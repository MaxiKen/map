# Nigeria WebGIS (geology and minerals)

A mobile-friendly, installable map app. No backend, no API keys. Everything is static files.

## How it works
- `data/` holds one GeoPackage per layer (vector, raster, image or table).
- `scripts/build_site.py` reads every `.gpkg` in `data/` and writes the website into `public/`
  (GeoJSON, images, value grids, `catalog.json`). Layer names, fields, colours and legends are detected automatically.
- A GitHub Action runs the build whenever you push changes to `data/`, `app/`, `scripts/` or `config/`, and commits `public/`.
- Netlify serves `public/` (no build command needed).

## Legends live inside their layer
There is no separate legend layer and no legend widget to keep in sync. A `*_legend_*` table is never
published as a layer: the build folds its rows into the layer it describes.

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
**Layers** — every layer, grouped by theme, plus the layers currently on the map at the top
(the one you switched on last is on top, and it is drawn on top). Drag the ⠿ handle to reorder
layers; the layer tools (show all, hide all, fit visible, grid, labels, clear filters) are here.

**Legend** — the legend of everything that is on the map. Tap an entry to zoom to it, to show only
that class, or to add it to the map as a **label**. Labels are dragged on the map and edited in the
label panel (text, size, colour, halo, bold/italic, rotation).

**Info** — attributes of whatever you tap, plus facts: area, perimeter, compactness, rank
("54th largest of 1,485 polygons"), share of the layer and of Nigeria, centroid, UTM zone,
bounding box, distance to Abuja, nearest neighbour for points. Raster taps show the class name
and the legend columns.

**Tools**
- Starter: add a label, measure distance, measure area, go to coordinates, save the map as a PNG, grid lines.
- Everyday GIS: symbology (fill, stroke, width, dash, marker shape/size, labels), feature labels,
  reclassify a numeric field (quantile / equal interval, colour ramp), filter features, layer statistics, zoom to a layer.
- Advanced: import GeoJSON, export visible layers / CSV / PNG, attribute table, distance & bearing.

Colours, filters, classifications, labels and the panel order are kept in `localStorage`, so a reload
does not lose the work. "Reset the work" in Tools clears it.

## Setup
1. Create a GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Netlify: Add new site -> Import from GitHub -> pick the repo. Publish directory `public` (already set in `netlify.toml`).
3. Done. The site is live; the first page load already works because `public/` is included.

## Updating
- Add, replace or edit a `.gpkg` in `data/` (any name; the prefix before the first `_` becomes the group) and push. The Action rebuilds and Netlify redeploys.
- Names and columns are not fixed. Optional labels, groups, order, default-visible layers, label field and colours go in `config/layers.config.json`.
- GitHub rejects files over 100 MB; keep each gpkg below that.

## Netlify's "Powered by Netlify" badge
That button is not part of this code — Netlify injects an iframe (`#nl-badge-frame`) at the bottom
right of sites on the free plan. `app/css/app.css` hides it, so it no longer blocks the bottom
toolbar. To remove it properly, open the Netlify dashboard: **Project configuration → General →
Powered by Netlify badge** and switch it off (that setting needs a paid team on some accounts).

## Local build
    pip install -r scripts/requirements.txt
    python scripts/build_site.py
    cd public && python -m http.server
