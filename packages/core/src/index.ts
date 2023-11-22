import chalk from 'chalk'
import imagemin from 'imagemin'
import isAPNG from 'is-apng'
import { Buffer } from 'node:buffer'
import { lstatSync, readdirSync, unlinkSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createFilter, normalizePath } from 'vite'

import { FileCache } from './cache'
import {
  escapeRegExp,
  isBoolean,
  isFilterPattern,
  isFunction,
  isObject,
  isString,
  smartEnsureDirs,
} from './utils'

import type { PluginOption, ResolvedConfig } from 'vite'
import type {
  ConfigOptions,
  ErroredFile,
  FormatProcessedFileParams,
  Logger,
  PluginsConfig,
  ProcessFileParams,
  ProcessFileReturn,
  ProcessResult,
  ProcessedFile,
  ProcessedResults,
  ResolvedConfigOptions,
  ResolvedMakeConfigOptions,
  ResolvedPluginsConfig,
  Stack,
} from './typings'

// export const pathIsWithin = (parentPath: string, childPath: string) => {
//   try {
//     const relative = path.relative(parentPath, childPath)
//     return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
//   } catch (e) {
//     return false
//   }
// }

export const parsePlugins = (rawPlugins: PluginsConfig) => {
  let plugins: false | ResolvedPluginsConfig = false
  if (rawPlugins && isObject(rawPlugins)) {
    let hasPlugins = false
    plugins = Object.entries(rawPlugins).reduce((o, [k, v]) => {
      if (typeof v === 'function') {
        o[k] = [v]
        hasPlugins = true
      } else if (Array.isArray(v)) {
        o[k] = v.filter(f => isFunction(f))
        hasPlugins = hasPlugins || o[k].length > 0
      }
      return o
    }, {} as ResolvedPluginsConfig)

    if (!hasPlugins) {
      plugins = false
    }
  }

  return plugins
}

export const parseOptions = (
  _options: ConfigOptions,
): false | ResolvedConfigOptions => {
  if (!isObject(_options)) {
    return false
  }

  const plugins = parsePlugins(_options.plugins)
  if (!plugins) {
    return false
  }

  let makeAvif: false | ResolvedMakeConfigOptions = false
  if (_options?.makeAvif && isObject(_options.makeAvif?.plugins)) {
    const avifPlugins = parsePlugins(_options.makeAvif.plugins)

    if (avifPlugins) {
      makeAvif = {
        plugins: avifPlugins,
        formatFilePath: isFunction(_options.makeAvif.formatFilePath)
          ? _options.makeAvif.formatFilePath
          : f => `${f}.avif`,
        skipIfLargerThan:
          false === _options.makeAvif.skipIfLargerThan
            ? _options.makeAvif.skipIfLargerThan
            : isString(_options.makeAvif.skipIfLargerThan)
              ? _options.makeAvif.skipIfLargerThan
              : 'optimized',
      }
    }
  }

  let makeWebp: false | ResolvedMakeConfigOptions = false
  if (_options?.makeWebp && isObject(_options.makeWebp?.plugins)) {
    const webpPlugins = parsePlugins(_options.makeWebp.plugins)

    if (webpPlugins) {
      makeWebp = {
        plugins: webpPlugins,
        formatFilePath: isFunction(_options.makeWebp.formatFilePath)
          ? _options.makeWebp.formatFilePath
          : f => `${f}.webp`,
        skipIfLargerThan:
          false === _options.makeWebp.skipIfLargerThan
            ? _options.makeWebp.skipIfLargerThan
            : isString(_options.makeWebp.skipIfLargerThan)
              ? _options.makeWebp.skipIfLargerThan
              : 'optimized',
      }
    }
  }

  return {
    // General options
    root: isString(_options?.root) ? _options.root : undefined,
    // entry: _options?.entry || 'src',

    // Input options
    include: isFilterPattern(_options?.include)
      ? _options.include
      : [/\.(png|jpg|jpeg|gif|svg)$/i],
    exclude: isFilterPattern(_options?.exclude)
      ? _options.exclude
      : [/node_modules/],
    onlyAssets: isBoolean(_options?.onlyAssets) ? _options.onlyAssets : false,

    // Process options
    formatFilePath: isFunction(_options?.formatFilePath)
      ? _options.formatFilePath
      : (p: string) => p,
    skipIfLarger: isBoolean(_options?.skipIfLarger)
      ? _options.skipIfLarger
      : true,
    cache: isBoolean(_options?.cache) ? _options.cache : true,
    cacheDir: isString(_options?.cacheDir) ? _options.cacheDir : undefined,
    cacheKey: isString(_options?.cacheDir) ? _options.cacheDir : '',
    clearCache: isBoolean(_options?.clearCache) ? _options.clearCache : false,
    plugins,
    makeAvif,
    makeWebp,

    // Log options
    verbose: isBoolean(_options?.verbose) ? _options.verbose : true,
    logger:
      isObject(_options?.logger) && isFunction(_options?.logger?.info)
        ? _options.logger
        : false,
    logByteDivider:
      _options?.logByteDivider && Number.isInteger(_options?.logByteDivider)
        ? _options.logByteDivider
        : 1000,
  }
}

