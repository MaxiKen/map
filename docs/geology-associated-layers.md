# Geology-associated layers available online for Nigeria

> **Status 2026-11-07 (updated):** seven of the sources surveyed below were
> subsequently fetched, cropped to Nigeria, published as standalone GeoPackages
> and added to the site (56 layers, 18 groups, build `f445969fc8`). See
> **`docs/geology-layers.md`** for the exact picks, URLs, licences, method and
> validation — including why the large/duplicate candidates were skipped.

Originally surveyed 2026-11-07 against the then-current catalog: 49 layers in 17
groups (build `627de1bd83`). It began as a **research-only** survey; no import was
performed as part of the survey itself. Source shortlists for the two earlier
fetches are in `docs/raster-sources.md` and `docs/online-layers.md`.

## What the project already has (so we don't duplicate it)

| Theme | Existing layers |
|---|---|
| Bedrock geology / lithology | `geology_units_map2011_pg`, `geology_unit_boundaries_map2011_ln`, `geology_admin_boundaries_map2011_ln`, `geology_ridges_map2011_ln`, `geology_map2011_img`, `geology_general_picture_*` |
| Surficial geology | `geology_surficial_usgs_pg`, `geology_surficial_usgs_code_rst` — USGS surficial geology by `glg_code`, 14 classes (the exact source edition is not recorded in the repo, but it is in this family of Africa-wide USGS products) |
| Structures / faults | `geology_faults_map2011_ln` |
| Mineral resources | `minerals_occurrences_map2023_pt`, `minerals_unresolved_symbols_map2023_pt`, `minerals_division_lines_map2023_ln`, `minerals_map2023_img`, `minerals_legend_map2023_tbl` (folded) |
| Topography | `elevation_srtm_terrarium_rst` (500 × 400, 0.025°) |
| Soils | `soil_wrb2006_isric_pg`, `soil_ph_0_5cm_isric_rst` |
| Surface water | `water_lines_diva_ln`, `water_areas_diva_pg`, `water_basins_fao_pg` |
| Hazards | `hazards_flood_aqueduct_rst` (100-year riverine depth) |
| Climate | 3 WorldClim 2.1 rasters |

**The one big hole is the subsurface below the soil:** there is no aquifer,
water table, groundwater, regolith/bedrock-depth, geophysics, or geothermal
layer of any kind. Rivers, lakes, basins and flood inundation are surface water;
they do not represent groundwater.

The project's standing rule is **mostly vectors, rasters only for continuous
fields**. So aquifer/hydrogeological units and fault-style linework should be
vectors; depth-to-water, depth-to-bedrock, geophysical anomaly fields and
probability surfaces are legitimately rasters.

---

## A. Groundwater / water table — the clearest gap

### A1. BGS Africa Groundwater Atlas — Nigeria country hydrogeology map (vector) ★

- **URL:** `https://africagroundwateratlas.org/downloads/Nigeria.zip`
- **Index / licence:** `https://africagroundwateratlas.org/downloadGIS.html`, `https://www.bgs.ac.uk/geology-projects/africa-groundwater-atlas/`
- **Content:** one shapefile per country at 1:5,000,000, with **both geology
  (hydrogeologically significant units) and hydrogeology (aquifer type +
  productivity)** in the attribute table, plus ArcGIS `.lyr` legend files and
  the user-guide PDF. 43 countries released, Nigeria included. Version 1.0
  (2019), CC BY-SA.
- **Why useful:** a ready-made, Nigeria-specific vector layer that answers
  "where are the high-yielding aquifers, and are they porous / weathered /
  fractured?" — no clipping of a global raster needed. Small (<10 MB).
- **Note:** the accompanying `Hydrogeology of Nigeria` profile reports water
  tables typically 3–15 m below ground (up to 55 m), yields 3–60 l/s and
  borehole depths 10–800 m for the dominantly unconsolidated aquifers — those
  are **text statistics**, not a spatial layer.

### A2. WHYMAP / BGR "Groundwater Resources in the ECOWAS Region" (vector) ★

