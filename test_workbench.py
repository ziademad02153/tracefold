import unittest
from unittest.mock import patch
from fastapi import HTTPException
from sqlalchemy import create_engine

from workbench import create_router, digest, extract_function, validate_test

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

    def session(self):
        from workbench import GenerateRequest
        with patch("workbench.generate_test", return_value={"scenario":"Discount reduces price","test_code":TEST}), patch("workbench.runner_status",return_value={"image_id":"sha256:test"}):
            return self.endpoint("/sessions","POST")(GenerateRequest(
                repo="owner/repo",ref="bad",path="service.py",function="discount",
                expected="100 with 20 percent discount returns 80",
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
        session=self.session()
        self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        with patch("workbench.execute_test",side_effect=[
            {"status":"failed","log":"assert 120 == 80","exit_code":1},
            {"status":"passed","log":"1 passed","exit_code":0},
        ]) as runner:
            for ref in ("bad","fixed"):
                result=self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref=ref,test_hash=session["test_hash"]))
        self.assertEqual([r["status"] for r in result["runs"]],["failed","passed"])
        self.assertEqual(result["test_code"],TEST)
        self.assertEqual(result["test_hash"],digest(TEST))
        self.assertNotEqual(result["runs"][0]["sha"],result["runs"][1]["sha"])
        for call in runner.call_args_list:
            self.assertEqual(call.args[1],TEST)
            self.assertEqual(call.args[2],"sha256:test")
        loaded=self.endpoint("/sessions/{session_id}","GET")(session["id"])
        self.assertEqual(loaded["runs"],result["runs"])

    def test_runner_failure_is_persisted_as_blocked(self):
        from workbench import Approval, RunRequest
        session=self.session()
        self.endpoint("/sessions/{session_id}/approve","POST")(session["id"],Approval(test_hash=session["test_hash"]))
        with patch("workbench.execute_test",side_effect=RuntimeError("offline")):
            result=self.endpoint("/sessions/{session_id}/run","POST")(session["id"],RunRequest(ref="bad",test_hash=session["test_hash"]))
        self.assertEqual(result["state"],"ready")
        self.assertEqual(result["runs"][0]["status"],"blocked")


if __name__ == "__main__":
    unittest.main()
