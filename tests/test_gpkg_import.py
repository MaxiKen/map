"""GeoPackage import: Nigerian coordinate conversion and a real file read."""

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class GpkgImportTest(unittest.TestCase):
    def test_reader_and_nigerian_coordinate_systems(self):
        subprocess.run(
            ['node', 'tests/gpkg_import_test.mjs'],
            cwd=ROOT, check=True, capture_output=True, text=True, timeout=60,
        )


if __name__ == '__main__':
    unittest.main()
