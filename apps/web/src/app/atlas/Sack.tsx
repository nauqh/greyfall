import { useEffect, useState } from "react";

import type { SackView } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import "./sack.css";

/** The captain's sack: its button by the purse, and on I the goods kept for good. */
export function Sack({ sack }: { sack: SackView }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      if (e.key.toLowerCase() === "i") setOpen((o) => !o);
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <button type="button" className="sackButton" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Sack <kbd>I</kbd>
      </button>
      {open && (
        // What the merchants sold, kept for good: each good and what it gives.
        <div className="sack" role="dialog" aria-label="Sack">
          <span className="sackTitle">Sack</span>
          {sack.items.length === 0 ? (
            <span className="sackEmpty">Empty. Merchants sell goods you keep for good.</span>
          ) : (
            <ul>
              {sack.items.map((s) => (
                <li key={s.label}>
                  <span className="sackKey">
                    <ItemIcon icon={s.icon} size={32} />
                  </span>
                  <span>
                    <b>{s.label}</b>
                    <br />
                    {s.gives}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
