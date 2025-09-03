const apiClient = require('../config/api');
// const jobScheduler = require('./jobScheduler'); // REMOVED: Circular dependency - loaded lazily when needed
const logger = require('../utils/logger');
const jobInspector = require('../utils/jobInspector');
const candidateQueueService = require('./candidateQueueService');
const jiraJobHistoryService = require('./jiraJobHistoryService');

class CandidateProcessingJob {
    constructor() {
        this.jobName = 'process-candidates';
        this.isProcessing = false;
        this.queuePollInterval = 5000; // Poll every 5 seconds
        this.queuePollTimer = null;
        // Jobs are now loaded from database by jobScheduler
        // this.registerJobs(); // REMOVED: Jobs now managed via database
    }

    /**
     * Register the scheduled jobs with the job scheduler
     * NOTE: This method is kept for reference but no longer called
     * Jobs are now defined in the job_definitions database table
     */
    registerJobsLegacy() {
        try {
            // Main processing job - runs every hour for recent candidates
            jobScheduler.registerJob(
                'process-recent-candidates',
                '0 * * * *', // Every hour at minute 0
                () => this.processRecentCandidates(),
                {
                    enabled: true,
                    maxRetries: 2,
                    retryDelay: 5000,
                    description: 'Automatically process new candidates from Jira',
                    longDescription: 'Finds candidates added to Jira in the last 24 hours and runs the 4-step processing workflow: (1) Verify LinkedIn URL, (2) Ingest profile data, (3) Check role compatibility for CIO/CTO/CISO positions, (4) Score the best-fitting role. Updates Jira with results.',
                    category: 'Candidate Processing',
                    tags: ['automated', 'hourly', 'linkedin', 'scoring'],
                    config: {
                        schedule: '0 * * * *', // Every hour at minute 0
                        timeWindow: '24 hours',
                        maxCandidates: 20,
                        targetStatus: 'Interviewing',
                        steps: [
                            { order: 1, name: 'Verify LinkedIn URL', description: 'Validates that the LinkedIn profile URL is accessible and properly formatted' },
                            { order: 2, name: 'Ingest Profile Data', description: 'Extracts profile information from LinkedIn and stores it in our database' },
                            { order: 3, name: 'Check Role Compatibility', description: 'Tests candidate against CIO, CTO, and CISO role requirements to find the best fit' },
                            { order: 4, name: 'Score Candidate', description: 'Generates a numerical score (0-10) for the candidate in their best-fit role' }
                        ],
                        jiraUpdates: [
                            'Adds comments for each processing step',
                            'Updates fit status field (Scored/No Fit/Unscored)', 
                            'Sets numerical score (0-10)',
                            'Adds processing summary'
                        ],
                        configFile: '/app/services/candidateProcessingJob.js',
                        configLines: '18-30'
                    }
                }
            );

            // Catch-up job - runs daily for older unprocessed candidates
            jobScheduler.registerJob(
                'process-older-candidates',
                '0 8 * * *', // Daily at 8 AM
                () => this.processOlderCandidates(),
                {
                    enabled: true,
                    maxRetries: 1,
                    retryDelay: 10000,
                    description: 'Process older unscored candidates (catch-up job)',
                    longDescription: 'Daily catch-up job that finds ALL older candidates with LinkedIn URLs who have never been processed, regardless of creation date. Processes them oldest-first in small batches (5 candidates) to work through the backlog systematically.',
                    category: 'Candidate Processing',
                    tags: ['automated', 'daily', 'catch-up', 'maintenance']
                }
            );

            logger.info('Candidate processing jobs registered successfully');

        } catch (error) {
            logger.error('Failed to register candidate processing jobs:', error);
        }
    }

    /**
     * Process recent candidates (last 24 hours) - now queues candidates for processing
     */
    async processRecentCandidates() {
        const jobName = 'process-recent-candidates';
        const startTime = Date.now();
        
        // Log job start with comprehensive context
        jobInspector.logJobStart(jobName, {
            hoursBack: 24,
            maxResults: 20,
            jobType: 'recent',
            targetStatus: 'Interviewing',
            dryRun: process.env.JOB_DRY_RUN === 'true'
        });
        
        logger.info('Starting recent candidates queueing job');
        
        try {
            const result = await this.queueCandidatesForProcessing({
                hoursBack: 24,
                maxResults: 20,
                jobType: 'recent'
            });
            
            const duration = Date.now() - startTime;
            result.duration = duration;

            // Start queue processing if not already running
            if (!this.isProcessing) {
                this.startQueueProcessing();
            }

            // Log successful completion
            jobInspector.logJobComplete(jobName, result);
            logger.info('Recent candidates queueing job completed', result);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Log job failure
            jobInspector.logJobComplete(jobName, {
                success: false,
                error: error.message,
                duration
            });
            
            throw error;
        }
    }

    /**
     * Process older candidates (catch-up job) - now queues candidates for processing
     */
    async processOlderCandidates() {
        const jobName = 'process-older-candidates';
        const startTime = Date.now();
        
        logger.info('🔧 DEBUG: processOlderCandidates method called - THIS IS THE ACTUAL HANDLER!');
        logger.info('🔧 DEBUG: processOlderCandidates execution started at:', new Date().toISOString());
        
        // Log job start with comprehensive context
        jobInspector.logJobStart(jobName, {
            hoursBack: 24 * 7, // 1 week
            maxResults: 5,
            jobType: 'catchup',
            targetStatus: 'Interviewing',
            dryRun: process.env.JOB_DRY_RUN === 'true'
        });
        
        logger.info('🔧 DEBUG: About to log job start and begin queueing');
        logger.info('Starting older candidates queueing job');
        
        try {
            const result = await this.queueCandidatesForProcessing({
                hoursBack: null, // No date filter - find ALL older candidates
                maxResults: 2,
                jobType: 'older'
            });
            
            const duration = Date.now() - startTime;
            result.duration = duration;

            // Start queue processing if not already running
            if (!this.isProcessing) {
                this.startQueueProcessing();
            }

            // Log successful completion
            jobInspector.logJobComplete(jobName, result);
            logger.info('Older candidates queueing job completed', result);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Log job failure
            jobInspector.logJobComplete(jobName, {
                success: false,
                error: error.message,
                duration
            });
            
            throw error;
        }
    }

