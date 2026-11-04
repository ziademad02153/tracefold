"""First runtime provider: approved pip environments and existing pytest suites."""
import base64
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tempfile
import tomllib
from uuid import uuid4
from time import monotonic

from packaging.requirements import Requirement, InvalidRequirement
from pydantic import BaseModel, ConfigDict, Field

from execution_core.contracts import ProviderError, identity
from .docker_worker import command, remove, run_args

BOOTSTRAP = 'tracefold-pytest:1'


def relative(value, allow_dot=True):
    if value == '.' and allow_dot:
        return value
    if not value or PurePosixPath(value).is_absolute() or any(p in ('','.','..') or '\\' in p or ':' in p or p.endswith((' ','.')) for p in value.split('/')):
        raise ProviderError('Use a repository-relative path without parent traversal.')
    return value


class Config(BaseModel):
    model_config=ConfigDict(extra='forbid', strict=True)
    component_root: str = '.'
    runtime: str = '3.11'
    install_project: bool = True
    requirements_files: list[str] = Field(default_factory=list, max_length=10)
    packages: list[str] = Field(default_factory=lambda:['pytest==8.3.5'], max_length=100)
    extras: list[str] = Field(default_factory=list, max_length=10)
    plugins: list[str] = Field(default_factory=list, max_length=20)
    pytest_args: list[str] = Field(default_factory=lambda:['-q'], max_length=40)
    pythonpath: list[str] = Field(default_factory=list, max_length=10)


def requirement(value):
    if len(value)>500:
        raise ProviderError('Dependency specification is too long.')
    try:
        parsed=Requirement(value)
    except InvalidRequirement as failure:
        raise ProviderError('Unsupported dependency line: '+value) from failure
    if parsed.url:
        raise ProviderError('VCS, local paths and direct dependency URLs need a separate supported profile.')
    return str(parsed)


