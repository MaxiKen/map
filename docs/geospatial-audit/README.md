# Professional geospatial alignment and plausibility audit

Audited source commit: `eccc307d1533ef3329510d5b2fc4242dd40b328f`
Scope: **all 98 GeoPackages — 82 vector layers, 13 numeric rasters and 3 georeferenced image overlays; visible and hidden data included.**

See `layer-review.md` for the explicit disposition and evidence level of every layer.

## Executive conclusion

**The layers must not receive a blanket “all aligned” certification.** The audit found no evidence of a repository-wide CRS error, latitude/longitude swap, null-island coordinates or a single national translation. Most layers pass structural and gross-registration checks, and several independent pairs align strongly. All six prioritized correction/reclassification tasks are complete; the reviewed ward exceptions, partial magnetic coverage, unresolved external identifier links and other documented scope qualifications remain explicit:

1. **The state-capital correction is complete and reproducible.** 32 scanned-map positions were replaced individually with reviewed OSM city/town nodes and 5 corroborated gazetteer positions were retained. Strict held-out DIVA validation across 30 eligible matches gives median **1.244 km**, p95 **4.918 km** and maximum **5.272 km**; all 37 outputs also pass named-state containment. Remaining findings are documented scope limitations.
2. **The Gada/Illela reciprocal identity conflict is resolved without moving geometry.** All 11 Gada wards and 10 of 11 Illela wards now fall inside their corrected named polygons; 21 former reciprocal exceptions are resolved. Darna/Sabon Gari remains a separate Gwadabawa exception 0.242 km outside corrected Illela. No ward, polygon, centroid or derived-feature geometry was changed. The follow-on 40-case residual review is also complete: three LGA attributes were corrected and 37 evidence-documented exceptions remain, with zero ward geometry changes.
3. **The reviewed polygon-topology correction is complete with zero active invalid geometries.** All 191 former exceptions across 16 layers are valid MultiPolygons. 5,635 untargeted geometry blobs and every attribute are unchanged; 191 invalid originals remain only in hidden provenance.
4. **The magnetic raster is transparently classified as partial coverage.** 90.2% of sampled land cells are valid; Ekiti 0.0%, Osun 5.6%, Oyo 30.4%, and Sokoto 40.2%. The visible label and source description disclose the limitation. Missing cells remain NoData, and no magnetic values were interpolated or shifted.
5. **Both hidden-source artefacts are resolved without coordinate shifts.** FID 479 “Tow ns” was quarantined as non-settlement legend text, leaving 478 active hidden cross-check points. D0451 was retained byte-for-byte but reclassified as a connected population-class region crossing 16 states and 124 LGAs, excluded from district analysis.
6. **Stable administrative identifiers are installed.** All 37 states, 774 LGAs and 8,809 wards have persistent `ngmap-admin-v1` IDs and parent keys. The separate INEC crosswalk covers every state/LGA and 8,589/8,809 wards; 220 ambiguous or unmatched ward links remain explicitly null rather than guessed.
7. **A cross-border data policy governs all 98 spatial layers.** `ngmap-cross-border-v1` preserves complete sources, distinguishes foreign/marine context from Nigerian administration, and requires explicit Nigeria-only filters and clipped measurements. No source geometry was clipped, moved or deleted for this policy.

Only the documented capital, reviewed polygon-topology, Gada/Illela identity, three evidence-gated residual LGA attribute corrections, metadata-only magnetic partial-coverage reclassification, two evidence-gated hidden-artifact resolutions and schema-only stable administrative identifier additions were applied. FID 479 was quarantined—not silently deleted—while every D0451 feature attribute and geometry byte was retained. Identifier installation preserved every original value and geometry byte. No blanket translation, ward movement, geometry replacement or magnetic infilling was performed. The cross-border task changed policy, audit and catalog metadata only; it did not alter any GeoPackage, feature value or geometry.

## Prioritized findings

