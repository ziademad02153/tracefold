import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from pathlib import Path
from time import time

from ai_review import review_diff
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import JSON, Column, MetaData, String, Table, create_engine, select, update
from sqlalchemy.exc import IntegrityError

REPOSITORIES = {
    "tracefold-demo/retry-service": {
        "name": "tracefold-demo/retry-service",
        "description": "Python service with retry policy checks",
    },
}
PULL_REQUESTS = {
    "tracefold-demo/retry-service": [{
        "number": 14,
        "title": "Update retry limit",
        "base": "2b110be17c6400d8c46c52396a1c99b8e1381150",
        "head": "823a2c86efa2b76c87c3d12d1d674adbbfc61d8a",
        "diff": "--- a/retry.py\n+++ b/retry.py\n@@ -1,2 +1,2 @@\n def retry_limit(requested):\n-    return min(requested, 3)\n+    return max(requested, 3)",
        "checks": [
            {"version": "Baseline", "status": "Passed", "log": "test_caps_retries: expected 3, got 3"},
            {"version": "Proposed change", "status": "Failed", "log": "test_caps_retries: expected 3, got 5"},
        ],
    }],
}

root = Path(__file__).resolve().parent
engine = create_engine(os.getenv("DATABASE_URL") or f"sqlite:///{root / 'tracefold.db'}")
metadata = MetaData()
projects = Table("projects", metadata, Column("repo", String, primary_key=True))
reports = Table(
    "reports", metadata,
    Column("id", String, primary_key=True),
    Column("repo", String, nullable=False),
    Column("snapshot", JSON, nullable=False),
)
reviews = Table(
    "ai_reviews", metadata,
    Column("report_id", String, primary_key=True),
    Column("state", JSON, nullable=False),
    Column("token", String, nullable=False),
)
metadata.create_all(engine)

app = FastAPI(title="Tracefold")


class ConnectRepository(BaseModel):
    repo: str


class CreateReport(ConnectRepository):
    number: int


def connected(repo):
    with engine.connect() as connection:
        if connection.scalar(select(projects.c.repo).where(projects.c.repo == repo)) is None:
            raise HTTPException(404, "Connect this repository first.")


def github(path, accept="application/vnd.github+json"):
    request = Request("https://api.github.com/repos/" + path, headers={
        "Accept": accept, "User-Agent": "Tracefold",
    })
    try:
        with urlopen(request, timeout=12) as response:
            payload = response.read(4_000_001)
    except HTTPError as error:
        if error.code == 404:
            raise HTTPException(404, "GitHub resource not found. Private repositories require a GitHub App.")
        if error.code in (403, 429):
            raise HTTPException(503, "GitHub denied or rate-limited this request. Try again later.")
        raise HTTPException(502, "GitHub could not return this resource.")
    except (URLError, TimeoutError):
        raise HTTPException(502, "Could not reach GitHub.")
    if len(payload) > 4_000_000:
        raise HTTPException(413, "This GitHub response exceeds the preview size limit.")
    return json.loads(payload) if accept.endswith("+json") else payload.decode("utf-8", errors="replace")


def repository_name(value):
    value = value.strip().removeprefix("https://github.com/").rstrip("/").removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9-]+/[A-Za-z0-9_.-]+", value) or value.split("/")[1] in (".", ".."):
        raise HTTPException(422, "Enter a GitHub repository URL or owner/repository.")
    return value


def pull_summary(pull):
    return {"number": pull["number"], "title": pull["title"],
            "base": pull["base"]["sha"], "head": pull["head"]["sha"]}


@app.get("/api/repositories")
def repositories():
    return list(REPOSITORIES.values())


@app.get("/api/projects")
def list_projects():
    with engine.connect() as connection:
        return [REPOSITORIES.get(repo, {"name": repo, "description": "Public GitHub repository"})
                for repo in connection.scalars(select(projects.c.repo))]


@app.post("/api/projects")
def connect_repository(request: ConnectRepository):
    repo = repository_name(request.repo)
    if repo not in REPOSITORIES:
        repo = github(repo)["full_name"]
    try:
        with engine.begin() as connection:
            connection.execute(projects.insert().values(repo=repo))
    except IntegrityError:
        connected(repo)
    return REPOSITORIES.get(repo, {"name": repo, "description": "Public GitHub repository"})


