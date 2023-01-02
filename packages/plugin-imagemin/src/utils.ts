import { ensureDirSync } from 'fs-extra'

export const isFunction = (
  arg: unknown,
): arg is (...args: unknown[]) => unknown => {
  return typeof arg === 'function'
}

export const isBoolean = (arg: unknown): arg is boolean => {
  return typeof arg === 'boolean'
}

export const isObject = (arg: unknown): arg is boolean => {
  return typeof arg === 'object'
}

export const isNotFalse = (arg: unknown): arg is boolean => {
  return !(isBoolean(arg) && !arg)
}

export const isRegExp = (arg: unknown): arg is RegExp => {
  return Object.prototype.toString.call(arg) === '[object RegExp]'
}

export const escapeRegExp = (text: string): string =>
  text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

/**
 * Ensure all (sub) directories of filepaths exist.
 * @param filePaths Array of filepaths.
 * @param mode Mode for newly created directories.
 */
export function smartEnsureDirs(filePaths: string[], mode = 0o0755): void {
  const fileRE = /\/[^/]*$/
  Array.from(new Set(filePaths.map(file => file.replace(fileRE, ''))))
    .map((dir): [string, number] => {
      return [dir, dir.split('/').length]
    })
    .sort((a, b) => b[1] - a[1])
    .reduce((dirs, [dir]) => {
      if (!dirs.some(d => d.startsWith(dir))) {
        dirs.push(dir)
      }
      return dirs
    }, [] as string[])
    .forEach(dir => ensureDirSync(dir, { mode }))
}
