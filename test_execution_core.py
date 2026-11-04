import ast
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from sqlalchemy import create_engine

from execution_core.contracts import Policy, ProviderError, Snapshot, reconcile
from execution_core.service import ExecutionService
from snapshot_store import extract_snapshot
from snapshot_store import GithubSnapshots
from unittest.mock import patch
from providers.python_repository import PythonRepositoryProvider


class ContractProvider:
    id='contract-device'
    version='1'
    capabilities=('prepare-environment','collect-existing','run-existing')

    def discover(self,snapshot,component):
        return {'component':component}
    def validate(self,snapshot,config):
        return {'device_suite':config['device_suite']}
    def prepare(self,snapshot,config,policy):
        return {'status':'ready','id':'emulator-state:42','target':'contract-test-device'}
    def execute(self,snapshot,config,environment,policy):
        return {'exit_code':0,'collected':['screen://submit[locale=ar]'],
                'tests':[{'id':'screen://submit[locale=ar]','status':'passed','detail':'Contract fixture only'}],
                'artifacts':[{'name':'device-trace','media_type':'text/plain','content':'fixture evidence'}]}


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.engine=create_engine('sqlite:///'+str(Path(self.temporary.name)/'store.db'))
        self.source=Snapshot('owner/repo','a'*40,Path(self.temporary.name),'hash',1)
        self.provider=ContractProvider()
        self.service=ExecutionService(self.engine,{self.provider.id:self.provider},lambda repo,ref:self.source)

    def tearDown(self):
        self.engine.dispose()
        self.temporary.cleanup()

    def create(self):
        return self.service.create('owner/repo','main',self.provider.id,{'device_suite':'submit'})

    def test_non_python_lifecycle_and_evidence_survive_reopening(self):
        profile=self.create()
        prepared=self.service.prepare(profile['id'],profile['profile_hash'])
        self.assertEqual(prepared['environment']['id'],'emulator-state:42')
        result=self.service.run(profile['id'],profile['profile_hash'])
        reopened=ExecutionService(self.engine,{self.provider.id:self.provider},lambda repo,ref:self.source).get(profile['id'])
        self.assertEqual(reopened['runs'],result['runs'])
        self.assertEqual(result['runs'][0]['status'],'passed')
        self.assertEqual(result['runs'][0]['tests'][0]['id'],'screen://submit[locale=ar]')
        self.assertEqual(result['runs'][0]['artifacts'][0]['media_type'],'text/plain')
        self.assertNotIn('function',profile)
        self.assertNotIn('pytest',profile['config'])

    def test_approval_preparation_and_provider_are_required(self):
        profile=self.create()
        with self.assertRaises(ProviderError):
            self.service.run(profile['id'],profile['profile_hash'])
        with self.assertRaises(ProviderError):
            self.service.prepare(profile['id'],'incorrect-hash')
        with self.assertRaises(ProviderError):
            self.service.create('owner/repo','main','unavailable',{})

    def test_unsupported_capability_is_rejected_before_execution(self):
        profile=self.create()
        self.service.prepare(profile['id'],profile['profile_hash'])
        self.provider.capabilities=('prepare-environment',)
        with self.assertRaises(ProviderError):
            self.service.run(profile['id'],profile['profile_hash'])
        self.assertEqual(self.service.get(profile['id'])['state'],'ready')

    def test_same_profile_cannot_be_claimed_twice(self):
        profile=self.create()
        self.service._claim(profile['id'],profile['profile_hash'],'preparing')
        with self.assertRaises(ProviderError):
            self.service.prepare(profile['id'],profile['profile_hash'])

    def test_environment_preparation_failure_remains_visible(self):
        profile=self.create()
        def fail(*args):
            raise ProviderError('Missing supported SDK')
        self.provider.prepare=fail
        result=self.service.prepare(profile['id'],profile['profile_hash'])
        self.assertEqual(result['state'],'blocked')
        self.assertIn('SDK',result['error'])

    def test_missing_duplicate_unknown_and_zero_evidence_cannot_pass(self):
        cases=[
            {'exit_code':0,'collected':[],'tests':[]},
            {'exit_code':0,'collected':['a'],'tests':[]},
            {'exit_code':0,'collected':['a'],'tests':[{'id':'a','status':'passed'},{'id':'a','status':'passed'}]},
            {'exit_code':0,'collected':['a'],'tests':[{'id':'a','status':'invented'}]},
        ]
        for result in cases:
            with self.subTest(result=result):
                self.assertEqual(reconcile(result,Policy())['status'],'blocked')
        for status in ['skipped','xfailed','xpassed']:
            result=reconcile({'exit_code':0,'collected':['a'],'tests':[{'id':'a','status':status}]},Policy())
            self.assertEqual(result['status'],'completed_with_exceptions')

    def test_invalid_artifact_checksum_and_unserializable_results_are_blocked(self):
        result=self.provider.execute(None,None,None,None)
        result['artifacts'][0]['sha256']='incorrect'
        with self.assertRaises(ProviderError):
            reconcile(result,Policy())
        with self.assertRaises(ProviderError):
            reconcile({'collected':{'not-a-json-array'}},Policy())

    def test_core_and_http_adapter_do_not_import_runtime_implementations(self):
        forbidden={'providers','test_runner','workbench','pytest','symtable','ai_review'}
        for path in [*Path('execution_core').glob('*.py'),Path('execution_api.py')]:
            tree=ast.parse(path.read_text())
            for node in ast.walk(tree):
                names=[a.name for a in node.names] if isinstance(node,ast.Import) else [node.module or ''] if isinstance(node,ast.ImportFrom) else []
                self.assertFalse(any(name.split('.')[0] in forbidden for name in names),str(path))


