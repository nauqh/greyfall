// The war map's island, drawn from the engine's height map. Shared by the map
// scene and the title screen, which frames a corner of the same island.

import { MINES, castlePlot, findPath, isOpen, makeRng, type BuildingKind, type Cell, type Plot } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl, type BuildingName } from "./art";
import { MAP, STRAT_COLS, STRAT_ROWS, at, isLand, isSlope, level } from "./stratMap";
import { DEPTH, addBuilding, addDecor, loadBuildings, standing, type Structure } from "./terrain";

/** The tileset's native tile: nothing is stretched. */
export const CELL = 64;

/** Work loops for a Pawn at its job: the pickaxe at a mine, the hammer at a
 *  plot, and the run with a bag of gold on the way home. The keys and files
 *  are the blue clan's; workKey gives each clan its own. */
export const WORK = {
  dig: { key: "pawnDig", file: "Units/Blue Units/Pawn/Pawn_Interact Pickaxe.png" },
  hammer: { key: "pawnHammer", file: "Units/Blue Units/Pawn/Pawn_Interact Hammer.png" },
  carry: { key: "pawnCarry", file: "Units/Blue Units/Pawn/Pawn_Run Gold.png" },
} as const;

export function workKey(side: "a" | "b", job: keyof typeof WORK): string {
  return side === "a" ? WORK[job].key : `${WORK[job].key}Red`;
}

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** Placed in cells, so a building's base lands on the row it names. */
export function cell(side: Structure["side"], name: Structure["name"], col: number, row: number, scale?: number): Structure {
  return { side, name, x: col * CELL, y: row * CELL, scale };
}

const ART: Record<BuildingKind, BuildingName> = {
  castle: "castle",
  barracks: "barracks",
  archery: "archery",
  tower: "tower",
  monastery: "monastery",
  house: "house1",
};

/** The pack's three house fronts, taken in turn by the house's number. */
export function artOf(p: Plot): BuildingName {
  if (p.kind !== "house") return ART[p.kind];
  return `house${(Number(/\d+$/.exec(p.id)?.[0] ?? 0) % 3) + 1}` as BuildingName;
}

/** Where a plot's art stands: centred on its footprint, base on its last row. */
export function plotBase(p: Plot): { x: number; y: number } {
  return { x: (p.col + p.w / 2) * CELL, y: (p.row + p.h) * CELL };
}

/** The map's art beyond terrain and units: lowland grass, the Pawns' work
 *  loops, gold and sheep. */
export function loadMapArt(scene: Phaser.Scene): void {
  // Lowland grass in the sheet's deeper green, as the pack's demo map does:
  // the plateaus keep the sunlit colour1 and the Crown takes the darkest,
  // colour5, so height reads as colour too.
  scene.load.image("tilesetLow", packUrl("Terrain/Tileset/Tilemap_color3.png"));
  scene.load.image("tilesetHigh", packUrl("Terrain/Tileset/Tilemap_color5.png"));
  // The dustiest of the five greens, for the two roads.
  scene.load.image("tilesetRoad", packUrl("Terrain/Tileset/Tilemap_color4.png"));
  loadBuildings(scene, LANDMARKS);
  for (const [job, w] of Object.entries(WORK) as [keyof typeof WORK, (typeof WORK)[keyof typeof WORK]][]) {
    scene.load.spritesheet(w.key, packUrl(w.file), { frameWidth: 192, frameHeight: 192 });
    scene.load.spritesheet(workKey("b", job), packUrl(w.file.replace("Blue Units", "Red Units")), { frameWidth: 192, frameHeight: 192 });
  }
  scene.load.image("goldMine", packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png"));
  scene.load.spritesheet("sheep", packUrl("Terrain/Resources/Meat/Sheep/Sheep_Idle.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
}

export function makeMapAnims(scene: Phaser.Scene): void {
  for (const job of Object.keys(WORK) as (keyof typeof WORK)[]) {
    for (const side of ["a", "b"] as const) {
      const key = workKey(side, job);
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key), frameRate: 10, repeat: -1 });
    }
  }
  if (!scene.anims.exists("sheep_anim")) {
    scene.anims.create({ key: "sheep_anim", frames: scene.anims.generateFrameNumbers("sheep"), frameRate: 8, repeat: -1 });
  }
}

/** Each land level's ground colour: lowland, plateau, the Crown. */
const SHEET: Record<number, string> = { 1: "tilesetLow", 2: "tileset", 3: "tilesetHigh" };

/** Neutral landmarks, Warcraft's doodads: huts and a cave in the woods, a
 *  dead tree on the islet, towers and a fish hut in the shallows. Each stands
 *  on forest or water, so none of them sits where a unit can walk. */
