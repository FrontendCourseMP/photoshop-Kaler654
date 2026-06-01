export const KERNEL_PRESETS = [
  { name: 'Тождественное отображение', values: [0, 0, 0, 0, 1, 0, 0, 0, 0] },
  { name: 'Повышение резкости',         values: [0, -1, 0, -1, 5, -1, 0, -1, 0] },
  { name: 'Фильтр Гаусса (3×3)',        values: [1, 2, 1, 2, 4, 2, 1, 2, 1] },
  { name: 'Прямоугольное размытие',     values: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { name: 'Оператор Прюитта (горизонтальный)', values: [-1, -1, -1, 0, 0, 0, 1, 1, 1] },
  { name: 'Оператор Прюитта (вертикальный)',   values: [-1, 0, 1, -1, 0, 1, -1, 0, 1] },
]

export const CHAN_IDX = { r: 0, g: 1, b: 2, a: 3 }

// edge: 'black' | 'white' | 'copy'
export function applyKernel(src, kernel, channels, edge) {
  const { width: w, height: h, data } = src
  const out = new Uint8ClampedArray(data)

  const sum = kernel.reduce((a, b) => a + b, 0)
  const divisor = Math.abs(sum) < 1e-6 ? 1 : sum

  for (const ch of channels) {
    const ci = CHAN_IDX[ch]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = 0
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const ox = x + kx - 1
            const oy = y + ky - 1
            let val
            if (ox >= 0 && ox < w && oy >= 0 && oy < h) {
              val = data[(oy * w + ox) * 4 + ci]
            } else if (edge === 'black') {
              val = ci === 3 ? 255 : 0
            } else if (edge === 'white') {
              val = 255
            } else {
              const px = Math.max(0, Math.min(w - 1, ox))
              const py = Math.max(0, Math.min(h - 1, oy))
              val = data[(py * w + px) * 4 + ci]
            }
            acc += kernel[ky * 3 + kx] * val
          }
        }
        out[(y * w + x) * 4 + ci] = Math.max(0, Math.min(255, Math.round(acc / divisor)))
      }
    }
  }

  return new ImageData(out, w, h)
}
