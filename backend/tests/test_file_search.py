import pytest
from pathlib import Path
from services.file_manager import FileManager

@pytest.mark.asyncio
async def test_search():
    fm = FileManager()
    # Mock workspace for test
    fm.workspace_path = Path(".").resolve()
    
    # List all files first
    all_files = await fm.get_directory()
    print(f"Total files: {len(all_files)}")
    
    # Test search pattern "agents"
    search_results = await fm.get_directory("agents")
    print(f"Search results for 'agents': {len(search_results)}")
    for f in search_results:
        print(f" - {f['path']}")
