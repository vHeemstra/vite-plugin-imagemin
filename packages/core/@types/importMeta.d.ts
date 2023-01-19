/// <reference types="vite/client" />

interface ImportMetaEnv {
  [key: string]: any
  // BASE_URL: string
  // MODE: string
  // DEV: boolean
  // PROD: boolean
  // SSR: boolean
  readonly VITEST: string
  readonly VITEST_MODE: string
  readonly VITEST_POOL_ID: string
  readonly VITEST_WORKER_ID: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
