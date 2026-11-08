# Stable administrative identifier resolution

**Status:** installed and verified.

## Canonical IDs

- `ngmap-admin-v1` assigns persistent IDs to **37 states**, **774 LGAs** and **8,809 wards**. Water body and Lake Chad are non-administrative rows and retain null IDs.
- States use `ngmap:state:NG-AB`; LGAs use `ngmap:lga:0001`; wards use `ngmap:ward:000001`. These are repository-issued identifiers, not statutory or INEC codes.
- IDs are never renumbered to fill gaps. A reviewed name correction retains the existing ID; new, split or merged entities require an explicit registry decision.
- LGA rows include `state_admin_id`; ward rows include both `state_admin_id` and `lga_admin_id`. Population-state polygons share state IDs, and capitals reference them.

## INEC crosswalk

- **37/37 states** and **774/774 LGAs** have INEC internal IDs; LGA/ward local codes are stored as text to preserve leading zeroes.
- **8,589/8,809 wards (97.5%)** have one-to-one INEC ward links. Exact names account for 8,189 and conservative terminal-numeral normalization for 400.
- **220 wards** retain null INEC ward fields: 198 unmatched names and 22 rows in 11 duplicate local-label groups. No external ID is guessed or reused.
- The pinned source contains 8,810 raw ward records. ID 8810 is excluded as an exact duplicate of Mbaikyaan ID 1462/code 09 in Gwer East, leaving the curated 8,809.
- INEC IDs describe the electoral registration-area hierarchy. They are not legal boundary identifiers and do not replace the canonical project IDs.

## Preservation and reproduction

- Only the declared identifier columns, indexes and GeoPackage descriptions are added. Every original attribute and geometry blob is compared byte-for-byte in staging and after installation.
- Registry: `docs/admin-identifiers/admin-identifier-registry.csv` (9,622 rows including two non-administrative records).
- Source provenance: `docs/admin-identifiers/inec-source-manifest.json`, pinned to `8a5bebf12f2e688ed26c313a632f1b729115d095` of `https://github.com/kcemenike/find-my-polling-unit`.

```bash
python scripts/introduce_admin_identifiers.py
python scripts/introduce_admin_identifiers.py --apply --approve-verified
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/build_site.py
```
