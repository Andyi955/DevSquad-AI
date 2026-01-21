"""
Agent Orchestrator
Manages multi-agent conversations and handles cue-based handoffs
"""

import re
import asyncio
from typing import Dict, List, Optional, AsyncGenerator, Any
from dataclasses import dataclass, field
from datetime import datetime
import os
import shutil
import aiofiles

from .senior_dev import SeniorDevAgent
from .junior_dev import JuniorDevAgent
from .unit_tester import UnitTesterAgent
from .researcher import ResearcherAgent
from .research_lead import ResearchLeadAgent
from .summarizer import SummarizerAgent


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
        "RESEARCHER": "Researcher",
        "LEAD": "Research Lead",
        "SEARCH": "Search",
        "FILE_SEARCH": "FileSearch"
    }
    
    def __init__(self, file_manager=None, scraper=None, usage_tracker=None):
        self.file_manager = file_manager
        self.scraper = scraper
        self.usage_tracker = usage_tracker
        self.agents: Dict[str, Any] = {}
        self.conversation: List[Message] = []
        self.pending_file_changes: List[dict] = []
        self.last_handoff: Optional[str] = None
        self.handoff_queue: List[str] = []  # Queue for sequential handoffs
        self.initialized = False
        self.mission_status = "IDLE"
        self._stop_event = asyncio.Event()
        
        # Mission Checklist tracking
        self.mission_checklist: List[dict] = []  # [{step: str, agent: str, done: bool}]
        self.mission_description: str = ""
    
    async def initialize(self):
        """Initialize all agents"""
        if self.initialized:
            return
        
        self.agents = {
            "Senior Dev": SeniorDevAgent(),
            "Junior Dev": JuniorDevAgent(),
            "Unit Tester": UnitTesterAgent(),
            "Researcher": ResearcherAgent(),
            "Research Lead": ResearchLeadAgent(),
            "Summarizer": SummarizerAgent()
        }
        self.initialized = True
        print("✅ All agents initialized")
    
    def get_agent_status(self) -> List[dict]:
        """Get status of all agents"""
        return [agent.get_info() for agent in self.agents.values()]
    
    def _extract_mission_checklist(self, content: str) -> bool:
        """
        Extract and store a Mission Checklist from agent response.
        Returns True if a checklist was found and parsed.
        
        Format:
        [MISSION_CHECKLIST]
        Mission: Description
        - [ ] 1. Step one (→AGENT)
        - [ ] 2. Step two (→AGENT)
        [/MISSION_CHECKLIST]
        """
        pattern = r'\[MISSION_CHECKLIST\](.*?)\[/MISSION_CHECKLIST\]'
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            return False
        
        checklist_text = match.group(1).strip()
        lines = checklist_text.split('\n')
        
        self.mission_checklist = []
        self.mission_description = ""
        
        for line in lines:
            line = line.strip()
            
            # Parse mission description
            if line.startswith('Mission:'):
                self.mission_description = line[8:].strip()
                continue
            
            # Parse checklist items: - [ ] 1. Description (→AGENT)
            item_match = re.match(r'-\s*\[([ x])\]\s*(\d+)\.\s*(.+?)(?:\s*\(→(\w+)\))?$', line)
            if item_match:
                done = item_match.group(1) == 'x'
                step_num = int(item_match.group(2))
                description = item_match.group(3).strip()
                agent = item_match.group(4) or "SENIOR"
                
                self.mission_checklist.append({
                    'step': step_num,
                    'description': description,
                    'agent': agent,
                    'done': done
                })
        
        if self.mission_checklist:
            print(f"📋 [Orchestrator] Parsed Mission Checklist: {len(self.mission_checklist)} items")
            for item in self.mission_checklist:
                status = "✅" if item['done'] else "⬜"
                print(f"   {status} {item['step']}. {item['description']} (→{item['agent']})")
            return True
        
        return False
    
    def _extract_checklist_updates(self, content: str) -> int:
        """
        Extract and apply checklist updates from agent response.
        Returns number of items updated.
        
        Format:
        [CHECKLIST_UPDATE]
        - [x] 2. Step description
        [/CHECKLIST_UPDATE]
        """
        pattern = r'\[CHECKLIST_UPDATE\](.*?)\[/CHECKLIST_UPDATE\]'
        matches = re.findall(pattern, content, re.DOTALL)
        
        updates_applied = 0
        
        for match in matches:
            lines = match.strip().split('\n')
            for line in lines:
                line = line.strip()
                # Parse: - [x] 2. Description
                item_match = re.match(r'-\s*\[(x)\]\s*(\d+)\.\s*(.+)', line)
                if item_match:
                    step_num = int(item_match.group(2))
                    
                    # Find and update the matching item
                    for item in self.mission_checklist:
                        if item['step'] == step_num and not item['done']:
                            item['done'] = True
                            updates_applied += 1
                            print(f"✅ [Orchestrator] Checklist updated: Step {step_num} marked complete")
                            break
        
        return updates_applied
    
    def _is_checklist_complete(self) -> bool:
        """Check if all checklist items are marked done"""
        if not self.mission_checklist:
            return True  # No checklist = can complete anytime
        
        return all(item['done'] for item in self.mission_checklist)
    
    def get_checklist_summary(self) -> str:
        """Get a formatted summary of the current checklist for agent context"""
        if not self.mission_checklist:
            return ""
        
        lines = [f"## Current Mission Checklist: {self.mission_description}"]
        for item in self.mission_checklist:
            status = "[x]" if item['done'] else "[ ]"
            lines.append(f"- {status} {item['step']}. {item['description']} (→{item['agent']})")
        
        completed = sum(1 for item in self.mission_checklist if item['done'])
        total = len(self.mission_checklist)
        lines.append(f"\n**Progress: {completed}/{total} complete**")
        
        if completed < total:
            lines.append(f"⚠️ Cannot use [PROJECT_COMPLETE] until all items are [x]")
        else:
            lines.append(f"✅ All items complete - [PROJECT_COMPLETE] is allowed")
        
        return "\n".join(lines)

    
    def _select_initial_agent(self, message: str) -> str:
        """Select which agent should respond first based on message content"""
        
        # 1. Check for explicit mentions first (Highest Priority)
        if re.search(r'\b(senior|lead|architect)\b', message, re.IGNORECASE):
            return "Senior Dev"
        if re.search(r'\b(junior|dev|implement)\b', message, re.IGNORECASE):
            return "Junior Dev"
        if re.search(r'\b(tester|tests?|testing|coverage)\b', message, re.IGNORECASE):
            return "Unit Tester"
        if re.search(r'\b(researcher|research|search|find)\b', message, re.IGNORECASE):
            return "Researcher"

        # 2. Key phrases/intents
        # Research keywords
        if re.search(r'\b(deep research|thorough research|analyze|report|synthesis|multiple sources|comparison)\b', message, re.IGNORECASE):
            return "Research Lead"
            
        if re.search(r'\b(docs?|documentation|latest news|look up)\b', message, re.IGNORECASE):
            return "Researcher"

        # Senior Dev for architectural decisions, complex planning, team requests, or building new things
        senior_keywords = [
            r'\b(team|build|create|design|architecture|plan|refactor|structure|feature|project|system)\b',
            r'\b(how should|best way|what is the best|organize)\b'
        ]
        if any(re.search(kw, message, re.IGNORECASE) for kw in senior_keywords):
            return "Senior Dev"
        
        # Default to Junior Dev for specific implementation, fixes, and direct tasks
        return "Junior Dev"
    
    def _extract_cues(self, content: str) -> List[str]:
        """Extract cues from agent response, respecting their order of appearance"""
        cue_hits = []
        
        # 1. Find explicit handoff tags [→AGENT]
        for cue_name in self.CUE_TO_AGENT.keys():
            pattern = re.escape(f"[→{cue_name}]")
            for match in re.finditer(pattern, content):
                cue_hits.append((match.start(), cue_name))
        
        # 2. Find @mentions as accidental handoffs
        mention_pattern = r'(@(Senior|Junior|Tester|Researcher)(?:\s*Dev)?)'
        for match in re.finditer(mention_pattern, content, re.IGNORECASE):
            full_mention = match.group(1)
            agent_found = match.group(2).upper()
            
            # Check context: Is this just a thank you?
            context_before = content[max(0, match.start() - 20):match.start()].lower()
            if any(keyword in context_before for keyword in ["thanks", "thank", "great work", "good job", "excellent"]):
                print(f"👋 [Orchestrator] Ignoring thank-you mention of {agent_found}")
                continue

            if agent_found in self.CUE_TO_AGENT:
                cue_hits.append((match.start(), agent_found))
        
        # 3. Find file edit cues
        edit_pattern = r'\[EDIT_FILE:([^\]]+)\]'
        for match in re.finditer(edit_pattern, content):
            path = match.group(1)
            cue_hits.append((match.start(), f"EDIT:{path}"))
        
        create_pattern = r'\[CREATE_FILE:([^\]]+)\]'
        for match in re.finditer(create_pattern, content):
            path = match.group(1)
            cue_hits.append((match.start(), f"CREATE:{path}"))

        # 4. Find search cues
        search_pattern = r'\[SEARCH:([^\]]+)\]'
        for match in re.finditer(search_pattern, content):
            query = match.group(1).strip().strip('"').strip("'")
            cue_hits.append((match.start(), f"SEARCH:{query}"))

        # 5. Find file search cues
        file_search_pattern = r'\[FILE_SEARCH:([^\]]+)\]'
        for match in re.finditer(file_search_pattern, content):
            pattern = match.group(1).strip()
            cue_hits.append((match.start(), f"FILE_SEARCH:{pattern}"))

        # 6. Find file delete cues
        delete_pattern = r'\[DELETE_FILE:([^\]]+)\]'
        for match in re.finditer(delete_pattern, content):
            path = match.group(1)
            cue_hits.append((match.start(), f"DELETE:{path}"))

        # 7. Find file read cues
        read_pattern = r'\[READ_FILE:([^\]]+)\]'
        for match in re.finditer(read_pattern, content):
            path = match.group(1)
            cue_hits.append((match.start(), f"READ:{path}"))

        # 8. Find web read cues
        web_read_pattern = r'\[READ_URL:([^\]]+)\]'
        for match in re.finditer(web_read_pattern, content):
            url = match.group(1).strip().strip('"').strip("'")
            cue_hits.append((match.start(), f"READ_URL:{url}"))

        # 9. Find sub-research cues (Deep Research)
        sub_research_pattern = r'\[SUB_RESEARCH:([^\]]+)\]'
        for match in re.finditer(sub_research_pattern, content):
            query = match.group(1).strip().strip('"').strip("'")
            cue_hits.append((match.start(), f"SUB_RESEARCH:{query}"))

        # 10. Check for DONE cue
        if "[DONE]" in content:
            pos = content.rfind("[DONE]")
            cue_hits.append((pos, "DONE"))
        
        # 11. Check for PROJECT_COMPLETE cue
        if "[PROJECT_COMPLETE]" in content:
            pos = content.rfind("[PROJECT_COMPLETE]")
            cue_hits.append((pos, "PROJECT_COMPLETE"))

        # Sort all found cues by their start position in the text
        cue_hits.sort(key=lambda x: x[0])
        
        # Return unique cues in order of appearance
        final_cues = []
        for _, cue in cue_hits:
            if cue not in final_cues:
                final_cues.append(cue)
        
        return final_cues
    
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
        
        # 1. Remove all internal cues and technical tags
        message = re.sub(r'\[(?:File (?:Edit|Create|Delete): |SEARCH:|FILE_SEARCH:|READ_FILE:|EDIT_FILE:|CREATE_FILE:|DELETE_FILE:|READ_URL:|SUB_RESEARCH:)[^\]]+\]', '', message)
        message = message.replace("[DONE]", "")
        
        # 2. Convert agent handoff cues to @ mentions
        cue_to_mention = {
            r'\[→SENIOR\]': '@Senior Dev',
            r'\[→JUNIOR\]': '@Junior Dev', 
            r'\[→TESTER\]': '@Unit Tester',
            r'\[→RESEARCH\]': '@Researcher',
        }
        for cue_pattern, mention in cue_to_mention.items():
            message = re.sub(cue_pattern, mention, message)
        
        # 3. Clean up "ghost" artifacts
        # Attaches punctuation to preceding words (word . -> word.)
        message = re.sub(r'(\w)\s+([.,!?;:])', r'\1\2', message)
        
        # Remove trailing colons/whitespace only at the ABSOLUTE END of the message
        message = re.sub(r'[:\s]+$', '', message)
        
        # 4. Header Protection Logic for Premium Reports
        header_map = {
            "Analysis Summary": "### 🧠 Analysis Summary",
            "Key Technical Insights": "### 💡 Key Technical Insights",
            "Recommendations": "### 🎯 Recommendations",
            "Source Verification": "### 🔗 Source Verification"
        }
        
        for plain_header, markdown_header in header_map.items():
            # Match any character followed by the header, fixing missing newlines/markings
            pattern = r'(?i)([^\n])\s*(?:###\s*)?(?:[🧠💡🎯🔗]\s*)?' + re.escape(plain_header)
            message = re.sub(pattern, r'\1\n\n' + markdown_header, message)
            
            # Ensure correct double newline even if structure is mostly correct
            correct_pattern = r'([^\n])\n' + re.escape(markdown_header)
            message = re.sub(correct_pattern, r'\1\n\n' + markdown_header, message)
        
        # 5. Fix punctuation spacing around code blocks and inlines
        # Inline code: Keep but attach (e.g. `code` . -> `code`.)
        message = re.sub(r'(`)\s*([.,!?;:])', r'\1\2', message)
        
        # Block code: Strip trailing punctuation and replace with newline (satisfies legacy tests)
        # This turns ```...```, into ```\n
        message = re.sub(r'(```)\s*[.,!?;:]\s*', r'\1\n', message)
        
        # 6. Final whitespace normalization
        message = re.sub(r'\n{3,}', '\n\n', message)
        message = re.sub(r' {2,}', ' ', message)
        
        return message.strip()
    
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
            self.handoff_queue = []
            self.mission_status = "IN_PROGRESS"
            yield {"type": "agent_status", "status": "🚀 Initializing mission..."}
        
        # Reset stop event
        self._stop_event.clear()
        
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
            if self._stop_event.is_set():
                print("🛑 Stopping process_message_stream due to stop event")
                yield {"type": "complete", "message": "Mission stopped by user"}
                break
            
            # Refresh Attached Files contents from disk to ensure agents see newest approved changes
            if full_context.get("attached_files"):
                for file_info in full_context["attached_files"]:
                    file_path_str = file_info.get("path")
                    if file_path_str and isinstance(file_path_str, str):
                        try:
                            on_disk_content = await self.file_manager.read_file(file_path_str)
                            if on_disk_content is not None:
                                file_info["content"] = on_disk_content
                        except Exception as e:
                            print(f"⚠️ Failed to refresh {file_path_str}: {e}")

            turn += 1
            start_time = datetime.now()
            agent = self.agents[current_agent_name]
            print(f"\n{'='*60}")
            print(f"🎬 [Orchestrator] Turn {turn} starting with {current_agent_name}")
            print(f"{'='*60}")
            
            yield {
                "type": "agent_start",
                "agent": current_agent_name,
                "emoji": agent.emoji,
                "color": agent.color,
                "turn": turn
            }
            
            # Update Gemini's context
            turn_context = full_context.copy()
            
            # Collect full response for cue extraction
            full_response = ""
            full_thoughts = ""
            
            # Stream agent response
            suppress_message = False
            last_was_cue = False
            print(f"\n🔄 [Orchestrator] Starting stream for {current_agent_name}...")
            # print(f"   📨 Message (first 200 chars): {current_message[:200]}...")
            async for event in agent.think(current_message, turn_context):
                if self._stop_event.is_set():
                    print(f"🛑 [Orchestrator] Force stopping turn for {current_agent_name}")
                    break
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
            
            # Track usage and timing
            duration = (datetime.now() - start_time).total_seconds()
            print(f"⏱️ [Orchestrator] Turn {turn} ({current_agent_name}) took {duration:.2f}s")
            
            # Send stats to UI
            yield {
                "type": "turn_stats",
                "agent": current_agent_name,
                "duration": duration,
                "turn": turn
            }
            
            # Extract cues and determine next action
            cues = self._extract_cues(full_response)
            if cues:
                print(f"🎯 [Orchestrator] Cues detected: {cues}")
                # Visualize cues for dev console
                yield {
                    "type": "dev_log",
                    "level": "info",
                    "message": f"🎯 Agent {current_agent_name} triggered cues: {', '.join(cues)}"
                }
            # else:
            #     # Debug: Log when NO cues are found
            #     response_preview = full_response[-500:] if len(full_response) > 500 else full_response
            #     print(f"⚠️ [Orchestrator] NO CUES detected from {current_agent_name}!")
            #     print(f"   📝 Response length: {len(full_response)} chars")
            #     print(f"   📝 Response tail: {response_preview[:200]}...")
            
            # Process Mission Checklist cues
            if self._extract_mission_checklist(full_response):
                yield {
                    "type": "checklist_created",
                    "mission": self.mission_description,
                    "items": self.mission_checklist
                }
            
            # Process Checklist Updates
            updates = self._extract_checklist_updates(full_response)
            if updates > 0:
                yield {
                    "type": "checklist_updated",
                    "items_completed": updates,
                    "mission": self.mission_description,
                    "checklist": self.mission_checklist,
                    "is_complete": self._is_checklist_complete()
                }
            
            # Inject checklist summary into context for next agent
            checklist_summary = self.get_checklist_summary()
            if checklist_summary:
                full_context["checklist_summary"] = checklist_summary
            
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
            
            # Detect Synthetic Research Report
            if "### 🏆 Executive Deep Research Report" in clean_full_response:
                yield {
                    "type": "research_report",
                    "content": clean_full_response
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

            # Check for sub-research cues (Deep Research)
            sub_research_queries = []
            for cue in cues:
                if cue.startswith("SUB_RESEARCH:"):
                    sub_research_queries.append(cue.split(":", 1)[1])

            if sub_research_queries:
                # Save the Research Lead's message to conversation FIRST
                # This ensures the Summarizer knows what was planned
                lead_msg = Message(
                    agent=current_agent_name,
                    content=clean_full_response,
                    thoughts=full_thoughts,
                    cues=cues
                )
                self.conversation.append(lead_msg)
                full_context["conversation"].append({
                    "agent": current_agent_name,
                    "content": lead_msg.content
                })

                all_detailed_contents = []
                
                for idx, query in enumerate(sub_research_queries):
                    # Signal deep research starting for this sub-query
                    status_prefix = f"[{idx+1}/{len(sub_research_queries)}]"
                    print(f"\n{'='*60}")
                    print(f"🔬 [DEEP RESEARCH] {status_prefix} Starting: {query}")
                    print(f"{'='*60}")
                    
                    yield {
                        "type": "agent_status",
                        "agent": "Research Lead",
                        "status": f"🔍 Researching: {query}..."
                    }
                    
                    # Get initial search links
                    search_data = await self.scraper.search_web(query, max_results=5)
                    
                    yield {
                        "type": "research_results",
                        "results": search_data
                    }

                    yield {
                        "type": "agent_status",
                        "status": f"🌐 {status_prefix} Reading {len(search_data)} sources in parallel..."
                    }

                    # Parallel fetching of all URLs
                    async def fetch_item(f_idx, url):
                        if not url or not url.startswith("http"):
                            return None
                        try:
                            # Use a specific status for each fetch in logs
                            content = await self.scraper.fetch_page(url)
                            if content:
                                return {"url": url, "content": content, "title": search_data[f_idx].get("title", "Unknown")}
                        except Exception as e:
                            print(f"❌ [TANDEM] Error fetching {url}: {e}")
                        return None

                    tasks = [fetch_item(i, res.get("url", "")) for i, res in enumerate(search_data)]
                    results = await asyncio.gather(*tasks)
                    
                    # Filter out failures and add to master list
                    sub_contents = [r for r in results if r is not None]
                    all_detailed_contents.extend(sub_contents)
                    
                    print(f"✅ [DEEP RESEARCH] {status_prefix} Fetched {len(sub_contents)} pages")

                # Save to temp files and build context
                attached_files = []
                os.makedirs(".research", exist_ok=True)
                
                for i, res in enumerate(all_detailed_contents):
                    file_safe_title = "".join(x for x in res['title'] if x.isalnum() or x in " -_")[:30].strip()
                    filename = f".research/{i+1}_{file_safe_title}.md"
                    
                    file_content = f"Source URL: {res['url']}\n\n{res['content']}"
                    
                    async with aiofiles.open(filename, 'w', encoding='utf-8') as f:
                        await f.write(file_content)
                        
                    attached_files.append({
                        "path": filename,
                        "content": file_content
                    })

                yield {
                    "type": "agent_status",
                    "status": f"🧠 AI Synthesis: Analyzed {len(attached_files)} sources. Generating Executive Report..."
                }

                # Update the context for all future agents in this turn
                full_context["attached_files"] = attached_files

                # New message to direct the Summarizer
                current_message = f"I have gathered extensive research from {len(sub_research_queries)} sub-topics. The raw content from {len(attached_files)} sources is attached as files.\n\nTask: Synthesize everything into a final 🏆 Executive Deep Research Report."
                
                # Switch to Summarizer for the final report
                current_agent_name = "Summarizer"
                continue

            # Check for web read cues
            read_url = None
            for cue in cues:
                if cue.startswith("READ_URL:"):
                    read_url = cue.split(":", 1)[1]
                    break
                    
            if read_url:
                print(f"\n🌐 [READ_URL] Agent requested direct URL read: {read_url}")
                yield {
                    "type": "agent_status",
                    "agent": current_agent_name,
                    "status": f"Reading page: {read_url}..."
                }
                
                content = await self.scraper.fetch_page(read_url)
                if content:
                    print(f"✅ [READ_URL] Successfully extracted {len(content)} chars from {read_url}")
                    print(f"   📝 Preview: {content[:150].replace(chr(10), ' ')}...")
                    current_message = f"Extracted content from {read_url}:\n\n{content}\n\nPlease summarize this content for the research report."
                else:
                    print(f"❌ [READ_URL] Failed to extract content from {read_url}")
                    current_message = f"I tried to read {read_url} but couldn't extract any content. The site might be blocking automated access or is currently down."
                
                # Continue loop with same agent
                continue

            if search_query:
                yield {
                    "type": "agent_status",
                    "agent": current_agent_name,
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
            cues_for_handoff = [c for c in cues if c in self.CUE_TO_AGENT]
            handoff_agent = None
            handoff_cue = None
            
            print(f"🔍 [Orchestrator] Checking for handoff. Cues for handoff: {cues_for_handoff}")

            if cues_for_handoff:
                # If multiple cues, the first one is immediate, others go to queue
                first_cue = cues_for_handoff[0]
                target_agent = self.CUE_TO_AGENT[first_cue]
                print(f"🎯 [Orchestrator] First handoff cue: {first_cue} -> {target_agent}")
                
                if target_agent != current_agent_name:
                    handoff_agent = target_agent
                    handoff_cue = first_cue
                    print(f"✅ [Orchestrator] Will hand off to: {handoff_agent}")
                    
                    # Queue the rest if they aren't already there
                    for extra_cue in cues_for_handoff[1:]:
                        extra_agent = self.CUE_TO_AGENT[extra_cue]
                        if extra_agent not in self.handoff_queue and extra_agent != current_agent_name:
                            self.handoff_queue.append(extra_agent)
                else:
                    print(f"⚠️ [Orchestrator] Handoff target same as current agent, skipping")

            # If file edit proposed, we pause here to let user review
            if file_edit_proposed:
                self.last_handoff = handoff_agent
                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Pausing for file review... ⏸️"
                }
                break

            # Check for PROJECT_COMPLETE - Immediate Stop
            if "PROJECT_COMPLETE" in cues:
                # Validate checklist is complete before allowing project completion
                if not self._is_checklist_complete():
                    incomplete_items = [item for item in self.mission_checklist if not item['done']]
                    incomplete_list = ", ".join([f"Step {item['step']}" for item in incomplete_items])
                    print(f"⚠️ [Orchestrator] PROJECT_COMPLETE blocked - checklist incomplete: {incomplete_list}")
                    
                    yield {
                        "type": "dev_log",
                        "level": "warning", 
                        "message": f"⚠️ [PROJECT_COMPLETE] blocked: {len(incomplete_items)} checklist items incomplete"
                    }
                    
                    # Send warning back to agent and continue
                    current_message = f"⚠️ Cannot mark project complete yet. The following checklist items are not done:\n"
                    for item in incomplete_items:
                        current_message += f"- [ ] {item['step']}. {item['description']} (→{item['agent']})\n"
                    current_message += "\nPlease complete these remaining steps first."
                    
                    # Keep same agent to handle the incomplete work
                    continue
                
                print("🏁 [Orchestrator] Project marked as COMPLETE by agent")
                self.handoff_queue = [] # Clear queue
                self.mission_status = "IDLE"
                
                # Clear checklist for next mission
                self.mission_checklist = []
                self.mission_description = ""
                
                # Cleanup research files
                if os.path.exists(".research"):
                    try:
                        shutil.rmtree(".research")
                    except Exception:
                        pass

                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Mission Accomplished! 🚀"
                }
                break

            # Check for done - but only if NO handoff is pending and queue is empty
            if "DONE" in cues:
                if handoff_agent:
                    # We have a handoff pending, don't break - let the handoff happen
                    print(f"📌 [Orchestrator] DONE detected but handoff to {handoff_agent} pending - continuing")
                elif self.handoff_queue:
                    # Move to next agent in queue instead of stopping
                    handoff_agent = self.handoff_queue.pop(0)
                    handoff_cue = "QUEUE_NEXT"
                    print(f"⏭️ [Orchestrator] Task complete. Moving to queued agent: {handoff_agent}")
                else:
                    # No handoff pending and queue empty - actually stop
                    print(f"⏹️ [Orchestrator] DONE detected with no pending handoffs - stopping")
                    
                    # Cleanup research files
                    if os.path.exists(".research"):
                        try:
                            shutil.rmtree(".research")
                        except Exception:
                            pass

                    yield {
                        "type": "agent_done",
                        "agent": current_agent_name,
                        "message": "Turn complete. Waiting for next step. ✅"
                    }
                    break
            
            if handoff_agent:
                print(f"🔀 [Orchestrator] Executing handoff: {current_agent_name} -> {handoff_agent}")
                yield {
                    "type": "handoff",
                    "from_agent": current_agent_name,
                    "to_agent": handoff_agent,
                    "cue": handoff_cue
                }
                
                # Set up for next turn
                current_agent_name = handoff_agent
                current_message = f"Previous agent ({msg.agent}) said:\n\n{full_response}\n\nPlease continue with your expertise."
                print(f"🔄 [Orchestrator] Continuing loop to turn {turn+1}...")
            else:
                # No handoff, we're done
                print(f"⏹️ [Orchestrator] No handoff detected, ending loop")
                yield {
                    "type": "agent_done",
                    "agent": current_agent_name,
                    "message": "Response complete"
                }
                break
        
        print(f"🏁 [Orchestrator] Loop ended after {turn} turns")
        # Final complete event
        yield {
            "type": "complete",
            "turns": turn,
            "conversation_length": len(self.conversation),
            "final": self.mission_status == "IDLE"
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
        was_done = last_msg and "[DONE]" in last_msg.content
        
        if approved:
            # Check if they explicitly marked the project as complete
            is_project_complete = last_msg and "[PROJECT_COMPLETE]" in last_msg.content
            
            if is_project_complete:
                self.mission_status = "IDLE"
                self.last_handoff = None
                return {
                    "next_agent": None,
                    "message": None
                }
                
            if self.last_handoff:
                current_agent_name = self.last_handoff
                message = f"The user has approved the file changes from {last_agent_name}. You've been called in to help with the next step."
            elif self.handoff_queue:
                current_agent_name = self.handoff_queue.pop(0)
                message = f"User approved previous changes. Now it's your turn in the mission queue."
            else:
                # If was_done, we might want to hand back to Senior for final check
                if was_done and last_agent_name == "Junior Dev":
                    current_agent_name = "Senior Dev"
                    message = f"The Junior Dev has finished their task and the changes were approved. Please review the result and decide on the next step."
                else:
                    current_agent_name = last_agent_name
                    message = "Great! Changes approved. What's next?"
            
            # CRITICAL: Since files were just approved, they are now on disk.
            # We don't need to pass anything extra here; the next call to 
            # process_message_stream in main.py will handle building context.
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

    def stop(self):
        """Signal all agents to stop"""
        print("🛑 [Orchestrator] Stop signal received - Clearing queue and stopping agents")
        self._stop_event.set()
        self.handoff_queue = [] # Clear any pending agents
        self.mission_status = "IDLE"

    def clear_history(self):
        """Clear conversation history and reset mission state"""
        self.conversation = []
        self.last_handoff = None
        self.handoff_queue = []
        self.mission_status = "IDLE"
        # Clear checklist state
        self.mission_checklist = []
        self.mission_description = ""
        return {"status": "cleared"}

    async def do_research(self, query: str) -> AsyncGenerator[Dict, None]:
        """
        Dedicated deep research flow.
        Routes query directly to Research Lead who coordinates the tandem agents.
        """
        print(f"\n{'='*60}")
        print(f"🔬 [DO_RESEARCH] Starting dedicated research flow for: {query}")
        print(f"{'='*60}")
        
        # Ensure initialized
        if not self.initialized:
            await self.initialize()
        
        yield {
            "type": "agent_status",
            "status": f"🔬 Initializing deep research: {query}"
        }
        
        # Route directly to Research Lead with the research request
        research_message = (
            f"The user has requested a deep research mission:\n\n"
            f"**Research Topic**: {query}\n\n"
            f"Please break this down into 2-3 specific sub-questions using [SUB_RESEARCH: \"query\"] cues. "
            f"After gathering information from all sources, synthesize your findings into an "
            f"Executive Deep Research Report.\n\n"
            f"Remember:\n"
            f"- Use [SUB_RESEARCH: \"query\"] to search and automatically scrape full page content\n"
            f"- Use [READ_URL: \"url\"] to read specific pages you want to dive deeper into\n"
            f"- Cross-reference sources and look for contradictions\n"
            f"- End with [DONE] when the report is complete"
        )

        # Use the streaming message processor with Research Lead as initial agent
        async for event in self.process_message_stream(
            message=research_message,
            initial_agent="Research Lead"
        ):
            yield event
