import type { MonsterSheet } from '../types/monster'

interface Props {
  sheet: MonsterSheet
  onClose: () => void
}

export function CharacterSheetModal({ sheet, onClose }: Props): React.JSX.Element {
  const abilities = [
    { label: 'STR', score: sheet.str, mod: sheet.strMod },
    { label: 'DEX', score: sheet.dex, mod: sheet.dexMod },
    { label: 'CON', score: sheet.con, mod: sheet.conMod },
    { label: 'INT', score: sheet.int, mod: sheet.intMod },
    { label: 'WIS', score: sheet.wis, mod: sheet.wisMod },
    { label: 'CHA', score: sheet.cha, mod: sheet.chaMod },
  ]

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>{sheet.name}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {sheet.imgUrl && (
            <img
              className="sheet-image"
              src={sheet.imgUrl}
              alt={sheet.name}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <p className="sheet-meta">{sheet.meta}</p>
          <div className="sheet-basics">
            <span><strong>AC</strong> {sheet.armorClass}</span>
            <span><strong>HP</strong> {sheet.hitPoints} ({sheet.hitDice})</span>
            <span><strong>Speed</strong> {sheet.speed}</span>
          </div>
          <div className="sheet-abilities">
            {abilities.map(({ label, score, mod }) => (
              <div key={label} className="sheet-ability">
                <span className="sheet-ability-label">{label}</span>
                <span className="sheet-ability-score">{score}</span>
                <span className="sheet-ability-mod">{mod}</span>
              </div>
            ))}
          </div>
          {sheet.savingThrows && <p className="sheet-row"><strong>Saving Throws</strong> {sheet.savingThrows}</p>}
          {sheet.skills && <p className="sheet-row"><strong>Skills</strong> {sheet.skills}</p>}
          {sheet.languages && <p className="sheet-row"><strong>Languages</strong> {sheet.languages}</p>}
          {sheet.challenge && <p className="sheet-row"><strong>Challenge</strong> {sheet.challenge}</p>}
          {sheet.traits && sheet.traits.length > 0 && (
            <div className="sheet-section">
              <h4>Traits</h4>
              {sheet.traits.map((t, i) => <p key={i}>{t}</p>)}
            </div>
          )}
          {sheet.actions && sheet.actions.length > 0 && (
            <div className="sheet-section">
              <h4>Actions</h4>
              {sheet.actions.map((a, i) => <p key={i}>{a}</p>)}
            </div>
          )}
          {sheet.reactions && sheet.reactions.length > 0 && (
            <div className="sheet-section">
              <h4>Reactions</h4>
              {sheet.reactions.map((r, i) => <p key={i}>{r}</p>)}
            </div>
          )}
          {sheet.legendaryActions && sheet.legendaryActions.length > 0 && (
            <div className="sheet-section">
              <h4>Legendary Actions</h4>
              {sheet.legendaryActions.map((a, i) => <p key={i}>{a}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
