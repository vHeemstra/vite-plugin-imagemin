import { mergeConfig } from 'vite'
import {
  // configDefaults,
  defineConfig,
} from 'vitest/config'
import viteConfig from './playground/vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: [
        'packages/plugin-imagemin/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      // exclude: [...configDefaults.exclude, './other/*', './playground/*'],
      testTimeout: 5000,
      globalSetup: ['./vitest.global-setup.js'],
      coverage: {
        all: true,
        include: ['packages/plugin-imagemin/src/**'],
        reportsDirectory: './test/coverage',
        provider: 'istanbul',
        // Add Vitest UI ? (https://vitest.dev/guide/ui.html)
      },
    },
  }),
)
