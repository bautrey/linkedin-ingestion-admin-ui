const express = require('express');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/templates - Proxy to backend templates endpoint
router.get('/templates', async (req, res) => {
    try {
        const response = await apiClient.get('/templates', { params: req.query });
        res.json(response.data);
    } catch (error) {
        logger.error('Error proxying templates request:', error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch templates',
            message: error.message
        });
    }
});

// GET /api/templates/:id - Proxy to backend template by ID endpoint
router.get('/templates/:id', async (req, res) => {
    try {
        const response = await apiClient.get(`/templates/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying template ${req.params.id} request:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch template',
            message: error.message
        });
    }
});

// PUT /api/templates/:id - Proxy to backend template update endpoint
router.put('/templates/:id', async (req, res) => {
    try {
        const response = await apiClient.put(`/templates/${req.params.id}`, req.body);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying template ${req.params.id} update:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to update template',
            message: error.message
        });
    }
});

// DELETE /api/templates/:id - Proxy to backend template delete endpoint
router.delete('/templates/:id', async (req, res) => {
    try {
        const response = await apiClient.delete(`/templates/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying template ${req.params.id} delete:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to delete template',
            message: error.message
        });
    }
});

// POST /api/templates/:id/test - Proxy to backend template test endpoint
router.post('/templates/:id/test', async (req, res) => {
    try {
        const response = await apiClient.post(`/templates/${req.params.id}/test`, req.body);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying template ${req.params.id} test:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to test template',
            message: error.message
        });
    }
});

// POST /api/profiles/:id/score-template - Proxy to backend profile scoring endpoint
router.post('/profiles/:id/score-template', async (req, res) => {
    try {
        const response = await apiClient.post(`/profiles/${req.params.id}/score-template`, req.body);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying profile ${req.params.id} scoring:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to score profile',
            message: error.message
        });
    }
});

// GET /api/v1/profiles/:id - Proxy to backend profile endpoint  
router.get('/v1/profiles/:id', async (req, res) => {
    try {
        const response = await apiClient.get(`/profiles/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying profile ${req.params.id} request:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch profile',
            message: error.message
        });
    }
});

// GET /api/scoring-jobs - Proxy to backend scoring jobs endpoint
router.get('/scoring-jobs', async (req, res) => {
    try {
        const response = await apiClient.get('/scoring-jobs', { params: req.query });
        res.json(response.data);
    } catch (error) {
        logger.error('Error proxying scoring jobs request:', error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch scoring jobs',
            message: error.message
        });
    }
});

// GET /api/profiles/:id/role-compatibility/latest - Proxy to backend role compatibility endpoint
router.get('/profiles/:id/role-compatibility/latest', async (req, res) => {
    try {
        const response = await apiClient.get(`/profiles/${req.params.id}/role-compatibility/latest`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying role compatibility for profile ${req.params.id}:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch role compatibility',
            message: error.message
        });
    }
});

// GET /api/processing/candidates/:key/history - Proxy to backend processing history endpoint
router.get('/processing/candidates/:key/history', async (req, res) => {
    try {
        const response = await apiClient.get(`/processing/candidates/${req.params.key}/history`);
        res.json(response.data);
    } catch (error) {
        logger.error(`Error proxying processing history for ${req.params.key}:`, error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch processing history',
            message: error.message
        });
    }
});

// POST /api/candidates/:key/process-async - Process single candidate asynchronously
router.post('/candidates/:key/process-async', async (req, res) => {
    try {
        const { key } = req.params;
        logger.info(`🎯 API: Starting async processing for candidate ${key}`);

        // Import candidateProcessingJob and call our new method
        const candidateProcessingJob = require('../services/candidateProcessingJob');
        
        // Start processing asynchronously (don't await)
        const processingPromise = candidateProcessingJob.processSingleCandidateFromUI(key);
        
        // Return immediately with job tracking info
        const jobExecutionId = `ui-${key}-${Date.now()}`;
        
        logger.info(`🎯 API: Async processing started for candidate ${key}`, {
            executionId: jobExecutionId
        });

        res.json({
            success: true,
            message: 'Processing started',
            candidateKey: key,
            executionId: jobExecutionId,
            status: 'started',
            timestamp: new Date().toISOString()
        });

        // Handle the processing result (success or failure) in the background
        processingPromise.then(result => {
            logger.info(`🎯 API: Background processing completed for ${key}`, {
                success: result.success,
                executionId: result.executionId
            });
        }).catch(error => {
            logger.error(`🎯 API: Background processing failed for ${key}`, {
                error: error.message,
                executionId: jobExecutionId
            });
        });

    } catch (error) {
        logger.error(`🎯 API: Failed to start processing for ${req.params.key}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to start processing',
            message: error.message,
            candidateKey: req.params.key
        });
    }
});

module.exports = router;
