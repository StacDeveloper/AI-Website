export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageReporters: ['lcov', 'text', 'json-summary'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!eslint.config.js',
    '!server.js',
    '!**/langgraph.js',
    '!configs/db.js',
    '!configs/gemini.js',
    '!configs/cloudinary.js',
    '!configs/model.js',
    '!babel.config.js',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      functions: 65,
      branches: 65,
      lines: 80,
    },
  },
};
