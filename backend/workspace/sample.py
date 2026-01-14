# Sample Python File
# Upload your own code files to get started!

def hello_world():
    """A simple hello world function"""
    print("Hello from AutoAgents! 🤖")
    return "success"

class Calculator:
    """Basic calculator class for demonstration"""
    
    def add(self, a, b):
        return a + b
    
    def subtract(self, a, b):
        return a - b
    
    def multiply(self, a, b):
        return a * b
    
    def divide(self, a, b):
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b

if __name__ == "__main__":
    hello_world()
    
    calc = Calculator()
    print(f"2 + 3 = {calc.add(2, 3)}")
    print(f"10 / 2 = {calc.divide(10, 2)}")
