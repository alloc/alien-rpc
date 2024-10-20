// Adapted from https://github.com/vitest-dev/vitest/blob/d70b08b1ac88f06b8d79be6d7988bc742c5c5beb/packages/vitest/src/node/stdin.ts
import { bold, dim, reset } from 'kleur/colors'
import readline from 'node:readline'
import { isArray } from 'radashi'

export type Shortcut = [string[], string, () => void]

export function printShortcutsHelp(keys: Shortcut[]) {
  process.stdout.write(
    `
${bold('  Watch Usage')}
${keys
  .map(
    i =>
      dim('  press ') +
      reset(
        [i[0]]
          .flat()
          .map(x => bold(x))
          .join(', ')
      ) +
      dim(` to ${i[1]}`)
  )
  .join('\n')}
`
  )
}

export function registerConsoleShortcuts(keys: Shortcut[]) {
  const stdin = process.stdin

  async function _keypressHandler(str: string, key: any) {
    if (
      str === '\x03' ||
      str === '\x1B' ||
      (key && key.ctrl && key.name === 'c')
    ) {
      return process.exit()
    }

    // window not support suspend
    if (process.platform !== 'win32' && key && key.ctrl && key.name === 'z') {
      process.kill(process.ppid, 'SIGTSTP')
      process.kill(process.pid, 'SIGTSTP')
      return
    }

    const name = key?.name

    // help
    if (name === 'h') {
      return printShortcutsHelp(keys)
    }

    for (const [key, , handler] of keys) {
      if (key === name || (isArray(key) && key.includes(name))) {
        return handler()
      }
    }
  }

  async function keypressHandler(str: string, key: any) {
    await _keypressHandler(str, key)
  }

  let rl: readline.Interface | undefined
  function on() {
    off()
    rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 })
    readline.emitKeypressEvents(stdin, rl)
    if (stdin.isTTY) {
      stdin.setRawMode(true)
    }
    stdin.on('keypress', keypressHandler)
  }

  function off() {
    rl?.close()
    rl = undefined
    stdin.removeListener('keypress', keypressHandler)
    if (stdin.isTTY) {
      stdin.setRawMode(false)
    }
  }

  on()

  return function cleanup() {
    off()
  }
}
