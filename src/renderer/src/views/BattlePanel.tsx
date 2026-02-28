import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Battle, Combatant, Effect, BattleLogEntry, BattleLogKind } from '../types'
import './BattlePanel.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId(): string { return crypto.randomUUID() }
function nowIso(): string { return new Date().toISOString() }

function logEntry(
  round: number,
  kind: BattleLogKind,
  text: string,
  combatantId: string | null = null,
  meta: BattleLogEntry['meta'] = null,
): BattleLogEntry {
  return { id: newId(), round, timestamp: nowIso(), kind, text, combatantId, meta }
}

function sortedCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort(
    (a, b) =>
      b.initiative - a.initiative ||
      b.initiativeTieBreak - a.initiativeTieBreak ||
      a.sortOrder - b.sortOrder,
  )
}

const EFFECT_COLORS = ['#a855f7', '#f59e0b', '#4caf50', '#4a9eff', '#e53935', '#ec4899']

// ── Sub-components ────────────────────────────────────────────────────────────

interface EffectPopoverProps {
  onAdd: (name: string, duration: number | null, color: string) => void
  onClose: () => void
}

function EffectPopover({ onAdd, onClose }: EffectPopoverProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [color, setColor] = useState(EFFECT_COLORS[0])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function submit(): void {
    if (!name.trim()) return
    const dur = duration.trim() ? parseInt(duration, 10) : null
    onAdd(name.trim(), isNaN(dur as number) ? null : dur, color)
    onClose()
  }

  return (
    <div className="effect-popover" ref={ref}>
      <input
        autoFocus
        placeholder="Effect name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <input
        placeholder="Duration (rounds, blank=∞)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="effect-color-row">
        {EFFECT_COLORS.map((c) => (
          <button
            key={c}
            className={`effect-color-swatch ${color === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={submit}>
        Add Effect
      </button>
    </div>
  )
}

interface CombatantRowProps {
  combatant: Combatant
  tokenColor: string | null
  round: number
  onUpdate: (c: Combatant, extraLog?: BattleLogEntry) => void
  onRemove: (id: string) => void
}

function CombatantRow({ combatant: c, tokenColor, round, onUpdate, onRemove }: CombatantRowProps): React.JSX.Element {
  const [editingHp, setEditingHp] = useState(false)
  const [hpInput, setHpInput] = useState('')
  const [showEffectPopover, setShowEffectPopover] = useState(false)

  function commitHp(): void {
    setEditingHp(false)
    const val = parseInt(hpInput, 10)
    if (isNaN(val) || c.hp === null) return
    const delta = val - c.hp
    const kind: BattleLogKind = delta < 0 ? 'damage' : delta > 0 ? 'heal' : 'note'
    const text = delta < 0
      ? `${c.name} took ${Math.abs(delta)} damage (${val}/${c.hpMax ?? '?'} HP)`
      : delta > 0
        ? `${c.name} healed ${delta} HP (${val}/${c.hpMax ?? '?'} HP)`
        : ''
    const updated = { ...c, hp: val }
    if (val <= 0 && c.hp > 0) {
      onUpdate(
        { ...updated, hp: 0 },
        logEntry(round, 'death', `${c.name} dropped to 0 HP`, c.id),
      )
    } else if (text) {
      onUpdate(updated, logEntry(round, kind, text, c.id, { amount: Math.abs(delta) }))
    } else {
      onUpdate(updated)
    }
  }

  function addEffect(name: string, duration: number | null, color: string): void {
    const effect: Effect = { id: newId(), name, duration, color }
    const durationStr = duration !== null ? ` (${duration} round${duration !== 1 ? 's' : ''})` : ''
    onUpdate(
      { ...c, effects: [...c.effects, effect] },
      logEntry(round, 'effect-added', `${c.name} gained ${name}${durationStr}`, c.id, { effectName: name }),
    )
  }

  function removeEffect(effectId: string): void {
    onUpdate({ ...c, effects: c.effects.filter((e) => e.id !== effectId) })
  }

  function toggleVisibility(): void {
    onUpdate({ ...c, isVisible: !c.isVisible })
  }

  return (
    <div className={`combatant-row${c.isActive ? ' is-active' : ''}${c.hp === 0 ? ' is-dead' : ''}`}
         style={{ position: 'relative' }}>
      <span className="combatant-initiative">{c.initiative}</span>
      <span
        className="combatant-token-dot"
        style={{ background: tokenColor ?? (c.isPlayerCharacter ? '#4a9eff' : '#666') }}
      />
      <span className={`combatant-name${c.isActive ? ' is-active' : ''}`}>{c.name}</span>

      {c.hp !== null && (
        editingHp ? (
          <input
            className="combatant-hp-input"
            autoFocus
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={commitHp}
            onKeyDown={(e) => { if (e.key === 'Enter') commitHp(); if (e.key === 'Escape') setEditingHp(false) }}
          />
        ) : (
          <span
            className="combatant-hp"
            title="Click to edit HP"
            onClick={() => { setHpInput(String(c.hp)); setEditingHp(true) }}
          >
            {c.hp}/{c.hpMax ?? '?'}
          </span>
        )
      )}

      {c.ac !== null && <span className="combatant-ac">AC {c.ac}</span>}

      <div className="combatant-effects">
        {c.effects.map((ef) => (
          <span key={ef.id} className="effect-pill" style={{ background: ef.color + '33', color: ef.color }}>
            {ef.name}{ef.duration !== null ? ` ${ef.duration}` : ''}
            <button className="effect-pill-remove" onClick={() => removeEffect(ef.id)}>×</button>
          </span>
        ))}
      </div>

      <div className="combatant-row-actions" style={{ position: 'relative' }}>
        <button
          className="btn-icon"
          title="Add effect"
          onClick={() => setShowEffectPopover((v) => !v)}
        >✦</button>
        <button
          className="btn-icon"
          title={c.isVisible ? 'Visible to players' : 'Hidden from players'}
          onClick={toggleVisibility}
        >{c.isVisible ? '👁' : '🚫'}</button>
        <button className="btn-icon remove" title="Remove" onClick={() => onRemove(c.id)}>✕</button>
        {showEffectPopover && (
          <EffectPopover onAdd={addEffect} onClose={() => setShowEffectPopover(false)} />
        )}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function BattlePanel({ onClose }: Props): React.JSX.Element {
  const battle = useGameStore((s) => s.battle)
  const tokens = useGameStore((s) => s.tokens)
  const setBattle = useGameStore((s) => s.setBattle)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newInit, setNewInit] = useState('')
  const [newHp, setNewHp] = useState('')
  const [newHpMax, setNewHpMax] = useState('')
  const [newAc, setNewAc] = useState('')
  const [newTokenId, setNewTokenId] = useState<string>('none')
  const [newIsPlayer, setNewIsPlayer] = useState(false)
  const [noteText, setNoteText] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  // Scroll log to bottom on new entries
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [battle?.log.length])

  // ── Battle creation ──────────────────────────────────────────────────────

  function startBattle(): void {
    const b: Battle = {
      id: newId(),
      name: 'Battle',
      round: 1,
      turnDuration: 6,
      isActive: true,
      combatants: [],
      log: [logEntry(1, 'round-start', 'Round 1 started')],
      createdAt: nowIso(),
    }
    setBattle(b)
  }

  function endBattle(): void {
    if (!battle) return
    setBattle({ ...battle, isActive: false })
  }

  // ── Mutations (all via setBattle) ────────────────────────────────────────

  function updateCombatant(updated: Combatant, extraLog?: BattleLogEntry): void {
    if (!battle) return
    const combatants = battle.combatants.map((c) => c.id === updated.id ? updated : c)
    const log = extraLog ? [...battle.log, extraLog] : battle.log
    setBattle({ ...battle, combatants, log })
  }

  function removeCombatant(id: string): void {
    if (!battle) return
    // If the removed combatant was active, transfer active to the next one
    const sorted = sortedCombatants(battle.combatants)
    const idx = sorted.findIndex((c) => c.id === id)
    const wasActive = sorted[idx]?.isActive ?? false
    let remaining = battle.combatants.filter((c) => c.id !== id)
    if (wasActive && remaining.length > 0) {
      const nextIdx = idx % sortedCombatants(remaining).length
      const nextId = sortedCombatants(remaining)[nextIdx]?.id
      remaining = remaining.map((c) => ({ ...c, isActive: c.id === nextId }))
    }
    setBattle({ ...battle, combatants: remaining })
  }

  function addCombatant(): void {
    if (!battle || !newName.trim()) return
    const initiative = parseInt(newInit, 10)
    if (isNaN(initiative)) return

    const linkedToken = newTokenId !== 'none' ? tokens.find((t) => t.id === newTokenId) : undefined
    const combatant: Combatant = {
      id: newId(),
      name: newName.trim(),
      initiative,
      initiativeTieBreak: 0,
      sortOrder: battle.combatants.length,
      tokenId: linkedToken?.id ?? null,
      hp: newHp.trim() ? parseInt(newHp, 10) : null,
      hpMax: newHpMax.trim() ? parseInt(newHpMax, 10) : null,
      ac: newAc.trim() ? parseInt(newAc, 10) : null,
      isPlayerCharacter: newIsPlayer,
      isVisible: true,
      isActive: false,
      effects: [],
    }

    const isFirst = battle.combatants.length === 0
    const updatedCombatant = isFirst ? { ...combatant, isActive: true } : combatant
    setBattle({ ...battle, combatants: [...battle.combatants, updatedCombatant] })

    setNewName(''); setNewInit(''); setNewHp(''); setNewHpMax(''); setNewAc('')
    setNewTokenId('none'); setNewIsPlayer(false)
  }

  function nextTurn(): void {
    if (!battle) return
    const sorted = sortedCombatants(battle.combatants)
    const activeIdx = sorted.findIndex((c) => c.isActive)
    const nextIdx = (activeIdx + 1) % sorted.length
    const isNewRound = nextIdx === 0

    // Decrement effect durations on the combatant whose turn is ending
    const departing = sorted[activeIdx]
    let newLog = [...battle.log]

    let updatedCombatants = battle.combatants.map((c) => {
      if (c.id !== departing?.id) return { ...c, isActive: c.id === sorted[nextIdx].id }
      // Decrement effects
      const newEffects: Effect[] = []
      for (const ef of c.effects) {
        if (ef.duration === null) {
          newEffects.push(ef)
        } else if (ef.duration - 1 > 0) {
          newEffects.push({ ...ef, duration: ef.duration - 1 })
        } else {
          newLog.push(logEntry(battle.round, 'effect-expired', `${c.name}: ${ef.name} expired`, c.id))
        }
      }
      return { ...c, isActive: false, effects: newEffects }
    })

    const newRound = isNewRound ? battle.round + 1 : battle.round
    if (isNewRound) {
      newLog.push(logEntry(newRound, 'round-start', `Round ${newRound} started`))
    }
    newLog.push(logEntry(newRound, 'turn-start', `${sorted[nextIdx].name}'s turn`, sorted[nextIdx].id))

    setBattle({ ...battle, combatants: updatedCombatants, round: newRound, log: newLog })
  }

  function addNote(): void {
    if (!battle || !noteText.trim()) return
    const entry = logEntry(battle.round, 'note', noteText.trim())
    setBattle({ ...battle, log: [...battle.log, entry] })
    setNoteText('')
  }

  function updateTurnDuration(val: number): void {
    if (!battle || isNaN(val) || val < 1) return
    setBattle({ ...battle, turnDuration: val })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!battle) {
    return (
      <div className="battle-panel">
        <div className="battle-panel-header">
          <div className="battle-panel-header-row">
            <span className="battle-panel-title">Battle Tracker</span>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          <p style={{ marginBottom: 12 }}>No active battle.</p>
          <button className="btn btn-primary" onClick={startBattle}>Start Battle</button>
        </div>
      </div>
    )
  }

  const sorted = sortedCombatants(battle.combatants)
  const activeIdx = sorted.findIndex((c) => c.isActive)
  const completedTurns = (battle.round - 1) * sorted.length + Math.max(0, activeIdx)
  const elapsed = completedTurns * battle.turnDuration
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s elapsed` : elapsed > 0 ? `${seconds}s elapsed` : ''

  return (
    <div className="battle-panel">

      {/* Header */}
      <div className="battle-panel-header">
        <div className="battle-panel-header-row">
          <span className="battle-panel-title">Battle Tracker</span>
          {battle.isActive && (
            <button className="btn btn-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={endBattle}>
              End
            </button>
          )}
          {!battle.isActive && (
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={startBattle}>
              New Battle
            </button>
          )}
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="battle-round">Round {battle.round}</div>
        <div className="battle-round-sub">
          {timeStr && <span>{timeStr} · </span>}
          <span>
            {battle.turnDuration}s/turn{' '}
            <input
              type="number"
              min={1}
              max={600}
              value={battle.turnDuration}
              onChange={(e) => updateTurnDuration(parseInt(e.target.value, 10))}
              style={{ width: 44, fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', padding: '0 4px' }}
            />
          </span>
        </div>
      </div>

      {/* Combatant list */}
      <div className="battle-combatants">
        {sorted.map((c) => {
          const linkedToken = c.tokenId ? tokens.find((t) => t.id === c.tokenId) : undefined
          return (
            <CombatantRow
              key={c.id}
              combatant={c}
              tokenColor={linkedToken?.color ?? null}
              round={battle.round}
              onUpdate={updateCombatant}
              onRemove={removeCombatant}
            />
          )
        })}

        {/* Add combatant toggle */}
        <button className="add-combatant-toggle" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? '▾' : '▸'} Add Combatant
        </button>

        {showAddForm && (
          <div className="add-combatant-form">
            <div className="add-combatant-row">
              <input
                type="text"
                placeholder="Name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCombatant()}
              />
              <input
                type="number"
                placeholder="Init"
                value={newInit}
                onChange={(e) => setNewInit(e.target.value)}
              />
            </div>
            <div className="add-combatant-row">
              <input type="number" placeholder="HP" value={newHp} onChange={(e) => setNewHp(e.target.value)} />
              <input type="number" placeholder="Max HP" value={newHpMax} onChange={(e) => setNewHpMax(e.target.value)} />
              <input type="number" placeholder="AC" value={newAc} onChange={(e) => setNewAc(e.target.value)} />
            </div>
            <select
              value={newTokenId}
              onChange={(e) => {
                const id = e.target.value
                setNewTokenId(id)
                if (id !== 'none') {
                  const t = tokens.find((tok) => tok.id === id)
                  if (t) {
                    setNewName(t.label)
                    setNewHp(t.hp != null ? String(t.hp) : '')
                    setNewHpMax(t.hpMax != null ? String(t.hpMax) : '')
                    setNewAc(t.ac != null ? String(t.ac) : '')
                    setNewIsPlayer(t.type === 'player')
                  }
                }
              }}
            >
              <option value="none">No token link</option>
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>{t.label} ({t.type})</option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={newIsPlayer} onChange={(e) => setNewIsPlayer(e.target.checked)} />
              {' '}Player character
            </label>
            <button className="btn btn-primary" onClick={addCombatant} disabled={!newName.trim() || !newInit.trim()}>
              Add
            </button>
          </div>
        )}
      </div>

      {/* Quick action bar */}
      {battle.isActive && battle.combatants.length > 0 && (
        <div className="battle-quick-bar">
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={nextTurn}>
            Next Turn →
          </button>
        </div>
      )}

      {/* Battle log */}
      <div className="battle-log">
        <div className="battle-log-entries">
          {battle.log.map((entry) => (
            <div key={entry.id} className={`log-entry ${entry.kind}`}>
              {entry.kind !== 'round-start' && (
                <span className="log-entry-round">R{entry.round} </span>
              )}
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
        <div className="battle-note-input">
          <input
            placeholder="Add note to log…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
          />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={addNote}>
            Log
          </button>
        </div>
      </div>
    </div>
  )
}
