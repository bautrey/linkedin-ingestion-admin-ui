const express = require('express');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

const router = express.Router();

// GET /ingestion - Show ingestion dashboard
router.get('/', async (req, res) => {
    try {
        // For now, just show the dashboard without jobs data
        // In the future, this would fetch real ingestion job data
        const jobs = [];
        
        res.render('ingestion/dashboard', {
            title: 'LinkedIn Ingestion',
            jobs: jobs
        });
    } catch (error) {
        logger.error('Error loading ingestion dashboard:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load ingestion dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// GET /ingestion/new - Show ingestion form
router.get('/new', (req, res) => {
    res.render('ingestion/form', {
        title: 'Ingest LinkedIn Profiles'
    });
});

// NOTE: Ingestion job tracking was removed - ingestion is now synchronous
// Jobs route removed as /api/v1/jobs/{id} endpoint doesn't exist

module.exports = router;
