# Final batch — three non-groundwater layers

Added 2026-11-07 as the **fourth and final** fetch batch. The previous batch
(`docs/geology-layers.md`) was deliberately groundwater-heavy: aquifer units,
boreholes, water table depth, transboundary aquifers. This batch broadens the
catalog into the *other* categories from `docs/geology-associated-layers.md`:
**geohazards** and **geothermal / rock properties**.

Three layers, **2 vectors + 1 raster** — the standing "mostly vectors, few
rasters" rule holds; only the continuous annual landslide frequency needs a
raster. One standalone `.gpkg` per layer, cropped to `2.5–15.0°E, 4.0–14.0°N`,
raster masked to the geoBoundaries national outline, zero table layers.

Site build: **`3add8addcb`** — 59 layers from 62 files, 18 groups, 13 rasters,
0 table layers. No new group: the two landslide layers join **Natural hazards**,
the heat-flow points join **Geology**.

---

## 1. What was picked

| Layer (`.gpkg` in its `data/` group folder) | Kind | Content | Why |
|---|---|---|---|
| `hazards_landslide_rainfall_wb_rst` | raster | 500 × 400, 0–0.0268 landslides/km²/yr | The only **quantitative** geohazard layer; complements the existing 100-year flood-depth raster with a rainfall-triggered slope-failure frequency. |
| `hazards_landslide_classes_wb_pg` | polygon | 1,500 class regions, ranks 1–4 (Very low → High) | The same concept as a **vector**: combined rainfall + earthquake hazard simplified to four ThinkHazard classes. Concept variants kept together, per the project's grouping rule. |
| `geology_heatflow_ihfc2024_pt` | point | 176 measured sites, 25–95 mW/m² | **Observed** geothermal heat flow — a genuinely different physical quantity, with temperature gradient, lithology, quality code and publication reference. Nothing like it existed in the catalog. |

## 2. Sources, exact URLs and licences

| Layer | Publisher / dataset | Exact download | Licence |
|---|---|---|---|
| Both landslide layers | World Bank Group & GFDRR, *Global Landslide Hazard Map* (Arup, 2020), CKAN dataset `global-landslide-hazard-map`, `https://energydata.info/dataset/global-landslide-hazard-map`, API `https://energydata.info/api/3/action/package_show?id=global-landslide-hazard-map`. | Median rainfall-triggered COG: `https://datacatalogfiles.worldbank.org/ddh-published/0037584/DR0045419/LS_RF_Median_1980-2018_COG.tif` (129.7 MB). ThinkHazard ranks ZIP: `https://datacatalogfiles.worldbank.org/ddh-published/0037584/DR0045415/ls_th.zip` (18.9 MB, contains `LS_TH.tif`). | **CC BY 4.0** (dataset `license_id: CC-BY-4.0`). |
| Heat flow | International Heat Flow Commission, *Global Heat Flow Database, Release 2024* (91,182 points), DOI `10.5880/fidgeo.2024.014`; landing page `https://www.ihfc-iugg.org/products/global-heat-flow-database/data`. | `https://www.ihfc-iugg.org/user/downloads/data/R2024/IHFC_2024_GHFDB.xlsx` (30.7 MB). | Open EOSDIS/GFZ-style research data; cite the release DOI. Data description: `https://www.ihfc-iugg.org/user/downloads/data/R2024/GHFDB-AG_etal._2024_release_data_description.pdf`. |

The median raster is the **median annual frequency of significant
rainfall-triggered landslides per km², 1980–2018**; the classified raster is the
combined rainfall + earthquake hazard simplified to four ThinkHazard ranks.
Both are 30 arc-second (~1 km) global Cloud-Optimised GeoTIFFs (43,201 × 15,779,
EPSG:4326), so a `/vsicurl/` window transfers only the 1,500 × 1,200 Nigeria
block instead of the whole file.

## 3. Method

`scripts/fetch_final_layers.py`, run in GitHub Actions
(`.github/workflows/fetch-final-layers.yml`) because the editing sandbox cannot
reach these hosts directly.

* **Quantitative raster** — the Nigeria window of the median COG is written to a
  temporary GeoTIFF, then averaged to 500 × 400 with `WarpedVRT` and masked to
  the national outline. Annual frequency is a *rate*, so `Resampling.average`
  (not `sum`) is correct. NoData `-9999`, bbox `2.5, 4.0, 15.0, 14.0`.
* **Classified vector** — `LS_TH.tif` is `uint8` with values 1–4 and 255 NoData.
  Its Nigeria window is masked to the national outline *before* polygonising, so
  the "Very low" class does not spill into neighbouring countries.
  `rasterio.features.shapes` produces contiguous class regions; regions smaller
  than `5e-6 deg²` are dropped, the **largest 1,500** are kept, and boundaries
  are simplified to `0.002°` with topology preserved. `class_name` carries the
  readable ThinkHazard label so the site colours it automatically.
