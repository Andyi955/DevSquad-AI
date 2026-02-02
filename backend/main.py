import os
import sys
import asyncio
import re

# AT THE ABSOLUTE TOP
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import json
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env")

from agents.orchestrator import AgentOrchestrator
from services.file_manager import FileManager
from services.usage_tracker import UsageTracker
from services.web_scraper import WebScraper

# Initialize services
file_manager = FileManager()
scraper = WebScraper()
usage_tracker = UsageTracker()
orchestrator = AgentOrchestrator(file_manager, scraper, usage_tracker)

# Helper to detect OS
IS_WINDOWS = sys.platform == 'win32'

if IS_WINDOWS:
    try:
        from winpty import PtyProcess
    except ImportError:
        PtyProcess = None
        print("⚠️ pywinpty not found, terminal features may not work on Windows")
else:
    import pty
    import termios
    import struct
    import fcntl
    import select
    from collections import deque

class TerminalManager:
    def __init__(self):
        self.ptys = {}
        self.active_tasks = {}
        self.log_buffers = {} # client_id -> string buffer for timeline logs
        self.last_sent_commands = {} # client_id -> deque of recently sent commands to filter echo
        
    def _strip_ansi(self, text: str) -> str:
        """Remove ANSI escape sequences from text for clean logging"""
        # More comprehensive ANSI escape pattern
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    async def _broadcast_log(self, client_id: str, text: str):
        """Buffer and broadcast clean terminal logs to the timeline"""
        clean_text = self._strip_ansi(text)
        if not clean_text.strip():
            return
            
        # Check if this is an echo of a command we just sent
        sent_queue = self.last_sent_commands.get(client_id)
        if sent_queue:
            # Fuzzy match: strip all formatting, slashes, and spaces
            def fuzzy(s): return re.sub(r'[\s\\\/\"\'\r\n]', '', s).lower()
            clean_fuzzy = fuzzy(clean_text)
            
            for cmd in list(sent_queue):
                if clean_fuzzy == fuzzy(cmd):
                    sent_queue.remove(cmd)
                    return # Filter out the echo
            
        # Add to buffer
        current_buffer = self.log_buffers.get(client_id, "") + clean_text
        
        # If we have a newline, broadcast the full lines
        if "\n" in current_buffer:
            lines = current_buffer.split("\n")
            # Keep the last partial line in buffer
            self.log_buffers[client_id] = lines[-1]
            
            # Broadcast each full line
            for line in lines[:-1]:
                if line.strip():
                    await broadcast_event({
                        "type": "dev_log",
                        "level": "info",
                        "message": f"💻 Terminal: {line.strip()}"
                    })
        else:
            # If no newline but buffer is getting big, broadcast anyway
            if len(current_buffer) > 100:
                await broadcast_event({
                    "type": "dev_log",
                    "level": "info",
                    "message": f"💻 Terminal: {current_buffer.strip()}"
                })
                self.log_buffers[client_id] = ""
            else:
                self.log_buffers[client_id] = current_buffer

    async def create_pty(self, client_id: str, rows: int = 24, cols: int = 80, shell: str = None):
        if client_id in self.ptys:
            self.close_pty(client_id)
        
        if IS_WINDOWS:
            # For Windows, we now EXCLUSIVELY use PowerShell.
            # CMD's char-by-char echoing causes 'Context Explosion' in the agent history.
            shell_cmd = "powershell.exe"

            try:
                # Initialize sent command queue
                from collections import deque
                self.last_sent_commands[client_id] = deque(maxlen=5)

                if not PtyProcess:
                    raise ImportError("pywinpty not installed. Run 'pip install pywinpty' to enable terminal support on Windows.")

                process = PtyProcess.spawn(
                    [shell_cmd],
                    dimensions=(rows, cols),
                    cwd=os.getcwd()
                )
                self.ptys[client_id] = {'type': 'win', 'process': process}
                print(f"🖥️ Terminal session started for {client_id} (Windows) using {shell_cmd}")
                return process
            except Exception as e:
                print(f"❌ Failed to start Windows PTY ({shell_cmd}): {e}")
                raise e
        else:
            # Unix/Linux/Mac Implementation using native pty
            try:
                # fork a child process
                pid, fd = pty.fork()
                
                if pid == 0:  # Child process
                    # Start shell
                    shell = os.environ.get('SHELL', 'bash')
                    os.chdir(os.getcwd())
                    os.execvp(shell, [shell])
                else:  # Parent process
                    # Initialize sent command queue
                    from collections import deque
                    self.last_sent_commands[client_id] = deque(maxlen=5)
                    
                    # Resize locally
                    self._set_winsize(fd, rows, cols)
                    
                    self.ptys[client_id] = {
                        'type': 'posix', 
                        'fd': fd, 
                        'pid': pid
                    }
                    print(f"🖥️ Terminal session started for {client_id} (Posix)")
                    return fd
            except Exception as e:
                print(f"❌ Failed to start Posix PTY: {e}")
                raise e

    def resize_pty(self, client_id: str, rows: int, cols: int):
        if client_id not in self.ptys: return
        
        session = self.ptys[client_id]
        if session['type'] == 'win':
            session['process'].setwinsize(rows, cols)
        else:
            self._set_winsize(session['fd'], rows, cols)

    def _set_winsize(self, fd, row, col, xpix=0, ypix=0):
        if IS_WINDOWS: return
        winsize = struct.pack("HHHH", row, col, xpix, ypix)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

    def write_to_pty(self, client_id: str, data: str, is_system: bool = False):
        if client_id not in self.ptys: return
        
        # If it's a system command (like cd), record it to filter its echo
        if is_system:
            if client_id in self.last_sent_commands:
                self.last_sent_commands[client_id].append(data)

        session = self.ptys[client_id]
        if session['type'] == 'win':
            session['process'].write(data)
        else:
            os.write(session['fd'], data.encode('utf-8'))

    async def read_from_pty(self, client_id: str, websocket: WebSocket):
        if client_id not in self.ptys: return
        
        session = self.ptys[client_id]
        buffer = []
        last_flush = asyncio.get_event_loop().time()
        
        if session['type'] == 'win':
            process = session['process']
            while True:
                try:
                    # Non-blocking read
                    output = await asyncio.to_thread(process.read, 1024)
                    if not output:
                        break
                    
                    # Immediate send to Xterm.js (low latency)
                    await websocket.send_text(output)
                    
                    # Buffered send to Timeline (prevent flooding)
                    buffer.append(output)
                    now = asyncio.get_event_loop().time()
                    if '\n' in output or '\r' in output or (now - last_flush > 0.5) or len("".join(buffer)) > 500:
                        full_chunk = "".join(buffer)
                        await self._broadcast_log(client_id, full_chunk)
                        buffer = []
                        last_flush = now
                        
                except Exception as e:
                    print(f"Error reading from PTY: {e}")
                    break
        else:
            fd = session['fd']
            while True:
                try:
                    await asyncio.sleep(0.01)
                    data = await asyncio.to_thread(os.read, fd, 1024)
                    if not data: 
                        break
                    decoded = data.decode('utf-8', errors='replace')
                    
                    # Immediate send to Xterm.js
                    await websocket.send_text(decoded)
                    
                    # Buffered send to Timeline
                    buffer.append(decoded)
                    now = asyncio.get_event_loop().time()
                    if '\n' in decoded or '\r' in decoded or (now - last_flush > 0.5) or len("".join(buffer)) > 500:
                        full_chunk = "".join(buffer)
                        await self._broadcast_log(client_id, full_chunk)
                        buffer = []
                        last_flush = now
                        
                except OSError:
                    break
                except Exception as e:
                    print(f"Error reading from PTY: {e}")
                    break

    def close_pty(self, client_id: str):
        if client_id in self.ptys:
            session = self.ptys[client_id]
            try:
                if session['type'] == 'win':
                    session['process'].close()
                else:
                    os.close(session['fd'])
                    # optionally kill pid
                    # os.kill(session['pid'], signal.SIGTERM)
            except:
                pass
            del self.ptys[client_id]
            if client_id in self.log_buffers:
                del self.log_buffers[client_id]
            if client_id in self.last_sent_commands:
                del self.last_sent_commands[client_id]
            print(f"🖥️ Terminal session closed for {client_id}")

    def sync_workspace(self, path):
        """Update all active terminals to the new workspace path"""
        if not path: return
        path_str = str(path)
        # Force absolute path normalization for Windows
        normalized_path = os.path.abspath(path_str)
        cd_cmd = f'cd "{normalized_path}"\n' 
        for client_id in self.ptys:
            print(f"🔄 Syncing terminal {client_id} to workspace: {normalized_path}")
            self.write_to_pty(client_id, cd_cmd, is_system=True)

