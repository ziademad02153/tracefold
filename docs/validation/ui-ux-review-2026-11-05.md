# UI/UX and functional review — 5 November 2026

## Verdict

The supported repository-testing journey works end-to-end, but the UI does not yet meet a daily-team-use acceptance bar. Four high-priority interaction issues can lose draft work, obscure unavailable activity, offer conflicting operations or prioritize the wrong saved execution. No application UI code was changed during this review; these findings remain open.

The visual baseline is consistent: Tracefold identity, dark-green/lime palette, readable primary text and stable card/navigation styling. That does not establish first-time-user comprehension or complete accessibility compliance.

## Scope and method

- Browser: headless Microsoft Edge/Chromium on Windows, against the running Vite/FastAPI application.
- Thirteen screen/routes: Projects, connection, project overview, environment setup/list, generated suites, Runs, defect/repair reports, PR list, advisory review, focused-file selection/report and invalid-route handling.
- Responsive inspection at 390, 768 and 1440 CSS-pixel widths: no document-level horizontal overflow in those route/width checks.
- Twenty-six recorded screen/interaction checks completed, plus the new live repository generation/repair journey and live AI review described below.
- Axe-core 4.10.3 WCAG 2 A/AA and 2.1 AA checks on the thirteen screens: no detected violations or incomplete checks in that run. Keyboard activation of the skip link was checked separately. This is not certification, an assistive-technology study or testing every browser/device.
- Real company Ollama gemma4:e4b and Docker execution were used for the live journey. Controlled API fixtures were used to reproduce pending, empty and failed-fetch states without corrupting saved records.
- Local screenshots and detailed browser captures are under ignored .tracefold/ui-audit/2026-11-05/. They are local audit artifacts, not live data promoted into the versioned evidence inventory.

## Functional observations

| Journey/control | Result |
|---|---|
| Invalid repository submission | Actionable validation error displayed |
| Connect existing public repository | Resolves into the correct project; no duplicate project required |
| Inspect real revision/component | Native API discovery and environment fields rendered |
| Save/review/prepare environment | New profile prepared through the UI |
| Existing tests | Two existing cases passed |
| Actual model generation | Six test functions generated for two real modules; all required assertions independently reviewed |
| Draft edit/save/approval | Unsaved changes disable approval; saving changes the hash; approved code becomes read-only |
| Defective revision execution | Eight cases total: six passed, two failed |
| Repaired revision | Eight passed with the same approved suite hash; two failures changed to passes, no case additions/removals |
| Refresh | Approved suite, source/evidence identities and successful repair result retained |
| Environment recovery/rebuild | Ready environment rebuilt; original report/environment snapshot remained intact |
| Live advisory PR review | Completed with one concrete discount-calculation finding; retained after refresh |
| Earlier focused-file tool | File loading, original-source inspection and function selection worked; saved reports were readable |
| Empty Runs / partial history failure | Start action present for an empty history; partial failure warns while remaining reports stay available |
| Missing profile / unknown route | Explicit error or not-found page rather than a frontend crash |
| Frontend runtime | No page-level JavaScript exceptions observed during the recorded browser checks |

The defect is one known percentage-sign logic error; two failing generated cases are not two independently discovered defects. Gemma returned six functions although the request suggested three; six is within the schema's 3–8 bound, but exact requested grouping was not followed. This is a smoke test of a public educational fixture, not a company pilot or model-quality benchmark.

### New saved records

| Record | Identity |
|---|---|
| Defect profile | 3512fd8959fd4e1e8dbabf52fa0f4262 |
| Repair profile | eb75bd18a5474792a975f3e79b971bf8 |
| Approved suite | a5fc81643bb74a25900f8c588a37ce1f |
| Advisory review report | 9ad8bce6ddf34583b69274fd8b929687 |

These records are in the local application database, not bundled by git clone. The validation project intentionally contains educational defect/repair branches. Existing reports were not deleted.

