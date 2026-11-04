# Sprint 3 — Python File Testing

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

Status: M1 acceptance passed on the bounded synthetic fixture, 4 November 2026. Scope is M1 in [the Python repository roadmap](../roadmap/repository-testing.md). [Language Expansion Roadmap](../roadmap/language-expansion.md) defines the later C#, Java, C/C++ and Embedded direction; no additional language runner is implemented here. This is not a claim of company-project or full-repository readiness.

## Delivered behavior

New sessions preserve the original source file rather than extract a function into target.py. Helpers, constants, definitions and module initialization remain intact. The selected repository-relative module path is materialized in the isolated container; tests import its original dotted name. Modules in namespace directories are supported. Modules requiring package initializer files are explicitly blocked until M2 instead of silently dropping initializer behavior.

The user inspects a Python file, selects one to five public top-level synchronous functions without decorators, describes expected behavior for the selection, and requests 3–5 tests. Every selected function must appear in the generated suite's calls and imports. This is bounded file-context testing, not a statement that all code paths in the file have been tested.

Review scenarios and assertions, approve the suite hash, run all tests, inspect each result, then select the repair revision and rerun the exact approved suite. Save full module content and content hash per run, revision, original path, suite hash and runner image identity. Earlier standalone sessions retain their original source extraction and test identities; their UI labels the legacy execution mode.

## Boundaries

- Source file: up to 30 KB, UTF-8, importable module path. Model context remains bounded; large/complex inputs may fail generation rather than establish support.
- Supported imports: math, decimal, fractions, statistics, datetime, re, itertools, functools, typing and collections. Inspect nested import statements too. This allowlist defines support, not a security sandbox.
- Cross-file imports, external dependencies, package initializers and selected async/decorated/class methods need later milestones. Unsupported imports produce a preparation error before generation/execution.
- Container remains Python 3.11 with pinned pytest; syntax/runtime incompatibility is an execution/setup problem. Host API inspection only parses source and never imports repository code.
- Runtime isolation and limits remain unchanged: read-only source/root, no network, non-root user, dropped capabilities, no application credentials/socket, bounded CPU/memory/process count/time/output.
- Generated tests are plain argument-free pytest functions. Fixtures, parametrization and project pytest configurations are not introduced by M1.
- Tests require intended behavior from the user. A failing assertion can indicate a code defect or a mistaken expectation. Passing tests do not certify the file or repository.

## Generation reliability

The acceptance exercise exposed duplicate test function names from Gemma. These are rejected because Python would overwrite earlier definitions. A structurally invalid suite gets at most one model correction request; validation is reapplied and an invalid second response is rejected. Network/invalid-response failures are not retried silently. Successful generation records generation_attempts; generated code is never silently rewritten or automatically approved.

A diagnostic model response also used 333 instead of the supplied 334 for a rounding case. Structural validation cannot establish semantic correctness. The acceptance oracle is specified before generation, assertions are checked against it before approval, and the model prompt requests exact user-supplied values. This remains a model quality limitation, not a defect automatically solved by retrying structural validation.

## Synthetic acceptance fixture

Public educational repository, previously authorized by the user: [tracefold-validation](https://github.com/ziademad02153/tracefold-validation).

- Bad branch sprint3-file-bug, commit 6909cd715d747c907ad3114a3c771d1ac6a1494f.
- Repair branch sprint3-file-fixed, commit 9abc67b3824b26eaa27905f723a8f362d28f859a.
- File pricing.py contains PERCENT_SCALE, private helper _remaining_percent and two public functions price_after_discount and discount_amount. Only the helper's plus/minus operator changes between versions.
- Predefined five-case oracle: discounted 10000 at 20% -> 8000; zero discount -> 10000; full discount -> 0; discount amount 10000 at 20% -> 2000; discount amount 3333 at 10% -> 334.

## Verification

- TypeScript/Vite production build passed.
- Workbench API tests cover original module preservation, helper/constant support, original import validation, multi-function selection coverage, explicit approval, immutable suite rerun, persisted full source/image identity, legacy behavior and bounded model correction.
- Docker integration tests passed, including a namespace module policy/retries.py whose shared helper defect causes 3 failures plus 1 module-identity pass. The same four tests all pass after repairing the helper. Isolation, missing dependency, skipped tests, output limits and per-test evidence checks also pass.
- Browser/Gemma acceptance: session 9ba3c48709744ce88a26e4acb7a4b610, 5 tests across both public functions. Bad helper: 1 passed / 4 failed. Repaired helper: 5 passed / 0 failed, same suite hash and image. The explicit rounding oracle was checked before approval. The successful generation used one request after the prompt was strengthened; prior rejected generation attempts are described above.
- Refresh preserved both runs, all ten per-test entries and suite identity. The earlier Sprint 2 suite remained readable. Desktop/tablet/mobile widths 1440/768/390 had no horizontal overflow and no browser page errors were recorded. Build, workbench and Docker checks are engineering smoke/regression evidence, not a broad model quality benchmark.
- [Saved acceptance artifact](../../validation/evidence/sprint3-file-testing.json) contains the approved test code, original source snapshots, identities and results. [Open local report](http://127.0.0.1:5173/#test-session/9ba3c48709744ce88a26e4acb7a4b610).

### Reproduce

Start Docker, build the runner if needed, and run npm start. Open tracefold-validation, create a suite on sprint3-file-bug/pricing.py, select both functions, and supply the five-case oracle above. Review all assertions, approve and run, then choose sprint3-file-fixed and rerun unchanged. For code checks:

    .venv/Scripts/python.exe -m unittest test_workbench test_ai_review test_docker_runner -v
    npm.cmd run build
