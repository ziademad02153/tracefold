# UI/UX remediation — 5 November 2026

This implementation follows the [baseline review](ui-ux-review-2026-11-05.md). It changes the supported journey, not the language/provider roadmap. Raw browser screenshots and live runtime records remain ignored under `.tracefold/ui-remediation/2026-11-05/`.

## Resolved findings

| Baseline | Implemented behavior | Verification |
|---|---|---|
| UX-01 | Unsaved suite edits are retained in tab-scoped session storage, restored on reload and protected when switching suites or following application links. Storage failure is explicit. Approval requires saving first. | Browser switching, cancellation, reload, navigation, failed-save and unavailable-storage cases |
| UX-02 | Environment preparation, rebuild, generation and execution share pending-state locks. Loading and operation feedback are visible. | Delayed generation/rebuild tests; live execution |
| UX-03 | Overview exposes incomplete activity fetches and retry; independent saved records remain usable. | Controlled HTTP 503 and recovery |
| UX-04 | No eligible source modules gives supported-scope guidance and a next action. | Empty-catalog test |
| UX-05 | Execution completion opens that exact run. Latest/selected verdict precedes individual cases. Historical runs remain selectable. | Old-pass/new-fail fixture and live defect/repair |
| UX-06 | Repository suites, execution counts, latest run and contextual next actions lead the project overview. Earlier focused tools are secondary. | Overview assertions and visual inspection |
| UX-07 | Searchable source checkboxes, selected count, enforced selection limit and removable selections replace Ctrl-select. | Search/limit/removal tests and responsive checks |
| UX-08 | Focused tools link to the implemented repository workflow; obsolete milestone copy is removed. | Source review and production build |

Environment setup separates essential and advanced options. Discovery explains supported Python source and recognizes dependency files declaring pytest, avoiding an untouched conflicting default pin. Saved environments display the requested revision alongside the pinned source identity. Results distinguish existing/generated cases, provide search/filter/pagination, and keep diagnostic artifacts collapsed.

## Live model and Docker acceptance

Authorized public educational repository: `ziademad02153/tracefold-validation`, component `m4_project`. This is not company-project acceptance.

1. Added/opened the repository through the UI; inspected and prepared `sprint4-context-bug` in Docker.
2. Ran existing tests: **2 passed**. Completion opened the exact saved run.
3. Selected pricing and validation modules and described required discount/boundary behavior.
4. Gemma `gemma4:e4b` generated **6 test functions** in 52.89 seconds. Assertions were independently reviewed against the stated expected values. A review comment was saved before approval; assertions were unchanged.
5. Approved suite `59376274056a4079814ae8ca586e4c6f`; source became read-only. Existing + generated execution: **6 passed, 2 failed**.
6. Opened repaired commit `f88e9f524a428c0ec9aa0e45bc26be5ad725a32a`, prepared its environment and reused the exact approved suite: **8 passed**.
7. Comparison recorded two generated failures becoming passes, zero added/removed cases and a changed source/environment. Refresh preserved the result. No browser JavaScript errors were recorded.

Defect environment: `b93007a347c14fed90e1ce98e6832d8b`. Repaired environment: `9052e40705e747059538abc9bb71eb9c`.

GitHub rate-limited branch resolution during repair. The UI retained the suite and exposed the failure. Pinned 40-character commit acquisition now skips unnecessary branch resolution while preserving connected-repository checks, archive validation and cached-content rehashing. Repair was resumed with the known immutable commit. Branch names still need GitHub resolution; this does not bypass rate limits for fresh branch/PR discovery.

## Repeatable checks

- `npm run test:ui`: **20/20** controlled browser scenarios passed, including keyboard skip navigation, saved/dirty/error/pending states and exact-run selection.
- Eight workspace modes checked at **320, 390, 768 and 1440 CSS pixels** without document overflow. Automated axe WCAG A/AA rule checks found no violations in those fixtures.
- Final Python regression: **56 passed, no failures or skips**, including Docker execution and pinned-snapshot integrity/offline replay.
- TypeScript check and production build passed. Documentation links and six static evidence capsules verified.

The controlled browser suite uses API fixtures, not model or container substitutes presented as live acceptance. The separate live journey above supplies that evidence. A pre-existing non-failing SQLite cleanup ResourceWarning remains.

## Design criteria and limits

The implementation uses W3C guidance for [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) and [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). These are review criteria, not a certification of full WCAG compliance.

Tested browser: Microsoft Edge on Windows, headless automation. Physical touch devices, Safari/Firefox, screen-reader user studies, private repository connection, other runtimes and multi-user deployment were not validated. Company repository acceptance remains **NOT RUN**. Fresh advisory PR import/review was blocked by GitHub rate limiting during remediation; the earlier successful live advisory review remains in the baseline record. No claim of exhaustive defect absence is made.
