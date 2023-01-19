import { Plugin } from 'imagemin'

/**
 * Jpegoptim imagemin plugin
 */
declare function imageminJpegoptim(options?: Options): Plugin

export type Options = {
  /**
   * Strip  all  markers  from  output  file.
   * @default true
   */
  stripAll?: boolean | undefined

  /**
   * Strip Comment (COM) markers from output file.
   * @default true
   */
  stripCom?: boolean | undefined

  /**
   * Strip EXIF markers from output file.
   * @default true
   */
  stripExif?: boolean | undefined

  /**
   * Strip IPTC / Adobe Photoshop (APP13) markers from output file.
   * @default true
   */
  stripIptc?: boolean | undefined

  /**
   * Strip ICC profiles from output file.
   * @default true
   */
  stripIcc?: boolean | undefined

  /**
   * Strip XMP profiles from output file.
   * @default true
   */
  stripXmp?: boolean | undefined

  /**
   * Force all output files to be progressive.
   */
  progressive?: boolean | undefined

  /**
   * Sets the maximum image quality factor (disables lossless optimization mode, which is
   * by default enabled). This option will reduce quality of those source files that were
   * saved  using  higher  quality  setting.  While files that already have lower quality
   * setting will be compressed using the lossless optimization method.
   *
   * Valid values for quality parameter are: 0 - 100
   */
  max?: number | undefined

  /**
   * Try to optimize file to given size (disables  lossless  optimization  mode).
   * Target size  is  specified  either  in kilobytes (1 - n) or as percentage (1% - 99%)
   * of the original file size.
   */
  size?: number | undefined
}

export default imageminJpegoptim
