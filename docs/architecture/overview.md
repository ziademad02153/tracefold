# As-built architecture

This is the authoritative architecture reference. [Historical reviews](../archive/README.md) retain the original findings; they are not independent audits or competing current designs.

## Dependency direction

```text
React workspace → FastAPI adapters → ExecutionService
                                  ├── SQL profiles / suites / runs
                                  ├── injected immutable snapshot acquisition
                                  └── Provider contracts
                                        └── PythonRepositoryProvider
                                             ├── AST/context discovery
                                             ├── company Ollama generation
                                             ├── isolated pip preparation
                                             └── pinned native pytest executor

Advisory PR review and earlier focused file/function tooling remain separate paths.
```

## Responsibilities

| Boundary | Implementation |
|---|---|
| Composition and project/PR APIs | [app.py](../../app.py) |
| Generic execution HTTP adapter | [execution_api.py](../../execution_api.py) |
| Contracts, policy and reconciliation | [execution_core/contracts.py](../../execution_core/contracts.py) |
| Profiles, hash approval, lifecycle, persistence and comparison | [execution_core/service.py](../../execution_core/service.py) |
| Verified source acquisition | [snapshot_store.py](../../snapshot_store.py) |
| Python preparation/native execution | [providers/python_repository.py](../../providers/python_repository.py) |
| Bounded generation/context | [providers/python_generation.py](../../providers/python_generation.py) |
| Provider-specific UI options | [src/providers](../../src/providers/) |
| Generic execution/suite UI | [RepositoryExecution](../../src/RepositoryExecution.tsx), [RepositorySuiteFlow](../../src/RepositorySuiteFlow.tsx) |

Core/HTTP imports are guarded by regression checks. Configuration and environment IDs are provider-owned. Generation is an optional capability extension, not a requirement for every provider. A non-Python contract fixture uses device identities, a feature file and emulator-like environment; it proves contract behavior, not a second runtime implementation.

## Execution identities

A profile fixes source, provider/version, configuration and policy. A suite independently hashes approved files and origin/context metadata. A run retains source/profile/environment and suite identities plus the environment manifest. Rebuilds do not rewrite earlier run manifests. New source revisions require their own profiles/prepared environments.

SQLite is the local default through SQLAlchemy. PostgreSQL configuration exists but migration/integration/recovery acceptance remains open. Tables are created on startup; there is no established production migration service.

Application data now resolves through [runtime_paths.py](../../runtime_paths.py). New checkouts default to a sibling data directory; this local E:\Tracefold installation uses E:\Tracefold-data for its database and snapshots. TRACEFOLD_DATA_DIR overrides the location and DATABASE_URL independently selects a database. Legacy locations remain compatible until explicitly migrated. Moving local data outside source is housekeeping, not distributed storage, a backup system or multi-user deployment acceptance.

There is currently no authenticated user/project membership boundary. The connected-repository check verifies that a repository exists in the local workspace, not that a particular user is authorized. Consequently, binding the existing API to a shared address or adding DNS/login UI is insufficient. The [ordered delivery gates](../roadmap.md#local-mvp-to-company-service-ordered-delivery-plan) own the required authorization, migration, worker and operational work.

## Preparation and execution

The downloader receives approved registry wheel specifications without repository source or application credentials. Installation/build hooks run offline in an isolated container. The prepared image pins the native executor and records runtime, package and script identities.

Execution uses read-only source/control mounts, non-root identity, no network, dropped capabilities and bounded resources. Existing/generated phases use separate fresh source copies under the same pinned image. Generated overlays cannot overwrite source files. Baseline CLI selection and explicit generated-file selection are retained in effective configuration.

Native case IDs/phases, configuration and artifacts return through the provider. Core verifies text-artifact checksums, normalizes outcomes and reconciles them with collection inventory. Missing/duplicate/unknown evidence is blocked. Explicitly empty existing baselines are distinguishable from collection/import failures.

## Limits and open findings

- One Python 3.11/Linux/pip/pytest profile; supported wheel-based dependency inputs, no automatic uv/Poetry/workspace/service/GPU/device orchestration.
- Generation uses bounded selected modules and one-hop context, not a complete repository dependency graph. Structural checks do not establish semantic test quality.
- Native evidence is bounded inline text; large/binary artifacts require storage/contract evolution.
- Jobs are synchronous; durable scheduling/cancellation, aggregate quotas and preparation disk limits remain open for shared use.
- The source connector is public GitHub only. Runtime-neutral contracts do not imply private/source-host support.
- Default source bounds: 16 MB compressed, 64 MB expanded, 5,000 files, 8 MB/file. Case limit: 5,000.
- Default worker bounds: 1 GB/2 CPUs/128 PIDs, 256 MB temporary space, preparation 360 seconds, repository execution 120 seconds. These are policies, not capacity guarantees.
- Company acceptance, shared authorization, retention/backup and image/cache cleanup are open gates, not solved by this document.

Future providers can reuse demonstrated lifecycle/evidence contracts but may require versioned extensions. No claim of zero future schema evolution is made.
