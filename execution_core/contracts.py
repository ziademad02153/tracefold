"""Contracts contain no tested-language or test-framework assumptions."""
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
import hashlib
import json


def identity(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def checked_payload(value, limit):
    try:
        if not isinstance(value, dict) or len(json.dumps(value, allow_nan=False).encode()) > limit:
            raise ValueError()
    except (TypeError, ValueError, OverflowError) as failure:
        raise ProviderError('Provider payload is invalid or exceeds the evidence limit.') from failure
    return value


@dataclass(frozen=True)
class Snapshot:
    repository: str
    revision: str
    path: Path
    content_hash: str
    file_count: int

    def public(self):
        return {"repository": self.repository, "revision": self.revision,
                "content_hash": self.content_hash, "file_count": self.file_count}


@dataclass(frozen=True)
class Policy:
    prepare_seconds: int = 360
    run_seconds: int = 120
    output_bytes: int = 1_000_000
    max_cases: int = 5000


class ProviderError(ValueError):
    pass


class Provider(Protocol):
    id: str
    version: str
    capabilities: tuple[str, ...]

    def discover(self, snapshot: Snapshot, component: str) -> dict: ...
    def validate(self, snapshot: Snapshot, config: dict) -> dict: ...
    def prepare(self, snapshot: Snapshot, config: dict, policy: Policy) -> dict: ...
    def execute(self, snapshot: Snapshot, config: dict, environment: dict, policy: Policy) -> dict: ...


OUTCOMES = ("passed", "failed", "error", "skipped", "xfailed", "xpassed", "not_run")


def reconcile(result, policy):
    """Never infer a pass from absent, duplicate or unrecognized evidence."""
    checked_payload(result, policy.output_bytes * 2)
    collected = result.get("collected", [])
    tests = result.get("tests", [])
    if (not isinstance(collected,list) or not all(isinstance(value,str) and len(value)<=2000 for value in collected)
            or not isinstance(tests,list) or not all(isinstance(test,dict) and isinstance(test.get('id'),str) for test in tests)):
        raise ProviderError('Provider test identities do not satisfy the execution contract.')
    artifacts = result.get('artifacts', [])
    if not isinstance(artifacts,list) or len(artifacts)>10:
        raise ProviderError('Invalid provider artifact collection.')
    for artifact in artifacts:
        if not isinstance(artifact,dict) or not isinstance(artifact.get('content'),str) or not isinstance(artifact.get('media_type'),str):
            raise ProviderError('Artifacts require a media type and bounded text content in this contract version.')
        actual = hashlib.sha256(artifact['content'].encode()).hexdigest()
        if artifact.get('sha256',actual)!=actual:
            raise ProviderError('Provider artifact checksum does not match its content.')
        artifact['sha256']=actual
    ids = [test.get("id") for test in tests]
    if not collected:
        return {**result,'status':'blocked','error':'No tests were collected. Inspect selection, collection errors and skipped modules.',
                'summary':{'total':0,**{status:0 for status in OUTCOMES}}}
    if (not collected or len(collected) > policy.max_cases or len(set(collected)) != len(collected)
            or len(set(ids)) != len(ids) or set(ids) != set(collected)
            or any(test.get("status") not in OUTCOMES for test in tests)):
        return {**result, "status": "blocked", "error": "Collected cases and execution evidence do not reconcile.",
                "summary": {"total": 0, **{status: 0 for status in OUTCOMES}}}
    summary = {"total": len(tests), **{status: sum(t["status"] == status for t in tests) for status in OUTCOMES}}
    if result.get("collection_errors") or summary["error"] or summary["not_run"] or result.get("exit_code") not in (0, 1):
        status = "blocked"
    elif summary["failed"] or result.get("exit_code") == 1:
        status = "failed"
    elif summary["skipped"] or summary["xfailed"] or summary["xpassed"]:
        status = "completed_with_exceptions"
    else:
        status = "passed"
    return {**result, "status": status, "summary": summary}
