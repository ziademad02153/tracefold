# Tracefold

Tracefold is an early testing platform with Python as its first proven runtime. It prepares supported repository environments, runs existing tests and saves per-case evidence. Reviewed AI-generated Python file suites and advisory PR review remain separate tools.

**Status: single-user local pilot.** Repository execution supports an explicit Python 3.11/Linux/pip/pytest profile, real package installation, internal imports, selected dependency files/plugins and saved results. It does not require AI. The upstream itsdangerous 2.2.0 acceptance run passed 297 existing tests and matched a direct pytest reference. The user's company pilot remains pending. Private access, services/GPU/workspace adapters, other runtimes and shared deployment are not implemented. See [M2/M3 implementation and limits](M2_M3.md).

## Architecture

| Layer | Implementation |
|---|---|
| UI | React, TypeScript and Vite in src/ |
| API | FastAPI in app.py |
| Persistence | SQLAlchemy with SQLite by default. Optional PostgreSQL configuration in compose.yaml |
| GitHub | Public repository metadata and PR imports through the REST API |
| Reports | Persisted snapshots addressed by a generated report ID |
| Execution Core | Provider-neutral contracts, profiles, lifecycle and evidence in execution_core/ |
| First Provider | Python preparation and native pytest execution in providers/ |

## Start everything

After the initial dependency setup, run:

    npm start

This starts FastAPI and Vite, waits for the backend and opens the browser. Ctrl+C stops services started by this command. Existing Tracefold services are reused and remain owned by their original terminals. A different service occupying ports 8001 or 5173 produces an error with recovery instructions.

## Run locally on Windows

Requirements: Node.js 22, npm and Python 3.13. Run from the checkout directory.

Backend, in terminal one:

    python -m venv .venv
    .venv/Scripts/python.exe -m pip install -r requirements.txt
    .venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001

Frontend, in terminal two:

    npm.cmd ci
    npm.cmd run dev

