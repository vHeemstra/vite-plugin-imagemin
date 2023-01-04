import { rmSync, existsSync /*, mkdirSync */ } from 'node:fs'

export async function setup() {
  if (existsSync('./test')) {
    rmSync('./test', { recursive: true, force: true })
  }
}

export async function teardown() {
  // if (existsSync('./test')) {
  //   rmSync('./test', { recursive: true, force: true })
  // }
}
