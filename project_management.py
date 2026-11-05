"""Local-workspace deletion with reviewed inventory and mutation exclusion."""
from contextlib import contextmanager
from hashlib import sha256
from threading import Lock
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import MetaData, Table, select, delete


class WorkspaceWriteGate:
    """Single-process local application: deletion cannot race an active write."""
    def __init__(self):
        self.lock, self.writers, self.deleting = Lock(), 0, False

    @contextmanager
    def enter(self, exclusive=False):
        with self.lock:
            if self.deleting or (exclusive and self.writers):
                raise HTTPException(409, 'An operation is in progress. Wait for it to finish, then try again.')
            if exclusive:
                self.deleting = True
            else:
                self.writers += 1
        try:
            yield
        finally:
            with self.lock:
                if exclusive:
                    self.deleting = False
                else:
                    self.writers -= 1


class DeleteProject(BaseModel):
    confirmation: str
    inventory: str


class ProjectManagement:
    def __init__(self, engine):
        self.engine = engine
        metadata = MetaData()
        self.tables = {name: Table(name, metadata, autoload_with=engine) for name in (
            'projects', 'reports', 'ai_reviews', 'test_sessions', 'test_runs',
            'execution_profiles', 'execution_suites', 'execution_runs')}

    def inventory(self, connection, repo):
        t = self.tables
        if connection.scalar(select(t['projects'].c.repo).where(t['projects'].c.repo == repo)) is None:
            raise HTTPException(404, 'Project was not found. It may already have been deleted.')
        rows = {}
        for name in ('reports', 'test_sessions', 'execution_profiles', 'execution_suites'):
            rows[name] = connection.execute(select(t[name]).where(t[name].c.repo == repo)).mappings().all()
        ids = {name: [r['id'] for r in items] for name, items in rows.items()}
        for name, parent, key in [('ai_reviews', 'reports', 'report_id'), ('test_runs', 'test_sessions', 'session_id'), ('execution_runs', 'execution_profiles', 'profile_id')]:
            rows[name] = connection.execute(select(t[name]).where(t[name].c[key].in_(ids[parent]))).mappings().all()
        busy = any(r['state'] in ('running', 'preparing', 'generating') for name in ('test_sessions', 'execution_profiles') for r in rows[name])
        busy = busy or any(r['state'].get('status') == 'running' for r in rows['ai_reviews'])
        serial = {name: sorted((dict(r) for r in items), key=lambda r: str(r.get('id', r.get('report_id')))) for name, items in rows.items()}
        fingerprint = sha256(json.dumps(serial, sort_keys=True, default=str).encode()).hexdigest()
        return rows, {'repo': repo, 'inventory': fingerprint, 'busy': busy, 'counts': {name: len(items) for name, items in rows.items()}}

    def preview(self, repo):
        with self.engine.connect() as connection:
            return self.inventory(connection, repo)[1]

    def remove(self, repo, request):
        if request.confirmation != repo:
            raise HTTPException(422, 'Type the full repository name exactly to confirm deletion.')
        with self.engine.begin() as connection:
            rows, preview = self.inventory(connection, repo)
            if preview['busy']:
                raise HTTPException(409, 'This project has an unfinished operation. Resolve it before deleting the project.')
            if preview['inventory'] != request.inventory:
                raise HTTPException(409, 'Project activity changed. Reload the deletion summary before confirming.')
            for name in ('ai_reviews', 'test_runs', 'execution_runs', 'execution_suites', 'execution_profiles', 'test_sessions', 'reports'):
                key = 'report_id' if name == 'ai_reviews' else 'id'
                connection.execute(delete(self.tables[name]).where(self.tables[name].c[key].in_([r[key] for r in rows[name]])))
            connection.execute(delete(self.tables['projects']).where(self.tables['projects'].c.repo == repo))
        return {'deleted': repo, 'counts': preview['counts']}


def create_project_management_router(engine):
    manager = ProjectManagement(engine)
    router = APIRouter()

    @router.get('/api/projects/deletion-preview')
    def preview(repo: str):
        return manager.preview(repo)

    @router.delete('/api/projects')
    def remove(repo: str, request: DeleteProject):
        return manager.remove(repo, request)

    return router
