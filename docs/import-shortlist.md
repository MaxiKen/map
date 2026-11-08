# Import short-list — analysed against your criteria

Rules applied, in your words:

1. **Vectors first.** Take the vector wherever it represents the concept well.
2. **Raster only where vector can't work** (DEM, continuous fields) — ethnic is the worked example of
   the opposite: its vector is good, so vector wins.
3. **Nothing already in the project.** All 14 geology/minerals layers and the 5 rasters already in
   `data/` are out.
4. **No table layers.** Every table must be folded into the layer it belongs to.

---

## ⚠ Blocker at the time: the rasters did not exist as files

> **Update 2026-11-07:** the missing rasters were fetched from source and added — see
> `docs/raster-sources.md`. The section below records the original state of the bundle.

`all_maps.gpkg` contains **only** `features` and `attributes` — 0 tile tables, 0 gridded coverages.
`meta_raster_info_tbl` *describes* 41 rasters, but there is not one `.tif` anywhere in the repo
(I searched for `.tif/.tiff/.asc/.nc` — nothing).

So the raster side of your plan **cannot be built from what is in the repo today**. The vector side
can, entirely. The rasters you name below need their source GeoTIFFs supplied first, then a
one-time conversion to GeoPackage (`2d-gridded-coverage`), which is how the two rasters already in
`data/` are stored.

---

## Part 1 — Vectors to import: 18 layers

Sizes are estimated GeoJSON cost. "Absorbs" means the table becomes attributes of that layer — no
table layer is published.

### Administrative boundaries (5)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 1 | `admin_country_geoboundaries_pg` | 1 | 0.12 MB | the light national outline (the `esri` twin is 3.0 MB for the same shape) |
| 2 | `admin_states_gadm_pg` | 38 | 3.22 MB | canonical 36 states + FCT, with state codes |
| 3 | `admin_lgas_gadm_pg` | 775 | 4.51 MB | all LGAs, with alt names and area |
| 4 | `admin_lga_centroids_pt` | 774 | 0.08 MB | one point per LGA — **absorbs `admin_senatorial_districts_tbl`** |
| 5 | `admin_wards_pt` | 8,809 | 0.52 MB | finest admin unit available |

`admin_senatorial_districts_tbl` → folded into **#4**. Verified: 109 districts in the table, 109 in
the centroids, **109 match, zero orphans**.

### Population (1)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 6 | `population_density2016_states_pg` | 38 | 3.22 MB | the only real population numbers in the bundle |

⚠ **This duplicates #2.** Both are 38 state polygons, but they are *different drawn boundaries*
(0 of 38 geometries identical), so you would be shipping the state outline twice for +3.2 MB.
How to resolve — pick one:
- keep **#2** (`states_gadm`) as the admin reference and drop #6 → simpler, lighter; or
- keep **#6** and drop #2 → you get states *and* population in one layer.

I have kept #6 in the list because population is otherwise absent from the whole map. Say the word
and I drop one.

### Settlements (2)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 7 | `settlements_places_osm_pt` | 51,230 | 3.08 MB | the settlement base layer — 41,078 distinct names |
| 8 | `settlements_state_capitals_map2023_pt` | 37 | ~0 | all 37 capitals, already cross-checked against OSM |

`settlements_gazetteer_diva_pt` (43,021) is held back: **85 % of its names are already in #7**
(29,979 of 35,414), so it is largely the same points twice.
`settlements_towns_map2023_pt` (478 active points after quarantining one scanned “Tow ns” legend
artefact) is also held back: 71 % of it is already in #7 — it is the 2023 sheet's own label set,
useful only for cross-checking the picture.

### Transport (2)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 9 | `transport_roads_diva_ln` | 4,708 | 1.18 MB | full road network with road-type attributes |
| 10 | `transport_railways_diva_ln` | 33 | 0.03 MB | rail with status and track type |

The four `*_map2011_ln` / `*_map2023_ln` sheet-traced road and rail layers are held back: they are
sparse tracings of the printed sheets (246 / 259 / 6 / 7 features) and would sit on top of the
complete DIVA network as near-duplicates.

### Water (2)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 11 | `water_lines_diva_ln` | 5,162 | 1.94 MB | full river network, perennial vs seasonal |
| 12 | `water_areas_diva_pg` | 1,186 | 0.86 MB | named lakes and reservoirs |

The 2011/2023 sheet river tracings (`water_rivers_map2011_ln` 784, `water_rivers_map2023_ln` 865)
are held back — same reason as the roads: subset tracings of #11.

