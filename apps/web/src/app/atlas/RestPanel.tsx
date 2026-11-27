import { heroLevel } from "@greyfall/engine";
import type { ReactNode } from "react";

import type { LevelView } from "../../game/AtlasScene";
import { LevelBadge, SidePanel, useCursor, type PanelOption } from "./SidePanel";
import { StatIcon, type Stat } from "./statIcons";
import "./rest.css";

/** Sat at a bonfire: where, the level, what resting did, the wanderer's numbers, then travel, level up or leave. */
export function RestPanel({
  name,
  area,
  view,
  flasks,
  options,
  pick,
  onPick,
  onChoose,
  foot,
}: {
  name: string;
  area: string;
  view: LevelView;
  flasks: number;
  options: PanelOption[];
  pick: number;
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
  foot?: ReactNode;
}) {
  const stats: { label: string; icon: Stat; value: number; gold?: boolean }[] = [
    { label: "Health", icon: "hp", value: view.kit.hp },
    { label: "Attack", icon: "attack", value: view.kit.attack },
    { label: "Stamina", icon: "stamina", value: view.kit.stamina },
    { label: "Embers", icon: "flasks", value: flasks },
    { label: "Gold", icon: "gold", value: view.gold, gold: true },
  ];
  return (
    <SidePanel
      kicker="Bonfire"
      name={name}
      sub={area && area !== name ? area : undefined}
      badge={<LevelBadge level={heroLevel(view.levels)} />}
      options={options}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      cursor={useCursor(pick)}
      className="bonfirePanel"
      foot={foot}
    >
      <p className="panelNote">Health and embers restored. The dead walk again.</p>
      <ul className="restStats panelRule">
        {stats.map((s) => (
          <li key={s.label} className={s.gold ? "restGold" : undefined}>
            <span className="statFrame">
              <StatIcon stat={s.icon} mono />
            </span>
            <span>{s.label}</span>
            <b>{s.value}</b>
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}
