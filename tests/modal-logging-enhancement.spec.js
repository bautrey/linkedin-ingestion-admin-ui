const { test, expect } = require('@playwright/test');

test.describe('Enhanced Modal Logging Functions', () => {
  let mockLogElement;
  let mockStepElement;

  test.beforeEach(async ({ page }) => {
    // Mock the modal logging environment
    await page.setContent(`
      <div id="processingLog"></div>
      <div id="step-verify">
        <div class="step-content">
          <div class="step-title">Verify LinkedIn URL</div>
          <div class="step-status"></div>
        </div>
      </div>
      <div id="step-ingest">
        <div class="step-content">
          <div class="step-title">Ingest Profile Data</div>
          <div class="step-status"></div>
        </div>
      </div>
      <div id="step-compatibility">
        <div class="step-content">
          <div class="step-title">Check Role Compatibility</div>
          <div class="step-status"></div>
        </div>
      </div>
    `);

    // Add the enhanced logging functions to the page
    await page.addScriptTag({
      content: `
        // Enhanced log entry formatting functions
        function formatVerificationLogEntry(data) {
          const url = data.context?.result?.linkedin_url || data.context?.linkedin_url;
          if (url) {
            return \`Verifying LinkedIn URL: \${url}\`;
          }
          return 'Verifying LinkedIn URL...';
        }

        function formatIngestionLogEntry(data) {
          const result = data.context?.result;
          if (!result) return 'Extracting profile data...';
          
          const details = [];
          if (result.profile_name) details.push(\`Name: \${result.profile_name}\`);
          if (result.current_title) details.push(\`Title: \${result.current_title}\`);
          if (result.current_company) details.push(\`Company: \${result.current_company}\`);
          if (result.location) details.push(\`Location: \${result.location}\`);
          
          if (details.length > 0) {
            return \`Profile extracted - \${details.join(', ')}\`;
          }
          return result.skipped ? 'Profile already exists' : 'Profile data extracted';
        }

        function formatCompatibilityLogEntry(data) {
          const result = data.context?.result;
          if (!result) return 'Checking role compatibility...';
          
          if (result.compatible_roles && Array.isArray(result.compatible_roles)) {
            const roleScores = result.compatible_roles
              .map(role => \`\${role.role}: \${(role.confidence * 10).toFixed(1)}/10\`)
              .join(', ');
            return \`Compatibility Results: \${roleScores}\`;
          }
          
          const primaryRole = result.recommended_primary_role;
          if (primaryRole) {
            return \`Best fit role identified: \${primaryRole}\`;
          }
          
          return 'Role compatibility analysis completed';
        }

        function formatScoringLogEntry(data) {
          const result = data.context?.result;
          if (!result) return 'AI scoring in progress...';
          
          const score = result.score ?? result.total_score;
          const role = result.role || result.suggested_role;
          
          if (score !== undefined && role) {
            return \`AI Scoring Complete: \${score}/10 for \${role} role\`;
          } else if (score !== undefined) {
            return \`AI Scoring Complete: \${score}/10\`;
          }
          
          return 'AI scoring completed';
        }

        function formatJiraLogEntry(data) {
          const result = data.context?.result;
          if (!result) return 'Updating JIRA with results...';
          
          const updates = [];
          if (result.fit_score) updates.push(\`FIT Score: \${result.fit_score}\`);
          if (result.fit_status) updates.push(\`Status: \${result.fit_status}\`);
          if (result.standing) updates.push(\`Standing: \${result.standing}\`);
          if (result.jira_status) updates.push(\`Result: \${result.jira_status}\`);
          
          if (updates.length > 0) {
            return \`JIRA Updated - \${updates.join(', ')}\`;
          }
          
          return 'JIRA fields updated successfully';
        }

        function formatErrorLogEntry(data, stepName) {
          const error = data.error || data.message;
          const errorType = data.error_type;
          const suggestedAction = data.suggested_action;
          
          let message = \`\${stepName} failed\`;
          if (error) message += \`: \${error}\`;
          if (suggestedAction === 'retry_later') message += ' (retry in a few minutes)';
          if (suggestedAction === 'retry_immediately') message += ' (can retry now)';
          
          return message;
        }

        // Enhanced addModalLogEntry function
        function addEnhancedModalLogEntry(message, type = 'info', data = null) {
          const log = document.getElementById('processingLog');
          const timestamp = new Date().toLocaleTimeString();
          const entry = \`[\${timestamp}] \${message}\\n\`;
          log.textContent += entry;
          log.scrollTop = log.scrollHeight;
        }

        // Enhanced updateModalStep function
        function updateEnhancedModalStep(stepName, status, message = '', data = null) {
          const stepEl = document.getElementById(\`step-\${stepName}\`);
          if (!stepEl) return;
          
          stepEl.className = \`step \${status}\`;
          
          // Update status message
          const statusEl = stepEl.querySelector('.step-status');
          if (statusEl) statusEl.textContent = message;
          
          // Add or update timestamp
          let timestampEl = stepEl.querySelector('.step-timestamp');
          if (!timestampEl) {
            timestampEl = document.createElement('div');
            timestampEl.className = 'step-timestamp text-muted small';
            stepEl.querySelector('.step-content').appendChild(timestampEl);
          }
          
          const now = new Date();
          const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          timestampEl.textContent = \`Last updated: \${timeString}\`;
          
          // Generate enhanced log entries based on step and data
          let logMessage = message || \`\${stepName} \${status}\`;
          
          if (data && status === 'in-progress') {
            switch(stepName) {
              case 'verify':
                logMessage = formatVerificationLogEntry(data);
                break;
              case 'ingest':
                logMessage = formatIngestionLogEntry(data);
                break;
              case 'compatibility':
                logMessage = formatCompatibilityLogEntry(data);
                break;
              case 'score':
                logMessage = formatScoringLogEntry(data);
                break;
              case 'update_jira':
                logMessage = formatJiraLogEntry(data);
                break;
            }
          } else if (data && status === 'completed') {
            switch(stepName) {
              case 'verify':
                logMessage = 'LinkedIn URL verified successfully';
                break;
              case 'ingest':
                logMessage = formatIngestionLogEntry(data);
                break;
              case 'compatibility':
                logMessage = formatCompatibilityLogEntry(data);
                break;
              case 'score':
                logMessage = formatScoringLogEntry(data);
                break;
              case 'update_jira':
                logMessage = formatJiraLogEntry(data);
                break;
            }
          } else if (data && status === 'failed') {
            logMessage = formatErrorLogEntry(data, stepName);
          }
          
          if (status === 'in-progress') {
            addEnhancedModalLogEntry(\`Starting: \${logMessage}\`);
          } else if (status === 'completed') {
            addEnhancedModalLogEntry(\`✓ \${logMessage}\`, 'success');
          } else if (status === 'failed') {
            addEnhancedModalLogEntry(\`✗ \${logMessage}\`, 'error');
          }
        }

        // Make functions available globally for testing
        window.formatVerificationLogEntry = formatVerificationLogEntry;
        window.formatIngestionLogEntry = formatIngestionLogEntry;
        window.formatCompatibilityLogEntry = formatCompatibilityLogEntry;
        window.formatScoringLogEntry = formatScoringLogEntry;
        window.formatJiraLogEntry = formatJiraLogEntry;
        window.formatErrorLogEntry = formatErrorLogEntry;
        window.addEnhancedModalLogEntry = addEnhancedModalLogEntry;
        window.updateEnhancedModalStep = updateEnhancedModalStep;
      `
    });
  });

  test('formatVerificationLogEntry should extract and display LinkedIn URL', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            linkedin_url: 'https://www.linkedin.com/in/johndoe'
          }
        }
      };
      return formatVerificationLogEntry(mockData);
    });

    expect(result).toBe('Verifying LinkedIn URL: https://www.linkedin.com/in/johndoe');
  });

  test('formatVerificationLogEntry should handle missing URL gracefully', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = { context: {} };
      return formatVerificationLogEntry(mockData);
    });

    expect(result).toBe('Verifying LinkedIn URL...');
  });

  test('formatIngestionLogEntry should display extracted profile fields', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            profile_name: 'John Doe',
            current_title: 'Senior Software Engineer',
            current_company: 'Tech Corp',
            location: 'San Francisco, CA'
          }
        }
      };
      return formatIngestionLogEntry(mockData);
    });

    expect(result).toBe('Profile extracted - Name: John Doe, Title: Senior Software Engineer, Company: Tech Corp, Location: San Francisco, CA');
  });

  test('formatIngestionLogEntry should handle skipped profiles', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            skipped: true
          }
        }
      };
      return formatIngestionLogEntry(mockData);
    });

    expect(result).toBe('Profile already exists');
  });

  test('formatCompatibilityLogEntry should display role scores', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            compatible_roles: [
              { role: 'CIO', confidence: 0.72 },
              { role: 'CTO', confidence: 0.89 },
              { role: 'CISO', confidence: 0.61 }
            ]
          }
        }
      };
      return formatCompatibilityLogEntry(mockData);
    });

    expect(result).toBe('Compatibility Results: CIO: 7.2/10, CTO: 8.9/10, CISO: 6.1/10');
  });

  test('formatCompatibilityLogEntry should handle primary role only', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            recommended_primary_role: 'CTO'
          }
        }
      };
      return formatCompatibilityLogEntry(mockData);
    });

    expect(result).toBe('Best fit role identified: CTO');
  });

  test('formatScoringLogEntry should display score and role', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            score: 8.7,
            role: 'CTO'
          }
        }
      };
      return formatScoringLogEntry(mockData);
    });

    expect(result).toBe('AI Scoring Complete: 8.7/10 for CTO role');
  });

  test('formatJiraLogEntry should display JIRA field updates', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            fit_score: 87,
            fit_status: 'Scored',
            standing: 'Good Qualified Candidate',
            jira_status: 'Updated'
          }
        }
      };
      return formatJiraLogEntry(mockData);
    });

    expect(result).toBe('JIRA Updated - FIT Score: 87, Status: Scored, Standing: Good Qualified Candidate, Result: Updated');
  });

  test('formatErrorLogEntry should format error messages with retry information', async ({ page }) => {
    const result = await page.evaluate(() => {
      const mockData = {
        error: 'LinkedIn API rate limit exceeded',
        error_type: 'rate_limiting',
        suggested_action: 'retry_later'
      };
      return formatErrorLogEntry(mockData, 'verify');
    });

    expect(result).toBe('verify failed: LinkedIn API rate limit exceeded (retry in a few minutes)');
  });

  test('updateEnhancedModalStep should update step status and log entry', async ({ page }) => {
    await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            linkedin_url: 'https://www.linkedin.com/in/johndoe'
          }
        }
      };
      updateEnhancedModalStep('verify', 'in-progress', 'Verifying...', mockData);
    });

    // Check that step status was updated
    const stepClass = await page.locator('#step-verify').getAttribute('class');
    expect(stepClass).toContain('in-progress');

    // Check that log entry was added
    const logContent = await page.locator('#processingLog').textContent();
    expect(logContent).toContain('Starting: Verifying LinkedIn URL: https://www.linkedin.com/in/johndoe');
  });

  test('updateEnhancedModalStep should handle completion with rich context', async ({ page }) => {
    await page.evaluate(() => {
      const mockData = {
        context: {
          result: {
            compatible_roles: [
              { role: 'CTO', confidence: 0.89 },
              { role: 'CIO', confidence: 0.72 }
            ]
          }
        }
      };
      updateEnhancedModalStep('compatibility', 'completed', 'Analysis complete', mockData);
    });

    // Check that step status was updated
    const stepClass = await page.locator('#step-compatibility').getAttribute('class');
    expect(stepClass).toContain('completed');

    // Check that enhanced log entry was added
    const logContent = await page.locator('#processingLog').textContent();
    expect(logContent).toContain('✓ Compatibility Results: CTO: 8.9/10, CIO: 7.2/10');
  });

  test('updateEnhancedModalStep should handle errors with retry information', async ({ page }) => {
    await page.evaluate(() => {
      const mockData = {
        error: 'Network timeout',
        suggested_action: 'retry_immediately'
      };
      updateEnhancedModalStep('verify', 'failed', 'Failed', mockData);
    });

    // Check that step status was updated
    const stepClass = await page.locator('#step-verify').getAttribute('class');
    expect(stepClass).toContain('failed');

    // Check that error log entry was added with retry info
    const logContent = await page.locator('#processingLog').textContent();
    expect(logContent).toContain('✗ verify failed: Network timeout (can retry now)');
  });

  test('enhanced logging should add timestamps to steps', async ({ page }) => {
    await page.evaluate(() => {
      updateEnhancedModalStep('verify', 'in-progress', 'Starting verification');
    });

    // Check that timestamp was added
    const timestampEl = await page.locator('#step-verify .step-timestamp');
    await expect(timestampEl).toBeVisible();
    
    const timestampText = await timestampEl.textContent();
    expect(timestampText).toMatch(/Last updated: \d{2}:\d{2}:\d{2}/);
  });
});

