import logging
from typing import List, Union, Optional
from collections import deque
from logger_config import setup_logger, Colors

# Module-level Constants
MAX_HISTORY_SIZE = 100

def get_welcome_message() -> str:
    """Returns a standard welcome string with some flair."""
    return f"{Colors.BOLD}{Colors.OKBLUE}Hello from AutoAgents! 🚀{Colors.ENDC}"

class Calculator:
    """
    A basic calculator with operation history and logging.
    
    Args:
        logger: An optional logging.Logger instance.
        max_history: Maximum number of operations to store.
    """
    
    def __init__(self, logger: Optional[logging.Logger] = None, max_history: int = MAX_HISTORY_SIZE):
        self._history = deque(maxlen=max_history)
        self.logger = logger or setup_logger("Calculator")

    def __repr__(self) -> str:
        return f"{Colors.OKCYAN}Calculator(operations_performed={len(self._history)}){Colors.ENDC}"

    def _log_operation(self, operation: str, result: Union[int, float]):
        """Internal helper to track calculations."""
        entry = f"{operation} = {Colors.BOLD}{result}{Colors.ENDC}"
        self._history.append(entry)
        self.logger.info(f"Performed calculation: {entry}")

    def get_history(self) -> List[str]:
        """Returns a list of the calculation history."""
        return list(self._history)

    def add(self, a: float, b: float) -> float:
        """Returns the sum of a and b."""
        result = a + b
        self._log_operation(f"{a} + {b}", result)
        return result

    def subtract(self, a: float, b: float) -> float:
        """Returns the difference of a and b (a - b)."""
        result = a - b
        self._log_operation(f"{a} - {b}", result)
        return result

    def multiply(self, a: float, b: float) -> float:
        """Returns the product of a and b."""
        result = a * b
        self._log_operation(f"{a} * {b}", result)
        return result
    
    def divide(self, a: float, b: float) -> float:
        """Returns the quotient of a divided by b."""
        if b == 0:
            raise ValueError(f"Division by zero error: cannot divide {a} by {b}")
        result = a / b
        self._log_operation(f"{a} / {b}", result)
        return result

    def power(self, a: float, b: float) -> float:
        """
        Returns a raised to the power of b (a^b).
        
        Raises:
            ValueError: If the result is complex or exceeds float capacity (Overflow).
        """
        try:
            result = a ** b
            if isinstance(result, complex):
                raise ValueError(f"Complex result error: {a} ^ {b} results in a complex number.")
            
            self._log_operation(f"{a} ^ {b}", result)
            return float(result)
        except OverflowError:
            raise ValueError(f"Overflow error: The result of {a} ^ {b} is too large to represent.")

    def modulus(self, a: float, b: float) -> float:
        """
        Returns the remainder of a divided by b (a % b).
        
        Raises:
            ValueError: If b is zero (modulus by zero is undefined).
        """
        if b == 0:
            raise ValueError(f"Modulus by zero error: cannot compute {a} % {b}")
        result = a % b
        self._log_operation(f"{a} % {b}", result)
        return result

if __name__ == "__main__":
    main_logger = setup_logger("Main")
    print(get_welcome_message())
    
    calc = Calculator(logger=main_logger)
    try:
        calc.add(10, 5)
        calc.multiply(3, 7)
        calc.power(2, 3)
        calc.modulus(10, 3)
        
        print(f"\n{Colors.UNDERLINE}Current State:{Colors.ENDC} {calc}")
        print(f"{Colors.UNDERLINE}Full History:{Colors.ENDC}")
        for item in calc.get_history():
            print(f"  • {item}")
            
    except ValueError as e:
        main_logger.error(f"Calculation failed: {e}")