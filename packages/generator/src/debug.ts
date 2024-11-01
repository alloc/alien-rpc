import createDebug from 'debug'

export const debug = createDebug('alien-rpc:generator')

if (process.env.TEST) {
  createDebug.log = console.log.bind(console)
}
