import type { Battle } from '../types'
import './InitiativeStrip.css'

interface Props {
  battle: Battle
}

export function InitiativeStrip({ battle }: Props): React.JSX.Element {
  const sorted = [...battle.combatants]
    .filter((c) => c.isVisible || c.isPlayerCharacter)
    .sort((a, b) =>
      b.initiative - a.initiative ||
      b.initiativeTieBreak - a.initiativeTieBreak ||
      a.sortOrder - b.sortOrder
    )

  const elapsed = (battle.round - 1) * battle.roundDuration
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`

  return (
    <div className="initiative-strip">
      <div className="initiative-strip-header">
        Round {battle.round}
        {elapsed > 0 && <span style={{ marginLeft: 6, opacity: 0.6 }}>{timeStr}</span>}
      </div>
      {sorted.map((c) => (
        <div key={c.id} className={`initiative-entry${c.isActive ? ' is-active' : ''}`}>
          <span className="initiative-entry-turn">{c.isActive ? '▶' : ''}</span>
          <span>{c.name}</span>
        </div>
      ))}
    </div>
  )
}
