# M3 Validation Report

Review date: 4 November 2026 (Africa/Cairo). Implementation under review: f12eefd. This report changes documentation only; it does not implement M4 or add runtime capabilities.

**Decision: the supported open-source engineering pilot passed. Company-project validation is NOT RUN and full company acceptance remains pending. Do not start M4 before reviewing that result and obtaining the next scope decision.**

## User-facing capability and AI role

Repository Tests currently executes the repository's EXISTING tests. It does not create missing tests. The 297 passing cases in the upstream acceptance run were authored in itsdangerous; Gemma did not generate them, and 297 passed does not mean 297 bugs were found.

| Current workflow | AI role | Executed evidence |
|---|---|---|
| Repository Tests | None required | Run the existing configured suite in a prepared, recorded environment |
| Python File Testing | Gemma proposes 3–5 tests for up to five selected public functions in one supported module | Review, approve and execute that saved suite; rerun unchanged after a repair |
| PR AI Review | Gemma reviews the saved PR diff for potential issues | Advisory findings only; that action does not execute tests |

Function/file generation has narrower support than repository execution. Its existing workflow supports same-file helpers/constants and selected standard-library imports; it does not generate tests using arbitrary installed project dependencies, package initializers, framework fixtures or the newly prepared repository environment. Historical standalone-function sessions retain their original behavior.

### If the repository has no tests

- Repository Tests reports zero collected cases as BLOCKED, not PASSED. Environment preparation can succeed without establishing any behavioral verification.
- If a source module fits the current File Testing limits, the user can generate/review/run a small suite in that separate workflow. The saved suite is not automatically added to the repository or combined with Repository Tests. A developer can copy approved tests into the project and configure their intended test location/imports manually.
- For a dependency-heavy project with no tests, automatic repository-context test generation is not implemented. That is the M4 gap. PR review remains advisory and does not close it.
- The current product should be described as existing-repository test execution plus bounded AI file testing and advisory PR review, not automatic AI verification of any repository with no tests.

## 1. As-built architecture for this M3 delivery

~~~mermaid
flowchart TB
    UI["Generic execution UI"] --> API["execution_api.py"]
    API --> CORE["ExecutionService and generic contracts"]
    CORE --> CONTRACT["Injected Provider interface"]
    CORE --> DB["Profiles, runs and evidence persistence"]
    CORE --> SOURCE["Injected immutable source acquisition"]
    PY["PythonRepositoryProvider"] -. "implements" .-> CONTRACT
    PY --> WORKER["Docker preparation and pinned pytest executor"]
    ROOT["Composition roots: app.py and src/main.tsx"] --> CORE
    ROOT --> PY
    ROOT --> SOURCE
    ROOT --> FORM["Python configuration form"]
    ROOT --> LEGACY["Separate function/file and PR tools"]
~~~

This is an as-built diagram for the new repository-execution path, not a diagram claiming future providers are installed. The core owns identity, approved profiles, lifecycle, dispatch, persistence and result reconciliation. The Python provider owns Python discovery, pip installation, pytest configuration/collection/execution and native outcome interpretation. Concrete provider registration is outside core orchestration.

Static dependency checks and a non-Python-shaped contract fixture exercise the boundary. The fixture uses screen://submit[locale=ar], an emulator-style environment ID and text/plain evidence; a browser fixture verifies generic rendering. These are architecture tests, not implemented Mobile/Embedded support. Existing function/file tools remain a separately scoped Python-specific compatibility path.

See [the full Architecture Review](ARCHITECTURE_REVIEW_M3.md) for ownership, contract/version constraints, the next-provider change map and open findings.

## 2. What Repository Testing actually does

| Step | Delivered behavior |
|---|---|
| Select source | Connected public GitHub repo, branch/tag resolved to an immutable commit, explicit component root |
| Retain context | Bounded full snapshot including internal packages, resources, conftest and test configuration; validated archive paths and cached content hashes |
| Inspect | Show installability, layout, runtime declaration, manifests/dependency files and configuration candidates; do not import project code in the API process |
| Review configuration | Choose dependency files/packages, project installation versus explicit source paths, test arguments and approved plugins; save/hash the profile before preparation |
| Prepare environment | Source-free registry wheel download, offline isolated project installation into a fresh environment, dependency check and saved image/distribution/wheel/harness identities |
| Collect and execute | Run native pytest collection and tests using the same prepared environment in fresh temporary source copies; preserve full native case IDs |
| Validate outcomes | Reconcile collection/run inventories and represent assertions, setup/teardown errors, skips, expected failures, unexpected passes and missing evidence |
| Save and reopen | Persist profile/source/environment identities, per-case results, effective configuration, bounded logs and native artifact checksums |
| Repeat | Rerun the same recorded revision/environment; earlier evidence and environment manifests remain available after rebuilding an environment |

The runtime environment is currently Linux/Python 3.11. Source/test behavior is not changed merely to obtain a green result. A failed existing baseline can be valid evidence; it must agree with or explain differences from the reference run.

## 3. Unsupported and unvalidated scope

