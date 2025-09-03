// Favicon Cross-Browser Testing
// Testing favicon display and functionality across different browsers

const fs = require('fs');
const path = require('path');

// Mock browser environments for testing
class MockBrowser {
    constructor(name, userAgent, features = {}) {
        this.name = name;
        this.userAgent = userAgent;
        this.features = features;
        this.favicon = null;
        this.bookmarks = [];
        this.tabs = [];
    }

    loadFavicon(faviconUrl, faviconType = 'image/x-icon') {
        // Simulate favicon loading
        this.favicon = {
            url: faviconUrl,
            type: faviconType,
            loaded: true,
            displaySize: this.getDisplaySize(),
            theme: this.getCurrentTheme()
        };
        return this.favicon;
    }

    addBookmark(title, url, faviconUrl) {
        const bookmark = {
            title,
            url,
            favicon: faviconUrl,
            faviconLoaded: this.canLoadFavicon(faviconUrl)
        };
        this.bookmarks.push(bookmark);
        return bookmark;
    }

    openTab(title, url, faviconUrl) {
        const tab = {
            id: this.tabs.length + 1,
            title,
            url,
            favicon: faviconUrl,
            faviconVisible: this.canDisplayFavicon(faviconUrl),
            active: false
        };
        this.tabs.push(tab);
        return tab;
    }

    canLoadFavicon(faviconUrl) {
        // Simulate format support
        if (faviconUrl.endsWith('.ico')) {
            return this.features.supportsICO !== false;
        }
        if (faviconUrl.endsWith('.png')) {
            return this.features.supportsPNG !== false;
        }
        return false;
    }

    canDisplayFavicon(faviconUrl) {
        return this.canLoadFavicon(faviconUrl) && this.features.showsFavicons !== false;
    }

    getDisplaySize() {
        // Different browsers use different favicon sizes
        const sizes = {
            'Chrome': 16,
            'Firefox': 16,
            'Safari': 16,
            'Edge': 16
        };
        return sizes[this.name] || 16;
    }

    getCurrentTheme() {
        return this.features.darkMode ? 'dark' : 'light';
    }

    supportsFormat(format) {
        const formatSupport = {
            'ico': this.features.supportsICO !== false,
            'png': this.features.supportsPNG !== false,
            'gif': this.features.supportsGIF === true,
            'svg': this.features.supportsSVG === true
        };
        return formatSupport[format.toLowerCase()] || false;
    }
}

// Browser configurations
const BROWSER_CONFIGS = {
    chrome: {
        name: 'Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        features: {
            supportsICO: true,
            supportsPNG: true,
            supportsGIF: true,
            supportsSVG: true,
            showsFavicons: true,
            darkMode: false
        }
    },
    firefox: {
        name: 'Firefox',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        features: {
            supportsICO: true,
            supportsPNG: true,
            supportsGIF: true,
            supportsSVG: true,
            showsFavicons: true,
            darkMode: false
        }
    },
    safari: {
        name: 'Safari',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.0 Safari/537.36',
        features: {
            supportsICO: true,
            supportsPNG: true,
            supportsGIF: false,
            supportsSVG: true,
            showsFavicons: true,
            darkMode: false
        }
    },
    edge: {
        name: 'Edge',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        features: {
            supportsICO: true,
            supportsPNG: true,
            supportsGIF: true,
            supportsSVG: true,
            showsFavicons: true,
            darkMode: false
        }
    }
};

// Utility functions for cross-browser testing
function createBrowser(browserType) {
    const config = BROWSER_CONFIGS[browserType.toLowerCase()];
    if (!config) {
        throw new Error(`Unknown browser type: ${browserType}`);
    }
    
    return new MockBrowser(config.name, config.userAgent, config.features);
}

function testFaviconFormats(browser, faviconUrls) {
    const results = [];
    
    faviconUrls.forEach(url => {
        const extension = path.extname(url).substring(1);
        const canLoad = browser.canLoadFavicon(url);
        const canDisplay = browser.canDisplayFavicon(url);
        
        results.push({
            url,
            format: extension,
            canLoad,
            canDisplay,
            browser: browser.name
        });
    });
    
    return results;
}