export function getAllFiles(dir: string, logger: Logger): string[] {
  let files: string[] = []
  try {
    const stats = lstatSync(dir)
    if (stats.isDirectory()) {
      readdirSync(dir).forEach(file => {
        files = files.concat(
          getAllFiles(path.join(dir, path.sep, file), logger),
        )
      })
    } else {
      // [DISABLED] Cache lookup
      // if (stats.mtimeMs > (mtimeCache.get(dir) || 0)) {
      //   mtimeCache.set(dir, stats.mtimeMs)
      files.push(dir)
      // }
    }
  } catch (error) {
    // ENOENT SystemError (trown by lstatSync() if non-existent path)
    logger.error('Error: ' + (error as Error)?.message)
  }
  return files
}

export function formatProcessedFile({
  oldPath,
  newPath,
  oldSize,
  newSize,
  duration,
  fromCache,
  precisions,
  bytesDivider,
  sizeUnit,
}: FormatProcessedFileParams) {
  const ratio = newSize / oldSize - 1

  return {
    oldPath,
    newPath,
    oldSize,
    newSize,
    ratio,
    duration,
    oldSizeString: `${(oldSize / bytesDivider).toFixed(
      precisions.size,
    )} ${sizeUnit}`,
    newSizeString: `${(newSize / bytesDivider).toFixed(
      precisions.size,
    )} ${sizeUnit}`,
    ratioString: `${ratio > 0 ? '+' : ratio === 0 ? ' ' : ''}${(
      ratio * 100
    ).toFixed(precisions.ratio)} %`,
    durationString: fromCache
      ? 'Cache'
      : `${duration.toFixed(precisions.duration)} ms`,
    fromCache,
    optimizedDeleted: false as const,
    avifDeleted: false as const,
    webpDeleted: false as const,
  }
}