terminal_manager = TerminalManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("🚀 Starting Multi-Agent Code Assistant...")
    try:
        await orchestrator.initialize()
    except Exception as e:
        print(f"❌ Initialization error: {e}")
    yield
    # Shutdown
    print("👋 Shutting down agents...")
    print("👋 Shutdown complete.")

app = FastAPI(
    title="DevSquad AI API",
    description="Multi-agent collaboration API",
    version="1.0.0",
    lifespan=lifespan
)

async def broadcast_event(event: dict):
    """Send an event to all connected agent websockets"""
    if not hasattr(app.state, "connections"):
        return
    
    dead_connections = []
    for ws in app.state.connections:
        try:
            await ws.send_text(json.dumps(event))
        except:
            dead_connections.append(ws)
    
    for dead in dead_connections:
        app.state.connections.remove(dead)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared memory for active research
active_research = {}

class ChatMessage(BaseModel):
    content: str
    agent_id: Optional[str] = None
    files: Optional[List[str]] = None

@app.post("/chat")
async def chat_endpoint(message: ChatMessage):
    """Legacy HTTP endpoint for chat (now handled via WebSockets)"""
    return {"status": "Use WebSocket at /ws/agents"}

@app.websocket("/ws/agents")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(f"🔌 Client connected. Total: {len(app.state.connections) + 1 if hasattr(app.state, 'connections') else 1}")
    
    if not hasattr(app.state, "connections"):
        app.state.connections = []
    
    app.state.connections.append(websocket)
    
    active_stream_task = None

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle stop signal
            if message_data.get("type") == "stop":
                print("🛑 Stop signal received from UI")
                orchestrator.stop()
                if active_stream_task and not active_stream_task.done():
                    print("🔪 Cancelling active stream task")
                    active_stream_task.cancel()
                continue

            # Handle manual research triggers from UI
            if message_data.get("type") == "research":
                query = message_data.get("query")
                print(f"🕵️‍♂️ Manual research initiated: {query}")
                
                async for event in orchestrator.do_research(query):
                    await websocket.send_text(json.dumps(event))
                continue

            # Handle normal agent flow
            content = message_data.get("message") or message_data.get("content", "")
            context = message_data.get("context", {})
            
            # Handle approval signals from UI
            if message_data.get("type") == "approval_done":
                approved = message_data.get("approved", True)
                feedback = message_data.get("feedback")
                result = await orchestrator.handle_approval_signal(approved, feedback)
                
                if result.get("next_agent"):
                    # Define the task to run the stream
                    async def stream_task():
                        try:
                            async for event in orchestrator.process_message_stream(
                                result["message"], 
                                context, 
                                initial_agent=result["next_agent"]
                            ):
                                await websocket.send_text(json.dumps(event))
                        except asyncio.CancelledError:
                            print("🧱 Stream task cancelled via approval flow")
                        except Exception as e:
                            print(f"❌ Stream task error: {e}")

                    active_stream_task = asyncio.create_task(stream_task())
                continue

            if not content:
                print("⚠️ Received empty message, skipping process.")
                continue
                
            # Run the main process_message_stream in a task
            async def main_stream():
                try:
                    async for event in orchestrator.process_message_stream(content, context):
                        await websocket.send_text(json.dumps(event))
                except asyncio.CancelledError:
                    print("🧱 Main stream task cancelled")
                except Exception as e:
                    print(f"❌ Main stream task error: {e}")

            active_stream_task = asyncio.create_task(main_stream())
                
    except WebSocketDisconnect:
        app.state.connections.remove(websocket)
        print(f"🔌 Client disconnected. Total: {len(app.state.connections)}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in app.state.connections:
            app.state.connections.remove(websocket)

@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket, shell: Optional[str] = None):
    await websocket.accept()
    client_id = str(id(websocket))
    print(f"🖥️ Terminal Client connected: {client_id} (requested shell: {shell})")
    
    try:
        # Create PTY session (returns process OR fd depending on OS)
        await terminal_manager.create_pty(client_id, shell=shell)
        
        # Start reading task (logic moved into manager for better encapsulation)
        read_task = asyncio.create_task(
            terminal_manager.read_from_pty(client_id, websocket)
        )
        terminal_manager.active_tasks[client_id] = read_task
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "input":
                terminal_manager.write_to_pty(client_id, message.get("data", ""))
            elif message.get("type") == "resize":
                cols = message.get("cols", 80)
                rows = message.get("rows", 24)
                terminal_manager.resize_pty(client_id, rows, cols)
                
    except WebSocketDisconnect:
        print(f"🖥️ Terminal Client disconnected: {client_id}")
    except Exception as e:
        print(f"Terminal WebSocket error: {e}")
    finally:
        if client_id in terminal_manager.active_tasks:
            terminal_manager.active_tasks[client_id].cancel()
        terminal_manager.close_pty(client_id)

