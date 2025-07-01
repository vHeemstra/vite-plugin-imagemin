import crypto, { BinaryLike } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { normalizePath } from 'vite'

import {
  getPackageDirectory,
  getPackageName,
  isString,
  smartEnsureDirs,
} from './utils'

import type { CacheValue, ResolvedConfigOptions } from './typings'

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

async function checkAndUpdate({
  fileName,
  directory,
  stats,
  buffer,
  restoreTo,
}: {
  fileName: string
  directory?: string
  stats?: Omit<CacheValue, 'hash'>
  buffer?: Buffer | Uint8Array
  restoreTo?: string | false
}): Promise<{
  changed?: boolean
  value?: CacheValue
  error?: Error
}> {
  if (cacheEnabled) {
    if (!fileName) {
      return {
        error: new Error('Missing filename'),
      }
    }

    const filePath = (directory ?? cacheDir) + fileName

    if (!buffer) {
      try {
        buffer = await readFile(filePath)
      } catch (error) {
        return {
          error: error as Error,
        }
      }
    }

    const hash = md5(buffer)
    const cacheValue = fileCacheMap.get(filePath)
    if (cacheValue && cacheValue.hash === hash) {
      if (restoreTo) {
        try {
          await writeFile(restoreTo + fileName, buffer)
        } catch (error) {
          return {
            error: error as Error,
          }
        }
      }

      return {
        changed: false,
        value: cacheValue,
      }
    }

    entryMap.set(filePath, {
      hash,
      oldSize: stats?.oldSize ?? 1,
      newSize: stats?.newSize ?? 1,
    })
  }

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

  checkAndUpdate: checkAndUpdate,

  update: async ({
    fileName,
    buffer,
    directory,
    stats,
  }: {
    fileName: string
    buffer: Buffer | Uint8Array
    directory?: string
    stats?: Omit<CacheValue, 'hash'>
  }) => {
    if (!cacheEnabled) {
      return false
    }

    if (!fileName) {
      return {
        error: new Error('Missing filename'),
      }
    }

    if (!buffer) {
      return {
        error: new Error('Missing content for cache file'),
      }
    }

    const filePath = (directory ?? cacheDir) + fileName

    try {
      await writeFile(filePath, buffer)
    } catch (error) {
      return {
        error: new Error(
          `Could not write cache file [${(error as Error).message}]`,
        ),
      }
    }

    return await checkAndUpdate({
      fileName,
      directory,
      buffer,
      stats,
    })
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
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    } catch (error) {
      // console.error('Cache reconcile has failed', error)
      return false
    }
  },
}
