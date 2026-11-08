# Hidden-source artifact resolution

**Status:** applied and verified.

## 1. Scanned-map “Tow ns” label

- Active hidden point FID **479**, coordinates **12.434389 E, 5.750015 N**, label distance **15.8 pt**.
- Nearest OSM settlement: **Nver**, **133.821 km** away. Nearest DIVA settlement: **Nver**, **133.823 km** away.
- Resolution: remove only this generic legend-text row from the active hidden table (479 → 478 features). Do not rename or move it as a settlement.
- The complete original attributes and exact GeoPackage geometry blob are preserved in `settlements_towns_map2023_excluded_artifacts_tbl`. All other 478 rows remain byte-identical.

## 2. Population region D0451

- FID **451**, class **232,288 - 1,319,571**, stated area **121,139.862 km²**; current metric geometry area **121,249.280 km²**.
- Intersects **16 states** and **124 LGAs** at ≥1 km² per intersection.
- Resolution: classify D0451 as a connected population-class picture region—not an administrative district—and exclude it from district-level analysis. All 504 active features, attributes and geometry blobs remain unchanged.
- The semantic decision and intersection evidence are registered in `population_districts_picture_semantic_review_tbl`.

## Evidence and reproduction

`hidden-source-artifact-ledger.csv`, `hidden-source-artifact-verification.json` and `hidden-source-artifact-result.json` record guarded before/after hashes and complete checks.

```bash
python scripts/resolve_hidden_source_artifacts.py
# Only after reviewing the verification:
python scripts/resolve_hidden_source_artifacts.py --apply --approve-verified
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/build_site.py
```
