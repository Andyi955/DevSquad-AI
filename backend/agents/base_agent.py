"""
Base Agent Class
Abstract base for all AI agents with Gemini/DeepSeek support
"""

import os
import json
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any
from pathlib import Path

from google import genai
from google.genai import types
from openai import AsyncOpenAI


class BaseAgent(ABC):
    """Base class for AI agents"""
    
    # Cue patterns for agent handoffs
    CUES = {
        "SENIOR": "[→SENIOR]",
        "JUNIOR": "[→JUNIOR]", 
        "TESTER": "[→TESTER]",
        "RESEARCH": "[→RESEARCH]",
        "EDIT_FILE": "[EDIT_FILE:",
        "CREATE_FILE": "[CREATE_FILE:",
        "FILE_SEARCH": "[FILE_SEARCH:",
        "DONE": "[DONE]"
    }
    
    def __init__(
        self, 
        name: str,
        emoji: str,
        provider: str = "gemini",  # "gemini" or "deepseek"
        model: str = None,
        color: str = "#00ff88"
    ):
        self.name = name
        self.emoji = emoji
        self.provider = provider
        self.color = color
        self.model = model
        self.conversation_history = []
        
        # Always initialize BOTH clients for Hybrid DeepThink
        self.gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.openai_client = AsyncOpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com"
        )
        
        if provider == "gemini":
            self.model = model or "gemini-3-flash-preview"
            self.client = self.gemini_client
        elif provider == "deepseek":
            self.model = model or "deepseek-chat"
            self.client = self.openai_client
        else:
            raise ValueError(f"Unknown provider: {provider}")
        
        # Load system prompt
        base_prompt = self._load_prompt()
        import datetime
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.system_prompt = f"## Environmental Context\n- Current Date/Time: {now}\n\n{base_prompt}"
    
    def _load_prompt(self) -> str:
        """Load the system prompt from prompts folder"""
        prompt_file = Path(__file__).parent.parent / "prompts" / f"{self._prompt_name()}.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        return self._default_prompt()
    
    @abstractmethod
    def _prompt_name(self) -> str:
        """Return the prompt file name (without extension)"""
        pass
    
    @abstractmethod
    def _default_prompt(self) -> str:
        """Return default system prompt if file not found"""
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """Get agent info for frontend"""
        return {
            "name": self.name,
            "emoji": self.emoji,
            "color": self.color,
            "provider": self.provider,
            "model": self.model
        }
    
    async def think(self, message: str, context: dict = None) -> AsyncGenerator[Dict, None]:
        """
        Process a message and yield streaming response with thoughts
        Yields: {"type": "thought"|"message"|"cue", "content": str, "agent": str}
        """
        
        # Build the full prompt with context
        full_prompt = self._build_prompt(message, context)
        
        # State for parsing
        in_thought = False
        buffer = ""
        full_message_accumulated = "" # To check for cues at the end
        
        # Get appropriate stream
        if self.provider == "gemini":
            stream = self._stream_gemini(full_prompt)
        elif self.provider == "deepseek":
            stream = self._stream_deepseek(full_prompt)
        else:
            yield {"type": "error", "content": f"Unknown provider: {self.provider}", "agent": self.name}
            return

        try:
            async for chunk in stream:
                buffer += chunk
                
                while True:
                    if in_thought:
                        # Look for closing tag
                        end_tag = "</think>"
                        if end_tag in buffer:
                            # Found end of thought
                            parts = buffer.split(end_tag, 1)
                            thought_content = parts[0]
                            remainder = parts[1]
                            if thought_content:
                                yield {"type": "thought", "content": thought_content, "agent": self.name}
                            in_thought = False
                            buffer = remainder
                            continue
                        else:
                            # stream safe part of thought
                            safe_len = len(buffer) - len(end_tag) + 1
                            if safe_len > 0:
                                chunk_out = buffer[:safe_len]
                                buffer = buffer[safe_len:]
                                yield {"type": "thought", "content": chunk_out, "agent": self.name}
                            break
                    else:
                        # Look for opening tag
                        start_tag = "<think>"
                        if start_tag in buffer:
                            # Found start of thought
                            parts = buffer.split(start_tag, 1)
                            msg_content = parts[0]
                            remainder = parts[1]
                            if msg_content:
                                full_message_accumulated += msg_content
                                yield {"type": "message", "content": msg_content, "agent": self.name}
                            
                            in_thought = True
                            buffer = remainder
                            # Signal thought start
                            yield {"type": "thought", "content": "", "agent": self.name}
                            continue
                        else:
                            # Check for partial start tag at end of buffer
                            if '<' in buffer:
                                last_lt = buffer.rfind('<')
                                possible_tag = buffer[last_lt:]
                                if start_tag.startswith(possible_tag):
                                    to_yield = buffer[:last_lt]
                                    if to_yield:
                                        full_message_accumulated += to_yield
                                        yield {"type": "message", "content": to_yield, "agent": self.name}
                                    buffer = possible_tag
                                    break
                                else:
                                    full_message_accumulated += buffer
                                    yield {"type": "message", "content": buffer, "agent": self.name}
                                    buffer = ""
                                    break
                            else:
                                # No tags, yield all
                                full_message_accumulated += buffer
                                yield {"type": "message", "content": buffer, "agent": self.name}
                                buffer = ""
                                break
            
            # Flush remaining buffer
            if buffer:
                if in_thought:
                    yield {"type": "thought", "content": buffer, "agent": self.name}
                else:
                    full_message_accumulated += buffer
                    yield {"type": "message", "content": buffer, "agent": self.name}
            
            # Check for cues in the final message
            for cue_name, cue_pattern in self.CUES.items():
                if cue_pattern in full_message_accumulated:
                    yield {"type": "cue", "content": cue_name, "agent": self.name}
                        
        except Exception as e:
            yield {"type": "error", "content": str(e), "agent": self.name}

    def _build_prompt(self, message: str, context: dict = None) -> str:
        """Build full prompt with context and history (system prompt is separate)"""
        parts = []
        
        if context:
            if "files" in context:
                parts.append("## Project Structure (Available Files)\n")
                parts.append("You can see the names and sizes of all files in the project. You DO NOT have their content unless they are in the 'Active Context' below.\n")
                for f in context["files"]:
                    parts.append(f"- {f['path']} ({f.get('size', 'unknown')} bytes)\n")
                parts.append("\n")
            
            # Build Active Context (files we have content for)
            active_context = []
            seen_paths = set()
            
            if context.get("attached_files"):
                for f in context["attached_files"]:
                    active_context.append({"path": f["path"], "content": f["content"], "type": "Attached"})
                    seen_paths.add(f["path"])
            
            if context.get("current_file") and context["current_file"]["path"] not in seen_paths:
                active_context.append({
                    "path": context["current_file"]["path"], 
                    "content": context["current_file"]["content"],
                    "type": "Selected"
                })

            if active_context:
                parts.append("## Active Context (Full Content Provided)\n")
                parts.append("You have the FULL content for the following files. Use them to answer the user's request IMMEDIATELY without asking for them again.\n\n")
                for f in active_context:
                    parts.append(f"### File: {f['path']} ({f['type']})\n```\n")
                    parts.append(f['content'])
                    parts.append("\n```\n\n")
            else:
                parts.append("## Active Context\nNo files are currently attached or selected for deep analysis. You only see the project structure above.\n\n")
            
            if "conversation" in context:
                parts.append("## Previous Conversation\n")
                parts.append("IMPORTANT: You must use this history to maintain context.\n\n")
                for msg in context["conversation"][-20:]:  # Last 20 messages
                    parts.append(f"**{msg['agent']}**: {msg['content']}\n\n")
        
        parts.append(f"## User Request\n{message}")
        
        return "".join(parts)
    
    async def _stream_gemini(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream response from Gemini using new SDK with async support"""
        try:
            # The new SDK has an 'aio' attribute for async operations
            stream = await self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=0.7,
                    max_output_tokens=4096
                )
            )
            
            async for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except AttributeError:
            # Fallback if aio is not available or differently structured
            print("⚠️ Falling back to sync Gemini stream (aio not found)")
            def get_stream():
                return self.client.models.generate_content_stream(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=self.system_prompt,
                        temperature=0.7,
                        max_output_tokens=4096
                    )
                )

            response = await asyncio.to_thread(get_stream)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
    
    async def _stream_deepseek(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream response from DeepSeek"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        stream = await self.openai_client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=512
        )
        
        async for chunk in stream:
            if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
            
            if hasattr(chunk.choices[0].delta, 'reasoning_content') and chunk.choices[0].delta.reasoning_content:
                reasoning = chunk.choices[0].delta.reasoning_content
                yield f"<think>{reasoning}</think>"
    
    async def generate(self, message: str, context: dict = None) -> str:
        """Non-streaming generation using mixed SDKs"""
        full_prompt = self._build_prompt(message, context)
        
        if self.provider == "gemini":
            response = await asyncio.to_thread(
                lambda: self.client.models.generate_content(
                    model=self.model,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=self.system_prompt,
                        temperature=0.7,
                        max_output_tokens=4096
                    )
                )
            )
            return response.text
            
        elif self.provider == "deepseek":
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": full_prompt}
            ]
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=4096
            )
            return response.choices[0].message.content
