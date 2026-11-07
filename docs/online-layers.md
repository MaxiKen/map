# Six new online layers — sources and provenance

Added 2026-11-07. These six concepts had **no layer of any kind** in the project
(see the gap survey in `docs/other-online-layers.md`). They were fetched from
public, key-free sources, cropped to Nigeria, written as standalone GeoPackages in
`data/`, registered in `config/layers.config.json` and published by
`python scripts/build_site.py`. The earlier five climate/elevation/soil rasters are
documented separately in `docs/raster-sources.md`.

The project's rule **mostly vectors, rasters only for continuous fields** is kept:
the three continuous fields (built-up surface, 100-year inundation depth, population
count) are `2d-gridded-coverage` rasters; the five discrete datasets are feature
layers. One standalone `.gpkg` per layer, zero new table layers, all new layers
default **off**.

Every layer covers `2.5–15.0°E, 4.0–14.0°N` in EPSG:4326; rasters are additionally
clipped to the geoBoundaries national outline (`−9999` = NoData).

## What was added

| Concept | File in `data/` | Kind | Features / grid | Source | Licence |
|---|---|---|---|---|---|
| Settlement extents | `settlements_extents_grid3_pg.gpkg` | polygon | 12,000 | GRID3 NGA Settlement Extents v3.1 (CIESIN / Columbia, HDX) | CC BY-SA 4.0 |
| Built-up areas | `settlements_builtup_ghsl2020_rst.gpkg` | raster | 500 × 400, 0.025° | JRC GHSL `GHS-BUILT-S` epoch 2020, R2023A, 30 arc-sec | JRC / EC, CC BY 4.0 |
| River basins | `water_basins_fao_pg.gpkg` | polygon | 83 | FAO AQUASTAT *Hydrological basins in Africa* (HydroSHEDS-derived) | FAO, free with attribution |
| Flood hazard | `hazards_flood_aqueduct_rst.gpkg` | raster | 500 × 400, 0.025° | WRI Aqueduct Floods Hazard Maps v2, baseline riverine 1-in-100-year | WRI, CC BY 4.0 |
| WorldPop 100 m gridded population | `population_worldpop2025_rst.gpkg` | raster | 1400 × 1120, ~0.0089° (~1 km) | WorldPop NGA population v3.0 (2025), 3 arc-sec | CC BY 4.0 |
| Airports | `infrastructure_airports_osm_pt.gpkg` | point | 1,571 | HOT OSM country export, HDX, snapshot 2026-11-02 | ODbL (© OpenStreetMap contributors) |
| Sea ports | `infrastructure_seaports_osm_pt.gpkg` | point | 451 | HOT OSM country export, HDX, snapshot 2026-11-02 | ODbL |
| Points of interest | `infrastructure_pois_osm_pt.gpkg` | point | 60,490 | HOT OSM country export, HDX, snapshot 2026-11-02 | ODbL |
| — | `hazards`, `infrastructure` groups | — | — | `config/layers.config.json` | — |

Catalog after the build: **49 layers, 17 groups, 10 rasters, 0 table layers**,
build `627de1bd83`.

## Exact source URLs

