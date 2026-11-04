# Repository Testing technical roadmap

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

Status 4 November 2026. Approved delivery direction. No new testing capability is introduced by this document.

Implementation update: M1 / Sprint 3 is accepted by the user. See [SPRINT3.md](../sprints/sprint-3.md) for implementation evidence and limits. The current-state description below records the baseline at roadmap approval. [Language Expansion Roadmap](language-expansion.md) defines the direction beyond Python M4.

M2/M3 delivery update: the first supported repository profile and separated execution core/provider are implemented. [M2_M3.md](../validation/m2-m3.md) records the real upstream 297-case pilot and limits; [ARCHITECTURE_REVIEW_M3.md](../architecture/m3-review.md) reviews the as-built boundary and open findings. Company-project acceptance remains pending. M4 was subsequently authorized and implemented; see [M4.md](../validation/m4.md).

## Current delivery decision: validate M4 on the company project

Overview, Tests, Runs and AI Review remain the primary project destinations. M4 now runs inside Tests: prepared environment → bounded generation → review/approval → execution → saved evidence → replay unchanged on a repaired revision. See [M4 implementation/validation](../validation/m4.md) and [M4 architecture self-review](../architecture/m4-review.md).

M2/M3/M4 have supported-profile engineering evidence. Company acceptance remains NOT RUN. No additional features or runtime expansion are authorized in the current scope. The next gate is the actual company repository, its reference commands and review of the implementation findings.

Pilot status: the user will supply a company Python repository and its installation/test commands. While awaiting that input, engineering validation used the real upstream package pallets/itsdangerous at 2.2.0, not the synthetic tracefold-validation repository. Its 297 cases match a direct pytest reference under the selected environment. This does not substitute for company-project acceptance. Initial inspection of ZEDX-AI-Simulator found the application and existing test suite are JavaScript/TypeScript; Python files are auxiliary agent scripts, so it is not the Python pilot.

### Pilot intake and reference run

Record the repository URL, immutable revision, project/component root, supported Python version, installation command, dependency/lock inputs, test extras/plugins and reference test command. Identify services, credentials, datasets, native dependencies or GPU requirements explicitly. Unsupported requirements produce a preparation finding rather than a silent change to the project's intended test selection.

1. Inspect the supplied project and its documented environment before defining its execution profile.
2. Establish a reference run in an isolated clean environment, recording collection IDs, outcomes and effective configuration. A project with pre-existing failing tests still has a valid reference baseline; failures must remain visible rather than require an artificial all-green result.
3. Build the approved environment inside isolation, install the actual project and dependencies, and record exact resolved versions and environment identity.
4. Execute the existing suite through Tracefold using the equivalent profile. Preserve internal imports, conftest, resources and pytest settings. No AI generation is needed for this gate.
5. Compare collected/executed cases and outcomes with the reference. Explain any differences, represent skipped/error/interrupted cases and verify saved evidence after backend restart.
6. Re-run the same commit/environment to check repeatability, document the supported profile and review the product with the user at M3.

M2/M3 runner and UI work is delivered for the bounded profile documented in M2_M3.md. Evaluate the company pilot against that profile before estimating additional requirements; do not infer universal repository support from the upstream acceptance result.

## Architectural acceptance: Core Platform and Python Provider

Approved direction: Tracefold is a general testing platform for Backend, AI, Web, API, Mobile and Embedded teams. Python is the first supported runtime. These engineering domains are not interchangeable language identifiers: a component profile also identifies its test framework, execution target and required facilities.

Separate the existing Python workflow incrementally during M2 and M3. Do not postpone the provider boundary until the second language. The backend may remain implemented in Python; platform independence means its orchestration and data contracts do not require the tested project to use Python or pytest.

### Ownership boundaries

