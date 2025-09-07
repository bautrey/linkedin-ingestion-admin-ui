const { test, expect } = require('@playwright/test');

// Log formatting functions for enhanced modal displays
function formatLogEntryWithStructure(message, type = 'info', data = null, timestamp = null) {
    const now = timestamp || new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    const typeIcons = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'progress': '⏳'
    };
    
    const icon = typeIcons[type] || 'ℹ️';
    const formattedMessage = formatMessageContent(message, data);
    
    return {
        timestamp: timeString,
        icon,
        type,
        message: formattedMessage,
        data: data,
        html: generateLogEntryHTML(timeString, icon, type, formattedMessage, data)
    };
}

function formatMessageContent(message, data) {
    if (!data) return message;
    
    // Format different data types
    if (data.url) {
        return `${message}\n  → URL: ${truncateUrl(data.url)}`;
    }
    
    if (data.profile) {
        const profileDetails = [];
        if (data.profile.name) profileDetails.push(`Name: ${data.profile.name}`);
        if (data.profile.title) profileDetails.push(`Title: ${data.profile.title}`);
        if (data.profile.company) profileDetails.push(`Company: ${data.profile.company}`);
        
        if (profileDetails.length > 0) {
            return `${message}\n  → ${profileDetails.join(', ')}`;
        }
    }
    
    if (data.scores && Array.isArray(data.scores)) {
        const scoreDetails = data.scores.map(score => 
            `${score.role}: ${(score.confidence * 10).toFixed(1)}/10`
        ).join(', ');
        return `${message}\n  → ${scoreDetails}`;
    }
    
    if (data.jiraFields) {
        const fieldUpdates = Object.entries(data.jiraFields)
            .map(([field, value]) => `${field}: ${value}`)
            .join(', ');
        return `${message}\n  → ${fieldUpdates}`;
    }
    
    return message;
}

function truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    
    // Try to keep the domain and path structure visible
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    if (`${domain}${path}`.length <= maxLength) {
        return `${domain}${path}`;
    }
    
    return url.substring(0, maxLength - 3) + '...';
}

