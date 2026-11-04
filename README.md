# Tracefold

Tracefold is an early engineering review workspace. It imports pull requests from public GitHub repositories and saves a snapshot of the diff and commit IDs for later review.

**Status: local prototype.** The public import uses GitHub data. The bundled demo uses sample check results. Local AI diff review uses gemma4:e4b through Ollama. Function testing supports standalone Python functions, Gemma-generated pytest tests, explicit approval, Docker execution and saved evidence. Live CI results, private repository access and team authentication are planned. Treat this build as a single-user local tool.

## Architecture

| Layer | Implementation |
|---|---|
| UI | React, TypeScript and Vite in src/ |
| API | FastAPI in app.py |
| Persistence | SQLAlchemy with SQLite by default. Optional PostgreSQL configuration in compose.yaml |
| GitHub | Public repository metadata and PR imports through the REST API |
| Reports | Persisted snapshots addressed by a generated report ID |

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

Open [Tracefold](http://127.0.0.1:5173/#connect). Paste a public GitHub repository URL, select a pull request and create a report. Refresh the report and reopen it from Saved reports. A repository with no PRs has no importable change in the current flow. Try demo provides a bundled PR.

## Build and verify

    npm.cmd run build

Restart FastAPI after building to serve the compiled frontend and API together at [port 8001](http://127.0.0.1:8001/). Vite on port 5173 proxies API requests to port 8001.

Smoke check the demo, then use a public repository with a PR. Verify the saved report shows the source, two commit IDs and the diff. Check that an invalid repository produces a readable error and a repository with zero PRs shows an empty state.

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

Select **Test a function** on a repository card. Choose a branch, file and function, describe expected behavior, generate a test and review it before approval. Run the saved test on the initial revision, then rerun it on your repair branch. Sessions and execution evidence are persisted. See [SPRINT1.md](SPRINT1.md) for scope, runner setup and real acceptance evidence.

    docker build -t tracefold-pytest:1 runner

No application data or credentials are mounted into test containers. Docker must be running. Tests that require external project packages or helper modules are outside this standalone-function workflow.


## Sprint 2 suites

New sessions generate 3–5 pytest tests for the selected standalone function. Review their scenarios and code, approve the entire suite, then select **Run all tests**. Each saved run shows per-test status, duration and evidence. Reuse the same saved suite on a repair branch. See [SPRINT2.md](SPRINT2.md) for the verified five-test acceptance result and current limitations.


## Product structure

Open a Project to see Overview, Tests and Results. Overview uses saved activity only. Tests creates or reopens suites, and Results opens execution evidence. Advisory PR code review is an additional tool inside the project. See [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md) for the sitemap, architecture and proposed File Testing milestone.
