"""Immutable public GitHub snapshots. Archive contents are data, never imported."""
import hashlib
import io
import json
import re
import shutil
import stat
import tempfile
import threading
from uuid import uuid4
import zipfile
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen

from execution_core.contracts import ProviderError, Snapshot


def extract_snapshot(data, destination):
    total, count, seen = 0, 0, set()
    hashes = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        roots = {item.filename.split('/')[0] for item in archive.infolist()}
        if len(roots) != 1:
            raise ProviderError("Archive must have one repository root.")
        for item in archive.infolist():
            parts = item.filename.split('/')[1:]
            if item.is_dir():
                continue
            if (not parts or any(part in ('', '.', '..') or ':' in part or '\\' in part or part.endswith((' ', '.'))
                                 or part.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]}
                                 for part in parts) or PurePosixPath('/'.join(parts)).is_absolute()
                    or stat.S_ISLNK(item.external_attr >> 16)):
                raise ProviderError("Archive contains an unsupported path or symlink.")
            key = '/'.join(parts)
            if key.casefold() in seen:
                raise ProviderError("Archive contains colliding paths.")
            seen.add(key.casefold())
            total += item.file_size
            count += 1
            if total > 64_000_000 or count > 5000 or item.file_size > 8_000_000:
                raise ProviderError("Snapshot exceeds the initial repository size limits.")
            content = archive.read(item)
            target = destination.joinpath(*parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            hashes.append((key, hashlib.sha256(content).hexdigest()))
    if not count:
        raise ProviderError("Repository snapshot is empty.")
    return hashlib.sha256(json.dumps(sorted(hashes)).encode()).hexdigest(), count


class GithubSnapshots:
    def __init__(self, root, github, connected):
        self.root, self.github, self.connected = Path(root).resolve(), github, connected
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()

    def __call__(self, repo, ref):
        with self.lock:
            return self._acquire(repo, ref)

    def _acquire(self, repo, ref):
        self.connected(repo)
        if not re.fullmatch(r'[A-Za-z0-9-]+/[A-Za-z0-9_.-]+', repo):
            raise ProviderError("Choose a real connected GitHub repository.")
        from urllib.parse import quote
        # Immutable commit IDs need no branch-resolution request. Cached snapshots
        # are still rehashed below, so replay remains verified when GitHub is busy.
        sha = ref if re.fullmatch(r'[0-9a-f]{40}', ref) else self.github(repo + '/commits/' + quote(ref, safe=''))['sha']
        if not re.fullmatch(r'[0-9a-f]{40}', sha):
            raise ProviderError("GitHub did not return an immutable revision.")
        key = hashlib.sha256((repo + ':' + sha).encode()).hexdigest()
        pointer = self.root / (key + '.json')
        metadata = json.loads(pointer.read_text()) if pointer.is_file() else None
        if metadata and (not re.fullmatch(key + r'-[A-Za-z0-9_-]+', metadata['directory'])):
            raise ProviderError('Cached snapshot location is invalid.')
        cache = self.root / metadata['directory'] if metadata else None
        # Rehash cached content instead of trusting editable local metadata.
        if cache is None:
            request = Request(f'https://codeload.github.com/{repo}/zip/{sha}', headers={'User-Agent':'Tracefold'})
            try:
                with urlopen(request, timeout=40) as response:
                    data = response.read(16_000_001)
                if len(data) > 16_000_000:
                    raise ProviderError("Compressed repository snapshot exceeds 16 MB.")
                cache = Path(tempfile.mkdtemp(prefix=key+'-', dir=self.root))
                try:
                    source_hash, count = extract_snapshot(data, cache)
                    metadata = {'directory':cache.name,'content_hash':source_hash,'file_count':count}
                    temporary_pointer = self.root / (uuid4().hex + '.tmp')
                    temporary_pointer.write_text(json.dumps(metadata))
                    temporary_pointer.replace(pointer)
                except Exception:
                    # Only remove this freshly allocated staging tree within our snapshot store.
                    if cache.resolve().is_relative_to(self.root):
                        shutil.rmtree(cache)
                    raise
            except ProviderError:
                raise
            except Exception as failure:
                raise ProviderError("Could not acquire a safe GitHub snapshot. Check connection and repository limits.") from failure
        if not cache.is_dir():
            raise ProviderError('Cached snapshot is missing. Restore the snapshot store before running.')
        files = sorted((path for path in cache.rglob('*') if path.is_file()), key=lambda p:p.relative_to(cache).as_posix())
        if any(path.is_symlink() for path in cache.rglob('*')):
            raise ProviderError("Cached snapshot contains a symlink.")
        hashes = [(p.relative_to(cache).as_posix(), hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]
        content_hash = hashlib.sha256(json.dumps(hashes).encode()).hexdigest()
        if content_hash != metadata['content_hash'] or len(files) != metadata['file_count']:
            raise ProviderError('Cached snapshot content changed. Execution was blocked.')
        return Snapshot(repo, sha, cache, content_hash, len(files))
