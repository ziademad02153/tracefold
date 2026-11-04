# M3 Architecture Review

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

Historical M3 baseline: M4 subsequently added optional generic suite lifecycle and provider-owned generation. See [M4 architecture self-review](m4-review.md) for the current extension and open findings.

4 November 2026. Implementation self-review against the approved core/provider acceptance criteria. This is not an external audit or certification. Scope: the newly delivered repository-execution path, with explicit legacy and operational limits below.

## As-built dependency direction

~~~mermaid
flowchart TB
    UI["Generic execution UI"] --> API["Generic execution HTTP adapter"]
    API --> CORE["Core contracts and ExecutionService"]
    CORE --> CONTRACT["Injected Provider contract"]
    PY["PythonRepositoryProvider"] --> CONTRACT
    PY --> WORKER["Docker preparation and pinned pytest harness"]
    CORE --> SOURCE["Injected GitHub snapshot store"]
    CORE --> DB["Profiles and execution evidence store"]
    ROOT["Composition roots: app.py and src/main.tsx"] --> PY
    ROOT --> UI
~~~

Arrows describe dependencies/registration, not network traffic. Core service receives providers and snapshots by injection. It does not import Python source analysis, pytest, model generation, the concrete Docker worker or the old workbench. The Python backend implementation language is separate from the runtime of a tested project.

| Ownership | Actual implementation |
|---|---|
| Contract and capability selection | execution_core/contracts.py, service.py |
| Profiles, hashes, approvals, lifecycle and SQL evidence | execution_core/service.py |
| Runtime-neutral routes | execution_api.py |
| Python configuration/discovery/install/pytest normalization | providers/python_repository.py |
| Framework-specific execution phases and native diagnostics | providers/repository_executor.py, pinned into prepared image |
| Concrete registry/view selection | app.py, src/main.tsx |
| Python-specific setup fields | src/providers/PythonEnvironmentForm.tsx |
| Shared result view | src/RepositoryExecution.tsx |
| Existing function/file sessions | separate workbench.py / test_runner.py compatibility path |

## Contract observations

A profile records contract version, provider ID/version, source identity, immutable validated provider-specific config, policy and approval hash. Core configuration has no required Python function, .py path, pytest argument or Linux image field. Prepared environment ID is opaque: contract tests use emulator-state:42. A concrete provider currently chooses Docker, not the core.

Cases have opaque native IDs; core does not reconstruct them from function names. Outcomes are normalized and reconciled with the collected inventory. Expected/unexpected failure aliases are retained in the first normalized schema; native framework phases remain separately available. Unknown outcomes, incomplete inventories and malformed artifact checksums are blocked.

Evidence includes media type and bounded content with computed/verified checksums. This version supports inline text artifacts; binary files/large artifacts will need a versioned storage/view extension before enabling providers that need them. No claim of zero future schema evolution is made.

Existing test execution does not call Gemma. Generation remains outside this core lifecycle. Snapshot acquisition is source-host-specific but runtime-neutral and injected.

## Checks and evidence

| Review check | Result and evidence |
|---|---|
| Core/HTTP layer imports contracts instead of concrete runtimes | Pass: static AST dependency guard in test_execution_core.py |
| Non-Python-shaped identities and environment | Pass: contract-device fixture with screen://submit[locale=ar] and emulator-state:42 |
| Approval, lifecycle, SQL persistence/reopening through that fixture | Pass: CoreTests; environment preparation and unsupported capabilities are tested |
| Shared UI can render non-Python identity and non-JSON evidence | Pass: browser contract fixture, text/plain device trace; no pytest setup form required |
| Missing/unknown/duplicate/zero evidence cannot pass | Pass: core reconciliation checks and real negative profiles |
| Actual src-layout package, dependencies, configuration and native cases | Pass: itsdangerous 2.2.0, 297 cases, matching direct reference collection and outcomes |
| Plugins/fixtures/parameterization and exceptional outcomes | Pass: real container regression with explicit plugin and resources |
| Historical function/file evidence | Pass: legacy regression and browser reopening; not silently migrated |
| Saved run identity includes source/profile/environment | Pass: repeated browser runs; per-run environment snapshots retained |

Backend restart persistence and the exact acceptance artifact are recorded in M2_M3.md/evidence. See the implementation/validation record rather than treating this table as a universal provider compatibility guarantee.

## Findings and remaining limits

| ID | Severity / disposition | Assessment |
|---|---|---|
| AR-01 | Blocking coupling resolved for new repository path | Concrete Python/pytest/Docker work lives outside core; registration is at the composition root |
| AR-02 | Blocking evidence ambiguity resolved for supported cases | Reconcile inventories, retain phases, distinguish preparation/collection/error/skip/xfail/xpass and block missing evidence |
| AR-03 | Medium, explicitly open | Earlier function/file UI/runner remains Python-specific legacy tooling. Unifying it later needs compatibility/migration work; it does not define the new core schema |
| AR-04 | Medium, explicitly open | Only text artifacts and the first provider contract version exist. Browser screenshots, recordings and large native artifacts need a storage/view extension |
| AR-05 | Release blocker for shared deployment | No authentication/queue/shared concurrency/retention/backups or strict preparation disk quota. Do not expose this local pilot as a shared untrusted runner service |
| AR-06 | Supported-profile boundary | Python 3.11/Linux only; no service/GPU/private-registry/workspace adapters. Report unsupported requirements rather than claim general project support |
| AR-07 | Scope remains pending | The user's company repository has not been supplied. Upstream package success is engineering evidence, not company-project acceptance |

## Next-provider change map

For a future .NET or JVM unit-test profile, add its provider implementation, environment/worker support, framework result normalization and configuration view, then register them in the composition roots. Generic source/profile approvals, lifecycle, persisted runs and text/XML evidence should reuse the delivered core. Prove that by implementing and testing the actual adapter before advertising support.

Browser, mobile, GPU or hardware profiles may additionally need execution-target/credential/resource capabilities and binary artifacts. Extend versioned contracts where concrete needs require it; do not force these environments into Python, pytest or a Linux-container assumption. This is an extension point, not an implementation promise that those profiles exist today.

## Decision

The new repository-execution core/provider boundary passes the listed local contract and supported-profile checks. Architecture is suitable to continue validating the approved Python pilot scope with the documented limits. It is not a claim that every existing tool has been migrated, every future provider can be enabled without any core evolution, or that operational team readiness is complete.

Present M2/M3 functional evidence and this review to the user. Do not begin M4 or language expansion without the next scope decision. Company-pilot acceptance remains pending.
