import io
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import URLError

from ai_review import diff_lines, review_diff

DIFF = "--- a/retry.py\n+++ b/retry.py\n@@ -1,2 +1,2 @@\n def retry_limit(requested):\n-    return requested\n+    return max(requested, 3)"
FINDING = {"file":"retry.py","line":2,"title":"Retry cap changed",
           "explanation":"Returns 5 for requested=5.","suggestion":"Use min."}


class ReviewTests(unittest.TestCase):
    def run_model(self, content, reason="stop"):
        response = io.BytesIO(json.dumps({
            "done":True,"done_reason":reason,"message":{"content":json.dumps(content)}
        }).encode())
        opener = Mock()
        opener.open.return_value = response
        with patch("ai_review.build_opener", return_value=opener):
            return review_diff(DIFF)

    def test_locations_exclude_deleted_lines(self):
        self.assertEqual(diff_lines(DIFF), {("retry.py",1),("retry.py",2)})

    def test_valid_finding_and_empty_review(self):
        self.assertEqual(self.run_model({"findings":[FINDING]})["findings"], [FINDING])
        self.assertEqual(self.run_model({"findings":[]})["findings"], [])

    def test_hallucinated_line_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"outside"):
            self.run_model({"findings":[{**FINDING,"line":999}]})

    def test_malformed_and_truncated_responses_are_rejected(self):
        with self.assertRaises(ValueError):
            self.run_model({"findings":"looks good"})
        with self.assertRaises(ValueError):
            self.run_model({"findings":[]}, reason="length")

    def test_network_failure_is_actionable(self):
        opener = Mock()
        opener.open.side_effect = URLError("offline")
        with patch("ai_review.build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError,"company network"):
                review_diff(DIFF)

    def test_large_diff_rejected_before_model_call(self):
        with patch("ai_review.build_opener") as request:
            with self.assertRaises(ValueError):
                review_diff("x"*28001)
            request.assert_not_called()


class SavedReviewTests(unittest.TestCase):
    def setUp(self):
        from sqlalchemy import create_engine
        import app
        self.app = app
        self.engine = create_engine("sqlite://")
        app.metadata.create_all(self.engine)
        self.engine_patch = patch.object(app, "engine", self.engine)
        self.engine_patch.start()
        with self.engine.begin() as connection:
            connection.execute(app.reports.insert().values(
                id="test-report", repo="test/repo", snapshot={
                    "number":1, "title":"Change", "diff":DIFF, "base":"base", "head":"head", "checks":[],
                }
            ))

    def tearDown(self):
        self.engine_patch.stop()
        self.engine.dispose()

    def test_result_is_durable_and_failed_retry_retains_result(self):
        result = {"model":"gemma4:e4b","findings":[FINDING]}
        with patch.object(self.app, "review_diff", return_value=result):
            self.app.review_report("test-report")
        self.assertEqual(self.app.get_report("test-report")["ai_review"]["result"], result)
        with patch.object(self.app, "review_diff", side_effect=ValueError("offline")):
            self.app.review_report("test-report")
        saved = self.app.get_report("test-report")["ai_review"]
        self.assertEqual(saved["status"], "failed")
        self.assertEqual(saved["result"], result)

    def test_completed_result_stays_visible_during_retry(self):
        result = {"model":"gemma4:e4b","findings":[FINDING]}
        with patch.object(self.app, "review_diff", return_value=result):
            self.app.review_report("test-report")
        def inspect_running(diff):
            running = self.app.get_report("test-report")["ai_review"]
            self.assertEqual(running["status"], "running")
            self.assertEqual(running["result"], result)
            return result
        with patch.object(self.app, "review_diff", side_effect=inspect_running):
            self.app.review_report("test-report")

    def test_public_snapshot_uses_immutable_merge_base(self):
        from unittest.mock import call
        with self.engine.begin() as connection:
            connection.execute(self.app.projects.insert().values(repo="public/repo"))
        responses = [
            {"number":1, "title":"PR", "base":{"sha":"base-tip"}, "head":{"sha":"head-sha"}},
            {"merge_base_commit":{"sha":"merge-base"}},
            DIFF,
        ]
        with patch.object(self.app, "github", side_effect=responses) as github:
            report = self.app.create_report(self.app.CreateReport(repo="public/repo",number=1))
        self.assertEqual(report["base"], "merge-base")
        self.assertEqual(report["head"], "head-sha")
        self.assertEqual(github.call_args_list[-1], call(
            "public/repo/compare/merge-base...head-sha", "application/vnd.github.diff"
        ))

    def test_second_submission_is_rejected_while_running(self):
        from fastapi import HTTPException
        from time import time
        with self.engine.begin() as connection:
            connection.execute(self.app.reviews.insert().values(
                report_id="test-report", token="claimed",
                state={"status":"running", "started":time()},
            ))
        with patch.object(self.app, "review_diff") as model:
            with self.assertRaises(HTTPException) as error:
                self.app.review_report("test-report")
            self.assertEqual(error.exception.status_code, 409)
            model.assert_not_called()

    def test_preexisting_report_without_ai_still_loads(self):
        self.assertIsNone(self.app.get_report("test-report")["ai_review"])


if __name__ == "__main__":
    unittest.main()
