const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/components/**/*.test.[jt]s?(x)',
    '**/utils/**/*.test.[jt]s?(x)',
    '**/hooks/**/*.test.[jt]s?(x)',
    '**/app/**/*.test.[jt]s?(x)',
  ],
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/node_modules/(?:(?:@mswjs|msw)/)|exceljs|jszip|pako|saxes|fast-crc32c|ip-address|next-intl|use-intl)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const nextJestConfig = await createJestConfig(customJestConfig)()
  return {
    ...nextJestConfig,
    transformIgnorePatterns: [
      // Explicitly transform ESM-only packages
      'node_modules/(?!(msw|@mswjs|until-async|exceljs|jszip|pako|saxes|fast-crc32c|ip-address|next-intl|use-intl|intl-messageformat|@formatjs)/)',
    ],
  }
}
