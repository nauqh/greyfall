import type { LevelView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import "./rest.css";

/** The wanderer's numbers at a rest, with the icons the HUD and the level up card use. */
const STATS = [
  { label: "Health", icon: "ui/icon_hp.png", of: (v: LevelView) => v.now.hp },
  { label: "Attack", icon: "ui/icon_damage.png", of: (v: LevelView) => v.now.attack },
  { label: "Stamina", icon: "UI Elements/UI Elements/Icons/Icon_08.png", of: (v: LevelView) => v.now.stamina },
] as const;

/**
 * Sat at a bonfire, after Elden Ring's grace: where you are and your level at the head, what you carry in the middle,
 * what to do at the foot. The world stays in view to its left.
 */
export function RestPanel({
  name,
  area,
  view,
  flasks,
  options,
  pick,
  onPick,
  onChoose,
}: {
  name: string;
  area: string;
  view: LevelView;
  flasks: number;
  options: { label: string; note: string }[];
  pick: number;
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
}) {
  const level = 1 + view.levels.hp + view.levels.attack + view.levels.stamina;
  return (
    <div className="restPanel" role="menu" aria-label={name}>
      <div className="restHead">
        <div className="restWhere">
          <span className="restKicker">Bonfire</span>
          <span className="restName">{name}</span>
          {area && area !== name && <span className="restArea">{area}</span>}
        </div>
        <div className="restLevel" aria-label={`Level ${level}`}>
          <span>Level</span>
          <b>{level}</b>
        </div>
      </div>
      <p className="restRested">Health and flasks restored. The dead walk again.</p>
      <ul className="restStats">
        {STATS.map((s) => (
          <li key={s.label}>
            <img src={packUrl(s.icon)} alt="" width={24} height={24} />
            <span>{s.label}</span>
            <b>{s.of(view)}</b>
          </li>
        ))}
        <li>
          <img src={packUrl("ui/icon_heal.png")} alt="" width={24} height={24} />
          <span>Flasks</span>
          <b>{flasks}</b>
        </li>
        <li className="restGold">
          <img src={packUrl("ui/icon_gold.png")} alt="" width={24} height={24} />
          <span>Gold</span>
          <b>{view.gold}</b>
        </li>
      </ul>
      <div className="restOptions">
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            role="menuitem"
            className={`restOption${i === pick ? " picked" : ""}`}
            onMouseEnter={() => onPick(i)}
            onClick={() => onChoose(i)}
          >
            <span className="restOptionName">{o.label}</span>
            {o.note && <span className="restOptionNote">{o.note}</span>}
          </button>
        ))}
      </div>
      <span className="restKeys" aria-hidden="true">
        W/S pick &nbsp; E choose &nbsp; Esc stand
      </span>
    </div>
  );
}
