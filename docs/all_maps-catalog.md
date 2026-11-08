# Layer catalog of `files/all_maps.gpkg` — grouped pick-list

64 layers (51 spatial features + 13 attribute tables) · 81 MB · surveyed 2026-11-07.
Sizes are the estimated GeoJSON cost on the site, not the GeoPackage bytes.

**How to read this:** every row has a **pick ID** (e.g. `C4`). Reply with the IDs you want, or with
group names ("all of D and E", "everything except N and O"). Groups **A** and **B** are already on the
site — they are listed for completeness, not as new picks.

`ON SITE` = already published from `data/` · `NEW` = only in the bundle · `ORPHAN` = table whose
raster partner is not in the bundle, so it cannot be published on its own.

---

## A. Geology — already on site (10 in bundle)

| pick | layer | type | rows | size | contains | status |
|---|---|---|---|---|---|---|
| A1 | `geology_units_map2011_pg` | polygon | 1,485 | 2.6 MB | unit code, formation, series, epoch, age, legend colour | ON SITE |
| A2 | `geology_unit_boundaries_map2011_ln` | line | 22,851 | 4.3 MB | outlines between the units above | ON SITE |
| A3 | `geology_faults_map2011_ln` | line | 11,638 | 2.0 MB | fault traces | ON SITE |
| A4 | `geology_admin_boundaries_map2011_ln` | line | 66 | 0.5 MB | state boundaries as printed on the 2011 sheet | ON SITE |
| A5 | `geology_ridges_map2011_ln` | line | 14 | ~0 | ridge lines | ON SITE |
| A6 | `geology_general_picture_pg` | polygon | 8 | 0.2 MB | simplified eras (basement / sedimentary…) | ON SITE |
| A7 | `geology_background_map2023_pg` | polygon | 305 | 0.3 MB | 2023 sheet background units + age group | ON SITE |
| A8 | `geology_surficial_usgs_pg` | polygon | 14 | 0.4 MB | USGS surficial geology by `glg_code` | ON SITE |
| A9 | `geology_legend_map2011_tbl` | table | 100 | ~0 | the 100 unit codes behind A1 (folded into A1, not a layer) | ON SITE |
| A10 | `geology_surficial_usgs_legend_tbl` | table | 14 | ~0 | legend for A8 (folded in) | ON SITE |

*Site also has 5 raster layers that are not in this bundle*: `geology_map2011_img`,
`geology_general_picture_img`, `geology_general_picture_code_rst`, `geology_surficial_usgs_code_rst`
and `minerals_map2023_img`.

**Note — two versions of one concept:** A1/A2/A3/A4/A5 are the **2011** sheet; A7 is the **2023**
sheet background. If you show both, the 2023 one is coarser and will not line up class-for-class.

## B. Mineral resources — already on site (4 in bundle)

| pick | layer | type | rows | size | contains | status |
|---|---|---|---|---|---|---|
| B1 | `minerals_occurrences_map2023_pt` | point | 1,483 | 0.1 MB | mineral, legend no, zone, match class/score, state, LGA | ON SITE ⚠ |
| B2 | `minerals_legend_map2023_tbl` | table | 67 | ~0 | the 67 minerals + counts (folded into B1) | ON SITE |
| B3 | `minerals_division_lines_map2023_ln` | line | 6 | ~0 | the A–G mineral zone divisions | ON SITE ⚠ |
| B4 | `minerals_unresolved_symbols_map2023_pt` | point | 63 | ~0 | symbols on the sheet that could not be named | ON SITE ⚠ |

⚠ **These four are the layers where the bundle and `data/` disagree.** `data/` has the newer
1,547-point set; the bundle has the older 1,483-point set but with the 3.2 km registration
correction applied. See `docs/all_maps-vs-data-comparison.md`. **Do not re-import B1/B3/B4 from the
bundle** unless you want the old point set back.

---

# New layers — the actual pick-list

## C. Administrative boundaries — 8 layers, 10,512 rows, 11.5 MB

The core "where is it" group. **Three different versions of the national outline and two versions of
the state map** — you almost certainly want one of each, not all.

