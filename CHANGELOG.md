# Changelog

Nigeria WebGIS uses [semantic versioning](https://semver.org/). Each released version has a matching
`vX.Y.Z` tag, a reproducible public build identifier, and a static-site release archive. Changes are
collected under **Unreleased** until `scripts/prepare_release.py` assigns a version and UTC date.

## [Unreleased]

### Fixed

- Restrict mutable source-fetch workflows to main-branch pushes or manual dispatch so release tags and
  pull-request branch pushes never fetch and commit replacement data.
- Correct the EMAG2 future-fetch mask's height/width order, exercise the failed non-square grid, and make the
  seven-layer geology refresh manual-only. The 98% coverage guard still refuses unreviewed partial data.

### Removed

- All application GeoJSON acquisition controls: expanded-layer and Quality-panel links, single-feature JSON export,
  and visible-layer GeoJSON export. Rendering/fallback artifacts, source provenance, user-owned GeoJSON import,
  CSV/PNG export and the non-geometric quality-register download remain intact.

## [1.0.0] - 2026-11-08

### Added

- Stable `ngmap-admin-v1` identifiers and parent joins for states, LGAs and wards, with a conservative
  external INEC crosswalk and complete unresolved-link provenance.
- The `ngmap-cross-border-v1` policy covering all 98 source layers, including explicit transboundary,
  regional-reference, marine, raster-window and Nigeria-only aggregation rules.
- The `ngmap-layer-quality-v1` JSON/CSV/Markdown register and an interactive Quality & source UI with
  measured checks, source metadata, limitations, licence evidence, hashes and metadata gaps; no numeric
  quality score or invented missing metadata.
- Deterministic gzip transport sidecars, bounded layer loading, module-worker parsing/conversion and a
  compatible yielding fallback. Original GeoJSON downloads remain available.
- Real-Chromium interaction, gzip-worker, offline-reload, service-worker update and desktop/mobile visual
  regression tests with no external tile dependency.
- One-command maintenance verification, byte-reproducible public-build checks, release preparation and
  deterministic static-site ZIP/manifest/checksum packaging.

### Changed

- Reviewed state-capital positions, polygon topology, ward/LGA attributes and hidden-source artifacts now
  carry guarded ledgers, before/after hashes, stable provenance and read-only verification.
- EMAG2 magnetic coverage is explicitly presented as partial rather than implying continuous national
  coverage. Raster values and source geometry were not interpolated or silently repaired.
- Public exports and the service-worker shell are versioned together. Network-first catalog/register/data
  responses use their last good cached copy offline, and controlled updates reload once without a hard
  refresh or manual cache clearing.
- CI validates source/public artifacts, Python and Node regressions, real Chromium behavior and visual
  baselines. The same validation workflow is reusable by tag releases.

### Fixed

- Worker vector requests use application-root data URLs rather than resolving below `/js/`.
- First-visit service-worker installation caches the catalog for offline reload, and a subsequent update
  in that visit is no longer suppressed by the initial controller state.
- Source links are restricted to HTTP(S), quality content is escaped, and unclassified vector styling uses
  an explicit neutral fallback instead of failing in the legend.
