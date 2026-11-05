# Developer guide

Engineering setup belongs here; the root README remains a product overview. Run commands from the repository root. The validated Windows application setup uses Node.js 22/npm and Python 3.13; repository workloads use their own Python 3.11/Linux provider.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd ci
docker build -t tracefold-pytest:1 runner
```

Docker Desktop must use Linux containers. GitHub/registry access supports acquisition/preparation; company Ollama access is needed for real generation, not existing-test execution.

## Run the application

```powershell
npm start
```

The launcher starts/reuses Tracefold API on 127.0.0.1:8001 and Vite on 127.0.0.1:5173, checks readiness and opens the workspace. Ctrl+C stops only processes it started. `npm run dev` starts the frontend alone.

After `npm run build`, restart FastAPI to serve the compiled interface at port 8001:

```powershell
.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

Do not start a second backend if an existing process owns that port. OpenAPI is available at http://127.0.0.1:8001/docs. Local binding is not a shared deployment configuration.

## Configuration

| Variable | Behavior |
|---|---|
| OLLAMA_BASE_URL | Company model base URL; default http://10.11.3.181:11434 |
| TRACEFOLD_TEST_MODEL | Repository generation model; default gemma4:e4b |
| DATABASE_URL | SQLAlchemy URL; defaults to root tracefold.db |
| POSTGRES_PASSWORD | Required by optional PostgreSQL Compose service |

The app reads process variables, not automatically loaded .env files. Earlier file/PR tools use their fixed gemma4:e4b constant. Switching database URLs does not migrate reports. Compose starts PostgreSQL only; PostgreSQL/migration acceptance is open.

## Verification

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -t . -v
npm run build
npm run test:ui
.venv\Scripts\python.exe scripts/check_documentation.py
.venv\Scripts\python.exe scripts/check_validation_evidence.py
git diff --check
```

`tests/` is a package; `-t .` keeps application imports and shared test helpers explicit. A focused example is `python -m unittest tests.test_execution_core -v` using the project virtual environment.

The browser regression suite requires the frontend/backend to be running. It uses controlled API fixtures and does not alter live projects or request model/container execution. It launches installed Microsoft Edge; set `TRACEFOLD_BROWSER_PATH` to another Chromium executable when needed. `TRACEFOLD_TEST_BASE_URL` overrides http://127.0.0.1:5173. Results remain ignored under `.tracefold/ui-regression/`. Real-model/container acceptance is recorded separately in the validation index.

Eight tests depend on Docker readiness. Start Docker and build the bootstrap before full execution acceptance; report skips explicitly. Container preparation requires registry access. The suite is not a real-model accuracy benchmark or company-project acceptance. An existing SQLite cleanup ResourceWarning is a known non-failing finding.

## Source and data boundaries

- Backend modules remain at their established paths to preserve application imports, startup and stored runtime locations.
- Root test_runner.py is a compatibility execution module, not a regression file. Do not move it based on filename alone.
- Test modules live under tests/. Shared helper imports use tests.test_execution_core.
- Runtime data remains ignored: tracefold.db, .tracefold/, .venv/, node_modules/, dist/ and Docker images.
- Static reviewed capsules live under docs/validation/evidence/ with an integrity manifest; never redirect runtime storage there.
- README artwork source is scripts/render_readme_assets.py; vendor icon licensing remains under docs/assets/icons/.

## Documentation changes

Update the authoritative topic in [the index](README.md). Historical archive commands describe their original layouts; do not copy them over this guide. Correct relative links when moving a document. Evidence JSON uses enforced LF endings for portable exact-byte hashes. Preserve versioned historical content unless a separately reviewed sanitization is necessary.
