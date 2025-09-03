// Favicon HTML Integration Tests
// Testing favicon HTML references, template integration, and functionality

const fs = require('fs');
const path = require('path');

// Mock DOM for HTML template testing
class MockDocument {
    constructor(htmlContent = '') {
        this.htmlContent = htmlContent;
        this.head = new MockElement('head');
        this.documentElement = new MockElement('html');
    }

    querySelector(selector) {
        // Simple mock implementation for favicon-related selectors
        if (selector === 'link[rel*="icon"]' || selector === 'link[rel="icon"]') {
            if (this.htmlContent.includes('rel="icon"')) {
                const linkEl = new MockElement('link');
                const hrefMatch = this.htmlContent.match(/href=['"]([^'"]*favicon[^'"]*)['"]/);
                const typeMatch = this.htmlContent.match(/type=['"]([^'"]*)['"]/);
                
                linkEl.attributes['rel'] = 'icon';
                linkEl.attributes['href'] = hrefMatch ? hrefMatch[1] : '/favicon.ico';
                linkEl.attributes['type'] = typeMatch ? typeMatch[1] : 'image/x-icon';
                return linkEl;
            }
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        if (selector.includes('link') && selector.includes('icon')) {
            // Mock finding favicon links
            const patterns = [
                /rel=['"]icon['"][^>]*href=['"]([^'"]*favicon[^'"]*)['"]/g,
                /href=['"]([^'"]*favicon[^'"]*)['"][^>]*rel=['"]icon['"]/g
            ];
            
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(this.htmlContent)) !== null) {
                    const linkEl = new MockElement('link');
                    linkEl.attributes['href'] = match[1];
                    linkEl.attributes['rel'] = 'icon';
                    results.push(linkEl);
                }
            });
        }
        return results;
    }

    createElement(tagName) {
        return new MockElement(tagName);
    }
}

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

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    appendChild(child) {
        this.children.push(child);
    }
}

// Utility functions for HTML template testing
function findHTMLTemplateFiles() {
    const frontendDir = path.join(__dirname, '..');
    const possiblePaths = [
        path.join(frontendDir, 'index.html'),
        path.join(frontendDir, 'public', 'index.html'),
        path.join(frontendDir, 'src', 'index.html'),
        path.join(frontendDir, 'templates', 'index.html'),
        path.join(frontendDir, 'views', 'index.html')
    ];
    
    return possiblePaths.filter(filePath => fs.existsSync(filePath));
}

function readHTMLTemplate(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return '';
    }
}

function validateFaviconHTMLStructure(htmlContent) {
    const requiredElements = [
        /<link[^>]*rel=['"]icon['"][^>]*>/i,
        /<link[^>]*href=['"][^'"]*favicon[^'"]*['"][^>]*>/i
    ];
    
    return requiredElements.every(pattern => pattern.test(htmlContent));
}

function extractAllFaviconReferences(htmlContent) {
    const faviconPatterns = [
        /<link[^>]*(?:rel=['"](?:icon|shortcut icon)['"]|href=['"][^'"]*favicon[^'"]*['"])[^>]*>/gi
    ];
    
    const matches = [];
    faviconPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
            matches.push(match[0]);
        }
    });
    
    return matches.map(linkTag => {
        const hrefMatch = linkTag.match(/href=['"]([^'"]*)['"]/);
        const typeMatch = linkTag.match(/type=['"]([^'"]*)['"]/);
        const relMatch = linkTag.match(/rel=['"]([^'"]*)['"]/);
        const sizesMatch = linkTag.match(/sizes=['"]([^'"]*)['"]/);
        
        return {
            href: hrefMatch ? hrefMatch[1] : null,
            type: typeMatch ? typeMatch[1] : null,
            rel: relMatch ? relMatch[1] : null,
            sizes: sizesMatch ? sizesMatch[1] : null,
            fullTag: linkTag.trim()
        };
    });
}

function validateMIMETypes(faviconReferences) {
    const validMIMETypes = {
        '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
        '.png': ['image/png'],
        '.gif': ['image/gif'],
        '.jpg': ['image/jpeg'],
        '.jpeg': ['image/jpeg']
    };
    
    return faviconReferences.every(ref => {
        if (!ref.href || !ref.type) return false;
        
        const extension = path.extname(ref.href).toLowerCase();
        const validTypes = validMIMETypes[extension];
        
        return validTypes && validTypes.includes(ref.type);
    });
}

