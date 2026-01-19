import pytest
import re
from pathlib import Path
from agents.orchestrator import AgentOrchestrator
from services.file_manager import FileManager
from services.usage_tracker import UsageTracker

@pytest.mark.asyncio
async def test_read_file_cue():
    file_manager = FileManager()
    # Mock workspace
    file_manager.workspace_path = Path(".").resolve()
    usage_tracker = UsageTracker()
    orchestrator = AgentOrchestrator(file_manager, None, usage_tracker)
    
    # Testing cue extraction logic
    test_file_path = "test_cue.py"
    cues = orchestrator._extract_cues(f"I will check the file. [READ_FILE:{test_file_path}]")
    assert f"READ:{test_file_path}" in cues
    print("✅ Cue extraction successful")

@pytest.mark.asyncio
async def test_file_change_concise():
    file_manager = FileManager()
    orchestrator = AgentOrchestrator(file_manager, None, None)
    
    full_response = "I have updated the file.\n\n```python\nprint('new code')\n```\n\n[EDIT_FILE:test.py]"
    
    # Verify the cleaning logic in orchestrator
    clean_message = orchestrator._clean_message_for_display(full_response)
    
    # The new logic removes the tag
    assert "[EDIT_FILE:" not in clean_message
    assert "print('new code')" in clean_message
    print("✅ Concise message logic successful")
