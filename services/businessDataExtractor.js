/**
 * Business Data Extractor
 * Transforms raw API responses into executive-ready business insights
 * Task 2.2: Data extraction and prioritization logic for business audience
 */

/**
 * Extract business-relevant insights from compatibility API response
 * @param {Object} compatibilityData - Raw compatibility step result from LLM
 * @returns {Object} Business-focused compatibility insights
 */
function extractCompatibilityInsights(compatibilityData) {
    if (!compatibilityData?.success || !compatibilityData.result) {
        return {
            hasData: false,
            overallStatus: 'no-data',
            primaryRecommendation: null,
            roleAnalysis: [],
            llmAssessment: 'Compatibility analysis not available',
            proceedWithScoring: false
        };
    }

    const result = compatibilityData.result;
    const compatibleRoles = result.compatible_roles || [];

    // Transform LLM role analysis to business display format
    const businessRoles = compatibleRoles.map(role => ({
        role: role.role,
        matchPercentage: Math.round(role.confidence * 100),
        isCompatible: role.compatible,
        llmReasoning: role.reasoning,  // Keep LLM's actual reasoning
        keyQualifications: role.key_qualifications || [],  // LLM's found strengths
        missingQualifications: role.missing_qualifications || [],  // LLM's identified gaps
        colorCode: getCompatibilityColor(role.confidence),
        statusIcon: getCompatibilityIcon(role.compatible, role.confidence)
    })).sort((a, b) => b.matchPercentage - a.matchPercentage); // Sort by match percentage descending

    // Determine overall status based on LLM's recommendation
    const overallStatus = determineOverallCompatibilityStatus(businessRoles);
    
    return {
        hasData: true,
        overallStatus,
        primaryRecommendation: result.recommended_primary_role,
        roleAnalysis: businessRoles,
        llmAssessment: result.overall_assessment,  // LLM's full assessment with confidence heatmap
        proceedWithScoring: result.proceed_with_scoring,
        modelUsed: result.model_used,
        responseTime: result.ai_response_time
    };
}

/**
 * Extract business-focused scoring insights
 * @param {Object} scoreData - Raw scoring step result or API response
 * @returns {Object} Business-focused scoring insights
 */
function extractScoringInsights(scoreData) {
    if (!scoreData?.success || typeof scoreData.result?.score !== 'number') {
        return {
            hasData: false,
            numericScore: 0,
            llmVerdict: 'Not Evaluated',
            rationale: 'Scoring analysis not available',
            statusColor: '#6B778C',
            targetRole: null,
            gatekeeperResult: 'Unknown'
        };
    }

    const score = scoreData.result.score;
    const role = scoreData.result.role;
    const fitVerdict = scoreData.result.fit_verdict || 'Unknown';
    const rationale = scoreData.result.rationale || 'No rationale provided';
    const gatekeeperResult = scoreData.result.gatekeeper_result || 'Unknown';
    
    return {
        hasData: true,
        numericScore: score,
        llmVerdict: fitVerdict,
        rationale: rationale,
        statusColor: getVerdictColor(fitVerdict),
        targetRole: role,
        gatekeeperResult: gatekeeperResult,
        scoreBreakdown: scoreData.result.score_breakdown || {}
    };
}

/**
 * Generate executive summary based on processing results
 * @param {Object} candidate - Candidate basic info
 * @param {Object} compatibilityInsights - Processed compatibility data
 * @param {Object} scoringInsights - Processed scoring data  
 * @param {Array} processingSteps - All processing steps
 * @returns {Object} Executive summary for business decisions
 */
