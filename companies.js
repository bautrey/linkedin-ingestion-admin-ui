const express = require('express');
const apiClient = require('../config/api');
const logger = require('../utils/logger');

const router = express.Router();

// GET /companies - List all companies
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        
        const params = {
            page: parseInt(page),
            limit: parseInt(limit)
        };
        
        if (search) params.search = search;
        
        const response = await apiClient.get('/companies', { params });
        
        res.render('companies/list', {
            title: 'Companies',
            companies: response.data.data || [],
            pagination: response.data.pagination || {},
            query: req.query
        });
    } catch (error) {
        logger.error('Error fetching companies:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load companies',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// GET /companies/:id - View single company
router.get('/:id', async (req, res) => {
    try {
        const [companyResponse, profilesResponse] = await Promise.all([
            apiClient.get(`/companies/${req.params.id}`),
            apiClient.get(`/companies/${req.params.id}/profiles`)
        ]);
        
        res.render('companies/detail', {
            title: `Company: ${companyResponse.data.name}`,
            company: companyResponse.data,
            profiles: profilesResponse.data.data || []
        });
    } catch (error) {
        logger.error(`Error fetching company ${req.params.id}:`, error);
        if (error.response && error.response.status === 404) {
            res.status(404).render('error', {
                title: 'Company Not Found',
                message: 'The requested company could not be found'
            });
        } else {
            res.status(500).render('error', {
                title: 'Error',
                message: 'Failed to load company',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }
});

module.exports = router;
