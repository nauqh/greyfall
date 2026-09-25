"use client";

// The cloud bank as DOM, for the screens that are not a Phaser scene (the
// duel lobby and room) and for the canvas's loading screen. Same layout as
// terrain.ts cloudCover, from art.ts cloudAt, and the same timings, so an
// HTML screen and a scene open and close on one sky.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { CLOUD_DRIFT, cloudAt, cloudAway } from "./art";

// Enough rows and columns for any window; the container clips the rest.
const CLOUDS = Array.from({ length: 14 * 12 }, (_, i) => cloudAt(Math.floor(i / 12), i % 12));

/** How long each mode runs before it is done, as cloudCover times it. */
const OPEN_MS = 1700;
const CLOSE_MS = 1050;

/**
 * "cover" sits still, "open" parts from the middle outward, "close" draws in
 * from the edges. Direction and delay depend on the window, so they are set
 * after mount: server and first client render agree, then the motion starts.
 */
export function Clouds({ mode, onDone }: { mode: "cover" | "open" | "close"; onDone?: () => void }) {
  const [run, setRun] = useState<{ w: number; h: number; u: number } | null>(null);
  const [gone, setGone] = useState(false);
  const layers = useRef<(HTMLDivElement | null)[]>([]);

  // Phase each layer's sway to the wall clock, the way cloudCover does in
  // Phaser, so a DOM cover and a scene's cover hand over mid-sway. A negative
  // delay starts a CSS animation part way through; set here rather than in
  // the markup, where the server's clock would not match the client's.
  useLayoutEffect(() => {
    const now = Date.now();
    layers.current.forEach((el, i) => {
      if (el) el.style.animationDelay = `-${now % (2 * CLOUD_DRIFT[i]!.p)}ms`;
    });
  }, [gone]);

  useEffect(() => {
    if (mode === "cover") return;
    setRun({ w: window.innerWidth, h: window.innerHeight, u: Math.min(window.innerWidth / 1200, window.innerHeight / 720) });
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
      {CLOUD_DRIFT.map((d, layer) => (
        <div
          key={layer}
          ref={(el) => {
            layers.current[layer] = el;
          }}
          className="cloudLayer"
          style={{ zIndex: layer, "--a": d.a, "--p": `${d.p}ms` } as React.CSSProperties}
        >
          {CLOUDS.map((c, i) => {
            if (c.layer !== layer) return null;
            let motion = {};
            if (run) {
              const away = cloudAway(c.x * run.u - run.w / 2, c.y * run.u - run.h / 2, run.w, run.h);
              const delay = mode === "open" ? 200 + away.reach * 350 : (1 - away.reach) * 300;
              const far = run.w * (mode === "open" ? 0.8 : 0.5);
              motion = { "--dx": `${away.dx * far}px`, "--dy": `${away.dy * far}px`, "--delay": `${delay}ms` };
            }
            return (
              <div
                key={i}
                className={`cloud ${c.key}${c.flip ? " flip" : ""}`}
                style={
                  {
                    left: `calc(${c.x} * var(--u))`,
                    top: `calc(${c.y} * var(--u))`,
                    "--s": c.s,
                    ...motion,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      ))}
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