| Core Platform owns | Python Provider owns |
|---|---|
| Project/component identity and immutable source references | Python project/layout/manifest discovery |
| Provider selection, contract version and capability negotiation | Interpreter, package installation, extras and dependency resolution |
| Approved execution profiles, lifecycle and dispatch | Python build and pytest invocation/configuration/plugins |
| Resource/access policies and worker capability matching | Native collection IDs and pytest outcome parsing |
| Approval identity, persisted runs, artifact references and comparison | Python-specific source analysis and generated-test validation |
| Generic result views and explicit unsupported/blocked outcomes | Native diagnostics and framework-specific evidence interpretation |

The first contract covers discovery, preparation, collection, execution and evidence normalization; a build step may be part of preparation. Generation is an optional capability, not a prerequisite for running existing tests. The core must not import Python source analysis, pytest-specific parsers or the concrete Python runner to coordinate a run. A composition root registers/injects the concrete provider. Provider code depends on core contracts; core orchestration does not depend on a concrete provider.

### Data and execution contracts

- A profile has a provider ID/version, component/source identity, execution target, policy and a validated provider-specific configuration section. Python flags and installation settings stay in that section, not required fields of every core profile.
- Tests use opaque provider-issued IDs, including native parameterized/class identities. A core test case does not require a Python function, .py path or test_ name. Optional display locations/metadata retain their provenance.
- Results distinguish lifecycle/infrastructure failures from test outcomes. Preserve passed/failed/error/skipped/expected-failure/unexpected-pass/not-run information and the original native outcome where applicable; unsupported or unmapped outcomes cannot silently become a pass.
- Evidence carries media type, artifact identity/hash and bounded content/reference metadata. Python/JUnit details remain available without making a specific evidence format mandatory for all providers. Reconcile collection and execution so absent evidence cannot produce all-passed status.
- Runtime image/environment identity is recorded without assuming every target is a Linux Docker container. Future Windows, browser, simulator and hardware workers declare capabilities; they are not implemented by this separation.
- Generic lifecycle, persistence and result UI consume these contracts. Python forms remain provider-specific views within that shell. Existing saved sessions keep an explicit legacy execution contract; refactoring cannot silently change approved code or historical evidence.
- A local model is optional for execution. M3 must be usable with existing repository tests when Gemma is unavailable.

### Delivery split

**During M2:** define the minimal versioned contract from real pilot needs, separate Python discovery/preparation from core profile/source/run ownership, and route operations through explicit provider dispatch. Avoid a plugin marketplace, dynamic installation system, speculative universal build DSL or production implementations of future providers.

**During M3:** route collection/execution through the same boundary, persist normalized and native evidence, adapt generic result views and preserve the legacy session path. Complete the architectural review below together with real-project functional acceptance.

### Mandatory Architecture Review after M3, before M4

Produce a review against the delivered code, not only a target diagram. The review record must include:

1. An as-built dependency diagram, module ownership and the implemented provider/profile/result schema, compared with the boundaries above.
2. Dependency checks showing core orchestration imports contracts rather than Python/pytest implementation details. Provider-specific form fields must not be mandatory for generic runs or evidence.
3. A contract-test provider with non-Python-shaped identities/artifacts. Exercise dispatch, lifecycle failures, persistence, reopening and generic result rendering without the Python runner or Gemma. This fixture demonstrates boundary behavior only; it does not claim a second language is supported.
4. The real Python pilot evidence: preparation, native collection/configuration, reference outcome comparison and repeatability after restart, plus regression checks for existing approved sessions.
5. Failure-path checks for unsupported capability/target, preparation failure, collection failure, zero tests, skipped/expected-failure cases, timeout and incomplete evidence.
6. A concrete change map for one hypothetical next provider: new provider package/worker profile and registration should suffice for the shared lifecycle and result flow. Any required edits to core orchestration/schema/rendering must be explained and assessed before claiming extensibility.
7. A findings table with evidence, severity, required fixes and remaining limitations. Mark the review passed only when blocking coupling is resolved; list future extensions honestly rather than promise no core changes will ever be needed.

M3 exits only when both real-project functional acceptance and this Architecture Review pass. Present that review to the user and obtain the next scope decision before starting M4 or language expansion. No claim of architectural independence is made by this document alone.

## Direct answer