### A1 — Resolved with provenance: state-capital positions

- Before correction, OSM median/p95/maximum separation was **9.753 / 20.242 / 24.015 km**; DIVA median was **10.247 km**. The original evidence is preserved, not overwritten.
- **Construction:** 32 same-name OSM city/town replacements and 5 retained approximate gazetteer positions. No coordinates were averaged and no constant shift was applied.
- **Strict held-out DIVA:** median / p95 / maximum **1.244 / 4.918 / 5.272 km** across 30 eligible matches. Six selection-informed cases are excluded: Umuahia, Yola, Abakaliki, Ado-Ekiti, Katsina, Gusau.
- **All available DIVA cross-source comparisons:** median / p95 / maximum **1.154 / 4.709 / 5.272 km** across 36 matches. Osogbo has no suitable DIVA match; state containment still applies.
- **OSM is not independent validation for the 32 replacements.** Its residuals are construction self-consistency checks; only the five unchanged positions use OSM solely as corroboration.
- **Reviewed exceptions:** Yola uses the DIVA-corroborated OSM town rather than the separate northern metropolitan/Jimeta city node; Asaba retains its Delta-side approximation because the OSM reference lies across the GADM boundary; Abuja and Lokoja retain reviewed OSM nodes despite 5.27/5.23 km DIVA centre differences.
- **Provenance:** the original is hidden as `settlements_state_capitals_map2023_original_pt`; the visible attributes retain previous coordinates, source, movement and QA notes. Before/after SHA256 values and reviewed exceptions are in `capital-correction-result.json`.
- **Evidence:** `capital-correction-ledger.csv` is the authoritative 37-row review record; `capital-coordinate-comparison.csv` / `.png` are current comparisons; `-before.csv` / `-before.png` preserve the uncorrected evidence.

### A2 — Resolved with provenance: reciprocal Gada/Illela identity conflict

- **Official control:** INEC’s Sokoto registration-area directory identifies Gada as LGA code 04 and Illela as code 08. Both official 11-name ward lists exactly match the existing assignments; no ward name, assignment or coordinate was changed.
- **Independent boundary identity:** reciprocal metric IoU is **0.736** for the former Gada-labelled polygon versus reference Illela and **0.854** for the former Illela-labelled polygon versus reference Gada. Same-name IoUs are only 0.045 and 0.002. The simplified external geometry was identity evidence only, not replacement geometry.
- **Correction:** FID/lga_id 708 is now Illela and FID/lga_id 712 is now Gada. Two polygon names and two centroid identity/attribute records were corrected; FIDs, IDs, areas and all centroid/polygon geometry remain fixed. Gada retains Wikidata Q5516271 and Illela Q5999073 with their correct representative districts.
- **Derived data:** 575 LGA joins were corrected only where the old attribute exactly matched the old containing polygon: 173 boreholes, 97 DIVA places, 303 OSM places and two hidden scanned-map towns. `previous_lga` is retained. Twenty-two ward-to-centroid distances were recomputed; OSM Kiri FID 14680 correctly remains Illela.
- **Residual ward review:** the follow-on A3 review is complete. Three LGA attributes were corrected and 37 documented exceptions remain; 32 are within 1 km and 0 exceed 10 km. Darna/Sabon Gari remains assigned to Illela but contained in Gwadabawa, **0.242 km** outside corrected Illela; it was not moved to force containment.
- **Provenance and evidence:** original LGA/centroid layers are hidden as `admin_lgas_gadm_identity_original_pg` and `admin_lga_centroids_identity_original_pt`. `gada-illela-verification.json`, the 601-row correction ledger, result hashes, two-feature reference extract and `ward-lga-exceptions-before.csv` / `sokoto-gada-illela-before.png` preserve the evidence.

### A3 — Resolved with provenance: residual ward/LGA exception review

