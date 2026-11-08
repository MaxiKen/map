# Geology-associated layers — sources and provenance

> **Status 2026-11-07 (updated):** a final batch of three *non-groundwater*
> layers (two landslide-hazard layers and IHFC geothermal heat-flow points) was
> added afterwards because this batch was groundwater-heavy. See
> **`docs/final-layers.md`**. The catalog is now 59 layers in 18 groups
> (build `3add8addcb`).
>
> **Coverage follow-up 2026-11-08:** the committed EMAG2 derivative has only
> 90.2% sampled land coverage (90.1% using every cell). It is now explicitly
> labeled **“Magnetic anomaly (EMAG2 v2, partial coverage)”** in the source
> metadata and public catalog. Missing cells remain NoData; no interpolation was
> applied. See `geospatial-audit/magnetic-coverage-reclassification.md`.

Added 2026-11-07. This is the **third** fetch batch. The survey that led to it is
`docs/geology-associated-layers.md`; the earlier batches are `docs/raster-sources.md`
(five climate/elevation/soil rasters) and `docs/online-layers.md` (six settlement /
water / population / infrastructure concepts, eight layers).

The gap was the **subsurface below the soil**: the catalog had bedrock geology,
surficial geology, faults, mineral occurrences, a DEM, soil pH/WRB, rivers, basins
and flood inundation — but no aquifer, water table, groundwater, borehole,
basement-depth or geophysical layer of any kind. Rivers and flood maps are surface
water, not groundwater.

**Seven layers were picked: five vectors + two rasters.** That keeps the standing
"mostly vectors, few rasters" rule — the two rasters are continuous fields that
cannot be faithfully represented as polygons (depth to water, magnetic anomaly).
Every layer is a single standalone `.gpkg` in its group folder under `data/`, cropped to
`2.5–15.0°E, 4.0–14.0°N`; rasters are additionally masked to the geoBoundaries
national outline. No table layers were published.

Site build: **`f445969fc8`** — 56 layers from 59 files, 18 groups, 12 rasters,
0 table layers. New group `groundwater` ("Groundwater & hydrogeology", order 18);
the magnetic-anomaly raster is filed under the existing `geology` group.

---

## 1. What was picked, and why

| # | Layer (`.gpkg` in its `data/` group folder) | Kind | Why it is worth having |
|---|---|---|---|
| 1 | `groundwater_aquifers_bgs2019_pg` | polygon | The single best Nigeria-specific aquifer layer: 196 polygons, each with both the hydrogeologically significant geology unit and the aquifer type/productivity class. Tiny (0.46 MB), national, authoritative. |
| 2 | `groundwater_units_ecowas2022_pg` | polygon | The 2022 harmonised regional successor: 644 units inside Nigeria with stratigraphy, basin, lithology, flow type, expected borehole yield and productivity. Richer attributes than #1, Nigeria linework revised from Dessauvagie 1974. A legitimate second variant of the same concept, like the existing DIVA/geoBoundaries pairs. |
| 3 | `groundwater_cover_ecowas2022_pg` | polygon | The superficial Quaternary aquifers (alluvial / aeolian / lacustrine deposits) that overlie bedrock aquifers — a different horizon, not a duplicate of #2. 7 units inside Nigeria. |
| 4 | `groundwater_boreholes_wpdx_pt` | point | 99,245 **observed** water points (87,362 boreholes/tubewells, protected wells and springs) with technology, functionality status, state and LGA. The only measured groundwater dataset in the project, and a direct complement to the modelled water table. |
| 5 | `groundwater_transboundary_igrac2025_pg` | polygon | Six cross-border aquifer systems touching Nigeria (Lake Chad, Iullemmeden, Benue, Rio del Rey, Keta, Volta) with lithology, confinement and SDG 6.5.2 reporting status. Governance context no national map gives. |
| 6 | `groundwater_water_table_fan2017_rst` | raster | **The literal "water table" layer.** Revised Fan et al. equilibrium water table depth at 0.01° (~1 km), averaged to a 1000 × 800 grid. A continuous field → raster is correct. |
| 7 | `geophysics_magnetic_emag2_rst` | raster | EMAG2 v2 total-field magnetic anomaly. Maps basement structure and sedimentary-basin fabric, which the existing fault lines only hint at. Genuinely new geophysics; continuous field → raster. |

## 2. Sources, exact URLs and licences

