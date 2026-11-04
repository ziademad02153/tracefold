import unittest
from test_runner import execute_test, runner_status


@unittest.skipUnless(runner_status()["ready"], "Build and start the Docker pytest runner first.")
class DockerRunnerTests(unittest.TestCase):
    def test_pass_failure_and_collection_error_have_distinct_states(self):
        source = "def add(a, b): return a+b"
        for test, expected in [
            ("from target import add\ndef test_add(): assert add(1,2)==3", "passed"),
            ("from target import add\ndef test_add(): assert add(1,2)==4", "failed"),
            ("from missing_dependency import f\ndef test_add(): assert f()", "blocked"),
        ]:
            with self.subTest(expected=expected):
                self.assertEqual(execute_test(source,test)["status"],expected)

    def test_runner_has_no_network_and_readonly_input_and_nonroot_user(self):
        code = """import os
import socket
import pytest
from target import f

def test_isolation():
    assert f() == 1
    assert os.geteuid() != 0
    with pytest.raises(OSError):
        open('/workspace/escape.txt', 'w')
    sock = socket.socket()
    sock.settimeout(1)
    assert sock.connect_ex(('1.1.1.1', 443)) != 0
    sock.close()
    assert 'DATABASE_URL' not in os.environ
"""
        result=execute_test("def f(): return 1",code)
        self.assertEqual(result["status"],"passed",result["log"])

    def test_excessive_output_is_bounded_and_blocked(self):
        result=execute_test("def f(): return 1",
            "from target import f\ndef test_output():\n print('x'*100000)\n assert f()==2")
        self.assertEqual(result["status"],"blocked")
        self.assertLess(len(result["log"]),66000)


if __name__ == "__main__":
    unittest.main()
