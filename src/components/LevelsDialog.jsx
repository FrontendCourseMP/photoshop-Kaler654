import { useState, useEffect, useRef, useCallback } from 'react'
import { defaultLevels, computeHistogram, drawHistogram, applyLevels } from '../utils/levels'
import { LevelsPreviewWorker } from '../utils/levelsPreviewWorker'
import './LevelsDialog.css'

const CHANNELS = ['master', 'r', 'g', 'b', 'a']
const CHANNEL_LABELS = { master: 'Совмещённый', gray: 'Серый', r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha' }

function getAvailableChannels(colorDepth) {
  if (!colorDepth) return ['master', 'r', 'g', 'b']
  if (colorDepth === 7) return ['gray']
  if (colorDepth === 8) return ['gray', 'a']
  if (colorDepth <= 24) return ['master', 'r', 'g', 'b']
  return CHANNELS
}

export default function LevelsDialog({ isOpen, imageData, colorDepth, canvasRef, onApply, onCancel }) {
  const [channel, setChannel] = useState('master')
  const [levels, setLevels] = useState(defaultLevels)
  const [isLog, setIsLog] = useState(false)
  const [preview, setPreview] = useState(true)
  const [applying, setApplying] = useState(false)
  const histRef = useRef(null)
  const rafRef = useRef(null)
  const workerRef = useRef(null)

  const [pos, setPos] = useState(() => ({
    x: Math.round(window.innerWidth / 2 - 190),
    y: Math.round(window.innerHeight / 2 - 220),
  }))
  const dragStart = useRef(null)

  const cur = levels[channel === 'gray' ? 'master' : channel]

  useEffect(() => {
    if (!isOpen) return
    setChannel(getAvailableChannels(colorDepth)[0])
    setLevels(defaultLevels)
    setIsLog(false)
    setPreview(true)
    setApplying(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !imageData || !histRef.current) return
    const run = () => {
      const hist = computeHistogram(imageData, channel)
      drawHistogram(histRef.current, hist, isLog)
    }
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(run)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 0)
    return () => clearTimeout(id)
  }, [isOpen, imageData, channel, isLog])

  useEffect(() => {
    if (!isOpen || !imageData) {
      workerRef.current?.terminate()
      workerRef.current = null
      return
    }
    workerRef.current = new LevelsPreviewWorker(imageData)
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [isOpen, imageData])

  useEffect(() => {
    if (!isOpen || !imageData || !canvasRef.current) return
    const isDefault = CHANNELS.every(ch =>
      levels[ch].black === 0 && levels[ch].white === 255 && levels[ch].gamma === 1
    )
    const canvas = canvasRef.current
    if (!preview || isDefault) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        canvas.getContext('2d')?.putImageData(imageData, 0, 0)
      })
      return
    }
    const worker = workerRef.current
    if (!worker) return
    void worker.compute(levels).then(result => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        canvas.getContext('2d')?.putImageData(result, 0, 0)
      })
    })
  }, [isOpen, imageData, levels, preview, canvasRef])

  const updateLevel = useCallback((key, value) => {
    setLevels(prev => {
      const isGray = channel === 'gray'
      const src = (channel === 'master' || isGray) ? prev.master : prev[channel]
      let clamped = value
      if (key === 'black') clamped = Math.min(value, src.white - 1)
      if (key === 'white') clamped = Math.max(value, src.black + 1)
      const updated = { ...src, [key]: clamped }
      if (channel === 'master' || isGray) {
        return { ...prev, master: updated, r: updated, g: updated, b: updated }
      }
      return { ...prev, [channel]: updated }
    })
  }, [channel])

  const handleReset = () => {
    setLevels(defaultLevels)
    setIsLog(false)
    setPreview(true)
  }

  const handleApply = () => {
    if (!imageData || applying) return
    setApplying(true)
    const result = applyLevels(imageData, levels)
    onApply(result)
  }

  const handleTitleMouseDown = (e) => {
    e.preventDefault()
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y }
    const onMove = (ev) => {
      if (!dragStart.current) return
      setPos({ x: dragStart.current.posX + ev.clientX - dragStart.current.mouseX, y: dragStart.current.posY + ev.clientY - dragStart.current.mouseY })
    }
    const onUp = () => {
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!isOpen) return null

  const available = getAvailableChannels(colorDepth)
  const busy = !imageData || applying

  return (
    <div className="levels-dialog" style={{ left: pos.x, top: pos.y }}>
      <div className="levels-titlebar" onMouseDown={handleTitleMouseDown}>
        <span>Уровни{!imageData ? ' — загрузка...' : applying ? ' — применение...' : ''}</span>
        <button className="levels-close" onMouseDown={e => e.stopPropagation()} onClick={onCancel}>✕</button>
      </div>

      <div className="levels-body">
        <div className="levels-row">
          <label className="levels-label">Канал:</label>
          <select className="levels-select" value={channel} onChange={e => setChannel(e.target.value)}>
            {available.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>)}
          </select>
          <div className="levels-scale-btns">
            <button
              className={`levels-scale-btn${!isLog ? ' levels-scale-btn-active' : ''}`}
              onClick={() => setIsLog(false)}
            >Линейная</button>
            <button
              className={`levels-scale-btn${isLog ? ' levels-scale-btn-active' : ''}`}
              onClick={() => setIsLog(true)}
            >Лог</button>
          </div>
        </div>

        <div className="levels-hist-wrap">
          <canvas ref={histRef} className="levels-hist-canvas" width={256} height={100} />
        </div>

        <div className="levels-sliders">
          <div className="levels-slider-row">
            <div className="levels-slider-header">
              <span>Чёрная точка</span><span>{cur.black}</span>
            </div>
            <input type="range" className="levels-range" min={0} max={254} value={cur.black}
              onChange={e => updateLevel('black', Number(e.target.value))} />
          </div>
          <div className="levels-slider-row">
            <div className="levels-slider-header">
              <span>Белая точка</span><span>{cur.white}</span>
            </div>
            <input type="range" className="levels-range" min={1} max={255} value={cur.white}
              onChange={e => updateLevel('white', Number(e.target.value))} />
          </div>
          <div className="levels-slider-row">
            <div className="levels-slider-header">
              <span>Гамма</span><span>{cur.gamma.toFixed(1)}</span>
            </div>
            <input type="range" className="levels-range" min={0.1} max={9.9} step={0.1} value={cur.gamma}
              onChange={e => updateLevel('gamma', Number(e.target.value))} />
          </div>
        </div>

        <div className="levels-inputs">
          <div className="levels-input-group">
            <label className="levels-input-label">Чёрная точка</label>
            <input className="levels-num-input" type="number" min={0} max={254} value={cur.black}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateLevel('black', Math.max(0, Math.min(254, v))) }} />
          </div>
          <div className="levels-input-group">
            <label className="levels-input-label">Гамма</label>
            <input className="levels-num-input" type="number" min={0.1} max={9.9} step={0.1} value={cur.gamma.toFixed(1)}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateLevel('gamma', Math.max(0.1, Math.min(9.9, v))) }} />
          </div>
          <div className="levels-input-group">
            <label className="levels-input-label">Белая точка</label>
            <input className="levels-num-input" type="number" min={1} max={255} value={cur.white}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateLevel('white', Math.max(1, Math.min(255, v))) }} />
          </div>
        </div>
      </div>

      <div className="levels-footer">
        <label className="levels-preview-label">
          <input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} />
          Предпросмотр
        </label>
        <div className="levels-footer-btns">
          <button className="levels-btn" onClick={handleReset}>Сброс</button>
          <button className="levels-btn" onClick={onCancel}>Отмена</button>
          <button className="levels-btn levels-btn-primary" onClick={handleApply} disabled={busy}>Применить</button>
        </div>
      </div>
    </div>
  )
}