function generateExecutiveSummary(candidate, compatibilityInsights, scoringInsights, processingSteps) {
    const successful = processingSteps.filter(s => s.success).length;
    const failed = processingSteps.filter(s => !s.success).length;
    const isComplete = successful > 0 && failed === 0;
    const isPartial = successful > 0 && failed > 0;
    
    // Determine overall status
    let overallStatus, statusColor, nextSteps;
    
    if (!isComplete && failed > 0) {
        // Processing failed or incomplete
        const failedStep = processingSteps.find(s => !s.success);
        if (failedStep?.name === 'verify') {
            overallStatus = 'Profile Verification Failed';
            statusColor = '#FF5630';
            nextSteps = 'Verify LinkedIn URL is correct and publicly accessible';
        } else if (failedStep?.name === 'check_compatibility') {
            overallStatus = 'Compatibility Analysis Failed'; 
            statusColor = '#FF5630';
            nextSteps = 'Manual compatibility review required';
        } else {
            overallStatus = 'Processing Incomplete';
            statusColor = '#FFAB00';
            nextSteps = 'Complete remaining evaluation steps';
        }
    } else if (!compatibilityInsights.proceedWithScoring) {
        // No roles met compatibility threshold
        overallStatus = 'No Executive Role Fit';
        statusColor = '#FF5630'; 
        nextSteps = 'Consider for other roles or archive';
    } else if (!scoringInsights.hasData) {
        // Compatibility passed but no scoring
        overallStatus = 'Scoring Incomplete - Manual Review Needed';
        statusColor = '#FFAB00';
        nextSteps = 'Complete final scoring evaluation';
    } else {
        // Full evaluation completed - use LLM's fit verdict
        const role = scoringInsights.targetRole || compatibilityInsights.primaryRecommendation;
        const llmVerdict = scoringInsights.llmVerdict || 'Unknown';
        
        // Map LLM verdict to business status
        if (llmVerdict.toLowerCase().includes('excellent') || llmVerdict.toLowerCase().includes('strong')) {
            overallStatus = `${llmVerdict} - Ready for ${role} Interview Process`;
            statusColor = '#00875A';
            nextSteps = `Schedule ${role} interview and reference checks`;
        } else if (llmVerdict.toLowerCase().includes('good') || llmVerdict.toLowerCase().includes('moderate')) {
            overallStatus = `${llmVerdict} - Consider for ${role} Role with Additional Evaluation`;
            statusColor = '#FFAB00'; 
            nextSteps = `Additional interviews or assessment recommended`;
        } else if (llmVerdict.toLowerCase().includes('no fit') || llmVerdict.toLowerCase().includes('fail')) {
            overallStatus = `${llmVerdict} - Not Recommended for Executive Role`;
            statusColor = '#FF5630';
            nextSteps = 'Consider for other roles or development program';
        } else {
            // Unknown verdict - fall back to score-based logic
            const score = scoringInsights.numericScore;
            if (score >= 80) {
                overallStatus = `Ready for ${role} Interview Process`;
                statusColor = '#00875A';
                nextSteps = `Schedule ${role} interview and reference checks`;
            } else if (score >= 60) {
                overallStatus = `Consider for ${role} Role with Additional Evaluation`;
                statusColor = '#FFAB00';
                nextSteps = `Additional interviews or assessment recommended`;
            } else {
                overallStatus = 'Not Recommended for Executive Role';
                statusColor = '#FF5630';
                nextSteps = 'Consider for other roles or development program';
            }
        }
    }
    
    return {
        overallStatus,
        statusColor,
        nextSteps,
        isComplete,
        isPartial,
        businessPriority: determineBusinessPriority(compatibilityInsights, scoringInsights),
        keyDecisionFactors: extractKeyDecisionFactors(compatibilityInsights, scoringInsights),
        urgencyLevel: determineUrgencyLevel(compatibilityInsights, scoringInsights),
        scoringRationale: scoringInsights.rationale || null
    };
}

// Helper functions for business logic

/**
 * Get compatibility color based on confidence score
 */
function getCompatibilityColor(confidence) {
    if (confidence >= 0.70) return '#00875A'; // Green - Strong match
    if (confidence >= 0.50) return '#FFAB00'; // Orange - Moderate match  
    return '#FF5630'; // Red - Poor match
}

