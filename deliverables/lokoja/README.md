# Map of Lokoja — cleaned images, georeferenced sheet and one GeoPackage

Everything asked for, built from the Lokoja map image you supplied plus the layers that
already live in this repository. All deliverables sit in this folder.

---

## 1. Files

| File | What it is |
|---|---|
| **Lokoja_map_and_data.gpkg** | **The single GeoPackage.** 2 raster map sheets + 1 DEM raster + 20 vector layers + 2 attribute tables (`layer_catalogue`, `geology_legend_2011`). Everything is clipped to the map sheet extent. Built from the repository at `a479c0b` (after the geology legend fix). |
| **lokoja_map_clear.png** | The whole sheet, cleaned and enlarged 4× (2740 × 1716 px, 300 dpi). Coordinate labels, legend, scale bar and north arrow all kept. |
| **lokoja_map_no_coordinates.png** | The map face only (no margin, no coordinate labels, no legend/scale/north arrow), place names kept. 2160 × 1500 px. |
| **lokoja_map_clean_no_labels.png** | The map face with **no text at all** — no coordinates, no place names, no river names. Only the drawn map graphics and the neat line. 2160 × 1500 px. |
| **lokoja_map_wgs84.tif** | The map face **georeferenced**, WGS 84 (EPSG:4326), 2160 × 1500 px, pixel 8.5 m — footprint identical to the `map_extent` polygon. |
| **lokoja_map_utm32n.tif** | The same, in UTM zone 32N (EPSG:32632), pixel 8.64 m. |
| **lokoja_map_unlabelled_wgs84.tif** / **lokoja_map_unlabelled_utm32n.tif** | The label-free version, georeferenced the same way. |
| **lokoja_geology_preview.png** | The updated 2011 geology: the 5 units in their legend colours with the 12 unit boundaries, plus the wider view showing that the fault lines sit outside the sheet. |
| **lokoja_alignment_qa.png** | Alignment proof: left, the layers digitised from the sheet sit exactly on the sheet; right, the same raster with the repository layers, whose own offsets are stated. |
| **lokoja_qa_overlay.png** | QA plot: the georeferenced sheet with its own vector layers drawn on top, so the fit can be judged by eye. |
| README.md | This file. |

---

## 2. How the sheet was georeferenced

The sheet carries its own graticule, so it was fitted from that — not estimated by eye.

* Ticks measured on the scan: longitude 6°38′, 6°40′, 6°42′, 6°44′, 6°46′ E on the top edge;
  latitude 7°46′, 7°48′, 7°50′, 7°52′ N on both side edges.
* A least-squares affine fit per axis (no rotation — the left and right latitude ticks sit on
  the same rows, so the sheet is north-up):

  ```
  longitude = 6.602063962 + 0.000312694884 · x_pixel
  latitude  = 7.876660189 − 0.000313282101 · y_pixel
  ```

  (These are pixel coordinates on the full 379 × 544 scan; the neat-line crop is 540 × 375 px
  starting at column 44, row 15.)
* The same fit expressed on the **delivered** 2160 × 1500 rasters:

  ```
  longitude = 6.6158225 + 0.0000781738 · x
  latitude  = 7.8719610 − 0.0000783205 · y
  ```

* Fit residual: **±0.34 arcsec ≈ ±10 m** at every tick.
* The negative latitude coefficient and near-identical pixel sizes per degree confirm a plain
  plate-carrée layout; the aspect correction (cos 7.81°) is inside the pixel-size difference.
* Sheet extent (the neat line, = the `map_extent` polygon):

  | | value |
  |---|---|
  | west | 6.6158225 E |
  | east | 6.7846778 E |
  | south | 7.7544802 N |
  | north | 7.8719610 N |
  | size | 18.6 km × 13.0 km ≈ **242 km²** |

* The scan is 540 × 375 px for that extent, i.e. **one source pixel = 34.5 m**. The delivered
  rasters are a 4× resample of it, so the pixel size is **8.6 m** — that is resampling, not new
  detail: the true ground resolution of the sheet stays about 35 m.
* Independent check against open data: OSM place nodes that also appear on the sheet
  (Okumi/Okume, Felele/Filele, Zongondaji, …) land 0.5–0.8 km from the printed name, in
  **random directions** — no systematic shift — which is the expected displacement of a printed
  label from the place it names. Treat the sheet as good to roughly ±½ km against modern data.

---

## 3. What is inside the GeoPackage

Open `Lokoja_map_and_data.gpkg` in QGIS/ArcGIS Pro (drag and drop, or *Add vector/raster layer*).
All vectors are **EPSG:4326**, clipped to the sheet extent. The `layer_catalogue` table lists
every layer with its source file and a note.

### Rasters (3)

