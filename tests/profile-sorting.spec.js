const { test, expect } = require('@playwright/test');

test.describe('Profile Sorting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the profiles page
    await page.goto('http://localhost:3003/profiles');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should sort by name when clicking name header', async ({ page }) => {
    // Find the sortable name header
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    
    // Click on the name header to sort
    await nameHeader.click();
    
    // Wait for any network requests to complete
    await page.waitForLoadState('networkidle');
    
    // Check if URL contains sort parameters
    const url = page.url();
    console.log('URL after sort click:', url);
    
    // Should contain sort_by=name in the URL
    expect(url).toMatch(/[?&]sort_by=name/);
  });

  test('should toggle sort order when clicking same header twice', async ({ page }) => {
    // Find the sortable name header
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    
    // First click - should sort ascending
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    let url = page.url();
    console.log('URL after first click:', url);
    
    // Second click - should sort descending
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    url = page.url();
    console.log('URL after second click:', url);
    
    // Should contain sort_order=desc in the URL
    expect(url).toMatch(/[?&]sort_order=desc/);
  });

  test('should sort by company when clicking company header', async ({ page }) => {
    // Find the sortable company header
    const companyHeader = page.locator('th.sortable[data-sort="current_company"]');
    
    // Click on the company header to sort
    await companyHeader.click();
    
    // Wait for any network requests to complete
    await page.waitForLoadState('networkidle');
    
    // Check if URL contains sort parameters
    const url = page.url();
    console.log('URL after company sort click:', url);
    
    // Should contain sort_by=current_company in the URL
    expect(url).toMatch(/[?&]sort_by=current_company/);
  });

  test('should show visual indication of current sort', async ({ page }) => {
    // Find the sortable name header
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    
    // Click on the name header to sort
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    // Check if the sort icon has changed to indicate current sort
    const sortIcon = nameHeader.locator('i.sort-icon');
    
    // Should have some visual indication (class change, icon change, etc.)
    const iconClass = await sortIcon.getAttribute('class');
    console.log('Sort icon class after click:', iconClass);
    
    // The exact class will depend on implementation, but it should change
    expect(iconClass).not.toContain('bi-chevron-expand');
  });
});
