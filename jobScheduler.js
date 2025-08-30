const cron = require('node-cron');
const logger = require('../utils/logger');
const EventEmitter = require('events');
const jiraJobHistoryService = require('./jiraJobHistoryService');
const jobDefinitionService = require('./jobDefinitionService');

class JobScheduler extends EventEmitter {
    constructor() {
        super();
        this.jobs = new Map();
        this.jobStatus = new Map();
        this.jobHistory = [];
        this.maxHistorySize = 1000;
        this.io = null; // Will be set by server.js
        
        // Initialize default jobs
        this.initializeJobs();
    }

    /**
     * Initialize jobs from database
     */
    async initializeJobs() {
        try {
            logger.info('Loading job definitions from database...');
            const jobDefinitions = await jobDefinitionService.getAllEnabledJobs();
            
            for (const jobDef of jobDefinitions) {
                const handler = this.getJobHandler(jobDef.handler_function);
                if (handler) {
                    this.registerJob(
                        jobDef.name,
                        jobDef.schedule,
                        handler,
                        {
                            timezone: jobDef.timezone,
                            enabled: jobDef.enabled,
                            maxRetries: jobDef.max_retries,
                            retryDelay: jobDef.retry_delay_ms,
                            timeout: jobDef.timeout_ms,
                            description: jobDef.description,
                            ...jobDef.options
                        }
                    );
                } else {
                    logger.warn(`No handler found for job '${jobDef.name}' with function '${jobDef.handler_function}'`);
                }
            }
            
            logger.info(`Job scheduler initialized with ${jobDefinitions.length} jobs from database`);
        } catch (error) {
            logger.error('Failed to initialize jobs from database:', error);
            logger.info('Job scheduler will start with no jobs');
        }
    }

    /**
     * Get job handler function by name
     * @param {string} handlerName - Name of the handler function
     * @returns {Function|null} Handler function or null if not found
     */
    getJobHandler(handlerName) {
        // Lazy load candidateProcessingJob to avoid circular dependency issues
        const handlerMap = {
            'processRecentCandidates': () => {
                const candidateProcessingJob = require('./candidateProcessingJob');
                return candidateProcessingJob.processRecentCandidates();
            },
            'processOlderCandidates': () => {
                const candidateProcessingJob = require('./candidateProcessingJob');
                return candidateProcessingJob.processOlderCandidates();
            }
        };

        return handlerMap[handlerName] || null;
    }

    /**
     * Register a new scheduled job
     * @param {string} name - Job name
     * @param {string} schedule - Cron schedule expression
     * @param {Function} handler - Job handler function
     * @param {Object} options - Job options
     */
    registerJob(name, schedule, handler, options = {}) {
        if (this.jobs.has(name)) {
            throw new Error(`Job '${name}' already registered`);
        }

        const job = {
            name,
            schedule,
            handler,
            options: {
                timezone: 'America/New_York',
                enabled: true,
                maxRetries: 3,
                retryDelay: 5000, // 5 seconds
                ...options
            },
            task: null,
            lastRun: null,
            nextRun: null,
            runCount: 0,
            failCount: 0
        };

        // Create the cron task
        job.task = cron.schedule(schedule, async () => {
            await this.executeJob(name);
        }, {
            scheduled: false, // Don't start immediately
            timezone: job.options.timezone
        });

        this.jobs.set(name, job);
        
        // Initialize job status
        this.jobStatus.set(name, {
            name,
            status: 'idle',
            enabled: job.options.enabled,
            lastRun: null,
            lastResult: null,
            nextRun: this.getNextRunTime(schedule, job.options.timezone),
            runCount: 0,
            failCount: 0,
            currentRetry: 0
        });

        logger.info(`Registered job '${name}' with schedule '${schedule}'`);

        // Start the job if enabled
        if (job.options.enabled) {
            this.startJob(name);
        }

        return job;
    }

    /**
     * Emit detailed job progress update
     * @param {string} jobName - Job name
     * @param {string} stepName - Current step name
     * @param {Object} data - Progress data
     */
    emitJobProgress(jobName, stepName, data) {
        if (this.io) {
            this.io.emit('job-progress-update', {
                jobName,
                stepName,
                timestamp: new Date().toISOString(),
                ...data
            });
        }
    }

