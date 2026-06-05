export const defaultLevels = {
  master: { black: 0, white: 255, gamma: 1 },
  r: { black: 0, white: 255, gamma: 1 },
  g: { black: 0, white: 255, gamma: 1 },
  b: { black: 0, white: 255, gamma: 1 },
  a: { black: 0, white: 255, gamma: 1 },
}

export function makeLUT(black, gamma, white) {
  const lut = new Uint8ClampedArray(256)
  const lo = Math.max(0, Math.min(255, black))
  const hi = Math.max(0, Math.min(255, white))
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < 256; i++) {
    if (i <= lo) lut[i] = 0
    else if (i >= hi) lut[i] = 255
    else lut[i] = Math.round(Math.max(0, Math.min(255, Math.pow((i - lo) / range, 1 / gamma) * 255)))
  }
  return lut
}

export function applyLevels(imageData, levels) {
  const out = new ImageData(imageData.width, imageData.height)
  const lutR = makeLUT(levels.r.black, levels.r.gamma, levels.r.white)
  const lutG = makeLUT(levels.g.black, levels.g.gamma, levels.g.white)
  const lutB = makeLUT(levels.b.black, levels.b.gamma, levels.b.white)
  const lutA = makeLUT(levels.a.black, levels.a.gamma, levels.a.white)
  const s = imageData.data
  const d = out.data
  for (let i = 0; i < s.length; i += 4) {
    d[i]     = lutR[s[i]]
    d[i + 1] = lutG[s[i + 1]]
    d[i + 2] = lutB[s[i + 2]]
    d[i + 3] = lutA[s[i + 3]]
  }
  return out
}

export function computeHistogram(imageData, channel) {
  const hist = new Array(256).fill(0)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    let value
    if (channel === 'master') value = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    else if (channel === 'gray') value = r
    else if (channel === 'r') value = r
    else if (channel === 'g') value = g
    else if (channel === 'b') value = b
    else value = a
    hist[value]++
  }
  return hist
}

export function drawHistogram(canvas, histogram, isLog) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const maxValue = Math.max(...histogram)
  if (maxValue === 0) return
  const scale = canvas.height / (isLog ? Math.log(maxValue + 1) : maxValue)
  ctx.fillStyle = '#888'
  for (let i = 0; i < 256; i++) {
    const h = isLog ? Math.log(histogram[i] + 1) * scale : histogram[i] * scale
    ctx.fillRect(i, canvas.height - h, 1, h)
  }
}
