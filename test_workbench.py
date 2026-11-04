import unittest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy import create_engine

from workbench import create_router, digest, extract_function, validate_test, file_context

SOURCE = 'def discount(price, percent):\n    return price * (100 - percent) // 100\n'
TEST = 'from target import discount\n\ndef test_discount():\n    assert discount(100, 20) == 80\n'


class WorkbenchTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        def github(path):
            if "/commits/" in path:
                return {"sha":"a"*40 if path.endswith("/bad") else "b"*40}
            if "/contents/" in path:
                import base64
                return {"type":"file","encoding":"base64","size":len(SOURCE),
                        "content":base64.b64encode(SOURCE.encode()).decode()}
            raise AssertionError(path)
        self.router = create_router(self.engine, github, lambda repo: None)

    def tearDown(self):
        self.engine.dispose()

    def endpoint(self, suffix, method):
        return next(route.endpoint for route in self.router.routes
                    if route.path == "/api/testing" + suffix and method in route.methods)

    def session(self, suite=False):
        from workbench import GenerateRequest
        plan = {"scenario":"Discount reduces price","test_code":TEST}
        if suite:
            plan["test_code"] = "from target import discount\n" + "\n".join(
                f"def test_case_{i}():\n    assert discount(100, {i}) == {100-i}\n" for i in range(3))
            plan["tests"] = [{"name":f"test_case_{i}","scenario":f"Discount of {i} percent"} for i in range(3)]
        with patch("workbench.generate_test", return_value=plan), patch("workbench.runner_status",return_value={"image_id":"sha256:test"}):
            return self.endpoint("/sessions","POST")(GenerateRequest(
                repo="owner/repo",ref="bad",path="service.py",function="discount",
                expected="100 with 20 percent discount returns 80", mode="function",
            ))

    def test_function_extraction_rejects_helpers_and_decorators(self):
        self.assertEqual(extract_function(SOURCE, "discount"), SOURCE)
        for code in ['def f(x):\n return helper(x)', '@decorator\ndef f(x):\n return x']:
            with self.assertRaises(HTTPException):
                extract_function(code, "f")

    def test_generated_test_requires_selected_import_and_assertion(self):
        self.assertEqual(validate_test(TEST, "discount"), TEST)
        for code in ['def test_fake(): pass', 'from target import other\ndef test_x(): assert True']:
            with self.assertRaises(HTTPException):
                validate_test(code, "discount")

    def test_suite_count_names_duplicates_and_assertions(self):
        suite = "from target import discount\n" + "\n".join(
            f"def test_case_{i}():\n    assert discount(100, {i}) == {100-i}\n" for i in range(3))
        self.assertEqual(validate_test(suite, "discount", 3, 5), suite)
        for bad in [
            TEST,
            suite + "\n" + "\n".join(f"def test_more_{i}():\n assert discount(1, {i}) == 1" for i in range(3)),
            suite.replace("test_case_2","test_case_1"),
            suite.replace("discount(100, 2) == 98", "discount(100, 1) == 99"),
            suite.replace("assert discount(100, 2) == 98","assert True"),
            suite.replace("def test_case_1():","def test_case_1(*args):"),
        ]:
            with self.assertRaises(HTTPException):
                validate_test(bad, "discount", 3, 5)

    def test_legacy_session_exposes_original_single_test(self):
        session = self.session()
        self.assertEqual(session["tests"],[{"name":"test_discount","scenario":"Discount reduces price"}])
        self.assertEqual(session["test_code"],TEST)

    def test_approval_is_required_and_hash_is_verified(self):
        from workbench import Approval, RunRequest
        session = self.session()
        with self.assertRaises(HTTPException):
            self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref="bad",test_hash=session["test_hash"]))
        with self.assertRaises(HTTPException):
            self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash="wrong"))
        approved=self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        self.assertIsNotNone(approved["approved_at"])

    def test_two_versions_keep_the_same_saved_test_and_evidence(self):
        from workbench import Approval, RunRequest
        session=self.session(suite=True)
        self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        with patch("workbench.execute_test",side_effect=[
            {"status":"failed","log":"assert 120 == 80","exit_code":1},
            {"status":"passed","log":"1 passed","exit_code":0},
        ]) as runner:
            for ref in ("bad","fixed"):
                result=self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref=ref,test_hash=session["test_hash"]))
        self.assertEqual([r["status"] for r in result["runs"]],["failed","passed"])
        self.assertEqual(result["test_code"],session["test_code"])
        self.assertEqual(len(result["tests"]),3)
        self.assertEqual(result["test_hash"],digest(session["test_code"]))
        self.assertNotEqual(result["runs"][0]["sha"],result["runs"][1]["sha"])
        for call in runner.call_args_list:
            self.assertEqual(call.args[1],session["test_code"])
            self.assertEqual(call.args[2],"sha256:test")
        loaded=self.endpoint("/sessions/{session_id}","GET")(session["id"])
        self.assertEqual(loaded["runs"],result["runs"])

    def test_project_overview_uses_saved_activity_only(self):
        from workbench import Approval, RunRequest
        session=self.session(suite=True)
        self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        with patch("workbench.execute_test",side_effect=[
            {"status":"failed","log":"failed","exit_code":1},
            {"status":"passed","log":"passed","exit_code":0},
        ]):
            for ref in ("bad","fixed"):
                self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref=ref,test_hash=session["test_hash"]))
        overview=self.endpoint("/overview","GET")(repo="owner/repo")[0]
        self.assertEqual(overview["suite_count"],1)
        self.assertEqual(overview["test_count"],3)
        self.assertEqual(overview["run_count"],2)
        self.assertEqual(overview["latest_run"]["status"],"passed")
        self.assertIsNone(overview["latest_run"]["summary"])
        self.assertEqual(overview["runs"][0]["status"],"passed")
        self.assertEqual(self.endpoint("/overview","GET")(repo="other/repo")[0]["run_count"],0)

    def test_runner_failure_is_persisted_as_blocked(self):
        from workbench import Approval, RunRequest
        session=self.session()
        self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        with patch("workbench.execute_test",side_effect=RuntimeError("offline")):
            result=self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref="bad",test_hash=session["test_hash"]))
        self.assertEqual(result["state"],"ready")
        self.assertEqual(result["runs"][0]["status"],"blocked")

    def test_file_context_preserves_helpers_constants_and_rejects_dependencies(self):
        source = 'LIMIT = 3\ndef _cap(x): return min(x, LIMIT)\ndef retry(x): return _cap(x)\ndef zero(): return 0\n'
        context = file_context(source, "logic/retries.py", ["retry", "zero"])
        self.assertEqual(context["source"], source)
        self.assertEqual(context["module_name"], "logic.retries")
        self.assertEqual(context["functions"], ["retry", "zero"])
        for source, path in [
            ('from .helpers import cap\ndef f(): return cap()', 'service.py'),
            ('import requests\ndef f(): return 1', 'service.py'),
            ('def f():\n import os\n return 1', 'service.py'),
            ('def f(): return 1', '../escape.py'),
            ('def f(): return 1', 'test_generated.py'),
            ('def f(): return 1', 'package/__init__.py'),
        ]:
            with self.subTest(path=path, source=source), self.assertRaises(HTTPException):
                file_context(source, path)

    def test_package_initializer_context_is_not_silently_omitted(self):
        import base64
        def github(path):
            if '/commits/' in path:
                return {'sha':'a'*40}
            if '/contents/' in path:
                return {'type':'file','encoding':'base64','size':len(SOURCE),'content':base64.b64encode(SOURCE.encode()).decode()}
            if '/git/trees/' in path:
                return {'tree':[{'path':'package/__init__.py'}, {'path':'package/service.py'}]}
            raise AssertionError(path)
        router = create_router(self.engine, github, lambda repo:None)
        endpoint = next(route.endpoint for route in router.routes if route.path=='/api/testing/functions')
        with self.assertRaises(HTTPException) as failure:
            endpoint(repo='owner/repo', ref='main', path='package/service.py')
        self.assertEqual(failure.exception.status_code,422)
        self.assertIn('package initializer',failure.exception.detail)

    def test_file_suite_must_import_original_module_and_cover_each_selection(self):
        suite = 'from service import first, second\ndef test_first(): assert first(1) == 1\ndef test_second(): assert second(2) == 2\ndef test_boundary(): assert first(0) == 0\n'
        self.assertEqual(validate_test(suite, ['first', 'second'], 3, 5, 'service'), suite)
        for bad in [suite.replace('from service', 'from target'), suite.replace('second(2)', 'first(2)')]:
            with self.assertRaises(HTTPException):
                validate_test(bad, ['first', 'second'], 3, 5, 'service')

    def test_model_repair_is_bounded_and_cannot_bypass_suite_validation(self):
        import io
        import json
        from workbench import generate_test
        valid_code = 'from service import first, second\ndef test_first(): assert first(1) == 1\ndef test_second(): assert second(2) == 2\ndef test_zero(): assert first(0) == 0\n'
        valid = {'scenario':'Preserve values', 'test_code':valid_code,
                 'tests':[{'name':name,'scenario':name} for name in ['test_first','test_second','test_zero']]}
        invalid = {**valid, 'test_code':valid_code.replace('test_zero', 'test_first')}
        def response(plan):
            return io.BytesIO(json.dumps({'done':True,'message':{'content':json.dumps(plan)}}).encode())
        with patch('workbench.build_opener') as opener:
            opener.return_value.open.side_effect = [response(invalid), response(valid)]
            plan = generate_test('def first(x): return x\ndef second(x): return x', ['first','second'], 'Return input integers unchanged', 'service')
            self.assertEqual(plan['generation_attempts'], 2)
            self.assertEqual(plan['test_code'], valid_code)
            self.assertEqual(opener.return_value.open.call_count, 2)
        with patch('workbench.build_opener') as opener:
            opener.return_value.open.side_effect = [response(invalid), response(invalid)]
            with self.assertRaises(HTTPException):
                generate_test('def first(x): return x', ['first','second'], 'Return input integers unchanged', 'service')
            self.assertEqual(opener.return_value.open.call_count, 2)

    def test_file_session_persists_full_module_and_reruns_original_path(self):
        from workbench import GenerateRequest, Approval, RunRequest
        source = 'FACTOR = 1\ndef _apply(x): return x * FACTOR\ndef first(x): return _apply(x)\ndef second(x): return _apply(x)\n'
        suite = 'from service import first, second\ndef test_first(): assert first(1) == 1\ndef test_second(): assert second(2) == 2\ndef test_zero(): assert first(0) == 0\n'
        plan = {'scenario': 'Both public functions preserve values', 'test_code': suite,
                'tests': [{'name': n, 'scenario': n} for n in ['test_first','test_second','test_zero']]}
        with patch('workbench.generate_test', return_value=plan), patch('workbench.runner_status', return_value={'image_id':'sha256:test'}), patch.dict(globals(), {'SOURCE':source}):
            session = self.endpoint('/sessions', 'POST')(GenerateRequest(repo='owner/repo', ref='bad', path='service.py', function='first', functions=['first','second'], expected='Both functions return their input integer.'))
            self.endpoint('/sessions/{session_id}/approve', 'POST')(session['id'], Approval(test_hash=session['test_hash']))
            with patch('workbench.execute_test', side_effect=[{'status':'failed','log':'failure','exit_code':1}, {'status':'passed','log':'passed','exit_code':0}]) as runner:
                for ref in ['bad','fixed']:
                    result = self.endpoint('/sessions/{session_id}/run', 'POST')(session['id'], RunRequest(ref=ref, test_hash=session['test_hash']))
        self.assertEqual(session['source'], source)
        self.assertEqual(session['mode'], 'file')
        self.assertEqual(session['module_name'], 'service')
        self.assertEqual(session['functions'], ['first','second'])
        for call in runner.call_args_list:
            self.assertEqual(call.args[0], source)
            self.assertEqual(call.args[1], suite)
            self.assertEqual(call.kwargs['source_path'], 'service.py')
        loaded = self.endpoint('/sessions/{session_id}', 'GET')(session['id'])
        self.assertEqual(loaded['test_code'], suite)
        self.assertEqual(loaded['runs'], result['runs'])
        self.assertEqual([run['status'] for run in loaded['runs']], ['failed','passed'])
        self.assertTrue(all(run['runner_image']=='sha256:test' for run in loaded['runs']))


if __name__ == "__main__":
    unittest.main()
