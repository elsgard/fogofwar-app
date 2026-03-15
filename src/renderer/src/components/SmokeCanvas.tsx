import { useEffect, useRef } from 'react'
import { Application, Sprite, Texture, Container, Graphics } from 'pixi.js'
import type { IdleEffects } from '../types'

// ── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  startScale: number
  endScale: number
  rotSpeed: number
}

interface Ember {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
}

// Glow source: a large soft blob sitting at the bottom edge that flickers.
// xFrac is 0–1 across screen width. Flicker is sum of three sines:
//   alpha = base + a1*sin(t*f1+p1) + a2*sin(t*f2+p2) + a3*sin(t*f3+p3)
interface GlowSource {
  sprite: Sprite
  xFrac: number   // 0–1 relative screen width
  yOffset: number // px below bottom edge (centre buried so only top half visible)
  base: number; a1: number; f1: number; p1: number
                  a2: number; f2: number; p2: number
                  a3: number; f3: number; p3: number
}

// ── Texture builders ─────────────────────────────────────────────────────────

function makeSmokeTex(): Texture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0,    'rgba(255,255,255,0.55)')
  g.addColorStop(0.40, 'rgba(255,255,255,0.25)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.07)')
  g.addColorStop(1,    'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return Texture.from(c)
}

// Sharper centre than smoke — for the fire glow blobs.
function makeGlowTex(): Texture {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0,    'rgba(255,255,255,0.9)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.15)')
  g.addColorStop(1,    'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return Texture.from(c)
}

