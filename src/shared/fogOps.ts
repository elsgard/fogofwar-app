import type { FogOp } from '../renderer/src/types'

/**
 * Pure fog-op accumulator. Returns the new ops array after applying `op`.
 * Rules:
 *   - A 'reset' op discards all previous ops and becomes the sole entry.
 *   - If the current last op is a 'reset', the incoming op replaces it
 *     (the reset is already implicit in the cleared state; no need to keep it).
 *   - Otherwise the op is appended.
 */
export function applyFogOp(ops: FogOp[], op: FogOp): FogOp[] {
  if (op.type === 'reset' || op.type === 'reveal-all') return [op]
  const last = ops[ops.length - 1]
  if (last?.type === 'reset' || last?.type === 'reveal-all') return [op]
  return [...ops, op]
}
