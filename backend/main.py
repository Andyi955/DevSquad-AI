"""
Multi-Agent Code Assistant - FastAPI Backend
Real-time AI agent collaboration for code review and development
"""

import os
import json
import asyncio
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
usage_tracker = UsageTracker()
web_scraper = WebScraper()
orchestrator = AgentOrchestrator(usage_tracker, file_manager)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 Starting Multi-Agent Code Assistant...")
    await orchestrator.initialize()
    yield
    # Shutdown
    print("👋 Shutting down...")

app = FastAPI(
    title="Multi-Agent Code Assistant",
    description="AI agents collaborate to review and improve your code",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Models ==============

class ChatMessage(BaseModel):
    message: str
    context: Optional[dict] = None

class FileContent(BaseModel):
    path: str
    content: str

class ApprovalRequest(BaseModel):
    change_id: str
    approved: bool

class ResearchQuery(BaseModel):
    query: str
    sources: Optional[List[str]] = None

# ============== WebSocket Connection Manager ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌 Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"🔌 Client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting: {e}")

manager = ConnectionManager()

# ============== REST Endpoints ==============

@app.get("/")
async def root():
    return {"message": "🤖 Multi-Agent Code Assistant API", "status": "running"}

@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...), 
    paths: List[str] = Form(None)
):
    """Upload code files to workspace"""
    uploaded = []
    
    # If paths are not provided (e.g. simple drag drop without folder), use empty list
    # But usually creating a list of None or handling the index is better
    
    for i, file in enumerate(files):
        try:
            # Get corresponding path if available
            rel_path = paths[i] if paths and i < len(paths) else None
            # If path is "undefined" string (from frontend FormData sometimes), ignore it
            if rel_path == "undefined" or rel_path == "null":
                rel_path = None
                
            result = await file_manager.save_file(file, relative_path=rel_path)
            uploaded.append(result)
        except Exception as e:
            print(f"Error uploading {file.filename}: {e}")
            # Continue uploading other files instead of failing all? 
            # Or raise error. Let's return error for now to be safe, or just skip.
            # User experience: probably better to see what failed. 
            pass # We'll just skip failed ones or maybe we should raise
            
    return {"uploaded": uploaded, "count": len(uploaded)}

@app.get("/files")
async def list_files():
    """List all files in workspace"""
    files = await file_manager.list_files()
    return {"files": files}

@app.get("/files/{path:path}")
async def read_file(path: str):
    """Read a specific file"""
    content = await file_manager.read_file(path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"path": path, "content": content}

@app.put("/files/{path:path}")
async def write_file(path: str, body: FileContent):
    """Write/update a file (creates pending change)"""
    change_id = await file_manager.create_pending_change(path, body.content)
    return {"change_id": change_id, "status": "pending_approval"}

@app.get("/pending-changes")
async def get_pending_changes():
    """Get all pending file changes awaiting approval"""
    changes = file_manager.get_pending_changes()
    return {"changes": changes}

@app.delete("/files")
async def clear_workspace():
    """Clear all files in workspace"""
    result = await file_manager.clear_workspace()
    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@app.post("/approve")
async def approve_change(request: ApprovalRequest):
    """Approve or reject a file change"""
    if request.approved:
        result = await file_manager.apply_change(request.change_id)
    else:
        result = file_manager.reject_change(request.change_id)
    
    # Broadcast to all connected clients
    await manager.broadcast({
        "type": "change_result",
        "change_id": request.change_id,
        "approved": request.approved,
        "result": result
    })
    
    return result

@app.post("/research")
async def web_research(query: ResearchQuery):
    """Perform web research and return summarized results"""
    usage_tracker.track("research", 1)
    results = await web_scraper.search_and_summarize(query.query, query.sources)
    return results

@app.get("/usage")
async def get_usage():
    """Get API usage statistics"""
    return usage_tracker.get_stats()

@app.post("/chat")
async def chat(message: ChatMessage):
    """Send a message to agents (non-streaming, returns full response)"""
    response = await orchestrator.process_message(
        message.message, 
        message.context,
        stream=False
    )
    return response

# ============== WebSocket Endpoint ==============

@app.websocket("/ws/agents")
async def websocket_agents(websocket: WebSocket):
    """Real-time agent conversation streaming"""
    await manager.connect(websocket)
    
    current_task: Optional[asyncio.Task] = None
    
    async def run_agent_stream(message: str, context: dict, initial_agent: str = None):
        try:
            # Add files context if not provided
            if "files" not in context:
                context["files"] = await file_manager.list_files()
            
            # Stream agent responses
            async for event in orchestrator.process_message_stream(message, context, initial_agent=initial_agent):
                await websocket.send_json(event)
        except asyncio.CancelledError:
            print("Agent task cancelled")
        except Exception as e:
            print(f"Error in agent stream: {e}")
            await websocket.send_json({"type": "error", "agent": "System", "content": str(e)})

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            if data.get("type") == "chat":
                # Cancel existing task if any
                if current_task and not current_task.done():
                    current_task.cancel()
                
                message = data.get("message", "")
                context = data.get("context", {})
                
                # Start new streaming task
                current_task = asyncio.create_task(run_agent_stream(message, context))
                
            elif data.get("type") == "approval_done":
                # Handle approval signal
                approved = data.get("approved", True)
                feedback = data.get("feedback")
                
                # Get signal from orchestrator
                signal = await orchestrator.handle_approval_signal(approved, feedback)
                
                # Start new streaming task to resume
                if current_task and not current_task.done():
                    current_task.cancel()
                
                context = data.get("context", {})
                current_task = asyncio.create_task(run_agent_stream(
                    message=signal["message"], 
                    context=context,
                    initial_agent=signal["next_agent"]
                ))

            elif data.get("type") == "stop":
                if current_task and not current_task.done():
                    current_task.cancel()
                    await websocket.send_json({
                        "type": "agent_done", 
                        "agent": "System", 
                        "message": "Task stopped by user 🛑"
                    })
                
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        if current_task and not current_task.done():
            current_task.cancel()
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if current_task and not current_task.done():
            current_task.cancel()
        manager.disconnect(websocket)

# ============== Health Check ==============

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "agents": orchestrator.get_agent_status(),
        "usage": usage_tracker.get_summary()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
