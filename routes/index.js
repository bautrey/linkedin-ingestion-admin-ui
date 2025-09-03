const express = require('express');
const router = express.Router();
const apiClient = require('../config/api');
const logger = require('../utils/logger');

// Dashboard route
router.get('/', async (req, res) => {
    try {
        // Fetch dashboard statistics
        const [profilesResponse, companiesResponse, healthResponse] = await Promise.allSettled([
            apiClient.get('/profiles', { params: { limit: 20, offset: 0 } }),
            apiClient.get('/companies', { params: { limit: 10, offset: 0 } }),
            apiClient.get('/health')
        ]);

        // Extract data with fallbacks, handling nested response structure
        const profiles = profilesResponse.status === 'fulfilled' 
            ? (profilesResponse.value.data || { data: [], pagination: { total: 0 } })
            : { data: [], pagination: { total: 0 } };
        const companies = companiesResponse.status === 'fulfilled' 
            ? (companiesResponse.value.data || { data: [], pagination: { total: 0 } }) 
            : { data: [], pagination: { total: 0 } };
        const health = healthResponse.status === 'fulfilled' 
            ? (healthResponse.value.data?.data || healthResponse.value.data || { status: 'unknown' }) 
            : { status: 'unknown' };

        logger.info(`Dashboard data - Profiles: ${profiles.data?.length || 0}, Companies: ${companies.data?.length || 0}`);
        
        // Recent profiles (last 10 for quick view)
        const recentProfiles = profiles.data ? profiles.data.slice(0, 10) : [];

        res.render('dashboard', {
            title: 'Dashboard',
            statistics: {
                profileCount: profiles.pagination?.total || profiles.total || 0,
                companyCount: companies.pagination?.total || companies.total || 0,
                recentCount: recentProfiles.length
            },
            recentProfiles: recentProfiles,
            systemHealth: health,
            pageScript: 'dashboard'
        });

    } catch (error) {
        logger.error('Dashboard error:', error);
        res.render('error', {
            title: 'Dashboard Error',
            message: 'Failed to load dashboard data. Please try again later.',
            error: { 
                message: 'Failed to load dashboard data. Please try again later.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

module.exports = router;
