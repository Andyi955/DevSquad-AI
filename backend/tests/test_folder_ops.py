
import pytest
from fastapi.testclient import TestClient
import os
import shutil
import sys
from pathlib import Path

# Add parent directory to path to allow importing main
sys.path.append(str(Path(__file__).parent.parent))

from main import app, file_manager

client = TestClient(app)

# Setup a temporary test workspace
TEST_WORKSPACE = "test_workspace_folder_ops"

@pytest.fixture(scope="module", autouse=True)
def setup_teardown():
    os.makedirs(TEST_WORKSPACE, exist_ok=True)
    # Mock the workspace path in file_manager
    original_workspace = file_manager.workspace_path
    file_manager.set_workspace(os.path.abspath(TEST_WORKSPACE))
    
    yield
    
    # Teardown
    if os.path.exists(TEST_WORKSPACE):
        shutil.rmtree(TEST_WORKSPACE)
    file_manager.workspace_path = original_workspace

def test_create_folder():
    """Test creating a new folder via API"""
    response = client.post("/create-folder", data={"path": "new_folder"})
    assert response.status_code == 200
    assert os.path.isdir(os.path.join(TEST_WORKSPACE, "new_folder"))

def test_create_nested_folder():
    """Test creating a nested folder via API"""
    response = client.post("/create-folder", data={"path": "parent/child"})
    assert response.status_code == 200
    assert os.path.isdir(os.path.join(TEST_WORKSPACE, "parent", "child"))

def test_move_folder():
    """Test moving a folder via API"""
    # Create source folder
    source = os.path.join(TEST_WORKSPACE, "source_folder")
    dest_dir = os.path.join(TEST_WORKSPACE, "target_dir")
    os.makedirs(source, exist_ok=True)
    os.makedirs(dest_dir, exist_ok=True)
    
    # Move it into target_dir
    response = client.post("/move", json={
        "source_path": "source_folder",
        "destination_folder": "target_dir"
    })
    
    assert response.status_code == 200
    assert not os.path.exists(source)
    assert os.path.exists(os.path.join(dest_dir, "source_folder"))

def test_move_file():
    """Test moving a file via API"""
    # Create source file and target folder
    source_file = os.path.join(TEST_WORKSPACE, "test_file.txt")
    dest_dir = os.path.join(TEST_WORKSPACE, "file_dest")
    os.makedirs(dest_dir, exist_ok=True)
    
    with open(source_file, "w") as f:
        f.write("content")
        
    # Move it into file_dest
    response = client.post("/move", json={
        "source_path": "test_file.txt",
        "destination_folder": "file_dest"
    })
    
    assert response.status_code == 200
    assert not os.path.exists(source_file)
    assert os.path.exists(os.path.join(dest_dir, "test_file.txt"))
