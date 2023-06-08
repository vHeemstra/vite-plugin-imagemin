import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'
import { mergeConfig, build, normalizePath, UserConfig } from 'vite'
import {
  existsSync,
  mkdirSync,
  rmSync,
  // lstatSync,
  // readdirSync,
  // readFileSync,
} from 'node:fs'
import {
  dirname,
  relative,
  join,
  // resolve,
  // sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

import _config from '../../playground/vite.config'
import viteImagemin, {
  parseOptions,
  parsePlugins,
  getAllFiles,
  processFile,
  processResults,
  logResults,
  logErrors,
} from './index'

// Your chosen Imagemin plugins:
import imageminMozjpeg from 'imagemin-mozjpeg'
// import imageminJpegtran from 'imagemin-jpegtran'
// import imageminJpegoptim from 'imagemin-jpegoptim'
// import imageminPngquant from 'imagemin-pngquant'
// import imageminOptipng from 'imagemin-optipng'
import imageminOxipng from '@vheemstra/imagemin-oxipng'
import imageminGifsicle from 'imagemin-gifsicle'
import imageminSvgo from 'imagemin-svgo'
import imageminWebp from 'imagemin-webp'
import imageminGif2webp from 'imagemin-gif2webp'
// import imageminAvif from 'imagemin-avif'
import imageminAvif from '@vheemstra/imagemin-avifenc'

import type { Plugin } from 'imagemin'
import type {
  ConfigOptions,
  Logger,
  ProcessFileParams,
  ProcessResult,
  ResolvedConfigOptions,
} from './typings'

/**
 * Directory path of this file polyfill
 * @see https://antfu.me/posts/publish-esm-and-cjs
 */
const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url))

/**
 * Prepare playground config without viteImagemin plugin
 */
const config = _config as UserConfig
const playgroundConfig = {
  ...config,
  plugins:
    config?.plugins?.filter(p => {
      return !(
        p &&
        !Array.isArray(p) &&
        !(p instanceof Promise) &&
        p?.name === 'vite-plugin-imagemin'
      )
    }) || [],
}

/**
 * Default build config for all tests
 */
const buildConfig = {
  root: 'packages/playground',
  logLevel: 'silent',
  configFile: false,
  build: {
    // esbuild do not minify ES lib output since that would remove pure annotations and break tree-shaking
    // skip transpilation during tests to make it faster
    target: 'esnext',
    // tests are flaky when `emptyOutDir` is `true`
    emptyOutDir: false,
    minify: false,
  },
}
const getBuildConfig = (plugin, extraOptions = {}) =>
  mergeConfig(
    buildConfig,
    Object.assign(
      {
        ...playgroundConfig,
        plugins: playgroundConfig.plugins.concat(plugin),
      },
      extraOptions,
    ),
  )

// const root = normalizePath(
//   relative(normalizePath(process.cwd()), normalizePath(_dirname)),
// )
const root = 'packages/playground'
const skipBuilds = typeof process.env.VITEST_SKIP_BUILDS !== 'undefined'

const mockPlugin: Plugin = b => Promise.resolve(b)
const mockFormatFilePath = (f: string) => `__${f}__`
const mockLogger: Logger = {
  info: (msg: string) => msg,
  warn: (msg: string) => msg,
  error: (msg: string) => msg,
}

describe('parsePlugins', () => {
  it('false on false, empty or invalid', () => {
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins(null)).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins(undefined)).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins(false)).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins(true)).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins([])).toBe(false)
    expect(parsePlugins({})).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins({ ext: null })).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins({ ext: [null] })).toBe(false)
    // @ts-expect-error testing wrong argument type
    expect(parsePlugins({ ext: ['test', false] })).toBe(false)
  })

  it('returns filtered plugins array', () => {
    expect(parsePlugins({ ext: mockPlugin })).toMatchObject({
      ext: [mockPlugin],
    })

    expect(parsePlugins({ ext: [mockPlugin] })).toMatchObject({
      ext: [mockPlugin],
    })

    expect(
      // @ts-expect-error testing wrong argument type
      parsePlugins({ ext: ['test', mockPlugin, false, mockPlugin] }),
    ).toMatchObject({ ext: [mockPlugin, mockPlugin] })
  })
})

