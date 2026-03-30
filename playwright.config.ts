import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PWA offline testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: 'html',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:8080',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on first retry */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Service Workers
        serviceWorkers: 'allow',
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Enable Service Workers
        serviceWorkers: 'allow',
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // Enable Service Workers
        serviceWorkers: 'allow',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx serve -s www -l 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
