import { useEffect, useRef, useState } from 'react'
import { MapCanvas } from '../components/MapCanvas'
import { InitiativeStrip } from '../components/InitiativeStrip'
import { MonsterRevealOverlay } from '../components/MonsterRevealOverlay'
import { SmokeCanvas } from '../components/SmokeCanvas'
import { useGameStore } from '../store/gameStore'
import appIcon from '../assets/icon.png'
import rockTexture from '../assets/rock_texture.jpg'

const IDLE_JOKES = [
  "What do you call a mountaintop guarded by rogues?\nA Sneak Peak.",
  "What do you call an entire party of rogues?\nSurprise Party.",
  "A sneak attack is a Jab Well Done.",
  "Why do rogues prefer leather armor?\nBecause it's made of Hide.",
  "A monk walks into a street food vendor and says, \"make me one with everything.\"\nShe gets her food and asks, \"where's my change?\"\nThe vendor says, \"change comes from within.\"",
  "What do you call a group of bards all wearing plate armor?\nHeavy metal band.",
  "Why was the barbarian attempting to learn lightning magic?\nBecause he was told he needed an outlet for his anger.",
  "Have you heard how barbarians play chords?\nThree or four of them each hold a note.",
  "Why do dwarven bards sound better by candlelight?\nBecause you can shove wax in your ears.",
  "How many wizards does it take to change lamp oil?\nDepends on what you want it changed into.",
  "Why did nobody trust the low dexterity wizard?\nBecause he cantrip at any moment.",
  "Why did the Tabaxi wear a dress into battle?\nBecause she was Feline Fine.",
  "Two half-orcs walk into a bar.\nThe halfling walks under it.",
  "What do you call the advantage the undead gain from a necropolis?\nWight Privilege.",
  "A warlock threw a teacup at me once...\nGuess I should've expected it from a Tiefling.",
  "How many Elves does it take to light a candle?\nThree: one to sing, one to dance, one to summon the spiritual guardian of joyous flame forth into the realm of the material plane.",
  "Why was the werebat afraid to fly?\nBecause every cloud has its silver lining.",
  "What do you call a halfling fortune-teller who escaped from prison?\nA small medium at large.",
  "Two Orcs were eating a Court Jester.\nSaid one to the other: \"does this taste funny to you?\"",
  "Long Fairy Tales have a tendency to Drag-on.",
  "I once heard of a Druid who could wield swords while using wild shape.\nShe had a right to bear arms.",
  "What happens if you step on a d4 die?\nYou take 1d4 damage.",
  "I've been reading a tome about anti-gravity spells.\nIt's impossible to put down.",
  "What do you call a Kenku Cleric?\nA Bird of Pray.",
  "What's your AC?\nI want to know how hard it is to hit on you.",
  "A vampire had gained a reputation as a bit of a necromancer —\ndue to the many hickeys he had given in his life.",
]

export function PlayerView(): React.JSX.Element {
  const map = useGameStore((s) => s.map)
  const battle = useGameStore((s) => s.battle)
  const tokens = useGameStore((s) => s.tokens)
  const monsterReveal = useGameStore((s) => s.monsterReveal)
  const idleMode = useGameStore((s) => s.idleMode)
  const idleEffects = useGameStore((s) => s.idleEffects)
  const glowRef = useRef<HTMLDivElement>(null)
  const pulseEnabledRef = useRef(idleEffects.pulse)
  useEffect(() => { pulseEnabledRef.current = idleEffects.pulse }, [idleEffects.pulse])

  // Drive the red glow with summed irrational-frequency sines + random flares
  // so the pulse is never periodic or predictable.
  useEffect(() => {
    if (!glowRef.current) return
    const el = glowRef.current
    let rafId: number
    let elapsed = 0
    let lastTime: number | null = null

    // Occasional random flare: track remaining extra brightness
    let flareAmount = 0
    let nextFlare = 6 + Math.random() * 10

    const tick = (now: number): void => {
      const dt = lastTime !== null ? (now - lastTime) / 1000 : 0
      lastTime = now

      if (!pulseEnabledRef.current) {
        el.style.opacity = '0'
        rafId = requestAnimationFrame(tick)
        return
      }

      elapsed += dt

      // Schedule & decay flares
      nextFlare -= dt
      if (nextFlare <= 0) {
        flareAmount = 0.4 + Math.random() * 0.5
        nextFlare = 6 + Math.random() * 14
      }
      flareAmount *= Math.pow(0.05, dt) // fast exponential decay

      // Sum of four sines at irrational ratios — never repeats in practice
      const base =
        0.40 * Math.sin(elapsed * 0.53) +
        0.20 * Math.sin(elapsed * 1.37) +
        0.12 * Math.sin(elapsed * 2.91) +
        0.07 * Math.sin(elapsed * 5.17)

      // Remap [-0.79, 0.79] → [0.25, 1.0], then add flare on top
      const opacity = Math.min(1, Math.max(0.25, (base + 0.79) / 1.58 * 0.75 + 0.25) + flareAmount)
      el.style.opacity = String(opacity.toFixed(3))

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const [idleText, setIdleText] = useState('The Dungeon Master is preparing…')

  useEffect(() => {
    // Show the default message for the first minute, then cycle jokes
    const queue: string[] = []

    const nextJoke = (): string => {
      if (queue.length === 0) {
        // Fisher-Yates shuffle into the queue
        const shuffled = [...IDLE_JOKES]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        queue.push(...shuffled)
      }
      return queue.pop()!
    }

    const first = setTimeout(() => {
      setIdleText(nextJoke())
    }, 60_000)

    const interval = setInterval(() => {
      setIdleText(nextJoke())
    }, 60_000)

    return () => { clearTimeout(first); clearInterval(interval) }
  }, [])

  // Always mount MapCanvas so PixiJS (WebGL context + shaders) initialises
  // immediately while the player is waiting. If MapCanvas only mounted after
  // the map arrived, app.init() would still be running when the first fog ops
  // come in, causing them to be silently dropped (isReady=false).
  return (
    <div className="player-view">
      <MapCanvas isPlayerView={true} />
      {(idleMode || !map) && (
        <div className="player-waiting" style={{ backgroundImage: `url(${rockTexture})` }}>
          <div className="idle-overlay-dark" />
          <div className="idle-overlay-vignette" />
          <div className="idle-overlay-glow" ref={glowRef} />
          <SmokeCanvas effects={idleEffects} />
          <h1 className="player-waiting-title">Fog of War</h1>
          <img className="player-waiting-icon" src={appIcon} alt="Fog of War" />
          <p>{idleText}</p>
        </div>
      )}
      {battle?.isActive && <InitiativeStrip battle={battle} tokens={tokens} />}
      {monsterReveal && (
        <MonsterRevealOverlay
          name={monsterReveal.name}
          imgUrl={monsterReveal.imgUrl}
          topOffset={20}
        />
      )}
    </div>
  )
}
