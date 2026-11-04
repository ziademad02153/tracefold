"""Runs inside the prepared environment; records native pytest node IDs and phases."""
import json
import os
from pathlib import Path,PurePosixPath
import shutil
import sys

import pytest


class Evidence:
    def __init__(self):
        self.collected = []
        self.reports = {}
        self.errors = []
        self.skips = []
        self.config = {}

    def pytest_sessionstart(self, session):
        config = session.config
        self.config = {'rootdir':str(config.rootpath), 'config_file':str(config.inipath) if config.inipath else None,
                       'args':list(config.invocation_params.args), 'pytest':pytest.__version__,
                       'plugins':[name for name, plugin in config.pluginmanager.list_name_plugin() if plugin is not None]}

    def pytest_collection_finish(self, session):
        self.collected = [item.nodeid for item in session.items]

    def pytest_collectreport(self, report):
        if report.failed:
            self.errors.append({'id':report.nodeid, 'detail':str(report.longrepr)[:12000]})
        elif report.skipped:
            self.skips.append({'id':report.nodeid,'detail':str(report.longrepr)[:12000]})

    def pytest_runtest_logreport(self, report):
        self.reports.setdefault(report.nodeid, []).append({
            'when':report.when, 'outcome':report.outcome, 'wasxfail':getattr(report,'wasxfail',None),
            'detail':str(report.longrepr)[:12000] if report.longrepr else '', 'seconds':report.duration})

    def result(self, code):
        tests=[]
        for nodeid in self.collected:
            phases = self.reports.get(nodeid, [])
            status, detail = 'not_run', 'No completed test call was recorded.'
            for phase in phases:
                outcome, when = phase['outcome'], phase['when']
                if when != 'call' and outcome == 'failed':
                    status, detail = 'error', phase['detail']
                    break
                if when == 'call' and outcome == 'failed' and phase['detail'].startswith('[XPASS(strict)]'):
                    status, detail = 'xpassed', phase['detail']
                    continue
                if phase['wasxfail']:
                    status = 'xfailed' if outcome == 'skipped' else 'xpassed'
                    detail = phase['detail'] or phase['wasxfail']
                elif outcome == 'skipped':
                    status, detail = 'skipped', phase['detail']
                elif when == 'call':
                    status = 'failed' if outcome == 'failed' else 'passed'
                    detail = phase['detail'] or 'Assertions passed.'
            tests.append({'id':nodeid,'status':status,'detail':detail,'seconds':round(sum(p['seconds'] for p in phases),4),'native_phases':phases})
        return {'exit_code':int(code),'collected':self.collected,'tests':tests,'collection_errors':self.errors,
                'collection_skips':self.skips,'effective_config':self.config}


if __name__ == '__main__':
    mode, destination = sys.argv[1:3]
    config=json.loads(Path('/control/config.json').read_text())
    root=Path('/tmp')/mode/'project'
    shutil.copytree('/source',root)
    component=root/config['component_root']
    generated=mode.endswith('-generated')
    suite=json.loads(Path('/control/suite.json').read_text()) if generated else None
    if suite:
        for file in suite['files']:
            path=PurePosixPath(file['path'])
            if path.is_absolute() or any(part in ('','.','..') or '\\' in part or ':' in part for part in path.parts):
                raise ValueError('Invalid generated file path.')
            target=component.joinpath(*path.parts)
            if target.exists():
                raise ValueError('Generated overlay would overwrite a repository file.')
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(file['content'],encoding='utf-8')
    os.chdir(component)
    sys.path.insert(0,str(component))
    for relative in reversed(config['pythonpath']):
        sys.path.insert(0,str(component/relative))
    os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD']='1'
    evidence=Evidence()
    args=['-p','no:cacheprovider']
    for plugin in config['plugins']:
        args += ['-p',plugin]
    args += ['-q',*[file['path'] for file in suite['files']]] if generated else config['pytest_args']
    if mode.startswith('collect'):
        args += ['--collect-only','-q']
    code=pytest.main(args,plugins=[evidence])
    result=evidence.result(code)
    for test in result['tests']:
        test['origin']='generated' if generated else 'existing'
    result['phase']='generated' if generated else 'existing'
    Path(destination).write_text(json.dumps(result))
    sys.exit(int(code))
