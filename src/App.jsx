import './App.css'

function App() {
  return (
    <div className="app">
      <div className="toolbar">
        <div className="toolbar-icon" title="Move">V</div>
        <div className="toolbar-icon" title="Marquee">M</div>
        <div className="toolbar-icon" title="Lasso">L</div>
        <div className="toolbar-icon" title="Crop">C</div>
        <div className="toolbar-icon" title="Brush">B</div>
        <div className="toolbar-icon" title="Eraser">E</div>
        <div className="toolbar-icon" title="Text">T</div>
        <div className="toolbar-icon" title="Zoom">Z</div>
      </div>

      <div className="main">
        <div className="menubar">
          {['File', 'Edit', 'Image', 'Layer', 'Select', 'Filter', 'View', 'Help'].map(item => (
            <span key={item} className="menu-item">{item}</span>
          ))}
        </div>

        <div className="workspace">
          <div className="canvas-area">
            <div className="canvas-placeholder">
              <span>Open an image to start</span>
            </div>
          </div>

          <div className="panels">
            <div className="panel">
              <div className="panel-header">Layers</div>
              <div className="panel-body">
                <div className="layer active">Background</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">Properties</div>
              <div className="panel-body">
                <div className="prop-row"><span>W:</span><span>—</span></div>
                <div className="prop-row"><span>H:</span><span>—</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="statusbar">
          <span>Ready</span>
          <span>Width: — &nbsp;|&nbsp; Height: — &nbsp;|&nbsp; Color Depth: —</span>
        </div>
      </div>
    </div>
  )
}

export default App