@app.get("/files")
async def list_files():
    """List all project files"""
    files = await file_manager.get_directory()
    return {
        "files": files,
        "workspace": str(file_manager.workspace_path) if file_manager.workspace_path else None
    }

@app.post("/files/upload")
async def upload_files(files: List[UploadFile] = File(...), path: str = Form(".")):
    """Upload files to the project"""
    saved = []
    for file in files:
        file_path = f"{path}/{file.filename}"
        content = await file.read()
        file_manager.write_file(file_path, content.decode())
        saved.append(file_path)
    return {"status": "success", "files": saved}

@app.post("/clear-chat")
async def clear_chat():
    """Clear conversation history"""
    orchestrator.clear_history()
    return {"status": "success"}

@app.post("/research")
async def initiate_research(data: dict):
    """Initiate a research mission"""
    query = data.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    # In a real app we'd trigger the background agent
    # For now we'll just acknowledge the mission start
    return {"status": "research_initiated", "query": query}

@app.get("/usage")
async def get_usage():
    """Get API usage statistics"""
    return usage_tracker.get_summary()

@app.get("/select-folder")
async def select_folder():
    """Open a native folder picker and return the selected path"""
    def _open_picker():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            root.lift()
            root.focus_force()
            path = filedialog.askdirectory(title="Select Project Folder")
            root.destroy()
            return path
        except Exception as e:
            print(f"❌ Error in folder picker: {e}")
            return None

    import asyncio
    selected_path = await asyncio.to_thread(_open_picker)
    
    if not selected_path:
        return {"cancelled": True}
        
    return {"path": selected_path}

