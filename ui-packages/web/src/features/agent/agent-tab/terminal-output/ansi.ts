import { rgbColor, xtermColor } from './palette'

export type AnsiStyle = {
  readonly fg: string | null
  readonly bg: string | null
  readonly bold: boolean
  readonly dim: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly inverse: boolean
}

export type AnsiSpan = {
  readonly text: string
  readonly style: AnsiStyle
}

const DEFAULT_STYLE: AnsiStyle = {
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strike: false,
  inverse: false,
}

const stylesEqual = (left: AnsiStyle, right: AnsiStyle): boolean =>
  left.fg === right.fg &&
  left.bg === right.bg &&
  left.bold === right.bold &&
  left.dim === right.dim &&
  left.italic === right.italic &&
  left.underline === right.underline &&
  left.strike === right.strike &&
  left.inverse === right.inverse

const basicColor = (code: number, offset: number, brightOffset: number): string | null => {
  if (code >= offset && code <= offset + 7) return xtermColor(code - offset)
  if (code >= brightOffset && code <= brightOffset + 7) {
    return xtermColor(code - brightOffset + 8)
  }
  return null
}

const extendedColor = (
  params: readonly number[],
  index: number,
): { readonly color: string | null; readonly consumed: number } | null => {
  if (params[index + 1] === 5) {
    const paletteIndex = params[index + 2]
    return { color: paletteIndex === undefined ? null : xtermColor(paletteIndex), consumed: 2 }
  }
  if (params[index + 1] === 2) {
    const red = params[index + 2]
    const green = params[index + 3]
    const blue = params[index + 4]
    return {
      color:
        red === undefined || green === undefined || blue === undefined
          ? null
          : rgbColor(red, green, blue),
      consumed: 4,
    }
  }
  return null
}

const toggleStyle = (style: AnsiStyle, code: number): AnsiStyle | null => {
  if (code === 1) return { ...style, bold: true }
  if (code === 2) return { ...style, dim: true }
  if (code === 3) return { ...style, italic: true }
  if (code === 4) return { ...style, underline: true }
  if (code === 7) return { ...style, inverse: true }
  if (code === 9) return { ...style, strike: true }
  if (code === 22) return { ...style, bold: false, dim: false }
  if (code === 23) return { ...style, italic: false }
  if (code === 24) return { ...style, underline: false }
  if (code === 27) return { ...style, inverse: false }
  if (code === 29) return { ...style, strike: false }
  return null
}

const applySgr = (style: AnsiStyle, payload: string): AnsiStyle => {
  const params = payload === '' ? [0] : payload.split(';').map(value => Number(value || 0))
  return params.reduce<{ readonly style: AnsiStyle; readonly skip: number }>(
    (state, code, index) => {
      if (state.skip > 0) return { style: state.style, skip: state.skip - 1 }
      if (!Number.isFinite(code)) return state
      if (code === 0) return { style: DEFAULT_STYLE, skip: 0 }

      const toggled = toggleStyle(state.style, code)
      if (toggled) return { style: toggled, skip: 0 }
      if (code === 39) return { style: { ...state.style, fg: null }, skip: 0 }
      if (code === 49) return { style: { ...state.style, bg: null }, skip: 0 }

      const foreground = basicColor(code, 30, 90)
      if (foreground) return { style: { ...state.style, fg: foreground }, skip: 0 }
      const background = basicColor(code, 40, 100)
      if (background) return { style: { ...state.style, bg: background }, skip: 0 }
      if (code !== 38 && code !== 48) return state

      const extended = extendedColor(params, index)
      if (!extended?.color) return state
      const colorKey = code === 38 ? 'fg' : 'bg'
      return {
        style: { ...state.style, [colorKey]: extended.color },
        skip: extended.consumed,
      }
    },
    { style, skip: 0 },
  ).style
}

const escapeEnd = (text: string, start: number): number => {
  if (text[start + 1] === '[') {
    const finalOffset = [...text.slice(start + 2)].findIndex(character => {
      const code = character.charCodeAt(0)
      return code >= 0x40 && code <= 0x7e
    })
    return finalOffset < 0 ? text.length : start + 2 + finalOffset + 1
  }
  if (text[start + 1] === ']') {
    const bell = text.indexOf('\u0007', start + 2)
    const stringTerminator = text.indexOf('\u001b\\', start + 2)
    const endings = [bell < 0 ? text.length : bell + 1, stringTerminator < 0 ? text.length : stringTerminator + 2]
    return Math.min(...endings)
  }
  return Math.min(start + 2, text.length)
}

export const parseAnsi = (source: string): readonly (readonly AnsiSpan[])[] => {
  const text = source.replaceAll('\r\n', '\n').replaceAll('\r', '')
  const lines: AnsiSpan[][] = [[]]
  let style = DEFAULT_STYLE
  let buffer = ''

  const flush = () => {
    if (!buffer) return
    const line = lines.at(-1)
    if (!line) return
    const previous = line.at(-1)
    if (previous && stylesEqual(previous.style, style)) {
      line[line.length - 1] = { ...previous, text: previous.text + buffer }
    }
    else line.push({ text: buffer, style })
    buffer = ''
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '\n') {
      flush()
      lines.push([])
      continue
    }
    if (character === '\u001b') {
      flush()
      const end = escapeEnd(text, index)
      if (text[index + 1] === '[' && text[end - 1] === 'm') {
        style = applySgr(style, text.slice(index + 2, end - 1))
      }
      index = end - 1
      continue
    }
    if (character === undefined) continue
    const code = character.charCodeAt(0)
    if (code < 0x20 || code === 0x7f) continue
    buffer += character
  }
  flush()

  return lines.map(line => (line.length > 0 ? line : [{ text: '', style: DEFAULT_STYLE }]))
}
