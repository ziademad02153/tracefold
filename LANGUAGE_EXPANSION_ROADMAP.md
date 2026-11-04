# Language Expansion Roadmap

Status: approved product direction, 4 November 2026. Implementation through M4 remains Python only. This document does not claim that any additional language runner exists.

## Product destination

Tracefold is intended to serve Backend, AI and Embedded engineering teams through reproducible testing, reviewed AI-generated tests and saved execution evidence. Users connect a repository, select supported components and execution profiles, run existing tests, approve generated additions, and rerun the same additions against a repair revision.

“Any file containing code” is a product ambition, not an executable support contract. A source file needs its imports/includes, build configuration, dependencies and target runtime. Adding an extension to the file picker or asking the model to read a language does not establish testing support. Unsupported components remain visible with a precise explanation and never receive a passing verdict.

## Proposed order after Python M4

| Order | Release gate | Initial supported profile | Deferred extensions |
|---|---|---|---|
| 0 | Complete and validate Python M4 | Supported Python projects, pytest and reproducible project environments | Other Python test frameworks, GPU/model evaluation and service integration need explicit profiles |
| 1 | C# backend pilot | One supported .NET SDK/runtime on Linux, SDK-style projects, xUnit, recorded NuGet restore | NUnit/MSTest, Windows/.NET Framework, desktop/COM and Windows-only dependencies |
| 2 | Java backend pilot | One pinned JDK family, Maven wrapper, JUnit and Surefire unit tests | Gradle adapter, integration tests, application servers and other frameworks |
| 3 | Native C/C++ pilot | Host GCC/Clang, CMake/CTest with GoogleTest for C++; a separate C profile with Ceedling/Unity/CMock | Other build systems, proprietary compilers, Windows native environments and target architectures |
| 4 | Embedded simulation pilot | One selected board/SDK/toolchain and an agreed simulator, with board-independent host tests retained | Other boards, RTOS/SDK families and unsupported peripherals |
| 5 | Embedded hardware pilot | One approved board and lab fixture, controlled flash/run/reset and captured evidence | Additional boards, instruments, timing-sensitive validation and safety qualification |

This is the default sequence, not a dated commitment. After M4, inventory real company repositories and choose a pilot for each language. If Embedded demand is stronger, move the host C/C++ pilot ahead of C#/Java by an explicit priority decision. Do not implement all adapters at once. Complete the execution gate before AI generation for each profile.

## Shared architecture, language-specific adapters

Keep repository snapshots, approval, job lifecycle, suite identities, history, evidence storage and before/after comparison shared. Extract a runner adapter contract from the proven Python pipeline when adding the first new language; do not build an unused plugin framework during Sprint 3.

An adapter must implement discovery -> environment preparation -> build -> test collection -> execution -> evidence normalization, plus framework-specific generated-test validation. It declares language/runtime/platform versions, project roots, commands as argument arrays, lock/restore metadata, test framework, resource limits and required services/devices.

Every saved result records commit, generated suite hash, dependency/build manifest, runner image/OS/toolchain identity and native artifacts. Distinguish preparation errors, compile errors, failed assertions, skips, timeouts and missing evidence. Zero collected tests is not a passing test run. Preserve native identities, including namespaces, classes, overloads and parameterized cases; simple function names are insufficient.

Use isolated builds with controlled package access and execution with only the explicitly required access. Never expose application credentials or a Docker socket to repository build scripts. Windows and device jobs need dedicated constrained workers rather than an assumption that every workload fits a Linux container.

## C# implementation

- Discover solution/project files, project references, target frameworks, global.json, NuGet configuration and package lock data. Multi-target projects record each target separately.
- Restore approved dependencies, build the selected project/solution and run its existing xUnit tests first. Respect the selected SDK and test-platform mode; dotnet test and TRX configuration differ between VSTest and Microsoft.Testing.Platform.
- Generate tests in a separate test project with a real ProjectReference. Preserve namespace/type/method context; asynchronous methods and mocking require declared support, not string extraction.
- Normalize native test results and retain original TRX/logs. Validate generated tests compile, contain meaningful assertions and exercise the intended component before calling the generation step usable.
- Exit gate: a real multi-project C# pilot builds from a clean environment, its baseline agrees with the team's reference run, and an approved generated suite fails on a seeded defect and passes unchanged on its repair. Build failure is recorded separately.

## Java implementation

- Discover pom.xml, Maven wrapper, parent/module hierarchy, JDK/toolchain, repositories and test dependencies. Preserve package names, source sets, resources and inter-module classpaths.
- Start with existing JUnit tests through the project's Maven/Surefire configuration. Read native XML reports and record the actual collected/executed identities. JUnit major version and plugin compatibility are part of the profile.
- Generate additions in the correct test source tree/package, using the project's supported JUnit generation. Compile before execution. Mockito, Spring context, databases and integration-test lifecycles each require an explicit supported profile.
- Add Gradle later through its own wrapper/task/source-set adapter; Maven support does not imply Gradle support.
- Exit gate: a real multi-module Java pilot reproduces baseline outcomes and the same reviewed generated tests fail before, pass after a repair, with dependency/JDK/build evidence saved.

