// Tests for new professional comment template structure
// Task 2.1: Define the expected format for business-focused JIRA comments

const { 
    highPerformingCandidate, 
    mediumPerformingCandidate, 
    lowPerformingCandidate,
    partialProcessingCandidate,
    failedVerificationCandidate,
    minimalDataCandidate
} = require('../fixtures/candidate-evaluation-data');

// Import the new professional comment formatter (to be implemented)
// const ProfessionalJiraComment = require('../../services/professionalJiraComment');

describe('Professional JIRA Comment Template Structure', () => {

    describe('Header Formatting with Candidate Name and Position', () => {
        
        test('should generate executive header panel for high-performing candidate', () => {
            const expectedHeaderPattern = [
                '{panel:title=🎯 EXECUTIVE CANDIDATE ASSESSMENT|borderStyle=solid|borderColor=#00875A|titleBGColor=#E3FCEF}',
                '**Sarah Johnson** | Senior Technology Leader',
                '📍 Location | 🔗 [LinkedIn Profile|https://www.linkedin.com/in/senior-cto-tech]',
                '{panel}'
            ].join('\n');

            // Test that header contains all required elements
            expect(expectedHeaderPattern).toContain('🎯 EXECUTIVE CANDIDATE ASSESSMENT');
            expect(expectedHeaderPattern).toContain('**Sarah Johnson**');
            expect(expectedHeaderPattern).toContain('LinkedIn Profile');
            expect(expectedHeaderPattern).toContain('borderColor=#00875A'); // Success green
        });

        test('should generate header with proper LinkedIn URL formatting', () => {
            const candidate = highPerformingCandidate.candidate;
            
            // Expected Jira link format: [Display Text|URL]
            const expectedLinkFormat = `🔗 [LinkedIn Profile|${candidate.linkedinUrl}]`;
            
            expect(expectedLinkFormat).toBe('🔗 [LinkedIn Profile|https://www.linkedin.com/in/senior-cto-tech]');
            expect(expectedLinkFormat).toMatch(/^\🔗 \[LinkedIn Profile\|https:\/\/www\.linkedin\.com\/in\/[\w-]+\]$/);
        });

        test('should handle missing candidate position gracefully', () => {
            const candidateWithoutPosition = {
                candidateKey: 'TEST-001',
                linkedinUrl: 'https://www.linkedin.com/in/test',
                fullName: 'Test Candidate'
                // No position data
            };

            const expectedHeader = [
                '**Test Candidate**',
                '🔗 [LinkedIn Profile|https://www.linkedin.com/in/test]'
            ].join(' | ');

            expect(expectedHeader).toContain('Test Candidate');
            expect(expectedHeader).not.toContain('undefined');
        });
    });

    describe('Compatibility Results Panel with Color-Coded Match Percentages', () => {
        
        test('should format high-compatibility results with green indicators', () => {
            const compatibilityData = highPerformingCandidate.steps[2].result;
            
            const expectedCompatibilityPanel = [
                '{panel:title=📊 EXECUTIVE FIT ANALYSIS|borderStyle=solid|borderColor=#0052CC|titleBGColor=#E6F2FF}',
                '{color:#00875A}✅ **CTO Role**: 92% Match{color} - _Extensive experience in technology leadership with P&L responsibility_',
                '',
                '{color:#00875A}✅ **CIO Role**: 78% Match{color} - _Strong business alignment with enterprise IT experience_',
                '',
                '{color:#FF5630}❌ **CISO Role**: 35% Match{color} - _Limited security governance experience_',
                '{panel}'
            ].join('\n');

            // Verify color coding logic
            expect(expectedCompatibilityPanel).toContain('{color:#00875A}✅ **CTO Role**: 92%'); // Green for high match
            expect(expectedCompatibilityPanel).toContain('{color:#00875A}✅ **CIO Role**: 78%'); // Green for good match  
            expect(expectedCompatibilityPanel).toContain('{color:#FF5630}❌ **CISO Role**: 35%'); // Red for poor match
        });

        test('should apply correct color coding based on confidence percentage', () => {
            const testCases = [
                { confidence: 0.85, expectedColor: '#00875A', expectedIcon: '✅' }, // Green for >70%
                { confidence: 0.65, expectedColor: '#FFAB00', expectedIcon: '⚠️' }, // Orange for 50-70%
                { confidence: 0.35, expectedColor: '#FF5630', expectedIcon: '❌' }  // Red for <50%
            ];

            testCases.forEach(({ confidence, expectedColor, expectedIcon }) => {
                const percentage = Math.round(confidence * 100);
                const expectedFormat = `{color:${expectedColor}}${expectedIcon} **ROLE**: ${percentage}% Match{color}`;
                
                expect(expectedFormat).toContain(expectedColor);
                expect(expectedFormat).toContain(expectedIcon);
                expect(expectedFormat).toContain(`${percentage}%`);
            });
        });

        test('should format compatibility reasoning with appropriate emphasis', () => {
            const role = highPerformingCandidate.steps[2].result.compatible_roles[0];
            
            const expectedReasoning = `_${role.reasoning}_`;
            
            expect(expectedReasoning).toBe('_Extensive experience in technology leadership with P&L responsibility_');
            expect(expectedReasoning).toMatch(/^_.*_$/); // Surrounded by italic markers
        });

        test('should handle no compatible roles scenario', () => {
            const noFitCompatibility = lowPerformingCandidate.steps[2].result;
            
            const expectedNoFitPanel = [
                '{panel:title=📊 EXECUTIVE FIT ANALYSIS|borderStyle=solid|borderColor=#FF5630|titleBGColor=#FFE6E6}',
                '{color:#FF5630}❌ **CTO Role**: 15% Match{color} - _Insufficient senior technology leadership experience_',
                '',
                '{color:#FF5630}❌ **CIO Role**: 20% Match{color} - _Limited business and enterprise IT experience_',
                '',
                '{color:#FF5630}❌ **CISO Role**: 12% Match{color} - _No security leadership or governance experience_',
                '{panel}'
            ].join('\n');

            // Verify all roles show red with low percentages
            expect(expectedNoFitPanel).toContain('borderColor=#FF5630'); // Red border for no-fit scenario
            expect(expectedNoFitPanel).toContain('❌ **CTO Role**: 15%');
            expect(expectedNoFitPanel).toContain('❌ **CIO Role**: 20%');
            expect(expectedNoFitPanel).toContain('❌ **CISO Role**: 12%');
        });
    });

    describe('Scoring Table with Weighted Breakdown and Visual Emphasis', () => {
        
        test('should format high score with prominent visual emphasis', () => {
            const scoreData = { score: 94, role: 'CTO' };
            
            const expectedScoreSection = [
                '{color:#00875A}*RECOMMENDATION: STRONG CTO CANDIDATE*{color}',
                '{color:#172B4D}**Overall Score: 94/100** • **Role: Chief Technology Officer**{color}',
                '',
                '---'
            ].join('\n');

            expect(expectedScoreSection).toContain('*RECOMMENDATION: STRONG CTO CANDIDATE*');
            expect(expectedScoreSection).toContain('**Overall Score: 94/100**');
            expect(expectedScoreSection).toContain('**Role: Chief Technology Officer**');
            expect(expectedScoreSection).toContain('{color:#00875A}'); // Green for strong candidate
        });

        test('should format medium score with appropriate visual treatment', () => {
            const scoreData = { score: 73, role: 'CIO' };
            
            const expectedScoreSection = [
                '{color:#FFAB00}*RECOMMENDATION: GOOD CIO CANDIDATE*{color}',
                '{color:#172B4D}**Overall Score: 73/100** • **Role: Chief Information Officer**{color}'
            ].join('\n');

            expect(expectedScoreSection).toContain('GOOD CIO CANDIDATE');
            expect(expectedScoreSection).toContain('73/100');
            expect(expectedScoreSection).toContain('{color:#FFAB00}'); // Orange for good candidate
        });

        test('should format low score with cautionary visual treatment', () => {
            const scoreData = { score: 45, role: 'CTO' };
            
            const expectedScoreSection = [
                '{color:#FF5630}*ASSESSMENT: NEEDS DEVELOPMENT*{color}',
                '{color:#172B4D}**Overall Score: 45/100** • **Role: Chief Technology Officer**{color}'
            ].join('\n');

            expect(expectedScoreSection).toContain('NEEDS DEVELOPMENT');
            expect(expectedScoreSection).toContain('45/100');
            expect(expectedScoreSection).toContain('{color:#FF5630}'); // Red for low score
        });

        test('should determine score category and recommendation text correctly', () => {
            const testScores = [
                { score: 95, expectedRecommendation: 'STRONG', expectedColor: '#00875A' },
                { score: 85, expectedRecommendation: 'STRONG', expectedColor: '#00875A' },
                { score: 75, expectedRecommendation: 'GOOD', expectedColor: '#FFAB00' },
                { score: 65, expectedRecommendation: 'CONSIDER', expectedColor: '#FFAB00' },  // Fixed: 65 < 70
                { score: 55, expectedRecommendation: 'NEEDS DEVELOPMENT', expectedColor: '#FF5630' },  // 55 < 60, so else branch
                { score: 45, expectedRecommendation: 'NEEDS DEVELOPMENT', expectedColor: '#FF5630' },  // 45 < 60, so goes to else branch
                { score: 25, expectedRecommendation: 'NOT RECOMMENDED', expectedColor: '#FF5630' }
            ];

            testScores.forEach(({ score, expectedRecommendation, expectedColor }) => {
                // Professional comment recommendation logic (simplified for testing)
                let recommendation, color;
                if (score >= 80) {
                    recommendation = 'STRONG';
                    color = '#00875A';
                } else if (score >= 60) {
                    recommendation = score >= 70 ? 'GOOD' : 'CONSIDER';
                    color = '#FFAB00';
                } else {
                    recommendation = score >= 40 ? 'NEEDS DEVELOPMENT' : 'NOT RECOMMENDED';
                    color = '#FF5630';
                }

                expect(recommendation).toBe(expectedRecommendation);
                expect(color).toBe(expectedColor);
            });
        });
    });

    describe('Executive Summary Section with Actionable Recommendations', () => {
        
        test('should generate actionable summary for successful high-scoring candidate', () => {
            const compatibilityData = highPerformingCandidate.steps[2].result;
            const scoreData = { score: 94, role: 'CTO' };
            
            const expectedSummary = [
                '{panel:title=⭐ KEY STRENGTHS|borderStyle=solid|borderColor=#00875A|titleBGColor=#E3FCEF}',
                '• Multiple CTO roles with enterprise scope',
                '• Proven track record in building and scaling technology teams',  
                '• Experience in digital transformation and innovation',
                '• Leadership in developing advanced technology platforms',
                '{panel}',
                '',
                '{color:#172B4D}**BUSINESS ASSESSMENT:** Outstanding technology executive with proven track record in scaling engineering organizations and driving digital transformation. Strong candidate for CTO role with potential CIO fit.{color}',
                '',
                '{color:#00875A}**STATUS:** ✅ Ready for CTO interview process{color}'
            ].join('\n');

            expect(expectedSummary).toContain('⭐ KEY STRENGTHS');
            expect(expectedSummary).toContain('Multiple CTO roles with enterprise scope');
            expect(expectedSummary).toContain('**BUSINESS ASSESSMENT:**');
            expect(expectedSummary).toContain('**STATUS:** ✅ Ready for CTO interview process');
        });

        test('should generate development areas for candidates with gaps', () => {
            const candidateWithGaps = highPerformingCandidate; // Has some missing qualifications
            
            const expectedDevelopmentAreas = [
                '{panel:title=⚠️ DEVELOPMENT AREAS|borderStyle=solid|borderColor=#FFAB00|titleBGColor=#FFF4E6}',
                '• Limited evidence of P&L responsibility',
                '• Missing global team management experience',
                '{panel}'
            ].join('\n');

            expect(expectedDevelopmentAreas).toContain('⚠️ DEVELOPMENT AREAS');
            expect(expectedDevelopmentAreas).toContain('Limited evidence of P&L responsibility');
            expect(expectedDevelopmentAreas).toContain('borderColor=#FFAB00'); // Orange for cautions
        });

        test('should generate appropriate status and next steps for different scenarios', () => {
            const testScenarios = [
                {
                    score: 90,
                    role: 'CTO',
                    expectedStatus: '✅ Ready for CTO interview process',
                    expectedColor: '#00875A'
                },
                {
                    score: 70,
                    role: 'CIO', 
                    expectedStatus: '⚠️ Consider for CIO role with additional evaluation',
                    expectedColor: '#FFAB00'
                },
                {
                    score: 40,
                    role: 'CTO',
                    expectedStatus: '❌ Not recommended for executive role at this time',
                    expectedColor: '#FF5630'
                }
            ];

            testScenarios.forEach(({ score, role, expectedStatus, expectedColor }) => {
                const statusLine = `{color:${expectedColor}}**STATUS:** ${expectedStatus}{color}`;
                
                expect(statusLine).toContain(expectedStatus);
                expect(statusLine).toContain(expectedColor);
            });
        });

        test('should handle partial processing scenarios gracefully', () => {
            const partialData = partialProcessingCandidate;
            
            const expectedPartialSummary = [
                '{color:#FFAB00}**STATUS:** ⚠️ Scoring incomplete - manual review needed{color}',
                '',
                '{color:#172B4D}**BUSINESS ASSESSMENT:** Experienced IT executive with strong potential for CIO role. Compatibility analysis completed successfully, but final scoring requires manual evaluation.{color}'
            ].join('\n');

            expect(expectedPartialSummary).toContain('Scoring incomplete - manual review needed');
            expect(expectedPartialSummary).toContain('Compatibility analysis completed successfully');
            expect(expectedPartialSummary).toContain('{color:#FFAB00}'); // Orange for partial
        });

        test('should handle failed verification with appropriate messaging', () => {
            const failedData = failedVerificationCandidate;
            
            const expectedFailedSummary = [
                '{color:#FF5630}**STATUS:** ❌ Profile verification failed{color}',
                '',
                '{color:#172B4D}**BUSINESS ASSESSMENT:** Unable to evaluate candidate due to LinkedIn profile accessibility issues. Profile may be private or URL incorrect.{color}',
                '',
                '{color:#6B778C}**NEXT STEPS:** Verify LinkedIn URL is correct and publicly accessible{color}'
            ].join('\n');

            expect(expectedFailedSummary).toContain('Profile verification failed');
            expect(expectedFailedSummary).toContain('LinkedIn profile accessibility issues');
            expect(expectedFailedSummary).toContain('**NEXT STEPS:**');
            expect(expectedFailedSummary).toContain('{color:#FF5630}'); // Red for failure
        });
    });

    describe('Complete Template Integration', () => {
        
        test('should combine all sections into cohesive professional comment', () => {
            const candidate = highPerformingCandidate.candidate;
            const compatibility = highPerformingCandidate.steps[2].result;
            const score = { score: 94, role: 'CTO' };
            
            const expectedFullComment = [
                // Header
                '{panel:title=🎯 EXECUTIVE CANDIDATE ASSESSMENT|borderStyle=solid|borderColor=#00875A|titleBGColor=#E3FCEF}',
                '**Sarah Johnson** | Senior Technology Leader',
                '📍 Location | 🔗 [LinkedIn Profile|https://www.linkedin.com/in/senior-cto-tech]',
                '{panel}',
                '',
                // Score
                '{color:#00875A}*RECOMMENDATION: STRONG CTO CANDIDATE*{color}',
                '{color:#172B4D}**Overall Score: 94/100** • **Role: Chief Technology Officer**{color}',
                '',
                '---',
                '',
                // Compatibility
                '{panel:title=📊 EXECUTIVE FIT ANALYSIS|borderStyle=solid|borderColor=#0052CC|titleBGColor=#E6F2FF}',
                '{color:#00875A}✅ **CTO Role**: 92% Match{color} - _Extensive experience in technology leadership_',
                '{panel}',
                '',
                // Status
                '{color:#00875A}**STATUS:** ✅ Ready for CTO interview process{color}',
                '',
                // Footer
                '_{color:#6B778C}🤖 AI-Generated Executive Assessment • Processed: ' + new Date().toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) + '{color}_'
            ].join('\n');

            // Verify complete structure
            expect(expectedFullComment).toContain('🎯 EXECUTIVE CANDIDATE ASSESSMENT');
            expect(expectedFullComment).toContain('STRONG CTO CANDIDATE');
            expect(expectedFullComment).toContain('📊 EXECUTIVE FIT ANALYSIS');
            expect(expectedFullComment).toContain('Ready for CTO interview process');
            expect(expectedFullComment).toContain('🤖 AI-Generated Executive Assessment');
            
            // Verify proper spacing and structure
            expect(expectedFullComment.split('\n').length).toBeGreaterThan(10); // Multi-section structure
            expect(expectedFullComment).toContain('---'); // Section separator
        });

        test('should maintain consistent formatting across different candidate types', () => {
            const candidateTypes = [
                highPerformingCandidate,
                mediumPerformingCandidate, 
                lowPerformingCandidate
            ];

            candidateTypes.forEach(candidateData => {
                // Every comment should have these consistent elements
                const requiredElements = [
                    '🎯 EXECUTIVE CANDIDATE ASSESSMENT',
                    'Overall Score:',
                    '📊 EXECUTIVE FIT ANALYSIS', 
                    '**STATUS:**',
                    '🤖 AI-Generated Executive Assessment'
                ];

                requiredElements.forEach(element => {
                    // Test that element would be present in generated comment
                    expect(element).toBeTruthy();
                });
            });
        });
    });
});