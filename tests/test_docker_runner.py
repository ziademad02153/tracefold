import unittest
from test_runner import execute_test, runner_status, parse_results, summarize


@unittest.skipUnless(runner_status()["ready"], "Build and start the Docker pytest runner first.")
class DockerRunnerTests(unittest.TestCase):
    def test_original_module_helpers_constants_and_identity_survive_repair(self):
        source = '''LIMIT = 3
def _cap(requested):
    return max(requested, LIMIT)
def retry(requested):
    return _cap(requested)
def remaining(requested):
    return LIMIT - retry(requested)
'''
        suite = '''from policy.retries import retry, remaining
def test_cap():
    assert retry(5) == 3
def test_small():
    assert retry(2) == 2
def test_remaining():
    assert remaining(2) == 1
def test_module_identity():
    assert retry.__module__ == "policy.retries"
'''
        bad = execute_test(source, suite, source_path='policy/retries.py')
        fixed = execute_test(source.replace('max(requested, LIMIT)', 'min(requested, LIMIT)'), suite, source_path='policy/retries.py')
        self.assertEqual(bad['status'], 'failed', bad['log'])
        self.assertEqual(bad['summary']['failed'], 3)
        self.assertEqual(bad['summary']['passed'], 1)
        self.assertEqual(fixed['status'], 'passed', fixed['log'])
        self.assertEqual(fixed['summary']['passed'], 4)

    def test_pass_failure_and_collection_error_have_distinct_states(self):
        source = "def add(a, b): return a+b"
        for test, expected in [
            ("from target import add\ndef test_add(): assert add(1,2)==3", "passed"),
            ("from target import add\ndef test_add(): assert add(1,2)==4", "failed"),
            ("from missing_dependency import f\ndef test_add(): assert f()", "blocked"),
        ]:
            with self.subTest(expected=expected):
                self.assertEqual(execute_test(source,test)["status"],expected)

    def test_mixed_suite_reports_each_test_and_reruns_unchanged(self):
        suite = """from target import f
def test_zero():
    assert f(0) == 0
def test_one():
    assert f(1) == 1
def test_two():
    assert f(2) == 2
"""
        bad = execute_test("def f(x): return x*2",suite)
        fixed = execute_test("def f(x): return x",suite)
        self.assertEqual(bad["status"],"failed",bad["log"])
        self.assertEqual(bad["summary"]["passed"],1)
        self.assertEqual(bad["summary"]["failed"],2)
        self.assertEqual([test["name"] for test in bad["tests"]],["test_zero","test_one","test_two"])
        self.assertEqual(fixed["status"],"passed",fixed["log"])
        self.assertEqual(fixed["summary"]["passed"],3)
        self.assertEqual(fixed["summary"]["failed"],0)

    def test_skips_are_not_reported_as_success(self):
        result = execute_test("def f(): return 1", "import pytest\nfrom target import f\ndef test_skip():\n pytest.skip('No assertion executed')")
        self.assertEqual(result["status"],"blocked",result["log"])
        self.assertEqual(result["tests"][0]["status"],"skipped")

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


class EvidenceParsingTests(unittest.TestCase):
    def test_source_paths_cannot_escape_or_replace_generated_tests(self):
        for path in ['../escape.py', '/tmp/escape.py', 'C:\\escape.py', 'test_generated.py', 'a/../../b.py']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                execute_test('def f(): return 1', 'def test_f(): assert True', source_path=path)
    def test_missing_results_remain_not_run(self):
        result=parse_results(b'<testsuites><testsuite><testcase name="test_a" time="0.1"/></testsuite></testsuites>',["test_a","test_b"])
        self.assertEqual(summarize(result),{"total":2,"passed":1,"failed":0,"blocked":0,"skipped":0,"not_run":1})

    def test_duplicate_and_unknown_results_are_rejected(self):
        for xml in [
            b'<testsuites><testcase name="wrong"/></testsuites>',
            b'<testsuites><testcase name="test_a"/><testcase name="test_a"/></testsuites>',
        ]:
            with self.assertRaises(ValueError):
                parse_results(xml,["test_a"])

    def test_setup_error_is_blocked(self):
        tests=parse_results(b'<testsuites><testcase name="test_a"><error message="fixture failed">error detail</error></testcase></testsuites>',["test_a"])
        self.assertEqual(tests[0]["status"],"blocked")
        self.assertEqual(tests[0]["detail"],"error detail")


if __name__ == "__main__":
    unittest.main()
