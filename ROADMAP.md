# Tracefold | Engineering audit and delivery plan

## Current delivery update — 4 November 2026

M2/M3/M4 are implemented and locally validated on the supported Python profile. [M4.md](M4.md) records the working repository generation/approval/execution/replay workflow and evidence. [REPOSITORY_TESTING_ROADMAP.md](REPOSITORY_TESTING_ROADMAP.md) is the active roadmap; [ARCHITECTURE_REVIEW_M4.md](ARCHITECTURE_REVIEW_M4.md) records the self-review and open limits. Company acceptance is still pending the real repository and reference commands. No language or feature expansion is in the active scope.

## Historical initial audit (superseded capability baseline)

Tracefold is a public GitHub PR importer with durable snapshots and a separate demo. The product premise is to give developers reproducible review evidence and save review time. The current real workflow offers little beyond GitHub apart from a retained snapshot. A GitHub repository with no PRs has no actionable review path today. The demo check results are fixtures and cannot validate a real repository. A shared team deployment is out of scope for the current unauthenticated build.

| Area | Evidence in the current implementation | Release gap |
|---|---|---|
| Repository connection | Public URL is resolved through GitHub. Demo is separate. | GitHub App installation and private repo access, per-user authorization and removal. |
| Change selection | Most recent 30 PRs. Empty state for a repo with none. | Branch/commit comparison and pagination or targeted PR lookup. |
| Report | PR diff and commit IDs persisted. Public reports have no checks. | CI evidence, explicit incomplete states and robust snapshot integrity. New imports use a merge base and immutable commit IDs. Earlier snapshots retain their original import semantics. |
| Data | SQLite verified in development. SQLAlchemy creates tables on startup. | PostgreSQL integration test, migrations, constraints, backup and recovery. |
| Security | Loopback development. No app users, roles or workspace isolation. | Authentication, authorization on every resource, secret management, audit and retention. Critical before shared deployment. |
| AI and execution | Model unavailable. Demo check logs are fixture text. | Local-model validation, plus separately authorized and isolated execution if required. |
| Operations | Manual build, development proxy and API startup. | CI, integration tests, staging, deployment, health monitoring and operator documentation. |

## Delivery order

| Phase | Work | Exit criteria |
|---|---|---|
| 0. Reproducible baseline | Commit this checkpoint. Document setup and add automated smoke coverage for connect, saved report, invalid input and empty repos. Select one pilot team and repository. | Fresh clone builds and one teammate can reproduce a report using documented commands. |
| 1. Review without a PR | Add Compare branches or commits to the empty state and project actions. Resolve selected refs to immutable SHAs, preview the comparison and persist its source and inputs. Handle identical refs, missing refs and large comparisons explicitly. | The microwave repository can produce a report without a PR when it has two distinct comparable revisions. |
| 2. Evidence from existing CI | Import check runs and commit statuses against the precise SHA. Show pending, passed, failed, cancelled, skipped and unavailable with source links. Keep missing baseline evidence separate from a proven regression. | Known green and red changes match GitHub and a missing baseline cannot yield a regression verdict. |
| 3. Team access and private GitHub | Add company sign-in, workspace membership and server-side access checks. Install an organization-owned GitHub App with read-only pilot permissions. Keep secrets server-side and support removal. | Authorized users can open pilot reports, while requests from another workspace are denied. |
| 4. Data and staging | Add migrations and automated tests on PostgreSQL. Deploy on company infrastructure with HTTPS, secret storage, logs and backup restore checks. Add signed webhooks only when an approved route is available. | Two authorized teammates can use the same report link from staging and an operator can restore the database. |
| Parallel. Local model | From the intended backend network, confirm connectivity, model ID and protocol. Use small known-good and known-buggy diffs. Validate structured findings, line references, latency and degradation during timeout. | Findings meet the pilot team's usefulness threshold and an unavailable model leaves CI evidence intact. |
| 5. Pilot | Release to one team. Track successful imports, useful findings, time to evidence, failures and access issues. Fix pilot blockers before adding teams. | A developer can connect, review and share a real report without developer assistance. |
| 6. Expand | Prioritize isolated execution or generated tests if the pilot needs them. Add browser, embedded or AI-specific runners by demand. | Each new workflow has independent evidence and explicit pass/fail semantics. |

## Next session

1. Confirm which GitHub repository and existing CI the pilot will use.
2. Implement and verify comparison without a PR. Start with the existing zero-PR case and two available commits.
3. On the company network, verify local model access from the intended backend. Record model ID and benchmark results without storing credentials in Git.
4. Keep the first pilot read-only on GitHub. CI execution and organization-wide rollout require separate milestones.

## Local AI checkpoint — 4 November 2026

Implemented gemma4:e4b review on saved diffs with durable review state, output schema validation, line-location validation, running and failure states, and retry. Browser validation used a real public PR and the demo regression with refresh persistence. Nine automated tests cover the AI adapter, including network and malformed output paths. The initial model test produced a false positive on valid code. More explicit preconditions and review instructions produced an empty result for that valid case on a subsequent request. Wider evaluation remains necessary.

The current AI feature is available before live CI integration. Production multi-user access remains blocked on the access-control milestones above.


## UI and reliability review — 4 November 2026
See AUDIT.md. Eleven browser scenarios and eleven Python tests passed. Added failure-tolerant saved history, invalid-route handling, clearer review actions, stable diff inputs and responsive UI refinements. Shared deployment remains pending access control and operations work.


## Approved Sprint 1 implementation
The standalone-function testing path is implemented and verified with a generated test that fails on a defective discount calculation and passes unchanged on a subsequent repair commit. See SPRINT1.md. This advances the previously pending execution milestone for standalone Python functions only. Live CI, project dependencies and shared team deployment remain separate work.


## Sprint 2 checkpoint
Multi-test suites for standalone Python functions are implemented. The acceptance run changed from 2 passed / 3 failed on a known defective revision to 5 passed / 0 failed on its repair, with the same approved suite. Per-test evidence is persisted and Sprint 1 sessions remain readable. See SPRINT2.md. File and repository support still require dependency and environment work; they are separate milestones.
