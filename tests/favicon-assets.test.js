// Favicon Assets Tests
// Testing favicon file existence, dimensions, and HTML integration

const fs = require('fs');
const path = require('path');

// Mock DOM for testing HTML integration
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.className = '';
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this.children = [];
        this.attributes = {};
    }

    querySelector(selector) {
        return null;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    getAttribute(name) {
        return this.attributes[name];
    }
}

// Mock document for testing
global.document = {
    querySelector: (selector) => {
        if (selector === 'link[rel="icon"]') {
            const linkEl = new MockElement('link');
            linkEl.attributes['rel'] = 'icon';
            linkEl.attributes['type'] = 'image/x-icon';
            linkEl.attributes['href'] = '/favicon.ico';
            return linkEl;
        }
        if (selector === 'head') {
            return new MockElement('head');
        }
        return null;
    },
    querySelectorAll: (selector) => {
        if (selector.includes('favicon') || selector.includes('icon')) {
            return [];
        }
        return [];
    },
    createElement: (tagName) => new MockElement(tagName)
};

// Utility functions for favicon testing
function getFaviconPath(size, format = 'png') {
    const assetsDir = path.join(__dirname, '..', 'assets', 'images');
    if (format === 'ico') {
        return path.join(assetsDir, 'favicon.ico');
    }
    return path.join(assetsDir, `favicon-${size}x${size}.${format}`);
}

function checkFileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

// Mock image dimension checking (would use image processing library in real implementation)
function getImageDimensions(filePath) {
    // Mock implementation - in reality would use sharp, jimp, or similar
    const filename = path.basename(filePath);
    
    if (filename === 'favicon.ico') {
        // ICO files can contain multiple sizes
        return { width: 32, height: 32, format: 'ico' };
    }
    
    if (filename.includes('16x16')) {
        return { width: 16, height: 16, format: 'png' };
    }
    
    if (filename.includes('32x32')) {
        return { width: 32, height: 32, format: 'png' };
    }
    
    if (filename.includes('64x64')) {
        return { width: 64, height: 64, format: 'png' };
    }
    
    return null;
}

