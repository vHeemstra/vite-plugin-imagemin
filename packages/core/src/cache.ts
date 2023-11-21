import { createCache } from '@file-cache/core'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { normalizePath } from 'vite'

import {
  getPackageDirectory,
  getPackageName,
  isString,
  smartEnsureDirs,
} from './utils'

import type { CacheInterface } from '@file-cache/core/mjs/CacheInterface'
import type { ResolvedConfigOptions, StackItem } from './typings'

let cacheEnabled = false
let cache: CacheInterface
let cacheDir = ''

function initCacheDir(rootDir: string, _cacheDir?: string): void {
  // Note: Only cacheDir has a trailing slash.
  if (isString(_cacheDir)) {
    cacheDir =
      normalizePath(
        path.isAbsolute(_cacheDir)
          ? _cacheDir
          : path.resolve(rootDir, _cacheDir),
      ) + '/'
  } else {
    const packageDir = normalizePath(getPackageDirectory())
    cacheDir = `${packageDir}/node_modules/.cache/vite-plugin-imagemin/${getPackageName(
      packageDir,
    )}/`
  }

  mkdirSync(cacheDir.slice(0, -1), { recursive: true })
}

export const FileCache = {
  init: async (options: ResolvedConfigOptions, rootDir: string) => {
    cacheEnabled = options.cache !== false

    initCacheDir(rootDir, options.cacheDir)

    if (options.clearCache) {
      FileCache.clear()
    }

    cache = (await createCache({
      noCache: !cacheEnabled,
      cacheDirectory: cacheDir.slice(0, -1),
      mode: 'content',
      keys: [
        () => {
          return JSON.stringify(options)
        },
      ],
    })) as CacheInterface
  },

  prepareDirs: (filePaths: string[]): void => {
    if (cacheEnabled) {
      smartEnsureDirs(filePaths.map(file => cacheDir + file))
    }
  },

  check: async (
    baseDir: string,
    filePathFrom: string,
    fileToStack: StackItem[] = [],
  ) => {
    const inputFileCache = await cache?.getAndUpdateCache(
      baseDir + filePathFrom,
    )

    // Check if input file has changed or there was an error
    if (inputFileCache.changed || inputFileCache.error) {
      return false
    }

    // Check if output files are in cache and use them if they haven't changed
    const outputFilesExist = await Promise.allSettled(
      fileToStack.map(
        item =>
          new Promise((resolve, reject) =>
            cache
              .getAndUpdateCache(cacheDir + item.toPath)
              .then(outputFileCache => {
                if (!outputFileCache.error && !outputFileCache.changed) {
                  copyFileSync(cacheDir + item.toPath, baseDir + item.toPath)
                  if (existsSync(baseDir + item.toPath)) {
                    resolve(true)
                  }
                }
                reject(
                  outputFileCache.error
                    ? `Error while checking cache [${outputFileCache.error.message}]`
                    : 'Could not copy cached files',
                )
              })
              .catch(reject),
          ),
      ),
    )

    return outputFilesExist.every(p => p.status === 'fulfilled')
  },

  update: async (baseDir: string, filePathTo: string) => {
    if (cacheEnabled) {
      copyFileSync(baseDir + filePathTo, cacheDir + filePathTo)
      await cache.getAndUpdateCache(cacheDir + filePathTo)
    }
  },

  reconcile: async () => {
    await cache?.reconcile()
  },

  clear: () => {
    if (!cache || !cacheDir) {
      return
    }

    rmSync(cacheDir.slice(0, -1), { recursive: true, force: true })
  },
}
