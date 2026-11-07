# Raster types in this project

There are **four different things** called "raster" here. They differ in container, in payload, and
in how the app uses them.

| # | Type | GeoPackage `data_type` | Payload | Where | How the app uses it |
|---|---|---|---|---|---|
| 1 | **Coded raster** | `2d-gridded-coverage` | GeoTIFF tiles (one band, numbers) | 2 in `data/` | PNG picture + values read on tap |
| 2 | **Picture image** | `tiles` | PNG / JPEG tiles (RGBA) | 3 in `data/` | flat overlay image |
| 3 | **Picture map** | `tiles` | photo of a printed map | none in `data/` (8 documented) | overlay + a matching vector layer |
| 4 | **Basemap tiles** | — (not a file) | PNG/JPEG from a tile server | external | the background map |

---

## 1. Coded raster — `2d-gridded-coverage`

The real GIS raster. One number per cell, and the app can tell you *what* that number is.

- **Stored as**: tile pyramid + `gpkg_2d_gridded_coverage_ancillary` (datatype, scale, offset, null value, unit, field name).
- **Payload format**: GeoTIFF — the tile bytes start with `II*\0`.
- **In `data/`**: `geology_general_picture_code_rst` (8 classes, values 1–8) and
  `geology_surficial_usgs_code_rst` (values 7–44). Both 90 tiles, 5 zoom levels (0–4),
  `float32`, nodata `-9999`, unit `class code`, field `GeologyCode`.
- **Both are categorical** — the build detects this from `unit contains 'class'` / field ending in `code` /
  table ending in `_code_rst` (see `build_site.py:208`).
- **Published as two files**:
  - `<name>.png` — coloured RGBA picture (categorical → palette, continuous → viridis ramp), max 2800 px
  - `<name>.vals.gz` — the **value grid** at 1400×1118, `int16` (`-32768` = nodata), gzipped with a fixed mtime
- **Why two files**: the PNG is only pixels. The `.vals.gz` is what makes tapping the map say
  "Class 3 — Sedimentary" instead of showing a colour, and it is what area-summary counts cells with.

> 91 KB PNG + 42 KB `.vals.gz` for `geology_general_picture_code_rst`.

## 2. Picture image — `tiles`

A plain picture overlay. No values, no attributes, no tapping — it is just a scan placed on the map.

- **Stored as**: tile pyramid only (`gpkg_tile_matrix_set` + `gpkg_tile_matrix`), no ancillary tables.
- **Payload format**: whatever the source was — **PNG** (`\x89PNG`) for one, **JPEG** (`\xff\xd8\xff\xe0`) for two.
- **In `data/`**:

  | layer | tiles | zooms | payload | published |
  |---|---|---|---|---|
  | `geology_map2011_img` | 164 | 0–4 | JPEG | 1.5 MB `.jpg` (2800×2285) |
  | `minerals_map2023_img` | 143 | 0–4 | JPEG | 1.2 MB `.jpg` (2745×2234) |
  | `geology_general_picture_img` | 9 | 0–2 | PNG | 388 KB `.png` (554×442) |

- **The build re-encodes these**: it stitches the tiles, resamples rows for Web Mercator, then saves
  **JPEG quality 82 if the image is fully opaque, PNG if it has transparency** (`build_site.py:261`).
  That is why `_img` layers end up as `.jpg` and the one with alpha ends up as `.png`.

## 3. Picture map — a scanned printed sheet

Conceptually the same as type 2 (it is a `tiles` table), but it matters separately because a scan has
to be **georeferenced**, and the project keeps that provenance.

- **In `data/`**: none — the only pictures present are the two geology/minerals sheets, which are
  the source maps themselves.
