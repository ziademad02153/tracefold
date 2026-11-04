"""Native container checks for generated overlays, evidence and failure handling."""
import hashlib
from pathlib import Path
import tempfile
import unittest

from execution_core.contracts import Snapshot,Policy,reconcile
from providers.python_repository import PythonRepositoryProvider
from test_runner import runner_status


@unittest.skipUnless(runner_status()['ready'],'Start Docker and build the bootstrap runner.')
class RepositorySuiteRunnerTests(unittest.TestCase):
    def test_overlay_uses_project_imports_fixtures_and_reports_incomplete_execution(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);(root/'src/pilot').mkdir(parents=True);(root/'tests').mkdir()
            (root/'src/pilot/__init__.py').write_text('',encoding='utf-8')
            module=root/'src/pilot/calc.py'
            module.write_text('def double(x): return x*2\n',encoding='utf-8')
            (root/'tests/conftest.py').write_text('import pytest\n@pytest.fixture\ndef amount(): return 4\n',encoding='utf-8')
            (root/'pytest.ini').write_text('[pytest]\ntestpaths=tests\n',encoding='utf-8')
            source=Snapshot('fixture/overlay','a'*40,root,hashlib.sha256(b'overlay').hexdigest(),4)
            provider=PythonRepositoryProvider()
            config=provider.validate(source,{'install_project':False,'pythonpath':['src']})
            environment=provider.prepare(source,config,Policy())
            code='from pilot.calc import double\ndef test_zero(): assert double(0)==0\ndef test_one(): assert double(1)==2\ndef test_fixture(amount): assert double(amount)==8\n'
            proposal=provider.validate_suite(source,config,{'files':[{'path':'tests/test_tracefold_overlay.py','content':code}],
                'metadata':{'test_directory':'tests','context':{'selected':[{'module':'pilot.calc'}]}}},'overlay')
            suite={'id':'overlay',**proposal}
            def run():return reconcile(provider.execute_suite(source,config,environment,suite,Policy()),Policy())
            first=run()
            self.assertEqual(first['status'],'passed');self.assertTrue(first['baseline_empty'])
            self.assertEqual(first['summary']['passed'],3)
            self.assertEqual(first['groups']['generated']['passed'],3)
            self.assertTrue(all(test['origin']=='generated' for test in first['tests']))
            self.assertFalse((root/'tests/test_tracefold_overlay.py').exists())
            module.write_text('def double(x): return x*3\n',encoding='utf-8')
            broken=run()
            self.assertEqual(broken['status'],'failed');self.assertEqual(broken['summary']['failed'],2)
            self.assertEqual(first['collected'],broken['collected'])
            (root/'tests/test_existing.py').write_text('def test_existing(): assert False\n',encoding='utf-8')
            existing_failure=run()
            self.assertEqual(existing_failure['groups']['existing']['failed'],1)
            self.assertEqual(existing_failure['status'],'failed')
            (root/'tests/test_existing.py').write_text('import nonexistent_tracefold_dependency\n',encoding='utf-8')
            collection_failure=run()
            self.assertEqual(collection_failure['status'],'blocked')
            self.assertTrue(collection_failure['collection_errors'])
            self.assertEqual(collection_failure['groups']['generated']['total'],3)
            (root/'tests/test_existing.py').unlink()
            (root/'tests/conftest.py').write_text('',encoding='utf-8')
            fixture_error=run()
            self.assertEqual(fixture_error['status'],'blocked')
            self.assertEqual(fixture_error['summary']['error'],1)