Open [Tracefold](http://127.0.0.1:5173/#connect). Add a public GitHub repository, open its project and choose **Create test suite**. Select a revision and Python file, inspect it, select public functions and describe expected behavior. Review the generated suite, approve it and run it. Rerun the same approved suite on your repair revision. This testing workflow does not require a pull request. Advisory PR review is available separately inside the project.

## Build and verify

    npm.cmd run build

Restart FastAPI after building to serve the compiled frontend and API together at [port 8001](http://127.0.0.1:8001/). Vite on port 5173 proxies API requests to port 8001.

Verify the test workflow with a known defect and its repair, confirm the suite hash is unchanged and reopen saved evidence after refresh. Also check invalid repository input, unsupported file dependencies and the separate PR review empty state.

SQLite creates an ignored tracefold.db. For PostgreSQL, set POSTGRES_PASSWORD, run docker compose up -d, and set DATABASE_URL to a postgresql+psycopg URL before starting FastAPI. PostgreSQL and SQLite use separate stores. The PostgreSQL deployment path still needs integration testing.

## Engineering handoff

- [Current audit, roadmap and next-session checklist](ROADMAP.md)
- [Product requirements and acceptance criteria](PRODUCT.md)

## Local AI review

On a saved report, select **Review with AI**. The backend sends only the saved diff to the internal Ollama service and validates the JSON findings and visible new-side line locations before saving. Requests do not execute repository code. Refreshing a running report polls the persisted status. Interrupted reviews can be retried after 210 seconds.

The model is gemma4:e4b. Set OLLAMA_BASE_URL on the backend to override the internal service address. Requests require network access to the model server. Diff inputs are limited to 28,000 characters. Findings are advisory and may include false positives or miss bugs. A timeout or invalid model response is shown with a retry action. A failed retry preserves the previous completed result.

    .venv/Scripts/python.exe -m unittest test_ai_review -v

The local UI was exercised in a browser against octocat/Hello-World PR 37 and the bundled regression. Saved reviews survived refresh. The controls for repository connection, invalid input and report creation were exercised, and mobile overflow checked. Model testing covered one known bug and one valid function. This is a smoke evaluation, not a quality benchmark.

AI state uses an additive ai_reviews table, so existing reports remain readable. Multiple simultaneous review submissions for one report are rejected using a database claim. The synchronous model request is bounded by a 150-second network timeout. Production worker scheduling, schema migrations, authentication and PostgreSQL integration testing remain open.

## Verification record

See [AUDIT.md](AUDIT.md) for tested flows, fixes and the release decision. Run the automated adapter and persistence checks with:

    .venv/Scripts/python.exe -m unittest test_ai_review -v


## Function testing

The original standalone-function implementation is recorded in [SPRINT1.md](SPRINT1.md). New sessions use file context as described in [SPRINT3.md](SPRINT3.md); older approved sessions retain their original execution contract.

    docker build -t tracefold-pytest:1 runner

No application data or credentials are mounted into test containers. Docker must be running. Same-file helpers are supported in new sessions. Imports of other project files and external project packages remain outside M1.


## Sprint 2 suites

Sprint 2 established 3–5 pytest tests, whole-suite approval and per-test saved evidence. Those contracts continue in File Testing. See [SPRINT2.md](SPRINT2.md) for its historical acceptance record.


## Product structure

Open a Project to see Overview, Tests and Results. Overview uses saved activity only. Tests creates or reopens suites, and Results opens execution evidence. Advisory PR code review is an additional tool inside the project. See [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md) for the sitemap and architecture.

## Product direction and implementation gates

Current delivery: M2/M3 implemented and validated on the supported upstream profile; company-project acceptance awaits the real Python pilot and install/test commands. Review the working product and Architecture Review before authorizing M4 or other additions.

Architecture gate: separate Python Provider from Core Platform during M2/M3. At M3, review as-built dependencies, provider-neutral lifecycle/results/evidence, a non-Python contract-test fixture and legacy compatibility alongside the real Python pilot. Both functional and architectural acceptance must pass before the next scope decision. See the [architectural acceptance criteria](REPOSITORY_TESTING_ROADMAP.md#architectural-acceptance-core-platform-and-python-provider).

- [Python M1–M4 repository testing roadmap](REPOSITORY_TESTING_ROADMAP.md)
- [Language Expansion Roadmap: C#, Java, C/C++ and Embedded](LANGUAGE_EXPANSION_ROADMAP.md)
- [Sprint 3 File Testing scope and verification](SPRINT3.md)

Language expansion follows Python M4 and uses separately validated execution profiles. Reading a language is not equivalent to compiling and testing its projects.

## Run existing repository tests (M2/M3)

Open a project and choose **Run repository tests**. Inspect a revision/component, choose dependency files/packages and the install/test profile, save it for review, approve preparation and select **Run existing tests**. Re-run using the same saved environment. Source and profile identities are immutable; testing a new revision requires a new profile. Earlier runs keep their environment manifest if an environment is rebuilt.

For the real upstream acceptance example, add pallets/itsdangerous, choose tag 2.2.0 and root ., enable project installation, select requirements/tests.txt and requirements/build.txt, remove the default extra pytest pin, retain -q, save/approve/prepare and run. No local model is needed.

- [Implementation, reproducibility and release limits](M2_M3.md)
- [M3 Validation Report: current capabilities, AI role, evidence and pending company validation](M3_VALIDATION_REPORT.md)
- [As-built Architecture Review and findings](ARCHITECTURE_REVIEW_M3.md)
- [Saved upstream report](http://127.0.0.1:5173/#execution/b63e7e12cecf4b7f92527d20509a6669)

Snapshots are cached under ignored .tracefold/. Prepared environments are local Docker images; git clone does not include those images or the local SQLite reports. After installing updated backend requirements and building the bootstrap image, npm start launches the application as before.
