/**
 * JIRA Atlassian Document Format (ADF) Formatter
 * Converts professional comment content to proper ADF JSON structure
 * Enables visual formatting (panels, colors, typography) through JIRA API
 */

/**
 * ADF Color Constants - JIRA-supported hex colors
 */
const ADF_COLORS = {
    SUCCESS: '#00875A',      // Green for positive results
    WARNING: '#FFAB00',      // Orange for cautions  
    ERROR: '#FF5630',        // Red for negative results
    PRIMARY: '#172B4D',      // Dark blue for main text
    SECONDARY: '#6B778C',    // Gray for secondary info
    INFO: '#0052CC'          // Blue for information panels
};

/**
 * Create ADF text node with optional formatting
 * @param {string} text - Text content
 * @param {Array} marks - Array of mark objects (bold, color, etc.)
 * @returns {Object} ADF text node
 */
function createTextNode(text, marks = []) {
    const node = {
        type: 'text',
        text: text
    };
    
    if (marks.length > 0) {
        node.marks = marks;
    }
    
    return node;
}

/**
 * Create ADF paragraph node
 * @param {Array} content - Array of content nodes (text, etc.)
 * @returns {Object} ADF paragraph node
 */
function createParagraph(content) {
    return {
        type: 'paragraph',
        content: content
    };
}

/**
 * Create ADF panel node
 * @param {string} panelType - Panel type (info, note, success, warning, error)
 * @param {Array} content - Array of content nodes
 * @returns {Object} ADF panel node
 */
function createPanel(panelType, content) {
    return {
        type: 'panel',
        attrs: {
            panelType: panelType
        },
        content: content
    };
}

/**
 * Create ADF heading node
 * @param {number} level - Heading level (1-6)
 * @param {Array} content - Array of content nodes
 * @returns {Object} ADF heading node
 */
function createHeading(level, content) {
    return {
        type: 'heading',
        attrs: {
            level: level
        },
        content: content
    };
}

/**
 * Create color mark for text formatting
 * @param {string} color - Hex color code
 * @returns {Object} ADF color mark
 */
function createColorMark(color) {
    return {
        type: 'textColor',
        attrs: {
            color: color
        }
    };
}

/**
 * Create bold mark for text formatting
 * @returns {Object} ADF bold mark
 */
function createBoldMark() {
    return {
        type: 'strong'
    };
}

/**
 * Create italic mark for text formatting
 * @returns {Object} ADF italic mark
 */
function createItalicMark() {
    return {
        type: 'em'
    };
}

/**
 * Format candidate header as ADF
 * @param {Object} candidate - Candidate information
 * @param {string} overallStatus - Overall assessment status
 * @returns {Object} ADF panel for candidate header
 */
function formatCandidateHeaderAdf(candidate, overallStatus) {
    const { fullName, linkedinUrl, position } = candidate;
    
    // Header color based on status
    let panelType = 'info';
    if (overallStatus.includes('Ready for') || overallStatus.includes('Strong')) {
        panelType = 'success';
    } else if (overallStatus.includes('Consider') || overallStatus.includes('Incomplete')) {
        panelType = 'warning';
    } else if (overallStatus.includes('Failed') || overallStatus.includes('Not')) {
        panelType = 'error';
    }

    const headerText = [
        createTextNode('🎯 EXECUTIVE CANDIDATE ASSESSMENT', [createBoldMark()]),
        createTextNode('\n'),
        createTextNode(`${fullName}`, [createBoldMark()]),
        position ? createTextNode(` | ${position}`) : null,
        linkedinUrl ? createTextNode(` | 🔗 LinkedIn Profile: ${linkedinUrl}`) : null
    ].filter(Boolean);

    return createPanel(panelType, [
        createParagraph(headerText)
    ]);
}

/**
 * Format compatibility results as ADF
 * @param {Object} compatibilityInsights - Processed compatibility data
 * @returns {Object} ADF panel for compatibility results
 */
function formatCompatibilityAdf(compatibilityInsights) {
    if (!compatibilityInsights.hasData) {
        return createPanel('error', [
            createParagraph([
                createTextNode('❌ EXECUTIVE FIT ANALYSIS', [createBoldMark()]),
                createTextNode('\nCompatibility analysis not available. Manual review required.')
            ])
        ]);
    }

    const { roleAnalysis, llmAssessment } = compatibilityInsights;
    
    // Build role entries
    const content = [
        createParagraph([
            createTextNode('📊 EXECUTIVE FIT ANALYSIS', [createBoldMark()])
        ])
    ];
    
    roleAnalysis.forEach(role => {
        const statusIcon = role.matchPercentage >= 70 ? '✅' : 
                          role.matchPercentage >= 50 ? '⚠️' : '❌';
        const statusColor = role.matchPercentage >= 70 ? ADF_COLORS.SUCCESS :
                           role.matchPercentage >= 50 ? ADF_COLORS.WARNING : ADF_COLORS.ERROR;
        
        // Role header
        content.push(createParagraph([
            createTextNode(`${statusIcon} ${role.role} Role: ${role.matchPercentage}% Match`, 
                [createBoldMark(), createColorMark(statusColor)])
        ]));
        
        // Reasoning
        if (role.llmReasoning) {
            content.push(createParagraph([
                createTextNode(role.llmReasoning, [createItalicMark()])
            ]));
        }
        
        // Key Strengths
        if (role.keyQualifications && role.keyQualifications.length > 0) {
            content.push(createParagraph([
                createTextNode('Key Strengths:', [createBoldMark()])
            ]));
            role.keyQualifications.slice(0, 3).forEach(qual => {
                content.push(createParagraph([
                    createTextNode(`• ${qual}`)
                ]));
            });
        }
        
        // Development Areas
        if (role.missingQualifications && role.missingQualifications.length > 0) {
            content.push(createParagraph([
                createTextNode('Development Areas:', [createBoldMark()])
            ]));
            role.missingQualifications.slice(0, 2).forEach(qual => {
                content.push(createParagraph([
                    createTextNode(`• ${qual}`)
                ]));
            });
        }
    });
    
    // LLM Overall Assessment
    if (llmAssessment) {
        content.push(createParagraph([
            createTextNode('---')
        ]));
        content.push(createParagraph([
            createTextNode('LLM ASSESSMENT: ', [createBoldMark()]),
            createTextNode(llmAssessment, [createColorMark(ADF_COLORS.PRIMARY)])
        ]));
    }
    
    return createPanel('info', content);
}