function generateLogEntryHTML(timestamp, icon, type, message, data) {
    const typeClasses = {
        'info': 'text-info',
        'success': 'text-success',
        'warning': 'text-warning',
        'error': 'text-danger',
        'progress': 'text-primary'
    };
    
    const typeClass = typeClasses[type] || 'text-muted';
    const lines = message.split('\n');
    const mainMessage = lines[0];
    const details = lines.slice(1);
    
    let html = `
        <div class="log-entry mb-2" data-type="${type}">
            <div class="d-flex align-items-start">
                <span class="log-timestamp text-muted small me-2">${timestamp}</span>
                <span class="log-icon me-1">${icon}</span>
                <div class="log-content flex-grow-1">
                    <div class="log-message ${typeClass}">${escapeHtml(mainMessage)}</div>
    `;
    
    if (details.length > 0) {
        html += `<div class="log-details text-muted small mt-1">`;
        details.forEach(detail => {
            if (detail.trim()) {
                html += `<div class="ps-3">${escapeHtml(detail)}</div>`;
            }
        });
        html += `</div>`;
    }
    
    // Add structured data display if available
    if (data && typeof data === 'object') {
        html += generateStructuredDataHTML(data);
    }
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function generateStructuredDataHTML(data) {
    if (data.progress && typeof data.progress === 'object') {
        const { current, total, eta } = data.progress;
        return `
            <div class="progress-info mt-2">
                <div class="progress" style="height: 4px;">
                    <div class="progress-bar" role="progressbar" 
                         style="width: ${(current/total)*100}%"></div>
                </div>
                <small class="text-muted">${current}/${total}${eta ? ` • ETA: ${eta}` : ''}</small>
            </div>
        `;
    }
    
    if (data.json && typeof data.json === 'object') {
        return `
            <details class="mt-2">
                <summary class="small text-muted cursor-pointer">Raw Data</summary>
                <pre class="small bg-light p-2 rounded mt-1 text-wrap">${JSON.stringify(data.json, null, 2)}</pre>
            </details>
        `;
    }
    
    return '';
}

function escapeHtml(text) {
    // Simple HTML escaping for test environment
    if (typeof text !== 'string') return text;
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTimestampForDisplay(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
}

// Enhanced addModalLogEntry function
function addEnhancedModalLogEntry(message, type = 'info', data = null) {
    const log = document.getElementById('processingLog');
    if (!log) return;
    
    const formatted = formatLogEntryWithStructure(message, type, data);
    
    // Create new log entry element
    const entryElement = document.createElement('div');
    entryElement.innerHTML = formatted.html;
    
    // Append to log with smooth animation
    log.appendChild(entryElement.firstElementChild);
    
    // Auto-scroll to bottom
    log.scrollTop = log.scrollHeight;
    
    // Limit log entries to prevent memory issues
    const entries = log.querySelectorAll('.log-entry');
    if (entries.length > 100) {
        entries[0].remove();
    }
    
    return formatted;
}

test.describe('Log Formatting Functions - Unit Tests', () => {

    test('formatLogEntryWithStructure should create properly structured log entry', async () => {
        const result = formatLogEntryWithStructure('Test message', 'info');
        
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('icon', 'ℹ️');
        expect(result).toHaveProperty('type', 'info');
        expect(result).toHaveProperty('message', 'Test message');
        expect(result).toHaveProperty('html');
        expect(result.html).toContain('log-entry');
        expect(result.html).toContain('Test message');
    });

    test('formatLogEntryWithStructure should handle different message types', async () => {
        const successResult = formatLogEntryWithStructure('Success message', 'success');
        const errorResult = formatLogEntryWithStructure('Error message', 'error');
        const warningResult = formatLogEntryWithStructure('Warning message', 'warning');
        
        expect(successResult.icon).toBe('✅');
        expect(successResult.html).toContain('text-success');
        
        expect(errorResult.icon).toBe('❌');
        expect(errorResult.html).toContain('text-danger');
        
        expect(warningResult.icon).toBe('⚠️');
        expect(warningResult.html).toContain('text-warning');
    });

    test('formatMessageContent should format URL data', async () => {
        const data = { url: 'https://www.linkedin.com/in/very-long-profile-name-that-should-be-truncated' };
        const result = formatMessageContent('Verifying LinkedIn URL', data);
        
        expect(result).toContain('Verifying LinkedIn URL');
        expect(result).toContain('→ URL:');
        expect(result).toContain('linkedin.com');
    });

    test('formatMessageContent should format profile data', async () => {
        const data = {
            profile: {
                name: 'John Doe',
                title: 'Senior Software Engineer',
                company: 'Tech Corp'
            }
        };
        const result = formatMessageContent('Profile extracted', data);
        
        expect(result).toContain('Profile extracted');
        expect(result).toContain('→ Name: John Doe');
        expect(result).toContain('Title: Senior Software Engineer');
        expect(result).toContain('Company: Tech Corp');
    });

    test('formatMessageContent should format compatibility scores', async () => {
        const data = {
            scores: [
                { role: 'CIO', confidence: 0.72 },
                { role: 'CTO', confidence: 0.89 },
                { role: 'CISO', confidence: 0.61 }
            ]
        };
        const result = formatMessageContent('Compatibility analysis complete', data);
        
        expect(result).toContain('Compatibility analysis complete');
        expect(result).toContain('→ CIO: 7.2/10, CTO: 8.9/10, CISO: 6.1/10');
    });

    test('formatMessageContent should format JIRA field updates', async () => {
        const data = {
            jiraFields: {
                'FIT Score': '87',
                'Status': 'Scored',
                'Standing': 'Good Qualified Candidate'
            }
        };
        const result = formatMessageContent('JIRA updated', data);
        
        expect(result).toContain('JIRA updated');
        expect(result).toContain('→ FIT Score: 87');
        expect(result).toContain('Status: Scored');
        expect(result).toContain('Standing: Good Qualified Candidate');
    });

    test('truncateUrl should handle long URLs properly', async () => {
        const longUrl = 'https://www.linkedin.com/in/very-long-profile-name-that-exceeds-fifty-characters-easily';
        const truncated = truncateUrl(longUrl, 50);
        
        expect(truncated.length).toBeLessThanOrEqual(50);
        expect(truncated).toContain('linkedin.com');
    });

    test('truncateUrl should preserve short URLs', async () => {
        const shortUrl = 'https://linkedin.com/in/john';
        const result = truncateUrl(shortUrl, 50);
        
        expect(result).toBe(shortUrl);
    });

    test('generateLogEntryHTML should create proper HTML structure', async () => {
        const html = generateLogEntryHTML('14:30:25', '✅', 'success', 'Test message', null);
        
        expect(html).toContain('log-entry');
        expect(html).toContain('14:30:25');
        expect(html).toContain('✅');
        expect(html).toContain('text-success');
        expect(html).toContain('Test message');
    });

    test('generateLogEntryHTML should handle multi-line messages', async () => {
        const message = 'Main message\n  → Detail line 1\n  → Detail line 2';
        const html = generateLogEntryHTML('14:30:25', 'ℹ️', 'info', message, null);
        
        expect(html).toContain('Main message');
        expect(html).toContain('log-details');
        expect(html).toContain('Detail line 1');
        expect(html).toContain('Detail line 2');
    });

    test('generateStructuredDataHTML should create progress bars', async () => {
        const data = {
            progress: {
                current: 75,
                total: 100,
                eta: '30s remaining'
            }
        };
        const html = generateStructuredDataHTML(data);
        
        expect(html).toContain('progress-bar');
        expect(html).toContain('width: 75%');
        expect(html).toContain('75/100');
        expect(html).toContain('ETA: 30s remaining');
    });

    test('generateStructuredDataHTML should create JSON details', async () => {
        const data = {
            json: {
                profile_name: 'John Doe',
                current_title: 'Engineer',
                scores: [8.5, 7.2]
            }
        };
        const html = generateStructuredDataHTML(data);
        
        expect(html).toContain('<details');
        expect(html).toContain('Raw Data');
        expect(html).toContain('profile_name');
        expect(html).toContain('John Doe');
    });

    test('formatTimestampForDisplay should handle relative times', async () => {
        const now = new Date();
        const oneMinuteAgo = new Date(now - 60 * 1000);
        const oneHourAgo = new Date(now - 60 * 60 * 1000);
        const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
        
        expect(formatTimestampForDisplay(now)).toBe('just now');
        expect(formatTimestampForDisplay(oneMinuteAgo)).toBe('1m ago');
        expect(formatTimestampForDisplay(oneHourAgo)).toBe('1h ago');
        const twoDaysResult = formatTimestampForDisplay(twoDaysAgo);
        expect(twoDaysResult).toMatch(/\w{3} \d{1,2}, \d{2}:\d{2}/); // Should match "Sep 1, 16:28" format
    });
});

test.describe('Log Display Integration Tests', () => {

    test('should format realistic verification event', async () => {
        const data = {
            url: 'https://www.linkedin.com/in/billgtingle/'
        };
        const result = formatLogEntryWithStructure('LinkedIn URL verified', 'success', data);
        
        expect(result.message).toContain('LinkedIn URL verified');
        expect(result.message).toContain('→ URL:');
        expect(result.message).toContain('linkedin.com/in/billgtingle');
        expect(result.html).toContain('text-success');
        expect(result.html).toContain('✅');
    });

    test('should format realistic ingestion event', async () => {
        const data = {
            profile: {
                name: 'Bill Tingle',
                title: 'Founder & CEO, Tingle Leadership',
                company: 'Tingle Leadership'
            }
        };
        const result = formatLogEntryWithStructure('Profile data extracted', 'success', data);
        
        expect(result.message).toContain('Profile data extracted');
        expect(result.message).toContain('→ Name: Bill Tingle, Title: Founder & CEO, Tingle Leadership, Company: Tingle Leadership');
    });

    test('should format realistic compatibility event', async () => {
        const data = {
            scores: [
                { role: 'CIO', confidence: 0.78 },
                { role: 'CTO', confidence: 0.92 },
                { role: 'CISO', confidence: 0.65 }
            ]
        };
        const result = formatLogEntryWithStructure('Role compatibility analysis complete', 'success', data);
        
        expect(result.message).toContain('Role compatibility analysis complete');
        expect(result.message).toContain('→ CIO: 7.8/10, CTO: 9.2/10, CISO: 6.5/10');
    });

    test('should format realistic JIRA update event', async () => {
        const data = {
            jiraFields: {
                'FIT Score': '92',
                'FIT Status': 'Scored',
                'Standing': 'Excellent Qualified Candidate',
                'Profile Updated': 'Yes'
            }
        };
        const result = formatLogEntryWithStructure('JIRA ticket updated', 'success', data);
        
        expect(result.message).toContain('JIRA ticket updated');
        expect(result.message).toContain('→ FIT Score: 92, FIT Status: Scored, Standing: Excellent Qualified Candidate, Profile Updated: Yes');
    });

    test('should format error with retry information', async () => {
        const data = {
            error: 'Rate limit exceeded',
            suggested_action: 'retry_later',
            retry_after: '5 minutes'
        };
        const result = formatLogEntryWithStructure('LinkedIn verification failed', 'error', data);
        
        expect(result.type).toBe('error');
        expect(result.icon).toBe('❌');
        expect(result.html).toContain('text-danger');
    });
});