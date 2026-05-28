const SIG = [0x47, 0x42, 0x37, 0x1D]

export function decodeGB7(buffer) {
  const view = new DataView(buffer)

  for (let i = 0; i < 4; i++) {
    if (view.getUint8(i) !== SIG[i]) throw new Error('Неверная сигнатура GB7')
  }

  const flag = view.getUint8(5)
  const hasMask = (flag & 0x01) === 1
  const width = view.getUint16(6, false)
  const height = view.getUint16(8, false)

  if (buffer.byteLength < 12 + width * height) {
    throw new Error('Файл повреждён: недостаточно данных')
  }

  const imageData = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < width * height; i++) {
    const byte = view.getUint8(12 + i)
    const gray7 = byte & 0x7F
    const maskBit = (byte >> 7) & 0x01
    const gray8 = Math.round((gray7 / 127) * 255)

    imageData[i * 4 + 0] = gray8
    imageData[i * 4 + 1] = gray8
    imageData[i * 4 + 2] = gray8
    imageData[i * 4 + 3] = hasMask ? (maskBit ? 255 : 0) : 255
  }

  return { width, height, imageData, colorDepth: 7 }
}

export function encodeGB7(canvas) {
  const { width, height } = canvas
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data

  const buf = new ArrayBuffer(12 + width * height)
  const view = new DataView(buf)

  view.setUint8(0, 0x47)
  view.setUint8(1, 0x42)
  view.setUint8(2, 0x37)
  view.setUint8(3, 0x1D)
  view.setUint8(4, 0x01)
  view.setUint8(5, 0x00)
  view.setUint16(6, width, false)
  view.setUint16(8, height, false)
  view.setUint16(10, 0, false)

  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    const gray7 = Math.round((gray / 255) * 127)
    view.setUint8(12 + i, gray7 & 0x7F)
  }

  return buf
}