```
# GRID3 settlement extents v3.1 (HDX; 735,773,991-byte ZIP holding a 1.74 GB GeoPackage)
https://data.humdata.org/dataset/af838671-b9a6-4ae9-8ed5-eea750b05597/resource/0a22d6fc-7f1f-4f50-aead-09ef7be0455d/download/grid3_nga_settlement_extents_v3_1_gpkg.zip
# HDX dataset record: GRID3 - Nigeria - Settlement Extents v3.1, CC BY-SA 4.0
https://data.humdata.org/api/3/action/package_show?id=af838671-b9a6-4ae9-8ed5-eea750b05597

# JRC GHSL built-up surface, epoch 2020, 30 arc-second, EPSG:4326 (187,081,725-byte ZIP)
https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E2020_GLOBE_R2023A_4326_30ss/V1-0/GHS_BUILT_S_E2020_GLOBE_R2023A_4326_30ss_V1_0.zip
https://ghsl.jrc.ec.europa.eu/

# FAO AQUASTAT hydrological basins in Africa (4,255,526-byte ZIP, ESRI shapefile)
https://storage.googleapis.com/fao-maps-catalog-data/geonetwork/aquamaps/hydrobasins_africa.zip
https://data.apps.fao.org/catalog/dataset/e54e2014-d23b-402b-8e73-c827628d17f4

# WRI Aqueduct Floods v2, 100-year baseline riverine inundation depth (92,162,308-byte GeoTIFF)
https://aqueduct.wridata.org/AqueductFloods20/inunriver_historical_000000000WATCH_1980_rp00100.tif
https://aqueduct.wridata.org/AqueductFloods20/index.html
https://datasets.wri.org/datasets/aqueduct-floods-hazard-maps

# WorldPop NGA population v3.0 gridded counts (45,731,850-byte ZIP -> 50,221,869-byte GeoTIFF)
https://data.worldpop.org/repo/wopr/NGA/population/v3.0/NGA_population_v3_0_gridded.zip
https://data.worldpop.org/repo/wopr/NGA/population/v3.0/NGA_population_v3_0_README.pdf
https://www.worldpop.org/

# HOT OSM GPKG country exports (ODbL)
https://production-raw-data-api.s3.amazonaws.com/ISO3/NGA/airports/hotosm_nga_airports_osm_gpkg.zip
https://production-raw-data-api.s3.amazonaws.com/ISO3/NGA/sea_ports/hotosm_nga_sea_ports_osm_gpkg.zip
https://production-raw-data-api.s3.amazonaws.com/ISO3/NGA/points_of_interest/hotosm_nga_points_of_interest_osm_gpkg.zip
```

## Method

`.github/workflows/fetch-layers.yml` runs `scripts/fetch_layers.py` on a GitHub
Actions runner. The sandbox this repository is edited in cannot reach those hosts
directly, so the same CI-relay pattern as `docs/raster-sources.md` is used: the
workflow downloads, converts and commits only the finished `.gpkg` files.

- **Download / extract.** `urllib` streams each source into `/tmp/nga_layers`;
  ZIPs are expanded there. Nothing except the eight output `.gpkg` files is kept.
- **Rasters.** `rasterio.WarpedVRT` warps each global or national GeoTIFF onto the
  Nigeria window with an explicit output transform and `float32` destination.
  - WorldPop: `Resampling.sum` adds the 3 arc-second counts falling inside each
    ~1 km cell, ignoring the source's NaN NoData; empty cells become 0 people.
    This keeps national totals correct (an average-of-valid-cells approach inflated
    them ~4×).
  - GHSL: `Resampling.average` of built-up surface (m² per 30 arc-sec source cell).
  - Aqueduct: `Resampling.max` of inundation depth, so narrow 30 arc-second river
    floodplains are not averaged away; unmapped / dry cells are 0 m.
  - All three are then masked with the national outline rasterised at the output
    resolution. `scripts/make_raster_gpkg.py` writes one float32 GeoTIFF tile plus
    the `gpkg_contents` / tile-matrix / ancillary / extension rows.
- **Vectors.** `pyogrio` / `geopandas` read the source, keep a short attribute
  selection, reproject to EPSG:4326 and clip to the map window.
  - GRID3 has 745,191 multipolygons in a 1.74 GB GeoPackage. An OGR SQL
    `ORDER BY building_area DESC LIMIT 14000` reduction is done inside GDAL, then
    geometries are simplified to 0.0015° and the largest 12,000 are written. This
    is a **generalised national overview**, not the full 745k-feature extract; the
    full v3.1 extents (or the 3.4 GB v4.0 / the newer v4.1 GPKG) should be used
    for settlement-level analysis.
  - FAO basins are intersected with the map window (83 sub-basins remain) and
    simplified to 0.002°; `SUB_NAME` / `MAJ_NAME` / areas are kept.
  - OSM exports mix points, lines and polygons. Every feature is reduced to one
    representative point (centroid for non-points) and the admin p-code columns
    are dropped, so the published layers are true `POINT` layers.
