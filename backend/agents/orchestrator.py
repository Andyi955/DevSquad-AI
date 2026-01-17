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
        self.mission_status = "IDLE"
    
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
        
        # Check for explicit agent mentions with word boundaries
        # Use regex to avoid partial matches (e.g. "latest" matching "test")
        if re.search(r'\b(tests?|testing|coverage|unit tests?)\b', message, re.IGNORECASE):
            return "Unit Tester"
        
        # Researcher keywords
        # Note: "find" is very common, might be risky, but kept as per original design
        if re.search(r'\b(research|search|find|look up|latest|docs?|documentation)\b', message, re.IGNORECASE):
            return "Researcher"
        
        # Default to Junior Dev for implementation and general tasks
        return "Junior Dev"
    
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

        # Check for file delete cues
        delete_pattern = r'\[DELETE_FILE:([^\]]+)\]'
        deletes = re.findall(delete_pattern, content)
        for path in deletes:
            cues.append(f"DELETE:{path}")

        # Check for file read cues
        read_pattern = r'\[READ_FILE:([^\]]+)\]'
        reads = re.findall(read_pattern, content)
        for path in reads:
            cues.append(f"READ:{path}")

        # Check for done cue
        if "[DONE]" in content:
            cues.append("DONE")
        
        return cues
    
    def _extract_code_block(self, content: str, start_index: int = 0) -> Optional[tuple[str, int, int]]:
        """
        Extract the first code block from content starting at start_index.
        Returns: (code_content, start_pos, end_pos) or None
        """
        pattern = r'```(?:\w+)?\n(.*?)\n```'
        match = re.search(pattern, content[start_index:], re.DOTALL)
        if match:
            code_start = start_index + match.start()
            code_end = start_index + match.end()
            return match.group(1).strip(), code_start, code_end
        return None

    def _extract_all_edits(self, full_response: str) -> List[dict]:
        """
        Find all file cues and associate them with their respective code blocks.
        """
        edits = []
        # Find all EDIT/CREATE cues with their positions
        cue_pattern = r'\[(EDIT|CREATE)_FILE:([^\]]+)\]'
        for match in re.finditer(cue_pattern, full_response):
            action = match.group(1).lower()
            path = match.group(2)
            cue_end = match.end()
            
            # Find the code block specifically AFTER this cue
            extracted = self._extract_code_block(full_response, cue_end)
            if extracted:
                code_content, block_start, block_end = extracted
                # Only associate if there isn't another cue between this one and the block
                next_cue = re.search(cue_pattern, full_response[cue_end:block_start])
                if not next_cue:
                    edits.append({
                        "action": action,
                        "path": path,
                        "content": code_content,
                        "cue_start": match.start(),
                        "cue_end": match.end(),
                        "block_start": block_start,
                        "block_end": block_end
                    })
        return edits
    
    def _clean_message_for_display(self, message: str) -> str:
        """
        Clean up technical cues and placeholders for user-friendly display.
        """
        # 0. Flatten short code blocks that should have been inline
        # Matches: ```language\nword\n``` or just ```word```
        # This fixes agents accidentally using block code for single words/filenames
        def flatten_code_blocks(match):
            content = match.group(1).strip()
            # If it's short, has no spaces, or is just one line
            if len(content) < 40 and "\n" not in content and " " not in content:
                return f" `{content}` "
            return match.group(0) # Keep as is if it's "real" code

        # Updated regex: If there's content after ```, it must be followed by a newline to be a language tag
        message = re.sub(r'```(?:\w+\n)?\s*(.*?)\s*```', flatten_code_blocks, message, flags=re.DOTALL)

        # 1. Remove file edit/create/delete placeholders (internal ones)
        message = re.sub(r'\[File (Edit|Create|Delete): [^\]]+\]', '', message)
        
        # 2. Convert agent handoff cues to @ mentions
        cue_to_mention = {
            r'\[→SENIOR\]': '@Senior Dev',
            r'\[→JUNIOR\]': '@Junior Dev', 
            r'\[→TESTER\]': '@Unit Tester',
            r'\[→RESEARCH\]': '@Researcher',
        }
        
        for cue_pattern, mention in cue_to_mention.items():
            message = re.sub(cue_pattern, mention, message)
        
        # 3. Remove [DONE] tags
        message = re.sub(r'\[DONE\]', '', message)
        
        # 4. Remove technical cues with parameters
        message = re.sub(r'\[(SEARCH|FILE_SEARCH|READ_FILE|EDIT_FILE|CREATE_FILE|DELETE_FILE):[^\]]+\]', '', message)
        
        # 5. Clean up "ghost" punctuation left by tag removal
        # Remove trailing ":", " " and extra punctuation at ends of lines where tags were
        message = re.sub(r'[:\s]+(\n|$)', r'\1', message)
        
        # Consolidate newlines (max 2)
        message = re.sub(r'\n{3,}', '\n\n', message)

        # Fix punctuation starting on a new line (common after tag removal)
        # This turns:
        # "Something
        # . Next" -> "Something. Next"
        message = re.sub(r'\n\s*([.,!?;])', r'\1', message)
        
        # FIRST: Clean up spaces between closing backticks and punctuation
        # This handles cases like: "`code` ." -> "`code`."
        message = re.sub(r'`\s+([.,!?;])', r'`\1', message)
        
        # THEN: Fix remaining spaces before punctuation (for normal text)
        message = re.sub(r'(?<!`)\s+([.,!?;])(?![`])', r'\1', message)
        
        # CRITICAL: Strip punctuation immediately after triple-backtick code blocks
        # Pattern matches: ``` followed by optional whitespace, then punctuation
        # This prevents orphaned punctuation in the React UI
        message = re.sub(r'```\s*([.,;!?:])', r'```', message)
        
        # Avoid hanging prepositions/conjunctions at ends of lines if they were followed by a tag
        message = re.sub(r'\b(for|to|at|in|about|of|with|and|the)\s*\n', '\n', message)
        
        # 6. Final white-space collapse
        message = re.sub(r' +', ' ', message)
        message = message.strip()
        
        return message
    
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

        # Handle Mission State
        if self.mission_status == "IDLE":
            # Start new mission - Clear previous context to avoid confusion
            self.conversation = [] 
            self.mission_status = "IN_PROGRESS"
        
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
            suppress_message = False
            last_was_cue = False

            async for event in agent.think(current_message, full_context):
                if event.get("update_state"):
                    continue
                    
                if event["type"] == "thought":
                    full_thoughts += event.get("content", "")
                    yield {
                        "type": "thought",
                        "agent": current_agent_name,
                        "content": event.get("content", "")
                    }
                elif event["type"] == "message":
                    full_response += event.get("content", "")
                    
                    # Heuristic: if we just saw an EDIT/CREATE cue, and this chunk starts a code block,
                    # we start suppressing it from the chat stream.
                    if (last_was_cue or "[EDIT_FILE:" in full_response or "[CREATE_FILE:" in full_response) and "```" in event.get("content", ""):
                        suppress_message = True
                        yield {
                            "type": "agent_status",
                            "status": f"Generating code changes..."
                        }

                    if not suppress_message:
                        yield {
                            "type": "message",
                            "agent": current_agent_name,
                            "content": event.get("content", "")
                        }
                    
                    if "```" in event.get("content", "") and suppress_message and full_response.count("```") % 2 == 0:
                        # We closed the code block
                        suppress_message = False

                elif event["type"] == "error":
                    yield {
                        "type": "error",
                        "agent": current_agent_name,
                        "content": event.get("content", "Unknown error")
                    }
                elif event["type"] == "cue":
                    if event.get("content", "") in ["EDIT_FILE", "CREATE_FILE", "DELETE_FILE"]:
                        last_was_cue = True
            
            # Track usage
            if self.usage_tracker:
                self.usage_tracker.track(agent.provider, 1)
            
            # Extract cues and determine next action
            cues = self._extract_cues(full_response)
            
            # Extract all file edits and associate with their code blocks
            all_edits = self._extract_all_edits(full_response)
            file_edit_proposed = False
            
            # Map of positions to replace to avoid overlapping substitutions
            # Initialize this FIRST before using it later
            replacements = []
            
            for edit in all_edits:
                action = edit["action"]
                path = edit["path"]
                code_content = edit["content"]
                
                # Register pending change
                change_id = await self.file_manager.create_pending_change(
                    path=path,
                    content=code_content,
                    agent=current_agent_name,
                    action=action
                )
                
                pending_changes = self.file_manager.get_pending_changes()
                change_details = next((c for c in pending_changes if c['id'] == change_id), None)
                
                if change_details:
                    # Mark the range for placeholder replacement later
                    placeholder = f"[File {action.capitalize()}: {path}]"
                    replacements.append({
                        "start": edit["cue_start"],
                        "end": edit["block_end"],
                        "text": placeholder
                    })
                    
                    yield {
                        "type": "file_change",
                        "change_id": change_id,
                        "action": action,
                        "path": path,
                        "agent": current_agent_name,
                        "new_content": change_details['new_content'],
                        "old_content": change_details['old_content'],
                        "concise_message": None # We will build the full concise message once
                    }
                    file_edit_proposed = True
            
            # Check for deletions separately as they might not have code blocks
            delete_pattern = r'\[DELETE_FILE:([^\]]+)\]'
            for match in re.finditer(delete_pattern, full_response):
                path = match.group(1)
                change_id = await self.file_manager.create_pending_change(
                    path=path,
                    agent=current_agent_name,
                    action="delete"
                )
                
                pending_changes = self.file_manager.get_pending_changes()
                change_details = next((c for c in pending_changes if c['id'] == change_id), None)
                
                if change_details:
                    placeholder = f"[File Delete: {path}]"
                    replacements.append({
                        "start": match.start(),
                        "end": match.end(),
                        "text": placeholder
                    })
                    
                    yield {
                        "type": "file_change",
                        "change_id": change_id,
                        "action": "delete",
                        "path": path,
                        "agent": current_agent_name,
                        "new_content": change_details['new_content'],
                        "old_content": change_details['old_content'],
                        "concise_message": None
                    }
                    file_edit_proposed = True

            # Create a cleaned version for user display (always)
            clean_full_response = self._clean_message_for_display(full_response)
            
            # If we had replacements, we already have a partial clean_full_response
            # but let's re-clean it properly to handle both cases (edits or just technical tags)
            if replacements:
                # Re-apply replacements to the full response first to get the placeholders
                # then clean it using the display cleaner
                temp_clean = full_response
                for r in replacements:
                    temp_clean = temp_clean[:r["start"]] + r["text"] + temp_clean[r["end"]:]
                clean_full_response = self._clean_message_for_display(temp_clean)
            
            # Save to conversation - USE CLEANED/PLACEHOLDER VERSION
            # This ensures agents don't see giant code blocks or old content in history
            msg = Message(
                agent=current_agent_name, 
                content=clean_full_response,
                thoughts=full_thoughts,
                cues=cues
            )
            self.conversation.append(msg)
            
            # Update context with this response
            full_context["conversation"].append({
                "agent": current_agent_name,
                "content": msg.content
            })
                
            # Signal the final concise/cleaned message
            yield {
                "type": "message_update",
                "concise_message": clean_full_response
            }
            
            # Check for file read cues
            file_read_path = None
            for cue in cues:
                if cue.startswith("READ:"):
                    file_read_path = cue.split(":", 1)[1]
                    break
            
            if file_read_path:
                yield {
                    "type": "agent_status",
                    "status": f"Reading file: {file_read_path}..."
                }
                
                # Perform file read
                file_content = await self.file_manager.read_file(file_read_path)
                
                if file_content is None:
                    current_message = f"I tried to read '{file_read_path}' but it doesn't exist or is empty."
                else:
                    current_message = f"Content of '{file_read_path}':\n\n```\n{file_content}\n```\n\nI have read the file. Please continue with your analysis."
                
                # Continue the loop with the same agent
                continue

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
                matching_files = await self.file_manager.get_directory(file_search_pattern)
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
                self.mission_status = "IDLE" # Mark mission as complete
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
        
        # Check if they said they were done
        was_done = last_msg and "DONE" in last_msg.cues
        
        if approved:
            # If they were done and it's approved, we truly are finished
            if was_done:
                self.mission_status = "IDLE"
                self.last_handoff = None
                return {
                    "next_agent": None,
                    "message": None
                }
                
            if self.last_handoff:
                current_agent_name = self.last_handoff
                message = f"The user has approved the file changes from {last_agent_name}. You've been called in to help with the next step. Please proceed with your expertise."
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
