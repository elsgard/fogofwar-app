import { useState, useRef, useEffect } from 'react'
import { MapCanvas } from '../components/MapCanvas'
import type { MapCanvasHandle } from '../components/MapCanvas'
import { BattlePanel } from './BattlePanel'
import { HelpModal } from '../components/HelpModal'
import { ExportPartyDialog } from '../components/ExportPartyDialog'
import { MonsterSearchModal } from '../components/MonsterSearchModal'
import { CharacterSheetModal } from '../components/CharacterSheetModal'
import { useGameStore } from '../store/gameStore'
import type { Token, TokenStatus, MonsterSheet } from '../types'
import type { MonsterEntry } from '../types/monster'
import { entryToSheet } from '../types/monster'

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

const TOOL_CYCLE = ['select', 'fog-reveal', 'fog-hide', 'token-move', 'pan', 'laser'] as const

const DOCK_TOOLS = [
  { id: 'select',     label: 'Select', icon: '⊹', key: 'V' },
  { id: 'fog-reveal', label: 'Reveal', icon: '◐', key: 'R' },
  { id: 'fog-hide',   label: 'Hide',   icon: '◑', key: 'H' },
  { id: 'token-move', label: 'Move',   icon: '✥', key: 'T' },
  { id: 'pan',        label: 'Pan',    icon: '⤢', key: 'P' },
  { id: 'laser',      label: 'Laser',  icon: '✦', key: 'L' },
] as const

const LASER_COLORS = ['#ff2222', '#ff9800', '#ffeb3b', '#4caf50', '#4a9eff', '#ffffff']

