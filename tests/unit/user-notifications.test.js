/**
 * Unit Tests: User Notifications for Processing History Failures (LIN-13 Task 2.2)
 * 
 * Tests user-visible feedback when processing history storage fails.
 */

const jobInspector = require('../../utils/jobInspector');

// Mock global window and showToast function
global.window = {
    showToast: jest.fn()
};

describe('User Notifications for Processing History Failures', () => {
    let consoleSpy;
    let originalApiClient;

    beforeEach(() => {
        // Spy on console to suppress logs during testing
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});

        // Clear showToast mock calls
        window.showToast.mockClear();

        // Mock axios to simulate API failures
        jest.doMock('../../config/api', () => ({
            post: jest.fn()
        }));
    });

    afterEach(() => {
        // Restore console
        if (consoleSpy) {
            consoleSpy.mockRestore();
        }
        jest.restoreAllMocks();
    });

    describe('storeProcessingHistory user notifications', () => {
        test('should show user notification when API call fails with network error', async () => {
            // Mock retryApiCall to simulate final failure after retries
            const networkError = new Error('Network connection failed');
            networkError.code = 'ECONNREFUSED';
            
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(networkError);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-001',
                'verify',
                'error',
                { test: 'data' }
            );

            // Verify user notification was shown
            expect(window.showToast).toHaveBeenCalledTimes(1);
            expect(window.showToast).toHaveBeenCalledWith(
                'Processing History Warning',
                'Failed to save processing details for CAN-NOTIFY-001. Network connection failed. Processing continues normally.',
                'warning',
                8000
            );
        });

        test('should show user notification when API call fails with server error', async () => {
            const serverError = new Error('Internal Server Error');
            serverError.response = {
                status: 500,
                data: { detail: 'Database connection failed' }
            };
            
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(serverError);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-002',
                'score',
                'success',
                { score: 85 }
            );

            // Verify user notification was shown with server error details
            expect(window.showToast).toHaveBeenCalledTimes(1);
            expect(window.showToast).toHaveBeenCalledWith(
                'Processing History Warning',
                'Failed to save processing details for CAN-NOTIFY-002. Database connection failed. Processing continues normally.',
                'warning',
                8000
            );
        });

        test('should show generic notification when error has no detailed message', async () => {
            const genericError = new Error();
            // No message, no response data
            
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(genericError);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-003',
                'ingest',
                'error',
                { error: 'Profile not found' }
            );

            // Verify user notification was shown with generic message
            expect(window.showToast).toHaveBeenCalledTimes(1);
            expect(window.showToast).toHaveBeenCalledWith(
                'Processing History Warning',
                'Failed to save processing details for CAN-NOTIFY-003. Unable to save processing details. Processing continues normally.',
                'warning',
                8000
            );
        });

        test('should NOT show notification when window.showToast is not available', async () => {
            // Remove showToast from global window
            delete window.showToast;

            const error = new Error('API failure');
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(error);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-004',
                'verify',
                'error',
                { test: 'data' }
            );

            // Should not crash and should not call showToast (since it doesn't exist)
            // Test passes if no error is thrown
            expect(true).toBe(true);
            
            // Restore showToast for other tests
            window.showToast = jest.fn();
        });

        test('should NOT show notification when running in Node.js environment', async () => {
            // Mock Node.js environment (no window object)
            const originalWindow = global.window;
            delete global.window;

            const error = new Error('API failure');
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(error);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-005',
                'verify',
                'error',
                { test: 'data' }
            );

            // Should not crash when window is undefined
            // Test passes if no error is thrown
            expect(true).toBe(true);
            
            // Restore window for other tests
            global.window = originalWindow;
        });

        test('should show notification with proper warning styling and duration', async () => {
            const error = new Error('Connection timeout');
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(error);

            await jobInspector.storeProcessingHistory(
                'CAN-NOTIFY-006',
                'jira_update',
                'progress',
                { step: 'Updating JIRA' }
            );

            // Verify notification uses warning style and 8-second duration
            expect(window.showToast).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'warning',
                8000
            );
        });
    });

    describe('Integration with processing workflows', () => {
        test('should show notifications during candidate processing failures', async () => {
            // Simulate processing history failure during candidate workflow
            const processingError = new Error('Backend unavailable');
            processingError.response = {
                status: 503,
                data: { detail: 'Service temporarily unavailable' }
            };
            
            jest.spyOn(jobInspector, 'retryApiCall').mockRejectedValueOnce(processingError);

            // Simulate processing step that tries to store history
            await jobInspector.storeProcessingHistory(
                'CAN-WORKFLOW-001',
                'verify',
                'error',
                {
                    error: 'LinkedIn profile verification failed',
                    suggested_action: 'Check profile URL and try again',
                    step_context: { stepNumber: 1, totalSteps: 5 }
                }
            );

            expect(window.showToast).toHaveBeenCalledWith(
                'Processing History Warning',
                'Failed to save processing details for CAN-WORKFLOW-001. Service temporarily unavailable. Processing continues normally.',
                'warning',
                8000
            );
        });
    });
});

/**
 * Test Helper Functions
 */

/**
 * Creates a mock API error response
 */
function createApiError(status, message, detail = null) {
    const error = new Error(message);
    error.response = {
        status,
        data: { detail: detail || message }
    };
    return error;
}

/**
 * Creates a mock network error
 */
function createNetworkError(code = 'ECONNREFUSED', message = 'Network error') {
    const error = new Error(message);
    error.code = code;
    return error;
}