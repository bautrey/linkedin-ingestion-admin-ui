const apiClient = require('../config/api');
const logger = require('../utils/logger');
const jobInspector = require('../utils/jobInspector');
const jiraClient = require('../config/jira');

/**
 * Sequential Candidate Processor
 * Ensures each processing step completes fully before the next begins
 * Includes timeouts, error handling, and detailed progress tracking
 */
class CandidateSequentialProcessor {
    constructor() {
        // Verify dependencies are loaded
        logger.info('🔧 Initializing CandidateSequentialProcessor', {
            hasApiClient: !!apiClient,
            hasLogger: !!logger,
            hasJobInspector: !!jobInspector,
            hasJiraClient: !!jiraClient,
            jiraClientType: typeof jiraClient
        });
        
        this.STEP_TIMEOUT = 120000; // 2 minutes per step
        this.MAX_RETRIES = 2;
        this.RETRY_DELAY = 3000; // 3 seconds between retries
        
        this.steps = [
            { name: 'verify', displayName: 'Verify LinkedIn URL', timeout: 30000 }, // 30s for verification
            { name: 'ingest', displayName: 'Ingest Profile Data', timeout: 60000 }, // 60s for ingestion
            { name: 'check_compatibility', displayName: 'Check Role Compatibility', timeout: 90000 }, // 90s for compatibility
            { name: 'score', displayName: 'Score Candidate', timeout: 60000 }, // 60s for scoring
            { name: 'update_jira', displayName: 'Update JIRA', timeout: 30000 } // 30s for JIRA update
        ];
    }