- **URL:** `https://download.bgr.de/bgr/grundwasser/gwr_ecowas/SHP/GWR_ECOWAS_SHP_v1.zip`
- **Page:** `https://www.whymap.org/whymap/EN/Maps_Data/Gwrecowas/gwrecowas_node_en.html`
- **Content:** 2022, 1:5,000,000, UNESCO/BGR/BGS/BRGM/EAWAG. Expected aquifer
  productivity (5 borehole-yield classes × 4 aquifer flow types), 15 generalised
  lithological classes, harmonised across ECOWAS from the *Carte hydrogéologique
  de l'Afrique* (Seguin 2016) and the BGS country maps, with Nigeria-specific
  linework refined from Dessauvagie (1974). Includes sedimentary-basin isopachs,
  a structural/tectonic map, fluoride and arsenic probability, groundwater
  recharge and groundwater-level hydrographs as **inset themes** (in the PDF /
  technical note): `https://download.bgr.de/bgr/grundwasser/gwr_ecowas/PDF/GWR_ECOWAS_PDF_v1.zip`.
- **Why useful:** newer and more harmonised than the BGS country map, and West
  Africa-specific. A good second aquifer variant (different vintage / method,
  like the DIVA-vs-OSM pairs already kept in the catalog).

### A3. Depth to groundwater / water table (continuous → raster) ★

Three independent products, all Nigeria-covering:

| Product | Resolution / classes | Format | Access |
|---|---|---|---|
| **BGS Quantitative maps of groundwater resources in Africa** (MacDonald et al. 2012) | nominal 1:20 M, six classes `<7 … >250 m` (plus aquifer productivity `>20 … <0.1 l/s` and groundwater storage `0 … >50,000 mm`) | xyz tab-delimited text → rasterise | `https://earthwise.bgs.ac.uk/index.php/Continental_hydrogeological_maps_of_Africa`; IGRAC viewer `https://ggis.un-igrac.org/ggis-viewer/viewer/groundwaterafrica/public/default`; WFS `BGS_groundwater:bgs_hydrogeol_nigeria` on `https://ggis.un-igrac.org/geoserver/ows` |
| **Fan, Li & Miguez-Macho 2013 / revised 2017 global water table depth** | 0.01° (~1 km), equilibrium water table depth in m | NetCDF | JRC AquaKnow record `https://aquaknow.jrc.ec.europa.eu/node/18916`; source THREDDS `http://thredds-gfnl.usc.es/thredds/catalog/GLOBALWTDFTP/catalog.html` |
| **GLOBGM v1 (2025) hyper-resolution groundwater heads / WTD** | 30 arc-sec (~1 km), monthly 1960–2019 + scenarios | NetCDF | `https://eartharxiv.org/repository/view/10273/` |

- **Licence:** BGS maps are free with acknowledgement of MacDonald et al. 2012;
  the Fan dataset is free for research with citation of Fan et al. 2017;
  GLOBGM is an open research dataset.
- **Caveats:** the old `www2.bgs.ac.uk/groundwater/international/africangroundwater/mapsDownload.html`
  now redirects to a generic BGS page, so the xyz files need to be recovered
  from IGRAC's GeoServer or an archived mirror. The Fan THREDDS host returned
  HTTP 500 during this survey. Both are **modelled** estimates, not observed
  water levels.

### A4. Compact package with most aquifer properties at once

`https://data.msdlive.org/records/h2wjr-te507` — *Global Geo-processed Data of
Aquifer Properties by 0.5° Grid, Country and Water Basins* (Niazi et al., 2024,
open). `aquifer_properties_rec.csv` + `shapefiles.zip` contain
`Depth_to_water` (Fan 2013), `Recharge` (Döll & Fiedler 2008),
`Aquifer_thickness` (de Graaf 2015), `Porosity` / `Permeability` (GLHYMPS),
and `WHYClass` (WHYMAP aquifer classes). At 0.5° it is coarse, but it is a
single small download that yields five distinct geology-associated themes.
Also `https://www.osti.gov/biblio/2484226`.

### A5. Related groundwater themes

