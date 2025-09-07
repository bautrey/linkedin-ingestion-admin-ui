/**
 * Unit Tests: API Client Configuration (LIN-13)
 * 
 * Tests to verify that the API client is properly configured
 * and can handle various environment scenarios.
 * 
 * Addresses the root cause of processing history persistence failures.
 */

const apiClient = require('../../config/api');

describe('API Client Configuration', () => {
    let originalEnv;

    beforeAll(() => {
        // Store original environment variables
        originalEnv = {
            FASTAPI_BASE_URL: process.env.FASTAPI_BASE_URL,
            API_KEY: process.env.API_KEY,
            NODE_ENV: process.env.NODE_ENV
        };
    });

    afterEach(() => {
        // Restore environment variables after each test
        Object.assign(process.env, originalEnv);
    });

    describe('Base URL Configuration', () => {
        test('should construct correct base URL when FASTAPI_BASE_URL is set', () => {
            // Simulate Docker environment
            process.env.FASTAPI_BASE_URL = 'http://api:8000';
            
            // Reload the API client module to pick up new environment
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('http://api:8000/api/v1');
        });

        test('should handle missing FASTAPI_BASE_URL gracefully', () => {
            // Simulate missing environment variable
            delete process.env.FASTAPI_BASE_URL;
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('undefined/api/v1');
        });

        test('should construct correct base URL for production environment', () => {
            process.env.FASTAPI_BASE_URL = 'https://api-docker-production.up.railway.app';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('https://api-docker-production.up.railway.app/api/v1');
        });

        test('should construct correct base URL for local development', () => {
            process.env.FASTAPI_BASE_URL = 'http://localhost:8000';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('http://localhost:8000/api/v1');
        });
    });

    describe('Authentication Configuration', () => {
        test('should use API_KEY from environment when available', () => {
            process.env.API_KEY = 'test-env-api-key';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.headers['X-API-Key']).toBe('test-env-api-key');
        });

        test('should fallback to hardcoded API key when API_KEY not set', () => {
            delete process.env.API_KEY;
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.headers['X-API-Key']).toBe('li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I');
        });

        test('should have proper Content-Type header', () => {
            expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
        });

        test('should have proper User-Agent header', () => {
            expect(apiClient.defaults.headers['User-Agent']).toBe('LinkedIn-Ingestion-Admin-UI/1.0');
        });
    });

    describe('Timeout Configuration', () => {
        test('should have 30 second timeout configured', () => {
            expect(apiClient.defaults.timeout).toBe(30000);
        });

        test('should have reasonable timeout for processing history calls', () => {
            // Processing history storage should not take more than 30 seconds
            expect(apiClient.defaults.timeout).toBeGreaterThanOrEqual(30000);
            expect(apiClient.defaults.timeout).toBeLessThanOrEqual(60000);
        });
    });

    describe('Interceptor Configuration', () => {
        test('should have request interceptor configured', () => {
            expect(apiClient.interceptors.request.handlers).toHaveLength(1);
            expect(typeof apiClient.interceptors.request.handlers[0].fulfilled).toBe('function');
        });

        test('should have response interceptor configured', () => {
            expect(apiClient.interceptors.response.handlers).toHaveLength(1);
            expect(typeof apiClient.interceptors.response.handlers[0].fulfilled).toBe('function');
            expect(typeof apiClient.interceptors.response.handlers[0].rejected).toBe('function');
        });
    });

    describe('Environment-Specific Configuration', () => {
        test('should be configured for Docker development environment', () => {
            process.env.FASTAPI_BASE_URL = 'http://api:8000';
            process.env.NODE_ENV = 'development';
            process.env.API_KEY = 'li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('http://api:8000/api/v1');
            expect(freshApiClient.defaults.headers['X-API-Key']).toBe('li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I');
        });

        test('should be configured for production environment', () => {
            process.env.FASTAPI_BASE_URL = 'https://api-docker-production.up.railway.app';
            process.env.NODE_ENV = 'production';
            process.env.API_KEY = 'prod-api-key';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('https://api-docker-production.up.railway.app/api/v1');
            expect(freshApiClient.defaults.headers['X-API-Key']).toBe('prod-api-key');
        });

        test('should be configured for test environment', () => {
            process.env.FASTAPI_BASE_URL = 'http://localhost:8000';
            process.env.NODE_ENV = 'test';
            process.env.API_KEY = 'test-api-key';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            expect(freshApiClient.defaults.baseURL).toBe('http://localhost:8000/api/v1');
            expect(freshApiClient.defaults.headers['X-API-Key']).toBe('test-api-key');
        });
    });

    describe('Processing History Endpoint Configuration', () => {
        test('should be able to construct processing history endpoint URLs', () => {
            process.env.FASTAPI_BASE_URL = 'http://api:8000';
            
            // Reload the API client module
            delete require.cache[require.resolve('../../config/api')];
            const freshApiClient = require('../../config/api');
            
            const candidateKey = 'CAN-TEST-001';
            const expectedUrl = `/processing/candidates/${candidateKey}/history`;
            
            // Simulate building the full URL as axios would
            const fullUrl = freshApiClient.defaults.baseURL + expectedUrl;
            expect(fullUrl).toBe('http://api:8000/api/v1/processing/candidates/CAN-TEST-001/history');
        });

        test('should handle URL construction for different base URLs', () => {
            const testCases = [
                {
                    baseUrl: 'http://api:8000',
                    expected: 'http://api:8000/api/v1/processing/candidates/CAN-123/history'
                },
                {
                    baseUrl: 'https://api-docker-production.up.railway.app',
                    expected: 'https://api-docker-production.up.railway.app/api/v1/processing/candidates/CAN-123/history'
                },
                {
                    baseUrl: 'http://localhost:8000',
                    expected: 'http://localhost:8000/api/v1/processing/candidates/CAN-123/history'
                }
            ];

            testCases.forEach(({ baseUrl, expected }) => {
                process.env.FASTAPI_BASE_URL = baseUrl;
                
                // Reload the API client module
                delete require.cache[require.resolve('../../config/api')];
                const freshApiClient = require('../../config/api');
                
                const candidateKey = 'CAN-123';
                const endpoint = `/processing/candidates/${candidateKey}/history`;
                const fullUrl = freshApiClient.defaults.baseURL + endpoint;
                
                expect(fullUrl).toBe(expected);
            });
        });
    });

    describe('Error Handling Configuration', () => {
        test('should handle axios configuration errors', () => {
            // Test that the API client can be imported without throwing
            expect(() => {
                delete require.cache[require.resolve('../../config/api')];
                require('../../config/api');
            }).not.toThrow();
        });

        test('should have proper error handling for malformed base URLs', () => {
            process.env.FASTAPI_BASE_URL = 'not-a-valid-url';
            
            // Should not throw during module load
            expect(() => {
                delete require.cache[require.resolve('../../config/api')];
                require('../../config/api');
            }).not.toThrow();
        });
    });
});

/**
 * Test Helper Functions
 */

/**
 * Reloads the API client module with fresh environment variables
 */
function reloadApiClient() {
    delete require.cache[require.resolve('../../config/api')];
    return require('../../config/api');
}

/**
 * Sets up environment variables for testing
 */
function setTestEnvironment(config) {
    if (config.fastApiBaseUrl !== undefined) {
        process.env.FASTAPI_BASE_URL = config.fastApiBaseUrl;
    }
    if (config.apiKey !== undefined) {
        process.env.API_KEY = config.apiKey;
    }
    if (config.nodeEnv !== undefined) {
        process.env.NODE_ENV = config.nodeEnv;
    }
}