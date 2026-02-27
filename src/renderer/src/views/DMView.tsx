import { useState } from 'react'
import { MapCanvas } from '../components/MapCanvas'
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
    saveScene,
    loadScene,
  } = useGameStore()

  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenType, setNewTokenType] = useState<Token['type']>('player')
  const [newTokenColor, setNewTokenColor] = useState(TYPE_DEFAULT_COLORS.player)

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
      {/* ── Left sidebar ── */}
      <aside className="sidebar">
        <h2 className="sidebar-title">Fog of War</h2>

        {/* Session section */}
        <section className="sidebar-section">
          <h3>
            Session
            {isDirty && <span className="dirty-indicator" title="Unsaved changes"> ●</span>}
          </h3>
          <div className="session-buttons">
            <button className="btn btn-primary" onClick={saveScene}>
              Save…
            </button>
            <button className="btn btn-secondary" onClick={loadScene}>
              Load…
            </button>
          </div>
        </section>

        {/* Map section */}
        <section className="sidebar-section">
          <h3>Map</h3>
          <button className="btn btn-primary" onClick={loadMap}>
            {map ? 'Change Map…' : 'Load Map…'}
          </button>
          {map && <p className="map-name">{map.name}</p>}
        </section>

        {/* Tools section */}
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
          </>
        )}

        {/* Player window */}
        <section className="sidebar-section">
          <h3>Player View</h3>
          <button
            className="btn btn-primary"
            onClick={() => window.api.openPlayerWindow()}
          >
            Open Player Window
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => window.open(`${window.location.origin}?role=player`)}
          >
            Open in Browser
          </button>
        </section>

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
          <MapCanvas isPlayerView={false} />
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
