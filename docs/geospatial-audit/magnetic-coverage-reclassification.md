# EMAG2 magnetic coverage — transparent reclassification

**Status:** applied and verified.

## Decision

The committed derivative is **partial coverage**, not a continuous national magnetic surface. No values were interpolated or otherwise repaired. Missing cells remain NoData. The visible layer label is **Magnetic anomaly (EMAG2 v2, partial coverage)**.

- Full-cell Nigerian land coverage: **90.1%** (107,357 of 119,116 cells).
- Published stride-two land sample: **90.2%** (26,871 of 29,789 cells).
- Grid: 500 × 400; 109,484 valid and 90,516 NoData cells.
- The distinction between 90.1% full-cell and 90.2% sampled coverage is intentional.

## Preservation

- Tile rows: 1; tile SHA256: `5869206b07b14c3f7bdfcacea193f71fbd242150efbe663453885d6688619af0`.
- Logical float32 array SHA256: `c69542c525b08981ac9b3930944b710d97a7a46da92f608d211d78c5152498ce`.
- All tables other than `gpkg_contents`: `734aed400455aa433b7876b4a18a49e318fc77f31298d1e56d5e8b371fdbf550`.
- Installation changes only `gpkg_contents.description` and `last_change`. The public PNG and compressed value grid are expected to remain byte-identical.

## State coverage

| State / area | Cells | Valid cells | Valid fraction |
|---|---:|---:|---:|
| Abia | 613 | 613 | 100.0% |
| Adamawa | 4505 | 4497 | 99.8% |
| Akwa Ibom | 878 | 878 | 100.0% |
| Anambra | 597 | 597 | 100.0% |
| Bauchi | 6503 | 6503 | 100.0% |
| Bayelsa | 1282 | 1282 | 100.0% |
| Benue | 4100 | 4100 | 100.0% |
| Borno | 8795 | 8795 | 100.0% |
| Cross River | 2785 | 2784 | 100.0% |
| Delta | 2167 | 2167 | 100.0% |
| Ebonyi | 812 | 812 | 100.0% |
| Edo | 2563 | 2440 | 95.2% |
| Ekiti | 697 | 0 | 0.0% |
| Enugu | 1009 | 1009 | 100.0% |
| Federal Capital Territory | 968 | 968 | 100.0% |
| Gombe | 2410 | 2410 | 100.0% |
| Imo | 695 | 695 | 100.0% |
| Jigawa | 3188 | 3188 | 100.0% |
| Kaduna | 5853 | 5853 | 100.0% |
| Kano | 2663 | 2663 | 100.0% |
| Katsina | 3153 | 3015 | 95.6% |
| Kebbi | 4774 | 3677 | 77.0% |
| Kogi | 3790 | 3512 | 92.7% |
| Kwara | 4676 | 3103 | 66.4% |
| Lagos | 501 | 458 | 91.4% |
| Nasarawa | 3451 | 3451 | 100.0% |
| Niger | 9357 | 9225 | 98.6% |
| Ogun | 2098 | 1256 | 59.9% |
| Ondo | 1897 | 1316 | 69.4% |
| Osun | 1199 | 67 | 5.6% |
| Oyo | 3597 | 1095 | 30.4% |
| Plateau | 3637 | 3637 | 100.0% |
| Rivers | 1111 | 1111 | 100.0% |
| Sokoto | 4240 | 1705 | 40.2% |
| Taraba | 7911 | 7861 | 99.4% |
| Water body | 690 | 690 | 100.0% |
| Yobe | 6053 | 6053 | 100.0% |
| Zamfara | 4588 | 4561 | 99.4% |

## Reproduction

```bash
python scripts/reclassify_magnetic_coverage.py
# Only after reviewing the verification evidence:
python scripts/reclassify_magnetic_coverage.py --apply --approve-verified
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/build_site.py
```

A future source rebuild must pass the completeness gate in `scripts/fetch_geology_layers.py`; otherwise it must retain explicit partial-coverage labeling.
