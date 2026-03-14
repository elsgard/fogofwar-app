/**
 * Returns the "major.minor" portion of a semver string.
 * Patch versions are intentionally ignored — patch releases must not break save files.
 */
export function minorVersion(v: string): string {
  return v.split('.').slice(0, 2).join('.')
}

/**
 * Returns true if a save file created with `saveVersion` is compatible
 * with the running app at `appVersion`.
 * Compatibility requires the same major.minor; patch differences are allowed.
 */
export function isVersionCompatible(saveVersion: string, appVersion: string): boolean {
  return minorVersion(saveVersion) === minorVersion(appVersion)
}
