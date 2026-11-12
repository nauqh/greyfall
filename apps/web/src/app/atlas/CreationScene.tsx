import { useEffect, useRef, useState } from "react";
import type { HeroClass } from "@greyfall/engine";

import type { SackItem } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import type { CLASS_ROWS } from "./Creation";
import { ItemIcon } from "./ItemIcon";
import "./creationScene.css";

/** About `want` times the art's size, snapped so each of its pixels covers whole screen pixels, as pixel art stays sharp. */
function zoom(want: number): number {
  const d = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // A few percent short still takes the step: only the foam's outer ring would be cut.
  return Math.max(1, Math.floor(want * d + 0.04)) / d;
}

/** Each class's own moves, played in turn between spells of idling: the warrior's cut and guard, the lancer's thrust and brace. */
const MOVES: Record<HeroClass, { sheet: string; frames: number }[]> = {
  warrior: [
    { sheet: "Units/Blue Units/Warrior/Warrior_Attack1.png", frames: 4 },
    { sheet: "Units/Blue Units/Warrior/Warrior_Guard.png", frames: 6 },
  ],
  lancer: [
    { sheet: "Units/Blue Units/Lancer/Lancer_Right_Attack.png", frames: 3 },
    { sheet: "Units/Blue Units/Lancer/Lancer_Right_Defence.png", frames: 6 },
  ],
};

/** The stage in art pixels: wide enough for the lancer's thrust, tall enough for its lance held up. */
const STAGE = { w: 250, h: 220 };
const IDLE_MS = 2600;

/** The class on show: on a rock in the Reach's sea, in daylight, idling and now and then showing its moves; the gift at its feet. */
export function CreationScene({ row, gift }: { row: (typeof CLASS_ROWS)[number]; gift?: SackItem }) {
  const view = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(2);
  useEffect(() => {
    const el = view.current!;
    const fit = () => setK(zoom(Math.min(el.clientWidth / STAGE.w, el.clientHeight / STAGE.h)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Even beats idle; odd beats play the next move once.
  const [beat, setBeat] = useState(0);
  useEffect(() => setBeat(0), [row.cls]);
  useEffect(() => {
    if (beat % 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setBeat((b) => b + 1), IDLE_MS);
    return () => clearTimeout(t);
  }, [beat]);
  const move = beat % 2 ? MOVES[row.cls][((beat - 1) / 2) % MOVES[row.cls].length]! : { sheet: row.idle, frames: row.frames };

  return (
    <div className="crScene" aria-hidden="true">
      <div ref={view} className="crView" style={{ "--k": k, "--cloud": `url("${packUrl("Terrain/Decorations/Clouds/Clouds_03.png")}")`, "--cloud2": `url("${packUrl("Terrain/Decorations/Clouds/Clouds_04.png")}")`, "--sea": `url("${packUrl("Terrain/Tileset/Water Background color.png")}")` } as React.CSSProperties}>
        <div className="crStand" style={{ "--isle": `url("${packUrl("Terrain/Tileset/Tilemap_color1.png")}")`, "--foam": `url("${packUrl("Terrain/Tileset/Water Foam.png")}")` } as React.CSSProperties}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="crFoam" style={{ "--i": i } as React.CSSProperties} />
          ))}
          <span className="crIsle" />
          <span
            key={`${row.cls}:${beat}`}
            className={`crFigure${beat % 2 ? " once" : ""}${beat === 0 ? " enter" : ""}`}
            style={{ "--sheet": `url("${packUrl(move.sheet)}")`, "--frames": move.frames, "--frame": `${row.frame}px`, "--feet": `${row.feet}px` } as React.CSSProperties}
            onAnimationEnd={(e) => e.animationName === "crFrames" && beat % 2 && setBeat((b) => b + 1)}
          />
          {gift && (
            <span key={gift.label} className="crGift">
              <ItemIcon icon={gift.icon} size={Math.round(16 * k)} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
