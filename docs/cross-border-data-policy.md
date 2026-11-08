# Cross-border geographic data policy

**Policy ID:** `ngmap-cross-border-v1`

**Status:** defined and propagated to the audit register and public catalog

**Applies to:** every visible and hidden spatial layer in this repository

This policy governs **geographic scope**: features that cross Nigeria's borders, foreign features in an
extraction envelope, transboundary natural systems, coastal/marine features, regional reference data, and
map sheets that extend beyond Nigeria. It is not a personal-data transfer policy and does not replace any
source licence, attribution requirement, or restriction on international data sharing.

## 1. Normative rules

The words **must**, **must not**, and **required** below are repository requirements.

1. **Preserve the source.** A feature must not be clipped, moved, deleted, split, or relabelled merely because
   it crosses or lies outside the diagnostic Nigeria boundary. Existing hidden provenance remains hidden.
2. **Make scope explicit.** Every spatial layer must resolve to one scope class in
   `config/cross-border-policy.json`. Its class, source-retention rule, foreign-feature treatment, and
   national-statistics rule are recorded in the audit and, for published layers, `public/catalog.json`.
3. **Do not confuse an extraction window with a country.** A rectangular bbox, source API envelope, scanned
   map sheet, or raster window is not evidence that every included feature is Nigerian.
4. **Do not silently nationalise context.** Foreign, marine, and transboundary features must not be assigned
   to the nearest Nigerian state/LGA or included in a Nigeria-only total without the rules in section 4.
5. **Do not treat the diagnostic boundary as law.** GADM, geoBoundaries, Natural Earth, ESRI, and scanned
   boundary lines are reference products with different vintages and generalisation. They do not establish
   sovereignty, a legal international boundary, territorial waters, or an exclusive economic zone.
6. **NoData is not zero.** Raster cells outside source coverage or marked NoData must remain unknown; they
   must not be interpolated or counted as zero just to make a national total appear complete.

## 2. Scope classes

| Class | Intended content | Foreign-feature treatment | Nigeria-statistics rule |
|---|---|---|---|
| `nigeria_focused` | Nigerian administrative or thematic data | Foreign-only features require feature-level review; border/generalisation differences are not automatic coordinate errors | Explicit Nigeria filter required |
| `nigeria_with_context` | Nigeria extraction with declared neighbouring-country, coastal, or marine context | Retain as labelled context; do not turn it into Nigerian administration | Explicit Nigeria filter required |
| `transboundary_system` | Aquifers, basins, rivers, geological/cultural areas, roads, railways, and other continuing systems | Preserve the whole feature | Report whole-system and Nigeria-only portions separately |
| `regional_reference` | Regional/global reference, ECOWAS regional units, and boundary reference | Expected reference content | Not a Nigeria total |
| `map_sheet` | Scanned-sheet derivatives, images, graticules, and sheet furniture | Retain sheet context, including foreign content where present | Exclude foreign sheet content; clip derived measurements |
| `raster_window` | Numeric raster grids | Respect the source valid-data mask | Apply both the analysis AOI and valid-data mask |

The current register covers **98 spatial layers: 59 visible and 39 hidden**. Hidden topology, identity, and
capital originals inherit the active layer's scope class but have `hidden_provenance` publication semantics.
A new layer uses the safe kind default until a reviewer assigns a more specific override. Stale overrides,
unknown classes, and missing register/catalog coverage fail validation.

## 3. Geographic references and special cases

### Diagnostic land mask

The audit's diagnostic land mask is the dissolve of `admin_states_gadm_pg`, excluding the special
**Water body / Lake Chad** row. Natural Earth country polygons provide independent neighbouring-country and
marine context in `point-outliers-classified.csv`.

These references support diagnostics, not legal adjudication. A point outside the land mask can be a valid
port, Lake Chad feature, offshore measurement, foreign extraction-context feature, or genuine error. A
polygon or line not fully covered by the land mask can be a boundary-generalisation difference, a coastal
feature, or a legitimately transboundary system.

### Lake Chad and marine areas

- Water body / Lake Chad is not a 38th state or 775th LGA and has no canonical administrative ID.
- The whole lake must not be treated as Nigerian land or added wholesale to Nigerian land area.
- Ports and other water-context features are not coordinate failures solely because they fall outside a
  land-only polygon.
- Marine heat-flow measurements and other offshore observations remain marine observations. Their presence
  does not assert an EEZ or territorial-sea boundary.

### Administrative identity

Canonical `ngmap-admin-v1` IDs identify the repository's Nigerian administrative entities. They must not be
assigned to foreign extraction-context features. A foreign feature must not receive a Nigerian parent join
by nearest distance, fuzzy place name, or coincidental containment in a generalised polygon. Existing
source-provided country/admin labels remain source attributes, not automatic proof of a corrected join.

