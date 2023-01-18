import { existsSync, mkdirSync } from 'node:fs'
import { FilterPattern } from 'vite'
// import { ensureDirSync } from 'fs-extra'

export const isFunction = (
  arg: unknown,
): arg is (...args: unknown[]) => unknown => {
  return typeof arg === 'function'
}

export const isBoolean = (arg: unknown): arg is boolean => {
  return typeof arg === 'boolean'
}

export const isString = (arg: unknown): arg is string => {
  return typeof arg === 'string'
}

export const isObject = (arg: unknown): arg is object => {
  return typeof arg === 'object' && arg !== null && !Array.isArray(arg)
}

export const isNotFalse = (arg: unknown): arg is boolean => {
  return !(isBoolean(arg) && !arg)
}

export const isRegExp = (arg: unknown): arg is RegExp => {
  return Object.prototype.toString.call(arg) === '[object RegExp]'
}

export const isFilterPattern = (arg: unknown): arg is FilterPattern => {
  return (
    isString(arg) ||
    isRegExp(arg) ||
    (Array.isArray(arg) &&
      arg.filter(v => !isString(v) && !isRegExp(v)).length == 0)
  )
}

export const escapeRegExp = (text: string): string =>
  text.replace(/[[\]{}()*+?.,/\\^$|#-]/g, '\\$&')

/**
 * Ensure all (sub) directories of filepaths exist.
 * @param filePaths Array of normalized filepaths.
 * @param mode Mode for newly created directories.
 */
export function smartEnsureDirs(filePaths: string[], mode = 0o0755): string[] {
  const fileRE = /\/[^/]*$/
  return Array.from(new Set(filePaths.map(file => file.replace(fileRE, ''))))
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
    .map(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode })
      }
      // ensureDirSync(dir, { mode })
      return dir
    })
}
