# Project management completion — 5 November 2026

This change closes missing basic workspace actions identified by the product owner. It is not a declaration that all future UX states are complete.

| Action | Implemented behavior | Verification |
|---|---|---|
| Add / reconnect | Existing repository names are matched case-insensitively before a GitHub call; reconnect does not create duplicates or fail because GitHub is temporarily unavailable | Isolated real-HTTP test |
| Open | Existing project destinations remain intact | Browser regressions |
| View original | GitHub link available on project cards and within project navigation | Source and visual review |
| Delete | Visible on cards and within project navigation; native modal, record counts, explicit scope, exact-name confirmation | Controlled browser tests and isolated real HTTP |
| Cancel | Cancel/Escape do not delete; focus returns to the trigger; destructive in-flight request cannot be dismissed | Browser cancellation/focus and request locking |
| Recover | Failed summary/delete retains the project and supports reload; changed activity requires a fresh preview | UI failure/retry and backend inventory tests |
| Protect active work | In-process mutation/deletion exclusion, plus persisted unfinished-operation checks | Gate and service tests |
| Preserve other projects | Transaction deletes only the selected project's related records; injected storage failure rolls back | Backend cascade, isolation and rollback tests |
| Retry history | Runs provides an in-place retry while retaining successfully loaded history | Browser regression |

## Deletion boundary

The operation permanently deletes saved Tracefold project records, not the GitHub repository. It deletes associated repository and focused-testing records and AI change reports/reviews. Draft browser-cache entries for that repository are cleared best-effort; another project's entries remain. The dialog explicitly states that downloaded source-cache files and prepared Docker images remain on disk. Cache/image retention and cleanup are separate operational work; deletion must not imply disk reclamation or secure erasure.

The existing application is a local, single-user, single-process service. The mutation gate is process-local; it is not ready for a multi-worker/company deployment without shared lifecycle locking and authorization. Persisted unfinished operations must be resolved before deletion. No real user project was deleted for acceptance: destructive real-HTTP testing uses a temporary database and owned server process. The live UI check previews and cancels only.

## Verification method

Six new backend tests cover scoped cascade/reconnection, confirmation/freshness, active work, rollback, write exclusion and real HTTP integration. Seven new browser scenarios cover cancellation/focus, confirmed deletion/list refresh/draft scope, deletion failure/retry, busy project, preview failure/retry, modal reflow/accessibility and Runs retry. The browser suite retains all previous testing/onboarding regressions.

Final backend regression: **66 tests passed, no failures or skips**, including the isolated HTTP workflow and Docker execution checks. Browser regression: **39/39 scenarios passed**. TypeScript and the production build passed. The live project deletion summary was opened and cancelled, with no JavaScript errors or deletion of user projects; desktop/mobile screenshots were visually inspected. Documentation links and the six static evidence capsules passed verification. A pre-existing non-failing SQLite cleanup ResourceWarning remains. Automated accessibility checks are scoped rule checks, not full compliance certification.