- **Publish.** `python scripts/build_site.py` converts WKB geometry to GeoJSON and
  emits a `.png` + `.vals.gz` pair per raster (≤2800 px image, ≤1400 px value grid,
  Mercator-resampled rows). New layers are default-off and ordered 65–72.

## Validation

- All eight GeoPackages open in SQLite; `gpkg_contents` reports `features` or
  `2d-gridded-coverage`, `srs_id = 4326`, and `gpkg_geometry_columns` reports
  `POINT` / `POLYGON` / `MULTIPOLYGON` as appropriate.
- Raster masks cover ~60% of each grid (the Nigeria outline). Valid ranges after
  the final re-run:
  - built-up surface 0 – 558,837 m² per source cell, mean 7,537;
  - 100-year riverine inundation depth 0 – 14.04 m, 86% of cells dry;
  - population 0 – 56,444 people per ~1 km cell; **sum 237.5 million**, consistent
    with WorldPop's 2025 Nigeria estimate.
- Row counts: GRID3 extents 12,000 (1,896 Built-up Area + 10,104 Small Settlement
  Area), basins 83, airports 1,571, sea ports 451, POIs 60,490.
- Catalog after rebuild: 49 layers / 17 groups / 10 rasters / **0** table layers,
  build `627de1bd83`. Site `catalog.json`, GeoJSON and raster value grids served
  over HTTP 200 in the live preview.

## Licences and attribution

- **GRID3 / CIESIN** settlement extents — CC BY-SA 4.0; derived products must
  carry the same licence. Cite *GRID3 Nigeria Settlement Extents v3.1*.
- **JRC GHSL** — European Commission, Joint Research Centre; `GHS-BUILT-S`
  R2023A is released under CC BY 4.0. Cite *Pesaresi & Politis (2023)*.
- **FAO AQUASTAT** — free for use with attribution; HydroSHEDS-derived basins
  (Lehner & Grill 2013) require acknowledgement of the HydroSHEDS core data.
- **WRI Aqueduct Floods v2** — CC BY 4.0. Cite *Winsemius et al.* and WRI.
- **WorldPop v3.0** — CC BY 4.0. Operational population estimates are **not**
  official statistics; cite *WorldPop (2025), Nigeria v3.0*.
- **HOT OSM / OpenStreetMap** — ODbL 1.0; © OpenStreetMap contributors. Any
  public derivative of these three layers must be shared alike and attributed.

The five earlier rasters have their own licence notes in `docs/raster-sources.md`.

## Source reachability notes (CI probes, 2026-11-07)

- `data.hydrosheds.org/file/hydrobasins/standard/hybas_af_lev01-12_v1c.zip`
  returned **HTTP 403 from GitHub Actions** for both HEAD and browser-UA GET;
  the HDX mirror of that same URL is flagged `broken_link: true`. The FAO AQUASTAT
  mirror of the Africa basins was used instead.
- `wri-projects.s3.amazonaws.com/AqueductFloodTool/download/v2/…` returns 404;
  `aqueduct.wridata.org/AqueductFloods20/…` returns 200 for the same file name.
- The old GRID3 "version 02" download URL is 404; use the HDX v3.1 record above.
  `figshare.com/s/dc2318c9884f57b22c0d` (Nigeria flood susceptibility) is 403 to
  the page fetcher, so this batch used WRI Aqueduct instead.
- `GHS_BUILT_S_E2018_GLOBE_R2023A_4326_30ss/` is 404; the E2020 30ss V1-0 folder
  is the current one.

## Reproduce

```
gh workflow run fetch-layers.yml            # or push a change to scripts/fetch_layers.py
python scripts/build_site.py                # regenerate public/ from data/
```

The workflow commits changed `data/*.gpkg` with `[skip ci]`; the site build is a
separate step (`.github/workflows/build-site.yml` or the command above).