- **Transboundary aquifers** — IGRAC *Transboundary Aquifers of the World* 2021
  (468 systems) / 2025 edition: `https://un-igrac.org/data/maps/transboundary-aquifers-of-the-world-map-2021-3/`,
  viewer `https://ggis.un-igrac.org/view/tba/`, Africa map
  `https://un-igrac.org/data/maps/`. Nigeria shares **AF051 Aquifer Vallée de la
  Benoué** (Nigeria/Cameroon, 196,532 km²) and **AF052 Lake Chad Basin**
  (1,983,982 km²). Vector polygons, small.
- **Karst aquifers** — WHYMAP WOKAM shapefile
  `https://download.bgr.de/bgr/grundwasser/whymap/shp/WHYMAP_WOKAM_v1.zip`
  (`https://www.whymap.org/whymap/EN/Maps_Data/Wokam/wokam_node_en.html`).
  **Low value for Nigeria** — carbonate/karst outcrops are negligible; skip.
- **Groundwater recharge** — MacDonald et al. 2021 Africa recharge from 134
  ground studies is an inset of the ECOWAS map; the global Döll & Fiedler 2008
  / Gleeson 2016 0.5° grids are in the MSDLive package above. Moeck et al. 2020
  compiled a global point dataset of direct natural recharge
  (`https://www.dora.lib4ri.ch/eawag/`).
- **Groundwater quality (geogenic)** — Eawag / ERIC-open global probability
  rasters: arsenic >10 µg/L (Podgorski & Berg 2020,
  `https://doi.org/10.25678/0001ZT`) and fluoride >1.5 mg/L (Podgorski & Berg
  2022, 250 m, `https://doi.org/10.25678/0006GQ`), viewable on
  `https://www.gapmaps.org`. Both highlight African/Sahel hotspots, so Nigeria
  has real signal. Continuous probability → raster.
- **Boreholes / water points** — WPDx Nigeria on HDX,
  `https://data.humdata.org/dataset/wpdx_nga`, CSV 53.2 MB, CC BY-SA, weekly
  updates to 2024, with `#lat_deg` / `#lon_deg`, water source/tech, status,
  adm1/adm2. Direct:
  `https://data.humdata.org/dataset/29677a2d-1fb2-48a3-a06a-9c66800c418b/resource/1fdb9a0c-d145-49e5-a502-6a3bc63626e8/download/wpdx_enhanced.csv`.
  A national 86,586-point 2010–2024 inventory is also on Zenodo
  (`https://zenodo.org/records/23526026`). This is water infrastructure rather
  than geology, but it is the closest thing to **observed** groundwater points.
  NMIS 2009–2014 water facilities (GeoJSON/CSV) also exist at
  `https://energydata.info/dataset/nigeria-nmis-water-facility-data-2014`.

---

## B. Subsurface geometry / rock properties

| Concept | Source | Format | Notes |
|---|---|---|---|
| **Depth to bedrock / regolith thickness** | ISRIC SoilGrids250m `BDTICM` — `https://files.isric.org/soilgrids/former/2017-03-10/data/BDTICM_M_250m_ll.tif` (250 m, cm, EPSG:4326, ODbL 1.0); metadata `https://data.isric.org/srv/api/records/f36117ea-9be5-4afd-bb7d-7a3e77bf392a` | GeoTIFF | Continuous → raster. Directly complements existing soil pH/WRB layers. SoilGrids 2.0 predictions are CC BY 4.0 via WCS `https://maps.isric.org` (the project already uses `phh2o.map`; a `bdticm.map` endpoint returned 404 during this survey, so the exact 2.0 coverage name still needs checking). |
| **Soil / regolith / sedimentary deposit thickness** | Pelletier et al. 2016, ORNL DAAC `https://daac.ornl.gov/SOILS/guides/Global_Soil_Regolith_Sediment.html` | 6 GeoTIFFs, 30 arc-sec | Separate from depth-to-bedrock; explicitly models regolith from water-table depth. Global free archive. |
| **Permeability & porosity (GLHYMPS)** | Gleeson et al. 2014 `https://doi.org/10.5683/SP2/DLGXYO` (1.1 GB GDB), v2.0 Huscroft et al. 2018 `https://doi.org/10.5683/SP2/TTJNIU` (2.4 GB shapefile), CC BY 4.0 | polygon vector | Genuine gap: hydraulic rock properties. The 2.4 GB shapefile is impractical; a **convenient redistribution as GeoPackage + COG** is `https://storage.i-guide.io/datasets/fd345695-7dfd-4ba1-97b7-a3cc984b060d/GLiM_GLHYMPS.zip` (`https://platform.i-guide.io/datasets/fd345695-7dfd-4ba1-97b7-a3cc984b060d`, CC BY). Clip to Nigeria. |
| **Global lithology (GLiM)** | Hartmann & Moosdorf 2012, 1.2 M polygons, 0.5° gridded version `https://doi.org/10.1594/PANGAEA.788537`; `https://www.geo.uni-hamburg.de/en/geologie/forschung/aquatische-geochemie/glim.html` | vector / raster | **Overlaps** `geology_units_map2011_pg`; only worth adding as an explicitly labelled global-vintage variant. |

