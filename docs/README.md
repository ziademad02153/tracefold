# Engineering documentation

The root [README](../README.md) presents the product. This directory contains its engineering references. Each topic has one authoritative entry; archived records are historical evidence, not competing specifications.

| Topic | Authoritative reference | Owns |
|---|---|---|
| Product | [Product definition](product/overview.md) | Terminology, navigation, implemented support and acceptance boundary |
| Architecture | [Architecture](architecture/overview.md) | As-built boundaries, data flow, runtime design and open constraints |
| Delivery direction | [Roadmap](roadmap.md) | Company gate, operational gate and all language/target expansion |
| Verification | [Validation](validation/README.md) | Consolidated acceptance record, evidence classification and integrity manifest |
| Development | [Developer guide](development.md) | Setup, commands, test discovery and local operation |
| Contribution | [Contribution guide](../CONTRIBUTING.md) | Change boundaries, review expectations and licensing/release policy |

## Repository boundaries

- `src/`, `execution_core/`, `providers/`, `runner/` and the application modules contain implementation.
- `tests/` contains automated regressions. Root `test_runner.py` is a runtime module imported by the application, not a discovered test suite.
- `docs/assets/` contains README artwork and attributed technology icons.
- `docs/validation/evidence/` contains reviewed, static validation capsules. It is not a runtime storage directory.
- Runtime database/snapshots live outside source for new installations; this checkout uses E:\Tracefold-data. Legacy `.tracefold/` and root tracefold.db remain ignored/compatible until migration. Dependencies and build output are not application source. Prepared environments live in Docker.

## Historical records

[Archive](archive/README.md) preserves earlier plans, audits, sprint notes and milestone reports for provenance. Their headers mark them as historical. Use the references above for decisions and executable commands.

Documentation changes should update the topic owner rather than introduce another root specification or parallel roadmap.
