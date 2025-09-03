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
     * Store processing history entry to database for persistent tracking
     * @param {string} candidateKey - JIRA candidate key (e.g., "CAN-4230")
     * @param {string} operation - Operation performed (verify, compatibility, scoring, jira_update)
     * @param {string} status - Status (success, error, in_progress)
     * @param {Object} details - Detailed information about the operation
     * @param {number} durationMs - Duration in milliseconds (optional)
     * @param {string} profileId - Profile ID if available (optional)
     */
    async storeProcessingHistory(candidateKey, operation, status, details = {}, durationMs = null, profileId = null) {
        try {
            const historyData = {
                candidate_key: candidateKey,
                operation,
                status,
                details,
                duration_ms: durationMs,
                profile_id: profileId
            };

            // Store in database via backend API
            const response = await apiClient.post(`/processing/candidates/${candidateKey}/history`, historyData);
            
            if (response.success) {
                logger.info('Processing history stored to database', {
                    candidateKey,
                    operation,
                    status,
                    entryId: response.entry_id
                });
            }
        } catch (error) {
            logger.error('Failed to store processing history', {
                candidateKey,
                operation,
                error: error.message
            });
            // Don't throw - we don't want processing to fail just because history storage failed
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
            success: '✅',
            error: '❌'
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

// Cleanup old entries daily
setInterval(() => {
    jobInspector.cleanup();
}, 24 * 60 * 60 * 1000);

module.exports = jobInspector;
