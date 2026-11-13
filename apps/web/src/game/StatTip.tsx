"use client";

// Hover tooltips for the Phaser draft cards. The scene reports hover with
// native pointer coordinates; the tooltip renders here, over the canvas, as
// ink on the kit's paper, clamped to the viewport.

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

/** Title is the text before the first colon, comma or full stop. */
function splitTip(text: string): { title: string; body: string } {
  const cuts = [text.indexOf(": "), text.indexOf(", "), text.indexOf(". ")].filter((i) => i !== -1);
  if (cuts.length === 0) return { title: text, body: "" };
  const cut = Math.min(...cuts);
  return { title: text.slice(0, cut), body: text.slice(cut + 2) };
}

/** Body sentences, each on its own line; the last keeps its full stop. */
function bodyLines(body: string): string[] {
  return body
    .split(". ")
    .map((line, i, all) => (i < all.length - 1 ? `${line.trim()}.` : line.trim()))
    .filter(Boolean);
}

export function StatTip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  const { title, body } = splitTip(tip.text);
  const lines = bodyLines(body);
  return (
    <div
      className="statTip"
      style={{ "--tip-x": `${tip.x}px`, "--tip-y": `${tip.y}px` } as React.CSSProperties}
    >
      <div className="statTipTitle">{title.replace(/\.$/, "")}</div>
      {lines.map((line, i) => (
        <div className="statTipLine" key={i}>
          {i === 0 ? line.charAt(0).toUpperCase() + line.slice(1) : line}
        </div>
      ))}
    </div>
  );
}
