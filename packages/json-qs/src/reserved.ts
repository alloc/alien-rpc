const keyReservedChars = '~:(),'

export const KEY_RESERVED_CHARS = new RegExp(`['${keyReservedChars}]`, 'g')

export const keyReservedCharEncoder = /* @__PURE__ */ (() => {
  const charMap: Record<string, string> = {
    "'": "''",
  }
  for (const [index, char] of keyReservedChars.split('').entries()) {
    charMap[char] = '~' + index
  }
  return charMap
})()

export const keyReservedCharDecoder = /* @__PURE__ */ (() => {
  const charMap: Record<string, string> = {}
  for (const [index, char] of keyReservedChars.split('').entries()) {
    charMap[index] = char
  }
  return charMap
})()
