"use client";

// Hover tooltips for the Phaser draft cards. The scene reports hover with
// native pointer coordinates; the tooltip renders here, over the canvas, as
// plain styled text - no game art, and the box hugs the text.

import { useCallback, useState } from "react";

export interface TipState {
  text: string;
  x: number;
  y: number;
}

/** Tooltip state plus the stable setter the scene gets via its launcher. */
export function useStatTip(): { tip: TipState | null; onTip: (text: string | null, x: number, y: number) => void } {
  const [tip, setTip] = useState<TipState | null>(null);
  const onTip = useCallback((text: string | null, x: number, y: number) => {
    setTip(text ? { text, x, y } : null);
  }, []);
  return { tip, onTip };
}

export function StatTip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div className="statTip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}