| Layer | Size | Note |
|---|---|---|
| `MAP_SHEET_LOKOJA` | 2160 × 1500 | the sheet as published, georeferenced |
| `MAP_SHEET_LOKOJA_UNLABELLED` | 2160 × 1500 | the same sheet with all lettering removed |
| `ELEVATION_DEM` | 7 × 5 cells | SRTM elevation, 35–254 m, resampled onto a grid whose bounds equal the sheet extent; the repository DEM is 0.025° (≈2.8 km) so only a handful of cells fall in a 19 km sheet |

### Vectors (18)

| Layer | Type | Features | Content |
|---|---|---|---|
| `map_extent` | polygon | 1 | **the sheet extent on its own — geometry only, no attributes** |
| `admin_states` | polygon | 1 | Kogi State, clipped to the sheet |
| `admin_lgas` | polygon | 5 | Lokoja and neighbouring LGAs, clipped |
| `admin_wards` | point | 1 | ward centre inside the sheet |
| `towns_osm` | point | 10 | named places: Lokoja, Okume, Filele, Zongondaji, Adonkolo, Numai, Lairdstown, Zokoja, Felelen Buzu, … |
| `builtup_areas` | polygon | 4 | built-up / settlement footprints (Lokoja urban area) |
| `sheet_rivers` | polygon | 5 | water areas **digitised from the sheet itself** — 0 m offset from the raster |
| `sheet_roads` | polygon | 26 | road corridors **digitised from the sheet itself** (19 major/highway, 7 secondary) — 0 m offset from the raster |
| `roads` | line | 3 | DIVA road network, clipped |
| `roads_map2023` | line | 0 | the 2023 road sheet has no line inside this extent (nearest 1.5 km) — layer kept so the gap is documented |
| `water_areas` | polygon | 3 | the Niger and Benue surfaces |
| `water_lines` | line | 1 | DIVA water lines |
| `water_major_rivers` | line | 2 | **major river centre lines**: Niger, Benue |
| `water_basins` | polygon | 3 | FAO basins, clipped |
| `geology_units_2011` | polygon | 5 | **geological map 1 (2011)** — units, with formation/series/epoch/legend colour. Inside the sheet: `M` Migmatite, `Al` Alluvium, `NPss` Nupe Formation, `OGCh` Charnockitic rocks, `OGp` Older Granite (porphyritic) |
| `geology_unit_boundaries_2011` | line | 12 | the 2011 unit boundaries |
| `geology_background_2023` | polygon | 4 | **geological map 2 (2023)** — background units |
| `geology_faults_2011` | line | 0 | **faults inside the sheet: the 2011 dataset has none here** (nearest mapped fault is 3.9 km outside) |
| `geology_faults_2011_context` | line | 2 | context only: the faults that fall in a 10 km collar around the sheet |
| `minerals_occurrences_2023` | point | 2 | **mineral map (2023)** — occurrence points |

### Attribute tables (2, no geometry)

| Table | Rows | Content |
|---|---|---|
| `layer_catalogue` | 22 | one row per layer: geometry type, feature count, catalogue label, description, source GeoPackage in the repository, source layer id, and a processing note |
| `geology_legend_2011` | 100 | the **complete legend of the 2011 Geological Map of Nigeria** — `unit_code`, description, formation, series, epoch, legend colour, note, and `in_sheet` (1 for the five classes that actually occur inside the sheet). This is where the six previously unclassified `UNCL_*` fill colours now carry their inferred formation/series/epoch. |

The two *geological maps* are the vector versions — `geology_units_2011` (1:2 000 000 sheet of
2011, with formation, series, epoch and legend colour) and `geology_background_2023` (2023
sheet) — plus the 2011 unit boundaries. The **scanned sheet pictures** of those two maps
(`geology_map2011_img`, `minerals_map2023_img`) were not copied in: they are whole-Nigeria
scans at 0.004°/pixel, so clipping one to Lokoja yields a 40 × 28 px thumbnail that shows
nothing. The vector layers are the usable form of the same maps.

---

## 3a. Alignment and coordination — everything shares one footprint

Everything in the package is on **one frame**, not four different ones:

| Thing | Footprint |
|---|---|
| `map_extent` polygon | 6.6158225–6.7846778 E, 7.7544802–7.8719610 N |
| `MAP_SHEET_LOKOJA` / `..._UNLABELLED` rasters | **identical to the polygon, to 7 decimals** (the 2-pixel collar used earlier is gone) |
| `ELEVATION_DEM` | **identical to the polygon** (resampled onto that grid) |
| `lokoja_map_wgs84.tif` | same bounds; UTM copies are the same footprint reprojected (EPSG:32632, 8.64 m) |
| every vector layer | clipped to that polygon, EPSG:4326 |

