const { test, expect } = require('@playwright/test');

// Extract the enhanced logging functions from the EJS template for testing
// These are the exact functions from the implementation
function formatVerificationLogEntry(data) {
    const url = data.context?.result?.linkedin_url || data.context?.linkedin_url;
    if (url) {
        return `Verifying LinkedIn URL: ${url}`;
    }
    return 'Verifying LinkedIn URL...';
}

function formatIngestionLogEntry(data) {
    const result = data.context?.result;
    if (!result) return 'Extracting profile data...';
    
    const details = [];
    if (result.profile_name) details.push(`Name: ${result.profile_name}`);
    if (result.current_title) details.push(`Title: ${result.current_title}`);
    if (result.current_company) details.push(`Company: ${result.current_company}`);
    if (result.location) details.push(`Location: ${result.location}`);
    
    if (details.length > 0) {
        return `Profile extracted - ${details.join(', ')}`;
    }
    return result.skipped ? 'Profile already exists' : 'Profile data extracted';
}

function formatCompatibilityLogEntry(data) {
    const result = data.context?.result;
    if (!result) return 'Checking role compatibility...';
    
    if (result.compatible_roles && Array.isArray(result.compatible_roles)) {
        const roleScores = result.compatible_roles
            .map(role => `${role.role}: ${(role.confidence * 10).toFixed(1)}/10`)
            .join(', ');
        return `Compatibility Results: ${roleScores}`;
    }
    
    const primaryRole = result.recommended_primary_role;
    if (primaryRole) {
        return `Best fit role identified: ${primaryRole}`;
    }
    
    return 'Role compatibility analysis completed';
}

function formatScoringLogEntry(data) {
    const result = data.context?.result;
    if (!result) return 'AI scoring in progress...';
    
    const score = result.score ?? result.total_score;
    const role = result.role || result.suggested_role;
    
    if (score !== undefined && role) {
        return `AI Scoring Complete: ${score}/10 for ${role} role`;
    } else if (score !== undefined) {
        return `AI Scoring Complete: ${score}/10`;
    }
    
    return 'AI scoring completed';
}

function formatJiraLogEntry(data) {
    const result = data.context?.result;
    if (!result) return 'Updating JIRA with results...';
    
    const updates = [];
    if (result.fit_score) updates.push(`FIT Score: ${result.fit_score}`);
    if (result.fit_status) updates.push(`Status: ${result.fit_status}`);
    if (result.standing) updates.push(`Standing: ${result.standing}`);
    if (result.jira_status) updates.push(`Result: ${result.jira_status}`);
    
    if (updates.length > 0) {
        return `JIRA Updated - ${updates.join(', ')}`;
    }
    
    return 'JIRA fields updated successfully';
}

function formatErrorLogEntry(data, stepName) {
    const error = data.error || data.message;
    const errorType = data.error_type;
    const suggestedAction = data.suggested_action;
    
    let message = `${stepName} failed`;
    if (error) message += `: ${error}`;
    if (suggestedAction === 'retry_later') message += ' (retry in a few minutes)';
    if (suggestedAction === 'retry_immediately') message += ' (can retry now)';
    
    return message;
}

