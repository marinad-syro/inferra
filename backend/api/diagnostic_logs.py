import logging
from pathlib import Path

# Set up a file handler for diagnostic logs
log_file = Path(__file__).parent / "diagnostic.log"
diagnostic_logger = logging.getLogger("diagnostic")
diagnostic_logger.setLevel(logging.INFO)

# Clear existing handlers
diagnostic_logger.handlers = []

# File handler
fh = logging.FileHandler(log_file, mode='w')
fh.setLevel(logging.INFO)
formatter = logging.Formatter('[%(asctime)s] %(message)s', datefmt='%H:%M:%S')
fh.setFormatter(formatter)
diagnostic_logger.addHandler(fh)

# Also add console handler
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
ch.setFormatter(formatter)
diagnostic_logger.addHandler(ch)