describe('parseOptions', () => {
  describe('options.plugins', () => {
    it('false on empty or invalid', () => {
      // @ts-expect-error testing wrong argument type
      expect(parseOptions()).toBe(false)
      // @ts-expect-error testing wrong argument type
      expect(parseOptions({})).toBe(false)
    })
  })

  describe('options.makeAvif', () => {
    const base = {
      plugins: { ext: mockPlugin },
      makeAvif: { plugins: { ext: mockPlugin } },
    }

    it.each([
      ['bool ', false],
      ['bool ', true],
      ['', undefined],
      ['string ', 'test'],
      ['object ', {}],
      ['object ', { plugins: {} }],
    ] as [string, any][])(`is false on %s%s`, (typeString: string, v: any) => {
      const parsedOptions = parseOptions({
        plugins: { ext: mockPlugin },
        makeAvif: v,
      }) as ResolvedConfigOptions
      expect(parsedOptions).toHaveProperty('makeAvif')
      expect(parsedOptions.makeAvif).toBe(false)
    })

    it('formatFilePath is default or valid callback', () => {
      let options: ConfigOptions & {
        makeAvif: Exclude<ConfigOptions['makeAvif'], undefined>
      }
      let parsedOptions: false | ResolvedConfigOptions

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeAvif.formatFilePath = {}
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty('makeAvif.formatFilePath')
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeAvif.formatFilePath).toBeTypeOf('function')
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeAvif.formatFilePath('XXX')).toBe('XXX.avif')

      options = Object.assign({}, base)
      options.makeAvif.formatFilePath = mockFormatFilePath
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toMatchObject({
        makeAvif: {
          plugins: { ext: [mockPlugin] },
          formatFilePath: mockFormatFilePath,
        },
      })
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeAvif.formatFilePath('XXX')).toBe('__XXX__')
    })

    it('skipIfLargerThan is false, string or default', () => {
      let options: ConfigOptions & {
        makeAvif: Exclude<ConfigOptions['makeAvif'], undefined>
      }
      let parsedOptions: false | ResolvedConfigOptions
      const defaultVal = 'optimized'

      options = Object.assign({}, base)
      options.makeAvif.skipIfLargerThan = false
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty('makeAvif.skipIfLargerThan', false)

      options = Object.assign({}, base)
      options.makeAvif.skipIfLargerThan = 'original'
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeAvif.skipIfLargerThan',
        'original',
      )

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeAvif.skipIfLargerThan = true
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeAvif.skipIfLargerThan',
        defaultVal,
      )

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeAvif.skipIfLargerThan = {}
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeAvif.skipIfLargerThan',
        defaultVal,
      )
    })
  })

  describe('options.makeWebp', () => {
    const base = {
      plugins: { ext: mockPlugin },
      makeWebp: { plugins: { ext: mockPlugin } },
    }

    it.each([
      ['bool ', false],
      ['bool ', true],
      ['', undefined],
      ['string ', 'test'],
      ['object ', {}],
      ['object ', { plugins: {} }],
    ] as [string, any][])(`is false on %s%s`, (typeString: string, v: any) => {
      const parsedOptions = parseOptions({
        plugins: { ext: mockPlugin },
        makeWebp: v,
      }) as ResolvedConfigOptions
      expect(parsedOptions).toHaveProperty('makeWebp')
      expect(parsedOptions.makeWebp).toBe(false)
    })

    it('formatFilePath is default or valid callback', () => {
      let options: ConfigOptions & {
        makeWebp: Exclude<ConfigOptions['makeWebp'], undefined>
      }
      let parsedOptions: false | ResolvedConfigOptions

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeWebp.formatFilePath = {}
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty('makeWebp.formatFilePath')
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeWebp.formatFilePath).toBeTypeOf('function')
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeWebp.formatFilePath('XXX')).toBe('XXX.webp')

      options = Object.assign({}, base)
      options.makeWebp.formatFilePath = mockFormatFilePath
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toMatchObject({
        makeWebp: {
          plugins: { ext: [mockPlugin] },
          formatFilePath: mockFormatFilePath,
        },
      })
      // @ts-expect-error asserting existence of correct type
      expect(parsedOptions.makeWebp.formatFilePath('XXX')).toBe('__XXX__')
    })

    it('skipIfLargerThan is false, string or default', () => {
      let options: ConfigOptions & {
        makeWebp: Exclude<ConfigOptions['makeWebp'], undefined>
      }
      let parsedOptions: false | ResolvedConfigOptions
      const defaultVal = 'optimized'

      options = Object.assign({}, base)
      options.makeWebp.skipIfLargerThan = false
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty('makeWebp.skipIfLargerThan', false)

      options = Object.assign({}, base)
      options.makeWebp.skipIfLargerThan = 'original'
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeWebp.skipIfLargerThan',
        'original',
      )

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeWebp.skipIfLargerThan = true
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeWebp.skipIfLargerThan',
        defaultVal,
      )

      options = Object.assign({}, base)
      // @ts-expect-error testing wrong argument type
      options.makeWebp.skipIfLargerThan = {}
      parsedOptions = parseOptions(options)
      expect(parsedOptions).toHaveProperty(
        'makeWebp.skipIfLargerThan',
        defaultVal,
      )
    })
  })

  // TODO? better types for options/parsedOptions etc (see above)
  describe('options.root', () => {
    it('is provided string or undefined', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      let options

      options = Object.assign({}, base)
      options.root = false
      options = parseOptions(options)
      expect(options).toHaveProperty('root')
      expect(options.root).toBeUndefined()

      options = Object.assign({}, base)
      options.root = true
      options = parseOptions(options)
      expect(options).toHaveProperty('root')
      expect(options.root).toBeUndefined()

      options = Object.assign({}, base)
      options.root = ''
      options = parseOptions(options)
      expect(options).toHaveProperty('root', '')

      options = Object.assign({}, base)
      options.root = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('root', 'test')
    })
  })

  describe('options.include', () => {
    it('is provided pattern or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = [/\.(png|jpg|jpeg|gif|svg)$/i]
      let options

      options = Object.assign({}, base)
      options.include = false
      options = parseOptions(options)
      expect(options).toHaveProperty('include', defaultVal)

      options = Object.assign({}, base)
      options.include = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('include', 'test')
    })
  })

  describe('options.exclude', () => {
    it('is provided pattern or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = [/node_modules/]
      let options

      options = Object.assign({}, base)
      options.exclude = false
      options = parseOptions(options)
      expect(options).toHaveProperty('exclude', defaultVal)

      options = Object.assign({}, base)
      options.exclude = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('exclude', 'test')
    })
  })

  describe('options.onlyAssets', () => {
    it('is provided boolean or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = false
      let options

      options = Object.assign({}, base)
      options.onlyAssets = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('onlyAssets', defaultVal)

      options = Object.assign({}, base)
      options.onlyAssets = false
      options = parseOptions(options)
      expect(options).toHaveProperty('onlyAssets', false)

      options = Object.assign({}, base)
      options.onlyAssets = true
      options = parseOptions(options)
      expect(options).toHaveProperty('onlyAssets', true)
    })
  })

  describe('options.formatFilePath', () => {
    it('is provided or undefined', () => {
      const base = {
        plugins: { ext: mockPlugin },
        makeWebp: { plugins: { ext: mockPlugin } },
      }
      let options

      options = Object.assign({}, base)
      options.formatFilePath = {}
      options = parseOptions(options)
      expect(options).toHaveProperty('formatFilePath')
      expect(options.formatFilePath).toBeTypeOf('function')
      expect(options.formatFilePath('XXX')).toBe('XXX')

      options = Object.assign({}, base)
      options.formatFilePath = mockFormatFilePath
      options = parseOptions(options)
      expect(options).toHaveProperty('formatFilePath')
      expect(options.formatFilePath).toBeTypeOf('function')
      expect(options.formatFilePath('XXX')).toBe('__XXX__')
    })
  })

  describe('options.skipIfLarger', () => {
    it('is provided boolean or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = true
      let options

      options = Object.assign({}, base)
      options.skipIfLarger = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('skipIfLarger', defaultVal)

      options = Object.assign({}, base)
      options.skipIfLarger = false
      options = parseOptions(options)
      expect(options).toHaveProperty('skipIfLarger', false)

      options = Object.assign({}, base)
      options.skipIfLarger = true
      options = parseOptions(options)
      expect(options).toHaveProperty('skipIfLarger', true)
    })
  })

  describe('options.verbose', () => {
    it('is provided boolean or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = true
      let options

      options = Object.assign({}, base)
      options.verbose = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('verbose', defaultVal)

      options = Object.assign({}, base)
      options.verbose = false
      options = parseOptions(options)
      expect(options).toHaveProperty('verbose', false)

      options = Object.assign({}, base)
      options.verbose = true
      options = parseOptions(options)
      expect(options).toHaveProperty('verbose', true)
    })
  })

  describe.todo('options.logger')

  describe('options.logByteDivider', () => {
    it('is provided number or default', () => {
      const base = {
        plugins: { ext: mockPlugin },
      }
      const defaultVal = 1000
      let options

      options = Object.assign({}, base)
      options.logByteDivider = 'test'
      options = parseOptions(options)
      expect(options).toHaveProperty('logByteDivider', defaultVal)

      options = Object.assign({}, base)
      options.logByteDivider = 0
      options = parseOptions(options)
      expect(options).toHaveProperty('logByteDivider', defaultVal)

      options = Object.assign({}, base)
      options.logByteDivider = 1024
      options = parseOptions(options)
      expect(options).toHaveProperty('logByteDivider', 1024)

      options = Object.assign({}, base)
      options.logByteDivider = 27
      options = parseOptions(options)
      expect(options).toHaveProperty('logByteDivider', 27)
    })
  })
})