@app.post("/set-workspace")
async def set_workspace(data: dict):
    path_str = data.get("path")
    if not path_str:
        raise HTTPException(status_code=400, detail="Path is required")
    
    # Path will be resolved by FileManager
    file_manager.set_workspace(Path(path_str))
    
    # Sync terminals to the new workspace
    terminal_manager.sync_workspace(file_manager.workspace_path)
    
    files = await file_manager.get_directory()
    return {
        "status": "success", 
        "workspace": str(file_manager.workspace_path),
        "files": files
    }

@app.post("/detach-workspace")
async def detach_workspace():
    file_manager.detach_workspace()
    return {"status": "detached"}

@app.post("/upload")
async def upload_files_multi(files: List[UploadFile] = File(...), paths: List[str] = Form(...)):
    """Upload multiple files with their relative paths"""
    saved = []
    # Identify the common project root name (first part of the path)
    project_name = None
    if paths:
        # Assuming path is "ProjectName/subdir/file"
        first_path = paths[0].replace("\\", "/")
        if "/" in first_path:
            project_name = first_path.split("/")[0]
            
    # Calculate absolute path for usage in set_workspace
    absolute_project_path = None
    if project_name:
        # If workspace is detached, files go to projects_root
        # We can ask file_manager where projects_root is
        projects_root = file_manager.projects_root
        absolute_project_path = str((projects_root / project_name).resolve())
        print(f"📂 [Upload] Detected project name: {project_name}")
        print(f"📂 [Upload] Calculated absolute path: {absolute_project_path}")

    for i, file in enumerate(files):
        rel_path = paths[i]
        result = await file_manager.save_file(file, rel_path)
        saved.append(result)
        
    return {
        "status": "success", 
        "count": len(saved), 
        "files": saved,
        "project_path": absolute_project_path # Frontend can use this for set-workspace
    }

