"""
Optimizer Agent
Reads Review Agent reports and edits prompts/code to improve agent performance
"""

import os
import re
import json
from typing import Dict, List, Optional, Any
from pathlib import Path
from google import genai
from google.genai import types


class OptimizerAgent:
    """Agent that optimizes other agents by editing their prompts and code"""
    
    def __init__(self, rating_service=None):
        self.name = "Optimizer"
        self.emoji = "⚡"
        self.model = "gemini-3-flash-preview"
        self.scoring_history: list = []  # Track scores across optimization iterations
        self.temperature = 0.3
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.rating_service = rating_service
        
        # Paths for editing
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self.agents_dir = Path(__file__).parent
        
        # Track changes made
        self.changes_history: List[dict] = []
        
        self.system_prompt = self._load_prompt()
    
    def _load_prompt(self) -> str:
        """Load optimizer prompt from file or use default"""
        prompt_path = self.prompts_dir / "optimizer.md"
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return self._default_prompt()
    
    def _default_prompt(self) -> str:
        return """# Optimizer Agent ⚡

You are the **performance optimizer** for a multi-agent development team.
Your job is to analyze Review Agent reports and improve agent behavior by editing their prompts and code.

## Your Responsibilities
1. **Identify Patterns**: Find recurring issues in Review reports (e.g., "Junior Dev skips handoffs")
2. **Propose Fixes**: Suggest specific edits to prompt files or agent code
3. **Prioritize**: Focus on high-impact changes that fix frequent issues

## Files You Can Edit
- `backend/prompts/*.md` - Agent system prompts
- `backend/agents/*.py` - Agent code (especially temperature values)

## Rules
- Make MINIMAL changes - don't rewrite entire prompts
- Be SPECIFIC - say exactly what line to change
- Explain WHY - connect the change to the Review report issue
- NEVER break existing functionality

## Output Format (JSON only)
{
  "analysis": "Summary of issues found in reviews",
  "changes": [
    {
      "file": "prompts/junior_dev.md",
      "action": "append",
      "content": "CRITICAL: Always end with [→SENIOR] after implementation!",
      "reason": "Junior Dev missed handoffs in 3/5 reviews"
    }
  ],
  "summary": "Applied X changes to fix Y issues"
}

Actions can be: "append", "prepend", "replace_line", "adjust_temperature"
For "adjust_temperature", include "new_value" field.
For "replace_line", include "target" (text to find) and "replacement" fields.
"""
    
    async def optimize_agents(self, review_history: List[dict]) -> Dict[str, Any]:
        """
        Analyze review history and propose optimizations (does NOT apply them).
        
        Args:
            review_history: List of review report dicts with scores, critiques, etc.
            
        Returns:
            Dict with analysis, suggested changes, and summary
        """
        
        if not review_history:
            return {
                "analysis": "No review history to analyze",
                "changes": [],
                "summary": "No optimizations needed"
            }
        
        # Build analysis prompt
        prompt = self._build_optimization_prompt(review_history)
        
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=self.temperature,
                    max_output_tokens=4096
                )
            )
            
            result_text = response.text.strip()
            
            # Parse JSON response
            if result_text.startswith("```"):
                result_text = re.sub(r'^```(?:json)?\n?', '', result_text)
                result_text = re.sub(r'\n?```$', '', result_text)
            
            result = json.loads(result_text)
            
            # We no longer apply changes here. We return them for approval.
            result["summary"] = f"Proposed {len(result.get('changes', []))} optimizations based on {len(review_history)} reports"
            
            print(f"⚡ [Optimizer] {result['summary']}")
            return result
            
        except json.JSONDecodeError as e:
            print(f"⚠️ [Optimizer] Failed to parse response: {e}")
            return {"analysis": "Parse error", "changes": [], "summary": "Failed to parse optimizer response"}
        except Exception as e:
            print(f"❌ [Optimizer] Optimization error: {e}")
            return {"analysis": str(e), "changes": [], "summary": "Optimization failed"}
    
    def _build_optimization_prompt(self, review_history: List[dict]) -> str:
        """Build the optimization analysis prompt with more context"""
        
        parts = ["## Review History Analysis\n\n"]
        
        # Add User Feedback Lessons if available
        if self.rating_service:
            parts.append(self.rating_service.get_lessons_for_optimizer() + "\n\n")

        # Add scoring history so optimizer can see if previous edits helped or hurt
        if self.scoring_history:
            parts.append("## 📈 Optimization Scoring History\n\n")
            parts.append("Previous iterations and their results (did your last edits help or hurt?):\n")
            for entry in self.scoring_history[-10:]:
                direction = "📈" if entry.get("delta", 0) > 0 else "📉" if entry.get("delta", 0) < 0 else "➡️"
                parts.append(f"- Iteration {entry['iteration']}: score {entry['score']:.1f} "
                           f"{direction} (delta: {entry.get('delta', 0):+.1f}) "
                           f"changes: {entry.get('changes_summary', 'none')}\n")
            parts.append("\n")

        # Summarize reviews by agent
        agent_issues = {}
        for review in review_history:
            for r in review.get("reviews", []):
                agent = r.get("agent_name", "Unknown")
                if agent not in agent_issues:
                    agent_issues[agent] = {"scores": [], "critiques": []}
                agent_issues[agent]["scores"].append(r.get("score", 0))
                agent_issues[agent]["critiques"].extend(r.get("critique", []))
        
        for agent, data in agent_issues.items():
            avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
            parts.append(f"### {agent} (Avg Score: {avg_score:.1f})\n")
            parts.append("Critiques:\n")
            for critique in data["critiques"][:30]:
                parts.append(f"- {critique}\n")
            parts.append("\n")
        
        # Include current prompt snippets for context
        parts.append("## Current Prompt Context\n\n")
        for prompt_file in self.prompts_dir.glob("*.md"):
            try:
                content = prompt_file.read_text(encoding="utf-8")
                parts.append(f"### {prompt_file.name}\n```\n{content[:2000]}...\n```\n\n")
            except:
                pass
        
        parts.append("## Your Task\nAnalyze the issues and propose specific changes to fix them. "
                     "You may use 'full_rewrite' action for major prompt overhauls. Return JSON.")
        
        return "".join(parts)
    
    async def apply_optimization(self, change: dict) -> bool:
        """Apply a single change to a file (Public method)"""
        
        file_path = change.get("file", "")
        action = change.get("action", "")
        
        # Resolve path
        if file_path.startswith("prompts/"):
            full_path = self.prompts_dir / file_path.replace("prompts/", "")
        elif file_path.startswith("agents/"):
            full_path = self.agents_dir / file_path.replace("agents/", "")
        elif file_path.startswith("backend/"):
            full_path = Path(__file__).parent.parent / file_path.replace("backend/", "")
        else:
            print(f"⚠️ [Optimizer] Unknown path format: {file_path}")
            return False
        
        if not full_path.exists():
            print(f"⚠️ [Optimizer] File not found: {full_path}")
            return False
        
        try:
            content = full_path.read_text(encoding="utf-8")
            
            if action == "append":
                new_content = content + "\n\n" + change.get("content", "")
            elif action == "prepend":
                new_content = change.get("content", "") + "\n\n" + content
            elif action == "replace_line":
                target = change.get("target", "")
                replacement = change.get("replacement", "")
                if target in content:
                    new_content = content.replace(target, replacement, 1)
                else:
                    print(f"⚠️ [Optimizer] Target not found for replace: {target[:50]}")
                    return False
            elif action == "adjust_temperature":
                # Special handling for temperature in Python files
                new_temp = change.get("new_value", 0.2)
                pattern = r'temperature\s*=\s*[\d.]+'
                if re.search(pattern, content):
                    new_content = re.sub(pattern, f'temperature={new_temp}', content)
                else:
                    print(f"⚠️ [Optimizer] No temperature found in {file_path}")
                    return False
            elif action == "full_rewrite":
                # Complete prompt replacement (used during optimization loops)
                new_content = change.get("content", "")
                if not new_content:
                    print(f"⚠️ [Optimizer] No content for full_rewrite")
                    return False
                print(f"📝 [Optimizer] Full rewrite of {file_path}")
            else:
                print(f"⚠️ [Optimizer] Unknown action: {action}")
                return False
            
            # Write the changes
            full_path.write_text(new_content, encoding="utf-8")
            print(f"✅ [Optimizer] Applied {action} to {file_path}: {change.get('reason', 'No reason')}")
            
            # Track history after success
            self.changes_history.append(change)
            return True
            
        except Exception as e:
            print(f"❌ [Optimizer] Failed to apply change to {file_path}: {e}")
            return False
    
    def get_changes_summary(self) -> str:
        """Get a summary of all changes made"""
        if not self.changes_history:
            return "No optimizations applied yet."
        
        lines = [f"## Optimization History ({len(self.changes_history)} changes)"]
        for change in self.changes_history[-10:]:  # Last 10
            lines.append(f"- {change.get('file')}: {change.get('action')} - {change.get('reason', 'N/A')}")
        return "\n".join(lines)
    
    def clear_history(self):
        """Clear changes history"""
        self.changes_history = []
