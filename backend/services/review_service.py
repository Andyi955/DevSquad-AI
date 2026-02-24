import asyncio
import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from agents.review_agent import ReviewAgent
from services.file_manager import FileManager

class ReviewService:
    """
    Manages the background review process with session support.
    - Current session reviews are shown in the dashboard
    - When a new chat starts, old reviews are archived to history
    - History is preserved across sessions
    """
    
    def __init__(self, file_manager: FileManager):
        self.reviewer = ReviewAgent()
        self.file_manager = file_manager
        
        # Current session
        self.session_id: str = str(uuid.uuid4())[:8]
        self.session_reviews: List[Dict[str, Any]] = []  # Reviews for current session
        self.session_start: str = datetime.now().isoformat()
        
        # Historical archive (persists across sessions)
        self.archived_sessions: List[Dict[str, Any]] = []  # List of past session summaries
        
        self.latest_stats: Dict[str, Any] = {}
        self._lock = asyncio.Lock()
    
    @property
    def review_history(self) -> List[Dict[str, Any]]:
        """Get all reviews from current session for Optimizer consumption"""
        return self.session_reviews
    
    @property
    def latest_review(self) -> Optional[Dict[str, Any]]:
        """Get the most recent review for Supervisor context"""
        return self.session_reviews[-1] if self.session_reviews else None
        
    def start_new_session(self) -> Dict[str, Any]:
        """
        Start a new review session. Archives current session and resets.
        Called when user starts a new chat.
        """
        # Only archive if there are reviews in the current session
        if self.session_reviews:
            # Calculate session summary
            all_scores = []
            for r in self.session_reviews:
                for item in r.get("reviews", []):
                    all_scores.append(item.get("score", 0))
            
            avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
            
            archived_session = {
                "session_id": self.session_id,
                "started_at": self.session_start,
                "ended_at": datetime.now().isoformat(),
                "review_count": len(self.session_reviews),
                "average_score": avg_score,
                "reviews": self.session_reviews  # Keep full reviews for history
            }
            
            self.archived_sessions.append(archived_session)
            print(f"📦 [ReviewService] Archived session {self.session_id} with {len(self.session_reviews)} reviews (avg: {avg_score})")
        
        # Reset for new session
        self.session_id = str(uuid.uuid4())[:8]
        self.session_reviews = []
        self.session_start = datetime.now().isoformat()
        self.latest_stats = {}
        
        print(f"🆕 [ReviewService] Started new session: {self.session_id}")
        
        return {
            "session_id": self.session_id,
            "archived_count": len(self.archived_sessions)
        }
        
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
            
            # Timestamp and session tag
            review_data["timestamp"] = datetime.now().isoformat()
            review_data["session_id"] = self.session_id
            
            async with self._lock:
                self.session_reviews.append(review_data)
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
            "session_id": self.session_id,
            "session_started": self.session_start,
            "reviews": self.session_reviews[-10:],  # Last 10 reviews from current session
            "stats": self.latest_stats,
            "total_reviews": len(self.session_reviews)
        }
    
    def get_history(self) -> Dict[str, Any]:
        """Get archived session history"""
        # Return summaries without full review content for lighter payload
        summaries = []
        for session in self.archived_sessions:
            summaries.append({
                "session_id": session["session_id"],
                "started_at": session["started_at"],
                "ended_at": session["ended_at"],
                "review_count": session["review_count"],
                "average_score": session["average_score"]
            })
        
        return {
            "current_session": self.session_id,
            "archived_sessions": summaries,
            "total_archived": len(self.archived_sessions)
        }
    
    def get_session_details(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get full details for a specific archived session"""
        for session in self.archived_sessions:
            if session["session_id"] == session_id:
                return session
        return None

    async def apply_improvement(self, suggestion: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply a suggestion to a file.
        suggestion: { "target_file": str, "proposed_content": str, "description": str }
        
        Supports editing:
        - Prompt files (backend/prompts/*.md)
        - Orchestrator logic (backend/agents/orchestrator.py)
        """
        target_file = suggestion.get("target_file")
        content = suggestion.get("proposed_content")
        
        if not target_file or not content:
            return {"status": "error", "message": "Missing file or content"}
        
        # Validate target file is in allowed list for safety
        allowed_files = [
            "backend/prompts/",
            "backend/agents/orchestrator.py"
        ]
        
        is_allowed = any(target_file.startswith(prefix) or target_file == prefix for prefix in allowed_files)
        if not is_allowed:
            return {
                "status": "error", 
                "message": f"Review Agent can only edit prompt files or orchestrator.py, not: {target_file}"
            }
            
        try:
            # Read current content for context
            current_content = await self.file_manager.read_file(target_file)
            
            # Use the pending change system from FileManager
            change_id = await self.file_manager.create_pending_change(
                path=target_file,
                content=content,
                agent="Review Agent",
                action="edit"
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
        """Aggregate scores over time for current session"""
        scores = []
        for r in self.session_reviews:
            for item in r.get("reviews", []):
                scores.append({
                    "timestamp": r["timestamp"],
                    "score": item.get("score", 0),
                    "agent": item.get("agent_name", "Unknown")
                })
        return {"history": scores}

