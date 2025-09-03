const express = require('express');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

const router = express.Router();

// GET /profiles - List all profiles
router.get('/', async (req, res) => {
    try {
        logger.info('Processing profiles request', { query: req.query, originalUrl: req.originalUrl });
        
        const { page = 1, limit = 50, search, company, location, score_range, sort_by, sort_order } = req.query;
        
        const params = {
            page: parseInt(page),
            limit: parseInt(limit)
        };
        
        // Handle search/filter parameters
        if (search) params.name = search;  // API uses 'name' parameter for search
        if (company) params.company = company;
        if (location) params.location = location;
        if (score_range) params.score_range = score_range;
        if (sort_by) params.sort_by = sort_by;
        if (sort_order) params.sort_order = sort_order;
        
        logger.info('Making API call with params', { params });
        
        const response = await apiClient.get('/profiles', { params });
        
        logger.info('API response received', { 
            dataLength: response.data?.data?.length || 0,
            pagination: response.data?.pagination
        });
        
        // Build base URL for pagination
        const baseUrl = req.originalUrl.split('?')[0];
        const queryString = new URLSearchParams(req.query);
        
        logger.info('Rendering template', { 
            baseUrl, 
            queryParams: queryString.toString(),
            hasProfiles: !!(response.data?.data?.length)
        });
        
        res.render('profiles/list', {
            title: 'LinkedIn Profiles',
            profiles: response.data.data || [],
            pagination: response.data.pagination || {},
            query: req.query,
            currentPage: 'profiles',
            baseUrl: baseUrl,
            queryParams: queryString.toString()
        });
    } catch (error) {
        logger.error('Error fetching profiles:', {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            config: {
                url: error.config?.url,
                method: error.config?.method,
                params: error.config?.params
            }
        });
        
        // In case of API error, still render the page but with empty results
        // This prevents losing the URL parameters
        const baseUrl = req.originalUrl.split('?')[0];
        const queryString = new URLSearchParams(req.query);
        
        res.render('profiles/list', {
            title: 'LinkedIn Profiles',
            profiles: [],
            pagination: {},
            query: req.query,
            currentPage: 'profiles',
            baseUrl: baseUrl,
            queryParams: queryString.toString(),
            error: 'Failed to load profiles. Please try again.'
        });
    }
});