export async function processFile({
  filePathFrom,
  fileToStack = [],
  baseDir = '',
  precisions,
  bytesDivider,
  sizeUnit,
}: ProcessFileParams): ProcessFileReturn {
  // const start = performance.now()

  if (!filePathFrom?.length) {
    return Promise.reject({
      oldPath: filePathFrom,
      newPath: '',
      error: 'Empty filepath',
      errorType: 'error',
    }) as Promise<ErroredFile>
  }

  if (!fileToStack?.length) {
    return Promise.reject({
      oldPath: filePathFrom,
      newPath: '',
      error: 'Empty to-stack',
      errorType: 'error',
    }) as Promise<ErroredFile>
  }

  const [inputCacheStatus, outputCacheStatus] = await FileCache.checkAndCopy(
    baseDir,
    filePathFrom,
    fileToStack,
  )

  let cacheStack: (false | Promise<ProcessedFile>)[] = []

  if (inputCacheStatus) {
    let hasFullValidCache = true

    cacheStack = outputCacheStatus.map((status, i) => {
      if (isString(status)) {
        hasFullValidCache = false
        return false
      }

      return Promise.resolve(
        formatProcessedFile({
          oldPath: filePathFrom,
          newPath: fileToStack[i].toPath,
          oldSize: status.oldSize,
          newSize: status.newSize,
          duration: 0,
          fromCache: true,
          precisions,
          bytesDivider,
          sizeUnit,
        }),
      )
    })

    if (hasFullValidCache) {
      return Promise.allSettled(cacheStack as Promise<ProcessedFile>[])
    }
  }

  let oldBuffer: Buffer
  let oldSize = 0

  return readFile(baseDir + filePathFrom)
    .then(buffer => {
      const start = performance.now()

      oldBuffer = buffer
      oldSize = oldBuffer.byteLength

      // TODO: handle elsewhere with
      // (to-make-myself) `imagemin-apngquant` plugin
      // `imagemin-apngquant` uses:
      //  - is-apng
      //  - apngdis-bin
      //  - (concat frames to strip) [see script at: ...?]
      //  - optimize using:
      //    - user-supplied plugin + options
      //    ? pngquant fallback
      //  - apng-asm (strip to apng)
      if (filePathFrom.match(/\.a?png$/i) && isAPNG(buffer)) {
        /**
         * TODO:
         * - apngdis the input APNG, then:
         * - if output path .png: make strip + run plugins + apngasm from strip + output
         * - if output path .webp: plugin each frame + run frames through webpmux-bin + single .webp output
         *
         * @see C:\Users\phili\Desktop\APNG\test\index.js
         */
        throw new Error('SKIP: Animated PNGs not supported')

        // Copy input to tmp dir .png

        // apngdis-bin: this file to frame `.png`s

        // convert/optimize each .png to .webp

        // webpmux-bin: combine all .webp to final .webp

        // // const fileString = buffer.toString('utf8')
        // const idatIdx = buffer.indexOf('IDAT')
        // const actlIdx = buffer.indexOf('acTL')
        // if (
        //   filePathFrom.endsWith('.png') &&
        //   idatIdx > 0 &&
        //   actlIdx > 0 &&
        //   idatIdx > actlIdx
        // ) {
        //   throw new Error('SKIP: Animated PNGs not supported')
        // }
      }

      return Promise.allSettled(
        fileToStack.map((item, i) => {
          let newBuffer: Buffer
          let newSize = 0

          const filePathTo = item.toPath

          if (cacheStack[i]) {
            return cacheStack[i] as Promise<ProcessedFile>
          }

          return imagemin
            .buffer(oldBuffer, { plugins: item.plugins })
            .catch(e =>
              Promise.reject(
                // e.message ? `Error processing file [${e.message}]` : e,
                e.message ? `Error processing file:\n${e.message}` : e,
              ),
            )
            .then(buffer2 => {
              newBuffer = buffer2
              newSize = newBuffer.byteLength

              if (false !== item.skipIfLarger && newSize > oldSize) {
                // throw new Error('SKIP: Output is larger')
                if (filePathTo === filePathFrom) {
                  // NOTE:
                  // If this optimized file is larger than original
                  // and this is not a WebP/Avif version;
                  // don't overwrite the original, but do continue (to have it log with the rest).
                  return Promise.resolve()
                }
              }

              // const newDirectory = path.dirname(baseDir + filePathTo)
              // await ensureDir(newDirectory, 0o755)
              return writeFile(baseDir + filePathTo, newBuffer)
            })
            .catch(e => {
              if (e?.message) {
                if (e.message.startsWith('SKIP: ')) {
                  e = e.message
                } else {
                  e = `Error writing file [${e.message}]`
                }
              }
              return Promise.reject(e)
            })
            .then(async () => {
              await FileCache.update(baseDir, filePathTo, {
                oldSize,
                newSize,
              })

              return Promise.resolve(
                formatProcessedFile({
                  oldPath: filePathFrom,
                  newPath: filePathTo,
                  oldSize,
                  newSize,
                  duration: performance.now() - start,
                  fromCache: false,
                  precisions,
                  bytesDivider,
                  sizeUnit,
                }),
              )
            })
            .catch(error => {
              let errorType = 'error'
              if (error.startsWith('SKIP: ')) {
                error = error.slice(6)
                errorType = 'skip'
              } else if (error.startsWith('WARN: ')) {
                error = error.slice(6)
                errorType = 'warning'
              }

              return Promise.reject({
                oldPath: filePathFrom,
                newPath: filePathTo,
                error,
                errorType,
              })
            })
        }),
      )
    })
    .catch(e => {
      let errorType = 'error'
      let error = (e as Error).message

      if (error.startsWith('SKIP: ')) {
        error = error.slice(6)
        errorType = 'skip'
        // } else if (error.startsWith('WARN: ')) {
        //   error = error.slice(6)
        //   errorType = 'warning'
      } else {
        error = `Error reading file [${error}]`
      }

      return Promise.reject({
        oldPath: filePathFrom,
        newPath: '',
        error,
        errorType,
      }) as Promise<ErroredFile>
    })
}

