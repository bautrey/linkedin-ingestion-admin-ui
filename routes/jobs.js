const express = require('express');
const router = express.Router();
const apiClient = require('../config/api');
const logger = require('../utils/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Helper function to get API URL
function getApiUrl() {
    return process.env.FASTAPI_BASE_URL || 'https://api-docker-production.up.railway.app';
}

// Import jobScheduler for local job management
const jobScheduler = require('../services/jobScheduler');

// Jobs dashboard page
router.get('/', async (req, res) => {
    try {
        // Get jobs from local job scheduler (candidate processing jobs)
        const localJobs = await jobScheduler.getJobStatus();
        const jobHistory = await jobScheduler.getJobHistory(null, 50);
        
        let jobs = [];
        let recentHistory = [];
        let stats = {
            totalJobs: 0,
            runningJobs: 0,
            failedJobs: 0,
            enabledJobs: 0,
            recentSuccessful: 0,
            recentFailed: 0,
            recentTotal: 0
        };
        
        // Process local candidate processing jobs
        if (localJobs && localJobs.length > 0) {
            jobs = localJobs.map(job => ({
                id: job.name,
                name: job.name,
                status: job.status,
                enabled: job.enabled,
                last_run: job.lastRun,
                next_run: job.nextRun,
                run_count: job.runCount,
                fail_count: job.failCount,
                last_result: job.lastResult,
                type: 'candidate-processing',
                category: 'Ingestion Jobs',
                created_at: job.lastRun || new Date().toISOString()
            }));
            
            stats.totalJobs = jobs.length;
            stats.runningJobs = jobs.filter(job => job.status === 'running').length;
            stats.failedJobs = jobs.filter(job => job.last_result && !job.last_result.success).length;
            stats.enabledJobs = jobs.filter(job => job.enabled).length;
            
            // Process job history for recent stats
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentExecutions = jobHistory.filter(execution => 
                new Date(execution.startTime) > oneDayAgo
            );
            
            stats.recentTotal = recentExecutions.length;
            stats.recentSuccessful = recentExecutions.filter(execution => execution.success).length;
            stats.recentFailed = recentExecutions.filter(execution => !execution.success).length;
            
            recentHistory = jobHistory.slice(0, 20).map(execution => ({
                id: execution.id,
                name: execution.jobName,
                status: execution.success ? 'completed' : 'failed',
                start_time: execution.startTime,
                end_time: execution.endTime,
                duration: execution.duration,
                success: execution.success,
                error: execution.error,
                result: execution.result,
                isDryRun: execution.isDryRun,
                created_at: execution.startTime
            }));
        }
        
        try {
            // Also try to get scoring jobs using apiClient
            const scoringResponse = await apiClient.get('/scoring-jobs');
            
            if (scoringResponse.data && Array.isArray(scoringResponse.data)) {
                const scoringJobs = scoringResponse.data.slice(0, 25); // Add some scoring jobs
                jobs = [...jobs, ...scoringJobs];
                
                // Update stats with scoring jobs
                stats.totalJobs = jobs.length;
                stats.runningJobs += scoringJobs.filter(job => job.status === 'processing' || job.status === 'running').length;
                stats.failedJobs += scoringJobs.filter(job => job.status === 'failed' || job.status === 'error').length;
                
                recentHistory = [...recentHistory, ...scoringJobs.slice(0, 10)];
            }
        } catch (scoringError) {
            logger.warn('Could not fetch scoring jobs from API:', scoringError.message);
        }
        
        res.render('jobs/dashboard', {
            title: 'Job Dashboard',
            jobs: jobs.slice(0, 100), // Limit display
            recentHistory: recentHistory.slice(0, 50),
            stats,
            pageScript: 'jobs'
        });
        
    } catch (error) {
        logger.error('Jobs dashboard error:', error);
        res.render('error', {
            title: 'Jobs Error',
            message: 'Failed to load jobs dashboard',
            error: {
                message: 'Failed to load job information. The job scheduler service may not be available.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

// Get job status API endpoint
router.get('/api/status', async (req, res) => {
    try {
        const apiUrl = getApiUrl();
        let allJobs = [];
        
        // Note: Ingestion jobs are handled by local job scheduler, not backend API
        
        // Fetch scoring jobs
        try {
            const scoringResponse = await axios.get(`${apiUrl}/api/v1/scoring-jobs`, {
                timeout: 5000,
                headers: {
                    'Accept': 'application/json',
                    'X-API-Key': process.env.API_KEY
                }
            });
            
            if (scoringResponse.data && Array.isArray(scoringResponse.data)) {
                allJobs = [...allJobs, ...scoringResponse.data.slice(0, 50)];
            }
        } catch (apiError) {
            logger.warn('Could not fetch scoring jobs:', apiError.message);
        }
        
        res.json({
            success: true,
            jobs: allJobs,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Get job status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get job history API endpoint
router.get('/api/history', async (req, res) => {
    try {
        const { jobName, limit = 100 } = req.query;
        const apiUrl = getApiUrl();
        
        // For now, return the same as status since we don't have separate history endpoint
        let history = [];
        
        // If specific job name requested, try to find it
        if (jobName) {
            try {
                // Try to get specific job details (could be ingestion or scoring)
                let jobFound = false;
                
                // Try ingestion jobs first
                try {
                    const ingestionResponse = await axios.get(`${apiUrl}/api/v1/ingestion-jobs/${jobName}`, {
                        timeout: 5000,
                        headers: {
                            'Accept': 'application/json',
                            'X-API-Key': process.env.API_KEY
                        }
                    });
                    
                    if (ingestionResponse.data) {
                        history = [ingestionResponse.data];
                        jobFound = true;
                    }
                } catch (ingestionError) {
                    // Try scoring jobs
                    try {
                        const scoringResponse = await axios.get(`${apiUrl}/api/v1/scoring-jobs/${jobName}`, {
                            timeout: 5000,
                            headers: {
                                'Accept': 'application/json',
                                'X-API-Key': process.env.API_KEY
                            }
                        });
                        
                        if (scoringResponse.data) {
                            history = [scoringResponse.data];
                            jobFound = true;
                        }
                    } catch (scoringError) {
                        logger.warn(`Job ${jobName} not found in either ingestion or scoring jobs`);
                    }
                }
            } catch (error) {
                logger.warn(`Could not fetch specific job ${jobName}:`, error.message);
            }
        } else {
            // Return general job history (same as status for now)
            const statusResponse = await axios.get(`${req.protocol}://${req.get('host')}/jobs/api/status`);
            if (statusResponse.data && statusResponse.data.jobs) {
                history = statusResponse.data.jobs.slice(0, parseInt(limit));
            }
        }
        
        res.json({
            success: true,
            history,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Get job history error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Job trigger endpoint - supports local jobs
router.post('/api/:jobName/trigger', async (req, res) => {
    try {
        const { jobName } = req.params;
        logger.info(`🔧 DEBUG: Trigger endpoint called for job '${jobName}'`);
        
        // Check if this is a local job first
        logger.info(`🔧 DEBUG: Getting job status for all local jobs...`);
        const allLocalJobs = await jobScheduler.getJobStatus();
        logger.info(`🔧 DEBUG: Found ${allLocalJobs.length} local jobs:`, allLocalJobs.map(j => j.name));
        
        const localJobStatus = allLocalJobs.find(job => job.name === jobName);
        if (localJobStatus) {
            logger.info(`🔧 DEBUG: Job '${jobName}' found locally, triggering...`);
            // Trigger local job
            const result = await jobScheduler.triggerJob(jobName);
            logger.info(`🔧 DEBUG: Job '${jobName}' trigger completed with result:`, result);
            return res.json({ success: true, message: `Job '${jobName}' triggered successfully`, result });
        }
        
        // Fallback to backend API jobs (not implemented)
        res.status(501).json({
            success: false,
            error: 'Job triggering not available for backend API jobs'
        });
    } catch (error) {
        logger.error('Trigger job error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Job dry-run endpoint - supports local jobs
router.post('/api/:jobName/dry-run', async (req, res) => {
    try {
        const { jobName } = req.params;
        const dryRunOptions = req.body || {};
        
        // Check if this is a local job first
        const allLocalJobs = await jobScheduler.getJobStatus();
        const localJobStatus = allLocalJobs.find(job => job.name === jobName);
        if (localJobStatus) {
            // Trigger local job in dry-run mode
            const result = await jobScheduler.triggerJob(jobName, true, dryRunOptions);
            return res.json({ success: true, message: `Dry-run completed for job '${jobName}'`, result });
        }
        
        // Fallback to backend API jobs (not implemented)
        res.status(501).json({
            success: false,
            error: 'Dry-run not available for backend API jobs'
        });
    } catch (error) {
        logger.error('Dry-run job error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/:jobName/status', async (req, res) => {
    try {
        const { jobName } = req.params;
        const apiUrl = getApiUrl();
        
        let jobStatus = null;
        let recentHistory = [];
        
        // First, check if this is a local job (candidate processing jobs)
        try {
            const allLocalJobs = await jobScheduler.getJobStatus();
            const localJobStatus = allLocalJobs.find(job => job.name === jobName);
            if (localJobStatus) {
                // Get history for local job
                const localHistory = await jobScheduler.getJobHistory(jobName, 10);
                
                jobStatus = {
                    id: localJobStatus.name,
                    name: localJobStatus.name,
                    status: localJobStatus.status,
                    enabled: localJobStatus.enabled,
                    last_run: localJobStatus.lastRun,
                    next_run: localJobStatus.nextRun,
                    run_count: localJobStatus.runCount,
                    fail_count: localJobStatus.failCount,
                    last_result: localJobStatus.lastResult,
                    type: 'local-job',
                    category: 'Local Processing'
                };
                
                recentHistory = localHistory.map(execution => ({
                    id: execution.id,
                    name: execution.jobName,
                    status: execution.success ? 'completed' : 'failed',
                    startTime: execution.startTime,
                    endTime: execution.endTime,
                    duration: execution.duration,
                    success: execution.success,
                    error: execution.error,
                    result: execution.result
                }));
            }
        } catch (localError) {
            logger.warn('Could not check local jobs:', localError.message);
        }
        
        // If not found locally, try backend jobs
        if (!jobStatus) {
            // Try to find the job in ingestion jobs
            try {
                const ingestionResponse = await axios.get(`${apiUrl}/api/v1/ingestion-jobs/${jobName}`, {
                    timeout: 5000,
                    headers: {
                        'Accept': 'application/json',
                        'X-API-Key': process.env.API_KEY
                    }
                });
                
                if (ingestionResponse.data) {
                    jobStatus = ingestionResponse.data;
                    recentHistory = [jobStatus]; // Single job for now
                }
            } catch (ingestionError) {
                // Try scoring jobs
                try {
                    const scoringResponse = await axios.get(`${apiUrl}/api/v1/scoring-jobs/${jobName}`, {
                        timeout: 5000,
                        headers: {
                            'Accept': 'application/json',
                            'X-API-Key': process.env.API_KEY
                        }
                    });
                    
                    if (scoringResponse.data) {
                        jobStatus = scoringResponse.data;
                        recentHistory = [jobStatus];
                    }
                } catch (scoringError) {
                    return res.status(404).json({
                        success: false,
                        error: `Job '${jobName}' not found`
                    });
                }
            }
        }
        
        res.json({
            success: true,
            job: jobStatus,
            recentHistory,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error(`Get job status error for ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start/stop job endpoint - supports local jobs
router.post('/api/:jobName/:action', async (req, res) => {
    try {
        const { jobName, action } = req.params;
        
        // Check if this is a local job first
        const allLocalJobs = await jobScheduler.getJobStatus();
        const localJobStatus = allLocalJobs.find(job => job.name === jobName);
        if (localJobStatus) {
            if (action === 'start') {
                jobScheduler.enableJob(jobName);
                return res.json({ success: true, message: `Job '${jobName}' started successfully` });
            } else if (action === 'stop') {
                jobScheduler.disableJob(jobName);
                return res.json({ success: true, message: `Job '${jobName}' stopped successfully` });
            } else {
                return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
            }
        }
        
        // Fallback to backend API jobs (not implemented)
        res.status(501).json({
            success: false,
            error: 'Job control not available for backend API jobs'
        });
    } catch (error) {
        logger.error('Job control error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve job source code (local jobs)
router.get('/api/:jobName/source', async (req, res) => {
    try {
        const { jobName } = req.params;
        // Only allow local jobs (managed by jobScheduler)
        const allLocalJobs = await jobScheduler.getJobStatus();
        const localJobStatus = allLocalJobs.find(job => job.name === jobName);
        if (!localJobStatus) {
            return res.status(404).json({ success: false, error: `Local job '${jobName}' not found` });
        }

        // Try to locate config with file info
        const config = localJobStatus.config || {};
        let configFile = config.configFile || '';
        let configLines = config.configLines || '';

        if (!configFile) {
            // Fallback: known mapping for candidate processing jobs
            if (jobName === 'process-recent-candidates' || jobName === 'process-older-candidates') {
                configFile = '/app/services/candidateProcessingJob.js';
                configLines = '1-9999';
            } else {
                return res.status(400).json({ success: false, error: 'No config file specified for this job' });
            }
        }

        // Map container path /app/* to local project path
        const projectRoot = path.resolve(__dirname, '..');
        let localPath = configFile;
        if (configFile.startsWith('/app/')) {
            localPath = path.join(projectRoot, configFile.replace('/app/', ''));
        } else if (!path.isAbsolute(configFile)) {
            localPath = path.join(projectRoot, configFile);
        }

        // Security: ensure file resides within projectRoot
        const normalized = path.normalize(localPath);
        if (!normalized.startsWith(projectRoot)) {
            return res.status(400).json({ success: false, error: 'Invalid file path' });
        }

        if (!fs.existsSync(normalized)) {
            return res.status(404).json({ success: false, error: 'Source file not found', filePath: normalized });
        }

        const content = fs.readFileSync(normalized, 'utf8');

        // Optionally slice by lines if provided like "18-30"
        let startLine = 1;
        let endLine = undefined;
        let sliced = content;
        if (configLines && /\d+-\d+/.test(configLines)) {
            const [s, e] = configLines.split('-').map(n => parseInt(n, 10));
            if (!isNaN(s) && !isNaN(e) && s > 0 && e >= s) {
                startLine = s;
                endLine = e;
                const lines = content.split('\n');
                sliced = lines.slice(s - 1, e).join('\n');
            }
        }

        // Return user-friendly display path (relative to project if possible)
        let displayPath = normalized;
        if (normalized.startsWith(projectRoot)) {
            displayPath = path.relative(projectRoot, normalized);
            if (!displayPath.startsWith('.')) {
                displayPath = './' + displayPath;
            }
        }

        return res.json({
            success: true,
            filePath: displayPath,
            fullPath: normalized,
            startLine,
            endLine,
            content: sliced
        });
    } catch (error) {
        logger.error('Get job source error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Job details page
router.get('/:jobName', async (req, res) => {
    try {
        const { jobName } = req.params;
        const apiUrl = getApiUrl();
        
        let jobStatus = null;
        let jobHistory = [];
        
        // Try to find the job
        try {
            const statusResponse = await axios.get(`${req.protocol}://${req.get('host')}/jobs/api/${jobName}/status`);
            if (statusResponse.data && statusResponse.data.success) {
                jobStatus = statusResponse.data.job;
                jobHistory = statusResponse.data.recentHistory || [];
            }
        } catch (error) {
            return res.status(404).render('error', {
                title: 'Job Not Found',
                message: `Job '${jobName}' not found`,
                error: {
                    message: error.message,
                    status: 404
                }
            });
        }
        
        // Calculate basic stats
        const stats = {
            totalRuns: jobHistory.length,
            successfulRuns: jobHistory.filter(run => run.status === 'completed').length,
            failedRuns: jobHistory.filter(run => run.status === 'failed' || run.status === 'error').length,
            successRate: 0,
            avgDuration: 0
        };
        
        if (stats.totalRuns > 0) {
            stats.successRate = ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1);
        }
        
        res.render('jobs/detail', {
            title: `Job: ${jobName}`,
            jobName,
            job: jobStatus,
            history: jobHistory,
            stats,
            pageScript: 'job-detail'
        });
        
    } catch (error) {
        logger.error(`Job detail error for ${req.params.jobName}:`, error);
        res.render('error', {
            title: 'Job Error',
            message: `Failed to load job '${req.params.jobName}'`,
            error: {
                message: 'Failed to load job details. Please try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
});

module.exports = router;
