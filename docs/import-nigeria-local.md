# Local Nigeria imports

These layers were fetched from public repositories and written into `data/` as
EPSG:4326 GeoPackages. The top-level folder is the layer group. The place folder
under it is only for organisation.

UTM sources were zone 31N or 32N on WGS 84 (EPSG:32631 / EPSG:32632). The transform
to longitude and latitude is that CRS conversion. It is not the Minna national shift.

Empty attribute columns, and columns with only one value on a multi-feature layer,
were omitted, except place names such as state and LGA. Building layers also omitted
the long tail of empty OpenStreetMap tags. Geometry was not simplified. An invalid
polygon was made valid only when Shapely rejected it; the count is in the GeoPackage
description.

Exact copies were not imported twice: the Zaria water-point UTM duplicate, the second
Obio/Akpor hospital file, the Obio/Akpor boundary file when it matched the wards, the
Ogun border places shapefile when it matched the GeoPackage, and the smaller Kaduna
North highway/water file when the flood-exposure zip had the fuller layers.

Not fetched, because the host blocked the download or the file is Git LFS / too large
for this environment: geoBoundaries ADM1/ADM2 shapefiles, the HDX COD-AB geodatabase
zip, energydata.info admin zips, national GRID3 wards/health/roads, and the Microsoft
building-footprint release. The 774-feature LGA layer below is a COD-style copy that
was already in a public repository, not the HDX zip itself.

## Layers

