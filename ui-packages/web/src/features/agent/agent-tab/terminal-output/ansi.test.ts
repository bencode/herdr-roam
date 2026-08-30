import { describe, expect, it } from 'vitest'
import { parseAnsi } from './ansi'

describe('parseAnsi', () => {
  it('parses basic, 256-color, and truecolor SGR sequences', () => {
    const [line] = parseAnsi(
      '\u001b[1;31;44mbasic\u001b[38;5;196m indexed\u001b[48;2;12;34;56m truecolor',
    )

    expect(line).toEqual([
      {
        text: 'basic',
        style: expect.objectContaining({ bold: true, fg: '#cc6666', bg: '#81a2be' }),
      },
      {
        text: ' indexed',
        style: expect.objectContaining({ bold: true, fg: '#ff0000', bg: '#81a2be' }),
      },
      {
        text: ' truecolor',
        style: expect.objectContaining({ bold: true, fg: '#ff0000', bg: '#0c2238' }),
      },
    ])
  })

  it('resets all active styling', () => {
    const [line] = parseAnsi('\u001b[1;2;3;4;7;9;32;45mstyled\u001b[0mplain')

    expect(line?.[0]?.style).toMatchObject({
      bold: true,
      dim: true,
      italic: true,
      underline: true,
      strike: true,
      inverse: true,
    })
    expect(line?.[1]).toEqual({
      text: 'plain',
      style: {
        fg: null,
        bg: null,
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        strike: false,
        inverse: false,
      },
    })
  })

  it('normalizes carriage returns and preserves empty lines', () => {
    expect(parseAnsi('first\r\n\r\nsecond\rline')).toEqual([
      [expect.objectContaining({ text: 'first' })],
      [expect.objectContaining({ text: '' })],
      [expect.objectContaining({ text: 'secondline' })],
    ])
  })

  it('drops non-SGR escape sequences and C0 controls', () => {
    const [line] = parseAnsi('before\u001b[2Jafter\u001b]0;title\u0007!\u0000\u001bc')
    expect(line?.map(span => span.text).join('')).toBe('beforeafter!')
  })
})
