import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.file_manager import FileManager

async def test_search():
    fm = FileManager()
    # Assuming the current directory is the project root
    print(f"Workspace path: {fm.workspace_path}")
    
    # List all files first
    all_files = await fm.list_files()
    print(f"Total files: {len(all_files)}")
    
    # Test search pattern "sample"
    search_results = await fm.list_files("sample")
    print(f"Search results for 'sample': {len(search_results)}")
    for f in search_results:
        print(f" - {f['path']}")
    
    # Test non-existent pattern
    no_results = await fm.list_files("xyz123abc")
    print(f"Search results for 'xyz123abc': {len(no_results)}")

if __name__ == "__main__":
    asyncio.run(test_search())