| pick | layer | type | rows | size | contains | note |
|---|---|---|---|---|---|---|
| C1 | `admin_states_gadm_pg` | polygon | 38 | 3.2 MB | 36 states + FCT, state code, type, area | ✅ recommend — the main state layer |
| C2 | `population_density2016_states_pg` | polygon | 38 | 3.2 MB | same 38 states, **different drawn geometry**, + pop 2016 | duplicate concept of C1 |
| C3 | `admin_lgas_gadm_pg` | polygon | 775 | 4.5 MB | all LGAs with state, alt names, area | ✅ recommend |
| C4 | `admin_lga_centroids_pt` | point | 774 | 0.1 MB | one point per LGA + wikidata, senatorial/repr. district | ✅ recommend, pairs with C3 |
| C5 | `admin_wards_pt` | point | 8,809 | 0.5 MB | every ward + distance to LGA centre, QA flag | good for detail |
| C6 | `admin_country_geoboundaries_pg` | polygon | 1 | 0.1 MB | national outline, plain | ✅ recommend (light) |
| C7 | `admin_country_esri_pg` | polygon | 1 | **3.0 MB** | national outline + ISO/FIPS/UN/WB/income/pop, area | same shape, far heavier |
| C8 | `admin_international_boundary_map2023_ln` | line | 5 | 0.05 MB | borders as drawn on the 2023 sheet | pairs with B1 |
| C9 | `admin_senatorial_districts_tbl` | table | 109 | 0.01 MB | 109 districts → their LGAs (no geometry) | pairs with C4 |

**One concept, several forms:** national outline = **C6 / C7** (and C8 as a line);
states = **C1 / C2**; LGA = **C3 + C4** (polygon + centroid).

## D. Settlements — 4 layers, 94,767 rows, 6.7 MB

The biggest row counts in the bundle, but cheap in bytes because points are small.

| pick | layer | type | rows | size | contains | note |
|---|---|---|---|---|---|---|
| D1 | `settlements_places_osm_pt` | point | 51,230 | 3.1 MB | OSM places: name, place type, state, LGA | largest layer in the bundle |
| D2 | `settlements_gazetteer_diva_pt` | point | 43,021 | 3.6 MB | DIVA gazetteer: name, class, designation, state, LGA | overlaps D1 heavily |
| D3 | `settlements_towns_map2023_pt` | point | 479 | 0.04 MB | towns labelled on the 2023 sheet + name QA | ✅ light, picture-accurate |
| D4 | `settlements_state_capitals_map2023_pt` | point | 37 | ~0 | 37 reviewed capitals + previous coordinates, correction sources and QA | ✅ recommend |

**One concept, three forms:** settlements are offered as OSM (D1), gazetteer (D2) and the 479
map-labelled towns (D3). D1 and D2 are both huge and largely duplicate each other — picking one is
usually enough; D3 is the one that matches the mineral sheet.

## E. Transport — 6 layers, 5,259 rows, 1.8 MB

Straightforward **three vintages of the same two networks** — this is the clearest "same concept,
different source" group in the bundle.

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| E1 | `transport_roads_diva_ln` | line | 4,708 | 1.2 MB | DIVA road network + median/route/feature type |
| E2 | `transport_roads_map2011_ln` | line | 246 | 0.25 MB | roads drawn on the 2011 sheet |
| E3 | `transport_roads_map2023_ln` | line | 259 | 0.30 MB | roads drawn on the 2023 sheet + class |
| E4 | `transport_railways_diva_ln` | line | 33 | 0.03 MB | DIVA rail + status, track type |
| E5 | `transport_railways_map2011_ln` | line | 6 | 0.02 MB | rail on the 2011 sheet |
| E6 | `transport_railways_map2023_ln` | line | 7 | 0.02 MB | rail on the 2023 sheet |

**Roads: E1 / E2 / E3.** **Rail: E4 / E5 / E6.** Recommendation: E1 + E3 (or E1 + E2 + E3 — all three
are small and comparing vintages is genuinely useful).

## F. Water — 5 layers, 7,999 rows, 3.6 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| F1 | `water_lines_diva_ln` | line | 5,162 | 1.9 MB | full DIVA river network, perennial/seasonal regime |
| F2 | `water_areas_diva_pg` | polygon | 1,186 | 0.9 MB | lakes/reservoirs with names + hydro regime |
| F3 | `water_rivers_map2011_ln` | line | 784 | 0.43 MB | rivers drawn on the 2011 geological sheet |
| F4 | `water_rivers_map2023_ln` | line | 865 | 0.40 MB | rivers drawn on the 2023 mineral sheet |
| F5 | `water_rivers_major_wfp_ln` | line | 2 | ~0 | **only** the Niger and Benue |

