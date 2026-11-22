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

/** The islet in 64px tiles, `.` sea and `g` grass, with a ring of sea for its foam. */
const MAP = ["......", ".gggg.", ".gggg.", ".gggg.", "......"];
/** Where the class's feet are on the islet, in art px from its map's top left: midway across, toward the front. */
const HERO = { x: 192, y: 214 };
/** The art px box the window must show whole: the islet, its foam, the boat, and the champion's swing over its head. */
const VIEW = { x: 192, y: 178, w: 312, h: 244 };

/** What is on the islet and in the shallows: each one's sheet, its square frame and count, the row its foot is on, and
 *  where that foot stands in art px on the map, `half` drawn at half size. The boat it came in lies beached on the front
 *  corner, small beside the class. */
const PROPS: { sheet: string; frame: number; frames: number; foot: number; x: number; y: number; half?: boolean }[] = [
  { sheet: "Terrain/Decorations/Bushes/Bushe3.png", frame: 128, frames: 8, foot: 84, x: 108, y: 108 },
  { sheet: "Terrain/Decorations/Bushes/Bushe1.png", frame: 128, frames: 8, foot: 79, x: 282, y: 100 },
  { sheet: "Resources/Sheep/HappySheep_Idle.png", frame: 128, frames: 8, foot: 86, x: 284, y: 170 },
  { sheet: "Terrain/Decorations/Rocks in the Water/Water Rocks_01.png", frame: 64, frames: 16, foot: 48, x: 318, y: 292 },
  { sheet: "Enemy Pack/Extra/Boat/Boat_Idle.png", frame: 256, frames: 8, foot: 170, x: 84, y: 288, half: true },
];

const isLand = (r: number, c: number) => (MAP[r]?.[c] ?? ".") !== ".";

/** The tileset's autotile cell for a piece of the land: its 3 by 3 block, the one-wide column right of it, the one-tall
 *  row under it and the lone tile, chosen by which sides the land goes on. */
function piece(r: number, c: number): [number, number] {
  const w = isLand(r, c - 1);
  const e = isLand(r, c + 1);
  const n = isLand(r - 1, c);
  const s = isLand(r + 1, c);
  return [w && e ? 1 : e ? 0 : w ? 2 : 3, n && s ? 1 : s ? 0 : n ? 2 : 3];
}

/** The islet at the art's own size, foam frame `tick`: the foam along its edge, then the grass. */
function drawIsle(g: CanvasRenderingContext2D, tiles: HTMLImageElement, foam: HTMLImageElement, tick: number): void {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const land = MAP.flatMap((row, r) => [...row].map((_, c) => [r, c] as const)).filter(([r, c]) => isLand(r, c));
  for (const [r, c] of land) {
    if (isLand(r - 1, c) && isLand(r + 1, c) && isLand(r, c - 1) && isLand(r, c + 1)) continue;
    g.drawImage(foam, ((tick + r * 7 + c * 3) % 16) * 192, 0, 192, 192, (c - 1) * TILE, (r - 1) * TILE, 192, 192);
  }
  for (const [r, c] of land) {
    const [x, y] = piece(r, c);
    g.drawImage(tiles, x * TILE, y * TILE, TILE, TILE, c * TILE, r * TILE, TILE, TILE);
  }
}

/** The window on the creation sheet: a small islet in the sea, the boat beached on its corner, and the class on show in
 *  its middle, idling and now and then showing its moves, the gift at its feet. Everything at one whole scale, as large
 *  as the window lets the islet stand whole. */
export function CreationScene({ row, gift }: { row: (typeof CLASS_ROWS)[number]; gift?: SackItem }) {
  const view = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const k = zoom(Math.min(size.w / VIEW.w, size.h / VIEW.h));
  useEffect(() => {
    const el = view.current!;
    const fit = () => setSize({ w: el.clientWidth, h: el.clientHeight });
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
      <div ref={view} className="crView" style={{ "--k": k } as React.CSSProperties}>
        <div className="crIsle" style={{ "--cx": VIEW.x, "--cy": VIEW.y } as React.CSSProperties}>
          <canvas ref={land} className="crLand" width={MAP[0]!.length * TILE} height={MAP.length * TILE} style={{ "--w": MAP[0]!.length * TILE, "--h": MAP.length * TILE } as React.CSSProperties} />
          {PROPS.map((d, i) => (
            <span
              key={i}
              className="crDecor"
              style={{ "--x": d.x, "--y": d.y, zIndex: d.y, "--sheet": `url("${packUrl(d.sheet)}")`, "--frames": d.frames, "--frame": `${d.half ? d.frame / 2 : d.frame}px`, "--foot": `${d.half ? d.foot / 2 : d.foot}px` } as React.CSSProperties}
            />
          ))}
          <div className="crStand" style={{ "--x": HERO.x, "--y": HERO.y, zIndex: HERO.y } as React.CSSProperties}>
            <span
              key={`${row.cls}:${beat}`}
              className={`crFigure${beat % 2 ? " once" : ""}${beat === 0 ? " enter" : ""}`}
              style={{ "--sheet": `url("${packUrl(move.sheet)}")`, "--frames": move.frames, "--frame": `${row.frame}px`, "--feet": `${row.feet}px` } as React.CSSProperties}
              onAnimationEnd={(e) => e.animationName === "crFrames" && beat % 2 && setBeat((b) => b + 1)}
            />
            {gift && (
              <span key={gift.label} className="crGift">
                <ItemIcon icon={gift.icon} size={Math.round(32 * k)} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
