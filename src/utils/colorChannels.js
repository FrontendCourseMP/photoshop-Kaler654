export function getChannelIds(colorDepth) {
  if (colorDepth <= 7) return ['gray']
  if (colorDepth <= 16) return ['gray', 'alpha']
  if (colorDepth <= 24) return ['red', 'green', 'blue']
  return ['red', 'green', 'blue', 'alpha']
}

export function scaleImageData(src, targetW, targetH) {
  const out = new ImageData(targetW, targetH)
  const xRatio = src.width / targetW
  const yRatio = src.height / targetH
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), src.width - 1)
      const srcY = Math.min(Math.floor(y * yRatio), src.height - 1)
      const si = (srcY * src.width + srcX) * 4
      const di = (y * targetW + x) * 4
      out.data[di]     = src.data[si]
      out.data[di + 1] = src.data[si + 1]
      out.data[di + 2] = src.data[si + 2]
      out.data[di + 3] = src.data[si + 3]
    }
  }
  return out
}

export function extractChannelPreview(imageData, channelId) {
  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  const d = out.data
  for (let i = 0; i < data.length; i += 4) {
    if (channelId === 'composite') {
      d[i] = data[i]; d[i + 1] = data[i + 1]; d[i + 2] = data[i + 2]; d[i + 3] = data[i + 3]
      continue
    }
    const v =
      channelId === 'red'   ? data[i]     :
      channelId === 'green' ? data[i + 1] :
      channelId === 'blue'  ? data[i + 2] :
      channelId === 'alpha' ? data[i + 3] :
      data[i]
    d[i]     = channelId === 'red'   || channelId === 'gray' || channelId === 'alpha' ? v : 0
    d[i + 1] = channelId === 'green' || channelId === 'gray' || channelId === 'alpha' ? v : 0
    d[i + 2] = channelId === 'blue'  || channelId === 'gray' || channelId === 'alpha' ? v : 0
    d[i + 3] = 255
  }
  return out
}

export function applyChannelMask(imageData, activeChannels, availableChannels) {
  const allActive = availableChannels.every(ch => activeChannels.has(ch))
  if (allActive) return null

  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  const d = out.data

  const isGrayscale = availableChannels.includes('gray')
  const hasAlpha = availableChannels.includes('alpha')
  const onlyAlpha = activeChannels.size === 1 && activeChannels.has('alpha')

  const showGray = activeChannels.has('gray')
  const showR = activeChannels.has('red')
  const showG = activeChannels.has('green')
  const showB = activeChannels.has('blue')
  const showA = activeChannels.has('alpha')

  for (let i = 0; i < data.length; i += 4) {
    if (onlyAlpha) {
      const a = data[i + 3]
      d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255
    } else if (isGrayscale) {
      const v = showGray ? data[i] : 0
      d[i] = v; d[i + 1] = v; d[i + 2] = v
      d[i + 3] = hasAlpha ? (showA ? data[i + 3] : 255) : 255
    } else {
      d[i]     = showR ? data[i]     : 0
      d[i + 1] = showG ? data[i + 1] : 0
      d[i + 2] = showB ? data[i + 2] : 0
      d[i + 3] = hasAlpha ? (showA ? data[i + 3] : 255) : 255
    }
  }
  return out
}
