# Sprint 1 — Function testing

## Delivered workflow

Choose a connected public repository, a branch or commit, a Python file and a standalone synchronous function. Describe supported inputs and expected output. Gemma generates one pytest test. The developer reviews the code and explicitly approves its hash. The same saved test can run against another revision of the same file and function.

Supported source is one extracted function and supported standard-library imports. The runner does not execute other module-level code. Helpers, project globals, classes, decorators and external package dependencies require a later workflow. This is function testing, not full-project validation.

## Real acceptance test

Open the saved [discount session](http://127.0.0.1:5173/#test-session/0d5a96da70944587a66991f8c11e4269).

- Selected service.py / price_after_discount from branch case-a in ziademad02153/tracefold-validation.
- Expected 8000 cents for 10000 cents with a 20% discount.
- Gemma generated a direct pytest assertion and it was reviewed and approved in the browser.
- Run 1 on the defective revision failed with actual 12000 versus expected 8000.
- Run 2 on the original correct main revision passed.
- A new branch case-a-fixed was created from the defective branch and committed with the correction. Run 3 on that repair passed.
- All three runs used test hash 3ceb9be0265827abc2efb4e694f59f060c8770938ceb9c890464a5e694f615c0 and the same runner image.
- Refresh retained the generated test, approval, revisions, logs and results.
- Browser verification included the disabled run action before approval and mobile overflow checks.

These were actual Docker executions through the UI, not fixture results.

## Runner setup

Docker must be running. Build the runner once from the project directory:

    docker build -t tracefold-pytest:1 runner

A test container has network disabled, a read-only root and input mount, a non-root user, dropped capabilities, no Docker socket or host environment credentials, a 256 MB memory limit, one CPU, 64 PIDs, a 25-second execution limit and bounded output. Cleanup removes the container after completion. The selected image ID is saved with the session.

A shared service accepting untrusted projects needs further deployment and access-control review. The local runner boundary does not make this an enterprise release.

## Verification

    npm run build
    .venv/Scripts/python.exe -m unittest test_workbench test_ai_review test_docker_runner -v

Nineteen tests passed in the implementation environment. Docker tests cover successful assertions, failed assertions, blocked collection, output limits, network isolation, read-only inputs and the non-root user. Workbench tests cover approval, hash checks, supported function extraction and saved evidence with an unchanged test.

## State meaning

- PASSED: pytest completed with assertions satisfied.
- FAILED: pytest reported a failed test. The developer must verify whether the test or product assumption is wrong.
- BLOCKED: collection, environment, output or execution limits prevented a completed test result.