- **Individual authoritative review:** all 40 cases across 20 states were checked against INEC registration-area directories and independent ArcGIS/Michael Bauer Research/NBS 2023 point intersections. The 40-row pre-review register is preserved separately.
- **Three true LGA attribute errors:** FID 4096 Kwarau changed from Kaduna North to Igabi; FID 4215 Gidan Waya changed from Sanga to Jema'a; FID 7295 Ward XI E9 I changed from Ibadan South East to Ibadan North East. Their derived centroid distances are 25.5, 23.4 and 0.9 km respectively. CSV feature indices 4095, 4214 and 7294 are zero-based and are not FIDs.
- **Thirty-seven reviewed retentions:** 20 boundary-generalisation/source-disagreement cases, 14 coastal/water cases, two suspect-coordinate cases (Gambaki/Bidir and Ilasa II/Ikun/Araromi), and Kwambai with explicit Takum/Ussa delimitation uncertainty. No containing polygon was relabeled merely because it contained a point.
- **Current residual metrics:** 37 exceptions; 32 within 1 km; 0 over 10 km; 15 without a local container. All 8,809 ward geometry blobs are byte-identical and all untargeted attributes were verified.
- **Cautions retained:** Ward XI E9 I has an independent Egbeda disagreement despite INEC and local Ibadan North East support. Arak and Panda/Kare have independent support for Sanga and Karu. Name variants and Kwambai uncertainty were documented rather than silently changed.
- **Evidence:** `ward-lga-review-ledger.csv`, `ward-lga-review-verification.json`, `ward-lga-correction-result.json`, `ward-lga-review.md`, `ward-lga-exceptions-before-residual-review.csv` and `references/ward-lga-review-sources.md` preserve every disposition, source URL, query, before/after attribute and geometry hash.

### B1 — Resolved with provenance: polygon topology errors

- **Before:** 191 invalid geometries: **183 Ring Self-intersection**, **7 Self-intersection**, **1 Nested shells**; 76 visible and 115 hidden. **After: zero active invalid geometries.**
- **Method:** GEOS 3.14.1 MakeValid linework, retaining valid polygonal coverage and discarding zero-area line residue from 40 features. No coordinate translation, feature deletion, FID change or attribute edit was applied.
- **Review gates:** 187 automatic cases, three individually reviewed area cases (Gulf of Guinea, Cross River and historical climate water), and one reviewed collapsed-line envelope case. The largest automatic absolute area change was 0.163%. Invalid source signed areas are diagnostic, not authoritative ground areas.
- **Bounds and unchanged data:** all raw GEOS linework bounds are unchanged. One zero-area vertical line extended 0.006091117859° north of its polygon; discarding it shrinks only that feature envelope. 5,635 untargeted geometry blobs remain byte-identical and every attribute is preserved.
- **Raster regression:** all 22 exact geology raster/vector class checks retain identical sampled-cell counts and agreement fractions before and after repair.
- **Static export:** the five-decimal default remains, with 43 per-feature higher-precision fallbacks recorded in `public/catalog.json` to prevent rounding-induced invalidity. The exporter does not MakeValid or alter source geometry.
- **Provenance:** 16 full source copies are hidden as `*_topology_original`; their 191 invalid geometries are historical evidence and excluded from active-defect counts. `topology-correction-ledger.csv`, `topology-correction-verification.json` and `topology-correction-result.json` record every feature, review, area, bounds delta and hash.
- **Evidence:** `topology-exceptions-before.csv` preserves the original 191 exceptions; `topology-exceptions.csv` is the now-empty active exception register. `raster-class-agreement-before-topology.csv` preserves the pre-repair raster baseline; `topology-reviewed-cases.png` shows all four reviewed before/after dispositions.

### B2 — Disclosed scope limitation: EMAG2 partial coverage

