import { LEVEL_UP, levelCost, type Levels } from "@greyfall/engine";

import type { LevelView } from "../../game/AtlasScene";
import { levelOf } from "./RestPanel";
import { StatIcon } from "./statIcons";
import { SidePanel, useCursor } from "./SidePanel";
import "./levelup.css";

export const STATS: { stat: keyof Levels; name: string; raises: string }[] = [
  { stat: "hp", name: "Vigour", raises: "Health" },
  { stat: "attack", name: "Strength", raises: "Attack" },
  { stat: "stamina", name: "Endurance", raises: "Stamina" },
];

/** The gold the points held would cost, bought one at a time as the scene buys them, each dearer than the last. */
export function heldCost(levels: Levels, held: Levels): number {
  let at = { ...levels };
  let gold = 0;
  for (const { stat } of STATS)
    for (let k = 0; k < held[stat]; k++) {
      gold += levelCost(at);
      at = { ...at, [stat]: at[stat] + 1 };
    }
  return gold;
}

/** Now, a pointer, then after: the after in green when it gains. */
function Change({ now, after, pop }: { now: number; after: number; pop?: number }) {
  return (
    <span className="luChange">
      <span>{now}</span>
      <span className="luTo" aria-label="to" />
      <b key={pop} className={`${after > now ? "luGain" : ""}${pop ? " pop" : ""}`}>
        {after}
      </b>
    </span>
  );
}

/**
 * Levelling at a bonfire after Dark Souls': the level and gold, then the attributes, each with the points held on it
 * (A/D or the arrows take one back or add one), and beside them what the points change. Nothing is spent till E accepts.
 */
export function LevelUp({
  view,
  held,
  pick,
  bought,
  onPick,
  onChoose,
  onShift,
}: {
  view: LevelView;
  held: Levels;
  pick: number;
  bought?: { stat: keyof Levels; at: number };
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
  onShift: (stat: keyof Levels, by: 1 | -1) => void;
}) {
  const level = levelOf(view);
  const adding = held.hp + held.attack + held.stamina;
  const cost = heldCost(view.levels, held);
  const next = levelCost({
    hp: view.levels.hp + held.hp,
    attack: view.levels.attack + held.attack,
    stamina: view.levels.stamina + held.stamina,
  });
  const cursor = useCursor(pick);
  return (
    <SidePanel
      name="Level up"
      options={[]}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      cursor={cursor}
      className="bonfirePanel luPanel"
    >
      <div className="luColumns">
        <div className="luColumn">
          <dl className="luSheet">
            <div>
              <dt>Level</dt>
              <dd>
                <Change now={level} after={level + adding} pop={bought?.at} />
              </dd>
            </div>
            <div>
              <dt>Gold held</dt>
              <dd className="panelGold">{view.gold}</dd>
            </div>
            <div className={view.gold < cost + next ? "luShort" : undefined}>
              <dt>Gold needed</dt>
              <dd className="panelGold">{cost + next}</dd>
            </div>
          </dl>
          <h3 className="panelHeading">Attributes</h3>
          <div className="luAttrs">
            {STATS.map((s, i) => {
              const pop = bought?.stat === s.stat ? bought.at : undefined;
              const more = held[s.stat] > 0;
              return (
                <div
                  key={s.stat}
                  role="menuitem"
                  className={`panelOption luAttr${i === pick ? " picked" : ""}`}
                  onMouseEnter={() => onPick(i)}
                >
                  <span className="statFrame">
                    <StatIcon stat={s.stat} size={22} mono />
                  </span>
                  {/* The bar lights this part only, beside the icon's frame, as Dark Souls lights a name. */}
                  <span ref={cursor.mark(i)} className="luAttrBody">
                    <span className="panelOptionName">{s.name}</span>
                    <button
                      type="button"
                      className="luStep"
                      aria-label={`Fewer ${s.name}`}
                      disabled={!more}
                      onClick={() => onShift(s.stat, -1)}
                    >
                      ‹
                    </button>
                    <b key={pop} className={`panelAside${more ? " luGain" : ""}${pop ? " pop" : ""}`}>
                      {view.levels[s.stat] + held[s.stat]}
                    </b>
                    <button
                      type="button"
                      className="luStep"
                      aria-label={`More ${s.name}`}
                      disabled={view.gold < cost + next}
                      onClick={() => onShift(s.stat, 1)}
                    >
                      ›
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="luColumn">
          <h3 className="panelHeading">Character status</h3>
          <dl className="luSheet">
            {STATS.map((s) => (
              <div key={s.stat}>
                <dt>
                  <span className="statFrame">
                    <StatIcon stat={s.stat} size={18} mono />
                  </span>
                  {s.raises}
                </dt>
                <dd>
                  <Change now={view.now[s.stat]} after={view.now[s.stat] + LEVEL_UP[s.stat] * held[s.stat]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SidePanel>
  );
}
