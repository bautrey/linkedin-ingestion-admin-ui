const { test, expect } = require('@playwright/test');

test.describe('Visual Profile Sorting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the profiles page
    await page.goto('http://localhost:3003/profiles');
    await page.waitForLoadState('networkidle');
  });

  test('should actually reorder names when sorting by name column', async ({ page }) => {
    // Get the initial order of names
    const initialNames = await page.locator('tbody tr td:nth-child(2) .fw-medium a').allTextContents();
    console.log('Initial names order:', initialNames);
    
    // Click on the name header to sort
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    // Get the new order of names after sorting
    const sortedNames = await page.locator('tbody tr td:nth-child(2) .fw-medium a').allTextContents();
    console.log('Names after sort click:', sortedNames);
    
    // Verify that the order actually changed (unless it was already sorted)
    // At minimum, the names should be in alphabetical order now
    const expectedSorted = [...sortedNames].sort();
    console.log('Expected alphabetical order:', expectedSorted);
    
    expect(sortedNames).toEqual(expectedSorted);
  });

  test('should actually reorder when toggling sort direction', async ({ page }) => {
    // Click name header once (ascending)
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    const ascendingNames = await page.locator('tbody tr td:nth-child(2) .fw-medium a').allTextContents();
    console.log('Ascending order:', ascendingNames);
    
    // Click name header again (descending)
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    const descendingNames = await page.locator('tbody tr td:nth-child(2) .fw-medium a').allTextContents();
    console.log('Descending order:', descendingNames);
    
    // Verify that descending is the reverse of ascending
    expect(descendingNames).toEqual(ascendingNames.reverse());
  });

  test('should show actual visual changes in sort icons', async ({ page }) => {
    const nameHeader = page.locator('th.sortable[data-sort="name"]');
    const sortIcon = nameHeader.locator('i.sort-icon');
    
    // Get initial icon class
    const initialIconClass = await sortIcon.getAttribute('class');
    console.log('Initial icon class:', initialIconClass);
    
    // Click to sort
    await nameHeader.click();
    await page.waitForLoadState('networkidle');
    
    // Get icon class after sorting
    const afterSortIconClass = await sortIcon.getAttribute('class');
    console.log('Icon class after sort:', afterSortIconClass);
    
    // Icon should change to indicate sorting direction
    expect(afterSortIconClass).not.toEqual(initialIconClass);
  });
});