| Group | Place | Layer | Features |
|---|---|---|---:|
| Administrative boundaries | AMAC | `admin_amac_wards_grid3_pg` | 12 |
| Administrative boundaries | AMAC | `admin_amac_boundary_pg` | 1 |
| Infrastructure & services | AMAC | `infrastructure_amac_health_grid3_pt` | 249 |
| Infrastructure & services | AMAC | `infrastructure_amac_ward_reach_pg` | 12 |
| Infrastructure & services | AMAC | `infrastructure_amac_uncovered_pg` | 11 |
| Administrative boundaries | Ife Central | `admin_ife_central_wards_grid3_pg` | 11 |
| Administrative boundaries | Ife Central | `admin_ife_central_boundary_pg` | 1 |
| Infrastructure & services | Ife Central | `infrastructure_ife_central_health_grid3_pt` | 48 |
| Administrative boundaries | Ogbia | `admin_ogbia_wards_grid3_pg` | 13 |
| Settlements | Ogbia | `settlements_ogbia_points_pt` | 1066 |
| Settlements | Ogbia | `settlements_ogbia_extents_grid3_pg` | 1066 |
| Water | Ogbia | `water_ogbia_rivers_osm_ln` | 25 |
| Water | Ogbia | `water_ogbia_streams_osm_ln` | 58 |
| Transport | Ogbia | `transport_ogbia_highways_osm_ln` | 737 |
| Administrative boundaries | Zaria | `admin_zaria_wards_grid3_pg` | 13 |
| Groundwater & hydrogeology | Zaria | `groundwater_zaria_water_points_pt` | 334 |
| Infrastructure & services | Zaria | `infrastructure_zaria_health_grid3_pt` | 84 |
| Administrative boundaries | Obio Akpor | `admin_obio_akpor_wards_pg` | 17 |
| Infrastructure & services | Obio Akpor | `infrastructure_obio_akpor_hospitals_pt` | 111 |
| Administrative boundaries | Anambra West | `admin_anambra_west_boundary_pg` | 1 |
| Administrative boundaries | Anambra West | `admin_anambra_west_wards_grid3_pg` | 10 |
| Infrastructure & services | Anambra West | `infrastructure_anambra_west_hospitals_pt` | 19 |
| Transport | Anambra West | `transport_anambra_west_roads_ln` | 12 |
| Water | Anambra West | `water_anambra_west_osm_ln` | 70 |
| Administrative boundaries | Ogun border | `admin_ogun_state_pg` | 1 |
| Administrative boundaries | Ogun border | `admin_ogun_border_study_area_pg` | 4 |
| Administrative boundaries | Ogun border | `admin_ogun_border_lgas_pg` | 4 |
| Administrative boundaries | Ogun border | `admin_ogun_border_wards_pg` | 14 |
| Administrative boundaries | Ogun border | `admin_ogun_border_wards_alt_pg` | 43 |
| Settlements | Ogun border | `settlements_ogun_border_places_pt` | 381 |
| Settlements | Ogun border | `settlements_ogun_border_places_1km_pt` | 295 |
| Transport | Ogun border | `transport_ogun_border_primary_roads_osm_ln` | 61 |
| Transport | Ogun border | `transport_ogun_border_secondary_roads_osm_ln` | 23 |
| Infrastructure & services | Ogun border | `infrastructure_ogun_border_powerlines_pt` | 784 |
| Infrastructure & services | Ogun border | `infrastructure_ogun_border_powerlines_ln` | 2 |
| Forest | Ogun border | `forest_ogun_border_forest_pg` | 1 |
| Land cover | Ogun border | `landcover_ogun_border_natural_pg` | 56 |
| Water | Ogun border | `water_ogun_border_osm_ln` | 104 |
| Settlements | Ogun border | `settlements_ogun_border_buildings_osm_pg` | 64386 |
| Settlements | Ogun border | `settlements_ogun_border_ward_buildings_pg` | 16592 |
| Administrative boundaries | Cities | `admin_city_outlines_pg` | 5 |
| Administrative boundaries | Cities | `admin_metro_lgas_pg` | 32 |
| Settlements | Kano | `settlements_kano_settlements_pt` | 5085 |
| Administrative boundaries | — | `admin_lgas_pcodes_pg` | 774 |
| Natural hazards | Niger Delta | `hazards_niger_delta_oilspill_footprints_pg` | 28 |
| Natural hazards | Niger Delta | `hazards_niger_delta_oilspill_sites_pg` | 3 |
| Natural hazards | Niger Delta | `hazards_niger_delta_nosdra_pt` | 3 |
| Natural hazards | South South | `hazards_south_south_oilspill_pt` | 7920 |
| Settlements | Kaduna North | `settlements_kaduna_north_buildings_osm_pg` | 128865 |
| Transport | Kaduna North | `transport_kaduna_north_highways_osm_ln` | 5679 |
| Water | Kaduna North | `water_kaduna_north_bodies_pg` | 44 |
| Water | Kaduna North | `water_kaduna_north_waterways_pt` | 8 |
| Administrative boundaries | Abuja | `admin_abuja_boundary_pg` | 1 |
| Administrative boundaries | Abuja | `admin_abuja_wards_pg` | 10 |
| Infrastructure & services | Abuja | `infrastructure_abuja_clinics_pt` | 248 |
| Infrastructure & services | Abuja | `infrastructure_abuja_schools_pt` | 499 |
| Settlements | Abuja | `settlements_abuja_settlements_pt` | 271 |
| Settlements | Abuja | `settlements_abuja_places_pt` | 22 |
| Administrative boundaries | Ibadan | `admin_ibadan_boundary_pg` | 1 |
| Administrative boundaries | Ibadan | `admin_ibadan_wards_pg` | 59 |
| Infrastructure & services | Ibadan | `infrastructure_ibadan_clinics_pt` | 445 |
| Infrastructure & services | Ibadan | `infrastructure_ibadan_schools_pt` | 453 |
| Settlements | Ibadan | `settlements_ibadan_settlements_pt` | 324 |
| Settlements | Ibadan | `settlements_ibadan_places_pt` | 23 |
| Administrative boundaries | Kano | `admin_kano_boundary_pg` | 1 |
| Administrative boundaries | Kano | `admin_kano_wards_pg` | 88 |
| Infrastructure & services | Kano | `infrastructure_kano_clinics_pt` | 465 |
| Infrastructure & services | Kano | `infrastructure_kano_schools_pt` | 1045 |
| Settlements | Kano | `settlements_kano_places_pt` | 22 |
| Administrative boundaries | Lagos | `admin_lagos_boundary_pg` | 1 |
| Administrative boundaries | Lagos | `admin_lagos_wards_pg` | 128 |
| Infrastructure & services | Lagos | `infrastructure_lagos_clinics_pt` | 777 |
| Infrastructure & services | Lagos | `infrastructure_lagos_schools_pt` | 1595 |
| Settlements | Lagos | `settlements_lagos_settlements_pt` | 461 |
| Settlements | Lagos | `settlements_lagos_places_pt` | 36 |
| Administrative boundaries | Port Harcourt | `admin_port_harcourt_boundary_pg` | 1 |
| Administrative boundaries | Port Harcourt | `admin_port_harcourt_wards_pg` | 37 |
| Infrastructure & services | Port Harcourt | `infrastructure_port_harcourt_clinics_pt` | 175 |
| Infrastructure & services | Port Harcourt | `infrastructure_port_harcourt_schools_pt` | 326 |
| Settlements | Port Harcourt | `settlements_port_harcourt_settlements_pt` | 197 |
| Settlements | Port Harcourt | `settlements_port_harcourt_places_pt` | 32 |
| Population | AMAC | `population_amac_worldpop_rst` | 368714 |

## Kwara

Kwara was already inside the national state, LGA, ward-point, place, borehole and protected-area layers. It had no place folder, so it did not show up next to Lagos, Kano or Ilorin. These layers add that place folder. National files were not edited.

