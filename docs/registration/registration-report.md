# Layer registration check — rivers as the control

**Question:** does the major river (Niger–Benue) on the basemap coincide with the river drawn on the
geology picture (2011 map scan) and the mineral picture (2023 map scan)? Are features from different
layers that look co-located on screen really co-located on the ground, or can two things appear in the
same place while being kilometres apart?

**Answer:** the two map pictures were already correctly registered (≤ 1 km at the control points), but
the **minerals vector layers (occurrences, unresolved symbols, zone division lines) sat a constant
3.2 km north of their own symbols on the 2023 picture** — exactly the "two layers close on screen but
far apart in reality" failure. They have been shifted back onto their symbols and the site rebuilt.

## Method

Ground truth for the basemap river is the Natural Earth 1:10 m river centre-lines (the same public
domain data family the key basemaps generalise from) plus Natural Earth populated places and lakes
for spot controls (Lokoja, Idah, Makurdi, Kainji Reservoir). The river drawn on each picture was
extracted as thin blue line-work and matched against that reference; the sheets' printed 1°/2°
graticules were detected independently as a second control; mineral symbols were extracted as
coloured blobs and matched against the digitised points.

## Findings

### Geology picture (`geology_map2011_img`) — correct, unchanged

| control | result |
|---|---|
| printed graticule under current bounds | verticals at 3.000, 4.000, 5.000 … 14.000 (± 0.005°) |
| river at Lokoja confluence vs basemap | 0.85 km E, 0.21 km S |
| river at Niger delta apex vs basemap | < 0.05 km |
| Kainji Reservoir outline vs basemap | coincides (visual overlay) |

The sheet's content, its graticule and the real world agree — registration is good to a few hundred
metres. The geology vector layers (unit boundaries) were digitised on the same picture and trace its
drawn boundaries exactly, so the whole geology family is consistent.

### Mineral picture (`minerals_map2023_img`) — correct, unchanged

The 2023 sheet has a printing fault: its **content is drawn 0.176° of longitude east of its own
printed graticule** (graticule lines read integer + 0.176 under the current bounds). The registration
already compensates with a +0.175° longitude shift (as its catalog description notes), and the
content-based controls confirm that compensation is right:

| control | result |
|---|---|
| river at Lokoja confluence vs basemap | 0.11 km W, 0.22 km S |
| river at Niger delta apex vs basemap | < 0.05 km |
| Kainji Reservoir outline vs basemap | coincides (visual overlay) |

Local river differences of up to 3–4 km along the middle Niger (Baro–Lokoja meanders) are the paper
map's own river generalisation, not registration error — the same check on the (detailed) 2011 sheet
gives sub-km residuals there.

### Mineral vectors vs the mineral picture — **were misregistered, now fixed**

Every digitised feature sat a constant **6.3 px = 0.0288° ≈ 3.2 km north** and 0.2 px east of the
symbol or line drawn on the picture:

* 136/136 yellow square symbols matched to their nearest occurrence point: symbols 3.20 km S of points
  (west/east split 3.37 / 2.70 km — constant, not scale);
* the zone division lines: the digitised horizontal divider at lat 8.029 vs the drawn divider at
  8.000 — the same 6.4 px;
* 63 unresolved symbols digitised in the same session shared the offset.

The picture is right (river + lake controls), so the vectors were wrong: a mineral occurrence was
displayed ~3 km away from where it lies on its own source map, i.e. over the wrong geology unit.

**Fix applied** (2026-11-06): shift all three layers by `dlon +0.0010°, dlat −0.0288°` in
`data/minerals_occurrences_map2023_pt.gpkg`, `data/minerals_unresolved_symbols_map2023_pt.gpkg`,
`data/minerals_division_lines_map2023_ln.gpkg`, then rebuild `public/`.

After the fix: symbol-minus-point offset 0.00 km E / 0.20 km N (residual = click noise, σ ≈ 1–2 px),
division lines land on the drawn dividers (rows/cols match to 0.2 px).

## Evidence images

* `river_composite.png` — red: basemap reference river; green: river extracted from the geology
  picture; blue: river extracted from the mineral picture. The Niger and Benue coincide through
  their whole course; divergences are ≤ 3 km and only along heavily meandering stretches.
* `before_fix.png` / `after_fix.png` — mineral occurrence points (green crosses) on the 2023 picture
  around Abakaliki before and after the fix: before, crosses hang above their symbols; after they sit
  on them.

## Cross-layer consistency after the fix

All three families — geology 2011 (picture + vectors), minerals 2023 (picture + occurrence points +
unresolved symbols + division lines) and the basemap — place the same ground feature within ~1–2 km,
which is the drawing precision of the two paper maps. Cross-layer co-location on screen (a mineral
occurrence "on" a geology contact, a locality beside the river) is now real co-location.
