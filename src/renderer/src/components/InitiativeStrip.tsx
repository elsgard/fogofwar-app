import type { Battle, Token } from '../types'
import './InitiativeStrip.css'

interface Props {
  battle: Battle
  tokens: Token[]
}

export function InitiativeStrip({ battle, tokens }: Props): React.JSX.Element {
  const active = battle.combatants.find((c) => c.isActive && (c.isVisible || c.isPlayerCharacter))

  if (!active) return <></>

  const isPlayer = active.tokenId
    ? (tokens.find((t) => t.id === active.tokenId)?.type === 'player')
    : active.isPlayerCharacter

  const displayName = active.tokenId
    ? (tokens.find((t) => t.id === active.tokenId)?.label ?? active.name)
    : active.name

  return (
    <div className="initiative-strip">
      <div className="initiative-strip-label">{isPlayer ? 'Your turn' : 'Current turn'}</div>
      <div className="initiative-strip-name">{displayName}</div>
    </div>
  )
}
