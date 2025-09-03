# Admin UI Smoke Tests

## Overview
These smoke tests verify that all main pages in the admin UI load without server errors. They're designed to catch basic issues like missing templates, undefined variables, or broken routes.

## What They Test
- ✅ All main navigation pages load (Dashboard, Profiles, Companies, etc.)
- ✅ System pages load (Status, Model Config)
- ✅ Job detail pages load without 500 errors
- ✅ Pages return proper HTTP status codes
- ✅ Basic HTML structure is present (title tags, etc.)

## Running Tests

### Local Development
```bash
# Make sure the server is running first
npm start

# Then run smoke tests in another terminal
npm run test:smoke

# Or wait for server to be ready automatically
npm run test:smoke:wait
```

### Docker Container
```bash
# Run tests inside the container
docker exec admin-ui-container npm run test:smoke

# Or run the full test suite with server startup
docker exec admin-ui-container bash test-runner.sh
```

### CI/CD Integration
Tests automatically run on GitHub Actions for every push/PR that affects the admin-ui directory.

## Test Output
```
🧪 Starting Admin UI Smoke Tests

Base URL: http://localhost:3003
Tests to run: 12

Testing Dashboard                 /                              ✅ 200 (163ms)
Testing Profiles                  /profiles                      ✅ 200 (221ms)
Testing Candidates                /candidates                    ✅ 200 (8ms)
...

================================================================================
📊 Test Summary
================================================================================
Total tests: 12
Passed: 12
Failed: 0
Total time: 2479ms
Average response time: 206ms

✅ All tests passed!
```

## What These Tests DON'T Cover
- Content accuracy (they just check pages load)
- JavaScript functionality 
- Form submissions
- User interactions
- Visual appearance

For comprehensive testing, use the Playwright e2e tests in addition to these smoke tests.

## Adding New Tests
To test a new page, add it to the `TESTS` array in `smoke-test.js`:

```javascript
const TESTS = [
    { name: 'My New Page', path: '/my-new-page' },
    // ... existing tests
];
```

## Error Detection
The tests look for:
- HTTP status codes >= 400
- Common JavaScript error strings in HTML:
  - `ReferenceError`
  - `TypeError` 
  - `is not defined`
  - `Cannot read property`
  - `Server Error`

This catches the most common issues like the `filterOptions is not defined` error we just fixed.
