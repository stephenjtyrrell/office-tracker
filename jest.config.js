module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '**/tests/calendar.test.js',
        '**/tests/database.test.js',
        '**/tests/server.test.js',
        '**/tests/integration.test.js'
      ]
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/app.test.js']
    }
  ],
  collectCoverageFrom: [
    '*.js',
    '!jest.config.js',
    '!node_modules/**',
    '!coverage/**'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
