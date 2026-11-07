# `files/all_maps.gpkg` vs what the project actually uses

Compared on 2026-11-07. Nothing was changed: this is a read-only audit.

## Short answer

They are **two different snapshots of the same source**, not the same data twice.

- `files/all_maps.gpkg` is the **full master catalog**: 64 layers (51 spatial + 13 tables), 81 MB,
  16 themes.
- `data/` is the **shipped subset**: 19 layers (17 in the master + 5 derived rasters/tiles), 17.8 MB,
  geology and minerals only.
- `public/` is the website, rebuilt from `data/` only. **The build never reads `files/`** — nothing in
  the repo, the GitHub Action or Netlify references the bundle.

So for the 14 minerals/geology layers they share, `data/` is the source of truth; `all_maps.gpkg`
is a superset that is **out of date on exactly the minerals layers** and **ahead on the layers the
site never got**.

## 1. `files/all_maps.gpkg` has 50 layers the project does not have

16 themes, all absent from `data/` and the site:

| theme | layers | notable |
|---|---|---|
| settlements | 4 | `places_osm_pt` 51,230 · `gazetteer_diva_pt` 43,021 |
| admin | 8 | states/LGAs GADM, wards 8,809, LGA centroids 774, senatorial districts |
| transport | 6 | roads/railways DIVA, 2011 and 2023 |
| water | 5 | rivers 2011/2023, lakes, all DIVA water lines |
| landcover | 5 | CGLS2019, GLC2000, West Africa 2013 + legends |
| soil | 5 | ISRIC WRB 2006 + dominant/pH picture layers |
| reference | 4 | world countries, Africa, graticules 2011/2023 |
| forest | 2 | OSM forest 757, reserves/rivers 1,120 |
| population | 2 | density 2016 by state, districts picture |
| ethnic | 2 | areas, groups |
| climate / elevation / protected / meta | 1 each + 4 meta | temperature picture, elevation classes, WDPA 967, metadata tables |

That is **122,537 extra features** — the site currently publishes 37,983. Adopting the whole bundle
would grow the published vector data by about **4.2×**.

## 2. On the 14 shared layers, the two agree

Byte-identical row content for 10 of them (geology in full, plus the two other minerals tables'
attributes): `geology_units_map2011_pg`, `geology_faults_map2011_ln`,
`geology_unit_boundaries_map2011_ln`, `geology_admin_boundaries_map2011_ln`,
`geology_background_map2023_pg`, `geology_general_picture_pg`, `geology_ridges_map2011_ln`,
`geology_surficial_usgs_pg`, and both geology legends.

Two cosmetic-only differences: `geology_legend_map2011_tbl` and `geology_surficial_usgs_legend_tbl`
use `fid` in the bundle and `id` in `data/`. Values identical — this is just the surrogate key that
`split_gpkg.py` produces.

## 3. The minerals layers have genuinely diverged — in both directions

`docs/minerals-points/centering-report.md` records a replacement of
`minerals_occurrences_map2023_pt` on 2026-11-06, and `docs/registration/registration-report.md`
records a **+0.0288° latitude / −0.001° longitude** correction to all three minerals vector layers.
Those edits were applied in different places:

| layer | `data/` (shipped) | `files/all_maps.gpkg` |
|---|---|---|
| `minerals_occurrences_map2023_pt` | **new**: 1,547 points, `symbol-centered` / `as-digitized` | **old**: 1,483 points, `exact` / `relaxed` / `tolerant` / `partial_*` |
| `minerals_legend_map2023_tbl` | `points_detected` refreshed (Σ 1,545) | old counts (Σ 1,483); 47 of 67 rows differ |
| `minerals_unresolved_symbols_map2023_pt` | geometry **not** shifted (pre-registration-fix) | geometry shifted +0.0288° lat / −0.001° lon |
| `minerals_division_lines_map2023_ln` | geometry **not** shifted | geometry shifted by the same amount |

So the registration fix lives **only in the bundle**, and the new 1,547-point set lives **only in
`data/`**. Neither file is a superset of the other.

**Is `public/` correct today?** Yes for the point set: published coordinates match `data/` exactly
(1,547 features, `match_class` as published). But because the fix was never split into `data/`, the
**published unresolved symbols and division lines are still 3.2 km north** of where the registration
report says they should be (`public/` fid 1 at 10.27968 vs corrected 10.30848).

Side effect of dropping the old point set: `state`, `lga`, `zone`, `visible_fraction`,
`position_accuracy_m` and `qa_flag` survive in the schema but are **NULL for all 1,547 rows** — the
catalog still advertises all twelve fields, and the bundle's 1,483-point set is the last place that
join exists. The old and new point sets are also not a refinement of each other: only 4.5 % of old
points have a new point within 1 km (median offset 3.2 km).

## 4. The bundle's own metadata is stale

`meta_raster_info_tbl`, `meta_picture_raster_info_tbl`, `meta_picture_value_legend_tbl` and
`meta_accuracy_check_tbl` document **58 layers, of which none is in the bundle**. They are all rasters
and rasters cannot be stored in this bundle the way they are shipped (it has no tile tables and no
gridded coverage — 0 of 64), so the bundle is a *vector-only* master carrying the catalog of a much
larger raster collection. The `meta_*` tables are the only trace of it in this repo.

## 5. Layers `data/` has that the bundle does not

These are the rasters and tiles that only exist in `data/`, because the bundle cannot hold them:
`geology_general_picture_code_rst`, `geology_general_picture_img`, `geology_map2011_img`,
`geology_surficial_usgs_code_rst`, `minerals_map2023_img`.

## 6. Impact of building from the bundle

`scripts/build_site.py --data files` would ingest all 64 tables. Everything is a supported type
(`features` or `attributes`), so nothing would be skipped — the result would be 64 layers and
~160k features, and it would **regress the four minerals layers to the old point set and keep the
unshifted geometry**, exactly backwards from what the two reports describe.

## 7. Suggested reconciliation (not done)

1. Cherry-pick the bundle's registration-fixed geometry for
   `minerals_unresolved_symbols_map2023_pt` and `minerals_division_lines_map2023_ln` into `data/`,
   then rebuild — that closes the 3.2 km error still live on the site.
2. Treat `data/` as the source of truth for everything already in it; treat the bundle as the supply
   for the 50 layers the site has never had, split per layer with `python scripts/split_gpkg.py
   files/all_maps.gpkg "data/Group name" <prefix>`.
3. Regenerate or drop the four stale `meta_*` tables, or ship them without the raster catalog.
4. Decide whether the 122,537 extra features should be published — the two OSM/DIVA settlement
   layers alone are 94k points, far more than everything on the map today.
