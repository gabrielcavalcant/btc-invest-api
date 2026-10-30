import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the front-end against the real API.
 * Default target is the Docker stack (docker compose up -d → http://localhost:8080);
 * against the dev server: E2E_BASE_URL=http://localhost:5173 npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // Sign-up and login hash the password with bcrypt, which is slow on purpose (and slower
  // still in Docker Desktop): each check waits up to 15 s instead of the default 5 s
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  // One test at a time: the flows share the login rate limit and a slow machine stays stable
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
