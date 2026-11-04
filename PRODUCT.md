# Tracefold | MVP requirements

## Product goal
Help an engineer reviewing a proposed change decide whether it introduced a regression and locate the evidence needed to reproduce it. Pilot with one team, one repository and one Git or CI integration.

## Requirements and acceptance

| Priority | Requirement | Acceptance |
|---|---|---|
| P0 | Projects and runs | An engineer can find the pilot repository, open a change and identify its exact base and head commits. |
| P0 | Reproducible checks | Run approved checks with the same configuration across base and head in an isolated runner. Record command, exit status and output for each version. |
| P0 | Review verdict | Show ready, running, passed, regression or blocked. A baseline failure or environment failure is shown explicitly and cannot be labeled a new regression. |
| P0 | Evidence | Show the changed file and line, expected versus actual behavior when present, and expandable diff and logs. |
| P0 | Run history | Persist runs and artifacts by commit pair. A reviewer can reopen a previous result. |
| P0 | Local model review | Validate structured, line-specific findings from the internal model. Label their source and keep the test report usable during model failures. Findings are advisory during the pilot. |
| Later | Additional coverage | Generate and verify test patches, then expand to browser, embedded or AI evaluation flows based on pilot demand. |

## Delivery sequence

1. **Design and offline validation.** Review the Projects → Runs → Report → Evidence path. Test with an engineer who can explain the failure without guidance. Confirm states and evidence hierarchy before implementing the design on the web.
2. **Deterministic workflow.** Implement report states, a reproducible runner and persisted results. Verify success, regression, a baseline failure and a blocked run independently.
3. **Internal model validation.** Check connectivity and model ID from the intended backend. Test buggy and clean changes. Measure valid structured outputs, line accuracy, useful findings and latency before enabling them in pilot reports.
4. **Pilot integration.** Connect the chosen Git or CI provider, run on real changes and review false positives, run time and whether the evidence helped engineers.
5. **Expansion.** Prioritize generated tests or another project type using pilot results.

## Visual direction
Light neutral workspace, navy navigation, blue actions. Green and red are reserved for results with explicit text. The lime folded-trace mark is preserved. Figma includes the identity, three workflow screens and six review-state examples.

## Current implementation note — 4 November 2026

The current review feature is advisory AI analysis of a saved public GitHub PR diff. Live CI collection and reproducible execution remain incomplete P0 requirements. The active visual direction is the evidence-focused Figma revision, with warm neutral surfaces, dark green navigation, a lime mark and explicit red/green diff indicators. See AUDIT.md for the implementation-to-requirements review.
