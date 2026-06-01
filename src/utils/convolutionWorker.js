const WORKER_CODE = `
  let src = null;
  let w = 0, h = 0;

  function getPixel(data, x, y, ci, edge) {
    if (x >= 0 && x < w && y >= 0 && y < h) return data[(y * w + x) * 4 + ci];
    if (edge === 'black') return ci === 3 ? 255 : 0;
    if (edge === 'white') return 255;
    return data[(Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4 + ci];
  }

  function convolve(kernel, channels, edge) {
    const CHAN = { r: 0, g: 1, b: 2, a: 3 };
    const sum = kernel.reduce((a, b) => a + b, 0);
    const divisor = Math.abs(sum) < 1e-6 ? 1 : sum;
    const out = new Uint8ClampedArray(src);
    for (const ch of channels) {
      const ci = CHAN[ch];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let acc = 0;
          for (let ky = 0; ky < 3; ky++) {
            for (let kx = 0; kx < 3; kx++) {
              acc += kernel[ky * 3 + kx] * getPixel(src, x + kx - 1, y + ky - 1, ci, edge);
            }
          }
          out[(y * w + x) * 4 + ci] = Math.max(0, Math.min(255, Math.round(acc / divisor)));
        }
      }
    }
    return out;
  }

  self.onmessage = ({ data }) => {
    if (data.type === 'init') {
      src = new Uint8ClampedArray(data.buf);
      w = data.w; h = data.h;
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'compute') {
      if (!src) return;
      const out = convolve(data.kernel, data.channels, data.edge);
      self.postMessage({ type: 'result', buf: out.buffer, gen: data.gen }, [out.buffer]);
    }
  };
`

// Persistent worker — keeps imageData in its memory, only receives kernel params per tick
export class KernelPreviewWorker {
  constructor(imageData) {
    this.w = imageData.width
    this.h = imageData.height
    this.busy = false
    this.gen = 0
    this.pendingResolve = null
    this.queued = null

    this.url = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'application/javascript' }))
    this.worker = new Worker(this.url)

    this.worker.onmessage = ({ data }) => {
      if (data.type === 'result' && data.gen === this.gen) {
        const resolve = this.pendingResolve
        this.pendingResolve = null
        this.busy = false
        resolve?.(new ImageData(new Uint8ClampedArray(data.buf), this.w, this.h))
        if (this.queued) {
          const { kernel, channels, edge, resolve: qr } = this.queued
          this.queued = null
          this._dispatch(kernel, channels, edge, qr)
        }
      }
    }

    const copy = imageData.data.slice().buffer
    this.worker.postMessage({ type: 'init', buf: copy, w: imageData.width, h: imageData.height }, [copy])
  }

  compute(kernel, channels, edge) {
    return new Promise(resolve => {
      if (this.busy) {
        this.queued = { kernel, channels, edge, resolve }
      } else {
        this._dispatch(kernel, channels, edge, resolve)
      }
    })
  }

  _dispatch(kernel, channels, edge, resolve) {
    this.busy = true
    this.gen++
    this.pendingResolve = resolve
    this.worker.postMessage({ type: 'compute', kernel, channels, edge, gen: this.gen })
  }

  terminate() {
    this.worker.terminate()
    URL.revokeObjectURL(this.url)
    this.queued = null
    this.pendingResolve = null
  }
}

export function applyKernelInWorker(src, kernel, channels, edge) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'application/javascript' }))
    const worker = new Worker(url)
    const w = src.width, h = src.height

    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        worker.postMessage({ type: 'compute', kernel, channels, edge, gen: 1 })
      } else if (data.type === 'result') {
        URL.revokeObjectURL(url)
        worker.terminate()
        resolve(new ImageData(new Uint8ClampedArray(data.buf), w, h))
      }
    }
    worker.onerror = (e) => {
      URL.revokeObjectURL(url)
      worker.terminate()
      reject(e)
    }

    const copy = src.data.slice().buffer
    worker.postMessage({ type: 'init', buf: copy, w, h }, [copy])
  })
}