export function processResults(results: ProcessResult[]): ProcessedResults {
  // let totalTime: ProcessedResults["totalTime"] = 0
  const totalSize: ProcessedResults['totalSize'] = {
    from: 0,
    to: 0,
  }
  const maxLengths: ProcessedResults['maxLengths'] = {
    oldPath: 0,
    newPath: 0,
    oldSize: 0,
    newSize: 0,
    ratio: 0,
    duration: 0,
  }
  const processedFiles: ProcessedResults['processedFiles'] = {}
  const erroredFiles: ProcessedResults['erroredFiles'] = {}

  results.forEach(result => {
    let file: ProcessedFile | ErroredFile
    if (result.status === 'fulfilled') {
      result.value.forEach(result2 => {
        if (result2.status === 'fulfilled') {
          // Output success
          file = result2.value as ProcessedFile
          if (!processedFiles[file.oldPath]) {
            processedFiles[file.oldPath] = []
          }
          processedFiles[file.oldPath].push({ ...file })
          totalSize.from += file.oldSize
          totalSize.to += file.newSize
          maxLengths.oldSize = Math.max(
            maxLengths.oldSize,
            file.oldSizeString.length,
          )
          maxLengths.newSize = Math.max(
            maxLengths.newSize,
            file.newSizeString.length,
          )
          maxLengths.ratio = Math.max(maxLengths.ratio, file.ratioString.length)
          maxLengths.duration = Math.max(
            maxLengths.duration,
            file.durationString.length,
          )
        } else {
          // Output error
          file = result2.reason as ErroredFile
          if (!erroredFiles[file.oldPath]) {
            erroredFiles[file.oldPath] = []
          }
          erroredFiles[file.oldPath].push({ ...file })
        }
        maxLengths.oldPath = Math.max(maxLengths.oldPath, file.oldPath.length)
        maxLengths.newPath = Math.max(maxLengths.newPath, file.newPath.length)
      })
    } else {
      // Input error
      file = result.reason as ErroredFile
      if (!erroredFiles[file.oldPath]) {
        erroredFiles[file.oldPath] = []
      }
      erroredFiles[file.oldPath].push({ ...file })
      maxLengths.oldPath = Math.max(maxLengths.oldPath, file.oldPath.length)
    }
  })

  return {
    // totalTime,
    totalSize,
    maxLengths,
    processedFiles,
    erroredFiles,
  }
}

