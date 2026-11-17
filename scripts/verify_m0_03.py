"""Shared contract regression gate, preserving historical M0-02 QA output."""
import sys
from verify_m0_02 import main
if __name__=='__main__':sys.exit(main('qa/m0-03/contracts.json'))
