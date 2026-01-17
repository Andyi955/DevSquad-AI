import sys
import os
import shutil
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app, file_manager

client = TestClient(app)

# Setup temporary test workspaces
TEST_ROOT = Path("test_environments").resolve()
PROJECT_A = TEST_ROOT / "project_a"
PROJECT_B = TEST_ROOT / "project_b"

@pytest.fixture(scope="module", autouse=True)
def setup_teardown():
    # Cleanup any old test artifacts
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    
    # Create test projects
    PROJECT_A.mkdir(parents=True)
    PROJECT_B.mkdir(parents=True)
    
    # Add some initial files
    (PROJECT_A / "index.html").write_text("<html></html>")
    (PROJECT_A / "styles").mkdir()
    (PROJECT_A / "styles" / "main.css").write_text("body {}")
    
    (PROJECT_B / "readme.md").write_text("# Project B")
    
    # Save original workspace to restore later
    original_workspace = file_manager.workspace_path
    
    yield
    
    # Teardown
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    file_manager.workspace_path = original_workspace

def test_status_no_workspace():
    """Verify system state when no workspace is active"""
    file_manager.workspace_path = None
    response = client.get("/files")
    assert response.status_code == 200
    assert response.json()["files"] == []
    assert response.json()["workspace"] is None

def test_set_workspace_and_switch():
    """Test the 'Safe Switch' project switching functionality"""
    # Switch to Project A
    response = client.post("/set-workspace", json={"path": str(PROJECT_A)})
    assert response.status_code == 200
    assert "project_a" in response.json()["workspace"].lower()
    assert len(response.json()["files"]) >= 2 # index.html and styles/
    
    # Ensure index.html is present
    file_paths = [f["path"] for f in response.json()["files"]]
    assert "index.html" in file_paths
    
    # Switch to Project B
    response = client.post("/set-workspace", json={"path": str(PROJECT_B)})
    assert response.status_code == 200
    assert "project_b" in response.json()["workspace"].lower()
    
    file_paths = [f["path"] for f in response.json()["files"]]
    assert "readme.md" in file_paths
    assert "index.html" not in file_paths # Safe switch check

def test_rename_file_and_folder():
    """Test inline renaming for both files and folders"""
    client.post("/set-workspace", json={"path": str(PROJECT_A)})
    
    # Rename File
    response = client.post("/rename", json={
        "path": "index.html",
        "new_name": "home.html"
    })
    assert response.status_code == 200
    assert (PROJECT_A / "home.html").exists()
    assert not (PROJECT_A / "index.html").exists()
    
    # Rename Folder
    response = client.post("/rename", json={
        "path": "styles",
        "new_name": "css"
    })
    assert response.status_code == 200
    assert (PROJECT_A / "css").is_dir()
    assert (PROJECT_A / "css" / "main.css").exists()
    assert not (PROJECT_A / "styles").exists()

def test_move_file_and_folder_to_root():
    """Test drag and drop movement to root and nested folders"""
    client.post("/set-workspace", json={"path": str(PROJECT_A)})
    
    # Create a nested file
    (PROJECT_A / "temp").mkdir(exist_ok=True)
    (PROJECT_A / "temp" / "move_me.txt").write_text("bye")
    
    # Move from nested to root
    response = client.post("/move", json={
        "source_path": "temp/move_me.txt",
        "destination_folder": "" # Root
    })
    assert response.status_code == 200
    assert (PROJECT_A / "move_me.txt").exists()
    assert not (PROJECT_A / "temp" / "move_me.txt").exists()
    
    # Move folder into another folder
    response = client.post("/move", json={
        "source_path": "temp",
        "destination_folder": "css"
    })
    assert response.status_code == 200
    assert (PROJECT_A / "css" / "temp").is_dir()

def test_create_folder_duplicate_handling():
    """Test folder creation with existing paths"""
    client.post("/set-workspace", json={"path": str(PROJECT_A)})
    
    # Create new folder using Form data
    response = client.post("/create-folder", data={"path": "assets"})
    assert response.status_code == 200
    
    # Try to create it again (should return 200 because of exist_ok=True in FileManager)
    response = client.post("/create-folder", data={"path": "assets"})
    assert response.status_code == 200

def test_orchestrator_scrubbing():
    """Test technical tag scrubbing and code block consolidation in Orchestrator"""
    from agents.orchestrator import AgentOrchestrator
    orchestrator = AgentOrchestrator()
    
    # 1. Test short code block consolidation (word-size blocks to inline)
    dirty_msg = "Please check my ```test.py``` file."
    clean_msg = orchestrator._clean_message_for_display(dirty_msg)
    print(f"CLEANED_MSG: '{clean_msg}'")
    # The current implementation adds spaces around the backticks
    assert "`test.py`" in clean_msg
    
    # 2. Test removal of internal file placeholders
    # Note: We need to match the exact placeholder format
    with_placeholder = "I have updated the code. [File Edit: main.py] Is there anything else?"
    clean_placeholder = orchestrator._clean_message_for_display(with_placeholder)
    assert "[File Edit: main.py]" not in clean_placeholder
    assert "I have updated the code. Is there anything else?" in clean_placeholder
    
    # 3. Test ghost punctuation cleanup after tag removal
    ghost_punct = "Finished task [DONE]."
    clean_ghost = orchestrator._clean_message_for_display(ghost_punct)
    assert "[DONE]" not in clean_ghost
    assert clean_ghost.strip() == "Finished task."
    
    # 4. Test handoff cue to @mention conversion
    handoff_msg = "[→SENIOR] Can you review this?"
    clean_handoff = orchestrator._clean_message_for_display(handoff_msg)
    assert "[→SENIOR]" not in clean_handoff
    assert "@Senior Dev" in clean_handoff

@pytest.mark.asyncio
async def test_orchestrator_duplication_prevention():
    """Verify that approval doesn't trigger extra responses after DONE cue"""
    from agents.orchestrator import AgentOrchestrator, Message
    orchestrator = AgentOrchestrator()
    
    # Simulate a finished mission with a DONE cue
    orchestrator.conversation.append(Message(
        agent="Junior Dev",
        content="Task finished. [DONE]",
        cues=["DONE"]
    ))
    orchestrator.mission_status = "IN_PROGRESS"
    
    # Trigger approval - it should NOT return a next agent
    signal = await orchestrator.handle_approval_signal(approved=True)
    
    assert signal["next_agent"] is None
    assert signal["message"] is None
    assert orchestrator.mission_status == "IDLE"
    
    # Simulate a mission that is NOT finished (handoff pending)
    orchestrator.conversation.append(Message(
        agent="Junior Dev",
        content="I need a review [→SENIOR]",
        cues=["SENIOR"]
    ))
    orchestrator.last_handoff = "Senior Dev"
    
    # Trigger approval - it SHOULD return Senior Dev
    signal = await orchestrator.handle_approval_signal(approved=True)
    assert signal["next_agent"] == "Senior Dev"
    assert "approved" in signal["message"].lower()