Two new layers make the fit checkable instead of claimed: `sheet_rivers` and `sheet_roads`
were digitised **from the georeferenced raster itself**, so they cannot drift from it — they
are derived from the same pixels. Measured against them:

| Comparison | Result |
|---|---|
| `map_extent` ↔ raster bounds | 0 m (exact) |
| `sheet_rivers` / `sheet_roads` ↔ raster | 0 m (derived from it) |
| DIVA `water_areas` ↔ `sheet_rivers` | overlap 0.56; best possible shift only 155 m and buys 2 points of overlap → the residual is vector generalisation, not a georeferencing error |
| DIVA `roads` ↔ `sheet_roads` | overlap 0.003 — the DIVA roads are 1:1 000 000 chords, they are not the streets on this sheet |
| OSM towns ↔ printed names | 0.5–0.8 km, random directions (label displacement) |

The georeference itself was **not** bent to chase those layers: it stays on the sheet's own
graticule (±10 m residual at every tick). Forcing it onto the coarse DIVA water polygons would
have moved the sheet ~0.5 km and stretched it 1.5 %, which contradicts the printed coordinates.
Where you need exact overlay, use the `sheet_*` layers; where you need national datasets, use
the repository layers and expect their own error.

## 3b. Repository update of 2026-11-09 — what it did and did not change here

The repository moved from `31dba92` to `a479c0b` (PR #11, "assign real geology to unclassified
legend entries"). That work fills in formation / series / epoch / colour for **six `UNCL_*`
legend rows** in `geology_units_map2011_pg.gpkg`. The package was rebuilt from that commit:

* `geology_units_2011` — **still 5 features**, and their attributes are byte-for-byte identical
  to before. None of the six `UNCL_*` codes has a polygon inside the Lokoja sheet (they have no
  polygon at all — they are legend-only entries), so nothing in this layer could change.
* `geology_unit_boundaries_2011` — **still 12 features**, unchanged (the boundary GeoPackage was
  not touched by the update).
* `geology_background_2023` — 4 features, unchanged (the 2023 GeoPackage was not touched).
* **New:** `geology_legend_2011` gives you all 100 legend classes, including the six that were
  just fixed, with `in_sheet` marking the five that occur on the sheet — so the improvement in
  the repository is now visible in the package even though it falls outside this small extent.

The sheet's geology in short: Precambrian migmatite/gneiss basement west of the Niger
(`M`), the Cretaceous Nupe Formation sandstone belt through the middle (`NPss`), Pan-African
older granites (`OGp`, `OGCh`) in the extreme north-west corner, and Quaternary alluvium (`Al`)
along the Niger–Benue floodplain. The 2011 dataset carries **no fault line inside the sheet**;
the two nearest mapped faults are 4–10 km outside (see the right-hand panel of
`lokoja_geology_preview.png`).

## 4. How the pictures were made (so you can redo it)

1. **Enlarge** 4× with Lanczos, paper-white clean-up of the JPEG haze, unsharp mask on the
   luminance channel only (so colours are not over-saturated), slight saturation lift, and a
   small edge-preserving filter to kill the resampling steps.
2. **Remove the coordinate labels / legend / scale bar / north arrow** by cropping to the neat
   line — they live outside it.
3. **Remove the place names** by masking just the lettering inside each of the 16 labels
   (they were located at 8× zoom, one by one), then filling the masked pixels with the *modal*
   colour of their surroundings. That keeps the paper white, the river blue and the built-up
   beige exactly as before. Text printed on a road leaves a small pale gap where the road was
   covered by the lettering — the road under the ink was never in the scan, so it cannot be
   recovered; the gap is between 10 and 20 source pixels (0.3–0.7 km) at four labels.
4. **Georeference** with the affine fit above, written as a proper GeoTIFF (deflate, tiled,
   EPSG:4326 and a UTM 32N copy).

---

## 5. Things to be aware of

* The scan is small (685 × 429 px). The 4× version is sharper and easier to read, but it cannot
  invent detail that was not in the original; expect soft edges at 100 % zoom.
* The DEM in the repository is a 0.025° grid, so it is nearly useless at this scale — kept
  because you asked for it, but for real terrain work you would want SRTM 30 m.
* `roads`, `water_lines` and `water_basins` come from small-scale national datasets; inside a
  19 km sheet they are a handful of generalised lines. The detailed street/road network visible
  on the sheet exists only as pixels, in the georeferenced raster.
* No fault line of the 2011 geological map falls inside the sheet. The
  `geology_faults_2011_context` layer (10 km collar) is there so you still have fault geometry,
  but those lines lie outside the sheet and must be treated as context, not as sheet content.
* Cross-border / whole-feature policy of the source repository is preserved: features are cut
  at the sheet extent, the underlying dataset is untouched in `data/`.
