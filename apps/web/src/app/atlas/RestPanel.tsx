import type { LevelView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { LevelBadge, SidePanel, type PanelOption } from "./SidePanel";
import "./rest.css";

/** Health, attack and stamina with the icons the HUD and the level up use. */
export const STAT_ICON = { hp: "ui/icon_hp.png", attack: "ui/icon_damage.png", stamina: "UI Elements/UI Elements/Icons/Icon_08.png" } as const;

export function levelOf(view: LevelView): number {
  return 1 + view.levels.hp + view.levels.attack + view.levels.stamina;
}

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
}: {
  name: string;
  area: string;
  view: LevelView;
  flasks: number;
  options: PanelOption[];
  pick: number;
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
}) {
  const stats = [
    { label: "Health", icon: STAT_ICON.hp, value: view.now.hp },
    { label: "Attack", icon: STAT_ICON.attack, value: view.now.attack },
    { label: "Stamina", icon: STAT_ICON.stamina, value: view.now.stamina },
    { label: "Flasks", icon: "ui/icon_heal.png", value: flasks },
    { label: "Gold", icon: "ui/icon_gold.png", value: view.gold, gold: true },
  ];
  return (
    <SidePanel
      kicker="Bonfire"
      name={name}
      sub={area && area !== name ? area : undefined}
      badge={<LevelBadge level={levelOf(view)} />}
      options={options}
      pick={pick}
      onPick={onPick}
      onChoose={onChoose}
      keys="W/S pick   E choose   Esc stand"
    >
      <p className="panelNote">Health and flasks restored. The dead walk again.</p>
      <ul className="restStats panelRule">
        {stats.map((s) => (
          <li key={s.label} className={s.gold ? "restGold" : undefined}>
            <img src={packUrl(s.icon)} alt="" width={24} height={24} />
            <span>{s.label}</span>
            <b>{s.value}</b>
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}