export function DMView(): React.JSX.Element {
  const mapCanvasRef = useRef<MapCanvasHandle>(null)
  const menubarRef = useRef<HTMLElement>(null)
  const monsterFileRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const dockVisibleRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dockVisible, setDockVisible] = useState(false)
  const [openMenu, setOpenMenu] = useState<'session' | 'map' | 'player' | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showBattlePanel, setShowBattlePanel] = useState(false)
  const [showExportPartyDialog, setShowExportPartyDialog] = useState(false)
  const [showMonsterSearch, setShowMonsterSearch] = useState(false)
  const [viewSheet, setViewSheet] = useState<MonsterSheet | null>(null)

  const {
    map,
    tokens,
    battle,
    activeTool,
    brushRadius,
    tokenRadius,
    tokenLabelSize,
    tokenLabelVisible,
    selectedTokenId,
    laserRadius,
    laserColor,
    isDirty,
    monsters,
    loadMap,
    resetFog,
    revealAllFog,
    addToken,
    removeToken,
    updateToken,
    setActiveTool,
    setBrushRadius,
    setTokenRadius,
    setTokenLabelSize,
    setTokenLabelVisible,
    tokenLabelHiddenTypes,
    setTokenLabelHiddenTypes,
    setSelectedTokenId,
    setLaserRadius,
    setLaserColor,
    setPlayerViewport,
    setMonsters,
    monsterReveal,
    setMonsterReveal,
    saveScene,
    loadScene,
    saveParty,
    loadParty,
  } = useGameStore()

  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenType, setNewTokenType] = useState<Token['type']>('player')
  const [newTokenColor, setNewTokenColor] = useState(TYPE_DEFAULT_COLORS.player)
  const [newTokenHp, setNewTokenHp] = useState('')
  const [newTokenHpMax, setNewTokenHpMax] = useState('')
  const [newTokenAc, setNewTokenAc] = useState('')
  const [pendingMonsterEntry, setPendingMonsterEntry] = useState<MonsterEntry | null>(null)

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  // Edit state for selected token
  const [editLabel, setEditLabel] = useState('')
  const [editType, setEditType] = useState<Token['type']>('player')
  const [editColor, setEditColor] = useState(TYPE_DEFAULT_COLORS.player)
  const [editHp, setEditHp] = useState('')
  const [editHpMax, setEditHpMax] = useState('')
  const [editAc, setEditAc] = useState('')

  // Auto-clear monster reveal when the character sheet modal is closed
  useEffect(() => {
    if (!viewSheet && monsterReveal) setMonsterReveal(null)
  }, [viewSheet])

  // Sync edit fields when a different token is selected
  useEffect(() => {
    if (!selectedToken) return
    setEditLabel(selectedToken.label)
    setEditType(selectedToken.type)
    setEditColor(selectedToken.color)
    setEditHp(selectedToken.hp != null ? String(selectedToken.hp) : '')
    setEditHpMax(selectedToken.hpMax != null ? String(selectedToken.hpMax) : '')
    setEditAc(selectedToken.ac != null ? String(selectedToken.ac) : '')
  }, [selectedToken?.id])

  // Tool keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F1') { e.preventDefault(); setShowHelp(true); return }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      let switched = true
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break
        case 'r': setActiveTool('fog-reveal'); break
        case 'h': setActiveTool('fog-hide'); break
        case 't': setActiveTool('token-move'); break
        case 'p': setActiveTool('pan'); break
        case 'l': setActiveTool('laser'); break
        case 'tab': {
          e.preventDefault()
          const idx = TOOL_CYCLE.indexOf(activeTool as typeof TOOL_CYCLE[number])
          setActiveTool(TOOL_CYCLE[(idx + 1) % TOOL_CYCLE.length])
          break
        }
        default: switched = false
      }
      if (switched) { showDock(); scheduleDockHide() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTool, setActiveTool])

  // Close dropdown when clicking outside the menu bar
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: MouseEvent): void => {
      if (!menubarRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  // Dock auto-show/hide: appear when near bottom, hide 1s after leaving
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      // Use a larger threshold when dock is visible to keep it shown while using popovers
      const threshold = dockVisibleRef.current ? 220 : 60
      if (e.clientY > window.innerHeight - threshold) {
        showDock()
      } else if (hideTimerRef.current === null) {
        scheduleDockHide()
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  function showDock(): void {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    dockVisibleRef.current = true
    setDockVisible(true)
  }

  function scheduleDockHide(): void {
    hideTimerRef.current = setTimeout(() => {
      dockVisibleRef.current = false
      setDockVisible(false)
      hideTimerRef.current = null
    }, 1000)
  }

  function toggleMenu(id: typeof openMenu): void {
    setOpenMenu((prev) => (prev === id ? null : id))
  }

  function handleTypeChange(type: Token['type']): void {
    setNewTokenType(type)
    setNewTokenColor(TYPE_DEFAULT_COLORS[type])
  }

  function handleMonsterFileLoad(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data)) {
          setMonsters(data as MonsterEntry[])
        } else {
          alert('Invalid monster database format. Expected a JSON array.')
        }
      } catch {
        alert('Failed to parse monster database JSON.')
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be reloaded
    if (monsterFileRef.current) monsterFileRef.current.value = ''
  }

  function handleMonsterSelect(entry: MonsterEntry): void {
    setNewTokenLabel(entry.name)
    setNewTokenHp(entry.maxHitPoints != null ? String(entry.maxHitPoints) : '')
    setNewTokenHpMax(entry.maxHitPoints != null ? String(entry.maxHitPoints) : '')
    setNewTokenAc(entry.ac != null ? String(entry.ac) : '')
    setNewTokenType('enemy')
    setNewTokenColor(TYPE_DEFAULT_COLORS.enemy)
    setPendingMonsterEntry(entry)
  }

  function handleAddToken(): void {
    if (!map || !newTokenLabel.trim()) return
    addToken({
      type: newTokenType,
      label: newTokenLabel.trim(),
      color: newTokenColor,
      x: map.width / 2,
      y: map.height / 2,
      visibleToPlayers: true,
      hp: newTokenHp.trim() ? parseInt(newTokenHp, 10) : null,
      hpMax: newTokenHpMax.trim() ? parseInt(newTokenHpMax, 10) : null,
      ac: newTokenAc.trim() ? parseInt(newTokenAc, 10) : null,
      monsterSheet: pendingMonsterEntry ? entryToSheet(pendingMonsterEntry) : null,
    })
    setNewTokenLabel('')
    setNewTokenHp('')
    setNewTokenHpMax('')
    setNewTokenAc('')
    setPendingMonsterEntry(null)
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

  function handleCopyToken(token: Token): void {
    // Strip trailing number to get the base name (e.g. "Goblin 3" → "Goblin")
    const base = token.label.replace(/ \d+$/, '').trimEnd()
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( (\\d+))?$`)
    const maxN = tokens.reduce((max, t) => {
      const m = t.label.match(re)
      if (!m) return max
      return Math.max(max, m[2] ? parseInt(m[2], 10) : 1)
    }, 0)
    addToken({
      type: token.type,
      label: `${base} ${maxN + 1}`,
      color: token.color,
      x: token.x + 40,
      y: token.y + 40,
      visibleToPlayers: token.visibleToPlayers,
      status: token.status,
      hp: token.hp ?? null,
      hpMax: token.hpMax ?? null,
      ac: token.ac ?? null,
      monsterSheet: token.monsterSheet ?? null,
    })
  }

  function saveEditStats(): void {
    if (!selectedToken) return
    updateToken({
      ...selectedToken,
      hp: editHp.trim() ? parseInt(editHp, 10) : null,
      hpMax: editHpMax.trim() ? parseInt(editHpMax, 10) : null,
      ac: editAc.trim() ? parseInt(editAc, 10) : null,
    })
  }

  return (
    <div className="dm-view">

      {/* Hidden file input for monster database */}
      <input
        ref={monsterFileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleMonsterFileLoad}
      />

      {/* ── Menu bar ── */}
      <nav className="menubar" ref={menubarRef} onClick={() => setOpenMenu(null)}>
        <span className="menubar-title">Fog of War</span>

        {/* Session menu */}
        <div className="menu-item" onClick={(e) => e.stopPropagation()}>
          <button
            className={`menu-trigger ${openMenu === 'session' ? 'open' : ''}`}
            onClick={() => toggleMenu('session')}
            onMouseEnter={() => { if (openMenu !== null) setOpenMenu('session') }}
          >
            Session
            {isDirty && <span className="dirty-indicator"> ●</span>}
            {' '}▾
          </button>
          {openMenu === 'session' && (
            <div className="menu-dropdown">
              <button className="menu-dropdown-item" onClick={() => { saveScene(); setOpenMenu(null) }}>
                Save Scene…
              </button>
              <button className="menu-dropdown-item" onClick={() => { loadScene(); setOpenMenu(null) }}>
                Load Scene…
              </button>
              <div className="menu-dropdown-divider" />
              <button className="menu-dropdown-item" onClick={() => { setShowExportPartyDialog(true); setOpenMenu(null) }}>
                Export Party…
              </button>
              <button className="menu-dropdown-item" onClick={() => { loadParty(); setOpenMenu(null) }}>
                Import Party…
              </button>
              <div className="menu-dropdown-divider" />
              <button className="menu-dropdown-item" onClick={() => { monsterFileRef.current?.click(); setOpenMenu(null) }}>
                {monsters ? `Reload Monster DB… (${monsters.length})` : 'Load Monster DB…'}
              </button>
              {monsters && (
                <button className="menu-dropdown-item" onClick={() => { setMonsters(null); setOpenMenu(null) }}>
                  Unload Monster DB
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map menu */}
        <div className="menu-item" onClick={(e) => e.stopPropagation()}>
          <button
            className={`menu-trigger ${openMenu === 'map' ? 'open' : ''}`}
            onClick={() => toggleMenu('map')}
            onMouseEnter={() => { if (openMenu !== null) setOpenMenu('map') }}
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
        <div className="menu-item" onClick={(e) => e.stopPropagation()}>
          <button
            className={`menu-trigger ${openMenu === 'player' ? 'open' : ''}`}
            onClick={() => toggleMenu('player')}
            onMouseEnter={() => { if (openMenu !== null) setOpenMenu('player') }}
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
                onClick={() => { window.api.openInBrowser(); setOpenMenu(null) }}
              >
                Open in Browser
              </button>
            </div>
          )}
        </div>

        {/* Battle button */}
        <button
          className={`menu-trigger ${showBattlePanel ? 'open' : ''}`}
          onClick={() => setShowBattlePanel((v) => !v)}
        >
          Battle{battle?.isActive ? ' ⚔' : ''}
        </button>

        {/* Help button */}
        <button className="menu-trigger" onClick={() => setShowHelp(true)} title="User Guide (F1)">
          ?
        </button>

        {/* Right-side: Player View controls */}
        {map && (
          <div className="menubar-right">
            <button
              className="menu-trigger"
              title="Push your current pan/zoom to the player view"
              onClick={() => {
                const vp = mapCanvasRef.current?.getCurrentViewport() ?? null
                setPlayerViewport(vp)
              }}
            >
              Push View →
            </button>
            <button
              className="menu-trigger"
              title="Reset player view to auto-fit"
              onClick={() => setPlayerViewport(null)}
            >
              Reset View
            </button>
          </div>
        )}
      </nav>

      {/* ── Left sidebar ── */}
      <aside className="sidebar">

        {/* Tokens + token list (only when map loaded) */}
        {map && (
          <>
            {/* Tokens section */}
            <section className="sidebar-section">
              <h3>Tokens</h3>

              {/* Size & Labels sub-section */}
              <details className="subsection">
                <summary className="subsection-header">Size &amp; Labels</summary>
                <div className="subsection-body">
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
                  {tokenLabelVisible && (
                    <div style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                      {(['player', 'npc', 'enemy'] as const).map((type) => (
                        <label key={type} className="token-label-toggle" style={{ textTransform: 'capitalize' }}>
                          <input
                            type="checkbox"
                            checked={!tokenLabelHiddenTypes[type]}
                            onChange={(e) =>
                              setTokenLabelHiddenTypes({ ...tokenLabelHiddenTypes, [type]: !e.target.checked })
                            }
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              {/* Add Token sub-section */}
              <details className="subsection" open>
                <summary className="subsection-header">Add Token</summary>
                <div className="subsection-body">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Label…"
                      value={newTokenLabel}
                      onChange={(e) => { setNewTokenLabel(e.target.value); if (pendingMonsterEntry) setPendingMonsterEntry(null) }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddToken()}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    {monsters && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                        onClick={() => setShowMonsterSearch(true)}
                        title="Search monster database"
                      >
                        🔍 Monster
                      </button>
                    )}
                  </div>
                  {pendingMonsterEntry && (
                    <p className="hint" style={{ fontStyle: 'italic' }}>
                      From: {pendingMonsterEntry.name}
                    </p>
                  )}
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
                  <div className="token-stat-row">
                    <input
                      type="number"
                      placeholder="HP"
                      value={newTokenHp}
                      onChange={(e) => setNewTokenHp(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max HP"
                      value={newTokenHpMax}
                      onChange={(e) => setNewTokenHpMax(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="AC"
                      value={newTokenAc}
                      onChange={(e) => setNewTokenAc(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={handleAddToken} disabled={!newTokenLabel.trim()}>
                    Add Token
                  </button>
                </div>
              </details>
            </section>

            {/* Token list — grows to fill remaining sidebar space */}
            <div className="token-list-section">
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
                    <div className="token-item-actions">
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
                        className="btn-icon"
                        title="Duplicate token"
                        onClick={(e) => { e.stopPropagation(); handleCopyToken(token) }}
                      >
                        ❐
                      </button>
                      {token.monsterSheet && (
                        <button
                          className="btn-icon"
                          title="View character sheet"
                          onClick={(e) => { e.stopPropagation(); setViewSheet(token.monsterSheet!) }}
                        >
                          📋
                        </button>
                      )}
                      <button
                        className="btn-icon remove"
                        title="Remove token"
                        onClick={(e) => { e.stopPropagation(); removeToken(token.id) }}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

          </>
        )}

        {selectedToken && (
          <section className="sidebar-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3>Edit Token</h3>
              <button
                className="btn-icon"
                title="Deselect token"
                onClick={() => setSelectedTokenId(null)}
                style={{ fontSize: 12, opacity: 0.6 }}
              >
                ✕
              </button>
            </div>
            <div className="token-form">
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={() => { if (editLabel.trim()) updateToken({ ...selectedToken, label: editLabel.trim() }) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && editLabel.trim()) updateToken({ ...selectedToken, label: editLabel.trim() }) }}
              />
              <div className="token-type-radios">
                {(['player', 'npc', 'enemy'] as const).map((type) => (
                  <label
                    key={type}
                    className={`token-type-radio ${editType === type ? 'token-type-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="edit-token-type"
                      value={type}
                      checked={editType === type}
                      onChange={() => { setEditType(type); updateToken({ ...selectedToken, type }) }}
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>
              <div className="color-swatches">
                {TOKEN_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`swatch ${editColor === c ? 'swatch-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => { setEditColor(c); updateToken({ ...selectedToken, color: c }) }}
                  />
                ))}
                <label
                  className={`swatch swatch-picker ${!TOKEN_COLORS.includes(editColor) ? 'swatch-active' : ''}`}
                  style={TOKEN_COLORS.includes(editColor) ? undefined : { background: editColor }}
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => { setEditColor(e.target.value); updateToken({ ...selectedToken, color: e.target.value }) }}
                  />
                </label>
              </div>
              <div className="token-stat-row">
                <input type="number" placeholder="HP" value={editHp}
                  onChange={(e) => setEditHp(e.target.value)} onBlur={saveEditStats} />
                <input type="number" placeholder="Max HP" value={editHpMax}
                  onChange={(e) => setEditHpMax(e.target.value)} onBlur={saveEditStats} />
                <input type="number" placeholder="AC" value={editAc}
                  onChange={(e) => setEditAc(e.target.value)} onBlur={saveEditStats} />
              </div>
              {selectedToken.monsterSheet && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12 }}
                  onClick={() => setViewSheet(selectedToken.monsterSheet!)}
                >
                  📋 View Character Sheet
                </button>
              )}
              <p className="hint">
                Position: ({Math.round(selectedToken.x)}, {Math.round(selectedToken.y)})
              </p>
            </div>
          </section>
        )}
      </aside>

      {/* ── Battle panel (right side overlay) ── */}
      {showBattlePanel && <BattlePanel onClose={() => setShowBattlePanel(false)} />}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showExportPartyDialog && (
        <ExportPartyDialog
          tokens={tokens}
          onExport={(selected) => { saveParty(selected); setShowExportPartyDialog(false) }}
          onClose={() => setShowExportPartyDialog(false)}
        />
      )}

      {showMonsterSearch && monsters && (
        <MonsterSearchModal
          monsters={monsters}
          onSelect={handleMonsterSelect}
          onClose={() => setShowMonsterSearch(false)}
        />
      )}

      {viewSheet && (
        <CharacterSheetModal
          sheet={viewSheet}
          onClose={() => setViewSheet(null)}
          onShowToPlayers={() => setMonsterReveal({ imgUrl: viewSheet.imgUrl!, name: viewSheet.name })}
          isShowing={!!monsterReveal && monsterReveal.imgUrl === viewSheet.imgUrl}
        />
      )}

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

      {/* ── Tool Dock ── */}
      {map && (
        <div ref={dockRef} className={`tool-dock ${dockVisible ? 'tool-dock-visible' : ''}`}>
          {DOCK_TOOLS.map((tool) => (
            <div key={tool.id} className="dock-slot">
              {activeTool === tool.id && (tool.id === 'select' || tool.id === 'fog-reveal' || tool.id === 'fog-hide' || tool.id === 'laser') && (
                <div className="dock-popover">
                  {(tool.id === 'select' || tool.id === 'fog-reveal' || tool.id === 'fog-hide') && (
                    <>
                      <label className="brush-label">
                        Brush: {brushRadius}px
                        <input
                          type="range"
                          min={10}
                          max={300}
                          value={brushRadius}
                          onChange={(e) => setBrushRadius(Number(e.target.value))}
                        />
                      </label>
                      {tool.id === 'fog-reveal' && (
                        <button className="btn btn-secondary" onClick={revealAllFog} style={{ fontSize: 12 }}>
                          Reveal All
                        </button>
                      )}
                      {tool.id === 'fog-hide' && (
                        <button className="btn btn-danger" onClick={resetFog} style={{ fontSize: 12 }}>
                          Reset Fog
                        </button>
                      )}
                    </>
                  )}
                  {tool.id === 'laser' && (
                    <>
                      <label className="brush-label">
                        Size: {laserRadius}px
                        <input
                          type="range"
                          min={4}
                          max={32}
                          value={laserRadius}
                          onChange={(e) => setLaserRadius(Number(e.target.value))}
                        />
                      </label>
                      <div className="color-swatches">
                        {LASER_COLORS.map((c) => (
                          <button
                            key={c}
                            className={`swatch ${laserColor === c ? 'swatch-active' : ''}`}
                            style={{ background: c }}
                            onClick={() => setLaserColor(c)}
                          />
                        ))}
                        <label
                          className={`swatch swatch-picker ${!LASER_COLORS.includes(laserColor) ? 'swatch-active' : ''}`}
                          style={!LASER_COLORS.includes(laserColor) ? { background: laserColor } : undefined}
                          title="Custom color"
                        >
                          <input type="color" value={laserColor} onChange={(e) => setLaserColor(e.target.value)} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                className={`dock-btn ${activeTool === tool.id ? 'dock-btn-active' : ''}`}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.label} (${tool.key})`}
              >
                <span className="dock-icon">{tool.icon}</span>
                <span className="dock-label">{tool.label}</span>
                <kbd>{tool.key}</kbd>
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
