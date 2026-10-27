/**
 * The Atlas: the whole Shattered Reach, in three tiers on one grid. The
 * Surface is seven areas, each its own landmass, joined only at named gates
 * the way a Souls map joins its areas. Over it floats the Gilded Reach, a sky
 * city you can see from below; under it the Underneath, caverns cut from the
 * rock. Lifts, wells and stairs join the tiers at the same spot on the grid,
 * so what is above a place is really above it, as in Dark Souls, where the
 * depths lie under the town and a city stands over the swamp.
 *
 * Each tier is pure data in the war island's height-map format (island.ts),
 * so the war's autotiler draws it and its pathing walks it. The web dresses it.
 */

import { castsCliff, cellKey, isWalkable, level, stepsFrom, useIsland, type Cell, type Island } from "./island.ts";
import { hashSeed, makeRng, type Rng } from "./rng.ts";

export type TierId = "sky" | "surface" | "below";

export type AreaId =
  | "saltreach"
  | "harbour"
  | "emberwood"
  | "crags"
  | "barrowmoor"
  | "fen"
  | "greyfall"
  | "steps"
  | "gilded"
  | "undercroft"
  | "deeps"
  | "hollow";

export interface AtlasArea {
  id: AreaId;
  tier: TierId;
  name: string;
  blurb: string;
  /** Tileset colours: lowland, plateau, and the heights above; one green for all, as the pack draws its own maps. */
  palette: readonly [number, number, number];
  /** The light over it, as a multiply colour; white for plain daylight. */
  mood: number;
  label: Cell;
}

/** open: a plain way through. gate: barred, opened once. shortcut: opens only
 *  from its far side. locked: needs keys. high: a road on the high ground. */
export type GateKind = "open" | "gate" | "shortcut" | "locked" | "high";

export interface AtlasGate {
  id: string;
  name: string;
  kind: GateKind;
  from: AreaId;
  to: AreaId;
  note: string;
  /** Where its name and its gatehouse stand. */
  at: Cell;
  /** The tiles cut through what parts the two areas: sea, sky or rock. */
  cells: Cell[];
}

/** lift: both ways. drop: down only, no climbing back. shortcut: works once
 *  opened from its upper end, the way a Souls elevator opens home. */
export type LiftKind = "lift" | "drop" | "shortcut";

export interface LiftEnd {
  tier: TierId;
  area: AreaId;
  at: Cell;
}

/** A way between tiers: `up` is its upper end, `down` its lower. */
export interface AtlasLift {
  id: string;
  name: string;
  kind: LiftKind;
  note: string;
  up: LiftEnd;
  down: LiftEnd;
}

/** A building or prop. `art` names the web's art; `color` picks a faction's building set. */
export interface Placed {
  art: string;
  col: number;
  row: number;
  color?: "blue" | "red" | "yellow" | "purple" | "black";
  flip?: boolean;
  scale?: number;
  /** A sheet's frame, for art with variants. */
  frame?: number;
}

/** A creature, or a knight with `color`. With `to`, it walks between the two; `act` picks a pose. */
export interface Dweller {
  kind: string;
  col: number;
  row: number;
  color?: "blue" | "red" | "yellow" | "purple" | "black";
  to?: Cell;
  act?: string;
  flip?: boolean;
  scale?: number;
}

/** What lies outside the land: sea round the Surface, open sky, solid rock. */
export type TierBase = "sea" | "sky" | "rock";

export interface AtlasTier {
  id: TierId;
  name: string;
  blurb: string;
  base: TierBase;
  island: Island;
  /** The area each tile belongs to, one character a tile (AREA_CODE), "-" for none. */
  areaAt: string[];
  gates: AtlasGate[];
  roads: Cell[];
  props: Placed[];
  dwellers: Dweller[];
  /** Bonfires: where the warband would rest. */
  fires: Cell[];
  bosses: { name: string; area: AreaId; col: number; row: number }[];
  /** Fence pens and barricades, as rectangles of tiles. */
  fences: { col: number; row: number; w: number; h: number }[];
}

export interface AtlasMap {
  tiers: Record<TierId, AtlasTier>;
  areas: AtlasArea[];
  lifts: AtlasLift[];
}

export const ATLAS_SIZE = { cols: 128, rows: 80 } as const;
export const TIERS: readonly TierId[] = ["sky", "surface", "below"];
/** One character a tile in `areaAt`, by the area's index in AREAS. */
export const AREA_CODE = "0123456789ab";

export const AREAS: readonly AtlasArea[] = [
  {
    id: "saltreach",
    tier: "surface",
    name: "Saltreach",
    blurb: "Fishing isles on the west shore, where the boats put in. The yellow militia still hold the villages, just.",
    palette: [5, 5, 5],
    mood: 0xffffff,
    label: { col: 13, row: 56 },
  },
  {
    id: "harbour",
    tier: "surface",
    name: "Last Harbour",
    blurb: "The last free town, under the blue castle. Every road starts at the fire in its square, and every road comes back to it: down its old well, up its watchtower lift.",
    palette: [3, 3, 3],
    mood: 0xffffff,
    label: { col: 40, row: 47 },
  },
  {
    id: "emberwood",
    tier: "surface",
    name: "Emberwood",
    blurb: "Old pine the goblins burn for room. Warrens in every clearing, and a troll in the biggest one.",
    palette: [4, 4, 4],
    mood: 0xffe2c8,
    label: { col: 38, row: 4 },
  },
  {
    id: "crags",
    name: "Tinker Crags",
    tier: "surface",
    blurb: "Gnome country: a rock that climbs in five steps to the Tinker Peak, and a lift off the peak into the clouds. A bridge runs off the rock toward the grey.",
    palette: [2, 2, 2],
    mood: 0xfff8e6,
    label: { col: 81, row: 24 },
  },
  {
    id: "barrowmoor",
    tier: "surface",
    name: "Barrowmoor",
    blurb: "The old kings' barrows. The dead walk the moor at dusk, something with horns keeps the deepest grave, and the cave goes down further than anyone has followed it.",
    palette: [4, 4, 4],
    mood: 0xc4c4e4,
    label: { col: 77, row: 57 },
  },
  {
    id: "fen",
    tier: "surface",
    name: "Lizard Fen",
    blurb: "Reed and black water between the shore and the moor. A purple chapel prays to the grey in the middle of it, over a sinkhole that drinks the pools.",
    palette: [5, 5, 5],
    mood: 0xdcecdc,
    label: { col: 66, row: 76 },
  },
  {
    id: "greyfall",
    tier: "surface",
    name: "The Greyfall",
    blurb: "The warlord's citadel, where the grey pours from, its keep on the fourth height. Two keys open its gate; the gnomes' high road is the other way in.",
    palette: [4, 4, 4],
    mood: 0x9c9fa8,
    label: { col: 112, row: 46 },
  },
  {
    id: "steps",
    tier: "sky",
    name: "Skyward Steps",
    blurb: "A chain of drifting isles from the cloud bridge west to a lift that drops onto the Harbour's castle. Nobody below can open it; whoever comes down it can.",
    palette: [1, 1, 1],
    mood: 0xfff4e0,
    label: { col: 50, row: 30 },
  },
  {
    id: "gilded",
    tier: "sky",
    name: "The Gilded Reach",
    blurb: "The sky city of the old gnome-kings, all gold and sunlight, still held by its yellow guard and the Sentinel on the high hall. The warlord's throne isle hangs off its east end.",
    palette: [1, 1, 1],
    mood: 0xfff0d0,
    label: { col: 93, row: 21 },
  },
  {
    id: "undercroft",
    tier: "below",
    name: "The Undercroft",
    blurb: "The Harbour's cisterns and catacombs, under its well. Black water, old bones, spiders in the pillars, and a tunnel east that nobody admits to digging.",
    palette: [4, 4, 4],
    mood: 0x8c88a8,
    label: { col: 40, row: 52 },
  },
  {
    id: "deeps",
    tier: "below",
    name: "Barrow Deeps",
    blurb: "The tombs under the moor, where the barrows go down. The Weaver nests in the deepest vault, and the Sinking Stair goes deeper still.",
    palette: [4, 4, 4],
    mood: 0x8478a0,
    label: { col: 82, row: 57 },
  },
  {
    id: "hollow",
    tier: "below",
    name: "The Drowned Hollow",
    blurb: "The bottom of the world: a still lake under the fen, lit by gold in the rock, where stone trees stand in the shallows and something vast sleeps in its shell.",
    palette: [5, 5, 5],
    mood: 0x9ab4c8,
    label: { col: 64, row: 76 },
  },
];

export const TIER_INFO: Record<TierId, { name: string; blurb: string; base: TierBase }> = {
  sky: { name: "The Gilded Reach", blurb: "The sky over the rock and the citadel, where the gnome-kings built in gold.", base: "sky" },
  surface: { name: "The Surface", blurb: "Seven lands on the sea, joined at their gates.", base: "sea" },
  below: { name: "The Underneath", blurb: "Caverns in the rock under the town, the moor and the fen.", base: "rock" },
};