/**
 * Format scoring breakdown as ADF
 * @param {Object} scoringInsights - Processed scoring data
 * @returns {Array} ADF content for scoring section
 */
function formatScoringAdf(scoringInsights) {
    if (!scoringInsights.hasData) {
        return [
            createParagraph([
                createTextNode('Overall Score: Not Available', [createBoldMark(), createColorMark(ADF_COLORS.SECONDARY)])
            ]),
            createParagraph([
                createTextNode('Scoring analysis incomplete - manual evaluation required.', [createItalicMark()])
            ])
        ];
    }

    const { numericScore, llmVerdict, rationale, targetRole } = scoringInsights;
    const statusColor = numericScore >= 80 ? ADF_COLORS.SUCCESS :
                       numericScore >= 60 ? ADF_COLORS.WARNING : ADF_COLORS.ERROR;

    return [
        createParagraph([
            createTextNode(`LLM ASSESSMENT: ${llmVerdict.toUpperCase()}`, 
                [createBoldMark(), createItalicMark(), createColorMark(statusColor)])
        ]),
        createParagraph([
            createTextNode(`Score: ${numericScore}/100 • Role: ${targetRole}`, 
                [createBoldMark(), createColorMark(ADF_COLORS.PRIMARY)])
        ]),
        createParagraph([
            createTextNode(rationale, [createItalicMark(), createColorMark(ADF_COLORS.SECONDARY)])
        ]),
        createParagraph([
            createTextNode('---')
        ])
    ];
}

/**
 * Format executive summary as ADF
 * @param {Object} compatibilityInsights - Compatibility data
 * @param {Object} executiveSummary - Executive summary data
 * @returns {Array} ADF content for executive summary
 */
function formatExecutiveSummaryAdf(compatibilityInsights, executiveSummary) {
    // Business Assessment
    let businessAssessment = 'Candidate evaluation completed with available data.';
    if (executiveSummary.scoringRationale) {
        businessAssessment = executiveSummary.scoringRationale;
    } else if (compatibilityInsights.llmAssessment) {
        businessAssessment = compatibilityInsights.llmAssessment;
    }

    const statusIcon = executiveSummary.overallStatus.includes('Ready') ? '✅' :
                      executiveSummary.overallStatus.includes('Consider') ? '⚠️' : '❌';

    const content = [
        createParagraph([
            createTextNode('BUSINESS ASSESSMENT: ', [createBoldMark()]),
            createTextNode(businessAssessment, [createColorMark(ADF_COLORS.PRIMARY)])
        ]),
        createParagraph([
            createTextNode(`STATUS: ${statusIcon} ${executiveSummary.overallStatus}`, 
                [createBoldMark(), createColorMark(executiveSummary.statusColor)])
        ])
    ];

    if (executiveSummary.nextSteps) {
        content.push(createParagraph([
            createTextNode('NEXT STEPS: ', [createBoldMark()]),
            createTextNode(executiveSummary.nextSteps, [createColorMark(ADF_COLORS.SECONDARY)])
        ]));
    }

    return content;
}

/**
 * Generate complete ADF document for professional JIRA comment
 * @param {Object} candidate - Candidate information
 * @param {Object} compatibilityInsights - Processed compatibility data
 * @param {Object} scoringInsights - Processed scoring data
 * @param {Object} executiveSummary - Generated executive summary
 * @returns {Object} Complete ADF document
 */
function generateProfessionalAdfComment(candidate, compatibilityInsights, scoringInsights, executiveSummary) {
    const content = [];

    // Header Section
    content.push(formatCandidateHeaderAdf(candidate, executiveSummary.overallStatus));

    // Scoring Section
    const scoringContent = formatScoringAdf(scoringInsights);
    content.push(...scoringContent);

    // Compatibility Section
    content.push(formatCompatibilityAdf(compatibilityInsights));

    // Executive Summary Section
    const summaryContent = formatExecutiveSummaryAdf(compatibilityInsights, executiveSummary);
    content.push(...summaryContent);

    // Footer
    const timestamp = new Date().toLocaleDateString("en-US", {
        month: "short", 
        day: "numeric", 
        year: "numeric"
    });
    
    content.push(createParagraph([
        createTextNode(`🤖 AI-Generated Executive Assessment • Processed: ${timestamp}`, 
            [createItalicMark(), createColorMark(ADF_COLORS.SECONDARY)])
    ]));

    return {
        version: 1,
        type: 'doc',
        content: content
    };
}

module.exports = {
    generateProfessionalAdfComment,
    createTextNode,
    createParagraph,
    createPanel,
    createHeading,
    createColorMark,
    createBoldMark,
    createItalicMark,
    ADF_COLORS
};