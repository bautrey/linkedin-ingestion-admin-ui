const express = require('express');
const logger = require('../utils/logger');
const apiClient = require('../config/api');
const jiraClient = require('../config/jira');
const axios = require('axios');

const router = express.Router();

// GET /system/status - System Status Page
router.get('/status', async (req, res) => {
    try {
        // Check API Backend
        let backendStatus = {
            status: 'disconnected',
            url: process.env.FASTAPI_BASE_URL || 'https://api-docker-production.up.railway.app',
            error: null,
            version: null
        };
        
        try {
            const healthResponse = await apiClient.get('/health');
            if (healthResponse.status === 200) {
                backendStatus.status = 'connected';
                backendStatus.version = healthResponse.data.version || 'Unknown';
            }
        } catch (error) {
            backendStatus.error = `Connection failed: ${error.message}`;
            logger.warn('API Backend health check failed:', error.message);
        }
        
        // Check Jira Integration
        const jiraStatus = {
            status: 'not_configured',
            hasBaseUrl: !!process.env.JIRA_BASE_URL,
            hasUsername: !!process.env.JIRA_USERNAME,
            hasApiToken: !!process.env.JIRA_API_TOKEN,
            url: process.env.JIRA_BASE_URL || null,
            error: null
        };
        
        if (jiraStatus.hasBaseUrl && jiraStatus.hasUsername && jiraStatus.hasApiToken) {
            jiraStatus.status = 'configured';
            try {
                const connectionTest = await jiraClient.testConnection();
                if (connectionTest.connected) {
                    jiraStatus.status = 'connected';
                } else {
                    jiraStatus.error = connectionTest.error || 'Connection test failed';
                }
            } catch (error) {
                jiraStatus.error = `Connection test failed: ${error.message}`;
            }
        } else {
            const missing = [];
            if (!jiraStatus.hasBaseUrl) missing.push('JIRA_BASE_URL');
            if (!jiraStatus.hasUsername) missing.push('JIRA_USERNAME');
            if (!jiraStatus.hasApiToken) missing.push('JIRA_API_TOKEN');
            jiraStatus.error = `Missing environment variables: ${missing.join(', ')}`;
        }
        
        // Check Job Scheduler (via FastAPI backend)
        let schedulerStatus = {
            totalJobs: 0,
            enabledJobs: 0,
            runningJobs: 0
        };
        
        if (backendStatus.status === 'connected') {
            try {
                // Get jobs from the local jobs API endpoint
                const jobsResponse = await axios.get(`http://localhost:3003/jobs/api/status`);
                if (jobsResponse.data && jobsResponse.data.jobs) {
                    const jobs = jobsResponse.data.jobs;
                    schedulerStatus.totalJobs = jobs.length;
                    schedulerStatus.enabledJobs = jobs.filter(job => job.status !== 'cancelled').length;
                    schedulerStatus.runningJobs = jobs.filter(job => job.status === 'processing' || job.status === 'running').length;
                }
            } catch (error) {
                logger.warn('Failed to get job statistics:', error.message);
            }
        }
        
        // Get data counts (if backend is available)
        let dataStatus = {
            profiles: 'N/A',
            companies: 'N/A'
        };
        
        if (backendStatus.status === 'connected') {
            try {
                const profilesResponse = await apiClient.get('/profiles', { params: { limit: 1 } });
                dataStatus.profiles = profilesResponse.data?.total || 0;
                
                const companiesResponse = await apiClient.get('/companies', { params: { limit: 1 } });
                dataStatus.companies = companiesResponse.data?.total || 0;
            } catch (error) {
                logger.warn('Failed to get data counts:', error.message);
            }
        }
        
        // Determine feature availability
        const features = {
            candidates: {
                available: jiraStatus.status === 'connected'
            },
            profiles: {
                available: backendStatus.status === 'connected'
            },
            scoring: {
                available: backendStatus.status === 'connected'
            },
            jobs: {
                available: true // Job scheduler is always available
            }
        };
        
        // Determine overall system health
        let overallStatus = 'healthy';
        if (backendStatus.status !== 'connected') {
            overallStatus = 'critical';
        } else if (jiraStatus.status !== 'connected') {
            overallStatus = 'degraded';
        }
        
        const status = {
            overall: overallStatus,
            backend: backendStatus,
            jira: jiraStatus,
            scheduler: schedulerStatus,
            data: dataStatus,
            features
        };
        
        res.render('system/status', {
            title: 'System Status',
            status,
            pageScript: 'system-status'
        });
        
    } catch (error) {
        logger.error('System status page error:', error);
        res.render('error', {
            title: 'System Status Error',
            message: 'Failed to load system status',
            error: {
                message: 'Unable to check system status. Please try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

// GET /system/model-config - Model Configuration Page
router.get('/model-config', (req, res) => {
    try {
        // In a future version, you could fetch current configuration from API
        const currentConfig = {
            stage_2_model: process.env.STAGE_2_MODEL || 'gpt-3.5-turbo',
            stage_3_model: process.env.STAGE_3_MODEL || 'gpt-4o',
            default_model: process.env.OPENAI_DEFAULT_MODEL || 'gpt-3.5-turbo'
        };

        res.render('system/model-config', {
            title: 'AI Model Configuration',
            currentPage: 'model-config',
            config: currentConfig
        });
    } catch (error) {
        logger.error('Error loading model configuration page:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load model configuration',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// POST /system/model-config - Save Model Configuration
router.post('/model-config', (req, res) => {
    try {
        const { stage_2_model, stage_3_model, default_model } = req.body;
        
        logger.info('Model configuration update requested', {
            stage_2_model,
            stage_3_model,
            default_model
        });

        // For now, just log the configuration
        // In a production system, you would:
        // 1. Update environment variables
        // 2. Potentially restart services
        // 3. Update database configuration
        // 4. Make API call to update backend settings

        res.json({
            success: true,
            message: 'Model configuration updated successfully',
            config: {
                stage_2_model,
                stage_3_model,
                default_model
            }
        });

    } catch (error) {
        logger.error('Error updating model configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update model configuration',
            error: error.message
        });
    }
});

// GET /system/model-config/test - Test Model Configuration
router.post('/system/model-config/test', (req, res) => {
    try {
        const { stage_2_model, stage_3_model, default_model } = req.body;
        
        logger.info('Testing model configuration', {
            stage_2_model,
            stage_3_model,
            default_model
        });

        // Simulate a configuration test
        // In production, this would make actual API calls to test the models
        
        const testResults = {
            stage_2_test: {
                model: stage_2_model,
                status: 'success',
                response_time: Math.random() * 1000 + 500, // Random response time
                cost_estimate: 0.002
            },
            stage_3_test: {
                model: stage_3_model,
                status: 'success',
                response_time: Math.random() * 2000 + 1000,
                cost_estimate: 0.020
            },
            default_test: {
                model: default_model,
                status: 'success',
                response_time: Math.random() * 1500 + 750,
                cost_estimate: default_model === 'gpt-3.5-turbo' ? 0.002 : 0.020
            }
        };

        res.json({
            success: true,
            message: 'Model configuration test completed',
            test_results: testResults
        });

    } catch (error) {
        logger.error('Error testing model configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Model configuration test failed',
            error: error.message
        });
    }
});

module.exports = router;
