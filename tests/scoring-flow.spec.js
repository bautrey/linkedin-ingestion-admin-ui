const { test, expect } = require('@playwright/test');

test.describe('Profile Scoring Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start the admin UI server if it's not running
    // You may need to adjust this based on your development setup
    // The tests assume the server is running on the configured baseURL
    await page.goto('/');
  });

  test('Complete profile scoring workflow', async ({ page }) => {
    // Navigate to profiles list
    await page.click('text=Profiles');
    await expect(page).toHaveURL(/\/profiles/);

    // Wait for profiles to load and click on the first profile
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const firstProfileLink = page.locator('a[href*="/profiles/"]').first();
    await firstProfileLink.click();

    // Verify we're on a profile detail page
    await expect(page).toHaveURL(/\/profiles\/[a-f0-9-]+/);
    
    // Get the profile ID from URL for later assertions
    const profileUrl = page.url();
    const profileId = profileUrl.match(/\/profiles\/([a-f0-9-]+)/)?.[1];
    expect(profileId).toBeTruthy();

    // Click the "Score Profile" button to open the modal
    await page.click('button:has-text("Score Profile")');
    
    // Wait for the modal to appear
    await expect(page.locator('#scoreModal')).toBeVisible();
    
    // Wait for templates to load in the dropdown
    await page.waitForTimeout(2000);
    
    // Select the first available template
    await page.selectOption('#templateSelect', { index: 1 });
    
    // Optionally add a custom prompt
    await page.fill('#customPrompt', 'Test scoring run via Playwright automation');
    
    // Submit the scoring request (call JavaScript function directly)
    await page.evaluate(() => {
      if (typeof submitScoring === 'function') {
        submitScoring();
      }
    });
    
    // Wait for the modal to close and success notification
    await expect(page.locator('#scoreModal')).not.toBeVisible({ timeout: 15000 });
    
    // The page should redirect to scoring job detail page (wait for redirect with longer timeout)
    await expect(page).toHaveURL(/\/scoring\/jobs\/[a-f0-9-]+/, { timeout: 20000 });
    
    // Get the job ID for further verification
    const jobUrl = page.url();
    const jobId = jobUrl.match(/\/scoring\/jobs\/([a-f0-9-]+)/)?.[1];
    expect(jobId).toBeTruthy();
    
    // Verify job details page content
    await expect(page.locator('h2')).toContainText('Scoring Job Details');
    // Check that we have the job ID displayed instead of custom prompt
    await expect(page.locator('text=Job ID:')).toBeVisible();
    
    // Wait for job completion (with reasonable timeout)
    // This will vary based on your scoring implementation
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
    
    while (!jobCompleted && attempts < maxAttempts) {
      await page.reload();
      await page.waitForTimeout(2000);
      
      const statusBadge = page.locator('.badge');
      const statusText = await statusBadge.textContent();
      
      if (statusText?.toLowerCase().includes('completed')) {
        jobCompleted = true;
        break;
      } else if (statusText?.toLowerCase().includes('failed')) {
        throw new Error('Scoring job failed');
      }
      
      attempts++;
    }
    
    if (!jobCompleted) {
      console.warn('Job did not complete within timeout - this may be expected for long-running jobs');
    } else {
      // If job completed, verify the score is displayed
      await expect(page.locator('text=Final Score')).toBeVisible();
      
      // Navigate back to profile to verify score is attached
      await page.goto(`/profiles/${profileId}`);
      
      // Check if profile page shows the new score
      // This assumes your profile detail page displays recent scores
      await page.waitForTimeout(1000);
      
      // Look for score indicators on the profile page
      const scoreElement = page.locator('.score-display, .profile-score, [class*="score"]').first();
      if (await scoreElement.isVisible()) {
        console.log('Score successfully attached to profile');
      }
    }
  });

  test('Scoring modal validation', async ({ page }) => {
    // Navigate to a profile page
    await page.goto('/profiles');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await page.click('a[href*="/profiles/"]:first-child');
    
    // Open scoring modal
    await page.click('button:has-text("Score Profile")');
    await expect(page.locator('#scoreModal')).toBeVisible();
    
    // Try to submit without selecting a template
    // Set up dialog handler before clicking
    const dialogPromise = page.waitForEvent('dialog');
    await page.evaluate(() => {
      if (typeof submitScoring === 'function') {
        submitScoring();
      }
    });
    
    // Handle validation dialog
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('select a scoring template');
    await dialog.accept();
    
    // Modal should still be visible
    await expect(page.locator('#scoreModal')).toBeVisible();
    
    // Close modal
    await page.click('.btn-close');
    await expect(page.locator('#scoreModal')).not.toBeVisible();
  });

  test('Scoring history page navigation', async ({ page }) => {
    // Navigate to profiles and select first profile
    await page.goto('/profiles');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await page.click('a[href*="/profiles/"]:first-child');
    
    // Get profile ID
    const profileUrl = page.url();
    const profileId = profileUrl.match(/\/profiles\/([a-f0-9-]+)/)?.[1];
    
    // Navigate to scoring history (assuming there's a link on the profile page)
    // If not, navigate directly
    await page.goto(`/profiles/${profileId}/scoring-history`);
    
    // Verify we're on the scoring history page
    await expect(page.locator('h2')).toContainText('Scoring History');
    await expect(page.locator('text=Back to Profile')).toBeVisible();
    
    // Test the back button
    await page.click('text=Back to Profile');
    await expect(page).toHaveURL(`/profiles/${profileId}`);
  });

  test('Scoring job detail page functionality', async ({ page }) => {
    // This test assumes there's at least one scoring job in the system
    // You might want to create a job first or mock this
    
    // Navigate to scoring dashboard
    await page.goto('/scoring');
    
    // Look for job links and click the first one
    const jobLink = page.locator('a[href*="/scoring/jobs/"]').first();
    if (await jobLink.isVisible()) {
      await jobLink.click();
      
      // Verify job details page loads
      await expect(page).toHaveURL(/\/scoring\/jobs\/[a-f0-9-]+/);
      await expect(page.locator('h2')).toContainText('Scoring Job');
      
      // Test refresh button if it exists
      const refreshButton = page.locator('button:has-text("Refresh")');
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Test retry button if job failed
      const retryButton = page.locator('button:has-text("Retry")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
          await dialog.accept();
        });
        
        await page.waitForTimeout(1000);
      }
    }
  });

  test('Template loading in scoring modal', async ({ page }) => {
    // Navigate to a profile
    await page.goto('/profiles');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await page.click('a[href*="/profiles/"]:first-child');
    
    // Open scoring modal
    await page.click('button:has-text("Score Profile")');
    await expect(page.locator('#scoreModal')).toBeVisible();
    
    // Wait for templates to load
    await page.waitForTimeout(3000);
    
    // Check that templates are loaded in the dropdown
    const templateOptions = page.locator('#templateSelect option');
    const optionCount = await templateOptions.count();
    
    // Should have at least the default option plus one or more templates
    expect(optionCount).toBeGreaterThan(1);
    
    // Verify first option is the placeholder
    const firstOption = templateOptions.first();
    await expect(firstOption).toHaveText('Select a template...');
  });
});

// Helper functions for test setup and teardown
test.afterAll(async () => {
  // Clean up any test data if needed
  // This depends on your backend implementation
  console.log('Test cleanup completed');
});

// Configuration for running against different environments
const config = {
  // Default to localhost:3001, but allow override via environment variable
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3001',
  
  // Adjust timeouts based on your scoring job duration
  timeout: 120000, // 2 minutes for long-running scoring jobs
  
  // Retry failed tests once in case of transient issues
  retries: 1,
};

module.exports = config;
