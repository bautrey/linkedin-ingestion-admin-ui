/**
 * Unit Tests: Processing History Migration Handler (LIN-13 Task 3.2)
 * 
 * Tests the migration handler that displays legacy processing history entries
 * alongside enhanced ones, ensuring backwards compatibility.
 */

const jobInspector = require('../../utils/jobInspector');

describe('Processing History Migration Handler', () => {
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

    describe('migrateProcessingHistoryDisplay method', () => {
        test('should handle mixed legacy and enhanced entries', () => {
            const mixedEntries = [
                // Enhanced entry (new format)
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T10:00:00.000Z',
                    duration_ms: 2000,
                    details: {
                        formattedMessage: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe',
                        rawData: { linkedin_url: 'https://linkedin.com/in/johndoe' },
                        contextInfo: {
                            operation: 'verify',
                            status: 'success',
                            stepNumber: 1,
                            totalSteps: 4,
                            timestamp: '2025-01-15T10:00:00.000Z'
                        }
                    }
                },
                // Legacy entry (old format)
                {
                    id: 2,
                    operation: 'ingest',
                    status: 'error',
                    created_at: '2025-01-15T10:01:00.000Z',
                    duration_ms: 5000,
                    details: {
                        error: 'Profile extraction timeout',
                        suggested_action: 'retry_later',
                        error_type: 'timeout_error'
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(mixedEntries);

            expect(migrated).toHaveLength(2);

            // Enhanced entry should preserve formatted message
            expect(migrated[0]).toMatchObject({
                id: 1,
                operation: 'verify',
                status: 'success',
                displayMessage: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe',
                stepNumber: 1,
                totalSteps: 4,
                isEnhanced: true
            });

            // Legacy entry should have generated display message
            expect(migrated[1]).toMatchObject({
                id: 2,
                operation: 'ingest',
                status: 'error',
                displayMessage: 'ingest failed: Profile extraction timeout (retry in a few minutes)',
                suggestedAction: 'retry_later',
                errorType: 'timeout_error',
                isEnhanced: false
            });
        });

        test('should handle all enhanced entries', () => {
            const enhancedEntries = [
                {
                    id: 1,
                    operation: 'score',
                    status: 'success',
                    created_at: '2025-01-15T10:00:00.000Z',
                    details: {
                        formattedMessage: 'AI scoring completed: 8.5/10',
                        rawData: { score: 8.5, profile_name: 'John Doe' },
                        contextInfo: {
                            operation: 'score',
                            status: 'success',
                            stepNumber: 3,
                            totalSteps: 4
                        }
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(enhancedEntries);

            expect(migrated).toHaveLength(1);
            expect(migrated[0]).toMatchObject({
                id: 1,
                displayMessage: 'AI scoring completed: 8.5/10',
                stepNumber: 3,
                totalSteps: 4,
                isEnhanced: true,
                rawData: { score: 8.5, profile_name: 'John Doe' }
            });
        });

        test('should handle all legacy entries', () => {
            const legacyEntries = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T09:00:00.000Z',
                    details: {
                        linkedin_url: 'https://linkedin.com/in/legacy'
                    }
                },
                {
                    id: 2,
                    operation: 'jira_update',
                    status: 'error',
                    created_at: '2025-01-15T09:01:00.000Z',
                    details: {
                        error: 'JIRA API timeout',
                        suggested_action: 'retry_immediately'
                    }
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(legacyEntries);

            expect(migrated).toHaveLength(2);
            
            expect(migrated[0]).toMatchObject({
                id: 1,
                displayMessage: 'LinkedIn URL verified: https://linkedin.com/in/legacy',
                isEnhanced: false
            });

            expect(migrated[1]).toMatchObject({
                id: 2,
                displayMessage: 'jira_update failed: JIRA API timeout (can retry now)',
                suggestedAction: 'retry_immediately',
                isEnhanced: false
            });
        });

        test('should handle empty or null entries gracefully', () => {
            const testCases = [null, undefined, [], {}];

            testCases.forEach(testCase => {
                const migrated = jobInspector.migrateProcessingHistoryDisplay(testCase);
                expect(migrated).toEqual([]);
            });
        });

        test('should handle entries with missing details', () => {
            const entriesWithMissingDetails = [
                {
                    id: 1,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T10:00:00.000Z'
                    // No details field
                },
                {
                    id: 2,
                    operation: 'ingest',
                    status: 'error',
                    created_at: '2025-01-15T10:01:00.000Z',
                    details: null
                }
            ];

            const migrated = jobInspector.migrateProcessingHistoryDisplay(entriesWithMissingDetails);

            expect(migrated).toHaveLength(2);
            
            expect(migrated[0]).toMatchObject({
                id: 1,
                displayMessage: 'LinkedIn URL verification completed',
                isEnhanced: false,
                rawData: {}
            });

            expect(migrated[1]).toMatchObject({
                id: 2,
                displayMessage: 'ingest failed: Unknown error occurred',
                isEnhanced: false,
                rawData: {}
            });
        });
    });

    describe('generateLegacyDisplayMessage method', () => {
        test('should generate proper error messages for legacy entries', () => {
            const testCases = [
                {
                    entry: {
                        operation: 'verify',
                        status: 'error',
                        details: { error: 'Invalid LinkedIn URL' }
                    },
                    expected: 'verify failed: Invalid LinkedIn URL'
                },
                {
                    entry: {
                        operation: 'ingest',
                        status: 'failed',
                        details: { 
                            error: 'Timeout error',
                            suggested_action: 'retry_later'
                        }
                    },
                    expected: 'ingest failed: Timeout error (retry in a few minutes)'
                },
                {
                    entry: {
                        operation: 'score',
                        status: 'error',
                        details: { 
                            message: 'API quota exceeded',
                            suggested_action: 'retry_immediately'
                        }
                    },
                    expected: 'score failed: API quota exceeded (can retry now)'
                }
            ];

            testCases.forEach(({ entry, expected }) => {
                const message = jobInspector.generateLegacyDisplayMessage(entry);
                expect(message).toBe(expected);
            });
        });

        test('should generate proper success messages for legacy entries', () => {
            const testCases = [
                {
                    entry: {
                        operation: 'verify',
                        status: 'success',
                        details: { linkedin_url: 'https://linkedin.com/in/test' }
                    },
                    expected: 'LinkedIn URL verified: https://linkedin.com/in/test'
                },
                {
                    entry: {
                        operation: 'ingest',
                        status: 'completed',
                        details: { profile_name: 'Jane Smith' }
                    },
                    expected: 'Profile data extracted: Jane Smith'
                },
                {
                    entry: {
                        operation: 'score',
                        status: 'success',
                        details: { total_score: 7.2 }
                    },
                    expected: 'AI scoring completed: 7.2/10'
                },
                {
                    entry: {
                        operation: 'jira_update',
                        status: 'success',
                        details: {}
                    },
                    expected: 'JIRA fields updated successfully'
                }
            ];

            testCases.forEach(({ entry, expected }) => {
                const message = jobInspector.generateLegacyDisplayMessage(entry);
                expect(message).toBe(expected);
            });
        });

        test('should handle in-progress status', () => {
            const progressEntries = [
                {
                    operation: 'verify',
                    status: 'progress',
                    details: {}
                },
                {
                    operation: 'score',
                    status: 'in_progress',
                    details: {}
                }
            ];

            progressEntries.forEach(entry => {
                const message = jobInspector.generateLegacyDisplayMessage(entry);
                expect(message).toBe(`${entry.operation} in progress...`);
            });
        });
    });

    describe('formatProcessingHistoryForUI method', () => {
        test('should add UI-specific formatting to migrated entries', () => {
            const migratedEntry = {
                id: 1,
                operation: 'verify',
                status: 'success',
                timestamp: '2025-01-15T10:00:00.000Z',
                duration_ms: 2500,
                displayMessage: 'LinkedIn URL verified',
                stepNumber: 1,
                totalSteps: 4,
                isEnhanced: true
            };

            const formatted = jobInspector.formatProcessingHistoryForUI(migratedEntry);

            expect(formatted).toMatchObject({
                ...migratedEntry,
                statusIcon: '✅',
                statusClass: 'text-success',
                durationText: '3s', // 2500ms rounded to 3s
                stepProgress: '1/4',
                typeIndicator: '🔄' // Enhanced entry indicator
            });

            // Should have timeAgo field
            expect(formatted.timeAgo).toMatch(/ago/);
        });

        test('should handle legacy entry formatting', () => {
            const legacyEntry = {
                id: 2,
                operation: 'ingest',
                status: 'error',
                timestamp: '2025-01-15T09:00:00.000Z',
                duration_ms: null,
                displayMessage: 'ingest failed: Timeout',
                isEnhanced: false
            };

            const formatted = jobInspector.formatProcessingHistoryForUI(legacyEntry);

            expect(formatted).toMatchObject({
                ...legacyEntry,
                statusIcon: '❌',
                statusClass: 'text-danger',
                durationText: null, // No duration
                stepProgress: null, // No step info
                typeIndicator: '📝' // Legacy entry indicator
            });
        });

        test('should handle entries with missing optional fields', () => {
            const minimalEntry = {
                id: 3,
                operation: 'unknown',
                status: 'unknown',
                timestamp: '2025-01-15T08:00:00.000Z',
                displayMessage: 'Unknown operation',
                isEnhanced: false
            };

            const formatted = jobInspector.formatProcessingHistoryForUI(minimalEntry);

            expect(formatted).toMatchObject({
                ...minimalEntry,
                statusIcon: '📝', // Default icon
                statusClass: 'text-muted', // Default class
                durationText: null,
                stepProgress: null,
                typeIndicator: '📝'
            });
        });
    });

    describe('Integration with processing history display', () => {
        test('should provide complete migration pipeline', () => {
            // Simulate mixed database entries
            const databaseEntries = [
                // Legacy entry
                {
                    id: 100,
                    operation: 'verify',
                    status: 'success',
                    created_at: '2025-01-15T08:00:00.000Z',
                    duration_ms: 1200,
                    details: {
                        linkedin_url: 'https://linkedin.com/in/legacy-user'
                    }
                },
                // Enhanced entry  
                {
                    id: 101,
                    operation: 'score',
                    status: 'success',
                    created_at: '2025-01-15T08:01:00.000Z',
                    duration_ms: 3500,
                    details: {
                        formattedMessage: 'AI scoring completed: 9.2/10',
                        rawData: { score: 9.2, profile_name: 'Enhanced User' },
                        contextInfo: {
                            operation: 'score',
                            status: 'success',
                            stepNumber: 3,
                            totalSteps: 4
                        }
                    }
                }
            ];

            // Complete migration pipeline
            const migrated = jobInspector.migrateProcessingHistoryDisplay(databaseEntries);
            const formatted = migrated.map(entry => jobInspector.formatProcessingHistoryForUI(entry));

            expect(formatted).toHaveLength(2);

            // Legacy entry should be properly migrated and formatted
            expect(formatted[0]).toMatchObject({
                id: 100,
                displayMessage: 'LinkedIn URL verified: https://linkedin.com/in/legacy-user',
                statusIcon: '✅',
                statusClass: 'text-success',
                durationText: '1s',
                isEnhanced: false,
                typeIndicator: '📝'
            });

            // Enhanced entry should preserve formatting
            expect(formatted[1]).toMatchObject({
                id: 101,
                displayMessage: 'AI scoring completed: 9.2/10',
                statusIcon: '✅',
                statusClass: 'text-success',
                durationText: '4s',
                stepProgress: '3/4',
                isEnhanced: true,
                typeIndicator: '🔄'
            });
        });
    });
});