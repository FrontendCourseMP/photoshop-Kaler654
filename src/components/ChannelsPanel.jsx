import { useRef, useEffect } from 'react'
import { getChannelIds, extractChannelPreview, scaleImageData } from '../utils/colorChannels'

const CHANNEL_LABELS = {
  red: 'Красный',
  green: 'Зелёный',
  blue: 'Синий',
  alpha: 'Альфа',
  gray: 'Серый',
}

const THUMB_W = 48

function ChannelThumbnail({ bitmap, imageData, channelId, width, height }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bitmap) return
    const thumbH = Math.max(1, Math.round(THUMB_W * (height / width)))
    canvas.width = THUMB_W
    canvas.height = thumbH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingEnabled = true
    if (imageData) {
      const scaled = scaleImageData(imageData, THUMB_W, thumbH)
      const preview = channelId === 'composite' ? scaled : extractChannelPreview(scaled, channelId)
      ctx.putImageData(preview, 0, 0)
    } else {
      ctx.drawImage(bitmap, 0, 0, THUMB_W, thumbH)
      if (channelId !== 'composite') {
        const thumbData = ctx.getImageData(0, 0, THUMB_W, thumbH)
        ctx.putImageData(extractChannelPreview(thumbData, channelId), 0, 0)
      }
    }
  }, [bitmap, imageData, channelId, width, height])
  return <canvas ref={canvasRef} className="ch-thumb" />
}

function EyeIcon({ visible }) {
  return (
    <svg className="ch-eye" viewBox="0 0 16 12" fill="none">
      {visible ? (
        <>
          <path d="M1 6C3 2 13 2 15 6C13 10 3 10 1 6Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="6" r="2.2" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M1 6C3 2 13 2 15 6C13 10 3 10 1 6Z" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
          <line x1="2" y1="11" x2="14" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

export default function ChannelsPanel({ bitmap, imageData, width, height, colorDepth, activeChannels, onToggle }) {
  const channelIds = getChannelIds(colorDepth)
  const hasComposite = channelIds.length > 1
  const allActive = channelIds.every(ch => activeChannels.has(ch))
  const visibleChannels = hasComposite ? channelIds.filter(ch => ch !== 'gray') : channelIds

  return (
    <div className="channels-panel">
      {hasComposite && (
        <div
          className={`ch-row${allActive ? ' ch-active' : ''}`}
          onClick={() => onToggle('composite')}
        >
          <EyeIcon visible={allActive} />
          <div className="ch-thumb-wrap">
            <ChannelThumbnail bitmap={bitmap} imageData={imageData} channelId="composite" width={width} height={height} />
          </div>
          <span className="ch-label">Совмещённый</span>
        </div>
      )}
      {visibleChannels.map(ch => (
        <div
          key={ch}
          className={`ch-row${activeChannels.has(ch) ? ` ch-active ch-${ch}` : ''}`}
          onClick={() => onToggle(ch)}
        >
          <EyeIcon visible={activeChannels.has(ch)} />
          <div className="ch-thumb-wrap">
            <ChannelThumbnail bitmap={bitmap} imageData={imageData} channelId={ch} width={width} height={height} />
          </div>
          <span className="ch-label">{CHANNEL_LABELS[ch]}</span>
        </div>
      ))}
    </div>
  )
}
