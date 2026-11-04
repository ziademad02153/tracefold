"""Bounded local Docker transport used by the Python provider, not the core."""
import subprocess
import threading

from execution_core.contracts import ProviderError


def command(args, seconds=30, limit=1_000_000):
    output = bytearray()
    overflow = threading.Event()
    read_error = threading.Event()
    try:
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError as failure:
        raise ProviderError("Docker is unavailable. Start Docker Desktop and retry.") from failure
    def read():
        try:
            while True:
                chunk = process.stdout.read(4096)
                if not chunk:
                    break
                if len(output) + len(chunk) > limit:
                    overflow.set()
                    break
                output.extend(chunk)
        except (OSError, ValueError):
            read_error.set()
        finally:
            # Only the reader owns this buffered stream. Closing it from the
            # controller during a blocking read races on Windows/Python 3.13.
            process.stdout.close()
    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    try:
        reader.join(seconds)
        if reader.is_alive() or overflow.is_set():
            if process.poll() is None:
                process.kill()
            raise ProviderError("Operation exceeded its time or output limit.\n" + output.decode('utf-8', errors='replace')[-12000:])
        if read_error.is_set():
            raise ProviderError('Runner output could not be read completely. No successful result was accepted.')
        process.wait(timeout=10)
        return process.returncode, output.decode('utf-8', errors='replace')
    finally:
        if process.poll() is None:
            process.kill()
        # The caller removes the named container as well; killing its CLI alone is insufficient.
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass
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