const AREA_INDEX = Object.fromEntries(AREAS.map((a, i) => [a.id, i])) as Record<AreaId, number>;

/** The tops and stairs of each height above the lowland. */
const HEIGHT: Record<number, { top: string; left: string; right: string }> = {
  2: { top: "#", left: "<", right: ">" },
  3: { top: "^", left: "[", right: "]" },
  4: { top: "4", left: "{", right: "}" },
  5: { top: "5", left: "(", right: ")" },
};

const line = (a: Cell, b: Cell, each: (c: Cell) => void): void => {
  const n = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
  for (let i = 0; i <= n; i++) each({ col: Math.round(a.col + ((b.col - a.col) * i) / Math.max(1, n)), row: Math.round(a.row + ((b.row - a.row) * i) / Math.max(1, n)) });
};

/** What an area map is built from: the tier builder, sized for one area. */
export type TierBuilder = ReturnType<typeof tierBuilder>;

export interface Relief {
  area: AreaId;
  at: Cell;
  rx: number;
  ry: number;
  levels: 2 | 3 | 4 | 5;
  core?: { at: Cell; r: number };
}

/** Value noise in -1..1, smooth over `scale` tiles, the same for the same seed. */
export function noise(seed: string, scale: number): (c: number, r: number) => number {
  const v = (x: number, y: number) => (hashSeed(`${seed}:${x}:${y}`) / 4294967296) * 2 - 1;
  const ease = (k: number) => k * k * (3 - 2 * k);
  return (c, r) => {
    const x = c / scale;
    const y = r / scale;
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [ease(x - x0), ease(y - y0)];
    const top = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx;
    const bottom = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

type Builder = ReturnType<typeof tierBuilder>;

/**
 * The ground a prop's base covers, measured off its art: width in tiles, and
 * rows back from its base row. `clear` props want a tile of open ground of
 * their own height all round, so nothing stands on a cliff's lip or the shore.
 */
const FOOT: Record<string, { w: number; d: number; clear: boolean }> = {
  castle: { w: 4, d: 2, clear: true },
  monastery: { w: 3, d: 2, clear: true },
  barracks: { w: 3, d: 2, clear: true },
  archery: { w: 3, d: 2, clear: true },
  tower: { w: 2, d: 1, clear: true },
  house1: { w: 2, d: 1, clear: true },
  house2: { w: 2, d: 1, clear: true },
  house3: { w: 2, d: 1, clear: true },
  goblinHut: { w: 3, d: 1, clear: true },
  gnomeHut: { w: 2, d: 1, clear: true },
  gnomeTower: { w: 2, d: 1, clear: true },
  cave: { w: 4, d: 2, clear: true },
  fishHut: { w: 3, d: 1, clear: true },
  goldMine: { w: 3, d: 1, clear: true },
  trollDead: { w: 3, d: 1, clear: false },
  deadTree: { w: 2, d: 1, clear: false },
  // A bonfire wants its own level ground round it too: never on a cliff's lip.
  fire: { w: 1, d: 1, clear: true },
  boat: { w: 3, d: 1, clear: true },
  pirateTowerWater: { w: 2, d: 1, clear: true },
};

/** The tiles under a prop's base, and with `ring` the open ground it wants round them. */
export function footprint(p: Placed, ring = false): Cell[] {
  const f = FOOT[p.art] ?? { w: 1, d: 1, clear: false };
  const w = Math.max(1, Math.round(f.w * (p.scale ?? 1)));
  const m = ring && f.clear ? 1 : 0;
  const left = p.col - Math.floor((w - 1) / 2);
  const out: Cell[] = [];
  for (let r = p.row - f.d + 1 - m; r <= p.row + m; r++) for (let c = left - m; c < left + w + m; c++) out.push({ col: c, row: r });
  return out;
}

/** Props that stand in the sea, creatures that swim in it, and those that fly over anything. */
export const WATER_ART: ReadonlySet<string> = new Set(["boat", "pirateTowerWater"]);
export const SEA_KINDS: ReadonlySet<string> = new Set(["harpoonShark", "paddleShark", "seahorseBoat", "bombFish", "rubberDuck"]);
export const FLYING: ReadonlySet<string> = new Set(["bat", "bee", "imp"]);

/**
 * Lay down every relief as terrain, the way the pack's own maps draw high
 * ground: broad irregular tables whose edges notch in and out, cliffs that
 * can drop straight into the sea, and each height a tile inside the one
 * below it. Then a stair onto every table; a table that can take none is
 * levelled.
 */
function terrain(t: Builder, rows: number, cols: number): void {
  const { area, at, put } = t;
  const height: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  // Roads and gates run through the high ground as valleys: keep it a tile clear of them.
  const valley = new Set<string>();
  const clearOf = (c: number, r: number): void => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) valley.add(`${c + dc},${r + dr}`);
  };
  for (const k of [...t.roadSet, ...t.paths]) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    clearOf(c, r);
  }
  for (const g of t.gates) if (g.kind !== "high") for (const c of g.cells) clearOf(c.col, c.row);

  // Each height its own outline: its own noise, drifting toward the summit and shrinking, so
  // the heights read as terraces stepping up one way and not as rings round a point.
  t.reliefs.forEach((rel, i) => {
    const own = AREA_INDEX[rel.area];
    const peak = rel.core?.at ?? rel.at;
    for (let k = 2; k <= rel.levels; k++) {
      const coarse = noise(`relief:${t.id}:${i}:${k}`, 4);
      const fine = noise(`relief:${t.id}:${i}:${k}:fine`, 1.8);
      const step = (k - 2) / Math.max(1, rel.levels - 1);
      // Higher terraces sit back to the north, so their cliffs, which face south, stack into one face.
      const cx = rel.at.col + (peak.col - rel.at.col) * step;
      const cy = rel.at.row + (peak.row - rel.at.row) * step - rel.ry * 0.3 * step;
      const shrink = 1 - 0.24 * (k - 2);
      for (let r = Math.floor(rel.at.row - rel.ry - 2); r <= rel.at.row + rel.ry + 2; r++) {
        for (let c = Math.floor(rel.at.col - rel.rx - 2); c <= rel.at.col + rel.rx + 2; c++) {
          if (area[r]?.[c] !== own || !".T".includes(at(c, r)) || valley.has(`${c},${r}`)) continue;
          const d = Math.hypot((c - cx) / (rel.rx * shrink), (r - cy) / (rel.ry * shrink));
          const f = 1 - d + 0.42 * coarse(c, r) + 0.18 * fine(c, r);
          // A core keeps a flat top of its radius, and each height under it three tiles wider: nesting erodes two
          // tiles with a square, and a circle needs the extra tile to keep its diagonals.
          const core = rel.core && Math.hypot(c - rel.core.at.col, r - rel.core.at.row) <= rel.core.r + 3 * (rel.levels - k);
          if (f > 0.12 || core) height[r]![c] = Math.max(height[r]![c]!, k);
        }
      }
    }
  });
  // A high road laid before the terrain is part of the second height, and so is the ground
  // two tiles round each of its ends, where it lands, so it always meets that height.
  const landing = new Set<string>();
  for (const g of t.gates) {
    if (g.kind !== "high" || g.cells.length === 0) continue;
    for (const end of [g.cells[0]!, g.cells.at(-1)!]) {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (".T".includes(at(end.col + dc, end.row + dr))) landing.add(`${end.col + dc},${end.row + dr}`);
    }
  }
  const road = (c: number, r: number) => at(c, r) === "#" || landing.has(`${c},${r}`);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (road(c, r)) height[r]![c] = 2;
  // Authored ground: the highest block over a tile sets it exactly.
  const authored = new Map<string, number>();
  for (const b of t.blocks) {
    for (let r = b.y; r < b.y + b.h; r++) {
      for (let c = b.x; c < b.x + b.w; c++) {
        if (!".T".includes(at(c, r))) continue;
        const k = `${c},${r}`;
        authored.set(k, Math.max(authored.get(k) ?? 1, b.level));
        height[r]![c] = Math.max(height[r]![c]!, b.level);
      }
    }
  }
  // A bridge deck and the height it stands at: it joins tables of that height only, not those under it.
  const spanned = new Map(t.blocks.filter((b) => b.span).flatMap((b) => Array.from({ length: b.w * b.h }, (_, i): [string, number] => [`${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`, b.level])));
  // A notch cut back to the lowland under authored ground: a block of level 1.
  for (const b of t.blocks) if (b.level === 1) for (let r = b.y; r < b.y + b.h; r++) for (let c = b.x; c < b.x + b.w; c++) authored.set(`${c},${r}`, 1);
  const top = Math.max(1, ...height.flat(), ...t.blocks.map((b) => b.level));
  if (top < 2) return;

  type Mask = boolean[][];
  const blank = (): Mask => Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const get = (m: Mask, c: number, r: number) => m[r]?.[c] ?? false;
  const cores = new Set<string>();
  for (const rel of t.reliefs) {
    if (!rel.core) continue;
    const { at: p, r: rad } = rel.core;
    const reach = rad + 2 * (rel.levels - 2);
    for (let r = Math.floor(p.row - reach); r <= p.row + reach; r++) for (let c = Math.floor(p.col - reach); c <= p.col + reach; c++) if (Math.hypot(c - p.col, r - p.row) <= rad) cores.add(`${c},${r}`);
  }

  const masks: Mask[] = [];
  for (let k = 2; k <= top; k++) {
    let m = blank();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) m[r]![c] = height[r]![c]! >= k;
    // Smooth: a tile keeps the majority of its neighbourhood.
    for (let pass = 0; pass < 2; pass++) {
      const next = blank();
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) n += get(m, c + dc, r + dr) ? 1 : 0;
          const ground = height[r]![c]! >= 1;
          next[r]![c] = ground && (n >= 5 || (cores.has(`${c},${r}`) && height[r]![c]! >= k) || (k === 2 && road(c, r)));
        }
      }
      m = next;
    }
    // Straight cliff runs, as the pack draws them: fill one- and two-tile gaps in each row and
    // column, and drop runs that short, so an edge steps in notches, not a zigzag.
    for (let pass = 0; pass < 2; pass++) {
      for (const along of ["row", "col"] as const) {
        const outer = along === "row" ? rows : cols;
        const inner = along === "row" ? cols : rows;
        const cell = (o: number, i: number): [number, number] => (along === "row" ? [i, o] : [o, i]);
        for (let o = 0; o < outer; o++) {
          let i = 0;
          while (i < inner) {
            const [c, r] = cell(o, i);
            const on = get(m, c, r);
            let j = i;
            while (j < inner && get(m, ...cell(o, j)) === on) j++;
            const len = j - i;
            const bounded = i > 0 && j < inner;
            // A short gap inside high ground fills; a short spur of high ground goes.
            if (len <= 2 && bounded) {
              for (let x = i; x < j; x++) {
                const [cc, rr] = cell(o, x);
                if (on && (cores.has(`${cc},${rr}`) || (k === 2 && road(cc, rr)))) continue;
                if (!on && (height[rr]![cc]! < 1 || valley.has(`${cc},${rr}`))) continue;
                m[rr]![cc] = !on;
              }
            }
            i = j;
          }
        }
      }
    }
    // Inside the height below, two tiles in all round, so its cliff, its stairs and a walk past
    // its foot all stand on that height.
    if (k > 2) {
      const under = masks[k - 3]!;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!m[r]![c]) continue;
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (!get(under, c + dc, r + dr)) m[r]![c] = false;
        }
      }
    }
    if (k > 2) for (const key of landing) {
      const [c, r] = key.split(",").map(Number) as [number, number];
      m[r]![c] = false;
    }
    // No slivers: every tile has a neighbour of its height above or below it, and to one side.
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!m[r]![c] || (k === 2 && road(c, r))) continue;
          if ((!get(m, c, r - 1) && !get(m, c, r + 1)) || (!get(m, c - 1, r) && !get(m, c + 1, r))) m[r]![c] = false;
        }
      }
    }
    // Authored ground is exactly as drawn.
    for (const [key, lv] of authored) {
      const [c, r] = key.split(",").map(Number) as [number, number];
      m[r]![c] = lv >= k;
    }
    masks.push(m);
  }

  const levelAt = (c: number, r: number): number => {
    if (!".T#".includes(at(c, r))) return 0;
    if (landing.has(`${c},${r}`) && height[r]![c]! >= 1 && !get(masks[0]!, c, r)) return 1;
    let l = 1;
    for (let k = 2; k <= top; k++) if (get(masks[k - 2]!, c, r)) l = k;
    return l;
  };
  const stairs = new Map<string, string>();
  const isStair = (c: number, r: number) => stairs.has(`${c},${r}`);

  for (let k = 2; k <= top; k++) {
    const m = masks[k - 2]!;
    const seen = blank();
    for (let r0 = 0; r0 < rows; r0++) {
      for (let c0 = 0; c0 < cols; c0++) {
        if (!m[r0]![c0] || seen[r0]![c0] || (spanned.get(`${c0},${r0}`) ?? k) > k) continue;
        const comp: Cell[] = [];
        const queue: Cell[] = [{ col: c0, row: r0 }];
        seen[r0]![c0] = true;
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i]!;
          comp.push(p);
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const q = { col: p.col + dc, row: p.row + dr };
            if (get(m, q.col, q.row) && !seen[q.row]![q.col] && (spanned.get(`${q.col},${q.row}`) ?? k) <= k) {
              seen[q.row]![q.col] = true;
              queue.push(q);
            }
          }
        }
        // A stair stands beside the table's bottom row, on open ground of the height below, with that ground above it and below.
        const lower = (c: number, r: number) => levelAt(c, r) === k - 1 && !isStair(c, r) && (k > 2 || ".T".includes(at(c, r)));
        const found: { c: number; r: number; side: "L" | "R" }[] = [];
        for (const p of comp) {
          if (get(m, p.col, p.row + 1)) continue;
          for (const s of ["L", "R"] as const) {
            const c = p.col + (s === "L" ? -1 : 1);
            const r = p.row;
            if (lower(c, r) && lower(c, r - 1) && lower(c, r + 1) && levelAt(c, r + 2) >= 1) found.push({ c, r, side: s });
          }
        }
        // Authored ground takes only its authored stairs.
        if (comp.some((p) => authored.has(`${p.col},${p.row}`) && !spanned.has(`${p.col},${p.row}`))) continue;
        // An authored stair onto it keeps it, though no stair of its own fits.
        const kept = t.ways.some((w) => w.level === k && comp.some((p) => p.row === w.row && p.col === w.col + (w.side === "L" ? 1 : -1)));
        if (found.length === 0 && !kept) {
          for (const p of comp) for (let j = k - 2; j < masks.length; j++) masks[j]![p.row]![p.col] = false;
          continue;
        }
        const mid = comp.reduce((n, p) => n + p.col, 0) / comp.length;
        // Both ends, in each area the table spans: a high road joins two areas' tables, and each needs its own way up.
        for (const own of new Set(found.map((f) => area[f.r]![f.c]!))) {
          const pick = (s: "L" | "R") => found.filter((f) => f.side === s && area[f.r]![f.c] === own).sort((a, b) => b.r - a.r || Math.abs(a.c - mid) - Math.abs(b.c - mid))[0];
          for (const st of [pick("L"), pick("R")]) if (st) stairs.set(`${st.c},${st.r}`, st.side === "L" ? HEIGHT[k]!.left : HEIGHT[k]!.right);
        }
      }
    }
  }

  for (const w of t.ways) stairs.set(`${w.col},${w.row}`, w.side === "L" ? HEIGHT[w.level]!.left : HEIGHT[w.level]!.right);

  // Write the ground: tops, then stairs, with open ground at each stair's head and foot.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!".T#".includes(at(c, r))) continue;
      const l = levelAt(c, r);
      if (l >= 2) put(c, r, HEIGHT[l]!.top);
      else if (at(c, r) === "#") put(c, r, ".");
    }
  }
  for (const [k, ch] of stairs) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    put(c, r, ch);
    for (const dr of [-1, 1]) if (at(c, r + dr) === "T") put(c, r + dr, ".");
  }
}

