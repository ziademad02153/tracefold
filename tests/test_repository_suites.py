import hashlib
import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from execution_core.contracts import ProviderError,Snapshot,Policy
from execution_core.service import ExecutionService
from tests.test_execution_core import ContractProvider
from providers.python_generation import catalog,context_for,validate_proposal,generate


class SuiteContractProvider(ContractProvider):
    capabilities=(*ContractProvider.capabilities,'generate-suites','run-approved-suites')
    calls=0
    failing=True
    def generation_context(self,*args): return {'targets':[{'id':'screen','label':'screen'}]}
    def generate_suite(self,snapshot,config,environment,request,key,policy):
        self.calls+=1
        return {'files':[{'path':'checks/contract.feature','content':'Then the total is 80'}], 'metadata':{'title':'Contract-only suite'}}
    def validate_suite(self,snapshot,config,proposal,key):
        return proposal
    def validate_suite_target(self,config,suite): pass
    def execute_suite(self,snapshot,config,environment,suite,policy):
        status='failed' if self.failing else 'passed'
        return {'exit_code':1 if self.failing else 0,'collected':['existing://screen','generated://total'],
                'tests':[{'id':'existing://screen','status':'passed','origin':'existing'},
                         {'id':'generated://total','status':status,'origin':'generated'}]}


class SuiteCoreTests(unittest.TestCase):
    def setUp(self):
        from sqlalchemy import create_engine
        self.temp=tempfile.TemporaryDirectory()
        self.engine=create_engine('sqlite:///'+str(Path(self.temp.name)/'store.db'))
        self.source=Snapshot('owner/repo','a'*40,Path(self.temp.name),'hash',1)
        self.provider=SuiteContractProvider()
        self.service=ExecutionService(self.engine,{self.provider.id:self.provider},lambda repo,ref:self.source)
        self.profile=self.service.create('owner/repo','main',self.provider.id,{'device_suite':'screen'})
        self.service.prepare(self.profile['id'],self.profile['profile_hash'])

    def tearDown(self):
        self.engine.dispose();self.temp.cleanup()

    def draft(self):
        return self.service.generate_suite(self.profile['id'],self.profile['profile_hash'],{'selection':['screen'],'intent':'Expected total is 80'})

    def test_auto_pipeline_scans_generates_approves_and_executes(self):
        self.provider.failing = False
        result = self.service.auto_pipeline(self.profile['id'], self.profile['profile_hash'])
        self.assertEqual(len(result['runs']), 1)
        run = result['runs'][0]
        self.assertEqual(run['status'], 'passed')
        self.assertIsNotNone(run.get('suite_id'))
        self.assertTrue(any(t['origin'] == 'generated' for t in run['tests']))
        suites = self.service.list_suites('owner/repo')
        self.assertEqual(len(suites), 1)
        self.assertEqual(suites[0]['state'], 'approved')

    def test_generic_suite_review_edit_approval_and_fixed_version_replay(self):
        suite=self.draft()
        self.assertEqual(self.service.activity('owner/repo')[0]['suite_count'],1)
        for pair in [(suite['id'],None),(None,suite['suite_hash'])]:
            with self.assertRaises(ProviderError):self.service.run(self.profile['id'],self.profile['profile_hash'],*pair)
        with self.assertRaises(ProviderError):
            self.service.run(self.profile['id'],self.profile['profile_hash'],suite['id'],suite['suite_hash'])
        edited=self.service.revise_suite(suite['id'],suite['suite_hash'],[{'path':'checks/contract.feature','content':'Then the reviewed total is 80'}])
        self.assertNotEqual(edited['suite_hash'],suite['suite_hash'])
        with self.assertRaises(ProviderError): self.service.approve_suite(suite['id'],suite['suite_hash'])
        suite=self.service.approve_suite(suite['id'],edited['suite_hash'])
        with self.assertRaises(ProviderError): self.service.revise_suite(suite['id'],suite['suite_hash'],suite['files'])
        before=self.service.run(self.profile['id'],self.profile['profile_hash'],suite['id'],suite['suite_hash'])['runs'][-1]
        self.source=replace(self.source,revision='b'*40,content_hash='fixed-hash')
        fixed=self.service.create('owner/repo','fixed',self.provider.id,{'device_suite':'screen'})
        self.service.prepare(fixed['id'],fixed['profile_hash'])
        self.provider.failing=False
        after=self.service.run(fixed['id'],fixed['profile_hash'],suite['id'],suite['suite_hash'])['runs'][-1]
        self.assertEqual(before['status'],'failed');self.assertEqual(after['status'],'passed')
        self.assertEqual(after['suite_hash'],before['suite_hash'])
        self.assertTrue(after['comparison']['same_suite']);self.assertTrue(after['comparison']['source_changed'])
        self.assertEqual(after['comparison']['changes'],[{'id':'generated://total','before':'failed','after':'passed'}])
        self.assertEqual(self.provider.calls,1)
        reopened=ExecutionService(self.engine,{self.provider.id:self.provider},lambda repo,ref:self.source)
        self.assertEqual(reopened.get_suite(suite['id'])['files'],suite['files'])
        self.assertEqual(reopened.get(fixed['id'])['runs'][-1]['suite_hash'],suite['suite_hash'])

    def test_generation_failure_does_not_leave_profile_claimed(self):
        with patch.object(self.provider,'generate_suite',side_effect=ProviderError('Invalid model response')):
            with self.assertRaises(ProviderError): self.draft()
        self.assertEqual(self.service.get(self.profile['id'])['state'],'ready')


