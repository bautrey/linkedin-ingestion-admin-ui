/**
 * JIRA Update Service
 * Handles all JIRA comment and field updates for candidate processing
 * 
 * Designed for reusability across:
 * - candidateSequentialProcessor.js
 * - Scheduled jobs and other processors
 * 
 * Features:
 * - Professional ADF comment generation
 * - Field updates (FIT Score, FIT Status) 
 * - Error handling and logging
 * - Async operations with proper error management
 */

const { extractCompatibilityInsights, extractScoringInsights, generateExecutiveSummary } = require('./businessDataExtractor');
const { generateProfessionalAdfComment } = require('./jiraAdfFormatter');
const apiClient = require('../config/api');

class JiraUpdateService {
    constructor() {
        // Using apiClient for all requests - no need to store URL/key
    }

    /**
     * Complete JIRA update for candidate processing
     * Updates both comment and fields in a single operation
     * 
     * @param {string} candidateKey - JIRA candidate key (e.g., "CAN-4219")
     * @param {Object} candidateData - Basic candidate information
     * @param {Object} compatibilityData - LLM compatibility analysis results  
     * @param {Object} scoreData - LLM scoring results
     * @param {Array} processingSteps - Array of processing step results
     * @param {Object} options - Optional configuration
     * @returns {Promise<Object>} Update results with success status and details
     */
    async updateCandidateWithResults(candidateKey, candidateData, compatibilityData, scoreData, processingSteps, options = {}) {
        try {
            console.log(`🎯 Starting JIRA update for candidate: ${candidateKey}`);
            
            // Extract business insights from LLM responses
            const compatibilityInsights = extractCompatibilityInsights(compatibilityData);
            const scoringInsights = extractScoringInsights(scoreData);
            const executiveSummary = generateExecutiveSummary(candidateData, compatibilityInsights, scoringInsights, processingSteps);

            // Generate professional ADF comment
            const adfComment = generateProfessionalAdfComment(
                candidateData, 
                compatibilityInsights, 
                scoringInsights, 
                executiveSummary
            );

            // Prepare field updates
            const fieldUpdates = this._prepareFieldUpdates(scoringInsights, options);

            // Execute updates in parallel
            const [commentResult, fieldsResult] = await Promise.all([
                this._updateComment(candidateKey, adfComment),
                this._updateFields(candidateKey, fieldUpdates)
            ]);

            console.log(`✅ JIRA update completed for ${candidateKey}`);
            console.log(`   Comment ID: ${commentResult.comment_id}`);
            console.log(`   Fields updated: ${fieldsResult.updated_fields?.length || 0}`);

            return {
                success: true,
                candidateKey,
                results: {
                    comment: commentResult,
                    fields: fieldsResult
                },
                summary: {
                    commentId: commentResult.comment_id,
                    fieldsUpdated: fieldsResult.updated_fields?.length || 0,
                    updatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error(`❌ JIRA update failed for ${candidateKey}:`, error.message);
            
            return {
                success: false,
                candidateKey,
                error: {
                    message: error.message,
                    type: error.constructor.name,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Update only the JIRA comment (no field updates)
     * Useful for processing status updates or partial updates
     */
    async updateCommentOnly(candidateKey, candidateData, compatibilityData, scoreData, processingSteps) {
        try {
            const compatibilityInsights = extractCompatibilityInsights(compatibilityData);
            const scoringInsights = extractScoringInsights(scoreData);
            const executiveSummary = generateExecutiveSummary(candidateData, compatibilityInsights, scoringInsights, processingSteps);

            const adfComment = generateProfessionalAdfComment(
                candidateData, 
                compatibilityInsights, 
                scoringInsights, 
                executiveSummary
            );

            const result = await this._updateComment(candidateKey, adfComment);
            
            return {
                success: true,
                candidateKey,
                commentId: result.comment_id,
                updatedAt: result.created
            };

        } catch (error) {
            console.error(`❌ Comment update failed for ${candidateKey}:`, error.message);
            throw error;
        }
    }

    /**
     * Update only JIRA fields (no comment update)  
     * Useful for batch field updates or score corrections
     */
    async updateFieldsOnly(candidateKey, scoreData, options = {}) {
        try {
            const scoringInsights = extractScoringInsights(scoreData);
            const fieldUpdates = this._prepareFieldUpdates(scoringInsights, options);
            
            const result = await this._updateFields(candidateKey, fieldUpdates);
            
            return {
                success: true,
                candidateKey,
                fieldsUpdated: result.updated_fields?.length || 0,
                updatedFields: result.updated_fields
            };

        } catch (error) {
            console.error(`❌ Field update failed for ${candidateKey}:`, error.message);
            throw error;
        }
    }

    /**
     * Private method: Update JIRA comment with ADF content
     */
    async _updateComment(candidateKey, adfComment) {
        try {
            const response = await apiClient.post(`/jira/candidates/${candidateKey}/comments`, {
                comment_body: adfComment
            });
            return response.data;
        } catch (error) {
            throw new Error(`JIRA comment update failed: ${error.response?.status} ${error.response?.data || error.message}`);
        }
    }

    /**
     * Private method: Update JIRA custom fields
     */
    async _updateFields(candidateKey, fieldUpdates) {
        if (fieldUpdates.length === 0) {
            console.log(`   No field updates needed for ${candidateKey}`);
            return { success: true, updated_fields: [] };
        }

        try {
            const response = await apiClient.put(`/jira/candidates/${candidateKey}/fields`, {
                fields: fieldUpdates
            });
            return response.data;
        } catch (error) {
            throw new Error(`JIRA field update failed: ${error.response?.status} ${error.response?.data || error.message}`);
        }
    }

    /**
     * Private method: Prepare field updates based on scoring results
     */
    _prepareFieldUpdates(scoringInsights, options) {
        const fieldUpdates = [];

        // FIT Score update (customfield_11635)
        if (scoringInsights.numericScore !== null && scoringInsights.numericScore !== undefined) {
            fieldUpdates.push({
                field_id: 'customfield_11635',
                value: scoringInsights.numericScore
            });
        }

        // FIT Status update (customfield_11634) 
        if (scoringInsights.llmVerdict) {
            // Map LLM verdict to JIRA field values with proper ID format
            const statusMapping = {
                'STRONG FIT': '11029',    // Scored
                'MODERATE FIT': '11029',  // Scored  
                'WEAK FIT': '11029',      // Scored
                'NO FIT': '11028'         // No Fit
            };
            
            const fitStatusId = statusMapping[scoringInsights.llmVerdict.toUpperCase()] || '11029';
            
            fieldUpdates.push({
                field_id: 'customfield_11634', 
                value: { id: fitStatusId }  // Select list format with ID
            });
        }

        // Allow override of field updates
        if (options.additionalFields) {
            fieldUpdates.push(...options.additionalFields);
        }

        return fieldUpdates;
    }
}

module.exports = { JiraUpdateService };