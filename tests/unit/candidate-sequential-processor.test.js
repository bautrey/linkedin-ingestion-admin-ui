/**
 * Unit Tests: CandidateSequentialProcessor (LIN-16)
 * 
 * Comprehensive tests for the sequential processor step execution flow.
 * Tests verify that steps execute in order, handle errors properly,
 * and communicate with backend APIs and WebSocket events correctly.
 * 
 * Addresses: Sequential processor backend integration failure where
 * steps 1-4 don't execute properly, causing UI to show "stuck at verification"
 */

const CandidateSequentialProcessor = require('../../services/candidateSequentialProcessor');
const apiClient = require('../../config/api');
const logger = require('../../utils/logger');
const jobInspector = require('../../utils/jobInspector');
const jiraClient = require('../../config/jira');

// Mock all dependencies
jest.mock('../../config/api');
jest.mock('../../utils/logger');
jest.mock('../../utils/jobInspector');
jest.mock('../../config/jira');
jest.mock('../../services/jiraUpdateService');

describe('CandidateSequentialProcessor', () => {
    let processor;
    let mockApiClient;
    let mockLogger;
    let mockJobInspector;
    let mockJiraClient;

    const mockCandidateData = {
        key: 'CAN-4219',
        linkedinUrl: 'https://www.linkedin.com/in/bill-tingle',
        fullName: 'Bill Tingle',
        firstName: 'Bill',
        lastName: 'Tingle'
    };

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Setup API client mock
        mockApiClient = {
            post: jest.fn(),
            get: jest.fn(),
            defaults: {
                baseURL: 'http://localhost:8000/api/v1',
                headers: {
                    'X-API-Key': 'test-key',
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        };
        apiClient.post = mockApiClient.post;
        apiClient.get = mockApiClient.get;
        apiClient.defaults = mockApiClient.defaults;

        // Setup logger mock
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        logger.info = mockLogger.info;
        logger.warn = mockLogger.warn;
        logger.error = mockLogger.error;

        // Setup job inspector mock
        mockJobInspector = {
            logCandidateStart: jest.fn(),
            logStep: jest.fn(),
            logCandidateComplete: jest.fn(),
            storeProcessingHistory: jest.fn().mockResolvedValue()
        };
        jobInspector.logCandidateStart = mockJobInspector.logCandidateStart;
        jobInspector.logStep = mockJobInspector.logStep;
        jobInspector.logCandidateComplete = mockJobInspector.logCandidateComplete;
        jobInspector.storeProcessingHistory = mockJobInspector.storeProcessingHistory;

        // Setup JIRA client mock
        mockJiraClient = {
            updateCandidate: jest.fn().mockResolvedValue({ success: true })
        };
        jiraClient.updateCandidate = mockJiraClient.updateCandidate;

        // Create fresh processor instance
        processor = new CandidateSequentialProcessor();
    });

    describe('Constructor', () => {
        test('should initialize with correct step configuration', () => {
            expect(processor.steps).toHaveLength(5);
            expect(processor.steps[0].name).toBe('verify');
            expect(processor.steps[1].name).toBe('ingest');
            expect(processor.steps[2].name).toBe('check_compatibility');
            expect(processor.steps[3].name).toBe('score');
            expect(processor.steps[4].name).toBe('update_jira');
        });

        test('should set correct timeouts for each step', () => {
            expect(processor.steps[0].timeout).toBe(30000); // verify: 30s
            expect(processor.steps[1].timeout).toBe(60000); // ingest: 60s
            expect(processor.steps[2].timeout).toBe(90000); // compatibility: 90s
            expect(processor.steps[3].timeout).toBe(60000); // score: 60s
            expect(processor.steps[4].timeout).toBe(30000); // JIRA: 30s
        });

        test('should initialize JiraUpdateService', () => {
            expect(processor.jiraUpdateService).toBeDefined();
        });

        test('should log initialization with dependency check', () => {
            expect(mockLogger.info).toHaveBeenCalledWith(
                '🔧 Initializing CandidateSequentialProcessor',
                expect.objectContaining({
                    hasApiClient: true,
                    hasLogger: true,
                    hasJobInspector: true,
                    hasJiraClient: true
                })
            );
        });
    });

    describe('Step Execution Flow', () => {
        describe('executeStep method', () => {
            test('should execute verify step and call backend API', async () => {
                const mockVerifyResponse = {
                    data: {
                        verified: true,
                        profile_data: { name: 'Bill Tingle' },
                        executive_indicators: ['CTO_Experience']
                    }
                };
                mockApiClient.post.mockResolvedValueOnce(mockVerifyResponse);
                mockJiraClient.updateCandidate.mockResolvedValueOnce({ success: true });

                const result = await processor.executeStep('verify', {
                    candidateKey: 'CAN-4219',
                    linkedinUrl: 'https://www.linkedin.com/in/bill-tingle'
                });

                expect(mockApiClient.post).toHaveBeenCalledWith('/profiles/verify', {
                    linkedin_url: 'https://www.linkedin.com/in/bill-tingle'
                });

                expect(result).toEqual({
                    valid: true,
                    message: 'URL verified',
                    profile_data: { name: 'Bill Tingle' },
                    executive_indicators: ['CTO_Experience']
                });

                expect(mockJiraClient.updateCandidate).toHaveBeenCalledWith('CAN-4219', {
                    linkedinVerifiedDate: expect.any(String)
                });
            });

            test('should execute ingest step and handle existing profile', async () => {
                const mockExistingResponse = {
                    data: {
                        data: [{ id: 123, linkedin_url: 'https://www.linkedin.com/in/bill-tingle' }]
                    }
                };
                mockApiClient.get.mockResolvedValueOnce(mockExistingResponse);

                const result = await processor.executeStep('ingest', {
                    linkedinUrl: 'https://www.linkedin.com/in/bill-tingle'
                });

                expect(mockApiClient.get).toHaveBeenCalledWith('/profiles', {
                    params: { linkedin_url: 'https://www.linkedin.com/in/bill-tingle' }
                });

                expect(result).toEqual({
                    profile_id: 123,
                    message: 'Profile already exists, skipping ingestion',
                    skipped: true
                });
            });

            test('should execute ingest step and create new profile', async () => {
                const mockExistingResponse = { data: { data: [] } };
                const mockCreateResponse = { data: { profile_id: 456 } };
                
                mockApiClient.get.mockResolvedValueOnce(mockExistingResponse);
                mockApiClient.post.mockResolvedValueOnce(mockCreateResponse);

                const result = await processor.executeStep('ingest', {
                    linkedinUrl: 'https://www.linkedin.com/in/bill-tingle'
                });

                expect(mockApiClient.post).toHaveBeenCalledWith('/profiles', {
                    linkedin_url: 'https://www.linkedin.com/in/bill-tingle',
                    target_role: 'General'
                });

                expect(result).toEqual({
                    profile_id: 456,
                    message: 'Profile ingested successfully'
                });
            });

            test('should execute compatibility step and use existing results', async () => {
                const mockCompatibilityResponse = {
                    data: {
                        has_compatibility_results: true,
                        recommended_primary_role: 'CTO',
                        proceed_with_scoring: true,
                        compatible_roles: ['CTO', 'CIO']
                    }
                };
                mockApiClient.get.mockResolvedValueOnce(mockCompatibilityResponse);

                const result = await processor.executeStep('check_compatibility', {
                    profileId: 123
                });

                expect(mockApiClient.get).toHaveBeenCalledWith('/profiles/123/role-compatibility/latest');
                expect(result).toEqual(mockCompatibilityResponse.data);
            });

            test('should execute compatibility step and run fresh check', async () => {
                const mockExistingError = { response: { status: 404 } };
                const mockFreshResponse = {
                    data: {
                        recommended_primary_role: 'CTO',
                        proceed_with_scoring: true,
                        compatible_roles: ['CTO']
                    }
                };
                
                mockApiClient.get.mockRejectedValueOnce(mockExistingError);
                mockApiClient.post.mockResolvedValueOnce(mockFreshResponse);

                const result = await processor.executeStep('check_compatibility', {
                    profileId: 123
                });

                expect(mockApiClient.post).toHaveBeenCalledWith('/profiles/123/role-compatibility', {
                    target_roles: ['CTO', 'CIO', 'CISO'],
                    fast_screening: true
                });
                expect(result).toEqual(mockFreshResponse.data);
            });

            test('should execute scoring step with polling', async () => {
                const mockScoringResponse = { data: { job_id: 'job-789' } };
                const mockJobResponse = {
                    data: {
                        status: 'completed',
                        result: {
                            parsed_score: {
                                total_score: 85,
                                fit_verdict: 'Strong Fit',
                                rationale: 'Excellent technical background',
                                score_breakdown: { technical: 90, leadership: 80 },
                                gatekeeper_result: 'Pass'
                            }
                        }
                    }
                };

                mockApiClient.post.mockResolvedValueOnce(mockScoringResponse);
                mockApiClient.get.mockResolvedValueOnce(mockJobResponse);

                const result = await processor.executeStep('score', {
                    profileId: 123,
                    results: {
                        steps: [{
                            name: 'check_compatibility',
                            result: { recommended_primary_role: 'CTO' }
                        }]
                    }
                });

                expect(mockApiClient.post).toHaveBeenCalledWith('/profiles/123/score-template', {});
                expect(mockApiClient.get).toHaveBeenCalledWith('/scoring-jobs/job-789');

                expect(result).toEqual({
                    score: 85,
                    fit_verdict: 'Strong Fit',
                    rationale: 'Excellent technical background',
                    score_breakdown: { technical: 90, leadership: 80 },
                    gatekeeper_result: 'Pass',
                    job_id: 'job-789',
                    role: 'CTO',
                    message: 'Scoring completed: Strong Fit (85/100)'
                });
            });

            test('should throw error for unknown step', async () => {
                await expect(processor.executeStep('unknown_step', {}))
                    .rejects
                    .toThrow('Unknown processing step: unknown_step');
            });
        });

        describe('executeStepWithTimeout', () => {
            test('should execute step within timeout', async () => {
                const mockStep = { name: 'verify', timeout: 1000 };
                const mockParams = { candidateKey: 'CAN-123' };

                // Mock executeStep to resolve quickly
                jest.spyOn(processor, 'executeStep').mockResolvedValueOnce({ valid: true });

                const result = await processor.executeStepWithTimeout(mockStep, mockParams);

                expect(result).toEqual({ valid: true });
                expect(processor.executeStep).toHaveBeenCalledWith('verify', mockParams);
            });

            test('should timeout if step takes too long', async () => {
                const mockStep = { name: 'verify', timeout: 100 };
                const mockParams = { candidateKey: 'CAN-123' };

                // Mock executeStep to take longer than timeout
                jest.spyOn(processor, 'executeStep').mockImplementation(() => 
                    new Promise(resolve => setTimeout(() => resolve({ valid: true }), 200))
                );

                await expect(processor.executeStepWithTimeout(mockStep, mockParams))
                    .rejects
                    .toThrow('Step verify timed out after 100ms');
            });
        });
    });

    describe('Full Processing Workflow', () => {
        test('should process candidate through all steps successfully', async () => {
            // Setup mock responses for all steps
            mockApiClient.post
                .mockResolvedValueOnce({ data: { verified: true } }) // verify
                .mockResolvedValueOnce({ data: { profile_id: 123 } }) // ingest
                .mockResolvedValueOnce({ data: { job_id: 'job-456' } }); // scoring

            mockApiClient.get
                .mockResolvedValueOnce({ data: { data: [] } }) // check existing profile
                .mockResolvedValueOnce({ 
                    data: { 
                        has_compatibility_results: true,
                        recommended_primary_role: 'CTO',
                        proceed_with_scoring: true
                    }
                }) // compatibility check
                .mockResolvedValueOnce({
                    data: {
                        status: 'completed',
                        result: { parsed_score: { total_score: 85 } }
                    }
                }) // scoring job poll
                .mockResolvedValueOnce({
                    data: {
                        status: 'completed', 
                        result: { parsed_score: { total_score: 85 } }
                    }
                }); // JIRA update scoring job fetch

            mockJiraClient.updateCandidate.mockResolvedValue({ success: true });

            const result = await processor.processCandidate(mockCandidateData);

            expect(result.success).toBe(true);
            expect(result.completedSteps).toBe(5);
            expect(result.profileId).toBe(123);
            expect(result.steps).toHaveLength(5);

            // Verify all steps were logged
            expect(mockJobInspector.logCandidateStart).toHaveBeenCalled();
            expect(mockJobInspector.logStep).toHaveBeenCalledTimes(10); // start + complete for each step
            expect(mockJobInspector.logCandidateComplete).toHaveBeenCalled();
        });

        test('should stop processing when verification fails', async () => {
            mockApiClient.post.mockResolvedValueOnce({ 
                data: { verified: false, error: 'Invalid URL' } 
            });

            const result = await processor.processCandidate(mockCandidateData);

            expect(result.success).toBe(false);
            expect(result.completedSteps).toBe(1);
            expect(result.steps).toHaveLength(1);
            expect(result.steps[0].success).toBe(true); // step executes but returns invalid
            
            // Should not proceed to ingestion step
            expect(mockApiClient.get).not.toHaveBeenCalled();
        });

        test('should handle API errors gracefully', async () => {
            mockApiClient.post.mockRejectedValueOnce(new Error('Network error'));

            const result = await processor.processCandidate(mockCandidateData);

            expect(result.success).toBe(false);
            expect(result.steps[0].success).toBe(false);
            expect(result.steps[0].error).toBe('Verification failed: Network error');
            expect(result.failedStep).toBe('verify');
        });

        test('should store processing history for each step', async () => {
            mockApiClient.post.mockResolvedValueOnce({ data: { verified: true } });

            await processor.processCandidate(mockCandidateData);

            expect(mockJobInspector.storeProcessingHistory).toHaveBeenCalledWith(
                'CAN-4219',
                'verify',
                'success',
                expect.objectContaining({
                    stepDisplayName: 'Verify LinkedIn URL',
                    stepNumber: 1,
                    totalSteps: 5
                }),
                expect.any(Number),
                null
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle 422 validation error in verification', async () => {
            const mockError = {
                response: { status: 422, data: { detail: 'Invalid URL format' } }
            };
            mockApiClient.post.mockRejectedValueOnce(mockError);

            await expect(processor.verifyLinkedInUrl('invalid-url'))
                .rejects
                .toThrow('Invalid LinkedIn URL: Invalid URL format');
        });

        test('should handle generic verification error', async () => {
            mockApiClient.post.mockRejectedValueOnce(new Error('Connection timeout'));

            await expect(processor.verifyLinkedInUrl('https://linkedin.com/in/test'))
                .rejects
                .toThrow('Verification failed: Connection timeout');
        });

        test('should handle ingestion API error', async () => {
            const mockError = {
                response: { data: { detail: 'Profile extraction failed' } }
            };
            mockApiClient.get.mockResolvedValueOnce({ data: { data: [] } });
            mockApiClient.post.mockRejectedValueOnce(mockError);

            await expect(processor.ingestProfile('https://linkedin.com/in/test'))
                .rejects
                .toThrow('Ingestion failed: Profile extraction failed');
        });

        test('should handle compatibility check failure gracefully', async () => {
            mockApiClient.get.mockRejectedValueOnce(new Error('No existing results'));
            mockApiClient.post.mockRejectedValueOnce(new Error('AI service unavailable'));

            const result = await processor.checkCompatibility(123);

            expect(result).toEqual({
                proceed_with_scoring: false,
                recommended_primary_role: null,
                reason: 'Compatibility check failed: AI service unavailable',
                compatible_roles: []
            });
        });

        test('should handle scoring job timeout', async () => {
            mockApiClient.post.mockResolvedValueOnce({ data: { job_id: 'job-123' } });
            // Mock job to never complete
            mockApiClient.get.mockResolvedValue({ data: { status: 'in_progress' } });

            // Mock setTimeout to speed up test
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((callback, delay) => {
                if (delay === 5000) {
                    // Speed up polling interval for test
                    originalSetTimeout(callback, 10);
                } else {
                    originalSetTimeout(callback, delay);
                }
            });

            await expect(processor.scoreProfile(123, 'CTO'))
                .rejects
                .toThrow('Scoring job job-123 timed out after 300 seconds');

            global.setTimeout = originalSetTimeout;
        });
    });

    describe('URL Normalization', () => {
        test('should normalize various LinkedIn URL formats', () => {
            const testCases = [
                {
                    input: 'linkedin.com/in/bill-tingle',
                    expected: 'https://www.linkedin.com/in/bill-tingle'
                },
                {
                    input: 'http://www.linkedin.com/in/bill-tingle/',
                    expected: 'https://www.linkedin.com/in/bill-tingle'
                },
                {
                    input: 'https://linkedin.com/in/bill-tingle',
                    expected: 'https://www.linkedin.com/in/bill-tingle'
                },
                {
                    input: 'www.linkedin.com/in/bill-tingle/',
                    expected: 'https://www.linkedin.com/in/bill-tingle'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                expect(processor.normalizeLinkedInUrl(input)).toBe(expected);
            });
        });

        test('should return original URL if not LinkedIn format', () => {
            const nonLinkedInUrls = [
                'https://github.com/user',
                'https://twitter.com/user',
                'not-a-url',
                null,
                undefined
            ];

            nonLinkedInUrls.forEach(url => {
                expect(processor.normalizeLinkedInUrl(url)).toBe(url);
            });
        });
    });

    describe('Sleep Utility', () => {
        test('should resolve after specified milliseconds', async () => {
            const start = Date.now();
            await processor.sleep(100);
            const duration = Date.now() - start;
            
            expect(duration).toBeGreaterThanOrEqual(95);
            expect(duration).toBeLessThan(150);
        });
    });
});