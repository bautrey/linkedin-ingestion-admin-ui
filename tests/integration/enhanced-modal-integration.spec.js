const { test, expect } = require('@playwright/test');

test.describe('Enhanced Modal Logging - Integration Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to a candidate detail page
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.waitForLoadState('networkidle');
    });

    test('should display enhanced logging during complete processing flow', async ({ page }) => {
        // Open processing modal
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Verify modal opened with initial structured log entry
        const initialLog = page.locator('#processingLog .log-entry').first();
        await expect(initialLog).toContainText('Ready to start processing');
        await expect(initialLog).toHaveAttribute('data-type', 'info');
        
        // Verify log entry structure
        await expect(initialLog.locator('.log-timestamp')).toBeVisible();
        await expect(initialLog.locator('.log-icon')).toContainText('ℹ️');
        await expect(initialLog.locator('.log-message')).toBeVisible();
        
        // Start processing
        await page.click('#startProcessingBtn');
        
        // Wait for processing started message
        await page.waitForSelector('.log-entry:has-text("Processing pipeline started")', { timeout: 10000 });
        
        // Verify structured log entries appear during processing
        await expect(page.locator('#processingLog .log-entry')).toHaveCount.greaterThan(2);
        
        // Check that timestamps are properly formatted
        const timestamps = page.locator('#processingLog .log-timestamp');
        const firstTimestamp = await timestamps.first().textContent();
        expect(firstTimestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/); // HH:MM:SS format
    });

    test('should handle WebSocket step events with enhanced formatting', async ({ page }) => {
        // Mock WebSocket events for testing
        await page.addInitScript(() => {
            window.mockWebSocketEvents = [];
            window.originalWebSocket = window.WebSocket;
            
            // Mock WebSocket with controllable events
            window.WebSocket = class MockWebSocket {
                constructor(url) {
                    this.url = url;
                    this.readyState = 1; // OPEN
                    setTimeout(() => {
                        if (this.onopen) this.onopen();
                    }, 100);
                }
                
                send(data) {
                    // Store sent data for testing
                    window.mockWebSocketEvents.push(JSON.parse(data));
                }
                
                // Method to trigger events from test
                triggerEvent(eventName, data) {
                    if (this.onmessage) {
                        this.onmessage({ data: JSON.stringify({ type: eventName, ...data }) });
                    }
                }
            };
        });

        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Simulate WebSocket events with rich context data
        await page.evaluate(() => {
            const mockSocket = window.socket; // Assuming socket is available globally
            
            // Simulate verification step with URL data
            const verifyEvent = {
                jobName: 'CAN-4230',
                timestamp: new Date().toISOString(),
                context: {
                    result: {
                        linkedin_url: 'https://www.linkedin.com/in/billgtingle/'
                    }
                }
            };
            
            // Trigger step events
            if (window.handleProcessingStart) {
                window.handleProcessingStart({ candidateKey: 'CAN-4230', executionId: 'test-123' });
            }
            
            // Simulate enhanced step logging
            if (window.updateEnhancedModalStep) {
                window.updateEnhancedModalStep('verify', 'completed', 'LinkedIn URL verified', verifyEvent);
            }
        });
        
        // Wait for and verify enhanced log entries
        await page.waitForSelector('.log-entry[data-type="success"]', { timeout: 5000 });
        
        // Check for structured URL display
        const urlLogEntry = page.locator('.log-entry .log-details:has-text("linkedin.com/in/billgtingle")');
        await expect(urlLogEntry).toBeVisible();
        
        // Verify success styling
        const successEntry = page.locator('.log-entry[data-type="success"]');
        await expect(successEntry).toHaveCSS('border-left-color', 'rgb(40, 167, 69)'); // Bootstrap success green
    });

    test('should display profile data extraction with structured format', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Simulate profile ingestion event with real data
        await page.evaluate(() => {
            const profileData = {
                jobName: 'CAN-4230',
                timestamp: new Date().toISOString(),
                context: {
                    result: {
                        profile_name: 'Bill Tingle',
                        current_title: 'Founder & CEO, Tingle Leadership',
                        current_company: 'Tingle Leadership',
                        location: 'Fairfax, VA'
                    }
                }
            };
            
            // Use the enhanced logging function
            if (window.addModalLogEntry) {
                window.addModalLogEntry('Profile data extracted', 'success', {
                    profile: {
                        name: profileData.context.result.profile_name,
                        title: profileData.context.result.current_title,
                        company: profileData.context.result.current_company
                    }
                });
            }
        });
        
        // Verify structured profile data display
        await page.waitForSelector('.log-entry:has-text("Profile data extracted")', { timeout: 5000 });
        
        const profileEntry = page.locator('.log-entry .log-details:has-text("Name: Bill Tingle")');
        await expect(profileEntry).toBeVisible();
        
        const titleEntry = page.locator('.log-entry .log-details:has-text("Title: Founder & CEO, Tingle Leadership")');
        await expect(titleEntry).toBeVisible();
        
        const companyEntry = page.locator('.log-entry .log-details:has-text("Company: Tingle Leadership")');
        await expect(companyEntry).toBeVisible();
    });

    test('should display compatibility scores in structured format', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Simulate compatibility analysis results
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('Role compatibility analysis complete', 'success', {
                    scores: [
                        { role: 'CIO', confidence: 0.78 },
                        { role: 'CTO', confidence: 0.92 },
                        { role: 'CISO', confidence: 0.65 }
                    ]
                });
            }
        });
        
        // Verify structured score display
        await page.waitForSelector('.log-entry:has-text("Role compatibility analysis complete")', { timeout: 5000 });
        
        const scoresEntry = page.locator('.log-entry .log-details:has-text("CIO: 7.8/10, CTO: 9.2/10, CISO: 6.5/10")');
        await expect(scoresEntry).toBeVisible();
        
        // Verify the arrow indicator
        const detailsSection = page.locator('.log-entry .log-details .ps-3');
        await expect(detailsSection).toHaveCSS('position', 'relative');
    });

    test('should display JIRA field updates with structured format', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Simulate JIRA update event
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('JIRA ticket updated', 'success', {
                    jiraFields: {
                        'FIT Score': '92',
                        'FIT Status': 'Scored',
                        'Standing': 'Excellent Qualified Candidate'
                    }
                });
            }
        });
        
        // Verify structured JIRA updates display
        await page.waitForSelector('.log-entry:has-text("JIRA ticket updated")', { timeout: 5000 });
        
        const jiraEntry = page.locator('.log-entry .log-details:has-text("FIT Score: 92")');
        await expect(jiraEntry).toBeVisible();
        
        const statusEntry = page.locator('.log-entry .log-details:has-text("FIT Status: Scored")');
        await expect(statusEntry).toBeVisible();
        
        const standingEntry = page.locator('.log-entry .log-details:has-text("Standing: Excellent Qualified Candidate")');
        await expect(standingEntry).toBeVisible();
    });

    test('should handle error scenarios with enhanced formatting', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Simulate error scenario
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('LinkedIn verification failed: Rate limit exceeded', 'error', {
                    error: 'Rate limit exceeded',
                    suggested_action: 'retry_later',
                    retry_after: '5 minutes'
                });
            }
        });
        
        // Verify error styling and content
        await page.waitForSelector('.log-entry[data-type="error"]', { timeout: 5000 });
        
        const errorEntry = page.locator('.log-entry[data-type="error"]');
        await expect(errorEntry).toHaveCSS('border-left-color', 'rgb(220, 53, 69)'); // Bootstrap danger red
        
        const errorIcon = errorEntry.locator('.log-icon');
        await expect(errorIcon).toContainText('❌');
        
        const errorMessage = errorEntry.locator('.log-message');
        await expect(errorMessage).toContainText('Rate limit exceeded');
    });

    test('should be responsive on mobile screen sizes', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Add some test log entries
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('LinkedIn URL verified', 'success', {
                    url: 'https://www.linkedin.com/in/billgtingle/'
                });
                window.addModalLogEntry('Profile data extracted', 'success', {
                    profile: { name: 'Bill Tingle', title: 'CEO', company: 'Tingle Leadership' }
                });
            }
        });
        
        // Verify mobile-responsive styling
        await page.waitForSelector('.log-entry', { timeout: 5000 });
        
        // Check that timestamps are properly sized on mobile
        const timestamp = page.locator('.log-timestamp').first();
        const timestampStyle = await timestamp.evaluate(el => getComputedStyle(el));
        
        // Mobile timestamp should be smaller
        expect(parseFloat(timestampStyle.fontSize)).toBeLessThan(12); // Should be 0.7rem or smaller
        
        // Verify log entries are still readable
        const logEntries = page.locator('.log-entry');
        const entryCount = await logEntries.count();
        expect(entryCount).toBeGreaterThan(1);
        
        // Check that the modal is responsive
        const modal = page.locator('#processingModal .modal-dialog');
        await expect(modal).toBeVisible();
    });

    test('should handle memory management with many log entries', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Add many log entries to test memory management
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                // Add 105 entries (should trigger cleanup at 100)
                for (let i = 0; i < 105; i++) {
                    window.addModalLogEntry(`Test log entry ${i}`, 'info');
                }
            }
        });
        
        // Wait for all entries to be added
        await page.waitForTimeout(1000);
        
        // Verify that only ~100 entries remain (due to cleanup)
        const logEntries = page.locator('#processingLog .log-entry');
        const entryCount = await logEntries.count();
        
        expect(entryCount).toBeLessThanOrEqual(100);
        expect(entryCount).toBeGreaterThan(95); // Should be around 100, give some tolerance
        
        // Verify that the latest entries are still present
        const lastEntry = logEntries.last();
        await expect(lastEntry).toContainText('Test log entry');
    });

    test('should display JSON data in collapsible format', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Add log entry with JSON data
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('Processing result', 'success', {
                    json: {
                        profile_name: 'Bill Tingle',
                        scores: [8.5, 9.2, 7.1],
                        metadata: {
                            source: 'LinkedIn API',
                            timestamp: '2025-09-03T14:30:00Z'
                        }
                    }
                });
            }
        });
        
        // Verify JSON details section exists
        await page.waitForSelector('details summary:has-text("Raw Data")', { timeout: 5000 });
        
        const detailsElement = page.locator('details');
        await expect(detailsElement).toBeVisible();
        
        // Click to expand JSON
        await page.click('details summary');
        
        // Verify JSON content is displayed
        const jsonPre = page.locator('details pre');
        await expect(jsonPre).toBeVisible();
        await expect(jsonPre).toContainText('profile_name');
        await expect(jsonPre).toContainText('Bill Tingle');
        await expect(jsonPre).toContainText('scores');
        
        // Verify proper JSON formatting
        const jsonText = await jsonPre.textContent();
        expect(jsonText).toContain('{\n'); // Should be formatted JSON
    });

    test('should maintain scroll position and auto-scroll to new entries', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Add several log entries
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                for (let i = 0; i < 20; i++) {
                    window.addModalLogEntry(`Log entry ${i}`, 'info');
                }
            }
        });
        
        // Wait for entries to be added
        await page.waitForTimeout(500);
        
        // Verify that the log automatically scrolls to bottom
        const logContainer = page.locator('#processingLog');
        const scrollTop = await logContainer.evaluate(el => el.scrollTop);
        const scrollHeight = await logContainer.evaluate(el => el.scrollHeight);
        const clientHeight = await logContainer.evaluate(el => el.clientHeight);
        
        // Should be scrolled to near the bottom
        expect(scrollTop).toBeGreaterThan(scrollHeight - clientHeight - 10);
        
        // Add one more entry and verify auto-scroll
        await page.evaluate(() => {
            if (window.addModalLogEntry) {
                window.addModalLogEntry('Latest entry', 'success');
            }
        });
        
        await page.waitForTimeout(200);
        
        // Should still be at bottom after new entry
        const newScrollTop = await logContainer.evaluate(el => el.scrollTop);
        const newScrollHeight = await logContainer.evaluate(el => el.scrollHeight);
        expect(newScrollTop).toBeGreaterThan(newScrollHeight - clientHeight - 10);
    });
});

