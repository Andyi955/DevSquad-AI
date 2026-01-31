import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from agents.review_agent import ReviewAgent
from services.file_manager import FileManager

class ReviewService:
    """
    Manages the background review process.
    Stores reviews in memory and handles prompt updates.
    """
    
    def __init__(self, file_manager: FileManager):
        self.reviewer = ReviewAgent()
        self.file_manager = file_manager
        self.reviews: List[Dict[str, Any]] = [] # History of reviews
        self.latest_stats: Dict[str, Any] = {}
        self._lock = asyncio.Lock()
        
    async def trigger_review(self, conversation_history: list) -> Dict[str, Any]:
        """
        Trigger a review of the current conversation history.
        This is typically called in a background task.
        """
        print("🕵️‍♂️ [ReviewService] Starting background review...")
        try:
            # The agent returns a JSON string
            json_response = await self.reviewer.review_history(conversation_history)
            
            # Parse it
            review_data = json.loads(json_response)
            
            # Timestamp it
            review_data["timestamp"] = datetime.now().isoformat()
            
            async with self._lock:
                self.reviews.append(review_data)
                # Update latest stats (simple aggregation for now)
                self.latest_stats = self._calculate_stats()
                
            print(f"✅ [ReviewService] Review complete. Score: {self._get_latest_score(review_data)}")
            return review_data
            
        except Exception as e:
            print(f"❌ [ReviewService] Review failed: {e}")
            return {"error": str(e)}

    def get_latest_data(self) -> Dict[str, Any]:
        """Get the latest reviews and stats for the dashboard"""
        return {
            "reviews": self.reviews[-5:], # Last 5 reviews
            "stats": self.latest_stats,
            "total_reviews": len(self.reviews)
        }

    async def apply_improvement(self, suggestion: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply a suggestion to a file.
        suggestion: { "target_file": str, "proposed_content": str, "description": str }
        """
        target_file = suggestion.get("target_file")
        content = suggestion.get("proposed_content")
        
        if not target_file or not content:
            return {"status": "error", "message": "Missing file or content"}
            
        # For reliability, we append instructions to the end of the file for now,
        # OR if the agent returned the FULL file, we overwrite.
        # Let's assume the agent might return a snippet.
        # Safer strategy: Create a pending change via FileManager so user can review diff.
        
        try:
            # We'll treat 'proposed_content' as a snippet to be reviewed by user.
            # But the user asked "maybe can implement the changes".
            # Let's try to append if it looks like a list item, or just write it.
            
            # Actually, the Orchestrator's `create_pending_change` is perfect here.
            # It allows the user to accept/reject via the UI.
            # But FileManager creates a change ID.
            
            # Let's read the file first to check context
            current_content = await self.file_manager.read_file(target_file)
            
            # If the content is valid, we propose a change
            # Strategy: We'll overwrite the file with the "Proposed Content" if it looks complete,
            # Or we append it. This is tricky for an automated agent.
            # Let's assuming the ReviewAgent is smart enough to give us a valid block.
            
            # For this version, we will create a NEW file with a suffix `.suggested.md`
            # and let the user compare, OR we just use the pending change system.
            
            # Let's use the pending change system from FileManager
            change_id = await self.file_manager.create_pending_change(
                path=target_file,
                content=content,
                agent="Review Agent",
                action="edit" # or "audit"
            )
            
            return {
                "status": "success", 
                "message": "Change proposed", 
                "change_id": change_id
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _get_latest_score(self, review_data):
        if "reviews" in review_data and len(review_data["reviews"]) > 0:
            return review_data["reviews"][0].get("score", 0)
        return 0

    def _calculate_stats(self):
        """Aggregate scores over time"""
        scores = []
        for r in self.reviews:
            for item in r.get("reviews", []):
                scores.append({
                    "timestamp": r["timestamp"],
                    "score": item.get("score", 0),
                    "agent": item.get("agent_name", "Unknown")
                })
        return {"history": scores}