    /**
     * Process a single candidate with strict sequential execution
     */
    async processCandidate(candidateData) {
        const { key: candidateKey, linkedinUrl, fullName } = candidateData;
        const processingId = `seq-${candidateKey}-${Date.now()}`;
        
        logger.info(`🔄 Sequential Processing: Starting ${candidateKey} (${fullName})`, {
            processingId,
            candidateKey,
            stepCount: this.steps.length
        });

        // Log candidate processing start
        jobInspector.logCandidateStart(candidateKey, {
            fullName,
            linkedinUrl,
            processingSteps: this.steps.map(s => s.name),
            processingType: 'sequential',
            processingId
        });

        const results = {
            processingId,
            candidateKey,
            fullName,
            steps: [],
            profileId: null,
            finalScore: null,
            success: false,
            completedSteps: 0,
            failedStep: null,
            totalDuration: 0
        };

        const overallStartTime = Date.now();
        let shouldContinue = true;

        try {
            for (let i = 0; i < this.steps.length && shouldContinue; i++) {
                const step = this.steps[i];
                const stepStartTime = Date.now();
                
                logger.info(`🚀 Step ${i + 1}/${this.steps.length}: ${step.displayName}`, {
                    processingId,
                    candidateKey,
                    step: step.name,
                    timeout: step.timeout
                });

                // Log step start
                jobInspector.logStep(candidateKey, `step-${step.name}-start`, {
                    stepName: step.name,
                    stepDisplayName: step.displayName,
                    stepNumber: i + 1,
                    totalSteps: this.steps.length,
                    linkedinUrl: (step.name === 'verify' || step.name === 'ingest') ? linkedinUrl : undefined,
                    profileId: (step.name === 'check_compatibility' || step.name === 'score') ? results.profileId : undefined,
                    processingId
                }, 'start');

                try {
                    // Execute step with timeout
                    const stepResult = await this.executeStepWithTimeout(step, {
                        candidateKey,
                        linkedinUrl,
                        profileId: results.profileId,
                        fullName,
                        results,
                        processingId
                    });

                    const stepDuration = Date.now() - stepStartTime;

                    // Record successful step
                    const stepRecord = {
                        name: step.name,
                        displayName: step.displayName,
                        success: true,
                        duration: stepDuration,
                        result: stepResult,
                        timestamp: new Date().toISOString()
                    };

                    results.steps.push(stepRecord);
                    results.completedSteps = i + 1;

                    // Extract important data from step results
                    if (step.name === 'ingest' && stepResult.profile_id) {
                        results.profileId = stepResult.profile_id;
                        logger.info(`✅ Profile ID obtained: ${results.profileId}`, { processingId, candidateKey });
                    }

                    if (step.name === 'score' && stepResult.score !== undefined) {
                        results.finalScore = stepResult.score;
                        results.scoringJobId = stepResult.job_id; // Store job ID for JIRA update
                        logger.info(`✅ Final score obtained: ${results.finalScore}, Job ID: ${results.scoringJobId}`, { processingId, candidateKey });
                    }

                    // Log successful step completion
                    jobInspector.logStep(candidateKey, `step-${step.name}-complete`, {
                        stepName: step.name,
                        stepDisplayName: step.displayName,
                        stepNumber: i + 1,
                        success: true,
                        duration: stepDuration,
                        result: stepResult,
                        profileId: results.profileId,
                        processingId
                    }, 'success');

                    logger.info(`✅ Step ${i + 1}/${this.steps.length} completed: ${step.displayName} (${stepDuration}ms)`, {
                        processingId,
                        candidateKey,
                        step: step.name,
                        success: true
                    });

                    // Store processing step in database history
                    await jobInspector.storeProcessingHistory(
                        candidateKey,
                        step.name,
                        'success',
                        {
                            stepDisplayName: step.displayName,
                            stepNumber: i + 1,
                            totalSteps: this.steps.length,
                            result: stepResult,
                            processingId
                        },
                        stepDuration,
                        results.profileId
                    );

                    // Check if we should continue based on step results
                    
                    // Stop processing if verify step failed
                    if (step.name === 'verify' && stepResult && !stepResult.valid) {
                        logger.info(`🛑 Verification failed - stopping all processing`, {
                            processingId,
                            candidateKey,
                            verifyResult: stepResult
                        });
                        
                        jobInspector.logStep(candidateKey, 'processing-stopped', {
                            reason: 'verification-failed',
                            verifyResult: stepResult,
                            processingId
                        });
                        
                        shouldContinue = false;
                    }
                    
                    // Check compatibility recommendation to proceed with scoring
                    if (step.name === 'check_compatibility' && stepResult) {
                        logger.info(`🔍 DEBUG: Compatibility step result structure`, {
                            processingId,
                            candidateKey,
                            compatibility: stepResult,
                            hasProceedWithScoring: 'proceed_with_scoring' in stepResult,
                            proceedValue: stepResult.proceed_with_scoring
                        });
                        
                        const shouldProceed = stepResult.proceed_with_scoring;
                        
                        if (!shouldProceed) {
                            logger.info(`🛑 Compatibility check recommends stopping - no scoring will be performed`, {
                                processingId,
                                candidateKey,
                                compatibility: stepResult,
                                reason: 'No role met threshold for scoring'
                            });
                            
                            jobInspector.logStep(candidateKey, 'processing-stopped', {
                                reason: 'compatibility-recommends-no-scoring',
                                compatibility: stepResult,
                                processingId
                            });
                            
                            // Skip scoring step but continue to JIRA update
                            results.compatibilityStoppedScoring = true;
                            if (i < this.steps.length - 1 && this.steps[i + 1].name === 'score') {
                                shouldContinue = false;
                            }
                        }
                    }

                    // Wait a moment between steps to ensure proper sequencing
                    if (shouldContinue && i < this.steps.length - 1) {
                        await this.sleep(1000); // 1 second between steps
                    }

                } catch (error) {
                    const stepDuration = Date.now() - stepStartTime;
                    
                    logger.error(`❌ Step ${i + 1}/${this.steps.length} failed: ${step.displayName}`, {
                        processingId,
                        candidateKey,
                        step: step.name,
                        error: error.message,
                        duration: stepDuration
                    });

                    // Record failed step
                    const stepRecord = {
                        name: step.name,
                        displayName: step.displayName,
                        success: false,
                        duration: stepDuration,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };

                    results.steps.push(stepRecord);
                    results.failedStep = step.name;

                    // Log step failure
                    jobInspector.logStep(candidateKey, `step-${step.name}-failed`, {
                        stepName: step.name,
                        stepDisplayName: step.displayName,
                        stepNumber: i + 1,
                        success: false,
                        error: error.message,
                        duration: stepDuration,
                        processingId
                    }, 'error');

                    // Store failed step in database history
                    await jobInspector.storeProcessingHistory(
                        candidateKey,
                        step.name,
                        'error',
                        {
                            stepDisplayName: step.displayName,
                            stepNumber: i + 1,
                            totalSteps: this.steps.length,
                            error: error.message,
                            processingId
                        },
                        stepDuration,
                        results.profileId
                    );

                    // Stop processing on critical failures (verify/ingest)
                    if (step.name === 'verify' || step.name === 'ingest') {
                        logger.error(`🛑 Critical step failed - stopping processing`, {
                            processingId,
                            candidateKey,
                            failedStep: step.name
                        });
                        
                        jobInspector.logStep(candidateKey, 'processing-stopped', {
                            reason: `critical-failure-${step.name}`,
                            error: error.message,
                            processingId
                        });
                        
                        shouldContinue = false;
                    }
                    
                    // For non-critical steps, we can continue but mark as partial success
                    if (step.name === 'check_compatibility' || step.name === 'score') {
                        logger.warn(`⚠️ Non-critical step failed, continuing processing`, {
                            processingId,
                            candidateKey,
                            failedStep: step.name
                        });
                        // Continue to next step
                    }
                }
            }

            results.totalDuration = Date.now() - overallStartTime;
            results.success = results.completedSteps > 0 && !results.failedStep;

            // Log final completion
            jobInspector.logCandidateComplete(candidateKey, {
                success: results.success,
                stepsSuceeded: results.steps.filter(s => s.success).length,
                stepsFailed: results.steps.filter(s => !s.success).length,
                finalScore: results.finalScore,
                profileId: results.profileId,
                duration: results.totalDuration,
                processingId
            });

            // JIRA update is now handled as step 5 in the sequential process

            logger.info(`🏁 Sequential Processing Complete: ${candidateKey}`, {
                processingId,
                candidateKey,
                success: results.success,
                completedSteps: results.completedSteps,
                totalSteps: this.steps.length,
                duration: results.totalDuration,
                finalScore: results.finalScore
            });

            return results;

        } catch (error) {
            results.totalDuration = Date.now() - overallStartTime;
            results.success = false;
            
            logger.error(`💥 Sequential Processing Failed: ${candidateKey}`, {
                processingId,
                candidateKey,
                error: error.message,
                duration: results.totalDuration
            });

            jobInspector.logCandidateComplete(candidateKey, {
                success: false,
                error: error.message,
                duration: results.totalDuration,
                processingId
            });

            throw error;
        }
    }

