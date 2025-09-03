const { test, expect } = require('@playwright/test');

test.describe('Homepage Profiles Tests', () => {
    test('should show profiles on homepage dashboard', async ({ page }) => {
        console.log('🏠 Testing homepage profiles display...');
        
        // Navigate to homepage
        await page.goto('http://localhost:3003/');
        await page.waitForLoadState('networkidle');
        
        // Take screenshot
        await page.screenshot({ path: 'homepage.png', fullPage: true });
        console.log('📸 Screenshot taken: homepage.png');
        
        // Check page title
        const title = await page.title();
        console.log('📄 Page title:', title);
        
        // Look for dashboard statistics
        const statsSection = page.locator('.statistics, .stats, .dashboard-stats');
        const hasStats = await statsSection.isVisible();
        console.log('📊 Stats section visible:', hasStats);
        
        // Look for profile count
        const profileCountElements = page.locator('text=/Profile/i').locator('text=/\\d+/');
        const profileCountVisible = await profileCountElements.count() > 0;
        console.log('🧮 Profile count elements found:', await profileCountElements.count());
        
        if (profileCountVisible) {
            for (let i = 0; i < await profileCountElements.count(); i++) {
                const countText = await profileCountElements.nth(i).textContent();
                console.log(`📊 Profile count ${i + 1}:`, countText);
            }
        }
        
        // Look for recent profiles section
        const recentProfilesSection = page.locator('text=/Recent.*Profile/i').locator('..');
        const hasRecentProfiles = await recentProfilesSection.isVisible();
        console.log('👥 Recent profiles section visible:', hasRecentProfiles);
        
        // Look for individual profile cards/items
        const profileItems = page.locator('.profile-item, .profile-card, .list-group-item').filter({ hasText: /Reid|Satya|Nishant|Richard|Aaryan/i });
        const profileItemCount = await profileItems.count();
        console.log('🧑‍💼 Profile items found:', profileItemCount);
        
        if (profileItemCount > 0) {
            console.log('📋 Profile names found:');
            for (let i = 0; i < Math.min(profileItemCount, 5); i++) {
                const profileText = await profileItems.nth(i).textContent();
                console.log(`  ${i + 1}. ${profileText?.trim().substring(0, 100)}`);
            }
        }
        
        // Look for "No profiles" or empty state messages
        const noProfilesMessage = page.locator('text=/No.*profile/i, text=/empty/i, text=/not.*found/i');
        const hasNoProfilesMessage = await noProfilesMessage.isVisible();
        console.log('❌ "No profiles" message visible:', hasNoProfilesMessage);
        
        if (hasNoProfilesMessage) {
            const messageText = await noProfilesMessage.textContent();
            console.log('📄 No profiles message:', messageText?.trim());
        }
        
        // Check for API errors in the page content
        const apiErrors = page.locator('text=/error/i').filter({ hasText: /api|404|500/i });
        const hasApiErrors = await apiErrors.count() > 0;
        console.log('💥 API error messages found:', await apiErrors.count());
        
        // Look for any error messages
        const errorMessages = page.locator('.alert-danger, .error, .alert-warning');
        const errorCount = await errorMessages.count();
        console.log('⚠️ Error/warning messages found:', errorCount);
        
        if (errorCount > 0) {
            for (let i = 0; i < errorCount; i++) {
                const errorText = await errorMessages.nth(i).textContent();
                console.log(`  Error ${i + 1}:`, errorText?.trim());
            }
        }
    });
});