## Reproduced findings

| ID | Priority | Observation and effect | Reproduction / change required |
|---|---|---|---|
| UX-01 | P1 | Switching suites silently discards unsaved test-source edits | Controlled draft list: edit A, select B, reopen A; edit is gone. Protect suite changes/navigation with save/discard handling or retained local drafts. |
| UX-02 | P1 | Parent run/rebuild actions remain enabled while child generation is pending | Controlled delayed generation POST; both controls remain enabled. Share operation state across the profile page. Backend concurrency guards remain important but do not make the enabled UI correct. |
| UX-03 | P1 | Repository activity failure is silently omitted while earlier file metrics remain visible | Controlled activity 503; no warning appears on Overview. Show an explicit incomplete/unavailable state and retry. Do not imply the legacy metrics represent all project activity. |
| UX-05 | P1 | View test results starts at the oldest report, despite the summary describing the latest run | Live profile with baseline PASS followed by generated FAILED. The first visible report is the old two-case PASS. Target the latest/selected run and prioritize its verdict; preserve older results as history. |
| UX-04 | P2 | Empty eligible-module catalog is a blank selector and disabled action with no explanation | Controlled empty catalog. Explain support/eligibility and provide the next action instead of leaving a dead end. |
| UX-06 | P2 | Overview gives earlier file-suite metrics more visual priority than repository testing | Observed live desktop/mobile content order. Lead with current repository activity, latest result and a contextual next action; keep older tools secondary. |
| UX-07 | P2 | Source selection requires Ctrl/Cmd and has no search or persistent selected-file summary | Native multiple-select used live. Prefer searchable checkbox selection, visible limit/count and clear removal; especially important on touch devices and larger repositories. |
| UX-08 | P2 | Focused-file help still calls repository environments a later milestone | Visible live text in Workbench. Replace development-history language with current capability names and a link into repository testing. |

Source boundaries: [suite interaction](../../src/RepositorySuiteFlow.tsx), [profile/results view](../../src/RepositoryExecution.tsx), [overview](../../src/ProjectHome.tsx), [focused-file tool](../../src/Workbench.tsx).

P1 means correct before accepting this workflow for routine team use; P2 is the next clarity/usability work. These are review priorities, not security severity ratings.

## Additional clarity improvements

- Environment configuration exposes runtime/provider, component root, dependency pins, extras, plugin names, CLI arguments and import paths together. Preserve explicit approval while separating essential setup from advanced fields and explaining detected project inputs.
- Saved environments are identified mostly by commit hash/provider/state. Add human-readable revision/purpose context so several profiles of the same source are distinguishable.
- Connect accepts a public repository without prominently explaining the supported execution profile before deeper setup. Show support boundaries early, especially for non-Python projects.
- A profile page combines environment recovery, generation, approval/replay and long report history. Clarify the next action and put the relevant result before diagnostic/configuration details when viewing evidence.
- Keep new repository generation terminology distinct from older file-only tooling. No additional dashboard or language provider is needed to resolve these issues.

## Regression verification and limits

The automated suite completed 53 tests with no failures or skips, including Docker checks. The TypeScript/production build passed. An existing non-failing SQLite cleanup ResourceWarning remains. These regression results do not negate the reproduced UI findings.

The legacy generator was not submitted again during this review; its selection/report UI and backend regressions were exercised. No private connector, company repository, other runtime, multi-user access, Safari/Firefox, physical mobile device or user-comprehension study was tested. No claim that every possible state/button combination is covered is made.

## Recommended acceptance order

1. Preserve unsaved drafts, unify pending-state controls, expose partial-fetch errors and correct latest-result navigation.
2. Simplify project hierarchy, source selection, empty states and environment setup wording.
3. Repeat the same live defect/repair journey, interaction-state checks, responsive/accessibility checks and regression suite on the corrected UI.
4. Validate the supported journey with a first-time developer and the actual company project before declaring daily team readiness.
