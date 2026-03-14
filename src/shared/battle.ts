import type { Combatant, Token } from '../renderer/src/types'

export function sortedCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort(
    (a, b) =>
      b.initiative - a.initiative ||
      b.initiativeTieBreak - a.initiativeTieBreak ||
      a.sortOrder - b.sortOrder,
  )
}

/** Apply newHp to token, auto-setting status at 0 / above 0. */
export function updatedTokenWithStatus(token: Token, newHp: number): Token {
  const clampedHp = Math.max(0, newHp)
  if (clampedHp <= 0 && (token.hp ?? 1) > 0) {
    return { ...token, hp: 0, status: token.type === 'player' ? 'dsa' : 'dead' }
  } else if (clampedHp > 0 && (token.status === 'dead' || token.status === 'dsa')) {
    return { ...token, hp: clampedHp, status: 'alive' }
  }
  return { ...token, hp: clampedHp }
}