| Area | Current boundary |
|---|---|
| Repository AI generation | Not implemented; separate File Testing does not automatically use the repository execution environment |
| Other languages/targets | No .NET/JVM/Web/Mobile/Embedded provider or target is installed |
| Other runtime versions | No supported profile beyond Python 3.11/Linux |
| Dependency sources | Wheel-available public registry dependencies; no direct URL/VCS/private-registry or automatic nested-requirements/uv/Poetry lock adapter |
| Complex workspaces | One explicit component profile; no automatic installation order across separately packaged workspace projects |
| External facilities | No provisioned database/broker/API-service/GPU/lab environment |
| Coverage | No platform coverage measurement/dashboard added |
| Artifact scale | Bounded inline text artifacts; no general binary/large-artifact store |
| Shared operations | Local supervised single-user pilot; shared authentication, scheduling, retention/backups and strict preparation disk quota remain release requirements |
| Universal support | No claim that every Python repo builds/runs under the installed profile |

Source, resource and time limits are listed in [M2_M3.md](M2_M3.md). Exceeding them is a supported-profile limitation, not proof of a product-code bug.

## 4. Verification actually performed

| Check | Recorded result |
|---|---|
| Real upstream source | pallets/itsdangerous 2.2.0, commit 096c8d42545d3b68ea21a4f890fb2b2d8979c0bd |
| Runtime/toolchain | Python 3.11.18, pytest 8.1.1, Linux; actual project plus selected build/test requirements installed |
| Native collection and run | 297 collected / 297 passed / 0 failed |
| Repetition | Three saved runs, each 297 passed; same source, profile and prepared environment |
| Direct reference | Same 297 native collection IDs and individual JUnit outcomes using direct pytest in the same prepared environment |
| Persistence | Refresh and backend restart retained evidence; execution also repeated successfully after restart |
| Regression | 47 automated tests passed, including core contracts, legacy tools and real Docker integration; production build passed |
| UI | End-to-end inspect/configure/approve/prepare/run/re-run; 390/768/1440 widths; legacy evidence readable; no recorded browser page errors |
| Failures | Zero selected tests and invalid collection target -> blocked execution; nonexistent registry dependency -> blocked preparation |
| Native exceptional outcomes | Separate real package fixture covers resources, internal imports, external dependency, explicit plugin, fixtures, parametrization, assertion failure, teardown error, skip, xfail, xpass and timeout |

This is not execution of every upstream CI/tox target. The direct comparison used the recorded Python profile and documented CLI/evidence overrides. A successful 297-case run demonstrates environment and execution fidelity on that profile, not complete bug detection or generated-test quality.

Evidence: [profile/cases/three runs](evidence/m2-m3-itsdangerous.json), [reference comparison](evidence/m2-m3-reference.json), [negative probes](evidence/m2-m3-failure-probes.json), [saved local report](http://127.0.0.1:5173/#execution/b63e7e12cecf4b7f92527d20509a6669). Portable artifacts retain checksums and normalized cases; native artifact bodies remain in the local database.

## 5. Company repository validation — NOT RUN

The company Python repository and its install/test commands have not been supplied. No company-project result, collection count or success is asserted.

| Required record | Status |
|---|---|
| Repository access, immutable revision and component root | Awaiting input |
| Python version, documented installation/test commands and lock/dependency inputs | Awaiting input/discovery |
| Services, fixtures, data, secrets or native/GPU requirements | Not assessed |
| Isolated reference collection and baseline outcomes | Not run |
| Tracefold preparation and native execution | Not run |
| Case-by-case comparison, failures and differences | Not run |
| Repeatability and persisted company evidence | Not run |
| Project-specific blocker log and acceptance decision | Pending |

For a private repository, the current public-only connector cannot perform this validation; access support must be agreed without exposing credentials in chat or source control. If the company repo has no existing tests, preparation and correct zero-test detection can be validated, but meaningful M3 execution parity needs a real nonempty existing/user-authored baseline. Do not fabricate one or label file-test generation as completed M4.

## 6. Problems and blockers discovered

| Finding | Where observed | Disposition |
|---|---|---|
| Snapshot directory publication failed on Windows | Real upstream snapshot acquisition | Fixed: verify staged tree, publish atomic metadata pointer, rehash cache and reject tampering |
| Long hash text overflowed mobile viewport | Real repository report UI | Fixed and checked at 390/768/1440 widths |
| Execution harness could change independently of saved environment | Implementation review | Fixed: pin executor in prepared image, record script hash and retain per-run environment manifest |
| Empty/invalid selection could be mistaken for a useful run | Real upstream negative probes | Guarded: blocked status and native diagnostics, never an all-passed claim |
| Missing registry dependency | Real upstream negative preparation profile | Correctly blocked with preparation diagnostics; no fallback runtime/source build |
| Duplicate/missing/unknown test evidence and mismatched checksums | Core regression checks | Guarded: fail closed to blocked result |
| Existing SQLite test-process cleanup warning | Automated regression process | Open, non-failing warning; not a completed shared reliability gate |
| Limited runtime/dependency/service/workspace support | Implemented profile/review | Open, published supported-profile limits |
| Legacy function/file tooling remains Python-specific | Architecture review | Explicit compatibility boundary; not a dependency of the new execution core |
| Shared deployment and larger/binary artifact handling | Architecture/operational review | Open release/extension work, not implemented in this scope |
| Company-specific blockers | Company project | Unknown until the actual repository is assessed |

No company blocker list can be completed from an open-source run. On intake, append actual observed failures with stage, command/configuration, evidence, cause, owner and retest result.

## Acceptance decision and next gate

1. Supported-profile upstream execution: PASS with the documented limits.
2. New repository core/provider boundary: passes the listed implementation self-review checks; retain the open architectural/operational findings.
3. Company-project acceptance: PENDING / NOT RUN.
4. M4: NOT STARTED. Review the company results and architecture findings with the user before choosing M4 or modifying the plan.
