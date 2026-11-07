# Other online layers with Nigeria data that this project has none of

Surveyed 2026-11-07 against the **current** catalog: 41 layers in 15 groups
(`geology, minerals, admin, settlements, population, transport, water, landcover,
soil, ethnic, forest, protected, reference, climate, elevation`).

"Not in the project at all" is used strictly: a concept with **no layer of any kind** — no
vector, no raster, no picture, no folded table. Themes that are already represented are listed
separately at the end, because adding another version of them would not fill a gap.

The project's stated preference is **mostly vectors, rasters only for continuous fields**, so the
list is split accordingly.

---

## A. Completely absent, and best brought in as vectors

| # | Concept | What people use it for | Free Nigeria source | Form / licence |
|---|---|---|---|---|
| 1 | **Health facilities** (hospitals, clinics, pharmacies) | service coverage, catchment analysis, humanitarian planning | Nigeria healthsites (GeoJSON/SHP) [1](https://data.humdata.org/dataset/nigeria-healthsites); e-health Africa registry [2](https://data.humdata.org/dataset/nigeria-health-facilities); HOT OSM export, updated monthly [3](https://data.humdata.org/dataset/hotosm_nga_health_facilities) | points · ODbL / CC BY |
| 2 | **Schools / education facilities** | school mapping, enrolment catchments | HOT OSM Nigeria education-facilities export [5](https://data.humdata.org/group/nga?organization=hot) | points + polygons · ODbL, GeoPackage available |
| 3 | **Building footprints** | exposure, urban form, microplanning, population dasymetry | Google Open Buildings (516 M buildings across Africa) [5](https://blog.research.google/2021/07/mapping-africas-buildings-with.html); Microsoft `KenyaNigeriaBuildingFootprints` ODbL [1](https://datos.gob.es/en/blog/building-footprints-open-data-saves-lives-emergencies); HOT OSM buildings GPKG [5](https://data.humdata.org/group/nga?organization=hot) | polygons · CC BY 4.0 / ODbL. **Caveat:** Google v2 has no Borno coverage [2](https://data.worldpop.org/repo/prj/grid3/africa_building_metrics/v1/Africa_gridded_buildings_v1_0_README.pdf) |
| 4 | **Airports / airfields, seaports, POIs, banks & ATMs** | logistics, accessibility, humanitarian basemaps | HOT OSM country exports (airports, sea ports, points of interest, financial services) [5](https://data.humdata.org/group/nga?organization=hot) | points/polygons · ODbL, GeoPackage |
| 5 | **Electricity grid** — HV transmission lines, power plants, substations | energy access, siting, infrastructure planning | Nigeria SE4ALL downloadable HV lines + power plants [3](https://nigeriase4all.gov.ng/power-sector); GRID3 substations (1,253 records) [5](https://data.grid3.org/datasets/4eed11fbbdd34779be446296208c6cbe_0/about); curated grid datasets [1](https://github.com/open-energy-transition/Awesome-Electrical-Grid-Mapping) | lines + points · mixed open licences |
| 6 | **Oil & gas infrastructure** — flare sites, spill incidents, pipelines, blocks, refineries | Niger Delta environmental monitoring, the single most Nigeria-specific infrastructure theme | World Bank GGFR / VIIRS flare sites (476 mapped sites) [2](https://github.com/omuya-env/flare-watch-nigeria); NOSDRA oil-spill records + gas-flare tracker [1](https://spillflare.com.ng/); NOSDRA map layers [4](http://sdn4nigeria.github.io/monitoring-platform/open/); OGIM pipelines/blocks CC BY 4.0 [5](https://oilmap.xyz/country_profiles/nigeria_petroleum_market) | points + lines + polygons |
| 7 | **Settlement extents / built-up areas** | where people actually live, as opposed to town centroids | GRID3 Nigeria Settlement Extents v02 [1](https://data.humdata.org/dataset/grid3-nigeria-settlement-extents-version-02) and v4.0 **GeoPackage**, CC BY-SA 4.0 [5](https://ciesin.columbia.edu/news/new-data-release-grid3-nigeria-settlement-extents-v40); GRID3 Data Hub also carries wards, schools, health facilities, population [4](https://www.technicalgis.com/data-sources/nigeria/) | polygons · CC BY-SA 4.0. v02 is a 486 MB geodatabase — v4.0 GPKG is the practical pick |
| 8 | **River basins / watersheds** | hydrological units, upstream–downstream tracing | HydroBASINS (12 nested Pfafstetter levels, free, clip Africa to Nigeria) [3](https://www.hydrosheds.org/products/hydrobasins) | polygons · free with attribution |
| 9 | **Conflict events and displacement** | humanitarian situation maps for the North-East | ACLED Nigeria conflict events, weekly on HDX [1](https://data.humdata.org/dataset/nigeria-acled-conflict-data); IOM DTM IDP site assessments [4](https://dtm.iom.int/datasets/nigeria-north-central-and-north-west-zones-site-assessment-round-18); HDX Nigeria affected-people group [2](https://data.humdata.org/group/nga) | points / tabular with coordinates. ACLED full event data needs free registration |
| 10 | **Flood hazard / susceptibility** | the recurring national flood response theme | GAR/UNEP global flood hazard GeoTIFFs by return period [1](https://geodataviewer.com/datasets/natural-hazards/global-flood-hazard/); a 30 m nationwide Nigeria susceptibility map with open data + code [2](https://link.springer.com/article/10.1007/s11069-025-07868-y); 2022 flood extent/risk study [3](https://www.mdpi.com/2072-4292/17/11/1814) | raster, but can be vectorised to zones |

## B. Completely absent, and genuinely continuous (raster is the right form)

| # | Concept | Free Nigeria source | Note |
|---|---|---|---|
| 11 | **Gridded population** (100 m people-per-cell) | WorldPop Nigeria v2.1 [2](https://data.worldpop.org/repo/wopr/NGA/population/v2.1/NGA_population_v2_1_README.pdf) and v3.0 / 2025 [3](https://data.worldpop.org/repo/wopr/NGA/population/v3.0/NGA_population_v3_0_README.pdf); yearly 2000–2020 rasters on HDX [4](https://data.humdata.org/dataset/worldpop-nigeria-population); constrained counts 2015–2030 [5](https://data.humdata.org/dataset/worldpop-population-counts-2015-2030-nga) | v3.0 is CC BY 4.0; v2.1 is CC BY-SA. Labelled "operational estimates, not official statistics" |
| 12 | **Nighttime lights** (VIIRS VNL v2.2, ~500 m annual composites) | EOG/Payne Institute VNL downloads [5](https://eogdata.mines.edu/products/vnl/) | proxy for electrification and economic activity; GeoTIFF, EPSG:4326 |
| 13 | **Active fires / hotspots** | NASA FIRMS area CSV API (bbox + day range, MODIS/VIIRS) [4](https://firms.modaps.eosdis.nasa.gov/api/area/); VIIRS 375 m product [3](https://www.earthdata.nasa.gov/data/tools/firms/faq) | points by date; savanna burning is a major Nigeria theme. Can be shipped as a point layer |
| 14 | **Malaria incidence / parasite rate** and **travel time to healthcare / cities** | Malaria Atlas Project rasters [1](https://cran.r-project.org/web/packages/malariaAtlas/malariaAtlas.pdf); 1 km accessibility surfaces [2](https://malariaatlas.org/project-resources/accessibility-to-healthcare/); Nigeria-specific 5 km incidence + accessibility study [5](https://www.sciencedirect.com/science/article/pii/S004896972402388X) | 1 km / 5 km GeoTIFF; health planning |
| 15 | **Solar PV potential (GHI / DNI / PVOUT)** and wind resource | Global Solar Atlas ~1 km GeoTIFF, CC BY 4.0 [2](https://www.geodataviewer.com/datasets/energy/global-solar-atlas/); World Bank PVOUT dataset [3](https://datacatalog.worldbank.org/search/dataset/0038641/world-photovoltaic-power-potential-pvout-gis-data-global-solar-atlas) | energy planning; different from the WorldClim `srad` layer already on site |
| 16 | **Surface-water dynamics** (occurrence, seasonality, change, max extent 1984–2019, 30 m) | JRC Global Surface Water Explorer [1](http://data.europa.eu/89h/jrc-gswe-global-surface-water-explorer-v1) | complements the static rivers/lakes vectors |
| 17 | **Built-up fraction / impervious surface** | JRC GHSL `GHS-BUILT-S` (10 m, 2018) and GHS-BUILT-C [2](https://human-settlement.emergency.copernicus.eu/datasets.php) | GHSL also offers 1975–2100 epochs at 1 km |
| 18 | **Vegetation condition (NDVI / EVI)** and land-surface temperature | Sentinel-2 / MODIS time series; GRID3 v4.0 settlement blocks already carry NDVI/EVI [5](https://ciesin.columbia.edu/news/new-data-release-grid3-nigeria-settlement-extents-v40); MODIS LST used as a MAP covariate [3](https://pmc.ncbi.nlm.nih.gov/articles/PMC6173876/) | dynamic, unlike the static CGLS 2019 land-cover classes |

## C. Absent but derivable from data already in `data/` — no download needed

| # | Concept | How |
|---|---|---|
| 19 | **Slope, aspect, hillshade, terrain ruggedness** | derived from `elevation_srtm_terrarium_rst` |
| 20 | **Flood-prone lowlands / elevation zones** | threshold the DEM, optionally intersect `water_lines_diva_ln` |
| 21 | **Other SoilGrids properties** — organic carbon, clay/sand/silt, bulk density, CEC, nitrogen | the WCS pipeline in `scripts/fetch_rasters.py` already works; just swap the coverage ID [5](https://atlas.co/data-sources/soil-grids/) |
| 22 | **Monthly CHIRPS rainfall / drought anomaly** | precipitation theme exists, but only as an annual WorldClim sum; CHIRPS is the standard time-series source [3](https://www.mdpi.com/2072-4292/17/11/1814) |

## D. Themes already represented — do **not** count as gaps

Admin boundaries (country/states/LGAs/wards/centroids), place names and capitals,
population by state, roads, railways, rivers, water bodies, land-cover classes, WRB soil
groups, soil pH, annual temperature / precipitation / solar radiation, elevation, ethnic
areas, forest, protected areas, country reference outlines, geology and minerals.
Adding a second vintage of any of these is a variant, not a new concept — the same rule used
in `docs/all_maps-catalog.md`.

**Borderline, worth calling out:** gridded population (#11), settlement extents (#7) and
built-up (#17) sit next to themes that *do* have a representative. They are listed because
the existing layers are state-level polygons or town points — there is no settlement-surface
product at all.

---

## Practical notes before importing any of these

- `data/*.gpkg` → `public/*.geojson` means **every feature is shipped to the browser**.
  Building footprints (millions of polygons) and 100 m population grids must be clipped,
  simplified or downsampled first; the project currently ships ~70 MB of generated site data.
- HOT OSM and GRID3 v4.0 already publish **GeoPackage** — the project's native input format,
  so those are the lowest-friction imports.
- Licences differ: ODbL (OSM-derived), CC BY 4.0 (Google Buildings, WorldPop v3.0, GSA,
  SoilGrids), CC BY-SA 4.0 (GRID3 settlement extents, WorldPop v2.1). Attribution needed.
- ACLED full event-level data requires free registration; the HDX aggregate is open.
- Rasters need their source GeoTIFFs and the same CI relay used for the five already fetched
  (`docs/raster-sources.md`) because the coding sandbox cannot reach those hosts directly.

## Suggested first five

1. `health_facilities_nga_pt` — small, high value, HOT OSM GeoPackage monthly.
2. `education_facilities_nga_pt` — same pipeline.
3. `airports_seaports_nga_pt` + POIs — fills the transport/amenity hole.
4. `settlement_extents_grid3_pg` — the missing "where people live" polygons (v4.0 GPKG).
5. `power_grid_nga_ln` + `substations_nga_pt` — a whole new infrastructure theme.

Then, if a raster is wanted: **WorldPop 100 m population** (#11) or **VIIRS nighttime lights**
(#12) are the two most-used national layers not yet present.

---

*This is a survey only — nothing has been imported and the PR is unchanged.*
