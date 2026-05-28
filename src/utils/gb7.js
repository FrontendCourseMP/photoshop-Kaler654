const SIGNATURE = [0x47, 0x42, 0x37, 0x1d]
const HEADER_SIZE = 12

export function decodeGB7(buffer) {
  const bytes = new Uint8Array(buffer)

  if (bytes.length < HEADER_SIZE) throw new Error('Файл слишком короткий для формата GB7')

  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('Неверная сигнатура файла GB7')
  }

  const version = bytes[4]
  if (version !== 0x01) throw new Error(`Неподдерживаемая версия GB7: ${version}`)

  const flag = bytes[5]
  const hasMask = (flag & 0x01) === 1

  const width = (bytes[6] << 8) | bytes[7]
  const height = (bytes[8] << 8) | bytes[9]

  if (width === 0 || height === 0) throw new Error('Нулевые размеры изображения')
  if (bytes.length < HEADER_SIZE + width * height) throw new Error('Файл усечён или повреждён')

  const imageData = new ImageData(width, height)
  const data = imageData.data

  for (let i = 0; i < width * height; i++) {
    const byte = bytes[HEADER_SIZE + i]
    const gray7 = byte & 0x7f
    const maskBit = (byte >> 7) & 0x01
    const gray8 = Math.round((gray7 / 127) * 255)
    const alpha = hasMask ? (maskBit === 1 ? 255 : 0) : 255
    const off = i * 4
    data[off] = gray8
    data[off + 1] = gray8
    data[off + 2] = gray8
    data[off + 3] = alpha
  }

  return { imageData, colorDepth: hasMask ? 8 : 7 }
}

export function encodeGB7(imageData) {
  const { width, height, data } = imageData

  let hasMask = false
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) { hasMask = true; break }
  }

  const buffer = new Uint8Array(HEADER_SIZE + width * height)
  buffer[0] = 0x47; buffer[1] = 0x42; buffer[2] = 0x37; buffer[3] = 0x1d
  buffer[4] = 0x01
  buffer[5] = hasMask ? 0x01 : 0x00
  buffer[6] = (width >> 8) & 0xff; buffer[7] = width & 0xff
  buffer[8] = (height >> 8) & 0xff; buffer[9] = height & 0xff
  buffer[10] = 0x00; buffer[11] = 0x00

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3]
    const gray8 = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const gray7 = Math.round((gray8 / 255) * 127)
    const maskBit = hasMask ? (a >= 128 ? 1 : 0) : 0
    buffer[HEADER_SIZE + i] = (maskBit << 7) | (gray7 & 0x7f)
  }

  return buffer
}
