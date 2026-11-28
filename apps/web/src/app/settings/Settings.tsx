"use client";

// The settings, drawn in place of the title menu on its own scroll: categories
// pick like the main menu, Controls is the one built, read only.
// Q/E or Left/Right switch the mode inside it, Esc returns to the title.

import { useEffect, useState } from "react";

import { type Channel, CLICK, DEFAULT_LEVELS, levels, play, setLevel, useTick } from "../sound";
import { CONTROLS } from "./controls";
import "./settings.css";

const STEP: Record<string, number> = { q: -1, Q: -1, ArrowLeft: -1, e: 1, E: 1, ArrowRight: 1 };
// ponytail: only Controls is built; the rest show the shape of the menu.
const CATEGORIES = ["Controls", "Display", "Sound", "Gameplay"];

export function Settings({ back, leaving }: { back: () => void; leaving: boolean }) {
  const [tab, setTab] = useState(0);
  useTick(tab);

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
            <kbd className="keyCap">Q</kbd>
            <kbd className="keyCap">E</kbd> Switch mode
          </span>
          <button type="button" onClick={back}>
            <kbd className="keyCap wide">Esc</kbd> Back
          </button>
        </footer>
      </div>
    </div>
  );
}

const VOLUMES: { ch: Channel; label: string }[] = [
  { ch: "music", label: "Music" },
  { ch: "sfx", label: "Sound effects" },
];

/**
 * A slider per channel; music is heard as it moves, effects click so the level can be judged. Given a `pick`, A/D or
 * Left/Right move the picked one by key.
 */
export function SoundPane({ pick, onPick }: { pick?: number; onPick?: (i: number) => void }) {
  const [v, setV] = useState(levels);
  const change = (ch: Channel, n: number): void => {
    setLevel(ch, Math.min(1, Math.max(0, Math.round(n * 20) / 20)));
    setV(levels());
    if (ch === "sfx") play(CLICK);
  };
  const reset = (): void => {
    VOLUMES.forEach(({ ch }) => setLevel(ch, DEFAULT_LEVELS[ch]));
    setV(levels());
    play(CLICK);
  };
  useEffect(() => {
    if (pick === undefined) return;
    const onKey = (e: KeyboardEvent): void => {
      // A focused slider takes its own arrows.
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      const d = k === "a" || k === "arrowleft" ? -0.05 : k === "d" || k === "arrowright" ? 0.05 : 0;
      const ch = VOLUMES[pick]?.ch;
      if (d && ch) change(ch, levels()[ch] + d);
      else if ((k === "e" || k === "enter") && !e.repeat && pick === VOLUMES.length) reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  return (
    <section className="setGroup">
      <h2>Volume</h2>
      <dl>
        {VOLUMES.map(({ ch, label }, i) => (
          <div key={ch} className={`setRow${i === pick ? " picked" : ""}`} onMouseEnter={() => onPick?.(i)}>
            <dt>
              <label htmlFor={`vol-${ch}`}>{label}</label>
            </dt>
            <dd>
              <span className="setRange" style={{ "--fill": `${Math.round(v[ch] * 100)}%` } as React.CSSProperties}>
                <input
                  id={`vol-${ch}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(v[ch] * 100)}
                  onChange={(e) => change(ch, Number(e.target.value) / 100)}
                />
              </span>
              <output htmlFor={`vol-${ch}`} className="setPct">
                {Math.round(v[ch] * 100)}%
              </output>
            </dd>
          </div>
        ))}
      </dl>
      {/* After Dark Souls' Defaults, under the settings it puts back. */}
      <div className="panelOptions setDefaults">
        <button type="button" className={`panelOption${pick === VOLUMES.length ? " picked" : ""}`} onMouseEnter={() => onPick?.(VOLUMES.length)} onClick={reset}>
          <span className="panelOptionText">
            <span className="panelOptionName">Defaults</span>
          </span>
        </button>
      </div>
    </section>
  );
}