class PythonRepositoryProvider:
    id='python-pytest'
    version='1'
    capabilities=('repository-snapshot','prepare-environment','collect-existing','run-existing','native-evidence','generate-suites','run-approved-suites')

    def generation_context(self,snapshot,config,environment):
        from .python_generation import generation_context
        return generation_context(snapshot,config,environment)

    def generate_suite(self,snapshot,config,environment,request,key,policy):
        if environment.get('manifest',{}).get('suite_execution_version',0)<1:
            raise ProviderError('Rebuild the approved environment to enable pinned generated-suite execution.')
        from .python_generation import generate
        return generate(snapshot,config,environment,request,key,policy)

    def validate_suite(self,snapshot,config,proposal,key):
        from .python_generation import validate_proposal
        return validate_proposal(snapshot,config,proposal,key)

    def validate_suite_target(self,config,suite):
        if config['component_root']!=suite['metadata']['component_root']:
            raise ProviderError('Use the same component root when rerunning this approved suite.')

    def execute_suite(self,snapshot,config,environment,suite,policy):
        if (environment.get('source_hash')!=snapshot.content_hash or environment.get('profile_inputs_hash')!=identity(config)
                or environment.get('manifest',{}).get('suite_execution_version',0)<1):
            raise ProviderError('Prepare a compatible environment for this source/configuration and approved suites.')
        self.validate_suite_target(config,suite)
        verified=self.validate_suite(snapshot,config,{'files':suite['files'],'metadata':suite['metadata']},suite['id'])
        if verified['files']!=suite['files']:
            raise ProviderError('Approved file identity changed; execution was blocked.')
        name='tracefold-suite-'+uuid4().hex
        marker='TRACEFOLD-SUITE-'+uuid4().hex+':'
        with tempfile.TemporaryDirectory(prefix='tracefold-control-') as temporary:
            control=Path(temporary)
            (control/'config.json').write_text(json.dumps(config),encoding='utf-8')
            (control/'suite.json').write_text(json.dumps({'files':suite['files']}),encoding='utf-8')
            wrapper=(
                "import base64,json,pathlib,subprocess,sys\n"
                "python='/opt/tracefold/env/bin/python'\n"
                "def phase(label):\n"
                " path='/tmp/'+label+'.json'\n"
                " code=subprocess.run([python,'/opt/tracefold/executor.py',label,path]).returncode\n"
                " result=json.loads(pathlib.Path(path).read_text()) if pathlib.Path(path).is_file() else {'collected':[],'tests':[],'collection_errors':[{'detail':'No native evidence'}]}\n"
                " result['exit_code']=code\n"
                " return result\n"
                "bc=phase('collect-existing')\n"
                "baseline_empty=bc['exit_code']==5 and not bc.get('collection_errors')\n"
                "b=phase('run-existing') if bc['exit_code']==0 and bc.get('collected') else bc\n"
                "gc=phase('collect-generated')\n"
                "g=phase('run-generated') if gc['exit_code']==0 and gc.get('collected') else gc\n"
                "inventory_ok=(baseline_empty or bc.get('collected')==b.get('collected')) and gc.get('collected')==g.get('collected') and bool(g.get('collected'))\n"
                "errors=b.get('collection_errors',[])+g.get('collection_errors',[])\n"
                "if not inventory_ok: errors += [{'detail':'Phase inventories are incomplete or differ.'}]\n"
                "if not baseline_empty and bc['exit_code']!=0: errors += [{'detail':'Existing test collection could not complete.'}]\n"
                "if gc['exit_code']!=0: errors += [{'detail':'Generated test collection could not complete.'}]\n"
                "exit_code=2 if errors or b['exit_code'] not in (0,1,5) or g['exit_code'] not in (0,1) else 1 if b['exit_code']==1 or g['exit_code']==1 else 0\n"
                "tests=b.get('tests',[])+g.get('tests',[])\n"
                "statuses=['passed','failed','error','skipped','xfailed','xpassed','not_run']\n"
                "groups={label:{'total':sum(t.get('origin')==label for t in tests),**{status:sum(t.get('origin')==label and t['status']==status for t in tests) for status in statuses}} for label in ['existing','generated']}\n"
                "result={'exit_code':exit_code,'collected':b.get('collected',[])+g.get('collected',[]),'tests':tests,'collection_errors':errors,'collection_skips':b.get('collection_skips',[])+g.get('collection_skips',[]),'groups':groups,'baseline_empty':baseline_empty,'inventory_matches':inventory_ok,'effective_config':{'existing':b.get('effective_config'),'generated':g.get('effective_config')},'execution_mode':'separate existing and generated phases in the same pinned environment'}\n"
                "data=json.dumps(result).encode()\n"
                f"print('\\n{marker}'+base64.b64encode(data).decode() if len(data)<{policy.output_bytes//2} else '\\nEvidence exceeds artifact limit.',flush=True)\n")
            args=run_args(name)+['--user','65534:65534','--mount',f'type=bind,source={snapshot.path.resolve()},target=/source,readonly',
                '--mount',f'type=bind,source={control.resolve()},target=/control,readonly',environment['id'],'/opt/tracefold/env/bin/python','-c',wrapper]
            try:
                code,output=command(args,seconds=policy.run_seconds,limit=policy.output_bytes)
                log,separator,artifact=output.rpartition(marker)
                if not separator:
                    raise ProviderError('Combined suite evidence was not returned.\n'+output[-18000:])
                raw=base64.b64decode(artifact.strip(),validate=True)
                result=json.loads(raw)
                return {**result,'log':log[-40000:],'artifacts':[{'media_type':'application/json','name':'suite-native-evidence.json','sha256':hashlib.sha256(raw).hexdigest(),'content':raw.decode()}]}
            finally:
                remove('container',name)

    def discover(self,snapshot,component):
        root=snapshot.path/relative(component)
        if not root.is_dir():
            raise ProviderError('Component root was not found in this snapshot.')
        manifest={}
        if (root/'pyproject.toml').is_file():
            try:
                manifest=tomllib.loads((root/'pyproject.toml').read_text(encoding='utf-8'))
            except (ValueError,UnicodeError) as failure:
                raise ProviderError('pyproject.toml could not be parsed.') from failure
        names=[p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()]
        return {'component_root':component,'runtime_profiles':['3.11'],
                'project_name':manifest.get('project',{}).get('name'),
                'requires_python':manifest.get('project',{}).get('requires-python'),
                'installable':any((root/name).is_file() for name in ['pyproject.toml','setup.py','setup.cfg']),
                'layout':'src' if (root/'src').is_dir() else 'flat',
                'requirements_files':[name for name in names if ('requirement' in name.lower() and name.endswith(('.txt','.in')))],
                'configuration_files':[name for name in ['pytest.ini','.pytest.ini','pyproject.toml','setup.cfg','tox.ini','pytest.toml','.pytest.toml'] if (root/name).is_file()],
                'build_requires':manifest.get('build-system',{}).get('requires',[]),
                'optional_extras':list(manifest.get('project',{}).get('optional-dependencies',{})),
                'test_files':sum(name.endswith('.py') and (name.split('/')[-1].startswith('test_') or name.endswith('_test.py')) for name in names),
                'limits':['Python 3.11 / Linux only','Wheel-available registry dependencies; source dependency builds unsupported',
                          'No private registries, services, GPU, workspace installs or uv/Poetry lock adapter',
                          'Explicit pytest plugin selection; no automatic plugin loading']}

    def validate(self,snapshot,config):
        config={key:value for key,value in config.items() if key not in ('resolved_inputs','manifest_hashes')}
        try:
            parsed=Config.model_validate(config)
        except ValueError as failure:
            raise ProviderError('Invalid Python execution configuration: '+str(failure)) from failure
        config=parsed.model_dump()
        for key in ['packages','extras','plugins','pytest_args','pythonpath','requirements_files']:
            config[key]=[value.strip() for value in config[key] if value.strip()]
        if config['runtime']!='3.11':
            raise ProviderError('Only the Python 3.11 Linux profile is installed. No runtime substitution was made.')
        root=snapshot.path/relative(config['component_root'])
        if not root.is_dir():
            raise ProviderError('Component root does not exist.')
        for name in config['requirements_files']+config['pythonpath']:
            relative(name)
        if any(not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]*', p) for p in config['plugins']):
            raise ProviderError('Use importable pytest plugin names.')
        if any(not re.fullmatch(r'[A-Za-z0-9_-]+', extra) for extra in config['extras']):
            raise ProviderError('Invalid project extra name.')
        forbidden=('--collect-only','--co','--junit','--basetemp','--rootdir','--override-ini','-o','--confcutdir','--noconftest','-p','--pyargs')
        if any(len(arg)>500 or arg.startswith(forbidden) or '\x00' in arg for arg in config['pytest_args']):
            raise ProviderError('These pytest arguments alter collection, plugin or evidence policy. Use the explicit profile fields instead.')
        discovery=self.discover(snapshot,config['component_root'])
        if config['install_project'] and not discovery['installable']:
            raise ProviderError('This component is not installable. Select source-path mode explicitly and declare its import paths.')
        requirements=list(config['packages'])
        inputs={}
        for name in config['requirements_files']:
            path=root/name
            if not path.is_file() or path.stat().st_size>100000:
                raise ProviderError('Requirements file missing or too large: '+name)
            inputs[name]=hashlib.sha256(path.read_bytes()).hexdigest()
            for line in path.read_text(encoding='utf-8').splitlines():
                line=line.split(' #',1)[0].strip()
                if line and not line.startswith('#'):
                    requirements.append(requirement(line))
        manifest={}
        if (root/'pyproject.toml').is_file():
            manifest=tomllib.loads((root/'pyproject.toml').read_text(encoding='utf-8'))
            inputs['pyproject.toml']=hashlib.sha256((root/'pyproject.toml').read_bytes()).hexdigest()
        if config['install_project']:
            requirements += manifest.get('build-system',{}).get('requires',['setuptools','wheel'])
            requirements += manifest.get('project',{}).get('dependencies',[])
            optional=manifest.get('project',{}).get('optional-dependencies',{})
            for extra in config['extras']:
                if extra not in optional:
                    raise ProviderError('Extra is not statically declared in pyproject.toml: '+extra)
                requirements += optional[extra]
        requirements=sorted(set(requirement(value) for value in requirements))
        if not any(Requirement(value).name.lower()=='pytest' for value in requirements):
            raise ProviderError('Declare the intended pytest version in packages or an approved requirements file.')
        for name in config['pythonpath']:
            if not (root/name).is_dir():
                raise ProviderError('Import path does not exist: '+name)
        return {**config,'resolved_inputs':requirements,'manifest_hashes':inputs}

    def _base(self):
        code,output=command(['docker','image','inspect','--format','{{.Id}}',BOOTSTRAP],seconds=12)
        if code:
            raise ProviderError('Build the bootstrap runner first: docker build -t tracefold-pytest:1 runner')
        return output.strip()

    def prepare(self,snapshot,config,policy):
        deadline=monotonic()+policy.prepare_seconds
        def remaining(cap):
            budget=min(cap,deadline-monotonic())
            if budget<=0:
                raise ProviderError('Environment preparation exceeded its approved time limit.')
            return budget
        base=self._base()
        name='tracefold-prepare-'+uuid4().hex
        download='tracefold-download-'+uuid4().hex
        volume='tracefold-wheels-'+uuid4().hex
        log=[]
        code,output=command(['docker','volume','create',volume],seconds=15)
        if code:
            raise ProviderError('Could not create dependency staging volume.')
        try:
            # The networked downloader receives package names only, no repository, credentials or build scripts.
            downloader=("import pathlib,shutil,subprocess,sys\n"
                        "args=[sys.executable,'-m','pip','--isolated','download','--only-binary=:all:',"
                        "'--index-url','https://pypi.org/simple','--disable-pip-version-check','--no-cache-dir','--dest','/tmp/wheels']\n"
                        "result=subprocess.run(args+sys.argv[1:])\n"
                        "if result.returncode: sys.exit(result.returncode)\n"
                        "shutil.copytree('/tmp/wheels','/wheels',dirs_exist_ok=True)\n")
            args=run_args(download,network='bridge')+['--user','0:0','--mount',f'type=volume,source={volume},target=/wheels',base,
                'python','-c',downloader,*config['resolved_inputs']]
            code,output=command(args,seconds=remaining(180),limit=policy.output_bytes)
            log.append(output)
            if code:
                raise ProviderError('Dependency download failed; no source builds or fallback runtime were attempted.\n'+output[-18000:])
            with tempfile.TemporaryDirectory(prefix='tracefold-control-') as temporary:
                control=Path(temporary)
                (control/'config.json').write_text(json.dumps(config),encoding='utf-8')
                (control/'prepare.py').write_bytes(Path(__file__).with_name('container_prepare.py').read_bytes())
                (control/'executor.py').write_bytes(Path(__file__).with_name('repository_executor.py').read_bytes())
                marker='TRACEFOLD-PREPARE-'+uuid4().hex+':'
                args=run_args(name,readonly=False)+['--user','0:0','--mount',f'type=bind,source={snapshot.path.resolve()},target=/source,readonly',
                    '--mount',f'type=bind,source={control.resolve()},target=/control,readonly',
                    '--mount',f'type=volume,source={volume},target=/wheels,readonly',base,'python','/control/prepare.py',marker]
                code,output=command(args,seconds=remaining(policy.prepare_seconds),limit=policy.output_bytes)
                log.append(output)
                if code or marker not in output:
                    raise ProviderError('Offline project installation failed.\n'+output[-18000:])
                metadata=json.loads(output.rsplit(marker,1)[1].strip())
                code,image=command(['docker','commit','--change','USER 65534:65534',name],seconds=remaining(45))
                if code or not re.fullmatch(r'sha256:[0-9a-f]{64}',image.strip()):
                    raise ProviderError('Could not persist the prepared runner image.')
                return {'status':'ready','id':image.strip(),'target':'docker-linux','base_image':base,
                        'source_hash':snapshot.content_hash,'profile_inputs_hash':identity(config),
                        'manifest':metadata,'log':'\n'.join(log)[-30000:],
                        'dependency_mode':'registry wheels; resolved distribution versions and wheel hashes recorded'}
        finally:
            remove('container',download)
            remove('container',name)
            remove('volume',volume)

    def execute(self,snapshot,config,environment,policy):
        if environment.get('source_hash')!=snapshot.content_hash or environment.get('profile_inputs_hash')!=identity(config):
            raise ProviderError('Prepared environment does not match this source/configuration.')
        if not environment.get('manifest',{}).get('executor_sha256'):
            raise ProviderError('Rebuild this environment to pin the execution harness before running tests.')
        name='tracefold-repository-'+uuid4().hex
        marker='TRACEFOLD-RESULT-'+uuid4().hex+':'
        with tempfile.TemporaryDirectory(prefix='tracefold-control-') as temporary:
            control=Path(temporary)
            (control/'config.json').write_text(json.dumps(config),encoding='utf-8')
            wrapper=("import base64,json,pathlib,subprocess,sys\n"
                     "python='/opt/tracefold/env/bin/python'\n"
                     "c=subprocess.run([python,'/opt/tracefold/executor.py','collect','/tmp/collect.json'])\n"
                     "result=json.loads(pathlib.Path('/tmp/collect.json').read_text()) if pathlib.Path('/tmp/collect.json').is_file() else {}\n"
                     "inventory=result.get('collected',[])\n"
                     "if c.returncode==0 and inventory:\n"
                     " r=subprocess.run([python,'/opt/tracefold/executor.py','run','/tmp/run.json'])\n"
                     " result=json.loads(pathlib.Path('/tmp/run.json').read_text()) if pathlib.Path('/tmp/run.json').is_file() else {}\n"
                     " result['collection_inventory']=inventory\n"
                     " result['inventory_matches']=inventory==result.get('collected')\n"
                     "else:\n"
                     " result['inventory_matches']=False\n"
                     "data=json.dumps(result).encode()\n"
                     f"print('\\n{marker}'+base64.b64encode(data).decode() if len(data)<{policy.output_bytes//2} else '\\nEvidence exceeds artifact limit.',flush=True)\n")
            args=run_args(name)+['--user','65534:65534','--mount',f'type=bind,source={snapshot.path.resolve()},target=/source,readonly',
                '--mount',f'type=bind,source={control.resolve()},target=/control,readonly',environment['id'],
                '/opt/tracefold/env/bin/python','-c',wrapper]
            try:
                code,output=command(args,seconds=policy.run_seconds,limit=policy.output_bytes)
                log,separator,artifact=output.rpartition(marker)
                if not separator:
                    raise ProviderError('Native test evidence was not returned.\n'+output[-18000:])
                raw=base64.b64decode(artifact.strip(),validate=True)
                result=json.loads(raw)
                if result.get('inventory_matches') is not True:
                    result['collection_errors']=result.get('collection_errors',[])+[{'detail':'Collection and execution inventories differ, or collection did not complete.'}]
                return {**result,'log':log[-40000:],'artifacts':[{'media_type':'application/json','name':'native-test-evidence.json',
                        'sha256':hashlib.sha256(raw).hexdigest(),'content':raw.decode()}]}
            finally:
                remove('container',name)