- **Documented in the bundle** (`meta_picture_raster_info_tbl`, 17 rows): 8 source pictures plus 9
  rasters derived from their digitised vector layers.

  | source file | title | outline fit (IoU) |
  |---|---|---|
  | `forest-reserve-map-of-nigeria.png` | Forest reserves and major rivers | — |
  | `landcover-map-of-nigeria.png` | Land cover | 0.951 |
  | `population distribution-map-of-nigeria.png` | Population distribution | 0.976 |
  | `temperature-map-of-nigeria.png` | Average temperature 1986–2015 | 0.972 |
  | `soil-ph-map-of-nigeria.jpg` | Soil pH | 0.969 |
  | `DEM-of-map-of-nigeria.jpg` | Elevation (classified) | 0.969 |
  | `Ethnic-map-in-nigeria.png` | Ethnic groups | 0.948 |
  | `general-geology-map-of-nigeria.png` | General geology | 0.967 |
  | `dominant-soil-map-of-nigeria.jpg` | Dominant soil | 0.958 |

- Each one also carries: source projection (all "plate carrée"), how it was georeferenced (printed
  graticule vs outline fit), km/px, and its **vector companion** — the digitised layer in the bundle.
  That companion is the `*_picture_pg` layer (e.g. `landcover_picture_pg`, `soil_ph_picture_pg`).

## 4. The rasters the bundle documents but does not contain

`meta_raster_info_tbl` describes **41 rasters**, and **none of them is in `all_maps.gpkg`** — the
bundle has no tile tables and no gridded coverage at all. Two storage kinds are recorded:

| storage | count | examples |
|---|---|---|
| `float32 gridded coverage` | 38 | `elevation_srtm1km_diva_rst`, `landcover_glc2000_diva_rst`, `soil_wrb2006_isric_code_rst` |
| `PNG RGBA tiles` | 3 | `elevation_srtm1km_masked_view_img` and two other coloured renderings |

By theme, those 41 are: **climate 26** (WorldClim precip + solar radiation, monthly and annual),
**elevation 5**, **landcover 5**, **population 3**, **soil 2**. All built from GeoTIFFs
(`NGA_alt.tif`, `NGA_cov.tif`, `nga_pop.tif`, `nigeria_wrb_soil_class.tif`, `wc2.1_10m_*`).

This is the important gap: several **legend tables in the bundle point at rasters that were never
included** — `landcover_glc2000_legend_tbl`, `landcover_westafrica2013_legend_tbl` and
`meta_picture_value_legend_tbl` are orphans for exactly this reason.

## 5. Two ways a "raster" ends up as vector

Worth knowing because it decides whether you get a `.png` + `.vals.gz` or a `.geojson`:

- **Raster → vector (polygonised)**: the picture maps were digitised into `*_picture_pg` polygon
  layers. Those are ordinary GeoJSON layers, not rasters. `elevation_classes_picture_pg`,
  `soil_ph_picture_pg`, `climate_temperature_picture_pg`, `landcover_picture_pg`,
  `population_districts_picture_pg`, `ethnic_groups_picture_pg`, `soil_dominant_picture_pg`,
  `geology_general_picture_pg`.
- **Vector → raster (burned codes)**: the inverse, recorded as `*_picture_value_rst` /
  `*_picture_code_rst` in `meta_picture_raster_info_tbl` — "derived from the vector layer …".
  Only `geology_general_picture_code_rst` of that family actually exists in `data/`.

So the same concept can sit in the project as a polygon layer, a coded raster, or both.

---

## Summary

| type | files in `data/` | payload | produces | tap for value? |
|---|---|---|---|---|
| coded raster | 2 | GeoTIFF, `float32` | `.png` + `.vals.gz` | ✅ yes |
| picture image | 3 | PNG / JPEG tiles | `.jpg` / `.png` | ❌ no |
| picture map (scan) | 0 (8 documented) | PNG / JPEG tiles | `.jpg` / `.png` | ❌ no |
| basemap tiles | 0 (external) | PNG/JPEG from server | — | ❌ no |
| documented-only rasters | 0 (41 documented) | `float32 gridded coverage` / `PNG RGBA tiles` | would be either of the above | depends |

Cost per coded raster on the site: **~130 KB total** (PNG + values). Cost per picture: **0.4–1.5 MB**,
because pictures are stored at up to 2800 px.
