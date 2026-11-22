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

/** Each class's own moves, played in turn between spells of idling: the warrior's cut and guard, the bamboo-folk's blow and brace. */
const MOVES: Record<HeroClass, { sheet: string; frames: number }[]> = {
  warrior: [
    { sheet: "Units/Blue Units/Warrior/Warrior_Attack1.png", frames: 4 },
    { sheet: "Units/Blue Units/Warrior/Warrior_Guard.png", frames: 6 },
  ],
  eggwarden: [{ sheet: "Enemy Pack/Lizard/Lizard_Attack.png", frames: 9 }],
  champion: [{ sheet: "Enemy Pack/Minotaur/Minotaur_Attack.png", frames: 12 }],
  grovekeeper: [
    { sheet: "Enemy Pack/Panda/Panda_Attack.png", frames: 13 },
    { sheet: "Enemy Pack/Extra/Panda Guard/Panda_Guard.png", frames: 8 },
  ],
  barrowWarden: [{ sheet: "Enemy Pack/Hex Shaman/Hex Shaman_Attack.png", frames: 10 }],
};

const IDLE_MS = 2600;
const TILE = 64;

/** The shore in 64px tiles, `.` sea and `g` grass: the land runs off the top and both sides, down to the waterline. */
const MAP = [
  "ggggggggggggg",
  "ggggggggggggg",
  "ggggggggggggg",
  "gggggggggggg.",
  ".ggggggggg...",
  "...gggg......",
  ".............",
  ".............",
  ".............",
];
/** The tile the class stands on, a step up from the water. */
const HERO = { c: 5, r: 4 };
/** How far down the scene the class's feet are, in percent. */
const FEET = 56;

/** What is on the shore and in the shallows: each one's sheet, its square frame and count, the row its foot is on, and
 *  where that foot stands in tiles from the class's feet. The boat it came in drifts empty off the beach. */
const SHORE: { sheet: string; frame: number; frames: number; foot: number; dx: number; dy: number }[] = [
  { sheet: "Terrain/Resources/Wood/Trees/Tree4.png", frame: 192, frames: 8, foot: 169, dx: 1.4, dy: -2.3 },
  { sheet: "Terrain/Resources/Wood/Trees/Tree3.png", frame: 192, frames: 8, foot: 169, dx: -1.6, dy: -2 },
  { sheet: "Terrain/Decorations/Bushes/Bushe3.png", frame: 128, frames: 8, foot: 78, dx: -0.3, dy: -1.4 },
  { sheet: "Terrain/Decorations/Bushes/Bushe1.png", frame: 128, frames: 8, foot: 78, dx: -2.3, dy: -0.9 },
  { sheet: "Resources/Sheep/HappySheep_Idle.png", frame: 128, frames: 8, foot: 86, dx: 1.3, dy: -0.4 },
  { sheet: "Terrain/Resources/Wood/Wood Resource/Wood Resource.png", frame: 64, frames: 1, foot: 46, dx: 1.1, dy: 0.6 },
  { sheet: "Terrain/Resources/Wood/Wood Resource/Wood Resource.png", frame: 64, frames: 1, foot: 46, dx: -1.2, dy: 0.8 },
  { sheet: "Terrain/Decorations/Rocks in the Water/Water Rocks_02.png", frame: 64, frames: 16, foot: 47, dx: 2.3, dy: 1.5 },
  { sheet: "Enemy Pack/Extra/Boat/Boat_Idle.png", frame: 256, frames: 8, foot: 170, dx: 0.6, dy: 2 },
  { sheet: "Terrain/Decorations/Rocks in the Water/Water Rocks_01.png", frame: 64, frames: 16, foot: 47, dx: -1.8, dy: 2.3 },
];

const at = (r: number, c: number) => MAP[r]?.[c] ?? ".";
const isLand = (r: number, c: number) => at(r, c) !== ".";

/** The tileset's autotile cell for a piece of the land: its 3 by 3 block, the one-wide column right of it, the one-tall
 *  row under it and the lone tile, chosen by which sides the land goes on. */
function piece(has: (r: number, c: number) => boolean, r: number, c: number): [number, number] {
  const w = has(r, c - 1);
  const e = has(r, c + 1);
  const n = has(r - 1, c);
  const s = has(r + 1, c);
  return [w && e ? 1 : e ? 0 : w ? 2 : 3, n && s ? 1 : s ? 0 : n ? 2 : 3];
}

/** The shore at the art's own size, foam frame `tick`: the foam along the coast, then the grass. */
function drawIsle(g: CanvasRenderingContext2D, tiles: HTMLImageElement, foam: HTMLImageElement, tick: number): void {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const cells = MAP.flatMap((row, r) => [...row].map((_, c) => [r, c] as const));
  for (const [r, c] of cells) {
    if (!isLand(r, c) || (isLand(r - 1, c) && isLand(r + 1, c) && isLand(r, c - 1) && isLand(r, c + 1))) continue;
    const f = (tick + r * 7 + c * 3) % 16;
    g.drawImage(foam, f * 192, 0, 192, 192, (c - 1) * TILE, (r - 1) * TILE, 192, 192);
  }
  const tile = (x: number, y: number, r: number, c: number) => g.drawImage(tiles, x * TILE, y * TILE, TILE, TILE, c * TILE, r * TILE, TILE, TILE);
  for (const [r, c] of cells) {
    if (isLand(r, c)) tile(...piece(isLand, r, c), r, c);
  }
}

/** The world behind creation: the shore the class washed up on, the boat empty in the shallows, and the class on show at
 *  the waterline, idling and now and then showing its moves, the gift at its feet. Everything at one whole scale. */
export function CreationScene({ row, gift }: { row: (typeof CLASS_ROWS)[number]; gift?: SackItem }) {
  const view = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(2);
  useEffect(() => {
    const el = view.current!;
    const fit = () => setK(zoom(el.clientHeight >= 880 && el.clientWidth >= 1500 ? 3 : el.clientHeight >= 560 ? 2 : 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const land = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = land.current!.getContext("2d")!;
    const tiles = new Image();
    const foam = new Image();
    tiles.src = packUrl("Terrain/Tileset/Tilemap_color1.png");
    foam.src = packUrl("Terrain/Tileset/Water Foam.png");
    let tick = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    Promise.all([tiles.decode(), foam.decode()]).then(
      () => {
        drawIsle(g, tiles, foam, 0);
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        timer = setInterval(() => drawIsle(g, tiles, foam, ++tick), 100);
      },
      () => {},
    );
    return () => clearInterval(timer);
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
      <div ref={view} className="crView" style={{ "--k": k, "--stand": `${FEET}%`, "--cloud": `url("${packUrl("Terrain/Decorations/Clouds/Clouds_03.png")}")`, "--cloud2": `url("${packUrl("Terrain/Decorations/Clouds/Clouds_05.png")}")` } as React.CSSProperties}>
        <canvas
          ref={land}
          className="crLand"
          width={MAP[0]!.length * TILE}
          height={MAP.length * TILE}
          style={{ "--landCol": HERO.c + 0.5, "--landRow": HERO.r + 0.6, "--cols": MAP[0]!.length, "--rows": MAP.length } as React.CSSProperties}
        />
        {SHORE.map((d, i) => (
          <span
            key={i}
            className="crDecor"
            style={{ "--dx": d.dx, "--dy": d.dy, zIndex: Math.round(50 + d.dy * 10), "--sheet": `url("${packUrl(d.sheet)}")`, "--frames": d.frames, "--frame": `${d.frame}px`, "--foot": `${d.foot}px` } as React.CSSProperties}
          />
        ))}
        <div className="crStand">
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