@app.get("/api/pulls")
def list_pulls(repo: str):
    connected(repo)
    if repo not in PULL_REQUESTS:
        return [pull_summary(pull) for pull in github(repo + "/pulls?state=all&sort=updated&per_page=30")]
    return [{key: pull[key] for key in ("number", "title", "base", "head")}
            for pull in PULL_REQUESTS[repo]]


@app.get("/api/reports")
def list_reports(repo: str):
    connected(repo)
    with engine.connect() as connection:
        return [
            {"id": row.id, "number": row.snapshot["number"], "title": row.snapshot["title"]}
            for row in connection.execute(select(reports).where(reports.c.repo == repo))
        ]


@app.post("/api/reports", status_code=201)
def create_report(request: CreateReport):
    connected(request.repo)
    report_id = uuid4().hex
    if request.number < 1:
        raise HTTPException(422, "Enter a positive pull request number.")
    if request.repo in PULL_REQUESTS:
        pull = next((item for item in PULL_REQUESTS[request.repo] if item["number"] == request.number), None)
        if pull is None:
            raise HTTPException(404, "Pull request was not found.")
        snapshot = {**pull, "source": "GitHub demo fixture"}
    else:
        path = f"{request.repo}/pulls/{request.number}"
        summary = pull_summary(github(path))
        diff = github(path, "application/vnd.github.diff")
        if pull_summary(github(path)) != summary:
            raise HTTPException(409, "The pull request changed during import. Try again.")
        snapshot = {**summary, "diff": diff, "checks": [], "source": "GitHub public repository"}
    with engine.begin() as connection:
        connection.execute(reports.insert().values(id=report_id, repo=request.repo, snapshot=snapshot))
    return {"id": report_id, "repo": request.repo, **snapshot}


@app.get("/api/reports/{report_id}")
def get_report(report_id: str):
    with engine.connect() as connection:
        row = connection.execute(select(reports).where(reports.c.id == report_id)).first()
    if row is None:
        raise HTTPException(404, "Review report was not found.")
    with engine.connect() as connection:
        review = connection.scalar(select(reviews.c.state).where(reviews.c.report_id == report_id))
    if review and review["status"] == "running" and time() - review["started"] > 210:
        review = {**review, "status": "failed", "error": "Review was interrupted. Retry the review."}
    return {"id": row.id, "repo": row.repo, **row.snapshot, "ai_review": review}


@app.post("/api/reports/{report_id}/ai")
def review_report(report_id: str):
    report = get_report(report_id)
    if not report["diff"].strip() or len(report["diff"]) > 28000:
        raise HTTPException(422, "Choose a nonempty change under 28,000 characters for AI review.")
    started = time()
    running = {"status": "running", "started": started}
    with engine.begin() as connection:
        try:
            # A savepoint keeps PostgreSQL usable when a report was already reviewed.
            with connection.begin_nested():
                connection.execute(reviews.insert().values(report_id=report_id, state={"status": "new"}, token="initial"))
        except IntegrityError:
            pass
        row = connection.execute(select(reviews).where(reviews.c.report_id == report_id)).one()
        previous = row.state
        token = uuid4().hex
        if previous["status"] == "running" and started - previous["started"] <= 210:
            raise HTTPException(409, "A review is already running for this report.")
        changed = connection.execute(
            update(reviews).where(reviews.c.report_id == report_id, reviews.c.token == row.token)
            .values(state=running, token=token)
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "A review is already starting. Refresh the report.")
    try:
        result = review_diff(report["diff"])
        state = {"status": "completed", "started": started, "result": result}
    except ValueError as error:
        state = {"status": "failed", "started": started, "error": str(error)}
        if previous.get("result"):
            state["result"] = previous["result"]
    except Exception:
        state = {"status": "failed", "started": started, "error": "Review could not complete. Retry the review."}
        if previous.get("result"):
            state["result"] = previous["result"]
    with engine.begin() as connection:
        connection.execute(update(reviews).where(
            reviews.c.report_id == report_id, reviews.c.token == token
        ).values(state=state))
    return get_report(report_id)


if (root / "dist").is_dir():
    app.mount("/", StaticFiles(directory=root / "dist", html=True), name="frontend")
