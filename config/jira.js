const axios = require('axios');
const logger = require('../utils/logger');

class JiraClient {
    constructor() {
        this.baseURL = process.env.JIRA_BASE_URL;
        this.username = process.env.JIRA_USERNAME;
        this.apiToken = process.env.JIRA_API_TOKEN;
        this.tokenExpires = process.env.JIRA_TOKEN_EXPIRES;
        this.warningEnabled = process.env.JIRA_TOKEN_WARNING_ENABLED === 'true';
        this.warningDays = parseInt(process.env.JIRA_TOKEN_WARNING_DAYS) || 30;
        
        if (!this.baseURL || !this.username || !this.apiToken) {
            logger.warn('Jira configuration incomplete. Some features may not work properly.', {
                hasBaseURL: !!this.baseURL,
                hasUsername: !!this.username, 
                hasApiToken: !!this.apiToken,
                baseURL: this.baseURL
            });
            // Create a dummy client to prevent errors
            this.client = null;
            return;
        }
        
        // Only check token on first instantiation (singleton pattern)
        if (!JiraClient._tokenChecked && this.baseURL && this.username && this.apiToken) {
            JiraClient._tokenChecked = true;
            this.checkTokenExpiration().catch(error => {
                logger.error('Failed to check JIRA token expiration on startup:', error.message);
            });
        }
        
        try {
            logger.info('🔧 Creating JIRA client', {
                baseURL: `${this.baseURL}/rest/api/3`,
                username: this.username,
                hasToken: !!this.apiToken,
                tokenLength: this.apiToken?.length
            });
            
            this.client = axios.create({
                baseURL: `${this.baseURL}/rest/api/3`,
                auth: {
                    username: this.username,
                    password: this.apiToken
                },
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            logger.info('✅ JIRA client created successfully');
        } catch (error) {
            logger.error('Failed to create Jira client:', { error: error.message, baseURL: this.baseURL });
            this.client = null;
        }
    }

    /**
     * Search for candidates in Jira with various filters
     * @param {Object} options - Search options
     * @param {number} options.maxResults - Max results to return (default: 50)
     * @param {number} options.startAt - Starting position (default: 0)
     * @param {string} options.status - Filter by status
     * @param {string} options.standing - Filter by standing field
     * @param {string} options.needsScore - Filter by needs score flag
     * @param {string} options.search - Text search across summary/description
     * @returns {Promise<Object>} Jira search results with candidates
     */
    async searchCandidates(options = {}) {
        if (!this.client) {
            throw new Error('Jira client not configured');
        }
        try {
            const {
                maxResults = 50,
                startAt = 0,
                status,
                standing,
                needsScore,
                search,
                sortBy = 'created',
                sortOrder = 'DESC'
            } = options;

            // Build JQL query
            let jql = 'project = CAN AND issuetype = Candidate';
            
            // Add filters based on options
            if (status) {
                jql += ` AND status = "${status}"`;
            }
            
            if (standing) {
                // Standing is custom field cf[11436]
                jql += ` AND "Standing" = "${standing}"`;
            }
            
            if (needsScore !== undefined) {
                // NeedsScore is custom field cf[11601]
                const scoreValue = needsScore === 'true' ? 'Yes' : 'No';
                jql += ` AND "NeedsScore" = "${scoreValue}"`;
            }
            
            if (search) {
                jql += ` AND (summary ~ "${search}" OR description ~ "${search}" OR "CAN-First-Name" ~ "${search}" OR "CAN-Last-Name" ~ "${search}")`;
            }
            
            // Add ordering
            jql += ` ORDER BY ${sortBy} ${sortOrder}`;
            
            logger.info(`Searching Jira candidates with JQL: ${jql}`);
            
            const response = await this.client.post('/search', {
                jql: jql,
                startAt: startAt,
                maxResults: maxResults,
                fields: [
                    'summary',
                    'status',
                    'created',
                    'updated',
                    'assignee',
                    'reporter',
                    // Custom fields - these are the field IDs from your Make.com workflow
                    'customfield_10302', // CAN-First-Name
                    'customfield_10303', // CAN-Last-Name  
                    'customfield_10304', // CAN-Email
                    'customfield_10305', // CAN-Phone
                    'customfield_10306', // CAN-Region
                    'customfield_10400', // CAN-LinkedIN
                    'customfield_11408', // CAN-LinkedIn-URL
                    'customfield_11535', // CAN-LIProfile
                    'customfield_11667', // LinkedIn Verified Date
                    'customfield_11601', // NeedsScore
                    'customfield_11436', // Standing
                    'customfield_11428', // Stage
                    'customfield_11431', // Candidate Network
                    'customfield_11423', // GP Stage
                    'customfield_11422', // Category
                    // Processing fields
                    'customfield_11634', // Fit Status
                    'customfield_11635', // Fit Score
                ]
            });
            
            // Transform the response to a more usable format
            const candidates = response.data.issues.map(issue => ({
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                status: issue.fields.status?.name,
                created: issue.fields.created,
                updated: issue.fields.updated,
                assignee: issue.fields.assignee?.displayName,
                reporter: issue.fields.reporter?.displayName,
                
                // Candidate-specific fields
                firstName: issue.fields.customfield_10302,
                lastName: issue.fields.customfield_10303,
                email: issue.fields.customfield_10304,
                phone: issue.fields.customfield_10305,
                region: issue.fields.customfield_10306,
                linkedinUrl: issue.fields.customfield_10400 || issue.fields.customfield_11408,
                profileId: issue.fields.customfield_11535,
                linkedinVerifiedDate: issue.fields.customfield_11667,
                needsScore: issue.fields.customfield_11601?.value,
                standing: issue.fields.customfield_11436?.value,
                stage: issue.fields.customfield_11428?.value,
                network: issue.fields.customfield_11431?.value,
                gpStage: issue.fields.customfield_11423?.value,
                category: issue.fields.customfield_11422?.value,
                fitStatus: issue.fields.customfield_11634?.value,
                fitScore: issue.fields.customfield_11635,
                
                // Helper fields
                fullName: [issue.fields.customfield_10302, issue.fields.customfield_10303].filter(Boolean).join(' '),
                hasLinkedIn: !!(issue.fields.customfield_10400 || issue.fields.customfield_11408),
                hasProfile: !!issue.fields.customfield_11535,
                needsScoring: issue.fields.customfield_11601?.value === 'Yes'
            }));
            
            return {
                candidates,
                total: response.data.total,
                startAt: response.data.startAt,
                maxResults: response.data.maxResults,
                pagination: {
                    current: Math.floor(startAt / maxResults) + 1,
                    total: response.data.total,
                    totalPages: Math.ceil(response.data.total / maxResults),
                    startAt: response.data.startAt,
                    hasNext: startAt + maxResults < response.data.total,
                    hasPrev: startAt > 0
                }
            };
            
        } catch (error) {
            logger.error('Failed to search Jira candidates:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw new Error(`Jira search failed: ${error.message}`);
        }
    }

    /**
     * Get a specific candidate by key
     * @param {string} key - Jira issue key (e.g., "CAND-123")
     * @returns {Promise<Object>} Candidate details
     */
    async getCandidate(key) {
        if (!this.client) {
            throw new Error('Jira client not configured');
        }
        try {
            const response = await this.client.get(`/issue/${key}`);
            const issue = response.data;
            
            return {
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                description: issue.fields.description,
                status: issue.fields.status?.name,
                created: issue.fields.created,
                updated: issue.fields.updated,
                assignee: issue.fields.assignee?.displayName,
                reporter: issue.fields.reporter?.displayName,
                
                // All custom fields
                firstName: issue.fields.customfield_10302,
                lastName: issue.fields.customfield_10303,
                email: issue.fields.customfield_10304,
                phone: issue.fields.customfield_10305,
                region: issue.fields.customfield_10306,
                linkedinUrl: issue.fields.customfield_10400 || issue.fields.customfield_11408,
                profileId: issue.fields.customfield_11535,
                linkedinVerifiedDate: issue.fields.customfield_11667,
                needsScore: issue.fields.customfield_11601?.value,
                standing: issue.fields.customfield_11436?.value,
                stage: issue.fields.customfield_11428?.value,
                network: issue.fields.customfield_11431?.value,
                gpStage: issue.fields.customfield_11423?.value,
                category: issue.fields.customfield_11422?.value,
                fitStatus: issue.fields.customfield_11634?.value,
                fitScore: issue.fields.customfield_11635,
                
                // Helper fields
                fullName: [issue.fields.customfield_10302, issue.fields.customfield_10303].filter(Boolean).join(' '),
                hasLinkedIn: !!(issue.fields.customfield_10400 || issue.fields.customfield_11408),
                hasProfile: !!issue.fields.customfield_11535,
                needsScoring: issue.fields.customfield_11601?.value === 'Yes'
            };
            
        } catch (error) {
            logger.error(`Failed to get Jira candidate ${key}:`, error.message);
            throw new Error(`Failed to get candidate: ${error.message}`);
        }
    }

    /**
     * Update a candidate's fields
     * @param {string} key - Jira issue key
     * @param {Object} fields - Fields to update
     * @returns {Promise<void>}
     */
    async updateCandidate(key, fields) {
        if (!this.client) {
            throw new Error('Jira client not configured');
        }
        try {
            const updatePayload = { fields: {} };
            
            // Map common fields to Jira field IDs
            const fieldMapping = {
                profileId: 'customfield_11535',
                linkedinVerifiedDate: 'customfield_11667',
                needsScore: 'customfield_11601',
                standing: 'customfield_11436',
                stage: 'customfield_11428',
                // Processing fields
                fitStatus: 'customfield_11634', // Fit Status field
                fitScore: 'customfield_11635'    // Fit Score field
            };
            
            Object.keys(fields).forEach(field => {
                if (fieldMapping[field]) {
                    if (field === 'needsScore') {
                        // NeedsScore is a select field
                        updatePayload.fields[fieldMapping[field]] = { value: fields[field] };
                    } else if (['standing', 'stage'].includes(field)) {
                        // These are select fields
                        updatePayload.fields[fieldMapping[field]] = { value: fields[field] };
                    } else {
                        // Text fields
                        updatePayload.fields[fieldMapping[field]] = fields[field];
                    }
                }
            });
            
            await this.client.put(`/issue/${key}`, updatePayload);
            logger.info(`Updated Jira candidate ${key}:`, fields);
            
        } catch (error) {
            logger.error(`Failed to update Jira candidate ${key}:`, error.message);
            throw new Error(`Failed to update candidate: ${error.message}`);
        }
    }

    /**
     * Add a comment to a candidate issue
     * @param {string} key - Jira issue key
     * @param {string} body - Comment body
     * @returns {Promise<void>}
     */
    async addComment(key, body) {
        if (!this.client) {
            throw new Error('Jira client not configured');
        }
        try {
            await this.client.post(`/issue/${key}/comment`, {
                body: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: body
                                }
                            ]
                        }
                    ]
                }
            });
            
