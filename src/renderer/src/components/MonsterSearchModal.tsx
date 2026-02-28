import { useState, useEffect, useRef } from 'react'
import type { MonsterEntry } from '../types/monster'

interface Props {
  monsters: MonsterEntry[]
  onSelect: (entry: MonsterEntry) => void
  onClose: () => void
}

export function MonsterSearchModal({ monsters, onSelect, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = query.trim()
    ? monsters.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : monsters

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Monster Database ({monsters.length} loaded)</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <input
            ref={inputRef}
            className="monster-search-input"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="monster-list">
            {filtered.slice(0, 100).map((m) => (
              <li
                key={m.name}
                className="monster-item"
                onClick={() => { onSelect(m); onClose() }}
              >
                <span className="monster-name">{m.name}</span>
                <span className="monster-meta">{m.size} {m.creatureType}</span>
                <span className="monster-cr">CR {m.challenge.rating}</span>
              </li>
            ))}
            {filtered.length > 100 && (
              <li className="monster-more">…and {filtered.length - 100} more — refine your search</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
