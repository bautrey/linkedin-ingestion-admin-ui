const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'unit',
      testMatch: '**/unit/**/*.spec.js',
      use: {
        // For unit tests, we don't need a browser
      },
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
  },
});