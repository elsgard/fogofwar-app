import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

const TOOL_ROWS: { key: string; tool: string; description: string }[] = [
  { key: 'V', tool: 'Smart Select',  description: 'Drag token to move it; drag empty map to pan; Ctrl+drag to reveal fog; Shift+drag to hide fog' },
  { key: 'R', tool: 'Reveal Fog',    description: 'Paint to reveal the map to players' },
  { key: 'H', tool: 'Hide Fog',      description: 'Paint to cover revealed areas back with fog' },
  { key: 'T', tool: 'Move Token',    description: 'Drag any token to reposition it' },
  { key: 'P', tool: 'Pan / Zoom',    description: 'Click-drag to pan the map; scroll to zoom' },
  { key: 'L', tool: 'Laser Pointer', description: 'Draw a temporary glowing trail visible on the player screen' },
  { key: 'Tab',         tool: 'Cycle Tools',   description: 'Step through all tools in order' },
  { key: 'Right-click', tool: 'Laser (quick)', description: 'Activate laser pointer regardless of the active tool' },
]

export function HelpModal({ onClose }: Props): React.JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>

        <div className="dialog-header">
          <span>User Guide</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body" style={{ gap: 16 }}>

          {/* Tools */}
          <section>
            <h4 style={sectionHeading}>Tools <span style={hint}>— dock at the bottom, or use keyboard shortcuts</span></h4>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Key</th>
                  <th style={th}>Tool</th>
                  <th style={{ ...th, width: '100%' }}>What it does</th>
                </tr>
              </thead>
              <tbody>
                {TOOL_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td style={td}><kbd>{row.key}</kbd></td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{row.tool}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Fog */}
          <section>
            <h4 style={sectionHeading}>Fog of War</h4>
            <ul style={list}>
              <li>Select <strong>Reveal</strong> or <strong>Hide</strong> — a settings popover appears above the dock button with a <strong>Brush size</strong> slider.</li>
              <li><strong>Reveal All</strong> clears all fog instantly. <strong>Reset Fog</strong> covers the entire map again. Both are in the popover for their respective tools.</li>
              <li>Fog is rendered at full opacity for players; at 50% on the DM screen so you can see what's underneath.</li>
            </ul>
          </section>

          {/* Tokens */}
          <section>
            <h4 style={sectionHeading}>Tokens</h4>
            <ul style={list}>
              <li>Add tokens from the <strong>sidebar → Add Token</strong>. They appear at the centre of the map — drag them into position.</li>
              <li>Click a token in the list to <strong>select</strong> it and open the Edit panel. Click it again or press ✕ to deselect.</li>
              <li><strong>Hover</strong> a token row to reveal action buttons: cycle status (♥ / ⚠ / ☠), toggle player visibility (👁 / 🚫), duplicate (❐), view sheet (📋), delete (✕).</li>
              <li>Tokens with a monster sheet attached show a <strong>📋</strong> button that opens the full stat block.</li>
              <li>Load a <strong>Monster DB</strong> (Session menu) to search and auto-fill token stats via the <strong>🔍 Monster</strong> button. A compatible SRD dataset is available at <a href="https://gist.github.com/efortner/9b5a363df46d34d568c42b833344ba85" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>this GitHub Gist</a>.</li>
            </ul>
          </section>

          {/* Battle Tracker */}
          <section>
            <h4 style={sectionHeading}>Battle Tracker</h4>
            <ul style={list}>
              <li>Open the tracker with the <strong>Battle</strong> button in the menu bar.</li>
              <li>Add combatants, set initiative, and use <strong>Next Turn</strong> to advance. The active combatant is highlighted on the map.</li>
              <li>Effects and conditions track their remaining rounds automatically.</li>
              <li>Use the <strong>⚔</strong> button to log an attack with target and damage.</li>
              <li>The initiative strip is shown on the <strong>player screen</strong> during an active battle.</li>
            </ul>
          </section>

          {/* Player View */}
          <section>
            <h4 style={sectionHeading}>Player View</h4>
            <ul style={list}>
              <li><strong>Open Player Window</strong> — launches a second window on another display (Player menu).</li>
              <li><strong>Open in Browser</strong> — serves the player view at <code style={code}>http://127.0.0.1:7654</code> for use on any device on the same network.</li>
              <li><strong>Push View →</strong> copies your current pan/zoom to the player screen. <strong>Reset View</strong> puts the player back to auto-fit.</li>
            </ul>
          </section>

          {/* Idle Screen */}
          <section>
            <h4 style={sectionHeading}>Idle Screen</h4>
            <ul style={list}>
              <li>Click <strong>🌑 Idle</strong> in the top-right of the menu bar to show players an atmospheric waiting screen, even when a map is loaded — useful while you prepare in secret.</li>
              <li>The idle screen shows a rock texture with a vignette, a pulsating red glow, rising smoke, dying-fire embers, and occasional lightning flashes.</li>
              <li>After one minute the screen starts cycling through D&amp;D jokes, changing every minute.</li>
              <li>Use the <strong>🌑 Idle</strong> popover to toggle individual effects: <strong>Smoke</strong>, <strong>Glow</strong>, <strong>Embers</strong>, <strong>Lightning</strong>, and <strong>Pulse</strong> (the red glow).</li>
            </ul>
          </section>

          {/* Session */}
          <section>
            <h4 style={sectionHeading}>Session</h4>
            <ul style={list}>
              <li><strong>Save Scene…</strong> / <strong>Load Scene…</strong> — saves everything (map, fog, tokens, battle) to a <code style={code}>.fowsave</code> file. A <span style={{ color: '#f59e0b' }}>●</span> in the Session menu means there are unsaved changes.</li>
              <li><strong>Export Party…</strong> / <strong>Import Party…</strong> — share a group of tokens between sessions as a <code style={code}>.fowparty</code> file.</li>
              <li><strong>Load Monster DB…</strong> — load a local JSON monster database to enable quick token creation from stat blocks.</li>
            </ul>
          </section>

          {/* Credits */}
          <section style={{ marginTop: 4 }}>
            <h4 style={sectionHeading}>Credits</h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Made by <strong style={{ color: 'var(--text)' }}>Jonatan Elsgard</strong>, co-authored by <strong style={{ color: 'var(--text)' }}>Claude</strong>.{' '}
              <a href="https://github.com/elsgard/fogofwar-app" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                github.com/elsgard/fogofwar-app
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}

// ── Inline style helpers ─────────────────────────────────────────

const sectionHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--accent)',
  marginBottom: 6,
}

const hint: React.CSSProperties = {
  fontWeight: 400,
  textTransform: 'none',
  letterSpacing: 0,
  color: 'var(--text-muted)',
  fontSize: 11,
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const td: React.CSSProperties = {
  padding: '5px 8px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border)',
}

const list: React.CSSProperties = {
  paddingLeft: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 13,
  color: 'var(--text)',
  lineHeight: 1.5,
}

const code: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  background: 'rgba(0,0,0,0.3)',
  padding: '1px 5px',
  borderRadius: 3,
}