- Valid magnetic cells follow the same national grid, so this is not a misregistration finding. Whole or large parts of states have no values; those gaps remain explicitly NoData.
- **Two coverage denominators are retained:** the published stride-two sample is **90.2%**, while the independent full-cell calculation is **90.1%** (107,357 of 119,116 land cells). They are not contradictory measurements.
- **Transparent reclassification:** the visible name is “Magnetic anomaly (EMAG2 v2, partial coverage)”. The GeoPackage description begins “PARTIAL NIGERIA COVERAGE” and lists the state gaps and no-interpolation rule.
- **Preservation:** only `gpkg_contents.description` and `last_change` changed. Tile bytes, the logical float32 array, every other table and the public PNG/value-grid assets are hash-verified unchanged. No scientific values were fabricated.
- **Future rebuild control:** the EMAG2 fetch path now rejects output below 98% land coverage instead of silently publishing it as nationally complete. A verified complete source-window rebuild may replace the partial derivative as a separate evidence-led change.
- **Evidence:** `magnetic-coverage-reclassification-verification.json`, `magnetic-coverage-reclassification-result.json`, `magnetic-coverage-reclassification.md` and `raster-coverage-by-state.csv`.

### C — Hidden/source-data issues and scope qualifications

- **Resolved — scanned legend text:** FID 479 “Tow ns” at 12.434389 E, 5.750015 N was removed only from the active hidden town-label table (479 → 478). Its complete original attributes and exact geometry blob are preserved in `settlements_towns_map2023_excluded_artifacts_tbl`. The nearest OSM/DIVA settlement is Nver, 133.821/133.823 km away; the point was not renamed or moved as a settlement.
- **Resolved — population-region semantics:** D0451/FID 451 remains among all 504 active picture regions with identical feature digest, attributes and geometry. It is explicitly a connected population-class region, not an administrative district: 16 state and 124 LGA intersections support that classification. Its exclusion is registered in `population_districts_picture_semantic_review_tbl`; no split, deletion or coordinate repair was invented.
- **Evidence:** `hidden-source-artifact-ledger.csv`, `hidden-source-artifact-verification.json`, `hidden-source-artifact-result.json` and `hidden-source-artifact-resolution.md`.

### D — Resolved: stable administrative identifiers

- **Canonical keys:** states use `ngmap:state:NG-AB`, LGAs `ngmap:lga:0001` and wards `ngmap:ward:000001`. These are persistent repository-issued IDs, not statutory codes. LGA polygons and centroids share keys; wards carry both state and LGA parent keys; population-state polygons and capitals reference state keys.
- **Non-administrative context:** Water body and Lake Chad retain null administrative and INEC identifiers. They are not counted as a 38th state or 775th LGA.
- **INEC crosswalk:** 37/37 states, 774/774 LGAs and **8,589/8,809 wards** have one-to-one INEC links. The ward links comprise 8,189 exact-name and 400 conservative numeral-normalized matches. The remaining **220** comprise 198 unmatched names and 22 rows in 11 duplicate local-label groups; canonical project IDs remain complete.
- **Name stability:** Gada and Illela retain separate persistent project IDs while their INEC codes 04 and 08 are explicit. The Gbonyin/Aiyekire alias demonstrates why labels must not be used as identifiers. Existing names and assignments were not rewritten.
- **Preservation:** only declared identifier columns, indexes and metadata were added. All original attributes and geometry blobs passed staged and final byte-for-byte comparisons. Hidden pre-correction provenance was not modified.
- **Evidence:** `admin-identifier-verification.json`, `admin-identifier-result.json`, `admin-identifier-resolution.md` and `../admin-identifiers/` contain the 9,622-row registry, pinned source manifest, matching rules, coverage and before/after hashes.

### E — Defined: cross-border geographic data policy