| Layer | Publisher / dataset | Exact download | Licence |
|---|---|---|---|
| 1 | British Geological Survey, *Africa Groundwater Atlas Country Hydrogeology Maps*, Version 1.0 (2019/2021), 1:5 M. User guide BGS Open Report OR/21/063 (`https://nora.nerc.ac.uk/id/eprint/531584/`). | `https://africagroundwateratlas.org/downloads/Nigeria.zip` (index `https://africagroundwateratlas.org/downloadGIS.html`) | **CC BY-SA 4.0** — confirmed from `AfricaGroundwaterAtlasCountryMap-LicenceInformation_V1.2.txt` inside the ZIP. Credit: "British Geological Survey. 2019/2021. Africa Groundwater Atlas Country Hydrogeology Maps." |
| 2, 3 | BGR / BGS / BRGM / Eawag / UNESCO, *Groundwater Resources in the ECOWAS Region*, 1:5 M, 2022, vector dataset `GWR_ECOWAS_SHP_v1`. DOI `10.25928/GWR-ECOWAS.1`. Page `https://www.whymap.org/whymap/EN/Maps_Data/Gwrecowas/gwrecowas_node_en.html`. | `https://download.bgr.de/bgr/grundwasser/gwr_ecowas/SHP/GWR_ECOWAS_SHP_v1.zip` (31.95 MB) | Free-to-download public BGR data; cite the DOI / recommended citation. Share-alike obligations must be checked before commercial redistribution — this repository attributes all five partner organisations and links the DOI. |
| 4 | Water Point Data Exchange (WPDx), Nigeria enhanced CSV on HDX, `https://data.humdata.org/dataset/wpdx_nga`. | `https://data.humdata.org/dataset/29677a2d-1fb2-48a3-a06a-9c66800c418b/resource/1fdb9a0c-d145-49e5-a502-6a3bc63626e8/download/wpdx_enhanced.csv` (50.17 MB) | **CC BY-SA 4.0** (HDX dataset metadata). |
| 5 | IGRAC & UNESCO-IHP, *Transboundary Aquifers of the World Map, Edition 2025*, DOI `10.58154/yb8g-cp97`. | WFS `https://ggis.un-igrac.org/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=geonode:tba_map_2025&outputFormat=application/json&bbox=2.0,3.5,15.5,14.5&maxFeatures=200` | **CC BY-SA 3.0 IGO** (attribution-share-alike, commercial use allowed) — confirmed from the IGRAC 2025 methodology report and release note. |
| 6 | Fan Y., Miguez-Macho G., Jobbágy E.G., Jackson R.B., Otero-Casal C. (2017), *Hydrologic regulation of plant rooting depth*, PNAS 114(40):10572-10577, DOI `10.1073/pnas.1712381114`. Revised 0.01° global WTD; JRC AquaKnow record `https://aquaknow.jrc.ec.europa.eu/node/18916`. | `http://thredds-gfnl.usc.es/thredds/fileServer/GLOBALWTDFTP/annualmeans/AFRICA_WTD_annualmean.nc` (63.39 MB, Africa-only tile; catalog `http://thredds-gfnl.usc.es/thredds/catalog/GLOBALWTDFTP/annualmeans/catalog.html`) | **Free for research** provided Fan et al. 2017 is acknowledged; no warranty. |
| 7 | EMAG2 Earth Magnetic Anomaly Grid v2, NOAA/NCEI & CIRES, 2 arc-minute. `https://www.geomag.org/models/emag2.html`, NCEI metadata `https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ngdc.mgg.geophysical_models%3AEMAG2`. | `https://geomag.colorado.edu/images/EMAG2/EMAG2_V2.tif` (233 MB global float32 GeoTIFF; read through a `/vsicurl/` window so only the Nigeria block is transferred) | Free public-domain US government / academic product; cite Maus et al. / EMAG2 v2. |

## 3. Method

`scripts/fetch_geology_layers.py`, run in GitHub Actions because the editing
sandbox cannot reach these hosts directly (`.github/workflows/fetch-geology-layers.yml`,
`workflow_dispatch` plus a push trigger on the script).

* **Downloads** — all URLs were HEAD/GET-verified from CI before use; results are
  summarised below. ZIPs are extracted, shapefiles read with `pyogrio`/`geopandas`.
* **Vectors** — `clip_polygons()` intersects with the bbox, simplifies
  (`0.0004°` for BGS, `0.0008°` for ECOWAS, `0.0005°` for IGRAC), drops non-area
  geometries, then writes one GPKG per layer via `pyogrio.write_dataframe`.
  Attribute names are lowercased; the aquifer-productivity class is exposed as
  `class_name` so the site's automatic categorical styling picks it up. WPDx's
  first CSV row is an HXL hashtag row and is skipped; points are built from
  `lat_deg`/`lon_deg` and filtered to Nigeria.