class RepositoryGenerationTests(unittest.TestCase):
    def test_context_retains_internal_imports_and_validates_real_module_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);(root/'src/app').mkdir(parents=True);(root/'tests').mkdir()
            (root/'src/app/pricing.py').write_text('from .rules import factor\ndef price(x): return x*factor()')
            (root/'src/app/rules.py').write_text('FACTOR=2\ndef factor(): return FACTOR')
            snapshot=Snapshot('owner/repo','a'*40,root,'hash',2)
            config={'component_root':'.'}
            directory,context=context_for(snapshot,config,{'selection':['src/app/pricing.py'],'intent':'Return twice the amount','options':{'test_directory':'tests'}})
            self.assertEqual({item['module'] for item in context['sources']},{'app.pricing','app.rules'})
            metadata={'context':context,'test_directory':directory}
            code='from app.pricing import price\ndef test_zero(): assert price(0)==0\ndef test_one(): assert price(1)==2\ndef test_two(): assert price(2)==4\n'
            proposal={'files':[{'path':'tests/test_tracefold_key.py','content':code}],'metadata':metadata}
            self.assertEqual(validate_proposal(snapshot,config,proposal,'key')['files'][0]['content'],code)
            for bad in [code.replace('from app.pricing','from target'),code.replace('test_two','test_one'),code.replace('assert price(2)==4','assert True')]:
                with self.assertRaises(ProviderError):
                    validate_proposal(snapshot,config,{**proposal,'files':[{'path':'tests/test_tracefold_key.py','content':bad}]},'key')
            (root/'tests/test_tracefold_key.py').write_text('existing user tests')
            with self.assertRaises(ProviderError): validate_proposal(snapshot,config,proposal,'key')

    def test_generate_retries_with_explicit_structural_feedback(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'src/app').mkdir(parents=True)
            (root / 'tests').mkdir()
            (root / 'src/app/pricing.py').write_text('def price(x): return x * 2\n')
            snapshot = Snapshot('owner/repo', 'a' * 40, root, 'hash', 1)
            config = {'component_root': '.'}
            env = {'manifest': {'packages': ['pytest'], 'python': '3.11', 'suite_execution_version': 1}}
            req = {'selection': ['src/app/pricing.py'], 'intent': 'Check price outputs 2, 4, and 6.', 'options': {'test_directory': 'tests'}}

            invalid_code = (
                "from app.pricing import price\n"
                "def test_price(): assert price(1) == 2\n"
                "def test_price(): assert price(2) == 4\n"
                "def test_price(): assert price(3) == 6\n"
            )
            invalid_plan = {
                "title": "Duplicate tests",
                "scenarios": [
                    {"name": "test_price", "description": "One"},
                    {"name": "test_price", "description": "Two"},
                    {"name": "test_price", "description": "Three"},
                ],
                "test_code": invalid_code,
            }
            valid_code = (
                "from app.pricing import price\n"
                "def test_price_one(): assert price(1) == 2\n"
                "def test_price_two(): assert price(2) == 4\n"
                "def test_price_three(): assert price(3) == 6\n"
            )
            valid_plan = {
                "title": "Unique tests",
                "scenarios": [
                    {"name": "test_price_one", "description": "One"},
                    {"name": "test_price_two", "description": "Two"},
                    {"name": "test_price_three", "description": "Three"},
                ],
                "test_code": valid_code,
            }

            calls = []
            class MockOpener:
                def open(self, request, timeout=None):
                    body = json.loads(request.data.decode())
                    calls.append(body)
                    plan_dict = invalid_plan if len(calls) == 1 else valid_plan
                    raw = json.dumps({"done": True, "done_reason": "stop", "message": {"content": json.dumps(plan_dict)}}).encode()
                    class Resp:
                        def read(self, limit): return raw[:limit]
                        def __enter__(self): return self
                        def __exit__(self, *args): pass
                    return Resp()

            with patch('providers.python_generation.build_opener', return_value=MockOpener()):
                proposal = generate(snapshot, config, env, req, 'k1', Policy())

            self.assertEqual(len(calls), 2)
            self.assertIn("Validation failed", calls[1]['messages'][-1]['content'])
            self.assertIn("Explicit structural requirements", calls[1]['messages'][-1]['content'])
            self.assertEqual(proposal['metadata']['attempts'], 2)
            self.assertEqual(proposal['files'][0]['content'], valid_code.rstrip() + '\n')

    def test_generate_fails_cleanly_after_retry_without_saving(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'src/app').mkdir(parents=True)
            (root / 'tests').mkdir()
            (root / 'src/app/pricing.py').write_text('def price(x): return x * 2\n')
            snapshot = Snapshot('owner/repo', 'a' * 40, root, 'hash', 1)
            config = {'component_root': '.'}
            env = {'manifest': {'packages': ['pytest'], 'python': '3.11', 'suite_execution_version': 1}}
            req = {'selection': ['src/app/pricing.py'], 'intent': 'Check price outputs 2, 4, and 6.', 'options': {'test_directory': 'tests'}}

            invalid_code = (
                "from app.pricing import price\n"
                "def test_price(): assert price(1) == 2\n"
                "def test_price(): assert price(2) == 4\n"
                "def test_price(): assert price(3) == 6\n"
            )
            invalid_plan = {
                "title": "Duplicate tests",
                "scenarios": [
                    {"name": "test_price", "description": "One"},
                    {"name": "test_price", "description": "Two"},
                    {"name": "test_price", "description": "Three"},
                ],
                "test_code": invalid_code,
            }

            calls = []
            class MockOpener:
                def open(self, request, timeout=None):
                    calls.append(request)
                    raw = json.dumps({"done": True, "done_reason": "stop", "message": {"content": json.dumps(invalid_plan)}}).encode()
                    class Resp:
                        def read(self, limit): return raw[:limit]
                        def __enter__(self): return self
                        def __exit__(self, *args): pass
                    return Resp()

            with patch('providers.python_generation.build_opener', return_value=MockOpener()):
                with self.assertRaises(ProviderError) as ctx:
                    generate(snapshot, config, env, req, 'k2', Policy())

            self.assertEqual(len(calls), 2)
            self.assertIn("failed structural validation after retry", str(ctx.exception))
            self.assertIn("No invalid suite was saved", str(ctx.exception))
            self.assertFalse((root / 'tests/test_tracefold_k2.py').exists())


if __name__=='__main__': unittest.main()
