const ANSI_COLORS = [
  '#1d1f21',
  '#cc6666',
  '#b5bd68',
  '#f0c674',
  '#81a2be',
  '#b294bb',
  '#8abeb7',
  '#c5c8c6',
  '#666666',
  '#d54e53',
  '#b9ca4a',
  '#e7c547',
  '#7aa6da',
  '#c397d8',
  '#70c0b1',
  '#eaeaea',
] as const

const COLOR_CUBE = [0, 95, 135, 175, 215, 255] as const

const toHex = (value: number): string => value.toString(16).padStart(2, '0')

export const rgbColor = (red: number, green: number, blue: number): string | null => {
  const channels = [red, green, blue]
  if (!channels.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    return null
  }
  return `#${channels.map(toHex).join('')}`
}

export const xtermColor = (index: number): string | null => {
  if (!Number.isInteger(index) || index < 0 || index > 255) return null
  if (index < ANSI_COLORS.length) return ANSI_COLORS[index] ?? null
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10
    return rgbColor(gray, gray, gray)
  }

  const cubeIndex = index - 16
  const red = COLOR_CUBE[Math.floor(cubeIndex / 36)]
  const green = COLOR_CUBE[Math.floor((cubeIndex % 36) / 6)]
  const blue = COLOR_CUBE[cubeIndex % 6]
  if (red === undefined || green === undefined || blue === undefined) return null
  return rgbColor(red, green, blue)
}
