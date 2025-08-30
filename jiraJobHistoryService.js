const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class JiraJobHistoryService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }

    /**
     * Record the start of a JIRA job execution
     * @param {Object} execution - Execution details
     * @returns {Promise<string>} Execution ID
     */
    async recordJobStart(execution) {
        try {
            const {
                jobName,
                executionId,
                triggeredBy = 'scheduled',
                candidateKey = null,
                metadata = {}
            } = execution;

            const { data, error } = await this.supabase
                .from('jira_job_execution_history')
                .insert([{
                    job_name: jobName,
                    execution_id: executionId,
                    started_at: new Date().toISOString(),
                    status: 'running',
                    triggered_by: triggeredBy,
                    candidate_key: candidateKey,
                    metadata
                }])
                .select('id')
                .single();

            if (error) {
                logger.error('Failed to record job start:', error);
                throw error;
            }

            logger.info(`Recorded start of JIRA job ${jobName} (${executionId})`, {
                jobName,
                executionId,
                triggeredBy,
                candidateKey
            });

            return data.id;

        } catch (error) {
            logger.error('Error recording job start:', error);
            throw error;
        }
    }

    /**
     * Record the completion of a JIRA job execution
     * @param {Object} execution - Execution completion details
     */
    async recordJobCompletion(execution) {
        try {
            const {
                executionId,
                success,
                duration,
                result = null,
                error = null,
                retryCount = 0
            } = execution;

            const completedAt = new Date().toISOString();

            const { error: updateError } = await this.supabase
                .from('jira_job_execution_history')
                .update({
                    completed_at: completedAt,
                    duration_ms: duration,
                    status: success ? 'completed' : 'failed',
                    success,
                    result,
                    error_message: error,
                    retry_count: retryCount
                })
                .eq('execution_id', executionId);

            if (updateError) {
                logger.error('Failed to record job completion:', updateError);
                throw updateError;
            }

            logger.info(`Recorded completion of JIRA job execution ${executionId}`, {
                executionId,
                success,
                duration
            });

        } catch (error) {
            logger.error('Error recording job completion:', error);
            throw error;
        }
    }

    /**
     * Get JIRA job execution history
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Job execution history
     */
    async getJobHistory(filters = {}) {
        try {
            const {
                jobName = null,
                candidateKey = null,
                triggeredBy = null,
                limit = 100,
                offset = 0
            } = filters;

            let query = this.supabase
                .from('jira_job_execution_history')
                .select('*')
                .order('started_at', { ascending: false });

            if (jobName) {
                query = query.eq('job_name', jobName);
            }

            if (candidateKey) {
                query = query.eq('candidate_key', candidateKey);
            }

            if (triggeredBy) {
                query = query.eq('triggered_by', triggeredBy);
            }

            query = query.range(offset, offset + limit - 1);

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch job history:', error);
                throw error;
            }

            return data || [];

        } catch (error) {
            logger.error('Error fetching job history:', error);
            throw error;
        }
    }

    /**
     * Get JIRA job execution summary statistics
     * @param {string} jobName - Optional job name filter
     * @returns {Promise<Object>} Job summary statistics
     */
    async getJobSummary(jobName = null) {
        try {
            let query = this.supabase
                .from('jira_job_execution_summary')
                .select('*');

            if (jobName) {
                query = query.eq('job_name', jobName);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch job summary:', error);
                throw error;
            }

            return data || [];

        } catch (error) {
            logger.error('Error fetching job summary:', error);
            throw error;
        }
    }

    /**
     * Get recent job executions (last 24 hours)
     * @param {string} jobName - Optional job name filter
     * @returns {Promise<Array>} Recent executions
     */
    async getRecentExecutions(jobName = null) {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let query = this.supabase
                .from('jira_job_execution_history')
                .select('*')
                .gte('started_at', yesterday.toISOString())
                .order('started_at', { ascending: false });

            if (jobName) {
                query = query.eq('job_name', jobName);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch recent executions:', error);
                throw error;
            }

            return data || [];

        } catch (error) {
            logger.error('Error fetching recent executions:', error);
            throw error;
        }
    }

    /**
     * Get executions for a specific candidate
     * @param {string} candidateKey - JIRA candidate key
     * @returns {Promise<Array>} Candidate executions
     */
    async getCandidateExecutions(candidateKey) {
        try {
            const { data, error } = await this.supabase
                .from('jira_job_execution_history')
                .select('*')
                .eq('candidate_key', candidateKey)
                .order('started_at', { ascending: false });

            if (error) {
                logger.error('Failed to fetch candidate executions:', error);
                throw error;
            }

            return data || [];

        } catch (error) {
            logger.error('Error fetching candidate executions:', error);
            throw error;
        }
    }

    /**
     * Check if a job is currently running
     * @param {string} jobName - Job name to check
     * @returns {Promise<boolean>} True if job is running
     */
    async isJobRunning(jobName) {
        try {
            const { data, error } = await this.supabase
                .from('jira_job_execution_history')
                .select('id')
                .eq('job_name', jobName)
                .eq('status', 'running')
                .limit(1);

            if (error) {
                logger.error('Failed to check job running status:', error);
                throw error;
            }

            return (data || []).length > 0;

        } catch (error) {
            logger.error('Error checking job running status:', error);
            throw error;
        }
    }

    /**
     * Get the last execution for a job
     * @param {string} jobName - Job name
     * @returns {Promise<Object|null>} Last execution or null
     */
    async getLastExecution(jobName) {
        try {
            const { data, error } = await this.supabase
                .from('jira_job_execution_history')
                .select('*')
                .eq('job_name', jobName)
                .order('started_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                logger.error('Failed to fetch last execution:', error);
                throw error;
            }

            return data || null;

        } catch (error) {
            logger.error('Error fetching last execution:', error);
            throw error;
        }
    }

    /**
     * Clean up old job history (keep last 1000 executions per job)
     * @returns {Promise<number>} Number of records deleted
     */
    async cleanupOldHistory() {
        try {
            // Get job names
            const { data: jobs, error: jobsError } = await this.supabase
                .from('jira_job_execution_history')
                .select('job_name')
                .group('job_name');

            if (jobsError) {
                throw jobsError;
            }

            let totalDeleted = 0;

            for (const job of jobs || []) {
                const { data: oldRecords, error: oldError } = await this.supabase
                    .from('jira_job_execution_history')
                    .select('id')
                    .eq('job_name', job.job_name)
                    .order('started_at', { ascending: false })
                    .range(1000, 999999); // Skip first 1000, get the rest

                if (oldError) {
                    logger.warn(`Failed to fetch old records for ${job.job_name}:`, oldError);
                    continue;
                }

                if (oldRecords && oldRecords.length > 0) {
                    const idsToDelete = oldRecords.map(r => r.id);
                    
                    const { error: deleteError } = await this.supabase
                        .from('jira_job_execution_history')
                        .delete()
                        .in('id', idsToDelete);

                    if (deleteError) {
                        logger.warn(`Failed to delete old records for ${job.job_name}:`, deleteError);
                        continue;
                    }

                    totalDeleted += idsToDelete.length;
                    logger.info(`Cleaned up ${idsToDelete.length} old records for job ${job.job_name}`);
                }
            }

            return totalDeleted;

        } catch (error) {
            logger.error('Error cleaning up old history:', error);
            throw error;
        }
    }
}

// Create singleton instance
const jiraJobHistoryService = new JiraJobHistoryService();

module.exports = jiraJobHistoryService;