            logger.info(`Added comment to Jira candidate ${key}`);
            
        } catch (error) {
            logger.error(`Failed to add comment to candidate ${key}:`, error.message);
            throw new Error(`Failed to add comment: ${error.message}`);
        }
    }

    /**
     * Check token expiration status
     * @returns {Object} Token status information
     */
    async checkTokenExpiration() {
        if (!this.client) {
            logger.warn('🔐 JIRA client not configured - cannot check token expiration');
            return { status: 'unknown', daysRemaining: null, expired: false };
        }

        try {
            // Get token info from JIRA API (this will fail if token is expired/invalid)
            const response = await this.client.get('/myself');
            
            // For JIRA API tokens, we can't get exact expiration from API
            // But if the call succeeds, the token is valid
            // We'll estimate based on JIRA's standard 1-year expiration
            const now = new Date();
            const estimatedExpiration = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now
            const daysRemaining = Math.ceil((estimatedExpiration - now) / (1000 * 60 * 60 * 24));
            
            const status = {
                status: 'valid',
                daysRemaining,
                expired: false,
                warningRequired: false,
                expirationDate: estimatedExpiration.toISOString().split('T')[0],
                verified: true
            };

            logger.info(`🔐 JIRA API token verified as VALID (user: ${response.data.displayName})`);
            
            return status;

        } catch (error) {
            // Token is expired or invalid
            const status = {
                status: 'expired',
                daysRemaining: 0,
                expired: true,
                warningRequired: false,
                expirationDate: 'unknown',
                verified: false
            };

            if (error.response?.status === 401) {
                logger.error(`🔐 JIRA API TOKEN EXPIRED OR INVALID!`, {
                    error: 'Authentication failed',
                    action: 'IMMEDIATE RENEWAL REQUIRED',
                    renewalURL: 'https://id.atlassian.com/manage-profile/security/api-tokens',
                    envVariable: 'JIRA_API_TOKEN'
                });
            } else {
                logger.error(`🔐 JIRA API TOKEN CHECK FAILED`, {
                    error: error.message,
                    status: error.response?.status,
                    action: 'CHECK NETWORK/CONFIG'
                });
            }

            return status;
        }
    }

    /**
     * Get current token status for UI display
     * @returns {Promise<Object>} Token status with user-friendly messages
     */
    async getTokenStatus() {
        const status = await this.checkTokenExpiration();
        
        let message = '';
        let alertClass = 'info';
        
        if (status.expired) {
            message = `Jira token expired ${Math.abs(status.daysRemaining)} days ago. Update required immediately.`;
            alertClass = 'danger';
        } else if (status.warningRequired) {
            message = `Jira token expires in ${status.daysRemaining} days (${status.expirationDate}). Update recommended soon.`;
            alertClass = 'warning';
        } else if (status.status === 'valid') {
            message = `Jira token is valid for ${status.daysRemaining} more days.`;
            alertClass = 'success';
        } else {
            message = 'Jira token expiration date not configured.';
            alertClass = 'info';
        }
        
        return {
            ...status,
            message,
            alertClass,
            showInUI: status.expired || (status.warningRequired && this.warningEnabled)
        };
    }

    /**
     * Check if Jira integration is configured and working
     * @returns {Promise<Object>} Connection status with token info
     */
    async testConnection() {
        const tokenStatus = await this.getTokenStatus();
        
        try {
            if (!this.baseURL || !this.username || !this.apiToken) {
                return {
                    connected: false,
                    error: 'Jira configuration incomplete',
                    tokenStatus
                };
            }
            
            if (tokenStatus.expired) {
                return {
                    connected: false,
                    error: 'Jira API token has expired',
                    tokenStatus
                };
            }
            
            const response = await this.client.get('/myself');
            return {
                connected: true,
                user: response.data.displayName,
                email: response.data.emailAddress,
                tokenStatus
            };
        } catch (error) {
            logger.error('Jira connection test failed:', error.message);
            
            // Check if error is due to authentication (expired token)
            const isAuthError = error.response?.status === 401 || error.response?.status === 403;
            const errorMessage = isAuthError ? 'Authentication failed - token may be expired or invalid' : error.message;
            
            return {
                connected: false,
                error: errorMessage,
                authError: isAuthError,
                tokenStatus
            };
        }
    }

    /**
     * Search for candidates that need processing
     * @param {Object} options - Search options
     * @param {number} options.hoursBack - Look for candidates created within this many hours (default: 24)
     * @param {number} options.maxResults - Max results to return (default: 20)
     * @param {string} options.status - Filter by status (default: "Interviewing")
     * @returns {Promise<Array>} Candidates that need processing
     */
    async searchCandidatesForProcessing(options = {}) {
        const {
            hoursBack = null,
            maxResults = 20,
            status = 'Interviewing',
            jobType = 'recent'
        } = options;

        let jql = `project = CAN AND issuetype = Candidate AND status = "${status}"`;
        
        // Only apply date filter for recent candidates, not older candidates
        if (jobType === 'recent' && hoursBack) {
            // Calculate the date threshold for recent candidates
            const threshold = new Date();
            threshold.setHours(threshold.getHours() - hoursBack);
            const dateString = threshold.toISOString().split('T')[0]; // YYYY-MM-DD format
            jql += ` AND created >= "${dateString}"`;
        }
        
        // For older candidates, we want oldest first to process the backlog
        // For recent candidates, we want newest first
        const sortOrder = jobType === 'older' ? 'ASC' : 'DESC';
        jql += ` ORDER BY created ${sortOrder}`;

        logger.info(`Searching for ${jobType} candidates needing processing:`, jql);

        const results = await this.searchCandidates({
            maxResults,
            startAt: 0,
            status,
            sortBy: 'created',
            sortOrder
        });

        // Filter for candidates that have LinkedIn URLs and haven't been processed
        const needsProcessing = results.candidates.filter(candidate => 
            candidate.hasLinkedIn && !candidate.hasProfile
        );

        logger.info(`Found ${needsProcessing.length} ${jobType} candidates needing processing`);
        return needsProcessing;
    }

    /**
     * Update a candidate's processing status
     * @param {string} key - Jira issue key
     * @param {Object} processingResult - Processing result
     * @param {string} processingResult.fitStatus - Fit status ("Unscored", "No Fit", "Scored")
     * @param {number|null} processingResult.fitScore - Fit score (0-10 or null)
     * @param {string} processingResult.comment - Comment with processing details
     * @returns {Promise<void>}
     */
    async updateCandidateProcessingStatus(key, processingResult) {
        const { fitStatus, fitScore, comment } = processingResult;
        
        // Prepare field updates
        const fieldsToUpdate = {};
        
        if (fitStatus) {
            // TODO: Once we discover the actual field IDs, update these
            // fieldsToUpdate.fitStatus = fitStatus;
            logger.info(`Would update ${key} fitStatus to: ${fitStatus}`);
        }
        
        if (fitScore !== undefined && fitScore !== null) {
            // TODO: Once we discover the actual field IDs, update these
            // fieldsToUpdate.fitScore = fitScore;
            logger.info(`Would update ${key} fitScore to: ${fitScore}`);
        }
        
        // For now, just update the comment until we have the field IDs
        if (comment) {
            await this.addComment(key, comment);
        }
        
        // TODO: Uncomment once we have actual field IDs
        // if (Object.keys(fieldsToUpdate).length > 0) {
        //     await this.updateCandidate(key, fieldsToUpdate);
        // }
        
        logger.info(`Updated processing status for candidate ${key}`);
    }

    /**
     * Get recent comments for a candidate
     * @param {string} key - Jira issue key  
     * @param {number} limit - Number of recent comments to fetch
     * @returns {Promise<Array>} Recent comments
     */
    async getRecentComments(key, limit = 5) {
        if (!this.client) {
            throw new Error('Jira client not configured');
        }
        try {
            logger.debug(`🔍 Attempting to fetch JIRA comments for ${key}`);
            const response = await this.client.get(`/issue/${key}/comment`);
            const comments = response.data.comments || [];
            
            logger.debug(`✅ Successfully fetched ${comments.length} comments for ${key}`);
            
            // Sort by creation date (newest first) and limit results
            const recentComments = comments
                .sort((a, b) => new Date(b.created) - new Date(a.created))
                .slice(0, limit)
                .map(comment => ({
                    id: comment.id,
                    author: comment.author?.displayName || 'Unknown',
                    body: this.extractTextFromADF(comment.body),
                    created: comment.created,
                    updated: comment.updated
                }));
                
            return recentComments;
            
        } catch (error) {
            logger.error(`❌ Failed to get comments for Jira issue ${key}:`, {
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    hasAuth: !!error.config?.auth,
                    authUsername: error.config?.auth?.username
                }
            });
            throw new Error(`Failed to get comments: ${error.message}`);
        }
    }

    /**
     * Extract plain text from Atlassian Document Format (ADF)
     * @param {Object} adfBody - ADF body object
     * @returns {string} Plain text content
     */
    extractTextFromADF(adfBody) {
        if (!adfBody || !adfBody.content) {
            return '';
        }
        
        const extractText = (content) => {
            let text = '';
            
            if (Array.isArray(content)) {
                content.forEach(item => {
                    text += extractText(item);
                });
            } else if (content.type === 'text') {
                text += content.text || '';
            } else if (content.type === 'paragraph') {
                text += extractText(content.content) + '\n';
            } else if (content.content) {
                text += extractText(content.content);
            }
            
            return text;
        };
        
        return extractText(adfBody.content).trim();
    }

    /**
     * Add a processing comment with structured format
     * @param {string} key - Jira issue key
     * @param {Object} processingData - Processing data to include in comment
     * @returns {Promise<void>}
     */
    async addProcessingComment(key, processingData) {
        const {
            step,
            success,
            result,
            error,
            score,
            compatibility,
            timestamp = new Date()
        } = processingData;
        
        let comment = `*Processing Step: ${step}*\n`;
        comment += `*Status:* ${success ? '✅ Success' : '❌ Failed'}\n`;
        comment += `*Timestamp:* ${timestamp.toISOString()}\n\n`;
        
        if (success) {
            if (step === 'verify') {
                comment += `LinkedIn URL verified successfully.\n`;
            } else if (step === 'ingest') {
                comment += `Profile data ingested successfully.\n`;
                if (result?.profile_id) {
                    comment += `Profile ID: ${result.profile_id}\n`;
                }
            } else if (step === 'check_compatibility') {
                comment += `Role compatibility check completed.\n`;
                if (compatibility) {
                    comment += `*Compatibility:* ${compatibility.passed ? '✅ Compatible' : '❌ Not Compatible'}\n`;
                    if (compatibility.reason) {
                        comment += `*Reason:* ${compatibility.reason}\n`;
                    }
                }
            } else if (step === 'score') {
                comment += `AI scoring completed.\n`;
                if (score !== undefined) {
                    comment += `*Score:* ${score}/10\n`;
                }
            }
            
            if (result?.message) {
                comment += `*Details:* ${result.message}\n`;
            }
        } else {
            comment += `*Error:* ${error}\n`;
            
            if (step === 'verify') {
                comment += `The LinkedIn profile URL could not be verified. Please check the URL format and ensure it's accessible.\n`;
            } else if (step === 'ingest') {
                comment += `Profile data ingestion failed. This could be due to API limits, network issues, or profile access restrictions.\n`;
            } else if (step === 'check_compatibility') {
                comment += `Role compatibility check failed due to a processing error.\n`;
            } else if (step === 'score') {
                comment += `AI scoring failed. The profile may need manual review.\n`;
            }
        }
        
        await this.addComment(key, comment);
    }
}

module.exports = new JiraClient();
