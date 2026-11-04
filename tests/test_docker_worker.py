"""Exercise real child-process output ownership without requiring Docker."""
import sys
import unittest
from unittest.mock import patch

from execution_core.contracts import ProviderError
from providers.docker_worker import command


class WorkerTransportTests(unittest.TestCase):
    def test_timeout_does_not_close_a_pipe_under_the_reader(self):
        with patch('threading.excepthook') as background_error:
            for _ in range(3):
                with self.assertRaisesRegex(ProviderError,'limit'):
                    command([sys.executable,'-u','-c','import time; print("ready", flush=True); time.sleep(10)'],seconds=0.15)
            background_error.assert_not_called()

    def test_complete_output_and_nonzero_exit_are_preserved(self):
        code,output=command([sys.executable,'-u','-c','import sys; print("native failure"); sys.exit(7)'],seconds=5)
        self.assertEqual(code,7)
        self.assertIn('native failure',output)
