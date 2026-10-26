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

import { cellKey, isWalkable, stepsFrom, useIsland, type Cell, type Island } from "./island.ts";
import { makeRng, type Rng } from "./rng.ts";

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
  /** Tileset colours: lowland, plateau, and the heights above. */
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
    palette: [5, 3, 1],
    mood: 0xffffff,
    label: { col: 13, row: 56 },
  },
  {
    id: "harbour",
    tier: "surface",
    name: "Last Harbour",
    blurb: "The last free town, under the blue castle. Every road starts at the fire in its square, and every road comes back to it: down its old well, up its watchtower lift.",
    palette: [3, 1, 2],
    mood: 0xffffff,
    label: { col: 40, row: 47 },
  },
  {
    id: "emberwood",
    tier: "surface",
    name: "Emberwood",
    blurb: "Old pine the goblins burn for room. Warrens in every clearing, and a troll in the biggest one.",
    palette: [4, 2, 3],
    mood: 0xffe2c8,
    label: { col: 38, row: 4 },
  },
  {
    id: "crags",
    name: "Tinker Crags",
    tier: "surface",
    blurb: "Gnome country: a rock that climbs in five steps to the Tinker Peak, and a lift off the peak into the clouds. A bridge runs off the rock toward the grey.",
    palette: [2, 1, 3],
    mood: 0xfff8e6,
    label: { col: 81, row: 24 },
  },
  {
    id: "barrowmoor",
    tier: "surface",
    name: "Barrowmoor",
    blurb: "The old kings' barrows. The dead walk the moor at dusk, something with horns keeps the deepest grave, and the cave goes down further than anyone has followed it.",
    palette: [4, 3, 1],
    mood: 0xc4c4e4,
    label: { col: 77, row: 57 },
  },
  {
    id: "fen",
    tier: "surface",
    name: "Lizard Fen",
    blurb: "Reed and black water between the shore and the moor. A purple chapel prays to the grey in the middle of it, over a sinkhole that drinks the pools.",
    palette: [5, 4, 1],
    mood: 0xdcecdc,
    label: { col: 66, row: 76 },
  },
  {
    id: "greyfall",
    tier: "surface",
    name: "The Greyfall",
    blurb: "The warlord's citadel, where the grey pours from, its keep on the fourth height. Two keys open its gate; the gnomes' high road is the other way in.",
    palette: [4, 4, 2],
    mood: 0x9c9fa8,
    label: { col: 112, row: 46 },
  },
  {
    id: "steps",
    tier: "sky",
    name: "Skyward Steps",
    blurb: "A chain of drifting isles from the cloud bridge west to a lift that drops onto the Harbour's castle. Nobody below can open it; whoever comes down it can.",
    palette: [1, 3, 2],
    mood: 0xfff4e0,
    label: { col: 50, row: 30 },
  },
  {
    id: "gilded",
    tier: "sky",
    name: "The Gilded Reach",
    blurb: "The sky city of the old gnome-kings, all gold and sunlight, still held by its yellow guard and the Sentinel on the high hall. The warlord's throne isle hangs off its east end.",
    palette: [1, 2, 3],
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
    palette: [4, 3, 4],
    mood: 0x8478a0,
    label: { col: 82, row: 57 },
  },
  {
    id: "hollow",
    tier: "below",
    name: "The Drowned Hollow",
    blurb: "The bottom of the world: a still lake under the fen, lit by gold in the rock, where stone trees stand in the shallows and something vast sleeps in its shell.",
    palette: [5, 3, 1],
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

/** One tier under construction: its grid, and the tools that shape and fill it. */
function tierBuilder(id: TierId, rng: Rng) {
  const { cols, rows } = ATLAS_SIZE;
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
    /** Stepped high ground, a tile in each side every two rows, ramps on its last row. */
    plateau(x0: number, y0: number, w: number, h: number, ramps: readonly ("L" | "R")[], step = true): void {
      for (let r = 0; r < h; r++) {
        const inset = step ? Math.floor(r / 2) : 0;
        for (let c = x0 + inset; c <= x0 + w - 1 - inset; c++) put(c, y0 + r, "#");
      }
      const last = step ? Math.floor((h - 1) / 2) : 0;
      // Ground under every bottom edge, for its cliff face to stand on.
      for (let r = 0; r < h; r++) {
        const inset = step ? Math.floor(r / 2) : 0;
        for (let c = x0 + inset; c <= x0 + w - 1 - inset; c++) if (at(c, y0 + r + 1) === wall) put(c, y0 + r + 1, ".");
      }
      for (const side of ramps) {
        const c = side === "L" ? x0 + last - 1 : x0 + w - last;
        put(c, y0 + h - 1, side === "L" ? "<" : ">");
        put(c, y0 + h - 2, ".");
        put(c, y0 + h, ".");
      }
    },
    /** A height on top of the height below it, square-sided, with stairs at the ends of its last row. */
    raise(level: 3 | 4 | 5, x0: number, y0: number, w: number, h: number, stairs: readonly ("L" | "R")[]): void {
      const hgt = HEIGHT[level]!;
      for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, hgt.top);
      if (stairs.includes("L")) put(x0 - 1, y0 + h - 1, hgt.left);
      if (stairs.includes("R")) put(x0 + w, y0 + h - 1, hgt.right);
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
      t.cut(a, b, width, (c) => put(c.col, c.row, "."));
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
      for (const k of t.roadSet) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        clear(c, r, 1);
      }
      for (const g of t.gates) for (const c of g.cells) clear(c.col, c.row, 1);
      for (const c of from) clear(c.col, c.row, 2);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const a = area[r]![c]!;
          if (a < 0 || at(c, r) !== "." || keep.has(`${c},${r}`)) continue;
          // Never on a cliff face, a stair's foot, or beside a slope.
          if ("#^%45<>[]{}()".includes(at(c, r - 1)) || "<>[]{}()".includes(at(c - 1, r)) || "<>[]{}()".includes(at(c + 1, r))) continue;
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
    down: { tier: "surface", area: "crags", at: { col: 80, row: 6 } },
  },
  {
    id: "throne-stair",
    name: "Throne Stair",
    kind: "lift",
    note: "From the warlord's keep, a stair of floating stones up to his throne isle.",
    up: { tier: "sky", area: "gilded", at: { col: 112, row: 17 } },
    down: { tier: "surface", area: "greyfall", at: { col: 112, row: 21 } },
  },
  {
    id: "watch-lift",
    name: "Watch Lift",
    kind: "shortcut",
    note: "The castle's old sky-lift, chained from above. Ride it down once from the Steps and it runs both ways for good: the road home.",
    up: { tier: "sky", area: "steps", at: { col: 41, row: 30 } },
    down: { tier: "surface", area: "harbour", at: { col: 41, row: 33 } },
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

  // Saltreach: a bluff for the lighthouse.
  t.plateau(5, 37, 9, 4, ["R"]);
  // Last Harbour: the castle hill, the castle on its own height above the town.
  t.plateau(35, 33, 12, 4, ["L", "R"]);
  t.raise(3, 38, 33, 6, 2, ["L", "R"]);
  // Emberwood: Smoke Ridge, and a tarn.
  t.plateau(48, 13, 8, 4, ["L"]);
  t.pond(43, 21, 4, 2);
  // Tinker Crags: the rock climbs in five steps to the Tinker Peak.
  t.plateau(70, 5, 22, 10, ["L", "R"]);
  // Each height a tile in from the ring below it, so its stairs land beside the ring and never on it.
  t.raise(3, 75, 6, 12, 5, ["L", "R"]);
  t.raise(4, 77, 6, 8, 4, ["L", "R"]);
  t.raise(5, 79, 6, 4, 2, ["L"]);
  // Barrowmoor: three barrows.
  t.plateau(68, 40, 6, 2, ["R"]);
  t.plateau(80, 38, 8, 4, ["L"]);
  t.plateau(70, 50, 6, 2, ["L"]);
  // Lizard Fen: black pools.
  for (const [x, y, w, h] of [[53, 67, 3, 2], [59, 71, 3, 2], [65, 66, 2, 2], [69, 73, 3, 2], [75, 68, 2, 2], [82, 74, 3, 2], [57, 75, 2, 1]] as const) t.pond(x, y, w, h);
  // The Greyfall: the citadel walls, the Crown in them, the keep on top.
  t.plateau(104, 17, 18, 26, ["L", "R"], false);
  t.raise(3, 108, 21, 10, 8, ["L", "R"]);
  t.raise(4, 110, 21, 6, 4, ["L", "R"]);

  t.gate("old-bridge", "Old Bridge", "open", "saltreach", "harbour", { col: 22, row: 45 }, { col: 31, row: 44 }, "The way in from the shore, always open.");
  t.gate("ember-gate", "Ember Gate", "gate", "harbour", "emberwood", { col: 30, row: 37 }, { col: 30, row: 22 }, "A palisade on the causeway north. The town bars it at night.");
  t.gate("crag-stair", "Crag Stair", "open", "emberwood", "crags", { col: 61, row: 11 }, { col: 69, row: 16 }, "A gnome path out of the smoke, up to the rock.");
  t.gate("moor-gate", "Moor Gate", "shortcut", "harbour", "barrowmoor", { col: 52, row: 42 }, { col: 65, row: 44 }, "Barred from the moor side. Whoever comes through the moor can open it, and come home the short way.");
  t.gate("fen-causeway", "Fen Causeway", "open", "saltreach", "fen", { col: 27, row: 72 }, { col: 50, row: 72 }, "A long spit of shingle along the south shore.", 2);
  t.gate("barrow-path", "Barrow Path", "open", "fen", "barrowmoor", { col: 78, row: 67 }, { col: 82, row: 57 }, "Duckboards over the reeds, up onto the moor.");
  t.gate("grey-gate", "Grey Gate", "locked", "barrowmoor", "greyfall", { col: 93, row: 47 }, { col: 104, row: 47 }, "Two locks: the troll's key and the minotaur's.");
  t.gate("sky-bridge", "Sky Bridge", "high", "crags", "greyfall", { col: 92, row: 6 }, { col: 104, row: 6 }, "The gnomes' high road off the top of the rock, straight onto the citadel wall.", 2);
  // The high road turns down onto the citadel's top.
  for (let r = 6; r < 17; r++) for (const c of [103, 104]) if (t.at(c, r) !== "#") t.put(c, r, "#");

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
  prop("castle", 41, 34, { color: "blue" });
  prop("tower", 36, 34, { color: "blue" });
  prop("tower", 46, 34, { color: "blue" });
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
  for (const [x, y, rx, ry] of [[93, 13, 12, 7], [80, 9, 4, 3], [112, 16, 6, 4]] as const) t.blob("gilded", x, y, rx, ry);
  t.separate();
  t.bridge({ col: 45, row: 28 }, { col: 50, row: 25 });
  t.bridge({ col: 56, row: 22 }, { col: 62, row: 18 });
  t.bridge({ col: 83, row: 10 }, { col: 86, row: 11 });
  t.bridge({ col: 104, row: 14 }, { col: 107, row: 15 });
  t.gate("cloud-bridge", "Cloud Bridge", "open", "steps", "gilded", { col: 68, row: 15 }, { col: 77, row: 10 }, "A rope bridge over nothing at all, from the Steps to the gnome-kings' city.", 2);

  // The high hall: a hill in gold, the hall on its own height.
  t.plateau(86, 8, 14, 6, ["L", "R"]);
  t.raise(3, 89, 8, 8, 3, ["L", "R"]);
  t.road([86, 17], [93, 16], [100, 16]);
  const { prop, who } = t;
  prop("castle", 93, 10, { color: "yellow" });
  prop("tower", 87, 9, { color: "yellow" });
  prop("tower", 98, 9, { color: "yellow" });
  prop("monastery", 84, 16, { color: "yellow" });
  prop("house1", 100, 15, { color: "yellow" });
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
  who("gnome", 81, 10, { to: { col: 84, row: 11 } });
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
  t.plateau(44, 41, 6, 2, ["L"]);
  // Barrow Deeps: tomb daises.
  t.plateau(74, 45, 6, 2, ["R"]);
  t.plateau(86, 45, 6, 2, ["L"]);
  t.pillar(81, 51, 2, 1);
  // The Drowned Hollow: the lake, its islets, a shrine of stone at the back.
  t.pond(56, 70, 22, 3);
  t.pond(60, 73, 12, 1);
  t.plateau(76, 66, 6, 2, ["L"]);

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
