import crypto, { BinaryLike } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { normalizePath } from 'vite'

import {
  getPackageDirectory,
  getPackageName,
  isString,
  smartEnsureDirs,
} from './utils'

import type { CacheValue, ResolvedConfigOptions, StackItem } from './typings'

let cacheEnabled = false
let cacheDir = ''
let cacheKey = ''
let cacheFile = ''
let fileCacheMap = new Map<string, CacheValue>()
let entryMap = new Map<string, CacheValue>()

function md5(buffer: BinaryLike): string {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

export function createCacheKey(options: ResolvedConfigOptions) {
  return md5(
    Object.entries(options)
      .filter(
        ([k]) =>
          // Ignore these options, since they don't influence the files' content.
          ![
            'cache',
            'clearCache',
            'logByteDivider',
            'logger',
            'verbose',
          ].includes(k),
      )
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([k, v], i) => `${i}_${k}_${v}`)
      .join('|'),
  )
}

async function initCacheDir(rootDir: string, options: ResolvedConfigOptions) {
  cacheKey = createCacheKey(options)

  const packageDir = normalizePath(getPackageDirectory())
  const packageName = getPackageName(packageDir)

  if (isString(options.cacheDir)) {
    cacheDir = normalizePath(
      isAbsolute(options.cacheDir)
        ? options.cacheDir
        : resolve(rootDir, options.cacheDir),
    )
  } else {
    cacheDir = `${packageDir}/node_modules/.cache/vite-plugin-imagemin`
  }

  // cacheDir = cacheDir + `/${packageName}/${cacheKey}/`
  cacheDir = cacheDir + `/${packageName}/`

  if (options.clearCache) {
    await rm(cacheDir.slice(0, -1), { recursive: true, force: true })
  }

  if (!cacheEnabled) {
    return
  }

  await mkdir(cacheDir.slice(0, -1), { recursive: true })
}

async function initCacheMaps() {
  cacheFile = `${cacheDir}/contents-${cacheKey}.json`

  try {
    const json = JSON.parse(await readFile(cacheFile, 'utf-8'))
    entryMap = new Map<string, CacheValue>(Object.entries(json))
  } catch {
    entryMap = new Map<string, CacheValue>()
  }

  fileCacheMap = new Map<string, CacheValue>(entryMap)
}

async function getAndUpdateCacheContent(
  filePath: string,
  stats?: Omit<CacheValue, 'hash'>,
): Promise<{
  changed?: boolean
  value?: CacheValue
  error?: Error
}> {
  let hash = ''
  try {
    hash = md5(await readFile(filePath))
  } catch (error) {
    return {
      error: error as Error,
    }
  }

  const cacheValue = fileCacheMap.get(filePath)
  if (cacheValue && cacheValue.hash === hash) {
    return {
      changed: false,
      value: cacheValue,
    }
  }

  entryMap.set(filePath, {
    hash,
    oldSize: stats?.oldSize ?? 0,
    newSize: stats?.newSize ?? 0,
  })

  return {
    changed: true,
  }
}

export const FileCache = {
  init: async (options: ResolvedConfigOptions, rootDir: string) => {
    cacheEnabled = options.cache !== false

    await initCacheDir(rootDir, options)

    if (!cacheEnabled) {
      return
    }

    await initCacheMaps()
  },

  prepareDirs: (filePaths: string[]): void => {
    if (!cacheEnabled) {
      return
    }

    smartEnsureDirs(filePaths.map(file => cacheDir + file))
  },

  checkAndCopy: async (
    baseDir: string,
    filePathFrom: string,
    fileToStack: StackItem[] = [],
  ): Promise<[boolean, (string | CacheValue)[]]> => {
    if (!cacheEnabled) {
      return [false, []]
    }

    const inputCacheStatus = await getAndUpdateCacheContent(
      baseDir + filePathFrom,
    )

    // Check if input file has changed or there was an error
    if (inputCacheStatus?.error || inputCacheStatus?.changed) {
      return [false, []]
    }

    // Check if output files are in cache and use them if they haven't changed
    const outputFilesExist = await Promise.allSettled(
      fileToStack.map(async item => {
        const outputCacheStatus = await getAndUpdateCacheContent(
          cacheDir + item.toPath,
        )

        if (outputCacheStatus?.error) {
          return `Cache error [${outputCacheStatus.error.message}]`
        }

        if (outputCacheStatus?.changed) {
          return 'File changed'
        }

        try {
          await copyFile(cacheDir + item.toPath, baseDir + item.toPath)
        } catch (error) {
          return `Could not copy cached file [${(error as Error).message}]`
        }

        if (!existsSync(baseDir + item.toPath)) {
          return 'Could not use cached file'
        }

        return outputCacheStatus.value as CacheValue
      }),
    )

    return [
      true,
      outputFilesExist.map(p =>
        p.status === 'fulfilled' ? p.value : p.reason,
      ),
    ]
  },

  update: async (
    baseDir: string,
    filePathTo: string,
    stats: Omit<CacheValue, 'hash'>,
  ) => {
    if (!cacheEnabled) {
      return
    }

    await copyFile(baseDir + filePathTo, cacheDir + filePathTo)
    await getAndUpdateCacheContent(cacheDir + filePathTo, stats)
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

      fileCacheMap = new Map(entryMap)

      return true
    } catch (error) {
      // console.error('Cache reconcile has failed', error)
      return false
    }
  },
}
