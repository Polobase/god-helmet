import { defineConfig } from 'vitest/config'

// Unit tests only; the end-to-end tests in e2e/ are run by Playwright.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