    /**
     * Execute a job with error handling and retry logic
     * @param {string} name - Job name
     */
    async executeJob(name) {
        const job = this.jobs.get(name);
        const status = this.jobStatus.get(name);

        if (!job || !job.options.enabled) {
            return;
        }

        if (status.status === 'running') {
            logger.warn(`Job '${name}' is already running, skipping execution`);
            return;
        }

        const executionId = Date.now().toString();
        const startTime = new Date();

        // Record job start in database
        try {
            await jiraJobHistoryService.recordJobStart({
                jobName: name,
                executionId,
                triggeredBy: 'scheduled',
                metadata: {
                    maxRetries: job.options.maxRetries,
                    retryDelay: job.options.retryDelay
                }
            });
        } catch (dbError) {
            logger.warn('Failed to record job start in database:', dbError.message);
            // Continue execution even if database logging fails
        }

        // Update status
        status.status = 'running';
        status.lastRun = startTime;
        status.runCount++;
        status.currentRetry = 0;

        // Emit websocket update for job start
        if (this.io) {
            this.io.emit('job-status-update', {
                jobName: name,
                status: 'running',
                startTime: startTime.toISOString(),
                runCount: status.runCount,
                executionId,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`Starting job '${name}' (execution ${executionId});`);

        let result = null;
        let error = null;
        let retryCount = 0;

        while (retryCount <= job.options.maxRetries) {
            try {
                result = await job.handler();
                error = null;
                break; // Success, exit retry loop
            } catch (err) {
                error = err;
                retryCount++;
                    status.currentRetry = retryCount;

                    // Emit websocket update for retry
                    if (this.io && retryCount <= job.options.maxRetries) {
                        this.io.emit('job-status-update', {
                            jobName: name,
                            status: 'retrying',
                            currentRetry: retryCount,
                            maxRetries: job.options.maxRetries,
                            error: err.message,
                            executionId,
                            timestamp: new Date().toISOString()
                        });
                    }

                if (retryCount <= job.options.maxRetries) {
                    logger.warn(`Job '${name}' failed, retrying (${retryCount}/${job.options.maxRetries}):`, err.message);
                    if (job.options.retryDelay > 0) {
                        await this.sleep(job.options.retryDelay);
                    }
                } else {
                    logger.error(`Job '${name}' failed after ${job.options.maxRetries} retries:`, err.message);
                    status.failCount++;
                }
            }
        }

        const endTime = new Date();
        const duration = endTime - startTime;

        // Record job completion in database
        try {
            await jiraJobHistoryService.recordJobCompletion({
                executionId,
                success: !error,
                duration,
                result,
                error: error ? error.message : null,
                retryCount
            });
        } catch (dbError) {
            logger.warn('Failed to record job completion in database:', dbError.message);
            // Continue execution even if database logging fails
        }

        // Update status
        status.status = error ? 'failed' : 'completed';
        status.lastResult = {
            success: !error,
            duration,
            result: result,
            error: error ? error.message : null,
            timestamp: endTime,
            retries: retryCount
        };
        status.nextRun = this.getNextRunTime(job.schedule, job.options.timezone);
        status.currentRetry = 0;
        
        // Emit websocket update for job completion
        if (this.io) {
            this.io.emit('job-status-update', {
                jobName: name,
                status: error ? 'failed' : 'completed',
                duration,
                success: !error,
                result: result,
                error: error ? error.message : null,
                retries: retryCount,
                executionId,
                timestamp: endTime.toISOString(),
                nextRun: status.nextRun?.toISOString()
            });
        }

        // Add to history
        this.addToHistory({
            id: executionId,
            jobName: name,
            startTime,
            endTime,
            duration,
            success: !error,
            result,
            error: error ? error.message : null,
            retries: retryCount
        });

        // Emit events
        if (error) {
            this.emit('jobFailed', {
                name,
                error,
                retries: retryCount,
                duration
            });
        } else {
            this.emit('jobCompleted', {
                name,
                result,
                duration
            });
        }

        logger.info(`Job '${name}' completed in ${duration}ms (success: ${!error})`);
    }

    /**
     * Manually trigger a job
     * @param {string} name - Job name
     * @returns {Promise} Job result
     */
    async triggerJob(name) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job '${name}' not found`);
        }

        logger.info(`Manually triggering job '${name}'`);
        return await this.executeJob(name);
    }

    /**
     * Run a job in dry-run mode (test mode with limited data)
     * @param {string} name - Job name
     * @param {Object} options - Dry run options
     * @returns {Promise} Job result
     */
    async dryRunJob(name, options = {}) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job '${name}' not found`);
        }