## C and C++ implementation

- Preserve headers, translation units, include directories, compiler definitions, language standard, libraries, linker settings and build presets. Record compiler/ABI/platform identity. A .c/.cpp file alone is usually insufficient.
- C++ first profile: CMake configure/build, CTest execution and GoogleTest case-level results. Reconcile CTest executable-level outcomes with framework-level cases rather than count an executable as an individual assertion case.
- C first profile: Ceedling with Unity tests and CMock where configured. This is a separate adapter/profile and acceptance gate, not automatic C coverage from a C++ runner.
- Generate reviewed test source and explicitly review any test harness/build changes. Mock hardware/OS boundaries only where the team defines the intended contract. Do not modify production code invisibly to make generated tests pass.
- Exit gate for each profile: clean native build, reference baseline parity, multi-file linkage, a seeded logic defect detected, unchanged suite passing after repair, and build/link failures reported separately. Sanitizers are a subsequent explicit capability, not assumed from a successful unit test run.

## Embedded is a target environment, not another language

### E1: Host tests

Test board-independent C/C++ logic on the host using approved HAL interfaces and mocks/stubs. Record clearly that a host test cannot establish real peripheral, interrupt or timing correctness. This capability begins with the native C/C++ gate above.

### E2: Cross-build and simulation

Select one real board/RTOS/SDK pilot. Reproduce cross-compiler, linker script, startup code, SDK and configuration. Record firmware hash and target identity. Build-only is distinct from executed tests. Add one supported simulator and test harness, with UART/assertion/log evidence. Zephyr/Twister is a candidate when the selected company project actually uses Zephyr; QEMU availability does not imply support for every board or peripheral.

### E3: Hardware-in-the-loop

Use a dedicated lab worker and an approved board fixture. Require exclusive device reservation, board/probe/firmware identities, controlled flashing/reset, serial collection, bounded execution and recovery. Only explicitly approved devices and operations are available to jobs. Device loss or flashing failure is infrastructure failure, not a product assertion failure. Begin with one bounded board test; adding boards and measurement instruments requires separate validation.

Exit gates are independent: a host pass, simulator pass and hardware pass must never be substituted for one another. Tracefold testing does not itself provide automotive, medical or functional-safety certification.

## Backend and AI teams

Backend support initially covers unit tests for the supported language profiles. HTTP integration tests, databases and brokers require declared services and fixtures. AI-team support begins with deterministic Python data-processing/inference-wrapper logic using controlled fixtures. Model accuracy evaluation, datasets, stochastic behavior, GPU/CUDA dependencies and performance budgets require later explicit test profiles. Python support alone must not be marketed as comprehensive AI-system validation.

## Mixed-language repositories and user experience

A repository contains components. Each component selects a supported language/build/target profile. A Python component and a C# component can produce separate runs, with an aggregate report showing component outcomes and unsupported areas. Cross-language integration tests need their own environment and contract; individual component passes do not establish integration success.

The user sees: detected components -> supported/unsupported profiles -> setup requirements -> existing baseline -> reviewed generated tests -> execution evidence -> repair comparison. Never hide an unsupported component or present a partial run as proof that the entire repository passed.

## Release gate for every new language/profile

1. Select a real company pilot and document its reference build/test commands and supported versions.
2. Reproduce existing tests from a clean environment and explain every collection/outcome difference.
3. Generate, review and compile valid tests for representative multi-file code; evaluate the local model on known defects and clean controls. Do not assume Python generation quality transfers to other languages.
4. Run approved tests before and after a repair, keeping their identity fixed; persist and reopen per-case native evidence.
5. Test dependency/build failure, missing tools, zero tests, timeout, skip and interruption paths.
6. Publish the supported profile and remaining limits before enabling it for users. Estimate implementation after the pilot discovery, not from language syntax alone.

No language expansion is authorized for implementation during Python M1-M4 by this document. Sprint 3 remains Python File Testing.

## Primary technical references

- [.NET test execution and platform compatibility](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test)
- [Maven Surefire execution and native reports](https://maven.apache.org/surefire/maven-surefire-plugin/)
- [Gradle Java testing](https://docs.gradle.org/current/userguide/java_testing.html)
- [CMake CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html)
- [GoogleTest primer](https://google.github.io/googletest/primer.html)
- [Ceedling, Unity and CMock](https://www.throwtheswitch.org/ceedling)
- [Zephyr Twister targets, simulation and device execution](https://docs.zephyrproject.org/latest/develop/twister/index.html)
