"use client";

// The title screen: the live island behind a game menu. Mouse or keys pick
// an entry, that mode's sword marks it, the banner takes its colours, the
// island behind turns to that mode's own, and every way out closes the clouds.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCloudExit } from "../game/Clouds";
import { GameCanvas } from "../game/GameCanvas";

const MENU = [
  { href: "/map", mode: "play", label: "Play", hint: "The War. Raise a town, train an army, take the last island." },
  { href: "/atlas", mode: "atlas", label: "Atlas", hint: "Carry the last fire through the Shattered Reach." },
  { href: "/battle", mode: "skirmish", label: "Skirmish", hint: "Auto chess against three clans. Buy, merge, and outlast them." },
  { href: "/duel", mode: "duel", label: "Duel", hint: "Open a room and send the code to a friend." },
] as const;

export default function Page() {
  const router = useRouter();
  const exit = useCloudExit();
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState(0);
  // Past the first pick the ribbon swaps quickly instead of replaying its rise.
  const [moved, setMoved] = useState(false);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const show = useRef<(i: number) => void>(() => {});

  useEffect(() => show.current(pick), [pick]);

  const go = (href: string): void => exit.leave(() => router.push(href));

  // Arrow keys and W/S step the pick, wrapping; Enter follows the focused link.
  useEffect(() => {
    if (!ready) return;
    items.current[0]?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      const step = ({ ArrowDown: 1, s: 1, S: 1, ArrowUp: -1, w: -1, W: -1 } as Record<string, number>)[e.key];
      if (!step) return;
      e.preventDefault();
      // Focus drives the pick (onFocus), so the key only moves focus.
      const cur = Math.max(0, items.current.indexOf(document.activeElement as HTMLAnchorElement));
      items.current[(cur + step + MENU.length) % MENU.length]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

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
        {ready && (
          <>
            <div className="titleMenu" data-mode={MENU[pick]!.mode}>
              <h1 className={`logo${moved ? " swap" : ""}`} key={MENU[pick]!.mode}>
                Greyfall
                <span className="logoSub">Reign of Ash</span>
              </h1>
              <div className="menuScroll">
                <nav className="menu" aria-label="Main menu">
                  {MENU.map((m, i) => (
                    <Link
                      key={m.href}
                      ref={(el) => {
                        items.current[i] = el;
                      }}
                      href={m.href}
                      className={`menuItem${i === pick ? " on" : ""}`}
                      style={{ "--i": i } as React.CSSProperties}
                      aria-describedby="menuHint"
                      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
                      onFocus={() => {
                        if (i !== pick) setMoved(true);
                        setPick(i);
                      }}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        go(m.href);
                      }}
                    >
                      {m.label}
                    </Link>
                  ))}
                </nav>
                <p id="menuHint" className="menuHint" key={pick}>
                  {MENU[pick]!.hint}
                </p>
                <p className="credit">Developed by Nauqh</p>
              </div>
            </div>
          </>
        )}
      </GameCanvas>
      {exit.cover}
    </main>
  );
}
