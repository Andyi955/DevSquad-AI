"""
Planner Agent
Creates structured task plans before agent execution
"""

import os
import re
import json
from typing import Dict, List, Optional, Any
from pathlib import Path
from google import genai
from google.genai import types
import uuid
from datetime import datetime


class PlannerAgent:
    """Creates structured task plans with agent ownership"""
    
    def __init__(self):
        self.name = "Planner"
        self.emoji = "📋"
        self.model = "gemini-3-flash-preview"
        self.temperature = 0.2
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
        # Load system prompt
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self.system_prompt = self._load_prompt()
        
        # Current plan state
        self.current_plan: Optional[Dict] = None
        self.plan_approved = False
    
    def _load_prompt(self) -> str:
        """Load planner prompt from file"""
        prompt_path = self.prompts_dir / "planner.md"
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return self._default_prompt()
    
    def _default_prompt(self) -> str:
        return """You are a strategic planner. Break down requests into tasks and assign to agents.
        Return JSON with: title, tasks (array with id, description, owner, depends_on)"""
    
    async def create_plan(self, user_request: str, research_context: str = None, **kwargs) -> Dict[str, Any]:
        """
        Generate a structured plan from user request.
        
        Args:
            user_request: What the user wants to build
            research_context: Optional context from Researcher
        """
        # Support both 'context' and 'research_context' for back-compat
        research_context = research_context or kwargs.get("context")
        
        # Build prompt
        prompt_parts = [f"## User Request\n{user_request}"]
        
        if research_context:
            prompt_parts.append(f"\n## Research Context\n{research_context}")
        
        prompt_parts.append("\n\nCreate a structured plan. Return JSON only.")
        prompt = "\n".join(prompt_parts)
        
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=self.temperature,
                    max_output_tokens=2048
                )
            )
            
            result_text = response.text.strip()
            
            # Parse JSON response
            if result_text.startswith("```"):
                result_text = re.sub(r'^```(?:json)?\n?', '', result_text)
                result_text = re.sub(r'\n?```$', '', result_text)
            
            # Extract JSON
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result_text = json_match.group(0)
            
            plan_data = json.loads(result_text)
            
            # Enrich with metadata
            plan = {
                "id": f"plan_{uuid.uuid4().hex[:8]}",
                "title": plan_data.get("title", "Untitled Plan"),
                "status": "pending_approval",
                "tasks": [],
                "research_needed": plan_data.get("research_needed", False),
                "research_query": plan_data.get("research_query"),
                "notes": plan_data.get("notes"),
                "created_at": datetime.now().isoformat(),
                "original_request": user_request
            }
            
            # Process tasks
            for task in plan_data.get("tasks", []):
                plan["tasks"].append({
                    "id": task.get("id", len(plan["tasks"]) + 1),
                    "description": task.get("description", ""),
                    "owner": task.get("owner", "SENIOR"),
                    "depends_on": task.get("depends_on"),
                    "status": "pending",
                    "completed_at": None
                })
            
            self.current_plan = plan
            self.plan_approved = False
            
            print(f"📋 [Planner] Created plan: {plan['title']} with {len(plan['tasks'])} tasks")
            return plan
            
        except json.JSONDecodeError as e:
            print(f"⚠️ [Planner] JSON parse error: {e}")
            return self._fallback_plan(user_request)
        except Exception as e:
            print(f"❌ [Planner] Error creating plan: {e}")
            return self._fallback_plan(user_request)
    
    def _fallback_plan(self, user_request: str) -> Dict[str, Any]:
        """Create a simple fallback plan if parsing fails"""
        return {
            "id": f"plan_{uuid.uuid4().hex[:8]}",
            "title": "Task Plan",
            "status": "pending_approval",
            "tasks": [
                {"id": 1, "description": f"Implement: {user_request}", "owner": "JUNIOR", "depends_on": None, "status": "pending"},
                {"id": 2, "description": "Review implementation", "owner": "SENIOR", "depends_on": 1, "status": "pending"},
                {"id": 3, "description": "Write tests", "owner": "TESTER", "depends_on": 2, "status": "pending"}
            ],
            "research_needed": False,
            "notes": "Fallback plan created due to parsing error",
            "created_at": datetime.now().isoformat(),
            "original_request": user_request
        }
    
    def approve_plan(self) -> bool:
        """Mark the current plan as approved"""
        if self.current_plan:
            self.current_plan["status"] = "approved"
            self.plan_approved = True
            print(f"✅ [Planner] Plan approved: {self.current_plan['title']}")
            return True
        return False
    
    def reject_plan(self) -> bool:
        """Reject and clear the current plan"""
        if self.current_plan:
            print(f"❌ [Planner] Plan rejected: {self.current_plan['title']}")
            self.current_plan = None
            self.plan_approved = False
            return True
        return False
    
    def modify_plan(self, modifications: Dict[str, Any]) -> Dict[str, Any]:
        """
        Modify the current plan.
        
        Args:
            modifications: Dict with potential keys:
                - add_task: {description, owner, after_id}
                - remove_task: task_id
                - update_task: {id, description?, owner?}
                
        Returns:
            Updated plan
        """
        if not self.current_plan:
            return {"error": "No current plan to modify"}
        
        # Add a new task
        if "add_task" in modifications:
            new_task = modifications["add_task"]
            new_id = max(t["id"] for t in self.current_plan["tasks"]) + 1
            self.current_plan["tasks"].append({
                "id": new_id,
                "description": new_task.get("description", ""),
                "owner": new_task.get("owner", "JUNIOR"),
                "depends_on": new_task.get("after_id"),
                "status": "pending"
            })
        
        # Remove a task
        if "remove_task" in modifications:
            task_id = modifications["remove_task"]
            self.current_plan["tasks"] = [
                t for t in self.current_plan["tasks"] if t["id"] != task_id
            ]
        
        # Update a task
        if "update_task" in modifications:
            update = modifications["update_task"]
            for task in self.current_plan["tasks"]:
                if task["id"] == update.get("id"):
                    if "description" in update:
                        task["description"] = update["description"]
                    if "owner" in update:
                        task["owner"] = update["owner"]
        
        return self.current_plan
    
    async def update_plan_from_feedback(self, feedback: str) -> Dict[str, Any]:
        """
        Update the current plan based on user text feedback.
        Uses LLM to interpret the feedback and modify the plan.
        """
        if not self.current_plan:
            return {"error": "No current plan to update"}
            
        print(f"📝 [Planner] Updating plan with feedback: {feedback}")
        
        # Prepare context
        current_plan_json = json.dumps(self.current_plan, indent=2)
        
        prompt = f"""
## Current Plan
```json
{current_plan_json}
```

## User Feedback
"{feedback}"

## Instructions
Update the plan based on the user's feedback. You can add, remove, or modify tasks.
Ensure the task IDs are sequential and dependencies are correct.
Keep the same JSON structure.
Return ONLY the updated JSON.
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=2048
                )
            )
            
            result_text = response.text.strip()
            # Clean markdown
            if result_text.startswith("```"):
                result_text = re.sub(r'^```(?:json)?\n?', '', result_text)
                result_text = re.sub(r'\n?```$', '', result_text)
                
            # Parse
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result_text = json_match.group(0)
                
            updated_plan = json.loads(result_text)
            
            # Validate and apply structure safety
            if "tasks" in updated_plan:
                # Update current plan
                self.current_plan["tasks"] = updated_plan["tasks"]
                self.current_plan["title"] = updated_plan.get("title", self.current_plan["title"])
                self.current_plan["notes"] = updated_plan.get("notes", self.current_plan.get("notes"))
                
                print(f"✅ [Planner] Plan updated. New task count: {len(self.current_plan['tasks'])}")
                return self.current_plan
            else:
                print("⚠️ [Planner] Updated plan missing 'tasks' field")
                return self.current_plan
                
        except Exception as e:
            print(f"❌ [Planner] Failed to update plan: {e}")
            return self.current_plan
    
    def complete_task(self, task_id: int) -> bool:
        """Mark a task as completed"""
        if not self.current_plan:
            return False
        
        for task in self.current_plan["tasks"]:
            if task["id"] == task_id:
                task["status"] = "completed"
                task["completed_at"] = datetime.now().isoformat()
                print(f"✅ [Planner] Task {task_id} completed")
                return True
        return False
    
    def get_next_task(self) -> Optional[Dict]:
        """Get the next pending task that has no unmet dependencies"""
        if not self.current_plan or not self.plan_approved:
            return None
        
        completed_ids = {t["id"] for t in self.current_plan["tasks"] if t["status"] == "completed"}
        
        for task in self.current_plan["tasks"]:
            if task["status"] == "pending":
                depends = task.get("depends_on")
                if depends is None or depends in completed_ids:
                    return task
        return None
    
    def get_plan_summary(self) -> str:
        """Get a formatted summary of the current plan"""
        if not self.current_plan:
            return "No active plan."
        
        plan = self.current_plan
        lines = [f"## {plan['title']}", f"Status: {plan['status']}", ""]
        
        for task in plan["tasks"]:
            status_icon = "✅" if task["status"] == "completed" else "⬜"
            lines.append(f"{status_icon} [{task['id']}] {task['description']} (→{task['owner']})")
        
        return "\n".join(lines)
    
    def clear(self):
        """Clear current plan"""
        self.current_plan = None
        self.plan_approved = False
