import { LEVEL_UP, type Levels } from "@greyfall/engine";

import type { LevelView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import "./level.css";
import "./shop.css";

const STATS: { stat: keyof Levels; name: string; raises: string; icon: string }[] = [
  { stat: "hp", name: "Vigour", raises: "Health", icon: "ui/icon_hp.png" },
  { stat: "attack", name: "Strength", raises: "Attack", icon: "ui/icon_damage.png" },
  { stat: "stamina", name: "Endurance", raises: "Stamina", icon: "UI Elements/UI Elements/Icons/Icon_08.png" },
];

/** Levelling at a bonfire, after Dark Souls 3's: the attributes on one side, what the picked one raises on the other, the gold below. */
export function LevelUp({ view, pick, bought, onPick, onBuy }: { view: LevelView; pick: number; bought?: { stat: keyof Levels; at: number }; onPick: (i: number) => void; onBuy: (i: number) => void }) {
  const picked = STATS[pick]!.stat;
  const level = 1 + view.levels.hp + view.levels.attack + view.levels.stamina;
  const short = view.gold < view.cost;
  return (
    <div className="levelCard" role="menu" aria-label={`Level up, level ${level}`}>
      <div className="levelHead">
        <span>Level up</span>
        <span className="levelNow">
          Level{" "}
          <b key={bought?.at} className={bought ? "pop" : undefined}>
            {level}
          </b>
        </span>
      </div>
      <ul className="levelStats">
        {STATS.map((s, i) => (
          <li key={s.stat}>
            <button
              type="button"
              role="menuitem"
              aria-label={`${s.name}, ${view.levels[s.stat]}, +${LEVEL_UP[s.stat]} ${s.raises.toLowerCase()}`}
              className={`levelRow${i === pick ? " picked" : ""}${short ? " short" : ""}`}
              onMouseEnter={() => onPick(i)}
              onClick={() => onBuy(i)}
            >
              <span className="shopKey">
                <img src={packUrl(s.icon)} alt="" width={28} height={28} />
              </span>
              <span className="levelName">{s.name}</span>
              <b key={bought?.stat === s.stat ? bought.at : undefined} className={`levelCount${bought?.stat === s.stat ? " pop" : ""}`}>
                {view.levels[s.stat]}
              </b>
            </button>
          </li>
        ))}
      </ul>
      <ul className="levelAfter" aria-live="polite">
        {STATS.map((s) => (
          <li key={s.stat} className={s.stat === picked ? "raised" : undefined}>
            <span>{s.raises}</span>
            <span>
              {view.now[s.stat]}
              {s.stat === picked && <b> -&gt; {view.now[s.stat] + LEVEL_UP[s.stat]}</b>}
            </span>
          </li>
        ))}
      </ul>
      <div className={`levelCost${short ? " short" : ""}`}>
        <span>
          Gold held <span className="shopPrice">{view.gold}</span>
        </span>
        <span>
          Next level <span className="shopPrice">{view.cost}</span>
        </span>
        <span>{short ? `${view.cost - view.gold} gold short` : `${view.gold - view.cost} gold after`}</span>
      </div>
    </div>
  );
}