* **Water table** — the Africa NetCDF has `lat` 8,760 × `lon` 8,880 at 0.00833°
  plus an `int8` `mask` (1 = in domain). `WTD` is `int16` with
  `scale_factor 0.015259` / `add_offset -499.992`; **the revised dataset stores
  depth as a negative quantity** (scaled range −1000…0 m), so depth in metres is
  `-WTD`. Cells outside `mask == 1` become nodata. The Nigeria window is written
  as a north-up EPSG:4326 GeoTIFF, then averaged to 1000 × 800 with
  `WarpedVRT` and masked to the national outline.
* **Magnetic anomaly** — a `/vsicurl/` window of the 233 MB global GeoTIFF
  (300 × 375 cells at 2 arc-minutes) is written locally and averaged to 500 × 400
  with `src_nodata=-99999`; fallback is a full download. Values are nanoTesla and
  may be negative, so no `positive_only` filter is applied. A later audit found
  large NoData gaps in the committed derivative. Future fetches must now reach at
  least 98% valid coverage in the generated Nigeria land mask or the script stops
  before writing the layer; silent publication as an implicitly complete national
  raster is no longer permitted. The current partial artifact is disclosed rather
  than interpolated.
* **Raster GeoPackages** use `scripts/make_raster_gpkg.write_raster`, producing
  spec-clean `2d-gridded-coverage` tables with nodata `-9999`, EPSG:4326 and
  bbox `2.5, 4.0, 15.0, 14.0`.

## 4. Validation (from the committed GeoPackages)

| Layer | Features / grid | Size | Values |
|---|---|---|---|
| `groundwater_aquifers_bgs2019_pg` | 196 polygons | 0.46 MB | 12 geology units, 8 aquifer classes (`CSI-M/H`, `U-H/VH`, `B-L/M`, …), `EPSG:4326` |
| `groundwater_units_ecowas2022_pg` | 644 polygons | 1.54 MB | 9 productivity classes, 3 flow types, 5 yield classes; Chad, Iullemmeden, Benue, Keta basins |
| `groundwater_cover_ecowas2022_pg` | 7 polygons | 0.32 MB | Quaternary alluvial / aeolian / lacustrine cover, all porous aquifers |
| `groundwater_boreholes_wpdx_pt` | 99,245 points | 18.63 MB | 5 source types (87,362 boreholes/tubewells), 6 functionality statuses; all inside Nigeria |
| `groundwater_transboundary_igrac2025_pg` | 6 polygons | 0.13 MB | AF052 Lake Chad, AF056 Iullemmeden, AF051 Benue, AF042 Rio del Rey, AF048 Keta, AF054 Volta |
| `groundwater_water_table_fan2017_rst` | 1000 × 800 float32 | 3.29 MB | 0–380.51 m, mean 19.65 m, median 16.23 m, 60.4% of grid valid (Nigeria outline) |
| `geophysics_magnetic_emag2_rst` | 500 × 400 float32 | 0.89 MB | −128.67 to +104.05 nT, mean −7.06 nT, 54.7% of grid valid |

The 54.7% whole-grid figure includes the expected area outside the Nigeria mask;
it is not a land-completeness measure. The subsequent land audit measured 90.2%
valid sampled cells and 90.1% valid full cells. The current layer is therefore
classified as partial coverage. Its tile bytes, logical array and public raster
assets remain hash-identical to the values summarized above.

Published outputs for the site: 2 new `.png` / `.vals.gz` raster pairs and 5 new
vector `.geojson` files under `public/data/` (9 files). The WPDx GeoJSON is 26.9 MB; that
layer is **off by default** and only loads when the user switches it on.

## 5. Deliberately not picked (with reasons)

These were all probed from CI on 2026-11-07. Sizes are the publisher's
`Content-Length`; where a source is simply too large to relay, that is the reason.