describe('getAllFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gets all files recursively as an array', () => {
    const spy = vi.spyOn(mockLogger, 'error')
    // expect(spy.getMockName()).toEqual('error')

    const files = getAllFiles(join(root, 'public'), mockLogger)
    expect(spy).not.toHaveBeenCalled()
    expect(files).toHaveLength(23)
    expect(files).toContain(join(root, 'public', 'vite.svg'))
    // expect(files).toEqual(['vite.svg'])
  })

  it('logs ENOENT error on non-existing path', () => {
    const spy = vi.spyOn(mockLogger, 'error')
    // expect(spy.getMockName()).toEqual('error')

    getAllFiles(join(root, 'non-existing-directory'), mockLogger)
    expect(spy).toHaveBeenCalledTimes(1)
    // expect(spy).toHaveBeenCalledWith('Error: ')
    // expect(spy).toHaveReturnedWith('Error: ')
    expect(spy.mock.results[0].value).toMatch(
      /^Error: ENOENT: no such file or directory/,
    )
  })
})

describe('processFile', () => {
  it('returns error object if NO INPUT file', async () => {
    // @ts-expect-error testing wrong argument type
    await expect(processFile({})).rejects.toMatchObject({
      error: 'Empty filepath',
    })
  })

  it('returns error object if NO OUTPUT job', async () => {
    await expect(
      // @ts-expect-error testing wrong argument type
      processFile({
        filePathFrom: 'ignore.ext',
        fileToStack: [],
      }),
    ).rejects.toMatchObject({
      error: 'Empty to-stack',
    })
  })

  it('returns error object if INPUT READ error', async () => {
    await expect(
      // @ts-expect-error missing properties are used after expected error
      processFile({
        filePathFrom: 'non-existing-file.ext',
        fileToStack: [
          {
            toPath: 'ignored.ext',
            plugins: [mockPlugin],
            skipIfLarger: false,
          },
        ],
      }),
    ).rejects.toHaveProperty(
      'error',
      expect.stringMatching(/^Error reading file/),
    )
  })

  it('returns error object if INPUT IS APNG file (skip)', async () => {
    await expect(
      // @ts-expect-error missing properties are used after expected error
      processFile({
        filePathFrom: normalizePath(
          join('public', 'images', 'animated-transparent-1.png'),
        ),
        fileToStack: [
          {
            toPath: normalizePath(join('test', 'ignore.png')),
            plugins: [mockPlugin],
            skipIfLarger: false,
          },
        ],
        baseDir: normalizePath(root) + '/',
      }),
    ).rejects.toMatchObject({
      error: 'Animated PNGs not supported',
    })
  })

  it('returns error object if OUTPUT PROCESS error (Error & warn)', async () => {
    await expect(
      // @ts-expect-error missing properties are used after expected error
      processFile({
        filePathFrom: 'public/images/broken.png',
        fileToStack: [
          {
            toPath: 'test/ignore.png',
            plugins: [
              // imageminOxipng({
              //   optimization: 4,
              //   strip: 'safe',
              // }),
              () => Promise.reject(new Error('Test')),
              // () => {
              //   throw new Error('Test')
              // },
            ],
            skipIfLarger: false,
          },
        ],
        baseDir: normalizePath(root) + '/',
      }),
    ).resolves.toContainEqual({
      status: 'rejected',
      reason: expect.objectContaining({
        error: expect.stringMatching(/^Error processing file/),
      }),
    })

    await expect(
      // @ts-expect-error missing properties are used after expected error
      processFile({
        filePathFrom: 'public/images/broken.png',
        fileToStack: [
          {
            toPath: 'test/ignore.png',
            plugins: [
              // imageminOxipng({
              //   optimization: 4,
              //   strip: 'safe',
              // }),
              () => Promise.reject('WARN: Test error processing file'),
              // () => {
              //   throw 'WARN: Test error processing file'
              // },
            ],
            skipIfLarger: false,
          },
        ],
        baseDir: normalizePath(root) + '/',
      }),
    ).resolves.toContainEqual({
      status: 'rejected',
      reason: expect.objectContaining({
        error: 'Test error processing file',
      }),
    })
  })

  it('returns error object if OUTPUT WRITE error', async () => {
    await expect(
      // @ts-expect-error missing properties are used after expected error
      processFile({
        filePathFrom: 'public/images/broken.png',
        fileToStack: [
          {
            toPath: 'test/non-existing-directory/ignore.png',
            plugins: [mockPlugin],
            skipIfLarger: false,
          },
        ],
        baseDir: normalizePath(root) + '/',
      }),
    ).resolves.toContainEqual({
      status: 'rejected',
      reason: expect.objectContaining({
        error: expect.stringMatching(/^Error writing file/),
      }),
    })
  })

  describe('returns based on size and options.skipIfLarger', () => {
    let cnt = 0

    // skipIfLarger modes
    ;[
      [false as const, [true, true, true]] as const,
      ['original' as const, [true, true, false]] as const,
      ['optimized' as const, [true, true, false]] as const,
      ['smallest' as const, [true, true, false]] as const,
    ].forEach(([skipMode, expected]) => {
      const stack: ProcessFileParams = {
        filePathFrom: 'public/vite.svg',
        fileToStack: [],
        baseDir: normalizePath(root) + '/',
        bytesDivider: 1000 as const,
        sizeUnit: 'kB',
        precisions: {
          size: 2,
          ratio: 2,
          duration: 0,
        },
      }
      const expectedResults: any[] = []

      // output file sizes
      ;[
        [
          // smaller
          () => Promise.resolve(Buffer.from('less')),
          {
            oldPath: 'public/vite.svg',
            oldSize: 1497,
            newSize: 4,
            oldSizeString: '1.50 kB',
            newSizeString: '0.00 kB',
            ratioString: '-99.73 %',
          },
        ] as const,
        [
          // equal
          mockPlugin,
          {
            oldPath: 'public/vite.svg',
            oldSize: 1497,
            newSize: 1497,
            oldSizeString: '1.50 kB',
            newSizeString: '1.50 kB',
            ratioString: ' 0.00 %',
          },
        ] as const,
        [
          // larger
          (b: Buffer) =>
            Promise.resolve(Buffer.concat([b, Buffer.from('more')])),
          {
            oldPath: 'public/vite.svg',
            oldSize: 1497,
            newSize: 1501,
            oldSizeString: '1.50 kB',
            newSizeString: '1.50 kB',
            ratioString: '+0.27 %',
          },
        ] as const,
      ].forEach(([cb, fullfilledResult], j) => {
        stack.fileToStack.push({
          toPath: `test/skip${cnt++}.svg`,
          plugins: [cb],
          skipIfLarger: skipMode,
        })

        if (expected[j]) {
          expectedResults.push({
            status: 'fulfilled',
            value: expect.objectContaining(fullfilledResult),
          })
        } else {
          // TODO: rewrite different test? (or remove this one)
          //       - that checks the logs for skipped files
          //       - and/or checks that original file has not changed (when output is larger)
          // expectedResults.push({
          //   status: 'rejected',
          //   reason: expect.objectContaining({
          //     error: 'Output is larger',
          //     errorType: 'skip',
          //   }),
          // })
          expectedResults.push({
            status: 'fulfilled',
            value: expect.objectContaining(fullfilledResult),
          })
        }
      })

      it(`returns ${expected
        .map((b: boolean) => (b ? 'SUCCESS' : 'SKIP   '))
        .join(
          ' / ',
        )}   for sizes SMALLER / EQUAL / LARGER   when skipIfLarger = ${String(
        skipMode,
      )}`, async () => {
        await expect(processFile(stack)).resolves.toEqual(expectedResults)
      })
    })
  })
})

