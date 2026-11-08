# Nigeria WebGIS (geology and minerals)

A mobile-friendly, installable map app. No backend, no API keys. Everything is static files.

## How it works
- `data/<group name>/` holds the spatial GeoPackages. Each immediate subfolder is a layer group, and its folder
  name is shown verbatim in the app. No files belong directly in `data/`. Attribute tables live inside their owning
  GeoPackage, not in standalone `*_tbl.gpkg` files.
- `scripts/build_site.py` reads every visible `.gpkg` in those group folders and writes the website into `public/`
  (GeoJSON and gzip transport sidecars, images, value grids, `catalog.json`). A filename starting with `hidden_`
  is skipped. Layer names, fields,
  colours and legends are detected automatically; group membership and group names come only from the folders.
- A GitHub Action runs the build whenever you push changes to `data/`, `app/`, `scripts/` or `config/`, and commits `public/`.
- Netlify serves `public/` (no build command needed).

## Legends live inside their layer
There is no separate legend layer and no legend widget to keep in sync. A `*_legend_*` attribute table is never
published as a layer: the build folds its rows into the layer it describes. Keep that table **inside its owner's
`.gpkg`**; do not upload a standalone `*_tbl.gpkg`. `scripts/import_missing_hidden.py` can perform this consolidation.

- Vector layers: legend columns become attributes of every feature (joined on the key column), so
  the class name, description, colour and any extra column (e.g. `points_detected`) are in the
  attribute table and in the Info panel. The Legend tab reads the same rows.
- Raster layers: every class code gets its legend label and the legend columns, shown when you tap
  the raster, in "Attributes" and in the Legend tab.

The owner of a legend table is guessed from the table names and the key column. Override it in
`config/layers.config.json`:

```json
"geology_legend_map2011_tbl": { "legendOf": "geology_units_map2011_pg", "legendKey": "unit_code" }
```

## Basemaps
Basemaps need no API key: Esri light/dark canvas and imagery, OpenStreetMap streets, OpenTopoMap.
CARTO tiles are deliberately not used — since August 2026 the free CARTO tiles are stamped with an
"API KEY REQUIRED" watermark when no key is supplied.

## The app
The map is built for **readers**. Whoever uploads the GeoPackages owns the content; everyone else opens
the site to look at it. So the tools are about *seeing and analysing*, not authoring: nothing a visitor
touches changes the data, and no visitor is asked to import, style or label anything.

### Focus on an area (the main viewing tool)
Nigeria-wide layers are noisy. **Clip to an area** (Tools -> *Clip to an area*, or the **Clip** button
in Layers) restricts the map to one shape:

- **drag a box**, **draw a polygon** (tap corners, *Done* to close), **borrow a polygon from any layer**
  (tap a state, an LGA, a geological unit), **use the current view**, or **tap "Focus on it"** on any
  legend entry;
- everything outside fades back, and only features inside are drawn and picked;
- the status bar shows the area in km² and the edge length, and **Area summary** counts what is inside;
- the focus area is remembered on the device and travels with the saved view.

Press **Esc** to cancel a drawing. The focus chip turns green while a focus area is active; tapping it
again lets you change or clear it, and the same link appears in the Legend and Info panels.

### Analysis tools
- **Select by area** — tap a polygon of any layer and every feature inside it is listed, counted by
  layer, and exportable as CSV. It uses the real boundary, so a state or LGA outline works as a rubber band.
- **Area summary** — for every layer on the map: how many features (or raster cells) lie inside the
  focus area, the share of the layer, the summed area of the polygons and the top raster classes.
- **Chart a field** — histogram of any numeric column or a ranked count of any text column, limited to
  the focus area when one is active.
- **Layer statistics** — totals, averages, biggest features, and min/mean/max for numeric columns.
- **Group into classes** — reclassify a numeric field (quantile or equal interval) to see its pattern.
- **Filter features** — show only the rows that match a column.
- **Attribute table** — browse, sort, search and export every row.
- **Measure distance / area, distance & bearing, grid lines** for quick ground-truthing.
- Hovering the map names the feature under the pointer; tapping gives area, perimeter, compactness,
  rank ("54th largest of 1,485 polygons"), share of the layer and of Nigeria, centroid, UTM zone,
  distance to Abuja and the nearest neighbours for points.

### Layers, legend, info
**Layers** — every layer grouped by theme, and the layers currently on the map at the top (the one you
switched on last is on top and is drawn on top). Drag the ⠿ handle to reorder. The layer tools live here:
show all, hide all, fit visible, **clip**, grid, labels, clear filters.