| Candidate | Exact URL | Why skipped now |
|---|---|---|
| SoilGrids250m depth to bedrock | `https://files.isric.org/soilgrids/former/2017-03-10/data/BDTICM_M_250m_ll.tif` | **8.48 GB** global GeoTIFF; also ODbL 1.0 share-alike (different from the CC BY 4.0 SoilGrids 2.0 products already used). |
| GLHYMPS permeability + porosity | `https://storage.i-guide.io/datasets/fd345695-7dfd-4ba1-97b7-a3cc984b060d/GLiM_GLHYMPS.zip` | **2.29 GB** archive. Genuine gap, but the ECOWAS vector already delivers permeability-relevant flow/yield classes at a fraction of the size. |
| Global arsenic probability | `https://opendata.eawag.ch/dataset/96c10d69-078b-4db9-88d7-6c169826d91a/resource/81801478-47ba-41fb-8bea-280632526053/download/maps.zip` | **3.98 GB** ZIP; the main `probability_arsenic_gt_10ppb.tif` alone is 1.9 GB float64. |
| Global fluoride probability | `https://opendata.eawag.ch/dataset/2012f6f6-afb5-4c30-b032-89f28d0acd93/resource/840629ab-1899-4754-a2aa-827fe479a5ef/download/maps.zip` | **2.03 GB** ZIP; main hazard raster 1.6 GB float64. Both are already inset themes on the ECOWAS 2022 map's technical note. |
| GEM global active faults | `https://github.com/GEMScienceTools/gem-global-active-faults` | Duplicates `geology_faults_map2011_ln`; Nigeria is low-seismicity. GEM hazard is CC BY-NC-SA (non-commercial). |
| Geothermal heat flow (IHFC 2021) | `https://www.ihfc-iugg.org/products/global-heat-flow-database/data` | Only a handful of measurement points in Nigeria; a near-empty national layer. |
| WOKAM karst aquifers | `https://download.bgr.de/bgr/grundwasser/whymap/shp/WHYMAP_WOKAM_v1.zip` | Carbonate/karst outcrops are negligible in Nigeria. |
| GLiM global lithology | `https://doi.org/10.1594/PANGAEA.788537` | Duplicates `geology_units_map2011_pg` + USGS surficial geology. |
| Geomorpho90m slope / TWI | `https://doi.org/10.1038/s41597-020-0479-6` | Derivable locally from the existing `elevation_srtm_terrarium_rst` — no new source needed. |
| BGS 2012 quantitative Africa maps (xyz) | `https://earthwise.bgs.ac.uk/index.php/Continental_hydrogeological_maps_of_Africa` | Legacy download endpoints now 404/redirect; the 1 km Fan WTD NetCDF covers depth-to-water at much higher resolution. |
| NGSA Nigeria airborne magnetics | `https://ngsa.gov.ng/airborne-magnetic-data/` | Only three free 1:50,000 sample sheets; the rest of the national survey is paid. The EMAG2 source is global and free, but the committed Nigeria derivative remains explicitly partial until a verified complete rebuild. |
| IGRAC WFS Nigeria hydrogeology layer | `BGS_groundwater:bgs_hydrogeol_nigeria` on `https://ggis.un-igrac.org/geoserver/ows` | WFS query returned HTTP 400 (layer retired); the BGS country ZIP is the authoritative source anyway. |

**Unreachable / verified-dead during the probe:** `https://thredds-gfnl.usc.es/...`
HTTPS variant times out (HTTP variant works), `https://services.bgr.de/wms/groundwater/ecowas`
GetCapabilities 404, `energydata.info` NMIS dataset 403, `https://data.msdlive.org/api/records/h2wjr-te507/files`
contains only a 12-byte `dummy.txt` (the real 0.5° aquifer-property CSV is not
served by that API). HDX `package_search?q=groundwater&fq=groups:nga` returns 0
datasets — the WPDx link must be used directly.

## 6. Reproduction

```
gh workflow run fetch-geology-layers.yml      # on the default branch, or
git push <branch> with a change to scripts/fetch_geology_layers.py
python scripts/reclassify_magnetic_coverage.py  # verify current metadata-only result
python scripts/build_site.py                  # data/<group name>/**/*.gpkg -> public/
```

The workflow installs `numpy Pillow tifffile rasterio imagecodecs netCDF4
geopandas pyogrio shapely pandas`, runs the fetch script, validates all seven
GeoPackages and commits changed grouped `data/**/*.gpkg` files with `[skip ci]`. Successful runs:
`42362739731` (bot commit `4b71519`). Every layer is independently re-fetchable;
nothing depends on a previous batch's temporary files.

## 7. Attribution summary

* BGS (2019/2021) Africa Groundwater Atlas Country Hydrogeology Maps — **CC BY-SA 4.0**.
* BGR/BGS/BRGM/Eawag/UNESCO (2022), Groundwater Resources in the ECOWAS Region,
  doi `10.25928/GWR-ECOWAS.1`.
* WPDx / HDX Nigeria water points — **CC BY-SA 4.0**.
* IGRAC & UNESCO-IHP (2025) Transboundary Aquifers of the World, Edition 2025,
  doi `10.58154/yb8g-cp97` — **CC BY-SA 3.0 IGO**.
* Fan et al. (2017), PNAS 114(40):10572-10577 — free for research with acknowledgement.
* EMAG2 v2 / NOAA NCEI / CIRES — free, cite the EMAG2 v2 product.

Share-alike licences (BGS, WPDx, IGRAC) apply to the derived GeoPackages and the
published GeoJSON; attribution is carried in each `gpkg_contents.description`
and in the catalog entries generated from them.