### Land cover (1)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 13 | `landcover_cgls2019_pg` | 14 | 7.02 MB | CGLS 2019, whole country — **absorbs `landcover_cgls2019_legend_tbl`** |

⚠ **The most expensive layer in the list.** 14 polygons cost 7 MB because the coastal outlines carry
very dense vertices. If size matters, this is the one to simplify first (a 10–20 m tolerance would
cut it by most of that) — tell me and I'll do it in the import.

This is exactly your "ethnic" case, in reverse: land cover *is* well represented as vector, which is
why I am **not** proposing `landcover_cgls2019_code_rst` — the 14-class vector carries the same
information and stays queryable.

### Soil (1)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 14 | `soil_wrb2006_isric_pg` | 17 | 6.92 MB | WRB 2006 soil groups — **absorbs `soil_wrb2006_isric_legend_tbl`** and `soil_wrb2006_groups_tbl` |

Same story as land cover: the vector is the better representation, so the soil raster is not needed.

### Ethnicity (1) — your worked example

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 15 | `ethnic_areas_anthromapper_pg` | 118 | 1.50 MB | 118 ethnic areas with cluster, alt names and source date |

Vector wins, so `ethnic_groups_picture_pg` (34 coarse areas) and the
`ethnic_groups_picture_code_rst` raster both stay out. ✅ matches what you said.

### Forest (2)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 16 | `forest_osm_pg` | 757 | 0.72 MB | current forest cover, named |
| 17 | `forest_reserves_water_picture_pg` | 1,120 | 0.71 MB | gazetted reserves + major rivers |

These two are **complementary, not duplicates** — OSM forest is vegetation, reserves are a legal
designation. Both earn their place.

### Protected areas (1)

| # | Layer | Rows | Size | Why it stays |
|---|---|---|---|---|
| 18 | `protected_areas_wdpa_pg` | 967 | 1.26 MB | richest attributes of any new layer: IUCN category, governance, status year, authority |

---

## Part 2 — Table integration

You said no table layers. Four tables survive, all absorbed into a layer above — **solved at build
time, nothing for you to do**:

