export const INTERPOLATION_INFO = {
  nearest: {
    label: 'Ближайший сосед',
    tooltip:
      'Быстрый метод: каждый новый пиксель берёт цвет ближайшего пикселя источника. ' +
      'Сохраняет чёткие края и пиксельный стиль, но при увеличении даёт «кубики».',
  },
  bilinear: {
    label: 'Билинейная',
    tooltip:
      'Взвешенное среднее четырёх соседних пикселей источника. ' +
      'Результат плавный, без пикселизации. Рекомендуется по умолчанию для фотографий.',
  },
}

export function resizeNearest(src, targetW, targetH) {
  const dst = new ImageData(targetW, targetH)
  const { data: sd, width: sw, height: sh } = src
  const { data: dd } = dst
  const xr = sw / targetW
  const yr = sh / targetH
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(Math.floor(y * yr), sh - 1)
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(Math.floor(x * xr), sw - 1)
      const si = (sy * sw + sx) * 4
      const di = (y * targetW + x) * 4
      dd[di] = sd[si]; dd[di + 1] = sd[si + 1]; dd[di + 2] = sd[si + 2]; dd[di + 3] = sd[si + 3]
    }
  }
  return dst
}

export function resizeBilinear(src, targetW, targetH) {
  const dst = new ImageData(targetW, targetH)
  const { data: sd, width: sw, height: sh } = src
  const { data: dd } = dst
  const xr = sw / targetW
  const yr = sh / targetH
  for (let y = 0; y < targetH; y++) {
    const yf = y * yr
    const y0 = Math.floor(yf)
    const y1 = Math.min(y0 + 1, sh - 1)
    const yw = yf - y0
    for (let x = 0; x < targetW; x++) {
      const xf = x * xr
      const x0 = Math.floor(xf)
      const x1 = Math.min(x0 + 1, sw - 1)
      const xw = xf - x0
      const di = (y * targetW + x) * 4
      for (let c = 0; c < 4; c++) {
        const tl = sd[(y0 * sw + x0) * 4 + c]
        const tr = sd[(y0 * sw + x1) * 4 + c]
        const bl = sd[(y1 * sw + x0) * 4 + c]
        const br = sd[(y1 * sw + x1) * 4 + c]
        dd[di + c] = Math.round(tl * (1 - xw) * (1 - yw) + tr * xw * (1 - yw) + bl * (1 - xw) * yw + br * xw * yw)
      }
    }
  }
  return dst
}

export function resizeImage(src, targetW, targetH, method = 'bilinear') {
  if (method === 'nearest') return resizeNearest(src, targetW, targetH)
  return resizeBilinear(src, targetW, targetH)
}

export function resizeInWorker(src, targetW, targetH, method) {
  return new Promise((resolve, reject) => {
    const code = `
      self.onmessage = ({ data: { buffer, sw, sh, targetW, targetH, method } }) => {
        const sd = new Uint8ClampedArray(buffer);
        const dd = new Uint8ClampedArray(targetW * targetH * 4);
        const xr = sw / targetW, yr = sh / targetH;
        if (method === 'nearest') {
          for (let y = 0; y < targetH; y++) {
            const sy = Math.min(Math.floor(y * yr), sh - 1);
            for (let x = 0; x < targetW; x++) {
              const sx = Math.min(Math.floor(x * xr), sw - 1);
              const si = (sy * sw + sx) * 4, di = (y * targetW + x) * 4;
              dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3];
            }
          }
        } else {
          for (let y = 0; y < targetH; y++) {
            const yf = y * yr, y0 = Math.floor(yf), y1 = Math.min(y0+1, sh-1), yw = yf - y0;
            for (let x = 0; x < targetW; x++) {
              const xf = x * xr, x0 = Math.floor(xf), x1 = Math.min(x0+1, sw-1), xw = xf - x0;
              const di = (y * targetW + x) * 4;
              for (let c = 0; c < 4; c++) {
                const tl=sd[(y0*sw+x0)*4+c], tr=sd[(y0*sw+x1)*4+c];
                const bl=sd[(y1*sw+x0)*4+c], br=sd[(y1*sw+x1)*4+c];
                dd[di+c] = Math.round(tl*(1-xw)*(1-yw)+tr*xw*(1-yw)+bl*(1-xw)*yw+br*xw*yw);
              }
            }
          }
        }
        self.postMessage({ buffer: dd.buffer, targetW, targetH }, [dd.buffer]);
      };
    `
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
    const worker = new Worker(url)

    worker.onmessage = ({ data }) => {
      URL.revokeObjectURL(url)
      worker.terminate()
      resolve(new ImageData(new Uint8ClampedArray(data.buffer), data.targetW, data.targetH))
    }
    worker.onerror = (err) => {
      URL.revokeObjectURL(url)
      worker.terminate()
      reject(new Error(String(err)))
    }

    const copy = src.data.buffer.slice(0)
    worker.postMessage({ buffer: copy, sw: src.width, sh: src.height, targetW, targetH, method }, [copy])
  })
}