---

## C. Geophysics, geothermal and geohazards

| Concept | Source | Format / licence | Nigeria relevance |
|---|---|---|---|
| **Magnetic anomaly** | EMAG2 v2, NOAA/NCEI + CIRES — `https://www.geomag.org/models/emag2.html`, `http://geomag.colorado.edu/images/EMAG2/EMAG2_V2.tif` (228 MB float32 GeoTIFF, 2 arc-min, nT, nodata −99999), free | raster | Directly maps basement structure, lineaments and basin depth — a real complement to the existing fault lines. Also **NGSA Nigeria airborne magnetic data** `https://ngsa.gov.ng/airborne-magnetic-data/` offers free 1:50,000 Geosoft/ASCII sample sheets (e.g. `https://ngsa.gov.ng/sheet-287-nsukka-se/`, `.../sheet-143-alawa-nw/`), but most sheets are paid. |
| **Gravity anomaly** | WGM2012 / EGM2008 Bouguer, isostatic, free-air 2′×2′ grids, `https://bgi.obs-mip.fr/grids-and-models-2/` ("Extract geographical area" service) | raster (ASCII grids) | Sedimentary basin thickness / crustal structure. Genuine gap. |
| **Geothermal heat flow** | IHFC Global Heat Flow Database release 2021 (74,548 points, CSV/XML) `https://www.ihfc-iugg.org/products/global-heat-flow-database/data`; Lucazeau 2019 0.5° gridded map `https://doi.org/10.1029/2019GC008389`; older compilation `https://doi.org/10.1594/PANGAEA.910894` | points + 0.5° raster | Scientifically interesting but **very sparse in Nigeria** — likely only a handful of points. Low priority. |
| **Active faults / seismicity** | GEM Global Active Faults `https://github.com/GEMScienceTools/gem-global-active-faults` (raw `geojson/gem_active_faults.geojson`, 11.7 MB, 13,696 traces, free with attribution/share-alike); GEM Global Seismic Hazard Map v2026.1 `https://www.globalquakemodel.org/product/global-seismic-hazard-map` | vector lines + PGA raster | **Overlaps** `geology_faults_map2011_ln`. Nigeria is a low-seismicity intraplate region, so hazard values are near-uniform. GEM hazard data is **CC BY-NC-SA 4.0 (non-commercial)** — check before publishing. |
| **Terrain / geomorphometry** | Geomorpho90m, 26 MERIT-DEM derivatives (slope, aspect, TWI, geomorphons), 90 m / 250 m — `https://doi.org/10.1038/s41597-020-0479-6`, tiles named e.g. `slope_90M_MERIT_s00e000.tif` | GeoTIFF | Derivable from the project's **existing DEM** with no new source; cheaper and more consistent. Listed here for completeness, not as a fetch candidate. |
| **Landslide susceptibility / geohazard** | NASA LHASA ~250 m global susceptibility GeoTIFF (public domain) `https://www.geonode-gfdrrlab.org/layers/hazard:ls_nasa_rc`; World Bank / GFDRR / Arup Global Landslide Hazard Map 2020 `https://energydata.info/dataset/global-landslide-hazard-map` (ZIP + COG TIFF) | raster | Genuine gap, but Nigeria's relief is low outside the Jos / Mambilla / Obudu highlands and the eastern escarpment — most of the country would be "very low". |

---

## D. Already represented / not worth adding

