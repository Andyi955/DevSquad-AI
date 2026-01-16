"""
File Manager Service
Handles file uploads, reads, writes with approval workflow
"""

import os
import uuid
import asyncio
import aiofiles
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime
from dataclasses import dataclass, field, asdict


@dataclass
class PendingChange:
    """Represents a pending file change awaiting approval"""
    id: str
    path: str
    action: str  # "create", "edit", or "delete"
    new_content: str
    old_content: Optional[str] = None
    agent: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self):
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        return d


class FileManager:
    """Manages file operations within the workspace sandbox"""
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss',
        '.json', '.yaml', '.yml', '.md', '.txt', '.sh', '.bat',
        '.java', '.cpp', '.c', '.h', '.go', '.rs', '.rb', '.php'
    }
    
    def __init__(self):
        self.workspace_path = Path("./projects").resolve()
        self.max_file_size = int(os.getenv("MAX_FILE_SIZE_MB", 10)) * 1024 * 1024
        self.pending_changes: Dict[str, PendingChange] = {}
        
        # Create workspace if it doesn't exist
        self.workspace_path.mkdir(parents=True, exist_ok=True)
    
    def _sanitize_path(self, path: str) -> Path:
        """Sanitize and validate file path"""
        # Remove leading slashes and normalize
        clean_path = path.lstrip("/\\").replace("\\", "/")
        full_path = (self.workspace_path / clean_path).resolve()
        
        # Ensure path is within workspace (prevent directory traversal)
        if not str(full_path).startswith(str(self.workspace_path)):
            raise ValueError("Path must be within workspace")
        
        return full_path
    
    def _validate_extension(self, path: Path) -> bool:
        """Check if file extension is allowed"""
        return path.suffix.lower() in self.ALLOWED_EXTENSIONS
    
    async def save_file(self, upload_file, relative_path: str = None) -> dict:
        """Save an uploaded file to workspace"""
        filename = upload_file.filename
        
        # Validate extension
        if not self._validate_extension(Path(filename)):
            raise ValueError(f"File type not allowed: {Path(filename).suffix}")
        
        # Read content
        content = await upload_file.read()
        
        # Check size
        if len(content) > self.max_file_size:
            raise ValueError(f"File too large. Max size: {self.max_file_size // (1024*1024)}MB")
        
        # Save file
        # Use relative_path if provided (for folder uploads), otherwise filename
        target_path = relative_path if relative_path else filename
        file_path = self._sanitize_path(target_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        return {
            "path": str(file_path.relative_to(self.workspace_path)).replace("\\", "/"),
            "size": len(content),
            "status": "uploaded"
        }
    
    async def list_files(self, search_pattern: Optional[str] = None) -> List[dict]:
        """List all files in workspace with optional search pattern"""
        files = []
        
        for path in self.workspace_path.rglob("*"):
            if path.is_file() and self._validate_extension(path):
                rel_path = str(path.relative_to(self.workspace_path)).replace("\\", "/")
                
                # Filter by search pattern if provided
                if search_pattern and search_pattern.lower() not in rel_path.lower():
                    continue
                    
                stats = path.stat()
                files.append({
                    "path": rel_path,
                    "size": stats.st_size,
                    "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    "extension": path.suffix
                })
        
        return sorted(files, key=lambda x: x["path"])
    
    async def read_file(self, path: str) -> Optional[str]:
        """Read file content"""
        try:
            file_path = self._sanitize_path(path)
            
            if not file_path.exists():
                return None
            
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                return await f.read()
        except Exception as e:
            print(f"Error reading file: {e}")
            return None
    
    async def create_pending_change(
        self, 
        path: str, 
        content: str = None, 
        agent: str = None,
        action: str = None
    ) -> str:
        """Create a pending file change (requires approval)"""
        file_path = self._sanitize_path(path)
        
        # Check if file exists to determine action and old content
        old_content = None
        is_existing = file_path.exists() and file_path.is_file()

        # If it's a delete action, we handle it specifically
        if action == "delete":
            if is_existing:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    old_content = await f.read()
        else:
            # For create/edit/write
            if is_existing:
                action = "edit"
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    old_content = await f.read()
            else:
                action = "create"
        
        # Generate change ID
        change_id = str(uuid.uuid4())[:8]
        
        # Store pending change
        self.pending_changes[change_id] = PendingChange(
            id=change_id,
            path=str(file_path.relative_to(self.workspace_path)),
            action=action,
            new_content=content if content is not None else "",
            old_content=old_content,
            agent=agent
        )
        
        return change_id
    
    def get_pending_changes(self) -> List[dict]:
        """Get all pending changes"""
        return [change.to_dict() for change in self.pending_changes.values()]
    
    async def apply_change(self, change_id: str) -> dict:
        """Apply (approve) a pending change"""
        if change_id not in self.pending_changes:
            return {"error": "Change not found", "status": "failed"}
        
        change = self.pending_changes[change_id]
        file_path = self._sanitize_path(change.path)
        
        try:
            # Write file or delete
            if change.action == "delete":
                if file_path.exists():
                    file_path.unlink()
            else:
                # Create parent directories if needed
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Write file
                async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                    await f.write(change.new_content)
            
            # Remove from pending
            del self.pending_changes[change_id]
            
            return {
                "status": "applied",
                "path": change.path,
                "action": change.action
            }
        except Exception as e:
            return {"error": str(e), "status": "failed"}
    
    def reject_change(self, change_id: str) -> dict:
        """Reject a pending change"""
        if change_id not in self.pending_changes:
            return {"error": "Change not found", "status": "failed"}
        
        change = self.pending_changes[change_id]
        del self.pending_changes[change_id]
        
        return {
            "status": "rejected",
            "path": change.path
        }
    
    async def clear_workspace(self) -> dict:
        """Delete all files in workspace"""
        try:
            import shutil
            count = 0
            for path in self.workspace_path.iterdir():
                if path.is_file():
                    path.unlink()
                    count += 1
                elif path.is_dir():
                    shutil.rmtree(path)
                    count += 1
            
            return {"status": "cleared", "deleted": count}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
