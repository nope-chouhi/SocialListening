import { test, expect } from '@playwright/test';

/**
 * DEV_ONLY_setup_check.spec.ts
 *
 * This is a temporary setup verification test used solely to check if Playwright browser
 * contexts launch and assert correctly in the current local environment.
 * It is not a production test for the Nope Social Listening Platform.
 */
test('DEV_ONLY: verify playwright browser launch and external page title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});
