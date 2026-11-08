# Gada/Illela identity references

## Official administrative control

INEC's [Sokoto registration-area directory](https://inecnigeria.org/documents/resources/rac/SOKOTO.pdf)
lists **Gada as LGA code 04**, with 11 registration areas and 239 polling units, and
**Illela as LGA code 08**, with 11 registration areas and 210 polling units. The local ward
attributes reproduce both official 11-name lists exactly after case/whitespace normalization.
The official lists are recorded verbatim in `../gada-illela-verification.json`.

INEC controls ward-to-LGA assignment and ward naming. The directory is not a legal polygon survey
and was not used to move ward coordinates or replace polygon geometry.

## Independent boundary identity reference

`sokoto-gada-illela-esri-mbr-2023.geojson` is the exact two-feature GeoJSON response from ArcGIS
item `686ce086434740b3b5c517b732999c47`, layer:

<https://services8.arcgis.com/oTalEaSXAuyNT7xf/arcgis/rest/services/Nigeria_Local_Government_Area_Boundaries/FeatureServer/0>

The item describes a 2023 boundary service and credits **Esri, Michael Bauer Research GmbH 2023,
National Bureau of Statistics**. It is not relabelled as an official GRID3 product without further
provenance.

Query parameters:

- `where=NAME IN ('Gada','Illela')`
- `outFields=OBJECTID,ID,NAME,AREA`
- `returnGeometry=true`, `outSR=4326`, `f=geojson`
- `maxAllowableOffset=0.002`, `geometryPrecision=6`

Returned identities:

- OBJECTID **709**, ID **3405**: **Illela**, on the western geometry.
- OBJECTID **713**, ID **3409**: **Gada**, on the eastern geometry.

The simplified response is independent identity evidence only. It was never substituted for the
production polygons. Reciprocal and same-name metric IoUs, the local file SHA256, and all acceptance
gates are in `../gada-illela-verification.json`. The 601-row correction ledger and result JSON retain
before/after source and provenance hashes.
