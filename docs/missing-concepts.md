# What has no representative at all in the project now

Compared the **36 published layers** (`public/catalog.json`, built from `data/`) against the full
source inventory: **64 layers** in `files/all_maps.gpkg`, **41 rasters** documented in
`meta_raster_info_tbl`, and **17 picture rasters** in `meta_picture_raster_info_tbl`.

A concept counts as *missing* only when **no layer of any kind** — vector, raster, image or folded
table — represents it on the site. Excluding one version of a concept while another version is on
site is not a gap.

---

## 5 concepts with zero representation

| # | Missing concept | Candidate layers that exist in the source inventory | Why nothing made it | What is needed |
|---|---|---|---|---|
| 1 | **Elevation / DEM** | `elevation_classes_picture_pg` (vector, 7 bands) · `elevation_srtm247m_rst` · `elevation_srtm1km_diva_rst` · `elevation_srtm1km_masked_diva_rst` · `elevation_worldclim_rst` · `elevation_srtm1km_masked_view_img` · `elevation_picture_img` · `elevation_picture_value_rst` | the only vector is a coarse picture interpretation; every DEM is a documented raster with **no GeoTIFF in the repo** | `nigeria_dem_srtm30m_8arcsec_247m.tif` (best), or `NGA_alt.tif` / `NGA_msk_alt.tif` (1 km DIVA), or `wc2.1_10m_elev.tif` (coarse) — or re-add the excluded vector as a stopgap |
| 2 | **Climate — temperature** | `climate_temperature_picture_pg` (vector, 8 bands) · `climate_temperature_picture_img` · `climate_temperature_picture_value_rst` | the only data that exists is the picture vector, which was excluded. **No temperature raster is documented anywhere** — there is no raster fallback | re-add `climate_temperature_picture_pg`, or supply a new temperature source |
| 3 | **Climate — precipitation** | `climate_prec_m01_worldclim_rst` … `climate_prec_m12_worldclim_rst` (12) + `climate_prec_annual_worldclim_rst` | rasters only, documented but not shipped; **no vector version ever existed** | the 12 `wc2.1_10m_prec_XX.tif` files (annual is derived from them) |
| 4 | **Climate — solar radiation** | `climate_srad_m01_worldclim_rst` … `climate_srad_m12_worldclim_rst` (12) + `climate_srad_annual_worldclim_rst` | same as precipitation | the 12 `wc2.1_10m_srad_XX.tif` files |
| 5 | **Soil pH (acidity)** | `soil_ph_picture_pg` (vector, 5 bands) · `soil_ph_0_5cm_isric_rst` · `soil_ph_picture_img` · `soil_ph_picture_value_rst` | the picture vector was excluded (accuracy study scored it ~50 %); the ISRIC raster needs a missing GeoTIFF | `nigeria_phh2o_0-5cm.tif`, or re-add `soil_ph_picture_pg` |

**Soil classification is not missing** — `soil_wrb2006_isric_pg` is on site with its legend and WRB
codes folded in. pH is a different phenomenon and has nothing.

### The common cause

**Zero of the 41 documented rasters are on the site.** The only two raster layers in the catalog are
`geology_general_picture_code_rst` and `geology_surficial_usgs_code_rst` — both geology, both
derived from vectors. There is no `.tif`, `.asc` or `.nc` anywhere in the repository, so every one
of the five gaps above needs a source file supplied (or an excluded picture vector re-added).
Only 2 of the 17 documented picture rasters are on site.

---

## Covered, but only by one variant — not gaps

| Concept | On site | Absent variants |
|---|---|---|
| Graticule | **no data layer, but the app draws it** (Tools → Grid lines, `engine.js` `_drawGridLines`) | `reference_graticule_map2011_ln`, `reference_graticule_map2023_ln` |
| Population | `population_density2016_states_pg` (38 state polygons) | `population_districts_picture_pg`, `population_diva_rst`, `population_masked_diva_rst`, `population_masked_view_img`, `population_districts_picture_img`, `population_picture_value_rst` — no continuous density surface |
| Land cover | `landcover_cgls2019_pg` (14 classes, whole country) | GLC2000 (`landcover_glc2000_diva_rst`, `…_masked_diva_rst`, `…_masked_view_img`), West Africa 2013 (`landcover_westafrica2013_code_rst`), `landcover_picture_pg` and its two picture rasters. `landcover_glc2000_legend_tbl` and `landcover_westafrica2013_legend_tbl` are orphan tables with no owner |
| Soil classification | `soil_wrb2006_isric_pg` | `soil_dominant_picture_pg`, `soil_wrb2006_isric_code_rst`, `soil_dominant_picture_img`, `soil_dominant_picture_code_rst` |
| Ethnic groups | `ethnic_areas_anthromapper_pg` (118 areas) | `ethnic_groups_picture_pg` (34 coarse areas) + its two picture rasters |
| Forest | `forest_osm_pg`, `forest_reserves_water_picture_pg` | `forest_reserves_picture_img` (the scanned sheet) |
| Georeferenced sheet scans | `geology_general_picture_img`, `geology_map2011_img`, `minerals_map2023_img` | 8 of the 9 source picture scans documented in `meta_picture_raster_info_tbl` |

---

## The 20 excluded feature layers are mostly not gaps

15 of them are redundant variants of concepts that are on site: `admin_country_esri_pg`,
`admin_international_boundary_map2023_ln`, `ethnic_groups_picture_pg`, `landcover_picture_pg`,
`population_districts_picture_pg`, `settlements_gazetteer_diva_pt`,
`settlements_towns_map2023_pt`, `soil_dominant_picture_pg`,
`transport_roads_map2011_ln`, `transport_roads_map2023_ln`,
`transport_railways_map2011_ln`, `transport_railways_map2023_ln`,
`water_rivers_major_wfp_ln`, `water_rivers_map2011_ln`, `water_rivers_map2023_ln`.

The other 5 are the sole carrier of a missing concept (3: `elevation_classes_picture_pg`,
`climate_temperature_picture_pg`, `soil_ph_picture_pg`) or the app-drawn graticule (2:
`reference_graticule_map2011_ln`, `reference_graticule_map2023_ln`).

Precipitation and solar radiation have **no vector in the master at all** — they only ever existed
as the 26 documented WorldClim rasters.

`meta_*` tables (4) and `meta_picture_value_legend_tbl` are catalog metadata, not map content, so
their absence is intentional. The 3 `*_tbl.gpkg` still in `data/` are folded into geology/minerals
at build time; the catalog has **zero table layers**.