- **Coverage:** 59 visible and 39 hidden layers have explicit scope metadata; 19 hidden provenance layers inherit their active layer’s class. Current class counts: map_sheet 35, nigeria_focused 16, nigeria_with_context 13, raster_window 11, regional_reference 5, transboundary_system 18.
- **Retention and publication:** every class requires `preserve_unclipped`. Visibility remains unchanged; foreign extraction context, transboundary systems, regional references, map sheets and hidden originals are not silently removed or published.
- **National statistics:** an explicit named Nigeria mask is required. Foreign-only, boundary, marine and wholly internal features are separate categories. Nigeria-only polygon areas and line lengths are derived clipped measurements; whole transboundary totals are reported separately.
- **Boundary limits:** GADM and Natural Earth are diagnostic references, not legal sovereignty, international-boundary, territorial-sea or EEZ determinations. Water body / Lake Chad is not Nigerian administration or wholesale Nigerian land. NoData remains unknown, never zero.
- **Application contract:** catalog `crossBorder` metadata describes required interpretation; the focus-area Area summary is not an automatic country filter. Foreign features never receive Nigerian canonical IDs through nearest-distance or fuzzy-name inference.
- **Evidence:** `../cross-border-data-policy.md`, `../../config/cross-border-policy.json`, `cross-border-policy-register.csv`, the core audit policy summary and public catalog metadata provide the versioned rules and all 98 layer assignments.
- Visible WDPA includes correctly identified Cameroon features such as Korup, Takamanda and Waza-Logone; the large Gulf of Guinea polygon is explicitly marine; offshore heat-flow records are tagged `domain=marine`. Lake Chad ports are intentionally outside the land-only reference but remain valid water/port context. These are scope issues, not coordinate errors.
- Classified point-outlier outcomes: **expected Lake Chad/coastal port context: 38**; **expected marine/coastal extraction context: 3**; **expected marine/cross-border gazetteer context: 10**; **expected neighbouring-country extraction context: 3104**; **expected offshore measurement: 36**; **map content in neighbouring country; not a Nigerian coordinate shift: 6**.
- OSM/DIVA extraction envelopes contain neighbouring-country settlements. If the intended product is Nigeria-only, use a separately documented clipped derivative or label them as surrounding context rather than moving them or clipping the source in place.

## Checks that support alignment

### Coordinate systems, geometry decoding and raster grids

- **98/98 SQLite integrity checks passed.** All 98 spatial layers declare EPSG:4326 with no contents/geometry-column SRS mismatch.
- **0 null geometries, 0 empty geometries, 0 non-finite coordinates and 0 out-of-range longitude/latitude geometries** across 82 vector layers.
- **0 active invalid geometries.** Hidden topology provenance separately retains **191** historical invalid originals; those copies are not current production data.
- Every computed vector extent agrees with its declared GeoPackage extent to better than 0.001°. All 16 raster/image tile matrices have positive pixel sizes, decodable tiles and bounds consistent with their contents metadata.
- Excluding the explicitly partial magnetic product, sampled valid-data coverage inside Nigerian land is **99.4%–100.0%** across the other 12 numeric rasters; outside-land valid fractions are low edge effects. This confirms tile-grid and clipping-mask registration, but is not by itself proof of every cell value’s absolute accuracy.

### Exact raster/vector classification pairs

| Raster / vector pair | Classes | Agreement range | Interpretation |
|---|---:|---:|---|
| `geology_general_picture_code_rst` / `geology_general_picture_pg` | 8 | 92.8%–99.2% | Strong whole-class registration; small residuals are consistent with boundary/rasterisation differences |
| `geology_surficial_usgs_code_rst` / `geology_surficial_usgs_pg` | 14 | 91.8%–100.0% | Strong whole-class registration; small residuals are consistent with boundary/rasterisation differences |

- Landslide medians increase from **0** in rank 1 to **0.011789** in rank 4, supporting correct raster/vector registration and ordinal meaning.
- **100.0%** of **12,000** valid representative-point samples from 12,000 settlement-extent polygons have positive built-up surface; median **14,423 m² per cell**.
- `raster-class-agreement.csv` provides every class sample count, expected code, agreement fraction and dominant-code distribution.

### Administrative and independent national controls

