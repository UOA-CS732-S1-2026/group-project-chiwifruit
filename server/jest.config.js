module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude server.js as it's the entry point
  ],
};