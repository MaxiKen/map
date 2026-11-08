import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from build_site import build_timestamp, is_build_timestamp
from package_release import package
from prepare_release import prepare
from release_utils import changelog_section, numeric_version, public_build


class BuildClockTests(unittest.TestCase):
    def test_reproducible_epoch_and_validation(self):
        with patch.dict(os.environ, {'SOURCE_DATE_EPOCH': '0'}):
            self.assertEqual(build_timestamp(), '1970-01-01 00:00 UTC')
        with patch.dict(os.environ, {'SOURCE_DATE_EPOCH': '946684800'}):
            self.assertEqual(build_timestamp(), '2000-01-01 00:00 UTC')
        for invalid in ('-1', 'tomorrow', '1.5'):
            with self.subTest(invalid=invalid), patch.dict(os.environ, {'SOURCE_DATE_EPOCH': invalid}):
                with self.assertRaises(SystemExit):
                    build_timestamp()
        self.assertTrue(is_build_timestamp('2026-11-08 18:11 UTC'))
        for invalid in (None, 1794159060, '2026-11-08 18:11', '2026-11-08 18:11:00 UTC',
                        '2026-02-30 18:11 UTC', '2026-11-8 18:11 UTC'):
            with self.subTest(timestamp=invalid):
                self.assertFalse(is_build_timestamp(invalid))


class ReleasePreparationTests(unittest.TestCase):
    def make_root(self, notes='### Added\n\n- A tested maintenance improvement.'):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        (root / 'CHANGELOG.md').write_text(
            f'# Changelog\n\n## [Unreleased]\n\n{notes}\n', encoding='utf8')
        (root / 'package.json').write_text('{"name":"fixture","version":"1.0.0"}\n', encoding='utf8')
        (root / 'package-lock.json').write_text(json.dumps({
            'name': 'fixture', 'version': '1.0.0', 'lockfileVersion': 3,
            'packages': {'': {'name': 'fixture', 'version': '1.0.0'}},
        }), encoding='utf8')
        return temporary, root

    def test_prepare_preserves_notes_and_aligns_versions(self):
        temporary, root = self.make_root()
        self.addCleanup(temporary.cleanup)
        self.assertEqual(prepare(root, 'v1.2.3', '2026-11-09'), ('1.2.3', '2026-11-09'))
        text = (root / 'CHANGELOG.md').read_text(encoding='utf8')
        self.assertIn('## [Unreleased]\n\n## [1.2.3] - 2026-11-09', text)
        self.assertIn('A tested maintenance improvement.', text)
        self.assertEqual(changelog_section(root / 'CHANGELOG.md', '1.2.3')[0], '2026-11-09')
        self.assertEqual(json.loads((root / 'package.json').read_text())['version'], '1.2.3')
        lock = json.loads((root / 'package-lock.json').read_text())
        self.assertEqual(lock['version'], '1.2.3')
        self.assertEqual(lock['packages']['']['version'], '1.2.3')
        with self.assertRaisesRegex(ValueError, 'Unreleased'):
            prepare(root, '1.2.4', '2026-11-10')

    def test_prepare_rejects_invalid_version_date_and_empty_notes(self):
        for version in ('1.2', 'v01.2.3', '1.2.3-beta.1'):
            with self.subTest(version=version):
                temporary, root = self.make_root()
                self.addCleanup(temporary.cleanup)
                with self.assertRaises(ValueError):
                    prepare(root, version, '2026-11-09')
        temporary, root = self.make_root()
        self.addCleanup(temporary.cleanup)
        with self.assertRaises(ValueError):
            prepare(root, '1.2.3', '09/11/2026')
        temporary, root = self.make_root(notes='')
        self.addCleanup(temporary.cleanup)
        with self.assertRaisesRegex(ValueError, 'Unreleased'):
            prepare(root, '1.2.3', '2026-11-09')


