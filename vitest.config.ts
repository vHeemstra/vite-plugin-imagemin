// Configure Vite (https://vitejs.dev/config/)
// Configure Vitest (https://vitest.dev/config/)

import {
  defineConfig,
  // configDefaults,
} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

export default defineConfig({
  test: {
    // globals: true,
    // environment: 'happy-dom',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    dir: 'packages/core/src',
    // exclude: [...configDefaults.exclude, 'other/*', 'packages/playground/*'],
    testTimeout: 5000,
    globalSetup: ['./vitestGlobalSetup.ts'],
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', new GithubActionsReporter()]
      : 'default',
    coverage: {
      enabled: true,
      // provider: 'c8',
      // allowExternal: true,
      //
      provider: 'istanbul',
      all: true,
      include: ['**/packages/core/src/**'],
      reporter: [
        'html-spa',
        // 'html',
        'text',
        // 'clover',
        'lcov',
        // 'json',
      ],
      reportsDirectory: './coverage',
      clean: true,
      cleanOnRerun: true,
    },
  },
})
