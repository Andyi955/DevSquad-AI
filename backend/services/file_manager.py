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
        # Base paths for safe fallbacks
        self.root_path = Path(__file__).parent.parent.parent.resolve()
        self.projects_root = self.root_path / "projects"
        self.projects_root.mkdir(exist_ok=True)
        
        self.workspace_path = None  # No workspace until user opens a folder
        self.max_file_size = int(os.getenv("MAX_FILE_SIZE_MB", 10)) * 1024 * 1024
        self.pending_changes: Dict[str, PendingChange] = {}
    
    def set_workspace(self, path: Path):
        """Set the workspace to a new absolute path"""
        old_path = self.workspace_path
        self.workspace_path = Path(path).resolve()
        # Ensure it exists
        self.workspace_path.mkdir(parents=True, exist_ok=True)
        print(f"📂 [FileManager] Workspace SWITCH: {old_path} -> {self.workspace_path}")
        # Clear any pending changes from the previous project for safety
        self.pending_changes = {}

    def detach_workspace(self):
        """Close current workspace view"""
        print(f"🔌 [FileManager] Detaching workspace: {self.workspace_path}")
        self.workspace_path = None
        self.pending_changes = {}
    
    def _ensure_workspace(self):
        """Check that workspace is set before operations (Legacy check)"""
        if self.workspace_path is None:
            # Instead of failing, we now log that we are working in the base projects root
            print("💡 [FileManager] No active workspace. Using projects root.")
    
    def _sanitize_path(self, path: str) -> Path:
        """Sanitize and validate file path"""
        # If no workspace is active, we save to the projects root
        # This allows uploading NEW projects while in a detached state
        is_detached = self.workspace_path is None
        active_root = self.workspace_path if not is_detached else self.projects_root

        # Remove leading slashes and normalize
        clean_path = path.lstrip("/\\").replace("\\", "/")
        full_path = (active_root / clean_path).resolve()
        
        # Ensure path is within the intended root
        if not str(full_path).startswith(str(active_root)):
            raise ValueError(f"Path must be within {active_root}")
        
        return full_path
    
    def _validate_extension(self, path: Path) -> bool:
        """Check if file extension is allowed"""
        # Allow files with no extension (e.g. Dockerfile, LICENSE)
        if not path.suffix:
            return True
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
    
    async def save_file_from_content(self, path: str, content: str) -> dict:
        """Create a new file from string content"""
        file_path = self._sanitize_path(path)
        
        # Validate extension
        if not self._validate_extension(file_path):
            raise ValueError(f"File type not allowed: {file_path.suffix}")
        
        print(f"📂 [FileManager] Creating file at: {file_path}")
        
        if file_path.exists() and file_path.is_dir():
            raise ValueError(f"Cannot create file '{path}': A folder with this name already exists")

        # Create parent directories safely
        try:
            if file_path.parent.exists() and not file_path.parent.is_dir():
                 raise ValueError(f"Cannot create file in '{file_path.parent.name}': It is a file, not a folder")
            
            file_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            # Catch WinError 183 and others
            print(f"❌ [FileManager] mkdir failed: {e}")
            if "Cannot create a file when that file already exists" in str(e):
                raise ValueError(f"Cannot create folder structure for '{path}'. A file with the same name as a parent folder already exists.")
            raise ValueError(f"System error ensuring folder structure: {e}")
        
        # Write content
        try:
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(content)
        except Exception as e:
            print(f"❌ [FileManager] Write failed: {e}")
            raise ValueError(f"Failed to write file content: {e}")
        
        print(f"✅ [FileManager] Successfully created: {file_path}")
        return {
            "path": str(file_path.relative_to(self.workspace_path)).replace("\\", "/"),
            "size": len(content.encode('utf-8')),
            "status": "created"
        }
    
    async def create_folder(self, path: str) -> dict:
        """Create a new folder"""
        folder_path = self._sanitize_path(path)
        folder_path.mkdir(parents=True, exist_ok=True)
        
        return {
            "path": str(folder_path.relative_to(self.workspace_path)).replace("\\", "/"),
            "status": "created"
        }
    
    async def move_item(self, source_path: str, destination_folder: str) -> dict:
        """Move a file or folder to a new location within the workspace"""
        import shutil
        
        source = self._sanitize_path(source_path)
        dest_folder = self._sanitize_path(destination_folder)
        
        if not source.exists():
            raise ValueError(f"Source does not exist: {source_path}")
        
        if not dest_folder.is_dir():
            raise ValueError(f"Destination is not a folder: {destination_folder}")
        
        # Prevent moving into itself
        if str(dest_folder).startswith(str(source)):
            raise ValueError("Cannot move a folder into itself")
        
        # Calculate new path
        item_name = source.name
        new_path = dest_folder / item_name
        
        if new_path.exists():
            raise ValueError(f"An item named '{item_name}' already exists in the destination")
        
        # Move the item
        shutil.move(str(source), str(new_path))
        
        return {
            "old_path": source_path,
            "new_path": str(new_path.relative_to(self.workspace_path)).replace("\\", "/"),
            "status": "moved"
        }

    async def rename_item(self, path: str, new_name: str) -> dict:
        """Rename a file or folder at its current location"""
        source = self._sanitize_path(path)
        
        if not source.exists():
            raise ValueError(f"Item does not exist: {path}")
            
        # Ensure new_name is just a name and not a path
        if "/" in new_name or "\\" in new_name:
            raise ValueError("Rename only accepts a name, not a full path")
            
        new_path = source.parent / new_name
        
        if new_path.exists():
            raise ValueError(f"An item named '{new_name}' already exists")
            
        # Rename on disk
        source.rename(new_path)
        
        return {
            "old_path": path,
            "new_path": str(new_path.relative_to(self.workspace_path)).replace("\\", "/"),
            "status": "renamed"
        }
    
    async def get_directory(self, search_pattern: Optional[str] = None) -> List[dict]:
        """List all files in workspace with optional search pattern (Read Only)"""
        # Return empty list if no workspace is set
        if self.workspace_path is None:
            return []
        
        print(f"🔍 [FileManager] Getting directory for: {self.workspace_path}")
        files = []
        
        for path in self.workspace_path.rglob("*"):
            # Include both files (validated) and directories
            is_dir = path.is_dir()
            is_file = path.is_file()
            
            if (is_file and self._validate_extension(path)) or is_dir:
                rel_path = str(path.relative_to(self.workspace_path)).replace("\\", "/")
                
                # Filter by search pattern if provided
                if search_pattern and search_pattern.lower() not in rel_path.lower():
                    continue
                    
                stats = path.stat()
                file_info = {
                    "path": rel_path,
                    "size": stats.st_size if is_file else 0,
                    "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    "extension": path.suffix if is_file else None,
                    "type": "file" if is_file else "folder"
                }
                files.append(file_info)
                # Verbose logging to catch the "merging" bug
                print(f"  {'📄' if is_file else '📁'} Found: {rel_path}")
        
        print(f"🏁 [FileManager] Found {len(files)} files total.")
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
        """Safe Switch: Clear UI state only. Files remain safe on your hard drive."""
        try:
            # We NO LONGER delete files. This function is now a safety no-op
            # to preserve data during project switching.
            print("🛡️ [FileManager] Safe switch triggered: Preserving files on disk.")
            return {"status": "cleared", "deleted": 0, "message": "State cleared. Files remain safe on disk."}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