## 4. Aggregation and measurement

### Feature counts

Before producing a Nigeria-only count, name the analysis mask and report, where applicable:

1. wholly inside Nigeria;
2. intersecting or on the boundary;
3. foreign-only;
4. marine or otherwise unassigned.

For `regional_reference` layers, do not emit a Nigerian thematic count by default. For `map_sheet` layers,
exclude sheet furniture and foreign sheet content. For `nigeria_focused` layers, unexplained foreign-only
features remain review exceptions rather than being silently accepted or removed.

### Points and attribute joins

Classify points using their actual geometry. Do not use country/state/LGA text alone, and do not move a point
to make it fit a label. Foreign points remain foreign context unless new evidence supports a correction.
The existing Gada/Illela and residual ward/LGA decisions are separate, evidence-gated corrections and are
not overridden by this policy.

### Polygon area and line length

A whole transboundary feature's area or length is a **whole-system** measurement. For a Nigeria-only
measurement, intersect a copy with the named analysis mask and label the output **Nigeria-only clipped
area/length**. Preserve the source geometry and disclose the whole-feature value where it aids
interpretation. Do not mix clipped and unclipped measurements in one total.

This applies, for example, to IGRAC aquifers, FAO drainage basins, DIVA rivers and water areas, geological
units, and transport networks. Regional ECOWAS units require an explicit clipped derivative before any
Nigeria-only measurement is presented.

### Rasters

National raster summaries require both an analysis AOI and the source's valid-data mask. A rectangular grid
can extend beyond Nigeria; conversely, a grid labelled as a global product can contain NoData inside Nigeria.
Outside-country and missing-source cells remain unknown. Map-image and picture-code rasters follow the
`map_sheet` class rather than the numeric `raster_window` class.

### Current application behaviour

The catalog's `crossBorder` metadata is an interpretation and validation contract, not a claim that the
browser automatically determines sovereignty. The generic **Area summary** operates on the user's focus
area. A user producing Nigeria-only statistics must select an explicit Nigeria analysis area and apply the
rules above; raw layer-wide sums are not automatically Nigeria totals.

## 5. Publication and derived products

- Visible layers retain their complete declared source/context scope. Hidden sources and provenance are not
  published merely because they appear in the policy register.
- Scope metadata is required in `public/catalog.json`; it does not alter feature geometry or source values.
- A future Nigeria-clipped product must be a **new derivative**, not an in-place source edit. Its documentation
  must record the source layer, exact analysis-mask layer/version, operation, date, feature-count effects,
  and before/after hashes. Its name and description must say `Nigeria clipped` or equivalent.
- A transboundary product must not be replaced by its Nigeria-clipped derivative. Keep both when both views
  are needed, with distinct IDs and labels.
- Existing correction provenance and stable administrative IDs remain authoritative for their own scopes.
  This policy adds geographic-usage semantics; it does not rewrite those evidence chains.

## 6. Review and ingestion checklist

Before adding, replacing, or reclassifying a layer:

- [ ] Declare its scope class or consciously retain the safe default.
- [ ] Record why foreign, boundary, coastal, or marine content is expected or requires review.
- [ ] Check actual geometry, not just names, bbox, CRS, or a global/regional product title.
- [ ] Keep transboundary geometries whole and define separate whole-system/Nigeria-clipped statistics.
- [ ] Confirm that foreign features have not received Nigerian canonical IDs or nearest-place parent joins.
- [ ] Preserve source NoData and confirm that it is not rendered or aggregated as zero.
- [ ] Keep hidden provenance hidden and retain all correction hash chains.
- [ ] Regenerate the core audit, extended audit, layer register, and public catalog sequentially.
- [ ] Run artifact validation and the full regression suite.

A new unexplained foreign-only feature in a `nigeria_focused` layer requires an individual disposition:
retain with a documented context rule, correct with authoritative evidence, or quarantine with complete
provenance. Automatic clipping or deletion is not a permitted disposition.

## 7. Evidence and maintenance

- Machine-readable source of truth: `config/cross-border-policy.json`
- Shared resolver: `scripts/cross_border_policy.py`
- Complete per-layer register: `docs/geospatial-audit/cross-border-policy-register.csv`
- Core policy summary and per-layer rules: `docs/geospatial-audit/audit.json`
- Public interpretation metadata: `public/catalog.json` (`crossBorderPolicy` and per-layer `crossBorder`)
- Foreign/marine point review: `docs/geospatial-audit/point-outliers-classified.csv`

```bash
python scripts/audit_geospatial.py
python scripts/audit_geospatial_extended.py
python scripts/build_site.py
python scripts/validate_artifacts.py
python -m unittest discover -s tests -v
```

Run the commands sequentially. None of them clips or repairs source geometry as part of this policy.
