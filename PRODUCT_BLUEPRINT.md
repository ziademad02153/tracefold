# Tracefold product blueprint

Date 4 November 2026. This is the current product structure and proposal for the next milestone. Sprint 3 implementation has not started.

## Purpose and primary unit

Tracefold helps a developer create, review, execute and retain tests for a specific version of project code, then repeat the same tests after a repair. A Project is the workspace backed by a GitHub repository. Testing is the primary workflow. AI PR code review is an additional analysis tool.

| Object | Meaning |
|---|---|
| Project | The repository and its saved testing activity |
| Test suite | Approved test code, expected behavior, target source version and runner image |
| Test | One named scenario and its assertions |
| Run | Execution of the saved suite against one immutable revision |
| Evidence | Per-test outcome, details, duration, source, suite identity and raw output |
| Report | A readable view of saved evidence. AI code review reports are labeled separately. |

The current testing scope is one standalone Python function per suite, three to five generated pytest tests, explicit approval, Docker execution and repeatable evidence. Connecting a multi-language repository does not make all of its code executable by this workflow.

## Product sitemap

The projects screen is the entry dashboard. Its activity is read from saved records. Projects without test activity display zero saved suites/runs and Not run yet. Counts are not quality scores.

~~~mermaid
flowchart TD
  A["Projects and saved activity"] --> B["Add project from public GitHub"]
  B --> C["Project overview"]
  A --> C
  C --> D["Tests"]
  C --> E["Results"]
  D --> F["Create suite"]
  D --> G["Open saved suite"]
  F --> H["Review and approve tests"]
  H --> I["Run all tests"]
  I --> J["Per-test evidence"]
  G --> J
  E --> J
  J --> K["Choose repaired revision"]
  K --> I
  C --> L["Additional tool — AI code review"]
  L --> M["Select PR and view saved analysis"]
~~~

## Navigation map

| Destination | Route | Primary action |
|---|---|---|
| Projects | #projects | Open project |
| Add project | #connect | Connect repository URL |
| Project overview | #project/encoded-repository | Create test suite or open latest evidence |
| Tests | #testing/encoded-repository | Select code or reopen a saved suite |
| Suite and evidence | #test-session/session-id | Review, approve, run and rerun the same suite |
| Results | #results/encoded-repository | Open evidence from saved execution history |
| Optional PR analysis | #pulls/encoded-repository | Create an AI code review report |
| Saved code reviews | #history/encoded-repository | Open saved AI analysis |
| Code review result | #report/report-id | Read findings or repeat the analysis |

Existing saved report/session URLs continue to work. The former project route now opens its project overview. PR selection has its own explicit route.

## User journey

1. A new developer reads the entry description and adds or opens a project.
2. Overview states what is currently supported and what the next action is.
3. The developer opens Tests, selects source and specifies expected behavior.
4. Gemma proposes three to five tests. The developer inspects scenarios and assertions and approves the exact saved code.
5. Run all tests executes in the current Docker runner. Each test is passed, failed, skipped, blocked or not recorded as appropriate.
6. Results opens the evidence. A failure remains evidence for investigation, not an automatic product-bug verdict.
7. After committing a repair, the developer reruns the same approved suite on that revision.
8. The suite and all executions can be reopened later. Current persistence is local SQLite.

First-time usability acceptance is still to be reviewed with a new user. In 30 seconds, a user should be able to identify the supported task, open a project, find the start action and locate a previous test result. Automated navigation checks cannot establish that comprehension.

## Current system architecture

~~~mermaid
flowchart LR
  U["Developer browser"] --> W["React and TypeScript UI"]
  W --> API["FastAPI orchestration"]
  API --> GH["GitHub public source at commit SHA"]
  API --> LLM["Internal Ollama — gemma4 e4b"]
  API --> DB["SQLAlchemy — SQLite verified"]
  API --> CLI["Docker client on development host"]
  CLI --> RUN["Bounded Python and pytest container"]
  RUN --> ART["JUnit evidence and bounded output"]
  ART --> API
  API --> W
~~~

PostgreSQL configuration exists but has not been integration-tested. The current API handles model requests and runner orchestration synchronously. There is no separate production worker service yet. Test containers have no model, GitHub or database credentials and run with network disabled. A shared deployment still needs authentication, authorization, infrastructure and recovery work.

## Roadmap and next official milestone proposal

| Stage | Scope | Exit evidence |
|---|---|---|
| Function Testing — current | One standalone Python function and reviewed suite | A suite fails on a defect and passes unchanged on its repair. Sprint 2 recorded this. |
| File Testing — proposed Sprint 3A | One Python file, its public functions, same-file helpers, constants and supported standard-library imports | Tests import and execute the actual saved module. A helper/constant defect is reproduced and its repair passes the unchanged suite. |
| Project dependencies — later | Local module imports and an approved, reproducible package environment | The selected file runs with its real project imports and pinned environment. Unsupported dependencies produce an explicit blocked state. |
| Repository Testing — later | Multiple selected files and suites in a configured project environment | One saved run explains which files/scenarios ran and preserves results by revision. |
| PR verification — later | Run selected project tests against change revisions | The system distinguishes a new regression from a pre-existing failure. Existing AI PR review remains advisory until this is implemented. |

### Proposed Sprint 3A boundary

Select one Python file. Include its same-file helpers, constants and standard-library imports in model context and execution. Generate tests for selected public functions in that file and execute the actual module. Keep suite review, approval, per-test evidence and same-suite rerun semantics.

External packages, cross-file imports, databases, remote APIs, hardware and multiple languages are separate scope. The UI must explain an unsupported dependency before execution rather than silently extracting a function and losing required context.

### Proposed acceptance fixture

A pricing.py module contains a constant, a private rounding helper and two public functions that call that helper. A known helper defect causes at least one agreed scenario to fail. The same suite passes after a repair commit. The developer can inspect the module version and each result after refresh.

This is the candidate next milestone for review, not a completed feature or an approved implementation schedule.

## Design notes

The product keeps its existing mark, warm neutral workspace, dark navigation and status text/colors. Figma uses Inter because Segoe UI is unavailable in its font list. The web UI retains Segoe UI/system fonts. Screens in the Product Blueprint page distinguish current capabilities from future milestones.

No coverage percentage, language detection, risk score or whole-repository certification is inferred from suite counts. Latest-run counts refer only to that recorded execution.


## Review links and verification

- [Product Blueprint in Figma](https://www.figma.com/design/JApksAD4rM8ffWwQcoSENV?node-id=14-3)
- [Project overview design](https://www.figma.com/design/JApksAD4rM8ffWwQcoSENV?node-id=14-26)
- [Sitemap and journey](https://www.figma.com/design/JApksAD4rM8ffWwQcoSENV?node-id=14-63)
- [Current architecture](https://www.figma.com/design/JApksAD4rM8ffWwQcoSENV?node-id=14-98)
- [Next milestone proposal](https://www.figma.com/design/JApksAD4rM8ffWwQcoSENV?node-id=14-135)

The web build passed. A project-summary regression test verifies stored suite and run counts, latest-result selection and a new project with no activity. Browser checks covered project entry, Overview, Tests, Results, saved evidence, empty projects, optional PR analysis and 390/768/1440 pixel widths without overflow. Earlier pilot screens are labeled Archive in Figma. New-user comprehension remains a human usability check.

## Repository execution design

See [REPOSITORY_TESTING_ROADMAP.md](REPOSITORY_TESTING_ROADMAP.md) for the technical gates from extracted-function tests to real repository execution, dependency environments, pytest configuration, multi-module support and team rollout. This document refines the roadmap without approving Sprint 3 implementation.
