"""Run an approved standalone test in a bounded Docker container."""
import subprocess
import tempfile
import threading
from pathlib import Path
from time import monotonic
from uuid import uuid4

IMAGE = "tracefold-pytest:1"


def runner_status():
    try:
        result = subprocess.run(["docker", "image", "inspect", "--format", "{{.Id}}", IMAGE], capture_output=True, timeout=8)
        ready = result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        ready = False
    return {"ready": ready, "image": IMAGE,
            "image_id": result.stdout.decode().strip() if ready else None,
            "message": "Runner ready." if ready else "Start Docker and build the runner with docker build -t tracefold-pytest:1 runner."}


def execute_test(source, test_code, image_id=None):
    start = monotonic()
    info = runner_status()
    if not info["ready"]:
        return {"status": "blocked", "log": info["message"], "exit_code": None}
    image_id = image_id or info["image_id"]
    name = "tracefold-test-" + uuid4().hex
    with tempfile.TemporaryDirectory(prefix="tracefold-") as directory:
        path = Path(directory)
        (path / "target.py").write_text(source, encoding="utf-8")
        (path / "test_generated.py").write_text(test_code, encoding="utf-8")
        command = [
            "docker", "run", "--rm", "--pull=never", "--name", name,
            "--network=none", "--read-only", "--cap-drop=ALL",
            "--security-opt=no-new-privileges", "--memory=256m", "--cpus=1",
            "--pids-limit=64", "--user=65534:65534", "--log-driver=none",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m",
            "--mount", f"type=bind,source={path.resolve()},target=/workspace,readonly",
            image_id, "python", "-m", "pytest", "test_generated.py", "-q", "-ra",
            "--tb=short", "--color=no", "-p", "no:cacheprovider",
        ]
        output = bytearray()
        limit_hit = threading.Event()
        process = None
        reader = None
        try:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            def collect():
                while True:
                    chunk = process.stdout.read(1024)
                    if not chunk:
                        break
                    if len(output) + len(chunk) > 65536:
                        limit_hit.set()
                        break
                    output.extend(chunk)
            reader = threading.Thread(target=collect, daemon=True)
            reader.start()
            reader.join(25)
            interrupted = reader.is_alive() or limit_hit.is_set()
            if interrupted:
                subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=8)
                process.kill()
            process.wait(timeout=8)
            reader.join(2)
            status = "blocked" if interrupted or process.returncode not in (0, 1) else "passed" if process.returncode == 0 else "failed"
            log = output.decode("utf-8", errors="replace")
            if interrupted:
                log += "\nRun stopped at the time or output limit."
            return {"status": status, "exit_code": process.returncode, "log": log,
                    "seconds": round(monotonic() - start, 2), "image": image_id}
        except (OSError, subprocess.TimeoutExpired):
            return {"status": "blocked", "exit_code": None, "log": "Runner could not finish. Check Docker and retry."}
        finally:
            try:
                subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=8)
            except (OSError, subprocess.TimeoutExpired):
                pass
            if process is not None:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=3)
                if reader is not None:
                    reader.join(2)
                process.stdout.close()
