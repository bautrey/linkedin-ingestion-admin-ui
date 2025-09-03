const express = require('express');
const router = express.Router();
const jiraClient = require('../config/jira');
const apiClient = require('../config/api');
const logger = require('../utils/logger');
const axios = require('axios');

// Candidates list page
router.get('/', async (req, res) => {
    try {
        // Get query parameters for filtering
        const {
            page = 1,
            limit = 25,
            status,
            standing,
            fitStatus,
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
            fitStatus,
            search,
            sortBy,
            sortOrder
        };

        const jiraResults = await jiraClient.searchCandidates(searchOptions);

        // Pass candidates directly without any badge processing
        const candidatesWithStatus = jiraResults.candidates;

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
        let latestScoring = null;
        let roleCompatibility = null;
        let recentComments = [];
        
        if (candidate.linkedinUrl) {
            try {
                const profileResponse = await apiClient.get(`/profiles`, {
                    params: { linkedin_url: candidate.linkedinUrl }
                });
                
                if (profileResponse.data?.data?.length > 0) {
                    profileData = profileResponse.data.data[0];
                    
                    // Get processing history/scoring jobs via proxy
                    try {
                        const historyResponse = await apiClient.get(`/processing/candidates/${key}/history`);
                        processingHistory = historyResponse.data?.history || [];
                    } catch (historyError) {
                        logger.warn(`Failed to get processing history for ${key}:`, historyError.message);
                    }

                    // Get latest scoring results
                    try {
                        const scoringResponse = await apiClient.get(`/scoring-jobs`, {
                            params: { profile_id: profileData.id, limit: 1 }
                        });
                        if (scoringResponse.data?.jobs?.length > 0) {
                            latestScoring = scoringResponse.data.jobs[0];
                        }
                    } catch (scoringError) {
                        logger.warn(`Failed to get scoring data for ${key}:`, scoringError.message);
                    }

                    // Get role compatibility data directly from API
                    try {
                        const compatibilityResponse = await apiClient.get(`/profiles/${profileData.id}/role-compatibility/latest`);
                        profileData.compatibilityData = compatibilityResponse.data;
                        profileData.compatibility_passed = compatibilityResponse.data.proceed_with_scoring;
                        profileData.recommended_role = compatibilityResponse.data.recommended_primary_role;
                        profileData.has_compatibility_data = true;
                        roleCompatibility = compatibilityResponse.data; // For backward compatibility
                    } catch (compatError) {
                        if (compatError.response && compatError.response.status === 404) {
                            // No compatibility results yet
                            profileData.has_compatibility_data = false;
                            profileData.compatibility_passed = false;
                        } else {
                            logger.warn(`Failed to get role compatibility for ${key}:`, compatError.message);
                            profileData.has_compatibility_data = false;
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Failed to get profile data for candidate ${key}:`, error.message);
            }
        }

        // Get recent JIRA comments
        try {
            recentComments = await jiraClient.getRecentComments(key, 3); // Get last 3 comments
        } catch (commentError) {
            logger.warn(`Failed to get JIRA comments for ${key}:`, commentError.message);
        }

        res.render('candidates/detail', {
            title: `Candidate: ${candidate.fullName || candidate.key}`,
            candidate,
            profileData,
            processingHistory,
            latestScoring,
            roleCompatibility,
            recentComments,
            pageScript: 'candidate-detail',
            apiBaseUrl: process.env.FASTAPI_BASE_URL
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
            let compatibilityData = null;
            if (actions.includes('check_compatibility') && profileId) {
                logger.info(`Checking role compatibility for candidate ${key}, profile ${profileId}`);
                
                try {
                    // First, check if we already have compatibility results
                    const existingCompatibility = await apiClient.get(`/profiles/${profileId}/role-compatibility/latest`);
                    
                    // If we have recent results (within last hour), use them
                    const existingTimestamp = new Date(existingCompatibility.data.checked_at);
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    
                    if (existingTimestamp > oneHourAgo) {
                        logger.info(`Using existing compatibility results for ${key} from ${existingTimestamp}`);
                        compatibilityData = existingCompatibility.data;
                        results.push({ step: 'check_compatibility', success: true, data: { reused_existing: true, ...compatibilityData } });
                    } else {
                        // Run new compatibility check
                        const compatibilityResponse = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                            target_roles: ['CTO', 'CIO', 'CISO'],
                            fast_screening: true
                        });
                        compatibilityData = compatibilityResponse.data;
                        results.push({ step: 'check_compatibility', success: true, data: compatibilityData });
                    }
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        // No existing results, run new check
                        logger.info(`No existing compatibility results for ${key}, running new check`);
                        const compatibilityResponse = await apiClient.post(`/profiles/${profileId}/role-compatibility`, {
                            target_roles: ['CTO', 'CIO', 'CISO'],
                            fast_screening: true
                        });
                        compatibilityData = compatibilityResponse.data;
                        results.push({ step: 'check_compatibility', success: true, data: compatibilityData });
                    } else {
                        logger.error(`Error checking compatibility for ${key}: ${error.message}`);
                        results.push({ step: 'check_compatibility', success: false, error: error.message });
                    }
                }
            }

            // Step 4: Score candidate (if score is in actions and we have a profile)
            if (actions.includes('score') && profileId) {
                logger.info(`Scoring candidate ${key}, profile ${profileId}`);
                
                let scoreResponse = null;
                try {
                    // Get template ID based on role (from compatibility or default to CIO)
                    let targetRole = 'CIO'; // Default role
                    if (compatibilityData && compatibilityData.recommended_primary_role && compatibilityData.proceed_with_scoring) {
                        targetRole = compatibilityData.recommended_primary_role;
                        logger.info(`Using recommended role ${targetRole} for scoring ${key}`);
                    } else {
                        logger.info(`No compatibility recommendation for ${key}, using default ${targetRole} template`);
                    }

                    // Fetch templates via frontend proxy and find the one for our target role
                    const templatesResponse = await axios.get('http://localhost:3003/api/templates');
                    const template = templatesResponse.data.templates.find(t => t.category === targetRole);
                    
                    if (!template) {
                        throw new Error(`No template found for role: ${targetRole}`);
                    }

                    logger.info(`Using template ${template.name} (${template.id}) for role ${targetRole}`);

                    // Call score-template endpoint via frontend proxy
                    const scoringResponse = await axios.post(`http://localhost:3003/api/profiles/${profileId}/score-template`, {
                        template_id: template.id
                    });

                    const scoreData = scoringResponse.data;
                    results.push({ step: 'score', success: true, data: scoreData });
                    
                } catch (error) {
                    logger.error(`Error scoring candidate ${key}: ${error.message}`);
                    results.push({ step: 'score', success: false, error: error.message });
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
