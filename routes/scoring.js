const express = require('express');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

const router = express.Router();

// GET /scoring - Show scoring dashboard or profile scoring interface
router.get('/', async (req, res) => {
    try {
        const { profile_id, profile_ids } = req.query;
        
        // If profile_id or profile_ids are provided, show the scoring interface
        if (profile_id || profile_ids) {
            let profilesData = [];
            let templatesData = [];
            
            try {
                // Fetch templates for scoring selection
                const templatesResponse = await apiClient.get('/templates');
                // Handle API response structure: response.data.templates
                templatesData = templatesResponse.data?.templates || [];
                logger.info(`Fetched ${templatesData.length} templates for scoring`);
                logger.debug('Templates data:', templatesData);
                
                if (profile_id) {
                    // Single profile scoring
                    const profileResponse = await apiClient.get(`/profiles/${profile_id}`);
                    // Handle nested response structure for single profile
                    const profileData = profileResponse.data?.data || profileResponse.data;
                    profilesData = [profileData];
                    logger.info(`Fetched profile: ${profileData?.name || profileData?.full_name || 'Unknown'}`);
                } else if (profile_ids) {
                    // Bulk profile scoring
                    const idsArray = profile_ids.split(',');
                    const profilePromises = idsArray.map(id => 
                        apiClient.get(`/profiles/${id}`).catch(error => {
                            logger.warn(`Failed to fetch profile ${id}:`, error.message);
                            return null;
                        })
                    );
                    const profileResponses = await Promise.all(profilePromises);
                    // Handle nested response structure for each profile
                    profilesData = profileResponses.filter(Boolean).map(response => response.data?.data || response.data);
                    logger.info(`Fetched ${profilesData.length} profiles for bulk scoring`);
                }
                
                const title = profilesData.length === 1 
                    ? `Score Profile: ${profilesData[0].full_name || profilesData[0].name}` 
                    : `Score ${profilesData.length} Profiles`;
                
                res.render('scoring/score-profiles', {
                    title,
                    profiles: profilesData,
                    templates: templatesData,
                    isBulk: profilesData.length > 1,
                    currentPage: 'scoring'
                });
                
            } catch (error) {
                logger.error('Error loading profiles for scoring:', error);
                res.status(500).render('error', {
                    title: 'Error',
                    message: 'Failed to load profiles for scoring',
                    error: process.env.NODE_ENV === 'development' ? error : {}
                });
            }
        } else {
            // Show scoring dashboard
            try {
                // Fetch scoring jobs from API
                const jobsResponse = await apiClient.get('/scoring-jobs');
                let jobs = jobsResponse.data?.jobs || jobsResponse.data || [];
                
                // Enrich jobs with profile names (fetch first 20 jobs to avoid too many API calls)
                const jobsToEnrich = jobs.slice(0, 20);
                const enrichedJobs = await Promise.all(
                    jobsToEnrich.map(async (job) => {
                        try {
                            if (job.profile_id) {
                                const profileResponse = await apiClient.get(`/profiles/${job.profile_id}`);
                                const profile = profileResponse.data;
                                job.profile_name = profile?.name || profile?.full_name || 'Unknown Profile';
                            } else {
                                job.profile_name = 'No Profile ID';
                            }
                        } catch (error) {
                            logger.debug(`Failed to fetch profile name for job ${job.id}:`, error.message);
                            job.profile_name = 'Unknown Profile';
                        }
                        return job;
                    })
                );
                
                // Replace the first 20 jobs with enriched versions, keep the rest as-is
                jobs = [...enrichedJobs, ...jobs.slice(20)];
                
                // Calculate stats from jobs data
                const stats = {
                    total_jobs: jobs.length,
                    pending_jobs: jobs.filter(job => job.status === 'pending' || job.status === 'running').length,
                    completed_jobs: jobs.filter(job => job.status === 'completed').length,
                    failed_jobs: jobs.filter(job => job.status === 'failed' || job.status === 'error').length
                };
                
                logger.info(`Fetched ${jobs.length} scoring jobs for dashboard (enriched ${enrichedJobs.length} with profile names)`);
                
                res.render('scoring/dashboard', {
                    title: 'Scoring Dashboard',
                    jobs: jobs,
                    stats: stats,
                    currentPage: 'scoring'
                });
            } catch (error) {
                logger.warn('Error fetching scoring jobs for dashboard:', error.message);
                // Fallback to empty data if API call fails
                const jobs = [];
                const stats = {
                    total_jobs: 0,
                    pending_jobs: 0,
                    completed_jobs: 0,
                    failed_jobs: 0
                };
                
                res.render('scoring/dashboard', {
                    title: 'Scoring Dashboard',
                    jobs: jobs,
                    stats: stats,
                    currentPage: 'scoring',
                    warning: 'Unable to load scoring jobs. Please try again later.'
                });
            }
        }
    } catch (error) {
        logger.error('Error loading scoring interface:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load scoring interface',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// GET /scoring/jobs/:id - View scoring job details
router.get('/jobs/:id', async (req, res) => {
    try {
        // Use the correct API endpoint for scoring jobs
        const response = await apiClient.get(`/scoring-jobs/${req.params.id}`);
        
        res.render('scoring/job-detail', {
            title: `Scoring Job: ${req.params.id}`,
            job: response.data,
            currentPage: 'scoring'
        });
    } catch (error) {
        logger.error(`Error fetching scoring job ${req.params.id}:`, error);
        if (error.response && error.response.status === 404) {
            res.status(404).render('error', {
                title: 'Job Not Found',
                message: 'The requested scoring job could not be found',
                error: {}
            });
        } else {
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load scoring job',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }
});

module.exports = router;