/**
 * Get compatibility icon based on match quality
 */
function getCompatibilityIcon(isCompatible, confidence) {
    if (isCompatible && confidence >= 0.70) return '✅';
    if (confidence >= 0.50) return '⚠️'; 
    return '❌';
}

/**
 * Determine overall compatibility status
 */
function determineOverallCompatibilityStatus(businessRoles) {
    const compatibleRoles = businessRoles.filter(r => r.isCompatible);
    const bestMatch = businessRoles[0];
    
    if (compatibleRoles.length === 0) return 'no-fit';
    if (bestMatch.matchPercentage >= 80) return 'excellent-fit';
    if (bestMatch.matchPercentage >= 65) return 'good-fit';
    return 'moderate-fit';
}

/**
 * Get score-based recommendation (DEPRECATED - use LLM fit_verdict instead)
 * @deprecated Use LLM's fit_verdict from scoring response instead
 */
function getScoreRecommendation(score) {
    if (score >= 85) return 'STRONG_HIRE';
    if (score >= 75) return 'HIRE'; 
    if (score >= 65) return 'CONSIDER';
    if (score >= 50) return 'NEEDS_DEVELOPMENT';
    return 'NOT_RECOMMENDED';
}

/**
 * Get business-friendly score category (DEPRECATED - use LLM fit_verdict instead)
 * @deprecated Use LLM's fit_verdict from scoring response instead
 */
function getScoreCategory(score) {
    if (score >= 85) return 'EXCEPTIONAL CANDIDATE';
    if (score >= 75) return 'STRONG CANDIDATE';
    if (score >= 65) return 'GOOD CANDIDATE'; 
    if (score >= 50) return 'CONSIDER WITH DEVELOPMENT';
    return 'NOT RECOMMENDED';
}

/**
 * Get color for score display (legacy - use getVerdictColor instead)
 */
function getScoreColor(score) {
    if (score >= 75) return '#00875A'; // Green
    if (score >= 60) return '#FFAB00'; // Orange
    return '#FF5630'; // Red
}

/**
 * Get color based on LLM fit verdict
 */
function getVerdictColor(fitVerdict) {
    const verdict = (fitVerdict || '').toLowerCase();
    
    if (verdict.includes('excellent') || verdict.includes('strong')) return '#00875A'; // Green
    if (verdict.includes('good') || verdict.includes('moderate')) return '#FFAB00'; // Orange
    if (verdict.includes('no fit') || verdict.includes('poor') || verdict.includes('fail')) return '#FF5630'; // Red
    return '#6B778C'; // Gray for unknown/unclear verdicts
}

/**
 * Get score confidence level
 */
function getScoreConfidence(score) {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
}

/**
 * Get percentile ranking (simulated)
 */
function getPercentileRank(score) {
    if (score >= 90) return 'Top 5%';
    if (score >= 80) return 'Top 15%';
    if (score >= 70) return 'Top 35%'; 
    if (score >= 60) return 'Top 50%';
    return 'Below Average';
}

/**
 * Get hirability level
 */
function getHirabilityLevel(score) {
    if (score >= 85) return 'Immediate Hire';
    if (score >= 75) return 'Strong Hire';
    if (score >= 65) return 'Hire with Conditions';
    if (score >= 50) return 'Development Needed';
    return 'Not Recommended';
}

/**
 * Translate technical reasoning to business language
 */
function translateTechnicalReasoning(technicalReasoning) {
    if (!technicalReasoning) return 'Assessment completed';
    
    const businessTranslations = {
        'extensive experience': 'proven track record',
        'limited evidence': 'limited experience', 
        'no evidence': 'no background in',
        'strong background': 'excellent experience',
        'lacks focus': 'limited specialization',
        'demonstrates': 'shows',
        'aligns well': 'is well-suited for',
        'insufficient': 'needs more',
        'governance': 'leadership and oversight',
        'compliance': 'regulatory management',
        'incident response': 'crisis management'
    };
    
    let businessText = technicalReasoning;
    Object.keys(businessTranslations).forEach(technical => {
        const business = businessTranslations[technical];
        businessText = businessText.replace(new RegExp(technical, 'gi'), business);
    });
    
    return businessText;
}