    /**
     * Queue candidates for processing instead of batch processing
     * @param {Object} options - Processing options
     */
    async queueCandidatesForProcessing(options) {
        const { hoursBack, maxResults, jobType } = options;
        const isDryRun = process.env.JOB_DRY_RUN === 'true';
        const dryRunOptions = isDryRun ? JSON.parse(process.env.JOB_DRY_RUN_OPTIONS || '{}') : {};
        
        if (isDryRun) {
            logger.info(`🧪 Running in DRY-RUN mode`, dryRunOptions);
        }
        
        // Emit initial progress
        const jobScheduler = require('./jobScheduler');
        jobScheduler.emitJobProgress(`process-${jobType}-candidates`, 'initializing', {
            status: 'searching',
            message: 'Searching for candidates to queue...',
            hoursBack,
            maxResults,
            isDryRun
        });
        
        try {
            // Step 1: Find candidates that need processing
            jobInspector.logStep(`queue-${jobType}`, 'searching', {
                hoursBack,
                maxResults,
                isDryRun
            });
            
            const candidates = await this.findCandidatesForProcessing({
                hoursBack,
                maxResults: isDryRun ? Math.min(dryRunOptions.maxItems || 5, maxResults) : maxResults,
                jobType
            });

            jobInspector.logStep(`queue-${jobType}`, 'found-candidates', {
                candidateCount: candidates.length,
                candidateKeys: candidates.map(c => c.key)
            });

            // Emit progress update with candidate count
            jobScheduler.emitJobProgress(`process-${jobType}-candidates`, 'candidates-found', {
                status: 'found-candidates',
                message: `Found ${candidates.length} candidates to queue`,
                candidateCount: candidates.length,
                candidates: candidates.map(c => ({ key: c.key, fullName: c.fullName }))
            });

            if (candidates.length === 0) {
                require('./jobScheduler').emitJobProgress(`process-${jobType}-candidates`, 'no-candidates', {
                    status: 'completed',
                    message: 'No candidates found to queue',
                    candidateCount: 0
                });
                return {
                    success: true,
                    message: `No candidates found for ${jobType} processing`,
                    queued: 0,
                    failed: 0
                };
            }

            logger.info(`Found ${candidates.length} candidates for ${jobType} queueing`);

            // Step 2: Add each candidate to queue
            jobInspector.logStep(`queue-${jobType}`, 'queueing-candidates', {
                candidateCount: candidates.length
            });
            
            require('./jobScheduler').emitJobProgress(`process-${jobType}-candidates`, 'queueing-start', {
                status: 'queueing',
                message: `Adding ${candidates.length} candidates to processing queue...`,
                candidateCount: candidates.length,
                currentStep: 'queueing-candidates'
            });
            
            const results = await this.addCandidatesToQueue(candidates, `process-${jobType}-candidates`);

            // Step 3: Calculate summary
            const successful = results.filter(r => r.success).length;
            const failed = results.length - successful;

            jobInspector.logStep(`queue-${jobType}`, 'queueing-complete', {
                successful,
                failed,
                total: results.length
            });

            require('./jobScheduler').emitJobProgress(`process-${jobType}-candidates`, 'queueing-complete', {
                status: 'queued',
                message: `${successful} candidates queued for processing`,
                candidateCount: successful,
                currentStep: 'queueing-complete'
            });

            return {
                success: true,
                message: `${jobType} candidates queued for processing`,
                queued: successful,
                failed,
                total: results.length,
                details: results
            };

        } catch (error) {
            logger.error(`Candidate queueing failed (${jobType}):`, error);
            throw error;
        }
    }

    /**
     * Find candidates that need processing from Jira
     * @param {Object} options - Search options
     */
    async findCandidatesForProcessing(options) {
        const { hoursBack, maxResults, jobType } = options;

        try {
            // Use FastAPI Jira integration to find candidates needing processing
            const response = await apiClient.get('/jira/candidates', {
                params: {
                    status: 'Interviewing',
                    resolution: 'Unresolved',
                    limit: maxResults
                }
            });

            const candidates = response.data.candidates || [];
            return candidates;

        } catch (error) {
            logger.error('Failed to find candidates for processing:', error);
            throw error;
        }
    }