const LANDMARK_SPOTS: { name: BuildingName; col: number; row: number; scale?: number; clears?: [number, number][] }[] = [
  { name: "cave", col: 9, row: 33.9, clears: [[8, 33], [9, 33], [10, 33]] },
  { name: "goblinHut", col: 19, row: 33.9, scale: 0.8, clears: [[18, 33], [19, 33]] },
  { name: "gnomeHut", col: 14, row: 34.9, clears: [[13, 34], [14, 34]] },
  { name: "gnomeTower", col: 16, row: 34.9, scale: 0.85, clears: [[15, 34], [16, 34]] },
  { name: "skullSpike", col: 2.5, row: 22.9, clears: [[2, 22]] },
  { name: "skullSpike", col: 21.5, row: 12.9, clears: [[21, 12]] },
  { name: "fishHut", col: 9, row: 35.2 },
  { name: "waterTower", col: 17.5, row: 4.8 },
];
const LANDMARK_LIST = LANDMARK_SPOTS.flatMap((l) => [l, { ...l, col: STRAT_COLS - l.col, mirror: true }]);
const LANDMARKS: Structure[] = LANDMARK_LIST.map((l) => ({ ...cell("g", l.name, l.col, l.row), scale: l.scale }));
/** Forest tiles a landmark stands on, left without a tree. */
const CLEARED = new Set(
  LANDMARK_LIST.flatMap((l) => (l.clears ?? []).map(([c, r]) => (("mirror" in l) ? STRAT_COLS - 1 - c : c) + r * STRAT_COLS)),
);

/** The two roads across the lowland: the pathfinder's walk from castle to
 *  castle over the High Pass and over the ford, one tile wider, as dirt
 *  tracks. High ground keeps its grass: a patch of road there reads as one
 *  more level. The lake splits the island's middle column, so closing that
 *  column above or below it leaves one lane. */
function roadTiles(): Set<number> {
  const front = (side: "a" | "b"): Cell => ({ col: castlePlot(side).col + 1, row: castlePlot(side).row + 2 });
  const walk = (north: boolean): Cell[] =>
    findPath(front("a"), front("b"), (c) => !isOpen(c) || (c.col === (STRAT_COLS - 1) / 2 && c.row > STRAT_ROWS / 2 === north)) ?? [];
  const out = new Set<number>();
  for (const c of [...walk(true), ...walk(false)]) {
    if (level(c.col, c.row) !== 1) continue;
    out.add(c.row * STRAT_COLS + c.col);
    const wider = { col: c.col, row: c.row + 1 };
    if (isOpen(wider) && level(wider.col, wider.row) === 1) {
      out.add(wider.row * STRAT_COLS + wider.col);
    }
  }
  return out;
}

/** Foam under the shore and flat ground everywhere on land, then, once per
 *  level above it, shadow, elevated tops, cliffs and stairs: the tilemap
 *  guide's layer order. */
export function buildMap(scene: Phaser.Scene): void {
  const tile = (c: number, r: number, tc: number, tr: number, z: number, sheet: string): void => {
    scene.add.image(c * CELL, r * CELL, sheet, `tile_${tc}_${tr}`).setOrigin(0).setDepth(z);
  };

  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      let shore = false;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) shore ||= !isLand(c + dc, r + dr);
      }
      // A cliff standing in the sea gets foam too, each on its own frame, as
      // the guide asks.
      const cliffInSea = !isLand(c, r) && level(c, r - 1) >= 2 && !isSlope(c, r - 1);
      if ((isLand(c, r) && shore) || cliffInSea) {
        const foam = scene.add.sprite(c * CELL + CELL / 2, r * CELL + CELL / 2, "foam").setDepth(DEPTH.foam);
        foam.play("foam_anim");
        if (foam.anims.currentAnim) foam.anims.setProgress(Math.random());
      }
      if (isLand(c, r)) {
        const tc = edge(isLand(c - 1, r), isLand(c + 1, r));
        tile(c, r, tc, edge(isLand(c, r - 1), isLand(c, r + 1)), DEPTH.island, SHEET[1]!);
      }
    }
  }

  // A road is a patch of flat ground in the road colour, edged where it ends
  // like any other patch of ground.
  const roads = roadTiles();
  const road = (c: number, r: number): boolean => roads.has(r * STRAT_COLS + c);
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      if (road(c, r)) tile(c, r, edge(road(c - 1, r), road(c + 1, r)), edge(road(c, r - 1), road(c, r + 1)), DEPTH.island + 0.05, "tilesetRoad");
    }
  }

  for (const lv of [2, 3]) {
    const z = DEPTH.island + (lv - 1) * 0.3;
    const slope = (c: number, r: number): boolean => isSlope(c, r) && level(c, r) === lv;
    // Ground at this level or above: a higher level, and the stairs up to it,
    // stand on this level's centre pieces.
    const top = (c: number, r: number): boolean => level(c, r) >= lv && !slope(c, r);
    // A cliff face stands under every top of this level that is not this
    // level itself. A ramp stands outside the ground it climbs to, beside the
    // cliff, with nothing behind it, as in the guide.
    const wall = (c: number, r: number): boolean => top(c, r - 1) && level(c, r) < lv;
    const rampFoot = (c: number, r: number): boolean => slope(c, r - 1);

    // One shadow a whole tile below each walkable tile of this level, so it
    // pools at the cliff foot and rims the sides.
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (top(c, r)) scene.add.image(c * CELL + CELL / 2, (r + 1) * CELL + CELL / 2, "shadow_src").setDepth(z);
      }
    }
    // Tops, then walls, then ramps. Beside a ramp a top runs on without a
    // side edge, and so does the wall beside its foot: the guide's centre
    // pieces that join a stair to the ground and the cliff. Walls take the
    // colour of the ground they stand on, whose tufts are at their foot; the
    // row 4 wall stands on land, row 5 in water.
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (!top(c, r)) continue;
        const side = (dc: number): boolean => top(c + dc, r) || slope(c + dc, r);
        tile(c, r, 5 + edge(side(-1), side(1)), edge(top(c, r - 1), top(c, r + 1)), z + 0.1, SHEET[lv]!);
      }
    }
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (!wall(c, r)) continue;
        const below = isLand(c, r) ? SHEET[Math.max(1, level(c, r))]! : SHEET[1]!;
        const joins = (dc: number): boolean => wall(c + dc, r) || rampFoot(c + dc, r);
        tile(c, r, 5 + edge(joins(-1), joins(1)), isLand(c, r) ? 4 : 5, z + 0.1, below);
      }
    }
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (!slope(c, r)) continue;
        const col = "<[".includes(at(c, r)) ? 0 : 3;
        tile(c, r, col, 4, z + 0.2, SHEET[lv]!);
        tile(c, r + 1, col, 5, z + 0.2, SHEET[lv]!);
      }
    }
  }
}

