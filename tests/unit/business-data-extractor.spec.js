// Tests for business data extraction and prioritization logic
// Task 2.2: Validate data transformation functions

const {
    extractCompatibilityInsights,
    extractScoringInsights,
    generateExecutiveSummary,
    getCompatibilityColor,
    getCompatibilityIcon,
    getScoreCategory,
    getScoreColor,
    translateTechnicalReasoning,
    extractBusinessStrengths
} = require('../../services/businessDataExtractor');

const { 
    highPerformingCandidate, 
    mediumPerformingCandidate, 
    lowPerformingCandidate 
} = require('../fixtures/candidate-evaluation-data');

describe('Business Data Extractor', () => {

    describe('Compatibility Data Extraction', () => {
        
        test('should extract business insights from high-performing candidate compatibility', () => {
            const compatibilityStep = highPerformingCandidate.steps[2];
            const insights = extractCompatibilityInsights(compatibilityStep);
            
            expect(insights.hasData).toBe(true);
            expect(insights.overallStatus).toBe('excellent-fit');
            expect(insights.primaryRecommendation).toBe('CTO');
            expect(insights.roleAnalysis).toHaveLength(3);
            
            // Check role analysis sorting (highest match first)
            expect(insights.roleAnalysis[0].role).toBe('CTO');
            expect(insights.roleAnalysis[0].matchPercentage).toBe(92);
            expect(insights.roleAnalysis[0].isCompatible).toBe(true);
        });

        test('should apply correct color coding for compatibility percentages', () => {
            const testCases = [
                { confidence: 0.85, expectedColor: '#00875A', expectedIcon: '✅' },
                { confidence: 0.65, expectedColor: '#FFAB00', expectedIcon: '⚠️' },
                { confidence: 0.35, expectedColor: '#FF5630', expectedIcon: '❌' }
            ];

            testCases.forEach(({ confidence, expectedColor, expectedIcon }) => {
                expect(getCompatibilityColor(confidence)).toBe(expectedColor);
                const isCompatible = confidence >= 0.50;
                expect(getCompatibilityIcon(isCompatible, confidence)).toBe(expectedIcon);
            });
        });

        test('should handle missing compatibility data gracefully', () => {
            const emptyStep = { success: false };
            const insights = extractCompatibilityInsights(emptyStep);
            
            expect(insights.hasData).toBe(false);
            expect(insights.overallStatus).toBe('no-data');
            expect(insights.llmAssessment).toContain('not available');
        });

        test('should translate technical reasoning to business language', () => {
            const technicalText = 'Extensive experience in technology governance and compliance management';
            const businessText = translateTechnicalReasoning(technicalText);
            
            expect(businessText).toContain('proven track record');
            expect(businessText).toContain('regulatory management');
            expect(businessText).not.toContain('compliance management');
        });
    });

    describe('Scoring Data Extraction', () => {
        
        test('should extract business insights from scoring data', () => {
            const scoreStep = { 
                success: true, 
                result: { 
                    score: 94, 
                    role: 'CTO',
                    fit_verdict: 'Strong Fit',
                    rationale: 'Outstanding technology executive with proven track record.',
                    gatekeeper_result: 'Pass'
                } 
            };
            const insights = extractScoringInsights(scoreStep);
            
            expect(insights.hasData).toBe(true);
            expect(insights.numericScore).toBe(94);
            expect(insights.llmVerdict).toBe('Strong Fit');
            expect(insights.rationale).toBe('Outstanding technology executive with proven track record.');
            expect(insights.statusColor).toBe('#00875A');
            expect(insights.targetRole).toBe('CTO');
            expect(insights.gatekeeperResult).toBe('Pass');
        });

        test('should categorize scores correctly', () => {
            const testScores = [
                { score: 95, expectedCategory: 'EXCEPTIONAL CANDIDATE', expectedColor: '#00875A' },
                { score: 80, expectedCategory: 'STRONG CANDIDATE', expectedColor: '#00875A' },
                { score: 70, expectedCategory: 'GOOD CANDIDATE', expectedColor: '#FFAB00' },
                { score: 55, expectedCategory: 'CONSIDER WITH DEVELOPMENT', expectedColor: '#FF5630' },
                { score: 30, expectedCategory: 'NOT RECOMMENDED', expectedColor: '#FF5630' }
            ];

            testScores.forEach(({ score, expectedCategory, expectedColor }) => {
                expect(getScoreCategory(score)).toBe(expectedCategory);
                expect(getScoreColor(score)).toBe(expectedColor);
            });
        });

        test('should handle missing scoring data', () => {
            const emptyStep = { success: false };
            const insights = extractScoringInsights(emptyStep);
            
            expect(insights.hasData).toBe(false);
            expect(insights.numericScore).toBe(0);
            expect(insights.llmVerdict).toBe('Not Evaluated');
            expect(insights.rationale).toBe('Scoring analysis not available');
        });
    });

    describe('Executive Summary Generation', () => {
        
        test('should generate complete summary for successful high-performing candidate', () => {
            const candidate = highPerformingCandidate.candidate;
            const compatibilityInsights = extractCompatibilityInsights(highPerformingCandidate.steps[2]);
            const scoringInsights = extractScoringInsights(highPerformingCandidate.steps[3]);
            const steps = highPerformingCandidate.steps;
            
            const summary = generateExecutiveSummary(candidate, compatibilityInsights, scoringInsights, steps);
            
            expect(summary.isComplete).toBe(true);
            expect(summary.overallStatus).toContain('Ready for CTO Interview Process');
            expect(summary.statusColor).toBe('#00875A');
            expect(summary.businessPriority).toBe('high');
            expect(summary.nextSteps).toContain('Schedule CTO interview');
        });

        test('should handle failed verification scenario', () => {
            const candidate = { candidateKey: 'TEST-FAIL', linkedinUrl: 'invalid', fullName: 'Test' };
            const failedSteps = [{ name: 'verify', success: false, error: 'Profile not accessible' }];
            const emptyCompatibility = { hasData: false };
            const emptyScoring = { hasData: false };
            
            const summary = generateExecutiveSummary(candidate, emptyCompatibility, emptyScoring, failedSteps);
            
            expect(summary.isComplete).toBe(false);
            expect(summary.overallStatus).toBe('Profile Verification Failed');
            expect(summary.statusColor).toBe('#FF5630');
            expect(summary.nextSteps).toContain('Verify LinkedIn URL');
        });

        test('should handle partial processing (compatibility but no scoring)', () => {
            const candidate = { candidateKey: 'TEST-PARTIAL', linkedinUrl: 'test', fullName: 'Test' };
            const partialSteps = [
                { name: 'verify', success: true },
                { name: 'check_compatibility', success: true },
                { name: 'score', success: false, error: 'Timeout' }
            ];
            const goodCompatibility = { 
                hasData: true, 
                proceedWithScoring: true,
                primaryRecommendation: 'CIO'
            };
            const noScoring = { hasData: false };
            
            const summary = generateExecutiveSummary(candidate, goodCompatibility, noScoring, partialSteps);
            
            expect(summary.isPartial).toBe(true);
            expect(summary.overallStatus).toBe('Processing Incomplete');
            expect(summary.statusColor).toBe('#FFAB00');
        });

        test('should handle scoring incomplete scenario (compatibility passed, no scoring step)', () => {
            const candidate = { candidateKey: 'TEST-NO-SCORING', linkedinUrl: 'test', fullName: 'Test' };
            const completedSteps = [
                { name: 'verify', success: true },
                { name: 'check_compatibility', success: true }
                // No scoring step at all
            ];
            const goodCompatibility = { 
                hasData: true, 
                proceedWithScoring: true,
                primaryRecommendation: 'CIO'
            };
            const noScoring = { hasData: false };
            
            const summary = generateExecutiveSummary(candidate, goodCompatibility, noScoring, completedSteps);
            
            expect(summary.overallStatus).toBe('Scoring Incomplete - Manual Review Needed');
            expect(summary.statusColor).toBe('#FFAB00');
        });

        test('should handle no-fit scenario (compatibility failed)', () => {
            const candidate = lowPerformingCandidate.candidate;
            const compatibilityInsights = extractCompatibilityInsights(lowPerformingCandidate.steps[2]);
            const noScoring = { hasData: false };
            const steps = lowPerformingCandidate.steps;
            
            // Modify compatibility to not proceed with scoring
            compatibilityInsights.proceedWithScoring = false;
            
            const summary = generateExecutiveSummary(candidate, compatibilityInsights, noScoring, steps);
            
            expect(summary.overallStatus).toBe('No Executive Role Fit');
            expect(summary.statusColor).toBe('#FF5630');
            expect(summary.nextSteps).toContain('Consider for other roles');
        });
    });

    describe('Business Language Translation', () => {
        
        test('should extract business strengths from technical qualifications', () => {
            const technicalQuals = [
                'Multiple CTO roles with enterprise scope',
                'Experience in cloud migration and infrastructure consolidation',
                'Proven track record in building and scaling technology teams',
                'Leadership in developing advanced technology platforms',
                'Digital transformation and innovation experience'
            ];
            
            const businessStrengths = extractBusinessStrengths(technicalQuals);
            
            expect(businessStrengths).toHaveLength(4); // Limited to 4 for executives
            expect(businessStrengths[0]).toContain('Multiple CTO roles');
            expect(businessStrengths).not.toContain('infrastructure consolidation'); // Too technical
        });

        test('should handle various technical terms in reasoning', () => {
            const testTranslations = [
                { 
                    technical: 'Limited evidence of governance and compliance experience',
                    business: 'Limited experience of leadership and oversight and regulatory management experience'
                },
                {
                    technical: 'Extensive experience aligns well with CTO responsibilities',
                    business: 'proven track record is well-suited for CTO responsibilities'
                },
                {
                    technical: 'Insufficient incident response capabilities',
                    business: 'needs more crisis management capabilities'
                }
            ];

            testTranslations.forEach(({ technical, business }) => {
                const result = translateTechnicalReasoning(technical);
                // Check that key business terms are present
                if (business.includes('proven track record')) {
                    expect(result).toContain('proven track record');
                }
                if (business.includes('regulatory management')) {
                    expect(result).toContain('regulatory management');
                }
                if (business.includes('crisis management')) {
                    expect(result).toContain('crisis management');
                }
            });
        });
    });

    describe('Impact Level Assessment and Prioritization', () => {
        
        test('should determine correct business priority levels', () => {
            // High priority: Strong compatibility + high score
            const highPriorityCompat = { hasData: true, roleAnalysis: [{ matchPercentage: 85 }] };
            const highPriorityScore = { numericScore: 90 };
            
            const summary1 = generateExecutiveSummary({}, highPriorityCompat, highPriorityScore, []);
            expect(summary1.businessPriority).toBe('high');
            
            // Medium priority: Good compatibility + medium score  
            const medPriorityCompat = { hasData: true, roleAnalysis: [{ matchPercentage: 70 }] };
            const medPriorityScore = { numericScore: 70 };
            
            const summary2 = generateExecutiveSummary({}, medPriorityCompat, medPriorityScore, []);
            expect(summary2.businessPriority).toBe('medium');
            
            // Low priority: Poor compatibility or low score
            const lowPriorityCompat = { hasData: true, roleAnalysis: [{ matchPercentage: 45 }] };
            const lowPriorityScore = { numericScore: 50 };
            
            const summary3 = generateExecutiveSummary({}, lowPriorityCompat, lowPriorityScore, []);
            expect(summary3.businessPriority).toBe('low');
        });

        test('should extract key decision factors for executives', () => {
            const compatibilityInsights = extractCompatibilityInsights(highPerformingCandidate.steps[2]);
            const scoringInsights = extractScoringInsights(highPerformingCandidate.steps[3]);
            
            const summary = generateExecutiveSummary({}, compatibilityInsights, scoringInsights, []);
            
            expect(summary.keyDecisionFactors).toHaveLength(3);
            expect(summary.keyDecisionFactors[0]).toContain('92% compatibility');
            expect(summary.keyDecisionFactors[1]).toContain('Key strength');
            expect(summary.keyDecisionFactors[2]).toContain('/100 overall score');
        });

        test('should determine urgency level appropriately', () => {
            // High urgency: Exceptional candidate  
            const exceptionalCompat = { roleAnalysis: [{ matchPercentage: 88 }] };
            const exceptionalScore = { numericScore: 92 };
            const summary1 = generateExecutiveSummary({}, exceptionalCompat, exceptionalScore, []);
            expect(summary1.urgencyLevel).toBe('high');
            
            // Medium urgency: Strong candidate
            const strongCompat = { roleAnalysis: [{ matchPercentage: 75 }] };
            const strongScore = { numericScore: 78 };
            const summary2 = generateExecutiveSummary({}, strongCompat, strongScore, []);
            expect(summary2.urgencyLevel).toBe('medium');
            
            // Low urgency: Average candidate
            const avgCompat = { roleAnalysis: [{ matchPercentage: 60 }] };
            const avgScore = { numericScore: 65 };  
            const summary3 = generateExecutiveSummary({}, avgCompat, avgScore, []);
            expect(summary3.urgencyLevel).toBe('low');
        });
    });
});