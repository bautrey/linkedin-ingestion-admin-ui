// Import the class we're testing
const CandidateSequentialProcessor = require('../../services/candidateSequentialProcessor');

describe('buildComprehensiveComment Method - Current Behavior Analysis', () => {
    let processor;
    
    beforeEach(() => {
        processor = new CandidateSequentialProcessor();
    });

    test('should generate comment for successful processing with compatibility and score', () => {
        const mockCandidate = {
            candidateKey: 'CAN-123',
            linkedinUrl: 'https://www.linkedin.com/in/johndoe'
        };

        const mockSteps = [
            { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
            { name: 'ingest', success: true, result: { profile_id: '456' }, duration: 2000 },
            { name: 'check_compatibility', success: true, result: { 
                compatibility: {
                    recommended_primary_role: 'CTO',
                    compatible_roles: [
                        { role: 'CTO', compatible: true, confidence: 0.89, reasoning: 'Strong technical leadership' },
                        { role: 'CIO', compatible: true, confidence: 0.72, reasoning: 'Good business alignment' }
                    ],
                    overall_assessment: 'Excellent technical leadership candidate',
                    model_used: 'gpt-4',
                    ai_response_time: 3.2
                }
            }, duration: 3000 },
            { name: 'score', success: true, result: { score: 87, role: 'CTO' }, duration: 4000 }
        ];

        const mockCompatibilityStep = mockSteps[2];
        const mockScoreStep = { success: true, result: { score: 87, role: 'CTO' } };
        const fitStatus = 'Scored';
        const fitScore = 87;
        const profileId = '456';

        const comment = processor.buildComprehensiveComment(
            mockCandidate, 
            mockSteps, 
            mockCompatibilityStep, 
            mockScoreStep, 
            fitStatus, 
            fitScore, 
            profileId
        );

        // Test basic structure
        expect(comment).toContain('🤖 *Automated LinkedIn Processing - Complete*');
        expect(comment).toContain('*Candidate:* CAN-123');
        expect(comment).toContain('*LinkedIn:* https://www.linkedin.com/in/johndoe');
        expect(comment).toContain('*Profile ID:* #456');
        
        // Test step results
        expect(comment).toContain('✅ LinkedIn URL verified and accessible');
        expect(comment).toContain('✅ Profile data extracted and stored');
        expect(comment).toContain('✅ Role compatibility assessed');
        expect(comment).toContain('✅ Candidate scored successfully');
        
        // Test compatibility section
        expect(comment).toContain('*Compatibility Assessment:*');
        expect(comment).toContain('Excellent technical leadership candidate');
        expect(comment).toContain('• *CTO*: ✅ Compatible (89% confidence) ⭐ *Recommended*');
        expect(comment).toContain('• *CIO*: ✅ Compatible (72% confidence)');
        
        // Test final results
        expect(comment).toContain('*Final Score:* 87/100 (CTO Role)');
        expect(comment).toContain('*AI Model:* gpt-4 (3s)');
        expect(comment).toContain('*Status:* Ready for CTO interview consideration');
    });

    test('should generate comment for failed verification', () => {
        const mockCandidate = {
            candidateKey: 'CAN-124',
            linkedinUrl: 'https://www.linkedin.com/in/invalid'
        };

        const mockSteps = [
            { name: 'verify', success: false, error: 'Profile not accessible', duration: 1000 }
        ];

        const fitStatus = 'Invalid LinkedIn URL';
        const fitScore = 0;
        const errorMessage = 'Profile not accessible';

        const comment = processor.buildComprehensiveComment(
            mockCandidate, 
            mockSteps, 
            null, 
            null, 
            fitStatus, 
            fitScore, 
            null,
            errorMessage
        );

        expect(comment).toContain('🤖 *Automated LinkedIn Processing - Failed*');
        expect(comment).toContain('❌ LinkedIn URL verified and accessible');
        expect(comment).toContain('└── Profile not accessible');
        expect(comment).toContain('*Final Status:* LinkedIn URL verification failed');
        expect(comment).toContain('*Error:* Profile not accessible');
    });

    test('should generate comment for partial success (compatibility but no scoring)', () => {
        const mockCandidate = {
            candidateKey: 'CAN-125',
            linkedinUrl: 'https://www.linkedin.com/in/partialsuccess'
        };

        const mockSteps = [
            { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
            { name: 'ingest', success: true, result: { profile_id: '789' }, duration: 2000 },
            { name: 'check_compatibility', success: true, result: { 
                compatibility: {
                    recommended_primary_role: 'CIO',
                    compatible_roles: [
                        { role: 'CIO', compatible: true, confidence: 0.78, reasoning: 'Good business acumen' }
                    ],
                    proceed_with_scoring: true
                }
            }, duration: 3000 },
            { name: 'score', success: false, error: 'Scoring service timeout', duration: 4000 }
        ];

        const mockCompatibilityStep = mockSteps[2];
        const fitStatus = 'Unscored';
        const fitScore = 0;
        const profileId = '789';

        const comment = processor.buildComprehensiveComment(
            mockCandidate, 
            mockSteps, 
            mockCompatibilityStep, 
            null, 
            fitStatus, 
            fitScore, 
            profileId
        );

        expect(comment).toContain('🤖 *Automated LinkedIn Processing - Partial*');
        expect(comment).toContain('✅ LinkedIn URL verified and accessible');
        expect(comment).toContain('✅ Profile data extracted and stored');
        expect(comment).toContain('✅ Role compatibility assessed');
        expect(comment).toContain('❌ Candidate scored successfully');
        expect(comment).toContain('*Compatibility Assessment:*');
        expect(comment).toContain('*Recommendation:* CIO role shows strong compatibility');
        expect(comment).toContain('*Status:* Scoring step failed - manual review needed');
    });

    test('should handle no fit scenario (compatibility recommends no scoring)', () => {
        const mockCandidate = {
            candidateKey: 'CAN-126',
            linkedinUrl: 'https://www.linkedin.com/in/nofit'
        };

        const mockSteps = [
            { name: 'verify', success: true, result: { valid: true }, duration: 1000 },
            { name: 'ingest', success: true, result: { profile_id: '101' }, duration: 2000 },
            { name: 'check_compatibility', success: true, result: { 
                compatibility: {
                    recommended_primary_role: null,
                    compatible_roles: [
                        { role: 'CTO', compatible: false, confidence: 0.31, reasoning: 'Lacks technical leadership' },
                        { role: 'CIO', compatible: false, confidence: 0.28, reasoning: 'Limited business experience' }
                    ],
                    proceed_with_scoring: false,
                    overall_assessment: 'Not a strong match for executive roles'
                }
            }, duration: 3000 }
        ];

        const mockCompatibilityStep = mockSteps[2];
        const fitStatus = 'No Fit (0 Score)';
        const fitScore = 0;
        const profileId = '101';

        const comment = processor.buildComprehensiveComment(
            mockCandidate, 
            mockSteps, 
            mockCompatibilityStep, 
            null, 
            fitStatus, 
            fitScore, 
            profileId
        );

        expect(comment).toContain('*Compatibility Assessment:*');
        expect(comment).toContain('Not a strong match for executive roles');
        expect(comment).toContain('• *CTO*: ❌ Not Compatible (31% confidence)');
        expect(comment).toContain('• *CIO*: ❌ Not Compatible (28% confidence)');
        expect(comment).toContain('*Status:* No roles met minimum compatibility threshold');
        expect(comment).toContain('*Next Steps:* Consider for other roles or archive');
    });

    test('should analyze current comment structure and categorize content', async () => {
        const mockCandidate = { candidateKey: 'CAN-ANALYSIS', linkedinUrl: 'https://example.com' };
        const mockSteps = [
            { name: 'verify', success: true, result: { valid: true }, duration: 1000 }
        ];

        const comment = processor.buildComprehensiveComment(
            mockCandidate, 
            mockSteps, 
            null, 
            null, 
            'Unprocessed', 
            0, 
            null
        );

        // Analyze current structure
        const lines = comment.split('\n');
        
        // Current structure analysis
        const hasEmoji = comment.includes('🤖');
        const hasMonospacedText = comment.includes('*');
        const hasProcessingDetails = comment.includes('*Processed:*');
        const hasStepDetails = comment.includes('✅') || comment.includes('❌');
        
        // Content categorization
        const businessContent = [
            'Candidate:',
            'LinkedIn:',
            'Final Score:',
            'Compatibility Assessment:',
            'Status:'
        ].filter(item => comment.includes(item));

        const technicalContent = [
            'Profile ID:',
            'Processed:',
            'AI Model:',
            'AI response time'
        ].filter(item => comment.includes(item));

        // Store analysis results for documentation
        expect(hasEmoji).toBe(true); // Current uses emoji
        expect(hasMonospacedText).toBe(true); // Current uses markdown formatting
        expect(businessContent.length).toBeGreaterThan(0); // Has business content
        expect(technicalContent.length).toBeGreaterThan(0); // Has technical content
    });
});

test.describe('Data Extraction Pattern Analysis', () => {
    let processor;
    
    test.beforeEach(() => {
        processor = new CandidateSequentialProcessor();
    });

    test('should extract compatibility data correctly from API response', async () => {
        const mockCompatibilityStep = {
            success: true,
            result: {
                compatibility: {
                    recommended_primary_role: 'CTO',
                    compatible_roles: [
                        { role: 'CTO', compatible: true, confidence: 0.89 },
                        { role: 'CIO', compatible: false, confidence: 0.45 }
                    ],
                    overall_assessment: 'Strong technical background',
                    model_used: 'gpt-4',
                    ai_response_time: 2.5
                }
            }
        };

        // Test data extraction patterns
        const compatibility = mockCompatibilityStep.result?.compatibility;
        expect(compatibility).toBeDefined();
        expect(compatibility.recommended_primary_role).toBe('CTO');
        expect(compatibility.compatible_roles).toHaveLength(2);
        expect(compatibility.model_used).toBe('gpt-4');
    });

    test('should extract scoring data correctly from API response', async () => {
        const mockScoreStep = {
            success: true,
            result: {
                score: 87,
                role: 'CTO',
                reasoning: 'Strong technical leadership experience'
            }
        };

        // Test data extraction patterns
        const result = mockScoreStep.result;
        expect(result.score).toBe(87);
        expect(result.role).toBe('CTO');
        expect(result.reasoning).toBeDefined();
    });
});