* **Heat-flow points** — the IHFC workbook has a multi-row header: coded column
  IDs on row 0, flags/units on rows 1–4, **real field names on row 5** (0-based).
  Read with `pandas.read_excel(..., sheet_name='data release2024', header=5)`,
  giving `q` (heat flow, mW/m²), `q_uncertainty`, `lat_NS`, `long_EW`,
  `environment`, `Domain`, `Country`, `Year`, `Quality_Code`,
  `publication_reference`, `geo_lithology`, `T_grad_mean`. 176 of 91,182 rows
  fall inside the Nigeria window (including a handful of nearby cross-border
  sites in Niger / Cameroon, kept with their `country` attribute). Points built
  from `long_EW` / `lat_NS`.

## 4. Validation (from the committed GeoPackages)

| Layer | Features / grid | Size | Values |
|---|---|---|---|
| `hazards_landslide_rainfall_wb_rst` | 500 × 400 float32 | 0.89 MB | 0–0.02685 landslides/km²/yr, mean 0.00011, 60.6% of grid valid |
| `hazards_landslide_classes_wb_pg` | 1,500 polygons | 2.73 MB | 4 classes, ranks 1–4, `EPSG:4326` |
| `geology_heatflow_ihfc2024_pt` | 176 points | 0.14 MB | heat flow 25–95 mW/m², temp gradient 0–77 K/km, 10 publication references |

Published outputs: one `.png` / `.vals.gz` raster pair and two `.geojson` vector
files under `public/data/`. All preview endpoints return HTTP 200.

## 5. Candidates checked and deliberately not picked

All were HEAD/GET-probed from CI on 2026-11-07 before deciding.

| Candidate | Exact URL / source | Why skipped |
|---|---|---|
| Soil / regolith / sedimentary thickness above bedrock | Pelletier et al. 2016, ORNL DAAC DOI `10.3334/ORNLDAAC/1304`, guide `https://daac.ornl.gov/SOILS/guides/Global_Soil_Regolith_Sediment.html` | All four candidate file URLs returned **404 / 403** (the old `daac.ornl.gov` paths are gone; the NASA S3 data path is not public under that prefix). Would have been the ideal subsurface-geometry layer. |
| WGM2012 Bouguer gravity anomaly | `https://bgi.obs-mip.fr/grids-and-models-2/`, DOI `10.18168/bgi.23` | All three candidate grid URLs **404**; the BGI catalogue is a JS app with no direct file link, and the "Extract geographical area" tool is interactive. EMAG2 magnetic anomaly already covers geophysics. |
| GEM Global Active Faults | `https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults.geojson` (12.3 MB, 16,195 traces) | Only **2 traces** intersect Nigeria (both `Macgregor_AfricaFaults` near the Cameroon border). Too sparse to be a useful national layer, and it overlaps `geology_faults_map2011_ln`. |
| GLHYMPS permeability + porosity | `https://storage.i-guide.io/datasets/fd345695-7dfd-4ba1-97b7-a3cc984b060d/GLiM_GLHYMPS.zip` | **2.29 GB** ZIP64. A byte-range central-directory read failed (`BadZipFile`), so only a full download would work — not worth it for one layer. |
| Earthquake-triggered landslide hazard | `https://datacatalogfiles.worldbank.org/ddh-published/0037584/DR0045416/ls_eq_tiled.tif` | Nigeria values are effectively zero (0–3 × 10⁻⁵); no useful signal. Its contribution is already folded into the 4-class combined layer. |
| Global arsenic / fluoride probability rasters | Eawag `maps.zip` (3.98 GB / 2.03 GB) | Too large; also groundwater-quality rather than the requested breadth. |
| Geomorpho90m slope / TWI | `https://doi.org/10.1038/s41597-020-0479-6` | Derivable locally from the existing `elevation_srtm_terrarium_rst`; no new source needed. |
| Global lithology (GLiM), WOKAM karst, geothermal gridded heat flow | survey `docs/geology-associated-layers.md` | Duplicate of existing geology, negligible in Nigeria, or too sparse. |

## 6. Reproduction

```
gh workflow run fetch-final-layers.yml        # on the default branch, or
git push <branch> with a change to scripts/fetch_final_layers.py
python scripts/build_site.py                  # data/<group name>/**/*.gpkg -> public/
```

The workflow installs `numpy Pillow tifffile rasterio imagecodecs geopandas
pyogrio shapely pandas openpyxl`, runs the fetch script, validates all three
GeoPackages and commits changed grouped `data/**/*.gpkg` files with `[skip ci]`. Successful run:
`42364720588` (bot commit `7ae501a`).

## 7. Attribution

* World Bank Group / GFDRR (Arup, 2020), *Global Landslide Hazard Map* — **CC BY 4.0**.
* Global Heat Flow Data Assessment Group et al. (2024), *The Global Heat Flow Database: Release 2024*, GFZ Data Services, doi `10.5880/fidgeo.2024.014`.

Both attributions are carried in each `gpkg_contents.description` and in the
generated catalog entries.