class SnapshotTests(unittest.TestCase):
    def archive(self,names):
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,'w') as archive:
            for name,content in names:
                archive.writestr(name,content)
        return buffer.getvalue()

    def test_snapshot_preserves_internal_packages_and_resources(self):
        data=self.archive([('root/src/pkg/__init__.py',''),('root/src/pkg/data.txt','fixture'),('root/tests/conftest.py','x=1')])
        with tempfile.TemporaryDirectory() as temporary:
            hash_value,count=extract_snapshot(data,Path(temporary))
            self.assertEqual(count,3)
            self.assertEqual((Path(temporary)/'src/pkg/data.txt').read_text(),'fixture')
            self.assertEqual(len(hash_value),64)

    def test_archive_escape_and_case_collisions_are_rejected(self):
        for names in [[('root/../outside','bad')],[('root/A.py','a'),('root/a.py','b')],[('root/CON.txt','bad')]]:
            with tempfile.TemporaryDirectory() as temporary,self.assertRaises(ProviderError):
                extract_snapshot(self.archive(names),Path(temporary))

    def test_cached_snapshot_tampering_is_detected(self):
        with tempfile.TemporaryDirectory() as temporary:
            store=GithubSnapshots(temporary,lambda path:{'sha':'a'*40},lambda repo:None)
            with patch('snapshot_store.urlopen',return_value=io.BytesIO(self.archive([('root/src/a.py','x=1')]))):
                snapshot=store('owner/repo','main')
            (snapshot.path/'src/a.py').write_text('x=2')
            with self.assertRaises(ProviderError):
                store('owner/repo','main')


class PythonProfileTests(unittest.TestCase):
    def test_profile_preserves_project_configuration_and_rejects_direct_urls(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            (root/'pyproject.toml').write_text('[project]\nname="pilot"\nversion="1"\ndependencies=["packaging==24.0"]\n[build-system]\nrequires=["setuptools==75.1.0"]\n')
            (root/'tests.txt').write_text('pytest==8.3.5\n# comment\n')
            source=Snapshot('owner/repo','a'*40,root,'hash',2)
            provider=PythonRepositoryProvider()
            config=provider.validate(source,{'requirements_files':['tests.txt'],'packages':[]})
            self.assertIn('packaging==24.0',config['resolved_inputs'])
            self.assertIn('pytest==8.3.5',config['resolved_inputs'])
            self.assertIn('tests.txt',config['manifest_hashes'])
            for config in [{'packages':['pytest @ https://example.com/archive.whl']},{'component_root':'../outside'},{'runtime':'3.8'},{'pytest_args':['--collect-only']}]:
                with self.subTest(config=config),self.assertRaises(ProviderError):
                    provider.validate(source,config)


if __name__=='__main__':
    unittest.main()