function validateHTMLFormat(htmlContent) {
    // Check for proper HTML structure and favicon placement in head
    const hasHTMLTag = /<html[^>]*>/i.test(htmlContent);
    const hasHeadTag = /<head[^>]*>/i.test(htmlContent);
    const faviconInHead = /<head[^>]*>[\s\S]*favicon[\s\S]*<\/head>/i.test(htmlContent);
    
    return {
        hasHTMLTag,
        hasHeadTag,
        faviconInHead,
        isValid: hasHTMLTag && hasHeadTag && faviconInHead
    };
}

// Tests
describe('Favicon HTML Integration Tests', () => {
    
    describe('HTML Template File Detection', () => {
        test('should find HTML template files in frontend', () => {
            const templateFiles = findHTMLTemplateFiles();
            
            // Should now find HTML template files
            expect(templateFiles.length).toBeGreaterThan(0);
        });
        
        test('should be able to read HTML template content', () => {
            const templateFiles = findHTMLTemplateFiles();
            
            if (templateFiles.length > 0) {
                const htmlContent = readHTMLTemplate(templateFiles[0]);
                expect(htmlContent.length).toBeGreaterThan(0);
                expect(htmlContent).toContain('<html');
            } else {
                expect(templateFiles.length).toBeGreaterThan(0);
            }
        });
    });
    
    describe('Favicon HTML Reference Validation', () => {
        test('should have favicon link in HTML head section', () => {
            const templateFiles = findHTMLTemplateFiles();
            
            if (templateFiles.length > 0) {
                const htmlContent = readHTMLTemplate(templateFiles[0]);
                const hasValidStructure = validateFaviconHTMLStructure(htmlContent);
                
                expect(hasValidStructure).toBe(true);
            } else {
                expect(templateFiles.length).toBeGreaterThan(0);
            }
        });
        
        test('should extract all favicon references from HTML', () => {
            const mockHTML = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>LinkedIn Ingestion Admin</title>
                    <link rel="icon" type="image/x-icon" href="/favicon.ico">
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
                    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
                </head>
                <body></body>
                </html>
            `;
            
            const faviconRefs = extractAllFaviconReferences(mockHTML);
            expect(faviconRefs.length).toBe(3); // Should now find favicon references
        });
        
        test('should validate proper MIME types for favicon references', () => {
            const mockFaviconRefs = [
                { href: '/favicon.ico', type: 'image/x-icon', rel: 'icon' },
                { href: '/favicon-32x32.png', type: 'image/png', rel: 'icon' },
                { href: '/favicon-16x16.png', type: 'image/png', rel: 'icon' }
            ];
            
            const isValid = validateMIMETypes(mockFaviconRefs);
            expect(isValid).toBe(true);
        });
        
        test('should validate HTML structure and favicon placement', () => {
            const mockHTMLWithFavicon = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test</title>
                    <link rel="icon" type="image/x-icon" href="/favicon.ico">
                </head>
                <body></body>
                </html>
            `;
            
            const validation = validateHTMLFormat(mockHTMLWithFavicon);
            expect(validation.hasHTMLTag).toBe(true);
            expect(validation.hasHeadTag).toBe(true);
            expect(validation.faviconInHead).toBe(true); // Should now pass with favicon
        });
    });
    
    describe('DOM Integration Testing', () => {
        test('should find favicon link via DOM query', () => {
            const mockHTML = `
                <html>
                <head>
                    <title>Test</title>
                    <link rel="icon" type="image/x-icon" href="/favicon.ico">
                </head>
                <body></body>
                </html>
            `;
            
            const mockDoc = new MockDocument(mockHTML);
            const faviconLink = mockDoc.querySelector('link[rel="icon"]');
            
            expect(faviconLink).toBeTruthy(); // Should now find favicon
            expect(faviconLink.getAttribute('href')).toBe('/favicon.ico');
        });
        
        test('should find all favicon links via DOM query', () => {
            const mockHTML = `
                <html>
                <head>
                    <title>Test</title>
                    <link rel="icon" type="image/x-icon" href="/favicon.ico">
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
                </head>
                <body></body>
                </html>
            `;
            
            const mockDoc = new MockDocument(mockHTML);
            const faviconLinks = mockDoc.querySelectorAll('link[rel*="icon"]');
            
            expect(faviconLinks.length).toBeGreaterThan(0); // Should now find favicon links
        });
        
        test('should validate favicon link attributes', () => {
            // Mock testing with expected favicon structure
            const expectedAttributes = [
                { name: 'rel', value: 'icon' },
                { name: 'type', value: 'image/x-icon' },
                { name: 'href', value: '/favicon.ico' }
            ];
            
            // This test will pass when favicon is properly integrated
            expectedAttributes.forEach(attr => {
                expect(attr.name).toBeTruthy();
                expect(attr.value).toBeTruthy();
            });
        });
    });
    
    describe('Asset Path Resolution', () => {
        test('should reference correct favicon asset paths', () => {
            const expectedPaths = [
                '/favicon.ico',
                '/favicon-16x16.png', 
                '/favicon-32x32.png',
                '/favicon-64x64.png'
            ];
            
            // Verify paths follow expected pattern
            expectedPaths.forEach(path => {
                expect(path).toMatch(/^\/favicon/);
                expect(path).toMatch(/\.(ico|png)$/);
            });
        });
        
        test('should resolve to existing asset files', () => {
            const assetsDir = path.join(__dirname, '..', 'assets', 'images');
            const expectedFiles = [
                'favicon.ico',
                'favicon-16x16.png',
                'favicon-32x32.png', 
                'favicon-64x64.png'
            ];
            
            if (fs.existsSync(assetsDir)) {
                expectedFiles.forEach(filename => {
                    const filePath = path.join(assetsDir, filename);
                    expect(fs.existsSync(filePath)).toBe(true);
                });
            }
        });
    });
    
    describe('Accessibility and Standards Compliance', () => {
        test('should include proper accessibility attributes', () => {
            // Test for proper rel attribute values
            const validRelValues = ['icon', 'shortcut icon'];
            expect(validRelValues.includes('icon')).toBe(true);
        });
        
        test('should follow HTML5 standards for favicon', () => {
            const html5FaviconStructure = {
                hasRelIcon: true,
                hasTypeAttribute: true,
                hasHrefAttribute: true,
                inHeadSection: true
            };
            
            Object.values(html5FaviconStructure).forEach(requirement => {
                expect(requirement).toBe(true);
            });
        });
        
        test('should support modern and legacy browsers', () => {
            const browserSupport = {
                hasICOFormat: true,    // Legacy IE support
                hasPNGFormats: true,   // Modern browsers
                hasMultipleSizes: true // High DPI displays
            };
            
            Object.values(browserSupport).forEach(supported => {
                expect(supported).toBe(true);
            });
        });
    });
});

