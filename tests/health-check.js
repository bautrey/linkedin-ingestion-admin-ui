#!/usr/bin/env node

/**
 * Lightweight health check for Docker
 * Tests only the most critical pages to determine if the app is healthy
 */

const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3003';

// Critical pages that MUST work for the app to be considered healthy
const CRITICAL_TESTS = [
    { name: 'Health Endpoint', path: '/health' },
    { name: 'Dashboard', path: '/' },
    { name: 'Candidates', path: '/candidates' },
    { name: 'Jobs', path: '/jobs' }
];

const TIMEOUT_MS = 3000; // Shorter timeout for health checks

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: data
                });
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error(`Timeout after ${timeout}ms`));
        });
    });
}

/**
 * Check if response looks like an error
 */
function isErrorResponse(response) {
    const { statusCode, body } = response;
    
    if (statusCode >= 400) {
        return true;
    }
    
    // Check for common error indicators
    if (body.includes('ReferenceError') || 
        body.includes('is not defined') ||
        body.includes('Server Error')) {
        return true;
    }
    
    return false;
}

/**
 * Run health check
 */
async function runHealthCheck() {
    for (const test of CRITICAL_TESTS) {
        const url = `${BASE_URL}${test.path}`;
        
        try {
            const response = await makeRequest(url);
            
            if (isErrorResponse(response)) {
                console.error(`❌ HEALTH CHECK FAILED: ${test.name} returned ${response.statusCode}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error(`❌ HEALTH CHECK FAILED: ${test.name} - ${error.message}`);
            process.exit(1);
        }
    }
    
    console.log('✅ Health check passed');
    process.exit(0);
}

// Run health check
runHealthCheck().catch(error => {
    console.error(`❌ Health check error: ${error.message}`);
    process.exit(1);
});
