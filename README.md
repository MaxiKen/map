# Nigeria WebGIS (geology and minerals)

A mobile-friendly, installable map app. No backend. Everything is static files.

## How it works
- `data/` holds one GeoPackage per layer (vector, raster, image or table).
- `scripts/build_site.py` reads every `.gpkg` in `data/` and writes the website into `public/`
  (GeoJSON, images, value grids, `catalog.json`). Layer names, fields, colours and legends are detected automatically.
- A GitHub Action runs the build whenever you push changes to `data/`, `app/`, `scripts/` or `config/`, and commits `public/`.
- Netlify serves `public/` (no build command needed).

## Setup
1. Create a GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Netlify: Add new site -> Import from GitHub -> pick the repo. Publish directory `public` (already set in `netlify.toml`).
3. Done. The site is live; the first page load already works because `public/` is included.

## Updating
- Add, replace or edit a `.gpkg` in `data/` (any name; the prefix before the first `_` becomes the group) and push. The Action rebuilds and Netlify redeploys.
- Names and columns are not fixed. Optional labels, groups, order, default-visible layers, label field and colours go in `config/layers.config.json`.
- GitHub rejects files over 100 MB; keep each gpkg below that.

## Local build
    pip install -r scripts/requirements.txt
    python scripts/build_site.py
    cd public && python -m http.server
