# Mineral occurrence points (2023 map) — replacement layer + symbol centering

**Date:** 2026-11-06 · **Layer:** `minerals_occurrences_map2023_pt` · **Sheet:** `minerals_map2023_img.jpg` (2023)

## What changed

The occurrence layer is replaced by the complete, hand-picked point set (1 547 points, one per
mineral occurrence symbol the user identified on the 2023 sheet). Every point keeps its
user-given mineral name; coordinates are **centered on the raster symbol** wherever the
assignment between point and symbol was certain. Points whose symbol could not be determined
safely (dense clusters, partial matches) keep their as-digitized coordinates, per instruction
*"if you can't figure out the adjustment for a point, just leave it and not move"*.

| result | points |
|---|---|
| moved to symbol centre (`match_class = symbol-centered`) | **1 410** (91.1 %) |
| left as digitized (`match_class = as-digitized`) | 137 (8.9 %) |

One-to-one rule enforced throughout: no two points were assigned to the same symbol
(*"don't match two"*); when several points competed for one symbol in a cluster, the best
assignment was kept and the rest left unmoved.

## Method

1. **Symbol detector** (`symdetect.py`): 8 colour families (yellow, green, purple/magenta, red,
   blue-green, brown, olive, dark) with priority-based pixel classification; morphological
   closing + hole filling; thin-line rescue (graticule/road lines split symbols); watershed
   splitting of touching symbols; cross-family de-duplication → 4 650 candidate symbols on the
   sheet, each with family + size signature.
2. **Vocabulary learning**: clear-cut cases (unique symbol within 6 px, next ≥ 10 px away) gave
   per-mineral symbol families (e.g. Clay = yellow square "C", Kaolin = olive square "K",
   Limestone = green hatched square, Gold = plain yellow square, Marble = small red diamond,
   Columbite = dark shield, Tantalite = divided bowl, Coal = black bar, Gypsum = circle with
   bar, Iron Ore = purple circle/triangle, River Gravel = grid square). 23 minerals with ≥ 3
   clear cases also got a median **appearance template** (25×25 local-contrast patch).
3. **Matching** (`match4.py`): per point, template-correlation peaks + detector components
   within 18 px as candidates (comp centroid used to refine peak positions); cost = biased
   distance + 8·(1 − template corr) + family-mismatch penalty; hard corr gate 0.25; global
   one-to-one assignment (Hungarian on connected components, "leave" option cost 15). Final
   median template correlation of accepted matches: 0.53.
4. **Vertical bias**: user picks sit on average 6.0 px north of symbol centres (median applied
   shift 6.4 px; std ≈ 2 px) — corrected per point.

## Attributes written

- `mineral` — as provided in the new point set (2 rows have NULL mineral in the source and
  stay NULL).
- `legend_no` — joined through the 2023 legend table (all 76 mineral names resolved,
  including variants like "Tantalite (ta)" → legend 58 "Tantalite").
- `match_class` / `match_score` — this run's QA: `symbol-centered` + template correlation, or
  `as-digitized` + NULL.
- `map_label_no`, `zone`, `visible_fraction`, `position_accuracy_m`, `qa_flag`, `state`,
  `lga` — NULL (not computed for the new set; schema kept for compatibility).
- `minerals_legend_map2023_tbl.points_detected` — refreshed so the legend counts match the
  new layer (Σ = 1 545 for the named minerals).

## Verification

Random visual audit of 16 distinct minerals (green cross = as digitized, magenta ring = final
position; see `samples/`):

- 13/16 clearly centred on the correct mineral symbol (Clay, Manganese rosette, Gold,
  Columbite shield, Mica circle, Calcite, Gypsum, Iron Ore, Lignite bar, River Gravel grid,
  Coal bar, Bentonite "B", Brine "B").
- 3/16 on the correct symbol but not exactly at its centre (occluded/clustered symbols) —
  acceptable, none clearly wrong.
- Dense clusters (e.g. the Abakaliki red-diamond cluster, `sample_cluster_left_unmoved.png`)
  are left unmoved by design.

Geometry sanity: all 1 547 points inside the sheet bounds; GPKG extent metadata updated.

## Files

- `data/minerals_occurrences_map2023_pt.gpkg` — replaced (table name & schema unchanged).
- `data/minerals_legend_map2023_tbl.gpkg` — `points_detected` refreshed.
- `public/` — rebuilt via `scripts/build_site.py`.
