"""
Base Agent Class
Abstract base for all AI agents with Gemini/DeepSeek support
"""

import os
import json
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, List, Any
import base64
from pathlib import Path

from google import genai
from google.genai import types



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
        color: str = "#00ff88",
        temperature: float = 0.5,
        thinking_level: str = "HIGH"  # MINIMAL, LOW, MEDIUM, HIGH
    ):
        self.name = name
        self.emoji = emoji
        self.provider = provider
        self.color = color
        self.model = model
        self.temperature = temperature
        self.thinking_level = thinking_level
        self.conversation_history = []
        
        # Always initialize client
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = model or "gemini-3-flash-preview"
        
        if provider != "gemini":
             # Warn but default to Gemini
             print(f"⚠️ [BaseAgent] Provider '{provider}' not supported. Defaulting to Gemini.")
        
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
        
        # Logging for debugging
        print(f"📡 [DEBUG] Agent {self.name} receiving prompt (first 500 chars):\n{full_prompt[:500]}...")
        print(f"📡 [DEBUG] Model: {self.model}, Provider: {self.provider}")
        
        # State for parsing
        full_message_accumulated = ""
        
        # Get stream
        stream = self._stream_gemini(message, context or {})

        try:
            async for event in stream:
                if event["type"] == "message":
                    full_message_accumulated += event["content"]
                yield event
            
            
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
                parts.append("You see the file list below. To read any file's content, use the `[READ_FILE:path]` cue.\n")
                for f in context["files"]:
                    parts.append(f"- {f['path']} ({f.get('size', 'unknown')} bytes)\n")
                parts.append("\n")
            
            # Build Active Context (files we have content for)
            active_context = []
            seen_paths = set()
            
            if context.get("attached_files"):
                for f in context["attached_files"]:
                    active_context.append({"path": f["path"], "content": f.get("content", ""), "type": "Attached"})
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
                parts.append("## Active Context\nNo files are currently attached. If you need to see a file's content, you MUST use `[READ_FILE:path]`.\n\n")
            
            # Inject Mission Checklist if available
            if context.get("checklist_summary"):
                parts.append(context["checklist_summary"])
                parts.append("\n\n")
            
            if "conversation" in context:
                parts.append("## Previous Conversation\n")
                parts.append("IMPORTANT: You must use this history to maintain context.\n\n")
                for msg in context["conversation"][-20:]:  # Last 20 messages
                    # Ensure content is a string
                    msg_content = msg.get('content', '')
                    if not isinstance(msg_content, str):
                        msg_content = str(msg_content) if msg_content is not None else ""
                    parts.append(f"**{msg['agent']}**: {msg_content}\n\n")
        
        parts.append(f"## User Request\n{message}")
        
        return "".join(parts)
    
    def _build_gemini_contents(self, message: str, context: dict = None) -> list:
        """Build structured contents for Gemini, including history and signatures"""
        
        # 1. System Prompt is handled by system_instruction in config, but we can also prepend context here if needed.
        # However, to maintain pure history, we should rely on system_instruction for the "Who am I".
        
        # 2. Build Context String (Files, etc) - this still goes into the User Message
        # We use the existing _build_prompt to generate this context block
        full_message_text = self._build_prompt(message, context)
        
        contents = []
        
        # 3. Inject History
        if context and "conversation" in context:
            for msg in context["conversation"][-20:]:
                role = "model" if msg["agent"] == self.name else "user"
                
                # Ensure content is a string
                msg_content = msg.get("content", "")
                if not isinstance(msg_content, str):
                    msg_content = str(msg_content) if msg_content is not None else ""
                
                parts = [{"text": msg_content}]
                
                # Restore Thought Signature if present
                signature = msg.get("signature")
                if signature and role == "model":
                    try:
                        # We stored it as b64 string, Gemini expects bytes in the 'thought_signature' field
                        # but when using the Dictionary format in the SDK, it might be 'thought_signature'
                        # or 'thoughtSignature' depending on the exact schema version.
                        # The latest SDKs and the API wire format use 'thought_signature'.
                        parts[0]["thought_signature"] = base64.b64decode(signature)
                    except Exception as e:
                        print(f"⚠️ [BaseAgent] Failed to decode signature for {self.name}: {e}")
                
                contents.append({"role": role, "parts": parts})
        
        # 4. Add Current Message
        contents.append({"role": "user", "parts": [{"text": full_message_text}]})
        
        return contents

    async def _stream_gemini(self, message: str, context: dict, retry_count: int = 0) -> AsyncGenerator[Any, None]:
        """Stream response from Gemini using new SDK with thinking support"""
        max_retries = 2
        min_valid_chars = 20
        total_chars = 0
        
        try:
            # Build structured contents
            contents = self._build_gemini_contents(message, context)
            
            # Configure Thinking
            thinking_config = types.ThinkingConfig(
                include_thoughts=True,
                thinking_level=self.thinking_level
            )
            
            stream = await self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    temperature=self.temperature,
                    max_output_tokens=65536,
                    thinking_config=thinking_config
                )
            )
            
            async for chunk in stream:
                # Capture thoughts
                if hasattr(chunk, 'candidates') and chunk.candidates:
                    for part in chunk.candidates[0].content.parts:
                        # 1. Handle Thoughts
                        if hasattr(part, 'thought') and part.thought:  # SDK 0.1.0+ typically has this
                             # Ensure thought is converted to string (might be bool or other type)
                             thought_content = str(part.thought) if not isinstance(part.thought, str) else part.thought
                             yield {"type": "thought", "content": thought_content, "agent": self.name}
                        
                        # 2. Handle Text
                        if part.text:
                            total_chars += len(part.text)
                            yield {"type": "message", "content": part.text}
                            
                        # 3. Handle Thought Signature
                        # Gemini returns thought_signature as raw bytes. We must encode it
                        # to safely store it in our JSON history and pass it back.
                        if hasattr(part, 'thought_signature') and part.thought_signature:
                            b64_sig = base64.b64encode(part.thought_signature).decode('utf-8')
                            yield {"type": "signature", "content": b64_sig, "agent": self.name}
                        elif hasattr(part, 'thoughtSignature') and part.thoughtSignature:
                            b64_sig = base64.b64encode(part.thoughtSignature).decode('utf-8')
                            yield {"type": "signature", "content": b64_sig, "agent": self.name}
            
            # Retry logic...
            if total_chars < min_valid_chars and retry_count < max_retries:
                print(f"⚠️ [Gemini] {self.name}: Short response ({total_chars} chars), retrying...")
                await asyncio.sleep(1)
                async for event in self._stream_gemini(message, context, retry_count + 1):
                    yield event
                    
        except Exception as e:
            import traceback
            # Catch 503 Overloaded
            if ("503" in str(e) or "overloaded" in str(e).lower()) and retry_count < max_retries:
                print(f"🔄 [Gemini] {self.name}: 503 Overloaded, retrying...")
                await asyncio.sleep(2)
                async for event in self._stream_gemini(message, context, retry_count + 1):
                    yield event
                return
                
            print(f"❌ [Gemini] {self.name} ERROR: {e}")
            print(f"❌ [Gemini] {self.name} Traceback: {traceback.format_exc()}")
            yield {"type": "error", "content": str(e), "agent": self.name}
    

    
    async def generate(self, message: str, context: dict = None) -> str:
        """Non-streaming generation using mixed SDKs"""
        full_prompt = self._build_prompt(message, context)
        
        if self.provider == "gemini":
            # For non-streaming, we also need to respect thinking config
            # But generate() returns just text string, so we lose signature state.
            # Ideally everything should use stream. But for compatibility:
            contents = self._build_gemini_contents(message, context)
            response = await asyncio.to_thread(
                lambda: self.client.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=self.system_prompt,
                        temperature=0.7,
                        max_output_tokens=65536,
                        thinking_config=types.ThinkingConfig(include_thoughts=True)
                    )
                )
            )
            # We can't return the signature here easily without changing return type str
            # This method should probably be deprecated in favor of think()
            return response.text
            

