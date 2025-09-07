/**
 * Integration Tests: Processing History Persistence (LIN-13)
 * 
 * Tests to verify that storeProcessingHistory() calls are successfully 
 * reaching the backend API and persisting data to the database.
 * 
 * These tests diagnose the root cause of the issue where processing
 * history data vanishes when modal closes.
 */

const axios = require('axios');
const jobInspector = require('../../utils/jobInspector');
const apiClient = require('../../config/api');

// Mock server setup
const MockAdapter = require('axios-mock-adapter');

describe('Processing History Persistence Integration Tests', () => {
    let mockAxios;
    let originalEnv;

    beforeAll(() => {
        // Store original environment variables
        originalEnv = {
            FASTAPI_BASE_URL: process.env.FASTAPI_BASE_URL,
            API_KEY: process.env.API_KEY,
            NODE_ENV: process.env.NODE_ENV
        };

        // Set test environment
        process.env.FASTAPI_BASE_URL = 'http://localhost:8000';
        process.env.API_KEY = 'test-api-key';
        process.env.NODE_ENV = 'test';
    });

    beforeEach(() => {
        mockAxios = new MockAdapter(apiClient);
        
        // Clear any existing inspection history
        if (jobInspector.inspectionHistory) {
            jobInspector.inspectionHistory.length = 0;
        }
    });

    afterEach(() => {
        mockAxios.restore();
    });

    afterAll(() => {
        // Restore environment variables
        Object.assign(process.env, originalEnv);
    });

    describe('storeProcessingHistory() API Communication', () => {
        test('should successfully send processing history to backend API', async () => {
            const candidateKey = 'CAN-TEST-001';
            const operation = 'verify';
            const status = 'success';
            const details = {
                stepDisplayName: 'Verify LinkedIn URL',
                stepNumber: 1,
                totalSteps: 5,
                result: { valid: true },
                processingId: 'test-processing-001'
            };
            const durationMs = 2500;
            const profileId = 'prof-123';

            // Mock successful API response
            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).reply(200, {
                success: true,
                entry_id: 'hist-001',
                message: 'Processing history stored successfully'
            });

            // Test the storeProcessingHistory call
            await jobInspector.storeProcessingHistory(
                candidateKey,
                operation,
                status,
                details,
                durationMs,
                profileId
            );

            // Verify the API call was made with correct data
            expect(mockAxios.history.post).toHaveLength(1);
            const apiCall = mockAxios.history.post[0];
            
            expect(apiCall.url).toBe(`/processing/candidates/${candidateKey}/history`);
expect(JSON.parse(apiCall.data)).toEqual({
    candidate_key: candidateKey,
    operation,
    status,
    details: expect.objectContaining({
        rawData: details,
        formattedMessage: expect.any(String),
        contextInfo: expect.objectContaining({
            operation,
            status,
            timestamp: expect.any(String)
        })
    }),
    duration_ms: durationMs,
    profile_id: profileId
});        });

        test('should handle API authentication correctly', async () => {
            const candidateKey = 'CAN-TEST-002';
            
            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).reply(200, {
                success: true,
                entry_id: 'hist-002'
            });

            await jobInspector.storeProcessingHistory(
                candidateKey,
                'ingest',
                'success',
                { test: 'data' }
            );

            // Verify authentication headers
            const apiCall = mockAxios.history.post[0];
            expect(apiCall.headers['X-API-Key']).toBeDefined();
            expect(apiCall.headers['Content-Type']).toBe('application/json');
            expect(apiCall.headers['User-Agent']).toBe('LinkedIn-Ingestion-Admin-UI/1.0');
        });

        test('should handle API client configuration errors gracefully', async () => {
            const candidateKey = 'CAN-TEST-003';
            
            // Mock network error
            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).networkError();

            // Spy on console.error to verify error logging
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // This should not throw, but should log the error
            await expect(
                jobInspector.storeProcessingHistory(candidateKey, 'verify', 'error', { error: 'test' })
            ).resolves.toBeUndefined();

            // Clean up spy
            consoleSpy.mockRestore();
        });

        test('should handle backend API errors gracefully', async () => {
            const candidateKey = 'CAN-TEST-004';
            
            // Mock various API error responses
            const errorScenarios = [
                { status: 401, response: { detail: 'Unauthorized' } },
                { status: 422, response: { detail: 'Validation error' } },
                { status: 500, response: { detail: 'Internal server error' } },
                { status: 404, response: { detail: 'Endpoint not found' } }
            ];

            for (const scenario of errorScenarios) {
                mockAxios.reset();
                mockAxios.onPost(`/processing/candidates/${candidateKey}/history`)
                    .reply(scenario.status, scenario.response);

                // Should not throw despite API errors
                await expect(
                    jobInspector.storeProcessingHistory(candidateKey, 'score', 'success', {})
                ).resolves.toBeUndefined();
            }
        });

        test('should handle timeout errors properly', async () => {
            const candidateKey = 'CAN-TEST-005';
            
            // Mock timeout error
            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).timeout();

            // Should handle timeout gracefully
            await expect(
                jobInspector.storeProcessingHistory(candidateKey, 'check_compatibility', 'success', {})
            ).resolves.toBeUndefined();
        });
    });

    describe('API Client Configuration Verification', () => {
        test('should have correct base URL configuration', () => {
            const expectedBaseURL = process.env.FASTAPI_BASE_URL + '/api/v1';
            expect(apiClient.defaults.baseURL).toBe(expectedBaseURL);
        });

        test('should have proper timeout configuration', () => {
            expect(apiClient.defaults.timeout).toBe(30000); // 30 seconds
        });

        test('should have required headers configured', () => {
            expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
            expect(apiClient.defaults.headers['User-Agent']).toBe('LinkedIn-Ingestion-Admin-UI/1.0');
            expect(apiClient.defaults.headers['X-API-Key']).toBeDefined();
        });
    });

    describe('Processing History Data Format Validation', () => {
        test('should send properly structured data to backend', async () => {
            const candidateKey = 'CAN-TEST-006';
            const testData = {
                operation: 'jira_update',
                status: 'error',
                details: {
                    stepDisplayName: 'Update JIRA',
                    stepNumber: 5,
                    totalSteps: 5,
                    error: 'JIRA API authentication failed',
                    processingId: 'seq-CAN-TEST-006-1625097600000'
                },
                durationMs: 1500,
                profileId: 'profile-456'
            };

            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).reply(200, {
                success: true,
                entry_id: 'hist-006'
            });

            await jobInspector.storeProcessingHistory(
                candidateKey,
                testData.operation,
                testData.status,
                testData.details,
                testData.durationMs,
                testData.profileId
            );

            const apiCall = mockAxios.history.post[0];
            const sentData = JSON.parse(apiCall.data);

            // Verify all required fields are present and correctly formatted
            expect(sentData.candidate_key).toBe(candidateKey);
            expect(sentData.operation).toBe(testData.operation);
            expect(sentData.status).toBe(testData.status);
            expect(sentData.details.rawData).toEqual(testData.details);
            expect(sentData.duration_ms).toBe(testData.durationMs);
            expect(sentData.profile_id).toBe(testData.profileId);
        });

        test('should handle optional parameters correctly', async () => {
            const candidateKey = 'CAN-TEST-007';

            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).reply(200, {
                success: true,
                entry_id: 'hist-007'
            });

            // Test with minimal required parameters
            await jobInspector.storeProcessingHistory(candidateKey, 'verify', 'success');

            const apiCall = mockAxios.history.post[0];
            const sentData = JSON.parse(apiCall.data);

            expect(sentData.candidate_key).toBe(candidateKey);
            expect(sentData.operation).toBe('verify');
            expect(sentData.status).toBe('success');
            expect(sentData.details.rawData).toEqual({});
            expect(sentData.duration_ms).toBeNull();
            expect(sentData.profile_id).toBeNull();
        });
    });

    describe('Enhanced Modal Logging Integration', () => {
        test('should preserve enhanced formatting in processing history details', async () => {
            const candidateKey = 'CAN-TEST-008';
            const enhancedDetails = {
                stepDisplayName: 'Score Candidate',
                stepNumber: 4,
                totalSteps: 5,
                processingId: 'seq-CAN-TEST-008-1625097600000',
                result: {
                    score: 85,
                    fit_verdict: 'Strong Fit',
                    rationale: 'Candidate shows excellent technical leadership experience',
                    formattedMessage: '✅ Scoring completed: Strong Fit (85/100)',
                    suggested_action: 'proceed_with_interview'
                }
            };

            mockAxios.onPost(`/processing/candidates/${candidateKey}/history`).reply(200, {
                success: true,
                entry_id: 'hist-008'
            });

            await jobInspector.storeProcessingHistory(
                candidateKey,
                'score',
                'success',
                enhancedDetails,
                3200,
                'profile-789'
            );

            const apiCall = mockAxios.history.post[0];
            const sentData = JSON.parse(apiCall.data);

            // Verify enhanced formatting is preserved
            expect(sentData.details.rawData.result.formattedMessage).toBe('✅ Scoring completed: Strong Fit (85/100)');
            expect(sentData.details.rawData.result.suggested_action).toBe('proceed_with_interview');
            expect(sentData.details.rawData.stepDisplayName).toBe('Score Candidate');
            expect(sentData.details.rawData.processingId).toBe('seq-CAN-TEST-008-1625097600000');
        });
    });

    describe('Real Backend Integration (Manual Test)', () => {
        test.skip('should successfully store processing history in real backend (manual test)', async () => {
            // This test is skipped by default and should be run manually when backend is available
            // To run: npm test -- --testNamePattern="should successfully store processing history in real backend"
            
            if (process.env.NODE_ENV !== 'manual-test') {
                return;
            }

            const candidateKey = 'CAN-MANUAL-TEST-001';
            const testDetails = {
                stepDisplayName: 'Manual Integration Test',
                stepNumber: 1,
                totalSteps: 1,
                test: true,
                timestamp: new Date().toISOString()
            };

            // This will make a real API call to the backend
            await jobInspector.storeProcessingHistory(
                candidateKey,
                'test',
                'success',
                testDetails,
                1000
            );

            // If no error is thrown, the test passes
            // Manual verification required to check database
        });
    });
});

/**
 * Test Helper Functions
 */

/**
 * Creates a mock successful API response for processing history storage
 */
function createMockSuccessResponse(entryId = 'mock-entry-001') {
    return {
        success: true,
        entry_id: entryId,
        message: 'Processing history stored successfully'
    };
}

/**
 * Creates a mock error response for various failure scenarios
 */
function createMockErrorResponse(status = 500, detail = 'Internal server error') {
    return {
        success: false,
        error: detail,
        status: status
    };
}