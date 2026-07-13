// Tests are additive: they exercise existing code without changing it.
// jest-expo handles the React Native / Expo module transforms and mocks.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    // Mirror the '@/...' path alias from tsconfig.json.
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Only pick up our own test files, never anything under node_modules.
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};