/** Anything left on a cliff face or a stair by the terrain steps off it, onto the nearest open ground. */
function settleAll(t: Builder): void {
  const islandNow = (): Island => {
    const c0 = { col: 0, row: 0 };
    return { rows: t.grid.map((l) => l.join("")), start: { a: { castle: c0, barracks: c0 }, b: { castle: c0, barracks: c0 } }, mines: [], lair: c0 };
  };
  useIsland(islandNow());
  const slope = (c: Cell) => "<>[]{}()".includes(t.at(c.col, c.row));
  const key = (c: Cell) => `${c.col},${c.row}`;
  // Ground a building stands on, and the ground round it: taken once a building is placed.
  const under = new Set<string>();
  const taken = new Set<string>();

  /**
   * A building sits wholly on open ground of one height in its own area, with
   * a tile of that ground round it, clear of every other building: never on a
   * cliff's lip, a stair or the shore. A boat sits wholly in open water.
   */
  const fits = (p: Placed, own: number, height?: number): boolean => {
    const wet = WATER_ART.has(p.art);
    const base = level(p.col, p.row);
    if (!wet && height !== undefined && base !== height) return false;
    for (const c of footprint(p)) {
      if (taken.has(key(c))) return false;
      if (wet ? t.at(c.col, c.row) !== "~" : !isWalkable(c.col, c.row) || slope(c) || level(c.col, c.row) !== base || t.area[c.row]?.[c.col] !== own) return false;
    }
    for (const c of footprint(p, true)) {
      if (under.has(key(c))) return false;
      if (wet) {
        if (t.at(c.col, c.row) !== "~") return false;
        continue;
      }
      const ch = t.at(c.col, c.row);
      // Woods may stand at its side; sea, a cliff face, a stair or other ground may not.
      if (ch === "~" || slope(c) || level(c.col, c.row) !== base || castsCliff(c.col, c.row - 1) || t.area[c.row]?.[c.col] !== own) return false;
    }
    return true;
  };
  const place = (p: Placed): void => {
    for (const c of footprint(p)) under.add(key(c));
    for (const c of footprint(p, true)) taken.add(key(c));
  };
  // Buildings that already fit stay; the rest move to the nearest place that fits, on the height meant for them when there is one.
  const own = (p: Placed) => (WATER_ART.has(p.art) ? -1 : t.area[p.row]?.[p.col] ?? -1);
  const fitted = t.props.map((p) => {
    const ok = fits(p, own(p));
    if (ok) place(p);
    return ok;
  });
  const site = (p: Placed): Placed => {
    const area = own(p);
    const meant = level(p.col, p.row);
    for (const height of [meant, undefined]) {
      for (let d = 1; d <= 14; d++) {
        const ring: Placed[] = [];
        for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) if (Math.max(Math.abs(dr), Math.abs(dc)) === d) ring.push({ ...p, col: p.col + dc, row: p.row + dr });
        ring.sort((a, b) => Math.hypot(a.col - p.col, a.row - p.row) - Math.hypot(b.col - p.col, b.row - p.row));
        // A building keeps to its area; a boat to the water near where it was moored.
        const q = ring.find((c) => (area < 0 || t.area[c.row]?.[c.col] === area) && fits(c, area < 0 ? own(c) : area, height));
        if (q) {
          place(q);
          return q;
        }
      }
    }
    return p;
  };
  t.props = t.props.map((p, i) => (fitted[i] ? p : site(p)));
  // Bonfires after the buildings, on ground of their own.
  t.fires = t.fires.map((f) => {
    const p: Placed = { art: "fire", ...f };
    if (fits(p, own(p))) {
      place(p);
      return f;
    }
    const q = site(p);
    return { col: q.col, row: q.row };
  });

  const open = (c: Cell) => isWalkable(c.col, c.row) && !slope(c) && !under.has(key(c));
  const settle = <T extends Cell>(p: T, wet = false): T => {
    if (open(p) || (wet && t.at(p.col, p.row) === "~")) return p;
    for (let d = 1; d < 8; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          const q = { col: p.col + dc, row: p.row + dr };
          if (open(q)) return { ...p, ...q };
        }
      }
    }
    return p;
  };
  // Flyers hover where they are put; swimmers stay in the sea.
  t.dwellers = t.dwellers.map((d) => (FLYING.has(d.kind) ? d : { ...settle(d, SEA_KINDS.has(d.kind)), ...(d.to && { to: settle(d.to, SEA_KINDS.has(d.kind)) }) }));
  // A walker whose beat the terrain cut keeps to its spot.
  const walks = (a: Cell, b: Cell): boolean => {
    const seen = new Set([key(a)]);
    const queue = [a];
    for (let i = 0; i < queue.length && i < 4000; i++) {
      for (const n of stepsFrom(queue[i]!)) {
        if (n.col === b.col && n.row === b.row) return true;
        if (!seen.has(key(n))) (seen.add(key(n)), queue.push(n));
      }
    }
    return false;
  };
  t.dwellers = t.dwellers.map((d) => {
    if (!d.to || FLYING.has(d.kind) || SEA_KINDS.has(d.kind) || walks(d, d.to)) return d;
    const { to: _cut, ...rest } = d;
    return rest;
  });
  t.bosses = t.bosses.map((b) => settle(b));
}

