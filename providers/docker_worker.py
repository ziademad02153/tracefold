"""Bounded local Docker transport used by the Python provider, not the core."""
import subprocess
import threading

from execution_core.contracts import ProviderError


def command(args, seconds=30, limit=1_000_000):
    output = bytearray()
    overflow = threading.Event()
    try:
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError as failure:
        raise ProviderError("Docker is unavailable. Start Docker Desktop and retry.") from failure
    def read():
        while True:
            chunk = process.stdout.read(4096)
            if not chunk:
                break
            if len(output) + len(chunk) > limit:
                overflow.set()
                break
            output.extend(chunk)
    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    try:
        reader.join(seconds)
        if reader.is_alive() or overflow.is_set():
            process.kill()
            raise ProviderError("Operation exceeded its time or output limit.\n" + output.decode('utf-8', errors='replace')[-12000:])
        process.wait(timeout=10)
        return process.returncode, output.decode('utf-8', errors='replace')
    finally:
        if process.poll() is None:
            process.kill()
        # The caller removes the named container as well; killing its CLI alone is insufficient.
        process.stdout.close()
        reader.join(2)


def remove(kind, name):
    try:
        subprocess.run(['docker', kind, 'rm', '-f', name] if kind == 'container' else ['docker', kind, 'rm', name], capture_output=True, timeout=12)
    except (OSError, subprocess.TimeoutExpired):
        pass


def run_args(name, network='none', readonly=True):
    args = ['docker','run','--name',name,'--pull=never','--network='+network,
            '--cap-drop=ALL','--security-opt=no-new-privileges','--memory=1g','--cpus=2',
            '--pids-limit=128','--log-driver=none','--tmpfs','/tmp:rw,nosuid,size=256m']
    if readonly:
        args.append('--read-only')
    return args
