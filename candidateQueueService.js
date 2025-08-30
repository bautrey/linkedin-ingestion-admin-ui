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
     * @param {string} jobName - Name of the job adding the candidate
     * @param {Object} candidateData - Candidate data to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Queue entry
     */
    async addToQueue(jobName, candidateData, options = {}) {
        try {
            const queueEntry = {
                job_name: jobName,
                candidate_data: candidateData,
                status: 'pending',
                priority: options.priority || 1,
                attempts: 0,
                max_retries: options.maxRetries || 3,
                retry_delay_ms: options.retryDelayMs || 30000,
                timeout_ms: options.timeoutMs || 300000,
                options: options.additionalOptions || {},
                created_at: new Date().toISOString(),
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
                jobName,
                queueId: data.id,
                candidateId: candidateData.id || 'unknown'
            });

            return data;
        } catch (error) {
            logger.error('Error adding candidate to queue:', error);
            throw error;
        }
    }

    /**
     * Get next pending candidate from queue
     * @param {string} jobName - Name of the job requesting work
     * @returns {Promise<Object|null>} Next candidate to process or null
     */
    async getNextPending(jobName) {
        try {
            // Get next pending candidate with priority ordering
            const { data, error } = await this.supabase
                .from('candidate_processing_queue')
                .select('*')
                .eq('job_name', jobName)
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
                    started_at: new Date().toISOString(),
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
                    completed_at: new Date().toISOString(),
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

            const newAttempts = queueEntry.attempts + 1;
            const maxRetries = queueEntry.max_retries || 3;
            const retryDelayMs = queueEntry.retry_delay_ms || 30000;

            let updateData = {
                attempts: newAttempts,
                updated_at: new Date().toISOString(),
                error_message: errorMessage,
                last_error_at: new Date().toISOString()
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
                    attempts: newAttempts,
                    maxRetries,
                    nextRetryAt: nextRetryAt.toISOString(),
                    error: errorMessage
                });
            } else {
                updateData.status = 'failed';
                updateData.failed_at = new Date().toISOString();

                logger.error(`Candidate processing permanently failed`, {
                    queueId,
                    attempts: newAttempts,
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
     * @param {string} jobName - Optional job name filter
     * @returns {Promise<Object>} Queue statistics
     */
    async getQueueStats(jobName = null) {
        try {
            let query = this.supabase
                .from('candidate_processing_queue')
                .select('status');

            if (jobName) {
                query = query.eq('job_name', jobName);
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
                jobName = null,
                status = null,
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'desc'
            } = options;

            let query = this.supabase
                .from('candidate_processing_queue')
                .select('*');

            if (jobName) {
                query = query.eq('job_name', jobName);
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
     * @param {string} jobName - Optional job name filter
     * @param {number} olderThanHours - Remove completed entries older than this
     * @returns {Promise<number>} Number of entries removed
     */
    async clearCompleted(jobName = null, olderThanHours = 24) {
        try {
            const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

            let query = this.supabase
                .from('candidate_processing_queue')
                .delete()
                .eq('status', 'completed')
                .lt('completed_at', cutoffTime.toISOString());

            if (jobName) {
                query = query.eq('job_name', jobName);
            }

            const { data, error } = await query.select('id');

            if (error) {
                throw new Error(`Failed to clear completed candidates: ${error.message}`);
            }

            const removedCount = data?.length || 0;
            logger.info(`Cleared ${removedCount} completed candidates from queue`, {
                jobName: jobName || 'all',
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
                .lt('started_at', cutoffTime.toISOString())
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