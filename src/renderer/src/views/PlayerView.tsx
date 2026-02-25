import { MapCanvas } from '../components/MapCanvas'
import { useGameStore } from '../store/gameStore'

export function PlayerView(): React.JSX.Element {
  const map = useGameStore((s) => s.map)

  // Always mount MapCanvas so PixiJS (WebGL context + shaders) initialises
  // immediately while the player is waiting. If MapCanvas only mounted after
  // the map arrived, app.init() would still be running when the first fog ops
  // come in, causing them to be silently dropped (isReady=false).
  return (
    <div className="player-view">
      <MapCanvas isPlayerView={true} />
      {!map && (
        <div className="player-waiting">
          <p>Waiting for the Dungeon Master to load a map…</p>
        </div>
      )}
    </div>
  )
}
