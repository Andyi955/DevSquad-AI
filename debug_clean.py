
import re

def flatten_code_blocks(match):
    content = match.group(1).strip()
    if len(content) < 40 and "\n" not in content and " " not in content:
        return f" `{content}` "
    return match.group(0)

def clean(message):
    message = re.sub(r'```(?:\w+\n)?\s*(.*?)\s*```', flatten_code_blocks, message, flags=re.DOTALL)
    message = re.sub(r' +', ' ', message)
    message = message.strip()
    return message

msg = "Please check my ```test.py``` file."
print(f"'{clean(msg)}'")
