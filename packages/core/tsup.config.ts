import type { Options } from 'tsup'

const env = process.env.NODE_ENV

export const tsup: Options = {
  splitting: false,
  // shims: true,
  clean: true,
  dts: true,
  format: [
    // 'cjs',
    'esm',
  ],
  minify: env === 'production',
  // bundle: env === 'production',
  bundle: true,
  skipNodeModulesBundle: true,
  watch: env === 'development' && 'src',
  target: 'es2020',
  // target: 'es2017',
  // target: 'node14',
  // outDir: env === 'production' ? 'dist' : 'lib',
  outDir: 'dist',
  // entry: ['src/**/*.ts'],
  entry: ['src/index.ts'],
}