        const dryRunOptions = {
            maxItems: 5,
            skipWrites: true,
            logOnly: true,
            ...options
        };

        logger.info(`Starting dry-run for job '${name}'`, dryRunOptions);

        const executionId = `dryrun-${Date.now()}`;
        const startTime = new Date();

        try {
            // Set dry-run flag for the job handler to check
            process.env.JOB_DRY_RUN = 'true';
            process.env.JOB_DRY_RUN_OPTIONS = JSON.stringify(dryRunOptions);

            const result = await job.handler();
            const endTime = new Date();
            const duration = endTime - startTime;

            // Add dry-run to history
            this.addToHistory({
                id: executionId,
                jobName: name,
                startTime,
                endTime,
                duration,
                success: true,
                result,
                error: null,
                retries: 0,
                isDryRun: true,
                dryRunOptions
            });

            logger.info(`Dry-run for job '${name}' completed in ${duration}ms`);
            return { success: true, result, duration, isDryRun: true };

        } catch (error) {
            const endTime = new Date();
            const duration = endTime - startTime;

            this.addToHistory({
                id: executionId,
                jobName: name,
                startTime,
                endTime,
                duration,
                success: false,
                result: null,
                error: error.message,
                retries: 0,
                isDryRun: true,
                dryRunOptions
            });

            logger.error(`Dry-run for job '${name}' failed:`, error.message);
            return { success: false, error: error.message, duration, isDryRun: true };
        } finally {
            // Clean up dry-run environment
            delete process.env.JOB_DRY_RUN;
            delete process.env.JOB_DRY_RUN_OPTIONS;
        }
    }

    /**
     * Start a job
     * @param {string} name - Job name
     */
    startJob(name) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job '${name}' not found`);
        }

        job.task.start();
        job.options.enabled = true;
        
        const status = this.jobStatus.get(name);
        status.enabled = true;
        status.nextRun = this.getNextRunTime(job.schedule, job.options.timezone);

        logger.info(`Started job '${name}'`);
    }

    /**
     * Stop a job
     * @param {string} name - Job name
     */
    stopJob(name) {
        const job = this.jobs.get(name);
        if (!job) {
            throw new Error(`Job '${name}' not found`);
        }

        job.task.stop();
        job.options.enabled = false;
        
        const status = this.jobStatus.get(name);
        status.enabled = false;
        status.nextRun = null;

        logger.info(`Stopped job '${name}'`);
    }

    /**
     * Enable a job (updates database and starts job)
     * @param {string} name - Job name
     */
    async enableJob(name) {
        try {
            await jobDefinitionService.updateJobStatus(name, true);
            this.startJob(name);
            logger.info(`Job '${name}' enabled and started`);
        } catch (error) {
            logger.error(`Failed to enable job '${name}':`, error);
            throw error;
        }
    }

    /**
     * Disable a job (updates database and stops job)
     * @param {string} name - Job name
     */
    async disableJob(name) {
        try {
            await jobDefinitionService.updateJobStatus(name, false);
            this.stopJob(name);
            logger.info(`Job '${name}' disabled and stopped`);
        } catch (error) {
            logger.error(`Failed to disable job '${name}':`, error);
            throw error;
        }
    }

    /**
     * Get job status with database-enriched information
     * @param {string} name - Job name (optional, returns all if not specified)
     * @returns {Promise<Object|Array>} Job status
     */
    async getJobStatus(name = null) {
        if (name) {
            const status = this.jobStatus.get(name);
            const job = this.jobs.get(name);
            
            if (status && job) {
                // Enrich with database information
                try {
                    const lastExecution = await jiraJobHistoryService.getLastExecution(name);
                    const isRunning = await jiraJobHistoryService.isJobRunning(name);
                    
                    return {
                        ...status,
                        schedule: job.schedule,
                        config: job.options,
                        longDescription: job.options.longDescription,
                        tags: job.options.tags,
                        lastRun: lastExecution ? new Date(lastExecution.started_at) : null,
                        lastResult: lastExecution ? {
                            success: lastExecution.success,
                            duration: lastExecution.duration_ms,
                            error: lastExecution.error_message,
                            timestamp: new Date(lastExecution.completed_at || lastExecution.started_at),
                            retries: lastExecution.retry_count || 0
                        } : null,
                        status: isRunning ? 'running' : status.status
                    };
                } catch (error) {
                    logger.warn(`Failed to enrich job status for ${name}:`, error.message);
                    return {
                        ...status,
                        schedule: job.schedule,
                        config: job.options,
                        longDescription: job.options.longDescription,
                        tags: job.options.tags
                    };
                }
            }
            return status;
        }
        
        // Return all job statuses with database enrichment
        const statuses = Array.from(this.jobStatus.values());
        const enrichedStatuses = [];
        
        for (const status of statuses) {
            const job = this.jobs.get(status.name);
            if (job) {
                try {
                    const lastExecution = await jiraJobHistoryService.getLastExecution(status.name);
                    const isRunning = await jiraJobHistoryService.isJobRunning(status.name);
                    
                    enrichedStatuses.push({
                        ...status,
                        schedule: job.schedule,
                        config: job.options,
                        longDescription: job.options.longDescription,
                        tags: job.options.tags,
                        lastRun: lastExecution ? new Date(lastExecution.started_at) : null,
                        lastResult: lastExecution ? {
                            success: lastExecution.success,
                            duration: lastExecution.duration_ms,
                            error: lastExecution.error_message,
                            timestamp: new Date(lastExecution.completed_at || lastExecution.started_at),
                            retries: lastExecution.retry_count || 0
                        } : null,
                        status: isRunning ? 'running' : status.status
                    });
                } catch (error) {
                    logger.warn(`Failed to enrich job status for ${status.name}:`, error.message);
                    enrichedStatuses.push({
                        ...status,
                        schedule: job.schedule,
                        config: job.options,
                        longDescription: job.options.longDescription,
                        tags: job.options.tags
                    });
                }
            } else {
                enrichedStatuses.push(status);
            }
        }
        
        return enrichedStatuses;
    }

    /**
     * Get job history from database
     * @param {string} jobName - Filter by job name (optional)
     * @param {number} limit - Limit results (default: 100)
     * @returns {Promise<Array>} Job history entries
     */
    async getJobHistory(jobName = null, limit = 100) {
        try {
            const history = await jiraJobHistoryService.getJobHistory({
                jobName,
                limit
            });
            
            // Convert database format to match expected format
            return history.map(entry => ({
                id: entry.execution_id,
                jobName: entry.job_name,
                startTime: new Date(entry.started_at),
                endTime: entry.completed_at ? new Date(entry.completed_at) : null,
                duration: entry.duration_ms,
                success: entry.success,
                result: entry.result,
                error: entry.error_message,
                retries: entry.retry_count || 0,
                isDryRun: entry.is_dry_run,
                triggeredBy: entry.triggered_by,
                candidateKey: entry.candidate_key,
                metadata: entry.metadata
            }));
        } catch (error) {
            logger.error('Failed to fetch job history from database:', error);
            // Fall back to empty array if database fails
            return [];
        }
    }

    /**
     * Add entry to job history
     * @param {Object} entry - History entry
     */
    addToHistory(entry) {
        this.jobHistory.push(entry);
        
        // Trim history if too large
        if (this.jobHistory.length > this.maxHistorySize) {
            this.jobHistory = this.jobHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get next run time for a cron schedule
     * @param {string} schedule - Cron schedule
     * @param {string} timezone - Timezone
     * @returns {Date} Next run time
     */
    getNextRunTime(schedule, timezone = 'America/New_York') {
        try {
            // This is a simplified calculation - for production use a proper cron parser
            const now = new Date();
            const next = new Date(now.getTime() + 60000); // Simple: add 1 minute (placeholder)
            return next;
        } catch (error) {
            logger.warn('Failed to calculate next run time:', error.message);
            return null;
        }
    }

    /**
     * Utility method to sleep
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Set the Socket.IO instance for real-time updates
     * @param {Object} io - Socket.IO instance
     */
    setSocketIO(io) {
        this.io = io;
        logger.info('Job scheduler connected to Socket.IO for real-time updates');
    }
    
    /**
     * Shutdown the job scheduler
     */
    shutdown() {
        logger.info('Shutting down job scheduler...');
        
        for (const [name, job] of this.jobs) {
            if (job.task) {
                job.task.stop();
                logger.info(`Stopped job '${name}'`);
            }
        }
        
        this.jobs.clear();
        this.jobStatus.clear();
        
        logger.info('Job scheduler shutdown complete');
    }
}

// Create singleton instance
const jobScheduler = new JobScheduler();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    jobScheduler.shutdown();
});

process.on('SIGINT', () => {
    jobScheduler.shutdown();
});

module.exports = jobScheduler;
