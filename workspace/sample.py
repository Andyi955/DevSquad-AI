import logging
from typing import List, Union

# We define the logger at the module level, but configure it in the main block
logger = logging.getLogger(__name__)

def get_welcome_message() -> str:
    """Returns a standard welcome string."""
    return "Hello from AutoAgents!"

class Calculator:
    """
    A basic calculator with operation history and logging.
    """
    
    def __init__(self):
        self._history: List[str] = []

    def __repr__(self) -> str:
        return f"Calculator(operations_performed={len(self._history)})"

    def _log_operation(self, operation: str, result: Union[int, float]):
        """Internal helper to track calculations."""
        entry = f"{operation} = {result}"
        self._history.append(entry)
        logger.info(f"Performed calculation: {entry}")

    def get_history(self) -> List[str]:
        """Returns a copy of the calculation history."""
        return self._history.copy()

    def add(self, a: float, b: float) -> float:
        result = a + b
        self._log_operation(f"{a} + {b}", result)
        return result

    def subtract(self, a: float, b: float) -> float:
        result = a - b
        self._log_operation(f"{a} - {b}", result)
        return result

    def multiply(self, a: float, b: float) -> float:
        result = a * b
        self._log_operation(f"{a} * {b}", result)
        return result
    
    def divide(self, a: float, b: float) -> float:
        if b == 0:
            raise ValueError(f"Division by zero error: cannot divide {a} by {b}")
        result = a / b
        self._log_operation(f"{a} / {b}", result)
        return result

if __name__ == "__main__":
    # Configure logging only when the script is run directly
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print(get_welcome_message())
    
    calc = Calculator()
    try:
        calc.add(10, 5)
        calc.subtract(20, 8)
        calc.multiply(3, 7)
        calc.divide(100, 4)
        
        print(f"Current State: {calc}")
        print(f"Full History: {calc.get_history()}")
        
        # Test error case
        calc.divide(5, 0)
    except ValueError as e:
        logger.error(f"Calculation failed: {e}")