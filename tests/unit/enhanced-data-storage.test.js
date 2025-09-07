/**
 * Unit Tests: Enhanced Data Storage for Processing History (LIN-13 Task 3.2)
 * 
 * Tests the enhanced data structure that stores both formatted messages and raw error data
 * in the details field, allowing for both user display and programmatic analysis.
 */

const jobInspector = require('../../utils/jobInspector');

describe('Enhanced Processing History Data Storage', () => {
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
        test('should include both formatted message and raw data in details structure', () => {
            const rawDetails = {
                error: 'LinkedIn URL validation failed',
                linkedin_url: 'https://linkedin.com/invalid',
                error_type: 'validation_error',
                suggested_action: 'retry_immediately',
                stepNumber: 1,
                totalSteps: 4,
                processingId: 'proc-123'
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'verify', 'error');

            // Should have structured sections
            expect(enhanced).toHaveProperty('rawData');
            expect(enhanced).toHaveProperty('formattedMessage');
            expect(enhanced).toHaveProperty('contextInfo');

            // Raw data should be preserved exactly
            expect(enhanced.rawData).toEqual(rawDetails);

            // Formatted message should be generated
            expect(enhanced.formattedMessage).toBe('verify failed: LinkedIn URL validation failed (can retry now)');

            // Context info should include operation details
            expect(enhanced.contextInfo).toMatchObject({
                operation: 'verify',
                status: 'error',
                stepNumber: 1,
                totalSteps: 4,
                processingId: 'proc-123',
                suggested_action: 'retry_immediately',
                error_type: 'validation_error'
            });
        });

        test('should handle success status with formatted messages', () => {
            const rawDetails = {
                linkedin_url: 'https://linkedin.com/in/johndoe',
                profile_name: 'John Doe',
                score: 8.5,
                stepNumber: 2,
                totalSteps: 4
            };

            const testCases = [
                {
                    operation: 'verify',
                    expectedMessage: 'Verified LinkedIn URL: https://linkedin.com/in/johndoe'
                },
                {
                    operation: 'ingest',
                    expectedMessage: 'Profile extracted: John Doe'
                },
                {
                    operation: 'score',
                    expectedMessage: 'AI scoring completed: 8.5/10'
                }
            ];

            testCases.forEach(({ operation, expectedMessage }) => {
                const enhanced = jobInspector.createEnhancedDetails(rawDetails, operation, 'success');

                expect(enhanced.rawData).toEqual(rawDetails);
                expect(enhanced.formattedMessage).toBe(expectedMessage);
                expect(enhanced.contextInfo).toMatchObject({
                    operation,
                    status: 'success',
                    stepNumber: 2,
                    totalSteps: 4
                });
            });
        });

        test('should preserve step context and processing information', () => {
            const rawDetails = {
                error: 'API timeout',
                step_context: {
                    retryCount: 2,
                    endpoint: '/api/v1/process',
                    duration: 5000
                },
                processing_id: 'proc-456',
                step_number: 3,
                total_steps: 5
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'ingest', 'error');

            // Step context should be preserved in contextInfo
            expect(enhanced.contextInfo).toHaveProperty('step_context');
            expect(enhanced.contextInfo.step_context).toEqual(rawDetails.step_context);

            // Processing ID should be normalized
            expect(enhanced.contextInfo.processingId).toBe('proc-456');

            // Step numbers should be normalized
            expect(enhanced.contextInfo.stepNumber).toBe(3);
            expect(enhanced.contextInfo.totalSteps).toBe(5);
        });

        test('should handle both camelCase and snake_case field names', () => {
            const rawDetails = {
                stepNumber: 1,        // camelCase
                total_steps: 4,       // snake_case
                processingId: 'p1',   // camelCase
                suggested_action: 'retry_later'  // snake_case
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'verify', 'error');

            // Should normalize field names in contextInfo
            expect(enhanced.contextInfo.stepNumber).toBe(1);
            expect(enhanced.contextInfo.totalSteps).toBe(4);
            expect(enhanced.contextInfo.processingId).toBe('p1');
            expect(enhanced.contextInfo.suggested_action).toBe('retry_later');
        });

        test('should add timestamp to contextInfo', () => {
            const rawDetails = { test: 'data' };
            const beforeTime = new Date().toISOString();
            
            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'verify', 'success');
            
            const afterTime = new Date().toISOString();

            // Should have timestamp in ISO format
            expect(enhanced.contextInfo).toHaveProperty('timestamp');
            expect(enhanced.contextInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            
            // Timestamp should be within test execution timeframe
            expect(enhanced.contextInfo.timestamp >= beforeTime).toBe(true);
            expect(enhanced.contextInfo.timestamp <= afterTime).toBe(true);
        });
    });

    describe('Data structure compatibility', () => {
        test('should create data suitable for both user display and programmatic analysis', () => {
            const rawDetails = {
                error: 'Profile extraction timeout',
                error_type: 'timeout_error',
                suggested_action: 'retry_later',
                linkedin_url: 'https://linkedin.com/in/test',
                duration: 30000,
                stepNumber: 2,
                totalSteps: 4
            };

            const enhanced = jobInspector.createEnhancedDetails(rawDetails, 'ingest', 'error');

            // FOR USER DISPLAY:
            // Should have human-readable formatted message
            expect(enhanced.formattedMessage).toBe('ingest failed: Profile extraction timeout (retry in a few minutes)');
            
            // Should have contextual information for UI
            expect(enhanced.contextInfo.operation).toBe('ingest');
            expect(enhanced.contextInfo.status).toBe('error');
            expect(enhanced.contextInfo.stepNumber).toBe(2);
            expect(enhanced.contextInfo.totalSteps).toBe(4);

            // FOR PROGRAMMATIC ANALYSIS:
            // Should have complete raw data for debugging
            expect(enhanced.rawData.error).toBe('Profile extraction timeout');
            expect(enhanced.rawData.error_type).toBe('timeout_error');
            expect(enhanced.rawData.duration).toBe(30000);
            
            // Should have structured error handling information
            expect(enhanced.contextInfo.error_type).toBe('timeout_error');
            expect(enhanced.contextInfo.suggested_action).toBe('retry_later');
            
            // Should be serializable for database storage
            expect(() => JSON.stringify(enhanced)).not.toThrow();
            
            // Should be parseable after serialization
            const serialized = JSON.stringify(enhanced);
            const parsed = JSON.parse(serialized);
            expect(parsed).toEqual(enhanced);
        });

        test('should support analysis queries on stored data', () => {
            const testCases = [
                {
                    rawDetails: { error: 'Timeout', error_type: 'timeout_error' },
                    operation: 'verify',
                    status: 'error'
                },
                {
                    rawDetails: { error: 'Rate limit', error_type: 'rate_limit_error' },
                    operation: 'ingest', 
                    status: 'error'
                },
                {
                    rawDetails: { score: 7.5, profile_name: 'Test User' },
                    operation: 'score',
                    status: 'success'
                }
            ];

            const enhancedEntries = testCases.map(testCase => 
                jobInspector.createEnhancedDetails(testCase.rawDetails, testCase.operation, testCase.status)
            );

            // Should support filtering by operation
            const verifyEntries = enhancedEntries.filter(entry => entry.contextInfo.operation === 'verify');
            expect(verifyEntries).toHaveLength(1);

            // Should support filtering by status
            const errorEntries = enhancedEntries.filter(entry => entry.contextInfo.status === 'error');
            expect(errorEntries).toHaveLength(2);

            // Should support filtering by error type
            const timeoutErrors = enhancedEntries.filter(entry => 
                entry.contextInfo.error_type === 'timeout_error'
            );
            expect(timeoutErrors).toHaveLength(1);

            // Should support extracting metrics from raw data
            const successEntries = enhancedEntries.filter(entry => entry.contextInfo.status === 'success');
            const scores = successEntries.map(entry => entry.rawData.score).filter(Boolean);
            expect(scores).toEqual([7.5]);
        });
    });

    describe('Integration with storeProcessingHistory', () => {
        test('should store enhanced data structure when storeProcessingHistory is called', async () => {
            // Mock the retryApiCall to capture the data being sent
            let capturedData = null;
            const retrySpy = jest.spyOn(jobInspector, 'retryApiCall').mockImplementation(
                async (apiCallFn) => {
                    // Capture the data that would be sent to the API
                    const mockApiCall = apiCallFn.toString().match(/post\([^,]+,\s*(.+?)\)/);
                    if (mockApiCall) {
                        // This is a simplified extraction - in practice, we'd capture the actual call
                        capturedData = 'enhanced-structure';
                    }
                    return { status: 200, data: { success: true, entry_id: 'test-123' } };
                }
            );

            // Mock the createEnhancedDetails method to verify it's called
            const createSpy = jest.spyOn(jobInspector, 'createEnhancedDetails').mockReturnValue({
                rawData: { test: 'data' },
                formattedMessage: 'Test message',
                contextInfo: { operation: 'verify', status: 'success', timestamp: new Date().toISOString() }
            });

            await jobInspector.storeProcessingHistory(
                'CAN-ENHANCED-001',
                'verify',
                'success',
                { linkedin_url: 'https://linkedin.com/in/test' }
            );

            // Should create enhanced details structure
            expect(createSpy).toHaveBeenCalledWith(
                { linkedin_url: 'https://linkedin.com/in/test' },
                'verify',
                'success'
            );

            // Should use retry mechanism
            expect(retrySpy).toHaveBeenCalledTimes(1);

            retrySpy.mockRestore();
            createSpy.mockRestore();
        });
    });

    describe('Backwards compatibility', () => {
        test('should handle legacy data format gracefully', () => {
            // Simulate legacy data that might not have all expected fields
            const legacyDetails = {
                error: 'Old error format',
                // Missing: error_type, suggested_action, step info
            };

            const enhanced = jobInspector.createEnhancedDetails(legacyDetails, 'verify', 'error');

            // Should still create valid enhanced structure
            expect(enhanced).toHaveProperty('rawData');
            expect(enhanced).toHaveProperty('formattedMessage');
            expect(enhanced).toHaveProperty('contextInfo');

            // Raw data preserved
            expect(enhanced.rawData).toEqual(legacyDetails);

            // Formatted message should work with minimal data
            expect(enhanced.formattedMessage).toBe('verify failed: Old error format');

            // Context should handle missing fields gracefully
            expect(enhanced.contextInfo.operation).toBe('verify');
            expect(enhanced.contextInfo.status).toBe('error');
            expect(enhanced.contextInfo.stepNumber).toBeUndefined();
            expect(enhanced.contextInfo.totalSteps).toBeUndefined();
        });

        test('should handle empty or null details gracefully', () => {
            const testCases = [
                { details: {}, expectedMessage: 'verify failed: Unknown error' },
                { details: null, expectedMessage: 'verify failed: Unknown error' },
                { details: undefined, expectedMessage: 'verify failed: Unknown error' }
            ];

            testCases.forEach(({ details, expectedMessage }) => {
                const enhanced = jobInspector.createEnhancedDetails(details || {}, 'verify', 'error');

                expect(enhanced.rawData).toEqual(details || {});
                expect(enhanced.formattedMessage).toBe(expectedMessage);
                expect(enhanced.contextInfo.operation).toBe('verify');
                expect(enhanced.contextInfo.status).toBe('error');
            });
        });
    });
});