**Legend** — the legend of everything that is on the map. Tap an entry to zoom to it, **focus on it**,
show only that class, or (in author mode) add it as a label. Raster classes work the same way: the
extent of a class is read from the value grid, so zooming and focusing land on that class.

**Info** — attributes and facts for whatever you tap, and a link back to the whole map when a focus
area is active.

**View** — reset the view, full screen, and a **back** button (bottom-right) that returns to the previous
extent after you have zoomed around.

### Author mode
The owner's tools — import GeoJSON, symbology, class grouping, adding labels, label list, and the full
reset — are hidden from visitors. Open the site with **`?author=1`** to get them, and *Leave author
mode* to go back to the reader view. To hand them to every visitor, set `"authorMode": true` under
`app` in `config/layers.config.json`.

Colours, filters, classifications, labels, the focus area and the panel order are kept in
`localStorage`, so a reload does not lose your view. "Reset the view" (everyone) clears filters and the
focus; "Reset the work" (author mode) clears everything.

For scripting and support the console exposes `window.__nwg` (`map`, `L`, `stack`, `annotations`,
`setFocus`, `focusFromLonLat`, `stopFocus`, `focusAreaKm2`, `toolAoi`, `runQuery`, `rasterClassAnchor`,
`layerRank`).

## Loading performance

Vector layers retain their original GeoJSON downloads and also publish deterministic `.geojson.gz` transport
sidecars. A module worker handles fetching, decompression, JSON parsing and typed-geometry conversion off the UI
thread; compatible browsers without those APIs use a yielding fallback. A shared scheduler limits all layer loads
to two at once and deduplicates repeated requests. The current 43 vector sidecars are **83.9% smaller** than their
original representations. See [map loading performance](docs/map-loading-performance.md) for measurements,
fallback behavior and the exact round-trip validation gates.

## Setup
1. Create a GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Netlify: Add new site -> Import from GitHub -> pick the repo. Publish directory `public` (already set in `netlify.toml`).
3. Done. The site is live; the first page load already works because `public/` is included.

## Updating
Create or choose a top-level group folder, then add, replace or edit a `.gpkg` inside it and push. The Action
rebuilds and Netlify redeploys. For example:

```text
data/
├── Geology/
│   ├── geology_units_map2011_pg.gpkg
│   └── geology_faults_map2011_ln.gpkg
├── Mineral resources/
│   └── minerals_occurrences_map2023_pt.gpkg
├── My custom group/
│   └── any_layer_name.gpkg
└── Settlements/
    └── hidden_settlements_gazetteer_diva_pt.gpkg
```

- **Hide a layer:** add `hidden_` to the start of its GeoPackage filename, for example
  `hidden_water_rivers_map2011_ln.gpkg`. The build skips the entire file without opening it.
- **Show a hidden layer:** remove only the `hidden_` filename prefix and rebuild. Its table name and layer ID stay
  unchanged, while its folder continues to control the group. This works for every table contained in that GeoPackage.
- **Create a group:** create a folder in `data/`. Its exact name—including spaces and capitalisation—is its display name.
- **Rename a group:** rename the folder. **Move a layer to another group:** move its `.gpkg` to that group's folder.
  Filename prefixes and table names no longer affect grouping.
- Additional nested folders are allowed for organisation; the **top-level** folder still determines the group.
- The build stops with a clear error if any file is directly in `data/`. Put it in a group folder instead of relying on
  an automatic fallback. Since `/` cannot occur in a folder name, use another separator such as ` - ` in group names.
- Names and columns are not fixed. Optional layer labels, layer order, default-visible layers, label fields and colours
  go in `config/layers.config.json`. Its `groups` section controls **group order only** and is keyed by the exact folder
  name; per-layer `group` overrides are not used.
- Declare the new layer's geographic scope in `config/cross-border-policy.json` when the safe default is not
  sufficient. Regenerate the policy register and catalog, and do not silently remove foreign or transboundary features.
- GitHub rejects files over 100 MB; keep each gpkg below that.

### Import master layers without publishing them

The original `files/all_maps.gpkg` import is complete and that folder has been removed. To repeat the process with an
external master GeoPackage:

```bash
python scripts/import_missing_hidden.py --master /path/to/all_maps.gpkg
```

The utility compares the master with both visible and hidden tables already in `data/`. It imports only missing
spatial layers as `data/<group>/hidden_<table>.gpkg`, never replacing an existing layer. It also embeds standalone
attribute-table GeoPackages into the owners configured with `legendOf`, then removes the redundant table files.
Attribute tables whose real owner is absent remain only in the master rather than being attached to an unrelated
layer. The command is idempotent, so running it again imports nothing and changes nothing.

