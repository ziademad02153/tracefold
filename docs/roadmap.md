# Delivery roadmap

This is the sole active planning reference. Product terminology belongs to [Product](product/overview.md), implementation boundaries to [Architecture](architecture/overview.md), and measured outcomes to [Validation](validation/README.md). Earlier roadmaps are archived, not parallel plans.

## Established foundation

The supported Python profile implements project environment preparation, existing-test execution, bounded repository-context generation, exact-suite approval, saved native evidence and unchanged-suite repair replay. Core lifecycle and persistence are separated from the Python provider. Historical milestone names are retained only in the archive.

## Local MVP to company service: ordered delivery plan

The implemented testing workflow is a **local, supervised technical MVP**, not a deployed multi-user company service. The next work is service readiness and a real-company pilot, not another testing capability. Product clarity improvements support this gate; automated UI checks do not establish first-time comprehension.

### Scope and decisions

- Initial release: company-internal access, the existing Python provider and company-hosted Gemma. No public SaaS, new runtime, dashboard, notification or autonomous source modification is part of this plan.
- Existing technology is retained: React/TypeScript, FastAPI, SQLAlchemy, provider-neutral execution core and isolated Docker execution.
- Target shared database: PostgreSQL with versioned migrations and tested transfer of existing local records. Existing compose.yaml starts only PostgreSQL; it does not deploy Tracefold.
- Source snapshots and artifacts stay on persistent application storage, outside the source checkout and web-served frontend. Preserve source/suite/environment identities during migration. The first pilot can use persistent server volumes; object storage is a later capacity decision, not a prerequisite by itself.
- Prefer company identity integration if available. Exact identity provider, source-host connector, server OS/address and certificate process require the company's technical owner. These are deployment dependencies, not questions a nontechnical product owner must solve unaided.
- A friendly internal HTTPS address is the target. A publicly purchased domain is not required. DNS alone does not deploy or secure the service.

### Delivery gates

| Order | Deliverable | Concrete implementation | Acceptance / exit evidence | State |
|---|---|---|---|---|
| 0 | Pilot contract | Technical owner identifies one real project, documented test/install command, runtime, dependencies, repository access and any services/GPU requirements. Record support gaps before promising compatibility. | Written supported profile and pilot scenario, with known expected outcomes. Missing information stays explicitly unknown. | Awaiting company technical input |
| 1 | Shared persistence foundation | Versioned PostgreSQL migrations; users/project membership ownership model; transfer local projects/suites/runs without changing approved identities; explicit storage configuration. | Fresh install and upgrade tests; migrated inventories and hashes reconcile; backup restores into an independent database/storage copy. No local-data deletion before verified recovery. | Not implemented |
| 2 | Identity and authorized source access | Login/session/logout with the selected company identity; server-side membership checks on project, report, suite, run and artifact APIs; selected private connector with scoped credentials kept out of test containers and logs. Handle source permission loss and GitHub limits explicitly. | Two users cannot read or mutate each other's unshared project by guessing an ID; unauthenticated requests fail; revoked access is enforced; a private pilot snapshot is acquired without credential leakage. A login page alone does not satisfy this gate. | Not implemented |
| 3 | Reliable execution service | Move synchronous model/preparation/execution work into durable jobs; worker claim/heartbeat, timeouts, bounded concurrency, cancellation and interruption recovery; approval/hash checks at execution; resource/disk limits and retention preserving referenced evidence. | Closing a browser does not cancel evidence persistence; duplicate submissions do not launch duplicate jobs; restart/cancel/timeout have explicit durable states; concurrent work stays within configured limits. | Not implemented |
| 4 | Internal deployment | Production frontend build, API, worker, database, persistent storage and HTTPS ingress on an agreed company host; internal DNS/VPN policy, service restart, secret configuration, health checks, monitoring and rollback. Keep model/database/worker administration off the user-facing interface. | A permitted second computer can use the service while the developer laptop is off; unauthorized access is blocked; host/service restart retains reports; restore and rollback are demonstrated. | Not implemented |
| 5 | Company-project acceptance | Reproduce the native baseline, review generated assertions, run additions and replay unchanged tests after a fix; observe a first-time developer completing the actual flow. Include a clean control and known failure, not only successful examples. | Native IDs/outcomes match or differences are explained; human-approved assertions; saved before/after evidence survives restart; user can identify purpose/next action and complete work without external coaching. | NOT RUN |
| 6 | Limited daily pilot | Small named group uses only accepted project profiles; record setup time, accepted/rejected generated tests, actionable failures, reliability and support incidents. Technical/product owners review results. | Explicit go/no-go for routine internal use, supported-project list, operator/backup ownership and unresolved limitations. Test counts are not a substitute for this decision. | Not started |

Stage 0 informs every gate; supported local project trials may proceed before shared hosting if company policy allows, but they are not multi-user acceptance. Gates 1–4 may have overlapping implementation tasks, but none can be omitted for daily shared/private use. Do not expose the current unauthenticated API to the company network as a shortcut.

### Definition of the first company release

An authorized developer opens the internal link, signs in, sees only permitted projects, connects the accepted private Python repository, prepares its environment, runs existing tests or generates the first reviewed suite, inspects saved per-case evidence and reruns the same approved suite on a repaired revision. Work runs on company infrastructure; the developer's laptop is not the service host. This is the release acceptance contract, not a description of today's implementation.

No calendar completion date is asserted before source access, server availability and identity integration are established. Document any changed assumption here rather than creating another roadmap.

## Next gate: actual company repository

