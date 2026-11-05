import unittest
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from fastapi import HTTPException
from sqlalchemy import Column, JSON, MetaData, String, Table, create_engine, select, update, event

from project_management import DeleteProject, ProjectManagement, WorkspaceWriteGate


class ProjectManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        m = MetaData()
        Table('projects', m, Column('repo', String, primary_key=True))
        for name in ('reports', 'test_sessions', 'execution_profiles', 'execution_suites'):
            Table(name, m, Column('id', String, primary_key=True), Column('repo', String), Column('state', String), Column('payload', JSON))
        for name, parent in [('test_runs', 'session_id'), ('execution_runs', 'profile_id')]:
            Table(name, m, Column('id', String, primary_key=True), Column(parent, String), Column('payload', JSON))
        Table('ai_reviews', m, Column('report_id', String, primary_key=True), Column('state', JSON))
        m.create_all(self.engine)
        self.tables = m.tables
        with self.engine.begin() as c:
            for repo in ('owner/remove', 'owner/keep'):
                c.execute(self.tables['projects'].insert().values(repo=repo))
                for name in ('reports', 'test_sessions', 'execution_profiles', 'execution_suites'):
                    c.execute(self.tables[name].insert().values(id=repo+name, repo=repo, state='ready', payload={'source': 'unchanged'}))
                c.execute(self.tables['test_runs'].insert().values(id=repo+'test', session_id=repo+'test_sessions', payload={}))
                c.execute(self.tables['execution_runs'].insert().values(id=repo+'run', profile_id=repo+'execution_profiles', payload={}))
                c.execute(self.tables['ai_reviews'].insert().values(report_id=repo+'reports', state={'status': 'completed'}))
        self.manager = ProjectManagement(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def request(self):
        return DeleteProject(confirmation='owner/remove', inventory=self.manager.preview('owner/remove')['inventory'])

    def test_cascade_removes_only_selected_project_and_reconnect_starts_empty(self):
        before = self.manager.preview('owner/keep')
        result = self.manager.remove('owner/remove', self.request())
        self.assertEqual(result['counts']['execution_runs'], 1)
        self.assertEqual(self.manager.preview('owner/keep'), before)
        with self.assertRaises(HTTPException) as failure:
            self.manager.preview('owner/remove')
        self.assertEqual(failure.exception.status_code, 404)
        with self.engine.begin() as c:
            c.execute(self.tables['projects'].insert().values(repo='owner/remove'))
        self.assertTrue(all(v == 0 for v in self.manager.preview('owner/remove')['counts'].values()))

    def test_wrong_confirmation_and_changed_inventory_preserve_data(self):
        request = self.request()
        with self.assertRaises(HTTPException):
            self.manager.remove('owner/remove', DeleteProject(confirmation='wrong', inventory=request.inventory))
        with self.engine.begin() as c:
            c.execute(update(self.tables['execution_suites']).where(self.tables['execution_suites'].c.repo == 'owner/remove').values(payload={'edited': True}))
        with self.assertRaises(HTTPException) as failure:
            self.manager.remove('owner/remove', request)
        self.assertEqual(failure.exception.status_code, 409)
        self.assertEqual(self.manager.preview('owner/remove')['counts']['execution_runs'], 1)

    def test_unfinished_operations_block_deletion(self):
        for name in ('execution_profiles', 'test_sessions'):
            with self.engine.begin() as c:
                c.execute(update(self.tables[name]).where(self.tables[name].c.repo == 'owner/remove').values(state='running'))
            self.assertTrue(self.manager.preview('owner/remove')['busy'])
            with self.assertRaises(HTTPException):
                self.manager.remove('owner/remove', self.request())
            with self.engine.begin() as c:
                c.execute(update(self.tables[name]).where(self.tables[name].c.repo == 'owner/remove').values(state='ready'))
        with self.engine.begin() as c:
            c.execute(update(self.tables['ai_reviews']).where(self.tables['ai_reviews'].c.report_id == 'owner/removereports').values(state={'status': 'running'}))
        self.assertTrue(self.manager.preview('owner/remove')['busy'])

    def test_delete_transaction_rolls_back_on_failure(self):
        before = self.manager.preview('owner/remove')
        def fail(connection, cursor, statement, parameters, context, executemany):
            if statement.startswith('DELETE FROM execution_profiles'):
                raise RuntimeError('Injected storage failure')
        event.listen(self.engine, 'before_cursor_execute', fail)
        try:
            with self.assertRaises(RuntimeError):
                self.manager.remove('owner/remove', self.request())
        finally:
            event.remove(self.engine, 'before_cursor_execute', fail)
        self.assertEqual(self.manager.preview('owner/remove'), before)

    def test_write_gate_rejects_delete_during_write_and_write_during_delete(self):
        gate = WorkspaceWriteGate()
        with gate.enter():
            with self.assertRaises(HTTPException):
                with gate.enter(exclusive=True):
                    self.fail('Deletion raced a write')
        with gate.enter(exclusive=True):
            with self.assertRaises(HTTPException):
                with gate.enter():
                    self.fail('A write raced deletion')
        with self.assertRaises(ValueError):
            with gate.enter(exclusive=True):
                raise ValueError('Release lock on failure')
        with gate.enter():
            pass


class ProjectManagementHTTPTests(unittest.TestCase):
    def test_real_application_preview_confirm_delete_and_duplicate_connect(self):
        # Separate database/process: no deletion of developer or user projects.
        with tempfile.TemporaryDirectory() as folder:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            environment = {**os.environ, 'TRACEFOLD_DATA_DIR': folder,
                           'DATABASE_URL': 'sqlite:///'+str(Path(folder)/'acceptance.db')}
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', str(port)],
                                       cwd=Path(__file__).resolve().parents[1], env=environment,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            base = 'http://127.0.0.1:'+str(port)
            def request(path, body=None, method=None):
                req = Request(base+path, data=json.dumps(body).encode() if body is not None else None,
                              headers={'Content-Type': 'application/json'}, method=method)
                with urlopen(req, timeout=5) as response:
                    return json.load(response)
            try:
                for attempt in range(60):
                    try:
                        request('/api/projects')
                        break
                    except URLError:
                        if process.poll() is not None:
                            self.fail('Isolated application failed to start')
                        time.sleep(.1)
                else:
                    self.fail('Isolated application did not become ready')
                repo = 'tracefold-demo/retry-service'
                request('/api/projects', {'repo': repo})
                # Case-insensitive reconnect succeeds without a real GitHub call.
                self.assertEqual(request('/api/projects', {'repo': repo.upper()})['name'], repo)
                self.assertEqual(len(request('/api/projects')), 1)
                preview = request('/api/projects/deletion-preview?repo='+repo)
                with self.assertRaises(HTTPError) as failure:
                    request('/api/projects?repo='+repo, {'confirmation': 'wrong', 'inventory': preview['inventory']}, 'DELETE')
                self.assertEqual(failure.exception.code, 422)
                failure.exception.close()
                self.assertEqual(len(request('/api/projects')), 1)
                result = request('/api/projects?repo='+repo, {'confirmation': repo, 'inventory': preview['inventory']}, 'DELETE')
                self.assertEqual(result['deleted'], repo)
                self.assertEqual(request('/api/projects'), [])
                with self.assertRaises(HTTPError) as failure:
                    request('/api/projects/deletion-preview?repo='+repo)
                self.assertEqual(failure.exception.code, 404)
                failure.exception.close()
            finally:
                if os.name == 'nt':
                    # Windows venv launchers may have a child interpreter. Stop
                    # only this owned test process tree before releasing SQLite.
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                else:
                    process.terminate()
                process.wait(timeout=10)