/** One tier under construction: its grid, and the tools that shape and fill it. */
export function tierBuilder(id: TierId, rng: Rng, size: { cols: number; rows: number } = ATLAS_SIZE) {
  const { cols, rows } = size;
  const base = TIER_INFO[id].base;
  /** What parts two areas: water round land, solid rock round caverns. */
  const wall = base === "rock" ? "%" : "~";
  const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(wall));
  const area: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const put = (c: number, r: number, ch: string): void => {
    if (r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1) grid[r]![c] = ch;
  };
  const at = (c: number, r: number): string => grid[r]?.[c] ?? wall;

  const t = {
    id,
    grid,
    area,
    put,
    at,
    gates: [] as AtlasGate[],
    roadSet: new Set<string>(),
    props: [] as Placed[],
    dwellers: [] as Dweller[],
    fires: [] as Cell[],
    fences: [] as AtlasTier["fences"],
    bosses: [] as AtlasTier["bosses"],
    reliefs: [] as Relief[],
    /** Authored high ground: exact rectangles at a height, for a fortress's terraces. */
    blocks: [] as { level: number; x: number; y: number; w: number; h: number; span?: boolean }[],
    /** Authored stairs onto authored ground; a table of authored ground takes no others. */
    ways: [] as { level: number; col: number; row: number; side: "L" | "R" }[],
    /** Ways the high ground keeps clear of, drawn or not: roads, and the bridges between isles. */
    paths: new Set<string>(),

    /** Land, or a cavern: ragged ellipses of lowland for an area. */
    blob(a: AreaId, cx: number, cy: number, rx: number, ry: number): void {
      const wobble = Array.from({ length: 24 }, () => 0.86 + rng.next() * 0.22);
      for (let r = cy - ry - 2; r <= cy + ry + 2; r++) {
        for (let c = cx - rx - 2; c <= cx + rx + 2; c++) {
          const ang = Math.atan2(r - cy, c - cx);
          const w = wobble[Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 24) % 24]!;
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 > w * w) continue;
          if (r < 2 || c < 2 || r >= rows - 2 || c >= cols - 2) continue;
          grid[r]![c] = ".";
          area[r]![c] = AREA_INDEX[a];
        }
      }
    },
    /** Channels: land within two tiles of another area's goes back to sea, sky or rock. */
    separate(): void {
      const owner = area.map((l) => [...l]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const me = owner[r]![c]!;
          if (me < 0) continue;
          let other = false;
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) other ||= (owner[r + dr]?.[c + dc] ?? -1) >= 0 && owner[r + dr]![c + dc] !== me;
          if (other) {
            grid[r]![c] = wall;
            area[r]![c] = -1;
          }
        }
      }
    },
    /**
     * High ground for an area: a summit at `at`, falling away over `rx` by
     * `ry` tiles, broken up by noise, in `levels` heights. `core` forces the
     * top height round a spot, for a lift or a keep. Laid down in finish().
     */
    relief(spec: Relief): void {
      t.reliefs.push(spec);
    },
    /** Ground set to exactly `level` over a rectangle, past anything the reliefs make there; 1 cuts a notch back to the lowland. */
    block(level: 1 | 2 | 3 | 4 | 5, x: number, y: number, w: number, h: number): void {
      t.blocks.push({ level, x, y, w, h });
    },
    /** A raised bridge deck between two tables of `level`, over low ground or water; the tables keep their own stairs. */
    span(level: 2 | 3 | 4 | 5, x: number, y: number, w: number, h: number): Cell[] {
      const deck: Cell[] = [];
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) deck.push({ col: c, row: r });
      // Over water the deck belongs to the area of the land it leaves from.
      const own = deck.map((c) => area[c.row]?.[c.col] ?? -1).find((a) => a >= 0) ?? -1;
      for (const c of deck) {
        if (at(c.col, c.row) !== "~") continue;
        put(c.col, c.row, ".");
        area[c.row]![c.col] = own;
      }
      t.blocks.push({ level, x, y, w, h, span: true });
      return deck;
    },
    /** A stair onto `level` at a tile beside a table's bottom row: L with the table to its right, R to its left. */
    stair(level: 2 | 3 | 4 | 5, col: number, row: number, side: "L" | "R"): void {
      t.ways.push({ level, col, row, side });
    },
    /** A grove: lowland woods over an ellipse, `density` of its open ground. */
    grove(cx: number, cy: number, rx: number, ry: number, density: number): void {
      for (let r = Math.floor(cy - ry); r <= cy + ry; r++) {
        for (let c = Math.floor(cx - rx); c <= cx + rx; c++) {
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 <= 1 && at(c, r) === "." && rng.next() < density) put(c, r, "T");
        }
      }
    },
    pond(x0: number, y0: number, w: number, h: number): void {
      for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "~");
    },
    /** Rock left standing in a cavern: pillars and walls. */
    pillar(x0: number, y0: number, w: number, h: number): void {
      for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "%");
    },
    /** A strip of ground across water or sky, or through rock, inside one area. */
    bridge(a: Cell, b: Cell, width = 2): void {
      t.cut(a, b, width, (c) => {
        put(c.col, c.row, ".");
        // A path: the high ground keeps clear of it.
        t.paths.add(`${c.col},${c.row}`);
      });
    },
    cut(a: Cell, b: Cell, width: number, each: (c: Cell, through: boolean) => void): void {
      const seen = new Set<string>();
      const horizontal = Math.abs(b.col - a.col) >= Math.abs(b.row - a.row);
      line(a, b, (p) => {
        for (let d = -Math.floor(width / 2); d <= Math.floor((width - 1) / 2); d++) {
          const c = horizontal ? { col: p.col, row: p.row + d } : { col: p.col + d, row: p.row };
          const k = `${c.col},${c.row}`;
          if (seen.has(k)) continue;
          seen.add(k);
          each(c, at(c.col, c.row) === wall);
        }
      });
    },
    /** A gate: a strip cut across what parts two areas. */
    gate(gid: string, name: string, kind: GateKind, from: AreaId, to: AreaId, a: Cell, b: Cell, note: string, width = 3): void {
      const cells: Cell[] = [];
      t.cut(a, b, width, (c, through) => {
        if (through) {
          put(c.col, c.row, kind === "high" ? "#" : ".");
          cells.push(c);
        } else if (kind !== "high" && at(c.col, c.row) === "T") put(c.col, c.row, ".");
      });
      t.gates.push({ id: gid, name, kind, from, to, note, at: cells[Math.floor(cells.length / 2)] ?? a, cells });
    },
    road(...pts: [number, number][]): void {
      for (let i = 1; i < pts.length; i++) line({ col: pts[i - 1]![0], row: pts[i - 1]![1] }, { col: pts[i]![0], row: pts[i]![1] }, (c) => t.roadSet.add(`${c.col},${c.row}`));
    },
    prop(art: string, col: number, row: number, more: Omit<Placed, "art" | "col" | "row"> = {}): void {
      t.props.push({ art, col, row, ...more });
    },
    who(kind: string, col: number, row: number, more: Omit<Dweller, "kind" | "col" | "row"> = {}): void {
      t.dwellers.push({ kind, col, row, ...more });
    },

    /**
     * Woods on open ground nothing else uses, by area; then a path cut from
     * any pocket they sealed off; then every tile given its area. `from` is
     * where the walkable world starts, for the pocket check.
     */
    finish(density: Partial<Record<AreaId, number>>, from: readonly Cell[]): AtlasTier {
      terrain(t, rows, cols);
      const keep = new Set<string>();
      const clear = (c: number, r: number, rad: number): void => {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) keep.add(`${c + dc},${r + dr}`);
      };
      for (const p of t.props) clear(p.col, p.row, p.art === "castle" || p.art === "monastery" ? 3 : 2);
      for (const d of t.dwellers) clear(d.col, d.row, 1);
      for (const d of t.dwellers) if (d.to) line(d, d.to, (c) => clear(c.col, c.row, 1));
      for (const f of t.fires) clear(f.col, f.row, 2);
      for (const b of t.bosses) clear(b.col, b.row, 3);
      for (const f of t.fences) for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) keep.add(`${c},${r}`);
      for (const k of [...t.roadSet, ...t.paths]) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        clear(c, r, 1);
      }
      for (const g of t.gates) for (const c of g.cells) clear(c.col, c.row, 1);
      for (const c of from) clear(c.col, c.row, 2);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const a = area[r]![c]!;
          // Woods are lowland only: trees on the high ground are the scene's dressing, so they never wall a ledge off.
          if (a < 0 || at(c, r) !== "." || keep.has(`${c},${r}`)) continue;
          // Never on a cliff face, by a stair, or where a slope's head or foot is.
          const slope = (x: number, y: number) => "<>[]{}()".includes(at(x, y));
          if ("#^%45".includes(at(c, r - 1)) || slope(c, r - 1) || slope(c, r + 1) || slope(c - 1, r) || slope(c + 1, r)) continue;
          if (rng.next() < (density[AREAS[a]!.id] ?? 0)) put(c, r, "T");
        }
      }

      const centre = from[0]!;
      const islandOf = (): Island => ({
        rows: grid.map((l) => l.join("")),
        start: { a: { castle: centre, barracks: centre }, b: { castle: centre, barracks: centre } },
        mines: [],
        lair: centre,
      });
      // Woods never wall a clearing off: a pocket nobody can reach gets a path cut to the rest.
      for (let pass = 0; pass < 300; pass++) {
        useIsland(islandOf());
        const seen = new Set(from.map(cellKey));
        const queue = [...from];
        for (let i = 0; i < queue.length; i++) for (const n of stepsFrom(queue[i]!)) if (!seen.has(cellKey(n))) (seen.add(cellKey(n)), queue.push(n));
        let pocket: Cell | null = null;
        for (let r = 0; r < rows && !pocket; r++) for (let c = 0; c < cols && !pocket; c++) if (at(c, r) === "." && isWalkable(c, r) && !seen.has(cellKey({ col: c, row: r }))) pocket = { col: c, row: r };
        if (!pocket) break;
        const prev = new Map<number, Cell | null>([[cellKey(pocket), null]]);
        const q = [pocket];
        let found: Cell | null = null;
        for (let i = 0; i < q.length && !found; i++) {
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const n = { col: q[i]!.col + dc, row: q[i]!.row + dr };
            if (prev.has(cellKey(n)) || !".T".includes(at(n.col, n.row))) continue;
            prev.set(cellKey(n), q[i]!);
            if (seen.has(cellKey(n))) {
              found = n;
              break;
            }
            q.push(n);
          }
        }
        // Out through the trees to the rest; an islet with no way out goes to the woods.
        if (!found) put(pocket.col, pocket.row, "T");
        else for (let c: Cell | null = found; c; c = prev.get(cellKey(c)) ?? null) if (at(c.col, c.row) === "T") put(c.col, c.row, ".");
      }
      // High ground no stair reaches, cut off by a terrace's cliff or the woods on it, comes down a height.
      const lower: Record<string, string> = { "#": ".", "%": ".", "^": "#", "4": "^", "5": "4" };
      for (let pass = 0; pass < 40; pass++) {
        useIsland(islandOf());
        const seen = new Set(from.map(cellKey));
        const queue = [...from];
        for (let i = 0; i < queue.length; i++) for (const n of stepsFrom(queue[i]!)) if (!seen.has(cellKey(n))) (seen.add(cellKey(n)), queue.push(n));
        let changed = false;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const ch = at(c, r);
            if (!"#^45".includes(ch) || !isWalkable(c, r) || seen.has(cellKey({ col: c, row: r }))) continue;
            put(c, r, lower[ch]!);
            changed = true;
          }
        }
        if (!changed) break;
      }
      settleAll(t);

      // Gate tiles and land the carving made outside every outline join the nearest area.
      const owned = area.map((l) => [...l]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r]![c] === wall || owned[r]![c]! >= 0) continue;
          let best = -1;
          for (let d = 1; d < 14 && best < 0; d++) for (let dr = -d; dr <= d && best < 0; dr++) for (let dc = -d; dc <= d && best < 0; dc++) best = area[r + dr]?.[c + dc] ?? -1;
          owned[r]![c] = best;
        }
      }
      for (const g of t.gates) {
        const ids = [AREA_INDEX[g.from], AREA_INDEX[g.to]];
        for (const c of g.cells) {
          let best = ids[0]!;
          for (let d = 1; d < 30; d++) {
            const hit = ids.find((i) => [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dc, dr]) => area[c.row + dr!]?.[c.col + dc!] === i));
            if (hit !== undefined) {
              best = hit;
              break;
            }
          }
          owned[c.row]![c.col] = best;
        }
      }
      const info = TIER_INFO[id];
      return {
        id,
        name: info.name,
        blurb: info.blurb,
        base: info.base,
        island: islandOf(),
        areaAt: owned.map((l, r) => l.map((a, c) => (a >= 0 && grid[r]![c] !== wall && grid[r]![c] !== "~" ? AREA_CODE[a]! : "-")).join("")),
        gates: t.gates,
        roads: [...t.roadSet].map((k) => ({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]) })).filter((c) => at(c.col, c.row) === "."),
        props: t.props,
        dwellers: t.dwellers,
        fires: t.fires,
        bosses: t.bosses,
        fences: t.fences,
      };
    },
  };
  return t;
}