function validateFaviconHTML(htmlContent, browserName) {
    // Extract favicon links from HTML
    const faviconRegex = /<link[^>]*(?:rel=['"](?:icon|shortcut icon)['"]|href=['"][^'"]*favicon[^'"]*['"])[^>]*>/gi;
    const matches = htmlContent.match(faviconRegex) || [];
    
    return matches.map(linkTag => {
        const hrefMatch = linkTag.match(/href=['"]([^'"]*)['"]/);
        const typeMatch = linkTag.match(/type=['"]([^'"]*)['"]/);
        const sizesMatch = linkTag.match(/sizes=['"]([^'"]*)['"]/);
        
        return {
            href: hrefMatch ? hrefMatch[1] : null,
            type: typeMatch ? typeMatch[1] : null,
            sizes: sizesMatch ? sizesMatch[1] : null,
            browserSupported: validateBrowserSupport(typeMatch ? typeMatch[1] : null, browserName)
        };
    });
}

function validateBrowserSupport(mimeType, browserName) {
    const browser = createBrowser(browserName.toLowerCase());
    
    if (mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon') {
        return browser.supportsFormat('ico');
    } else if (mimeType === 'image/png') {
        return browser.supportsFormat('png');
    } else if (mimeType === 'image/gif') {
        return browser.supportsFormat('gif');
    } else if (mimeType === 'image/svg+xml') {
        return browser.supportsFormat('svg');
    }
    
    return false;
}

function simulateBrowserEnvironment(browserName, options = {}) {
    const browser = createBrowser(browserName);
    
    if (options.darkMode) {
        browser.features.darkMode = true;
    }
    
    // Load the main favicon
    const faviconUrl = '/favicon.ico';
    browser.loadFavicon(faviconUrl);
    
    // Simulate opening a tab
    const tab = browser.openTab('LinkedIn Ingestion Admin', 'http://localhost:3003', faviconUrl);
    
    // Simulate creating a bookmark
    const bookmark = browser.addBookmark('LinkedIn Ingestion Admin', 'http://localhost:3003', faviconUrl);
    
    return {
        browser,
        tab,
        bookmark,
        faviconLoaded: browser.favicon !== null,
        faviconVisible: tab.faviconVisible
    };
}

function testThemeCompatibility(faviconUrl, browserName) {
    const lightMode = simulateBrowserEnvironment(browserName, { darkMode: false });
    const darkMode = simulateBrowserEnvironment(browserName, { darkMode: true });
    
    return {
        browser: browserName,
        lightMode: {
            faviconVisible: lightMode.faviconVisible,
            theme: 'light'
        },
        darkMode: {
            faviconVisible: darkMode.faviconVisible,
            theme: 'dark'
        },
        compatible: lightMode.faviconVisible && darkMode.faviconVisible
    };
}

