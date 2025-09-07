const logger = require('./logger');
const apiClient = require('../config/api');

class JobInspector {
    constructor() {
        this.inspectionHistory = [];
        this.maxHistorySize = 100;
        this.enableDetailedLogging = process.env.NODE_ENV === 'development';
        this.io = null; // Will be set by server.js
    }

    setSocketIO(io) {
        this.io = io;
    }

    /**
     * Log detailed job execution step with context
     * @param {string} jobName - Name of the job
     * @param {string} step - Current step being executed
     * @param {Object} context - Step context and data
     * @param {string} status - Status: 'start', 'progress', 'success', 'error'
     */
    logStep(jobName, step, context = {}, status = 'progress') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            jobName,
            step,
            status,
            context: this.sanitizeContext(context),
            duration: context.duration || null
        };

        // Add to inspection history
        this.inspectionHistory.unshift(logEntry);
        if (this.inspectionHistory.length > this.maxHistorySize) {
            this.inspectionHistory = this.inspectionHistory.slice(0, this.maxHistorySize);
        }

        // Enhanced logging with visual indicators
        const statusIcon = this.getStatusIcon(status);
        const stepFormatted = step.replace(/([A-Z])/g, ' $1').trim();
        
        if (this.enableDetailedLogging) {
            logger.info(`${statusIcon} [${jobName}] ${stepFormatted}`, {
                step,
                status,
                context: this.sanitizeContext(context),
                service: 'job-inspector'
            });
        }

        // Emit WebSocket event for real-time updates
        if (this.io) {
            const eventName = step.replace(/_/g, '-');
            console.log(`🔄 Emitting ${eventName} to all clients`);
            this.io.emit(eventName, {
                jobName,
                step,
                status,
                context: this.sanitizeContext(context),
                timestamp,
                id: logEntry.id
            });
        }

        return logEntry.id;
    }

    /**
     * Retry API call with exponential backoff for failed processing history storage
     * @param {Function} apiCallFn - Function that returns a promise for the API call
     * @param {string} candidateKey - Candidate key for logging context
     * @param {string} operation - Operation being performed for logging context  
     * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
     * @returns {Promise} - Promise resolving to API response
     */
    async retryApiCall(apiCallFn, candidateKey, operation, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug(`🔄 [LIN-13] API call attempt ${attempt}/${maxRetries}`, {
                    candidateKey,
                    operation,
                    attempt,
                    maxRetries
                });
                
                const response = await apiCallFn();
                
                if (attempt > 1) {
                    logger.info(`✅ [LIN-13] API call succeeded on retry`, {
                        candidateKey,
                        operation,
                        attempt,
                        status: response.status
                    });
                }
                
                return response;
                
            } catch (error) {
                lastError = error;
                
                logger.warn(`⚠️ [LIN-13] API call attempt ${attempt}/${maxRetries} failed`, {
                    candidateKey,
                    operation,
                    attempt,
                    error: error.message,
                    status: error.response?.status,
                    willRetry: attempt < maxRetries
                });
                
                // Don't retry on certain error types (4xx client errors except 429)
                if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
                    logger.debug(`🚫 [LIN-13] Not retrying client error ${error.response.status}`, {
                        candidateKey,
                        operation,
                        status: error.response.status
                    });
                    throw error;
                }
                
                // Wait before next retry (exponential backoff)
                if (attempt < maxRetries) {
                    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 second delay
                    logger.debug(`⏳ [LIN-13] Waiting ${delayMs}ms before retry`, {
                        candidateKey,
                        operation,
                        attempt,
                        delayMs
                    });
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        
        logger.error(`❌ [LIN-13] All API call attempts failed`, {
            candidateKey,
            operation,
            maxRetries,
            lastError: lastError.message
        });
        
        throw lastError;
    }

    /**
     * Create enhanced details with formatted messages and processing context (LIN-13 Task 3.1)
     */
    createEnhancedDetails(rawDetails, operation, status) {
        const enhanced = {
            // Raw data for programmatic analysis
            rawData: rawDetails,
            
            // Formatted message for user display
            formattedMessage: this.generateFormattedMessage(rawDetails, operation, status),
            
            // Processing context information
            contextInfo: {
                operation,
                status,
                timestamp: new Date().toISOString(),
                stepNumber: rawDetails.stepNumber || rawDetails.step_number,
                totalSteps: rawDetails.totalSteps || rawDetails.total_steps,
                processingId: rawDetails.processingId || rawDetails.processing_id
            }
        };

        // Preserve retry suggestions and error handling information
        if (rawDetails.suggested_action) {
            enhanced.contextInfo.suggested_action = rawDetails.suggested_action;
        }
        
        if (rawDetails.error_type) {
            enhanced.contextInfo.error_type = rawDetails.error_type;
        }

        // Preserve step context for processing workflows
        if (rawDetails.step_context) {
            enhanced.contextInfo.step_context = rawDetails.step_context;
        }

        return enhanced;
    }

    /**
     * Generate formatted display message based on operation and status
     */
    generateFormattedMessage(data, operation, status) {
        // Handle error status with enhanced formatting
        if (status === 'error' || status === 'failed') {
            const error = data.error || data.message || 'Unknown error';
            let message = `${operation} failed: ${error}`;
            
            // Add retry suggestions
            if (data.suggested_action === 'retry_later') {
                message += ' (retry in a few minutes)';
            } else if (data.suggested_action === 'retry_immediately') {
                message += ' (can retry now)';
            }
            
            return message;
        }
        
        // Handle success status with operation-specific formatting
        if (status === 'success' || status === 'completed') {
            switch (operation) {
                case 'verify':
                    const url = data.linkedin_url || data.context?.result?.linkedin_url;
                    return url ? `Verified LinkedIn URL: ${url}` : 'LinkedIn URL verification completed';
                    
                case 'ingest':
                    const profile = data.profile_name || data.context?.result?.profile_name;
                    return profile ? `Profile extracted: ${profile}` : 'Profile data extracted successfully';
                    
                case 'score':
                    const score = data.score ?? data.total_score ?? data.context?.result?.score;
                    return score ? `AI scoring completed: ${score}/10` : 'AI scoring completed successfully';
                    
                case 'jira_update':
                    return 'JIRA fields updated successfully';
                    
                default:
                    return `${operation} completed successfully`;
            }
        }
        
        // Handle in-progress status
        if (status === 'progress' || status === 'in_progress') {
            switch (operation) {
                case 'verify':
                    return 'Verifying LinkedIn URL...';
                case 'ingest':
                    return 'Extracting profile data...';
                case 'score':
                    return 'AI scoring in progress...';
                case 'jira_update':
                    return 'Updating JIRA with results...';
                default:
                    return `${operation} in progress...`;
            }
        }
        
        // Default fallback
        return `${operation}: ${status}`;
    }

    /**
     * Store processing history entry to database for persistent tracking
     * @param {string} candidateKey - JIRA candidate key (e.g., "CAN-4230")
     * @param {string} operation - Operation performed (verify, compatibility, scoring, jira_update)
     * @param {string} status - Status (success, error, in_progress)
     * @param {Object} details - Detailed information about the operation
     * @param {number} durationMs - Duration in milliseconds (optional)
     * @param {string} profileId - Profile ID if available (optional)
     */
    async storeProcessingHistory(candidateKey, operation, status, details = {}, durationMs = null, profileId = null) {
        const startTime = Date.now();
        
        // Enhanced debug logging for troubleshooting persistence issues
        logger.debug('🔍 [LIN-13] Starting storeProcessingHistory call', {
            candidateKey,
            operation,
            status,
            detailsSize: JSON.stringify(details).length,
            durationMs,
            profileId,
            apiClientBaseURL: apiClient.defaults.baseURL,
            hasApiKey: !!apiClient.defaults.headers['X-API-Key'],
            environment: process.env.NODE_ENV
        });

        try {
            // Validate required parameters
            if (!candidateKey || !operation || !status) {
                const validationError = 'Missing required parameters for processing history storage';
                logger.error('🚫 [LIN-13] Processing history validation failed', {
                    candidateKey: !!candidateKey,
                    operation: !!operation, 
                    status: !!status,
                    error: validationError
                });
                return; // Exit early if validation fails
            }

            // Enhanced data structure with formatted messages and processing context (LIN-13 Task 3.1)
            const enhancedDetails = this.createEnhancedDetails(details, operation, status);
            
            const historyData = {
                candidate_key: candidateKey,
                operation,
                status,
                details: enhancedDetails,
                duration_ms: durationMs,
                profile_id: profileId
            };

            logger.debug('🔍 [LIN-13] Sending processing history to backend', {
                candidateKey,
                operation,
                status,
                endpoint: `/processing/candidates/${candidateKey}/history`,
                dataSize: JSON.stringify(historyData).length,
                timeout: apiClient.defaults.timeout
            });

            // Store in database via backend API with retry mechanism and detailed error tracking
            const response = await this.retryApiCall(
                () => apiClient.post(`/processing/candidates/${candidateKey}/history`, historyData),
                candidateKey,
                operation,
                3 // max 3 attempts
            );
            const callDuration = Date.now() - startTime;
            
            // Check if response indicates success
            const responseData = response.data || response;
            const isSuccess = responseData.success === true || response.status === 200 || response.status === 201;
            
            if (isSuccess) {
                logger.info('✅ [LIN-13] Processing history stored to database', {
                    candidateKey,
                    operation,
                    status,
                    entryId: responseData.entry_id || 'unknown',
                    apiCallDuration: callDuration,
                    responseStatus: response.status
                });
            } else {
                logger.warn('⚠️ [LIN-13] Processing history API returned non-success response', {
                    candidateKey,
                    operation,
                    responseStatus: response.status,
                    responseData: responseData,
                    apiCallDuration: callDuration
                });
            }
        } catch (error) {
            const callDuration = Date.now() - startTime;
            
            // Enhanced error logging with network diagnostics
            const errorContext = {
                candidateKey,
                operation,
                status,
                apiCallDuration: callDuration,
                errorType: error.constructor.name,
                errorMessage: error.message
            };

            // Add detailed error information based on error type
            if (error.response) {
                // Server responded with error status
                errorContext.httpStatus = error.response.status;
                errorContext.responseData = error.response.data;
                errorContext.responseHeaders = error.response.headers;
                
                logger.error('🚨 [LIN-13] Backend API error during processing history storage', errorContext);
            } else if (error.request) {
                // Request was made but no response received (network error)
                errorContext.requestConfig = {
                    method: error.config?.method,
                    url: error.config?.url,
                    baseURL: error.config?.baseURL,
                    timeout: error.config?.timeout,
                    headers: error.config?.headers ? Object.keys(error.config.headers) : []
                };
                errorContext.networkError = true;
                
                logger.error('🌐 [LIN-13] Network error during processing history storage', errorContext);
            } else {
                // Request setup error
                errorContext.requestSetupError = true;
                errorContext.stack = error.stack;
                
                logger.error('⚙️ [LIN-13] Request setup error during processing history storage', errorContext);
            }

            // Additional environment diagnostics for troubleshooting
            logger.debug('🔍 [LIN-13] Environment diagnostics for failed processing history storage', {
                candidateKey,
                operation,
                fastApiBaseUrl: process.env.FASTAPI_BASE_URL,
                apiKey: process.env.API_KEY ? '[PRESENT]' : '[MISSING]',
                nodeEnv: process.env.NODE_ENV,
                apiClientConfig: {
                    baseURL: apiClient.defaults.baseURL,
                    timeout: apiClient.defaults.timeout,
                    hasApiKey: !!apiClient.defaults.headers['X-API-Key']
                }
            });
            
            // Don't throw - we don't want processing to fail just because history storage failed
            // But now we have much better visibility into what's going wrong
            
            // Show user notification when processing history storage fails
            if (typeof window !== 'undefined' && window.showToast) {
                const errorMessage = error.response?.data?.detail || 
                                   error.message || 
                                   'Unable to save processing details';
                
                window.showToast(
                    'Processing History Warning',
                    `Failed to save processing details for ${candidateKey}. ${errorMessage}. Processing continues normally.`,
                    'warning',
                    8000
                );
            }
        }
    }

    /**
     * Log job start with comprehensive context
     */
    logJobStart(jobName, config = {}) {
        return this.logStep(jobName, 'job_start', {
            jobConfig: config,
            environment: process.env.NODE_ENV,
            dryRun: process.env.JOB_DRY_RUN === 'true',
            timestamp: new Date().toISOString()
        }, 'start');
    }

    /**
     * Log job completion with summary
     */
    logJobComplete(jobName, result = {}) {
        return this.logStep(jobName, 'job_complete', {
            success: result.success,
            processed: result.processed,
            failed: result.failed,
            duration: result.duration,
            summary: result.message || result.summary
        }, result.success ? 'success' : 'error');
    }

    /**
     * Log candidate processing start
     */
    logCandidateStart(candidateKey, config = {}) {
        return this.logStep(candidateKey, 'candidate_start', {
            candidateKey,
            fullName: config.fullName,
            linkedinUrl: config.linkedinUrl,
            processingSteps: config.processingSteps || [],
            timestamp: new Date().toISOString()
        }, 'start');
    }

    /**
     * Log candidate processing completion
     */
    logCandidateComplete(candidateKey, result = {}) {
        return this.logStep(candidateKey, 'candidate_complete', {
            candidateKey,
            success: result.success,
            stepsSuceeded: result.stepsSuceeded || 0,
            stepsFailed: result.stepsFailed || 0,
            finalScore: result.finalScore,
            profileId: result.profileId,
            processingTime: result.duration
        }, result.success ? 'success' : 'error');
    }

    /**
     * Log JIRA search operations with query details
     */
    logJiraSearch(jobName, jql, results = {}) {
        return this.logStep(jobName, 'jira_search', {
            query: jql,
            totalFound: results.total || 0,
            candidatesReturned: results.candidates ? results.candidates.length : 0,
            searchTime: results.searchTime,
            filters: this.extractJqlFilters(jql)
        });
    }

    /**
     * Log candidate processing with detailed breakdown
     */
    logCandidateProcessing(jobName, candidate, processStep, result = {}) {
        return this.logStep(jobName, `candidate_${processStep}`, {
            candidateKey: candidate.key,
            candidateName: candidate.fullName,
            linkedinUrl: candidate.linkedinUrl,
            step: processStep,
            success: result.success,
            message: result.message,
            error: result.error,
            profileId: result.profile_id || result.profileId,
            score: result.score,
            compatibility: result.compatibility
        }, result.success ? 'success' : 'error');
    }

    /**
     * Log API calls with timing and response details
     */
    logApiCall(jobName, endpoint, method = 'GET', response = {}) {
        return this.logStep(jobName, 'api_call', {
            endpoint,
            method,
            status: response.status,
            duration: response.duration,
            success: response.success,
            error: response.error,
            dataSize: response.data ? JSON.stringify(response.data).length : 0
        });
    }

    /**
     * Get recent inspection history for a specific job
     */
    getJobHistory(jobName, limit = 50) {
        return this.inspectionHistory
            .filter(entry => !jobName || entry.jobName === jobName)
            .slice(0, limit)
            .map(entry => ({
                ...entry,
                timeAgo: this.getTimeAgo(entry.timestamp),
                statusText: this.getStatusText(entry.status)
            }));
    }

    /**
     * Get job execution summary with metrics
     */
    getJobSummary(jobName, hoursBack = 24) {
        const cutoff = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
        const recentEntries = this.inspectionHistory.filter(entry => 
            (!jobName || entry.jobName === jobName) && 
            new Date(entry.timestamp) > cutoff
        );

        const summary = {
            jobName: jobName || 'All Jobs',
            periodHours: hoursBack,
            totalSteps: recentEntries.length,
            successfulSteps: recentEntries.filter(e => e.status === 'success').length,
            errorSteps: recentEntries.filter(e => e.status === 'error').length,
            completedRuns: recentEntries.filter(e => e.step === 'job_complete').length,
            avgDuration: this.calculateAvgDuration(recentEntries),
            lastRun: recentEntries.find(e => e.step === 'job_start'),
            commonErrors: this.getCommonErrors(recentEntries),
            stepBreakdown: this.getStepBreakdown(recentEntries)
        };

        summary.successRate = summary.totalSteps > 0 ? 
            ((summary.successfulSteps / summary.totalSteps) * 100).toFixed(1) : 0;

        return summary;
    }

    /**
     * Get live job status for dashboard display
     */
    getLiveStatus() {
        const recent = this.inspectionHistory.slice(0, 10);
        const activeJobs = [...new Set(recent.map(e => e.jobName))];
        
        return {
            timestamp: new Date().toISOString(),
            activeJobs: activeJobs.map(jobName => ({
                name: jobName,
                lastActivity: recent.find(e => e.jobName === jobName),
                recentSteps: recent.filter(e => e.jobName === jobName).slice(0, 5)
            })),
            systemStatus: this.getSystemStatus(),
            recentActivity: recent.slice(0, 5)
        };
    }

    /**
     * Search inspection history with filters
     */
    search(filters = {}) {
        let results = [...this.inspectionHistory];

        if (filters.jobName) {
            results = results.filter(e => e.jobName.includes(filters.jobName));
        }

        if (filters.step) {
            results = results.filter(e => e.step.includes(filters.step));
        }

        if (filters.status) {
            results = results.filter(e => e.status === filters.status);
        }

        if (filters.since) {
            const since = new Date(filters.since);
            results = results.filter(e => new Date(e.timestamp) > since);
        }

        if (filters.candidateKey) {
            results = results.filter(e => 
                e.context && e.context.candidateKey === filters.candidateKey
            );
        }

        return results.slice(0, filters.limit || 100);
    }

    // Helper methods
    getStatusIcon(status) {
        const icons = {
            start: '🚀',
            progress: '⚙️',
            in_progress: '⚙️',
            success: '✅',
            completed: '✅',
            error: '❌',
            failed: '❌'
        };
        return icons[status] || '📝';
    }

    getStatusText(status) {
        const statusMap = {
            start: 'Started',
            progress: 'In Progress', 
            success: 'Completed Successfully',
            error: 'Failed with Error'
        };
        return statusMap[status] || status;
    }

    sanitizeContext(context) {
        const sanitized = { ...context };
        
        // Remove or truncate large data
        if (sanitized.data && typeof sanitized.data === 'object') {
            const stringified = JSON.stringify(sanitized.data);
            if (stringified.length > 500) {
                sanitized.data = `[Large Object: ${stringified.length} chars]`;
            }
        }

        // Sanitize sensitive information
        ['password', 'token', 'key', 'secret'].forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    extractJqlFilters(jql) {
        const filters = {};
        
        // Extract common filters from JQL
        const projectMatch = jql.match(/project\s*=\s*([^\s]+)/i);
        if (projectMatch) filters.project = projectMatch[1];
        
        const statusMatch = jql.match(/status\s*=\s*"([^"]+)"/i);
        if (statusMatch) filters.status = statusMatch[1];
        
        const dateMatch = jql.match(/created\s*>=\s*"([^"]+)"/i);
        if (dateMatch) filters.since = dateMatch[1];

        return filters;
    }

    calculateAvgDuration(entries) {
        const durations = entries
            .filter(e => e.context && e.context.duration)
            .map(e => e.context.duration);
        
        if (durations.length === 0) return 0;
        return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }

    getCommonErrors(entries) {
        const errors = entries
            .filter(e => e.status === 'error' && e.context && e.context.error)
            .map(e => e.context.error);
        
        const errorCounts = {};
        errors.forEach(error => {
            const key = error.substring(0, 100); // First 100 chars
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        });

        return Object.entries(errorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([error, count]) => ({ error, count }));
    }

    getStepBreakdown(entries) {
        const steps = {};
        entries.forEach(entry => {
            const step = entry.step;
            if (!steps[step]) {
                steps[step] = { total: 0, success: 0, error: 0 };
            }
            steps[step].total++;
            if (entry.status === 'success') steps[step].success++;
            if (entry.status === 'error') steps[step].error++;
        });

        return Object.entries(steps).map(([step, counts]) => ({
            step,
            ...counts,
            successRate: counts.total > 0 ? ((counts.success / counts.total) * 100).toFixed(1) : 0
        }));
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diffSeconds = Math.floor((now - then) / 1000);

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
        return `${Math.floor(diffSeconds / 86400)}d ago`;
    }

    getSystemStatus() {
        const recent = this.inspectionHistory.slice(0, 20);
        const errors = recent.filter(e => e.status === 'error');
        
        if (errors.length === 0) return 'healthy';
        if (errors.length <= 2) return 'warning';
        return 'error';
    }

    /**
     * Migration handler for displaying legacy processing history entries alongside enhanced ones (LIN-13 Task 3.2)
     * @param {Array} historyEntries - Array of processing history entries from database
     * @returns {Array} - Normalized array of entries suitable for display
     */
    migrateProcessingHistoryDisplay(historyEntries) {
        if (!historyEntries || !Array.isArray(historyEntries)) {
            return [];
        }

        return historyEntries.map(entry => {
            // Check if this is an enhanced entry (new format)
            if (entry.details && typeof entry.details === 'object' && entry.details.formattedMessage) {
                // Enhanced entry - use formatted message and context
                return {
                    id: entry.id,
                    operation: entry.operation,
                    status: entry.status,
                    timestamp: entry.created_at || entry.timestamp,
                    duration_ms: entry.duration_ms,
                    
                    // Use enhanced formatted message for display
                    displayMessage: entry.details.formattedMessage,
                    
                    // Include contextual information for UI
                    stepNumber: entry.details.contextInfo?.stepNumber,
                    totalSteps: entry.details.contextInfo?.totalSteps,
                    suggestedAction: entry.details.contextInfo?.suggested_action,
                    errorType: entry.details.contextInfo?.error_type,
                    
                    // Preserve raw data for debugging/programmatic access
                    rawData: entry.details.rawData,
                    isEnhanced: true
                };
            } else {
                // Legacy entry - create formatted display from available data
                const legacyDisplayMessage = this.generateLegacyDisplayMessage(entry);
                
                return {
                    id: entry.id,
                    operation: entry.operation,
                    status: entry.status,
                    timestamp: entry.created_at || entry.timestamp,
                    duration_ms: entry.duration_ms,
                    
                    // Generate display message from legacy data
                    displayMessage: legacyDisplayMessage,
                    
                    // Extract what context we can from legacy format
                    stepNumber: entry.details?.stepNumber || entry.details?.step_number,
                    totalSteps: entry.details?.totalSteps || entry.details?.total_steps,
                    suggestedAction: entry.details?.suggested_action,
                    errorType: entry.details?.error_type,
                    
                    // Preserve original legacy data
                    rawData: entry.details || {},
                    isEnhanced: false
                };
            }
        });
    }

    /**
     * Generate display message for legacy processing history entries
     * @param {Object} entry - Legacy processing history entry
     * @returns {string} - Human-readable display message
     */
    generateLegacyDisplayMessage(entry) {
        const operation = entry.operation || 'Unknown operation';
        const status = entry.status || 'unknown';
        const details = entry.details || {};

        // Handle error status
        if (status === 'error' || status === 'failed') {
            const error = details.error || details.message || 'Unknown error occurred';
            let message = `${operation} failed: ${error}`;
            
            // Add retry suggestion if available
            if (details.suggested_action === 'retry_later') {
                message += ' (retry in a few minutes)';
            } else if (details.suggested_action === 'retry_immediately') {
                message += ' (can retry now)';
            }
            
            return message;
        }

        // Handle success status  
        if (status === 'success' || status === 'completed') {
            switch (operation) {
                case 'verify':
                    const url = details.linkedin_url;
                    return url ? `LinkedIn URL verified: ${url}` : 'LinkedIn URL verification completed';
                    
                case 'ingest':
                    const profile = details.profile_name;
                    return profile ? `Profile data extracted: ${profile}` : 'Profile data extracted successfully';
                    
                case 'score':
                    const score = details.score ?? details.total_score;
                    return score !== undefined ? `AI scoring completed: ${score}/10` : 'AI scoring completed successfully';
                    
                case 'jira_update':
                    return 'JIRA fields updated successfully';
                    
                default:
                    return `${operation} completed successfully`;
            }
        }

        // Handle in-progress status
        if (status === 'progress' || status === 'in_progress') {
            return `${operation} in progress...`;
        }

        // Default fallback
        return `${operation}: ${status}`;
    }

    /**
     * Format processing history entry for UI display with consistent styling
     * @param {Object} entry - Migrated processing history entry
     * @returns {Object} - Entry formatted for UI display
     */
    formatProcessingHistoryForUI(entry) {
        const statusIcon = this.getStatusIcon(entry.status);
        const statusClass = this.getStatusClass(entry.status);
        const timeAgo = this.getTimeAgo(entry.timestamp);
        
        return {
            ...entry,
            statusIcon,
            statusClass,
            timeAgo,
            
            // Format duration for display
            durationText: entry.duration_ms ? 
                `${Math.round(entry.duration_ms / 1000)}s` : 
                null,
                
            // Step progress indicator
            stepProgress: (entry.stepNumber && entry.totalSteps) ? 
                `${entry.stepNumber}/${entry.totalSteps}` : 
                null,
                
            // Enhanced vs Legacy indicator for debugging
            typeIndicator: entry.isEnhanced ? '🔄' : '📝'
        };
    }

    /**
     * Get CSS class for processing history status
     */
    getStatusClass(status) {
        const statusClasses = {
            success: 'text-success',
            completed: 'text-success',
            error: 'text-danger', 
            failed: 'text-danger',
            progress: 'text-primary',
            in_progress: 'text-primary'
        };
        return statusClasses[status] || 'text-muted';
    }

    /**
     * Clear old inspection history to prevent memory leaks
     */
    cleanup() {
        const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days
        this.inspectionHistory = this.inspectionHistory.filter(entry => 
            new Date(entry.timestamp) > cutoff
        );
        
        logger.info(`Job inspection history cleanup completed. Entries retained: ${this.inspectionHistory.length}`);
    }
}

// Create singleton instance
const jobInspector = new JobInspector();

// Cleanup old entries daily (only in production/development, not during tests)
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        jobInspector.cleanup();
    }, 24 * 60 * 60 * 1000);
}

module.exports = jobInspector;
