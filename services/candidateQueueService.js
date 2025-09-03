const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class CandidateQueueService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }

    /**
     * Add candidate to processing queue
     * @param {string} jobExecutionId - ID of the job execution adding the candidate
     * @param {Object} candidateData - Candidate data to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Queue entry
     */
    async addToQueue(jobExecutionId, candidateData, options = {}) {
        try {
            const queueEntry = {
                job_execution_id: jobExecutionId,
                candidate_key: candidateData.key,
                candidate_name: candidateData.name || candidateData.fields?.customfield_10302 || 'Unknown',
                linkedin_url: candidateData.fields?.customfield_10400,
                status: 'pending',
                priority: options.priority || 1,
                attempt_count: 0,
                max_attempts: options.maxRetries || 3,
                next_retry_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('candidate_processing_queue')
                .insert([queueEntry])
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to add candidate to queue: ${error.message}`);
            }

            logger.info(`Candidate queued successfully`, {
                jobExecutionId,
                queueId: data.id,
                candidateKey: candidateData.key || 'unknown'
            });

            return data;
        } catch (error) {
            logger.error('Error adding candidate to queue:', error);
            throw error;
        }
    }

    /**
     * Get next pending candidate from queue (any job)
     * @returns {Promise<Object|null>} Next candidate to process or null
     */
    async getNextPending() {
        try {
            // Get next pending candidate with priority ordering from any job
            const { data, error } = await this.supabase
                .from('candidate_processing_queue')
                .select('*')
                .eq('status', 'pending')
                .lte('next_retry_at', new Date().toISOString())
                .order('priority', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (error) {
                throw new Error(`Failed to get next pending candidate: ${error.message}`);
            }

            if (!data) {
                return null;
            }

            // Mark as processing
            const { error: updateError } = await this.supabase
                .from('candidate_processing_queue')
                .update({
                    status: 'processing',
                    processing_started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                logger.error(`Failed to mark candidate as processing: ${updateError.message}`);
                return null;
            }

            return data;
        } catch (error) {
            logger.error('Error getting next pending candidate:', error);
            throw error;
        }
    }

    /**
     * Mark candidate processing as successful
     * @param {string} queueId - Queue entry ID
     * @param {Object} result - Processing result
     * @returns {Promise<void>}
     */
    async markSuccess(queueId, result = {}) {
        try {
            const { error } = await this.supabase
                .from('candidate_processing_queue')
                .update({
                    status: 'completed',
                    processing_completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    result,
                    error_message: null
                })
                .eq('id', queueId);

            if (error) {
                throw new Error(`Failed to mark candidate as successful: ${error.message}`);
            }

            logger.info(`Candidate processing completed successfully`, { queueId });
        } catch (error) {
            logger.error('Error marking candidate as successful:', error);
            throw error;
        }
    }

    /**
     * Mark candidate processing as failed with retry logic
     * @param {string} queueId - Queue entry ID
     * @param {string} errorMessage - Error description
     * @param {boolean} shouldRetry - Whether to retry or mark as permanently failed
     * @returns {Promise<void>}
     */
    async markFailure(queueId, errorMessage, shouldRetry = true) {
        try {
            // Get current queue entry to check retry count
            const { data: queueEntry, error: fetchError } = await this.supabase
                .from('candidate_processing_queue')
                .select('*')
                .eq('id', queueId)
                .single();

            if (fetchError) {
                throw new Error(`Failed to fetch queue entry: ${fetchError.message}`);
            }

            const newAttempts = queueEntry.attempt_count + 1;
            const maxRetries = queueEntry.max_attempts || 3;
            const retryDelayMs = 30000; // 30 seconds base delay

            let updateData = {
                attempt_count: newAttempts,
                updated_at: new Date().toISOString(),
                error_message: errorMessage,
                last_attempt_at: new Date().toISOString()
            };

            if (shouldRetry && newAttempts < maxRetries) {
                // Calculate exponential backoff: 30s → 1m → 2m
                const backoffMultiplier = Math.pow(2, newAttempts - 1);
                const nextRetryDelay = retryDelayMs * backoffMultiplier;
                const nextRetryAt = new Date(Date.now() + nextRetryDelay);

                updateData.status = 'pending';
                updateData.next_retry_at = nextRetryAt.toISOString();

                logger.warn(`Candidate processing failed, will retry`, {
                    queueId,
                    attempt_count: newAttempts,
                    maxRetries,
                    nextRetryAt: nextRetryAt.toISOString(),
                    error: errorMessage
                });
            } else {
                updateData.status = 'failed';
                updateData.processing_completed_at = new Date().toISOString();

                logger.error(`Candidate processing permanently failed`, {
                    queueId,
                    attempt_count: newAttempts,
                    maxRetries,
                    error: errorMessage
                });
            }

            const { error } = await this.supabase
                .from('candidate_processing_queue')
                .update(updateData)
                .eq('id', queueId);

            if (error) {
                throw new Error(`Failed to mark candidate as failed: ${error.message}`);
            }
        } catch (error) {
            logger.error('Error marking candidate as failed:', error);
            throw error;
        }
    }

    /**
     * Get queue status summary
     * @param {string} jobExecutionId - Optional job execution ID filter
     * @returns {Promise<Object>} Queue statistics
     */
    async getQueueStats(jobExecutionId = null) {
        try {
            let query = this.supabase
                .from('candidate_processing_queue')
                .select('status');

            if (jobExecutionId) {
                query = query.eq('job_execution_id', jobExecutionId);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Failed to get queue stats: ${error.message}`);
            }

            const stats = {
                total: data.length,
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0
            };

            data.forEach(entry => {
                stats[entry.status] = (stats[entry.status] || 0) + 1;
            });

            return stats;
        } catch (error) {
            logger.error('Error getting queue stats:', error);
            throw error;
        }
    }

    /**
     * Get queue entries with pagination
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Queue entries
     */
    async getQueueEntries(options = {}) {
        try {
            const {
                jobExecutionId = null,
                status = null,
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'desc'
            } = options;

            let query = this.supabase
                .from('candidate_processing_queue')
                .select('*');

            if (jobExecutionId) {
                query = query.eq('job_execution_id', jobExecutionId);
            }

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query
                .order(orderBy, { ascending: orderDirection === 'asc' })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new Error(`Failed to get queue entries: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            logger.error('Error getting queue entries:', error);
            throw error;
        }
    }

    /**
     * Retry failed candidate
     * @param {string} queueId - Queue entry ID
     * @returns {Promise<void>}
     */
    async retryCandidate(queueId) {
        try {
            const { error } = await this.supabase
                .from('candidate_processing_queue')
                .update({
                    status: 'pending',
                    next_retry_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    error_message: null
                })
                .eq('id', queueId);

            if (error) {
                throw new Error(`Failed to retry candidate: ${error.message}`);
            }

            logger.info(`Candidate queued for retry`, { queueId });
        } catch (error) {
            logger.error('Error retrying candidate:', error);
            throw error;
        }
    }

    /**
     * Clear completed candidates from queue
     * @param {string} jobExecutionId - Optional job execution ID filter
     * @param {number} olderThanHours - Remove completed entries older than this
     * @returns {Promise<number>} Number of entries removed
     */
    async clearCompleted(jobExecutionId = null, olderThanHours = 24) {
        try {
            const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

            let query = this.supabase
                .from('candidate_processing_queue')
                .delete()
                .eq('status', 'completed')
                .lt('processing_completed_at', cutoffTime.toISOString());

            if (jobExecutionId) {
                query = query.eq('job_execution_id', jobExecutionId);
            }

            const { data, error } = await query.select('id');

            if (error) {
                throw new Error(`Failed to clear completed candidates: ${error.message}`);
            }

            const removedCount = data?.length || 0;
            logger.info(`Cleared ${removedCount} completed candidates from queue`, {
                jobExecutionId: jobExecutionId || 'all',
                olderThanHours
            });

            return removedCount;
        } catch (error) {
            logger.error('Error clearing completed candidates:', error);
            throw error;
        }
    }

    /**
     * Reset stuck processing candidates
     * @param {number} timeoutMinutes - Reset candidates processing longer than this
     * @returns {Promise<number>} Number of entries reset
     */
    async resetStuckProcessing(timeoutMinutes = 60) {
        try {
            const cutoffTime = new Date(Date.now() - (timeoutMinutes * 60 * 1000));

            const { data, error } = await this.supabase
                .from('candidate_processing_queue')
                .update({
                    status: 'pending',
                    next_retry_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    error_message: 'Reset due to processing timeout'
                })
                .eq('status', 'processing')
                .lt('processing_started_at', cutoffTime.toISOString())
                .select('id');

            if (error) {
                throw new Error(`Failed to reset stuck processing: ${error.message}`);
            }

            const resetCount = data?.length || 0;
            logger.warn(`Reset ${resetCount} stuck processing candidates`, {
                timeoutMinutes
            });

            return resetCount;
        } catch (error) {
            logger.error('Error resetting stuck processing:', error);
            throw error;
        }
    }
}

module.exports = new CandidateQueueService();