class ReleasePackageTests(unittest.TestCase):
    def make_root(self):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        public = root / 'public'
        (public / 'data').mkdir(parents=True)
        (public / 'index.html').write_text('<meta name="build" content="0123456789">', encoding='utf8')
        (public / 'data/example.txt').write_text('static payload\n', encoding='utf8')
        register = b'{"schemaVersion":1,"layers":[]}\n'
        (public / 'quality-register.json').write_bytes(register)
        register_hash = hashlib.sha256(register).hexdigest()
        catalog = {
            'title': 'Fixture WebGIS', 'built': '2026-11-09 10:00 UTC',
            'layers': [{'id': 'a', 'count': 2}, {'id': 'b'}, {'id': 'c', 'count': 3}],
            'layerQualityRegister': {
                'registerSha256': register_hash,
                'summary': {'layer_count': 2},
            },
        }
        (public / 'catalog.json').write_text(json.dumps(catalog), encoding='utf8')
        (root / 'package.json').write_text('{"version":"1.2.3"}\n', encoding='utf8')
        (root / 'CHANGELOG.md').write_text(
            '# Changelog\n\n## [Unreleased]\n\n## [1.2.3] - 2026-11-09\n\n'
            '### Added\n\n- Deterministic release fixture.\n', encoding='utf8')
        return temporary, root

    def test_package_is_complete_hashed_and_reproducible(self):
        temporary, root = self.make_root()
        self.addCleanup(temporary.cleanup)
        commit = 'a' * 40
        first = package(root, 'v1.2.3', root / 'dist-one', commit)
        second = package(root, '1.2.3', root / 'dist-two', commit)
        self.assertEqual(first['build'], '0123456789')
        self.assertEqual(first['tag'], 'v1.2.3')
        self.assertEqual(first['archive'].read_bytes(), second['archive'].read_bytes())
        self.assertEqual(first['checksum'].read_text(), f'{first["sha256"]}  {first["archive"].name}\n')
        self.assertEqual(hashlib.sha256(first['archive'].read_bytes()).hexdigest(), first['sha256'])

        manifest = json.loads(first['manifest'].read_text())
        self.assertEqual(manifest['commit'], commit)
        self.assertEqual(manifest['publishedLayers'], 3)
        self.assertEqual(manifest['sourceLayers'], 2)
        self.assertEqual(manifest['publishedFeatures'], 5)
        self.assertEqual(len(manifest['files']), 4)
        self.assertTrue(all(len(row['sha256']) == 64 for row in manifest['files']))
        notes = first['notes'].read_text(encoding='utf8')
        self.assertIn(commit, notes)
        self.assertIn('0123456789', notes)
        self.assertIn('Deterministic release fixture.', notes)

        with zipfile.ZipFile(first['archive']) as archive:
            self.assertIsNone(archive.testzip())
            names = archive.namelist()
            self.assertIn('ngmap-v1.2.3-0123456789/index.html', names)
            self.assertIn('ngmap-v1.2.3-0123456789/data/example.txt', names)
            self.assertIn('ngmap-v1.2.3-0123456789/release.json', names)
            embedded = json.loads(archive.read('ngmap-v1.2.3-0123456789/release.json'))
            self.assertEqual(embedded['build'], '0123456789')
            self.assertEqual({info.date_time for info in archive.infolist()}, {(2026, 11, 9, 0, 0, 0)})

    def test_package_requires_full_source_commit(self):
        temporary, root = self.make_root()
        self.addCleanup(temporary.cleanup)
        for invalid in ('', 'a' * 39, 'A' * 40, 'g' * 40):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, '40-character'):
                package(root, '1.2.3', root / 'dist', invalid)

    def test_package_requires_matching_version_and_catalog_hash(self):
        temporary, root = self.make_root()
        self.addCleanup(temporary.cleanup)
        (root / 'package.json').write_text('{"version":"9.8.7"}\n', encoding='utf8')
        with self.assertRaisesRegex(ValueError, 'does not match'):
            package(root, '1.2.3', root / 'dist', 'b' * 40)
        (root / 'package.json').write_text('{"version":"1.2.3"}\n', encoding='utf8')
        catalog_path = root / 'public/catalog.json'
        catalog = json.loads(catalog_path.read_text())
        catalog['layerQualityRegister']['registerSha256'] = '0' * 64
        catalog_path.write_text(json.dumps(catalog))
        with self.assertRaisesRegex(ValueError, 'catalog hash'):
            package(root, '1.2.3', root / 'dist', 'b' * 40)


class ReleaseUtilityTests(unittest.TestCase):
    def test_version_and_public_build_validation(self):
        self.assertEqual(numeric_version('v0.0.0'), '0.0.0')
        self.assertEqual(numeric_version('10.20.30'), '10.20.30')
        for invalid in ('1', '1.2.3.4', '1.2.3-rc1', '01.2.3'):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                numeric_version(invalid)
        with self.assertRaises((OSError, ValueError)):
            public_build(ROOT / 'does-not-exist')


if __name__ == '__main__':
    unittest.main()
