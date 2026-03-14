import { describe, it, expect } from 'vitest'
import { applyFogOp } from '../shared/fogOps'
import type { FogOp } from '../renderer/src/types'

const reveal = (x = 0, y = 0, radius = 30): FogOp => ({ type: 'reveal-circle', x, y, radius })
const hide = (x = 0, y = 0, radius = 30): FogOp => ({ type: 'hide-circle', x, y, radius })
const reset = (): FogOp => ({ type: 'reset' })

describe('applyFogOp', () => {
  it('appends a reveal op to an empty list', () => {
    const result = applyFogOp([], reveal())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('reveal-circle')
  })

  it('appends ops sequentially', () => {
    let ops: FogOp[] = []
    ops = applyFogOp(ops, reveal(0, 0))
    ops = applyFogOp(ops, hide(10, 10))
    ops = applyFogOp(ops, reveal(20, 20))
    expect(ops).toHaveLength(3)
  })

  it('a reset op discards all previous ops', () => {
    let ops: FogOp[] = [reveal(), hide(), reveal()]
    ops = applyFogOp(ops, reset())
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe('reset')
  })

  it('first non-reset op after a reset replaces the reset marker', () => {
    // After a reset, the canvas is blank. The first new op is sufficient
    // to describe state — keeping the reset marker is redundant.
    let ops: FogOp[] = applyFogOp([], reset())
    ops = applyFogOp(ops, reveal(5, 5))
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe('reveal-circle')
  })

  it('subsequent ops after reset-replacement accumulate normally', () => {
    let ops: FogOp[] = applyFogOp([], reset())
    ops = applyFogOp(ops, reveal(0, 0))
    ops = applyFogOp(ops, reveal(10, 10))
    expect(ops).toHaveLength(2)
  })

  it('does not mutate the input array', () => {
    const original = [reveal()]
    applyFogOp(original, reveal(99, 99))
    expect(original).toHaveLength(1)
  })

  it('a second reset after ops clears again', () => {
    let ops: FogOp[] = []
    ops = applyFogOp(ops, reveal())
    ops = applyFogOp(ops, reveal(1, 1))
    ops = applyFogOp(ops, reset())
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe('reset')
  })
})
