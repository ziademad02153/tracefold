# Product definition

This is the authoritative engineering product reference. The root README presents the full product vision; [the roadmap](../roadmap.md) owns future scope. This document defines the implemented user contract without duplicating historical milestones.

## Purpose

Tracefold connects project context, reviewed tests, native execution evidence and unchanged-suite repair verification. A repository-backed Project is the primary workspace. Python is the first executable provider, not the product's architectural identity.

## Terminology

| Term | Contract |
|---|---|
| Project | A repository and its retained testing activity |
| Snapshot | Immutable revision and verified source content identity |
| Execution profile | Provider/version, source, validated configuration and policy |
| Environment | Prepared runtime/dependencies with an opaque identity and manifest |
| Suite | Exact reviewed test files, context and approval hash |
| Run | One execution using recorded source, profile, environment and optional suite |
| Evidence | Native case identities/outcomes, diagnostics, logs and checksummed artifacts |
| Report | Readable saved execution evidence; advisory code reviews are labeled separately |

## Implemented experience

1. Connect a public GitHub repository and open its Project.
2. Select a branch/tag/commit and component, review configuration and approve preparation.
3. Run existing tests and inspect the baseline; zero tests is not a baseline pass.
4. In the same prepared profile, select bounded modules and define expected behavior.
5. Generate a draft, review/edit its actual assertions and approve its exact hash.
6. Execute existing/generated phases, preserving provenance and errors.
7. Open a repaired revision, prepare its profile and reuse the same approved suite.
8. Reopen results and compare outcomes, case inventories and source/environment changes.

No PR is required. Advisory PR analysis and earlier focused file/function workflows remain separate compatible tools.

## Navigation

Project Overview starts with in-product onboarding: what can be done today, an eight-stage testing journey, a state-dependent next action and the distinction between existing tests, generated tests, execution history and optional PR review. The recommendation follows the most recently created execution profile and its draft/approval/run records; older versions remain accessible through Tests and Runs. It is a recommendation, not a completion checklist or a claim that the repository is fully tested. Failed guidance requests expose a retry instead of assuming an empty project.

Tests, Runs and AI Review include short contextual orientation and a route back to the project guide. The existing-test path explains that a project without tests can proceed to generation after environment preparation. The guide explicitly separates advisory PR comments from test execution and explains that generated tests remain in Tracefold and code fixes happen outside it.

| View | Canonical route |
|---|---|
| Projects / add project | `#projects`, `#connect` |
| Project overview | `#project/{encoded-repository}` |
| Existing tests | `#tests/{encoded-repository}` |
| Generated repository suites | `#generated/{encoded-repository}` |
| Saved runs | `#runs/{encoded-repository}` |
| Advisory PR review | `#ai-review/{encoded-repository}` |
| Profile / selected run | `#execution/{profile-id}[/{run-id}]` |
| Exact suite | `#execution/{profile-id}/generate/{suite-id}` |

Earlier routes and stored reports remain readable. Reports/evidence are destinations inside the project, not extra primary navigation tabs.

Within an execution environment, Run existing tests, Generate & review and Results are separate views. Completing execution opens its exact saved verdict, with per-test outcomes and same-suite repair comparison when available. Generation uses searchable module checkboxes and explicit expected behavior. Draft edits are retained within the browser tab and require an explicit server save before approval; they are not shared drafts or server autosave. Environment recovery and native artifacts remain available in expandable details.

## Support boundary

The implemented repository profile is public GitHub + Python 3.11/Linux/pip/pytest. It preserves supported project installation, internal imports, fixtures/configuration, selected plugins and full native case IDs. Generation is bounded: up to three modules and 3–8 test functions in one reserved file. It is not automatic exhaustive generation for an entire repository.

Private access, other runtimes, service/GPU/device profiles, coverage, CI/PR execution automation and shared accounts/authorization are not delivered by that profile. Their single planning reference is the roadmap.

## Acceptance boundary

Supported-profile upstream and educational defect/repair validation are recorded in [Validation](../validation/README.md). Company-project acceptance remains NOT RUN: the real repository and reference installation/test commands have not been supplied. Supervised local success is not shared-service readiness or a quality guarantee for all projects.
