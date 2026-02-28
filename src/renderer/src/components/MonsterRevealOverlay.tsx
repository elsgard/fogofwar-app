interface Props {
  name: string
  imgUrl: string
  onDismiss?: () => void  // undefined → player view (no dismiss button)
  topOffset?: number      // px from top of containing block; default 20
}

export function MonsterRevealOverlay({ name, imgUrl, onDismiss, topOffset = 20 }: Props): React.JSX.Element {
  return (
    <div className="monster-reveal" style={{ top: topOffset }}>
      <div className="monster-reveal-header">
        <span className="monster-reveal-name">{name}</span>
        {onDismiss && (
          <button className="btn-icon" title="Hide from players" onClick={onDismiss}>✕</button>
        )}
      </div>
      <div className="monster-reveal-body">
        <img
          className="monster-reveal-img"
          src={imgUrl}
          alt={name}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    </div>
  )
}
