"""Regression tests for lossless, responsive map-layer loading."""
import gzip
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
sys.path.insert(0, str(ROOT / 'scripts'))

from build_site import write_vector_files  # noqa: E402


class LoadingPerformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((PUBLIC / 'catalog.json').read_text(encoding='utf8'))
        cls.vectors = [layer for layer in cls.catalog['layers']
                       if layer['kind'] in {'point', 'line', 'polygon'}]

    def test_transport_is_lossless_and_materially_smaller(self):
        original_total = compressed_total = 0
        for layer in self.vectors:
            original = (PUBLIC / layer['file']).read_bytes()
            compressed = (PUBLIC / layer['loadFile']).read_bytes()
            self.assertEqual(layer['loadEncoding'], 'gzip', layer['id'])
            self.assertEqual(gzip.decompress(compressed), original, layer['id'])
            self.assertEqual(layer['fileBytes'], len(original), layer['id'])
            self.assertEqual(layer['loadBytes'], len(compressed), layer['id'])
            self.assertEqual(compressed[4:8], b'\0\0\0\0', layer['id'])
            original_total += len(original)
            compressed_total += len(compressed)
        self.assertEqual(len(self.vectors), 43)
        self.assertGreater(1 - compressed_total / original_total, 0.60)
        for layer in self.catalog['layers']:
            if layer not in self.vectors:
                self.assertNotIn('loadFile', layer)

    def test_transport_writer_is_deterministic_and_preserves_geojson(self):
        feature = {
            'type': 'Feature', 'id': 'ngmap:state:test',
            'properties': {'admin_id': 'ngmap:state:test', 'name': 'Abuja ★'},
            'geometry': {'type': 'Point', 'coordinates': [7.3986, 9.0765]},
        }
        results = []
        payloads = []
        with tempfile.TemporaryDirectory() as temporary:
            for name in ('first', 'second'):
                out = Path(temporary) / name
                (out / 'data').mkdir(parents=True)
                result = write_vector_files(str(out), 'sample_pt', [feature])
                original = (out / result['file']).read_bytes()
                compressed = (out / result['loadFile']).read_bytes()
                self.assertEqual(gzip.decompress(compressed), original)
                self.assertEqual(result['fileBytes'], len(original))
                self.assertEqual(result['loadBytes'], len(compressed))
                results.append(result)
                payloads.append((original, compressed))
            self.assertEqual(results[0], results[1])
            self.assertEqual(payloads[0], payloads[1])
            collection = json.loads(payloads[0][0])
            self.assertEqual(collection['features'][0]['id'], 'ngmap:state:test')
            self.assertEqual(collection['features'][0]['properties']['name'], 'Abuja ★')

    def test_built_shell_versions_and_caches_loader_modules(self):
        index = (PUBLIC / 'index.html').read_text(encoding='utf8')
        build = re.search(r'<meta name="build" content="([^"]+)">', index).group(1)
        app = (PUBLIC / 'js/app.js').read_text(encoding='utf8')
        worker = (PUBLIC / 'js/vector-worker.js').read_text(encoding='utf8')
        worker_cache = (PUBLIC / 'sw.js').read_text(encoding='utf8')
        self.assertIn(f"from './loading.js?v={build}'", app)
        self.assertIn(f"from './engine.js?v={build}'", app)
        self.assertIn(f"from './engine.js?v={build}'", worker)
        self.assertIn('st.loadPromise', app)
        self.assertIn('createLoadScheduler()', app)
        self.assertIn("'js/loading.js' + V", worker_cache)
        self.assertIn("'js/vector-worker.js' + V", worker_cache)
        self.assertIn(f"const BUILD = '{build}';", worker_cache)

    @unittest.skipUnless(shutil.which('node'), 'Node.js is needed for JavaScript runtime tests')
    def test_javascript_scheduler_worker_and_syntax(self):
        subprocess.run([
            'node', '--experimental-default-type=module', 'tests/js_loading_test.mjs',
        ], cwd=ROOT, check=True, capture_output=True, text=True, timeout=30)
        for relative in ('app/js/app.js', 'app/js/engine.js', 'app/js/loading.js',
                         'app/js/vector-worker.js', 'app/sw.js'):
            subprocess.run([
                'node', '--experimental-default-type=module', '--check', relative,
            ], cwd=ROOT, check=True, capture_output=True, text=True, timeout=30)


if __name__ == '__main__':
    unittest.main()
