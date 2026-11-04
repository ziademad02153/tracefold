# Sprint 2 — Python test suites

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

## Delivered

Generate a suite of three to five distinct pytest tests for one supported standalone function. Each scenario has a name and explanation tied to the saved code. Review and approve the whole suite before execution. Run all cases, inspect each result, save evidence and rerun the unchanged suite against a repair revision.

No test parameters, decorators or fixtures are generated in this version. Sprint 1 sessions remain readable with their original single test and approval. Earlier runs without structured per-test evidence keep their original output, explicitly labeled as earlier evidence.

## Verified acceptance

[Open the saved five-test session](http://127.0.0.1:5173/#test-session/9835a105ca904937bafce353ffff0cef).

The browser selected service.py / price_after_discount on case-a in the validation repository. Expected behavior included supported input ranges and five explicit examples. Gemma generated five distinct assertion tests. The run action was disabled before approval. The tests were approved and executed through the UI.

| Scenario | Defective revision | Repair revision |
|---|---|---|
| Standard 20% discount | Failed, actual 12000 vs expected 8000 | Passed |
| Zero discount | Passed | Passed |
| Full discount | Failed, actual 20000 vs expected 0 | Passed |
| Zero initial price | Passed | Passed |
| Rounding down | Failed, actual 3666 vs expected 2999 | Passed |

The defective revision had 2 passed and 3 failed. The repair branch case-a-fixed had 5 passed and 0 failed. No cases were blocked, skipped or left without evidence. Both runs used exactly the same suite hash and code. All scenarios, approvals and per-test results survived refresh.

This verifies the software workflow on a small known case. It does not establish broad model quality, coverage or project-wide compatibility.

## Evidence implementation

Pytest writes JUnit XML in its container. A trusted launcher emits the bounded XML before the ephemeral filesystem disappears. The host validates case identities and completeness before producing a run verdict. The UI shows status, duration, scenario and assertion or error detail for each approved test, plus bounded raw output.

A skipped case, setup failure or missing result is shown separately and prevents an all-passed verdict. Suite generation rejects wrong counts, repeated test names, exact duplicate bodies and tests that do not invoke the selected function and assert behavior. It also verifies that scenario names match the saved test functions.

All existing Docker isolation, time, memory and output limits remain in force. Run input source and runner image identities remain recorded.

## Verification

    npm run build
    .venv/Scripts/python.exe -m unittest test_workbench test_ai_review test_docker_runner -v

Twenty-six automated tests cover the workbench, adapter, persistence and actual Docker execution. The real browser acceptance used Gemma, GitHub and Docker, and checked approval gating, mixed results, fixed-version execution, suite identity, refresh and mobile overflow.

## Product direction

The target is a testing workspace for a repository. Function testing is the current supported scope. File testing will require resolving helper functions and project dependencies and reproducing the execution environment. Repository testing will compose those file workflows. PR testing selects changed code within that environment.

Those expansions are future work. This sprint adds only multi-test generation, review, execution and saved evidence for the existing standalone Python function workflow.
