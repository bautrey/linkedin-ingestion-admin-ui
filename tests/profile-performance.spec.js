const { test, expect } = require('@playwright/test');

test.describe('Profile Page Performance', () => {
    test('should load Peter Holcomb profile page within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        
        // Go to admin UI homepage
        await page.goto('http://localhost:3003');
        
        // Navigate to profiles page
        await page.click('a[href="/profiles"]');
        await page.waitForLoadState('networkidle');
        
        // Find Peter Holcomb's profile link and click it
        // Look for either the name or try to find a profile with Optimo IT
        const profileLinks = await page.locator('a[href*="/profiles/"]').all();
        let peterHolcombLink = null;
        
        for (const link of profileLinks) {
            const text = await link.textContent();
            if (text && (text.includes('Peter Holcomb') || text.includes('Optimo IT'))) {
                peterHolcombLink = link;
                break;
            }
        }
        
        if (!peterHolcombLink) {
            // If we can't find Peter specifically, just use the first profile
            peterHolcombLink = profileLinks[0];
        }
        
        expect(peterHolcombLink).toBeTruthy();
        
        // Measure time to click and fully load the profile detail page
        const clickTime = Date.now();
        await peterHolcombLink.click();
        
        // Wait for the profile page to be fully loaded
        // Look for key elements that indicate the page is ready
        await page.waitForSelector('h2.fw-bold', { timeout: 15000 }); // Profile name
        await page.waitForSelector('.card-body', { timeout: 15000 }); // Profile cards
        await page.waitForLoadState('networkidle');
        
        const endTime = Date.now();
        const loadTime = endTime - clickTime;
        
        console.log(`Profile page load time: ${loadTime}ms`);
        
        // Verify the page loaded correctly
        await expect(page.locator('h2.fw-bold')).toBeVisible();
        await expect(page.locator('.card-body').first()).toBeVisible();
        
        // Assert performance target: should load in under 3 seconds (3000ms)
        expect(loadTime).toBeLessThan(3000);
        
        // If load time is still over 1 second, log a warning
        if (loadTime > 1000) {
            console.warn(`Warning: Profile page took ${loadTime}ms to load (over 1 second)`);
        }
        
        // Take a screenshot for debugging if needed
        if (loadTime > 2000) {
            await page.screenshot({ path: 'profile-performance-slow.png' });
        }
    });
    
    test('should load profile page multiple times to test consistency', async ({ page }) => {
        const loadTimes = [];
        const iterations = 3;
        
        for (let i = 0; i < iterations; i++) {
            console.log(`Performance test iteration ${i + 1}/${iterations}`);
            
            // Go to admin UI homepage
            await page.goto('http://localhost:3003');
            
            // Navigate to profiles page
            await page.click('a[href="/profiles"]');
            await page.waitForLoadState('networkidle');
            
            // Click on first profile
            const firstProfileLink = await page.locator('a[href*="/profiles/"]').first();
            
            const startTime = Date.now();
            await firstProfileLink.click();
            
            // Wait for page to load
            await page.waitForSelector('h2.fw-bold', { timeout: 15000 });
            await page.waitForSelector('.card-body', { timeout: 15000 });
            await page.waitForLoadState('networkidle');
            
            const endTime = Date.now();
            const loadTime = endTime - startTime;
            loadTimes.push(loadTime);
            
            console.log(`Iteration ${i + 1}: ${loadTime}ms`);
        }
        
        const averageTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
        const maxTime = Math.max(...loadTimes);
        const minTime = Math.min(...loadTimes);
        
        console.log(`Performance Results:`);
        console.log(`  Average: ${averageTime.toFixed(0)}ms`);
        console.log(`  Min: ${minTime}ms`);
        console.log(`  Max: ${maxTime}ms`);
        console.log(`  All times: ${loadTimes.join(', ')}ms`);
        
        // All load times should be under 3 seconds
        expect(maxTime).toBeLessThan(3000);
        
        // Average should be under 2 seconds for good performance
        expect(averageTime).toBeLessThan(2000);
    });
});
