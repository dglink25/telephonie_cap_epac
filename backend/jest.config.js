// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/tests/**',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches:   50,
      functions:  60,
      lines:      60,
      statements: 60,
    },
  },
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: false,
  setupFiles: ['<rootDir>/src/tests/setup.js'],
};
