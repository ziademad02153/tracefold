# Repository organization verification

Date: 5 November 2026. Scope: documentation consolidation, reviewed evidence relocation and automated test packaging. This is not a new model evaluation, company acceptance or production release.

## Changes

- Root README remains the branded product overview; CONTRIBUTING owns contributor expectations.
- docs/README.md identifies one authoritative owner per topic: product, architecture, roadmap, validation and development.
- Fifteen older root documents moved to a clearly labeled archive. Existing historical links were rebased rather than discarded.
- Seven regression modules moved into the tests package. Cross-test helper import was updated. The runtime module test_runner.py remains at its established application path.
- Six static JSON evidence capsules moved under docs/validation/evidence/; before/after SHA256 comparisons were identical. A checked manifest records bytes/hashes and provenance.
- Live databases, caches, prepared images, application imports and launcher paths remain unchanged.
- A dependency-free documentation checker verifies repository-local Markdown/HTML targets and heading anchors.

## Validation

Final regression discovery completed **53 tests, no failures and no skips**, including the two new transport checks and all eight Docker-dependent checks. The frontend TypeScript/production build passed. The 151 repository-local documentation links/assets/headings passed the checker. Six capsule inventories/sizes/hashes passed their manifest checker. Compiled UI, OpenAPI, project/provider APIs and the saved seven-case repair report remained readable. An existing non-failing SQLite cleanup ResourceWarning remains.

The initial relocated discovery had collected 51 tests but skipped eight Docker checks because the engine was stopped. That initial run was not used as container execution acceptance.

The next full container run completed all 51 checks but exposed an asynchronous reader exception during a timeout. The transport controller closed a buffered pipe while its reader thread was active. Stream closure was moved to its owning reader, incomplete-read errors now block success, and two real child-process regressions cover timeout cleanup and nonzero native output. This is the only application runtime fix in the cleanup.

Evidence newline handling is explicit: all six capsules match their original committed Git blobs, and LF checkout rules keep exact-byte manifest checks portable across Windows/Linux. This avoids hashing an incidental Windows CRLF conversion instead of the versioned capsule.

Docker Desktop initially failed to initialize its dockerInference IPC endpoint. With Desktop stopped, the runtime IPC directory was preserved under a backup name, allowing Desktop to recreate it. The engine subsequently responded and the bootstrap image identity matched its original hash. No factory reset, VM/image/volume deletion or WSL unregister was performed. This is an observed local recovery, not a claim that the underlying Windows/Docker failure cannot recur. A related failure class is documented in [Docker's issue tracker](https://github.com/docker/desktop-feedback/issues/554).

## Governance

No project-wide license was selected or grant inferred; third-party asset licensing is preserved. No release or tag was published merely to mark repository cleanup. The contribution guide defines the owner decisions and meaningful release evidence required.
