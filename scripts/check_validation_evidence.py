"""Verify the reviewed static evidence inventory; never load runtime storage."""
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / 'docs' / 'validation' / 'evidence'


def check():
    manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
    expected = set()
    for entry in manifest['files']:
        name = entry['file']
        if Path(name).name != name or '/' in name or '\\' in name or name in expected:
            raise ValueError('Invalid or duplicate evidence filename.')
        expected.add(name)
        data = (BASE / name).read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Evidence content changed: ' + name)
        json.loads(data)
    actual = {p.name for p in BASE.glob('*.json') if p.name != 'manifest.json'}
    if actual != expected:
        raise ValueError('Evidence inventory differs from the reviewed manifest.')
    print(f'Verified {len(expected)} static JSON capsules: inventory, sizes and SHA256 match.')


if __name__ == '__main__':
    check()