test.describe('Fallback and Error Handling', () => {

    test('should gracefully handle missing DOM elements', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        
        // Test that functions handle missing elements gracefully
        const result = await page.evaluate(() => {
            // Remove the processing log element to test error handling
            const log = document.getElementById('processingLog');
            if (log) log.remove();
            
            // Try to add a log entry - should not crash
            try {
                if (window.addModalLogEntry) {
                    const result = window.addModalLogEntry('Test message', 'info');
                    return { success: true, result };
                }
                return { success: false, error: 'Function not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        // Function should handle missing DOM gracefully
        expect(result.success).toBe(true);
    });

    test('should handle malformed WebSocket data', async ({ page }) => {
        await page.goto('http://localhost:3003/candidates/CAN-4230');
        await page.click('button:has-text("Process Candidate")');
        await page.waitForSelector('#processingModal', { state: 'visible' });
        
        // Test with malformed data
        const result = await page.evaluate(() => {
            try {
                if (window.addModalLogEntry) {
                    // Test with null data
                    window.addModalLogEntry('Test with null data', 'info', null);
                    
                    // Test with malformed data structure
                    window.addModalLogEntry('Test with bad data', 'info', { 
                        badField: undefined,
                        nested: { deeply: { malformed: null } }
                    });
                    
                    return { success: true };
                }
                return { success: false, error: 'Function not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        expect(result.success).toBe(true);
        
        // Verify that some log entries were still created
        const logEntries = page.locator('.log-entry');
        const entryCount = await logEntries.count();
        expect(entryCount).toBeGreaterThan(0);
    });
});