**Rivers: F1 / F3 / F4 / F5** — four forms of one concept (full network, 2011 sheet, 2023 sheet,
two majors). Note F3/F4 are the registration controls; they will not exactly match F1.

## G. Land cover — 5 layers, 88 rows, 7.2 MB

Only two of these are usable; the other three are legends with no layer behind them.

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| G1 | `landcover_cgls2019_pg` | polygon | 14 | **7.0 MB** | 14 CGLS 2019 classes, whole country — authoritative but very heavy |
| G2 | `landcover_picture_pg` | polygon | 14 | 0.2 MB | the coarse picture map, 14 classes, **ends near 4.9°N** |
| G3 | `landcover_cgls2019_legend_tbl` | table | 14 | ~0 | legend + class areas for G1 (folded into G1) |
| G4 | `landcover_glc2000_legend_tbl` | table | 22 | ~0 | ORPHAN — the GLC2000 raster is not in the bundle |
| G5 | `landcover_westafrica2013_legend_tbl` | table | 24 | ~0 | ORPHAN — the West Africa 2013 raster is not in the bundle |

**Two forms of one concept:** G1 (2019, authoritative, complete, 7 MB) vs G2 (picture, light, partial).
G1 is one polygon per class with very detailed coastlines — that's where the 7 MB comes from.

## H. Soil — 5 layers, 123 rows, 11.6 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| H1 | `soil_wrb2006_isric_pg` | polygon | 17 | **6.9 MB** | WRB 2006 soil groups, authoritative, very detailed geometry |
| H2 | `soil_dominant_picture_pg` | polygon | 54 | 4.5 MB | dominant soil per drawn area + FAO group, association |
| H3 | `soil_ph_picture_pg` | polygon | 5 | 0.25 MB | pH bands (photo-interpreted, **only ~50 % reliable**) |
| H4 | `soil_wrb2006_isric_legend_tbl` | table | 30 | ~0 | legend + areas for H1 (folded in) |
| H5 | `soil_wrb2006_groups_tbl` | table | 17 | ~0 | WRB code → soil group reference (pairs with H1) |

