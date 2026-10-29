"""Compatibility entry point for the current booking/ticket/PWA browser checks."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('verify-ticketing.py')),run_name='__main__')
