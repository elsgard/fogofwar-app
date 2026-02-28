import { useState } from 'react'
import type { Token } from '../types'

interface Props {
  tokens: Token[]
  onExport: (tokens: Token[]) => void
  onClose: () => void
}

export function ExportPartyDialog({ tokens, onExport, onClose }: Props): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tokens.filter((t) => t.type === 'player' || t.type === 'npc').map((t) => t.id))
  )

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleExport(): void {
    onExport(tokens.filter((t) => selected.has(t.id)))
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>

        <div className="dialog-header">
          <span>Export Party</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="dialog-row-actions">
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}
              onClick={() => setSelected(new Set(tokens.map((t) => t.id)))}>
              Select All
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}
              onClick={() => setSelected(new Set())}>
              Deselect All
            </button>
          </div>

          <ul className="token-list" style={{ maxHeight: '50vh' }}>
            {tokens.map((token) => (
              <li
                key={token.id}
                className={`token-item ${selected.has(token.id) ? 'token-selected' : ''}`}
                onClick={() => toggle(token.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(token.id)}
                  onChange={() => toggle(token.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0 }}
                />
                <span className="token-dot" style={{ background: token.color }} />
                <span className="token-label">{token.label}</span>
                <span className="token-type">{token.type}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={selected.size === 0}>
            Export{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

      </div>
    </div>
  )
}
