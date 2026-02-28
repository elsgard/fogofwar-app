import { useEffect } from 'react'
import { DMView } from './views/DMView'
import { PlayerView } from './views/PlayerView'
import { useGameStore } from './store/gameStore'
import type { GameState } from './types'

const role = new URLSearchParams(window.location.search).get('role') ?? 'dm'
const SSE_PORT = 7654

function App(): React.JSX.Element {
  const applyState = useGameStore((s) => s.applyState)

  useEffect(() => {
    // window.api is only available in the Electron context (via contextBridge).
    // In a regular browser (e.g. localhost:5173?role=player) it is undefined,
    // so we fall back to the local SSE server running on the main process.
    if (!window.api) {
      fetch(`http://localhost:${SSE_PORT}/state`)
        .then((r) => r.json())
        .then((state) => applyState(state as GameState))
        .catch(() => {})

      const es = new EventSource(`http://localhost:${SSE_PORT}/events`)
      es.onmessage = (e) => applyState(JSON.parse(e.data) as GameState)
      es.addEventListener('laser-pointer', (e) => {
        const pos = JSON.parse(e.data) as { x: number; y: number } | null
        window.dispatchEvent(new CustomEvent('laser-pointer', { detail: pos }))
      })
      return () => es.close()
    }

    // Electron path: use IPC
    window.api.getState().then((state) => {
      if (state) applyState(state)
    })

    const unsubscribe = window.api.onStateUpdate((state) => {
      applyState(state)
    })

    return unsubscribe
  }, [applyState])

  return role === 'player' ? <PlayerView /> : <DMView />
}

export default App
