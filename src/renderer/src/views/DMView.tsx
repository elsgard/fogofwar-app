import { useState } from 'react'
import { MapCanvas } from '../components/MapCanvas'
import { useGameStore } from '../store/gameStore'
import type { Token } from '../types'

const TOKEN_COLORS = ['#4a9eff', '#4caf50', '#e53935', '#ff9800', '#9c27b0', '#00bcd4']

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
  } = useGameStore()

  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenType, setNewTokenType] = useState<Token['type']>('player')
  const [newTokenColor, setNewTokenColor] = useState(TOKEN_COLORS[0])

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

  return (
    <div className="dm-view">
      {/* ── Left sidebar ── */}
      <aside className="sidebar">
        <h2 className="sidebar-title">Fog of War</h2>

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
                <div className="token-form-row">
                  <select
                    value={newTokenType}
                    onChange={(e) => setNewTokenType(e.target.value as Token['type'])}
                  >
                    <option value="player">Player</option>
                    <option value="npc">NPC</option>
                    <option value="enemy">Enemy</option>
                  </select>
                  <div className="color-swatches">
                    {TOKEN_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`swatch ${newTokenColor === c ? 'swatch-active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setNewTokenColor(c)}
                      />
                    ))}
                  </div>
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
