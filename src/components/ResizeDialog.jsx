import { useState, useEffect } from 'react'
import Modal from './Modal'
import { INTERPOLATION_INFO, resizeInWorker } from '../utils/interpolation'
import './ResizeDialog.css'

const PCT_MIN = 1, PCT_MAX = 3200
const PX_MIN = 1, PX_MAX = 32767

function validatePct(val) {
  const n = Number(val)
  if (!val.trim() || !Number.isFinite(n)) return 'Введите число'
  if (n < PCT_MIN || n > PCT_MAX) return `${PCT_MIN}–${PCT_MAX}%`
}

function validatePx(val) {
  const n = Number(val)
  if (!val.trim() || !Number.isFinite(n)) return 'Введите число'
  if (!Number.isInteger(n) || n < PX_MIN || n > PX_MAX) return `${PX_MIN}–${PX_MAX} пкс`
}

export default function ResizeDialog({ isOpen, imageData, onApply, onCancel }) {
  const [mode, setMode] = useState('percent')
  const [wVal, setWVal] = useState('100')
  const [hVal, setHVal] = useState('100')
  const [lock, setLock] = useState(true)
  const [interp, setInterp] = useState('bilinear')
  const [applying, setApplying] = useState(false)
  const [wErr, setWErr] = useState()
  const [hErr, setHErr] = useState()

  const origW = imageData?.width ?? 1
  const origH = imageData?.height ?? 1
  const aspect = origW / origH

  useEffect(() => {
    if (isOpen) {
      setMode('percent'); setWVal('100'); setHVal('100')
      setLock(true); setInterp('bilinear')
      setApplying(false); setWErr(undefined); setHErr(undefined)
    }
  }, [isOpen])

  const computeDims = () => {
    if (mode === 'percent') {
      const pw = Number(wVal), ph = Number(hVal)
      if (!Number.isFinite(pw) || pw < PCT_MIN || pw > PCT_MAX) return null
      if (!Number.isFinite(ph) || ph < PCT_MIN || ph > PCT_MAX) return null
      return { w: Math.max(1, Math.round(origW * pw / 100)), h: Math.max(1, Math.round(origH * ph / 100)) }
    }
    const w = Number(wVal), h = Number(hVal)
    if (!Number.isInteger(w) || w < PX_MIN || w > PX_MAX) return null
    if (!Number.isInteger(h) || h < PX_MIN || h > PX_MAX) return null
    return { w, h }
  }

  const handleModeChange = (next) => {
    if (next === mode) return
    const dims = computeDims()
    if (next === 'pixels') {
      setWVal(String(dims?.w ?? origW))
      setHVal(String(dims?.h ?? origH))
    } else {
      const pctW = dims ? Math.round(dims.w / origW * 100) : 100
      const pctH = dims ? Math.round(dims.h / origH * 100) : 100
      setWVal(String(pctW)); setHVal(String(pctH))
    }
    setWErr(undefined); setHErr(undefined); setMode(next)
  }

  const handleW = (val) => {
    setWVal(val)
    const err = mode === 'percent' ? validatePct(val) : validatePx(val)
    setWErr(err)
    if (!err && lock) {
      const n = Number(val)
      if (mode === 'percent') { setHVal(val); setHErr(undefined) }
      else { setHVal(String(Math.max(1, Math.round(n / aspect)))); setHErr(undefined) }
    }
  }

  const handleH = (val) => {
    setHVal(val)
    const err = mode === 'percent' ? validatePct(val) : validatePx(val)
    setHErr(err)
    if (!err && lock) {
      const n = Number(val)
      if (mode === 'percent') { setWVal(val); setWErr(undefined) }
      else { setWVal(String(Math.max(1, Math.round(n * aspect)))); setWErr(undefined) }
    }
  }

  const handleApply = async () => {
    if (!imageData) return
    const we = mode === 'percent' ? validatePct(wVal) : validatePx(wVal)
    const he = mode === 'percent' ? validatePct(hVal) : validatePx(hVal)
    setWErr(we); setHErr(he)
    if (we || he) return
    const dims = computeDims()
    if (!dims) return
    setApplying(true)
    try {
      const result = await resizeInWorker(imageData, dims.w, dims.h, interp)
      onApply(result)
    } catch {
      setApplying(false)
    }
  }

  const dims = computeDims()
  const beforeMP = (origW * origH / 1_000_000).toFixed(2)
  const afterLabel = dims
    ? `${dims.w} × ${dims.h} пкс (${(dims.w * dims.h / 1_000_000).toFixed(2)} Мп)`
    : '—'

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Размер изображения">
      <div className="rs-content">
        <div className="rs-info">
          <div className="rs-info-row">
            <span className="rs-info-label">До</span>
            <span className="rs-info-value">{origW} × {origH} пкс ({beforeMP} Мп)</span>
          </div>
          <div className="rs-info-row">
            <span className="rs-info-label">После</span>
            <span className="rs-info-value after">{afterLabel}</span>
          </div>
        </div>

        <div className="rs-field">
          <label className="rs-label">Единицы</label>
          <select className="rs-select" value={mode} onChange={e => handleModeChange(e.target.value)} disabled={applying}>
            <option value="percent">Проценты (%)</option>
            <option value="pixels">Пиксели (пкс)</option>
          </select>
        </div>

        <div className="rs-dims">
          <div className="rs-dim-field">
            <label className="rs-label">Ширина {mode === 'percent' ? '(%)' : '(пкс)'}</label>
            <input
              className={`rs-input${wErr ? ' err' : ''}`}
              type="number"
              value={wVal}
              min={mode === 'percent' ? PCT_MIN : PX_MIN}
              max={mode === 'percent' ? PCT_MAX : PX_MAX}
              step={1}
              onChange={e => handleW(e.target.value)}
              disabled={applying}
            />
            {wErr && <span className="rs-err">{wErr}</span>}
          </div>
          <div className="rs-dim-field">
            <label className="rs-label">Высота {mode === 'percent' ? '(%)' : '(пкс)'}</label>
            <input
              className={`rs-input${hErr ? ' err' : ''}`}
              type="number"
              value={hVal}
              min={PX_MIN}
              max={PX_MAX}
              step={1}
              onChange={e => handleH(e.target.value)}
              disabled={applying}
            />
            {hErr && <span className="rs-err">{hErr}</span>}
          </div>
        </div>

        <label className="rs-check-label">
          <input
            type="checkbox"
            checked={lock}
            onChange={e => setLock(e.target.checked)}
            disabled={applying}
          />
          Сохранять пропорции
        </label>

        <div className="rs-field">
          <label className="rs-label">Интерполяция</label>
          <div className="rs-interp-row">
            <select className="rs-select" value={interp} onChange={e => setInterp(e.target.value)} disabled={applying}>
              {Object.keys(INTERPOLATION_INFO).map(key => (
                <option key={key} value={key}>{INTERPOLATION_INFO[key].label}</option>
              ))}
            </select>
            <div className="rs-tip-wrap">
              <span className="rs-tip-icon">?</span>
              <div className="rs-tip">{INTERPOLATION_INFO[interp].tooltip}</div>
            </div>
          </div>
        </div>

        <div className="rs-actions">
          <button type="button" className="rs-btn rs-btn-cancel" onClick={onCancel} disabled={applying}>Отмена</button>
          <button type="button" className="rs-btn rs-btn-apply" onClick={handleApply} disabled={applying || !imageData || !!(wErr || hErr)}>
            {applying ? 'Применяется…' : 'Применить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
