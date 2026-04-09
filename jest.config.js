module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/tests/e2e/'],
  collectCoverageFrom: [
    'lib/i18n.js',
    'middleware/auth.js',
    'middleware/locale.js',
    'middleware/subscription.js',
    'services/emailService.js',
    'services/stateMachine.js',
    'utils/pagination.js',
    'utils/sanitize.js',
  ],
  coverageThreshold: {
    global: {
      lines: 99,
    },
  },
};
