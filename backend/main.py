import os
import sys
import asyncio

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
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle manual research triggers from UI
            if message_data.get("type") == "research":
                query = message_data.get("query")
                print(f"🕵️‍♂️ Manual research initiated: {query}")
                
                async for event in orchestrator.do_research(query):
                    await websocket.send_text(json.dumps(event))
                continue

            # Handle normal agent flow
            content = message_data.get("content", "")
            attached_files = message_data.get("files", [])
            
            # Create context with attached files
            context = {"attached_files": attached_files} if attached_files else {}
            
            async for event in orchestrator.process_message_stream(content, context):
                await websocket.send_text(json.dumps(event))
                
    except WebSocketDisconnect:
        app.state.connections.remove(websocket)
        print(f"🔌 Client disconnected. Total: {len(app.state.connections)}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in app.state.connections:
            app.state.connections.remove(websocket)

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

@app.post("/set-workspace")
async def set_workspace(data: dict):
    path_str = data.get("path")
    if not path_str:
        raise HTTPException(status_code=400, detail="Path is required")
    
    # Path will be resolved by FileManager
    file_manager.set_workspace(Path(path_str))
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
    for i, file in enumerate(files):
        rel_path = paths[i]
        result = await file_manager.save_file(file, rel_path)
        saved.append(result)
    return {"status": "success", "count": len(saved), "files": saved}

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

@app.post("/approve/{change_id}")
async def approve_change(change_id: str):
    result = await file_manager.apply_change(change_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Check if this change finished a mission
    await orchestrator.handle_approval_signal(approved=True)
    return result

@app.post("/reject/{change_id}")
async def reject_change(change_id: str):
    result = file_manager.reject_change(change_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    await orchestrator.handle_approval_signal(approved=False)
    return result

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