test.describe('Enhanced Modal Logging Functions - Unit Tests', () => {

    test('formatVerificationLogEntry should extract and display LinkedIn URL', async () => {
        const mockData = {
            context: {
                result: {
                    linkedin_url: 'https://www.linkedin.com/in/johndoe'
                }
            }
        };
        
        const result = formatVerificationLogEntry(mockData);
        expect(result).toBe('Verifying LinkedIn URL: https://www.linkedin.com/in/johndoe');
    });

    test('formatVerificationLogEntry should handle missing URL gracefully', async () => {
        const mockData = { context: {} };
        const result = formatVerificationLogEntry(mockData);
        expect(result).toBe('Verifying LinkedIn URL...');
    });

    test('formatIngestionLogEntry should display extracted profile fields', async () => {
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
        
        const result = formatIngestionLogEntry(mockData);
        expect(result).toBe('Profile extracted - Name: John Doe, Title: Senior Software Engineer, Company: Tech Corp, Location: San Francisco, CA');
    });

    test('formatIngestionLogEntry should handle skipped profiles', async () => {
        const mockData = {
            context: {
                result: {
                    skipped: true
                }
            }
        };
        
        const result = formatIngestionLogEntry(mockData);
        expect(result).toBe('Profile already exists');
    });

    test('formatIngestionLogEntry should handle missing context', async () => {
        const mockData = {};
        const result = formatIngestionLogEntry(mockData);
        expect(result).toBe('Extracting profile data...');
    });

    test('formatCompatibilityLogEntry should display role scores', async () => {
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
        
        const result = formatCompatibilityLogEntry(mockData);
        expect(result).toBe('Compatibility Results: CIO: 7.2/10, CTO: 8.9/10, CISO: 6.1/10');
    });

    test('formatCompatibilityLogEntry should handle primary role only', async () => {
        const mockData = {
            context: {
                result: {
                    recommended_primary_role: 'CTO'
                }
            }
        };
        
        const result = formatCompatibilityLogEntry(mockData);
        expect(result).toBe('Best fit role identified: CTO');
    });

    test('formatCompatibilityLogEntry should handle missing data', async () => {
        const mockData = { context: {} };
        const result = formatCompatibilityLogEntry(mockData);
        expect(result).toBe('Checking role compatibility...');
    });

    test('formatScoringLogEntry should display score and role', async () => {
        const mockData = {
            context: {
                result: {
                    score: 8.7,
                    role: 'CTO'
                }
            }
        };
        
        const result = formatScoringLogEntry(mockData);
        expect(result).toBe('AI Scoring Complete: 8.7/10 for CTO role');
    });

    test('formatScoringLogEntry should handle score only', async () => {
        const mockData = {
            context: {
                result: {
                    total_score: 9.2
                }
            }
        };
        
        const result = formatScoringLogEntry(mockData);
        expect(result).toBe('AI Scoring Complete: 9.2/10');
    });

    test('formatScoringLogEntry should handle missing data', async () => {
        const mockData = {};
        const result = formatScoringLogEntry(mockData);
        expect(result).toBe('AI scoring in progress...');
    });

    test('formatJiraLogEntry should display JIRA field updates', async () => {
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
        
        const result = formatJiraLogEntry(mockData);
        expect(result).toBe('JIRA Updated - FIT Score: 87, Status: Scored, Standing: Good Qualified Candidate, Result: Updated');
    });

    test('formatJiraLogEntry should handle partial updates', async () => {
        const mockData = {
            context: {
                result: {
                    fit_score: 92,
                    jira_status: 'Success'
                }
            }
        };
        
        const result = formatJiraLogEntry(mockData);
        expect(result).toBe('JIRA Updated - FIT Score: 92, Result: Success');
    });

    test('formatJiraLogEntry should handle missing data', async () => {
        const mockData = {};
        const result = formatJiraLogEntry(mockData);
        expect(result).toBe('Updating JIRA with results...');
    });

    test('formatErrorLogEntry should format error messages with retry information', async () => {
        const mockData = {
            error: 'LinkedIn API rate limit exceeded',
            error_type: 'rate_limiting',
            suggested_action: 'retry_later'
        };
        
        const result = formatErrorLogEntry(mockData, 'verify');
        expect(result).toBe('verify failed: LinkedIn API rate limit exceeded (retry in a few minutes)');
    });

    test('formatErrorLogEntry should handle immediate retry suggestion', async () => {
        const mockData = {
            error: 'Network timeout',
            suggested_action: 'retry_immediately'
        };
        
        const result = formatErrorLogEntry(mockData, 'ingest');
        expect(result).toBe('ingest failed: Network timeout (can retry now)');
    });

    test('formatErrorLogEntry should handle basic error without retry info', async () => {
        const mockData = {
            error: 'Invalid profile data'
        };
        
        const result = formatErrorLogEntry(mockData, 'compatibility');
        expect(result).toBe('compatibility failed: Invalid profile data');
    });

    test('formatErrorLogEntry should handle error without details', async () => {
        const mockData = {};
        const result = formatErrorLogEntry(mockData, 'score');
        expect(result).toBe('score failed');
    });
});

test.describe('Integration Test Scenarios', () => {
    
    test('should handle realistic WebSocket verification event', async () => {
        const mockWebSocketEvent = {
            jobName: 'CAN-123',
            timestamp: '2025-09-03T14:23:18Z',
            context: {
                result: {
                    linkedin_url: 'https://www.linkedin.com/in/senior-engineer-johndoe'
                }
            }
        };
        
        const result = formatVerificationLogEntry(mockWebSocketEvent);
        expect(result).toBe('Verifying LinkedIn URL: https://www.linkedin.com/in/senior-engineer-johndoe');
    });
    
    test('should handle realistic WebSocket ingestion event', async () => {
        const mockWebSocketEvent = {
            jobName: 'CAN-123',
            timestamp: '2025-09-03T14:23:25Z',
            context: {
                result: {
                    profile_name: 'John Doe',
                    current_title: 'Senior Software Engineer',
                    current_company: 'Tech Innovations Inc.',
                    location: 'San Francisco, CA',
                    years_experience: 8
                }
            }
        };
        
        const result = formatIngestionLogEntry(mockWebSocketEvent);
        expect(result).toBe('Profile extracted - Name: John Doe, Title: Senior Software Engineer, Company: Tech Innovations Inc., Location: San Francisco, CA');
    });
    
    test('should handle realistic WebSocket compatibility event', async () => {
        const mockWebSocketEvent = {
            jobName: 'CAN-123',
            timestamp: '2025-09-03T14:23:35Z',
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
        
        const result = formatCompatibilityLogEntry(mockWebSocketEvent);
        expect(result).toBe('Compatibility Results: CIO: 7.2/10, CTO: 8.9/10, CISO: 6.1/10');
    });
    
    test('should handle realistic WebSocket scoring event', async () => {
        const mockWebSocketEvent = {
            jobName: 'CAN-123',
            timestamp: '2025-09-03T14:23:45Z',
            context: {
                result: {
                    score: 8.7,
                    role: 'CTO',
                    reasoning: 'Strong technical leadership experience with enterprise architecture background',
                    confidence: 0.92
                }
            }
        };
        
        const result = formatScoringLogEntry(mockWebSocketEvent);
        expect(result).toBe('AI Scoring Complete: 8.7/10 for CTO role');
    });
    
    test('should handle realistic WebSocket JIRA update event', async () => {
        const mockWebSocketEvent = {
            jobName: 'CAN-123',
            timestamp: '2025-09-03T14:23:50Z',
            context: {
                result: {
                    fit_score: 87,
                    fit_status: 'Scored',
                    standing: 'Good Qualified Candidate',
                    jira_status: 'Updated',
                    fields_updated: ['customfield_11635', 'customfield_11634']
                }
            }
        };
        
        const result = formatJiraLogEntry(mockWebSocketEvent);
        expect(result).toBe('JIRA Updated - FIT Score: 87, Status: Scored, Standing: Good Qualified Candidate, Result: Updated');
    });
});