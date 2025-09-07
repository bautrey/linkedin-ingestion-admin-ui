/**
 * Professional Jira Comment Formatter
 * Creates executive-ready Jira comments with proper markup and visual hierarchy
 * Task 2.3: Implement Jira markup formatting functions
 */

const {
    extractCompatibilityInsights,
    extractScoringInsights,
    generateExecutiveSummary
} = require('./businessDataExtractor');

/**
 * JIRA Formatting Constants for consistent professional styling
 */
const JIRA_COLORS = {
    SUCCESS: '#00875A',        // Green for positive results
    WARNING: '#FFAB00',        // Orange for cautions  
    ERROR: '#FF5630',          // Red for negative results
    PRIMARY: '#172B4D',        // Dark blue for main text
    SECONDARY: '#6B778C'       // Gray for secondary info
};

const JIRA_PANELS = {
    EXECUTIVE_SUMMARY: { 
        borderColor: '#00875A', 
        titleBGColor: '#E3FCEF' 
    },
    FIT_ANALYSIS: { 
        borderColor: '#0052CC', 
        titleBGColor: '#E6F2FF' 
    },
    STRENGTHS: { 
        borderColor: '#00875A', 
        titleBGColor: '#E3FCEF' 
    },
    CONCERNS: { 
        borderColor: '#FFAB00', 
        titleBGColor: '#FFF4E6' 
    }
};

/**
 * Format executive header panel with candidate information
 * @param {Object} candidate - Basic candidate information
 * @param {string} overallStatus - Overall assessment status
 * @returns {string} Formatted Jira header markup
 */
function formatExecutiveHeader(candidate, overallStatus) {
    const { fullName, linkedinUrl, position } = candidate;
    
    // Determine header color based on overall status
    let headerColor = JIRA_COLORS.PRIMARY;
    if (overallStatus.includes('Ready for') || overallStatus.includes('Strong')) {
        headerColor = JIRA_COLORS.SUCCESS;
    } else if (overallStatus.includes('Consider') || overallStatus.includes('Incomplete')) {
        headerColor = JIRA_COLORS.WARNING;
    } else if (overallStatus.includes('Failed') || overallStatus.includes('Not')) {
        headerColor = JIRA_COLORS.ERROR;
    }

    const candidateInfo = [
        `**${fullName}**`,
        position ? position : null,
        `🔗 [LinkedIn Profile|${linkedinUrl}]`
    ].filter(Boolean).join(' | ');

    return [
        `{panel:title=🎯 EXECUTIVE CANDIDATE ASSESSMENT|borderStyle=solid|borderColor=${headerColor}|titleBGColor=#E3FCEF}`,
        candidateInfo,
        '{panel}'
    ].join('\n');
}

/**
 * Format compatibility results with LLM reasoning and qualifications
 * @param {Object} compatibilityInsights - Processed compatibility data from LLM
 * @returns {string} Formatted Jira compatibility panel
 */
function formatCompatibilityResults(compatibilityInsights) {
    if (!compatibilityInsights.hasData) {
        return [
            '{panel:title=📊 EXECUTIVE FIT ANALYSIS|borderStyle=solid|borderColor=#FF5630|titleBGColor=#FFE6E6}',
            '{color:#FF5630}❌ **Compatibility Analysis**: Not Available{color}',
            '',
            '_Compatibility analysis could not be completed. Manual review required._',
            '{panel}'
        ].join('\n');
    }

    const { roleAnalysis, llmAssessment } = compatibilityInsights;
    
    // Create detailed role entries with LLM's actual analysis
    const roleEntries = roleAnalysis.map(role => {
        const header = `{color:${role.colorCode}}${role.statusIcon} **${role.role} Role**: ${role.matchPercentage}% Match{color}`;
        const reasoning = role.llmReasoning ? `_${role.llmReasoning}_` : '';
        
        // Show key qualifications if found
        let qualifications = '';
        if (role.keyQualifications && role.keyQualifications.length > 0) {
            const keyQuals = role.keyQualifications.slice(0, 3).map(q => `• ${q}`).join('\n');
            qualifications = `**Key Strengths:**\n${keyQuals}`;
        }
        
        // Show missing qualifications for development areas  
        let gaps = '';
        if (role.missingQualifications && role.missingQualifications.length > 0) {
            const missingQuals = role.missingQualifications.slice(0, 2).map(q => `• ${q}`).join('\n');
            gaps = `**Development Areas:**\n${missingQuals}`;
        }
        
        return [header, reasoning, qualifications, gaps].filter(Boolean).join('\n');
    }).join('\n\n');

    // Add LLM's overall assessment at the bottom
    const overallSection = llmAssessment ? [
        '---',
        `{color:${JIRA_COLORS.PRIMARY}}**LLM ASSESSMENT:** ${llmAssessment}{color}`
    ].join('\n') : '';

    return [
        '{panel:title=📊 EXECUTIVE FIT ANALYSIS|borderStyle=solid|borderColor=#0052CC|titleBGColor=#E6F2FF}',
        roleEntries,
        overallSection,
        '{panel}'
    ].join('\n');
}

/**
 * Format scoring breakdown with LLM verdict and rationale
 * @param {Object} scoringInsights - Processed scoring data
 * @returns {string} Formatted Jira scoring section
 */
