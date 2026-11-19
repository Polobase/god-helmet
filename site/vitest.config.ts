import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests only; the end-to-end tests in e2e/ are run by Playwright.
// The .js tests cover the shared core (core/); two of them wait several
// seconds for a simulated helmet, hence the timeout.
export default defineConfig({
  resolve: { alias: { '#core': fileURLToPath(new URL('./core', import.meta.url)) } },
  test: { include: ['test/**/*.test.{ts,js}'], testTimeout: 30_000 },
})
