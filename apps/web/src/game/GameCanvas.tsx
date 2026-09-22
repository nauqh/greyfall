"use client";

import { useEffect, useRef } from "react";

/** Holds one Phaser game at the scene's own ratio. */
export function GameCanvas({
  start,
}: {
  start: (el: HTMLElement) => Promise<{ destroy: () => void }>;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let game: { destroy: () => void } | null = null;

    // Imported in the effect so Phaser never runs on the server.
    void import("../game/boot")
      .then(({ GAME_W, GAME_H }) => {
        if (cancelled) return null;
        // The scene owns the proportions. Hardcoding them in CSS letterboxes
        // FIT into a wrongly shaped box every time the layout moves.
        el.style.aspectRatio = `${GAME_W} / ${GAME_H}`;
        // Cap width by what the viewport height allows, or a short viewport
        // clamps height only and FIT letterboxes the sides.
        el.style.maxWidth = `min(1180px, calc((100vh - 28px) * ${GAME_W} / ${GAME_H}))`;
        return start(el);
      })
      .then((g) => {
        if (!g) return;
        if (cancelled) g.destroy();
        else game = g;
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

  return <div className="canvas" ref={holder} />;
}
