# Browser, offline and visual-regression tests

The repository has a development-only [Playwright](https://playwright.dev/) suite for the **built static site** in
`public/`. The production application and geospatial export remain dependency-free: `package.json` is not part of the
published runtime.

## Run locally

Requirements:

- Node.js **22.17 or newer**;
- the committed `public/` build (run `python scripts/build_site.py` first only when application/build inputs change);
- no installed Chrome, Playwright browser download, system packages, API key or external tile service.

```bash
npm ci
npm run test:browser
```

Useful focused runs:

```bash
npx playwright test tests/browser/loading.spec.mjs
npx playwright test tests/browser/offline.spec.mjs
npx playwright test tests/browser/update.spec.mjs
npm run test:browser -- --grep visual
```

The six tests run serially against a temporary Node static server on `127.0.0.1:4173`. The server is stopped by
Playwright after the run. `test-results/`, `playwright-report/` and `node_modules/` are ignored by Git. Failure traces,
screenshots and the HTML report are available locally, and CI uploads failure artifacts for seven days.

## Reproducible browser and network setup

`playwright.config.mjs` pins Chromium through `@sparticuz/chromium`; `package-lock.json` pins the complete npm
installation. Chromium and its runtime libraries come from the npm registry, so **do not run** `npx playwright install`.
The serverless-only single-process flags are removed because the tests exercise real dedicated module workers.

A pinned DejaVu fontconfig is generated in the temporary directory for every run. Fixed fonts, viewport, device scale,
locale, timezone, colour scheme and disabled animation prevent host-specific screenshot layout. Tests use one worker to
avoid contention for Chromium and the test server's deployment-update control.

All third-party browser requests are intercepted. Known tile hosts receive a fixed transparent one-pixel PNG (no error
toast or external request), any other third-party request fails the test, and Chromium DNS resolution is disabled for
non-local hosts. The map is started with `#l=&b=none`; the transparent response also covers the engine's constructor-time
requests before that hash is applied.

## What is covered

- **Real browser/vector path** — turn on the national boundary through the actual Layers UI, fetch and decompress its
  `.geojson.gz` in a dedicated module worker, verify converted geometry and the single-colour legend, and assert that
  the uncompressed main-thread fallback was not requested. The data URL must be application-root anchored, not resolved
  relative to `/js/vector-worker.js`.
- **Desktop Quality UI** — overview counts, WPDx review evidence, metadata gaps, safe source/download links, the complete
  register entry point, IGRAC complete metadata, and returning to the overview.
- **Mobile light/dark UI** — 390 × 844 layout, no horizontal overflow, evidence selection, dark colours and readable
  review status.
- **Offline reload** — install the real service worker, verify shell entries, load compressed vector data and the full
  register online, switch Chromium itself offline, reload, restore the 59-layer catalog and vector layer, and fetch all
  98 register rows. The register bytes are hashed with Web Crypto and compared with the UI. Server request accounting
  proves that navigation, catalog, vector and register requests did not reach the network while offline. The install
  explicitly pre-caches `catalog.json` in the **data** cache because the first page's catalog request precedes worker
  control.
- **Deployment update** — the test-only server serves a changed worker `BUILD`, just as a deployment would. The test
  proves that first installation does not reload, a subsequent update activates and reloads a controlled page exactly
  once, the worker reports the new build, and old shell/data caches are removed. Production files are not mutated.

The offline test uses Playwright's `context.setOffline(true)`, not a mocked fetch or DOM emulator. The update test drives
`registration.update()` and the application's real `controllerchange` handling.

## Visual baselines

Four reviewed PNG baselines are committed under `tests/browser/__snapshots__/`:

- `quality.spec.mjs/quality-overview-desktop.png`
- `quality.spec.mjs/quality-review-desktop.png`
- `mobile.spec.mjs/quality-overview-mobile.png`
- `mobile.spec.mjs/quality-review-mobile-dark.png`

They capture the Quality sheet at 1280 × 900 desktop and 390 × 844 mobile sizes, with 1× device scale. Comparisons allow
at most 0.1% differing pixels; no baseline is regenerated automatically during a normal test or CI run.

After an **intentional** UI change:

```bash
npm run test:browser:update -- --grep visual
# Inspect all four PNGs and the test diff, then rerun without update mode:
npm run test:browser
```

Commit the reviewed PNG changes with the corresponding UI change. Do not update snapshots to conceal an unexpected
layout, content, colour or overflow regression. For a non-visual failure, inspect `test-results/**/trace.zip` with
`npx playwright show-trace <path>` or open the generated HTML report.