    /**
     * Execute a step with timeout protection
     */
    async executeStepWithTimeout(step, params) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Step ${step.name} timed out after ${step.timeout}ms`));
            }, step.timeout);
        });

        const stepPromise = this.executeStep(step.name, params);

        return Promise.race([stepPromise, timeoutPromise]);
    }

    /**
     * Execute individual processing step
     */
    async executeStep(stepName, params) {
        const { candidateKey, linkedinUrl, profileId, fullName, results } = params;

        switch (stepName) {
            case 'verify':
                const verifyResult = await this.verifyLinkedInUrl(linkedinUrl);
                
                logger.info(`🔍 Verify step completed - checking conditions for JIRA update`, {
                    candidateKey,
                    hasVerifyResult: !!verifyResult,
                    verifyResultValid: verifyResult?.valid,
                    hasCandidateKey: !!candidateKey,
                    verifyResult: verifyResult
                });
                
                // Update JIRA with verification timestamp if successful
                if (verifyResult.valid && candidateKey) {
                    logger.info(`📝 Attempting JIRA update for verification timestamp`, {
                        candidateKey,
                        timestamp: new Date().toISOString()
                    });
                    
                    try {
                        const jiraUpdateResult = await jiraClient.updateCandidate(candidateKey, {
                            linkedinVerifiedDate: new Date().toISOString()
                        });
                        logger.info(`✅ Successfully updated JIRA verification timestamp for ${candidateKey}`, {
                            jiraUpdateResult
                        });
                    } catch (jiraError) {
                        logger.error(`❌ Failed to update JIRA verification timestamp for ${candidateKey}:`, {
                            error: jiraError.message,
                            stack: jiraError.stack
                        });
                        // Don't fail the verify step for JIRA issues
                    }
                } else {
                    logger.warn(`⚠️ Skipping JIRA update - conditions not met`, {
                        candidateKey,
                        verifyResultValid: verifyResult?.valid,
                        hasCandidateKey: !!candidateKey
                    });
                }
                
                return verifyResult;
                
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
                // Get recommended role from compatibility step results
                const compatibilityStep = results.steps?.find(s => s.name === 'check_compatibility');
                const recommendedRole = compatibilityStep?.result?.recommended_primary_role || 'CTO';
                
                logger.info(`🔗 Passing recommended role from compatibility step to scoring`, {
                    candidateKey,
                    recommendedRole,
                    compatibilityStepFound: !!compatibilityStep,
                    processingId: params.processingId
                });
                
                return await this.scoreProfile(profileId, recommendedRole);
                
            case 'update_jira':
                if (!candidateKey) {
                    throw new Error('Candidate key required for JIRA update');
                }
                return await this.updateJira(candidateKey, results);
                
            default:
                throw new Error(`Unknown processing step: ${stepName}`);
        }
    }

    /**
     * Verify LinkedIn URL
     */
    async verifyLinkedInUrl(linkedinUrl) {
        try {
            const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
            
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
            const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
            
            // Check if profile already exists
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

            // Ingest new profile
            const response = await apiClient.post('/profiles', {
                linkedin_url: normalizedUrl,
                target_role: 'General'
            });

            return {
                profile_id: response.data.profile_id,
                message: 'Profile ingested successfully'
            };
            
        } catch (error) {
            throw new Error(`Ingestion failed: ${error.response?.data?.detail || error.message}`);
        }
    }

    /**
     * Check role compatibility
     */
    async checkCompatibility(profileId) {
        // First check if we already have compatibility results
        try {
            const existingResponse = await apiClient.get(`/profiles/${profileId}/role-compatibility/latest`);
            
            if (existingResponse.data?.has_compatibility_results) {
                logger.info(`✅ Using existing compatibility results for profile ${profileId}`, {
                    recommended_role: existingResponse.data.recommended_primary_role,
                    proceed_with_scoring: existingResponse.data.proceed_with_scoring
                });
                
                return existingResponse.data;
            }
        } catch (error) {
            logger.info('No existing compatibility results found, running fresh check');
        }

        // Run fresh compatibility check if none exists
        logger.info(`🔍 Running fresh role compatibility check for profile ${profileId}`);
        
        try {
            // Run single compatibility check for all roles at once
            const response = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                target_roles: ['CTO', 'CIO', 'CISO'],
                fast_screening: true
            });
            
            return response.data;
            
        } catch (error) {
            logger.error(`Role compatibility check failed: ${error.message}`);
            
            return {
                proceed_with_scoring: false,
                recommended_primary_role: null,
                reason: `Compatibility check failed: ${error.message}`,
                compatible_roles: []
            };
        }
    }

    /**
     * Score profile for best role using async job polling pattern (copied from candidateProcessingJob.js)
     */
    async scoreProfile(profileId, recommendedRole = 'CTO') {
        try {
            const targetRole = recommendedRole;
            logger.info(`🎯 Scoring profile ${profileId} for ${targetRole} role`);

            // Backend automatically detects role from compatibility data
            // If no compatibility data exists, defaults to CIO template
            const response = await apiClient.post(`/profiles/${profileId}/score-template`, {});
            const jobId = response.data.job_id;

            if (!jobId) {
                throw new Error('No job ID returned from scoring request');
            }

            logger.info(`Scoring job created: ${jobId}, now polling for completion...`);

            // Poll the scoring job until completion (copied from candidateProcessingJob.js)
            const maxAttempts = 60; // 5 minutes max (5 second intervals)
            let attempts = 0;
            
            while (attempts < maxAttempts) {
                try {
                    const jobResponse = await apiClient.get(`/scoring-jobs/${jobId}`);
                    const jobData = jobResponse.data;

                    logger.info(`Polling scoring job ${jobId}, status: ${jobData.status}, attempt: ${attempts + 1}`);

                    if (jobData.status === 'completed') {
                        const finalScore = jobData.result?.parsed_score?.total_score || 0;
                        
                        // Debug scoring API response
                        logger.info(`🔍 DEBUG Scoring API Response:`, {
                            jobId,
                            status: jobData.status,
                            result: jobData.result,
                            llm_response: jobData.result?.llm_response,
                            parsed_score: jobData.result?.llm_response?.parsed_score,
                            extracted_score: finalScore
                        });
                        
                        logger.info(`✅ Scoring completed! Job: ${jobId}, Score: ${finalScore}, Role: ${targetRole}`);

                        return {
                            score: finalScore,
                            job_id: jobId,
                            role: targetRole,
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
     * Normalize LinkedIn URL
     */
    normalizeLinkedInUrl(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }
        
        let normalized = url.trim();
        
        // Remove any existing protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        
        // Remove www. if present
        normalized = normalized.replace(/^www\./, '');
        
        // Ensure it starts with linkedin.com
        if (!normalized.startsWith('linkedin.com')) {
            return url; // Return original if it doesn't look like a LinkedIn URL
        }
        
        // Add back the proper protocol and subdomain
        normalized = `https://www.${normalized}`;
        
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        
        return normalized;
    }

    /**
     * Build comprehensive comment for JIRA with processing results
     * @param {Object} candidate - Candidate data
     * @param {Array} steps - Processing steps
     * @param {Object} compatibilityStep - Compatibility step result
     * @param {Object} scoreStep - Score step result
     * @param {string} fitStatus - Final fit status
     * @param {number} fitScore - Final fit score
     * @param {string} profileId - Profile ID
     * @param {string} errorMessage - Error message if verification failed
     * @returns {string} Formatted comment
     */
    buildComprehensiveComment(candidate, steps, compatibilityStep, scoreStep, fitStatus, fitScore, profileId, errorMessage) {
        const { candidateKey, linkedinUrl } = candidate;
        const successful = steps.filter(s => s.success).length;
        const failed = steps.filter(s => !s.success).length;
        const processingDate = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        // Determine if processing was successful or failed
        const isSuccess = successful === steps.length;
        const isPartialSuccess = successful > 0 && failed > 0;
        
        let comment = '';
        
        if (isSuccess) {
            comment += '🤖 *Automated LinkedIn Processing - Complete*\n\n';
        } else if (isPartialSuccess) {
            comment += '🤖 *Automated LinkedIn Processing - Partial*\n\n';
        } else {
            comment += '🤖 *Automated LinkedIn Processing - Failed*\n\n';
        }
        
        // Basic information
        comment += `*Candidate:* ${candidateKey}\n`;
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
            const description = stepMap[step.name] || step.name;
            comment += `${status} ${description}\n`;
            
            // Add error details for failed steps
            if (!step.success && step.error) {
                comment += `   └── ${step.error}\n`;
            }
        });
        
        // Handle success scenario with compatibility and scoring
        if (isSuccess && compatibilityStep && scoreStep && fitStatus === 'Scored') {
            comment += '\n*Compatibility Assessment:*\n';
            
            const compatibility = compatibilityStep.result?.compatibility;
            const actualRole = scoreStep.result?.role || compatibility?.recommended_primary_role || 'Unknown';
            
            if (compatibility && compatibility.compatible_roles) {
                // Show overall assessment first
                if (compatibility.overall_assessment) {
                    comment += `${compatibility.overall_assessment}\n\n`;
                }
                
                // Show detailed role breakdown
                compatibility.compatible_roles.forEach(role => {
                    const status = role.compatible ? '✅ Compatible' : '❌ Not Compatible';
                    const isRecommended = compatibility.recommended_primary_role === role.role ? ' ⭐ *Recommended*' : '';
                    comment += `• *${role.role}*: ${status} (${Math.round(role.confidence * 100)}% confidence)${isRecommended}\n`;
                    
                    if (role.reasoning) {
                        comment += `   └── ${role.reasoning}\n`;
                    }
                    
                    // Show key qualifications for compatible roles
                    if (role.compatible && role.key_qualifications && role.key_qualifications.length > 0) {
                        comment += `   ✅ Key strengths: ${role.key_qualifications.slice(0, 2).join(', ')}\n`;
                    }
                    
                    // Show missing qualifications for incompatible roles
                    if (!role.compatible && role.missing_qualifications && role.missing_qualifications.length > 0) {
                        comment += `   ❌ Missing: ${role.missing_qualifications.slice(0, 2).join(', ')}\n`;
                    }
                    
                    comment += '\n';
                });
            }
            
            comment += `*Final Score:* ${fitScore}/100 (${actualRole} Role)\n`;
            comment += `*AI Model:* ${compatibility?.model_used || 'N/A'} (${compatibility?.ai_response_time ? Math.round(compatibility.ai_response_time) + 's' : 'N/A'})\n`;
            comment += `*Status:* Ready for ${actualRole} interview consideration\n`;
            comment += '\n---\n';
            comment += '*Next Steps:* Review candidate profile and schedule interview';
            
        } else if (compatibilityStep && compatibilityStep.result?.compatibility && (fitStatus === 'Unscored' || !scoreStep || !scoreStep.success)) {
            // We have compatibility data but scoring failed or didn't happen
            comment += '\n*Compatibility Assessment:*\n';
            
            const compatibility = compatibilityStep.result.compatibility;
            
            if (compatibility.overall_assessment) {
                comment += `${compatibility.overall_assessment}\n\n`;
            }
            
            // Show role breakdown
            if (compatibility.compatible_roles) {
                compatibility.compatible_roles.forEach(role => {
                    const status = role.compatible ? '✅ Compatible' : '❌ Not Compatible';
                    const isRecommended = compatibility.recommended_primary_role === role.role ? ' ⭐ *Recommended*' : '';
                    comment += `• *${role.role}*: ${status} (${Math.round(role.confidence * 100)}% confidence)${isRecommended}\n`;
                    
                    if (role.reasoning) {
                        comment += `   └── ${role.reasoning}\n`;
                    }
                    comment += '\n';
                });
            }
            
            if (compatibility && compatibility.proceed_with_scoring) {
                comment += `*Recommendation:* ${compatibility.recommended_primary_role} role shows strong compatibility\n`;
                comment += `*Status:* Scoring step failed - manual review needed\n`;
                comment += '\n---\n';
                comment += '*Next Steps:* Re-run scoring or conduct manual assessment';
            } else {
                comment += '*Status:* No roles met minimum compatibility threshold\n';
                comment += '\n---\n';
                comment += '*Next Steps:* Consider for other roles or archive';
            }
            
        } else if (fitStatus === 'Invalid LinkedIn URL') {
            comment += '\n*Final Status:* LinkedIn URL verification failed\n';
            comment += `*Error:* ${errorMessage || 'Unable to access or validate LinkedIn profile'}\n`;
            comment += '\n---\n';
            comment += '*Next Steps:* Verify LinkedIn URL is correct and publicly accessible';
            
        } else if (fitStatus === 'No Fit (0 Score)') {
            comment += '\n*Final Status:* Candidate does not meet role requirements\n';
            comment += '\n---\n';
            comment += '*Next Steps:* Consider for other roles or archive';
            
        } else if (fitStatus === 'Unprocessed') {
            comment += '\n*Final Status:* Processing not completed\n';
            comment += '\n---\n';
            comment += '*Next Steps:* Manual review required';
        }
        
        return comment;
    }

    /**
     * Get JIRA field ID for fit status - TODO: Make this configurable instead of hard-coded
     */
    getFitStatusId(fitStatus) {
        const statusMap = {
            'Unprocessed': '11027',
            'Invalid LinkedIn URL': '11060',
            'No Fit (0 Score)': '11028', // Assuming this is the old "No Fit" ID - needs verification
            'Scored (See Score and Comments)': '11029' // Assuming this is the old "Scored" ID - needs verification
        };
        
        return statusMap[fitStatus] || '11027'; // Default to Unprocessed
    }

    /**
     * Update JIRA with processing results
     */
    async updateJira(candidateKey, results) {
        // Get processing ID from results
        const processingId = `seq-${candidateKey}-${Date.now()}`;
        
        try {
            // Get scoring job result using the job ID from the scoring step
            let scoringJobResult = { success: false, score: 0, error: null };
            
            if (results.scoringJobId) {
                try {
                    const jobResponse = await apiClient.get(`/scoring-jobs/${results.scoringJobId}`);
                    const jobData = jobResponse.data;
                    
                    logger.info('🔍 DEBUG JIRA Logic - Fetched specific scoring job', {
                        candidateKey,
                        jobId: results.scoringJobId,
                        status: jobData.status,
                        processingId
                    });

                    if (jobData.status === 'completed') {
                        // Extract score using nullish coalescing to handle 0 scores
                        const scoreValue = jobData.result?.parsed_score?.total_score ?? 
                                         jobData.extracted_score ??
                                         jobData.result?.total_score;
                        
                        logger.info('🔍 DEBUG Score extraction paths', {
                            candidateKey,
                            jobId: results.scoringJobId,
                            'result.parsed_score.total_score': jobData.result?.parsed_score?.total_score,
                            'extracted_score': jobData.extracted_score,
                            'result.total_score': jobData.result?.total_score,
                            finalScore: scoreValue,
                            processingId
                        });
                        
                        if (scoreValue !== undefined && scoreValue !== null) {
                            scoringJobResult = {
                                success: true,
                                score: scoreValue,
                                error: null
                            };
                            logger.info('🔍 DEBUG JIRA Logic - Found scoring job result', {
                                candidateKey,
                                jobId: results.scoringJobId,
                                score: scoringJobResult.score,
                                processingId
                            });
                        } else {
                            scoringJobResult.error = 'Score extraction failed - no valid score found';
                            logger.info('🔍 DEBUG JIRA Logic - Score extraction failed', {
                                candidateKey,
                                jobId: results.scoringJobId,
                                jobStatus: jobData.status,
                                processingId
                            });
                        }
                    } else {
                        scoringJobResult.error = `Scoring job not completed: ${jobData.status}`;
                        logger.info('🔍 DEBUG JIRA Logic - Scoring job not completed', {
                            candidateKey,
                            jobId: results.scoringJobId,
                            status: jobData.status,
                            processingId
                        });
                    }
                } catch (apiError) {
                    scoringJobResult.error = `API call failed: ${apiError.message}`;
                    logger.error('🔍 DEBUG JIRA Logic - API call failed', {
                        candidateKey,
                        jobId: results.scoringJobId,
                        error: apiError.message,
                        processingId
                    });
                }
            } else {
                scoringJobResult.error = 'No scoring job ID available';
                logger.info('🔍 DEBUG JIRA Logic - No scoring job ID', {
                    candidateKey,
                    scoringStepCompleted: !!results.steps.find(s => s.name === 'score' && s.success),
                    processingId
                });
            }
            
            // Determine fit status and score based on all step results
            const verifyStep = results.steps.find(s => s.name === 'verify');
            const compatibilityStep = results.steps.find(s => s.name === 'check_compatibility');
            
            let fitStatus = 'Unprocessed';
            let fitScore = 0;
            let errorMessage = null;
            
            logger.info('🔍 DEBUG JIRA Logic - Step Results Analysis', {
                candidateKey,
                verifyStep: verifyStep ? { success: verifyStep.success, valid: verifyStep.result?.valid } : 'not found',
                compatibilityStep: compatibilityStep ? { success: compatibilityStep.success } : 'not found',
                compatibilityStoppedScoring: results.compatibilityStoppedScoring,
                processingId
            });
            
            // Check verify step first
            if (!verifyStep || !verifyStep.success || !verifyStep.result?.valid) {
                fitStatus = 'Invalid LinkedIn URL';
                fitScore = 0;
                errorMessage = verifyStep?.error || verifyStep?.result?.message || 'LinkedIn URL verification failed';
                logger.info('🔍 DEBUG JIRA Logic - Verify Failed', {
                    candidateKey,
                    fitStatus,
                    errorMessage,
                    processingId
                });
            } else if (!compatibilityStep || !compatibilityStep.success || results.compatibilityStoppedScoring) {
                // Compatibility failed or recommended not to score
                fitStatus = 'No Fit (0 Score)';
                fitScore = 0;
                if (results.compatibilityStoppedScoring) {
                    errorMessage = 'No role met threshold for scoring';
                } else {
                    errorMessage = compatibilityStep?.error || 'Compatibility check failed';
                }
                logger.info('🔍 DEBUG JIRA Logic - No Fit', {
                    candidateKey,
                    fitStatus,
                    errorMessage,
                    processingId
                });
            }
            
            // Use scoring job result if successful
            if (scoringJobResult.success) {
                fitStatus = 'Scored (See Score and Comments)';
                fitScore = scoringJobResult.score;
                logger.info('🔍 DEBUG JIRA Logic - Applied score from job', {
                    candidateKey,
                    scoreFromJob: fitScore,
                    processingId
                });
            } else if (scoringJobResult.error) {
                errorMessage = scoringJobResult.error;
                logger.error('🔍 DEBUG JIRA Logic - Scoring job error', {
                    candidateKey,
                    error: errorMessage,
                    processingId
                });
            }
            
            logger.info('🔍 DEBUG JIRA Logic - Final Values', {
                candidateKey,
                finalFitStatus: fitStatus,
                finalFitScore: fitScore,
                processingId
            });
            
            // Build comprehensive comment with correct score and compatibility results
            const comprehensiveComment = this.buildComprehensiveComment(
                { candidateKey, linkedinUrl: results.linkedinUrl }, 
                results.steps, 
                compatibilityStep, 
                scoringJobResult, 
                fitStatus, 
                fitScore, 
                results.profileId,
                errorMessage
            );

            logger.info(`📝 Updating JIRA fields and comment for ${candidateKey}`, {
                fitStatus,
                fitScore,
                processingId
            });
            
            // Update JIRA fields for fit score and status
            await apiClient.put(`/jira/candidates/${candidateKey}/fields`, {
                fields: [
                    {
                        field_id: 'customfield_11635', // FIT Score
                        value: fitScore
                    },
                    {
                        field_id: 'customfield_11634', // FIT Status
                        value: { id: this.getFitStatusId(fitStatus) }
                    }
                ]
            });
            
            // Add comprehensive processing comment
            await apiClient.post(`/jira/candidates/${candidateKey}/comments`, {
                comment_body: comprehensiveComment
            });
            
            logger.info(`✅ Successfully updated JIRA fields and comment for ${candidateKey}`, {
                fitStatus,
                fitScore,
                processingId
            });

            // Store successful JIRA update in database history
            await jobInspector.storeProcessingHistory(
                candidateKey,
                'jira_update',
                'success',
                {
                    fitStatus,
                    fitScore,
                    commentAdded: true,
                    fieldsUpdated: ['FIT Status', 'FIT Score'],
                    processingId
                },
                null,
                results.profileId
            );
            
            return {
                fitStatus,
                fitScore,
                jiraUpdated: true,
                message: `JIRA updated successfully with ${fitStatus} and score ${fitScore}`
            };
            
        } catch (jiraError) {
            logger.error(`❌ Failed to update JIRA fields for ${candidateKey}:`, {
                error: jiraError.message,
                stack: jiraError.stack,
                processingId
            });

            // Store failed JIRA update in database history
            await jobInspector.storeProcessingHistory(
                candidateKey,
                'jira_update',
                'error',
                {
                    error: jiraError.message,
                    processingId
                },
                null,
                results.profileId
            );

            // Still return success since JIRA update failures shouldn't fail the whole process
            return {
                fitStatus: 'JIRA Update Failed',
                fitScore: 0,
                jiraUpdated: false,
                error: jiraError.message,
                message: `JIRA update failed: ${jiraError.message}`
            };
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CandidateSequentialProcessor;