export function logResults(
  results: ProcessedFile[],
  logger: Logger,
  maxLengths: ProcessedResults['maxLengths'],
) {
  // logger.info('')

  const bullets = [' └─ ', ' ├─ '] // ▶▷
  const bulletLength = bullets[0].length
  // const bullets = [chalk.greenBright(' ✓ '), chalk.greenBright(' ✓ ')]
  // const bulletLength = 3
  const spaceLength = 2
  const maxPathLength = Math.max(
    maxLengths.oldPath,
    maxLengths.newPath + bulletLength,
  )
  const maxSizeLength = Math.max(maxLengths.oldSize, maxLengths.newSize)

  results.forEach((file, i, a) => {
    // totalTime += file.duration
    const basenameFrom = path.basename(file.oldPath)
    const basenameTo = path.basename(file.newPath)
    let logArray: string[] = ['  ']

    // Input file
    if (i === 0) {
      logArray.push(
        chalk.dim(
          file.oldPath.replace(
            new RegExp(`${escapeRegExp(basenameFrom)}$`),
            '',
          ),
        ),
        basenameFrom,
        ' '.repeat(maxPathLength - file.oldPath.length + spaceLength),

        // Size
        ' '.repeat(maxSizeLength - file.oldSizeString.length),
        file.oldSizeString,
        chalk.dim(' │ '),
      )
      logger.info(logArray.join(''))
      logArray = ['  ']
    }

    // Bullet & directory
    logArray.push(
      chalk.dim(a.length === i + 1 ? bullets[0] : bullets[1]),
      chalk.dim(
        file.newPath.replace(new RegExp(`${escapeRegExp(basenameTo)}$`), ''),
      ),
    )

    file.optimizedDeleted =
      !basenameTo.match(/\.(webp|avif)$/i) && file.optimizedDeleted
    file.webpDeleted = basenameTo.endsWith('.webp') && file.webpDeleted
    file.avifDeleted = basenameTo.endsWith('.avif') && file.avifDeleted
    if (file.optimizedDeleted || file.webpDeleted || file.avifDeleted) {
      // Skipped file
      logArray.push(
        // Filename
        file.fromCache ? chalk.blue.dim(basenameTo) : chalk.dim(basenameTo),
        ' '.repeat(
          maxPathLength - bulletLength - file.newPath.length + spaceLength,
        ),

        // Size
        ' '.repeat(maxSizeLength - file.newSizeString.length),
        chalk.dim(file.newSizeString),
        chalk.dim(' │ '),

        // Ratio
        ' '.repeat(maxLengths.ratio - file.ratioString.length),
        chalk.dim(file.ratioString),
        // file.ratio < 0
        //   ? chalk.green(file.ratioString)
        //   : file.ratio > 0
        //   ? chalk.red(file.ratioString)
        //   : file.ratioString,
        chalk.dim(
          ` │ Skipped │ Larger than ${
            file.optimizedDeleted || file.webpDeleted || file.avifDeleted
          }`,
        ),
      )
    } else {
      logArray.push(
        // Filename
        file.ratio < 0
          ? file.fromCache
            ? chalk.blue(basenameTo)
            : chalk.green(basenameTo)
          : file.ratio > 0
            ? chalk.yellow(basenameTo)
            : basenameTo,
        ' '.repeat(
          maxPathLength - bulletLength - file.newPath.length + spaceLength,
        ),

        // Size
        ' '.repeat(maxSizeLength - file.newSizeString.length),
        chalk.dim(file.newSizeString),
        chalk.dim(' │ '),

        // Ratio
        ' '.repeat(maxLengths.ratio - file.ratioString.length),
        file.ratio < 0
          ? chalk.green(file.ratioString)
          : file.ratio > 0
            ? chalk.red(file.ratioString)
            : file.ratioString,
        chalk.dim(' │ '),

        // Duration
        ' '.repeat(maxLengths.duration - file.durationString.length),
        chalk.dim(file.durationString),
      )
    }

    logger.info(logArray.join(''))
  })
}

export function logErrors(
  results: ErroredFile[],
  logger: Logger,
  maxLengths: ProcessedResults['maxLengths'],
) {
  logger.info('')

  const bullets = [' └─ ', ' ├─ '] // ▶▷
  const bulletLength = bullets[0].length
  // const bullets = [chalk.redBright(' ✗ '), chalk.redBright(' ✗ ')]
  // const bulletLength = 3
  const spaceLength = 2
  const maxPathLength = Math.max(
    maxLengths.oldPath,
    maxLengths.newPath + bulletLength,
  )

  results.forEach((file, i, a) => {
    // totalTime += file.duration
    const basenameFrom = file.oldPath.length ? path.basename(file.oldPath) : ''
    const basenameTo = file.newPath.length ? path.basename(file.newPath) : ''
    let logArray: string[] = ['  ']

    // Input file
    if (i === 0) {
      logArray.push(
        basenameFrom.length
          ? chalk.dim(
              file.oldPath.replace(
                new RegExp(`${escapeRegExp(basenameFrom)}$`),
                '',
              ),
            ) + basenameFrom
          : '(empty filepath)',
      )
      logger.info(logArray.join(''))
      logArray = ['  ']
    }

    if (a.length === 1 && basenameTo.length === 0) {
      // Input error
      logArray.push(
        // Bullet
        chalk.dim(bullets[0]),
      )

      // Error
      switch (file.errorType) {
        case 'skip':
          logArray.push(
            chalk.black.bgWhite(' SKIPPED '),
            // chalk.inverse.black(' SKIPPED '),
            ' ',
            file.error,
          )
          break
        case 'warning':
          logArray.push(
            chalk.bgYellow(' WARNING '),
            ' ',
            chalk.yellow(file.error),
          )
          break
        default:
          logArray.push(chalk.bgRed(' ERROR '), ' ', chalk.red(file.error))
          break
      }
    } else {
      // Processing / output error
      logArray.push(
        // Bullet & directory
        chalk.dim(a.length === i + 1 ? bullets[0] : bullets[1]),
        basenameTo.length
          ? chalk.dim(
              file.newPath.replace(
                new RegExp(`${escapeRegExp(basenameTo)}$`),
                '',
              ),
            ) + basenameTo
          : '(empty filepath)',
        ' '.repeat(
          maxPathLength -
            (basenameTo.length ? file.newPath.length : 16) +
            spaceLength,
        ),
      )

      // Error
      switch (file.errorType) {
        case 'skip':
          logArray.push(
            chalk.black.bgWhite(' SKIPPED '),
            // chalk.inverse.black(' SKIPPED '),
            ' ',
            file.error,
          )
          break
        case 'warning':
          logArray.push(
            chalk.bgYellow(' WARNING '),
            ' ',
            chalk.yellow(file.error),
          )
          break
        default:
          logArray.push(chalk.bgRed(' ERROR '), ' ', chalk.red(file.error))
          break
      }
    }

    logger.info(logArray.join(''))
  })
}

