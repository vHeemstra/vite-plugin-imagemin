import { rmSync, existsSync, mkdirSync } from 'node:fs'

// const root = process.cwd()
const root = './packages/playground'

export async function setup() {
  // console.log('GlobalSetup - setup')

  // Ensure empty test dir
  if (existsSync(`${root}/test`)) {
    rmSync(`${root}/test`, { recursive: true, force: true })
  }
  mkdirSync(`${root}/test`, { recursive: true, mode: 0o755 })
}

export async function teardown() {
  // console.log('GlobalSetup - teardown')

  // Cleanup test dir
  if (existsSync(`${root}/test`)) {
    rmSync(`${root}/test`, { recursive: true, force: true })
  }
}