| Group | Place | Layer | Features |
|---|---|---|---:|
| Administrative boundaries | Kwara | `admin_kwara_state_pg` | 1 |
| Administrative boundaries | Kwara | `admin_kwara_lgas_pg` | 16 |
| Administrative boundaries | Kwara | `admin_kwara_wards_inec_pg` | 193 |
| Administrative boundaries | Ilorin | `admin_ilorin_wards_inec_pg` | 35 |
| Settlements | Kwara | `settlements_kwara_markets_pt` | 114 |
| Settlements | Kwara | `settlements_kwara_places_osm_pt` | 1126 |
| Infrastructure & services | Kwara | `infrastructure_kwara_pois_osm_pt` | 2471 |
| Infrastructure & services | Kwara | `infrastructure_kwara_polling_units_pt` | 2508 |
| Groundwater & hydrogeology | Kwara | `groundwater_kwara_boreholes_wpdx_pt` | 3786 |
| Transport | Kwara | `transport_kwara_roads_diva_ln` | 97 |
| Transport | Ilorin | `transport_ilorin_roads_osm_ln` | 500 |
| Transport | Ilorin | `transport_ilorin_rail_osm_ln` | 5 |
| Water | Ilorin | `water_ilorin_mapped_pg` | 3 |
| Settlements | Malete | `settlements_kwasu_buildings_pg` | 14 |
| Transport | Malete | `transport_kwasu_ways_ln` | 43 |
| Land cover | Kwara | `landcover_kwara_farm_plots_pg` | 4 |
| Protected areas | Kwara | `protected_areas_kwara_wdpa_pg` | 23 |
| Forest | Kwara | `forest_kwara_osm_pg` | 2 |

The market file was labelled EPSG:4326 but the coordinates were UTM zone 31N. Reprojecting to longitude and latitude matched the file's own latitude and longitude columns. One farm polygon was invalid and was made valid without a shift. Ten polling-unit rows had coordinates outside Kwara, including a point in Pennsylvania, and were left out rather than moved. Neighbour lists and outlier scores from that student analysis were not copied.

GRID3's Kwara settlement and built-up services did not resolve from this environment. Coarser online copies of the state and LGA outlines were not imported, because the GADM extract is the one already in the project. A radial Ilorin corridor diagram was not a road network and was not imported.

## Skipped

- Ado-Odo/Ota wards: the GeoPackage has 16 attribute rows but every geometry is empty, so it was not imported.
- Kano settlements GeoJSON under 1 MB was not in the fetch; the larger 5,085-point Kano settlement file was imported instead.
- Kwara polling units: 10 of 2,518 rows had coordinates outside the state and were not imported.
- Ilorin solstice street lines and the radial corridor diagram overlap or are not a surveyed network, so they were not added beside the OSM road extract.

## Remaining fetched Kwara files

These were already downloaded and are now published to the same rule as the earlier extracts: EPSG:4326, one geometry type, place folder under the theme, empty and constant columns dropped, and no second copy of a file already imported.

| Group | Place | Layer | Features |
|---|---|---|---:|
| Administrative boundaries | Kwara | `admin_kwara_state_osm_pg` | 1 |
| Administrative boundaries | Kwara | `admin_kwara_state_naturalearth_pg` | 1 |
| Administrative boundaries | Kwara | `admin_kwara_lgas_simplified_pg` | 16 |
| Transport | Ilorin | `transport_ilorin_streets_solstice_ln` | 346 |
| Infrastructure & services | Ilorin | `infrastructure_ilorin_corridor_anchors_pt` | 21 |
| Reference | Ilorin | `reference_ilorin_corridor_diagram_ln` | 5 |
| Settlements | Kwara | `settlements_kwara_gazetteer_pt` | 2 |

Fetched files not imported again:

- kwara/kwasu_merged.geojson: the same 14 buildings and 43 ways already imported from the split OSM files.
- kwara/markets.geojson points: already imported after the zone 31N correction.
- kwara/markets.geojson ward polygons: 191 of 195 match the already imported EPSG:4326 ward file; the other four are the same names after the false CRS label. The 4326 file was kept.
- kwara/markets.geojson LGA polygons: duplicate names and fragments, including an Ilorin South piece with no overlap on the GADM LGA. Not a coherent boundary layer.
- kwara/kwara_state_bloknote.geojson: a shorter copy of OSM relation 3718090. The more detailed relation file was imported.
- kwara/ng-kw-low.geojson: a simplified copy of the same Natural Earth Kwara outline.
- kwara/ilorin_3lga.zip: already imported as the 35 Ilorin ward polygons.
- kwara/farm_boundaries.geojson, kwasu polygons and lines, ilorin_surface roads, rail and water, and polling_units.csv: already imported.