@app.post("/create-file")
async def create_file(data: dict):
    path = data.get("path")
    content = data.get("content", "")
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")
    
    try:
        result = await file_manager.save_file_from_content(path, content)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/create-folder")
async def create_folder(path: str = Form(...)):
    try:
        result = await file_manager.create_folder(path)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/rename")
async def rename_item(data: dict):
    path = data.get("path")
    new_name = data.get("new_name")
    if not path or not new_name:
        raise HTTPException(status_code=400, detail="Path and new_name are required")
    
    try:
        result = await file_manager.rename_item(path, new_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/move")
async def move_item(data: dict):
    source_path = data.get("source_path")
    destination_folder = data.get("destination_folder", "")
    if not source_path:
        raise HTTPException(status_code=400, detail="source_path is required")
    
    try:
        result = await file_manager.move_item(source_path, destination_folder)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/files/{path:path}")
async def read_file(path: str):
    content = await file_manager.read_file(path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"path": path, "content": content}

@app.get("/pending-changes")
async def get_pending_changes():
    return file_manager.get_pending_changes()

@app.post("/approve")
async def approve_change(data: dict):
    """Approve a file change via JSON body"""
    change_id = data.get("change_id")
    if not change_id:
        raise HTTPException(status_code=400, detail="change_id is required")
        
    result = await file_manager.apply_change(change_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@app.post("/reject")
async def reject_change(data: dict):
    """Reject a file change via JSON body"""
    change_id = data.get("change_id")
    if not change_id:
        raise HTTPException(status_code=400, detail="change_id is required")
        
    result = file_manager.reject_change(change_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

    return result

@app.get("/reviews")
async def get_reviews():
    """Get review history and stats"""
    if not orchestrator.review_service:
        return {"reviews": [], "stats": {}}
    return orchestrator.review_service.get_latest_data()

@app.post("/reviews/apply")
async def apply_review_suggestion(data: dict):
    """Apply a suggestion from the review agent"""
    if not orchestrator.review_service:
        raise HTTPException(status_code=400, detail="Review service not active")
    
    return await orchestrator.review_service.apply_improvement(data)

@app.post("/reviews/new-session")
async def start_new_review_session():
    """Start a new review session (archives current session)"""
    if not orchestrator.review_service:
        raise HTTPException(status_code=400, detail="Review service not active")
    
    # Also reset the orchestrator's conversation for a fresh start
    orchestrator.conversation = []
    orchestrator.turn_count = 0
    
    return orchestrator.review_service.start_new_session()

@app.get("/reviews/history")
async def get_review_history():
    """Get archived review sessions"""
    if not orchestrator.review_service:
        return {"archived_sessions": [], "total_archived": 0}
    return orchestrator.review_service.get_history()

@app.get("/reviews/history/{session_id}")
async def get_session_details(session_id: str):
    """Get details for a specific archived session"""
    if not orchestrator.review_service:
        raise HTTPException(status_code=400, detail="Review service not active")
    
    session = orchestrator.review_service.get_session_details(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "agents": orchestrator.get_agent_status(),
        "usage": usage_tracker.get_summary()
    }

if __name__ == "__main__":
    import uvicorn
    # When running manually, we force Proactor
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
