/**
 * Unit Tests: Retry Mechanism for Processing History (LIN-13 Task 2.1)
 * 
 * Tests the retry mechanism implemented in jobInspector.retryApiCall()
 * for handling transient failures in processing history storage.
 */

const jobInspector = require('../../utils/jobInspector');

describe('Processing History Retry Mechanism', () => {
    let mockApiCall;
    let consoleSpy;

    beforeEach(() => {
        // Spy on console to suppress logs during testing
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});

        // Reset mock function
        mockApiCall = jest.fn();
    });

    afterEach(() => {
        // Restore console
        if (consoleSpy) {
            consoleSpy.mockRestore();
        }
        jest.restoreAllMocks();
    });

    describe('retryApiCall method', () => {
        test('should succeed on first attempt when API call works', async () => {
            const mockResponse = { status: 200, data: { success: true } };
            mockApiCall.mockResolvedValueOnce(mockResponse);

            const result = await jobInspector.retryApiCall(
                mockApiCall, 
                'CAN-RETRY-001', 
                'verify', 
                3
            );

            expect(result).toBe(mockResponse);
            expect(mockApiCall).toHaveBeenCalledTimes(1);
        });

        test('should retry on network errors and succeed on second attempt', async () => {
            const networkError = new Error('Network timeout');
            networkError.code = 'ETIMEDOUT';
            
            const mockResponse = { status: 200, data: { success: true } };
            
            mockApiCall
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockResponse);

            const result = await jobInspector.retryApiCall(
                mockApiCall, 
                'CAN-RETRY-002', 
                'ingest', 
                3
            );

            expect(result).toBe(mockResponse);
            expect(mockApiCall).toHaveBeenCalledTimes(2);
        });

        test('should retry on 5xx server errors', async () => {
            const serverError = new Error('Internal Server Error');
            serverError.response = { status: 500, data: { error: 'Internal error' } };
            
            const mockResponse = { status: 200, data: { success: true } };
            
            mockApiCall
                .mockRejectedValueOnce(serverError)
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce(mockResponse);

            const result = await jobInspector.retryApiCall(
                mockApiCall, 
                'CAN-RETRY-003', 
                'score', 
                3
            );

            expect(result).toBe(mockResponse);
            expect(mockApiCall).toHaveBeenCalledTimes(3);
        });

        test('should retry on 429 rate limit errors', async () => {
            const rateLimitError = new Error('Too Many Requests');
            rateLimitError.response = { status: 429, data: { error: 'Rate limit exceeded' } };
            
            const mockResponse = { status: 200, data: { success: true } };
            
            mockApiCall
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(mockResponse);

            const result = await jobInspector.retryApiCall(
                mockApiCall, 
                'CAN-RETRY-004', 
                'jira_update', 
                3
            );

            expect(result).toBe(mockResponse);
            expect(mockApiCall).toHaveBeenCalledTimes(2);
        });

        test('should NOT retry on 4xx client errors (except 429)', async () => {
            const clientErrors = [
                { status: 400, name: 'Bad Request' },
                { status: 401, name: 'Unauthorized' },
                { status: 403, name: 'Forbidden' },
                { status: 404, name: 'Not Found' },
                { status: 422, name: 'Unprocessable Entity' }
            ];

            for (const errorCase of clientErrors) {
                const clientError = new Error(errorCase.name);
                clientError.response = { status: errorCase.status, data: { error: errorCase.name } };
                
                mockApiCall.mockRejectedValueOnce(clientError);

                await expect(
                    jobInspector.retryApiCall(mockApiCall, 'CAN-RETRY-005', 'verify', 3)
                ).rejects.toThrow(errorCase.name);

                expect(mockApiCall).toHaveBeenCalledTimes(1);
                mockApiCall.mockReset();
            }
        });

        test('should fail after max retries exhausted', async () => {
            const persistentError = new Error('Service Unavailable');
            persistentError.response = { status: 503, data: { error: 'Service down' } };
            
            mockApiCall.mockRejectedValue(persistentError);

            await expect(
                jobInspector.retryApiCall(mockApiCall, 'CAN-RETRY-006', 'verify', 3)
            ).rejects.toThrow('Service Unavailable');

            expect(mockApiCall).toHaveBeenCalledTimes(3);
        });

        test('should use exponential backoff between retries', async () => {
            const networkError = new Error('Connection timeout');
            const mockResponse = { status: 200, data: { success: true } };
            
            mockApiCall
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockResponse);

            // Spy on setTimeout to verify backoff timing
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
                // Execute immediately in tests, but verify delay values
                fn();
                return {}; // Mock timer handle
            });

            const result = await jobInspector.retryApiCall(
                mockApiCall, 
                'CAN-RETRY-007', 
                'score', 
                3
            );

            expect(result).toBe(mockResponse);
            expect(mockApiCall).toHaveBeenCalledTimes(3);
            
            // Verify exponential backoff delays: 1000ms, then 2000ms
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

            setTimeoutSpy.mockRestore();
        });

        test('should limit maximum delay to 10 seconds', async () => {
            const networkError = new Error('Connection timeout');
            
            mockApiCall.mockRejectedValue(networkError);

            // Spy on setTimeout to verify max delay cap
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
                fn();
                return {};
            });

            await expect(
                jobInspector.retryApiCall(mockApiCall, 'CAN-RETRY-008', 'verify', 5)
            ).rejects.toThrow('Connection timeout');

            // Check that delays don't exceed 10 seconds (10000ms)
            const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
            expect(delays.every(delay => delay <= 10000)).toBe(true);

            setTimeoutSpy.mockRestore();
        });
    });

    describe('Integration with storeProcessingHistory', () => {
        test('should use retry mechanism in storeProcessingHistory calls', async () => {
            // This test verifies the integration is working by checking that
            // storeProcessingHistory actually uses the retryApiCall method
            
            // Mock the retryApiCall method to verify it's being called
            const retrySpy = jest.spyOn(jobInspector, 'retryApiCall').mockResolvedValue({
                status: 200,
                data: { success: true, entry_id: 'test-entry' }
            });

            await jobInspector.storeProcessingHistory(
                'CAN-INTEGRATION-001',
                'verify',
                'success',
                { test: 'data' }
            );

            expect(retrySpy).toHaveBeenCalledTimes(1);
            expect(retrySpy).toHaveBeenCalledWith(
                expect.any(Function), // The API call function
                'CAN-INTEGRATION-001',
                'verify',
                3 // max retries
            );

            retrySpy.mockRestore();
        });
    });
});

/**
 * Test Helper Functions
 */

/**
 * Creates a mock network error
 */
function createNetworkError(message = 'Network error') {
    const error = new Error(message);
    error.code = 'ECONNREFUSED';
    return error;
}

/**
 * Creates a mock HTTP error response
 */
function createHttpError(status, message = 'HTTP error') {
    const error = new Error(message);
    error.response = {
        status,
        data: { error: message }
    };
    return error;
}