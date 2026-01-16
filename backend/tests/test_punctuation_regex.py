"""
Standalone test for punctuation cleanup regex
Tests the regex pattern without requiring full dependency imports
"""

import re


def clean_message_for_display(message: str) -> str:
    """
    Simplified version of orchestrator's _clean_message_for_display
    focusing on code block punctuation cleanup
    """
    # Strip punctuation immediately after triple-backtick code blocks
    message = re.sub(r'```\s*([.,;!?:])', r'```', message)
    return message


def test_code_block_followed_by_comma():
    """Comma after code block should be stripped"""
    message = "Use this approach:\n\n```python\ncode here\n```, which solves the issue"
    cleaned = clean_message_for_display(message)
    
    assert "```, " not in cleaned
    assert "```," not in cleaned
    print("✓ Code block + comma test passed")


def test_code_block_followed_by_period():
    """Period after code block should be stripped"""
    message = "Here's the solution:\n\n```javascript\nconst x = 5;\n```."
    cleaned = clean_message_for_display(message)
    
    assert "```." not in cleaned
    assert cleaned.endswith("```")
    print("✓ Code block + period test passed")


def test_code_block_followed_by_semicolon():
    """Semicolon after code block should be stripped"""
    message = "Try this:\n\n```bash\nnpm install\n```; then restart"
    cleaned = clean_message_for_display(message)
    
    assert "```;" not in cleaned
    print("✓ Code block + semicolon test passed")


def test_code_block_with_whitespace_and_punctuation():
    """Whitespace between code block and punctuation should be handled"""
    message = "Use this:\n\n```code\ntest\n```  ."
    cleaned = clean_message_for_display(message)
    
    assert "```  ." not in cleaned
    assert "``` ." not in cleaned
    assert cleaned.endswith("```")
    print("✓ Code block + whitespace + punctuation test passed")


def test_multiple_code_blocks():
    """Multiple code blocks should all have punctuation stripped"""
    message = """First:
```python
m1()
```, then:
```python
m2()
```."""
    cleaned = clean_message_for_display(message)
    
    assert "```, " not in cleaned
    assert "```." not in cleaned
    print("✓ Multiple code blocks test passed")


if __name__ == "__main__":
    print("Running punctuation cleanup regex tests...\n")
    
    try:
        test_code_block_followed_by_comma()
        test_code_block_followed_by_period()
        test_code_block_followed_by_semicolon()
        test_code_block_with_whitespace_and_punctuation()
        test_multiple_code_blocks()
        
        print("\n✅ All tests passed!")
        print("\nThe regex pattern successfully strips trailing punctuation after code blocks.")
        print("This prevents orphaned punctuation in the React frontend UI.")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
