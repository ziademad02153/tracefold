# Tracefold

Tracefold is an early engineering review workspace. It imports pull requests from public GitHub repositories and saves a snapshot of the diff and commit IDs for later review.

**Status: local prototype.** The public import uses GitHub data. The bundled demo uses sample check results. Live CI results, private repository access, team authentication and local AI review are planned. Treat this build as a single-user local tool.

## Architecture

| Layer | Implementation |
|---|---|
| UI | React, TypeScript and Vite in src/ |
| API | FastAPI in app.py |
| Persistence | SQLAlchemy with SQLite by default. Optional PostgreSQL configuration in compose.yaml |
| GitHub | Public repository metadata and PR imports through the REST API |
| Reports | Persisted snapshots addressed by a generated report ID |

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
