# Administrative identifiers

## Scheme: `ngmap-admin-v1`

The administrative layers now carry persistent identifiers independent of display names and GeoPackage export behavior.

| Entity | Example | Canonical field | Parent fields |
|---|---|---|---|
| State / FCT | `ngmap:state:NG-AB` | `admin_id` | — |
| LGA | `ngmap:lga:0001` | `admin_id` | `state_admin_id` |
| Ward | `ngmap:ward:000001` | `admin_id` | `state_admin_id`, `lga_admin_id` |

The identifiers are **repository-issued**, not official government, ISO, INEC, NBS, or legal boundary codes. The ISO 3166-2 value forms the state identifier; LGA and ward sequences were assigned once from the reviewed source inventory. They are stored as ordinary attributes and exported as GeoJSON feature IDs as well as properties.

Water body and its Lake Chad polygon are non-administrative context. Their `admin_id` and external INEC fields remain null; they are not counted as a 38th state or 775th LGA.

Population-state polygons share the state `admin_id`. State-capital points carry `state_admin_id`. LGA polygons and centroids use the same LGA and state identifiers.

## Stability rules

1. Never derive a new ID from a changed spelling, geometry, or replacement GeoPackage FID.
2. Never renumber existing IDs to close a gap or sort a layer differently.
3. A name correction or boundary geometry update retains the administrative ID after review confirms it is the same entity.
4. A genuinely new entity receives an unused ID. Split, merge, or abolition decisions require an explicit registry migration and provenance; they are not inferred automatically.
5. Joins should use `admin_id`, `state_admin_id`, or `lga_admin_id`. Names remain labels and review evidence, not keys.

`admin-identifier-registry.csv` is the authoritative assignment register. It contains 9,622 rows: 38 state-level rows and 775 LGA-level rows including the two non-administrative context records, plus 8,809 wards.

## Optional INEC crosswalk

The registry also preserves INEC internal database IDs and local codes from the electoral registration-area hierarchy:

- 37 states and all 774 real LGAs have one-to-one INEC mappings. Thirty-eight reviewed LGA name aliases and the FCT alias are explicit.
- 8,589 of 8,809 wards have one-to-one INEC mappings: 8,189 exact names and 400 conservative terminal-numeral normalizations.
- The remaining 220 wards have canonical project IDs but null `inec_ward_id` / `inec_ward_code`: 198 unmatched names and 22 rows in 11 duplicate local-label groups. No external ID is guessed or assigned twice.
- The pinned source has 8,810 raw ward records. Its exact duplicate `MBAIKYAAN` ID 8810 is excluded; persistent ID 1462 and code 09 are retained.

INEC codes identify electoral administration. They do not replace the canonical IDs and must not be interpreted as legal boundary identifiers. Codes with leading zeroes are stored as text.

`inec-source-manifest.json` pins the source repository/commit and SHA-256 for every source file. The upstream README describes the public INEC data as free to use but declares no formal repository licence; that limitation is retained rather than silently assigning a licence.

## Maintenance and verification

Normal verification uses only committed files:

```bash
python scripts/introduce_admin_identifiers.py
```

To review and apply a fresh migration on a pre-identifier checkout:

```bash
python scripts/introduce_admin_identifiers.py
python scripts/introduce_admin_identifiers.py --apply --approve-verified
```

Regenerating the registry requires the pinned `kcemenike/find-my-polling-unit` source tree and should itself be reviewed as a data change:

```bash
python scripts/introduce_admin_identifiers.py \
  --prepare-registry --source-dir /path/to/find-my-polling-unit
```

The installer stages all six affected GeoPackages, compares every original value and geometry blob, verifies registry assignments and indexes, then records before/after hashes in `../geospatial-audit/admin-identifier-result.json`. It does not modify hidden pre-correction provenance.
