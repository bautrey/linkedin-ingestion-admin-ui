#!/usr/bin/env node

/**
 * Favicon Browser Testing Script
 * 
 * This script helps automate the browser testing process by:
 * 1. Starting the development server
 * 2. Opening multiple browsers for testing
 * 3. Providing testing instructions
 * 4. Validating favicon accessibility
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    serverPort: 3003,
    serverUrl: 'http://localhost:3003',
    browsers: {
        chrome: {
            name: 'Google Chrome',
            macCommand: 'open -a "Google Chrome"',
            windowsCommand: 'start chrome',
            linuxCommand: 'google-chrome'
        },
        firefox: {
            name: 'Mozilla Firefox',
            macCommand: 'open -a "Firefox"',
            windowsCommand: 'start firefox',
            linuxCommand: 'firefox'
        },
        safari: {
            name: 'Safari',
            macCommand: 'open -a "Safari"',
            windowsCommand: null, // Safari not available on Windows
            linuxCommand: null // Safari not available on Linux
        },
        edge: {
            name: 'Microsoft Edge',
            macCommand: 'open -a "Microsoft Edge"',
            windowsCommand: 'start msedge',
            linuxCommand: 'microsoft-edge'
        }
    },
    testPages: [
        '/',
        '/dashboard',
        '/candidates',
        '/jobs',
        '/system'
    ]
};

// Utility functions
function getOS() {
    const platform = process.platform;
    if (platform === 'darwin') return 'mac';
    if (platform === 'win32') return 'windows';
    if (platform === 'linux') return 'linux';
    return 'unknown';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function validateFaviconFiles() {
    console.log('📁 Validating favicon files...');
    
    const requiredFiles = [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-64x64.png'
    ];
    
    const publicDir = path.join(__dirname, 'public');
    const missingFiles = [];
    
    requiredFiles.forEach(file => {
        const filePath = path.join(publicDir, file);
        if (!fs.existsSync(filePath)) {
            missingFiles.push(file);
        } else {
            const stats = fs.statSync(filePath);
            console.log(`  ✅ ${file} (${stats.size} bytes)`);
        }
    });
    
    if (missingFiles.length > 0) {
        console.log('\n❌ Missing favicon files:');
        missingFiles.forEach(file => console.log(`  - ${file}`));
        return false;
    }
    
    console.log('✅ All favicon files present');
    return true;
}

function checkServerStatus() {
    return new Promise((resolve) => {
        exec(`curl -s -o /dev/null -w "%{http_code}" ${CONFIG.serverUrl}`, (error, stdout) => {
            const statusCode = stdout.trim();
            resolve(statusCode === '200');
        });
    });
}

async function startServer() {
    console.log('🚀 Starting development server...');
    
    const serverProcess = exec('npm start', (error, stdout, stderr) => {
        if (error) {
            console.error(`Server error: ${error}`);
            return;
        }
    });
    
    // Wait for server to start
    console.log('⏳ Waiting for server to start...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (attempts < maxAttempts) {
        const isRunning = await checkServerStatus();
        if (isRunning) {
            console.log(`✅ Server started successfully at ${CONFIG.serverUrl}`);
            return serverProcess;
        }
        
        await sleep(1000);
        attempts++;
        process.stdout.write('.');
    }
    
    throw new Error('Server failed to start within 30 seconds');
}

function openBrowser(browserKey, url) {
    const os = getOS();
    const browser = CONFIG.browsers[browserKey];
    
    if (!browser) {
        console.log(`❌ Unknown browser: ${browserKey}`);
        return false;
    }
    
    let command;
    switch (os) {
        case 'mac':
            command = browser.macCommand;
            break;
        case 'windows':
            command = browser.windowsCommand;
            break;
        case 'linux':
            command = browser.linuxCommand;
            break;
        default:
            console.log(`❌ Unsupported OS: ${os}`);
            return false;
    }
    
    if (!command) {
        console.log(`❌ ${browser.name} not available on ${os}`);
        return false;
    }
    
    const fullCommand = `${command} "${url}"`;
    
    exec(fullCommand, (error) => {
        if (error) {
            console.log(`❌ Failed to open ${browser.name}: ${error.message}`);
        } else {
            console.log(`✅ Opened ${browser.name}`);
        }
    });
    
    return true;
}

function displayTestingInstructions() {
    console.log('\n📋 MANUAL TESTING INSTRUCTIONS');
    console.log('================================');
    console.log('\nFor each browser window that opened, please verify:');
    console.log('\n🔍 TAB TESTING:');
    console.log('  1. Check if custom favicon appears in browser tab');
    console.log('  2. Open multiple tabs with different pages');
    console.log('  3. Verify favicon shows in all tabs');
    console.log('\n🔖 BOOKMARK TESTING:');
    console.log('  1. Create a bookmark (Ctrl+D / Cmd+D)');
    console.log('  2. Check if favicon appears in bookmark');
    console.log('  3. Verify favicon in bookmarks bar/menu');
    console.log('\n🎨 THEME TESTING:');
    console.log('  1. Test in light browser theme');
    console.log('  2. Switch to dark browser theme');
    console.log('  3. Verify favicon visibility in both themes');
    console.log('\n📱 RESPONSIVE TESTING:');
    console.log('  1. Test different zoom levels (100%, 125%, 150%)');
    console.log('  2. Check favicon sharpness on high DPI displays');
    console.log('\nTest Pages to Visit:');
    CONFIG.testPages.forEach(page => {
        console.log(`  - ${CONFIG.serverUrl}${page}`);
    });
    console.log('\n✅ EXPECTED RESULT: Custom data pipeline favicon should appear in all contexts');
    console.log('❌ FAILURE: Default browser icon or no icon appears');
}

function displayTestResults() {
    console.log('\n📊 TEST RESULTS CHECKLIST');
    console.log('=========================');
    console.log('\nPlease mark your results:');
    console.log('\n[ ] Chrome - Tab Display');
    console.log('[ ] Chrome - Bookmark Display');
    console.log('[ ] Chrome - Light Theme');
    console.log('[ ] Chrome - Dark Theme');
    console.log('\n[ ] Firefox - Tab Display');
    console.log('[ ] Firefox - Bookmark Display');
    console.log('[ ] Firefox - Light Theme');
    console.log('[ ] Firefox - Dark Theme');
    console.log('\n[ ] Safari - Tab Display');
    console.log('[ ] Safari - Bookmark Display');
    console.log('[ ] Safari - Light Theme');
    console.log('[ ] Safari - Dark Theme');
    console.log('\n[ ] Edge - Tab Display');
    console.log('[ ] Edge - Bookmark Display');
    console.log('[ ] Edge - Light Theme');
    console.log('[ ] Edge - Dark Theme');
    console.log('\n📝 Save results to: manual-test-results.txt');
}

async function runFaviconTests() {
    console.log('🔧 FAVICON BROWSER TESTING UTILITY');
    console.log('===================================\n');
    
    // Step 1: Validate favicon files
    if (!validateFaviconFiles()) {
        console.log('\n❌ Please ensure all favicon files are present before testing');
        process.exit(1);
    }
    
    // Step 2: Check if server is already running
    console.log('\n🔍 Checking server status...');
    const serverRunning = await checkServerStatus();
    
    let serverProcess = null;
    if (!serverRunning) {
        try {
            serverProcess = await startServer();
        } catch (error) {
            console.error(`\n❌ ${error.message}`);
            process.exit(1);
        }
    } else {
        console.log(`✅ Server already running at ${CONFIG.serverUrl}`);
    }
    
    // Step 3: Open browsers for testing
    console.log('\n🌐 Opening browsers for testing...');
    const os = getOS();
    const availableBrowsers = [];
    
    for (const [key, browser] of Object.entries(CONFIG.browsers)) {
        let command;
        switch (os) {
            case 'mac':
                command = browser.macCommand;
                break;
            case 'windows':
                command = browser.windowsCommand;
                break;
            case 'linux':
                command = browser.linuxCommand;
                break;
        }
        
        if (command) {
            availableBrowsers.push(key);
            // Small delay between browser opens
            setTimeout(() => {
                openBrowser(key, CONFIG.serverUrl);
            }, availableBrowsers.length * 2000);
        }
    }
    
    if (availableBrowsers.length === 0) {
        console.log(`❌ No supported browsers found for ${os}`);
        process.exit(1);
    }
    
    console.log(`\n📱 Opening ${availableBrowsers.length} browsers: ${availableBrowsers.join(', ')}`);
    
    // Step 4: Display testing instructions
    setTimeout(() => {
        displayTestingInstructions();
        displayTestResults();
        
        console.log('\n⏹️  Press Ctrl+C to stop the server when testing is complete');
    }, 5000);
    
    // Handle cleanup
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down testing environment...');
        if (serverProcess) {
            serverProcess.kill('SIGINT');
        }
        process.exit(0);
    });
}

// Run the testing utility if called directly
if (require.main === module) {
    runFaviconTests().catch(error => {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    runFaviconTests,
    validateFaviconFiles,
    openBrowser,
    CONFIG
};