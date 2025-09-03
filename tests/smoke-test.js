#!/usr/bin/env node

/**
 * Smoke tests for LinkedIn Ingestion Admin UI
 * These tests verify that all main pages load without server errors
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3003';

// Test configuration
const TESTS = [
    { name: 'Dashboard', path: '/' },
    { name: 'Profiles', path: '/profiles' },
    { name: 'Companies', path: '/companies' },
    { name: 'Candidates', path: '/candidates' },
    { name: 'Ingestion', path: '/ingestion' },
    { name: 'Scoring', path: '/scoring' },
    { name: 'Templates', path: '/templates' },
    { name: 'Job Scheduler', path: '/jobs' },
    { name: 'System Status', path: '/system/status' },
    { name: 'Model Config', path: '/system/model-config' },
    // Test some job detail pages
    { name: 'Recent Candidates Job', path: '/jobs/process-recent-candidates' },
    { name: 'Older Candidates Job', path: '/jobs/process-older-candidates' }
];

const TIMEOUT_MS = 5000;

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        
        const request = http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    responseTime
                });
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
    });
}

/**
 * Check if response looks like an error page
 */
function isErrorResponse(response) {
    const { statusCode, body } = response;
    
    // Check for HTTP error status
    if (statusCode >= 400) {
        return true;
    }
    
    // Check for common error indicators in HTML
    if (body.includes('ReferenceError') || 
        body.includes('TypeError') || 
        body.includes('SyntaxError') ||
        body.includes('is not defined') ||
        body.includes('Cannot read property') ||
        body.includes('Server Error') ||
        body.includes('500 Internal Server Error')) {
        return true;
    }
    
    return false;
}

/**
 * Run a single test
 */
async function runTest(test) {
    const url = `${BASE_URL}${test.path}`;
    
    try {
        const response = await makeRequest(url);
        
        if (isErrorResponse(response)) {
            return {
                ...test,
                success: false,
                error: `Error response (${response.statusCode})`,
                statusCode: response.statusCode,
                responseTime: response.responseTime
            };
        }
        
        // Basic content checks
        const hasTitle = response.body.includes('<title>');
        const hasBootstrap = response.body.includes('bootstrap');
        
        return {
            ...test,
            success: true,
            statusCode: response.statusCode,
            responseTime: response.responseTime,
            hasTitle,
            hasBootstrap,
            contentLength: response.body.length
        };
        
    } catch (error) {
        return {
            ...test,
            success: false,
            error: error.message,
            statusCode: null,
            responseTime: null
        };
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🧪 Starting Admin UI Smoke Tests\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Tests to run: ${TESTS.length}\n`);
    
    const startTime = performance.now();
    const results = [];
    
    // Run tests sequentially to avoid overwhelming the server
    for (const test of TESTS) {
        process.stdout.write(`Testing ${test.name.padEnd(25)} ${test.path.padEnd(30)} `);
        
        const result = await runTest(test);
        results.push(result);
        
        if (result.success) {
            console.log(`✅ ${result.statusCode} (${result.responseTime}ms)`);
        } else {
            console.log(`❌ ${result.error}`);
        }
    }
    
    const endTime = performance.now();
    const totalTime = Math.round(endTime - startTime);
    
    // Summary
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average response time: ${Math.round(results.filter(r => r.responseTime).reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.responseTime).length)}ms`);
    
    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`  - ${result.name}: ${result.error}`);
        });
        
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    }
}

/**
 * Health check - wait for server to be ready
 */
async function waitForServer(maxAttempts = 30) {
    console.log('⏳ Waiting for server to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await makeRequest(`${BASE_URL}/health`, 2000);
            console.log('✅ Server is ready\n');
            return true;
        } catch (error) {
            if (i === maxAttempts - 1) {
                console.error('❌ Server failed to start within timeout');
                return false;
            }
            
            process.stdout.write('.');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

/**
 * Main execution
 */
async function main() {
    // Wait for server if needed
    if (process.env.WAIT_FOR_SERVER === 'true') {
        const ready = await waitForServer();
        if (!ready) {
            process.exit(1);
        }
    }
    
    await runAllTests();
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = { runAllTests, runTest, makeRequest };