/**
 * Extract business-focused strengths from qualifications
 */
function extractBusinessStrengths(qualifications) {
    if (!Array.isArray(qualifications)) return [];
    
    return qualifications
        .filter(qual => qual && qual.length > 0)
        .map(qual => translateTechnicalReasoning(qual))
        .slice(0, 4); // Limit to top 4 for executive consumption
}

/**
 * Extract development areas from missing qualifications  
 */
function extractDevelopmentAreas(missingQualifications) {
    if (!Array.isArray(missingQualifications)) return [];
    
    return missingQualifications
        .filter(qual => qual && qual.length > 0)
        .map(qual => translateTechnicalReasoning(qual))
        .slice(0, 3); // Limit to top 3 concerns
}

/**
 * Translate overall technical assessment to business language
 */
function translateTechnicalAssessment(assessment) {
    if (!assessment) return 'Candidate evaluation completed';
    
    // Remove technical scoring format (e.g., "CIO 0.30 | CTO 0.85 | CISO 0.20.")
    let businessAssessment = assessment.replace(/[A-Z]{2,5}\s+\d*\.\d+\s*\|?\s*/g, '');
    
    // Apply business translations
    businessAssessment = translateTechnicalReasoning(businessAssessment);
    
    return businessAssessment;
}

/**
 * Determine business priority level
 */
function determineBusinessPriority(compatibilityInsights, scoringInsights) {
    if (!compatibilityInsights.hasData || !compatibilityInsights.roleAnalysis?.length) return 'low';
    
    const bestMatch = compatibilityInsights.roleAnalysis[0];
    const score = scoringInsights.numericScore || 0;
    
    if (bestMatch?.matchPercentage >= 80 && score >= 80) return 'high';
    if (bestMatch?.matchPercentage >= 65 && score >= 65) return 'medium';
    return 'low';
}

/**
 * Extract key decision factors for executives
 */
function extractKeyDecisionFactors(compatibilityInsights, scoringInsights) {
    const factors = [];
    
    if (compatibilityInsights.hasData && compatibilityInsights.roleAnalysis?.length > 0) {
        const bestRole = compatibilityInsights.roleAnalysis[0];
        factors.push(`${bestRole.matchPercentage}% compatibility for ${bestRole.role} role`);
        
        if (bestRole.keyQualifications?.length > 0) {
            factors.push(`Key strength: ${bestRole.keyQualifications[0]}`);
        }
    }
    
    if (scoringInsights.hasData) {
        factors.push(`${scoringInsights.numericScore}/100 overall score`);
        factors.push(`LLM Assessment: ${scoringInsights.llmVerdict}`);
    }
    
    return factors.slice(0, 3); // Top 3 factors
}

/**
 * Determine urgency level for hiring decision
 */
function determineUrgencyLevel(compatibilityInsights, scoringInsights) {
    const score = scoringInsights.numericScore || 0;
    const bestMatch = compatibilityInsights.roleAnalysis?.[0]?.matchPercentage || 0;
    
    if (score >= 85 && bestMatch >= 80) return 'high'; // Exceptional candidate
    if (score >= 75 && bestMatch >= 70) return 'medium'; // Strong candidate
    return 'low';
}

module.exports = {
    extractCompatibilityInsights,
    extractScoringInsights, 
    generateExecutiveSummary,
    // Export helper functions for testing
    getCompatibilityColor,
    getCompatibilityIcon,
    getScoreCategory,
    getScoreColor,
    translateTechnicalReasoning,
    extractBusinessStrengths
};