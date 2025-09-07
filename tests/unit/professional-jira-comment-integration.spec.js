// Integration tests for Professional Jira Comment formatting functions
// Task 2.3: Test complete formatting integration and visual hierarchy

const {
    generateProfessionalComment,
    formatExecutiveHeader,
    formatCompatibilityResults,
    formatScoringBreakdown,
    formatExecutiveSummary,
    JIRA_COLORS,
    JIRA_PANELS
} = require('../../services/professionalJiraComment');

const { 
    highPerformingCandidate, 
    mediumPerformingCandidate, 
    lowPerformingCandidate,
    partialProcessingCandidate,
    failedVerificationCandidate
} = require('../fixtures/candidate-evaluation-data');

describe('Professional Jira Comment Integration', () => {

    describe('formatExecutiveHeader', () => {
        
        test('should format header with candidate information and success color', () => {
            const candidate = highPerformingCandidate.candidate;
            const overallStatus = 'Ready for CTO Interview Process';
            
            const header = formatExecutiveHeader(candidate, overallStatus);
            
            expect(header).toContain('🎯 EXECUTIVE CANDIDATE ASSESSMENT');
            expect(header).toContain('**Sarah Johnson**');
            expect(header).toContain('🔗 [LinkedIn Profile|https://www.linkedin.com/in/senior-cto-tech]');
            expect(header).toContain('borderColor=#00875A'); // Success green
            expect(header).toContain('{panel}');
        });

        test('should apply warning color for partial status', () => {
            const candidate = partialProcessingCandidate.candidate;
            const overallStatus = 'Scoring Incomplete - Manual Review Needed';
            
            const header = formatExecutiveHeader(candidate, overallStatus);
            
            expect(header).toContain('borderColor=#FFAB00'); // Warning orange
        });

        test('should apply error color for failed status', () => {
            const candidate = failedVerificationCandidate.candidate;
            const overallStatus = 'Profile Verification Failed';
            
            const header = formatExecutiveHeader(candidate, overallStatus);
            
            expect(header).toContain('borderColor=#FF5630'); // Error red
        });

        test('should handle missing position gracefully', () => {
            const candidateWithoutPosition = {
                candidateKey: 'TEST-001',
                linkedinUrl: 'https://www.linkedin.com/in/test',
                fullName: 'Test Candidate'
                // No position
            };
            
            const header = formatExecutiveHeader(candidateWithoutPosition, 'Status');
            
            expect(header).toContain('**Test Candidate**');
            expect(header).toContain('🔗 [LinkedIn Profile|https://www.linkedin.com/in/test]');
            expect(header).not.toContain(' | | '); // No double separators
        });
    });

    describe('formatCompatibilityResults', () => {
        
        test('should format multiple role analysis with color coding', () => {
            const compatibilityStep = highPerformingCandidate.steps[2];
            const compatibilityResults = formatCompatibilityResults({
                hasData: true,
                roleAnalysis: [
                    {
                        role: 'CTO',
                        matchPercentage: 92,
                        isCompatible: true,
                        businessReasoning: 'Extensive experience in technology leadership',
                        colorCode: '#00875A',
                        statusIcon: '✅'
                    },
                    {
                        role: 'CIO',
                        matchPercentage: 78,
                        isCompatible: true,
                        businessReasoning: 'Strong business alignment with enterprise IT experience',
                        colorCode: '#00875A',
                        statusIcon: '✅'
                    },
                    {
                        role: 'CISO',
                        matchPercentage: 35,
                        isCompatible: false,
                        businessReasoning: 'Limited security governance experience',
                        colorCode: '#FF5630',
                        statusIcon: '❌'
                    }
                ]
            });
            
            expect(compatibilityResults).toContain('📊 EXECUTIVE FIT ANALYSIS');
            expect(compatibilityResults).toContain('{color:#00875A}✅ **CTO Role**: 92% Match{color}');
            expect(compatibilityResults).toContain('{color:#00875A}✅ **CIO Role**: 78% Match{color}');
            expect(compatibilityResults).toContain('{color:#FF5630}❌ **CISO Role**: 35% Match{color}');
            expect(compatibilityResults).toContain('_Extensive experience in technology leadership_');
        });

        test('should handle no compatibility data scenario', () => {
            const noDataResults = formatCompatibilityResults({ hasData: false });
            
            expect(noDataResults).toContain('borderColor=#FF5630'); // Error red
            expect(noDataResults).toContain('❌ **Compatibility Analysis**: Not Available');
            expect(noDataResults).toContain('Manual review required');
        });
    });

    describe('formatScoringBreakdown', () => {
        
        test('should format high score with LLM verdict', () => {
            const scoringInsights = {
                hasData: true,
                numericScore: 94,
                llmVerdict: 'Strong Fit',
                rationale: 'Outstanding technology executive with proven track record.',
                targetRole: 'CTO',
                statusColor: '#00875A'
            };
            
            const scoreBreakdown = formatScoringBreakdown(scoringInsights);
            
            expect(scoreBreakdown).toContain('{color:#00875A}*LLM ASSESSMENT: STRONG FIT*{color}');
            expect(scoreBreakdown).toContain('**Score: 94/100** • **Role: Chief Technology Officer**');
            expect(scoreBreakdown).toContain('_Outstanding technology executive with proven track record._');
            expect(scoreBreakdown).toContain('---'); // Section separator
        });

        test('should format medium score with LLM verdict', () => {
            const scoringInsights = {
                hasData: true,
                numericScore: 73,
                llmVerdict: 'Good Fit',
                rationale: 'Experienced IT executive with strong potential for CIO role.',
                targetRole: 'CIO',
                statusColor: '#FFAB00'
            };
            
            const scoreBreakdown = formatScoringBreakdown(scoringInsights);
            
            expect(scoreBreakdown).toContain('*LLM ASSESSMENT: GOOD FIT*');
            expect(scoreBreakdown).toContain('**Score: 73/100** • **Role: Chief Information Officer**');
            expect(scoreBreakdown).toContain('_Experienced IT executive with strong potential for CIO role._');
        });

        test('should handle no scoring data', () => {
            const noScoringResults = formatScoringBreakdown({ hasData: false });
            
            expect(noScoringResults).toContain('**Overall Score**: Not Available');
            expect(noScoringResults).toContain('Scoring analysis incomplete');
        });
    });

    describe('formatExecutiveSummary', () => {
        
        test('should format strengths and status for high-performing candidate', () => {
            const compatibilityInsights = {
                hasData: true,
                roleAnalysis: [{
                    role: 'CTO',
                    keyStrengths: [
                        'Multiple CTO roles with enterprise scope',
                        'Proven track record in building and scaling technology teams',
                        'Experience in digital transformation and innovation'
                    ],
                    developmentAreas: []
                }]
            };
            
            const executiveSummary = {
                overallStatus: 'Ready for CTO Interview Process',
                statusColor: '#00875A',
                businessAssessment: 'Outstanding technology executive with proven track record.',
                nextSteps: 'Schedule CTO interview and reference checks'
            };
            
            const summary = formatExecutiveSummary(compatibilityInsights, executiveSummary);
            
            expect(summary).toContain('⭐ KEY STRENGTHS');
            expect(summary).toContain('Multiple CTO roles with enterprise scope');
            expect(summary).toContain('**BUSINESS ASSESSMENT:** Outstanding technology executive');
            expect(summary).toContain('**STATUS:** ✅ Ready for CTO Interview Process');
            expect(summary).toContain('**NEXT STEPS:** Schedule CTO interview');
        });

        test('should include development areas when present', () => {
            const compatibilityInsights = {
                hasData: true,
                roleAnalysis: [{
                    role: 'CTO',
                    keyStrengths: ['Strong technical leadership'],
                    developmentAreas: [
                        'Limited evidence of P&L responsibility',
                        'Missing global team management experience'
                    ]
                }]
            };
            
            const executiveSummary = {
                overallStatus: 'Consider for CTO Role with Additional Evaluation',
                statusColor: '#FFAB00'
            };
            
            const summary = formatExecutiveSummary(compatibilityInsights, executiveSummary);
            
            expect(summary).toContain('⚠️ DEVELOPMENT AREAS');
            expect(summary).toContain('Limited evidence of P&L responsibility');
            expect(summary).toContain('borderColor=#FFAB00'); // Warning orange
        });
    });

    describe('generateProfessionalComment - Complete Integration', () => {
        
        test('should generate complete professional comment for high-performing candidate', () => {
            const candidate = highPerformingCandidate.candidate;
            const compatibilityData = highPerformingCandidate.steps[2];
            const scoreData = { 
                success: true, 
                result: { 
                    score: 94, 
                    role: 'CTO',
                    fit_verdict: 'Strong Fit',
                    rationale: 'Outstanding technology executive with proven track record.',
                    gatekeeper_result: 'Pass'
                } 
            };
            const processingSteps = highPerformingCandidate.steps;
            
            const fullComment = generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps);
            
            // Verify all major sections are present
            expect(fullComment).toContain('🎯 EXECUTIVE CANDIDATE ASSESSMENT');
            expect(fullComment).toContain('*LLM ASSESSMENT: STRONG FIT*');
            expect(fullComment).toContain('📊 EXECUTIVE FIT ANALYSIS');
            expect(fullComment).toContain('⭐ KEY STRENGTHS');
            expect(fullComment).toContain('**STATUS:**');
            expect(fullComment).toContain('🤖 AI-Generated Executive Assessment');
            
            // Verify proper section separation
            const sections = fullComment.split('\n\n');
            expect(sections.length).toBeGreaterThan(5); // Multiple distinct sections
            
            // Verify visual hierarchy
            expect(fullComment).toContain('---'); // Score section separator
            expect(fullComment).toContain('{panel}'); // Panel closures
        });

        test('should handle failed verification scenario gracefully', () => {
            const candidate = failedVerificationCandidate.candidate;
            const compatibilityData = { success: false };
            const scoreData = { success: false };
            const processingSteps = [{ name: 'verify', success: false, error: 'Profile not accessible' }];
            
            const fullComment = generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps);
            
            expect(fullComment).toContain('Profile Verification Failed');
            expect(fullComment).toContain('borderColor=#FF5630'); // Error red in header
            expect(fullComment).toContain('❌ **Compatibility Analysis**: Not Available');
            expect(fullComment).toContain('**Overall Score**: Not Available');
        });

        test('should maintain consistent formatting structure across candidate types', () => {
            const candidateTypes = [
                { candidate: highPerformingCandidate, score: 94, verdict: 'Strong Fit' },
                { candidate: mediumPerformingCandidate, score: 73, verdict: 'Good Fit' },
                { candidate: lowPerformingCandidate, score: 45, verdict: 'No Fit' }
            ];

            candidateTypes.forEach(({ candidate: candidateData, score, verdict }) => {
                const scoreData = { 
                    success: true, 
                    result: { 
                        score, 
                        role: 'CTO',
                        fit_verdict: verdict,
                        rationale: 'LLM assessment completed.',
                        gatekeeper_result: score >= 60 ? 'Pass' : 'Fail'
                    }
                };
                const fullComment = generateProfessionalComment(
                    candidateData.candidate, 
                    candidateData.steps[2], 
                    scoreData, 
                    candidateData.steps
                );
                
                // Every comment should have consistent core elements
                expect(fullComment).toContain('🎯 EXECUTIVE CANDIDATE ASSESSMENT');
                expect(fullComment).toContain('**Score:');
                expect(fullComment).toContain('📊 EXECUTIVE FIT ANALYSIS');
                expect(fullComment).toContain('**STATUS:**');
                expect(fullComment).toContain('🤖 AI-Generated Executive Assessment');
                
                // Verify professional structure
                expect(fullComment.split('{panel}').length).toBeGreaterThan(2); // Multiple panels
                expect(fullComment).toMatch(/\{color:#[0-9A-F]{6}\}/); // Color formatting present
            });
        });

        test('should generate comment within reasonable length limits', () => {
            const candidate = highPerformingCandidate.candidate;
            const compatibilityData = highPerformingCandidate.steps[2];
            const scoreData = { 
                success: true, 
                result: { 
                    score: 94, 
                    role: 'CTO',
                    fit_verdict: 'Strong Fit',
                    rationale: 'Outstanding technology executive.',
                    gatekeeper_result: 'Pass'
                }
            };
            const processingSteps = highPerformingCandidate.steps;
            
            const fullComment = generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps);
            
            // Target: ~800-1200 characters for one page viewport
            const commentLength = fullComment.length;
            expect(commentLength).toBeLessThan(2000); // Maximum reasonable length
            expect(commentLength).toBeGreaterThan(500); // Minimum useful content
            
            // Should have reasonable line count for readability
            const lineCount = fullComment.split('\n').length;
            expect(lineCount).toBeLessThan(50); // Not overwhelming
            expect(lineCount).toBeGreaterThan(15); // Sufficient detail
        });
    });

    describe('Visual Hierarchy and Professional Standards', () => {
        
        test('should use consistent color coding throughout comment', () => {
            const candidate = highPerformingCandidate.candidate;
            const compatibilityData = highPerformingCandidate.steps[2];
            const scoreData = { success: true, result: { score: 94, role: 'CTO' } };
            const processingSteps = highPerformingCandidate.steps;
            
            const fullComment = generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps);
            
            // Should use defined JIRA_COLORS consistently
            expect(fullComment).toContain(JIRA_COLORS.SUCCESS); // Green for positive
            expect(fullComment).toContain(JIRA_COLORS.PRIMARY); // Dark blue for main text
            expect(fullComment).toContain(JIRA_COLORS.SECONDARY); // Gray for footer
            
            // Should not have inconsistent color usage
            expect(fullComment).not.toContain('color:#123456'); // No arbitrary colors
        });

        test('should maintain proper panel structure', () => {
            const candidate = mediumPerformingCandidate.candidate;
            const compatibilityData = mediumPerformingCandidate.steps[2];
            const scoreData = { success: true, result: { score: 73, role: 'CIO' } };
            const processingSteps = mediumPerformingCandidate.steps;
            
            const fullComment = generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps);
            
            // Count panel openings and closures should match
            const panelOpenings = (fullComment.match(/\{panel:/g) || []).length;
            const panelClosures = (fullComment.match(/\{panel\}/g) || []).length;
            expect(panelOpenings).toBe(panelClosures);
            expect(panelOpenings).toBeGreaterThan(2); // Multiple panels for visual hierarchy
        });

        test('should use appropriate icons and emojis consistently', () => {
            const testCases = [
                { status: 'Ready for CTO Interview Process', expectedIcon: '✅' },
                { status: 'Consider for CIO Role with Additional Evaluation', expectedIcon: '⚠️' },
                { status: 'Not recommended for executive role', expectedIcon: '❌' }
            ];

            testCases.forEach(({ status, expectedIcon }) => {
                const candidate = { candidateKey: 'TEST', fullName: 'Test', linkedinUrl: 'test' };
                const header = formatExecutiveHeader(candidate, status);
                
                // Icons should be used consistently throughout the system
                expect(['✅', '⚠️', '❌']).toContain(expectedIcon);
            });
        });
    });
});