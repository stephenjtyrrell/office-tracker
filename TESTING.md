# Test Suite Documentation

This document describes the comprehensive test suite for the Office Tracker application.

## Overview

The test suite includes:
- **Unit Tests** for calendar calculations and date utilities
- **Integration Tests** for complete workflows
- **Database Schema Tests** for PostgreSQL configuration
- **API Endpoint Tests** for server routes
- **Frontend Tests** for client-side functionality

## Test Coverage

### 1. Calendar Module Tests (`tests/calendar.test.js`)

Tests for Irish public holiday calculations and working day management.

**Test Categories:**
- Date formatting (YYYY-MM-DD format)
- Weekend detection (Saturday & Sunday)
- Irish public holiday calculations
- Working day calculations (excluding weekends and holidays)
- Easter calculations for Easter Monday (moving holiday)
- Bank holiday calculations

**Key Test Cases:**
- ✅ New Year's Day, St. Patrick's Day, Christmas, St. Stephen's Day
- ✅ Easter Monday and bank holidays
- ✅ Weekday vs. weekend detection
- ✅ Month-specific working days
- ✅ Leap year handling
- ✅ Edge cases and year boundaries

**Run Calendar Tests:**
```bash
npm test -- tests/calendar.test.js
```

### 2. Server API Tests (`tests/server.test.js`)

Tests for Express server endpoints and authentication.

**Test Categories:**
- **Authentication**
  - User registration with validation
  - Login/logout flows
  - Session management
  - Current user retrieval

- **Password Reset**
  - Token generation and validation
  - Password reset flow
  - Token expiration
  - Security measures

- **Health Checks**
  - Database connectivity
  - Server health status

**Key Test Cases:**
- ✅ Valid registration with strong password
- ✅ Email uniqueness validation
- ✅ Password strength requirements
- ✅ Login with correct/incorrect credentials
- ✅ Rate limiting on auth endpoints
- ✅ Password reset token generation and expiration
- ✅ Health endpoint database checks

**Run Server Tests:**
```bash
npm test -- tests/server.test.js
```

### 3. Database Tests (`tests/database.test.js`)

Tests for PostgreSQL schema and database configuration.

**Test Categories:**
- Module exports and configuration
- Connection string validation
- Table structure verification
- Index creation
- Foreign key constraints
- Unique constraints
- Data types

**Database Schema Verified:**
- `users` table with email uniqueness
- `office_days` table with foreign keys and date uniqueness
- `annual_leave` table with cascading deletes
- `password_reset_tokens` table with expiration
- All required indexes for performance

**Run Database Tests:**
```bash
npm test -- tests/database.test.js
```

### 4. Frontend Application Tests (`tests/app.test.js`)

Tests for client-side JavaScript functionality.

**Test Categories:**
- DOM element presence
- Password visibility toggle
- Date/time navigation
- API request handling
- Form validation patterns
- User state management
- UI display functions
- Event handlers

**Key Test Cases:**
- ✅ Authentication UI sections
- ✅ Form field validation (email, password, date)
- ✅ Month navigation
- ✅ User data display
- ✅ Password visibility toggle
- ✅ Fetch API interactions

**Run Frontend Tests:**
```bash
npm test -- tests/app.test.js
```

### 5. Integration Tests (`tests/integration.test.js`)

End-to-end tests for complete application workflows.

**Test Categories:**
- Complete month summary calculations
- Date handling consistency
- Holiday calculations
- Edge cases (leap years, boundary conditions)
- Performance benchmarks
- Real-world scenarios

**Key Test Cases:**
- ✅ 50% office attendance requirement calculation
- ✅ Annual leave impact on requirements
- ✅ Balance calculations
- ✅ Year boundary handling
- ✅ Annual leave scenarios (~3 weeks spread)
- ✅ Full year summary calculations

**Run Integration Tests:**
```bash
npm test -- tests/integration.test.js
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- tests/calendar.test.js
npm test -- tests/server.test.js
npm test -- tests/database.test.js
npm test -- tests/app.test.js
npm test -- tests/integration.test.js
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

This generates a coverage report showing test coverage for:
- Statements
- Branches
- Functions
- Lines

### Run Specific Test Pattern
```bash
npm test -- --testNamePattern="getWorkingDays"
npm test -- --testNamePattern="authentication"
```

## Test Setup

### Test Environment Configuration

The test suite uses the following configuration:
- **Test Environment**: Node.js
- **Test Framework**: Jest
- **Coverage Threshold**: Configurable in jest.config.js

### Environment Variables for Testing

Tests use mocked environment:
```javascript
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'test-secret-key-do-not-use-in-production'
```

### Available Test Utilities

Global utilities available in all tests (`tests/setup.js`):
- `createMockUser()` - Creates a mock user object
- `createMockSession()` - Creates a mock session
- `formatDateForTest()` - Formats dates consistently
- `getDateDaysAhead()` - Gets a future date

```javascript
// Example usage
const user = createMockUser({ email: 'custom@example.com' });
const session = createMockSession(1);
const futureDate = getDateDaysAhead(30);
```

## Database Testing

For integration tests with a real database:

1. Create test database:
```bash
createdb office_tracker_test
```

2. Set test database URL:
```bash
export DATABASE_URL="postgresql://user:password@localhost/office_tracker_test"
```

3. Run database tests:
```bash
npm test -- tests/database.test.js
```

## Mocking

The test suite uses Jest mocking for:
- **Database Module**: Mocked PostgreSQL pool queries
- **Fetch API**: Mocked for frontend tests
- **Authentication**: Mocked bcrypt operations

## Test Metrics

### Expected Test Statistics
- **Total Tests**: 100+ test cases
- **Line Coverage**: Target 80%+
- **Branch Coverage**: Target 75%+
- **Function Coverage**: Target 85%+

### Running Coverage Analysis
```bash
npm run test:coverage
```

The coverage report shows which parts of the codebase are not tested and need additional tests.

## Continuous Integration

For CI/CD pipelines, use:
```bash
npm test -- --coverage --passWithNoTests --CI
```

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_DB: office_tracker_test
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Common Issues & Solutions

### Issue: Tests timeout
**Solution**: Increase `testTimeout` in jest.config.js or use `--testTimeout=10000` flag

### Issue: Database connection errors
**Solution**: Ensure DATABASE_URL is set or use mocked tests with `npm test -- tests/calendar.test.js`

### Issue: Mock not working
**Solution**: Ensure `jest.mock()` is called before `require()` of the module

### Issue: DOM not available in tests
**Solution**: jsdom is automatically configured for Node.js tests in jest.config.js

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clear Naming**: Test names should describe what is being tested
3. **DRY Setup**: Use `beforeEach` and `afterEach` for common setup/teardown
4. **Mock External Calls**: Mock database, API, and file system calls
5. **Test Edge Cases**: Include tests for boundary conditions
6. **Keep Tests Fast**: Aim for tests to complete in < 5 seconds total

## Adding New Tests

To add tests for a new feature:

1. Create test file: `tests/feature.test.js`
2. Import required modules
3. Use `describe()` and `it()` blocks
4. Set up mocks in `beforeEach()`
5. Write assertions
6. Run: `npm test -- tests/feature.test.js`

Example:
```javascript
describe('New Feature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Test code
    expect(result).toBe(expected);
  });
});
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest for API Testing](https://github.com/visionmedia/supertest)
- [Node.js Testing Best Practices](https://nodejs.org/en/docs/guides/testing/)

## Support

For test-related issues or improvements:
1. Check existing test cases
2. Review Jest documentation
3. Check error messages for specific failures
4. Add console.log() for debugging (use `npm run test:watch`)
