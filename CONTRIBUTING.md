# Contributing to Tracefold

Start with [the engineering index](docs/README.md) and [developer guide](docs/development.md). The root README describes the product; implementation support is defined in the product reference, not inferred from logos.

## Changes

1. Use a focused branch and describe the problem, resulting behavior and affected support boundary.
2. Keep generic lifecycle/approval/evidence in execution_core/. Put framework/runtime logic in providers/ and provider UI forms.
3. Preserve existing approved suite identities, source snapshots and historical run manifests. Never silently regenerate tests during repair replay.
4. Run applicable regressions and frontend build using the developer guide. State container skips, environment requirements and unresolved findings.
5. Update the authoritative document for the topic; do not add root sprint notes or another roadmap.

## Evidence and sensitive data

Do not commit credentials, company source snapshots, live databases or unreviewed run artifacts. Use synthetic/public fixtures in tests. Static acceptance capsules require deliberate review, provenance and a manifest update. A limited regex scan does not establish absence of all sensitive data.

## Licensing

A project-wide license has not been selected by the owner. Do not add MIT, Apache or another grant merely to decorate the repository. Confirm ownership and contribution terms before distributing code or accepting external contributions. Devicon assets retain their independent license and attribution under docs/assets/.

## Releases

Tags/releases should identify reviewed, reproducible checkpoints with explicit support boundaries, test evidence and known limitations. Repository cleanup does not itself establish a production release. Do not publish a version or green badge solely to change the repository's appearance.
