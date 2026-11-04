"""Real container regression: package install, plugin, config, fixtures and outcomes."""
import hashlib
import tempfile
import unittest
from pathlib import Path

from execution_core.contracts import Policy,ProviderError,Snapshot,reconcile
from providers.python_repository import PythonRepositoryProvider
from test_runner import runner_status


@unittest.skipUnless(runner_status()['ready'],'Start Docker and build the bootstrap runner.')
class RepositoryRunnerTests(unittest.TestCase):
    def test_real_package_plugin_parametrization_outcomes_and_timeout(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            (root/'src/pilot').mkdir(parents=True)
            (root/'tests').mkdir()
            (root/'pyproject.toml').write_text('''[build-system]
requires=["setuptools==75.1.0","wheel==0.44.0"]
build-backend="setuptools.build_meta"
[project]
name="tracefold-engine-pilot"
version="1.0.0"
dependencies=["packaging==24.0"]
[tool.setuptools.packages.find]
where=["src"]
[tool.setuptools.package-data]
pilot=["data.txt"]
[tool.pytest.ini_options]
testpaths=["tests"]
addopts="-ra"
''')
            (root/'src/pilot/__init__.py').write_text('from .calculation import double\n')
            (root/'src/pilot/calculation.py').write_text('from .helper import factor\ndef double(x): return x * factor()\n')
            (root/'src/pilot/helper.py').write_text('from pathlib import Path\nfrom packaging.version import Version\ndef factor():\n assert Version("2") > Version("1")\n return int(Path(__file__).with_name("data.txt").read_text())\n')
            (root/'src/pilot/data.txt').write_text('2')
            (root/'tests/conftest.py').write_text('import pytest\n@pytest.fixture\ndef amount(): return 5\n@pytest.fixture\ndef teardown_error():\n yield\n raise ValueError("known teardown failure")\n')
            (root/'tests/test_suite.py').write_text('''import time
import pytest
from pilot import double
@pytest.mark.parametrize("value",[1,2],ids=["one","two"])
def test_parameter(value): assert double(value)==value*2
def test_plugin(mocker,amount):
 mocker.patch("pilot.calculation.factor",return_value=3)
 assert double(amount)==15
@pytest.mark.skip(reason="known skip")
def test_skip(): pass
@pytest.mark.xfail(reason="known expected failure")
def test_xfail(): assert False
@pytest.mark.xfail(reason="known unexpected pass")
def test_xpass(): assert True
@pytest.mark.xfail(reason="strict unexpected pass",strict=True)
def test_strict_xpass(): assert True
def test_failure(): assert double(1)==3
def test_teardown(teardown_error): assert True
def test_slow(): time.sleep(3); assert True
''')
            source=Snapshot('fixture/package','f'*40,root,hashlib.sha256(b'fixture-v1').hexdigest(),8)
            provider=PythonRepositoryProvider()
            config=provider.validate(source,{'packages':['pytest==8.3.5','pytest-mock==3.14.0'],'plugins':['pytest_mock']})
            environment=provider.prepare(source,config,Policy())
            self.assertEqual(environment['status'],'ready')
            result=reconcile(provider.execute(source,config,environment,Policy()),Policy())
            self.assertEqual(result['summary']['total'],10)
            self.assertEqual(result['summary']['passed'],4)
            self.assertEqual(result['summary']['failed'],1)
            self.assertEqual(result['summary']['error'],1)
            self.assertEqual(result['summary']['skipped'],1)
            self.assertEqual(result['summary']['xfailed'],1)
            self.assertEqual(result['summary']['xpassed'],2)
            self.assertTrue(any('[one]' in test['id'] for test in result['tests']))
            self.assertTrue(result['effective_config']['config_file'].endswith('pyproject.toml'))
            self.assertIn('pytest_mock',result['effective_config']['plugins'])
            self.assertEqual(result['status'],'blocked')
            with self.assertRaises(ProviderError) as timeout:
                provider.execute(source,config,environment,Policy(run_seconds=1))
            self.assertIn('limit',str(timeout.exception))


if __name__=='__main__':
    unittest.main()
