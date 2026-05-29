function linearize(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function labF(t) {
  const delta = 6 / 29
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29
}

export function rgbToLab(r, g, b) {
  const rl = linearize(r), gl = linearize(g), bl = linearize(b)
  const X = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047
  const Y = (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) / 1.0
  const Z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / 1.08883
  return {
    L: Math.round((116 * labF(Y) - 16) * 10) / 10,
    a: Math.round(500 * (labF(X) - labF(Y)) * 10) / 10,
    b: Math.round(200 * (labF(Y) - labF(Z)) * 10) / 10,
  }
}
