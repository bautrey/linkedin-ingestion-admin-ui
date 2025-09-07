const { test, expect } = require('@playwright/test');

test.describe('Profile Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the profiles page
    await page.goto('http://localhost:3003/profiles');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load profiles page successfully', async ({ page }) => {
    // Check that we're on the profiles page
    await expect(page.locator('h2')).toContainText('Profiles');
    
    // Check that the search form exists
    await expect(page.locator('form')).toBeVisible();
    
    // Check for search input
    await expect(page.locator('input[name="search"]')).toBeVisible();
  });

  test('should perform profile search', async ({ page }) => {
    // Fill in search term
    await page.fill('input[name="search"]', 'Shelly');
    
    // Submit the search form
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForLoadState('networkidle');
    
    // Check URL contains search parameter (case insensitive)
    expect(page.url().toLowerCase()).toContain('search=shelly');
    
    // Check that some result is shown (either profiles or "no results")
    const hasResults = await page.locator('tbody tr').count() > 0;
    const hasEmptyMessage = await page.locator('td[colspan]').isVisible();
    
    expect(hasResults || hasEmptyMessage).toBe(true);
  });

  test('should perform company filter', async ({ page }) => {
    // Check if company filter exists
    const companyFilter = page.locator('select[name="company"], input[name="company"]');
    
    if (await companyFilter.isVisible()) {
      // If it's a select dropdown
      if (await page.locator('select[name="company"]').isVisible()) {
        const options = await page.locator('select[name="company"] option').count();
        if (options > 1) {
          await page.selectOption('select[name="company"]', { index: 1 });
        }
      } else {
        // If it's a text input
        await page.fill('input[name="company"]', 'Microsoft');
      }
      
      // Submit the form
      await page.click('button[type="submit"]');
      
      // Wait for response
      await page.waitForLoadState('networkidle');
      
      // Check URL contains company parameter
      expect(page.url()).toContain('company=');
    } else {
      console.log('Company filter not found on page');
    }
  });

  test('should show search form elements', async ({ page }) => {
    // Log all form elements for debugging
    const forms = await page.locator('form').count();
    console.log(`Found ${forms} form(s) on page`);
    
    // Get all input elements
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} input(s)`);
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`Input ${i}: name="${name}", type="${type}", placeholder="${placeholder}"`);
    }
    
    // Get all select elements
    const selects = page.locator('select');
    const selectCount = await selects.count();
    console.log(`Found ${selectCount} select(s)`);
    
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const name = await select.getAttribute('name');
      console.log(`Select ${i}: name="${name}"`);
    }
    
    // Get all buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} button(s)`);
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const type = await button.getAttribute('type');
      const text = await button.textContent();
      console.log(`Button ${i}: type="${type}", text="${text?.trim()}"`);
    }
  });

  test('should test network requests during search', async ({ page }) => {
    // Listen to network requests
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/profiles')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });
    
    // Perform search
    await page.fill('input[name="search"]', 'engineer');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    console.log('Network requests during search:', JSON.stringify(requests, null, 2));
    
    // Check that a request was made
    expect(requests.length).toBeGreaterThan(0);
  });
});
