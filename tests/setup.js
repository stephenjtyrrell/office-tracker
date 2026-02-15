// Test setup and utilities
const crypto = require('crypto');

// Mock environment variables for testing
const originalEnv = process.env.NODE_ENV;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-key-do-not-use-in-production';
});

afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

/**
 * Utility to create a mock user object
 */
global.createMockUser = (overrides = {}) => {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    created_at: new Date(),
    ...overrides
  };
};

/**
 * Utility to create a mock session
 */
global.createMockSession = (userId = 1) => {
  return {
    userId,
    id: crypto.randomBytes(16).toString('hex'),
    regenerate: jest.fn((cb) => cb()),
    destroy: jest.fn((cb) => cb && cb())
  };
};

/**
 * Utility to format date for tests
 */
global.formatDateForTest = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Utility to get a date N days from now
 */
global.getDateDaysAhead = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
