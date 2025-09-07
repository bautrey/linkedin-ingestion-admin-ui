/**
 * Unit Tests: Processing History Section Display (LIN-13 Task 4.1)
 * 
 * Tests the Processing History section display integration with enhanced 
 * formatted messages and migration handler.
 */

const jobInspector = require('../../utils/jobInspector');

describe('Processing History Section Display', () => {
    let consoleSpy;

    beforeEach(() => {
        // Spy on console to suppress logs during testing
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console
        if (consoleSpy) {
            consoleSpy.mockRestore();
        }
        jest.restoreAllMocks();
    });

    describe('Enhanced message display integration', () => {
        test('should display formatted error messages correctly', () => {
            // Simulate database entries with enhanced format
            const databaseEntries = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'error',
                    created_at: '2025-01-15T10:00:00.000Z',
                    duration_ms: 2000,
                    details: {
                        formattedMessage: 'verify failed: Invalid LinkedIn URL format (can retry now)',
                        rawData: {
                            error: 'Invalid LinkedIn URL format',
                            linkedin_url: 'invalid-url',
                            suggested_action: 'retry_immediately'
                        },
                        contextInfo: {
                            operation: 'verify',
                            status: 'error',
                            stepNumber: 1,
                            totalSteps: 4,
                            suggested_action: 'retry_immediately',
                            error_type: 'validation_error'
                        }
                    }
                },
                {
                    id: 2,
                    operation: 'ingest',
                    status: 'error', 
                    created_at: '2025-01-15T10:01:00.000Z',
                    duration_ms: 30000,
                    details: {
                        formattedMessage: 'ingest failed: Profile extraction timeout (retry in a few minutes)',
                        rawData: {
                            error: 'Profile extraction timeout',
                            suggested_action: 'retry_later'
                        },
                        contextInfo: {
                            operation: 'ingest',
                            status: 'error',
                            stepNumber: 2,
                            totalSteps: 4,
                            suggested_action: 'retry_later',
                            error_type: 'timeout_error'
                        }
                    }
                }
            ];

            // Process through migration handler
            const migrated = jobInspector.migrateProcessingHistoryDisplay(databaseEntries);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady).toHaveLength(2);

            // First entry - validation error with immediate retry suggestion
            expect(displayReady[0]).toMatchObject({
                displayMessage: 'verify failed: Invalid LinkedIn URL format (can retry now)',
                statusIcon: '❌',
                statusClass: 'text-danger',
                stepProgress: '1/4',
                suggestedAction: 'retry_immediately',
                errorType: 'validation_error'
            });

            // Second entry - timeout error with delayed retry suggestion  
            expect(displayReady[1]).toMatchObject({
                displayMessage: 'ingest failed: Profile extraction timeout (retry in a few minutes)',
                statusIcon: '❌',
                statusClass: 'text-danger',
                stepProgress: '2/4',
                suggestedAction: 'retry_later',
                errorType: 'timeout_error'
            });
        });

        test('should display success messages with operation-specific details', () => {
            const successEntries = [
                {
                    id: 3,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T10:00:00.000Z',
                    duration_ms: 1500,
                    details: {
                        formattedMessage: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe',
                        rawData: {
                            linkedin_url: 'https://linkedin.com/in/johndoe'
                        },
                        contextInfo: {
                            operation: 'verify',
                            status: 'success',
                            stepNumber: 1,
                            totalSteps: 4
                        }
                    }
                },
                {
                    id: 4,
                    operation: 'score',
                    status: 'success',
                    created_at: '2025-01-15T10:02:00.000Z',
                    duration_ms: 5000,
                    details: {
                        formattedMessage: 'AI scoring completed: 8.7/10',
                        rawData: {
                            score: 8.7,
                            profile_name: 'John Doe'
                        },
                        contextInfo: {
                            operation: 'score',
                            status: 'success',
                            stepNumber: 3,
                            totalSteps: 4
                        }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(successEntries);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady).toHaveLength(2);

            // Verify entry shows URL
            expect(displayReady[0]).toMatchObject({
                displayMessage: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe',
                statusIcon: '✅',
                statusClass: 'text-success',
                stepProgress: '1/4',
                durationText: '2s'
            });

            // Score entry shows specific score
            expect(displayReady[1]).toMatchObject({
                displayMessage: 'AI scoring completed: 8.7/10',
                statusIcon: '✅',
                statusClass: 'text-success',
                stepProgress: '3/4',
                durationText: '5s'
            });
        });
    });

    describe('Retry suggestion display styling', () => {
        test('should show retry suggestions with appropriate styling classes', () => {
            const entriesWithRetryActions = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'error',
                    created_at: '2025-01-15T10:00:00.000Z',
                    details: {
                        formattedMessage: 'verify failed: Rate limit exceeded (can retry now)',
                        rawData: { error: 'Rate limit exceeded' },
                        contextInfo: {
                            suggested_action: 'retry_immediately',
                            error_type: 'rate_limit_error'
                        }
                    }
                },
                {
                    id: 2,
                    operation: 'ingest',
                    status: 'error',
                    created_at: '2025-01-15T10:01:00.000Z',
                    details: {
                        formattedMessage: 'ingest failed: Server overloaded (retry in a few minutes)',
                        rawData: { error: 'Server overloaded' },
                        contextInfo: {
                            suggested_action: 'retry_later',
                            error_type: 'server_error'
                        }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(entriesWithRetryActions);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            // Both entries should have retry suggestions available
            expect(displayReady[0].suggestedAction).toBe('retry_immediately');
            expect(displayReady[1].suggestedAction).toBe('retry_later');

            // Both should have error styling
            expect(displayReady[0].statusClass).toBe('text-danger');
            expect(displayReady[1].statusClass).toBe('text-danger');

            // Error types should be preserved for conditional styling
            expect(displayReady[0].errorType).toBe('rate_limit_error');
            expect(displayReady[1].errorType).toBe('server_error');
        });

        test('should handle entries without retry suggestions gracefully', () => {
            const entriesWithoutRetry = [
                {
                    id: 1,
                    operation: 'jira_update',
                    status: 'error',
                    created_at: '2025-01-15T10:00:00.000Z',
                    details: {
                        formattedMessage: 'jira_update failed: Invalid credentials',
                        rawData: { error: 'Invalid credentials' },
                        contextInfo: {
                            error_type: 'auth_error'
                            // No suggested_action
                        }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(entriesWithoutRetry);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0]).toMatchObject({
                displayMessage: 'jira_update failed: Invalid credentials',
                statusClass: 'text-danger',
                suggestedAction: undefined, // No retry suggestion
                errorType: 'auth_error'
            });
        });
    });

    describe('Status indicators and styling', () => {
        test('should display error entries with red indicators matching modal styling', () => {
            const errorEntry = {
                id: 1,
                operation: 'verify',
                status: 'error',
                created_at: '2025-01-15T10:00:00.000Z',
                details: {
                    formattedMessage: 'verify failed: Connection timeout',
                    rawData: { error: 'Connection timeout' },
                    contextInfo: {
                        operation: 'verify',
                        status: 'error'
                    }
                }
            };

            const migrated = jobInspector.migrateProcessingHistoryDisplay([errorEntry]);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0]).toMatchObject({
                statusIcon: '❌', // Error icon matching modal
                statusClass: 'text-danger', // Bootstrap danger class for red styling
                displayMessage: 'verify failed: Connection timeout'
            });
        });

        test('should display success entries with green indicators', () => {
            const successEntry = {
                id: 1,
                operation: 'ingest',
                status: 'success',
                created_at: '2025-01-15T10:00:00.000Z',
                details: {
                    formattedMessage: 'Profile data extracted successfully',
                    rawData: { profile_name: 'Test User' },
                    contextInfo: {
                        operation: 'ingest',
                        status: 'success'
                    }
                }
            };

            const migrated = jobInspector.migrateProcessingHistoryDisplay([successEntry]);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0]).toMatchObject({
                statusIcon: '✅', // Success icon matching modal
                statusClass: 'text-success', // Bootstrap success class for green styling
                displayMessage: 'Profile data extracted successfully'
            });
        });

        test('should display in-progress entries with blue indicators', () => {
            const progressEntry = {
                id: 1,
                operation: 'score',
                status: 'in_progress',
                created_at: '2025-01-15T10:00:00.000Z',
                details: {
                    formattedMessage: 'AI scoring in progress...',
                    rawData: {},
                    contextInfo: {
                        operation: 'score',
                        status: 'in_progress'
                    }
                }
            };

            const migrated = jobInspector.migrateProcessingHistoryDisplay([progressEntry]);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0]).toMatchObject({
                statusIcon: '⚙️', // Progress icon matching modal
                statusClass: 'text-primary', // Bootstrap primary class for blue styling
                displayMessage: 'AI scoring in progress...'
            });
        });
    });

    describe('Legacy compatibility in display', () => {
        test('should handle mixed legacy and enhanced entries in display', () => {
            const mixedEntries = [
                // Legacy entry (old format)
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T09:00:00.000Z',
                    duration_ms: 1000,
                    details: {
                        linkedin_url: 'https://linkedin.com/in/legacy-user'
                        // No formattedMessage - this triggers legacy handling
                    }
                },
                // Enhanced entry (new format)
                {
                    id: 2,
                    operation: 'ingest',
                    status: 'error',
                    created_at: '2025-01-15T09:01:00.000Z',
                    duration_ms: 5000,
                    details: {
                        formattedMessage: 'ingest failed: Enhanced error message',
                        rawData: { error: 'Enhanced error message' },
                        contextInfo: {
                            operation: 'ingest',
                            status: 'error',
                            stepNumber: 2,
                            totalSteps: 4
                        }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(mixedEntries);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady).toHaveLength(2);

            // Legacy entry should get generated display message
            expect(displayReady[0]).toMatchObject({
                displayMessage: 'LinkedIn URL verified: https://linkedin.com/in/legacy-user',
                isEnhanced: false,
                typeIndicator: '📝', // Legacy indicator
                statusClass: 'text-success'
            });

            // Enhanced entry should preserve formatted message
            expect(displayReady[1]).toMatchObject({
                displayMessage: 'ingest failed: Enhanced error message',
                isEnhanced: true,
                typeIndicator: '🔄', // Enhanced indicator
                statusClass: 'text-danger',
                stepProgress: '2/4'
            });
        });
    });

    describe('Processing progression display', () => {
        test('should show step progression information correctly', () => {
            const entriesWithSteps = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    details: {
                        formattedMessage: 'LinkedIn URL verified',
                        contextInfo: { stepNumber: 1, totalSteps: 4 }
                    }
                },
                {
                    id: 2,
                    operation: 'score',
                    status: 'success',
                    details: {
                        formattedMessage: 'AI scoring completed',
                        contextInfo: { stepNumber: 3, totalSteps: 4 }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(entriesWithSteps);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0].stepProgress).toBe('1/4');
            expect(displayReady[1].stepProgress).toBe('3/4');
        });

        test('should handle entries without step information gracefully', () => {
            const entriesWithoutSteps = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    details: {
                        formattedMessage: 'LinkedIn URL verified',
                        contextInfo: {} // No step info
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(entriesWithoutSteps);
            const displayReady = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(displayReady[0].stepProgress).toBeNull();
        });
    });
});