- GADM LGA polygons reconstruct every state with minimum area IoU **1.00000000**. The population-state polygons are geometrically identical to the state source (minimum IoU **1.00000000**).
- The special 775th LGA polygon is **Water body / Lake Chad**, explaining 775 polygons versus 774 LGA centroids; it was excluded from land-mask and national land-boundary comparisons.
- Independent geoBoundaries/Natural Earth national boundary comparison: area IoU **0.99377**, directed median nearest-boundary distances **0.359 km** and **0.350 km**. The remaining differences are consistent with source generalisation and boundary vintage.
- All 37 corrected capital points fall inside their named state. Containment is independent of the OSM construction coordinates, but it establishes administrative plausibility rather than survey accuracy.
- All 99,245 boreholes have a containing GADM LGA. Raw name mismatches are dominated by spelling variants; fuzzy-name results for boreholes, OSM/DIVA places, airports and POIs are retained in `extended-audit.json` rather than being misreported as coordinate failures.

### Scans and linear features

- The existing control-based registration report shows geology/mineral scan river controls at sub-kilometre to few-kilometre agreement and documents correction of the former 3.2 km mineral-vector offset. See `docs/registration/registration-report.md` and its before/after evidence.
- In this audit, 2011 geology contact lines have a **0.119 km median** nearest distance to their unit-polygon boundaries; 98.3% of samples are within 5 km.
- Roads, railways and rivers do **not** show a common constant translation: matched nearest-line median east/north residuals are generally below 0.3 km. Larger p95 distances reflect different network completeness, map scale and generalisation. DIVA contains many minor roads/rivers absent from the scanned maps, so reverse coverage percentages are not alignment scores.
- These are consistency checks, not proof that every geological contact or mineral occurrence is survey-accurate.

## Professional limitations

- **Internal alignment is not absolute ground truth.** Two layers derived from the same incorrect source can agree perfectly and still be wrong on the ground.
- OSM, DIVA, Natural Earth, GADM and geoBoundaries are external corroborating sources, but none is a legal survey. OSM is a construction source—not independent validation—for the 32 corrected capitals. DIVA statistics distinguish strict held-out cases from selection-informed candidate review. Authoritative ground control is still required for legal, engineering or mineral-title decisions.
- Different survey years, administrative vintages, generalisation and coast/lake treatments create legitimate residuals. Exceptions were therefore interpreted by feature type and stated scope.
- Scanned-map symbol alignment verifies digitisation relative to that sheet; it does not independently verify the real-world mineral occurrence or settlement coordinate.
- Historical picture polygons for climate, soil pH and population are different products/years from the modern rasters. Their numeric disagreement was not misused as a coordinate test.
- INEC controls ward-to-LGA assignments and ward names; its directory is not a legal polygon survey. The ArcGIS reference provides independent identity corroboration, but its simplified two-feature extract was not used as replacement geometry or relabelled as an official GRID3 product.
- The residual review uses INEC for assignment and 40 independent point-intersection responses for boundary corroboration. Independent disagreements remain visible; no external geometry was substituted and no ward coordinate was moved.
- EMAG2 remains a partial derivative despite its global source product name. The 90.2% sampled / 90.1% full-cell figures describe data presence, not scientific accuracy. NoData must not be interpreted as zero nanoTesla or filled by spatial interpolation.
- The hidden town layer remains a scanned-sheet cross-check source, not an authoritative settlement gazetteer. Population picture regions are class connected regions, not legal districts; D0451’s semantic exclusion must survive any future export or republication.
- `ngmap-admin-v1` IDs are repository-issued, not official government codes. INEC internal IDs and local codes describe electoral registration areas, not legal boundary surveys. The 220 null INEC ward links are intentional unresolved evidence gaps, not missing canonical IDs; do not infer them from fuzzy names or row order.
- Cross-border scope classes govern retention and aggregation, not sovereignty. GADM and Natural Earth remain diagnostic references; map inclusion does not prove Nigerian administration, a legal boundary, territorial waters or an EEZ. The catalog policy metadata does not turn the generic focus-area summary into an automatic country filter.

