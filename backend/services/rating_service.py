import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

class RatingService:
    """
    Manages user ratings for agent responses.
    Saves ratings to a persistent 'knowledge' file that the OptimizerAgent can consume.
    """
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.ratings_file = self.data_dir / "agent_ratings.json"
        self.optimizer_lessons_file = self.data_dir / "optimizer_lessons.json"
        
        # Ensure files exist
        if not self.ratings_file.exists():
            with open(self.ratings_file, 'w') as f:
                json.dump([], f)
        
        if not self.optimizer_lessons_file.exists():
            with open(self.optimizer_lessons_file, 'w') as f:
                json.dump({"lessons": []}, f)

    async def save_rating(self, rating_data: Dict[str, Any]):
        """
        Saves a user rating.
        rating_data: { 
            "message_id": str, 
            "agent_name": str, 
            "content": str, 
            "rating": int (1 or -1), 
            "feedback": str (optional)
        }
        """
        rating_data["timestamp"] = datetime.now().isoformat()
        
        # Load existing ratings
        try:
            with open(self.ratings_file, 'r', encoding='utf-8') as f:
                ratings = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            ratings = []
            
        ratings.append(rating_data)
        
        # Keep only the last 1000 ratings
        ratings = ratings[-1000:]
        
        with open(self.ratings_file, 'w', encoding='utf-8') as f:
            json.dump(ratings, f, indent=2)
            
        print(f"⭐ [RatingService] Captured rating for {rating_data['agent_name']}: {rating_data['rating']}")
        
        # If negative rating, prioritize creating a lesson for the optimizer
        if rating_data["rating"] == -1:
            await self._update_optimizer_lessons(rating_data)

    async def _update_optimizer_lessons(self, rating_data: Dict[str, Any]):
        """
        Extracts a 'lesson' from a negative rating for the OptimizerAgent.
        """
        lesson = {
            "timestamp": rating_data["timestamp"],
            "agent": rating_data["agent_name"],
            "problem": "User gave negative feedback",
            "content_snippet": rating_data["content"][:200] + "...",
            "feedback": rating_data.get("feedback", "No specific feedback provided"),
            "status": "pending_optimization"
        }
        
        try:
            with open(self.optimizer_lessons_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = {"lessons": []}
            
        data["lessons"].append(lesson)
        
        # Keep only last 50 lessons
        data["lessons"] = data["lessons"][-50:]
        
        with open(self.optimizer_lessons_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def get_lessons_for_optimizer(self) -> str:
        """Returns a string summary of lessons for the OptimizerAgent's context"""
        try:
            with open(self.optimizer_lessons_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            lessons = data.get("lessons", [])
            if not lessons:
                return "No specific user feedback lessons captured yet."
                
            summary = ["## Recent User Feedback Lessons:"]
            for l in lessons[-10:]: # Last 10
                summary.append(f"- Agent {l['agent']}: {l['feedback']} (Context: {l['content_snippet']})")
            
            return "\n".join(summary)
        except Exception:
            return "Error loading user feedback lessons."
