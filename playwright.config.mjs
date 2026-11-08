import { defineConfig } from '@playwright/test';
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// The npm package contains both Chromium and its Amazon Linux runtime libraries. Using
// those libraries on every CI host avoids a separate Playwright CDN or apt download.
await inflate(resolve(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'));
chromium.setGraphicsMode = false; // the map uses Canvas 2D, not WebGL

// Do not let host font substitution decide snapshot layout. This config is test-only;
// production keeps its normal system font stack.
const fontDirectory = resolve(root, 'node_modules/dejavu-fonts-ttf/ttf');
const fontConfigDirectory = join(tmpdir(), 'ngmap-playwright-fontconfig');
mkdirSync(join(fontConfigDirectory, 'cache'), { recursive: true });
const fontConfig = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDirectory}</dir>
  <cachedir>${join(fontConfigDirectory, 'cache')}</cachedir>
  <alias><family>system-ui</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>-apple-system</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>Segoe UI</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>Roboto</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>monospace</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
</fontconfig>
`;
writeFileSync(join(fontConfigDirectory, 'fonts.conf'), fontConfig);
process.env.FONTCONFIG_PATH = fontConfigDirectory;
process.env.FONTCONFIG_FILE = join(fontConfigDirectory, 'fonts.conf');

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 12_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.001,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'allow',
    launchOptions: {
      executablePath: await chromium.executablePath(),
      // Lambda's single-process/no-zygote flags suppress dedicated workers on desktop.
      args: [
        ...chromium.args.filter((arg) => arg !== '--single-process' && arg !== '--no-zygote'),
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
      headless: true,
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/browser/server.mjs --port 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
});