// Tiny bright dot for ember sparks.
function makeEmberTex(): Texture {
  const size = 32
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0,   'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)')
  g.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return Texture.from(c)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SmokeCanvas({ effects }: { effects: IdleEffects }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const effectsRef = useRef(effects)
  useEffect(() => { effectsRef.current = effects }, [effects])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let appReady = false
    const particles: Particle[] = []
    const embers: Ember[] = []
    let smokeTex: Texture | null = null
    let glowTex:  Texture | null = null
    let emberTex: Texture | null = null

    const app = new Application()

    app
      .init({
        resizeTo: el,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) { app.destroy(true, { children: true }); return }
        appReady = true

        el.appendChild(app.canvas as HTMLCanvasElement)

        smokeTex = makeSmokeTex()
        glowTex  = makeGlowTex()
        emberTex = makeEmberTex()

        // ── Glow layer (behind smoke) ──────────────────────────────────────
        const glowContainer = new Container()
        app.stage.addChild(glowContainer)

        // Five glow sources spread unevenly across the bottom.
        // Colours: deep crimson → orange-red → orange, giving a dying-coal palette.
        const glowDefs: Omit<GlowSource, 'sprite'>[] = [
          { xFrac:0.12, yOffset:110, base:0.18, a1:0.07, f1:1.7, p1:0.00, a2:0.04, f2:4.3, p2:1.1, a3:0.02, f3:9.1, p3:2.4 },
          { xFrac:0.34, yOffset: 90, base:0.24, a1:0.09, f1:2.1, p1:0.80, a2:0.05, f2:5.7, p2:0.3, a3:0.02, f3:11.3,p3:1.9 },
          { xFrac:0.55, yOffset:100, base:0.28, a1:0.10, f1:1.4, p1:1.50, a2:0.06, f2:3.9, p2:2.6, a3:0.03, f3:8.3, p3:0.7 },
          { xFrac:0.72, yOffset: 95, base:0.22, a1:0.08, f1:2.6, p1:0.40, a2:0.05, f2:6.1, p2:1.8, a3:0.02, f3:13.0,p3:3.0 },
          { xFrac:0.90, yOffset:115, base:0.16, a1:0.06, f1:1.9, p1:2.10, a2:0.03, f2:4.8, p2:0.9, a3:0.02, f3:10.2,p3:1.4 },
        ]

        // Alternate deep-red / orange-red / orange per source
        const glowTints = [0x7a1200, 0xbb3300, 0xdd5500, 0xaa2200, 0x882200]

        const glowSources: GlowSource[] = glowDefs.map((def, i) => {
          const sprite = new Sprite(glowTex!)
          sprite.anchor.set(0.5)
          // Scale so the glow radius (half-tex = 256px) appears ~180–240px on screen
          const radius = 180 + i * 12
          sprite.scale.set(radius / 256)
          sprite.tint = glowTints[i]
          sprite.alpha = def.base
          glowContainer.addChild(sprite)
          return { ...def, sprite }
        })

        // ── Smoke layer ────────────────────────────────────────────────────
        const smokeContainer = new Container()
        app.stage.addChild(smokeContainer)

        // ── Ember layer (on top) ───────────────────────────────────────────
        const emberContainer = new Container()
        app.stage.addChild(emberContainer)

        // ── Lightning flash overlay (topmost layer) ────────────────────────
        const flashRect = new Graphics()
        flashRect.rect(0, 0, 1, 1).fill({ color: 0xffffff })
        flashRect.alpha = 0
        app.stage.addChild(flashRect)

        // Flash state: null = idle, otherwise elapsed time within the flash
        let flashProgress: number | null = null
        // Countdown until the next flash fires (seconds)
        let flashCountdown = 15 + Math.random() * 30

        // Double-flash alpha curve — returns 0..1 given t in [0, 1].
        // Shape: sharp spike → dim gap → softer second spike → fade out.
        function flashAlpha(t: number): number {
          if (t < 0.12) return t / 0.12                          // ramp up
          if (t < 0.20) return 1 - ((t - 0.12) / 0.08) * 0.85  // drop to 0.15
          if (t < 0.28) return 0.15 + ((t - 0.20) / 0.08) * 0.55 // second peak
          return Math.max(0, (0.70 * (1 - (t - 0.28) / 0.72)))  // long fade
        }

        const FLASH_DURATION = 0.7 // seconds for the full flash curve

        let smokeTimer = 0
        let emberTimer = 0
        let elapsed   = 0

        app.ticker.add((ticker) => {
          const dt = ticker.deltaMS / 1000
          elapsed += dt
          const W = app.screen.width
          const H = app.screen.height

          const fx = effectsRef.current

          // ── Lightning flash ─────────────────────────────────────────────
          if (!fx.lightning) {
            flashRect.alpha = 0
          } else if (flashProgress !== null) {
            flashProgress += dt
            const t = flashProgress / FLASH_DURATION
            if (t >= 1) {
              flashRect.alpha = 0
              flashProgress   = null
              flashCountdown  = 15 + Math.random() * 30
            } else {
              flashRect.alpha = flashAlpha(t) * 0.55
              flashRect.width  = W
              flashRect.height = H
            }
          } else {
            flashCountdown -= dt
            if (flashCountdown <= 0) flashProgress = 0
          }

          // ── Glow flicker ────────────────────────────────────────────────
          for (const gs of glowSources) {
            if (!fx.glow) { gs.sprite.alpha = 0; continue }
            const t = elapsed
            gs.sprite.x = W * gs.xFrac
            gs.sprite.y = H + gs.yOffset
            const a = gs.base
              + gs.a1 * Math.sin(t * gs.f1 + gs.p1)
              + gs.a2 * Math.sin(t * gs.f2 + gs.p2)
              + gs.a3 * Math.sin(t * gs.f3 + gs.p3)
            gs.sprite.alpha = Math.max(0.01, a)
          }

          // ── Smoke spawn ─────────────────────────────────────────────────
          smokeTimer -= dt
          if (fx.smoke && smokeTimer <= 0) {
            smokeTimer = 0.11 + Math.random() * 0.07

            const maxLife  = 5 + Math.random() * 3
            const startR   = 40 + Math.random() * 40
            const endR     = startR * (2.2 + Math.random() * 0.8)
            const startScale = startR / 128
            const endScale   = endR / 128

            const sprite = new Sprite(smokeTex!)
            sprite.anchor.set(0.5)
            sprite.x = Math.random() * W
            sprite.y = H + startR
            sprite.scale.set(startScale)
            sprite.alpha = 0
            sprite.tint = 0x8fa8cc
            smokeContainer.addChild(sprite)

            particles.push({ sprite, vx: (Math.random() - 0.5) * 18,
              vy: -(30 + Math.random() * 30), life: 0, maxLife, startScale, endScale,
              rotSpeed: (Math.random() - 0.5) * 0.3 })
          }

          // ── Smoke update ────────────────────────────────────────────────
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]
            p.life += dt
            const t = p.life / p.maxLife
            if (t >= 1) {
              smokeContainer.removeChild(p.sprite)
              p.sprite.destroy()
              particles.splice(i, 1)
              continue
            }
            let alpha: number
            if      (t < 0.20) alpha = (t / 0.2) * 0.18
            else if (t < 0.65) alpha = 0.18
            else               alpha = 0.18 * (1 - (t - 0.65) / 0.35)
            p.sprite.alpha  = alpha
            p.sprite.x     += p.vx * dt
            p.sprite.y     += p.vy * dt
            p.sprite.rotation += p.rotSpeed * dt
            p.vx += (Math.random() - 0.5) * 12 * dt
            p.vx *= 1 - 0.6  * dt
            p.vy *= 1 - 0.15 * dt
            p.sprite.scale.set(p.startScale + (p.endScale - p.startScale) * t)
          }

          // ── Ember spawn ─────────────────────────────────────────────────
          emberTimer -= dt
          if (fx.embers && emberTimer <= 0) {
            emberTimer = 0.28 + Math.random() * 0.35

            const maxLife = 0.8 + Math.random() * 1.2
            const sprite  = new Sprite(emberTex!)
            sprite.anchor.set(0.5)
            // Spawn near a random glow source so they look like they come from coals
            const src = glowSources[Math.floor(Math.random() * glowSources.length)]
            sprite.x = W * src.xFrac + (Math.random() - 0.5) * 40
            sprite.y = H - 4
            const r  = 3 + Math.random() * 5
            sprite.scale.set(r / 16)
            sprite.alpha = 0
            // Ember colours: bright orange-yellow to dim amber
            const emberTints = [0xffcc44, 0xffaa22, 0xff8800, 0xffee66]
            sprite.tint = emberTints[Math.floor(Math.random() * emberTints.length)]
            emberContainer.addChild(sprite)

            embers.push({ sprite, vx: (Math.random() - 0.5) * 30,
              vy: -(90 + Math.random() * 80), life: 0, maxLife })
          }

          // ── Ember update ────────────────────────────────────────────────
          for (let i = embers.length - 1; i >= 0; i--) {
            const e = embers[i]
            e.life += dt
            const t = e.life / e.maxLife
            if (t >= 1) {
              emberContainer.removeChild(e.sprite)
              e.sprite.destroy()
              embers.splice(i, 1)
              continue
            }
            // Sharp in, slow fade out
            const alpha = t < 0.15
              ? (t / 0.15) * 0.85
              : 0.85 * (1 - (t - 0.15) / 0.85)
            e.sprite.alpha  = alpha
            e.sprite.x     += e.vx * dt
            e.sprite.y     += e.vy * dt
            // Embers decelerate and drift
            e.vx += (Math.random() - 0.5) * 20 * dt
            e.vx *= 1 - 0.8 * dt
            e.vy *= 1 - 0.4 * dt
          }
        })
      })

    return () => {
      cancelled = true
      // Stop the ticker first so no render frame fires after we start tearing down.
      if (appReady) app.ticker.stop()
      // Clear the live lists — app.destroy({ children: true }) owns the actual
      // sprite/texture cleanup for anything still attached to the stage.
      particles.length = 0
      embers.length    = 0
      smokeTex?.destroy(true)
      glowTex?.destroy(true)
      emberTex?.destroy(true)
      if (appReady) app.destroy(true, { children: true })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}
