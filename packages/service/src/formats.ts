import { FormatRegistry } from '@sinclair/typebox'
import { isFunction } from 'radashi'

export type StringFormat = RegExp | ((value: string) => boolean)

export function addStringFormat(name: string, test: StringFormat) {
  FormatRegistry.Set(name, isFunction(test) ? test : test.test.bind(test))
}

export * from './ajv-formats/formats.js'
