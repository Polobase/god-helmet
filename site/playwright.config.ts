import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the built site (npm run build), served the way
// Cloudflare Pages serves it. The app is exercised in Demo mode: no helmet.
// PW_CHROMIUM may point at an already installed Chromium to skip the download.
// E2E_BASE_URL runs the tests against a server that is already up (e.g. `npm run dev`).
const port = 43117
const external = process.env.E2E_BASE_URL
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: external
    ? undefined
    : {
        command: `node scripts/serve.mjs ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
      },
})
