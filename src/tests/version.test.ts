import { describe, it, expect } from 'vitest'
import { minorVersion, isVersionCompatible } from '../shared/version'

describe('minorVersion', () => {
  it('extracts major.minor from a full semver', () => {
    expect(minorVersion('0.1.0')).toBe('0.1')
    expect(minorVersion('1.2.3')).toBe('1.2')
    expect(minorVersion('2.0.0')).toBe('2.0')
  })

  it('ignores the patch segment', () => {
    expect(minorVersion('0.1.0')).toBe(minorVersion('0.1.9'))
    expect(minorVersion('1.3.0')).toBe(minorVersion('1.3.42'))
  })
})

describe('isVersionCompatible', () => {
  it('is compatible when major.minor matches exactly', () => {
    expect(isVersionCompatible('0.1.0', '0.1.0')).toBe(true)
  })

  it('is compatible when only patch differs', () => {
    expect(isVersionCompatible('0.1.0', '0.1.1')).toBe(true)
    expect(isVersionCompatible('0.1.5', '0.1.0')).toBe(true)
  })

  it('is incompatible when minor version differs', () => {
    expect(isVersionCompatible('0.1.0', '0.2.0')).toBe(false)
    expect(isVersionCompatible('0.2.0', '0.1.0')).toBe(false)
  })

  it('is incompatible when major version differs', () => {
    expect(isVersionCompatible('1.0.0', '0.1.0')).toBe(false)
    expect(isVersionCompatible('0.1.0', '1.0.0')).toBe(false)
  })

  it('handles missing version gracefully', () => {
    // Empty string from old saves that predate version field
    expect(isVersionCompatible('', '0.1.0')).toBe(false)
  })
})
