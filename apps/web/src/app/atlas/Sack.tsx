import { useEffect, useState } from "react";

import type { SackView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { ItemIcon } from "./ItemIcon";
import { STAT_ICON } from "./RestPanel";
import { LevelBadge, SidePanel } from "./SidePanel";
import "./sack.css";

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);

/** The numbers drawn big with an icon, as at a rest; the rest told small below them. */
const MAIN: Partial<Record<SackView["stats"][number]["key"], string>> = { hp: STAT_ICON.hp, attack: STAT_ICON.attack, stamina: STAT_ICON.stamina, flasks: "ui/icon_heal.png" };

/**
 * The captain's sack, after a Souls inventory: in the side panel the rests and merchants use, without stopping the world
 * or moving the camera, since it is opened in the field. Tab opens and closes it.
 */
export function Sack({ sack, gold }: { sack: SackView; gold: number }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (typing(e.target) || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const good = sack.items[Math.min(pick, sack.items.length - 1)];
  const main = sack.stats.filter((s) => MAIN[s.key]);
  const more = sack.stats.filter((s) => !MAIN[s.key]);
  return (
    <>
      {/* Keeps focus off the buttons, so Space rolls rather than pressing them. */}
      <button type="button" className="sackButton" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        Sack <kbd>Tab</kbd>
      </button>
      {open && (
        <div className="sideDock">
          <SidePanel
            kicker="Sack"
            name="The Wanderer"
            sub={`${sack.items.length} ${sack.items.length === 1 ? "good" : "goods"} kept`}
            badge={<LevelBadge level={sack.level} />}
            options={[]}
            pick={-1}
            onPick={() => {}}
            onChoose={() => {}}
            keys="Tab or Esc close"
            role="dialog"
            compact
          >
            <ul className="restStats panelRule">
              {main.map((s) => (
                <li key={s.key}>
                  <img src={packUrl(MAIN[s.key]!)} alt="" width={24} height={24} />
                  <span>{s.label}</span>
                  <b>{s.now}</b>
                </li>
              ))}
              <li className="restGold">
                <img src={packUrl("ui/icon_gold.png")} alt="" width={24} height={24} />
                <span>Gold</span>
                <b>{gold}</b>
              </li>
            </ul>
            <dl className="sackMore">
              {more.map((s) => (
                <div key={s.key}>
                  <dt>{s.label}</dt>
                  <dd>{s.now}</dd>
                </div>
              ))}
            </dl>
            {good ? (
              <>
                <div className="sackGoods">
                  {sack.items.map((s, i) => (
                    <button
                      type="button"
                      key={s.label}
                      className="sackKey"
                      aria-label={s.label}
                      aria-pressed={s === good}
                      onMouseEnter={() => setPick(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setPick(i)}
                    >
                      <ItemIcon icon={s.icon} size={32} />
                    </button>
                  ))}
                </div>
                <div className="sackDetail panelRule" aria-live="polite">
                  <div className="sackDetailHead">
                    <span className="shopKey big">
                      <ItemIcon icon={good.icon} size={40} />
                    </span>
                    <span>
                      <b>{good.label}</b>
                      <span className="sackGives">{good.gives}</span>
                    </span>
                  </div>
                  {good.about && <i className="sackAbout">{good.about}</i>}
                </div>
              </>
            ) : (
              <p className="panelNote">Empty. Merchants sell goods you keep for good, and the folk give some.</p>
            )}
          </SidePanel>
        </div>
      )}
    </>
  );
}
