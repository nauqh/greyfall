import { LEVEL_UP, type Levels } from "@greyfall/engine";

import type { LevelView } from "../../game/AtlasScene";
import { levelOf } from "./RestPanel";
import { LevelBadge, SidePanel } from "./SidePanel";

const STATS: { stat: keyof Levels; name: string; raises: string }[] = [
  { stat: "hp", name: "Vigour", raises: "health" },
  { stat: "attack", name: "Strength", raises: "attack" },
  { stat: "stamina", name: "Endurance", raises: "stamina" },
];

/** Levelling at a bonfire, opened inside its panel after Elden Ring's: each attribute a row with what it raises, the gold below. */
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
  const short = view.gold < view.cost;
  return (
    <SidePanel
      kicker="Level up"
      name={name}
      badge={<LevelBadge level={levelOf(view)} pop={bought?.at} />}
      options={[
        ...STATS.map((s) => ({
          label: s.name,
          note: `+${LEVEL_UP[s.stat]} ${s.raises}, ${view.now[s.stat]} -> ${view.now[s.stat] + LEVEL_UP[s.stat]}`,
          aside: view.levels[s.stat],
          pop: bought?.stat === s.stat ? bought.at : undefined,
          dim: short,
        })),
        { label: "Back", note: "To the bonfire" },
      ]}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      keys="W/S pick   E buy   Esc back"
    >
      <p className="panelNote">Gold buys strength here, as souls did. Each level costs more than the last.</p>
      <div className={`panelCost panelRule${short ? " short" : ""}`}>
        <span>
          Gold held <span className="panelGold">{view.gold}</span>
        </span>
        <span>
          Next level <span className="panelGold">{view.cost}</span>
        </span>
        <span>{short ? `${view.cost - view.gold} gold short` : `${view.gold - view.cost} gold after`}</span>
      </div>
    </SidePanel>
  );
}
