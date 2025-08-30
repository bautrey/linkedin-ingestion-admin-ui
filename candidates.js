const express = require('express');
const router = express.Router();
const jiraClient = require('../config/jira');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

// Candidates list page
router.get('/', async (req, res) => {
    try {
        // Get query parameters for filtering
        const {
            page = 1,
            limit = 25,
            status,
            standing,
            needsScore,
            search,
            sortBy = 'created',
            sortOrder = 'DESC'
        } = req.query;

        const startAt = (page - 1) * limit;

        // Test Jira connection first
        const connectionTest = await jiraClient.testConnection();
        
        if (!connectionTest.connected) {
            return res.render('candidates/list', {
                title: 'Candidates',
                error: `Jira connection failed: ${connectionTest.error}`,
                candidates: [],
                pagination: {},
                filters: req.query,
                filterOptions: { status: [], standing: [] }, // Provide empty filter options
                tokenStatus: connectionTest.tokenStatus,
                pageScript: 'candidates'
            });
        }

        // Search candidates in Jira
        const searchOptions = {
            maxResults: parseInt(limit),
            startAt: parseInt(startAt),
            status,
            standing,
            needsScore,
            search,
            sortBy,
            sortOrder
        };

        const jiraResults = await jiraClient.searchCandidates(searchOptions);

        // Cross-reference with our profile database to get processing status
        const candidatesWithStatus = await Promise.all(
            jiraResults.candidates.map(async (candidate) => {
                let processingStatus = 'unknown';
                let profileData = null;

                if (candidate.linkedinUrl) {
                    try {
                        // Check if profile exists in our system
                        const profileResponse = await apiClient.get(`/profiles`, {
                            params: { linkedin_url: candidate.linkedinUrl }
                        });
                        
                        if (profileResponse.data?.data?.length > 0) {
                            profileData = profileResponse.data.data[0];
                            
                            // Determine processing status based on profile data
                            if (profileData.score && profileData.score > 0) {
                                processingStatus = 'scored';
                            } else if (profileData.role_compatibility_checked) {
                                processingStatus = profileData.compatibility_passed ? 'ready_to_score' : 'compatibility_failed';
                            } else {
                                processingStatus = 'needs_compatibility_check';
                            }
                        } else {
                            processingStatus = candidate.hasLinkedIn ? 'needs_ingestion' : 'no_linkedin';
                        }
                    } catch (error) {
                        logger.warn(`Failed to check profile status for candidate ${candidate.key}:`, error.message);
                        processingStatus = 'check_failed';
                    }
                } else {
                    processingStatus = 'no_linkedin';
                }

                return {
                    ...candidate,
                    processingStatus,
                    profileData,
                    // Enhanced status badges
                    statusBadge: getStatusBadge(processingStatus, candidate, profileData)
                };
            })
        );

        // Get filter options for dropdowns
        const filterOptions = await getFilterOptions();

        res.render('candidates/list', {
            title: 'Candidates',
            candidates: candidatesWithStatus,
            pagination: jiraResults.pagination,
            filters: req.query,
            filterOptions,
            tokenStatus: connectionTest.tokenStatus,
            error: null,
            pageScript: 'candidates'
        });

    } catch (error) {
        logger.error('Candidates list error:', error);
        res.render('error', {
            title: 'Candidates Error',
            message: 'Failed to load candidates data',
            error: {
                message: 'Failed to load candidates. Please check Jira configuration and try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

// Individual candidate details page
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        // Get candidate details from Jira
        const candidate = await jiraClient.getCandidate(key);

        // Get profile data if exists
        let profileData = null;
        let processingHistory = [];
        
        if (candidate.linkedinUrl) {
            try {
                const profileResponse = await apiClient.get(`/profiles`, {
                    params: { linkedin_url: candidate.linkedinUrl }
                });
                
                if (profileResponse.data?.data?.length > 0) {
                    profileData = profileResponse.data.data[0];
                    
                    // Get processing history/scoring jobs
                    try {
                        const historyResponse = await apiClient.get(`/profiles/${profileData.id}/history`);
                        processingHistory = historyResponse.data?.data || [];
                    } catch (historyError) {
                        logger.warn(`Failed to get processing history for ${key}:`, historyError.message);
                    }
                }
            } catch (error) {
                logger.warn(`Failed to get profile data for candidate ${key}:`, error.message);
            }
        }

        res.render('candidates/detail', {
            title: `Candidate: ${candidate.fullName || candidate.key}`,
            candidate,
            profileData,
            processingHistory,
            pageScript: 'candidate-detail'
        });

    } catch (error) {
        logger.error(`Candidate detail error for ${req.params.key}:`, error);
        res.render('error', {
            title: 'Candidate Error',
            message: `Failed to load candidate ${req.params.key}`,
            error: {
                message: 'Failed to load candidate details. Please try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

// API endpoint to process a candidate
router.post('/:key/process', async (req, res) => {
    try {
        const { key } = req.params;
        const { actions = ['verify', 'ingest', 'check_compatibility', 'score'] } = req.body;

        // Get candidate data from Jira
        const candidate = await jiraClient.getCandidate(key);

        if (!candidate.linkedinUrl) {
            return res.status(400).json({
                success: false,
                error: 'Candidate has no LinkedIn URL'
            });
        }

        let results = [];
        let profileId = null;

        try {
            // Step 1: Verify LinkedIn URL (if verify is in actions)
            if (actions.includes('verify')) {
                logger.info(`Verifying LinkedIn URL for candidate ${key}`);
                const verifyResponse = await apiClient.post('/profiles/verify', {
                    linkedin_url: candidate.linkedinUrl
                });
                results.push({ step: 'verify', success: true, data: verifyResponse.data });
            }

            // Step 2: Ingest profile (if ingest is in actions)
            // First, always check if profile already exists
            try {
                const existingResponse = await apiClient.get('/profiles', {
                    params: { linkedin_url: candidate.linkedinUrl }
                });
                if (existingResponse.data?.data?.length > 0) {
                    profileId = existingResponse.data.data[0].id;
                    logger.info(`Profile already exists for candidate ${key}, using existing profile ${profileId}`);
                    if (actions.includes('ingest')) {
                        results.push({ 
                            step: 'ingest', 
                            success: true, 
                            data: { message: 'Profile already exists, skipping ingestion', profile_id: profileId }
                        });
                    }
                }
            } catch (err) {
                logger.warn(`Could not check for existing profile for ${key}: ${err.message}`);
            }
            
            // Only ingest if profile doesn't exist and ingest is requested
            if (actions.includes('ingest') && !profileId) {
                logger.info(`Ingesting new profile for candidate ${key}`);
                const ingestResponse = await apiClient.post('/profiles', {
                    linkedin_url: candidate.linkedinUrl,
                    suggested_role: 'CTO', // Default role - must be CIO, CTO, or CISO as per API validation
                    include_companies: true
                });
                results.push({ step: 'ingest', success: true, data: ingestResponse.data });
                profileId = ingestResponse.data.id;
                
                // Update Jira with profile ID
                if (profileId) {
                    await jiraClient.updateCandidate(key, { profileId: profileId });
                }
            }

            // Step 3: Check role compatibility (if check_compatibility is in actions and we have a profile)
            if (actions.includes('check_compatibility') && profileId) {
                logger.info(`Checking role compatibility for candidate ${key}, profile ${profileId}`);
                const compatibilityResponse = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                    role_description: 'General role compatibility check' // You might want to customize this
                });
                results.push({ step: 'check_compatibility', success: true, data: compatibilityResponse.data });
            }

            // Step 4: Score candidate (if score is in actions and we have a profile)
            if (actions.includes('score') && profileId) {
                logger.info(`Scoring candidate ${key}, profile ${profileId}`);
                // Use default template for scoring
                const defaultTemplateResponse = await apiClient.get(`/profiles/${profileId}/default-template`);
                
                if (defaultTemplateResponse.data) {
                    const scoreResponse = await apiClient.post(`/profiles/${profileId}/score-template`, {
                        template_id: defaultTemplateResponse.data.id
                    });
                    results.push({ step: 'score', success: true, data: scoreResponse.data });
                } else {
                    results.push({ step: 'score', success: false, error: 'No default template available' });
                }
            }

            const successfulSteps = results.filter(r => r.success).length;
            const failedSteps = results.filter(r => !r.success).length;

            res.json({
                success: true,
                message: `Processing completed: ${successfulSteps} successful, ${failedSteps} failed`,
                profile_id: profileId,
                steps: results,
                actions_requested: actions
            });

        } catch (stepError) {
            logger.error(`Processing step failed for candidate ${key}:`, stepError);
            results.push({ 
                step: 'unknown', 
                success: false, 
                error: stepError.response?.data?.detail || stepError.message 
            });
            
            res.json({
                success: false,
                error: `Processing failed: ${stepError.response?.data?.detail || stepError.message}`,
                profile_id: profileId,
                steps: results,
                actions_requested: actions
            });
        }

    } catch (error) {
        logger.error(`Failed to process candidate ${req.params.key}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint for batch processing
router.post('/batch/process', async (req, res) => {
    try {
        const { candidate_keys, actions = ['verify', 'ingest', 'check_compatibility', 'score'] } = req.body;

        if (!candidate_keys || !Array.isArray(candidate_keys)) {
            return res.status(400).json({
                success: false,
                error: 'candidate_keys array is required'
            });
        }

        // Process each candidate using our own processing logic
        const results = await Promise.all(
            candidate_keys.map(async (key) => {
                try {
                    const candidate = await jiraClient.getCandidate(key);
                    
                    if (!candidate.linkedinUrl) {
                        return { key, success: false, error: 'No LinkedIn URL' };
                    }

                    // Simulate the individual processing logic here
                    let stepResults = [];
                    let profileId = null;

                    // Step 1: Verify (if in actions)
                    if (actions.includes('verify')) {
                        const verifyResponse = await apiClient.post('/profiles/verify', {
                            linkedin_url: candidate.linkedinUrl
                        });
                        stepResults.push({ step: 'verify', success: true });
                    }

                    // Step 2: Check for existing profile first
                    try {
                        const existingResponse = await apiClient.get('/profiles', {
                            params: { linkedin_url: candidate.linkedinUrl }
                        });
                        if (existingResponse.data?.data?.length > 0) {
                            profileId = existingResponse.data.data[0].id;
                            if (actions.includes('ingest')) {
                                stepResults.push({ step: 'ingest', success: true, message: 'Profile already exists, skipped ingestion' });
                            }
                        }
                    } catch (err) {
                        // Profile doesn't exist or error checking
                    }
                    
                    // Step 2: Ingest (if in actions and profile doesn't exist)
                    if (actions.includes('ingest') && !profileId) {
                        const ingestResponse = await apiClient.post('/profiles', {
                            linkedin_url: candidate.linkedinUrl,
                            suggested_role: 'CTO', // Must be CIO, CTO, or CISO as per API validation
                            include_companies: true
                        });
                        stepResults.push({ step: 'ingest', success: true });
                        profileId = ingestResponse.data.id;
                        
                        // Update Jira
                        if (profileId) {
                            await jiraClient.updateCandidate(key, { profileId: profileId });
                        }
                    }

                    // Step 3: Check compatibility (if in actions and have profile)
                    if (actions.includes('check_compatibility') && profileId) {
                        const compatibilityResponse = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                            role_description: 'General role compatibility check'
                        });
                        stepResults.push({ step: 'check_compatibility', success: true });
                    }

                    // Step 4: Score (if in actions and have profile)
                    if (actions.includes('score') && profileId) {
                        try {
                            const defaultTemplateResponse = await apiClient.get(`/profiles/${profileId}/default-template`);
                            if (defaultTemplateResponse.data) {
                                const scoreResponse = await apiClient.post(`/profiles/${profileId}/score-template`, {
                                    template_id: defaultTemplateResponse.data.id
                                });
                                stepResults.push({ step: 'score', success: true });
                            }
                        } catch (scoreError) {
                            stepResults.push({ step: 'score', success: false });
                        }
                    }

                    const successful = stepResults.filter(r => r.success).length;
                    const failed = stepResults.filter(r => !r.success).length;

                    return {
                        key,
                        success: failed === 0,
                        profile_id: profileId,
                        steps_completed: successful,
                        steps_failed: failed,
                        message: `${successful} steps completed, ${failed} failed`
                    };

                } catch (error) {
                    logger.error(`Failed to process candidate ${key}:`, error);
                    return { key, success: false, error: error.message };
                }
            })
        );

        res.json({
            success: true,
            results,
            processed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });

    } catch (error) {
        logger.error('Batch processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to get status badge info
function getStatusBadge(processingStatus, candidate, profileData) {
    const badges = {
        'no_linkedin': { text: 'No LinkedIn', class: 'badge-secondary', icon: 'fas fa-times' },
        'needs_ingestion': { text: 'Needs Ingestion', class: 'badge-info', icon: 'fas fa-download' },
        'needs_compatibility_check': { text: 'Check Compatibility', class: 'badge-warning', icon: 'fas fa-search' },
        'compatibility_failed': { text: 'Not Compatible', class: 'badge-danger', icon: 'fas fa-times-circle' },
        'ready_to_score': { text: 'Ready to Score', class: 'badge-primary', icon: 'fas fa-star' },
        'scored': { text: `Score: ${profileData?.score || '?'}`, class: 'badge-success', icon: 'fas fa-check-circle' },
        'check_failed': { text: 'Check Failed', class: 'badge-dark', icon: 'fas fa-exclamation-triangle' },
        'unknown': { text: 'Unknown', class: 'badge-light', icon: 'fas fa-question' }
    };

    return badges[processingStatus] || badges['unknown'];
}

// Helper function to get filter options
async function getFilterOptions() {
    // In a real implementation, you might want to fetch these from Jira's field options
    return {
        status: [
            'Open',
            'In Progress', 
            'Closed',
            'Resolved'
        ],
        standing: [
            'Excellent',
            'Good',
            'Fair',
            'Poor'
        ],
        needsScore: [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' }
        ]
    };
}

module.exports = router;
