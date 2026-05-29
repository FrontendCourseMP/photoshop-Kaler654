import { useState, useRef, useEffect, useCallback } from 'react'
import { decodeGB7, encodeGB7 } from './utils/gb7'
import { snapZoom, calcFitZoom, ZOOM_PRESETS } from './utils/zoom'
import { getChannelIds, applyChannelMask } from './utils/colorChannels'
import ChannelsPanel from './components/ChannelsPanel'
import './App.css'

function extractImageData(bitmap, width, height) {
  const tmp = document.createElement('canvas')
  tmp.width = width; tmp.height = height
  const ctx = tmp.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, width, height)
}

export default function App() {
  const [image, setImage] = useState({
    bitmap: null, data: null,
    width: null, height: null,
    colorDepth: null, fileName: null,
  })
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(100)
  const [isDragOver, setIsDragOver] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [activeChannels, setActiveChannels] = useState(new Set())

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const zoomRef = useRef(100)
  const prevZoomRef = useRef(100)

  useEffect(() => {
    const bmp = image.bitmap
    return () => { bmp?.close() }
  }, [image.bitmap])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image.bitmap) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = image.width
    canvas.height = image.height
    if (activeChannels.size === 0) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, image.width, image.height)
      return
    }
    if (image.data) {
      const available = getChannelIds(image.colorDepth)
      const masked = applyChannelMask(image.data, activeChannels, available)
      if (masked) { ctx.putImageData(masked, 0, 0); return }
    }
    ctx.drawImage(image.bitmap, 0, 0)
  }, [image, activeChannels])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const prev = prevZoomRef.current
    if (prev === zoom) return
    const ratio = zoom / prev
    const cx = el.scrollLeft + el.clientWidth / 2
    const cy = el.scrollTop + el.clientHeight / 2
    el.scrollLeft = cx * ratio - el.clientWidth / 2
    el.scrollTop = cy * ratio - el.clientHeight / 2
    prevZoomRef.current = zoom
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(z => {
        const next = snapZoom(z, e.deltaY > 0 ? 'out' : 'in')
        zoomRef.current = next
        return next
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.menubar')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const processFile = useCallback(async (file) => {
    if (!file) return
    setError(null)
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'gb7') {
      try {
        const buffer = await file.arrayBuffer()
        const { imageData, colorDepth } = decodeGB7(buffer)
        const bitmap = await createImageBitmap(imageData)
        const fitZoom = calcFitZoom(imageData.width, imageData.height)
        setActiveChannels(new Set(getChannelIds(colorDepth)))
        setImage({ bitmap, data: imageData, width: imageData.width, height: imageData.height, colorDepth, fileName: file.name })
        setZoom(fitZoom)
      } catch (e) {
        setError(e.message)
      }
      return
    }

    if (ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') {
      setError('Поддерживаются форматы PNG, JPG и GB7')
      return
    }

    try {
      const bitmap = await createImageBitmap(file)
      const { width, height } = bitmap
      const colorDepth = ext === 'jpg' || ext === 'jpeg' ? 24 : 32
      const fitZoom = calcFitZoom(width, height)
      setActiveChannels(new Set(getChannelIds(colorDepth)))
      setImage({ bitmap, data: null, width, height, colorDepth, fileName: file.name })
      setZoom(fitZoom)
    } catch {
      setError('Не удалось декодировать изображение')
    }
  }, [])

  const handleFileInput = (e) => { processFile(e.target.files[0]); e.target.value = '' }
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); processFile(e.dataTransfer.files[0]) }

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  const baseName = () => (image.fileName?.replace(/\.[^.]+$/, '') ?? 'image')

  const saveAsPNG = useCallback(() => {
    if (!image.bitmap) return
    const c = document.createElement('canvas')
    c.width = image.width; c.height = image.height
    c.getContext('2d').drawImage(image.bitmap, 0, 0)
    c.toBlob(blob => blob && downloadBlob(blob, baseName() + '.png'), 'image/png')
    setOpenMenu(null)
  }, [image])

  const saveAsJPG = useCallback(() => {
    if (!image.bitmap) return
    const c = document.createElement('canvas')
    c.width = image.width; c.height = image.height
    c.getContext('2d').drawImage(image.bitmap, 0, 0)
    c.toBlob(blob => blob && downloadBlob(blob, baseName() + '.jpg'), 'image/jpeg', 0.95)
    setOpenMenu(null)
  }, [image])

  const saveAsGB7 = useCallback(() => {
    if (!image.bitmap) return
    const pixels = image.data ?? extractImageData(image.bitmap, image.width, image.height)
    downloadBlob(new Blob([encodeGB7(pixels).buffer], { type: 'application/octet-stream' }), baseName() + '.gb7')
    setOpenMenu(null)
  }, [image])

  const toggleChannel = useCallback((channelId) => {
    const doToggle = () => {
      if (channelId === 'composite') {
        const channels = getChannelIds(image.colorDepth)
        setActiveChannels(prev => new Set(channels.every(ch => prev.has(ch)) ? [] : channels))
        return
      }
      setActiveChannels(prev => {
        const next = new Set(prev)
        next.has(channelId) ? next.delete(channelId) : next.add(channelId)
        return next
      })
    }
    if (!image.data && image.bitmap) {
      const data = extractImageData(image.bitmap, image.width, image.height)
      setImage(prev => ({ ...prev, data }))
    }
    doToggle()
  }, [image])

  const hasImage = !!image.bitmap
  const scale = zoom / 100
  const zoomOptions = ZOOM_PRESETS.includes(zoom) ? ZOOM_PRESETS : [...ZOOM_PRESETS, zoom].sort((a, b) => a - b)

  return (
    <div className="app">
      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.gb7" onChange={handleFileInput} style={{ display: 'none' }} />

      <nav className="menubar">
        <div className="menu-item">
          <button className={`menu-btn${openMenu === 'file' ? ' active' : ''}`} onClick={() => setOpenMenu(v => v === 'file' ? null : 'file')}>
            Файл
          </button>
          {openMenu === 'file' && (
            <div className="dropdown">
              <button className="dd-item" onClick={() => { fileInputRef.current.click(); setOpenMenu(null) }}>Открыть…</button>
              <div className="dd-sep" />
              <button className="dd-item" disabled={!hasImage} onClick={saveAsPNG}>Сохранить как PNG</button>
              <button className="dd-item" disabled={!hasImage} onClick={saveAsJPG}>Сохранить как JPG</button>
              <button className="dd-item" disabled={!hasImage} onClick={saveAsGB7}>Сохранить как GB7</button>
            </div>
          )}
        </div>
      </nav>

      <div className="workspace">
        <div
          className={`canvas-area${isDragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }}
          onDrop={handleDrop}
        >
          {error && <div className="error-toast">{error}</div>}
          <div className="canvas-scroll" ref={scrollRef}>
            {hasImage ? (
              <div className="canvas-wrapper" style={{ width: image.width * scale, height: image.height * scale }}>
                <canvas ref={canvasRef} style={{ width: image.width * scale, height: image.height * scale }} />
              </div>
            ) : (
              <div className="empty-state" onClick={() => fileInputRef.current.click()}>
                <svg className="empty-icon" viewBox="0 0 64 64" fill="none">
                  <rect x="8" y="10" width="48" height="40" rx="2" stroke="#5a5a5a" strokeWidth="1.5"/>
                  <path d="M8 38l14-14 10 10 8-8 16 14" stroke="#5a5a5a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="22" cy="24" r="4" stroke="#5a5a5a" strokeWidth="1.5"/>
                </svg>
                <p className="empty-title">Изображение не открыто</p>
                <p className="empty-hint">Перетащите файл сюда или используйте <strong>Файл → Открыть</strong></p>
                <p className="empty-formats">PNG · JPG · GB7</p>
              </div>
            )}
          </div>
          {isDragOver && (
            <div className="drop-overlay"><p>Отпустите для открытия</p></div>
          )}
        </div>

        {hasImage && (
          <aside className="right-panel">
            <div className="panel-section">
              <div className="panel-header">Каналы</div>
              <ChannelsPanel
                bitmap={image.bitmap}
                width={image.width}
                height={image.height}
                colorDepth={image.colorDepth}
                activeChannels={activeChannels}
                onToggle={toggleChannel}
              />
            </div>
          </aside>
        )}
      </div>

      <footer className="statusbar">
        <div className="status-left">
          {hasImage ? (
            <>
              <span className="status-item">{image.fileName}</span>
              <span className="status-sep">|</span>
              <span className="status-item">{image.width} × {image.height} пкс</span>
              <span className="status-sep">|</span>
              <span className="status-item">{image.colorDepth} бит</span>
            </>
          ) : (
            <span className="status-hint">Откройте изображение для начала работы</span>
          )}
        </div>
        <div className="status-right">
          <select className="zoom-select" value={zoom} onChange={e => setZoom(Number(e.target.value))}>
            {zoomOptions.map(z => <option key={z} value={z}>{z}%</option>)}
          </select>
        </div>
      </footer>
    </div>
  )
}
