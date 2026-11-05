# Validation record

This is the authoritative acceptance index. Historical milestone reports are retained in [the archive](../archive/README.md); they are supporting records, not competing current summaries. Counts below describe observed tests, not product maturity percentages.

## Functional acceptance

| Subject | Recorded observation | Primary capsule |
|---|---|---|
| Upstream existing suite | itsdangerous 2.2.0, revision 096c8d42545d3b68ea21a4f890fb2b2d8979c0bd: 297 passed and matched direct native pytest IDs/outcomes | [Reference](evidence/m2-m3-reference.json), [profile/runs](evidence/m2-m3-itsdangerous.json) |
| Upstream generated additions | 297 existing + 3 generated cases: 300 passed | [Repository generation](evidence/m4-validation.json) |
| Educational installed-package defect | Two selected modules, actual internal helper/external dependency; seven cases: four passed, three failed | [Repository generation](evidence/m4-validation.json) |
| Repair replay | Same approved suite hash: seven passed; three generated failures became passes; no case additions/removals | [Repository generation](evidence/m4-validation.json) |
| Persistence/browser | Generation/edit/approval/run/replay and refresh/restart retained; artifact checksums verified; tested widths 390/768/1440 | [Repository generation](evidence/m4-validation.json) |
| Negative profiles | Empty/invalid selection, collection and missing dependency fail or block explicitly | [Negative probes](evidence/m2-m3-failure-probes.json) |
| Earlier file context | Five-case approved suite, original module context and unchanged-suite repair | [File acceptance](evidence/sprint3-file-testing.json) |
| Navigation baseline | Recorded project tabs/links; predates repository generation | [Navigation](evidence/project-navigation-validation.json) |
| Company repository | **NOT RUN**: actual repository and reference commands not supplied | [Company gate](../roadmap.md#next-gate-actual-company-repository) |

Initial larger upstream generation was structurally rejected. The educational generation's arithmetic comment needed human correction before approval. These findings remain in the generation capsule; success is not inferred from a model response alone.

## Evidence classification

The six JSON capsules are intentionally versioned, static verification records from public upstream or authorized educational fixtures. They include selected test/source context, case outcomes, identities and diagnostic excerpts. They are not the live database, snapshot cache or continuous run-artifact storage.

Versioned capsule bytes match the previously committed files. The manifest hashes the LF representation enforced by .gitattributes, so Windows/Linux checkout conversion cannot silently invalidate it. [Manifest](evidence/manifest.json) records file sizes and checksums. The 5 November review parsed every JSON and found no matches for the checked GitHub-token, AWS-access-key, private-key or credential-URL patterns. This limited scan is not a complete secret audit or permission to commit future runtime data.

The dependency-free scripts/check_validation_evidence.py verifies the exact JSON inventory, sizes and hashes against that manifest. It does not access live storage or certify absence of secrets.

Runtime database/snapshots remain ignored in their original locations. New company data, secrets, generated runs and raw snapshots must not be added to this directory by default. Promote only deliberately reviewed, non-sensitive acceptance fixtures; update the manifest and explain provenance.

## Repeatable regression checks

Use [Developer guide](../development.md#verification) for current commands. Test discovery targets `tests/` explicitly and excludes runtime `test_runner.py`. Container checks require Docker and the bootstrap image; a skipped container test is not a passing execution check.

Earlier acceptance recorded 51 passing automated checks and a successful frontend build. Cleanup verification is recorded separately in [repository cleanup](repository-cleanup.md), so historical execution evidence is not presented as a newly repeated model/company run.

## UI and usability review

[Workspace actions and recovery](workspace-actions-2026-11-05.md) inventories current screens, completes configuration correction/cancellation, draft discard, downloads and error recovery, and distinguishes unavailable data from empty results. It also records the unchanged live profile check and the remaining absence of running-job cancellation.

[Project management completion](project-management-2026-11-05.md) records deletion/confirmation/cancellation, scoped transactional cleanup, active-work protection, reconnect behavior and history retry. Source-cache/image retention and the single-process limit are explicit.

[In-product onboarding](product-onboarding-2026-11-05.md) records the visible guided journey, state-dependent next actions and contextual area explanations. First-minute comprehension remains a user-study target rather than an automated-test claim.

[5 November remediation](ui-ux-remediation-2026-11-05.md) resolves the eight baseline findings, adds twenty repeatable browser scenarios and repeats real Gemma generation, approval, failing execution and unchanged-suite repair through the corrected interface. The record distinguishes controlled tests from live execution and documents GitHub rate limiting and remaining acceptance limits.

[5 November UI/UX review](ui-ux-review-2026-11-05.md) records thirteen screens, controlled error/pending states, a new live Gemma/Docker defect-and-repair journey, advisory review, 53 regression tests and open interaction findings. Functional success is not a declaration that the UX is ready for daily team use.
