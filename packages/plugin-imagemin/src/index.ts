import path from 'node:path'
import { lstatSync, readdirSync, unlinkSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'
import chalk from 'chalk'
import { normalizePath, createFilter } from 'vite'
import type { PluginOption, ResolvedConfig } from 'vite'
import type {
  IConfigOptions,
  TMinifierConfig,
  ILogger,
  TProcessFileParams,
  TStack,
  TProcessResultWhenOutput,
  TProcessResult,
  TProcessFileReturn,
  TErroredFile,
  TProcessedFile,
} from './typings'
import { isFunction, isBoolean, escapeRegExp, smartEnsureDirs } from './utils'

import imagemin from 'imagemin'
import type { Plugin as TImageminPlugin } from 'imagemin'
import imageminJpegtran from 'imagemin-jpegtran'
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminJpegoptim from 'imagemin-jpegoptim'
import imageminPngquant from 'imagemin-pngquant'
import imageminOptipng from 'imagemin-optipng'
import imageminGifsicle from 'imagemin-gifsicle'
import imageminSvgo from 'imagemin-svgo'
import imageminWebp from 'imagemin-webp'
import imageminGif2webp from 'imagemin-gif2webp'
// import imageminAvif from 'imagemin-avif'
import imageminAvif from '@vheemstra/imagemin-avifenc'

const defaultMinifiers: {
  [key: string]: TMinifierConfig
} = {
  gifsicle: {
    active: true,
    // options: {},
    plugin: imageminGifsicle,
  },
  mozjpeg: {
    active: true,
    // options: {},
    plugin: imageminMozjpeg,
  },
  jpegoptim: {
    active: false,
    // options: {},
    plugin: imageminJpegoptim,
  },
  jpegtran: {
    active: false,
    // options: {},
    plugin: imageminJpegtran,
  },
  pngquant: {
    active: true,
    // options: {},
    plugin: imageminPngquant,
  },
  optipng: {
    active: false,
    // options: {},
    plugin: imageminOptipng,
  },
  svgo: {
    active: true,
    // options: {},
    plugin: imageminSvgo,
  },
  webp: {
    active: false,
    // options: {},
    plugin: imageminWebp,
  },
  gif2webp: {
    active: false,
    // options: {},
    plugin: imageminGif2webp,
  },
  avif: {
    active: false,
    // options: {},
    plugin: imageminAvif,
  },
}

export default function viteImagemin(_opt: IConfigOptions = {}): PluginOption {
  const pluginSignature = [
    // chalk.yellowBright('⚡'),
    // chalk.blueBright('vite-plugin-imagemin'),
    chalk.yellow('⚡'),
    chalk.cyan('vite-plugin-imagemin'),
  ].join('')

  let config: ResolvedConfig
  let root: string
  // let sourceDir: string
  let distDir: string
  let assetsDir: string
  // let publicDir = ''
  // const entry: string = _opt?.entry || 'src'
  const onlyAssets =
    _opt && isBoolean(_opt?.onlyAssets) ? _opt.onlyAssets : false
  const verbose = _opt && isBoolean(_opt?.verbose) ? _opt.verbose : true
  const formatFilePath =
    _opt && isFunction(_opt?.formatFilePath)
      ? _opt.formatFilePath
      : (p: string) => p
  const skipWebpIfLarger =
    _opt && isBoolean(_opt?.skipWebpIfLarger) ? _opt.skipWebpIfLarger : false
  const skipAvifIfLarger =
    _opt && isBoolean(_opt?.skipAvifIfLarger) ? _opt.skipAvifIfLarger : false

  let logger: ILogger = {
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

  const filter = createFilter(
    _opt?.include || [/\.(png|jpg|jpeg|gif|svg)$/i],
    _opt?.exclude || [/node_modules/],
  )

  const plugins: { [key: string]: TImageminPlugin[] } = {
    all: [],
    avif: [],
    webp: [],
    gif2webp: [],
  }
  const usedPlugins: string[] = []

  const precisions = {
    size: 2,
    ratio: 1,
    duration: 0,
  }
  const bytesDivider = 1000
  const sizeUnit = bytesDivider === 1000 ? 'kB' : 'KiB'

  let hadFilesToProcess = false
  let webpDeleted = false
  let avifDeleted = false
  // let totalTime = 0
  const totalSize = {
    from: 0,
    to: 0,
  }
  const maxLengths = {
    oldPath: 0,
    newPath: 0,
    oldSize: 0,
    newSize: 0,
    ratio: 0,
    duration: 0,
  }
  // const mtimeCache = new Map<string, number>()
  const processedFiles: { [oldPath: string]: TProcessedFile[] } = {}
  const erroredFiles: { [oldPath: string]: TErroredFile[] } = {}

  function prepareImageminPlugins(): void {
    const pluginOptions: {
      [key: string]: boolean | object
    } = _opt?.plugins || {}

    const pluginHandles: { [pluginName: string]: string } = {
      jpegtran: 'jpg',
      mozjpeg: 'jpg',
      jpegoptim: 'jpg',
      pngquant: 'png',
      optipng: 'png',
      gifsicle: 'gif',
      svgo: 'svg',
      avif: 'avif',
      webp: 'webp',
      gif2webp: 'gif2webp',
    }
    const handledExt: { [ext: string]: true } = {}

    Object.entries(defaultMinifiers).forEach(
      ([key, { active, plugin, options }]) => {
        let opts: boolean | object | undefined = active ? options : false

        if (pluginOptions && typeof pluginOptions[key] !== 'undefined') {
          if (isBoolean(pluginOptions[key])) {
            opts = pluginOptions[key] && options
          } else {
            opts = pluginOptions[key]
          }
        }

        if (!isBoolean(opts)) {
          if (handledExt[pluginHandles[key]]) {
            logger.info(
              [
                pluginSignature,
                ' ',
                chalk.bgYellow(` WARNING `),
                chalk.yellow(
                  ` ${pluginHandles[
                    key
                  ].toUpperCase()} files already handled, so skipping ${key}`,
                ),
              ].join(''),
            )
          } else {
            usedPlugins.push(key)
            handledExt[pluginHandles[key]] = true
            const pluginGroup =
              pluginHandles[key].includes('webp') ||
              pluginHandles[key].includes('avif')
                ? pluginHandles[key]
                : 'all'
            plugins[pluginGroup].push(plugin(opts))
          }
        }
      },
    )
  }

  function getAllFiles(dir: string): string[] {
    let files: string[] = []
    try {
      const stats = lstatSync(dir)
      if (stats.isDirectory()) {
        readdirSync(dir).forEach(file => {
          files = files.concat(getAllFiles(path.join(dir, path.sep, file)))
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

  function processFile({
    filePathFrom,
    fileToStack = [],
    baseDir = '',
  }: TProcessFileParams): TProcessFileReturn {
    // const start = performance.now()

    if (!filePathFrom?.length) {
      return Promise.reject({
        oldPath: filePathFrom,
        newPath: '',
        error: 'Empty filepath',
      }) as Promise<TErroredFile>
    }

    if (!fileToStack?.length) {
      return Promise.reject({
        oldPath: filePathFrom,
        newPath: '',
        error: 'Empty to-stack',
      }) as Promise<TErroredFile>
    }

    let oldBuffer: Buffer
    let newBuffer: Buffer
    let oldSize = 0
    let newSize = 0

    return readFile(baseDir + filePathFrom)
      .then(buffer => {
        const start = performance.now()

        oldBuffer = buffer
        oldSize = oldBuffer.byteLength

        return Promise.allSettled(
          fileToStack.map(item => {
            const filePathTo = item.toPath

            return imagemin
              .buffer(oldBuffer, { plugins: item.plugins })
              .catch(e =>
                Promise.reject(
                  e.message ? `Error processing file [${e.message}]` : e,
                ),
              )
              .then(buffer2 => {
                newBuffer = buffer2
                newSize = newBuffer.byteLength
                // const newDirectory = path.dirname(baseDir + filePathTo)
                // await ensureDir(newDirectory, 0o755)
                return writeFile(baseDir + filePathTo, newBuffer)
              })
              .catch(e =>
                Promise.reject(
                  e.message ? `Error writing file [${e.message}]` : e,
                ),
              )
              .then(() => {
                const duration = performance.now() - start
                const ratio = newSize / oldSize - 1
                return Promise.resolve({
                  oldPath: filePathFrom,
                  newPath: filePathTo,
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
                  durationString: `${duration.toFixed(precisions.duration)} ms`,
                })
              })
              .catch(error =>
                Promise.reject({
                  oldPath: filePathFrom,
                  newPath: filePathTo,
                  error,
                }),
              )
          }),
        ) as Promise<TProcessResultWhenOutput[]>
      })
      .catch(
        e =>
          Promise.reject({
            oldPath: filePathFrom,
            newPath: '',
            error: `Error reading file [${e.message}]`,
          }) as Promise<TErroredFile>,
      )
  }

  function processResults(results: TProcessResult[]) {
    results.forEach(result => {
      let file: TProcessedFile | TErroredFile
      if (result.status === 'fulfilled') {
        result.value.forEach(result2 => {
          if (result2.status === 'fulfilled') {
            // Output success
            file = result2.value as TProcessedFile
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
            maxLengths.ratio = Math.max(
              maxLengths.ratio,
              file.ratioString.length,
            )
            maxLengths.duration = Math.max(
              maxLengths.duration,
              file.durationString.length,
            )
          } else {
            // Output error
            file = result2.reason as TErroredFile
            if (!erroredFiles[file.oldPath]) {
              erroredFiles[file.oldPath] = []
            }
            erroredFiles[file.oldPath].push({ ...file })
          }
          maxLengths.oldPath = Math.max(maxLengths.oldPath, file.oldPath.length)
          maxLengths.newPath = Math.max(maxLengths.newPath, file.newPath.length)
        })
      } else if (result.status === 'rejected') {
        // Input error
        file = result.reason as TErroredFile
        if (!erroredFiles[file.oldPath]) {
          erroredFiles[file.oldPath] = []
        }
        erroredFiles[file.oldPath].push({ ...file })
        maxLengths.oldPath = Math.max(maxLengths.oldPath, file.oldPath.length)
      }
    })
  }

  function logResults(results: TProcessedFile[]) {
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
      let logArray: string[] = []

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
        logArray = []
      }

      // Bullet & directory
      logArray.push(
        chalk.dim(a.length === i + 1 ? bullets[0] : bullets[1]),
        chalk.dim(
          file.newPath.replace(new RegExp(`${escapeRegExp(basenameTo)}$`), ''),
        ),
      )

      if (
        (basenameTo.endsWith('.webp') && webpDeleted) ||
        (basenameTo.endsWith('.avif') && avifDeleted)
      ) {
        // Skipped file
        logArray.push(
          chalk.dim(
            [
              basenameTo,
              ' '.repeat(
                maxPathLength -
                  bulletLength -
                  file.newPath.length +
                  spaceLength +
                  maxSizeLength -
                  4,
              ),
              `- ${sizeUnit} │ Skipped`,
            ].join(''),
          ),
        )
      } else {
        logArray.push(
          // Filename
          file.ratio < 0
            ? chalk.green(basenameTo)
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

  function logErrors(results: TErroredFile[]) {
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
      const basenameFrom = file.oldPath.length
        ? path.basename(file.oldPath)
        : ''
      const basenameTo = file.newPath.length ? path.basename(file.newPath) : ''
      let logArray: string[] = []

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
        logArray = []
      }

      if (a.length === 1 && basenameTo.length === 0) {
        // Input error
        logArray.push(
          // Bullet
          chalk.dim(bullets[0]),

          // Error
          chalk.bgRed(' ERROR '),
          ' ',
          chalk.red(file.error),
        )
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

          // Error
          chalk.bgRed(' ERROR '),
          ' ',
          chalk.red(file.error),
        )
      }

      logger.info(logArray.join(''))
    })
  }

  return {
    name: 'vite-plugin-copy',
    enforce: 'post',
    apply: 'build',
    configResolved: resolvedConfig => {
      config = resolvedConfig
      root = _opt?.root || config.root || process.cwd()

      // sourceDir = normalizePath(path.resolve(root, entry))
      distDir = normalizePath(path.resolve(root, config.build.outDir))
      assetsDir = normalizePath(path.resolve(distDir, config.build.assetsDir))

      // if (typeof config.publicDir === 'string') {
      //   publicDir = config.publicDir
      // }
      // publicDir = normalizePath(publicDir)

      if (verbose) {
        logger = config.logger
      }
    },
    // transform(code: string, id: string) {
    //   if (!filter(id)) return

    //   log(id)

    //   const item = {
    //     code: id,
    //     map: null, // provide source map if available
    //   };

    //   maps.set(id, item)
    //   // return item
    //   return
    // },
    // generateBundle(options, bundle) {
    //   // TODO: do all processing in closeBundle instead of here?

    //   plugins = getImageminPlugins()

    //   // log('--- Start bundle ---')
    //   // Object.keys(bundle).forEach(key => {
    //   //   log(key)
    //   // })
    //   // log('--- End bundle ---')

    //   // TODO: filter out chosen image files
    //   // TODO: compress .svg with imagemin-svgo
    //   // TODO: compress .(png|jpe?g|gif) with imagemin-*
    //   // TODO: if webp: copy .(png|jpe?g) to *.webp and compress with webp
    //   // TODO: if webp: compress .gif with gif2webp

    //   Object.entries(bundle).forEach(([id, chunkOrAssetInfo]) => {
    //     if (!filter(id) || chunkOrAssetInfo.type !== 'asset') return

    //     log(path.resolve(config.build.outDir, id))

    //     // const fullFilePath = path.join(config.build.outDir, filePath);
    //     // if (existsSync(fullFilePath) === false) {
    //     //   return;
    //     // }
    //     // const { mtimeMs } = await fs.stat(fullFilePath);
    //     // if (mtimeMs <= (mtimeCache.get(filePath) || 0)) {
    //     //   return;
    //     // }
    //     // mtimeCache.set(filePath, Date.now());

    //     // mtimeCache.set(id, 1)

    //     let filename = id.replace(sourceDir, '')
    //     filename = _opt?.formatFilePath?.(filename) || filename

    //     // processedFiles.set(filename, {
    //     //   oldSize: chunkOrAssetInfo.source.byteLength,
    //     //   newSize: chunkOrAssetInfo.source.byteLength,
    //     //   ext: '',
    //     // });

    //     this.emitFile({
    //       type: 'asset',
    //       fileName: `${filename}.webp`,
    //       source: chunkOrAssetInfo.source,
    //       // source: id,
    //     })
    //   })
    // },
    async closeBundle() {
      const timeStart = performance.now()

      logger.info('')

      prepareImageminPlugins()

      // logger.info('')
      // logger.info(root)
      // logger.info(sourceDir)
      // logger.info(publicDir)
      // logger.info(distDir)
      // logger.info(assetsDir)
      // logger.info('')

      const processDir = onlyAssets ? assetsDir : distDir
      const baseDir = `${root}/`
      const rootRE = new RegExp(`^${escapeRegExp(baseDir)}`)

      // Get all input files to (potentially) process
      const files = getAllFiles(processDir)
        .filter(filter)
        .map(file => [
          normalizePath(file).replace(rootRE, ''),
          normalizePath(formatFilePath(file)).replace(rootRE, ''),
        ])

      if (files.length === 0) return

      // Prepare stack to process (grouped per input file)
      const gifRE = /\.gif$/i
      const webpRE = /\.(jpe?g|png)$/i
      const avifRE = /\.(jpe?g|png)$/i

      const fileStack: TStack = {}
      const toPaths: string[] = []

      files.forEach(([fromFile, toFile]) => {
        fileStack[fromFile] = []

        if (plugins.all.length) {
          fileStack[fromFile].push({
            toPath: toFile,
            plugins: plugins.all,
          })
          toPaths.push(toFile)
        }

        if (plugins.gif2webp.length && gifRE.test(fromFile)) {
          fileStack[fromFile].push({
            toPath: `${toFile}.webp`,
            plugins: plugins.gif2webp,
          })
          toPaths.push(`${toFile}.webp`)
        }

        if (plugins.webp.length && webpRE.test(fromFile)) {
          fileStack[fromFile].push({
            toPath: `${toFile}.webp`,
            plugins: plugins.webp,
          })
          toPaths.push(`${toFile}.webp`)
        }

        if (plugins.avif.length && avifRE.test(fromFile)) {
          fileStack[fromFile].push({
            toPath: `${toFile}.avif`,
            plugins: plugins.avif,
          })
          toPaths.push(`${toFile}.avif`)
        }

        if (fileStack[fromFile].length === 0) {
          delete fileStack[fromFile]
        } else {
          hadFilesToProcess = true
        }
      })

      // Ensure all destination (sub)directories are present
      smartEnsureDirs(toPaths.map(file => baseDir + file))

      // Process stack
      await (
        Promise.allSettled(
          Object.entries(fileStack).map(([fromFile, toStack]) =>
            processFile({
              filePathFrom: fromFile,
              fileToStack: toStack,
              baseDir,
            }),
          ),
        ) as Promise<TProcessResult[]>
      ).then(results => processResults(results))

      // Log results
      if (hadFilesToProcess) {
        logger.info(
          [
            pluginSignature,
            ' compressed these files:',
            chalk.dim(
              ' (using ' +
                usedPlugins.map(n => chalk.magenta(n)).join(', ') +
                ')',
            ),
          ].join(''),
        )

        Object.keys(processedFiles)
          .sort((a, b) => a.localeCompare(b)) // TODO: sort by (sub)folder and depth?
          .forEach(k => {
            // Delete WebP version if larger than other optimized version
            const webpVersion = processedFiles[k].find(f =>
              f.newPath.endsWith('.webp'),
            )
            if (skipWebpIfLarger && webpVersion) {
              const smallestVersion = processedFiles[k]
                .slice()
                .sort((a, b) => a.ratio - b.ratio)[0]
              if (!smallestVersion.newPath.endsWith('.webp')) {
                unlinkSync(baseDir + webpVersion.newPath)
                webpDeleted = true
              }
            }

            // Delete AVIF version if larger than other optimized version
            const avifVersion = processedFiles[k].find(f =>
              f.newPath.endsWith('.avif'),
            )
            if (skipAvifIfLarger && avifVersion) {
              const smallestVersion = processedFiles[k]
                .slice()
                .sort((a, b) => a.ratio - b.ratio)[0]
              if (!smallestVersion.newPath.endsWith('.avif')) {
                unlinkSync(baseDir + avifVersion.newPath)
                avifDeleted = true
              }
            }

            logResults(processedFiles[k])
          })

        Object.keys(erroredFiles)
          .sort((a, b) => a.localeCompare(b)) // TODO: sort by (sub)folder and depth?
          .forEach(k => {
            logErrors(erroredFiles[k])
          })

        // TODO: Totals

        logger.info('')
        logger.info(
          [
            chalk.dim('    in '),
            Math.round(performance.now() - timeStart),
            chalk.dim(' ms'),
            // chalk.dim('    of '),
            // Math.round(totalTime),
            // chalk.dim(' ms'),
          ].join(''),
        )
      }
    },
  }
}
