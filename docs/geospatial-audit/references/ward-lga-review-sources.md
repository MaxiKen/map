# Residual ward/LGA review sources

## Official administrative control

INEC registration-area directories control the ward-to-LGA assignments reviewed here. They are not legal polygon surveys and were not used to move points or replace geometry.

- [Abia](https://inecnigeria.org/documents/resources/rac/ABIA.pdf)
- [Akwa Ibom](https://inecnigeria.org/documents/resources/rac/AKWA-IBOM.pdf)
- [Bauchi](https://inecnigeria.org/documents/resources/rac/BAUCHI.pdf)
- [Bayelsa](https://inecnigeria.org/documents/resources/rac/BAYELSA.pdf)
- [Borno](https://inecnigeria.org/documents/resources/rac/BORNO.pdf)
- [Cross River](https://inecnigeria.org/documents/resources/rac/CROSS-RIVER.pdf)
- [Delta](https://inecnigeria.org/documents/resources/rac/DELTA.pdf)
- [Ekiti](https://inecnigeria.org/documents/resources/rac/EKITI.pdf)
- [Federal Capital Territory](https://inecnigeria.org/documents/resources/rac/FCT.pdf)
- [Kaduna](https://inecnigeria.org/documents/resources/rac/KADUNA.pdf)
- [Kano](https://inecnigeria.org/documents/resources/rac/KANO.pdf)
- [Katsina](https://inecnigeria.org/documents/resources/rac/KATSINA.pdf)
- [Kebbi](https://inecnigeria.org/documents/resources/rac/KEBBI.pdf)
- [Nasarawa](https://inecnigeria.org/documents/resources/rac/NASARAWA.pdf)
- [Osun](https://inecnigeria.org/documents/resources/rac/OSUN.pdf)
- [Oyo](https://inecnigeria.org/documents/resources/rac/OYO.pdf)
- [Plateau](https://inecnigeria.org/documents/resources/rac/PLATEAU.pdf)
- [Rivers](https://inecnigeria.org/documents/resources/rac/RIVERS.pdf)
- [Sokoto](https://inecnigeria.org/documents/resources/rac/SOKOTO.pdf)
- [Taraba](https://inecnigeria.org/documents/resources/rac/TARABA.pdf)

## Independent boundary point checks

Every case has a recorded point-intersection URL in `../ward-lga-review-ledger.csv`. The queries use:

- Layer: <https://services8.arcgis.com/oTalEaSXAuyNT7xf/arcgis/rest/services/Nigeria_Local_Government_Area_Boundaries/FeatureServer/0>
- ArcGIS item: `686ce086434740b3b5c517b732999c47`
- Credit: **Esri, Michael Bauer Research GmbH 2023, National Bureau of Statistics**
- Input: original EPSG:4326 ward coordinate, `esriSpatialRelIntersects`
- Output: `OBJECTID`, `ID`, `NAME`, no returned or substituted geometry

A different independent containing polygon does not override INEC. Empty coastal or inland results are recorded as empty rather than filled with the nearest polygon.

## Supplementary and historical evidence

Supplementary lists are not treated as superior to INEC. They resolve legacy names where current PDF extraction uses updated names or omits headings. The Kwambai case also records the historical Takum/Ussa dispute and remains explicitly uncertain.

- Feature index 6042, PANDA/KARE:
  - <https://www.manpower.com.ng/places/wards-in-lga/566/karu>
- Feature index 7851, BUKUMA:
  - <https://www.manpower.com.ng/places/wards-in-lga/726/degema>
- Feature index 7853, DEGEMA II:
  - <https://www.manpower.com.ng/places/wards-in-lga/726/degema>
- Feature index 7854, DEGEMA III:
  - <https://www.manpower.com.ng/places/wards-in-lga/726/degema>
- Feature index 7860, TOMBLE IV:
  - <https://www.manpower.com.ng/places/wards-in-lga/726/degema>
- Feature index 8447, KWAMBAI:
  - <https://www.manpower.com.ng/places/wards-in-lga/777/ussa>
  - <https://www.lawglobalhub.com/madaki-akintse-angwe-v-the-president-of-federal-republic-of-nigeria-ors-2012-lljr-ca/>
