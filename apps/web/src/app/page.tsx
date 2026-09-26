"use client";

// The title screen: the live island behind a game menu. Mouse or keys pick
// an entry, the sword banner marks it, and every way out closes the clouds.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCloudExit } from "../game/Clouds";
import { GameCanvas } from "../game/GameCanvas";

const MENU = [
  { href: "/map", label: "Play", hint: "The War. Raise a town, train a covenant, take the island." },
  { href: "/battle", label: "Skirmish", hint: "One board, twenty gold. Draft an army and watch it fight." },
  { href: "/duel", label: "Duel", hint: "Open a room and send the code to a friend." },
] as const;

export default function Page() {
  const router = useRouter();
  const exit = useCloudExit();
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState(0);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);

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
        start={(el) => import("../game/IntroScene").then(({ startIntro }) => startIntro(el))}
        onReady={() => setReady(true)}
      >
        {ready && (
          <>
            <div className="titleMenu">
              <h1 className="logo">
                Greyfall
                <span className="logoSub">The last island before the grey</span>
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
                      onFocus={() => setPick(i)}
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