Tracefold becomes capable of executing a real Python repository when it can reproduce that repository's approved test environment and run its existing configured test suite from an immutable checkout. That is the exit gate for Milestone 3 below. Repository-wide AI test generation is a subsequent gate, Milestone 4. Shared daily team use also has a separate operational release gate.

The current implementation has not reached those gates. It extracts a standalone function into target.py, generates 3–5 tests, runs one fixed Python/pytest image and records evidence. It does not install the selected project, load its pytest configuration, preserve internal imports or execute its existing test suite.

## Target execution pipeline

~~~mermaid
flowchart LR
    A["Repository and immutable revision"] --> B["Project discovery"]
    B --> C["Approved execution profile"]
    C --> D["Isolated environment build"]
    D --> E["Collect tests in project context"]
    E --> F["Execute existing baseline suite"]
    F --> G["Review generated test additions"]
    G --> H["Execute approved combined selection"]
    H --> I["Per-test evidence and environment manifest"]
    I --> J["Rerun saved generated suite on repair revision"]
~~~

An execution profile is configuration, not AI inference. It records the project root, interpreter/platform, package manifests and lock digest, install arguments, selected extras, test command, pytest configuration and plugins, environment-variable names and any approved service requirements.

## Milestone 1 — File Testing

### Changes

- Retain the actual source module. Preserve helpers, constants, imports and module identity.
- Generate tests for selected public functions in one file. Keep their original import paths.
- Execute the module in the container. Module initialization is treated as code execution.
- Keep the existing approval, immutable generated suite, result and rerun contracts.
- Support only declared standard-library dependencies initially. Detect external or cross-file requirements and show a preparation error.

### Acceptance

A module with two public functions, a private helper and a constant can be tested without extracting/reconstructing its functions. A defect in the helper causes an agreed case to fail and its repair passes the same generated suite. Both runs record module content, commit, suite hash and image identity.

This gate supports file context. It does not establish repository environment support.

## Milestone 2 — Repository context and environment reproduction

### Source and import handling

- Acquire the complete approved repository snapshot at a commit SHA. Preserve package directories, resources and relevant test configuration. Handle symlinks and archive paths explicitly.
- Determine flat versus src layout and the installable package/project root.
- Prefer the project's documented installation process. Build/install its package inside isolation so relative and absolute imports retain their intended semantics.
- Record explicit PYTHONPATH configuration only where the project's approved workflow requires it.
- Support local module imports before adding automatic AI generation across modules.
- Resolve the selected revision first. Environment generation and execution both refer to that snapshot.

### Dependencies and environments

- Discover pyproject.toml and requirements/lock files. Ask the project maintainer to approve install inputs and test extras.
- Begin with one supported pip-based project profile. Poetry, uv and other lock formats need explicit adapters before claiming support.
- Recreate the environment. Do not copy a developer's .venv or install project packages into Tracefold's own environment.
- Separate dependency preparation from test execution. Preparation can use an approved registry/wheelhouse under defined network rules; execution uses the already-built environment.
- Run build/install hooks inside isolation, with no host Docker socket or inherited application credentials.
- Record interpreter version, OS/architecture, tool versions, resolved distributions, lock hashes and image digest.
- Key dependency caches on environment inputs. A source package build also includes the source revision in its identity.
- A missing lock can produce a recorded resolved environment, but should not be presented as reproducible from the original manifest alone.

### Acceptance

A small real package using src layout, internal imports, a test dependency and an approved plugin can be built from a clean checkout and collected under its expected Python version. Repeating the build/execution uses the same recorded environment. Missing or incompatible dependencies fail preparation clearly, without being labeled product bugs.

## Milestone 3 — Execute the real repository test suite

### Pytest support

- Honor the selected project's pytest.ini, pyproject.toml, setup.cfg or tox.ini as supported by its selected pytest version.
- Preserve conftest.py, fixtures, testpaths, markers, selection options and the import mode used by the project.
- Record effective configuration and CLI arguments. Platform-controlled evidence paths and resource limits remain explicit overrides.
- Replace the current blanket plugin-disable assumption with an approved, pinned plugin set suitable for that project.
- Collect tests using pytest in the same environment used for execution. Use complete node IDs, including classes and parametrized cases.
- Reconcile expected collected cases with actual outcomes. Collection errors, skipped/xfail/xpass cases, interruptions and missing results must be represented.
- Run existing tests before adding AI tests. Existing baseline failures remain distinguishable from failures caused by newly generated assertions.

