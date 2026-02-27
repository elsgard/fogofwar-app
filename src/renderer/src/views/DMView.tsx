import { useState, useRef, useEffect } from 'react'
import { MapCanvas } from '../components/MapCanvas'
import type { MapCanvasHandle } from '../components/MapCanvas'
import { useGameStore } from '../store/gameStore'
import type { Token, TokenStatus } from '../types'

const TOKEN_COLORS = [
  '#4a9eff', // blue
  '#4caf50', // green
  '#00897b', // teal
  '#e53935', // red
  '#ff5252', // bright red
  '#ff9800', // orange
  '#f59e0b', // amber
  '#ffeb3b', // yellow
  '#9c27b0', // purple
  '#7e57c2', // indigo
  '#e91e63', // pink
  '#00bcd4', // cyan
  '#ffffff', // white
  '#9e9e9e', // grey
]

const TYPE_DEFAULT_COLORS: Record<Token['type'], string> = {
  player: '#4a9eff',
  npc: '#f59e0b',
  enemy: '#e53935',
}

export function DMView(): React.JSX.Element {
  const mapCanvasRef = useRef<MapCanvasHandle>(null)
  const menubarRef = useRef<HTMLElement>(null)
  const [openMenu, setOpenMenu] = useState<'session' | 'map' | 'player' | null>(null)

  const {
    map,
    tokens,
    activeTool,
    brushRadius,
    tokenRadius,
    tokenLabelSize,
    tokenLabelVisible,
    selectedTokenId,
    isDirty,
    loadMap,
    resetFog,
    addToken,
    removeToken,
    updateToken,
    setActiveTool,
    setBrushRadius,
    setTokenRadius,
    setTokenLabelSize,
    setTokenLabelVisible,
    setSelectedTokenId,
    setPlayerViewport,
    saveScene,
    loadScene,
  } = useGameStore()

  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenType, setNewTokenType] = useState<Token['type']>('player')
  const [newTokenColor, setNewTokenColor] = useState(TYPE_DEFAULT_COLORS.player)

  // Close dropdown when clicking outside the menu bar
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: MouseEvent): void => {
      if (!menubarRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  function toggleMenu(id: typeof openMenu): void {
    setOpenMenu((prev) => (prev === id ? null : id))
  }

  function handleTypeChange(type: Token['type']): void {
    setNewTokenType(type)
    setNewTokenColor(TYPE_DEFAULT_COLORS[type])
  }

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  function handleAddToken(): void {
    if (!map || !newTokenLabel.trim()) return
    addToken({
      type: newTokenType,
      label: newTokenLabel.trim(),
      color: newTokenColor,
      x: map.width / 2,
      y: map.height / 2,
      visibleToPlayers: true,
    })
    setNewTokenLabel('')
  }

  function handleToggleVisibility(token: Token): void {
    updateToken({ ...token, visibleToPlayers: !token.visibleToPlayers })
  }

  const STATUS_CYCLE: Record<TokenStatus, TokenStatus> = {
    alive: 'dsa',
    dsa: 'dead',
    dead: 'alive',
  }

  const STATUS_ICON: Record<TokenStatus, string> = {
    alive: '♥',
    dsa: '⚠',
    dead: '☠',
  }

  function handleCycleStatus(token: Token): void {
    const current: TokenStatus = token.status ?? 'alive'
    updateToken({ ...token, status: STATUS_CYCLE[current] })
  }

  return (
    <div className="dm-view">

      {/* ── Menu bar ── */}
      <nav className="menubar" ref={menubarRef}>
        <span className="menubar-title">Fog of War</span>

        {/* Session menu */}
        <div className="menu-item">
          <button
            className={`menu-trigger ${openMenu === 'session' ? 'open' : ''}`}
            onClick={() => toggleMenu('session')}
          >
            Session
            {isDirty && <span className="dirty-indicator"> ●</span>}
            {' '}▾
          </button>
          {openMenu === 'session' && (
            <div className="menu-dropdown">
              <button className="menu-dropdown-item" onClick={() => { saveScene(); setOpenMenu(null) }}>
                Save…
              </button>
              <button className="menu-dropdown-item" onClick={() => { loadScene(); setOpenMenu(null) }}>
                Load…
              </button>
            </div>
          )}
        </div>

        {/* Map menu */}
        <div className="menu-item">
          <button
            className={`menu-trigger ${openMenu === 'map' ? 'open' : ''}`}
            onClick={() => toggleMenu('map')}
          >
            Map ▾
          </button>
          {openMenu === 'map' && (
            <div className="menu-dropdown">
              <button className="menu-dropdown-item" onClick={() => { loadMap(); setOpenMenu(null) }}>
                {map ? 'Change Map…' : 'Load Map…'}
              </button>
              {map && (
                <>
                  <div className="menu-dropdown-divider" />
                  <span className="menu-dropdown-label">{map.name}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Player menu */}
        <div className="menu-item">
          <button
            className={`menu-trigger ${openMenu === 'player' ? 'open' : ''}`}
            onClick={() => toggleMenu('player')}
          >
            Player ▾
          </button>
          {openMenu === 'player' && (
            <div className="menu-dropdown">
              <button
                className="menu-dropdown-item"
                onClick={() => { window.api.openPlayerWindow(); setOpenMenu(null) }}
              >
                Open Player Window
              </button>
              <button
                className="menu-dropdown-item"
                onClick={() => { window.open(`${window.location.origin}?role=player`); setOpenMenu(null) }}
              >
                Open in Browser
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Left sidebar ── */}
      <aside className="sidebar">

        {/* Tools + Tokens + Viewport (only when map loaded) */}
        {map && (
          <>
            <section className="sidebar-section">
              <h3>Tools</h3>
              <div className="tool-grid">
                {(
                  [
                    { id: 'fog-reveal', label: 'Reveal Fog' },
                    { id: 'fog-hide', label: 'Hide Fog' },
                    { id: 'token-move', label: 'Move Token' },
                    { id: 'pan', label: 'Pan / Zoom' },
                  ] as const
                ).map((tool) => (
                  <button
                    key={tool.id}
                    className={`btn ${activeTool === tool.id ? 'btn-active' : 'btn-secondary'}`}
                    onClick={() => setActiveTool(tool.id)}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              {(activeTool === 'fog-reveal' || activeTool === 'fog-hide') && (
                <label className="brush-label">
                  Brush size: {brushRadius}px
                  <input
                    type="range"
                    min={10}
                    max={300}
                    value={brushRadius}
                    onChange={(e) => setBrushRadius(Number(e.target.value))}
                  />
                </label>
              )}

              <button className="btn btn-danger" onClick={resetFog}>
                Reset Fog
              </button>
            </section>

            {/* Tokens section */}
            <section className="sidebar-section">
              <h3>Tokens</h3>
              <label className="brush-label">
                Token size: {tokenRadius}px
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={tokenRadius}
                  onChange={(e) => setTokenRadius(Number(e.target.value))}
                />
              </label>
              <label className="brush-label">
                Label size: {tokenLabelSize}px
                <input
                  type="range"
                  min={8}
                  max={36}
                  value={tokenLabelSize}
                  onChange={(e) => setTokenLabelSize(Number(e.target.value))}
                />
              </label>
              <label className="token-label-toggle">
                <input
                  type="checkbox"
                  checked={tokenLabelVisible}
                  onChange={(e) => setTokenLabelVisible(e.target.checked)}
                />
                Show labels
              </label>
              <div className="token-form">
                <input
                  type="text"
                  placeholder="Label…"
                  value={newTokenLabel}
                  onChange={(e) => setNewTokenLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddToken()}
                />
                <div className="token-type-radios">
                  {(['player', 'npc', 'enemy'] as const).map((type) => (
                    <label
                      key={type}
                      className={`token-type-radio ${newTokenType === type ? 'token-type-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="token-type"
                        value={type}
                        checked={newTokenType === type}
                        onChange={() => handleTypeChange(type)}
                      />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  ))}
                </div>
                <div className="color-swatches">
                  {TOKEN_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${newTokenColor === c ? 'swatch-active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewTokenColor(c)}
                    />
                  ))}
                  <label
                    className={`swatch swatch-picker ${!TOKEN_COLORS.includes(newTokenColor) ? 'swatch-active' : ''}`}
                    style={TOKEN_COLORS.includes(newTokenColor) ? undefined : { background: newTokenColor }}
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={newTokenColor}
                      onChange={(e) => setNewTokenColor(e.target.value)}
                    />
                  </label>
                </div>
                <button className="btn btn-primary" onClick={handleAddToken} disabled={!newTokenLabel.trim()}>
                  Add Token
                </button>
              </div>

              <ul className="token-list">
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className={`token-item ${selectedTokenId === token.id ? 'token-selected' : ''}`}
                    onClick={() => setSelectedTokenId(token.id === selectedTokenId ? null : token.id)}
                  >
                    <span
                      className="token-dot"
                      style={{ background: token.color }}
                    />
                    <span className="token-label">{token.label}</span>
                    <span className="token-type">{token.type}</span>
                    <button
                      className={`btn-icon status-${token.status ?? 'alive'}`}
                      title={`Status: ${token.status ?? 'alive'} (click to cycle)`}
                      onClick={(e) => { e.stopPropagation(); handleCycleStatus(token) }}
                    >
                      {STATUS_ICON[token.status ?? 'alive']}
                    </button>
                    <button
                      className={`btn-icon ${token.visibleToPlayers ? 'visible' : 'hidden'}`}
                      title={token.visibleToPlayers ? 'Visible to players' : 'Hidden from players'}
                      onClick={(e) => { e.stopPropagation(); handleToggleVisibility(token) }}
                    >
                      {token.visibleToPlayers ? '👁' : '🚫'}
                    </button>
                    <button
                      className="btn-icon remove"
                      title="Remove token"
                      onClick={(e) => { e.stopPropagation(); removeToken(token.id) }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Player viewport push/reset */}
            <section className="sidebar-section">
              <h3>Player View</h3>
              <div className="session-buttons">
                <button
                  className="btn btn-primary"
                  title="Push your current pan/zoom to the player view"
                  onClick={() => {
                    const vp = mapCanvasRef.current?.getCurrentViewport() ?? null
                    setPlayerViewport(vp)
                  }}
                >
                  Push View →
                </button>
                <button
                  className="btn btn-secondary"
                  title="Reset player view to auto-fit"
                  onClick={() => setPlayerViewport(null)}
                >
                  Reset View
                </button>
              </div>
            </section>
          </>
        )}

        {selectedToken && (
          <section className="sidebar-section">
            <h3>Selected: {selectedToken.label}</h3>
            <p className="hint">Drag the token on the map to move it.</p>
            <p className="hint">Type: {selectedToken.type}</p>
            <p className="hint">
              Position: ({Math.round(selectedToken.x)}, {Math.round(selectedToken.y)})
            </p>
          </section>
        )}
      </aside>

      {/* ── Map canvas (fills the whole window behind the sidebar) ── */}
      <div className="canvas-area">
        {map ? (
          <MapCanvas ref={mapCanvasRef} isPlayerView={false} />
        ) : (
          <div className="empty-state">
            <p>Load a map to get started.</p>
            <button className="btn btn-primary btn-large" onClick={loadMap}>
              Load Map…
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