function formatScoringBreakdown(scoringInsights) {
    if (!scoringInsights.hasData) {
        return [
            '{color:#6B778C}**Overall Score**: Not Available{color}',
            '',
            '_Scoring analysis incomplete - manual evaluation required._'
        ].join('\n');
    }

    const { numericScore, llmVerdict, rationale, targetRole, statusColor } = scoringInsights;
    const roleTitle = getFullRoleTitle(targetRole);

    return [
        `{color:${statusColor}}*LLM ASSESSMENT: ${llmVerdict.toUpperCase()}*{color}`,
        `{color:${JIRA_COLORS.PRIMARY}}**Score: ${numericScore}/100** • **Role: ${roleTitle}**{color}`,
        '',
        `{color:${JIRA_COLORS.SECONDARY}}_${rationale}_{color}`,
        '',
        '---'
    ].join('\n');
}

/**
 * Format executive summary with actionable recommendations
 * Note: Key strengths and gaps are now shown in the compatibility section
 * @param {Object} compatibilityInsights - Processed compatibility data
 * @param {Object} executiveSummary - Generated executive summary
 * @returns {string} Formatted Jira executive summary
 */
function formatExecutiveSummary(compatibilityInsights, executiveSummary) {
    // Business Assessment - prefer LLM's actual assessments
    let businessAssessment = 'Candidate evaluation completed with available data.';
    
    if (executiveSummary.scoringRationale) {
        // Use scoring LLM rationale if available (most detailed)
        businessAssessment = executiveSummary.scoringRationale;
    } else if (compatibilityInsights.llmAssessment) {
        // Use compatibility LLM assessment (includes confidence heatmap)
        businessAssessment = compatibilityInsights.llmAssessment;
    } else if (executiveSummary.businessAssessment) {
        // Fallback to generated assessment
        businessAssessment = executiveSummary.businessAssessment;
    }

    const statusLine = `{color:${executiveSummary.statusColor}}**STATUS:** ${getStatusIcon(executiveSummary.overallStatus)} ${executiveSummary.overallStatus}{color}`;

    // Next Steps (if available)
    const nextStepsLine = executiveSummary.nextSteps ? 
        `{color:${JIRA_COLORS.SECONDARY}}**NEXT STEPS:** ${executiveSummary.nextSteps}{color}` : 
        null;

    return [
        `{color:${JIRA_COLORS.PRIMARY}}**BUSINESS ASSESSMENT:** ${businessAssessment}{color}`,
        '',
        statusLine,
        nextStepsLine
    ].filter(Boolean).join('\n');
}

/**
 * Generate complete professional Jira comment
 * @param {Object} candidate - Basic candidate information
 * @param {Object} compatibilityData - Raw compatibility step data
 * @param {Object} scoreData - Raw scoring step data
 * @param {Array} processingSteps - All processing steps
 * @returns {string} Complete formatted Jira comment
 */
function generateProfessionalComment(candidate, compatibilityData, scoreData, processingSteps) {
    // Extract business insights from raw data
    const compatibilityInsights = extractCompatibilityInsights(compatibilityData);
    const scoringInsights = extractScoringInsights(scoreData);
    const executiveSummary = generateExecutiveSummary(candidate, compatibilityInsights, scoringInsights, processingSteps);

    // Format each section
    const headerSection = formatExecutiveHeader(candidate, executiveSummary.overallStatus);
    const scoreSection = formatScoringBreakdown(scoringInsights);
    const compatibilitySection = formatCompatibilityResults(compatibilityInsights);
    const summarySection = formatExecutiveSummary(compatibilityInsights, executiveSummary);
    const footerSection = formatFooter();

    // Combine sections with proper spacing
    return [
        headerSection,
        '',
        scoreSection,
        '',
        compatibilitySection,
        '',
        summarySection,
        '',
        footerSection
    ].join('\n');
}

/**
 * Helper function to get full role titles
 */
function getFullRoleTitle(role) {
    const roleTitles = {
        'CTO': 'Chief Technology Officer',
        'CIO': 'Chief Information Officer',
        'CISO': 'Chief Information Security Officer'
    };
    return roleTitles[role] || role;
}

/**
 * Helper function to get status icons
 */
function getStatusIcon(status) {
    if (status.includes('Ready') || status.includes('Strong')) return '✅';
    if (status.includes('Consider') || status.includes('Incomplete')) return '⚠️';
    if (status.includes('Failed') || status.includes('Not')) return '❌';
    return '📋';
}

/**
 * Format footer with timestamp
 */
function formatFooter() {
    const timestamp = new Date().toLocaleDateString("en-US", {
        month: "short", 
        day: "numeric", 
        year: "numeric"
    });
    
    return `_{color:${JIRA_COLORS.SECONDARY}}🤖 AI-Generated Executive Assessment • Processed: ${timestamp}{color}_`;
}

module.exports = {
    generateProfessionalComment,
    formatExecutiveHeader,
    formatCompatibilityResults,
    formatScoringBreakdown,
    formatExecutiveSummary,
    // Export constants for testing
    JIRA_COLORS,
    JIRA_PANELS
};