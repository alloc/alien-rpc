import {
  blue,
  bold,
  type Colorize,
  cyan,
  gray,
  green,
  magenta,
  red,
  yellow,
} from 'kleur/colors'
import { URL } from 'node:url'
import { isString } from 'radashi'

let logTimestampsEnabled = false
let rootDir: string | undefined

const createLog =
  (color: Colorize, prefix = '•', method: 'log' | 'trace' = 'log') =>
  (message: string, ...args: any[]) => {
    message = color(prefix + ' ' + message)
    if (logTimestampsEnabled) {
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
      message = gray(`[${timestamp}]`) + ' ' + message
    }
    console.log(message, ...relativizePathArgs(args))
    if (method === 'trace') {
      console.log(color(new Error().stack!.replace(/^.*?\n/, '')))
    }
  }

type Logger = ReturnType<typeof createLog>

export const log = createLog(blue) as Logger & {
  error: Logger
  warn: Logger
  success: Logger
  command: Logger
  comment: Logger
  green: Logger
  cyan: Logger
  magenta: Logger
  eraseLine: () => void
  enableTimestamps: (enabled: boolean) => void
  setRootDirectory: (root: string) => void
}

log.enableTimestamps = (enabled: boolean) => {
  logTimestampsEnabled = enabled
}

log.setRootDirectory = (dir: string) => {
  rootDir = dir
}

log.error = createLog(red, '⚠️', 'trace')
log.warn = createLog(yellow, '⚠️')
log.success = createLog(green, '✔️')
log.command = createLog(bold, '»')
log.comment = createLog(gray, ' ')
log.green = createLog(green)
log.cyan = createLog(cyan)
log.magenta = createLog(magenta)

log.eraseLine = () => {
  process.stdout.write('\x1B[1A') // Move cursor up one line
  process.stdout.write(' '.repeat(process.stdout.columns)) // Write spaces to clear the line
  process.stdout.write('\r') // Move cursor to start of line
}

function relativizePathArgs(args: any[]) {
  if (rootDir == null) {
    return args
  }
  return args.map(arg => {
    if (
      isString(arg) &&
      URL.canParse('file://' + arg) &&
      arg.startsWith(rootDir!)
    ) {
      return '.' + arg.slice(rootDir!.length)
    }
    return arg
  })
}
