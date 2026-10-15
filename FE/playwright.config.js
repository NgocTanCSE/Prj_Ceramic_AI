import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || '3300';
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Playwright config — UI/E2E user-interaction tests for the Ceramic Atelier FE.
 *
 * • Spins up its OWN Vite dev server on a dedicated port (default 3300) so the
 *   suite always runs against live source — independent of any production build
 *   / container that may already be listening on :3000.
 * • WebGL (Three.js Studio 3D) is force-enabled in headless Chromium via the
 *   SwiftShader software rasterizer so the 3D canvas actually renders & can be
 *   interacted with / snapshotted during tests.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js/,
  fullyParallel: false,          // shared dev server + localStorage-sensitive flows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                    // serial: avoid localStorage/cart cross-talk
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Desktop viewport so the persistent left sidebar + right tool panel show.
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          // Force a working WebGL context in headless Chromium (Three.js).
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--enable-webgl',
            '--disable-gpu-sandbox',
          ],
        },
      },
    },
  ],

  webServer: {
    // Dedicated port avoids clashing with a production build on :3000.
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

