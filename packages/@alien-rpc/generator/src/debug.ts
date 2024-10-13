import createDebug from 'debug'

export const debug = createDebug('alien-rpc:generator')

export const reportDiagnostic = process.env.TEST
  ? (message: string): void => {
      const error = new Error(message)
      Error.captureStackTrace(error, reportDiagnostic)
      throw error
    }
  : console.warn
