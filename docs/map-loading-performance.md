# Map loading performance

The map remains dependency-free and lazy-loads layers only when needed. Loading is optimized in four ways:

1. **Deterministic gzip transport.** Every published vector has a `.geojson.gz` sidecar. The browser fetches
   this smaller representation when `DecompressionStream` is available. The original GeoJSON remains unchanged
   for downloads, exports, compatibility fallback and independent verification.
2. **Worker parsing and conversion.** `js/vector-worker.js` fetches and decompresses GeoJSON, parses JSON,
   converts coordinates to Web Mercator and allocates typed geometry arrays away from the UI thread. Coordinate
   buffers transfer back without another copy. Styling and feature indices use the same `prepareFeature`
   implementation as the fallback path.
3. **Bounded, deduplicated loads.** `js/loading.js` permits two layer loads at once across startup, raster/image
   loading, bulk activation and author tools. Repeated calls for the same layer share one in-flight promise.
   "Show all" refreshes the full layer panel once after loading instead of rebuilding it for every layer.
4. **Compatible fallback.** Without module workers or gzip streaming, the original GeoJSON is used. The main-thread
   fallback yields every 1,000 input features rather than converting an entire layer in one uninterrupted loop.
   A failed worker/data request still reports an error; it is not silently replaced with different data.

## Current static payload measurements

The build records `fileBytes`, `loadFile`, `loadEncoding` and `loadBytes` for every vector layer. These are file
sizes, **not browser timing benchmarks**. A CDN may already apply gzip to original responses; explicit sidecars
make the optimized representation deterministic and allow it to be decoded in the worker.

| Scope | Original GeoJSON | Gzip transport | Reduction |
| --- | ---: | ---: | ---: |
| All 43 published vector layers | 118,311,370 bytes (112.8 MiB) | 19,096,408 bytes (18.2 MiB) | **83.9%** |
| Default two-layer startup set | 3,446,059 bytes | 762,553 bytes | **77.9%** |
| WPDx boreholes | 26,914,961 bytes | 2,063,218 bytes | **92.3%** |
| OSM points of interest | 9,037,635 bytes | 825,925 bytes | **90.9%** |

Actual interactive timing depends on connection, device and browser. The architectural changes reduce bytes and
move the expensive parsing/coordinate conversion off the UI thread; they do not claim a universal load-time score.

## Correctness and maintenance

`scripts/build_site.py` writes deterministic gzip files (`mtime=0`) and refreshes them again if legend folding
adds attributes to an owner layer. `scripts/validate_artifacts.py` decompresses all 43 sidecars and requires exact
byte equality with the original GeoJSON, matching byte counts and deterministic timestamps. Build hashing and the
service-worker shell include `loading.js` and `vector-worker.js` so deployments cannot mix module versions.

The optimization does not change GeoPackages, published GeoJSON, stable feature IDs, geometry, attributes,
raster values, source metadata or cross-border rules. A pre/post-build hash comparison covered all 75 pre-existing
public data and icon files.

Run:

```bash
python scripts/build_site.py
python scripts/validate_artifacts.py
python -m unittest discover -s tests -v
```

`tests/js_loading_test.mjs` additionally executes scheduler and worker tests under Node.js when available,
including gzip and uncompressed parsing, styling, typed-array transfer, HTTP failures and queue recovery.
