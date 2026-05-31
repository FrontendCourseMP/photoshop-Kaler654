import { useEffect } from 'react'
import './Modal.css'

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-dialog" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
