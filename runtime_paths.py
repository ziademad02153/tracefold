"""Keep repository source separate from mutable application data."""
from pathlib import Path


def runtime_directory(source_root: Path, configured: str | None = None) -> Path:
    source_root = source_root.resolve()
    if configured:
        return Path(configured).expanduser().resolve()
    # Preserve old installations until their operator moves the database/cache.
    # Never silently create an empty replacement for existing saved reports.
    if (source_root / 'tracefold.db').exists() or (source_root / '.tracefold' / 'snapshots').exists():
        return source_root
    return source_root.parent / (source_root.name + '-data')


def snapshot_directory(source_root: Path, data_root: Path) -> Path:
    return data_root / '.tracefold' / 'snapshots' if data_root == source_root else data_root / 'snapshots'
