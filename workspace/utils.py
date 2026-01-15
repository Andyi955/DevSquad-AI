import logging
from typing import Dict

class Colors:
    """ANSI escape sequences for terminal text coloring."""
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
    
    FORMATS: Dict[int, str] = {
        logging.DEBUG: Colors.OKCYAN + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.INFO: Colors.OKGREEN + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.WARNING: Colors.WARNING + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.ERROR: Colors.FAIL + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC,
        logging.CRITICAL: Colors.BOLD + Colors.FAIL + "%(asctime)s - %(name)s - %(levelname)s - %(message)s" + Colors.ENDC
    }

    def format(self, record: logging.LogRecord) -> str:
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt='%Y-%m-%d %H:%M:%S')
        return formatter.format(record)

def setup_colored_logging(level: int = logging.INFO) -> None:
    """
    Initialize colored logging globally.
    
    Args:
        level: The logging level to set (e.g., logging.INFO, logging.DEBUG).
    """
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(ColoredFormatter())
    
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(ch)