### Reduce GeoPackage size losslessly

```bash
python scripts/optimize_gpkg.py --dry-run   # report only; writes nothing
python scripts/optimize_gpkg.py             # apply and VACUUM changed files
```

The optimizer removes empty/blank-only attribute columns and columns with at most one distinct non-blank value.
Geometry, primary keys and configured legend join keys are preserved, and stale label-field references are removed
from the layer config. It also uses smaller lossless DEFLATE TIFF tiles when an exact dtype, shape and cell-value
read-back check passes. Vector geometries and picture overlays are never simplified or recompressed.

### Administrative identifiers

States, LGAs and wards have persistent `ngmap-admin-v1` identifiers that do not depend on display names or
GeoPackage export FIDs. Use `admin_id` for the entity itself, `state_admin_id` for its state, and
`lga_admin_id` for a ward's LGA. LGA polygons and centroids share IDs; population-state polygons and
state capitals reference state IDs. Assigned IDs are exported both as GeoJSON feature `id` members and
as properties. Water body / Lake Chad remain non-administrative and have null IDs.

The IDs are repository-issued, not statutory codes. A separate INEC crosswalk covers every state/LGA and
8,589 of 8,809 wards; the other 220 external ward links remain null rather than being guessed. See
[the identifier guide and stability rules](docs/admin-identifiers/README.md) and
[the installation evidence](docs/geospatial-audit/admin-identifier-resolution.md). Run
`python scripts/introduce_admin_identifiers.py` to verify the installed registry without changing data.

### Cross-border geographic scope

`ngmap-cross-border-v1` defines how foreign, transboundary, coastal/marine, regional-reference, map-sheet,
and raster-window content is retained and aggregated. Sources are never clipped or deleted merely for
crossing the diagnostic Nigeria boundary. Nigeria-only counts require an explicit analysis mask; national
area/length measurements use documented clipped derivatives, while whole transboundary totals are reported
separately. NoData remains unknown, and Water body / Lake Chad is not Nigerian administration or wholesale
Nigerian land.

Read the [cross-border data policy](docs/cross-border-data-policy.md) and
[per-layer register](docs/geospatial-audit/cross-border-policy-register.csv) before producing national
statistics. The public catalog exposes the same rules as `crossBorderPolicy` and per-layer `crossBorder`
metadata. These fields guide interpretation; the generic focus-area summary is not an automatic country
filter or a legal sovereignty determination.

### Layer quality and metadata register

`ngmap-layer-quality-v1` consolidates all 98 source layers into
[JSON](docs/geospatial-audit/layer-quality-register.json),
[CSV](docs/geospatial-audit/layer-quality-register.csv), and a
[readable register](docs/geospatial-audit/layer-quality-register.md). Each row records source hashes, CRS,
bounds, attributes or raster grid details, structural/topology checks, reviewed use limits, publication,
cross-border rules, attribution, temporal coverage, licence/terms status, and explicit metadata gaps.
`config/layer-metadata.json` is the curated source registry; hidden originals inherit their active source.

Quality classes are not numeric accuracy scores, structural passes are not survey certification, and
metadata completeness is not licence clearance. Unknown values remain unrecorded rather than being guessed.
The public catalog exposes compact `quality` and `sourceMetadata` fields and a register summary/hash. In the map,
the **Quality & source** tab, per-layer links and feature results expose those checks, limitations, licences,
temporal coverage and explicit gaps. Users can download the exact hash-covered 98-layer JSON register; published
and all-source gap counts are labelled separately. See the [quality UI guide](docs/map-quality-ui.md).
Run `python scripts/layer_quality_register.py` after both audits and before the final public build. Rerun the
extended audit afterwards so its item 8 summary uses the current register. When the layer inventory changes,
run one provisional public build before the register so its public-export fields are current, then the final build.

### Geospatial quality audit

```bash
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/layer_quality_register.py
python scripts/audit_geospatial_extended.py  # include the current register in the report
python scripts/build_site.py
```

The two-stage audit covers every visible and hidden GeoPackage: CRS and extent integrity, geometry validity,
administrative containment, independent place/boundary comparisons, cross-layer line distances, raster grids and
raster/vector registration. It writes a professional report, a per-layer review register, diagnostic figures and
exception CSVs to `docs/geospatial-audit/`. The audit never shifts or repairs source geometry automatically.

