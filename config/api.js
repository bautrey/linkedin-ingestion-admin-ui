const axios = require('axios');
const logger = require('../utils/logger');

// Enhanced environment variable handling with debugging for LIN-13
function getApiBaseUrl() {
    const baseUrl = process.env.FASTAPI_BASE_URL;
    
    if (!baseUrl) {
        logger.warn('🚨 [LIN-13] FASTAPI_BASE_URL environment variable not set!', {
            NODE_ENV: process.env.NODE_ENV,
            availableEnvVars: Object.keys(process.env).filter(k => k.includes('API')),
            defaultingTo: 'http://localhost:8000'
        });
        
        // Default to localhost for development/testing when not in Docker
        return 'http://localhost:8000';
    }
    
    logger.debug('🔍 [LIN-13] API base URL configured', {
        baseUrl,
        NODE_ENV: process.env.NODE_ENV
    });
    
    return baseUrl;
}

function getApiKey() {
    const apiKey = process.env.API_KEY || 'li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I';
    
    logger.debug('🔍 [LIN-13] API key configured', {
        hasApiKey: !!apiKey,
        source: process.env.API_KEY ? 'environment' : 'fallback',
        NODE_ENV: process.env.NODE_ENV
    });
    
    return apiKey;
}

const apiClient = axios.create({
    baseURL: getApiBaseUrl() + '/api/v1',
    headers: {
        'X-API-Key': getApiKey(),
        'Content-Type': 'application/json',
        'User-Agent': 'LinkedIn-Ingestion-Admin-UI/1.0'
    },
    timeout: 30000 // 30 second timeout
});

// Log the final configuration for debugging
logger.info('🔧 [LIN-13] API client initialized', {
    baseURL: apiClient.defaults.baseURL,
    hasApiKey: !!apiClient.defaults.headers['X-API-Key'],
    timeout: apiClient.defaults.timeout,
    NODE_ENV: process.env.NODE_ENV
});

// Request interceptor for logging and debugging
apiClient.interceptors.request.use(
    (request) => {
        logger.debug(`API Request: ${request.method?.toUpperCase()} ${request.url}`, {
            params: request.params,
            data: request.data ? '[DATA]' : undefined
        });
        return request;
    },
    (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling and logging
apiClient.interceptors.response.use(
    (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            dataLength: response.data ? JSON.stringify(response.data).length : 0
        });
        return response;
    },
    (error) => {
        if (error.response) {
            // Server responded with error status
            logger.error(`API Error Response: ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            // Request was made but no response received
            logger.error('API No Response:', {
                method: error.config?.method,
                url: error.config?.url,
                message: error.message
            });
        } else {
            // Something else happened
            logger.error('API Request Setup Error:', error.message);
        }
        
        return Promise.reject(error);
    }
);

module.exports = apiClient;
