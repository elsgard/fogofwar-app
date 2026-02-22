import { useEffect } from 'react'
import { DMView } from './views/DMView'
import { PlayerView } from './views/PlayerView'
import { useGameStore } from './store/gameStore'

const role = new URLSearchParams(window.location.search).get('role') ?? 'dm'

function App(): React.JSX.Element {
  const applyState = useGameStore((s) => s.applyState)

  useEffect(() => {
    // Fetch the current game state on mount
    window.api.getState().then((state) => {
      if (state) applyState(state)
    })

    // Subscribe to live state broadcasts from main process
    const unsubscribe = window.api.onStateUpdate((state) => {
      applyState(state)
    })

    return unsubscribe
  }, [applyState])

  return role === 'player' ? <PlayerView /> : <DMView />
}

export default App
