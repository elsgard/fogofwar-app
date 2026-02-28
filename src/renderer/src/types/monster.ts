// Raw shape of a monster entry from the community D&D 5e SRD JSON database.
// See README for format details and the data source link.
export interface MonsterEntry {
  name: string
  ac: number
  size: string
  creatureType: string
  alignment: string
  languages: string[]
  maxHitPoints: number
  hitDice: string
  speed: {
    walk: number
    fly: number
    swim: number
    burrow: number
    climb: number
    hover: boolean
  }
  modifiers: {
    str: number; dex: number; con: number
    int: number; wis: number; cha: number
  }
  stats: {
    str: number; dex: number; con: number
    int: number; wis: number; cha: number
  }
  savingThrows: {
    str: number; dex: number; con: number
    int: number; wis: number; cha: number
  }
  skills: Record<string, number>
  traits: string[]
  actions: { list: string[]; attackRolls?: unknown }
  legendaryActions: string[]
  reactions: string[]
  challenge: { rating: string; xp: number }
  imageUrl?: string
}

// Cleaned-up version stored on a Token. Serializable to JSON.
export interface MonsterSheet {
  name: string
  meta: string              // e.g. "Large Aberration, Lawful Evil"
  armorClass: number
  hitPoints: number
  hitDice: string
  speed: string             // formatted, e.g. "10 ft., swim 40 ft."
  str: number;  strMod: string
  dex: number;  dexMod: string
  con: number;  conMod: string
  int: number;  intMod: string
  wis: number;  wisMod: string
  cha: number;  chaMod: string
  savingThrows?: string     // formatted non-zero saves, e.g. "Con +6, Int +8"
  skills?: string           // formatted non-zero skills
  challenge?: string        // e.g. "10 (5,900 XP)"
  languages?: string        // joined
  traits?: string[]
  actions?: string[]
  reactions?: string[]
  legendaryActions?: string[]
  imgUrl?: string
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

function formatSpeed(speed: MonsterEntry['speed']): string {
  const parts: string[] = []
  if (speed.walk) parts.push(`${speed.walk} ft.`)
  if (speed.fly) parts.push(`fly ${speed.fly} ft.${speed.hover ? ' (hover)' : ''}`)
  if (speed.swim) parts.push(`swim ${speed.swim} ft.`)
  if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`)
  if (speed.climb) parts.push(`climb ${speed.climb} ft.`)
  return parts.join(', ') || '—'
}

function formatRecord(rec: Record<string, number>): string | undefined {
  const parts = Object.entries(rec)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${cap(k)} ${formatMod(v)}`)
  return parts.length > 0 ? parts.join(', ') : undefined
}

export function entryToSheet(m: MonsterEntry): MonsterSheet {
  return {
    name: m.name,
    meta: `${cap(m.size)} ${cap(m.creatureType)}, ${m.alignment}`,
    armorClass: m.ac,
    hitPoints: m.maxHitPoints,
    hitDice: m.hitDice,
    speed: formatSpeed(m.speed),
    str: m.stats.str,  strMod: formatMod(m.modifiers.str),
    dex: m.stats.dex,  dexMod: formatMod(m.modifiers.dex),
    con: m.stats.con,  conMod: formatMod(m.modifiers.con),
    int: m.stats.int,  intMod: formatMod(m.modifiers.int),
    wis: m.stats.wis,  wisMod: formatMod(m.modifiers.wis),
    cha: m.stats.cha,  chaMod: formatMod(m.modifiers.cha),
    savingThrows: formatRecord(m.savingThrows),
    skills: formatRecord(m.skills),
    challenge: `${m.challenge.rating} (${m.challenge.xp.toLocaleString()} XP)`,
    languages: m.languages.join(', '),
    traits: m.traits.length > 0 ? m.traits : undefined,
    actions: m.actions.list.length > 0 ? m.actions.list : undefined,
    reactions: m.reactions.length > 0 ? m.reactions : undefined,
    legendaryActions: m.legendaryActions.length > 0 ? m.legendaryActions : undefined,
    imgUrl: m.imageUrl,
  }
}