| Table | Rows | Becomes attributes of | Join key | Verified |
|---|---|---|---|---|
| `admin_senatorial_districts_tbl` | 109 | `admin_lga_centroids_pt` (#4) | `senatorial_district` | 109/109 match |
| `landcover_cgls2019_legend_tbl` | 14 | `landcover_cgls2019_pg` (#13) | `raster_value` | 14/14 match |
| `soil_wrb2006_isric_legend_tbl` | 30 | `soil_wrb2006_isric_pg` (#14) | `raster_value` | 17/17 match |
| `soil_wrb2006_groups_tbl` | 17 | `soil_wrb2006_isric_pg` (#14) | `wrb2006_group` | 14/17 bare-name match |

**How the build already does this:** any table matching `(^|_)legend(_|$)` is auto-folded into its
owner — its columns are joined onto every feature and the table never appears in the Layers panel.
That covers the three legend tables with no config.

`admin_senatorial_districts_tbl` and `soil_wrb2006_groups_tbl` do **not** match that pattern, so they
would publish as table layers. They need an explicit `legendOf` entry in
`config/layers.config.json` — that is the only code change needed for your rule, and I'll make it.

Two wrinkles worth knowing:
- `soil_wrb2006_groups_tbl` keys on **code** (`AC`, `AL`, `AR`…) while the soil layer stores the
  **full name** (`Acrisols`). Joining needs the code expanded, otherwise the 3 groups the layer has
  and the table lacks (`Andosols`, `Calcisols`, `Solonchaks`) fall through. I'll expand codes.
- `soil_wrb2006_isric_legend_tbl` has 30 rows but only 17 soil groups exist in Nigeria — the other 13
  simply won't match, which is fine.

**Excluded table layers (7):** `landcover_glc2000_legend_tbl` and
`landcover_westafrica2013_legend_tbl` are orphans (their rasters were never shipped, so nothing to
fold into). The four `meta_*` tables are catalog metadata, not layer content, and are stale anyway.
`minerals_legend_map2023_tbl` and `geology_legend_map2011_tbl` are already in the project.

---

## Part 3 — Rasters to import: 3 (blocked on files)

Only where the vector genuinely cannot carry the concept.

| # | Raster | What it is | Why vector can't do it | Status |
|---|---|---|---|---|
| R1 | `elevation_srtm247m_rst` | DEM at 247 m, 30 m source averaged | elevation is a continuous surface; the vector version is only 7 bands and is a picture, not a DEM | **needs `nigeria_dem_srtm30m_8arcsec_247m.tif`** |
| R2 | `soil_ph_0_5cm_isric_rst` | ISRIC pH, continuous 0–8.5 | the pH vector is 5 coarse bands and `meta_accuracy_check_tbl` scores it only ~50 % reliable | **needs `nigeria_phh2o_0-5cm.tif`** |
| R3 | `climate_prec_annual_worldclim_rst` | annual precipitation | **no vector version exists at all** | **needs the 12 WorldClim monthly files** |

Optional additions, same blocker:

| Raster | What | Note |
|---|---|---|
| `elevation_srtm1km_masked_diva_rst` | 1 km DEM clipped to the national boundary | lighter than R1 (1.2 MB vs full grid); R1 and this are the same concept, pick one |
| `climate_prec_m01…m12` | monthly rainfall, 12 layers | only if you want a month slider — that is 12 more layers |
| `climate_srad_annual_worldclim_rst` | solar radiation | adds a theme nothing else covers |

If R1/R2/R3 ship, the matching picture vectors become redundant and stay out — which is why
`elevation_classes_picture_pg`, `soil_ph_picture_pg` and `climate_temperature_picture_pg` are not in
the list above.

---

## Part 4 — Excluded, and why

**Already in the project (19):** all 14 geology/minerals layers and 5 rasters in `data/`.

**Duplicate or superseded (13):**

| Excluded | Reason |
|---|---|
| `admin_country_esri_pg` | same outline as #1, 3.0 MB for ISO/FIPS attributes |
| `admin_international_boundary_map2023_ln` | 5 border segments — the country outline already implies it |
| `population_districts_picture_pg` | picture-derived 504 districts; #6 carries real numbers |
| `settlements_gazetteer_diva_pt` | 85 % overlap with #7 |
| `settlements_towns_map2023_pt` | 71 % overlap with #7 |
| `transport_roads_map2011_ln`, `transport_roads_map2023_ln` | sparse tracings of #9 |
| `transport_railways_map2011_ln`, `transport_railways_map2023_ln` | sparse tracings of #10 |
| `water_rivers_map2011_ln`, `water_rivers_map2023_ln` | subset tracings of #11 |
| `water_rivers_major_wfp_ln` | just the Niger and Benue — already inside #11 |
| `landcover_picture_pg` | 14 classes but **ends near 4.9 °N**; #13 covers the whole country |

**Poor representation — superseded by a raster (4):**
`elevation_classes_picture_pg`, `soil_ph_picture_pg`, `climate_temperature_picture_pg`,
`ethnic_groups_picture_pg` → ethnic is covered by #15.

**Not content (4):** the `meta_*` tables; `landcover_glc2000_legend_tbl`,
`landcover_westafrica2013_legend_tbl` (orphans).

**Reference / basemap support (4):** `reference_world_countries_pg` (3.9 MB),
`reference_africa_countries_pg`, and the two graticules — the app already draws basemap tiles and the
graticule; these only matter as clipping masks. Say so if you want them and I'll add them.

---

## Totals

| | Layers | Rows | Size |
|---|---|---|---|
| Vectors to import | **18** | **75,784** | **~36.9 MB** |
| Rasters to import | **3** | — | *blocked on source files* |
| Tables absorbed (not published) | 4 | 170 | ~0 |
| Dropped (28 new + 4 already-in-project excluded) | 42 | 46,970 | 20 MB |

Site after import: **16 → 34 layers**, **37,983 → 113,767 features**.

The two heavy polygons (#13 land cover 7.0 MB, #14 soil 6.9 MB) are **38 % of the whole payload on
their own**. Everything else fits in 23 MB.

---

## What I need from you

1. **Approve the 18 vectors**, or strike any you don't want.
2. **Decide on the states duplicate**: keep #2, keep #6, or both.
3. **Rasters:** do you have the GeoTIFFs for R1/R2/R3? If yes, point me at them (or drop them in
   `files/`) and I'll convert them. If not, they simply wait — the 18 vectors can ship now.
4. Optional: say the word on simplification for #13/#14 if 36.9 MB is too much.

On your go I will: split exactly these 18 tables out of `all_maps.gpkg`, add the two `legendOf`
entries so no table layer appears, wire the four tables into their layers, and run the build.