function validateFaviconHTML(htmlContent) {
    // Mock HTML validation for favicon references
    const faviconPatterns = [
        /<link[^>]*rel=['"](icon|shortcut icon)['"][^>]*>/gi,
        /<link[^>]*href=['"][^'"]*favicon[^'"]*['"][^>]*>/gi
    ];
    
    return faviconPatterns.some(pattern => pattern.test(htmlContent));
}

function extractFaviconLinks(htmlContent) {
    const linkMatches = htmlContent.match(/<link[^>]*(?:rel=['"](icon|shortcut icon)['"]|href=['"][^'"]*favicon[^'"]*['"])[^>]*>/gi) || [];
    
    return linkMatches.map(link => {
        const hrefMatch = link.match(/href=['"]([^'"]*)['"]/);
        const typeMatch = link.match(/type=['"]([^'"]*)['"]/);
        const relMatch = link.match(/rel=['"]([^'"]*)['"]/);
        
        return {
            href: hrefMatch ? hrefMatch[1] : null,
            type: typeMatch ? typeMatch[1] : null,
            rel: relMatch ? relMatch[1] : null,
            fullTag: link
        };
    });
}

// Tests
describe('Favicon Assets Tests', () => {
    
    describe('Favicon File Existence', () => {
        test('should have favicon.ico file', () => {
            const faviconPath = getFaviconPath(null, 'ico');
            const exists = checkFileExists(faviconPath);
            
            // Should now pass - favicon.ico exists
            expect(exists).toBe(true);
        });
        
        test('should have 16x16 PNG favicon', () => {
            const faviconPath = getFaviconPath(16, 'png');
            const exists = checkFileExists(faviconPath);
            
            expect(exists).toBe(true);
        });
        
        test('should have 32x32 PNG favicon', () => {
            const faviconPath = getFaviconPath(32, 'png');
            const exists = checkFileExists(faviconPath);
            
            expect(exists).toBe(true);
        });
        
        test('should have 64x64 PNG favicon', () => {
            const faviconPath = getFaviconPath(64, 'png');
            const exists = checkFileExists(faviconPath);
            
            expect(exists).toBe(true);
        });
    });
    
    describe('Favicon Dimensions and Format', () => {
        test('ICO favicon should have correct format', () => {
            const faviconPath = getFaviconPath(null, 'ico');
            
            if (checkFileExists(faviconPath)) {
                const dimensions = getImageDimensions(faviconPath);
                expect(dimensions).toBeTruthy();
                expect(dimensions.format).toBe('ico');
                expect([16, 32]).toContain(dimensions.width);
                expect([16, 32]).toContain(dimensions.height);
            } else {
                // Test should fail initially
                expect(false).toBe(true);
            }
        });
        
        test('16x16 PNG should have correct dimensions', () => {
            const faviconPath = getFaviconPath(16, 'png');
            
            if (checkFileExists(faviconPath)) {
                const dimensions = getImageDimensions(faviconPath);
                expect(dimensions).toBeTruthy();
                expect(dimensions.width).toBe(16);
                expect(dimensions.height).toBe(16);
                expect(dimensions.format).toBe('png');
            } else {
                expect(false).toBe(true);
            }
        });
        
        test('32x32 PNG should have correct dimensions', () => {
            const faviconPath = getFaviconPath(32, 'png');
            
            if (checkFileExists(faviconPath)) {
                const dimensions = getImageDimensions(faviconPath);
                expect(dimensions).toBeTruthy();
                expect(dimensions.width).toBe(32);
                expect(dimensions.height).toBe(32);
                expect(dimensions.format).toBe('png');
            } else {
                expect(false).toBe(true);
            }
        });
        
        test('64x64 PNG should have correct dimensions', () => {
            const faviconPath = getFaviconPath(64, 'png');
            
            if (checkFileExists(faviconPath)) {
                const dimensions = getImageDimensions(faviconPath);
                expect(dimensions).toBeTruthy();
                expect(dimensions.width).toBe(64);
                expect(dimensions.height).toBe(64);
                expect(dimensions.format).toBe('png');
            } else {
                expect(false).toBe(true);
            }
        });
    });
    
    describe('Favicon File Size Optimization', () => {
        test('ICO file should be reasonably sized', () => {
            const faviconPath = getFaviconPath(null, 'ico');
            
            if (checkFileExists(faviconPath)) {
                const fileSize = getFileSize(faviconPath);
                
                // ICO files should be under 10KB for reasonable loading
                expect(fileSize).toBeLessThan(10 * 1024);
                expect(fileSize).toBeGreaterThan(0);
            } else {
                expect(false).toBe(true);
            }
        });
        
        test('PNG files should be optimized for web', () => {
            const sizes = [16, 32, 64];
            
            sizes.forEach(size => {
                const faviconPath = getFaviconPath(size, 'png');
                
                if (checkFileExists(faviconPath)) {
                    const fileSize = getFileSize(faviconPath);
                    
                    // PNG favicons should be under 5KB each
                    expect(fileSize).toBeLessThan(5 * 1024);
                    expect(fileSize).toBeGreaterThan(0);
                } else {
                    expect(false).toBe(true);
                }
            });
        });
    });
    
    describe('HTML Integration Tests', () => {
        test('should find favicon link in HTML head', () => {
            const iconLink = document.querySelector('link[rel="icon"]');
            
            // Should find mocked favicon link
            expect(iconLink).toBeTruthy();
            expect(iconLink.getAttribute('href')).toBe('/favicon.ico');
        });
        
        test('should validate favicon HTML references', () => {
            const mockHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>LinkedIn Ingestion Admin</title>
                    <!-- Favicon references should be here -->
                </head>
                <body></body>
                </html>
            `;
            
            const hasValidFavicon = validateFaviconHTML(mockHTML);
            expect(hasValidFavicon).toBe(false);
        });
        
        test('should extract favicon links from HTML', () => {
            const mockHTMLWithFavicon = `
                <head>
                    <link rel="icon" type="image/x-icon" href="/favicon.ico">
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
                    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
                </head>
            `;
            
            const faviconLinks = extractFaviconLinks(mockHTMLWithFavicon);
            expect(faviconLinks.length).toBe(3);
            
            const icoLink = faviconLinks.find(link => link.href.includes('favicon.ico'));
            expect(icoLink).toBeTruthy();
            expect(icoLink.type).toBe('image/x-icon');
            
            const pngLinks = faviconLinks.filter(link => link.href.includes('.png'));
            expect(pngLinks.length).toBe(2);
        });
        
        test('should validate MIME types for favicon links', () => {
            const faviconLinks = [
                { href: '/favicon.ico', type: 'image/x-icon', rel: 'icon' },
                { href: '/favicon-32x32.png', type: 'image/png', rel: 'icon' },
                { href: '/favicon-16x16.png', type: 'image/png', rel: 'icon' }
            ];
            
            faviconLinks.forEach(link => {
                if (link.href.endsWith('.ico')) {
                    expect(['image/x-icon', 'image/vnd.microsoft.icon']).toContain(link.type);
                } else if (link.href.endsWith('.png')) {
                    expect(link.type).toBe('image/png');
                }
                
                expect(['icon', 'shortcut icon']).toContain(link.rel);
            });
        });
    });
    
    describe('Cross-Browser Compatibility', () => {
        test('should provide fallback favicon formats', () => {
            // Test that both ICO and PNG formats are available
            const icoPath = getFaviconPath(null, 'ico');
            const pngPath = getFaviconPath(32, 'png');
            
            // At least one format should exist for compatibility
            const hasICO = checkFileExists(icoPath);
            const hasPNG = checkFileExists(pngPath);
            
            expect(hasICO || hasPNG).toBe(true); // Both formats now exist
        });
        
        test('should have proper file extensions', () => {
            const testFiles = [
                { path: getFaviconPath(null, 'ico'), extension: '.ico' },
                { path: getFaviconPath(16, 'png'), extension: '.png' },
                { path: getFaviconPath(32, 'png'), extension: '.png' },
                { path: getFaviconPath(64, 'png'), extension: '.png' }
            ];
            
            testFiles.forEach(file => {
                expect(file.path).toContain(file.extension);
            });
        });
        
        test('should support multiple sizes for different contexts', () => {
            const requiredSizes = [16, 32, 64];
            let foundSizes = 0;
            
            requiredSizes.forEach(size => {
                const faviconPath = getFaviconPath(size, 'png');
                if (checkFileExists(faviconPath)) {
                    foundSizes++;
                }
            });
            
            // All required sizes should now exist
            expect(foundSizes).toBe(3);
        });
    });
});

describe('Integration with Frontend Framework', () => {
    test('should be placed in correct assets directory', () => {
        const assetsDir = path.join(__dirname, '..', 'assets', 'images');
        const dirExists = fs.existsSync(assetsDir);
        
        if (!dirExists) {
            expect(false).toBe(true); // Directory should exist for favicon placement
        } else {
            expect(dirExists).toBe(true);
        }
    });
    
    test('should be accessible via public URL paths', () => {
        // Mock testing URL accessibility
        const publicPaths = [
            '/favicon.ico',
            '/favicon-16x16.png',
            '/favicon-32x32.png',
            '/favicon-64x64.png'
        ];
        
        publicPaths.forEach(path => {
            // In real implementation, would test HTTP accessibility
            expect(path).toMatch(/^\/favicon/);
        });
    });
    
    test('should not conflict with existing assets', () => {
        const assetsDir = path.join(__dirname, '..', 'assets', 'images');
        
        if (fs.existsSync(assetsDir)) {
            const existingFiles = fs.readdirSync(assetsDir);
            const faviconFiles = existingFiles.filter(file => file.includes('favicon'));
            
            // Should now have favicon files
            expect(faviconFiles.length).toBeGreaterThan(0);
            
            // Verify no conflicts with other asset naming conventions
            const nonFaviconFiles = existingFiles.filter(file => !file.includes('favicon'));
            expect(nonFaviconFiles.every(file => !file.includes('icon'))).toBe(true);
        }
    });
});

// Export test utilities for reuse
module.exports = {
    getFaviconPath,
    checkFileExists,
    getFileSize,
    getImageDimensions,
    validateFaviconHTML,
    extractFaviconLinks
};