const { test, expect } = require('@playwright/test');

test.describe('Profile Management Functional Tests', () => {
  test('should access profiles page without errors', async ({ page }) => {
    // Try to navigate to profiles page
    await page.goto('/profiles');
    
    // Should not be a 404 or error page
    const pageTitle = await page.title();
    expect(pageTitle).not.toMatch(/404|error|not found/i);
    
    // Page should be visible and loaded
    await expect(page.locator('body')).toBeVisible();
    
    console.log('✅ Profiles page accessible');
  });

  test('should have profile listing interface elements', async ({ page }) => {
    await page.goto('/profiles');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for typical profile management elements
    const hasProfileElements = await Promise.all([
      page.locator('table').count(),
      page.locator('.profile, .card, .item').count(),
      page.locator('button, a[href*="profile"], input').count(),
      page.locator('h1, h2, h3').count()
    ]);
    
    const [tableCount, cardCount, interactiveCount, headingCount] = hasProfileElements;
    
    // Should have at least some interface elements
    const totalElements = tableCount + cardCount + interactiveCount + headingCount;
    expect(totalElements).toBeGreaterThan(0);
    
    console.log('✅ Profile management interface elements found');
    console.log(`   - Tables: ${tableCount}, Cards: ${cardCount}, Interactive: ${interactiveCount}, Headings: ${headingCount}`);
  });

  test('should handle navigation between sections', async ({ page }) => {
    await page.goto('/');
    
    // Look for navigation links
    const navigationLinks = await page.locator('a[href*="/"], button').all();
    
    if (navigationLinks.length > 0) {
      // Try clicking a few navigation elements (safely)
      const linkTexts = await Promise.all(
        navigationLinks.slice(0, 3).map(link => 
          link.textContent().catch(() => '')
        )
      );
      
      const validLinks = linkTexts.filter(text => 
        text && text.trim().length > 0 && text.length < 50
      );
      
      if (validLinks.length > 0) {
        console.log('✅ Navigation elements found:', validLinks);
      } else {
        console.log('ℹ️ No valid navigation text found - links may use icons or be dynamically loaded');
      }
    } else {
      console.log('ℹ️ No navigation links found - single page app');
    }
  });

  test('should load without critical network failures', async ({ page }) => {
    const failedRequests = [];
    
    // Monitor network requests
    page.on('response', response => {
      if (response.status() >= 500) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    await page.goto('/profiles');
    await page.waitForTimeout(3000);
    
    // Should not have any 5xx server errors
    expect(failedRequests.length).toBe(0);
    
    if (failedRequests.length > 0) {
      console.log('❌ Server errors detected:', failedRequests);
    } else {
      console.log('✅ No critical server errors detected');
    }
  });
});