    /**
     * Add multiple candidates to processing queue
     * @param {Array} candidates - Candidates to queue
     * @param {string} jobName - Name of the job queueing the candidates
     */
    async addCandidatesToQueue(candidates, jobName) {
        const results = [];
        const isDryRun = process.env.JOB_DRY_RUN === 'true';
        
        // Get the current job execution ID
        let jobExecutionId = null;
        if (!isDryRun) {
            try {
                const latestExecution = await jiraJobHistoryService.getLatestJobExecution(jobName);
                if (latestExecution) {
                    jobExecutionId = latestExecution.id;
                }
            } catch (error) {
                logger.warn(`Failed to get job execution ID for ${jobName}:`, error.message);
            }
        }
        
        // Add candidates to queue one at a time
        for (const candidate of candidates) {
            try {
                if (!isDryRun && jobExecutionId) {
                    const queueEntry = await candidateQueueService.addToQueue(jobExecutionId, {
                        key: candidate.key,
                        name: candidate.fullName,
                        fields: {
                            customfield_10400: candidate.linkedinUrl
                        }
                    }, {
                        priority: 1,
                        maxRetries: 3
                    });

                    results.push({
                        candidateKey: candidate.key,
                        success: true,
                        queueId: queueEntry.id,
                        message: 'Added to processing queue'
                    });
                } else {
                    logger.info(`🧪 DRY-RUN: Would queue candidate ${candidate.key} for processing`);
                    results.push({
                        candidateKey: candidate.key,
                        success: true,
                        queueId: 'dry-run-' + Date.now(),
                        message: 'DRY-RUN: Would add to processing queue'
                    });
                }
                
                // Small delay between queueing to avoid overwhelming the database
                await this.sleep(100);
                
            } catch (error) {
                logger.error(`Failed to queue candidate ${candidate.key}:`, error);
                results.push({
                    candidateKey: candidate.key,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Start the continuous queue processing loop
     */
    startQueueProcessing() {
        if (this.isProcessing) {
            logger.info('Queue processing is already running');
            return;
        }

        this.isProcessing = true;
        logger.info('Starting continuous queue processing');

        // Start the polling loop
        this.queuePollTimer = setInterval(async () => {
            try {
                await this.processNextFromQueue();
            } catch (error) {
                logger.error('Error in queue processing loop:', error);
            }
        }, this.queuePollInterval);

        // Also process immediately
        this.processNextFromQueue().catch(error => {
            logger.error('Error in initial queue processing:', error);
        });
    }

    /**
     * Stop the continuous queue processing loop
     */
    stopQueueProcessing() {
        if (this.queuePollTimer) {
            clearInterval(this.queuePollTimer);
            this.queuePollTimer = null;
        }
        this.isProcessing = false;
        logger.info('Stopped continuous queue processing');
    }

    /**
     * Process next candidate from queue
     */
    async processNextFromQueue() {
        try {
            // Get next pending candidate from any job
            const queueEntry = await candidateQueueService.getNextPending();
            
            if (!queueEntry) {
                // No pending candidates
                return;
            }

            const { id: queueId, candidate_key: candidateKey, candidate_name: candidateName, linkedin_url: linkedinUrl, job_execution_id: jobExecutionId } = queueEntry;
            logger.info(`Processing candidate from queue: ${candidateKey} (Queue ID: ${queueId})`);

            // Emit progress update for the specific job
            const jobScheduler = require('./jobScheduler');
            // Get job name from job execution ID if needed
            let jobName = 'unknown-job';
            try {
                const jobExecution = await jiraJobHistoryService.getJobExecutionById(jobExecutionId);
                if (jobExecution) {
                    jobName = jobExecution.job_name;
                }
            } catch (error) {
                logger.warn(`Failed to get job name for execution ${jobExecutionId}:`, error.message);
            }
            
            jobScheduler.emitJobProgress(jobName, 'processing-candidate', {
                status: 'processing',
                message: `Processing candidate ${candidateName}`,
                candidateKey: candidateKey,
                queueId
            });

            try {
                // Process the candidate using existing processing logic
                const candidateData = {
                    key: candidateKey,
                    linkedinUrl: linkedinUrl,
                    fullName: candidateName
                };
                const result = await this.processCandidate(candidateData);
                
                // Mark as successful in queue
                await candidateQueueService.markSuccess(queueId, result);
                
                // Emit success progress
                jobScheduler.emitJobProgress(jobName, 'candidate-success', {
                    status: 'candidate-completed',
                    message: `Successfully processed ${candidateData.fullName}`,
                    candidateKey: candidateData.key,
                    queueId,
                    result
                });

                logger.info(`Successfully processed candidate ${candidateData.key} from queue`);
                
            } catch (error) {
                logger.error(`Failed to process candidate ${candidateData.key} from queue:`, error);
                
                // Mark as failed in queue (will retry based on configuration)
                await candidateQueueService.markFailure(queueId, error.message, true);
                
                // Emit failure progress
                jobScheduler.emitJobProgress(jobName, 'candidate-failure', {
                    status: 'candidate-failed',
                    message: `Failed to process ${candidateData.fullName}: ${error.message}`,
                    candidateKey: candidateData.key,
                    queueId,
                    error: error.message
                });
            }

        } catch (error) {
            logger.error('Error processing candidate from queue:', error);
        }
    }

    /**
     * Process a single candidate through the 4-step workflow
     * @param {Object} candidate - Candidate to process
     */
    async processCandidate(candidate) {
        const { key, linkedinUrl, fullName } = candidate;
        
        logger.info(`Processing candidate ${key} (${fullName})`);
        
        // Log candidate processing start
        jobInspector.logCandidateStart(key, {
            fullName,
            linkedinUrl,
            processingSteps: ['verify', 'ingest', 'check_compatibility', 'score']
        });

        const steps = ['verify', 'ingest', 'check_compatibility', 'score'];
        const results = { steps: [], profileId: null, finalScore: null };
        let shouldContinue = true;

        for (const step of steps) {
            if (!shouldContinue) break;

            try {
                logger.info(`Running ${step} for candidate ${key}`);
                
                // Log step start
                jobInspector.logStep(key, `step-${step}-start`, {
                    stepName: step,
                    linkedinUrl: step === 'verify' || step === 'ingest' ? linkedinUrl : undefined,
                    profileId: step === 'check_compatibility' || step === 'score' ? results.profileId : undefined
                });
                
                const stepResult = await this.executeProcessingStep(step, {
                    candidateKey: key,
                    linkedinUrl,
                    profileId: results.profileId,
                    bestRole: this.getBestRoleFromResults(results)
                });

                results.steps.push({
                    step,
                    success: true,
                    ...stepResult
                });

                // Update profile ID from ingest step
                if (step === 'ingest' && stepResult.profile_id) {
                    results.profileId = stepResult.profile_id;
                }

                // Update final score from score step
                if (step === 'score' && stepResult.score !== undefined) {
                    results.finalScore = stepResult.score;
                }

                // Log step completion
                jobInspector.logStep(key, `step-${step}-complete`, {
                    stepName: step,
                    success: true,
                    result: stepResult,
                    profileId: results.profileId
                });

                // Step-by-step comments removed - will add comprehensive comment at the end
                if (process.env.JOB_DRY_RUN === 'true') {
                    logger.info(`🧪 DRY-RUN: Step ${step} completed for ${key}`);
                }

                // Check if we should continue based on step results
                if (step === 'check_compatibility' && stepResult.compatibility && !stepResult.compatibility.passed) {
                    logger.info(`Candidate ${key} failed compatibility check, stopping processing`);
                    jobInspector.logStep(key, 'processing-stopped', {
                        reason: 'failed-compatibility',
                        compatibility: stepResult.compatibility
                    });
                    shouldContinue = false;
                }

            } catch (error) {
                logger.warn(`Step ${step} failed for candidate ${key}:`, error.message);
                
                results.steps.push({
                    step,
                    success: false,
                    error: error.message
                });

                // Log step failure
                jobInspector.logStep(key, `step-${step}-failed`, {
                    stepName: step,
                    success: false,
                    error: error.message
                });

                // Step-by-step failure comments removed - will add comprehensive comment at the end
                if (process.env.JOB_DRY_RUN === 'true') {
                    logger.info(`🧪 DRY-RUN: Step ${step} failed for ${key}: ${error.message}`);
                }

                // Stop processing on critical failures
                if (step === 'verify' || step === 'ingest') {
                    jobInspector.logStep(key, 'processing-stopped', {
                        reason: `critical-failure-${step}`,
                        error: error.message
                    });
                    shouldContinue = false;
                }
            }
        }

        // Update Jira with final processing status
        await this.updateJiraWithResults(key, results, candidate);

        // Log candidate processing completion
        const successful = results.steps.filter(s => s.success).length;
        const failed = results.steps.filter(s => !s.success).length;
        
        jobInspector.logCandidateComplete(key, {
            success: successful > 0 && failed === 0,
            stepsSuceeded: successful,
            stepsFailed: failed,
            finalScore: results.finalScore,
            profileId: results.profileId
        });

        logger.info(`Completed processing candidate ${key}`);
        return results;
    }

    /**
     * Execute a single processing step
     * @param {string} step - Step name
     * @param {Object} params - Step parameters
     */
    async executeProcessingStep(step, params) {
        const { candidateKey, linkedinUrl, profileId } = params;

        switch (step) {
            case 'verify':
                return await this.verifyLinkedInUrl(linkedinUrl);
                
            case 'ingest':
                return await this.ingestProfile(linkedinUrl);
                
            case 'check_compatibility':
                if (!profileId) {
                    throw new Error('Profile ID required for compatibility check');
                }
                return await this.checkCompatibility(profileId);
                
            case 'score':
                if (!profileId) {
                    throw new Error('Profile ID required for scoring');
                }
                return await this.scoreProfile(profileId);
                
            default:
                throw new Error(`Unknown processing step: ${step}`);
        }
    }

    /**
     * Normalize LinkedIn URL to fix common format issues
     */
    normalizeLinkedInUrl(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }
        
        let normalized = url.trim();
        
        // Handle common format issues:
        // linkedin.com/in/username -> https://www.linkedin.com/in/username
        // http://linkedin.com/in/username -> https://www.linkedin.com/in/username
        // www.linkedin.com/in/username -> https://www.linkedin.com/in/username
        // https://linkedin.com/in/username -> https://www.linkedin.com/in/username
        
        // Remove any existing protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        
        // Remove www. if present (we'll add it back)
        normalized = normalized.replace(/^www\./, '');
        
        // Ensure it starts with linkedin.com
        if (!normalized.startsWith('linkedin.com')) {
            // If it doesn't start with linkedin.com, return original URL unchanged
            return url;
        }
        
        // Add the full prefix
        normalized = 'https://www.' + normalized;
        
        return normalized;
    }

    /**
     * Verify LinkedIn URL
     */
    async verifyLinkedInUrl(linkedinUrl) {
        try {
            // Normalize the URL first to fix common format issues
            const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
            
            if (normalizedUrl !== linkedinUrl) {
                logger.info(`Normalized LinkedIn URL: '${linkedinUrl}' -> '${normalizedUrl}'`);
            }
            
            const response = await apiClient.post('/profiles/verify', {
                linkedin_url: normalizedUrl
            });
            
            return {
                valid: response.data.verified || false,
                message: response.data.error || 'URL verified',
                profile_data: response.data.profile_data,
                executive_indicators: response.data.executive_indicators
            };
        } catch (error) {
            if (error.response?.status === 422) {
                throw new Error(`Invalid LinkedIn URL: ${error.response.data?.detail || 'Format error'}`);
            }
            throw new Error(`Verification failed: ${error.message}`);
        }
    }

    /**
     * Ingest profile data
     */
    async ingestProfile(linkedinUrl) {
        try {
            // Normalize the URL first to ensure consistency
            const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
            
            // First check if profile already exists
            const existingResponse = await apiClient.get('/profiles', {
                params: { linkedin_url: normalizedUrl }
            });

            if (existingResponse.data?.data?.length > 0) {
                const existingProfile = existingResponse.data.data[0];
                return {
                    profile_id: existingProfile.id,
                    message: 'Profile already exists, skipping ingestion',
                    skipped: true
                };
            }

            // Ingest new profile - use normalized URL and General for initial ingestion to let compatibility determine best role
            const response = await apiClient.post('/profiles', {
                linkedin_url: normalizedUrl,
                suggested_role: 'CTO' // Will be updated after compatibility check determines best fit
            });

            return {
                profile_id: response.data.id,
                message: 'Profile ingested successfully'
            };
        } catch (error) {
            if (error.response?.status === 422) {
                throw new Error(`Ingestion validation error: ${error.response.data?.detail || 'Invalid data'}`);
            }
            throw new Error(`Ingestion failed: ${error.message}`);
        }
    }

    /**
     * Check role compatibility against all three roles
     */
    async checkCompatibility(profileId) {
        const roles = ['CIO', 'CTO', 'CISO'];
        const compatibilityResults = [];
        let bestRole = null;
        let overallPassed = false;
        
        try {
            // Test compatibility against all three roles
            for (const role of roles) {
                try {
                    logger.info(`Checking compatibility for role: ${role}`);
                    
                    const response = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                        target_roles: [role],
                        fast_screening: true
                    });
                    
                    const roleResult = {
                        role: role,
                        passed: response.data.proceed_with_scoring || false,
                        reason: response.data.overall_assessment || `${role} compatibility check completed`
                    };
                    
                    compatibilityResults.push(roleResult);
                    
                    // If this role passes and we don't have a best role yet, set it
                    if (roleResult.passed && !bestRole) {
                        bestRole = role;
                        overallPassed = true;
                    }
                    
                    // Small delay between API calls
                    await this.sleep(500);
                    
                } catch (roleError) {
                    // Distinguish between service errors (404, 500, network) and legitimate rejections
                    if (roleError.response?.status === 404) {
                        logger.warn(`Scoring service not found for role ${role} - treating as service error`);
                        compatibilityResults.push({
                            role: role,
                            passed: null, // Unknown due to service error, not false
                            reason: `Scoring service unavailable for ${role} role check (404 error)`
                        });
                    } else if (roleError.response?.status >= 500) {
                        logger.warn(`Server error checking compatibility for role ${role}:`, roleError.message);
                        compatibilityResults.push({
                            role: role,
                            passed: null, // Unknown due to service error, not false
                            reason: `Service temporarily unavailable for ${role} role check (server error)`
                        });
                    } else if (roleError.code === 'ECONNREFUSED' || roleError.code === 'ETIMEDOUT') {
                        logger.warn(`Network error checking compatibility for role ${role}:`, roleError.message);
                        compatibilityResults.push({
                            role: role,
                            passed: null, // Unknown due to network error, not false
                            reason: `Network error during ${role} role check - service may be down`
                        });
                    } else {
                        // These are likely legitimate validation or business logic errors
                        logger.warn(`Failed to check compatibility for role ${role}:`, roleError.message);
                        compatibilityResults.push({
                            role: role,
                            passed: false,
                            reason: `${role} check failed: ${roleError.message}`
                        });
                    }
                }
            }
            
            // Get the best role from the latest API result (not first-match logic)
            let finalBestRole = bestRole; // Fallback to first-match
            if (overallPassed) {
                try {
                    const latestResponse = await apiClient.get(`/profiles/${profileId}/role-compatibility/latest`);
                    if (latestResponse.data && latestResponse.data.recommended_primary_role) {
                        finalBestRole = latestResponse.data.recommended_primary_role;
                        logger.info(`Using API-recommended best role: ${finalBestRole} (confidence: ${latestResponse.data.confidence_score})`);
                    }
                } catch (error) {
                    logger.warn('Could not fetch final best role from API, using first-match logic');
                }
            }
            
            // Build detailed results with proper handling of service errors
            const serviceErrors = compatibilityResults.filter(r => r.passed === null);
            const successfulChecks = compatibilityResults.filter(r => r.passed !== null);
            
            let finalReason;
            let finalStatus;
            
            if (serviceErrors.length === compatibilityResults.length) {
                // All checks failed due to service errors
                finalStatus = null; // Unknown status due to service issues
                finalReason = 'Unable to complete compatibility check due to service errors - manual review required';
            } else if (serviceErrors.length > 0 && overallPassed) {
                // Some service errors but at least one role passed
                finalStatus = overallPassed;
                finalReason = `Candidate is compatible with ${finalBestRole} role (${serviceErrors.length} role(s) had service errors)`;
            } else if (serviceErrors.length > 0 && !overallPassed) {
                // Some service errors and no definitive passes - inconclusive
                finalStatus = null; // Inconclusive due to service errors
                finalReason = `Compatibility check inconclusive - ${serviceErrors.length} role(s) had service errors, remaining roles showed no compatibility`;
            } else {
                // No service errors - use standard logic
                finalStatus = overallPassed;
                finalReason = overallPassed 
                    ? `Candidate is compatible with ${finalBestRole} role` 
                    : 'Candidate is not compatible with any executive role (CIO, CTO, CISO)';
            }
            
            const compatibility = {
                passed: finalStatus,
                bestRole: finalBestRole, // Use API-recommended role, not first-match
                reason: finalReason,
                roleResults: compatibilityResults,
                serviceErrors: serviceErrors.length,
                successfulChecks: successfulChecks.length
            };
            
            logger.info(`Compatibility check completed for profile ${profileId}:`, {
                passed: overallPassed,
                bestRole: finalBestRole,
                testedRoles: roles.length
            });
            
            return { compatibility };
            
        } catch (error) {
            throw new Error(`Compatibility check failed: ${error.message}`);
        }
    }

    /**
     * Score profile for a specific role
     * @param {string} profileId - Profile ID to score
     * @param {string} role - Role to score for (CIO, CTO, CISO)
     */
    async scoreProfile(profileId, role = null) {
        try {
            // Backend automatically detects role from compatibility data
            // If no compatibility data exists, defaults to CIO template
            const response = await apiClient.post(`/profiles/${profileId}/score-template`, {});
            const jobId = response.data.job_id;

            if (!jobId) {
                throw new Error('No job ID returned from scoring request');
            }

            logger.info(`Scoring job created: ${jobId}, now polling for completion...`);

            // Poll the scoring job until completion
            const maxAttempts = 60; // 5 minutes max (5 second intervals)
            let attempts = 0;
            
            while (attempts < maxAttempts) {
                try {
                    const jobResponse = await apiClient.get(`/scoring-jobs/${jobId}`);
                    const jobData = jobResponse.data;

                    logger.info(`Polling scoring job ${jobId}, status: ${jobData.status}, attempt: ${attempts + 1}`);

                    if (jobData.status === 'completed') {
                        // Get the actual role from latest compatibility result
                        let actualRole = role || 'Auto-detected';
                        try {
                            const compatibilityResponse = await apiClient.get(`/profiles/${profileId}/role-compatibility/latest`);
                            actualRole = compatibilityResponse.data.recommended_primary_role || actualRole;
                        } catch (compatError) {
                            console.warn('Could not fetch latest role compatibility for accurate role detection:', compatError.message);
                        }

                        const finalScore = jobData.result?.llm_response?.parsed_score?.total_score || 0;
                        
                        // Debug scoring API response
                        logger.info(`🔍 DEBUG Scoring API Response:`, {
                            jobId,
                            status: jobData.status,
                            result: jobData.result,
                            llm_response: jobData.result?.llm_response,
                            parsed_score: jobData.result?.llm_response?.parsed_score,
                            extracted_score: finalScore
                        });
                        
                        logger.info(`✅ Scoring completed! Job: ${jobId}, Score: ${finalScore}, Role: ${actualRole}`);

                        return {
                            score: finalScore,
                            job_id: jobId,
                            role: actualRole,
                            message: `Scoring completed successfully with score ${finalScore}`
                        };
                    } else if (jobData.status === 'failed') {
                        throw new Error(`Scoring job failed: ${jobData.error_message || 'Unknown error'}`);
                    }

                    // Job is still pending/in_progress, wait and retry
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                    attempts++;
                } catch (jobError) {
                    if (jobError.response?.status === 404) {
                        throw new Error(`Scoring job ${jobId} not found`);
                    }
                    throw jobError;
                }
            }

            throw new Error(`Scoring job ${jobId} timed out after ${maxAttempts * 5} seconds`);
        } catch (error) {
            throw new Error(`Scoring failed: ${error.message}`);
        }
    }

    /**
     * Helper to get the best role from processing results
     * @param {Object} results - Processing results so far
     * @returns {string|null} Best role or null if not determined yet
     */
    getBestRoleFromResults(results) {
        if (!results.steps) return null;
        
        const compatibilityStep = results.steps.find(s => 
            s.step === 'check_compatibility' && s.success && s.compatibility
        );
        
        return compatibilityStep?.compatibility?.bestRole || null;
    }

    /**
     * Update Jira with final processing results
     * @param {string} candidateKey - Jira candidate key
     * @param {Object} results - Processing results
     */
    async updateJiraWithResults(candidateKey, results, candidate) {
        try {
            const { steps, finalScore, profileId } = results;
            
            // Get fresh compatibility data (not step data which may be stale)
            let latestCompatibility = null;
            if (profileId) {
                try {
                    const compatResponse = await apiClient.get(`/profiles/${profileId}/role-compatibility/latest`);
                    latestCompatibility = compatResponse.data;
                } catch (error) {
                    console.warn('Could not fetch latest compatibility data for JIRA comment:', error.message);
                }
            }
            
            // Determine final fit status
            let fitStatus = 'Unscored';
            let fitScore = 0;
            
            const compatibilityStep = steps.find(s => s.step === 'check_compatibility' && s.success);
            const scoreStep = steps.find(s => s.step === 'score' && s.success);
            
            if (compatibilityStep && compatibilityStep.compatibility) {
                if (compatibilityStep.compatibility.passed === null) {
                    // Service errors occurred - manual review needed
                    fitStatus = 'Requires Manual Review';
                    fitScore = 0;
                } else if (!compatibilityStep.compatibility.passed) {
                    // Legitimate rejection after successful compatibility check
                    fitStatus = 'No Fit';
                    fitScore = 0;
                } else if (scoreStep && scoreStep.score !== undefined) {
                    fitStatus = 'Scored';
                    fitScore = scoreStep.score;
                }
            }

            // Build comprehensive comment using fresh compatibility data
            const comprehensiveComment = this.buildComprehensiveComment(
                candidate, 
                steps, 
                compatibilityStep, 
                scoreStep, 
                fitStatus, 
                fitScore, 
                profileId,
                latestCompatibility
            );

            // Update Jira with processing status and profile ID (skip in dry-run mode)
            if (process.env.JOB_DRY_RUN !== 'true') {
                // First update the profile ID if we have one (critical for deduplication)
                if (profileId) {
                    try {
                        await apiClient.put(`/jira/candidates/${candidateKey}/fields`, {
                            fields: [
                                {
                                    field_id: 'customfield_11535', // CAN-LI Profile ID field
                                    value: profileId
                                }
                            ]
                        });
                        logger.info(`Updated ${candidateKey} with profile ID: ${profileId}`);
                    } catch (error) {
                        logger.error(`Failed to update profile ID for ${candidateKey}:`, error.message);
                        // Continue processing even if profile ID update fails
                    }
                }
                
                // Then update processing status and add comment
                await apiClient.put(`/jira/candidates/${candidateKey}/fields`, {
                    fields: [
                        {
                            field_id: 'customfield_11635', // FIT Score
                            value: fitScore
                        },
                        {
                            field_id: 'customfield_11634', // FIT Status  
                            value: { id: fitStatus === 'Scored' ? '11029' : (fitStatus === 'No Fit' ? '11028' : '11027') }
                        }
                    ]
                });
                
                // Add comprehensive processing comment
                await apiClient.post(`/jira/candidates/${candidateKey}/comments`, {
                    comment_body: comprehensiveComment
                });
            } else {
                logger.info(`🧪 DRY-RUN: Would update Jira for ${candidateKey} with profile ID: ${profileId}, status ${fitStatus} and comment:\n${comprehensiveComment}`);
            }

        } catch (error) {
            logger.error(`Failed to update Jira for candidate ${candidateKey}:`, error);
            // Don't throw here - we don't want to fail the whole job for a Jira update issue
        }
    }

    /**
     * Build a comprehensive comment for Jira
     * @param {Object} candidate - Candidate information
     * @param {Array} steps - Processing steps results
     * @param {Object} compatibilityStep - Compatibility step result
     * @param {Object} scoreStep - Score step result
     * @param {string} fitStatus - Final fit status
     * @param {number} fitScore - Final fit score
     * @param {string} profileId - Profile ID
     * @returns {string} Formatted comment
     */
    buildComprehensiveComment(candidate, steps, compatibilityStep, scoreStep, fitStatus, fitScore, profileId, latestCompatibility = null) {
        const { fullName, linkedinUrl } = candidate;
        const successful = steps.filter(s => s.success).length;
        const failed = steps.filter(s => !s.success).length;
        const processingTime = Date.now();
        const processingDate = new Date(processingTime).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        // Determine if processing was successful or failed
        const isSuccess = successful === steps.length;
        const isPartialSuccess = successful > 0 && failed > 0;
        const isFailure = successful === 0;
        
        let comment = '';
        
        if (isSuccess) {
            comment += '🤖 *Automated LinkedIn Processing - Complete*\n\n';
        } else if (isPartialSuccess) {
            comment += '🤖 *Automated LinkedIn Processing - Partial*\n\n';
        } else {
            comment += '🤖 *Automated LinkedIn Processing - Failed*\n\n';
        }
        
        // Basic information
        comment += `*Candidate:* ${fullName}\n`;
        comment += `*LinkedIn:* ${linkedinUrl}\n`;
        comment += `*Processed:* ${processingDate}\n`;
        
        if (profileId) {
            comment += `*Profile ID:* #${profileId}\n`;
        }
        
        comment += '\n*Results:*\n';
        
        // Step results
        const stepMap = {
            'verify': 'LinkedIn URL verified and accessible',
            'ingest': 'Profile data extracted and stored',
            'check_compatibility': 'Role compatibility assessed', 
            'score': 'Candidate scored successfully'
        };
        
        steps.forEach(step => {
            const status = step.success ? '✅' : '❌';
            const description = stepMap[step.step] || step.step;
            comment += `${status} ${description}\n`;
            
            // Add error details for failed steps
            if (!step.success && step.error) {
                comment += `   └── ${step.error}\n`;
            }
        });
        
        // Handle different scenarios
        if (isSuccess && compatibilityStep && scoreStep) {
            // Full success with compatibility and scoring
            comment += '\n*Compatibility Results:*\n';
            
            // Use fresh compatibility data if available, fallback to step data
            const compatibilityData = latestCompatibility || compatibilityStep.compatibility;
            const actualRole = scoreStep?.role || latestCompatibility?.recommended_primary_role || compatibilityStep.compatibility?.bestRole || 'Unknown';
            
            if (latestCompatibility && latestCompatibility.compatible_roles) {
                // Use fresh compatibility data from API
                latestCompatibility.compatible_roles.forEach(role => {
                    const status = role.compatible ? '✅ Compatible' : '❌ Not Compatible';
                    const confidence = Math.round(role.confidence * 100);
                    const bestMatch = latestCompatibility.recommended_primary_role === role.role ? ' (Best Match)' : '';
                    comment += `• ${role.role}: ${status} (${confidence}% confidence)${bestMatch}\n`;
                });
            } else if (compatibilityStep.compatibility && compatibilityStep.compatibility.roleResults) {
                // Fallback to step data if fresh data not available
                compatibilityStep.compatibility.roleResults.forEach(role => {
                    const status = role.passed ? '✅ Compatible' : '❌ Not Compatible';
                    const bestMatch = compatibilityStep.compatibility.bestRole === role.role ? ' (Best Match)' : '';
                    comment += `• ${role.role}: ${status}${bestMatch}\n`;
                });
            }
            
            comment += `\n*Final Score:* ${fitScore}/100 (${actualRole} Role)\n`;
            comment += `*Status:* Ready for ${actualRole} interview consideration\n`;
            comment += '\n---\n';
            comment += '*Next Steps:* Review candidate profile and schedule interview';
            
        } else if (compatibilityStep && compatibilityStep.compatibility.passed === null) {
            // Service errors during compatibility check
            comment += '\n*Compatibility Results:*\n';
            
            // Use fresh compatibility data if available, fallback to step data
            if (latestCompatibility && latestCompatibility.compatible_roles) {
                // Use fresh compatibility data from API
                latestCompatibility.compatible_roles.forEach(role => {
                    const status = role.compatible ? '✅ Compatible' : '❌ Not Compatible';
                    const confidence = Math.round(role.confidence * 100);
                    comment += `• ${role.role}: ${status} (${confidence}% confidence)\n`;
                });
            } else if (compatibilityStep.compatibility && compatibilityStep.compatibility.roleResults) {
                compatibilityStep.compatibility.roleResults.forEach(role => {
                    if (role.passed === null) {
                        comment += `• ${role.role}: ⚠️ ${role.reason || 'Service error'}\n`;
                    } else {
                        const status = role.passed ? '✅ Compatible' : '❌ Not Compatible';
                        comment += `• ${role.role}: ${status}\n`;
                    }
                });
            }
            
            comment += '\n*Final Score:* Unable to determine due to service errors\n';
            comment += '*Status:* Requires manual review - scoring services unavailable\n';
            comment += '\n---\n';
            comment += '*Next Steps:* Manual compatibility assessment required due to technical issues';
            
        } else if (compatibilityStep && !compatibilityStep.compatibility.passed) {
            // Legitimate failed compatibility (after successful service calls)
            comment += '\n*Compatibility Results:*\n';
            
            // Use fresh compatibility data if available, fallback to step data
            if (latestCompatibility && latestCompatibility.compatible_roles) {
                // Use fresh compatibility data from API
                latestCompatibility.compatible_roles.forEach(role => {
                    const status = role.compatible ? '✅ Compatible' : '❌ Not Compatible';
                    const confidence = Math.round(role.confidence * 100);
                    const reasoning = role.reasoning || 'No detailed reasoning available';
                    comment += `• ${role.role}: ${status} (${confidence}% confidence) - ${reasoning}\n`;
                });
            } else if (compatibilityStep.compatibility && compatibilityStep.compatibility.roleResults) {
                compatibilityStep.compatibility.roleResults.forEach(role => {
                    if (role.passed === null) {
                        comment += `• ${role.role}: ⚠️ ${role.reason || 'Service error'}\n`;
                    } else {
                        comment += `• ${role.role}: ❌ ${role.reason || 'Not compatible'}\n`;
                    }
                });
            }
            
            comment += '\n*Final Score:* Not applicable\n';
            comment += '*Status:* No fit for executive roles\n';
            comment += '\n---\n';
            comment += '*Next Steps:* Consider for non-executive positions or archive';
            
        } else if (isFailure) {
            // Complete failure
            const firstFailedStep = steps.find(s => !s.success);
            comment += '\n*Error Details:*\n';
            
            if (firstFailedStep) {
                if (firstFailedStep.step === 'verify') {
                    comment += 'LinkedIn profile not accessible - may be private, deleted, or invalid URL\n';
                } else if (firstFailedStep.step === 'ingest') {
                    comment += 'Failed to extract profile data - LinkedIn may be blocking access\n';
                } else {
                    comment += `${firstFailedStep.error || 'Processing failed'}\n`;
                }
            }
            
            comment += '\n*Status:* Processing incomplete - manual review needed\n';
            comment += '\n---\n';
            comment += '*Next Steps:* Verify LinkedIn URL manually or request updated profile link';
            
        } else {
            // Partial success or other scenarios
            comment += `\n*Status:* ${fitStatus}\n`;
            comment += '\n---\n';
            comment += '*Next Steps:* Review processing results and determine next action';
        }
        
        return comment;
    }

    /**
     * Process a single candidate from the UI (frontend buttons)
     * @param {string} candidateKey - The candidate key (e.g. 'CAN-4230')
     * @returns {Promise<Object>} Job tracking information
     */
    async processSingleCandidateFromUI(candidateKey) {
        const jobExecutionId = `ui-${candidateKey}-${Date.now()}`;
        const startTime = Date.now();
        
        logger.info(`🎯 UI Processing: Starting sequential candidate processing for ${candidateKey}`, {
            executionId: jobExecutionId,
            type: 'ui-initiated-sequential'
        });

        try {
            // Get candidate data from backend JIRA proxy (not direct JIRA client)
            const apiClient = require('../config/api');
            const response = await apiClient.get(`/jira/candidates/${candidateKey}`);
            const candidate = response.data;

            if (!candidate) {
                throw new Error(`Candidate ${candidateKey} not found in Jira`);
            }

            // Extract LinkedIn URL from JIRA fields
            const linkedinUrl = candidate.fields?.customfield_10400 || candidate.fields?.customfield_11408;
            if (!linkedinUrl) {
                throw new Error(`Candidate ${candidateKey} has no LinkedIn URL`);
            }

            // Transform to match expected format
            const candidateData = {
                key: candidate.key,
                fullName: [candidate.fields?.customfield_10302, candidate.fields?.customfield_10303].filter(Boolean).join(' ') || candidate.summary,
                linkedinUrl: linkedinUrl,
                firstName: candidate.fields?.customfield_10302,
                lastName: candidate.fields?.customfield_10303,
                email: candidate.fields?.customfield_10304,
                phone: candidate.fields?.customfield_10305,
                region: candidate.fields?.customfield_10306
            };

            // Emit WebSocket update for UI
            const jobScheduler = require('./jobScheduler');
            if (jobScheduler.io) {
                jobScheduler.io.emit('candidate-processing-start', {
                    candidateKey,
                    executionId: jobExecutionId,
                    candidateName: candidateData.fullName,
                    status: 'starting',
                    timestamp: new Date().toISOString()
                });
            }

            // Use the NEW sequential processor for guaranteed step-by-step execution
            const CandidateSequentialProcessor = require('./candidateSequentialProcessor');
            const processor = new CandidateSequentialProcessor();
            const result = await processor.processCandidate(candidateData);

            const duration = Date.now() - startTime;

            // Emit completion WebSocket update
            if (jobScheduler.io) {
                jobScheduler.io.emit('candidate-processing-complete', {
                    candidateKey,
                    executionId: jobExecutionId,
                    candidateName: candidateData.fullName || result.fullName,
                    status: 'completed',
                    success: result.success,
                    results: result,
                    duration,
                    timestamp: new Date().toISOString()
                });
            }

            logger.info(`🎯 UI Processing: Completed sequential processing ${candidateKey} in ${duration}ms`, {
                executionId: jobExecutionId,
                success: result.success,
                completedSteps: result.completedSteps,
                totalSteps: result.steps.length,
                finalScore: result.finalScore
            });

            return {
                success: result.success,
                executionId: jobExecutionId,
                candidateKey,
                candidateName: candidateData.fullName || result.fullName,
                duration,
                result
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error(`🎯 UI Processing: Failed processing ${candidateKey}`, {
                executionId: jobExecutionId,
                error: error.message,
                duration
            });

            // Emit failure WebSocket update
            const jobScheduler = require('./jobScheduler');
            if (jobScheduler.io) {
                jobScheduler.io.emit('candidate-processing-error', {
                    candidateKey,
                    executionId: jobExecutionId,
                    candidateName: candidateKey, // Fallback to key if name not available during error
                    status: 'failed',
                    error: error.message,
                    duration,
                    timestamp: new Date().toISOString()
                });
            }

            return {
                success: false,
                executionId: jobExecutionId,
                candidateKey,
                error: error.message,
                duration
            };
        }
    }

    /**
     * Utility method to sleep
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the candidate processing jobs
const candidateProcessingJob = new CandidateProcessingJob();

module.exports = candidateProcessingJob;