describe('processResults', () => {
  it('returns grouped, categorized results with correct stats', () => {
    const processedFiles: ProcessResult[] = [
      // Input errored file
      {
        status: 'rejected',
        reason: {
          oldPath: 'old.img',
          newPath: '',
          error: 'Input error',
          errorType: 'error',
        },
      },
      {
        status: 'rejected',
        reason: {
          oldPath: 'old.img',
          newPath: '',
          error: 'Input skip',
          errorType: 'skip',
        },
      },
      {
        status: 'rejected',
        reason: {
          oldPath: 'old.img',
          newPath: '',
          error: 'Input warning',
          errorType: 'warning',
        },
      },
      {
        status: 'fulfilled',
        value: [
          // Process/Output errored file
          {
            status: 'rejected',
            reason: {
              oldPath: 'old.img',
              newPath: 'new.img',
              error: 'Process error',
              errorType: 'warning',
            },
          },
          {
            status: 'rejected',
            reason: {
              oldPath: 'old2.img',
              newPath: 'new2.img',
              error: 'Output error',
              errorType: 'error',
            },
          },
          // Output processed file
          {
            status: 'fulfilled',
            value: {
              oldPath: 'old.img',
              newPath: 'new.img',
              oldSize: 1000,
              newSize: 1000,
              ratio: 0,
              duration: 50,
              oldSizeString: '1 kB',
              newSizeString: '1 kB',
              ratioString: '0.00 %',
              durationString: '50 ms',
              optimizedDeleted: 'optimized',
              avifDeleted: 'optimized',
              webpDeleted: 'optimized',
            },
          },
          {
            status: 'fulfilled',
            value: {
              oldPath: 'old.img',
              newPath: 'new2.img',
              oldSize: 1000,
              newSize: 10000,
              ratio: 0,
              duration: 500,
              oldSizeString: '1 kB',
              newSizeString: '10 kB',
              ratioString: '+900.00 %',
              durationString: '500 ms',
              optimizedDeleted: false,
              avifDeleted: false,
              webpDeleted: false,
            },
          },
          {
            status: 'fulfilled',
            value: {
              oldPath: 'old2.img',
              newPath: 'new2.img',
              oldSize: 1000,
              newSize: 1000,
              ratio: 0,
              duration: 50,
              oldSizeString: '1 kB',
              newSizeString: '1 kB',
              ratioString: '0.00 %',
              durationString: '50 ms',
              optimizedDeleted: 'optimized',
              avifDeleted: 'optimized',
              webpDeleted: 'optimized',
            },
          },
        ],
      },
    ]

    expect(processResults(processedFiles)).toEqual({
      // totalTime: 600,
      totalSize: {
        from: 3000,
        to: 12000,
      },
      maxLengths: {
        oldPath: 8,
        newPath: 8,
        oldSize: 4,
        newSize: 5,
        ratio: 9,
        duration: 6,
      },
      processedFiles: {
        'old.img': [
          {
            oldPath: 'old.img',
            newPath: 'new.img',
            oldSize: 1000,
            newSize: 1000,
            ratio: 0,
            duration: 50,
            oldSizeString: '1 kB',
            newSizeString: '1 kB',
            ratioString: '0.00 %',
            durationString: '50 ms',
            optimizedDeleted: 'optimized',
            avifDeleted: 'optimized',
            webpDeleted: 'optimized',
          },
          {
            oldPath: 'old.img',
            newPath: 'new2.img',
            oldSize: 1000,
            newSize: 10000,
            ratio: 0,
            duration: 500,
            oldSizeString: '1 kB',
            newSizeString: '10 kB',
            ratioString: '+900.00 %',
            durationString: '500 ms',
            optimizedDeleted: false,
            avifDeleted: false,
            webpDeleted: false,
          },
        ],
        'old2.img': [
          {
            oldPath: 'old2.img',
            newPath: 'new2.img',
            oldSize: 1000,
            newSize: 1000,
            ratio: 0,
            duration: 50,
            oldSizeString: '1 kB',
            newSizeString: '1 kB',
            ratioString: '0.00 %',
            durationString: '50 ms',
            optimizedDeleted: 'optimized',
            avifDeleted: 'optimized',
            webpDeleted: 'optimized',
          },
        ],
      },
      erroredFiles: {
        'old.img': [
          {
            oldPath: 'old.img',
            newPath: '',
            error: 'Input error',
            errorType: 'error',
          },
          {
            oldPath: 'old.img',
            newPath: '',
            error: 'Input skip',
            errorType: 'skip',
          },
          {
            oldPath: 'old.img',
            newPath: '',
            error: 'Input warning',
            errorType: 'warning',
          },
          {
            oldPath: 'old.img',
            newPath: 'new.img',
            error: 'Process error',
            errorType: 'warning',
          },
        ],
        'old2.img': [
          {
            oldPath: 'old2.img',
            newPath: 'new2.img',
            error: 'Output error',
            errorType: 'error',
          },
        ],
      },
    })
  })
})