/** The ways between tiers. Each end stands where it says, and the two ends sit close on the grid. */
export const LIFTS: readonly AtlasLift[] = [
  {
    id: "old-well",
    name: "Old Well",
    kind: "drop",
    note: "A dry well off the square. A rope goes down; nothing comes back up it.",
    up: { tier: "surface", area: "harbour", at: { col: 41, row: 43 } },
    down: { tier: "below", area: "undercroft", at: { col: 41, row: 45 } },
  },
  {
    id: "barrow-cave",
    name: "Barrow Cave",
    kind: "lift",
    note: "The moor's cave, down a long ramp of bones into the tombs, and back up.",
    up: { tier: "surface", area: "barrowmoor", at: { col: 84, row: 49 } },
    down: { tier: "below", area: "deeps", at: { col: 84, row: 50 } },
  },
  {
    id: "sinkhole",
    name: "Fen Sinkhole",
    kind: "drop",
    note: "The pools drain into it, and so does anyone who steps too close. The Hollow is a long fall down.",
    up: { tier: "surface", area: "fen", at: { col: 63, row: 69 } },
    down: { tier: "below", area: "hollow", at: { col: 61, row: 68 } },
  },
  {
    id: "gnome-lift",
    name: "Gnome Lift",
    kind: "lift",
    note: "A basket on a gnome-built crane, off the Tinker Peak up into the clouds.",
    up: { tier: "sky", area: "gilded", at: { col: 80, row: 9 } },
    down: { tier: "surface", area: "crags", at: { col: 81, row: 10 } },
  },
  {
    id: "throne-stair",
    name: "Throne Stair",
    kind: "lift",
    note: "From the warlord's keep, a stair of floating stones up to his throne isle.",
    up: { tier: "sky", area: "gilded", at: { col: 112, row: 18 } },
    down: { tier: "surface", area: "greyfall", at: { col: 112, row: 22 } },
  },
  {
    id: "watch-lift",
    name: "Watch Lift",
    kind: "shortcut",
    note: "The castle's old sky-lift, chained from above. Ride it down once from the Steps and it runs both ways for good: the road home.",
    up: { tier: "sky", area: "steps", at: { col: 43, row: 31 } },
    down: { tier: "surface", area: "harbour", at: { col: 43, row: 36 } },
  },
];

