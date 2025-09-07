const { test, expect } = require('@playwright/test');

test.describe('Scoring Functionality Tests', () => {
    test('should load templates in score profile modal', async ({ page }) => {
        console.log('🎯 Testing profile scoring modal with templates...');
        
        // Navigate to a profile detail page
        await page.goto('/profiles/3d644180-9ae4-4f42-90e3-69d2da27c108');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Click the "Score Profile" button to open modal
        await page.click('button:has-text("Score Profile")');
        
        // Wait for modal to appear
        await page.waitForSelector('#scoreModal');
        
        // Wait a bit for AJAX to load templates
        await page.waitForTimeout(2000);
        
        // Check if templates are loaded in the dropdown
        const templateOptions = await page.locator('#templateSelect option').count();
        console.log(`📋 Found ${templateOptions} template options (including default)`);
        
        // Should have at least the default option plus loaded templates
        expect(templateOptions).toBeGreaterThan(1);
        
        // Check for specific templates
        const ciоTemplate = await page.locator('#templateSelect option:has-text("Enhanced CIO")').count();
        const ctoTemplate = await page.locator('#templateSelect option:has-text("Enhanced CTO")').count();
        const cisoTemplate = await page.locator('#templateSelect option:has-text("Enhanced CISO")').count();
        
        console.log(`✅ Templates loaded: CIO=${ciоTemplate}, CTO=${ctoTemplate}, CISO=${cisoTemplate}`);
        
        expect(ciоTemplate + ctoTemplate + cisoTemplate).toBeGreaterThanOrEqual(2);
        
        console.log('✅ Profile scoring modal templates test passed!');
    });
    
    test('should be able to start scoring with template selection', async ({ page }) => {
        console.log('🚀 Testing scoring submission...');
        
        // Navigate to profile detail page
        await page.goto('/profiles/3d644180-9ae4-4f42-90e3-69d2da27c108');
        await page.waitForLoadState('networkidle');
        
        // Open scoring modal
        await page.click('button:has-text("Score Profile")');
        await page.waitForSelector('#scoreModal');
        
        // Wait for templates to load
        await page.waitForTimeout(2000);
        
        // Select a template
        await page.selectOption('#templateSelect', { index: 1 }); // Select first non-default option
        
        // Mock the fetch call to avoid actually starting scoring
        await page.route('/api/profiles/*/score', route => {
            route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        job_id: 'test-job-123',
                        status: 'pending',
                        profile_id: '3d644180-9ae4-4f42-90e3-69d2da27c108'
                    }
                })
            });
        });
        
        // Click submit scoring button
        await page.click('button:has-text("Score Profile")');
        
        // The modal should close if successful
        await page.waitForSelector('#scoreModal', { state: 'hidden', timeout: 5000 });
        
        console.log('✅ Scoring submission test passed!');
    });
    
    test('should display profiles correctly in bulk scoring', async ({ page }) => {
        console.log('📊 Testing bulk scoring profile display...');
        
        // Navigate to bulk scoring page
        await page.goto('/scoring?profile_ids=3d644180-9ae4-4f42-90e3-69d2da27c108');
        await page.waitForLoadState('networkidle');
        
        // Check page title
        const title = await page.textContent('h2');
        expect(title).toContain('Score Profile:');
        
        // Check if profile is displayed
        const profileName = await page.textContent('.list-group-item .fw-medium');
        console.log(`👤 Profile displayed: ${profileName}`);
        expect(profileName).toBeTruthy();
        
        // Check if templates are loaded
        const templateRadios = await page.locator('input[name="template_id"]').count();
        console.log(`📋 Found ${templateRadios} template radio buttons`);
        expect(templateRadios).toBeGreaterThan(1); // Should have templates + custom option
        
        console.log('✅ Bulk scoring profile display test passed!');
    });
});

module.exports = test;