export default function viteImagemin(_options: ConfigOptions): PluginOption {
  const pluginSignature =
    chalk.yellow('⚡') + chalk.cyan('vite-plugin-imagemin')

  const options = parseOptions(_options)
  if (!options) {
    throw new Error('Missing valid `plugins` option')
  }

  let config: ResolvedConfig
  let rootDir: string
  // let sourceDir: string
  let outDir: string
  let assetsDir: string
  // let publicDir: string
  // const entry = options.entry
  const onlyAssets = options.onlyAssets
  const verbose = options.verbose
  const formatFilePath = options.formatFilePath
  const bytesDivider = options.logByteDivider
  const sizeUnit = bytesDivider === 1000 ? 'kB' : 'KiB'

  /* istanbul ignore next -- @preserve */
  let logger: Logger = {
    info: () => {
      null
    },
    warn: () => {
      null
    },
    error: () => {
      null
    },
  }

  const filter = createFilter(options.include, options.exclude)

  const precisions = {
    size: 2,
    ratio: 2,
    duration: 0,
  }

  let hadFilesToProcess = false
  // const mtimeCache = new Map<string, number>()

  return {
    name: 'vite-plugin-imagemin',
    enforce: 'post',
    apply: 'build',
    configResolved: resolvedConfig => {
      config = resolvedConfig

      rootDir = options.root || config.root
      rootDir = normalizePath(
        path.isAbsolute(rootDir)
          ? rootDir
          : path.resolve(process.cwd(), rootDir),
      )

      // sourceDir = normalizePath(path.resolve(rootDir, entry))
      outDir = normalizePath(path.resolve(rootDir, config.build.outDir))
      assetsDir = normalizePath(path.resolve(outDir, config.build.assetsDir))
      // publicDir = normalizePath(path.resolve(rootDir, config.publicDir))

      // const emptyOutDir = config.build.emptyOutDir || pathIsWithin(rootDir, outDir)

      if (verbose) {
        logger = options.logger || config.logger
      }
    },
    async closeBundle() {
      const timeStart = performance.now()

      logger.info('')

      await FileCache.init(options, rootDir)

      const processDir = onlyAssets ? assetsDir : outDir
      const baseDir = `${rootDir}/`
      const rootRE = new RegExp(`^${escapeRegExp(baseDir)}`)

      // Get all input files to (potentially) process
      const files = getAllFiles(processDir, logger)
        .filter(filter)
        .map(file => [
          normalizePath(file).replace(rootRE, ''),
          normalizePath(formatFilePath(file)).replace(rootRE, ''),
        ])

      if (files.length === 0) return

      const fileRE: { [ext: string]: RegExp } = {
        jpg: /\.jpe?g$/i,
        gif: /\.gif$/i,
        png: /\.png$/i,
        svg: /\.svg$/i,
      }

      // Prepare stack to process (grouped per input file)
      const fileStack: Stack = {}
      const toPaths: string[] = []

      files.forEach(([fromFile, toFile]) => {
        fileStack[fromFile] = []

        // Enqueue optimizations
        Object.keys(options.plugins).forEach(ext => {
          if (
            (fileRE?.[ext] && fileRE[ext].test(fromFile)) ||
            fromFile.endsWith(`.${ext}`)
          ) {
            fileStack[fromFile].push({
              toPath: toFile,
              plugins: options.plugins[ext],
              skipIfLarger: options.skipIfLarger,
            })
            toPaths.push(toFile)
          }
        })

        // Enqueue Avifs
        if (isObject(options.makeAvif)) {
          const _formatFilePath = options.makeAvif.formatFilePath
          const _skipIfLarger = options.makeAvif.skipIfLargerThan

          Object.entries(options.makeAvif.plugins).forEach(([ext, plugins]) => {
            if (
              (fileRE?.[ext] && fileRE[ext].test(fromFile)) ||
              fromFile.endsWith(`.${ext}`)
            ) {
              fileStack[fromFile].push({
                toPath: _formatFilePath(toFile),
                plugins: plugins,
                skipIfLarger: _skipIfLarger,
              })
              toPaths.push(_formatFilePath(toFile))
            }
          })
        }

        // Enqueue WebPs
        if (isObject(options.makeWebp)) {
          const _formatFilePath = options.makeWebp.formatFilePath
          const _skipIfLarger = options.makeWebp.skipIfLargerThan

          Object.entries(options.makeWebp.plugins).forEach(([ext, plugins]) => {
            if (
              (fileRE?.[ext] && fileRE[ext].test(fromFile)) ||
              fromFile.endsWith(`.${ext}`)
            ) {
              fileStack[fromFile].push({
                toPath: _formatFilePath(toFile),
                plugins: plugins,
                skipIfLarger: _skipIfLarger,
              })
              toPaths.push(_formatFilePath(toFile))
            }
          })
        }

        if (fileStack[fromFile].length === 0) {
          delete fileStack[fromFile]
        } else {
          hadFilesToProcess = true
        }
      })

      // Ensure all destination (sub)directories are present
      smartEnsureDirs(toPaths.map(file => baseDir + file))
      FileCache.prepareDirs(toPaths)

      // Process stack
      const {
        // totalTime,
        totalSize,
        maxLengths,
        processedFiles,
        erroredFiles,
      } = await (
        Promise.allSettled(
          Object.entries(fileStack).map(([fromFile, toStack]) =>
            processFile({
              filePathFrom: fromFile,
              fileToStack: toStack,
              baseDir,
              precisions,
              bytesDivider,
              sizeUnit,
            }),
          ),
        ) as Promise<ProcessResult[]>
      ).then(results => processResults(results))

      // Log results
      if (hadFilesToProcess) {
        logger.info(
          [
            pluginSignature,
            ' processed these files:',
            // chalk.dim(
            //   ' (using ' +
            //     usedPlugins.map(n => chalk.magenta(n)).join(', ') +
            //     ')',
            // ),
          ].join(''),
        )

        Object.keys(processedFiles)
          .sort((a, b) => a.localeCompare(b)) // TODO: sort by (sub)folder and depth?
          .forEach(k => {
            // Report optimized version as skipped if larger than original
            const optimizedVersionIdx = processedFiles[k].findIndex(
              f => !f.newPath.match(/\.(webp|avif)$/i),
            )
            if (options.skipIfLarger && optimizedVersionIdx >= 0) {
              const optimizedVersion = processedFiles[k][optimizedVersionIdx]
              if (optimizedVersion.ratio > 0) {
                processedFiles[k][optimizedVersionIdx].optimizedDeleted =
                  'original'
              }
            }

            // Delete WebP version if larger than other optimized version
            const webpVersionIdx = processedFiles[k].findIndex(f =>
              f.newPath.endsWith('.webp'),
            )
            if (
              options.makeWebp &&
              options.makeWebp.skipIfLargerThan &&
              webpVersionIdx >= 0
            ) {
              const webpVersion = processedFiles[k][webpVersionIdx]
              let shouldRemove = false
              /* istanbul ignore else -- @preserve */
              if ('smallest' === options.makeWebp.skipIfLargerThan) {
                const smallestVersion = processedFiles[k]
                  .slice()
                  .sort((a, b) => a.ratio - b.ratio)[0]
                shouldRemove = smallestVersion.ratio < webpVersion.ratio
              } else if ('optimized' === options.makeWebp.skipIfLargerThan) {
                const optimizedVersion = processedFiles[k].find(f =>
                  f.newPath.replace(/\.webp$/, ''),
                )
                shouldRemove = Boolean(
                  optimizedVersion &&
                    optimizedVersion.ratio < webpVersion.ratio,
                )
              }
              if (shouldRemove) {
                unlinkSync(baseDir + webpVersion.newPath)
                // rmSync(baseDir + webpVersion.newPath, { force: true })
                processedFiles[k][webpVersionIdx].webpDeleted =
                  options.makeWebp.skipIfLargerThan
              }
            }

            // Delete AVIF version if larger than other optimized version
            const avifVersionIdx = processedFiles[k].findIndex(f =>
              f.newPath.endsWith('.avif'),
            )
            if (
              options.makeAvif &&
              options.makeAvif.skipIfLargerThan &&
              avifVersionIdx >= 0
            ) {
              const avifVersion = processedFiles[k][avifVersionIdx]
              let shouldRemove = false
              /* istanbul ignore else -- @preserve */
              if ('smallest' === options.makeAvif.skipIfLargerThan) {
                const smallestVersion = processedFiles[k]
                  .slice()
                  .sort((a, b) => a.ratio - b.ratio)[0]
                shouldRemove = smallestVersion.ratio < avifVersion.ratio
              } else if ('optimized' === options.makeAvif.skipIfLargerThan) {
                const optimizedVersion = processedFiles[k].find(f =>
                  f.newPath.replace(/\.avif$/, ''),
                )
                shouldRemove = Boolean(
                  optimizedVersion &&
                    optimizedVersion.ratio < avifVersion.ratio,
                )
              }
              if (shouldRemove) {
                unlinkSync(baseDir + avifVersion.newPath)
                // rmSync(baseDir + avifVersion.newPath, { force: true })
                processedFiles[k][avifVersionIdx].avifDeleted =
                  options.makeAvif.skipIfLargerThan
              }
            }

            // Subtract size from total if skipped
            processedFiles[k].forEach(f => {
              if (f.optimizedDeleted || f.webpDeleted || f.avifDeleted) {
                totalSize.from -= f.oldSize
                totalSize.to -= f.newSize
              }
            })

            logResults(processedFiles[k], logger, maxLengths)
          })

        FileCache.reconcile()

        Object.keys(erroredFiles)
          .sort((a, b) => a.localeCompare(b)) // TODO: sort by (sub)folder and depth?
          .forEach(k => {
            logErrors(erroredFiles[k], logger, maxLengths)
          })

        // Log totals
        if (verbose) {
          const totalOldSize = `${(totalSize.from / bytesDivider).toFixed(
            precisions.size,
          )}`
          const totalNewSize = `${(totalSize.to / bytesDivider).toFixed(
            precisions.size,
          )}`
          const totalDuration = `${(performance.now() - timeStart).toFixed(
            precisions.duration,
          )}`
          const maxLengthTotals =
            Math.max(
              totalOldSize.length,
              totalNewSize.length,
              totalDuration.length,
            ) + 2
          const totalRatio = (totalSize.to / totalSize.from - 1) * 100

          const totalRatioString = isNaN(totalRatio)
            ? '0 %'
            : totalRatio < 0
              ? chalk.green(
                  `-${Math.abs(totalRatio).toFixed(precisions.ratio)} %`,
                )
              : totalRatio > 0
                ? chalk.red(
                    `+${Math.abs(totalRatio).toFixed(precisions.ratio)} %`,
                  )
                : `${Math.abs(totalRatio).toFixed(precisions.ratio)} %`

          logger.info('')

          logger.info(
            [
              chalk.dim(`Total size:   `),
              ' '.repeat(maxLengthTotals - totalOldSize.length),
              totalOldSize,
              ` ${sizeUnit}`,
            ].join(''),
          )

          logger.info(
            [
              chalk.dim(`Minified size:`),
              ' '.repeat(maxLengthTotals - totalNewSize.length),
              totalNewSize,
              ` ${sizeUnit}`,
              '  ',
              totalRatioString,
            ].join(''),
          )

          logger.info(
            [
              chalk.dim(`Total time:     `),
              totalDuration,
              ' ms',
              // chalk.dim('    of '),
              // Math.round(totalTime),
              // chalk.dim(' ms'),
            ].join(''),
          )
        }
      }
    },
  }
}
