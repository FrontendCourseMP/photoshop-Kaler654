import { useState, useEffect, useRef, useCallback } from 'react'
import { KERNEL_PRESETS } from '../utils/convolution'
import { KernelPreviewWorker, applyKernelInWorker } from '../utils/convolutionWorker'
import './KernelDialog.css'

const ALL_CHANNELS = ['r', 'g', 'b', 'a']
const CHANNEL_LABELS = { gray: 'Серый', r: 'R', g: 'G', b: 'B', a: 'A' }
const EDGE_LABELS = { black: 'Чёрный', white: 'Белый', copy: 'Копирование' }

function getAvailableChannels(colorDepth) {
  if (!colorDepth) return ['r', 'g', 'b']
  if (colorDepth === 7) return ['gray']
  if (colorDepth === 8) return ['gray', 'a']
  if (colorDepth === 32) return ALL_CHANNELS
  return ['r', 'g', 'b']
}

// GB7 'gray' maps to all three rgb channels in the worker
function expandChannels(channels) {
  const out = []
  for (const c of channels) {
    if (c === 'gray') out.push('r', 'g', 'b')
    else out.push(c)
  }
  return out
}

const DEFAULT_KERNEL = [...KERNEL_PRESETS[0].values]

export default function KernelDialog({ isOpen, imageData, colorDepth, canvasRef, onApply, onCancel }) {
  const [kernel, setKernel] = useState(DEFAULT_KERNEL)
  const [selectedChannels, setSelectedChannels] = useState(new Set(getAvailableChannels(colorDepth)))
  const [edge, setEdge] = useState('black')
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [presetIndex, setPresetIndex] = useState(0)

  const [pos, setPos] = useState(() => ({
    x: Math.round(window.innerWidth / 2 - 215),
    y: Math.round(window.innerHeight / 2 - 230),
  }))
  const dragStart = useRef(null)
  const workerRef = useRef(null)

  const availableChannels = getAvailableChannels(colorDepth)

  useEffect(() => {
    if (!isOpen) {
      workerRef.current?.terminate()
      workerRef.current = null
      return
    }
    setSelectedChannels(new Set(getAvailableChannels(colorDepth)))
    setKernel(DEFAULT_KERNEL); setPresetIndex(0); setEdge('black')
    setPreviewEnabled(false); setIsApplying(false)
    if (imageData) {
      workerRef.current?.terminate()
      workerRef.current = new KernelPreviewWorker(imageData)
    }
    return () => { workerRef.current?.terminate(); workerRef.current = null }
  }, [isOpen, imageData])

  useEffect(() => {
    if (isOpen && imageData && !workerRef.current) {
      workerRef.current = new KernelPreviewWorker(imageData)
    }
  }, [isOpen, imageData])

  const triggerPreview = useCallback((k, chans, e) => {
    if (!workerRef.current || !canvasRef.current) return
    const selected = availableChannels.filter(c => chans.has(c))
    if (selected.length === 0) return
    const channels = expandChannels(selected)
    workerRef.current.compute(k, channels, e).then(result => {
      const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      createImageBitmap(result).then(bmp => { ctx.drawImage(bmp, 0, 0); bmp.close() })
    })
  }, [canvasRef, availableChannels])

  const restoreCanvas = useCallback(() => {
    if (!canvasRef.current || !imageData) return
    createImageBitmap(imageData).then(bmp => {
      canvasRef.current?.getContext('2d', { willReadFrequently: true })?.drawImage(bmp, 0, 0)
      bmp.close()
    })
  }, [canvasRef, imageData])

  const handlePreviewToggle = (enabled) => {
    setPreviewEnabled(enabled)
    if (enabled) triggerPreview(kernel, selectedChannels, edge)
    else restoreCanvas()
  }

  const handleKernelChange = (idx, raw) => {
    const v = parseFloat(raw)
    const next = [...kernel]
    next[idx] = isNaN(v) ? 0 : v
    setKernel(next)
    setPresetIndex(-1)
    if (previewEnabled) triggerPreview(next, selectedChannels, edge)
  }

  const handlePresetChange = (i) => {
    setPresetIndex(i)
    const next = [...KERNEL_PRESETS[i].values]
    setKernel(next)
    if (previewEnabled) triggerPreview(next, selectedChannels, edge)
  }

  const handleChannelToggle = (ch) => {
    setSelectedChannels(prev => {
      const next = new Set(prev)
      if (next.has(ch)) {
        if (next.size === 1) return prev
        next.delete(ch)
      } else {
        next.add(ch)
      }
      if (previewEnabled) triggerPreview(kernel, next, edge)
      return next
    })
  }

  const handleEdgeChange = (e) => {
    setEdge(e)
    if (previewEnabled) triggerPreview(kernel, selectedChannels, e)
  }

  const handleReset = () => {
    const next = [...KERNEL_PRESETS[0].values]
    const defaultChans = new Set(availableChannels)
    setKernel(next); setPresetIndex(0)
    setSelectedChannels(defaultChans); setEdge('black')
    if (previewEnabled) triggerPreview(next, defaultChans, 'black')
  }

  const handleApply = async () => {
    if (!imageData) return
    const selected = availableChannels.filter(c => selectedChannels.has(c))
    if (selected.length === 0) return
    const channels = expandChannels(selected)
    setIsApplying(true)
    try {
      const result = await applyKernelInWorker(imageData, kernel, channels, edge)
      onApply(result)
    } finally {
      setIsApplying(false)
    }
  }

  const handleCancel = () => {
    if (previewEnabled) restoreCanvas()
    onCancel()
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

  const isBusy = !imageData || isApplying
  const title = !imageData ? 'Фильтр ядра — загрузка...' : isApplying ? 'Фильтр ядра — применение...' : 'Фильтр ядра'

  return (
    <div className="kd-dialog" style={{ left: pos.x, top: pos.y }}>
      <div className="kd-titlebar" onMouseDown={handleTitleMouseDown}>
        <span>{title}</span>
        <button className="kd-close" onMouseDown={e => e.stopPropagation()} onClick={handleCancel}>✕</button>
      </div>

      <div className="kd-body">
        <div className="kd-row">
          <label className="kd-label">Предустановка:</label>
          <select className="kd-select" value={presetIndex} onChange={e => handlePresetChange(Number(e.target.value))} disabled={isBusy}>
            {KERNEL_PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
            {presetIndex === -1 && <option value={-1}>Пользовательское</option>}
          </select>
        </div>

        <div className="kd-section">
          <span className="kd-section-title">Ядро свёртки (3×3)</span>
          <div className="kd-kernel-grid">
            {kernel.map((v, i) => (
              <input
                key={i}
                type="number"
                className="kd-kernel-input"
                value={v}
                step="any"
                disabled={isBusy}
                onChange={e => handleKernelChange(i, e.target.value)}
              />
            ))}
          </div>
        </div>

        <div className="kd-section">
          <span className="kd-section-title">Каналы</span>
          <div className="kd-check-group">
            {availableChannels.map(ch => (
              <label key={ch} className="kd-check-label">
                <input type="checkbox" checked={selectedChannels.has(ch)} disabled={isBusy} onChange={() => handleChannelToggle(ch)} />
                {CHANNEL_LABELS[ch]}
              </label>
            ))}
          </div>
        </div>

        <div className="kd-section">
          <span className="kd-section-title">Обработка краёв</span>
          <div className="kd-radio-group">
            {['black', 'white', 'copy'].map(e => (
              <label key={e} className="kd-radio-label">
                <input type="radio" name="kd-edge" value={e} checked={edge === e} disabled={isBusy} onChange={() => handleEdgeChange(e)} />
                {EDGE_LABELS[e]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="kd-footer">
        <label className="kd-preview-label">
          <input type="checkbox" checked={previewEnabled} disabled={isBusy} onChange={e => handlePreviewToggle(e.target.checked)} />
          Предпросмотр
        </label>
        <div className="kd-footer-btns">
          <button className="kd-btn" onClick={handleReset} disabled={isBusy}>Сброс</button>
          <button className="kd-btn" onClick={handleCancel} disabled={isApplying}>Отмена</button>
          <button className="kd-btn kd-btn-primary" onClick={handleApply} disabled={isBusy}>Применить</button>
        </div>
      </div>
    </div>
  )
}
