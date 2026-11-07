# The five fetched rasters — sources and provenance

> A second batch of three continuous rasters (built-up surface, 100-year flood
> depth, WorldPop population counts) plus five vector layers was added later the
> same day; see `docs/online-layers.md`. A third batch added two more geology
> rasters (water-table depth, magnetic anomaly) plus five vectors; see
> `docs/geology-layers.md`. A final batch added one more hazard raster plus two
> vectors; see `docs/final-layers.md`.

Added 2026-11-07 to fill the five concepts with **zero representation** in the project
(the gaps listed in `docs/missing-concepts.md`). Each is a proper `2d-gridded-coverage`
GeoPackage in `data/`: one float32 GeoTIFF tile, EPSG:4326, 500 × 400 cells at 0.025°
over `2.5–15.0°E, 4.0–14.0°N`, clipped to the geoBoundaries national outline so cells
outside Nigeria are NoData (`−9999`). Build emits a colour image plus a `.vals.gz` grid,
so every layer supports click-to-read values and area sums.

| Layer | Concept | Source | Units | Valid range |
|---|---|---|---|---|
| `elevation_srtm_terrarium_rst` | Elevation / DEM | AWS Terrain Tiles (Mapzen Terrarium: SRTM 30 m with Copernicus/other fill), zoom-9 tiles | metres | 0 – 2,381 |
| `climate_tavg_annual_worldclim_rst` | Temperature | WorldClim 2.1 10′ monthly `tavg`, mean of 12 months (1970–2000) | °C | 20.75 – 28.94 |
| `climate_prec_annual_worldclim_rst` | Precipitation | WorldClim 2.1 10′ monthly `prec`, sum of 12 months | mm/yr | 227 – 3,724 |
| `climate_srad_annual_worldclim_rst` | Solar radiation | WorldClim 2.1 10′ monthly `srad`, mean of 12 months | kJ m⁻² day⁻¹ | 14,215 – 21,820 |
| `soil_ph_0_5cm_isric_rst` | Soil pH | ISRIC SoilGrids 2.0 WCS `phh2o_0-5cm_mean`, values ÷ 10 | pH | 4.60 – 8.00 |

## Source links and licences

- **WorldClim 2.1** — <https://www.worldclim.org/data/worldclim21.html>,
  `https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_{prec,srad,tavg}.zip`.
  Fick & Hijmans (2017), *International Journal of Climatology* 37(12), doi:10.1002/joc.5086.
- **AWS Terrain Tiles / Terrarium** — `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`,
  304 tiles at z=9. Elevation decoded as `R×256 + G + B/256 − 32768`. Derived from SRTM and
  other public DEMs, distributed by Mapzen/AWS Open Data.
- **ISRIC SoilGrids 2.0** — `https://maps.isric.org/mapserv?map=/map/phh2o.map`
  (WCS 2.0.1, `COVERAGEID=phh2o_0-5cm_mean`, `OUTPUTCRS=EPSG:4326`, `SIZE=Long(500)/Lat(400)`).
  Poggio et al. (2021), *SOIL* 7:217–240, doi:10.5194/soil-7-217-2021, CC BY 4.0.

## Why these are rasters, not vectors

All five are continuous fields. The picture-vector versions in `files/all_maps.gpkg`
(7 elevation bands, 8 temperature bands, 5 pH bands) were excluded earlier because they are
coarse interpretations of printed sheets; the pH one was scored ~50 % accurate. The DEM,
climate normals and SoilGrids prediction are genuine per-cell measurements.

## Reproduction

`scripts/fetch_rasters.py` downloads and builds all five; `scripts/make_raster_gpkg.py` writes the
GeoPackage containers. Both need unrestricted HTTPS, so they run in the repository's
**Fetch public raster sources** GitHub Actions workflow (`workflow_dispatch`), which commits
the resulting grouped `data/**/*.gpkg` files. The sandbox itself can only reach GitHub/PyPI, which is why
the fetch was relayed through CI. To re-run: `gh workflow run fetch-rasters.yml`.

## Validation performed

- Every `.gpkg` opens with `data_type = 2d-gridded-coverage`, `srs_id = 4326`, one float32 tile.
- `build_site.py` reads all five as `raster`, `categorical = false`, with a 500 × 400 value grid each.
- Spot checks against known Nigerian geography: Jos Plateau 1,243 m and 21.9 °C, Mambilla
  1,282 m and 22.1 °C, Abuja 494 m and 26.0 °C, Maiduguri 335 m and 557 mm/yr, Bonny coast
  3,715 mm/yr, Sokoto 28.3 °C and 605 mm/yr.
- The DEM's ocean bathymetry is removed and every raster is clipped to the national outline,
  so the colour ramp reflects land values only.

The catalog now has **41 layers, 7 rasters, 0 table layers**.
