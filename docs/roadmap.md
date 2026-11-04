# Delivery roadmap

This is the sole active planning reference. Product terminology belongs to [Product](product/overview.md), implementation boundaries to [Architecture](architecture/overview.md), and measured outcomes to [Validation](validation/README.md). Earlier roadmaps are archived, not parallel plans.

## Established foundation

The supported Python profile implements project environment preparation, existing-test execution, bounded repository-context generation, exact-suite approval, saved native evidence and unchanged-suite repair replay. Core lifecycle and persistence are separated from the Python provider. Historical milestone names are retained only in the archive.

## Next gate: actual company repository

| Required input/check | Acceptance evidence |
|---|---|
| Repository access, immutable revision and component root | Identified source and supported profile; private access addressed explicitly if required |
| Reference installation/test commands, Python version and dependency inputs | Environment assessment, unsupported services/native/GPU needs recorded |
| Direct reference baseline | Stable native case IDs and observed outcomes; existing failures remain visible |
| Tracefold preparation/execution | Matching intended inventory/outcomes or explained differences |
| Generated additions | Human-reviewed assertions against known behaviors and clean controls |
| Repair replay | Same suite hash on repair, recorded environment differences, retained evidence after restart |

No company result is asserted. Review the pilot and as-built findings before deciding any extension. Do not add features merely to make the repository appear more complete.

## Shared-service operational gate

Before daily multi-user/private-company use, validate authenticated/authorized repository and resource access; durable queued/cancellable jobs; aggregate resource and preparation-disk quotas; secret isolation; migrations, backup/restore and PostgreSQL behavior; artifact retention, image/cache cleanup and monitoring. Internal hosting/TLS belongs to this gate. A changed bind address is not deployment acceptance.

## Language and target expansion

The proposed default sequence is below. It is not an implementation claim or dated commitment; real company demand can change the order by an explicit scope decision.

| Order | Provider/profile | Required technical scope |
|---|---|---|
| 1 | C# / .NET | Pinned SDK, SDK-style project references, approved NuGet restore, build, xUnit native outcomes and generated test project |
| 2 | Java | Pinned JDK, Maven wrapper/module/classpath/resources, JUnit/Surefire evidence; Gradle is a separate adapter |
| 3 | Host C / C++ | Compiler/ABI, headers/definitions/linkage and resources; CMake/CTest + GoogleTest for C++, separate Unity/Ceedling/CMock profile for C |
| 4 | Embedded simulation | Selected board/SDK/RTOS/toolchain, cross-build, firmware identity and a validated simulator/harness |
| 5 | Embedded hardware | Dedicated lab worker, device reservation, controlled flash/reset/run, target/firmware identities, diagnostics and recovery |

JavaScript/Web, API services and Mobile require separately scoped runtime, build and test environments. Browser/service integration, Android/iOS/device execution and cross-language integration are not inferred from language parsing. AI model evaluation requires explicit datasets, deterministic/stochastic semantics and accelerator profiles; Python unit testing alone does not establish it.

## Exit contract for every provider

1. Choose a real pilot with declared build/test commands and target versions.
2. Reproduce its existing baseline in isolation, retaining native identities and explaining differences.
3. Generate/review additions using actual imports/references and the declared framework; compile where required.
4. Demonstrate a known defect and unchanged-suite repair replay, with persisted evidence.
5. Verify missing dependencies/tools, build/collection failures, zero tests, timeout, skips and interruption.
6. Review contracts and publish explicit support boundaries before enabling the profile.

Host, simulator and hardware outcomes are distinct. Binary/large artifacts and new target semantics may require versioned contracts rather than reuse of today's text-evidence schema unchanged.

## Other product scope

Measured coverage/test-gap analysis, CI/PR automation, team integrations and notifications remain separate scope decisions after core acceptance. No coverage percentage, feature maturity score, release date or new runtime support is assumed by this document.
