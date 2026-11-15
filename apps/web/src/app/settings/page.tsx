"use client";

// The settings, on the title's own scroll over the live island: categories
// ride the sword like the main menu, Controls is the one built, read only.
// Q/E or Left/Right switch the mode inside it, Esc returns to the title.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCloudExit } from "../../game/Clouds";
import { GameCanvas } from "../../game/GameCanvas";
import { CONTROLS } from "./controls";
import "./settings.css";

const STEP: Record<string, number> = { q: -1, Q: -1, ArrowLeft: -1, e: 1, E: 1, ArrowRight: 1 };
// ponytail: only Controls is built; the rest show the shape of the menu.
const CATEGORIES = ["Controls", "Display", "Sound", "Gameplay"];

export default function SettingsPage() {
  const router = useRouter();
  const exit = useCloudExit();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(0);
  const back = (): void => exit.leave(() => router.push("/"));

  useEffect(() => {
    if (!ready) return;
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
  }, [ready]);

  const mode = CONTROLS[tab];

  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/IntroScene").then(({ startIntro }) => startIntro(el))} onReady={() => setReady(true)}>
        {ready && (
          <div className="titleMenu setPanel">
            <h1 className="logo">
              Settings
              <span className="logoSub">Reign of Ash</span>
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
                <Link
                  href="/"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    back();
                  }}
                >
                  <kbd className="setCap">Esc</kbd> Back
                </Link>
              </footer>
            </div>
          </div>
        )}
      </GameCanvas>
      {exit.cover}
    </main>
  );
}
