# Workspace action and recovery review — 5 November 2026

Scope: complete missing basic controls in the local single-user testing workflow. No account, deployment, language provider or execution engine is added. The previous [project-management acceptance](project-management-2026-11-05.md) remains the record for transactional deletion and its six backend tests.

## Screen/action inventory

| Area | Reviewed actions and resulting behavior |
|---|---|
| Projects | Add, open, view original, delete, search/reset and refresh. A failed list can retry. Unavailable activity no longer implies zero runs. Empty/whitespace connection input is disabled and duplicate submissions are guarded. |
| Overview | State-dependent guide, next step, area links, latest result and partial-fetch retry. Guidance does not assume successful completion when its records cannot load. |
| Environment setup | Inspect source, select dependencies/settings, save for explicit approval, confirmed reset and cancel. Provider failures retain accessible saved environments; history failures are not shown as an empty list. |
| Saved environment | Run baseline, generate, select result, rebuild, refresh status and change configuration. Correction copies the pinned setup into a new profile; original evidence is preserved. Status retry remains available during an operation. |
| Generated tests | Search/select modules, draft generation, saved-suite selection, save/edit/approve, confirmed discard of local edits, download saved code and same-suite repair replay. Saved history failures are labeled unavailable. |
| Results | Exact-run selection, per-case filtering/search/pagination, JSON download and direct approved-suite/repair link. Skipped or expected-failure cases are not called passes. Missing runs provide a return path. |
| Runs | Open saved evidence, partial-history warnings and in-place retry. |
| AI Review | PR import, saved report, model review/re-review, report retry/download and return to reviews/testing. An empty PR list offers repository testing without requiring PR creation. Failed report loading does not imply an empty saved history. |
| Earlier focused tools | Preserved selection/approval/run/history workflow; duplicate-operation guard and explicit history/runner/session retry. Repository testing remains the main supported cross-module path. |
| Destructive actions | Project deletion retains preview, exact-name confirmation, cancel/Escape/focus return, active-write exclusion, changed-inventory rejection and transactional scope from the preceding acceptance record. |

## Verification

- Browser API fixtures exercise twenty-two new action/error scenarios alongside thirty-nine existing scenarios. They test user-visible outcomes, immutable configuration copying, cancellation, saved-vs-unsaved download bytes, selected report identities, error-versus-assertion semantics and recovery from partial failures.
- Final browser result: **61/61 scenarios passed**. TypeScript/production build, 165 local documentation links and six static capsule integrity checks passed.
- TypeScript checking and the production build passed. Automated reflow checks include the inspected configuration form at 320/390/768/1440 CSS pixels; axe checks cover the configured A/AA rules, not full accessibility certification.
- Live existing project `ziademad02153/local-automation-Microwave-gril-app`: opened its saved setup, copied it for inspection, inspected the cached pinned revision, cancelled back and downloaded the exact saved run. The before/after profile JSON was unchanged; no browser JavaScript errors were observed. Desktop/mobile screenshots were inspected. No actual project was deleted, no new model generation requested and no new test run presented as live acceptance for this UI-only change.
- Backend code is unchanged in this review. The preceding complete backend run passed 66 tests; that historical count is not a newly repeated run here.
- Raw screenshots remain outside source under E:\Tracefold-data\ux-actions-review. Existing static evidence capsule bytes are unchanged.

## Explicit limits and next user trial

Stopping an already running synchronous operation is not implemented. The progress view says leaving does not cancel it; no fake cancel button is added. Approved tests remain immutable. Earlier standalone sessions remain a compatibility path, not a replacement for full repository support. Project deletion does not reclaim cached source or prepared images, as stated before confirmation.

The existing public-repository/Python/Linux profile still applies. A ready environment is not proof that hardware-dependent, GUI, GPU or service workloads are supported. The Microwave project describes HIL, PyQt and NI DAQ dependencies; its compatibility must be assessed before claiming a full-project testing result. The next first-time user trial proceeds one screen/action at a time and records the actual repository, configuration and results; no universal defect-free or first-minute comprehension claim is made.
