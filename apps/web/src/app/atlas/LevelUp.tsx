import { LEVEL_UP, type Levels } from "@greyfall/engine";

import type { LevelView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { STAT_ICON, levelOf } from "./RestPanel";
import { SidePanel } from "./SidePanel";
import "./levelup.css";

const STATS: { stat: keyof Levels; name: string; raises: string }[] = [
  { stat: "hp", name: "Vigour", raises: "Health" },
  { stat: "attack", name: "Strength", raises: "Attack" },
  { stat: "stamina", name: "Endurance", raises: "Stamina" },
];

const ICONS = "UI Elements/UI Elements/Icons/";

/** Now, a pointer, then after: the after in green when it gains. */
function Change({ now, after, pop }: { now: number; after: number; pop?: number }) {
  return (
    <span className="luChange">
      <span>{now}</span>
      <span className="luTo" aria-label="to" />
      <b key={pop} className={`${after > now ? "luGain" : ""}${pop ? " pop" : ""}`}>{after}</b>
    </span>
  );
}

/** Levelling at a bonfire after Elden Ring's: the level and the gold at the head, the attributes to raise, then what the picked one changes. */
export function LevelUp({
  name,
  view,
  pick,
  bought,
  onPick,
  onChoose,
}: {
  name: string;
  view: LevelView;
  pick: number;
  bought?: { stat: keyof Levels; at: number };
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
}) {
  const level = levelOf(view);
  const short = view.gold < view.cost;
  const raising = STATS[pick]?.stat;
  return (
    <SidePanel
      kicker="Level up"
      name={name}
      options={[{ label: "Back", note: "To the bonfire", i: STATS.length }]}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      keys="W/S pick   E raise   Esc back"
    >
      <dl className="luSheet">
        <div>
          <dt>Level</dt>
          <dd>
            <Change now={level} after={level + 1} pop={bought?.at} />
          </dd>
        </div>
        <div>
          <dt>Gold held</dt>
          <dd className="panelGold">{view.gold}</dd>
        </div>
        <div className={short ? "luShort" : undefined}>
          <dt>Gold needed</dt>
          <dd className="panelGold">{view.cost}</dd>
        </div>
      </dl>
      <h3 className="panelHeading">
        <img src={packUrl(`${ICONS}Icon_07.png`)} alt="" className="luUp" />
        Attributes
      </h3>
      <div className="luAttrs">
        {STATS.map((s, i) => {
          const pop = bought?.stat === s.stat ? bought.at : undefined;
          return (
            <button
              key={s.stat}
              type="button"
              role="menuitem"
              className={`panelOption luAttr${i === pick ? " picked" : ""}${short ? " dim" : ""}`}
              onMouseEnter={() => onPick(i)}
              onClick={() => onChoose(i)}
            >
              <img src={packUrl(STAT_ICON[s.stat])} alt="" width={22} height={22} />
              <span className="panelOptionName">{s.name}</span>
              <b key={pop} className={`panelAside${pop ? " pop" : ""}`}>
                {view.levels[s.stat]}
              </b>
              <img src={packUrl(`${ICONS}Icon_07.png`)} alt="Raise" className="luUp luRaise" />
            </button>
          );
        })}
      </div>
      <h3 className="panelHeading">
        <img src={packUrl(`${ICONS}Icon_06.png`)} alt="" />
        Character status
      </h3>
      <dl className="luSheet">
        {STATS.map((s) => (
          <div key={s.stat}>
            <dt>
              <img src={packUrl(STAT_ICON[s.stat])} alt="" width={18} height={18} />
              {s.raises}
            </dt>
            <dd>
              <Change now={view.now[s.stat]} after={view.now[s.stat] + (s.stat === raising ? LEVEL_UP[s.stat] : 0)} />
            </dd>
          </div>
        ))}
      </dl>
    </SidePanel>
  );
}
