"use client";

// The settings, drawn in place of the title menu on its own scroll: categories
// ride the sword like the main menu, Controls is the one built, read only.
// Q/E or Left/Right switch the mode inside it, Esc returns to the title.

import { useEffect, useState } from "react";

import { CONTROLS } from "./controls";
import "./settings.css";

const STEP: Record<string, number> = { q: -1, Q: -1, ArrowLeft: -1, e: 1, E: 1, ArrowRight: 1 };
// ponytail: only Controls is built; the rest show the shape of the menu.
const CATEGORIES = ["Controls", "Display", "Sound", "Gameplay"];

export function Settings({ back, leaving }: { back: () => void; leaving: boolean }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") return back();
      const step = STEP[e.key];
      if (!step) return;
      e.preventDefault();
      setTab((t) => (t + step + CONTROLS.length) % CONTROLS.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = CONTROLS[tab];

  return (
    <div className={`titleMenu setPanel${leaving ? " leaving" : ""}`}>
      <h1 className="logo">
        Settings
        <span className="logoSub">Ashen Crown</span>
      </h1>
      <div className="menuScroll setScroll">
        <nav className="menu setCats" aria-label="Settings">
          {CATEGORIES.map((c, i) => (
            <span
              key={c}
              className={`menuItem${i === 0 ? " on" : " off"}`}
              style={{ "--i": i } as React.CSSProperties}
              aria-current={i === 0 ? "page" : undefined}
              aria-disabled={i !== 0 || undefined}
            >
              {c}
            </span>
          ))}
        </nav>

        <div className="setPane">
          <div className="setModes" role="tablist" aria-label="Game modes">
            {CONTROLS.map((m, i) => (
              <button
                key={m.id}
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={i === tab}
                aria-controls="setBody"
                className={`setMode${i === tab ? " on" : ""}`}
                onClick={() => setTab(i)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode && (
            <div id="setBody" className="setBody" role="tabpanel" aria-labelledby={`tab-${mode.id}`} key={mode.id}>
              {mode.groups.map((g) => (
                <section key={g.title} className="setGroup">
                  <h2>{g.title}</h2>
                  <dl>
                    {g.binds.map((b) => (
                      <div key={b.action} className="setRow">
                        <dt>{b.action}</dt>
                        <dd>
                          {b.keys.map((k) => (
                            <span key={k} className="setCombo">
                              {k.split("+").map((p, i) => (
                                <span key={p}>
                                  {i > 0 && "+"}
                                  <kbd className="setCap">{p}</kbd>
                                </span>
                              ))}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="menuHint setFoot">
          <span>
            <kbd className="setCap">Q</kbd>
            <kbd className="setCap">E</kbd> Switch mode
          </span>
          <button type="button" onClick={back}>
            <kbd className="setCap">Esc</kbd> Back
          </button>
        </footer>
      </div>
    </div>
  );
}
