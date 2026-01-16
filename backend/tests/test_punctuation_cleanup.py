"""
Test suite for agent response punctuation cleanup
Verifies that the orchestrator strips trailing punctuation after code blocks
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from agents.orchestrator import AgentOrchestrator


class TestPunctuationCleanup:
    """Test the _clean_message_for_display method for punctuation handling"""
    
    @pytest.fixture
    def orchestrator(self):
        """Create orchestrator instance for testing"""
        return AgentOrchestrator()
    
    def test_code_block_followed_by_comma(self, orchestrator):
        """Comma after code block should be stripped"""
        message = "Use this approach:\n\n```python\ncode here\n```, which solves the issue"
        cleaned = orchestrator._clean_message_for_display(message)
        
        assert "```, " not in cleaned
        assert "```," not in cleaned
        # The comma should be removed completely
        assert cleaned.endswith("```\nwhich solves the issue")
    
    def test_code_block_followed_by_period(self, orchestrator):
        """Period after code block should be stripped"""
        message = "Here's the solution:\n\n```javascript\nconst x = 5;\n```."
        cleaned = orchestrator._clean_message_for_display(message)
        
        assert "```." not in cleaned
        assert cleaned.endswith("```")
    
    def test_code_block_followed_by_semicolon(self, orchestrator):
        """Semicolon after code block should be stripped"""
        message = "Try this:\n\n```bash\nnpm install\n```; then restart"
        cleaned = orchestrator._clean_message_for_display(message)
        
        assert "```;" not in cleaned
        assert cleaned.endswith("```\nthen restart")
    
    def test_inline_code_punctuation_preserved(self, orchestrator):
        """Inline code punctuation should be preserved"""
        message = "Install `pytest`, then run `npm install`."
        cleaned = orchestrator._clean_message_for_display(message)
        
        # Inline code with commas/periods should remain
        assert "`pytest`," in cleaned
        assert cleaned.endswith("`npm install`.")
    
    def test_multiple_code_blocks_with_punctuation(self, orchestrator):
        """Multiple code blocks should all have punctuation stripped"""
        message = """First approach:
```python
method1()
```, then second:
```python
method2()
```."""
        cleaned = orchestrator._clean_message_for_display(message)
        
        assert "```, " not in cleaned
        assert "```." not in cleaned
    
    def test_code_block_at_end_of_message(self, orchestrator):
        """Code block at the end should work correctly"""
        message = "Final solution:\n\n```python\nreturn True\n```"
        cleaned = orchestrator._clean_message_for_display(message)
        
        assert cleaned.endswith("```")
    
    def test_code_block_with_whitespace_and_punctuation(self, orchestrator):
        """Whitespace between code block and punctuation should be handled"""
        message = "Use this:\n\n```code\ntest\n```  ."
        cleaned = orchestrator._clean_message_for_display(message)
        
        # Should strip both whitespace and punctuation
        assert "```  ." not in cleaned
        assert "``` ." not in cleaned
        assert cleaned.endswith("```")
    
    def test_mixed_inline_and_block_code(self, orchestrator):
        """Both inline and block code should be handled appropriately"""
        message = """Install `package`, then use:
```python
import package
```, which provides functionality."""
        cleaned = orchestrator._clean_message_for_display(message)
        
        # Inline code punctuation preserved
        assert "`package`," in cleaned
        # Block code punctuation stripped
        assert "```, " not in cleaned
    
    def test_agent_cue_removal_with_code_blocks(self, orchestrator):
        """Agent cues should be removed without breaking code block cleanup"""
        message = "[→JUNIOR] Use:\n\n```python\ncode\n```."
        cleaned = orchestrator._clean_message_for_display(message)
        
        # Cue should be converted to mention
        assert "@Junior Dev" in cleaned
        # Punctuation after code block still stripped
        assert "```." not in cleaned
    
    def test_file_operation_tags_with_code_blocks(self, orchestrator):
        """File operation tags should be cleaned properly"""
        message = "[EDIT_FILE:test.py]\n```python\ncode here\n```, as shown above"
        cleaned = orchestrator._clean_message_for_display(message)
        
        # File operation tag should be removed
        assert "[EDIT_FILE:" not in cleaned
        # Comma after code block should be stripped
        assert "```, " not in cleaned
