"use client";

// The controls sheet: read only, one tab per mode, laid out like a Souls
// options screen. Q/E or Left/Right switch tabs, Esc returns to the title.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCloudExit } from "../../game/Clouds";
import { CONTROLS } from "./controls";
import "./settings.css";

const STEP: Record<string, number> = { q: -1, Q: -1, ArrowLeft: -1, e: 1, E: 1, ArrowRight: 1 };

export default function SettingsPage() {
  const router = useRouter();
  const exit = useCloudExit();
  const [tab, setTab] = useState(0);
  const back = (): void => exit.leave(() => router.push("/"));

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
    <main className="setStage">
      <section className="setPanel" aria-labelledby="setTitle">
        <header className="setHead">
          <h1 id="setTitle">Controls</h1>
          <nav className="setTabs" role="tablist" aria-label="Game modes">
            <kbd className="setCap dim">Q</kbd>
            {CONTROLS.map((m, i) => (
              <button
                key={m.id}
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={i === tab}
                aria-controls="setBody"
                className={`setTab${i === tab ? " on" : ""}`}
                onClick={() => setTab(i)}
              >
                {m.label}
              </button>
            ))}
            <kbd className="setCap dim">E</kbd>
          </nav>
        </header>

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
                                <kbd className={`setCap${p.length > 1 ? " wide" : ""}`}>{p}</kbd>
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

        <footer className="setFoot">
          <span>
            <kbd className="setCap">Q</kbd>
            <kbd className="setCap">E</kbd>:Switch tab
          </span>
          <Link
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              back();
            }}
          >
            <kbd className="setCap wide">Esc</kbd>:Back
          </Link>
        </footer>
      </section>
      {exit.cover}
    </main>
  );
}