function surface(rng: Rng): AtlasTier {
  const t = tierBuilder("surface", rng);
  const B: [AreaId, number, number, number, number][] = [
    ["saltreach", 14, 46, 11, 10], ["saltreach", 12, 61, 10, 9], ["saltreach", 21, 70, 8, 5],
    ["harbour", 40, 42, 14, 9], ["harbour", 35, 50, 10, 5],
    ["emberwood", 40, 14, 18, 11], ["emberwood", 24, 10, 8, 7], ["emberwood", 56, 9, 8, 6],
    ["crags", 80, 11, 16, 9], ["crags", 82, 19, 12, 6], ["crags", 92, 23, 6, 5],
    ["barrowmoor", 78, 46, 15, 10], ["barrowmoor", 88, 54, 8, 6],
    ["fen", 62, 70, 14, 7], ["fen", 78, 72, 10, 6],
    ["greyfall", 113, 27, 12, 15], ["greyfall", 113, 50, 12, 13], ["greyfall", 117, 66, 8, 6],
  ];
  for (const [a, x, y, rx, ry] of B) t.blob(a, x, y, rx, ry);
  t.separate();

  // Saltreach: the lighthouse bluff, and the headland south of Netmend.
  t.relief({ area: "saltreach", at: { col: 9, row: 40 }, rx: 7, ry: 5, levels: 2 });
  t.relief({ area: "saltreach", at: { col: 8, row: 60 }, rx: 5, ry: 4, levels: 2 });
  // Last Harbour: the castle hill, the castle on its own height above the town.
  t.relief({ area: "harbour", at: { col: 41, row: 36 }, rx: 10, ry: 4.5, levels: 3, core: { at: { col: 42, row: 35 }, r: 2 } });
  // Emberwood: Smoke Ridge, the western knolls, and a tarn.
  t.relief({ area: "emberwood", at: { col: 51, row: 15 }, rx: 7, ry: 5, levels: 2 });
  t.relief({ area: "emberwood", at: { col: 33, row: 8 }, rx: 6, ry: 4, levels: 2 });
  t.pond(43, 21, 4, 2);
  // Tinker Crags: the rock climbs to the Tinker Peak, five heights from the shore.
  t.relief({ area: "crags", at: { col: 81, row: 11 }, rx: 15, ry: 9, levels: 3, core: { at: { col: 81, row: 9 }, r: 2.2 } });
  // Barrowmoor: three barrows on the moor.
  t.relief({ area: "barrowmoor", at: { col: 71, row: 41 }, rx: 4.5, ry: 3, levels: 2 });
  t.relief({ area: "barrowmoor", at: { col: 84, row: 40 }, rx: 5.5, ry: 3.5, levels: 2 });
  t.relief({ area: "barrowmoor", at: { col: 73, row: 51 }, rx: 4.5, ry: 3, levels: 2 });
  // Lizard Fen: black pools.
  for (const [x, y, w, h] of [[53, 67, 3, 2], [59, 71, 3, 2], [65, 66, 2, 2], [69, 73, 3, 2], [75, 68, 2, 2], [82, 74, 3, 2], [57, 75, 2, 1]] as const) t.pond(x, y, w, h);
  // The Greyfall: the citadel rock, the keep on its fourth height, a spur out to the high road.
  t.relief({ area: "greyfall", at: { col: 113, row: 29 }, rx: 10, ry: 14, levels: 3, core: { at: { col: 112, row: 23 }, r: 2.2 } });
  t.relief({ area: "greyfall", at: { col: 106, row: 18 }, rx: 4, ry: 3, levels: 2 });

  t.gate("old-bridge", "Old Bridge", "open", "saltreach", "harbour", { col: 22, row: 45 }, { col: 31, row: 44 }, "The way in from the shore, always open.");
  t.gate("ember-gate", "Ember Gate", "gate", "harbour", "emberwood", { col: 30, row: 37 }, { col: 30, row: 22 }, "A palisade on the causeway north. The town bars it at night.");
  t.gate("crag-stair", "Crag Stair", "open", "emberwood", "crags", { col: 61, row: 11 }, { col: 69, row: 16 }, "A gnome path out of the smoke, up to the rock.");
  t.gate("moor-gate", "Moor Gate", "shortcut", "harbour", "barrowmoor", { col: 52, row: 42 }, { col: 65, row: 44 }, "Barred from the moor side. Whoever comes through the moor can open it, and come home the short way.");
  t.gate("fen-causeway", "Fen Causeway", "open", "saltreach", "fen", { col: 27, row: 72 }, { col: 50, row: 72 }, "A long spit of shingle along the south shore.", 2);
  t.gate("barrow-path", "Barrow Path", "open", "fen", "barrowmoor", { col: 78, row: 67 }, { col: 82, row: 57 }, "Duckboards over the reeds, up onto the moor.");
  t.gate("grey-gate", "Grey Gate", "locked", "barrowmoor", "greyfall", { col: 93, row: 47 }, { col: 104, row: 47 }, "Two locks: the troll's key and the minotaur's.");
  t.gate("sky-bridge", "Sky Bridge", "high", "crags", "greyfall", { col: 92, row: 6 }, { col: 104, row: 6 }, "The gnomes' high road off the top of the rock, straight onto the citadel wall.", 2);
  // The high road turns down to the citadel, and is part of the gate till it lands there.
  const high = t.gates.find((g) => g.id === "sky-bridge")!;
  for (let r = 6; r <= 19; r++) {
    for (const c of [103, 104]) {
      if (t.at(c, r) !== "~") continue;
      t.put(c, r, "#");
      high.cells.push({ col: c, row: r });
    }
  }

  t.road([16, 49], [22, 45], [31, 44], [36, 41], [41, 40]);
  t.road([41, 40], [33, 39], [30, 37], [30, 22], [30, 17], [37, 17]);
  t.road([41, 40], [48, 42], [52, 42], [65, 44], [76, 46], [85, 50]);
  t.road([14, 49], [13, 55], [14, 63]);
  t.road([18, 66], [27, 72], [50, 72], [62, 70], [78, 70], [80, 62]);
  t.road([37, 17], [44, 10], [56, 10], [62, 12], [69, 16]);
  t.road([93, 47], [101, 47], [102, 45]);
  const { prop, who } = t;

  // Saltreach: Netmend and Gull Point, the lighthouse bluff, pirates offshore.
  prop("tower", 9, 38, { color: "yellow" });
  prop("house1", 14, 46, { color: "yellow" });
  prop("house2", 18, 47, { color: "yellow" });
  prop("house3", 20, 50, { color: "yellow" });
  prop("fishHut", 11, 51);
  prop("fishHut", 9, 65, { flip: true });
  prop("house1", 14, 61, { color: "yellow" });
  prop("house3", 17, 62, { color: "yellow" });
  prop("archery", 11, 58, { color: "yellow" });
  prop("pirateTowerWater", 2, 57);
  prop("pirateTowerWater", 4, 74);
  prop("boat", 5, 52);
  prop("boat", 4, 67, { flip: true });
  t.fires.push({ col: 16, row: 49 });
  t.fences.push({ col: 16, row: 53, w: 4, h: 3 });
  for (const [c, r] of [[17, 54], [18, 55]] as const) who("sheep", c, r);
  who("warrior", 22, 45, { color: "yellow", to: { col: 16, row: 48 } });
  who("archer", 10, 38, { color: "yellow" });
  who("pawn", 12, 52, { color: "yellow", act: "knife" });
  who("pawn", 15, 63, { color: "yellow", act: "meat", to: { col: 12, row: 66 } });
  who("monk", 12, 59, { color: "yellow" });
  who("turtle", 7, 55);
  who("turtle", 20, 59, { flip: true });
  who("harpoonShark", 1, 42, { to: { col: 2, row: 50 } });
  who("paddleShark", 26, 60, { to: { col: 27, row: 66 } });
  who("seahorseBoat", 1, 61, { to: { col: 1, row: 47 } });
  who("rubberDuck", 24, 52);

  // Last Harbour: the castle on its height, the town round the square, the docks.
  // The castle's own turrets stand for towers: the hill has room for the castle alone.
  prop("castle", 41, 34, { color: "blue" });
  prop("monastery", 33, 42, { color: "blue" });
  prop("house1", 38, 41, { color: "blue" });
  prop("house2", 44, 41, { color: "blue" });
  prop("house3", 46, 44, { color: "blue" });
  prop("house1", 37, 45, { color: "blue" });
  prop("house2", 44, 46, { color: "blue" });
  prop("barracks", 50, 40, { color: "blue" });
  prop("archery", 30, 48, { color: "blue" });
  prop("goldMine", 51, 46);
  prop("boat", 34, 56);
  prop("boat", 40, 55, { flip: true });
  prop("tower", 29, 38, { color: "blue" });
  prop("tower", 32, 38, { color: "blue" });
  t.fires.push({ col: 41, row: 40 });
  t.fences.push({ col: 46, row: 48, w: 4, h: 3 });
  for (const [c, r] of [[47, 49], [48, 49]] as const) who("sheep", c, r);
  who("warrior", 30, 36, { color: "blue" });
  who("warrior", 31, 36, { color: "blue", flip: true });
  who("lancer", 36, 40, { color: "blue", to: { col: 47, row: 43 } });
  who("archer", 36, 35, { color: "blue" });
  who("archer", 45, 35, { color: "blue", flip: true });
  who("monk", 34, 44, { color: "blue" });
  who("pawn", 50, 47, { color: "blue", act: "pickaxe" });
  who("pawn", 52, 45, { color: "blue", act: "pickaxe", flip: true });
  who("pawn", 49, 44, { color: "blue", act: "gold", to: { col: 43, row: 42 } });
  who("pawn", 27, 41, { color: "blue", act: "axe" });
  who("pawn", 29, 43, { color: "blue", act: "wood", to: { col: 36, row: 43 } });
  who("pawn", 43, 44, { color: "blue", act: "hammer" });
  who("warrior", 51, 41, { color: "blue", to: { col: 51, row: 43 } });
  who("pawn", 39, 52, { color: "yellow", act: "meat", to: { col: 33, row: 51 } });

  // Emberwood: three warrens, the troll's clearing, logging at the gate.
  for (const [c, r, f] of [[23, 9, 0], [27, 11, 3], [24, 13, 6], [42, 6, 9], [46, 8, 12], [55, 8, 2], [58, 11, 5]] as const) prop("goblinHut", c, r, { frame: f });
  prop("deadTree", 34, 21);
  prop("trollDead", 50, 20, { scale: 0.6 });
  for (const [c, r] of [[26, 19], [29, 21], [33, 20], [24, 17], [27, 16]] as const) prop("stump", c, r);
  t.fires.push({ col: 25, row: 11 }, { col: 44, row: 8 }, { col: 56, row: 10 }, { col: 34, row: 21 });
  t.fences.push({ col: 19, row: 6, w: 4, h: 3 });
  for (const [c, r] of [[20, 7], [21, 8]] as const) who("pig", c, r);
  who("torch", 26, 9, { to: { col: 26, row: 14 } });
  who("torch", 43, 9);
  who("torch", 57, 9, { flip: true });
  who("spear", 28, 12);
  who("spear", 47, 6, { to: { col: 40, row: 9 } });
  who("spear", 59, 12, { flip: true });
  who("thief", 33, 15, { to: { col: 30, row: 19 } });
  who("gnoll", 50, 13);
  who("gnoll", 53, 13, { flip: true });
  who("troll", 39, 16);
  t.bosses.push({ name: "Cinder Troll", area: "emberwood", col: 39, row: 16 });

  // Tinker Crags: huts on the low rock, gold on the steps, the tower and the lift on the peak.
  prop("gnomeTower", 82, 7);
  for (const [c, r] of [[72, 6], [89, 6], [76, 13], [85, 13]] as const) prop("gnomeHut", c, r);
  for (const [c, r] of [[80, 13], [73, 9], [77, 12]] as const) prop("goldStone", c, r);
  prop("gnomeHut", 71, 17);
  t.fires.push({ col: 81, row: 12 });
  who("gnome", 73, 12, { to: { col: 79, row: 12 } });
  who("gnome", 87, 11, { flip: true });
  who("gnome", 85, 7, { to: { col: 89, row: 9 } });
  who("slingshot", 77, 8);
  who("slingshot", 84, 8, { flip: true });
  who("slingshot", 71, 7);
  who("bear", 72, 19, { to: { col: 77, row: 21 } });
  who("bear", 88, 20, { flip: true });
  who("bee", 80, 20);
  who("bee", 84, 18);
  who("bee", 76, 18);
  who("panda", 93, 23);
  who("panda", 90, 25, { flip: true });
  who("pandaGuard", 92, 21);
  t.bosses.push({ name: "Old Bamboo", area: "crags", col: 92, row: 21 });

  // Barrowmoor: barrows, bones, the cave, and the minotaur's grave.
  prop("cave", 84, 47);
  for (const [c, r] of [[67, 45], [74, 48], [80, 45], [91, 50], [79, 53], [86, 58]] as const) prop("deadTree", c, r, { scale: 0.5 });
  for (const [c, r] of [[69, 40], [73, 40], [82, 38], [86, 39], [85, 52], [91, 52], [85, 57], [91, 57], [72, 50]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[75, 44], [78, 50], [83, 55], [88, 51], [68, 47], [79, 42], [90, 56]] as const) prop("bones", c, r);
  t.fires.push({ col: 77, row: 46 });
  who("skull", 72, 46, { to: { col: 78, row: 48 } });
  who("skull", 82, 44);
  who("skullGuard", 70, 39);
  who("skullGuard", 84, 39, { flip: true });
  who("shaman", 71, 49);
  who("shaman", 83, 38);
  who("spider", 86, 46, { to: { col: 89, row: 48 } });
  who("snake", 66, 50);
  who("bat", 76, 42);
  who("bat", 88, 44);
  who("bat", 74, 53);
  who("minotaurGuard", 88, 54);
  t.bosses.push({ name: "The Barrow King", area: "barrowmoor", col: 88, row: 54 });

  // Lizard Fen: the purple chapel among the pools.
  prop("monastery", 78, 71, { color: "purple" });
  prop("house1", 74, 73, { color: "purple" });
  prop("house3", 82, 70, { color: "purple" });
  prop("tower", 60, 66, { color: "purple" });
  t.fires.push({ col: 66, row: 71 });
  who("monk", 77, 73, { color: "purple" });
  who("monk", 80, 73, { color: "purple", flip: true });
  who("warrior", 74, 70, { color: "purple", to: { col: 70, row: 70 } });
  who("lizard", 55, 70);
  who("lizard", 62, 74, { to: { col: 66, row: 75 } });
  who("lizard", 72, 68, { flip: true });
  who("snake", 58, 69);
  who("snake", 85, 72, { flip: true });
  who("turtle", 68, 71);
  who("rubberDuck", 60, 72);

  // The Greyfall: the black legion on the walls, the castle on the keep, imps round it.
  prop("castle", 113, 24, { color: "black" });
  for (const [c, r] of [[105, 18], [120, 18], [105, 40], [120, 40]] as const) prop("tower", c, r, { color: "black" });
  prop("barracks", 110, 37, { color: "black" });
  prop("archery", 116, 37, { color: "black" });
  prop("monastery", 112, 55, { color: "purple" });
  for (const [c, r, art] of [[108, 59, "house1"], [116, 60, "house3"], [119, 55, "house2"], [106, 54, "house2"]] as const) prop(art, c, r, { color: "black" });
  for (const [c, r] of [[104, 47], [104, 50], [107, 47], [107, 50]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[106, 45], [106, 50]] as const) prop("tower", c, r, { color: "black" });
  prop("skullSpike", 108, 45);
  prop("skullSpike", 108, 50);
  t.fires.push({ col: 109, row: 60 }, { col: 117, row: 61 }, { col: 112, row: 31 });
  who("skull", 110, 58, { to: { col: 117, row: 57 } });
  who("bat", 114, 52);
  who("lancer", 118, 49, { color: "black", to: { col: 110, row: 49 } });
  for (let i = 0; i < 4; i++) {
    who("warrior", 108 + i * 2, 33, { color: "black" });
    who("lancer", 108 + i * 2, 35, { color: "black" });
  }
  who("archer", 106, 20, { color: "black" });
  who("archer", 119, 20, { color: "black", flip: true });
  who("warrior", 106, 44, { color: "black", to: { col: 106, row: 52 } });
  who("imp", 110, 23);
  who("imp", 116, 22);
  who("imp", 107, 29);
  who("troll", 114, 47);
  who("bombFish", 126, 30, { to: { col: 126, row: 40 } });
  who("bombFish", 100, 60);
  who("monk", 110, 57, { color: "purple" });
  t.bosses.push({ name: "The Grey Warlord", area: "greyfall", col: 113, row: 26 });

  return t.finish(
    { saltreach: 0.07, harbour: 0.05, emberwood: 0.5, crags: 0.12, barrowmoor: 0.05, fen: 0.14, greyfall: 0.03 },
    [{ col: 41, row: 41 }, ...LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "surface").map((e) => e.at)],
  );
}