/** Mirrors a spot to the other half, as the island is. */
const both = (spots: [number, number][]): [number, number][] => [
  ...spots,
  ...spots.map(([c, r]): [number, number] => [STRAT_COLS - c, r]),
];

/** A tree on every forest tile a landmark does not stand on, the landmarks,
 *  gold where the engine's mines are, bushes and rocks strewn over open
 *  ground off the roads, sheep, and rocks in the shallows. Returns the strewn
 *  props by cell, for the map to hide under a building. */
export function buildScenery(scene: Phaser.Scene): Map<number, Phaser.GameObjects.Sprite> {
  const rng = makeRng("strat-scenery");
  const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
    spots.map(([c, r], i) => addDecor(scene, kind, c * CELL, r * CELL, 1, `strat-${kind}-${i}`));
  // Jittered and sometimes doubled, so a wood reads as trees and not a grid.
  const forest: [number, number][] = [];
  MAP.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      if (ch !== "T" || CLEARED.has(c + r * STRAT_COLS)) return;
      forest.push([c + 0.3 + rng.next() * 0.4, r + 0.75 + rng.next() * 0.3]);
      if (rng.next() < 0.25) forest.push([c + rng.next(), r + 0.4 + rng.next() * 0.3]);
    }),
  );
  put("tree", forest);
  LANDMARK_LIST.forEach((l, i) => {
    const art = addBuilding(scene, LANDMARKS[i]!);
    if ("mirror" in l) art.setFlipX(true);
  });

  const roads = roadTiles();
  const nearMine = (c: number, r: number): boolean => MINES.some((m) => Math.abs(m.col - c) <= 1 && Math.abs(m.row - r) <= 1);
  const strewn = new Map<number, Phaser.GameObjects.Sprite>();
  const shallows: [number, number][] = [];
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      const key = r * STRAT_COLS + c;
      if (!isLand(c, r)) {
        let coast = false;
        for (let d = -2; d <= 2; d++) coast ||= isLand(c + d, r) || isLand(c, r + d);
        if (coast && rng.next() < 0.07) shallows.push([c + rng.next(), r + rng.next()]);
        continue;
      }
      if (!isOpen({ col: c, row: r }) || isSlope(c, r) || isSlope(c, r - 1) || roads.has(key) || nearMine(c, r)) continue;
      // Thicker at the edges of things: beside a wood, the shore or a cliff.
      let edgy = false;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) edgy ||= !isOpen({ col: c + dc, row: r + dr });
      const roll = rng.next();
      const chance = edgy ? 0.22 : 0.06;
      if (roll >= chance) continue;
      const kind = roll < chance * 0.65 ? "bush" : "rock";
      const s = addDecor(scene, kind, (c + 0.2 + rng.next() * 0.6) * CELL, (r + 0.5 + rng.next() * 0.35) * CELL, kind === "bush" ? 0.7 + rng.next() * 0.3 : 1, `strat-strew-${key}`);
      strewn.set(key, s);
    }
  }
  put("waterRock", shallows).forEach((s) => s.setDepth(DEPTH.foam));

  for (const m of MINES) {
    const x = (m.col + 0.5) * CELL;
    const y = (m.row + 0.8) * CELL;
    scene.add.image(x, y, "goldMine").setOrigin(0.5, 0.78).setDepth(standing(y));
  }
  for (const [c, r] of both([[8.5, 8.4], [6.5, 24.4], [17.5, 31.3], [20.4, 17.6]])) {
    const sheep = scene.add
      .sprite(c * CELL, r * CELL, "sheep")
      .setOrigin(0.5, 0.66)
      .setDepth(standing(r * CELL))
      .setFlipX(c > STRAT_COLS / 2)
      .play("sheep_anim");
    if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
  }
  return strewn;
}
