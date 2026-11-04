# M4 as-built architecture review

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

4 November 2026. Implementation self-review, not an independent audit. This extends [M3 review](m3-review.md) after the user's authorization of M4; it does not close the company acceptance or shared-deployment gate.

## Boundaries

```text
Project → Tests → Runs / saved evidence
        │
        ├── generic React execution + suite workflow
        │       └── injected provider configuration/generation option views
        └── execution_api → ExecutionService
                ├── source snapshots (injected)
                ├── profiles / suites / approval hashes / runs / comparison
                └── provider registry
                        └── PythonRepositoryProvider
                              ├── AST module/context discovery
                              ├── local Gemma generation + pytest draft validation
                              ├── isolated pip project preparation
                              └── pinned Docker native pytest executor

Legacy file/function suites and advisory PR review remain separate compatibility paths.
```

## Review results

| Concern | Result |
|---|---|
| Core tied to Python file paths, import syntax, pytest options or Docker images | No new concrete runtime imports; core dispatches opaque provider requests/configuration/environment IDs |
| Generation mandatory for every provider | No; optional SuiteProvider contract, gated capabilities |
| Provider-specific UI settings | Python test-directory form injected from src/providers; generic view receives opaque catalog/options |
| Approval and replay independent of revision | Suite definition has its own hash; new profile/revision reuses approved files instead of regenerating |
| Generic lifecycle/persistence proof | Non-Python contract fixture uses a .feature file, device identities and an emulator environment; edit/approval, failure→repair, SQL reopening and a single generator invocation tested |
| Native execution proof | Real upstream 300-case combined result; two-module educational installed package retains internal import and external dependency; seven-case repair replay |
| Existing test failures/empty baselines/errors | Existing/generated provenance preserved; no existing tests explicitly labeled; collection/missing-fixture/incomplete evidence cannot silently pass |
| Environment reproducibility | Image/executor pinned and per-run manifest retained; fresh repair environment changes disclosed; dependency resolution may still change when manifests are not locked |
| Legacy compatibility | Old paths/data retained; legacy generation is not silently relabeled as repository-context generation |

## Open findings

- Shared persistence uses bounded inline text evidence; large/binary artifacts need a contract/storage extension.
- Core comparisons use normalized outcomes plus provider-origin labels; future providers must supply stable case IDs and clear provenance semantics.
- The source connector is GitHub/public-only. Provider neutrality does not imply source-host or private-access support.
- Generic suite file contracts are text-based. Compilers, service orchestration, mobile devices and embedded hardware require separately validated capabilities, not just a renamed provider.
- Python generation has bounded one-hop context, not full dependency graph analysis or complete repository generation. Human oracle review is essential.
- Jobs remain synchronous in a local pilot. Durable queues/cancellation, cross-profile quotas, preparation disk limits, access controls and migrations remain release blockers for a shared service.
- A real company project has not been assessed. Open-source and seeded-fixture success cannot establish company readiness.

Decision: the new M4 path preserves the demonstrated core/provider separation within its current contract. This is evidence for extensibility, not a guarantee that every future runtime will require no contract evolution. Review the company pilot and these findings before authorizing further scope.