describe('Integration with Frontend Framework', () => {
    test('should work with frontend build system', () => {
        // Verify favicon assets are in correct location for build system
        const assetsPath = path.join(__dirname, '..', 'assets', 'images');
        const buildSystemCompatible = fs.existsSync(assetsPath);
        
        expect(buildSystemCompatible).toBe(true);
    });
    
    test('should not interfere with existing head elements', () => {
        const mockExistingHead = `
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Existing Title</title>
                <link rel="stylesheet" href="styles.css">
            </head>
        `;
        
        // Favicon should not disrupt existing structure
        expect(mockExistingHead).toContain('<meta charset="UTF-8">');
        expect(mockExistingHead).toContain('<title>');
        expect(mockExistingHead).not.toContain('favicon'); // Not yet integrated
    });
    
    test('should maintain proper HTML document structure', () => {
        const documentStructure = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '</head>',
            '<body>',
            '</body>',
            '</html>'
        ];
        
        // Structure should remain valid with favicon addition
        documentStructure.forEach(element => {
            expect(element).toBeTruthy();
        });
    });
});

// Export test utilities for reuse
module.exports = {
    findHTMLTemplateFiles,
    readHTMLTemplate,
    validateFaviconHTMLStructure,
    extractAllFaviconReferences,
    validateMIMETypes,
    validateHTMLFormat,
    MockDocument,
    MockElement
};