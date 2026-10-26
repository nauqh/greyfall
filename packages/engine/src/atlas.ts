/**
 * The Atlas: the whole Shattered Reach as one map. Seven areas, each its own
 * landmass, joined only at named gates, the way a Souls map joins its areas:
 * a hub (Last Harbour), a gentle start (Saltreach), two ways onward that loop
 * back (Emberwood and the Fen), a shortcut that opens from the far side (the
 * Moor Gate), and the Greyfall behind a locked gate and a high road.
 *
 * Pure data in the war island's height-map format (island.ts), so the war's
 * autotiler draws it and its pathing walks it. The web dresses it.
 */

import { cellKey, isWalkable, stepsFrom, useIsland, type Cell, type Island } from "./island.ts";
import { makeRng } from "./rng.ts";

export type AreaId = "saltreach" | "harbour" | "emberwood" | "crags" | "barrowmoor" | "fen" | "greyfall";

export interface AtlasArea {
  id: AreaId;
  name: string;
  blurb: string;
  /** Tileset colours: lowland, plateau, Crown. */
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
  /** The tiles that cross the water between the two areas. */
  cells: Cell[];
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
}

export interface AtlasMap {
  island: Island;
  /** The area index each tile belongs to, a digit a tile, "-" for open sea. */
  areaAt: string[];
  areas: AtlasArea[];
  gates: AtlasGate[];
  roads: Cell[];
  props: Placed[];
  dwellers: Dweller[];
  /** Bonfires: where the warband would rest. */
  fires: Cell[];
  bosses: { name: string; area: AreaId; col: number; row: number }[];
  /** Fence pens and barricades, as rectangles or lines of tiles. */
  fences: { col: number; row: number; w: number; h: number }[];
}

export const ATLAS_SIZE = { cols: 128, rows: 80 } as const;

export const AREAS: readonly AtlasArea[] = [
  {
    id: "saltreach",
    name: "Saltreach",
    blurb: "Fishing isles on the west shore, where the boats put in. The yellow militia still hold the villages, just.",
    palette: [5, 3, 1],
    mood: 0xffffff,
    label: { col: 13, row: 56 },
  },
  {
    id: "harbour",
    name: "Last Harbour",
    blurb: "The last free town, under the blue castle. Every road starts at the fire in its square, and every road comes back to it.",
    palette: [3, 1, 1],
    mood: 0xffffff,
    label: { col: 40, row: 47 },
  },
  {
    id: "emberwood",
    name: "Emberwood",
    blurb: "Old pine the goblins burn for room. Warrens in every clearing, and a troll in the biggest one.",
    palette: [4, 2, 3],
    mood: 0xffe2c8,
    label: { col: 38, row: 4 },
  },
  {
    id: "crags",
    name: "Tinker Crags",
    blurb: "Gnome country on the high rock, all towers and slingshots. A bridge runs off the top toward the grey.",
    palette: [2, 1, 3],
    mood: 0xfff8e6,
    label: { col: 81, row: 24 },
  },
  {
    id: "barrowmoor",
    name: "Barrowmoor",
    blurb: "The old kings' barrows. The dead walk the moor at dusk, and something with horns keeps the deepest grave.",
    palette: [4, 3, 1],
    mood: 0xc4c4e4,
    label: { col: 77, row: 57 },
  },
  {
    id: "fen",
    name: "Lizard Fen",
    blurb: "Reed and black water between the shore and the moor. A purple chapel prays to the grey in the middle of it.",
    palette: [5, 4, 1],
    mood: 0xdcecdc,
    label: { col: 66, row: 76 },
  },
  {
    id: "greyfall",
    name: "The Greyfall",
    blurb: "The warlord's citadel, where the grey pours from. Two keys open its gate; the gnomes' high road is the other way in.",
    palette: [4, 4, 2],
    mood: 0x9c9fa8,
    label: { col: 112, row: 46 },
  },
];

const AREA_INDEX = Object.fromEntries(AREAS.map((a, i) => [a.id, i])) as Record<AreaId, number>;