**Three products, one concept:** H1 (authoritative WRB), H2 (picture map), H3 (pH — flagged as
unreliable in `meta_accuracy_check_tbl`, prefer the ISRIC raster that isn't in this bundle).

## I. Population — 2 layers, 542 rows, 3.6 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| I1 | `population_density2016_states_pg` | polygon | 38 | 3.2 MB | pop 2016, area, people/km² per state (= C2) |
| I2 | `population_districts_picture_pg` | polygon | 504 | 0.36 MB | 504 drawn districts with population **class bands** |

**Overlap warning:** I1 *is* C2 (same layer, same file). Pick it once — as C2 if you take the admin
group, else as I1.

## J. Ethnicity — 2 layers, 152 rows, 1.6 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| J1 | `ethnic_areas_anthromapper_pg` | polygon | 118 | 1.5 MB | people cluster, ethnic group, alt names, source + date |
| J2 | `ethnic_groups_picture_pg` | polygon | 34 | 0.1 MB | the coarse picture version + region group |

**Two forms of one concept:** J1 (detailed, sourced Anthromapper) vs J2 (picture, 34 areas).

## K. Forest — 2 layers, 1,877 rows, 1.4 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| K1 | `forest_osm_pg` | polygon | 757 | 0.7 MB | OSM forest polygons: name, area |
| K2 | `forest_reserves_water_picture_pg` | polygon | 1,120 | 0.7 MB | forest reserves + major rivers from the picture map |

**Two forms of one concept:** K1 (OSM, current forest) vs K2 (reserves as printed — a legal/administrative
concept, not the same thing). They are complementary rather than duplicates.

## L. Climate & elevation — 2 layers, 15 rows, 1.0 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| L1 | `climate_temperature_picture_pg` | polygon | 8 | 0.12 MB | 8 temperature classes with min/max °C |
| L2 | `elevation_classes_picture_pg` | polygon | 7 | 0.86 MB | 7 elevation bands with min/max metres |

Both are **polygonised pictures** — the bundle has no raster versions. `meta_accuracy_check_tbl` rates
L2 at 84 % agreement with SRTM after a shift; L1 is untested.

## M. Protected areas — 1 layer, 967 rows, 1.3 MB

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| M1 | `protected_areas_wdpa_pg` | polygon | 967 | 1.3 MB | WDPA: name, designation, IUCN category, governance, status year, state |

Richest attribute set of any new layer. No duplicate forms.

## N. Reference / basemap context — 4 layers, 452 rows, 4.2 MB

Support layers, not content. The app already draws tile basemaps, so these mostly matter as
clipping masks or for the graticule.

| pick | layer | type | rows | size | contains |
|---|---|---|---|---|---|
| N1 | `reference_world_countries_pg` | polygon | 251 | 3.9 MB | world countries (used as the land mask) |
| N2 | `reference_africa_countries_pg` | polygon | 54 | 0.37 MB | Africa only, with populations |
| N3 | `reference_graticule_map2011_ln` | line | 22 | ~0 | 1° grid as printed on the 2011 sheet |
| N4 | `reference_graticule_map2023_ln` | line | 125 | 0.02 MB | 2°/1° grid from the 2023 sheet |

**Two forms:** world (N1) vs Africa (N2); graticule 2011 (N3) vs 2023 (N4). N3/N4 are only useful for
checking registration — you probably do not want them on a public map.

## O. Metadata — 4 layers, 173 rows, 0.03 MB

| pick | layer | type | rows | contains |
|---|---|---|---|---|
| O1 | `meta_raster_info_tbl` | table | 41 | grid definitions for 41 climate/elevation/landcover rasters |
| O2 | `meta_picture_raster_info_tbl` | table | 17 | georeferencing of the 17 picture maps (IoU, km/px, legend) |
| O3 | `meta_picture_value_legend_tbl` | table | 110 | class codes for picture rasters |
| O4 | `meta_accuracy_check_tbl` | table | 5 | the accuracy studies (elevation 72→84 %, soil pH 50 %, …) |

⚠ **All four are stale**: they document **58 layers, none of which is in this bundle** (the bundle has
no rasters at all). Publishing them as layers would show empty catalog entries. Pick O4 only if you
want the accuracy notes visible; otherwise leave all of O alone.

---

## Summary — what a pick costs

| group | layers | rows | size | worth it? |
|---|---|---|---|---|
| C Administrative boundaries | 8 | 10,512 | 11.5 MB | high — the backbone |
| D Settlements | 4 | 94,767 | 6.7 MB | medium — two of the four are near-duplicates |
| E Transport | 6 | 5,259 | 1.8 MB | high — cheap, and vintage comparison is interesting |
| F Water | 5 | 7,999 | 3.6 MB | high |
| G Land cover | 5 | 88 | 7.2 MB | medium — G1 alone is 7 MB |
| H Soil | 5 | 123 | 11.6 MB | medium — H1 alone is 6.9 MB |
| I Population | 2 | 542 | 3.6 MB | I1 duplicates C2 |
| J Ethnicity | 2 | 152 | 1.6 MB | medium |
| K Forest | 2 | 1,877 | 1.4 MB | high — complementary, not duplicate |
| L Climate & elevation | 2 | 15 | 1.0 MB | medium — picture quality only |
| M Protected areas | 1 | 967 | 1.3 MB | high — richest attributes |
| N Reference | 4 | 452 | 4.2 MB | low — basemaps already cover it |
| O Metadata | 4 | 173 | 0.03 MB | low — stale |

Everything (50 new layers): **122,926 rows, ~55.6 MB**, taking the site from ~38k to ~160k features
and from 16 to 66 layers.

### A lean but complete first selection
`C1 C3 C4 C6 C5` · `D3 D4` · `E1 E2 E3 E4` · `F1 F2 F3` · `G2` · `H2 H3` · `I2` · `K1 K2` · `M1`
→ 19 layers, ~7k rows, ~13 MB. Leaves out the two heavy authoritative polygons (G1, H1) and both
94k-point settlement layers.

---

*Nothing has been copied into `data/` yet. When you have your list, each pick is one command:*
`python scripts/split_gpkg.py files/all_maps.gpkg "data/Group name" <prefix>` — or I can split exactly the
picked tables and run the build.
