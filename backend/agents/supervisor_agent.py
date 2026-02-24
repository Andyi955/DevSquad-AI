"""
Supervisor Agent
Always-on background monitor that detects agent failures and injects corrections
"""

import os
import json
import re
from typing import Dict, List, Optional, Any
from google import genai
from google.genai import types


class SupervisorAgent:
    """Silent overseer that monitors all agent turns and detects failures"""
    
    def __init__(self):
        self.name = "Supervisor"
        self.emoji = "👁️"
        self.model = "gemini-3-flash-preview"
        self.temperature = 0.1  # Ultra-low for deterministic analysis
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
        # Session memory for learnings
        self.learnings: List[str] = []
        self.correction_count = 0
        self.max_corrections_per_turn = 2
        
        self.system_prompt = self._load_prompt()
    
    def _load_prompt(self) -> str:
        """Load supervisor prompt from file or use default"""
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "supervisor.md")
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                return f.read()
        return self._default_prompt()
    
    def _default_prompt(self) -> str:
        return """# Supervisor Agent 👁️

You are the **silent overseer** of a multi-agent development team.
You do NOT write code. You analyze agent behavior and detect failures.

## Your Responsibilities
1. **Detect Missing Handoffs**: If an agent implements something but doesn't include `[→SENIOR]` or `[→TESTER]`, flag it.
2. **Detect Incomplete Turns**: If an agent's thoughts say "I should hand off" but their message doesn't, flag it.
3. **Detect Missing Cues**: Every implementation turn MUST end with `[DONE]`. If missing, flag it.
4. **Learn from Reviews**: If Review Agent gave low scores for specific reasons, remember them.
5. **Never Be Lenient**: You exist to catch what others miss. A missed cue is a failure.

## Analysis Rules
- If agent says "I implemented X" or "I created X" → MUST have `[→SENIOR]` for review
- If agent says "Ready for review" → MUST have a handoff cue
- If agent completes a task → MUST have `[DONE]`
- If thoughts mention "hand off" or "pass to" → Message MUST contain the handoff

## Output Format (JSON only, no markdown)
{
  "status": "OK" | "NEEDS_CORRECTION" | "CRITICAL_FAILURE",
  "issue": "Brief description of the problem or null if OK",
  "correction_message": "Message to inject to fix the issue or null if OK",
  "learning": "Pattern to remember for future sessions or null"
}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, just the JSON object.
"""
    
    async def analyze_turn(
        self,
        agent_name: str,
        thoughts: str,
        message: str,
        cues_detected: List[str],
        checklist: List[dict],
        review_reports: List[dict] = None
    ) -> Dict[str, Any]:
        """
        Analyze an agent's turn for failures.
        
        Returns:
        {
            "status": "OK" | "NEEDS_CORRECTION" | "CRITICAL_FAILURE",
            "issue": str or None,
            "correction_message": str or None,
            "learning": str or None
        }
        """
        
        # Build analysis prompt
        prompt = self._build_analysis_prompt(
            agent_name, thoughts, message, cues_detected, checklist, review_reports
        )
        
        try:
            # Force JSON output if possible with this SDK version
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=self.temperature,
                    max_output_tokens=1024,
                    response_mime_type="application/json"
                )
            )
            
            result_text = response.text.strip()
            
            # Parse JSON response - handle various formats
            # 1. Try direct parse
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                # 2. Handle potential markdown code blocks
                if "```" in result_text:
                    result_text = re.sub(r'^```(?:json)?\n?', '', result_text, flags=re.MULTILINE)
                    result_text = re.sub(r'\n?```$', '', result_text, flags=re.MULTILINE)
                
                # 3. Try to extract the first/main JSON object
                # This regex is more robust for finding the JSON block even with text around it
                json_match = re.search(r'(\{.*\})', result_text, re.DOTALL)
                if json_match:
                    try:
                        result = json.loads(json_match.group(1))
                    except json.JSONDecodeError:
                        # 4. Clean up common issues like unescaped newlines within values
                        cleaned = re.sub(r'\n', ' ', json_match.group(1))
                        try:
                            result = json.loads(cleaned)
                        except:
                            raise ValueError("Could not parse JSON even after cleaning")
                else:
                    raise ValueError("No JSON object found in response")
            
            # Store learning if present
            if result.get("learning"):
                self.learnings.append(result["learning"])
                print(f"📚 [Supervisor] New learning: {result['learning']}")
            
            # Ensure required keys exist
            if "status" not in result:
                result["status"] = "OK"
            
            # Log analysis result
            status = result.get("status", "OK")
            if status == "OK":
                print(f"✅ [Supervisor] {agent_name} turn OK")
            elif status == "NEEDS_CORRECTION":
                print(f"⚠️ [Supervisor] {agent_name} needs correction: {result.get('issue')}")
                # Increment locally but Orchestrator also has its own counter
                self.correction_count += 1
            else:
                print(f"🚨 [Supervisor] {agent_name} CRITICAL: {result.get('issue')}")
            
            return result
            
        except json.JSONDecodeError as e:
            print(f"⚠️ [Supervisor] Failed to parse response: {e}")
            return {"status": "OK", "issue": None, "correction_message": None, "learning": None}
        except Exception as e:
            print(f"❌ [Supervisor] Analysis error: {e}")
            return {"status": "OK", "issue": None, "correction_message": None, "learning": None}
    
    def _build_analysis_prompt(
        self,
        agent_name: str,
        thoughts: str,
        message: str,
        cues_detected: List[str],
        checklist: List[dict],
        review_reports: List[dict] = None
    ) -> str:
        """Build the analysis prompt for the supervisor"""
        
        parts = [f"## Agent Turn Analysis\n\n**Agent**: {agent_name}\n"]
        
        if thoughts:
            parts.append(f"### Agent's Hidden Thoughts\n```\n{thoughts[:2000]}\n```\n\n")
        
        parts.append(f"### Agent's Visible Message\n```\n{message[:3000]}\n```\n\n")
        
        parts.append(f"### Cues Detected by Orchestrator\n{cues_detected}\n\n")
        
        if checklist:
            parts.append("### Current Mission Checklist\n")
            for item in checklist:
                status = "✅" if item.get('done') else "⬜"
                parts.append(f"- {status} {item.get('step')}. {item.get('description')}\n")
            parts.append("\n")
        
        if review_reports:
            parts.append("### Recent Review Agent Reports\n")
            for report in review_reports[-3:]:  # Last 3 reports
                parts.append(f"- Score: {report.get('score', 'N/A')} - {report.get('summary', 'No summary')}\n")
            parts.append("\n")
        
        if self.learnings:
            parts.append("### Your Previous Learnings\n")
            for learning in self.learnings[-5:]:  # Last 5 learnings
                parts.append(f"- {learning}\n")
            parts.append("\n")
        
        parts.append("## Your Task\nAnalyze this turn. Return JSON with status, issue, correction_message, and learning.")
        
        return "".join(parts)
    
    def should_allow_correction(self) -> bool:
        """Check if we should allow another correction (prevent loops)"""
        return self.correction_count < self.max_corrections_per_turn
    
    def reset_correction_count(self):
        """Reset correction count for new turn"""
        self.correction_count = 0
    
    def get_learnings_summary(self) -> str:
        """Get a summary of all learnings for context"""
        if not self.learnings:
            return ""
        return "## Supervisor Learnings\n" + "\n".join(f"- {l}" for l in self.learnings)
    
    def clear_session(self):
        """Clear session data for new chat"""
        self.learnings = []
        self.correction_count = 0
        print("🔄 [Supervisor] Session cleared")