describe('logResults', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('display right colors for items', () => {
    const spy = vi.spyOn(mockLogger, 'info')

    logResults(
      [
        {
          oldPath: 'dist/from.ext',
          oldSize: 100,
          newPath: 'dist/to.ext',
          newSize: 90,
          ratio: -0.1,
          duration: 100,
          oldSizeString: '100 KiB',
          newSizeString: '90 KiB',
          ratioString: '-10 %',
          durationString: '100 ms',
          optimizedDeleted: false,
          avifDeleted: false,
          webpDeleted: false,
        },
        {
          oldPath: 'dist/from.ext',
          oldSize: 100,
          newPath: 'dist/to.ext',
          newSize: 110,
          ratio: 0.1,
          duration: 100,
          oldSizeString: '100 KiB',
          newSizeString: '110 KiB',
          ratioString: '+10 %',
          durationString: '100 ms',
          optimizedDeleted: false,
          avifDeleted: false,
          webpDeleted: false,
        },
        {
          oldPath: 'dist/from.ext',
          oldSize: 100,
          newPath: 'dist/to.ext',
          newSize: 100,
          ratio: 0,
          duration: 100,
          oldSizeString: '100 KiB',
          newSizeString: '100 KiB',
          ratioString: '0 %',
          durationString: '100 ms',
          optimizedDeleted: false,
          avifDeleted: false,
          webpDeleted: false,
        },
        {
          oldPath: 'dist/from.ext',
          oldSize: 100,
          newPath: 'dist/to.ext.avif',
          newSize: 100,
          ratio: 0,
          duration: 100,
          oldSizeString: '100 KiB',
          newSizeString: '100 KiB',
          ratioString: '0 %',
          durationString: '100 ms',
          optimizedDeleted: false,
          avifDeleted: 'optimized',
          webpDeleted: false,
        },
        {
          oldPath: 'dist/from.ext',
          oldSize: 100,
          newPath: 'dist/to.ext.webp',
          newSize: 100,
          ratio: 0,
          duration: 100,
          oldSizeString: '100 KiB',
          newSizeString: '100 KiB',
          ratioString: '0 %',
          durationString: '100 ms',
          optimizedDeleted: false,
          avifDeleted: false,
          webpDeleted: 'smallest',
        },
      ],
      mockLogger,
      {
        oldPath: 15,
        newPath: 16,
        oldSize: 10,
        newSize: 10,
        ratio: 10,
        duration: 10,
      },
    )
    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(6)
    // expect(spy).toHaveBeenCalledWith('Error: ')
    // expect(spy).toHaveReturnedWith('Error: ')
    expect(spy.mock.results[1].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[32m/, // green
      /dist\/.*to\.ext.+90 KiB.+-10 %.+100 ms/,
    )
    expect(spy.mock.results[2].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[33m/, // yellow
      /dist\/.*to\.ext.+110 KiB.+\+10 %.+100 ms/,
    )
    // expect(spy.mock.results[2].value).toMatch(
    //   /* eslint-disable-next-line no-control-regex */
    //   // /\u001b\[31m/, // red
    // )
    // expect(spy.mock.results[3].value).not.toMatch(
    //   /* eslint-disable-next-line no-control-regex */
    //   /\u001b\[3[1-3]m/, // red, green or yellow
    // )
    expect(spy.mock.results[3].value).toMatch(
      /dist\/.*to\.ext.+100 KiB.+0 %.+100 ms/,
    )
    // expect(spy.mock.results[4].value).not.toMatch(
    //   /* eslint-disable-next-line no-control-regex */
    //   /\u001b\[3[1-3]m/, // red, green or yellow
    // )
    expect(spy.mock.results[4].value).toMatch(
      /dist\/.*to\.ext\.avif.+ │ Skipped │ Larger than optimized/,
    )
    // expect(spy.mock.results[5].value).not.toMatch(
    //   /* eslint-disable-next-line no-control-regex */
    //   /\u001b\[3[1-3]m/, // red, green or yellow
    // )
    expect(spy.mock.results[5].value).toMatch(
      /dist\/.*to\.ext\.webp.+ │ Skipped │ Larger than smallest/,
    )
  })
})

describe('logErrors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('display right colors for items', () => {
    const spy = vi.spyOn(mockLogger, 'info')

    const maxLengths = {
      oldPath: 15,
      newPath: 15,
      oldSize: 10,
      newSize: 10,
      ratio: 10,
      duration: 10,
    }

    logErrors(
      [
        {
          error: 'Error',
          errorType: 'error',
          oldPath: '/',
          newPath: '',
        },
        {
          error: 'Warning',
          errorType: 'warning',
          oldPath: '/',
          newPath: '',
        },
        {
          error: 'Skipped',
          errorType: 'skip',
          oldPath: '/',
          newPath: '',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Error',
          errorType: 'error',
          oldPath: '/',
          newPath: 'dist/to.ext',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Warning',
          errorType: 'warning',
          oldPath: '',
          newPath: 'dist/to.ext',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Skipped',
          errorType: 'skip',
          oldPath: 'dist/from.ext',
          newPath: 'dist/to.ext',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Error',
          errorType: 'error',
          oldPath: 'dist/1',
          newPath: '',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Warning',
          errorType: 'warning',
          oldPath: 'dist/2',
          newPath: '',
        },
      ],
      mockLogger,
      maxLengths,
    )
    logErrors(
      [
        {
          error: 'Skipped',
          errorType: 'skip',
          oldPath: 'dist/3',
          newPath: '',
        },
      ],
      mockLogger,
      maxLengths,
    )

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(2 + 3 + 6 * 3)
    // For chalk's style codes, see:
    // https://github.com/chalk/chalk/blob/main/source/vendor/ansi-styles/index.js
    expect(spy.mock.results[2].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[41m ERROR /, // bgRed
      / ERROR /, // bgRed
    )
    expect(spy.mock.results[3].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[43m WARNING /, // bgYellow
      / WARNING /, // bgYellow
    )
    expect(spy.mock.results[4].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[47m SKIPPED /, // bgWhite
      / SKIPPED /, // bgWhite
    )
    expect(spy.mock.results[7].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[41m ERROR /, // bgRed
      / ERROR /, // bgRed
    )
    expect(spy.mock.results[10].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[43m WARNING /, // bgYellow
      / WARNING /, // bgYellow
    )
    expect(spy.mock.results[13].value).toMatch(
      /* eslint-disable-next-line no-control-regex */
      // /\u001b\[47m SKIPPED /, // bgWhite
      / SKIPPED /, // bgWhite
    )
  })
})

/**
 * Notes about output in playground (for making tests):
 * ----------------------------------------------------
 *
 *  larger than original:
 *    dist/images/animated-transparent-2.gif
 *    dist/images/animated-transparent-1.gif.webp
 *
 *  not larger than original:
 *    dist/images/transparent-1.png
 *    dist/images/transparent-1.png.avif
 *    dist/images/transparent-1.png.webp
 *
 *  larger than optimized:
 *    dist/images/static-2.jpg.webp
 *    dist/images/transparent-1.png.avif
 *    dist/assets/transparent-1-2fb48e3c.png.avif
 *
 *  not larger than optimized:
 *    dist/images/opaque-1.png.avif
 *    dist/images/opaque-1.png.webp
 *    dist/assets/transparent-1-2fb48e3c.png.webp
 *
 *  larger than smallest:
 *    dist/images/transparent-1.png.avif
 *    dist/images/opaque-1.png.webp
 *
 *  not larger than smallest:
 *    dist/images/transparent-1.png.webp
 *    dist/images/opaque-1.png.avif
 */

// TODO: expand after-build checks

describe.skipIf(skipBuilds)('viteImagemin', () => {
  beforeEach(ctx => {
    // Ensure empty temp dir for test
    const tempDir = normalizePath(
      //${process.env.VITEST_POOL_ID}
      join(root, 'test', `temp${ctx.meta.id}`),
    )
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true, mode: 0o755 })

    return () => {
      // Clean up temp dir
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(
    'default config',
    async ({ meta, expect }) => {
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`
      // const assetsDir = `${distDir}/assets`
      // const processDir = options.onlyAssets ? assetsDir : distDir
      // const baseDir = `${root}/`

      // expect(existsSync(root)).toBe(false)
      // if (existsSync(root)) {
      //   expect(readdirSync(root)).toEqual([])
      // }

      // expect(tempDir).toBe(true)
      // expect(normalizePath(relative(root, distDir))).toBe(true)
      // expect([
      //   process.env.VITEST_POOL_ID,
      //   process.env.VITEST_WORKER_ID,
      //   /* @ts-ignore */
      //   import.meta.env.VITEST_POOL_ID,
      //   /* @ts-ignore */
      //   import.meta.env.VITEST_WORKER_ID,
      // ]).toBe(false)

      const options = {
        plugins: {
          png: [
            imageminOxipng({
              optimization: 4,
              strip: 'safe',
            }),
          ],
          jpg: imageminMozjpeg(),
          gif: imageminGifsicle(),
          svg: imageminSvgo(),
        },
        makeAvif: {
          plugins: {
            png: imageminAvif(),
            jpg: imageminAvif(),
          },
          // formatFilePath: (filename) => `${filename}.avif`,
          // skipIfLargerThan: false,
          // skipIfLargerThan: 'optimized',
          // skipIfLargerThan: 'smallest',
        },
        makeWebp: {
          plugins: {
            png: imageminWebp(),
            jpg: imageminWebp(),
            gif: imageminGif2webp(),
          },
          // formatFilePath: (filename) => `${filename}.webp`,
          // skipIfLargerThan: false,
          // skipIfLargerThan: 'optimized',
          // skipIfLargerThan: 'smallest',
        },
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      // import type { RollupOutput } from 'rollup';

      // const stat = lstatSync(dir, {throwIfNoEntry: false, bigint: false})
      // stat?.isDirectory()
      // const files = readdirSync(dir)
      // const fileContentBuffer = readFileSync(filepath);
      // const fileContentString = readFileSync(filepath, {encoding: 'utf8', flag: 'r'});
      expect(existsSync(distDir)).toBe(true)

      // TODO:
      // - check log output
      // - check if expected files are there
      // - check if certain files have been skipped
    },
    {
      timeout: 30000,
    },
  )

  it(
    'only-smallest config',
    async ({ meta, expect }) => {
      // const spy = vi.spyOn(mockLogger, 'info')
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        logByteDivider: 1024 as const,
        include: /images\/transparent-1\.png$/i,
        plugins: {
          png: [
            imageminOxipng({
              optimization: 4,
              strip: 'safe',
            }),
          ],
          jpg: imageminMozjpeg(),
          gif: imageminGifsicle(),
          svg: imageminSvgo(),
        },
        makeAvif: {
          plugins: {
            png: imageminAvif(),
            jpg: imageminAvif(),
          },
          skipIfLargerThan: 'smallest' as const,
        },
        makeWebp: {
          plugins: {
            png: imageminWebp(),
            jpg: imageminWebp(),
            gif: imageminGif2webp(),
          },
          skipIfLargerThan: 'smallest' as const,
        },
        logger: mockLogger,
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      // import type { RollupOutput } from 'rollup';

      // const stat = lstatSync(dir, {throwIfNoEntry: false, bigint: false})
      // stat?.isDirectory()
      // const files = readdirSync(dir)
      // const fileContentBuffer = readFileSync(filepath);
      // const fileContentString = readFileSync(filepath, {encoding: 'utf8', flag: 'r'});
      expect(existsSync(distDir)).toBe(true)

      // expect(spy).not.toHaveBeenCalled()
      // expect(spy).toHaveBeenCalledTimes(8)
      // expect(spy.mock.results[3].value).toMatch(
      //   /* eslint-disable-next-line no-control-regex */
      //   // /\u001b\[33manimated-transparent-2.gif/, // yellow
      //   /animated-transparent-2.gif.+\+\d+(\.\d+)? %/, // yellow
      // )

      // TODO:
      // - check log output
      // - check if expected files are there
      // - check if certain files have been skipped
    },
    {
      timeout: 30000,
    },
  )

  it(
    'larger-than-original config',
    async ({ meta, expect }) => {
      const spy = vi.spyOn(mockLogger, 'info')

      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        include: /images\/animated-transparent-2\.gif$/i,
        skipIfLarger: false,
        plugins: {
          // gif: [imageminGifsicle()],
          gif: [
            (b: Buffer) =>
              Promise.resolve(Buffer.concat([b, Buffer.from('more')])),
          ],
        },
        logger: mockLogger,
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      expect(existsSync(distDir)).toBe(true)

      expect(spy).toHaveBeenCalledTimes(8)
      expect(spy.mock.results[3].value).toMatch(
        /* eslint-disable-next-line no-control-regex */
        // /\u001b\[33manimated-transparent-2.gif/, // yellow
        /animated-transparent-2.gif.+\+\d+(\.\d+)? %/, // yellow
      )
      // expect(spy.mock.results[3].value).toMatch(
      //   /* eslint-disable-next-line no-control-regex */
      //   /\u001b\[31m\+\d+(\.\d+)? %/, // red
      // )
      expect(spy.mock.results[6].value).toMatch(
        /* eslint-disable-next-line no-control-regex */
        // /\u001b\[31m\+\d+(\.\d+)? %/, // red
        /\+\d+(\.\d+)? %/, // red
      )
    },
    {
      timeout: 10000,
    },
  )

  it(
    'equal-sized config',
    async ({ meta, expect }) => {
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        include: /images\/animated-transparent-2\.gif$/i,
        skipIfLarger: false,
        plugins: {
          gif: [mockPlugin],
        },
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      expect(existsSync(distDir)).toBe(true)
    },
    {
      timeout: 10000,
    },
  )

  it(
    'non-verbose-equal-sized config',
    async ({ meta, expect }) => {
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        verbose: false,
        include: /images\/animated-transparent-2\.gif$/i,
        skipIfLarger: false,
        plugins: {
          gif: [mockPlugin],
        },
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      expect(existsSync(distDir)).toBe(true)
    },
    {
      timeout: 10000,
    },
  )

  it(
    'no-files config',
    async ({ meta, expect }) => {
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        onlyAssets: true,
        logByteDivider: 1024 as const,
        include: /\.none$/i,
        plugins: {
          png: [
            imageminOxipng({
              optimization: 4,
              strip: 'safe',
            }),
          ],
        },
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      expect(existsSync(distDir)).toBe(true)
    },
    {
      timeout: 10000,
    },
  )

  it(
    'no-plugins-for-files config',
    async ({ meta, expect }) => {
      const tempDir = normalizePath(join(root, 'test', `temp${meta.id}`))
      const distDir = `${tempDir}/dist`

      const options = {
        onlyAssets: true,
        logByteDivider: 1024 as const,
        include: /\.*$/i,
        plugins: {
          none: [mockPlugin],
        },
      }

      const testConfig = getBuildConfig(viteImagemin(options), {
        build: {
          outDir: normalizePath(relative(root, distDir)),
        },
      })

      await expect(build(testConfig)).resolves.toHaveProperty('output')

      expect(existsSync(distDir)).toBe(true)
    },
    {
      timeout: 10000,
    },
  )

  it('invalid plugins throws error on init', async ({ expect }) => {
    expect(() =>
      viteImagemin({
        // @ts-expect-error testing wrong argument type
        plugins: false,
      }),
    ).toThrowError('Missing valid `plugins` option')
  })

  // TODO: other configs?
})
