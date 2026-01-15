import logging
from typing import List, Union

# ANSI Escape Codes for Terminal Coloring
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class ColoredFormatter(logging.Formatter):
    """Custom logging formatter to add colors based on level."""
    
    FORMATS = {
        logging.DEBUG: Colors.OKCYAN + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.INFO: Colors.OKGREEN + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.WARNING: Colors.WARNING + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.ERROR: Colors.FAIL + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.CRITICAL: Colors.BOLD + Colors.FAIL + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)

# We define the logger at the module level
logger = logging.getLogger(__name__)

def get_welcome_message() -> str:
    """Returns a standard welcome string with some flair."""
    return f"{Colors.BOLD}{Colors.OKBLUE}Hello from AutoAgents! 🚀{Colors.ENDC}"

class Calculator:
    """
    A basic calculator with operation history and logging.
    """
    
    def __init__(self):
        self._history: List[str] = []

    def __repr__(self) -> str:
        return f"{Colors.OKCYAN}Calculator(operations_performed={len(self._history)}){Colors.ENDC}"

    def _log_operation(self, operation: str, result: Union[int, float]):
        """Internal helper to track calculations."""
        entry = f"{operation} = {Colors.BOLD}{result}{Colors.ENDC}"
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
    # Setup colored logging
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(ColoredFormatter())
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(ch)
    
    print(get_welcome_message())
    
    calc = Calculator()
    try:
        calc.add(10, 5)
        calc.subtract(20, 8)
        calc.multiply(3, 7)
        calc.divide(100, 4)
        
        print(f"\n{Colors.UNDERLINE}Current State:{Colors.ENDC} {calc}")
        print(f"{Colors.UNDERLINE}Full History:{Colors.ENDC}")
        for item in calc.get_history():
            print(f"  • {item}")
        
        print(f"\n{Colors.WARNING}Testing error case...{Colors.ENDC}")
        calc.divide(5, 0)
    except ValueError as e:
        logger.error(f"Calculation failed: {e}")