### Multi-module and workspace support

- A single installable package with multiple modules shares its approved environment.
- Multiple separately packaged projects use explicit component profiles when versions or runtimes differ.
- Workspace-local dependencies are installed in a declared order or through the project's supported workspace tool.
- Aggregate run results without flattening incompatible environments into one package installation.
- Databases, brokers, external APIs and GPUs require separately declared supported environments or remain blocked. A generic Python runner does not imply those facilities exist.

### Acceptance

Use a nominated real pilot repository. From the same commit, the Tracefold run and the documented CI/local command collect the same intended test cases under equivalent configuration. Pass/fail/skip/error outcomes agree, or each difference is explained. Execute from a clean environment and repeat after restart.

At this gate Tracefold can run a supported real Python repository's configured tests. That is a meaningful engineering tool even before AI-generated tests cover every module.

## Milestone 4 — Repository-wide generated tests

Implementation update, 4 November 2026: the authorized bounded M4 workflow is implemented on the supported Python profile. See [M4.md](../validation/m4.md) for actual batches, execution evidence and limits, and [architecture self-review](../architecture/m4-review.md). Company repository acceptance remains NOT RUN. The requirements below describe the milestone; they do not imply exhaustive generation or universal repository support.

### Changes

- Reuse the working repository environment.
- Select modules/functions for generation, with deterministic source and dependency context plus relevant existing tests and fixtures.
- Generate in bounded batches. An entire repository is not sent as a single model prompt.
- Review and approve generated files. Keep their hashes independent from the source revision.
- Execute generated additions and existing tests with clear provenance for each case.
- Rerun unchanged generated suites after a fix. If the repository's own tests also change, report additions/removals separately instead of calling the whole inventory identical.

### Acceptance

Generate approved tests for multiple modules in the pilot repo. Reproduce a seeded real defect and verify its repair, while the existing suite remains visible. Reopen evidence later and identify exactly which source, tests, environment and configuration produced it.

## Operational gate for daily team use

Functional repository support and shared deployment are different gates. Before exposing private company repositories to multiple users, complete access controls, GitHub App permissions, secret handling, queued/cancellable jobs, concurrency limits, reliable artifact persistence, migrations/backups and monitoring. These are release requirements, not extra feature work approved by this roadmap.

The current SQLite/synchronous local service is suitable for supervised evaluation, not an established shared runner service.

## Suggested execution order

1. Review this design and nominate one real Python pilot repo and its current install/test commands.
2. Implement File Testing and its module-context acceptance fixture.
3. Reproduce the pilot environment and run its existing tests.
4. Add generation for multiple modules in that environment.
5. Complete the operational gate before a daily team rollout.

Do not expand to multiple languages or claim universal repository support until a supported Python project profile passes these gates.

## Timing and definition of complete

Milestone 3 is the technical point at which real repository execution becomes available. Milestone 4 adds generated testing across the repo. Team rollout requires the operational gate as well.

A delivery date needs the pilot repository assessment. A small pure-Python package with a clean lockfile has a materially different installation scope from a monorepo with native extensions, services or GPUs. The first planning task should be a 1–2 working-day discovery timebox to produce the approved profile, unsupported requirements and a repo-specific estimate. This is a proposed planning timebox, not an already-completed assessment.

'Complete repository testing' means executing the configured supported suite against that repository snapshot and reporting its limits. It does not mean proving the correctness of every line or generating all possible tests.

## Primary references

- [pytest integration practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html)
- [pytest configuration](https://docs.pytest.org/en/stable/reference/customize.html)
- [Repeatable pip installs](https://pip.pypa.io/en/stable/topics/repeatable-installs/)
- [Python virtual environments](https://docs.python.org/3/library/venv.html)
