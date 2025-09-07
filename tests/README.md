# Frontend Testing with Playwright

This directory contains end-to-end (E2E) tests for the LinkedIn Ingestion Admin UI using Playwright.

## Test Coverage

### Smoke Tests (`admin-ui-smoke.spec.js`)
- ✅ **Homepage Loading** - Verifies the app loads without 404/error pages
- ✅ **API Connectivity** - Monitors network requests for API failures  
- ✅ **Profile Management Access** - Ensures profile sections are accessible
- ✅ **JavaScript Error Detection** - Catches critical JS errors (allows minor ones)
- ✅ **Responsive Design** - Tests desktop and mobile viewports

### Functional Tests (`profile-management.spec.js`)
- ✅ **Profiles Page Access** - Verifies `/profiles` route works
- ✅ **Interface Elements** - Checks for tables, forms, and interactive elements
- ✅ **Navigation Handling** - Validates UI navigation (flexible for icon-based nav)
- ✅ **Network Stability** - Ensures no 5xx server errors

### Scoring Flow Tests (`scoring-flow.spec.js`)
- ✅ **Complete Scoring Workflow** - End-to-end profile scoring with job completion
- ✅ **Modal Validation** - Scoring form validation and error handling
- ✅ **Scoring History Navigation** - Profile scoring history page functionality
- ✅ **Job Detail Page** - Scoring job status, refresh, and retry functionality
- ✅ **Template Loading** - Scoring template dropdown population and selection

## Running Tests

### Quick Test Run
```bash
npm run test:e2e
```

### Run Tests with UI (Interactive)
```bash
npm run test:e2e:ui
```

### Run Tests with Browser Visible (Debug)
```bash
npm run test:e2e:headed
```

### Run Only Scoring Tests
```bash
npx playwright test scoring-flow.spec.js
```

### Run Scoring Tests in Debug Mode
```bash
npx playwright test scoring-flow.spec.js --debug
```

## Test Results Summary

The tests verify that:
- Admin UI loads and renders properly
- Core navigation and interface elements exist  
- No critical JavaScript or server errors
- Responsive design works on different screen sizes
- Profile management interface is accessible
- Profile scoring workflow functions end-to-end
- Scoring job management and status tracking works
- Template selection and validation is functional

## Configuration

- **Config File**: `playwright.config.js`
- **Base URL**: `http://localhost:3001` (configurable via TEST_BASE_URL)
- **Browsers**: Chromium and Firefox (webkit available)
- **Screenshots**: Captured on test failures
- **Videos**: Recorded on test failures
- **Traces**: Recorded for debugging failed tests
- **Timeouts**: Extended to 2 minutes for long-running scoring jobs

## Extending Tests

To add more tests:
1. Create new `.spec.js` files in `tests/e2e/`
2. Use the existing patterns for page interactions
3. Follow the structure: `test.describe()` > `test()`

## Notes

- Tests automatically start the dev server if not running
- Minor JavaScript errors (missing static files, Socket.IO issues) are tolerated
- Tests are designed to be resilient and not brittle to UI changes
- Focus is on smoke testing and basic functionality validation