function sky(rng: Rng): AtlasTier {
  const t = tierBuilder("sky", rng);
  // The Steps: isles drifting west from the cloud bridge to over the castle.
  for (const [x, y, rx, ry] of [[41, 29, 5, 3], [53, 24, 4, 3], [65, 17, 4, 3]] as const) t.blob("steps", x, y, rx, ry);
  // The Gilded Reach: the high hall's isle, the lift's isle off the peak, the throne isle.
  for (const [x, y, rx, ry] of [[93, 13, 13, 8], [80, 9, 4, 3], [112, 16, 6, 4]] as const) t.blob("gilded", x, y, rx, ry);
  t.separate();
  t.bridge({ col: 45, row: 28 }, { col: 50, row: 25 });
  t.bridge({ col: 56, row: 22 }, { col: 62, row: 18 });
  t.bridge({ col: 83, row: 10 }, { col: 86, row: 11 });
  t.bridge({ col: 104, row: 14 }, { col: 107, row: 15 });
  t.gate("cloud-bridge", "Cloud Bridge", "open", "steps", "gilded", { col: 68, row: 15 }, { col: 77, row: 10 }, "A rope bridge over nothing at all, from the Steps to the gnome-kings' city.", 2);

  // The high hall: a hill in gold, the hall on its own height.
  t.relief({ area: "gilded", at: { col: 93, row: 12 }, rx: 8, ry: 4.5, levels: 2, core: { at: { col: 93, row: 12 }, r: 3.6 } });
  const { prop, who } = t;
  prop("castle", 93, 12, { color: "yellow" });
  prop("tower", 87, 9, { color: "yellow" });
  prop("tower", 98, 9, { color: "yellow" });
  prop("monastery", 100, 17, { color: "yellow" });
  prop("house2", 97, 17, { color: "yellow" });
  prop("archery", 102, 14, { color: "yellow" });
  prop("gnomeTower", 79, 8);
  for (const [c, r] of [[90, 15], [96, 15], [88, 18]] as const) prop("goldStone", c, r);
  t.fires.push({ col: 93, row: 16 });
  who("archer", 87, 10, { color: "yellow" });
  who("archer", 98, 10, { color: "yellow", flip: true });
  who("warrior", 88, 15, { color: "yellow", to: { col: 99, row: 17 } });
  who("monk", 85, 17, { color: "yellow" });
  who("lancer", 93, 13, { color: "yellow", scale: 1.8 });
  t.bosses.push({ name: "The Sun Sentinel", area: "gilded", col: 93, row: 13 });
  who("bee", 92, 18);
  who("bee", 101, 13);
  who("gnome", 81, 10, { to: { col: 78, row: 10 } });
  // The throne isle: black stone over the gold, imps round the warlord's empty seat.
  prop("tower", 114, 15, { color: "black" });
  prop("skullSpike", 110, 18);
  prop("skullSpike", 116, 18);
  who("imp", 111, 14);
  who("imp", 115, 17);
  // The Steps: a watch post at each isle, the lift's tower over the castle.
  prop("tower", 43, 28, { color: "blue" });
  prop("house3", 53, 24, { color: "yellow" });
  prop("tower", 65, 16, { color: "yellow" });
  t.fires.push({ col: 39, row: 29 }, { col: 64, row: 18 });
  who("archer", 43, 29, { color: "blue" });
  who("warrior", 52, 25, { color: "yellow", to: { col: 55, row: 23 } });
  who("bat", 58, 21);
  return t.finish({ steps: 0.05, gilded: 0.04 }, LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "sky").map((e) => e.at));
}

