export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/integration/**/*.test.js'],
  coverageReporters: ['lcov', 'text', 'json-summary'],
  passWithNoTests: true,
};
