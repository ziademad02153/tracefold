# Product onboarding acceptance — 5 November 2026

Scope: improve first-use understanding within the implemented product. No provider, authentication, generation or execution capability is added. This follows the [UI remediation](ui-ux-remediation-2026-11-05.md), which remains the source for the preceding live Gemma/Docker verification.

## Implemented guidance

- Project Overview states the present task: test the Python project, review AI-generated additions, retain evidence and verify fixes using unchanged tests.
- One prominent recommended action follows the latest saved execution setup: first preparation, saved configuration approval, running operation, interrupted/error recovery, draft review, approved-suite execution, baseline, failed evidence or generated-suite repair replay.
- The complete eight-stage route stays visible. Expandable explanations describe the actions and expected result at each stage, without pretending that all preceding stages are completed.
- Existing tests are optional. A prepared project without tests can go directly to generation.
- Linked area explanations distinguish Existing tests, Generated tests, Runs/evidence and optional AI PR review. Generated tests stay in Tracefold; the repository is not automatically modified.
- Working views retain concise context and an accessible route back to the project guide. Explanations use actual product actions, not infrastructure documentation.
- Guidance load failures show uncertainty and retry; they do not replace unknown progress with zero or suggest starting over.

## Verification

The browser regression completed **32/32 scenarios successfully**, including twelve additions alongside the previous twenty: first project/setup navigation, unprepared configuration, prepared/no-test choice, draft, unexecuted approval, successful baseline, failed evidence, successful generated execution/replay, request failure/retry, busy/interrupted recovery, orientation across Tests/Runs/AI Review, and expanded-guide reflow/accessibility.

Controlled API fixtures exercise UI decisions without changing real projects or spending model execution time. TypeScript checking and the production build cover integration with existing views. Desktop and mobile guide screenshots were visually inspected; collapsed and expanded guidance was checked at 320, 390, 768 and 1440 CSS pixels. Automated axe checks cover selected WCAG A/AA rules and are not a certification.

## Acceptance limits

“Understand within 30–60 seconds” is the usability target, not a measured result. It still needs first-time user observation: ask a developer to identify the product's purpose, pick the next action, distinguish AI Review from executed evidence and find generated tests without external explanation. Record time, errors and assistance required. The previously documented Python/public-repository scope, GitHub rate limits and company-repository acceptance gap remain unchanged.
