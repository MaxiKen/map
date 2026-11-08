# Maintenance and releases

This project publishes a generated static site from versioned geospatial sources and evidence. Routine
maintenance should change sources first, rebuild once, run every gate, and commit the source and generated
changes together. Do not hand-edit `public/`.

## Prerequisites

- Python 3.11 with `scripts/requirements.txt`; the project environment is `.venv/bin/python` in the
  development workspace.
- Node.js 22.22.3 and npm for the locked browser toolchain. These are development-only dependencies;
  the published site needs no Node runtime.
- The browser prerequisites and visual-review procedure in [browser-testing.md](browser-testing.md).

## One verification command

From the repository root:

```bash
# Read-only source/public verification plus clean npm install and all browser tests.
.venv/bin/python scripts/maintain.py

# Rebuild public/, then run every gate.
.venv/bin/python scripts/maintain.py --build

# Release-candidate gate: rebuild, independently prove reproducibility, then run every gate.
.venv/bin/python scripts/maintain.py --build --check-build
```

The command runs Python compilation, GeoPackage/source/public/gzip/register validation, the complete
Python and Node regression suite, `npm ci`, and real-Chromium interaction/offline/update/visual tests.
`--check-build` writes only to a temporary directory and compares every file with `public/` byte-for-byte.
A failure reports missing, unexpected, and different files.

`--skip-browser` is available for a limited geospatial-only check, but **is not sufficient for a build
commit or release**. With `python` from the virtual environment on `PATH`, the npm conveniences are
`npm run verify` and `npm run verify:build`.

## Reproducible public builds

The ten-character build identifier hashes the semantic catalog and application shell; it does not hash
the wall-clock timestamp. An unchanged rebuild preserves the existing catalog timestamp and produces no
diff. A source or application change gets a new identifier and a current UTC timestamp.

For a prescribed timestamp, set the standard `SOURCE_DATE_EPOCH` to non-negative Unix seconds before
running `scripts/build_site.py`. `scripts/check_build.py` automatically uses the committed catalog's
timestamp, so a temporary rebuild is deterministic without changing the working tree. Generated files,
original GeoJSON, gzip sidecars, quality evidence, application URLs, and service-worker cache identity
are all checked together.

### Routine update sequence

1. Start from a clean, up-to-date worktree. Update source data, `app/`, configuration, or audited evidence;
   never regenerate an audit concurrently with a build.
2. Run the relevant default/read-only historical verifiers after data corrections. Do not reapply a
   completed correction ledger.
3. Run `.venv/bin/python scripts/maintain.py --build --check-build` for a complete change, or without
   `--build` when only verification is needed.
4. Review `git diff`, including `public/catalog.json`, build URLs, evidence hashes, and intentional gzip
   changes. Preserve generated evidence CSV line endings.
5. Review every visual snapshot change according to `docs/browser-testing.md`; never update snapshots just
   to make an unexplained difference pass.
6. Commit source, evidence, generated public output, and tests together. The main-branch build workflow
   repeats the full gate and pushes a generated commit only if `public/` actually changed. Its concurrency
   group prevents overlapping auto-build commits.

## Changelog and versioning

Add user-visible changes to `CHANGELOG.md` under **Unreleased** as part of their normal pull request.
Releases use stable semantic versions `X.Y.Z`; the preparation and packaging commands intentionally reject
prerelease and malformed version strings. There is no automatic cadence or version selection.

The `package.json` version is release metadata only. It does not add a production npm dependency or change
Netlify's static publish configuration.

## Prepare, tag, and publish a release

1. Ensure the intended work is merged and main is green. In a normal release pull request, run:

   ```bash
   .venv/bin/python scripts/prepare_release.py X.Y.Z
   ```

   This moves the Unreleased notes into a dated section and aligns `package.json` and `package-lock.json`.
   It refuses empty notes, duplicate versions, and invalid versions/dates. It does not commit, tag, or
   publish. Use `--date YYYY-MM-DD` only when an explicit UTC release date is required.

2. Review the notes and run the release-candidate gate:

   ```bash
   .venv/bin/python scripts/maintain.py --build --check-build
   ```

   Commit and merge the preparation normally. Do not tag an unmerged release-preparation commit.

3. Tag the full resulting main commit and push only that tag:

   ```bash
   git fetch origin main
   git rev-parse origin/main       # review this full commit ID
   git tag -a vX.Y.Z <full-main-commit-id> -m "Nigeria WebGIS vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. The **Validate and release static site** workflow calls the exact reusable validation workflow, checks
   that the tagged commit is contained in `origin/main`, builds deterministic assets, and creates the
   GitHub Release. A tag/version/changelog/package mismatch fails before publication. The release body and
   manifest include the full source commit and public build identifier.

Each release contains:

- `ngmap-vX.Y.Z-<build>.zip`: the complete static site plus `release.json`;
- `ngmap-vX.Y.Z-<build>.sha256`: the ZIP's SHA-256 checksum;
- `ngmap-vX.Y.Z-<build>-manifest.json`: release/build/commit metadata, layer/feature counts, quality
  register hash, and the size and SHA-256 of every published file;
- release notes taken from the matching changelog section.

The archive is also checked for CRC errors. To exercise packaging locally after preparing a version:

```bash
.venv/bin/python scripts/package_release.py vX.Y.Z
cd dist && sha256sum -c ./*.sha256
```

`dist/` is ignored. Serve an extracted archive over HTTP(S), not `file://`; it can be hosted by any static
web server. As with the deployed application, offline reload requires the service worker's first successful
visit/cache installation.

## Deployment and recovery

Netlify still publishes committed `public/` from main independently of GitHub Releases. A GitHub Release
provides a reviewed, immutable source/data snapshot; it does not trigger a second deployment or require a
hard refresh, cache clearing, or service-worker script.

If the reproducibility gate fails, rebuild locally, inspect the named differing files, rerun the full gate,
and commit the intentional generated output. If a tag workflow fails, do not silently move a published tag
or replace verified assets: fix forward through main and use a new release version. Netlify rollbacks and
source recovery remain separate from release packaging.
