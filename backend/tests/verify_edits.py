import asyncio
import re
from typing import List, Optional

class MockOrchestrator:
    def _extract_code_block(self, content: str, start_index: int = 0) -> Optional[tuple[str, int, int]]:
        pattern = r'```(?:\w+)?\n(.*?)\n```'
        match = re.search(pattern, content[start_index:], re.DOTALL)
        if match:
            code_start = start_index + match.start()
            code_end = start_index + match.end()
            return match.group(1).strip(), code_start, code_end
        return None

    def _extract_all_edits(self, full_response: str) -> List[dict]:
        edits = []
        cue_pattern = r'\[(EDIT|CREATE)_FILE:([^\]]+)\]'
        for match in re.finditer(cue_pattern, full_response):
            action = match.group(1).lower()
            path = match.group(2)
            cue_end = match.end()
            extracted = self._extract_code_block(full_response, cue_end)
            if extracted:
                code_content, block_start, block_end = extracted
                next_cue = re.search(cue_pattern, full_response[cue_end:block_start])
                if not next_cue:
                    edits.append({
                        "action": action,
                        "path": path,
                        "content": code_content,
                        "cue_start": match.start(),
                        "cue_end": match.end(),
                        "block_start": block_start,
                        "block_end": block_end
                    })
        return edits

async def test_multi_edit_association():
    orchestrator = MockOrchestrator()
    
    # Message with TWO edits and some notes
    response = """
Here are my changes:

[EDIT_FILE:sample.py]
```python
print('new sample content')
```

And for the other file:

[CREATE_FILE:utils.py]
```python
print('new utils content')
```

Final summary.
"""
    
    edits = orchestrator._extract_all_edits(response)
    
    print(f"Extracted {len(edits)} edits.")
    for e in edits:
        print(f"Path: {e['path']}, Content: {e['content']}")
    
    assert len(edits) == 2
    assert edits[0]['path'] == 'sample.py'
    assert edits[0]['content'] == "print('new sample content')"
    assert edits[1]['path'] == 'utils.py'
    assert edits[1]['content'] == "print('new utils content')"
    
    # Test placeholder replacement logic (simulated)
    replacements = []
    for e in edits:
        replacements.append({"start": e["cue_start"], "end": e["block_end"], "text": f"[File {e['action'].capitalize()}: {e['path']}]"})
    
    replacements.sort(key=lambda x: x["start"], reverse=True)
    clean = response
    for r in replacements:
        clean = clean[:r["start"]] + r["text"] + clean[r["end"]:]
    
    print("\nCleaned Message:")
    print(clean)
    
    assert "[File Edit: sample.py]" in clean
    assert "[File Create: utils.py]" in clean
    assert "print('new sample content')" not in clean
    assert "print('new utils content')" not in clean
    print("\n✅ Verification SUCCESS")

if __name__ == "__main__":
    asyncio.run(test_multi_edit_association())
