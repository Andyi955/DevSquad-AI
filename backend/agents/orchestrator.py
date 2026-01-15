"""
Agent Orchestrator
Manages multi-agent conversations and handles cue-based handoffs
"""

import re
import asyncio
from typing import Dict, List, Optional, AsyncGenerator, Any
from dataclasses import dataclass, field
from datetime import datetime

from .senior_dev import SeniorDevAgent
from .junior_dev import JuniorDevAgent
from .unit_tester import UnitTesterAgent
from .researcher import ResearcherAgent


@dataclass
class Message:
    """Represents a message in the conversation"""
    agent: str
    content: str
    thoughts: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    cues: List[str] = field(default_factory=list)


class AgentOrchestrator:
    """Orchestrates multi-agent conversations"""
    
    # Agent cue mapping
    CUE_TO_AGENT = {
        "SENIOR": "Senior Dev",
        "JUNIOR": "Junior Dev",
        "TESTER": "Unit Tester",
        "RESEARCH": "Researcher",
        "SEARCH": "Search",
        "FILE_SEARCH": "FileSearch"
    }
    
    def __init__(self, usage_tracker=None, file_manager=None):
        self.usage_tracker = usage_tracker
        self.file_manager = file_manager
        self.agents: Dict[str, Any] = {}
        self.conversation: List[Message] = []
        self.pending_file_changes: List[dict] = []
        self.last_handoff: Optional[str] = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize all agents"""
        if self.initialized:
            return
        
        self.agents = {
            "Senior Dev": SeniorDevAgent(),
            "Junior Dev": JuniorDevAgent(),
            "Unit Tester": UnitTesterAgent(),
            "Researcher": ResearcherAgent()
        }
        self.initialized = True
        print("✅ All agents initialized")
    
    def get_agent_status(self) -> List[dict]:
        """Get status of all agents"""
        return [agent.get_info() for agent in self.agents.values()]
    
    def _select_initial_agent(self, message: str) -> str:
        """Select which agent should respond first based on message content"""
        message_lower = message.lower()
        
        # Check for explicit agent mentions
        if any(word in message_lower for word in ["test", "testing", "coverage", "unit test"]):
            return "Unit Tester"
        elif any(word in message_lower for word in ["research", "search", "find", "look up", "latest", "docs"]):
            return "Researcher"
        elif any(word in message_lower for word in ["implement", "create", "build", "code"]):
            return "Junior Dev"
        else:
            # Default to Senior Dev for reviews and general questions
            return "Senior Dev"
    
    def _extract_cues(self, content: str) -> List[str]:
        """Extract cues from agent response"""
        cues = []
        
        # Check for handoff cues
        for cue_name in self.CUE_TO_AGENT.keys():
            if f"[→{cue_name}]" in content:
                cues.append(cue_name)
        
        # Check for file edit cues
        edit_pattern = r'\[EDIT_FILE:([^\]]+)\]'
        edits = re.findall(edit_pattern, content)
        for path in edits:
            cues.append(f"EDIT:{path}")
        
        create_pattern = r'\[CREATE_FILE:([^\]]+)\]'
        creates = re.findall(create_pattern, content)
        for path in creates:
            cues.append(f"CREATE:{path}")
        
        # Check for search cues
        search_pattern = r'\[SEARCH:([^\]]+)\]'
        searches = re.findall(search_pattern, content)
        for query in searches:
            cues.append(f"SEARCH:{query.strip()}")

        # Check for file search cues
        file_search_pattern = r'\[FILE_SEARCH:([^\]]+)\]'
        file_searches = re.findall(file_search_pattern, content)
        for pattern in file_searches:
            cues.append(f"FILE_SEARCH:{pattern.strip()}")

        # Check for done cue
        if "[DONE]" in content:
            cues.append("DONE")
        
        return cues
    
    def _extract_code_block(self, content: str) -> str:
        """Extract the first code block from content, or return content if none found"""
        # Look for ```code``` blocks
        pattern = r'```(?:\w+)?\n(.*?)\n```'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            return match.group(1).strip()
        
        # Fallback: if no code block but starts/ends with something look-alike
        # or just return the trimmed content
        return content.strip()
    
    async def process_message(
        self, 
        message: str, 
        context: dict = None,
        stream: bool = True
    ) -> dict:
        """Process a message (non-streaming)"""
        
        # Select initial agent
        agent_name = self._select_initial_agent(message)
        agent = self.agents[agent_name]
        
        # Build context with conversation history
        full_context = context or {}
        full_context["conversation"] = [
            {"agent": m.agent, "content": m.content} 
            for m in self.conversation[-10:]
        ]
        
        # Generate response
        response = await agent.generate(message, full_context)
        
        # Extract cues
        cues = self._extract_cues(response)
        
        # Track usage
        if self.usage_tracker:
            self.usage_tracker.track(agent.provider, 1)
        
        # Save to conversation
        msg = Message(agent=agent_name, content=response, cues=cues)
        self.conversation.append(msg)
        
        return {
            "agent": agent_name,
            "emoji": agent.emoji,
            "color": agent.color,
            "content": response,
            "cues": cues
        }
    
    async def process_message_stream(
        self, 
        message: str, 
        context: dict = None,
        max_turns: int = 5,
        initial_agent: str = None
    ) -> AsyncGenerator[Dict, None]:
        """
        Process a message with streaming responses
        Yields events as agents respond and hand off
        """
        from services.web_scraper import WebScraper
        scraper = WebScraper()
        
        # Ensure initialized
        if not self.initialized:
            await self.initialize()
        
        # Select initial agent
        current_agent_name = initial_agent or self._select_initial_agent(message)
        current_message = message
        turn = 0
        
        # Build context with conversation history
        full_context = context or {}
        full_context["conversation"] = [
            {"agent": m.agent, "content": m.content} 
            for m in self.conversation[-20:]
        ]
        
        while turn < max_turns:
            turn += 1
            agent = self.agents[current_agent_name]
            
            # Announce agent starting
            yield {
                "type": "agent_start",
                "agent": current_agent_name,
                "emoji": agent.emoji,
                "color": agent.color,
                "turn": turn
            }
            
            # Collect full response for cue extraction
            full_response = ""
            full_thoughts = ""
            
            # Stream agent response
            async for event in agent.think(current_message, full_context):
                if event.get("update_state"):
                    continue
                    
                if event["type"] == "thought":
                    full_thoughts += event["content"]
                    yield {
                        "type": "thought",
                        "agent": current_agent_name,
                        "content": event["content"]
                    }
                elif event["type"] == "message":
                    full_response += event["content"]
                    yield {
                        "type": "message",
                        "agent": current_agent_name,
                        "content": event["content"]
                    }
                elif event["type"] == "error":
                    yield {
                        "type": "error",
                        "agent": current_agent_name,
                        "content": event["content"]
                    }
            
            # Track usage
            if self.usage_tracker:
                self.usage_tracker.track(agent.provider, 1)
            
            # Save to conversation
            msg = Message(
                agent=current_agent_name, 
                content=full_response,
                thoughts=full_thoughts,
                cues=self._extract_cues(full_response)
            )
            self.conversation.append(msg)
            
            # Update context with this response
            full_context["conversation"].append({
                "agent": current_agent_name,
                "content": full_response
            })
            
            # Extract cues and determine next action
            cues = self._extract_cues(full_response)
            
            # Check for file changes
            file_edit_proposed = False
            for cue in cues:
                if (cue.startswith("EDIT:") or cue.startswith("CREATE:")) and self.file_manager:
                    # Extract file path and notify frontend
                    path = cue.split(":", 1)[1]
                    action = "edit" if cue.startswith("EDIT:") else "create"
                    
                    # Extract actual code from response
                    code_content = self._extract_code_block(full_response)
                    
                    # Register pending change in file_manager to get an ID
                    change_id = await self.file_manager.create_pending_change(
                        path=path,
                        content=code_content,
                        agent=current_agent_name
                    )
                    
                    # Get the pending change details for the frontend
                    pending_changes = self.file_manager.get_pending_changes()
                    change_details = next((c for c in pending_changes if c['id'] == change_id), None)

                    if change_details:
                        yield {
                            "type": "file_change",
                            "change_id": change_id,
                            "action": action,
                            "path": path,
                            "agent": current_agent_name,
                            "new_content": change_details['new_content'],
                            "old_content": change_details['old_content']
                        }
                        file_edit_proposed = True
            
            # Check for search cues
            search_query = None
            for cue in cues:
                if cue.startswith("SEARCH:"):
                    search_query = cue.split(":", 1)[1]
                    break
            
            # Check for file search cues
            file_search_pattern = None
            for cue in cues:
                if cue.startswith("FILE_SEARCH:"):
                    file_search_pattern = cue.split(":", 1)[1]
                    break
            
            if file_search_pattern:
                yield {
                    "type": "agent_status",
                    "status": f"Searching for files: {file_search_pattern}..."
                }

                # Perform file search
                matching_files = await self.file_manager.list_files(file_search_pattern)
                file_list_str = "\n".join([f"- {f['path']} ({f['size']} bytes)" for f in matching_files])
                
                if not matching_files:
                    current_message = f"I searched for files matching '{file_search_pattern}' but found no results."
                else:
                    current_message = f"Found {len(matching_files)} files matching '{file_search_pattern}':\n\n{file_list_str}\n\nYou can ask the user to provide the content of any of these if you need to analyze them deeply."

                # Continue the loop with the same agent
                continue

            if search_query:
                yield {
                    "type": "agent_status",
                    "status": f"Searching for: {search_query}..."
                }
                
                # Perform search
                results = await scraper.search_and_summarize(search_query)
                
                # Broadcast results to frontend for cards
                yield {
                    "type": "research_results",
                    "query": search_query,
                    "results": results.get("search_results", [])
                }
                
                # Feed findings back to agent
                findings_summary = "\n".join([
                    f"- {r['title']}: {r['snippet']} ({r['url']})" 
                    for r in results.get("search_results", [])[:5]
                ])
                
                current_message = f"Web search results for '{search_query}':\n\n{findings_summary}\n\nPlease summarize these findings for the user."
                # We continue the loop with the SAME agent but new message (findings)
                continue

            # Check for handoff
            handoff_agent = None
            handoff_cue = None
            for cue in cues:
                if cue in self.CUE_TO_AGENT:
                    handoff_agent = self.CUE_TO_AGENT[cue]
                    handoff_cue = cue
                    break

            # If file edit proposed, we pause here to let user review
            if file_edit_proposed:
                self.last_handoff = handoff_agent
                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Pausing for file review... ⏸️"
                }
                break

            # Check for done
            if "DONE" in cues:
                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Task completed! ✅"
                }
                break
            
            if handoff_agent:
                yield {
                    "type": "handoff",
                    "from_agent": current_agent_name,
                    "to_agent": handoff_agent,
                    "cue": handoff_cue
                }
                
                # Set up for next turn
                current_agent_name = handoff_agent
                current_message = f"Previous agent ({msg.agent}) said:\n\n{full_response}\n\nPlease continue with your expertise."
            else:
                # No handoff, we're done
                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Response complete"
                }
                break
        
        # Final complete event
        yield {
            "type": "complete",
            "turns": turn,
            "conversation_length": len(self.conversation)
        }
    
    async def handle_approval_signal(self, approved: bool, feedback: str = None) -> Dict:
        """Handle signal from UI that approval/rejection is complete"""
        # Determine next agent
        current_agent_name = None
        message = ""
        
        # Get the agent who last spoke (from history)
        last_msg = self.conversation[-1] if self.conversation else None
        last_agent_name = last_msg.agent if last_msg else "Senior Dev"
        
        if approved:
            if self.last_handoff:
                current_agent_name = self.last_handoff
                message = f"User approved the changes. {last_agent_name} has handed off to you. Please proceed."
            else:
                current_agent_name = last_agent_name
                message = "User approved the changes. Great job! Is there anything else?"
        else:
            # Rejection - stick with same agent or go to requester if feedback exists
            current_agent_name = last_agent_name
            message = "User rejected the changes"
            if feedback:
                message += f" with feedback: {feedback}"
            else:
                message += ". Please try a different approach."
        
        # Clear last handoff
        self.last_handoff = None
        
        return {
            "next_agent": current_agent_name,
            "message": message
        }

    def clear_conversation(self):
        """Clear conversation history"""
        self.conversation = []
        self.last_handoff = None
        return {"status": "cleared"}
