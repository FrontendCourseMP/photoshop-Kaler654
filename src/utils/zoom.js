const ZOOM_STEPS = [10, 25, 33, 50, 67, 100, 150, 200, 300, 400, 600, 800]

export const ZOOM_PRESETS = [12, 25, 33, 50, 67, 75, 100, 150, 200, 300]

export function snapZoom(current, direction) {
  if (direction === 'in') {
    const next = ZOOM_STEPS.find(s => s > current)
    return next ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
  }
  const prev = [...ZOOM_STEPS].reverse().find(s => s < current)
  return prev ?? ZOOM_STEPS[0]
}

export function calcFitZoom(imgW, imgH) {
  const availW = window.innerWidth - 100
  const availH = window.innerHeight - 26 - 22 - 100
  if (availW <= 0 || availH <= 0) return 100
  const scale = Math.min(availW / imgW, availH / imgH) * 100
  return Math.min(300, Math.max(12, Math.round(scale)))
}
