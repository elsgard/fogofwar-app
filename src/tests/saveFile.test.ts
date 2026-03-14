import { describe, it, expect } from 'vitest'
import type { SaveFile } from '../renderer/src/types'

/**
 * Canonical fixture for the v0.1.0 save format.
 *
 * This is the regression anchor before any schema-breaking changes (e.g. the
 * map-memory optimization). If this fixture fails to satisfy the SaveFile type,
 * a field was added or removed and the major version should be bumped.
 *
 * When intentionally changing the schema:
 *   1. Update this fixture to match the new shape.
 *   2. Bump the app version accordingly (patch → no change; minor → compatible;
 *      major → breaking, old saves will warn on load).
 */
const V010_FIXTURE: SaveFile = {
  version: '0.1.0',
  savedAt: '2026-01-01T00:00:00.000Z',
  map: {
    dataUrl: 'data:image/png;base64,abc123',
    name: 'dungeon.png',
    width: 1920,
    height: 1080,
  },
  fogOps: [
    { type: 'reveal-circle', x: 100, y: 200, radius: 60 },
    { type: 'hide-circle', x: 300, y: 400, radius: 40 },
  ],
  tokens: [
    {
      id: 'token-1',
      x: 500,
      y: 500,
      color: '#4a9eff',
      label: 'Aragorn',
      type: 'player',
      hp: 45,
      hpMax: 52,
      ac: 16,
      status: 'alive',
      monsterSheet: null,
    },
    {
      id: 'token-2',
      x: 700,
      y: 600,
      color: '#e53935',
      label: 'Goblin',
      type: 'enemy',
      hp: 7,
      hpMax: 7,
      ac: 13,
      status: 'alive',
      monsterSheet: null,
    },
  ],
  tokenRadius: 20,
  tokenLabelSize: 14,
  tokenLabelVisible: true,
  playerViewport: {
    centerX: 960,
    centerY: 540,
    scale: 1,
  },
  battle: {
    id: 'battle-1',
    name: 'Battle',
    round: 2,
    turnDuration: 6,
    isActive: true,
    combatants: [
      {
        id: 'combatant-1',
        name: 'Aragorn',
        initiative: 18,
        initiativeTieBreak: 0,
        sortOrder: 0,
        tokenId: 'token-1',
        hp: 45,
        hpMax: 52,
        ac: 16,
        isPlayerCharacter: true,
        isVisible: true,
        isActive: true,
        effects: [],
      },
      {
        id: 'combatant-2',
        name: 'Goblin',
        initiative: 11,
        initiativeTieBreak: 0,
        sortOrder: 1,
        tokenId: 'token-2',
        hp: 7,
        hpMax: 7,
        ac: 13,
        isPlayerCharacter: false,
        isVisible: true,
        isActive: false,
        effects: [
          { id: 'effect-1', name: 'Poisoned', duration: 2, color: '#4caf50' },
        ],
      },
    ],
    log: [
      {
        id: 'log-1',
        round: 1,
        timestamp: '2026-01-01T00:00:01.000Z',
        kind: 'round-start',
        text: 'Round 1 started',
        combatantId: null,
        meta: null,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('SaveFile v0.1.0 schema fixture', () => {
  it('fixture satisfies the SaveFile type (compile-time check)', () => {
    // If this line compiles, the fixture matches the current SaveFile type.
    const save: SaveFile = V010_FIXTURE
    expect(save).toBeDefined()
  })

  it('fixture has required top-level fields', () => {
    expect(V010_FIXTURE).toHaveProperty('version')
    expect(V010_FIXTURE).toHaveProperty('savedAt')
    expect(V010_FIXTURE).toHaveProperty('fogOps')
    expect(V010_FIXTURE).toHaveProperty('tokens')
    expect(V010_FIXTURE).toHaveProperty('tokenRadius')
    expect(V010_FIXTURE).toHaveProperty('tokenLabelSize')
    expect(V010_FIXTURE).toHaveProperty('tokenLabelVisible')
  })

  it('tokens have required fields', () => {
    for (const token of V010_FIXTURE.tokens) {
      expect(token).toHaveProperty('id')
      expect(token).toHaveProperty('x')
      expect(token).toHaveProperty('y')
      expect(token).toHaveProperty('color')
      expect(token).toHaveProperty('label')
      expect(token).toHaveProperty('type')
      expect(token).toHaveProperty('status')
    }
  })

  it('battle combatants have required fields', () => {
    for (const c of V010_FIXTURE.battle!.combatants) {
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('initiative')
      expect(c).toHaveProperty('isActive')
      expect(c).toHaveProperty('effects')
    }
  })

  it('fog ops reference valid op types', () => {
    const validTypes = new Set(['reveal-circle', 'hide-circle', 'reveal-polygon', 'reset'])
    for (const op of V010_FIXTURE.fogOps) {
      expect(validTypes.has(op.type)).toBe(true)
    }
  })

  it('version string matches expected format', () => {
    expect(V010_FIXTURE.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