- **Lithological / geological units** — `geology_units_map2011_pg` + USGS surficial
  geology already cover this; adding GLiM or another USGS Africa surficial-geology
  edition (`https://catalog.data.gov/dataset/surficial-geologyof-africa-geo7-2ag`,
  the same base map BGS used for its aquifer maps) would be a duplicate.
- **Faults, ridges, unit boundaries, mineral occurrences** — present.
- **River basins / surface water** — `water_basins_fao_pg` is HydroSHEDS-derived;
  WHYMAP's *River and Groundwater Basins of the World*
  (`https://www.whymap.org/whymap/EN/Maps_Data/Rgwb/rgwb_node_en.html`) is a
  coarser 2012 global overview that would mostly repeat it.
- **Global groundwater resources of the world** (WHYMAP 2008,
  `https://www.whymap.org/whymap/EN/Maps_Data/Gwr/gwr_node_en.html`) — 1:25 M,
  three broad hydrogeological environments + recharge classes; superseded for
  Nigeria by the ECOWAS 2022 and BGS 2019 products.
- **Karst (WOKAM)** — negligible in Nigeria.
- **DEM-derived slope/TWI** — derive locally instead.

---

## Suggested first five (if you want a fetch next)

Keeping the *mostly vectors* rule and avoiding duplicates:

1. **BGS Nigeria hydrogeology + geology shapefile** — `https://africagroundwateratlas.org/downloads/Nigeria.zip` — vector, tiny, Nigeria-specific, aquifer type + productivity. Highest value per byte.
2. **WHYMAP ECOWAS hydrogeological units** — `https://download.bgr.de/bgr/grundwasser/gwr_ecowas/SHP/GWR_ECOWAS_SHP_v1.zip` — vector, 2022, expected borehole yields, Nigeria-refined linework. Clip to Nigeria.
3. **Depth to water table** — BGS 2012 Africa xyz (via IGRAC GeoServer) or Fan 2013/2017 1 km NetCDF → one clipped `2d-gridded-coverage` raster. This is literally the "water table" layer; a continuous field justifies a raster.
4. **Depth to bedrock / regolith thickness** — ISRIC `BDTICM_M_250m_ll.tif` (or Pelletier 2016 ORNL) → one clipped raster, pairs naturally with the existing soil pH and WRB layers.
5. **GLHYMPS permeability + porosity** — via the I-GUIDE GeoPackage redistribution → one clipped vector layer of hydraulic rock properties.

Useful second wave: **WPDx boreholes** (point vector, observed data),
**EMAG2 magnetic anomaly** (raster), **arsenic / fluoride probability** (two
rasters), **IGRAC transboundary aquifers** (polygon vector). Skip heat flow,
karst, seismic hazard and global lithology for now.

## Practical notes for a future import

- All global rasters / vectors would need clipping to `2.5–15.0°E, 4.0–14.0°N`
  and masking to the geoBoundaries national outline, exactly as
  `scripts/fetch_layers.py` and `scripts/fetch_rasters.py` do. Because the
  editing sandbox cannot reach these hosts directly, a GitHub Actions relay
  workflow is the working pattern (`.github/workflows/fetch-layers.yml`).
- Licences: BGS country maps CC BY-SA; WHYMAP/BGR vector data is free with
  attribution (check BGR terms before redistribution); GLHYMPS / GLiM CC BY 4.0;
  SoilGrids250m ODbL 1.0 (share-alike — note the share-alike obligation differs
  from the CC BY 4.0 SoilGrids 2.0 products already used); WPDx CC BY-SA; EMAG2
  free; GEM hazard **non-commercial**.
- Several legacy BGS URLs (`www2.bgs.ac.uk/.../mapsDownload.html`,
  `/africangroundwateratlas/index.cfm`) now 404 or redirect. Use
  `africagroundwateratlas.org`, `earthwise.bgs.ac.uk` (intermittently returns
  "MediaWiki internal error") or the IGRAC GGIS GeoServer instead.
- Fan WTD THREDDS host returned HTTP 500 during this survey; the JRC AquaKnow
  record stays the reliable metadata entry point.
- Nothing in this survey has been verified by an actual binary download; the
  URLs come from the publishers' own catalogues and metadata records and should
  be HEAD-tested in CI before a fetch, as was done for the last batch.
