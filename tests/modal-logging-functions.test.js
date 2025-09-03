// Enhanced Modal Logging Functions Tests
// Jest-based unit tests for the enhanced logging functionality

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
    
    if (result.compatible_roles && Array.isArray(result.compatible_roles) && result.compatible_roles.length > 0) {
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

describe('Enhanced Modal Logging Functions', () => {

    describe('formatVerificationLogEntry', () => {
        test('should extract and display LinkedIn URL', () => {
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

        test('should handle missing URL gracefully', () => {
            const mockData = { context: {} };
            const result = formatVerificationLogEntry(mockData);
            expect(result).toBe('Verifying LinkedIn URL...');
        });

        test('should handle empty data', () => {
            const result = formatVerificationLogEntry({});
            expect(result).toBe('Verifying LinkedIn URL...');
        });
    });

    describe('formatIngestionLogEntry', () => {
        test('should display extracted profile fields', () => {
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

        test('should handle skipped profiles', () => {
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

        test('should handle missing context', () => {
            const mockData = {};
            const result = formatIngestionLogEntry(mockData);
            expect(result).toBe('Extracting profile data...');
        });

        test('should handle partial profile data', () => {
            const mockData = {
                context: {
                    result: {
                        profile_name: 'Jane Smith',
                        current_title: 'CTO'
                    }
                }
            };
            
            const result = formatIngestionLogEntry(mockData);
            expect(result).toBe('Profile extracted - Name: Jane Smith, Title: CTO');
        });
    });

    describe('formatCompatibilityLogEntry', () => {
        test('should display role scores', () => {
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

        test('should handle primary role only', () => {
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

        test('should handle missing data', () => {
            const mockData = { context: {} };
            const result = formatCompatibilityLogEntry(mockData);
            expect(result).toBe('Checking role compatibility...');
        });

        test('should handle empty roles array', () => {
            const mockData = {
                context: {
                    result: {
                        compatible_roles: []
                    }
                }
            };
            
            const result = formatCompatibilityLogEntry(mockData);
            expect(result).toBe('Role compatibility analysis completed');
        });
    });

    describe('formatScoringLogEntry', () => {
        test('should display score and role', () => {
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

        test('should handle score only', () => {
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

        test('should handle missing data', () => {
            const mockData = {};
            const result = formatScoringLogEntry(mockData);
            expect(result).toBe('AI scoring in progress...');
        });

        test('should handle zero score', () => {
            const mockData = {
                context: {
                    result: {
                        score: 0,
                        role: 'CTO'
                    }
                }
            };
            
            const result = formatScoringLogEntry(mockData);
            expect(result).toBe('AI Scoring Complete: 0/10 for CTO role');
        });
    });

    describe('formatJiraLogEntry', () => {
        test('should display JIRA field updates', () => {
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

        test('should handle partial updates', () => {
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

        test('should handle missing data', () => {
            const mockData = {};
            const result = formatJiraLogEntry(mockData);
            expect(result).toBe('Updating JIRA with results...');
        });

        test('should handle empty result', () => {
            const mockData = {
                context: {
                    result: {}
                }
            };
            
            const result = formatJiraLogEntry(mockData);
            expect(result).toBe('JIRA fields updated successfully');
        });
    });

    describe('formatErrorLogEntry', () => {
        test('should format error messages with retry information', () => {
            const mockData = {
                error: 'LinkedIn API rate limit exceeded',
                error_type: 'rate_limiting',
                suggested_action: 'retry_later'
            };
            
            const result = formatErrorLogEntry(mockData, 'verify');
            expect(result).toBe('verify failed: LinkedIn API rate limit exceeded (retry in a few minutes)');
        });

        test('should handle immediate retry suggestion', () => {
            const mockData = {
                error: 'Network timeout',
                suggested_action: 'retry_immediately'
            };
            
            const result = formatErrorLogEntry(mockData, 'ingest');
            expect(result).toBe('ingest failed: Network timeout (can retry now)');
        });

        test('should handle basic error without retry info', () => {
            const mockData = {
                error: 'Invalid profile data'
            };
            
            const result = formatErrorLogEntry(mockData, 'compatibility');
            expect(result).toBe('compatibility failed: Invalid profile data');
        });

        test('should handle error without details', () => {
            const mockData = {};
            const result = formatErrorLogEntry(mockData, 'score');
            expect(result).toBe('score failed');
        });

        test('should use message field when error is not present', () => {
            const mockData = {
                message: 'Processing timeout',
                suggested_action: 'retry_later'
            };
            
            const result = formatErrorLogEntry(mockData, 'update_jira');
            expect(result).toBe('update_jira failed: Processing timeout (retry in a few minutes)');
        });
    });
});

describe('Integration Test Scenarios', () => {
    
    test('should handle realistic WebSocket verification event', () => {
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
    
    test('should handle realistic WebSocket ingestion event', () => {
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
    
    test('should handle realistic WebSocket compatibility event', () => {
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
    
    test('should handle realistic WebSocket scoring event', () => {
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
    
    test('should handle realistic WebSocket JIRA update event', () => {
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

    test('should handle complete processing pipeline simulation', () => {
        // Simulate a complete processing pipeline
        const candidateKey = 'CAN-123';
        const baseTimestamp = '2025-09-03T14:23:';
        
        // 1. Verification step
        const verifyEvent = {
            jobName: candidateKey,
            timestamp: baseTimestamp + '18Z',
            context: {
                result: {
                    linkedin_url: 'https://www.linkedin.com/in/senior-cto-candidate'
                }
            }
        };
        expect(formatVerificationLogEntry(verifyEvent)).toBe('Verifying LinkedIn URL: https://www.linkedin.com/in/senior-cto-candidate');
        
        // 2. Ingestion step
        const ingestEvent = {
            jobName: candidateKey,
            timestamp: baseTimestamp + '25Z',
            context: {
                result: {
                    profile_name: 'Sarah Johnson',
                    current_title: 'Chief Technology Officer',
                    current_company: 'Global Tech Solutions',
                    location: 'New York, NY'
                }
            }
        };
        expect(formatIngestionLogEntry(ingestEvent)).toBe('Profile extracted - Name: Sarah Johnson, Title: Chief Technology Officer, Company: Global Tech Solutions, Location: New York, NY');
        
        // 3. Compatibility step
        const compatibilityEvent = {
            jobName: candidateKey,
            timestamp: baseTimestamp + '35Z',
            context: {
                result: {
                    compatible_roles: [
                        { role: 'CTO', confidence: 0.95 },
                        { role: 'CIO', confidence: 0.78 },
                        { role: 'VP Engineering', confidence: 0.82 }
                    ]
                }
            }
        };
        expect(formatCompatibilityLogEntry(compatibilityEvent)).toBe('Compatibility Results: CTO: 9.5/10, CIO: 7.8/10, VP Engineering: 8.2/10');
        
        // 4. Scoring step
        const scoringEvent = {
            jobName: candidateKey,
            timestamp: baseTimestamp + '45Z',
            context: {
                result: {
                    score: 9.3,
                    role: 'CTO'
                }
            }
        };
        expect(formatScoringLogEntry(scoringEvent)).toBe('AI Scoring Complete: 9.3/10 for CTO role');
        
        // 5. JIRA update step
        const jiraEvent = {
            jobName: candidateKey,
            timestamp: baseTimestamp + '50Z',
            context: {
                result: {
                    fit_score: 93,
                    fit_status: 'Scored',
                    standing: 'Excellent Qualified Candidate',
                    jira_status: 'Updated'
                }
            }
        };
        expect(formatJiraLogEntry(jiraEvent)).toBe('JIRA Updated - FIT Score: 93, Status: Scored, Standing: Excellent Qualified Candidate, Result: Updated');
    });
});