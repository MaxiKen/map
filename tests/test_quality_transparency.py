"""Regression tests for UI access to the layer quality and source register."""
import hashlib
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class QualityTransparencyTests(unittest.TestCase):
    def test_public_register_is_exact_hash_covered_download(self):
        source = (ROOT / 'docs/geospatial-audit/layer-quality-register.json').read_bytes()
        published = ROOT / 'public/quality-register.json'
        self.assertTrue(published.is_file())
        self.assertEqual(published.read_bytes(), source)
        catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf8'))
        summary = catalog['layerQualityRegister']
        self.assertEqual(summary['registerFile'], 'quality-register.json')
        self.assertEqual(summary['registerSha256'], hashlib.sha256(source).hexdigest())
        self.assertEqual(summary['summary']['layer_count'], 98)
        self.assertEqual(sum(bool(layer.get('quality') and layer.get('sourceMetadata'))
                             for layer in catalog['layers']), 59)

    def test_quality_shell_is_versioned_and_accessible(self):
        index_source = (ROOT / 'app/index.html').read_text(encoding='utf8')
        self.assertIn('id="panel-quality"', index_source)
        self.assertIn('data-tab="quality"', index_source)
        index = (ROOT / 'public/index.html').read_text(encoding='utf8')
        build = re.search(r'<meta name="build" content="([^"]+)">', index).group(1)
        app = (ROOT / 'public/js/app.js').read_text(encoding='utf8')
        self.assertIn(f"from './quality.js?v={build}'", app)
        self.assertIn('function openQuality(', app)
        self.assertIn('data-act="quality"', app)
        self.assertIn("quality: 'Quality & source'", app)
        worker = (ROOT / 'public/sw.js').read_text(encoding='utf8')
        self.assertIn("'js/quality.js' + V", worker)
        self.assertIn("endsWith('quality-register.json')", worker)
        css = (ROOT / 'public/css/app.css').read_text(encoding='utf8')
        for class_name in ('quality-detail', 'quality-overview', 'q-review', 'q-limits', 'q-pass'):
            self.assertIn(class_name, css)
        netlify = (ROOT / 'netlify.toml').read_text(encoding='utf8')
        self.assertIn('for = "/quality-register.json"', netlify)

    def test_raw_geospatial_download_controls_are_removed(self):
        app = (ROOT / 'app/js/app.js').read_text(encoding='utf8')
        quality = (ROOT / 'app/js/quality.js').read_text(encoding='utf8')
        for forbidden in (
            'href="${esc(m.file)}" download', 'href="${esc(meta.file)}" download',
            'data-x="json"', 'id="e-geo"', "download('feature.json'",
            "download('visible-layers.geojson'", 'function toGeoJSON(',
            'Download layers as GeoJSON / CSV', 'Download GeoJSON',
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, app + quality)
        self.assertIn("['export', 'down', 'Export results'", app)
        self.assertIn('id="e-png"', app)
        self.assertNotIn('id="e-csv"', app)
        self.assertIn('Import GeoJSON', app)
        self.assertIn('Download full JSON register', quality)

    @unittest.skipUnless(shutil.which('node'), 'Node.js is needed for JavaScript runtime tests')
    def test_quality_renderer_runtime_and_javascript_syntax(self):
        subprocess.run([
            'node', '--experimental-default-type=module', 'tests/js_quality_test.mjs',
        ], cwd=ROOT, check=True, capture_output=True, text=True, timeout=30)
        for relative in ('app/js/app.js', 'app/js/engine.js', 'app/js/quality.js', 'app/sw.js'):
            subprocess.run([
                'node', '--experimental-default-type=module', '--check', relative,
            ], cwd=ROOT, check=True, capture_output=True, text=True, timeout=30)


if __name__ == '__main__':
    unittest.main()
