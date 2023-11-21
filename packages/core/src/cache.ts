import crypto, { BinaryLike } from 'crypto'
import { copyFileSync, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizePath } from 'vite'

import {
  getPackageDirectory,
  getPackageName,
  isString,
  smartEnsureDirs,
} from './utils'

import type { ResolvedConfigOptions, StackItem } from './typings'

type CacheValue = {
  hash: string
}

let cacheEnabled = false
let cacheDir = ''
let cacheFile = ''
let fileCacheMap = new Map<string, CacheValue>()
let entryMap = new Map<string, CacheValue>()

async function initCacheDir(rootDir: string, _cacheDir?: string) {
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

  await mkdir(cacheDir.slice(0, -1), { recursive: true })
}

async function initCacheMaps(options: ResolvedConfigOptions) {
  // create unique file for every different set of options
  // does not take into account changes in plugin settings
  // because these are unreachable at this point
  const key = md5(JSON.stringify(options))
  cacheFile = path.join(cacheDir, 'contents-' + key)

  try {
    const json = JSON.parse(await readFile(cacheFile, 'utf-8'))
    entryMap = new Map<string, CacheValue>(Object.entries(json))
  } catch {
    entryMap = new Map<string, CacheValue>()
  }

  fileCacheMap = new Map<string, CacheValue>(entryMap)
}

function md5(buffer: BinaryLike): string {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

async function getAndUpdateCacheContent(filePath: string | URL) {
  try {
    const hash = md5(await readFile(filePath))
    const normalizedFilePath = filePath.toString()
    const cacheValue = fileCacheMap.get(normalizedFilePath) as
      | CacheValue
      | undefined
    if (cacheValue && cacheValue.hash === hash) {
      return {
        changed: false,
      }
    }
    entryMap.set(normalizedFilePath, { hash })
    return {
      changed: true,
    }
  } catch (error) {
    return {
      changed: false,
      error: error as Error,
    }
  }
}

export const FileCache = {
  init: async (options: ResolvedConfigOptions, rootDir: string) => {
    cacheEnabled = options.cache !== false

    await initCacheDir(rootDir, options.cacheDir)

    // clear cache?
    if (options.clearCache && cacheDir) {
      await rm(cacheDir.slice(0, -1), { recursive: true, force: true })
    }

    await initCacheMaps(options)
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
    const { changed, error } = await getAndUpdateCacheContent(
      baseDir + filePathFrom,
    )

    // Check if input file has changed or there was an error
    if (changed || error) {
      return false
    }

    // Check if output files are in cache and use them if they haven't changed
    const outputFilesExist = await Promise.allSettled(
      fileToStack.map(
        item =>
          new Promise((resolve, reject) =>
            getAndUpdateCacheContent(cacheDir + item.toPath)
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
    if (!cacheEnabled) {
      return
    }

    await copyFile(baseDir + filePathTo, cacheDir + filePathTo)
    await getAndUpdateCacheContent(cacheDir + filePathTo)
  },

  reconcile: async () => {
    if (!cacheEnabled) {
      return true
    }

    try {
      await writeFile(
        cacheFile,
        JSON.stringify(Object.fromEntries(entryMap)),
        'utf-8',
      )
      // reflect the changes in the cacheMap
      fileCacheMap = new Map(entryMap)
      return true
    } catch (error) {
      //   console.error('Cache reconcile has failed', error)
      return false
    }
  },
}