// GET /profiles/:id - View single profile
router.get('/:id', async (req, res) => {
    const startTime = Date.now();
    try {
        logger.info(`Starting profile detail request for ${req.params.id}`);
        
        const apiCallStart = Date.now();
        const response = await apiClient.get(`/profiles/${req.params.id}`);
        const apiCallTime = Date.now() - apiCallStart;
        
        logger.info(`API call completed in ${apiCallTime}ms`);
        
        const profile = response.data;
        
        // Skip company mapping for faster page load - will be loaded asynchronously
        const companyMapping = {};
        
        const renderStart = Date.now();
        res.render('profiles/detail', {
            title: `Profile: ${profile.name}`,
            profile: profile,
            companyMapping: companyMapping,
            currentPage: 'profiles'
        });
        
        const totalTime = Date.now() - startTime;
        const renderTime = Date.now() - renderStart;
        logger.info(`Profile detail page completed - API: ${apiCallTime}ms, Render: ${renderTime}ms, Total: ${totalTime}ms`);
    } catch (error) {
        logger.error(`Error fetching profile ${req.params.id}:`, error);
        if (error.response && error.response.status === 404) {
            res.status(404).render('error', {
                title: 'Profile Not Found',
                message: 'The requested profile could not be found'
            });
        } else {
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load profile',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }
});

// GET /profiles/:id/scoring-history - View scoring history for profile
router.get('/:id/scoring-history', async (req, res) => {
    try {
        // Fetch profile info, scoring history, and templates
        const [profileResponse, historyResponse, templatesResponse] = await Promise.allSettled([
            apiClient.get(`/profiles/${req.params.id}`),
            // Get all scoring jobs and filter for this profile
            apiClient.get('/scoring-jobs', { params: { limit: 100 } }),
            // Get templates for name lookup
            apiClient.get('/templates')
        ]);
        
        if (profileResponse.status === 'fulfilled') {
            const profile = profileResponse.value.data;
            let history = [];
            
            if (historyResponse.status === 'fulfilled') {
                // Filter scoring jobs to only include jobs for this profile
                const allJobs = historyResponse.value.data.jobs || [];
                const filteredJobs = allJobs
                    .filter(job => job.profile_id === req.params.id)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Most recent first
                
                // Build template lookup map
                let templateMap = {};
                if (templatesResponse.status === 'fulfilled') {
                    const templates = templatesResponse.value.data.templates || [];
                    logger.info('Templates fetched for scoring history:', { 
                        count: templates.length, 
                        templates: templates.map(t => ({ id: t.id, name: t.name }))
                    });
                    templateMap = templates.reduce((map, template) => {
                        map[template.id] = template;
                        return map;
                    }, {});
                    logger.info('Template map created:', Object.keys(templateMap));
                } else {
                    logger.error('Failed to fetch templates for scoring history:', templatesResponse.reason);
                }
                
                // Enhance jobs with template information
                history = filteredJobs.map(job => ({
                    ...job,
                    template_name: templateMap[job.template_id]?.name || 'Unknown Template',
                    template_category: templateMap[job.template_id]?.category
                }));
            }
            
            res.render('profiles/scoring-history', {
                title: `Scoring History: ${profile.name}`,
                profile: profile,
                history: history,
                currentPage: 'profiles'
            });
        } else {
            throw profileResponse.reason;
        }
    } catch (error) {
        logger.error(`Error fetching scoring history for profile ${req.params.id}:`, error);
        if (error.response && error.response.status === 404) {
            res.status(404).render('error', {
                title: 'Profile Not Found',
                message: 'The requested profile could not be found'
            });
        } else {
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load scoring history',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }
});

// GET /profiles/:id/companies - Get companies for profile (proxy to backend API)
router.get('/:id/companies', async (req, res) => {
    try {
        const response = await apiClient.get(`/profiles/${req.params.id}/companies`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error fetching companies for profile ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});

// GET /profiles/:id/company-mapping - Get company mappings for profile (async)
router.get('/:id/company-mapping', async (req, res) => {
    try {
        const response = await apiClient.get(`/profiles/${req.params.id}`);
        const profile = response.data;
        
        // Extract company names from profile experience
        const companyNames = new Set();
        
        // Add current company
        if (profile.current_company && profile.current_company.name) {
            companyNames.add(profile.current_company.name);
        }
        
        // Add companies from experience
        if (profile.experience && profile.experience.length > 0) {
            profile.experience.forEach(exp => {
                if (exp.company) {
                    companyNames.add(exp.company);
                }
            });
        }
        
        // Search for all companies in parallel
        const companySearchPromises = Array.from(companyNames).map(async (companyName) => {
            try {
                const companyResponse = await apiClient.get('/companies', {
                    params: { name: companyName, limit: 1 }
                });
                
                if (companyResponse.data.data && companyResponse.data.data.length > 0) {
                    const company = companyResponse.data.data[0];
                    // Only map if the company name is a close match
                    if (company.company_name.toLowerCase().includes(companyName.toLowerCase()) || 
                        companyName.toLowerCase().includes(company.company_name.toLowerCase())) {
                        return {
                            originalName: companyName,
                            mapping: {
                                id: company.id,
                                name: company.company_name,
                                url: `/companies/${company.id}`
                            }
                        };
                    }
                }
                return null;
            } catch (companyError) {
                logger.debug(`Company search failed for ${companyName}:`, companyError.message);
                return null;
            }
        });
        
        // Wait for all company searches to complete
        const companyResults = await Promise.allSettled(companySearchPromises);
        
        // Build the mapping from results
        const companyMapping = {};
        companyResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                companyMapping[result.value.originalName] = result.value.mapping;
            }
        });
        
        res.json({ companyMapping });
    } catch (error) {
        logger.error(`Error fetching company mapping for profile ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to load company mapping' });
    }
});

// DELETE /profiles/:id - Delete profile
router.delete('/:id', async (req, res) => {
    try {
        await apiClient.delete(`/profiles/${req.params.id}`);
        res.json({ success: true, message: 'Profile deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting profile ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete profile',
            error: error.message
        });
    }
});

module.exports = router;
