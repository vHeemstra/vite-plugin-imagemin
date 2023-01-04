import {
  describe,
  // beforeAll,
  afterAll,
  expect,
  it,
} from 'vitest'
import { rmSync, existsSync } from 'node:fs'
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
  ar_array: [],
  obj_object: {},
  obj_regex: /.*/,
  func_function: () => 1,
}
type TTestVars = {
  [key in keyof typeof testVars]: any
}
const makeExpectedVars = (
  expect: Partial<TTestVars>,
  defaultValue: any = false,
): TTestVars => {
  return Object.assign(
    {},
    Object.keys(testVars).reduce((o, k) => {
      o[k] = defaultValue
      return o
    }, {}) as TTestVars,
    expect,
  )
}

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

describe('isObject', () => {
  const expected = makeExpectedVars({
    ar_array: true,
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

describe('escapeRegExp', () => {
  it(`returns string with special chars escaped`, () => {
    expect(utils.escapeRegExp('abc123_!@%& ^.,+*?#|-()[]{}/\\$')).toBe(
      'abc123_!@%& \\^\\.\\,\\+\\*\\?\\#\\|\\-\\(\\)\\[\\]\\{\\}\\/\\\\\\$',
    )
  })
})

describe('smartEnsureDirs', () => {
  // beforeAll(() => {
  //   ;['./test/dirA', './test/dirB', './test/dirC'].forEach(dir => {
  //     rmSync(dir, { recursive: true, force: true })
  //   })
  // })

  afterAll(() => {
    ;['./test/dirA', './test/dirB', './test/dirC'].forEach(dir => {
      rmSync(dir, { recursive: true, force: true })
    })
  })

  const input = [
    './test/dirA/file1.txt',
    './test/dirA/file2.txt',
    './test/dirB/file1.txt',
    './test/dirB/subdirA/subsubdirB/file1.txt',
    './test/dirB/subdirA/subsubdirA/file1.txt',
    './test/dirC/file1.txt',
    './test/dirC/subdirA/file1.txt',
  ]

  const expected = [
    './test/dirB/subdirA/subsubdirB',
    './test/dirB/subdirA/subsubdirA',
    './test/dirC/subdirA',
    './test/dirA',
  ]

  it('checks deepest unique paths only & creates all directories if absent', () => {
    expected.forEach(dir => {
      expect(existsSync(dir)).toBe(false)
    })

    expect(utils.smartEnsureDirs(input)).toEqual(expected)

    expected.forEach(dir => {
      expect(existsSync(dir)).toBe(true)
    })
  })
})