| Required input/check | Acceptance evidence |
|---|---|
| Repository access, immutable revision and component root | Identified source and supported profile; private access addressed explicitly if required |
| Reference installation/test commands, Python version and dependency inputs | Environment assessment, unsupported services/native/GPU needs recorded |
| Direct reference baseline | Stable native case IDs and observed outcomes; existing failures remain visible |
| Tracefold preparation/execution | Matching intended inventory/outcomes or explained differences |
| Generated additions | Human-reviewed assertions against known behaviors and clean controls |
| Repair replay | Same suite hash on repair, recorded environment differences, retained evidence after restart |

No company result is asserted. Review the pilot and as-built findings before deciding any extension. Do not add features merely to make the repository appear more complete.

## Shared-service operational gate

Before daily multi-user/private-company use, validate authenticated/authorized repository and resource access; durable queued/cancellable jobs; aggregate resource and preparation-disk quotas; secret isolation; migrations, backup/restore and PostgreSQL behavior; artifact retention, image/cache cleanup and monitoring. Internal hosting/TLS belongs to this gate. A changed bind address is not deployment acceptance.

## Language and target expansion

The proposed default sequence is below. It is not an implementation claim or dated commitment; real company demand can change the order by an explicit scope decision.

| Order | Provider/profile | Required technical scope |
|---|---|---|
| 1 | C# / .NET | Pinned SDK, SDK-style project references, approved NuGet restore, build, xUnit native outcomes and generated test project |
| 2 | Java | Pinned JDK, Maven wrapper/module/classpath/resources, JUnit/Surefire evidence; Gradle is a separate adapter |
| 3 | Host C / C++ | Compiler/ABI, headers/definitions/linkage and resources; CMake/CTest + GoogleTest for C++, separate Unity/Ceedling/CMock profile for C |
| 4 | Embedded simulation | Selected board/SDK/RTOS/toolchain, cross-build, firmware identity and a validated simulator/harness |
| 5 | Embedded hardware | Dedicated lab worker, device reservation, controlled flash/reset/run, target/firmware identities, diagnostics and recovery |

JavaScript/Web, API services and Mobile require separately scoped runtime, build and test environments. Browser/service integration, Android/iOS/device execution and cross-language integration are not inferred from language parsing. AI model evaluation requires explicit datasets, deterministic/stochastic semantics and accelerator profiles; Python unit testing alone does not establish it.

## Exit contract for every provider

1. Choose a real pilot with declared build/test commands and target versions.
2. Reproduce its existing baseline in isolation, retaining native identities and explaining differences.
3. Generate/review additions using actual imports/references and the declared framework; compile where required.
4. Demonstrate a known defect and unchanged-suite repair replay, with persisted evidence.
5. Verify missing dependencies/tools, build/collection failures, zero tests, timeout, skips and interruption.
6. Review contracts and publish explicit support boundaries before enabling the profile.

Host, simulator and hardware outcomes are distinct. Binary/large artifacts and new target semantics may require versioned contracts rather than reuse of today's text-evidence schema unchanged.

## Other product scope

## Test-type expansion within Python

Test types are distinct from workflow actions: Existing tests means execution of supplied tests; Generated tests means AI-assisted creation. Neither label by itself promises unit, service, UI, performance, security or model-quality coverage. Regression replay is a purpose of reusing tests after change, not a separate generation engine.

| Order / status | Test type | Supported or proposed scope | Acceptance gate |
|---|---|---|---|
| Available, bounded | Unit / behavior tests | Reviewable pytest assertions for selected Python modules, explicit outputs, boundaries and expected exceptions. Three to eight test functions in one reserved file. | Independent requirement review; real source import/execution; clean and defective controls. Generation does not guarantee all relevant cases. |
| Available, bounded | Internal module interaction | Actual package imports, local helpers and approved external Python dependencies in the selected execution environment. Not service/database/browser orchestration. | Demonstrate dependency-sensitive behavior against the real installed package; preserve native evidence. |
| Available | Regression replay | Same approved suite after a code repair, with source/environment identity and native-case comparison. | Failing-before/passing-after without silently rewriting expected values or changing the suite. |
| Next testing-depth gate | Broader Python unit scenarios | Classes/state, fixtures and mocks where required by the first accepted real project; define support instead of promising arbitrary Python code. | Named pilot workflows, meaningful assertions and measured accepted/rejected generated tests. Scope after the actual project assessment. |
| Later, scoped pilot | API / database integration | A named Python web framework, explicitly provided test database/services, credentials and network policy; isolated test data and cleanup. | Repeatable seeded service/database scenarios; correct cleanup, failures and secrets isolation. Not enabled by allowing arbitrary network access. |
| Later | Browser end-to-end | A deployed test application, browser runtime, test accounts and journeys spanning multiple screens. | Reproducible actual browser actions, failure artifacts and test-data recovery. |
| Separate future scope | Performance / load | Declared workload, concurrent users, latency/error thresholds and a target test environment. | Repeatable load runs with observed resource/latency evidence. Unit timings are not load testing. |
| Separate future scope | Security analysis/testing | Explicitly scoped checks and appropriate analysis/testing tools. | Named supported checks and validated findings; AI code comments alone are not security testing. |
| Separate future scope | AI/ML evaluation | Fixed datasets, declared metrics/thresholds, model/runtime identities and accelerator support if needed. | Reproducible evaluation including stochastic semantics. Gemma generating a Python test is not evaluation of the user's ML model. |
| Separate provider scope | Embedded / hardware | Named simulator or physical-device harness with controlled device lifecycle. | Host unit tests, simulation and real-device outcomes are recorded distinctly. See provider expansion above. |

These are capability gates, not delivery-date commitments or authorization to implement all types now. Immediate work remains the local Python user journey and a real-project fit assessment; multi-user release gates still apply when shared deployment is chosen.

Measured coverage/test-gap analysis, CI/PR automation, team integrations and notifications remain separate scope decisions after core acceptance. No coverage percentage, feature maturity score, release date or new runtime support is assumed by this document.
