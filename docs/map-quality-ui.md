# Quality transparency in the UI

The **Quality & source** tab exposes the existing `ngmap-layer-quality-v1` evidence without another catalog or
layer-data request. It is also available from each expanded layer row, feature/raster results, and Tools → About.

## What users can inspect

- **Catalog overview:** 59 published layers, their use classes, the open review queue, **47 published layers with
  metadata gaps**, and **86 layers with gaps across all 98 visible and hidden sources**. Published and all-source
  counts are labelled separately rather than mixed.
- **Per-layer measured checks:** structural status, topology status, reviewed disposition, coverage interpretation,
  feature count and the source GeoPackage SHA-256.
- **Narrative limitations:** the register's actual caveats and open review reasons, including the 314 WPDx LGA-name
  joins that still need source-vintage review.
- **Descriptive source metadata:** dataset, publisher, safe external source URL, licence/terms and their evidence
  status, temporal coverage, local evidence reference, source description and notes.
- **Explicit gaps:** the number of recorded fields and human-readable names of missing fields. Blank values remain
  “Not recorded”; no publisher, vintage, licence, URL, temporal coverage or provenance is inferred.
- **Geographic scope:** cross-border scope class, source retention, foreign-feature interpretation, national
  aggregation rule and scope note.

The interface deliberately states that structural checks are not survey certification, metadata completeness is
not licence clearance, and no numeric quality score is assigned. The per-layer `5 of 6` or `6 of 6` values are
counts of six tracked metadata fields, not quality ratings.

Source GeoPackage names and SHA-256 values are plain provenance text, not package downloads. Layer rows and layer
quality details do not offer GeoJSON links, and feature results do not offer GeoJSON/JSON export. These controls
were removed without changing the rendering data, fallback path, source metadata or evidence bytes.

## Full evidence download

The overview links to `public/quality-register.json`, an exact copy of
`docs/geospatial-audit/layer-quality-register.json`. It contains all 98 rows, including hidden sources and
provenance that are not published as map layers. The UI displays the register ID and SHA-256 from
`catalog.layerQualityRegister`; artifact validation requires the public file to equal the hash-covered source file.

The register and catalog use `Cache-Control: no-cache`, and the service worker handles them network-first. The full
register is fetched only when requested, so the quality panel adds no upfront download beyond the existing compact
catalog fields.

## Implementation and safety

`app/js/quality.js` is a presentation-only module. It does not calculate quality, alter source metadata or load
layer geometry. All catalog-derived text is HTML-escaped. External links accept only HTTP(S), open in a new tab with
`noopener noreferrer`, and unsafe/missing URLs remain “Not recorded”. Status labels have light/dark theme styles;
the layer selector, review queue, detail actions and per-layer quality buttons are keyboard accessible.

If a custom catalog has no quality register, the panel says that no quality judgment is inferred instead of showing
an invented pass. Single-colour legends use the shared `DEFAULT_VECTOR_COLOR` constant, including after worker-based
feature preparation.

## Verification

- `tests/js_quality_test.mjs` exercises the real catalog overview, WPDx and IGRAC details, missing GADM fields,
  escaping, unsafe URL rejection, empty-catalog behavior and the single-colour fallback.
- `tests/test_quality_transparency.py` checks public-register bytes/hash, versioned shell wiring, register/cache
  headers, removal of raw GeoPackage/GeoJSON controls and JavaScript syntax.
- `scripts/validate_artifacts.py` checks the exact public register and every compact catalog projection.
- A DOM-level smoke test exercised the actual built app: overview rendering, layer-row navigation, WPDx review,
  layer selection, register link, single-colour legend and quality search. Quality rendering reused one catalog
  fetch and did not request layer data.

Run:

```bash
python scripts/build_site.py
python scripts/validate_artifacts.py
python -m unittest discover -s tests -v
node --experimental-default-type=module tests/js_quality_test.mjs
```
