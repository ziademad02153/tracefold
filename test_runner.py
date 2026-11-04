"""Run an approved pytest suite in a bounded Docker container."""
import ast
import base64
import binascii
import subprocess
import tempfile
import threading
import xml.etree.ElementTree as ET
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


def planned_tests(code):
    return [node.name for node in ast.parse(code).body
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")]


def parse_results(xml, names):
    """Map pytest's structured evidence to the approved test names."""
    root = ET.fromstring(xml)
    observed = {}
    for case in root.iter("testcase"):
        name = case.get("name", "")
        if name not in names or name in observed:
            raise ValueError("Unexpected or duplicate test result.")
        failure = case.find("failure")
        error = case.find("error")
        skipped = case.find("skipped")
        status = "passed"
        detail = "Assertions passed."
        if failure is not None:
            status, detail = "failed", failure.text or failure.get("message", "Assertion failed.")
        elif error is not None:
            status, detail = "blocked", error.text or error.get("message", "Test setup could not complete.")
        elif skipped is not None:
            status, detail = "skipped", skipped.text or skipped.get("message", "Test was skipped.")
        observed[name] = {
            "name": name, "status": status, "detail": detail[:6000],
            "seconds": float(case.get("time", "0")),
        }
    return [observed.get(name, {"name": name, "status": "not_run", "detail": "No completed pytest result was recorded.", "seconds": 0})
            for name in names]


def summarize(tests):
    return {"total": len(tests), **{
        status: sum(test["status"] == status for test in tests)
        for status in ("passed", "failed", "blocked", "skipped", "not_run")
    }}


def execute_test(source, test_code, image_id=None):
    start = monotonic()
    names = planned_tests(test_code)
    tests = [{"name": name, "status": "not_run", "detail": "Run did not complete.", "seconds": 0} for name in names]
    info = runner_status()
    if not info["ready"]:
        return {"status": "blocked", "log": info["message"], "exit_code": None,
                "tests": tests, "summary": summarize(tests)}
    image_id = image_id or info["image_id"]
    name = "tracefold-test-" + uuid4().hex
    with tempfile.TemporaryDirectory(prefix="tracefold-") as directory:
        path = Path(directory)
        (path / "target.py").write_text(source, encoding="utf-8")
        (path / "test_generated.py").write_text(test_code, encoding="utf-8")
        marker = "TRACEFOLD-EVIDENCE-" + uuid4().hex + ":"
        # Read the ephemeral XML before the container exits, then emit a bounded artifact.
        wrapper = (
            "import base64,pathlib,subprocess,sys\n"
            "result=subprocess.run([sys.executable,'-m','pytest','test_generated.py','-q','-ra',"
            "'--tb=short','--color=no','-p','no:cacheprovider','--junitxml=/tmp/tracefold-results.xml'])\n"
            "artifact=pathlib.Path('/tmp/tracefold-results.xml')\n"
            "data=artifact.read_bytes() if artifact.is_file() and artifact.stat().st_size<=24000 else b''\n"
            f"print('\\n{marker}'+base64.b64encode(data).decode(),flush=True)\n"
            "sys.exit(result.returncode)\n"
        )
        command = [
            "docker", "run", "--rm", "--pull=never", "--name", name,
            "--network=none", "--read-only", "--cap-drop=ALL",
            "--security-opt=no-new-privileges", "--memory=256m", "--cpus=1",
            "--pids-limit=64", "--user=65534:65534", "--log-driver=none",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m",
            "--mount", f"type=bind,source={path.resolve()},target=/workspace,readonly",
            image_id, "python", "-c", wrapper,
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
            raw_log, separator, artifact = bytes(output).rpartition(marker.encode())
            log = (raw_log if separator else output).decode("utf-8", errors="replace")
            structured = False
            if not interrupted and separator:
                try:
                    xml = base64.b64decode(artifact.strip(), validate=True)
                    tests = parse_results(xml, names)
                    structured = True
                except (ET.ParseError, ValueError, binascii.Error):
                    log += "\nStructured test evidence could not be validated."
            counts = summarize(tests)
            incomplete = counts["blocked"] + counts["skipped"] + counts["not_run"] > 0
            if interrupted or not structured or incomplete or not names or process.returncode not in (0, 1):
                status = "blocked"
            elif counts["failed"] and process.returncode == 1:
                status = "failed"
            elif counts["passed"] == len(names) and process.returncode == 0:
                status = "passed"
            else:
                status = "blocked"
            if interrupted:
                log += "\nRun stopped at the time or output limit."
            return {"status": status, "exit_code": process.returncode, "log": log,
                    "seconds": round(monotonic() - start, 2), "image": image_id,
                    "tests": tests, "summary": counts}
        except (OSError, subprocess.TimeoutExpired):
            return {"status": "blocked", "exit_code": None,
                    "log": "Runner could not finish. Check Docker and retry.",
                    "tests": tests, "summary": summarize(tests)}
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
