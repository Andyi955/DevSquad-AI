import pytest
import os
import shutil
from pathlib import Path
import asyncio
from services.file_manager import FileManager

# Mock environment variable for max file size
os.environ["MAX_FILE_SIZE_MB"] = "10"

@pytest.fixture
def file_manager():
    fm = FileManager()
    # Use a temporary test directory within projects to be safe, or mock workspace_path
    # For integration testing, let's use a subdirectory 'test_env'
    fm.workspace_path = Path("./projects/test_env").resolve()
    if fm.workspace_path.exists():
        shutil.rmtree(fm.workspace_path)
    fm.workspace_path.mkdir(parents=True, exist_ok=True)
    yield fm
    # Cleanup
    if fm.workspace_path.exists():
        shutil.rmtree(fm.workspace_path)

@pytest.mark.asyncio
async def test_create_file_in_folder_success(file_manager):
    # 1. Create a folder
    await file_manager.create_folder("utils")
    
    # 2. Create a file inside it
    result = await file_manager.save_file_from_content("utils/helper.js", "console.log('hi')")
    assert result["status"] == "created"
    assert (file_manager.workspace_path / "utils" / "helper.js").exists()

@pytest.mark.asyncio
async def test_create_nested_file_structure(file_manager):
    # Should create parent folders automatically
    result = await file_manager.save_file_from_content("a/b/c/deep.txt", "deep content")
    assert result["status"] == "created"
    assert (file_manager.workspace_path / "a" / "b" / "c" / "deep.txt").exists()

@pytest.mark.asyncio
async def test_error_creating_file_when_parent_is_file(file_manager):
    # 1. Create a file
    await file_manager.save_file_from_content("utils.js", "content")
    
    # 2. Try to create a file treating 'utils.js' as a folder
    # This triggers the WinError 183 scenario on Windows (or NotADirectoryError on Linux)
    # Our new error handling should catch this and raise ValueError with specific message
    
    with pytest.raises(ValueError) as excinfo:
        await file_manager.save_file_from_content("utils.js/child.txt", "content")
    
    error_msg = str(excinfo.value)
    print(f"Caught error: {error_msg}")
    assert "It is a file, not a folder" in error_msg or "Cannot create folder structure" in error_msg

@pytest.mark.asyncio
async def test_error_creating_file_on_existing_folder(file_manager):
    # 1. Create a folder
    await file_manager.create_folder("my_folder")
    
    # 2. Try to create a file with same name
    with pytest.raises(ValueError) as excinfo:
        # On Windows this might fail with Access Denied or FileExists depending on how open() handles it
        # But we added an explicit check: if file_path.exists() and file_path.is_dir()...
        await file_manager.save_file_from_content("my_folder", "content")
        
    assert "A folder with this name already exists" in str(excinfo.value)