/** Each area's land, as ragged ellipses: centre, radii. */
const BLOBS: Record<AreaId, readonly [number, number, number, number][]> = {
  saltreach: [[14, 46, 11, 10], [12, 61, 10, 9], [21, 70, 8, 5]],
  harbour: [[40, 42, 14, 9], [35, 50, 10, 5]],
  emberwood: [[40, 14, 18, 11], [24, 10, 8, 7], [56, 9, 8, 6]],
  crags: [[80, 11, 16, 9], [82, 19, 12, 6], [92, 23, 6, 5]],
  barrowmoor: [[78, 46, 15, 10], [88, 54, 8, 6]],
  fen: [[62, 70, 14, 7], [78, 72, 10, 6]],
  greyfall: [[113, 27, 12, 15], [113, 50, 12, 13], [117, 66, 8, 6]],
};

/**
 * The atlas, the same every time. Land first, then the channels that keep
 * areas apart, then high ground, water, roads, the gates across the channels,
 * and woods everywhere nothing else stands.
 */
export function atlasMap(): AtlasMap {
  const rng = makeRng("atlas");
  const { cols, rows } = ATLAS_SIZE;
  const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill("~"));
  const area: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const put = (c: number, r: number, ch: string): void => {
    if (r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1) grid[r]![c] = ch;
  };
  const at = (c: number, r: number): string => grid[r]?.[c] ?? "~";

  // Land.
  for (const a of AREAS) {
    for (const [cx, cy, rx, ry] of BLOBS[a.id]) {
      const wobble = Array.from({ length: 24 }, () => 0.86 + rng.next() * 0.22);
      for (let r = cy - ry - 2; r <= cy + ry + 2; r++) {
        for (let c = cx - rx - 2; c <= cx + rx + 2; c++) {
          const ang = Math.atan2(r - cy, c - cx);
          const w = wobble[Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 24) % 24]!;
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 > w * w) continue;
          if (r < 2 || c < 2 || r >= rows - 2 || c >= cols - 2) continue;
          grid[r]![c] = ".";
          area[r]![c] = AREA_INDEX[a.id];
        }
      }
    }
  }
  // Channels: land within two tiles of another area's goes back to sea.
  const owner = area.map((l) => [...l]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const me = owner[r]![c]!;
      if (me < 0) continue;
      let other = false;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) other ||= (owner[r + dr]?.[c + dc] ?? -1) >= 0 && owner[r + dr]![c + dc] !== me;
      if (other) {
        grid[r]![c] = "~";
        area[r]![c] = -1;
      }
    }
  }

  /** Stepped high ground, a tile in each side every two rows, ramps on its last row. */
  const plateau = (x0: number, y0: number, w: number, h: number, ramps: readonly ("L" | "R")[], step = true): void => {
    for (let r = 0; r < h; r++) {
      const inset = step ? Math.floor(r / 2) : 0;
      for (let c = x0 + inset; c <= x0 + w - 1 - inset; c++) put(c, y0 + r, "#");
    }
    const last = step ? Math.floor((h - 1) / 2) : 0;
    // Ground under every bottom edge, for its cliff face to stand on.
    for (let r = 0; r < h; r++) {
      const inset = step ? Math.floor(r / 2) : 0;
      for (let c = x0 + inset; c <= x0 + w - 1 - inset; c++) if (at(c, y0 + r + 1) === "~") put(c, y0 + r + 1, ".");
    }
    for (const side of ramps) {
      const c = side === "L" ? x0 + last - 1 : x0 + w - last;
      put(c, y0 + h - 1, side === "L" ? "<" : ">");
      put(c, y0 + h - 2, ".");
      put(c, y0 + h, ".");
    }
  };
  /** The Crown on a plateau, with stairs at both ends of its last row. */
  const crown = (x0: number, y0: number, w: number, h: number): void => {
    for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "^");
    put(x0 - 1, y0 + h - 1, "[");
    put(x0 + w, y0 + h - 1, "]");
  };
  const pond = (x0: number, y0: number, w: number, h: number): void => {
    for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "~");
  };

  // Saltreach: a bluff for the lighthouse.
  plateau(5, 37, 9, 4, ["R"]);
  // Last Harbour: the castle hill over the town.
  plateau(35, 33, 12, 4, ["L", "R"]);
  // Emberwood: Smoke Ridge, and a tarn.
  plateau(48, 13, 8, 4, ["L"]);
  pond(43, 21, 4, 2);
  // Tinker Crags: the great rock, the Crown on it.
  plateau(70, 5, 22, 10, ["L", "R"]);
  crown(77, 7, 8, 3);
  // Barrowmoor: three barrows.
  plateau(68, 40, 6, 2, ["R"]);
  plateau(80, 38, 8, 4, ["L"]);
  plateau(70, 50, 6, 2, ["L"]);
  // Lizard Fen: black pools.
  for (const [x, y, w, h] of [[53, 67, 3, 2], [59, 71, 3, 2], [65, 66, 2, 2], [69, 73, 3, 2], [75, 68, 2, 2], [82, 74, 3, 2], [57, 75, 2, 1]] as const) pond(x, y, w, h);
  // The Greyfall: the citadel, square-walled, the Crown in its heart.
  plateau(104, 17, 18, 26, ["L", "R"], false);
  crown(108, 21, 10, 8);

  // Roads, before the gates and the woods.
  const roadSet = new Set<string>();
  const line = (a: Cell, b: Cell, each: (c: Cell) => void): void => {
    const n = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
    for (let i = 0; i <= n; i++) each({ col: Math.round(a.col + ((b.col - a.col) * i) / Math.max(1, n)), row: Math.round(a.row + ((b.row - a.row) * i) / Math.max(1, n)) });
  };
  const road = (...pts: [number, number][]): void => {
    for (let i = 1; i < pts.length; i++) line({ col: pts[i - 1]![0], row: pts[i - 1]![1] }, { col: pts[i]![0], row: pts[i]![1] }, (c) => roadSet.add(`${c.col},${c.row}`));
  };

  // Gates across the channels: a strip three tiles wide.
  const gates: AtlasGate[] = [];
  const gate = (id: string, name: string, kind: GateKind, from: AreaId, to: AreaId, a: Cell, b: Cell, note: string, width = 3): void => {
    const cells: Cell[] = [];
    const seen = new Set<string>();
    line(a, b, (p) => {
      for (let d = -Math.floor(width / 2); d <= Math.floor((width - 1) / 2); d++) {
        const horizontal = Math.abs(b.col - a.col) >= Math.abs(b.row - a.row);
        const c = horizontal ? { col: p.col, row: p.row + d } : { col: p.col + d, row: p.row };
        const k = `${c.col},${c.row}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (at(c.col, c.row) === "~") {
          put(c.col, c.row, kind === "high" ? "#" : ".");
          cells.push(c);
        } else if (kind !== "high" && "T".includes(at(c.col, c.row))) put(c.col, c.row, ".");
      }
    });
    const mid = cells[Math.floor(cells.length / 2)] ?? a;
    gates.push({ id, name, kind, from, to, note, at: mid, cells });
  };
  gate("old-bridge", "Old Bridge", "open", "saltreach", "harbour", { col: 22, row: 45 }, { col: 31, row: 44 }, "The way in from the shore, always open.");
  gate("ember-gate", "Ember Gate", "gate", "harbour", "emberwood", { col: 30, row: 37 }, { col: 30, row: 22 }, "A palisade on the causeway north. The town bars it at night.");
  gate("crag-stair", "Crag Stair", "open", "emberwood", "crags", { col: 61, row: 11 }, { col: 69, row: 16 }, "A gnome path out of the smoke, up to the rock.");
  gate("moor-gate", "Moor Gate", "shortcut", "harbour", "barrowmoor", { col: 52, row: 42 }, { col: 65, row: 44 }, "Barred from the moor side. Whoever comes through the moor can open it, and come home the short way.");
  gate("fen-causeway", "Fen Causeway", "open", "saltreach", "fen", { col: 27, row: 72 }, { col: 50, row: 72 }, "A long spit of shingle along the south shore.", 2);
  gate("barrow-path", "Barrow Path", "open", "fen", "barrowmoor", { col: 78, row: 67 }, { col: 82, row: 57 }, "Duckboards over the reeds, up onto the moor.");
  gate("grey-gate", "Grey Gate", "locked", "barrowmoor", "greyfall", { col: 93, row: 47 }, { col: 104, row: 47 }, "Two locks: the troll's key and the minotaur's.");
  gate("sky-bridge", "Sky Bridge", "high", "crags", "greyfall", { col: 92, row: 6 }, { col: 104, row: 6 }, "The gnomes' high road off the top of the rock, straight onto the citadel wall.", 2);
  // The high road turns down onto the citadel's top.
  for (let r = 6; r < 17; r++) for (const c of [103, 104]) if (at(c, r) !== "#") put(c, r, "#");

  road([16, 49], [22, 45], [31, 44], [36, 41], [41, 40]);
  road([41, 40], [33, 39], [30, 37], [30, 22], [30, 17], [37, 17]);
  road([41, 40], [48, 42], [52, 42], [65, 44], [76, 46], [85, 50]);
  road([14, 49], [13, 55], [14, 63]);
  road([18, 66], [27, 72], [50, 72], [62, 70], [78, 70], [80, 62]);
  road([37, 17], [44, 10], [56, 10], [62, 12], [69, 16]);
  road([93, 47], [101, 47], [102, 45]);
  const roads = [...roadSet].map((k) => ({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]) })).filter((c) => at(c.col, c.row) === ".");

  // What stands where. Coordinates are tiles; a building stands with its base on its row.
  const props: Placed[] = [];
  const dwellers: Dweller[] = [];
  const fires: Cell[] = [];
  const fences: AtlasMap["fences"] = [];
  const bosses: AtlasMap["bosses"] = [];
  const prop = (art: string, col: number, row: number, more: Omit<Placed, "art" | "col" | "row"> = {}): void => void props.push({ art, col, row, ...more });
  const who = (kind: string, col: number, row: number, more: Omit<Dweller, "kind" | "col" | "row"> = {}): void => void dwellers.push({ kind, col, row, ...more });

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
  fires.push({ col: 16, row: 49 });
  fences.push({ col: 16, row: 53, w: 4, h: 3 });
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

  // Last Harbour: castle on the hill, the town round the square, the docks.
  prop("castle", 41, 35, { color: "blue" });
  prop("tower", 36, 34, { color: "blue" });
  prop("tower", 46, 34, { color: "blue" });
  prop("monastery", 33, 42, { color: "blue" });
  prop("house1", 38, 41, { color: "blue" });
  prop("house2", 44, 41, { color: "blue" });
  prop("house3", 46, 44, { color: "blue" });
  prop("house1", 37, 45, { color: "blue" });
  prop("house2", 41, 46, { color: "blue" });
  prop("barracks", 50, 40, { color: "blue" });
  prop("archery", 30, 48, { color: "blue" });
  prop("goldMine", 51, 46);
  prop("boat", 34, 56);
  prop("boat", 40, 55, { flip: true });
  prop("tower", 29, 38, { color: "blue" });
  prop("tower", 32, 38, { color: "blue" });
  fires.push({ col: 41, row: 40 });
  fences.push({ col: 44, row: 47, w: 5, h: 3 });
  for (const [c, r] of [[45, 48], [47, 48], [46, 49]] as const) who("sheep", c, r);
  who("warrior", 30, 36, { color: "blue" });
  who("warrior", 31, 36, { color: "blue", flip: true });
  who("lancer", 36, 40, { color: "blue", to: { col: 47, row: 43 } });
  who("archer", 36, 35, { color: "blue" });
  who("archer", 45, 35, { color: "blue", flip: true });
  who("monk", 34, 44, { color: "blue" });
  who("pawn", 50, 47, { color: "blue", act: "pickaxe" });
  who("pawn", 52, 45, { color: "blue", act: "pickaxe", flip: true });
  who("pawn", 49, 44, { color: "blue", act: "gold", to: { col: 41, row: 42 } });
  who("pawn", 27, 41, { color: "blue", act: "axe" });
  who("pawn", 29, 43, { color: "blue", act: "wood", to: { col: 37, row: 43 } });
  who("pawn", 43, 44, { color: "blue", act: "hammer" });
  who("warrior", 51, 41, { color: "blue", to: { col: 51, row: 43 } });
  who("pawn", 39, 52, { color: "yellow", act: "meat", to: { col: 33, row: 51 } });

  // Emberwood: three warrens, the troll's clearing, logging at the gate.
  for (const [c, r, f] of [[23, 9, 0], [27, 11, 3], [24, 13, 6], [42, 6, 9], [46, 8, 12], [55, 8, 2], [58, 11, 5]] as const) prop("goblinHut", c, r, { frame: f });
  prop("deadTree", 34, 21);
  prop("trollDead", 50, 20, { scale: 0.6 });
  for (const [c, r] of [[26, 19], [29, 21], [33, 20], [24, 17], [27, 16]] as const) prop("stump", c, r);
  fires.push({ col: 25, row: 11 }, { col: 44, row: 8 }, { col: 56, row: 10 }, { col: 34, row: 21 });
  fences.push({ col: 19, row: 6, w: 4, h: 3 });
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
  bosses.push({ name: "Cinder Troll", area: "emberwood", col: 39, row: 16 });

  // Tinker Crags: gnome huts on the rock, a tower on the Crown, bears below.
  prop("gnomeTower", 81, 8);
  for (const [c, r] of [[72, 6], [89, 6], [75, 12], [86, 12]] as const) prop("gnomeHut", c, r);
  for (const [c, r] of [[78, 13], [83, 13], [73, 9]] as const) prop("goldStone", c, r);
  prop("gnomeHut", 71, 17);
  fires.push({ col: 80, row: 12 });
  who("gnome", 74, 11, { to: { col: 79, row: 12 } });
  who("gnome", 87, 11, { flip: true });
  who("gnome", 85, 7, { to: { col: 89, row: 9 } });
  who("slingshot", 79, 8);
  who("slingshot", 83, 8, { flip: true });
  who("slingshot", 71, 7);
  who("bear", 72, 19, { to: { col: 77, row: 21 } });
  who("bear", 88, 20, { flip: true });
  who("bee", 80, 20);
  who("bee", 84, 18);
  who("bee", 76, 18);
  who("panda", 93, 23);
  who("panda", 90, 25, { flip: true });
  who("pandaGuard", 92, 21);
  bosses.push({ name: "Old Bamboo", area: "crags", col: 92, row: 21 });

  // Barrowmoor: barrows, bones, the cave, and the minotaur's grave.
  prop("cave", 84, 47);
  for (const [c, r] of [[67, 45], [74, 48], [80, 45], [91, 50], [79, 53], [86, 58]] as const) prop("deadTree", c, r, { scale: 0.5 });
  for (const [c, r] of [[69, 40], [73, 40], [82, 38], [86, 39], [85, 52], [91, 52], [85, 57], [91, 57], [72, 50]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[75, 44], [78, 50], [83, 55], [88, 51], [68, 47], [79, 42], [90, 56]] as const) prop("bones", c, r);
  fires.push({ col: 77, row: 46 });
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
  bosses.push({ name: "The Barrow King", area: "barrowmoor", col: 88, row: 54 });

  // Lizard Fen: the purple chapel among the pools.
  prop("monastery", 78, 71, { color: "purple" });
  prop("house1", 74, 73, { color: "purple" });
  prop("house3", 82, 70, { color: "purple" });
  prop("tower", 60, 66, { color: "purple" });
  fires.push({ col: 66, row: 71 });
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

  // The Greyfall: the black legion on the citadel, imps over the Crown.
  prop("castle", 113, 25, { color: "black" });
  for (const [c, r] of [[105, 18], [120, 18], [105, 40], [120, 40]] as const) prop("tower", c, r, { color: "black" });
  prop("barracks", 110, 37, { color: "black" });
  prop("archery", 116, 37, { color: "black" });
  prop("monastery", 112, 55, { color: "purple" });
  // The last village before the citadel, burned out and still smoking.
  for (const [c, r, art] of [[108, 59, "house1"], [116, 60, "house3"], [119, 55, "house2"], [106, 54, "house2"]] as const) prop(art, c, r, { color: "black" });
  for (const [c, r] of [[104, 47], [104, 50], [107, 47], [107, 50]] as const) prop("skullSpike", c, r);
  fires.push({ col: 109, row: 60 }, { col: 117, row: 61 });
  who("skull", 110, 58, { to: { col: 117, row: 57 } });
  who("bat", 114, 52);
  who("lancer", 118, 49, { color: "black", to: { col: 110, row: 49 } });
  for (const [c, r] of [[106, 45], [106, 50]] as const) prop("tower", c, r, { color: "black" });
  prop("skullSpike", 108, 45);
  prop("skullSpike", 108, 50);
  fires.push({ col: 112, row: 31 });
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
  bosses.push({ name: "The Grey Warlord", area: "greyfall", col: 113, row: 26 });

  // Woods on open lowland nothing else uses, thick in Emberwood.
  const keep = new Set<string>();
  const clear = (c: number, r: number, rad: number): void => {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) keep.add(`${c + dc},${r + dr}`);
  };
  for (const p of props) clear(p.col, p.row, p.art === "castle" || p.art === "monastery" ? 3 : 2);
  for (const d of dwellers) clear(d.col, d.row, 1);
  for (const d of dwellers) if (d.to) line(d, d.to, (c) => clear(c.col, c.row, 1));
  for (const f of fires) clear(f.col, f.row, 2);
  for (const b of bosses) clear(b.col, b.row, 3);
  for (const f of fences) for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) keep.add(`${c},${r}`);
  for (const k of roadSet) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    clear(c, r, 1);
  }
  for (const g of gates) for (const c of g.cells) clear(c.col, c.row, 1);
  const density: Record<AreaId, number> = { saltreach: 0.07, harbour: 0.05, emberwood: 0.5, crags: 0.12, barrowmoor: 0.05, fen: 0.14, greyfall: 0.03 };
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const a = area[r]![c]!;
      if (a < 0 || at(c, r) !== "." || keep.has(`${c},${r}`)) continue;
      // Never on a cliff face, a ramp's foot, or beside a slope.
      if ("#^%<>[]".includes(at(c, r - 1)) || "<>[]".includes(at(c - 1, r)) || "<>[]".includes(at(c + 1, r))) continue;
      if (rng.next() < density[AREAS[a]!.id]) put(c, r, "T");
    }
  }

  const centre = { col: 41, row: 41 };
  const islandOf = (): Island => ({
    rows: grid.map((l) => l.join("")),
    start: { a: { castle: centre, barracks: centre }, b: { castle: centre, barracks: centre } },
    mines: [],
    lair: centre,
  });
  // Woods never wall a clearing off: a pocket nobody can reach gets a path cut to the rest.
  for (let pass = 0; pass < 200; pass++) {
    useIsland(islandOf());
    const seen = new Set([cellKey(centre)]);
    const queue = [centre];
    for (let i = 0; i < queue.length; i++) for (const n of stepsFrom(queue[i]!)) if (!seen.has(cellKey(n))) (seen.add(cellKey(n)), queue.push(n));
    let pocket: Cell | null = null;
    for (let r = 0; r < rows && !pocket; r++) for (let c = 0; c < cols && !pocket; c++) if (isWalkable(c, r) && !seen.has(cellKey({ col: c, row: r }))) pocket = { col: c, row: r };
    if (!pocket) break;
    // Out through the trees, the shortest way, to ground the rest can reach.
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
    if (!found) {
      // An islet of its own: let the woods have it.
      put(pocket.col, pocket.row, "T");
      continue;
    }
    for (let c: Cell | null = found; c; c = prev.get(cellKey(c)) ?? null) if (at(c.col, c.row) === "T") put(c.col, c.row, ".");
  }
  const island = islandOf();
  // Gate tiles join the nearer of their two areas; open sea stays unowned.
  for (const g of gates) {
    for (const c of g.cells) {
      const near = [g.from, g.to].map((id) => ({ id, d: Math.min(...BLOBS[id].map(([x, y]) => Math.abs(x - c.col) + Math.abs(y - c.row))) })).sort((p, q) => p.d - q.d)[0]!;
      area[c.row]![c.col] = AREA_INDEX[near.id];
    }
  }
  // Land the carving made outside every outline, a ramp's foot or a bridge's end, belongs to the nearest area.
  const owned = area.map((l) => [...l]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r]![c] === "~" || owned[r]![c]! >= 0) continue;
      let best = -1;
      for (let d = 1; d < 12 && best < 0; d++) for (let dr = -d; dr <= d && best < 0; dr++) for (let dc = -d; dc <= d && best < 0; dc++) best = area[r + dr]?.[c + dc] ?? -1;
      owned[r]![c] = best;
    }
  }
  const areaAt = owned.map((l, r) => l.map((a, c) => (a >= 0 && grid[r]![c] !== "~" ? String(a) : "-")).join(""));
  return { island, areaAt, areas: [...AREAS], gates, roads, props, dwellers, fires, bosses, fences };
}