## Reproduction and evidence files

```bash
python -m pip install -r scripts/requirements.txt
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
```

- `audit.json`: full core inventory, per-layer geometry and scope metrics, admin checks, national-boundary and line comparisons.
- `extended-audit.json`: independent capital checks, topology, raster registration/coverage and named-point results.
- `layer-review.md` / `layer-review.csv`: explicit disposition, evidence and action for every one of the 98 layers.
- `capital-correction-ledger.csv` / `capital-correction-result.json`: all 37 correction decisions, previous/new coordinates, sources, QA, review exceptions and hashes.
- `capital-coordinate-comparison.csv` and `.png`: current capital comparisons; `-before.csv` / `-before.png` preserve the uncorrected evidence.
- `ward-lga-exceptions.csv` and `sokoto-gada-illela.png`: all 37 current assigned-LGA exceptions and the current Sokoto evidence.
- `gada-illela-correction-ledger.csv` / `gada-illela-verification.json` / `gada-illela-correction-result.json`: official controls, independent identity direction, all 601 attribute-only decisions, before/after source and provenance hashes and post-apply checks. `references/` documents the exact two-feature boundary response and source limitations.
- `ward-lga-review-ledger.csv` / `ward-lga-review-verification.json` / `ward-lga-correction-result.json`: all 40 individual dispositions, three attribute-only corrections, official and independent evidence, before/after hashes and post-apply checks. `ward-lga-review.md`, `ward-lga-exceptions-before-residual-review.csv` and `references/ward-lga-review-sources.md` preserve the human review and source limitations.
- `magnetic-coverage-reclassification-verification.json` / `magnetic-coverage-reclassification-result.json` / `magnetic-coverage-reclassification.md`: explicit partial-coverage decision, full-cell and sampled coverage, state register, before/after metadata and unchanged-data hashes.
- `hidden-source-artifact-ledger.csv` / `hidden-source-artifact-verification.json` / `hidden-source-artifact-result.json` / `hidden-source-artifact-resolution.md`: the quarantined legend row and D0451 semantic exclusion, nearest-settlement and state/LGA-intersection evidence, sidecar provenance and complete before/after digests.
- `admin-identifier-verification.json` / `admin-identifier-result.json` / `admin-identifier-resolution.md` and `../admin-identifiers/`: canonical assignment rules, the 9,622-row registry, pinned INEC source manifest, external-link limitations, complete original-row/geometry digests and six before/after source hash chains.
- `../cross-border-data-policy.md` / `../../config/cross-border-policy.json` / `cross-border-policy-register.csv`: versioned retention, publication and aggregation rules, diagnostic-boundary limitations and all 98 per-layer scope assignments. Public catalog `crossBorderPolicy` and per-layer `crossBorder` fields carry the same policy ID and rules.
- `topology-correction-ledger.csv` / `topology-correction-verification.json` / `topology-correction-result.json`: all 191 feature repairs, four explicit review dispositions, before/after areas and bounds, source/provenance hashes and post-apply checks.
- `topology-exceptions.csv`: current active exceptions; `topology-exceptions-before.csv` preserves all 191 original defects and GEOS reasons.
- `raster-class-agreement.csv`: all 22 exact geology class checks; `raster-class-agreement-before-topology.csv` preserves the pre-repair baseline.
- `raster-coverage-by-state.csv`: magnetic valid-cell fraction by state.
- `point-outliers-classified.csv`: offshore/neighbouring-country/review interpretation for every point over 10 km from land.

**Recommended next step:** no further automatic correction is recommended. Preserve all six correction/reclassification evidence chains, the administrative identifier registry and `ngmap-cross-border-v1`. Apply the cross-border register before any Nigeria-only aggregation; use canonical IDs for new joins and never backfill unresolved INEC links or clip transboundary sources without a separately documented derivative.
