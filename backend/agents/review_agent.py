"""
Review Agent
Silent observer that critiques performance and suggests improvements.
Powered by Gemini 3 Flash.
"""

from .base_agent import BaseAgent

class ReviewAgent(BaseAgent):
    """
    The Review Agent observes the conversation in the background (Shadow Mode).
    It outputs structured JSON reviews to be displayed on the Dashboard.
    """
    
    def __init__(self):
        super().__init__(
            name="Review Agent",
            emoji="🕵️‍♂️",
            provider="gemini",
            # User explicitly requested gemini-3-flash-preview
            model="gemini-3-flash-preview", 
            color="#ec4899"  # Pink/Magenta for distinct visibility
        )
    
    def _prompt_name(self) -> str:
        return "review_agent"
    
    def _default_prompt(self) -> str:
        return "You are a helpful review agent."
    
    async def review_history(self, conversation_history: list) -> str:
        """
        Special method to trigger a review of the provided history.
        """
        # We manually construct a prompt here because this isn't a standard 'think' loop user message
        
        # Format history for the reviewer
        history_text = ""
        for msg in conversation_history:
            thought_text = f"\n(Hidden Thought: {msg.thoughts})\n" if msg.thoughts else ""
            history_text += f"\n=== {msg.agent} ===\n{thought_text}{msg.content}\n"
            
        prompt = f"""
        MESSAGE HISTORY TO REVIEW:
        {history_text}
        
        INSTRUCTIONS:
        Analyze the above history. 
        Generate a performance review JSON object as defined in your system prompt.
        """
        
        # Call generate directly (non-streaming preferred for JSON blobs, but we can stream if needed)
        # Using the base class's generate method
        response = await self.generate(prompt)
        
        # Strip markdown code blocks if present to get raw JSON
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            # Fallback for generic blocks
            response = response.split("```")[1].split("```")[0].strip()
            
        return response
