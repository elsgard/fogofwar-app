import type { Battle } from '../types'
import './InitiativeStrip.css'

interface Props {
  battle: Battle
}

export function InitiativeStrip({ battle }: Props): React.JSX.Element {
  const active = battle.combatants.find((c) => c.isActive && (c.isVisible || c.isPlayerCharacter))

  if (!active) return <></>

  return (
    <div className="initiative-strip">
      <div className="initiative-strip-label">Current turn</div>
      <div className="initiative-strip-name">{active.name}</div>
    </div>
  )
}
