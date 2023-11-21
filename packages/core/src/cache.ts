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

type CacheFileInfo = {
  oldPath: string
  newPath: string
  oldSize: number
  newSize: number
  ratio: number
  duration: number
  oldSizeString: string
  newSizeString: string
  ratioString: string
  durationString: string
}

type CacheValue = {
  hash: string
  info?: CacheFileInfo
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

async function getAndUpdateCacheContent(
  filePath: string,
  info?: CacheFileInfo,
) {
  try {
    const hash = md5(await readFile(filePath))
    const cacheValue = fileCacheMap.get(filePath)

    if (cacheValue && cacheValue.hash === hash) {
      return {
        changed: false,
        info: cacheValue.info,
      }
    }

    // save new hash && provided info in entry
    const entry = entryMap.get(filePath)
    const updatedEntry = { ...entry, hash, info: info ?? entry?.info }
    entryMap.set(filePath, updatedEntry)
    return {
      changed: true,
      info: updatedEntry.info,
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
      return
    }

    const outputFilesExist = await Promise.allSettled(
      fileToStack.map(item => {
        return new Promise((resolve, reject) => {
          getAndUpdateCacheContent(cacheDir + filePathFrom)
            .then(({ changed, error, info }) => {
              if (error || changed || !info) {
                return reject(error?.message)
              }

              try {
                copyFileSync(cacheDir + item.toPath, baseDir + item.toPath)

                if (existsSync(baseDir + item.toPath)) {
                  return resolve({ ...info, cached: true })
                }
              } catch {
                return reject('Could not copy cached file')
              }

              reject()
            })
            .catch(reject)
        })
      }),
    )

    const allFulFilled = outputFilesExist.every(p => p.status === 'fulfilled')

    if (allFulFilled) {
      return outputFilesExist
    }
  },

  update: async (baseDir: string, info: CacheFileInfo) => {
    if (!cacheEnabled) {
      return
    }

    await copyFile(baseDir + info.newPath, cacheDir + info.newPath)
    await getAndUpdateCacheContent(cacheDir + info.newPath, info)
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
