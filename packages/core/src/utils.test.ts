import { describe, expect, it, beforeEach } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { normalizePath } from 'vite'
import * as utils from './utils'

const testVars = {
  v_undefined: undefined,
  v_null: null,
  num_0: 0,
  num_1: 1,
  num_2: 2,
  bool_false: false,
  bool_true: true,
  empty_string: '',
  non_empty_string: 's',
  empty_array: [],
  str_array: [''],
  regexp_array: [/.*/],
  str_regexp_array: [/.*/, ''],
  bool_array: [true, false],
  mixed_array: [1, null, /.*/, '', true, false],
  obj_object: {},
  obj_regex: /.*/,
  func_function: () => 1,
}
type TestVars = {
  [key in keyof typeof testVars]: any
}
const makeExpectedVars = (
  expect: Partial<TestVars>,
  defaultValue: any = false,
): TestVars => {
  return Object.assign(
    {},
    Object.keys(testVars).reduce((o, k) => {
      o[k] = defaultValue
      return o
    }, {}) as TestVars,
    expect,
  )
}

const root = 'packages/playground'

describe('isFunction', () => {
  const expected = makeExpectedVars({
    func_function: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isFunction(v)).toBe(expected[k])
    })
  })
})

describe('isBoolean', () => {
  const expected = makeExpectedVars({
    bool_false: true,
    bool_true: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isBoolean(v)).toBe(expected[k])
    })
  })
})

describe('isString', () => {
  const expected = makeExpectedVars({
    empty_string: true,
    non_empty_string: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isString(v)).toBe(expected[k])
    })
  })
})

describe('isObject', () => {
  const expected = makeExpectedVars({
    obj_object: true,
    obj_regex: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isObject(v)).toBe(expected[k])
    })
  })
})

describe('isNotFalse', () => {
  const expected = makeExpectedVars(
    {
      bool_false: false,
    },
    true,
  )

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isNotFalse(v)).toBe(expected[k])
    })
  })
})

describe('isRegExp', () => {
  const expected = makeExpectedVars({
    obj_regex: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isRegExp(v)).toBe(expected[k])
    })
  })
})

describe('isFilterPattern', () => {
  const expected = makeExpectedVars({
    obj_regex: true,
    empty_string: true,
    non_empty_string: true,
    empty_array: true,
    str_array: true,
    regexp_array: true,
    str_regexp_array: true,
  })

  Object.entries(testVars).forEach(([k, v]) => {
    it(`${k} returns ${expected[k]}`, () => {
      expect(utils.isFilterPattern(v)).toBe(expected[k])
    })
  })
})

describe('escapeRegExp', () => {
  it(`returns string with special chars escaped`, () => {
    expect(utils.escapeRegExp('abc123_!@%& ^.,+*?#|-()[]{}/\\$')).toBe(
      'abc123_!@%& \\^\\.\\,\\+\\*\\?\\#\\|\\-\\(\\)\\[\\]\\{\\}\\/\\\\\\$',
    )
  })
})

describe('smartEnsureDirs', () => {
  let tempDir = ''

  beforeEach(ctx => {
    // Ensure empty temp dir for test
    tempDir = normalizePath(
      join(root, 'test', `temp${process.env.VITEST_POOL_ID}${ctx.task.id}`),
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

  it('checks deepest unique paths only & creates all directories if absent', () => {
    const input = [
      `${tempDir}/dirA/file1.txt`,
      `${tempDir}/dirA/file2.txt`,
      `${tempDir}/dirB/file1.txt`,
      `${tempDir}/dirB/subdirA/subsubdirB/file1.txt`,
      `${tempDir}/dirB/subdirA/subsubdirA/file1.txt`,
      `${tempDir}/dirC/file1.txt`,
      `${tempDir}/dirC/subdirA/file1.txt`,
    ]

    const expected = [
      `${tempDir}/dirB/subdirA/subsubdirB`,
      `${tempDir}/dirB/subdirA/subsubdirA`,
      `${tempDir}/dirC/subdirA`,
      `${tempDir}/dirA`,
    ]

    expected.forEach((dir, i) => {
      expect([existsSync(dir), i]).toEqual([false, i])
    })

    expect(utils.smartEnsureDirs(input)).toEqual(expected)

    expected.forEach((dir, i) => {
      expect([existsSync(dir), i]).toEqual([true, i])
    })
  })
})

// TODO: add tests for getPackageDirectory and getPackageName
// TODO: create `cache.test.ts` with tests for cache functions
