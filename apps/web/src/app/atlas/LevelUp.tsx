import { ATTRIBUTES, heroLevel, levelCost, type Attribute, type Kit, type Levels } from "@greyfall/engine";
import type { ReactNode } from "react";

import type { LevelView } from "../../game/AtlasScene";
import { StatIcon, type Stat } from "./statIcons";
import { SidePanel, useCursor } from "./SidePanel";
import "./levelup.css";

export const STATS: { stat: Attribute; name: string; icon: Stat }[] = [
  { stat: "vigour", name: "Vigour", icon: "hp" },
  { stat: "endurance", name: "Endurance", icon: "stamina" },
  { stat: "strength", name: "Strength", icon: "attack" },
  { stat: "agility", name: "Agility", icon: "agility" },
  { stat: "intelligence", name: "Intelligence", icon: "intelligence" },
  { stat: "warmth", name: "Warmth", icon: "flasks" },
  { stat: "luck", name: "Luck", icon: "luck" },
];

/** The levels with the points held on them. */
export function plus(levels: Levels, held: Levels): Levels {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, levels[a] + held[a]])) as Levels;
}

const pct = (n: number) => `${n}%`;
/** The numbers the attributes move, as Dark Souls' status lists them; `lower` where less is better. */
const STATUS: { label: string; icon: Stat; of: (k: Kit) => number; words?: (n: number) => string; lower?: boolean }[] = [
  { label: "Health", icon: "hp", of: (k) => k.hp },
  { label: "Stamina", icon: "stamina", of: (k) => k.stamina },
  { label: "Attack", icon: "attack", of: (k) => k.attack },
  { label: "Swing speed", icon: "agility", of: (k) => Math.round(100 / k.swing), words: pct },
  { label: "Roll cost", icon: "walk", of: (k) => k.roll, lower: true },
  { label: "Ember heal", icon: "flasks", of: (k) => k.flask },
  { label: "Gold from kills", icon: "gold", of: (k) => Math.round(k.greed * 100), words: pct },
  { label: "Trade goods", icon: "luck", of: (k) => Math.round(k.find * 100), words: pct },
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

/** Now, a pointer, then after: the after in green when it gains, and the pointer and after kept hidden till it moves. */
function Change({ now, after, pop, lower, words = String }: { now: number; after: number; pop?: number; lower?: boolean; words?: (n: number) => string }) {
  return (
    <span className={`luChange${after === now ? " still" : ""}`}>
      <span>{words(now)}</span>
      <span className="luTo" aria-label="to" />
      <b key={pop} className={`${(lower ? after < now : after > now) ? "luGain" : ""}${pop ? " pop" : ""}`}>
        {words(after)}
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
  foot,
}: {
  view: LevelView;
  held: Levels;
  pick: number;
  bought?: { stat: keyof Levels; at: number };
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
  onShift: (stat: keyof Levels, by: 1 | -1) => void;
  foot?: ReactNode;
}) {
  const level = heroLevel(view.levels);
  const adding = heroLevel(held) - 1;
  const cost = heldCost(view.levels, held);
  const after = plus(view.levels, held);
  const next = levelCost(after);
  const then = view.with(after);
  const cursor = useCursor(pick);
  const standing: { label: string; icon: Stat; value: number | string }[] = [{ label: "Embers", icon: "flasks", value: view.kit.flasks }];
  return (
    <SidePanel
      name="Level up"
      options={[]}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      cursor={cursor}
      className="bonfirePanel luPanel"
      foot={foot}
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
                    <StatIcon stat={s.icon} size={22} mono />
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
            {STATUS.map((s) => (
              <div key={s.label}>
                <dt>
                  <span className="statFrame">
                    <StatIcon stat={s.icon} size={18} mono />
                  </span>
                  {s.label}
                </dt>
                <dd>
                  <Change now={s.of(view.kit)} after={s.of(then)} lower={s.lower} words={s.words} />
                </dd>
              </div>
            ))}
          </dl>
          {/* Then, as Dark Souls lists poise and item discovery, the numbers a level does not move. */}
          <dl className="luSheet">
            {standing.map((r) => (
              <div key={r.label}>
                <dt>
                  <span className="statFrame">
                    <StatIcon stat={r.icon} size={18} mono />
                  </span>
                  {r.label}
                </dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SidePanel>
  );
}
