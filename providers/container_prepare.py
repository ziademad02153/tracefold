"""Runs only inside the isolated offline preparation container."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import venv

config = json.loads(Path('/control/config.json').read_text())
shutil.copytree('/source', '/tmp/project')
component = Path('/tmp/project') / config['component_root']
venv.EnvBuilder(with_pip=True).create('/opt/tracefold/env')
python = '/opt/tracefold/env/bin/python'
common = [python, '-m', 'pip', '--isolated', 'install', '--no-index', '--find-links=/wheels', '--no-cache-dir']
subprocess.run(common + config['resolved_inputs'], check=True, cwd=component)
if config['install_project']:
    target = '.' + ('[' + ','.join(config['extras']) + ']' if config['extras'] else '')
    subprocess.run(common + ['--no-build-isolation', target], check=True, cwd=component)
subprocess.run([python, '-m', 'pip', 'check'], check=True)
manifest_code = "import importlib.metadata,json,platform;print(json.dumps({'python':platform.python_version(),'platform':platform.platform(),'packages':sorted([{'name':d.metadata['Name'],'version':d.version} for d in importlib.metadata.distributions()],key=lambda d:d['name'].lower())}))"
metadata = json.loads(subprocess.check_output([python, '-c', manifest_code], text=True))
shutil.copyfile('/control/executor.py','/opt/tracefold/executor.py')
metadata['executor_sha256']=hashlib.sha256(Path('/opt/tracefold/executor.py').read_bytes()).hexdigest()
metadata['preparation_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
metadata['wheels'] = [{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(Path('/wheels').glob('*.whl'))]
Path('/opt/tracefold/environment.json').write_text(json.dumps(metadata))
print('\n' + sys.argv[1] + json.dumps(metadata), flush=True)
