"use client";

// The cloud bank as DOM, for the screens that are not a Phaser scene (the
// duel lobby and room) and for the canvas's loading screen. Same layout as
// terrain.ts cloudCover, from art.ts cloudAt, and the same timings, so an
// HTML screen and a scene open and close on one sky.

import { useEffect, useState, type ReactNode } from "react";

import { cloudAt } from "./art";

// Enough rows and columns for any window; the container clips the rest.
const CLOUDS = Array.from({ length: 14 * 12 }, (_, i) => cloudAt(Math.floor(i / 12), i % 12));

/** How long each mode runs before it is done, as cloudCover times it. */
const OPEN_MS = 1700;
const CLOSE_MS = 1150;

/**
 * "cover" sits still, "open" parts from the middle outward, "close" draws in
 * from the sides. Direction and delay depend on the window, so they are set
 * after mount: server and first client render agree, then the motion starts.
 */
export function Clouds({ mode, onDone }: { mode: "cover" | "open" | "close"; onDone?: () => void }) {
  const [run, setRun] = useState<{ w: number; u: number } | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (mode === "cover") return;
    setRun({ w: window.innerWidth, u: Math.min(window.innerWidth / 1200, window.innerHeight / 720) });
    const t = setTimeout(() => {
      if (mode === "open") setGone(true);
      onDone?.();
    }, mode === "open" ? OPEN_MS : CLOSE_MS);
    return () => clearTimeout(t);
    // Runs once per mount: a new mode is a new cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  return (
    <div className={`clouds ${mode}${run ? " run" : ""}`} aria-hidden>
      <div className="cloudsSky" />
      {CLOUDS.map((c, i) => {
        let motion = {};
        if (run) {
          const x = c.x * run.u;
          const reach = Math.abs(x - run.w / 2) / (run.w / 2);
          const delay = mode === "open" ? 200 + reach * 350 : (1 - Math.min(1, reach)) * 300;
          motion = { "--dx": `${Math.sign(x - run.w / 2 || 1) * run.w * 0.8}px`, "--delay": `${delay}ms` };
        }
        return (
          <div
            key={i}
            className={`cloud ${c.key}${c.flip ? " flip" : ""}`}
            style={{ left: `calc(${c.x} * var(--u))`, top: `calc(${c.y} * var(--u))`, zIndex: c.layer, ...motion }}
          />
        );
      })}
    </div>
  );
}

/**
 * For a DOM screen's exits: `leave(go)` closes the clouds and then runs `go`.
 * Render `cover` somewhere in the screen; it is null until a leave starts.
 */
export function useCloudExit(): { cover: ReactNode; leave: (go: () => void) => void } {
  const [go, setGo] = useState<(() => void) | null>(null);
  return {
    cover: go ? <Clouds mode="close" onDone={go} /> : null,
    // First exit wins: a double click must not restart the close.
    leave: (next) => setGo((cur) => cur ?? next),
  };
}
