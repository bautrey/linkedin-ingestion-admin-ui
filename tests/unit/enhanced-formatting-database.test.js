/**
 * Unit Tests: Enhanced Formatting in Database Storage (LIN-13 Task 3.1)
 * 
 * Tests that formatted display messages are stored alongside raw data in database.
 */

const jobInspector = require('../../utils/jobInspector');

describe('Enhanced Formatting in Database Storage', () => {
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

    describe('createEnhancedDetails method', () => {
        test('should structure data with formatted messages and raw data', () => {
            const rawDetails = {
                error: 'LinkedIn API rate limit exceeded',
                error_type: 'rate_limiting',
                suggested_action: 'retry_later'
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'verify', 'error');

            expect(enhanced).toHaveProperty('rawData', rawDetails);
            expect(enhanced).toHaveProperty('formattedMessage');
            expect(enhanced).toHaveProperty('contextInfo');
            expect(enhanced.formattedMessage).toBe('verify failed: LinkedIn API rate limit exceeded (retry in a few minutes)');
        });

        test('should preserve retry suggestions in context info', () => {
            const rawDetails = {
                error: 'Network timeout',
                suggested_action: 'retry_immediately'
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'ingest', 'error');

            expect(enhanced.contextInfo.suggested_action).toBe('retry_immediately');
            expect(enhanced.formattedMessage).toBe('ingest failed: Network timeout (can retry now)');
        });

        test('should preserve processing step context', () => {
            const rawDetails = {
                score: 8.5,
                stepNumber: 3,
                totalSteps: 5,
                processingId: 'proc-123',
                step_context: { currentPhase: 'scoring' }
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'score', 'success');

            expect(enhanced.contextInfo.stepNumber).toBe(3);
            expect(enhanced.contextInfo.totalSteps).toBe(5);
            expect(enhanced.contextInfo.processingId).toBe('proc-123');
            expect(enhanced.contextInfo.step_context).toEqual({ currentPhase: 'scoring' });
        });

        test('should handle alternative field names for processing context', () => {
            const rawDetails = {
                step_number: 2,
                total_steps: 4,
                processing_id: 'proc-456'
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'verify', 'success');

            expect(enhanced.contextInfo.stepNumber).toBe(2);
            expect(enhanced.contextInfo.totalSteps).toBe(4);
            expect(enhanced.contextInfo.processingId).toBe('proc-456');
        });

        test('should preserve error type information', () => {
            const rawDetails = {
                error: 'Profile not found',
                error_type: 'data_not_found'
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'ingest', 'error');

            expect(enhanced.contextInfo.error_type).toBe('data_not_found');
        });
    });

    describe('generateFormattedMessage method', () => {
        test('should format error messages with retry suggestions', () => {
            const data = {
                error: 'LinkedIn API rate limit exceeded',
                suggested_action: 'retry_later'
            };

            const formatted = jobInspector.generateFormattedMessage(data, 'verify', 'error');

            expect(formatted).toBe('verify failed: LinkedIn API rate limit exceeded (retry in a few minutes)');
        });

        test('should format immediate retry suggestions', () => {
            const data = {
                error: 'Network connection timeout',
                suggested_action: 'retry_immediately'
            };

            const formatted = jobInspector.generateFormattedMessage(data, 'score', 'error');

            expect(formatted).toBe('score failed: Network connection timeout (can retry now)');
        });

        test('should format success messages with operation-specific details', () => {
            const testCases = [
                {
                    data: { linkedin_url: 'https://linkedin.com/in/johndoe' },
                    operation: 'verify',
                    status: 'success',
                    expected: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe'
                },
                {
                    data: { profile_name: 'John Doe' },
                    operation: 'ingest',
                    status: 'success',
                    expected: 'Profile extracted: John Doe'
                },
                {
                    data: { score: 8.7 },
                    operation: 'score',
                    status: 'success',
                    expected: 'AI scoring completed: 8.7/10'
                },
                {
                    data: {},
                    operation: 'jira_update',
                    status: 'success',
                    expected: 'JIRA fields updated successfully'
                }
            ];

            testCases.forEach(({ data, operation, status, expected }) => {
                const formatted = jobInspector.generateFormattedMessage(data, operation, status);
                expect(formatted).toBe(expected);
            });
        });

        test('should format in-progress messages', () => {
            const testCases = [
                { operation: 'verify', expected: 'Verifying LinkedIn URL...' },
                { operation: 'ingest', expected: 'Extracting profile data...' },
                { operation: 'score', expected: 'AI scoring in progress...' },
                { operation: 'jira_update', expected: 'Updating JIRA with results...' },
                { operation: 'custom_op', expected: 'custom_op in progress...' }
            ];

            testCases.forEach(({ operation, expected }) => {
                const formatted = jobInspector.generateFormattedMessage({}, operation, 'progress');
                expect(formatted).toBe(expected);
            });
        });

        test('should handle nested data structures', () => {
            const data = {
                context: {
                    result: {
                        linkedin_url: 'https://linkedin.com/in/janedoe',
                        profile_name: 'Jane Doe',
                        score: 9.2
                    }
                }
            };

            const verifyFormatted = jobInspector.generateFormattedMessage(data, 'verify', 'success');
            expect(verifyFormatted).toBe('Verified LinkedIn URL: https://linkedin.com/in/janedoe');

            const ingestFormatted = jobInspector.generateFormattedMessage(data, 'ingest', 'success');
            expect(ingestFormatted).toBe('Profile extracted: Jane Doe');

            const scoreFormatted = jobInspector.generateFormattedMessage(data, 'score', 'success');
            expect(scoreFormatted).toBe('AI scoring completed: 9.2/10');
        });

        test('should handle missing or empty error messages', () => {
            const formatted1 = jobInspector.generateFormattedMessage({}, 'verify', 'error');
            expect(formatted1).toBe('verify failed: Unknown error');

            const formatted2 = jobInspector.generateFormattedMessage({ message: '' }, 'ingest', 'failed');
            expect(formatted2).toBe('ingest failed: Unknown error');
        });
    });

    describe('integration with storeProcessingHistory', () => {
        test('should call createEnhancedDetails when storing processing history', async () => {
            // Spy on createEnhancedDetails to verify it's being called
            const createEnhancedDetailsSpy = jest.spyOn(jobInspector, 'createEnhancedDetails');
            
            // Mock retryApiCall to avoid actual API calls
            jest.spyOn(jobInspector, 'retryApiCall').mockResolvedValue({
                status: 200,
                data: { success: true, entry_id: 'test-entry' }
            });

            const rawDetails = {
                error: 'Profile verification failed',
                suggested_action: 'retry_later',
                stepNumber: 1,
                totalSteps: 3
            };

            await jobInspector.storeProcessingHistory(
                'CAN-FORMAT-001',
                'verify',
                'error',
                rawDetails
            );

            expect(createEnhancedDetailsSpy).toHaveBeenCalledWith(rawDetails, 'verify', 'error');
            expect(createEnhancedDetailsSpy).toHaveReturnedWith(expect.objectContaining({
                rawData: rawDetails,
                formattedMessage: expect.stringContaining('verify failed'),
                contextInfo: expect.objectContaining({
                    suggested_action: 'retry_later',
                    stepNumber: 1,
                    totalSteps: 3
                })
            }));
        });
    });

    describe('backwards compatibility', () => {
        test('should handle legacy processing history entries gracefully', () => {
            const legacyData = {
                // Old format - just plain data without enhanced structure
                message: 'Processing completed',
                duration: 1500
            };

            const enhanced = jobInspector.createEnhancedDetails(legacyData, 'legacy_op', 'success');

            expect(enhanced.rawData).toBe(legacyData);
            expect(enhanced.formattedMessage).toBe('legacy_op completed successfully');
            expect(enhanced.contextInfo.operation).toBe('legacy_op');
            expect(enhanced.contextInfo.status).toBe('success');
        });
    });
});

/**
 * Test Helper Functions
 */

/**
 * Creates sample processing data for testing
 */
function createSampleProcessingData(overrides = {}) {
    return {
        stepNumber: 2,
        totalSteps: 5,
        processingId: 'proc-test-123',
        error: 'Test error message',
        suggested_action: 'retry_later',
        ...overrides
    };
}