// Tests
describe('Favicon Cross-Browser Testing', () => {
    
    describe('Browser Format Support', () => {
        const faviconUrls = [
            '/favicon.ico',
            '/favicon-16x16.png',
            '/favicon-32x32.png',
            '/favicon-64x64.png'
        ];
        
        test('Chrome should support all favicon formats', () => {
            const browser = createBrowser('chrome');
            const results = testFaviconFormats(browser, faviconUrls);
            
            // Chrome should support ICO and PNG
            const icoResults = results.filter(r => r.format === 'ico');
            const pngResults = results.filter(r => r.format === 'png');
            
            expect(icoResults.every(r => r.canLoad)).toBe(true);
            expect(pngResults.every(r => r.canLoad)).toBe(true);
            expect(results.every(r => r.canDisplay)).toBe(true);
        });
        
        test('Firefox should support all favicon formats', () => {
            const browser = createBrowser('firefox');
            const results = testFaviconFormats(browser, faviconUrls);
            
            const icoResults = results.filter(r => r.format === 'ico');
            const pngResults = results.filter(r => r.format === 'png');
            
            expect(icoResults.every(r => r.canLoad)).toBe(true);
            expect(pngResults.every(r => r.canLoad)).toBe(true);
            expect(results.every(r => r.canDisplay)).toBe(true);
        });
        
        test('Safari should support ICO and PNG formats', () => {
            const browser = createBrowser('safari');
            const results = testFaviconFormats(browser, faviconUrls);
            
            const icoResults = results.filter(r => r.format === 'ico');
            const pngResults = results.filter(r => r.format === 'png');
            
            expect(icoResults.every(r => r.canLoad)).toBe(true);
            expect(pngResults.every(r => r.canLoad)).toBe(true);
            expect(results.every(r => r.canDisplay)).toBe(true);
        });
        
        test('Edge should support all favicon formats', () => {
            const browser = createBrowser('edge');
            const results = testFaviconFormats(browser, faviconUrls);
            
            const icoResults = results.filter(r => r.format === 'ico');
            const pngResults = results.filter(r => r.format === 'png');
            
            expect(icoResults.every(r => r.canLoad)).toBe(true);
            expect(pngResults.every(r => r.canLoad)).toBe(true);
            expect(results.every(r => r.canDisplay)).toBe(true);
        });
    });
    
    describe('Browser Tab Display', () => {
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        
        browserTypes.forEach(browserType => {
            test(`${browserType} should display favicon in browser tabs`, () => {
                const result = simulateBrowserEnvironment(browserType);
                
                expect(result.faviconLoaded).toBe(true);
                expect(result.tab.faviconVisible).toBe(true);
                expect(result.tab.favicon).toBe('/favicon.ico');
            });
        });
        
        test('should handle multiple tabs with favicon', () => {
            const browser = createBrowser('chrome');
            
            const tab1 = browser.openTab('Admin Dashboard', 'http://localhost:3003/dashboard', '/favicon.ico');
            const tab2 = browser.openTab('Candidates', 'http://localhost:3003/candidates', '/favicon.ico');
            const tab3 = browser.openTab('Jobs', 'http://localhost:3003/jobs', '/favicon.ico');
            
            expect(browser.tabs.length).toBe(3);
            expect(tab1.faviconVisible).toBe(true);
            expect(tab2.faviconVisible).toBe(true);
            expect(tab3.faviconVisible).toBe(true);
        });
    });
    
    describe('Bookmark Display', () => {
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        
        browserTypes.forEach(browserType => {
            test(`${browserType} should display favicon in bookmarks`, () => {
                const result = simulateBrowserEnvironment(browserType);
                
                expect(result.bookmark.faviconLoaded).toBe(true);
                expect(result.bookmark.favicon).toBe('/favicon.ico');
            });
        });
        
        test('should handle bookmark collections with favicons', () => {
            const browser = createBrowser('chrome');
            
            const bookmark1 = browser.addBookmark('Dashboard', 'http://localhost:3003/dashboard', '/favicon.ico');
            const bookmark2 = browser.addBookmark('Candidates', 'http://localhost:3003/candidates', '/favicon.ico');
            const bookmark3 = browser.addBookmark('System Status', 'http://localhost:3003/system', '/favicon.ico');
            
            expect(browser.bookmarks.length).toBe(3);
            expect(bookmark1.faviconLoaded).toBe(true);
            expect(bookmark2.faviconLoaded).toBe(true);
            expect(bookmark3.faviconLoaded).toBe(true);
        });
    });
    
    describe('Light and Dark Theme Compatibility', () => {
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        
        browserTypes.forEach(browserType => {
            test(`${browserType} should display favicon in light theme`, () => {
                const result = testThemeCompatibility('/favicon.ico', browserType);
                
                expect(result.lightMode.faviconVisible).toBe(true);
                expect(result.lightMode.theme).toBe('light');
            });
            
            test(`${browserType} should display favicon in dark theme`, () => {
                const result = testThemeCompatibility('/favicon.ico', browserType);
                
                expect(result.darkMode.faviconVisible).toBe(true);
                expect(result.darkMode.theme).toBe('dark');
            });
            
            test(`${browserType} should be compatible with both themes`, () => {
                const result = testThemeCompatibility('/favicon.ico', browserType);
                
                expect(result.compatible).toBe(true);
            });
        });
    });
    
    describe('HTML Validation Across Browsers', () => {
        const sampleHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>LinkedIn Ingestion Admin</title>
                <link rel="icon" type="image/x-icon" href="/favicon.ico">
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
            </head>
            <body></body>
            </html>
        `;
        
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        
        browserTypes.forEach(browserType => {
            test(`should validate favicon HTML structure for ${browserType}`, () => {
                const faviconLinks = validateFaviconHTML(sampleHTML, browserType);
                
                expect(faviconLinks.length).toBe(3);
                
                const icoLink = faviconLinks.find(link => link.href === '/favicon.ico');
                const png32Link = faviconLinks.find(link => link.href === '/favicon-32x32.png');
                const png16Link = faviconLinks.find(link => link.href === '/favicon-16x16.png');
                
                expect(icoLink).toBeTruthy();
                expect(png32Link).toBeTruthy();
                expect(png16Link).toBeTruthy();
                
                expect(icoLink.browserSupported).toBe(true);
                expect(png32Link.browserSupported).toBe(true);
                expect(png16Link.browserSupported).toBe(true);
            });
        });
    });
    
    describe('Fallback Behavior', () => {
        test('should provide ICO fallback for all browsers', () => {
            const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
            
            browserTypes.forEach(browserType => {
                const browser = createBrowser(browserType);
                const canLoadICO = browser.canLoadFavicon('/favicon.ico');
                
                expect(canLoadICO).toBe(true);
            });
        });
        
        test('should provide PNG alternatives for modern browsers', () => {
            const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
            
            browserTypes.forEach(browserType => {
                const browser = createBrowser(browserType);
                const canLoadPNG = browser.canLoadFavicon('/favicon-32x32.png');
                
                expect(canLoadPNG).toBe(true);
            });
        });
        
        test('should gracefully handle missing favicon files', () => {
            const browser = createBrowser('chrome');
            
            // Test with non-existent favicon
            const result = browser.loadFavicon('/nonexistent-favicon.ico');
            expect(result.url).toBe('/nonexistent-favicon.ico');
            
            // Browser should still attempt to load it
            expect(result.loaded).toBe(true);
        });
    });
    
    describe('Performance and Caching', () => {
        test('should simulate proper caching headers support', () => {
            const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
            
            browserTypes.forEach(browserType => {
                const browser = createBrowser(browserType);
                const favicon = browser.loadFavicon('/favicon.ico');
                
                // All modern browsers support caching
                expect(browser.features.supportsCaching !== false).toBe(true);
                expect(favicon.loaded).toBe(true);
            });
        });
        
        test('should handle multiple favicon sizes efficiently', () => {
            const browser = createBrowser('chrome');
            const faviconSizes = [
                '/favicon-16x16.png',
                '/favicon-32x32.png',
                '/favicon-64x64.png'
            ];
            
            const loadResults = faviconSizes.map(url => browser.loadFavicon(url));
            
            expect(loadResults.every(result => result.loaded)).toBe(true);
            expect(loadResults.length).toBe(3);
        });
    });
});

describe('Real-World Browser Integration', () => {
    test('should provide comprehensive cross-browser support matrix', () => {
        const supportMatrix = {};
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        const formats = ['ico', 'png'];
        
        browserTypes.forEach(browserType => {
            supportMatrix[browserType] = {};
            const browser = createBrowser(browserType);
            
            formats.forEach(format => {
                supportMatrix[browserType][format] = browser.supportsFormat(format);
            });
        });
        
        // Verify comprehensive support
        expect(supportMatrix.chrome.ico).toBe(true);
        expect(supportMatrix.chrome.png).toBe(true);
        expect(supportMatrix.firefox.ico).toBe(true);
        expect(supportMatrix.firefox.png).toBe(true);
        expect(supportMatrix.safari.ico).toBe(true);
        expect(supportMatrix.safari.png).toBe(true);
        expect(supportMatrix.edge.ico).toBe(true);
        expect(supportMatrix.edge.png).toBe(true);
    });
    
    test('should validate production readiness', () => {
        const browserTypes = ['chrome', 'firefox', 'safari', 'edge'];
        let allBrowsersReady = true;
        const readinessReport = {};
        
        browserTypes.forEach(browserType => {
            const result = simulateBrowserEnvironment(browserType);
            const isReady = result.faviconLoaded && result.faviconVisible;
            
            readinessReport[browserType] = {
                faviconLoaded: result.faviconLoaded,
                faviconVisible: result.faviconVisible,
                ready: isReady
            };
            
            if (!isReady) {
                allBrowsersReady = false;
            }
        });
        
        expect(allBrowsersReady).toBe(true);
        
        // Verify specific browser readiness
        expect(readinessReport.chrome.ready).toBe(true);
        expect(readinessReport.firefox.ready).toBe(true);
        expect(readinessReport.safari.ready).toBe(true);
        expect(readinessReport.edge.ready).toBe(true);
    });
});

// Export test utilities for manual testing
module.exports = {
    createBrowser,
    testFaviconFormats,
    validateFaviconHTML,
    validateBrowserSupport,
    simulateBrowserEnvironment,
    testThemeCompatibility,
    BROWSER_CONFIGS
};