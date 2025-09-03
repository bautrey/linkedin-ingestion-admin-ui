const { test, expect } = require('@playwright/test');

test.describe('Scoring Templates Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Set up console logging
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    });

    test('should show scoring templates on scoring page', async ({ page }) => {
        console.log('🎯 Testing scoring templates functionality...');
        
        // First, let's check if templates are available via API
        const response = await page.request.get('http://localhost:3003/api/templates');
        console.log('Templates API response status:', response.status());
        
        if (response.ok()) {
            const templates = await response.json();
            console.log('Templates from API:', JSON.stringify(templates, null, 2));
        }
        
        // Navigate to the scoring page with a profile ID
        const profileId = '5ce5de74-33af-4e55-a9d9-1de8593c5103';
        console.log(`📍 Navigating to scoring page with profile ID: ${profileId}`);
        
        await page.goto(`http://localhost:3003/scoring?profile_id=${profileId}`);
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Take a screenshot to see what's happening
        await page.screenshot({ path: 'scoring-page.png', fullPage: true });
        console.log('📸 Screenshot taken: scoring-page.png');
        
        // Check if we're on an error page
        const isErrorPage = await page.locator('h1:has-text("Error")').isVisible();
        if (isErrorPage) {
            const errorMessage = await page.locator('p.fs-5.text-muted').textContent();
            console.log('❌ Error page detected:', errorMessage);
        }
        
        // Check page title
        const title = await page.title();
        console.log('📄 Page title:', title);
        
        // Look for template selection section
        const templateLabel = page.locator('label:has-text("Select Scoring Template")');
        const isTemplateSection = await templateLabel.isVisible();
        console.log('🎯 Template selection section visible:', isTemplateSection);
        
        if (isTemplateSection) {
            // Check for "No scoring templates available" message
            const noTemplatesAlert = page.locator('.alert-warning:has-text("No scoring templates available")');
            const hasNoTemplatesMessage = await noTemplatesAlert.isVisible();
            console.log('⚠️  "No templates" message visible:', hasNoTemplatesMessage);
            
            // Look for actual template radio buttons
            const templateRadios = page.locator('input[type="radio"][name="template_id"]');
            const templateCount = await templateRadios.count();
            console.log('🎯 Number of template radio buttons found:', templateCount);
            
            // Get template names if any
            if (templateCount > 0) {
                for (let i = 0; i < templateCount; i++) {
                    const radio = templateRadios.nth(i);
                    const label = page.locator(`label[for="${await radio.getAttribute('id')}"]`);
                    const templateName = await label.textContent();
                    console.log(`🎯 Template ${i + 1}:`, templateName?.trim());
                }
            }
        }
        
        // Check browser network requests
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('templates')) {
                requests.push({
                    url: request.url(),
                    method: request.method()
                });
            }
        });
        
        // Reload to capture requests
        console.log('🔄 Reloading page to capture network requests...');
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        console.log('🌐 Template-related requests:', requests);
        
        // Check for JavaScript errors
        let jsErrors = [];
        page.on('pageerror', error => {
            jsErrors.push(error.message);
        });
        
        if (jsErrors.length > 0) {
            console.log('💥 JavaScript errors:', jsErrors);
        }
    });
});