test.describe('Integration Tests with WebSocket Events', () => {
  test('should handle real WebSocket event structure', async ({ page }) => {
    await page.setContent(`
      <div id="processingLog"></div>
      <div id="step-compatibility">
        <div class="step-content">
          <div class="step-title">Check Role Compatibility</div>
          <div class="step-status"></div>
        </div>
      </div>
    `);

    // Add the enhanced logging functions
    await page.addScriptTag({
      content: `
        // ... include the same enhanced logging functions from above ...
        ${await page.locator('script').first().textContent()}
      `
    });

    // Simulate a real WebSocket event from the backend
    const result = await page.evaluate(() => {
      const mockWebSocketEvent = {
        jobName: 'CAN-123',
        timestamp: '2025-09-03T14:23:18Z',
        context: {
          result: {
            recommended_primary_role: 'CTO',
            compatible_roles: [
              { role: 'CIO', confidence: 0.72, compatible: true },
              { role: 'CTO', confidence: 0.89, compatible: true },
              { role: 'CISO', confidence: 0.61, compatible: false }
            ],
            overall_assessment: 'Strong technical leadership profile with enterprise architecture experience.',
            confidence_score: 0.89,
            proceed_with_scoring: true
          }
        }
      };

      // Simulate the WebSocket event handler calling our enhanced function
      updateEnhancedModalStep('compatibility', 'completed', '', mockWebSocketEvent);
      
      return document.getElementById('processingLog').textContent;
    });

    expect(result).toContain('✓ Compatibility Results: CIO: 7.2/10, CTO: 8.9/10, CISO: 6.1/10');
  });
});