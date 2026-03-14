import { describe, it, expect } from 'vitest'
import { sortedCombatants, updatedTokenWithStatus } from '../shared/battle'
import type { Combatant, Token } from '../renderer/src/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: crypto.randomUUID(),
    name: 'Test',
    initiative: 10,
    initiativeTieBreak: 0,
    sortOrder: 0,
    tokenId: null,
    hp: 20,
    hpMax: 20,
    ac: 14,
    isPlayerCharacter: false,
    isVisible: true,
    isActive: false,
    effects: [],
    ...overrides,
  }
}

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    id: crypto.randomUUID(),
    x: 0,
    y: 0,
    color: '#ff0000',
    label: 'Test',
    type: 'enemy',
    hp: 20,
    hpMax: 20,
    ac: 14,
    status: 'alive',
    monsterSheet: null,
    ...overrides,
  }
}

// ── sortedCombatants ──────────────────────────────────────────────────────────

describe('sortedCombatants', () => {
  it('sorts by initiative descending', () => {
    const a = makeCombatant({ initiative: 5 })
    const b = makeCombatant({ initiative: 15 })
    const c = makeCombatant({ initiative: 10 })
    const result = sortedCombatants([a, b, c])
    expect(result.map((x) => x.initiative)).toEqual([15, 10, 5])
  })

  it('breaks ties by initiativeTieBreak descending', () => {
    const a = makeCombatant({ initiative: 10, initiativeTieBreak: 2 })
    const b = makeCombatant({ initiative: 10, initiativeTieBreak: 5 })
    const result = sortedCombatants([a, b])
    expect(result[0]).toBe(b)
  })

  it('breaks double-ties by sortOrder ascending', () => {
    const a = makeCombatant({ initiative: 10, initiativeTieBreak: 0, sortOrder: 3 })
    const b = makeCombatant({ initiative: 10, initiativeTieBreak: 0, sortOrder: 1 })
    const result = sortedCombatants([a, b])
    expect(result[0]).toBe(b)
  })

  it('does not mutate the input array', () => {
    const a = makeCombatant({ initiative: 5 })
    const b = makeCombatant({ initiative: 15 })
    const input = [a, b]
    sortedCombatants(input)
    expect(input[0]).toBe(a)
  })

  it('returns empty array for empty input', () => {
    expect(sortedCombatants([])).toEqual([])
  })
})

// ── updatedTokenWithStatus ────────────────────────────────────────────────────

describe('updatedTokenWithStatus', () => {
  it('updates hp without changing status when hp stays above 0', () => {
    const token = makeToken({ hp: 20, status: 'alive' })
    const result = updatedTokenWithStatus(token, 15)
    expect(result.hp).toBe(15)
    expect(result.status).toBe('alive')
  })

  it('sets enemy status to dead when hp reaches 0', () => {
    const token = makeToken({ type: 'enemy', hp: 10, status: 'alive' })
    const result = updatedTokenWithStatus(token, 0)
    expect(result.hp).toBe(0)
    expect(result.status).toBe('dead')
  })

  it('sets npc status to dead when hp reaches 0', () => {
    const token = makeToken({ type: 'npc', hp: 10, status: 'alive' })
    const result = updatedTokenWithStatus(token, 0)
    expect(result.status).toBe('dead')
  })

  it('sets player status to dsa when hp reaches 0', () => {
    const token = makeToken({ type: 'player', hp: 10, status: 'alive' })
    const result = updatedTokenWithStatus(token, 0)
    expect(result.hp).toBe(0)
    expect(result.status).toBe('dsa')
  })

  it('clamps negative damage to 0', () => {
    const token = makeToken({ type: 'enemy', hp: 5, status: 'alive' })
    const result = updatedTokenWithStatus(token, -10)
    expect(result.hp).toBe(0)
    expect(result.status).toBe('dead')
  })

  it('revives a dead token when healed above 0', () => {
    const token = makeToken({ type: 'enemy', hp: 0, status: 'dead' })
    const result = updatedTokenWithStatus(token, 5)
    expect(result.hp).toBe(5)
    expect(result.status).toBe('alive')
  })

  it('revives a dsa player when healed above 0', () => {
    const token = makeToken({ type: 'player', hp: 0, status: 'dsa' })
    const result = updatedTokenWithStatus(token, 1)
    expect(result.hp).toBe(1)
    expect(result.status).toBe('alive')
  })

  it('does not change status of an already-dead token healed to 0', () => {
    const token = makeToken({ type: 'enemy', hp: 0, status: 'dead' })
    const result = updatedTokenWithStatus(token, 0)
    expect(result.status).toBe('dead')
  })

  it('does not mutate the original token', () => {
    const token = makeToken({ hp: 10 })
    updatedTokenWithStatus(token, 0)
    expect(token.hp).toBe(10)
  })
})
