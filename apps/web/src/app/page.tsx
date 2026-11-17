"use client";

// The title screen: the live island behind a game menu. Mouse or keys pick
// an entry, the sword marks it, the island behind turns to that mode's own,
// and every way out closes the clouds.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCloudExit } from "../game/Clouds";
import { GameCanvas } from "../game/GameCanvas";
import { Settings } from "./settings/Settings";

// An entry without an href opens the settings in place of the menu.
const MENU: readonly { href?: string; label: string; hint: string }[] = [
  { href: "/atlas", label: "Journey", hint: "The story. Wash ashore nameless and hunt the Grey Warlord." },
  { href: "/map", label: "War", hint: "Real-time war on one island: dig gold, raise an army, bring down the red hall." },
  { href: "/versus", label: "Versus", hint: "Auto chess. Buy, merge and place your band, then outlast AI clans or friends." },
  { label: "Settings", hint: "Keys and mouse for every mode." },
];

export default function Page() {
  const router = useRouter();
  const exit = useCloudExit();
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState(0);
  const [settings, setSettings] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const items = useRef<(HTMLElement | null)[]>([]);

  // The open scroll plays its 140ms exit (settings.css), then the other mounts.
  const swap = (to: boolean): void => {
    if (leaving) return;
    setLeaving(true);
    const out = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140;
    setTimeout(() => {
      setSettings(to);
      setSwapped(true);
      setLeaving(false);
    }, out);
  };
  const show = useRef<(i: number) => void>(() => {});

  useEffect(() => show.current(pick), [pick]);

  const go = (href: string): void => exit.leave(() => router.push(href));

  // Arrow keys and W/S step the pick, wrapping; Enter follows the focused link.
  useEffect(() => {
    if (!ready || settings) return;
    // Back from the settings, the sword stays on its entry.
    items.current[pick]?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      const step = ({ ArrowDown: 1, s: 1, S: 1, ArrowUp: -1, w: -1, W: -1 } as Record<string, number>)[e.key];
      if (!step) return;
      e.preventDefault();
      // Focus drives the pick (onFocus), so the key only moves focus.
      const cur = Math.max(0, items.current.indexOf(document.activeElement as HTMLElement));
      items.current[(cur + step + MENU.length) % MENU.length]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings]);

  return (
    <main className="stage">
      <GameCanvas
        start={(el) =>
          import("../game/IntroScene").then(({ startIntro }) => {
            const game = startIntro(el);
            show.current = game.show;
            return game;
          })
        }
        onReady={() => setReady(true)}
      >
        {ready && settings && <Settings leaving={leaving} back={() => swap(false)} />}
        {ready && !settings && (
          <>
            <div className={`titleMenu${swapped ? " swapIn" : ""}${leaving ? " leaving" : ""}`}>
              <h1 className="logo">
                Greyfall
                <span className="logoSub">The Shattered Reach</span>
              </h1>
              <div className="menuScroll">
                <nav className="menu" aria-label="Main menu">
                  {MENU.map((m, i) => {
                    const item = {
                      ref: (el: HTMLElement | null) => {
                        items.current[i] = el;
                      },
                      className: `menuItem${i === pick ? " on" : ""}`,
                      style: { "--i": i } as React.CSSProperties,
                      "aria-describedby": "menuHint",
                      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => e.currentTarget.focus({ preventScroll: true }),
                      onFocus: () => setPick(i),
                    };
                    const href = m.href;
                    return href ? (
                      <Link
                        key={m.label}
                        {...item}
                        href={href}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          go(href);
                        }}
                      >
                        {m.label}
                      </Link>
                    ) : (
                      <button key={m.label} type="button" {...item} onClick={() => swap(true)}>
                        {m.label}
                      </button>
                    );
                  })}
                </nav>
                <p id="menuHint" className="menuHint" key={pick}>
                  {MENU[pick]!.hint}
                </p>
                <p className="credit">© 2026 Designed and built by Nauqh</p>
              </div>
            </div>
          </>
        )}
      </GameCanvas>
      {exit.cover}
    </main>
  );
}
