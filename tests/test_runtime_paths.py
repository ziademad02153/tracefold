import tempfile
import unittest
from pathlib import Path

from runtime_paths import runtime_directory, snapshot_directory


class RuntimePathTests(unittest.TestCase):
    def test_new_installation_keeps_data_outside_source(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'Tracefold'
            source.mkdir()
            data = runtime_directory(source)
            self.assertEqual(data, source.parent / 'Tracefold-data')
            self.assertEqual(snapshot_directory(source, data), data / 'snapshots')

    def test_existing_database_is_not_silently_replaced(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder).resolve()
            (source / 'tracefold.db').touch()
            self.assertEqual(runtime_directory(source), source)
            self.assertEqual(snapshot_directory(source, source), source / '.tracefold' / 'snapshots')

    def test_existing_snapshots_keep_legacy_location(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder).resolve()
            (source / '.tracefold' / 'snapshots').mkdir(parents=True)
            self.assertEqual(runtime_directory(source), source)

    def test_explicit_data_location_overrides_legacy(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder).resolve()
            (source / 'tracefold.db').touch()
            destination = source.parent / 'chosen-data'
            self.assertEqual(runtime_directory(source, str(destination)), destination)
