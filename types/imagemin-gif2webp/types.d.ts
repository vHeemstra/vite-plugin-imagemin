import { Plugin } from 'imagemin'

declare function imageminGif2webp(options?: Options): Plugin

export type Options = {
  /**
   * Encode image using lossy compression.
   * @default false
   */
  lossy?: boolean | undefined

  /**
   * For each frame in the image, pick lossy or lossless compression heuristically.
   * @default false
   */
  mixed?: boolean | undefined

  /**
   * Quality factor between 0 and 100.
   * @default 75
   */
  quality?: number | undefined

  /**
   * Specify the compression method to use, between 0 (fastest) and 6 (slowest).
   * @default 4
   */
  method?: number | undefined

  /**
   * Minimize output size. Lossless compression by default; can be combined with quality, method, lossy or mixed options.
   * @default false
   */
  minimize?: boolean | undefined

  /**
   * Min distance between key frames.
   * @default 9 (lossy = false) | 3 (lossy = true)
   */
  kmin?: number | undefined

  /**
   * Max distance between key frames.
   * @default 17 (lossy = false) | 5 (lossy = true)
   */
  kmax?: number | undefined

  /**
   * Filter strength between 0 (off) and 100 (maximum). (Only for lossy encoding.)
   * @default
   */
  filter?: number | undefined

  /**
   * Comma separated list of metadata to copy from the input to the output if present. Valid values: all, none, icc, xmp.
   * @default xmp
   */
  metadata?: string | undefined

  /**
   * Use multi-threading if available.
   * @default false
   */
  multiThreading?: boolean | undefined
}

export default imageminGif2webp
