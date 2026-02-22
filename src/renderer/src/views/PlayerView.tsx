import { MapCanvas } from '../components/MapCanvas'
import { useGameStore } from '../store/gameStore'

export function PlayerView(): React.JSX.Element {
  const map = useGameStore((s) => s.map)

  return (
    <div className="player-view">
      {map ? (
        <MapCanvas isPlayerView={true} />
      ) : (
        <div className="player-waiting">
          <p>Waiting for the Dungeon Master to load a map…</p>
        </div>
      )}
    </div>
  )
}
