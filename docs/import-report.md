# Import report — approved layers now in `data/`

`scripts/import_selected.py` split the approved layers out of `files/all_maps.gpkg` into **one
standalone, single-layer GeoPackage per layer** in `data/`. Layer names are unchanged. No table
layer was written: the four attribute tables are now columns on the features they describe.

`python scripts/import_selected.py --single` writes the same 20 layers into one combined
`data/selected_layers.gpkg` instead, if a single file is preferred.

## Added — 20 layers, 75,838 rows, 44.4 MB of `.gpkg`

| # | Layer | Rows | MB |
|---|---|---|---|
| 1 | `admin_country_geoboundaries_pg` | 1 | 0.16 |
| 2 | `admin_states_gadm_pg` | 38 | 3.30 |
| 3 | `admin_lgas_gadm_pg` | 775 | 5.07 |
| 4 | `admin_lga_centroids_pt` | 774 | 0.20 |
| 5 | `admin_wards_pt` | 8,809 | 0.68 |
| 6 | `population_density2016_states_pg` | 38 | 3.30 |
| 7 | `settlements_places_osm_pt` | 51,230 | 3.57 |
| 8 | `settlements_state_capitals_map2023_pt` | 37 | 0.04 |
| 9 | `transport_roads_diva_ln` | 4,708 | 1.31 |
| 10 | `transport_railways_diva_ln` | 33 | 0.09 |
| 11 | `water_lines_diva_ln` | 5,162 | 2.19 |
| 12 | `water_areas_diva_pg` | 1,186 | 1.04 |
| 13 | `landcover_cgls2019_pg` | 14 | 7.08 |
| 14 | `soil_wrb2006_isric_pg` | 17 | 6.97 |
| 15 | `ethnic_areas_anthromapper_pg` | 118 | 1.62 |
| 16 | `forest_osm_pg` | 757 | 0.87 |
| 17 | `forest_reserves_water_picture_pg` | 1,120 | 0.84 |
| 18 | `protected_areas_wdpa_pg` | 967 | 1.58 |
| 19 | `reference_africa_countries_pg` | 54 | 0.46 |
| 20 | `reference_world_countries_pg` | 251 | 4.03 |

Versus the shortlist, the two `reference_*` layers are in (#19, #20) as requested; everything
else stayed as listed, including both state polygon layers (#2 and #6).

## Tables integrated — zero new table layers

| Source table | Joined into | Key | Result |
|---|---|---|---|
| `admin_senatorial_districts_tbl` (109) | `admin_lga_centroids_pt` | `senatorial_district` | **774/774** features gained `district_state`, `district_n_lgas`, `district_lgas` |
| `landcover_cgls2019_legend_tbl` (14) | `landcover_cgls2019_pg` | `raster_value` | **14/14** gained `legend_class_name`, `legend_cells`, `legend_area_km2` |
| `soil_wrb2006_isric_legend_tbl` (30) | `soil_wrb2006_isric_pg` | `raster_value` | **17/17** gained `legend_group`, `legend_cells_in_nigeria`, `legend_area_km2`, `isric_colour` |
| `soil_wrb2006_groups_tbl` (17) | `soil_wrb2006_isric_pg` | `reference_soil_group` = `wrb2006_group` | **14/17** gained `wrb_code` |

Three soil groups (`Andosols`, `Calcisols`, `Solonchaks`) have no code in the lookup table, so
`wrb_code` is blank for those three — no value was invented. `isric_colour` is picked up by the
build automatically, so the soil layer renders in the official ISRIC colours with soil-group labels.

Three `*_tbl.gpkg` files were **already** in `data/` from the original project
(`geology_legend_map2011_tbl`, `geology_surficial_usgs_legend_tbl`,
`minerals_legend_map2023_tbl`). They were left in place because `build_site.py` folds them into
geology/minerals at publish time — including the class labels for the surficial-geology raster,
which cannot be reproduced from layer columns. **No table layer is published**: the catalog contains
zero `table` entries.

## Site rebuilt

`python scripts/build_site.py` → `public/` regenerated (version `a8944dbc47`): **36 layers from 39
files**, 0 table layers, 13 groups. New groups get readable labels and an ordering after Geology
and Mineral resources. All 20 new layers start switched **off** (only the original geology units
and mineral occurrences are on), so they do not cover the existing map.

`config/layers.config.json` now holds labels, label fields and group definitions for all 20 layers.

## Still outstanding

The 3 rasters (`elevation_srtm247m_rst`, `soil_ph_0_5cm_isric_rst`,
`climate_prec_annual_worldclim_rst`) are **not** in `data/`: no GeoTIFF exists anywhere in the repo.
Supply the source files and they can be converted and added.

The duplicate state outlines (#2 `admin_states_gadm_pg` and #6
`population_density2016_states_pg`) are both still present, as no choice was made between them.
