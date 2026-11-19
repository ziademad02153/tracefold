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
    def __init__(self, root, github, connected, local_resolver=None):
        self.root, self.github, self.connected = Path(root).resolve(), github, connected
        self.local_resolver = local_resolver
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()

    def __call__(self, repo, ref):
        with self.lock:
            return self._acquire(repo, ref)

    def _snapshot_local(self, repo, ref, local_dir):
        ignored_names = {
            '.git', '.github', '__pycache__', '.pytest_cache', '.mypy_cache',
            '.venv', 'venv', 'env', '.env', 'node_modules', 'dist', 'build',
            '.tracefold', '.idea', '.vscode', '.eggs'
        }
        items = []
        for path in local_dir.rglob('*'):
            if not path.is_file() or path.is_symlink():
                continue
            rel = path.relative_to(local_dir)
            if any(part in ignored_names or part.endswith('.egg-info') for part in rel.parts):
                continue
            if path.suffix in ('.pyc', '.pyo', '.pyd', '.swp', '.tmp'):
                continue
            if path.stat().st_size > 8_000_000:
                continue
            key = rel.as_posix()
            try:
                content = path.read_bytes()
            except OSError:
                continue
            items.append((key, hashlib.sha256(content).hexdigest(), content))

        if not items:
            raise ProviderError(f"Local project directory {local_dir} contains no readable project files.")

        sorted_items = sorted(items, key=lambda x: x[0])
        hashes = [(k, h) for k, h, _ in sorted_items]
        content_hash = hashlib.sha256(json.dumps(hashes).encode()).hexdigest()

        cache_key = hashlib.sha256((repo + ':' + content_hash).encode()).hexdigest()[:32]
        cache = self.root / f"{cache_key}-local"

        if not cache.is_dir() or len(list(cache.rglob('*'))) < len(sorted_items):
            cache.mkdir(parents=True, exist_ok=True)
            for key, _, content in sorted_items:
                target = cache.joinpath(*Path(key).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)

        metadata = {
            'directory': cache.name,
            'content_hash': content_hash,
            'file_count': len(sorted_items),
            'local_source': str(local_dir)
        }
        pointer = self.root / f"{cache_key}.json"
        pointer.write_text(json.dumps(metadata), encoding='utf-8')

        return Snapshot(repo, ref or 'local', cache, content_hash, len(sorted_items))

    def _acquire(self, repo, ref):
        self.connected(repo)
        local_path = self.local_resolver(repo) if self.local_resolver else None
        if local_path or repo.startswith('local/'):
            if not local_path:
                raise ProviderError(f"Local project {repo} is not registered or directory path is missing.")
            local_dir = Path(local_path).resolve()
            if not local_dir.is_dir():
                raise ProviderError(f"Local project directory not found: {local_dir}")
            return self._snapshot_local(repo, ref or 'local', local_dir)

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