Read the [current audit report](docs/geospatial-audit/README.md) and its limitations before treating any layer as
ground truth. In particular, visual overlap and a shared EPSG code are not proof of correct absolute coordinates.

### Automated CI validation

The [Validate geospatial data and site workflow](.github/workflows/validate.yml) runs on pull requests to `main`,
pushes to `main`, and manual dispatch. It compiles the Python sources, checks every GeoPackage and generated audit or
public artifact, and runs the full regression suite with a read-only repository token.

Run the same checks locally from the repository root:

```bash
python -m pip install -r scripts/requirements.txt
python -m compileall -q scripts tests
python scripts/validate_artifacts.py
python -m unittest discover -s tests -v
```

`validate_artifacts.py` is read-only. It checks SQLite integrity, source/audit/public inventory consistency, staging
file absence, JSON and GeoJSON parsing, CSV structure, PNG integrity, and exact cross-border/quality-register
agreement. The regression suite additionally verifies correction evidence and hashes, source/public geometry
agreement, source metadata, precision fallbacks, and every published geometry.

With Node.js 22.17 or newer, the real-Chromium suite adds browser interactions, gzip-worker loading, offline reload,
service-worker deployment updates, and desktop/mobile visual comparisons without external tiles or a browser CDN:

```bash
npm ci
npm run test:browser
```

See [browser, offline and visual-regression testing](docs/browser-testing.md) for focused commands, snapshot update
procedures, deterministic network/font setup, and failure traces. Node packages are development-only and are not used
by the published static application.

The reviewed state-capital correction is complete: 32 scanned-map positions were replaced individually with OSM
city/town nodes and five corroborated gazetteer positions were retained. The original is hidden as
`settlements_state_capitals_map2023_original_pt`; previous coordinates and QA remain in the visible attributes.
See `docs/geospatial-audit/capital-correction-ledger.csv` and `capital-correction-result.json`. OSM is the
construction source for those replacements, not independent validation; the audit reports both all-source DIVA
comparisons and a strict held-out subset. `scripts/correct_state_capitals.py` refuses to overwrite the correction
or its provenance.

The reviewed polygon-topology correction is also complete: GEOS MakeValid repaired 191 invalid geometries across
16 layers without changing feature IDs, attributes or any originally valid geometry blob. The 16 full source copies
are hidden as `*_topology_original`; current audit counts exclude those historical provenance defects. Three
large-area interpretations and one collapsed-line envelope reduction have explicit review dispositions. All 22
exact geology raster/vector class checks are unchanged. Run `python scripts/correct_polygon_topology.py` to verify
the installed correction without reapplying it, and see `topology-correction-ledger.csv`,
`topology-correction-verification.json` and `topology-correction-result.json` in the audit directory.
The static exporter retains its compact five-decimal default but checks non-point output validity; only features
that would be broken by rounding are re-exported at the minimum valid precision (up to full double precision).
Those per-layer fallback counts are recorded as `geometryPrecisionFallbacks` in `public/catalog.json`.

## Updates on the deployed site (no hard refresh)
A deploy is picked up by itself:

- `sw.js` is served `no-store` and registered with `updateViaCache: 'none'`, so the worker script is
  never read from an HTTP cache.
- The build stamps the shell with a build id (`css/app.css?v=…`, `js/app.js?v=…`, and the `engine.js`
  import), so a new deploy can never be mixed with cached files. `index.html`, `sw.js`, `catalog.json`
  and the manifest are sent `no-cache`; JS/CSS/data are sent `must-revalidate` (see `netlify.toml`).
- The app requests an update check when it loads, whenever the tab becomes visible again, when the
  device comes back online, and every 15 minutes.
- When a new worker takes over, the page saves the project to `localStorage` and reloads once by
  itself (`controllerchange`). A first-ever install never reloads.
- The current build id is shown in **Tools → About** (and in `window.__nwg.build`), so you can tell
  which version a phone is running.

The only exception is a device that still has a worker from before this mechanism existed: the old
worker serves its cached page first, and that old code cannot update itself, so it needs one last
normal reload. From then on deploys arrive without anyone clearing anything.

## Netlify's "Powered by Netlify" badge
That button is not part of this code — Netlify injects an iframe (`#nl-badge-frame`) at the bottom
right of sites on the free plan. `app/css/app.css` hides it, so it no longer blocks the bottom
toolbar. To remove it properly, open the Netlify dashboard: **Project configuration → General →
Powered by Netlify badge** and switch it off (that setting needs a paid team on some accounts).

## Local build
    pip install -r scripts/requirements.txt
    python scripts/build_site.py
    cd public && python -m http.server
