import type { Logger as ViteLogger, FilterPattern } from 'vite'
import type { Plugin as ImageminPlugin } from 'imagemin'
import { CacheInterface } from '@file-cache/core/mjs/CacheInterface'

// type Required<T> = {
//   [P in keyof T]-?: T[P]
// }

export type PluginsConfig = {
  [fileExtension: string]: ImageminPlugin | ImageminPlugin[]
}

export type ResolvedPluginsConfig = {
  [fileExtension: string]: ImageminPlugin[]
}

export type MakeConfigOptions = {
  /**
   * Configuration of Imagemin plugins per file extension.
   */
  plugins: PluginsConfig

  /**
   * Callback for changing output filepath.
   * As default, filepaths will get either '.webp' or '.avif' appended.
   * @param filepath Filepath as returned from `options.formatFilePath` callback.
   * @default (filepath) => `${filepath}.ext`
   */
  formatFilePath?: (filepath: string) => string

  /**
   * Only create version if smaller than:
   * - smallest output for that file (`'smallest'`)
   * - optimized version of that file (`'optimized'`) (if no optimized version, compare to original)
   * - original file (`'original'`)
   * - ignore this feature (`false`)
   * @default 'optimized'
   */
  skipIfLargerThan?: false | 'original' | 'optimized' | 'smallest'
}

export type ResolvedMakeConfigOptions = {
  plugins: ResolvedPluginsConfig
  formatFilePath: (filepath: string) => string
  skipIfLargerThan: false | 'original' | 'optimized' | 'smallest'
}

export interface ConfigOptions {
  root?: string
  // entry?: string

  /**
   * Process files in assets dir only.
   * @default true
   */
  onlyAssets?: boolean

  /**
   * Used to filter files to include in processing.
   * Further filtering is based on the extensions used in `plugins` option.
   * @default [/\.(png|jpg|jpeg|gif|svg)$/i]
   */
  include?: FilterPattern

  /**
   * Used to filter files to exclude from processing.
   * @default [/node_modules/]
   */
  exclude?: FilterPattern

  /**
   * Callback for changing output filepath.
   * @default (filepath) => filepath
   */
  formatFilePath?: (filepath: string) => string

  /**
   * Console log results.
   * @default true
   */
  verbose?: boolean

  /**
   * Only optimize contents if it was updated.
   * @default true
   */
  cache?: boolean

  /**
   * Path of the directory to use for caching.
   * Either:
   *   - relative path to Vite's root
   *   - absolute path
   * @default <packageRoot>/node_modules/.cache/vite-plugin-imagemin
   */
  cacheDir?: string

  /**
   * Force-clear the cache.
   * @default false
   */
  clearCache?: boolean

  /**
   * Only use optimized contents if smaller than original.
   * @default true
   */
  skipIfLarger?: boolean

  /**
   * Configuration of Imagemin plugins per file extension.
   */
  plugins: PluginsConfig

  /**
   * Configuration object for the creation of WebP versions (skipped by default).
   * @default undefined
   */
  makeAvif?: MakeConfigOptions

  /**
   * Configuration object for the creation of Avif versions (skipped by default).
   * @default undefined
   */
  makeWebp?: MakeConfigOptions

  /**
   * Logger object with callbacks on info, warn and error keys.
   * @default Vite's resolved config's logger
   */
  logger?: Logger

  /**
   * Choose file size unit for log display.
   *
   * `1000` = kB
   * `1024` = KiB
   *
   * @default 1000
   */
  logByteDivider?: 1000 | 1024
}

export interface ResolvedConfigOptions {
  root?: string
  // entry: string
  include: FilterPattern
  exclude: FilterPattern
  formatFilePath: (file: string) => string
  onlyAssets: boolean
  verbose: boolean
  skipIfLarger: boolean
  cache: boolean
  cacheDir?: string
  clearCache: boolean
  plugins: ResolvedPluginsConfig
  makeAvif: false | ResolvedMakeConfigOptions
  makeWebp: false | ResolvedMakeConfigOptions
  logger: false | Logger
  logByteDivider: 1000 | 1024
}

export interface Logger {
  info: ViteLogger['info']
  warn: ViteLogger['warn']
  error: ViteLogger['error']
}

type StackItem = {
  toPath: string
  plugins: ImageminPlugin[]
  skipIfLarger: boolean | ResolvedMakeConfigOptions['skipIfLargerThan']
}

export type Stack = {
  [fromPath: string]: StackItem[]
}

export type ProcessFileParams = {
  baseDir?: string
  filePathFrom: string
  fileToStack: StackItem[]
  precisions: {
    size: number
    ratio: number
    duration: number
  }
  bytesDivider: number
  sizeUnit: string
  cacheDir?: string
  cache?: CacheInterface | null
}

export type ProcessedFile = {
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
  cached?: boolean
  optimizedDeleted: ResolvedMakeConfigOptions['skipIfLargerThan']
  avifDeleted: ResolvedMakeConfigOptions['skipIfLargerThan']
  webpDeleted: ResolvedMakeConfigOptions['skipIfLargerThan']
}

export type ErroredFile = {
  oldPath: string
  newPath: string
  error: string
  errorType: string
}

export type ProcessedResults = {
  // totalTime: number
  totalSize: {
    from: number
    to: number
  }
  maxLengths: {
    oldPath: number
    newPath: number
    oldSize: number
    newSize: number
    ratio: number
    duration: number
  }
  processedFiles: {
    [oldPath: string]: ProcessedFile[]
  }
  erroredFiles: {
    [oldPath: string]: ErroredFile[]
  }
}
interface IPromiseFulfilledResult<T> extends PromiseFulfilledResult<T> {
  status: 'fulfilled'
  value: T
}

interface IPromiseRejectedResult<T> extends PromiseRejectedResult {
  status: 'rejected'
  reason: T
}

export type ProcessResultWhenOutput =
  | IPromiseFulfilledResult<ProcessedFile>
  | IPromiseRejectedResult<ErroredFile>

export type ProcessResult =
  | IPromiseFulfilledResult<ProcessResultWhenOutput[]>
  | IPromiseRejectedResult<ErroredFile>

export type ProcessFileReturn = Promise<ErroredFile | ProcessResultWhenOutput[]>
