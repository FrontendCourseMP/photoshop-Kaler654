const WORKER_CODE = `
  let src = null;
  let w = 0, h = 0;

  function makeLUT(black, gamma, white) {
    const lut = new Uint8ClampedArray(256);
    const lo = Math.max(0, Math.min(255, black));
    const hi = Math.max(0, Math.min(255, white));
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < 256; i++) {
      if (i <= lo) lut[i] = 0;
      else if (i >= hi) lut[i] = 255;
      else lut[i] = Math.round(Math.max(0, Math.min(255, Math.pow((i - lo) / range, 1 / gamma) * 255)));
    }
    return lut;
  }

  self.onmessage = ({ data }) => {
    if (data.type === 'init') {
      src = new Uint8ClampedArray(data.buf);
      w = data.w;
      h = data.h;
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'compute') {
      if (!src) return;
      const { levels, gen } = data;
      const lutM = makeLUT(levels.master.black, levels.master.gamma, levels.master.white);
      const lutR_raw = makeLUT(levels.r.black, levels.r.gamma, levels.r.white);
      const lutG_raw = makeLUT(levels.g.black, levels.g.gamma, levels.g.white);
      const lutB_raw = makeLUT(levels.b.black, levels.b.gamma, levels.b.white);
      const lutA = makeLUT(levels.a.black, levels.a.gamma, levels.a.white);
      const lutR = new Uint8ClampedArray(256);
      const lutG = new Uint8ClampedArray(256);
      const lutB = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) {
        lutR[i] = lutR_raw[lutM[i]];
        lutG[i] = lutG_raw[lutM[i]];
        lutB[i] = lutB_raw[lutM[i]];
      }
      const dst = new Uint8ClampedArray(src.length);
      for (let i = 0; i < src.length; i += 4) {
        dst[i]   = lutR[src[i]];
        dst[i+1] = lutG[src[i+1]];
        dst[i+2] = lutB[src[i+2]];
        dst[i+3] = lutA[src[i+3]];
      }
      self.postMessage({ type: 'result', buf: dst.buffer, w, h, gen }, [dst.buffer]);
    }
  };
`

// Persistent worker — хранит пиксели в своей памяти, принимает только levels на каждый тик
export class LevelsPreviewWorker {
  constructor(imageData) {
    this.w = imageData.width
    this.h = imageData.height
    this.busy = false
    this.queued = null
    this.gen = 0
    this.pendingResolve = null

    this.url = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'application/javascript' }))
    this.worker = new Worker(this.url)

    this.worker.onmessage = ({ data }) => {
      if (data.type === 'result' && data.gen === this.gen) {
        const resolve = this.pendingResolve
        this.pendingResolve = null
        this.busy = false
        const result = new ImageData(new Uint8ClampedArray(data.buf), data.w, data.h)
        resolve?.(result)
        if (this.queued) {
          const { levels, resolve: qr } = this.queued
          this.queued = null
          this._dispatch(levels, qr)
        }
      }
    }

    const copy = imageData.data.slice().buffer
    this.worker.postMessage({ type: 'init', buf: copy, w: imageData.width, h: imageData.height }, [copy])
  }

  compute(levels) {
    return new Promise(resolve => {
      if (this.busy) {
        this.queued = { levels, resolve }
      } else {
        this._dispatch(levels, resolve)
      }
    })
  }

  _dispatch(levels, resolve) {
    this.busy = true
    this.gen++
    this.pendingResolve = resolve
    this.worker.postMessage({ type: 'compute', levels, gen: this.gen })
  }

  terminate() {
    this.worker.terminate()
    URL.revokeObjectURL(this.url)
    this.queued = null
    this.pendingResolve = null
  }
}
