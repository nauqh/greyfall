import { useEffect, useState } from "react";

import type { SackView } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import "./sack.css";

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);

/** The captain's sack, after a Souls inventory: their numbers over the goods kept, the hovered good told below. I or Tab opens it. */
export function Sack({ sack }: { sack: SackView }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (typing(e.target) || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab") e.preventDefault();
      if (e.key === "Tab" || e.key.toLowerCase() === "i") setOpen((o) => !o);
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const good = sack.items[Math.min(pick, sack.items.length - 1)];
  return (
    <>
      {/* Keeps focus off the buttons, so Space rolls rather than pressing them. */}
      <button type="button" className="sackButton" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        Sack <kbd>I</kbd>
      </button>
      {open && (
        <div className="sack" role="dialog" aria-label="Sack">
          <span className="sackTitle">Sack</span>
          {sack.stats.length > 0 && (
            <dl className="sackStats">
              {sack.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.now}</dd>
                </div>
              ))}
            </dl>
          )}
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
              <div className="sackDetail" aria-live="polite">
                <b>{good.label}</b>
                <span className="sackGives">{good.gives}</span>
                {good.about && <span className="sackAbout">{good.about}</span>}
              </div>
            </>
          ) : (
            <span className="sackEmpty">Empty. Merchants sell goods you keep for good.</span>
          )}
        </div>
      )}
    </>
  );
}
