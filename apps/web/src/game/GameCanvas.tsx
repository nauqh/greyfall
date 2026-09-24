"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Clouds } from "./Clouds";

/** Holds one Phaser game at the scene's own ratio. Children render over the
 *  canvas, inside it - the intro's HTML menu lives here. */
export function GameCanvas({
  start,
  children,
}: {
  start: (el: HTMLElement) => Promise<{ destroy: () => void; ready: Promise<void> }>;
  children?: ReactNode;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let game: { destroy: () => void; ready: Promise<void> } | null = null;

    // The scenes themselves are dynamically imported by the page, so Phaser
    // never runs on the server.
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        return start(el);
      })
      .then((g) => {
        if (!g) return;
        if (cancelled) g.destroy();
        else {
          void g.ready.then(() => {
            if (!cancelled) setReady(true);
          });
          game = g;
        }
      })
      // Without this a scene that throws on the way up leaves an empty holder
      // and a silent page, which is a long way from looking like an error.
      .catch((err: unknown) => {
        console.error("[canvas] the scene failed to start", err);
      });

    return () => {
      cancelled = true;
      game?.destroy();
    };
    // Mounts once and stays: later rounds are the scene restarting itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="canvas" ref={holder}>
      {/* Loading label while the scene boots; gone the frame create() runs. */}
      {!ready && (
        <div className="loader" aria-hidden>
          {/* The cloud bank the scenes open and close on, so a page change
              reads as one sky: close, load, part. */}
          <Clouds mode="cover" />
          <div className="loaderText">Loading...</div>
        </div>
      )}
      {children}
    </div>
  );
}