function below(rng: Rng): AtlasTier {
  const t = tierBuilder("below", rng);
  // Hollows in the rock under the town, the moor and the fen.
  for (const [x, y, rx, ry] of [[40, 46, 10, 6], [31, 50, 5, 3]] as const) t.blob("undercroft", x, y, rx, ry);
  for (const [x, y, rx, ry] of [[80, 49, 11, 6], [90, 55, 5, 4]] as const) t.blob("deeps", x, y, rx, ry);
  for (const [x, y, rx, ry] of [[66, 70, 17, 7], [52, 72, 6, 4]] as const) t.blob("hollow", x, y, rx, ry);
  t.separate();
  t.gate("cistern-run", "Cistern Run", "open", "undercroft", "deeps", { col: 49, row: 47 }, { col: 70, row: 48 }, "A tunnel east out of the cisterns. It comes up in the tombs.");
  t.gate("sinking-stair", "Sinking Stair", "open", "deeps", "hollow", { col: 76, row: 54 }, { col: 72, row: 64 }, "Steps cut down from the tombs to the Hollow's shore.");

  // The Undercroft: cisterns between pillars, a raised crypt.
  t.pond(35, 48, 9, 1);
  for (const [x, y] of [[36, 44], [44, 44], [32, 49]] as const) t.pillar(x, y, 2, 1);
  t.relief({ area: "undercroft", at: { col: 46, row: 42 }, rx: 4.5, ry: 2.5, levels: 2 });
  // Barrow Deeps: tomb daises.
  t.relief({ area: "deeps", at: { col: 76, row: 46 }, rx: 4.5, ry: 2.5, levels: 2 });
  t.relief({ area: "deeps", at: { col: 88, row: 46 }, rx: 4.5, ry: 2.5, levels: 2 });
  t.pillar(81, 51, 2, 1);
  // The Drowned Hollow: the lake, its islets, a shrine of stone at the back.
  t.pond(56, 70, 22, 3);
  t.pond(60, 73, 12, 1);
  t.relief({ area: "hollow", at: { col: 78, row: 67 }, rx: 5, ry: 2.5, levels: 2 });

  const { prop, who } = t;
  // The Undercroft.
  for (const [c, r] of [[33, 46], [47, 46], [42, 51], [37, 51]] as const) prop("bones", c, r);
  prop("skullSpike", 45, 42);
  prop("skullSpike", 48, 42);
  prop("deadTree", 30, 49, { scale: 0.5 });
  t.fires.push({ col: 40, row: 46 });
  who("spider", 37, 42, { to: { col: 42, row: 43 } });
  who("snake", 31, 51);
  who("skull", 47, 45);
  who("bat", 34, 44);
  who("thief", 43, 47, { to: { col: 48, row: 47 } });
  // Barrow Deeps.
  prop("trollDead", 80, 54, { scale: 0.7 });
  for (const [c, r] of [[76, 45], [78, 45], [87, 45], [90, 45]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[73, 50], [77, 52], [85, 49], [89, 53], [92, 56]] as const) prop("bones", c, r);
  for (const [c, r] of [[71, 47], [93, 55]] as const) prop("goldStone", c, r);
  t.fires.push({ col: 80, row: 48 });
  who("skullGuard", 76, 46);
  who("skullGuard", 89, 46, { flip: true });
  who("shaman", 83, 52);
  who("skull", 74, 50, { to: { col: 78, row: 51 } });
  who("bat", 86, 51);
  who("spider", 91, 56, { scale: 1.9 });
  t.bosses.push({ name: "The Weaver", area: "deeps", col: 91, row: 56 });
  // The Drowned Hollow.
  for (const [c, r] of [[52, 69], [57, 67], [72, 67], [83, 69], [50, 74]] as const) prop("deadTree", c, r, { scale: 0.55 });
  for (const [c, r] of [[55, 74], [64, 66], [69, 66], [80, 72], [48, 72]] as const) prop("goldStone", c, r);
  prop("skullSpike", 77, 66);
  prop("skullSpike", 80, 66);
  t.fires.push({ col: 78, row: 68 });
  who("turtle", 54, 73);
  who("turtle", 74, 74, { flip: true });
  who("lizard", 66, 67, { to: { col: 70, row: 67 } });
  who("bombFish", 64, 71, { to: { col: 72, row: 71 } });
  who("bombFish", 60, 72);
  who("turtleGuard", 79, 67, { scale: 1.5 });
  t.bosses.push({ name: "The Shell Below", area: "hollow", col: 79, row: 67 });
  return t.finish({ undercroft: 0.02, deeps: 0.03, hollow: 0.06 }, LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "below").map((e) => e.at));
}

/** The atlas, the same every time: three tiers and the lifts between them. */
export function atlasMap(): AtlasMap {
  // A seed a tier, so reshaping one never moves another; the surface keeps the atlas's first.
  const tiers: Record<TierId, AtlasTier> = { sky: sky(makeRng("atlas:sky")), surface: surface(makeRng("atlas")), below: below(makeRng("atlas:below")) };
  useIsland(tiers.surface.island);
  return { tiers, areas: [...AREAS], lifts: [...LIFTS] };
}
