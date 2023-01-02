import type { FilterPattern } from '@rollup/pluginutils'
import type { Logger } from 'vite'
import type { Plugin as TImageminPlugin } from 'imagemin'

import type { Options as GifsicleOptions } from 'imagemin-gifsicle'
import type { Options as JpegtranOptions } from 'imagemin-jpegtran'
import type { Options as MozjpegOptions } from 'imagemin-mozjpeg'
import type { Options as OptipngOptions } from 'imagemin-optipng'
import type { Options as PngquantOptions } from 'imagemin-pngquant'
import type { Options as SvgoOptions } from 'imagemin-svgo'
import type { Options as WebpOptions } from 'imagemin-webp'
import type { Options as AvifOptions } from '@vheemstra/imagemin-avifenc'
// import type { Options as Gif2webpOptions } from 'imagemin-gif2webp'
// import type { Options as JpegoptimOptions } from 'imagemin-jpegoptim'
import type { Options as Gif2webpOptions } from '../types/imagemin-gif2webp/types'
import type { Options as JpegoptimOptions } from '../types/imagemin-jpegoptim/types'

type TPluginsConfig = {
  gif2webp?: boolean | Gif2webpOptions
  gifsicle?: boolean | GifsicleOptions
  jpegoptim?: boolean | JpegoptimOptions
  jpegtran?: boolean | JpegtranOptions
  mozjpeg?: boolean | MozjpegOptions
  optipng?: boolean | OptipngOptions
  pngquant?: boolean | PngquantOptions
  svgo?: boolean | SvgoOptions
  webp?: boolean | WebpOptions
  avif?: boolean | AvifOptions
}

type TAnyImageminPluginOptions =
  | Gif2webpOptions
  | GifsicleOptions
  | JpegoptimOptions
  | JpegtranOptions
  | MozjpegOptions
  | OptipngOptions
  | PngquantOptions
  | SvgoOptions
  | WebpOptions
  | AvifOptions

// type TJobConfig = {
//   filter?: RegExp | ((path: string) => boolean) | {
//     include: FilterPattern
//     exclude?: FilterPattern
//   }
//   formatFilePath?: (file: string) => string
//   plugins: TPluginsConfig[]
// }

// export type TJob = {
//   filter: ((path: string) => boolean)
//   formatFilePath: (file: string) => string
//   plugins: TAnyImageminPluginOptions[]
// }

export type TStack = {
  [fromPath: string]: TStackItem[]
}

export type TStackItem = {
  toPath: string
  plugins: TImageminPlugin[]
}

export interface IConfigOptions {
  root?: string
  entry?: string
  exclude?: FilterPattern
  include?: FilterPattern

  formatFilePath?: (file: string) => string

  /**
   * Process static assets from public dir as well
   * @default true
   */
  processStaticAssets?: boolean

  /**
   * Console log results
   * @default true
   */
  verbose?: boolean

  /**
   * Skip WebP version of file if it's larger than other optimized versions
   * @default false
   */
  skipWebpIfLarger?: boolean

  /**
   * Skip AVIF version of file if it's larger than other optimized versions
   * @default false
   */
  skipAvifIfLarger?: boolean

  /**
   * Configuration of Imagemin plugins
   */
  plugins?: TPluginsConfig
}

export type TMinifierConfig = {
  active: boolean
  plugin: (options?: object) => TImageminPlugin
  options?: TAnyImageminPluginOptions
}

export interface ILogger {
  info: Logger['info']
  warn: Logger['warn']
  error: Logger['error']
}

export type TProcessFileParams = {
  baseDir?: string
  filePathFrom: string
  fileToStack: TStackItem[]
}

export type TProcessedFile = {
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

export type TErroredFile = {
  oldPath: string
  newPath: string
  error: string
}

interface IPromiseFulfilledResult<T> extends PromiseFulfilledResult<T> {
  status: 'fulfilled'
  value: T
}

interface IPromiseRejectedResult<T> extends PromiseRejectedResult {
  status: 'rejected'
  reason: T
}

export type TProcessResultWhenOutput =
  | IPromiseFulfilledResult<TProcessedFile>
  | IPromiseRejectedResult<TErroredFile>

export type TProcessResult =
  | IPromiseFulfilledResult<TProcessResultWhenOutput[]>
  | IPromiseRejectedResult<TErroredFile>

export type TProcessFileReturn = Promise<
  TErroredFile | TProcessResultWhenOutput[]
>
