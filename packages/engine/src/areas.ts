/**
 * Area maps: each area of the atlas as a large map of its own, the camera
 * kept inside it. Its exits run off its edges to the areas beside it, and
 * its lifts go up or down a tier. Built with the atlas's tier builder, so
 * the same terrain, placement and checks hold: natural relief where the
 * land is wild, authored blocks where it is built, like a fortress.
 */

import { AREAS, noise, tierBuilder, type AreaId, type AtlasTier, type GateKind, type LiftKind } from "./atlas.ts";
import type { Cell } from "./island.ts";
import { makeRng, type Rng } from "./rng.ts";

export const AREA_SIZE = { cols: 112, rows: 72 } as const;

/** A way out of an area: off an edge to another area, or a lift up or down. */
export interface AreaExit {
  to: AreaId;
  name: string;
  kind: GateKind | LiftKind;
  /** Where it is, on this map. */
  at: Cell;
}

/** A quarter of an area with its own ground, dressing and name on the land. */
export interface District {
  name: string;
  /** Where its name sits, and the seed its ground grows from. */
  at: Cell;
  /** Tileset colour by height, lowland first; the last carries on up. */
  palette: readonly number[];
  /** The atlas area whose trees, rocks and bones it is dressed like. */
  dress: AreaId;
  /** Ground it owns outright, instead of growing from its seed. */
  box?: { x: number; y: number; w: number; h: number };
}

export interface AreaMap extends AtlasTier {
  area: AreaId;
  /** Where the camera opens, and where a traveller arrives. */
  entry: Cell;
  exits: AreaExit[];
  districts: District[];
  /** The district each tile belongs to, one digit a tile, "-" for water. */
  districtAt: string[];
  /** Raised bridge decks, drawn in their own colour. */
  decks: Cell[];
}

/** Land to its district: a box first, else the nearest seed, the border wandered by noise. */
function districtGrid(tier: AtlasTier, districts: readonly District[]): string[] {
  const wander = noise(`districts:${tier.id}`, 9);
  return tier.areaAt.map((line, r) =>
    [...line]
      .map((ch, c) => {
        if (ch === "-") return "-";
        const boxed = districts.findIndex((d) => d.box && c >= d.box.x && c < d.box.x + d.box.w && r >= d.box.y && r < d.box.y + d.box.h);
        if (boxed >= 0) return String(boxed);
        let best = 0;
        let near = Infinity;
        districts.forEach((d, i) => {
          if (d.box) return;
          const dist = Math.hypot(c - d.at.col, r - d.at.row) + wander(c + i * 31, r) * 11;
          if (dist < near) [best, near] = [i, dist];
        });
        return String(best);
      })
      .join(""),
  );
}

type Builder = ReturnType<typeof tierBuilder>;

/** Scatter `n` of a dweller round a spot, each walking a short beat. */
function crowd(t: Builder, rng: Rng, kind: string, at: Cell, n: number, spread: number, more: { color?: "blue" | "red" | "yellow" | "purple" | "black"; act?: string; walk?: boolean } = {}): void {
  for (let i = 0; i < n; i++) {
    const col = Math.round(at.col + (rng.next() * 2 - 1) * spread);
    const row = Math.round(at.row + (rng.next() * 2 - 1) * spread * 0.7);
    const to = more.walk === false ? undefined : { col: col + rng.int(7) - 3, row: row + rng.int(5) - 2 };
    t.who(kind, col, row, { ...(more.color && { color: more.color }), ...(more.act && { act: more.act }), ...(to && { to }), flip: rng.next() < 0.5 });
  }
}

/**
 * Last Harbour, the hub. North, the castle citadel climbs in terraces: a
 * gatehouse into the lower bailey, corner stairs to the upper bailey, one
 * stair to the keep. South of it the town round the bonfire square and the
 * Old Well; the docks on the bay; farms to the west, the mine hills east.
 */
function harbour(): AreaMap {
  const rng = makeRng("area:harbour");
  const t = tierBuilder("surface", rng, AREA_SIZE);
  const { prop, who } = t;

  // The land, forest at its back, and the bay cut into its south shore.
  t.blob("harbour", 56, 38, 50, 29);
  t.blob("harbour", 56, 14, 36, 11);
  t.blob("harbour", 20, 50, 16, 14);
  t.blob("harbour", 94, 50, 15, 14);
  t.blob("harbour", 92, 18, 12, 10);
  t.pond(44, 58, 26, 10);
  t.pond(48, 56, 18, 2);
  t.pond(86, 52, 5, 3);
  // An inlet between the Northwood and the knoll, and a ravine under the Sky Bridge.
  t.pond(10, 21, 15, 8);
  t.pond(78, 11, 8, 5);

  // The Citadel: terraces rising north, every face a cliff.
  // Lower bailey, the gatehouse cut into its south wall, a stair either side of the gate.
  t.block(2, 36, 12, 42, 19);
  t.block(1, 55, 29, 3, 2);
  t.stair(2, 55, 30, "R");
  t.stair(2, 57, 30, "L");
  // Upper bailey, two tiles in all round, a corner stair at each end: two ways up.
  t.block(3, 43, 12, 28, 11);
  t.stair(3, 42, 22, "L");
  t.stair(3, 71, 22, "R");
  // The keep, its one stair at its west end.
  t.block(4, 51, 12, 13, 6);
  t.stair(4, 50, 17, "L");

  // Old Town: two raised streets either side of the square, a stair at each end.
  t.block(2, 34, 34, 14, 6);
  t.stair(2, 33, 39, "L");
  t.stair(2, 48, 39, "R");
  t.block(2, 65, 33, 17, 7);
  t.stair(2, 64, 39, "L");
  t.stair(2, 82, 39, "R");

  // Wild heights: the Northwood and the west knoll, the mine hills, the moor bluff.
  t.relief({ area: "harbour", at: { col: 24, row: 15 }, rx: 7, ry: 6, levels: 2, core: { at: { col: 22, row: 18 }, r: 1.6 } });
  t.relief({ area: "harbour", at: { col: 16, row: 33 }, rx: 8, ry: 6, levels: 2, core: { at: { col: 20, row: 30 }, r: 1.6 } });
  t.relief({ area: "harbour", at: { col: 93, row: 21 }, rx: 10, ry: 11, levels: 3, core: { at: { col: 89, row: 14 }, r: 2.2 } });
  t.relief({ area: "harbour", at: { col: 98, row: 54 }, rx: 8, ry: 6, levels: 3, core: { at: { col: 99, row: 53 }, r: 1.6 } });

  // Raised bridges, each over water so nothing on the ground is cut off.
  const decks = [
    // Knoll Bridge: the Northwood to the knoll, over the inlet.
    ...t.span(2, 23, 20, 2, 9),
    ...t.span(2, 21, 29, 4, 2),
    // Sky Bridge: the upper bailey east over the ravine to the mine hills.
    ...t.span(3, 71, 12, 17, 2),
    // The Sea Wall: shore to shore across the bay's mouth, a stair up at each end.
    ...t.span(2, 40, 62, 35, 2),
  ];
  t.stair(2, 39, 63, "L");
  t.stair(2, 75, 63, "R");

  // Woods: the Keepwood behind the castle, the Northwood, copses east and south-west.
  t.grove(56, 6, 24, 4, 0.65);
  t.grove(24, 13, 9, 6, 0.55);
  t.grove(104, 36, 5, 6, 0.4);
  t.grove(28, 60, 8, 4, 0.35);

  // Roads: from the square to the gatehouse, the docks, and every exit.
  t.road([56, 44], [56, 32]);
  t.road([56, 44], [56, 54]);
  t.road([56, 44], [30, 44], [6, 42], [2, 42]);
  t.road([56, 44], [84, 44], [104, 44], [110, 44]);
  t.road([30, 44], [31, 30], [31, 9], [26, 8], [26, 1]);
  // Piers out into the bay, and the exits' causeways to the map's edge.
  t.bridge({ col: 50, row: 56 }, { col: 50, row: 59 });
  t.bridge({ col: 62, row: 56 }, { col: 62, row: 59 });
  t.bridge({ col: 6, row: 42 }, { col: 1, row: 42 }, 3);
  t.bridge({ col: 104, row: 44 }, { col: 110, row: 44 }, 3);
  t.bridge({ col: 26, row: 8 }, { col: 26, row: 1 }, 3);

  // The Citadel's buildings: towers on the bailey's corners, barracks and archery in it,
  // the monastery and houses above, the castle on the keep.
  for (const [c, r] of [[39, 15], [74, 16], [39, 28], [74, 28]] as const) prop("tower", c, r, { color: "blue" });
  prop("barracks", 47, 27, { color: "blue" });
  prop("archery", 66, 27, { color: "blue" });
  prop("monastery", 46, 17, { color: "blue" });
  prop("house2", 67, 17, { color: "blue" });
  prop("house3", 67, 21, { color: "blue" });
  prop("castle", 57, 15, { color: "blue" });
  t.fires.push({ col: 56, row: 25 });
  // The garrison: drilling in the lower bailey, archers on the corners, lancers at the gate and on the Sky Bridge.
  for (let i = 0; i < 4; i++) {
    who("warrior", 51 + i * 2, 26, { color: "blue" });
    who("lancer", 51 + i * 2, 28, { color: "blue" });
  }
  for (const [c, r] of [[40, 17], [73, 19], [40, 26], [73, 26]] as const) who("archer", c, r, { color: "blue" });
  who("lancer", 54, 32, { color: "blue" });
  who("lancer", 58, 32, { color: "blue", flip: true });
  who("lancer", 74, 12, { color: "blue", to: { col: 84, row: 12 } });
  who("monk", 48, 20, { color: "blue", to: { col: 62, row: 20 } });
  who("warrior", 45, 21, { color: "blue", to: { col: 68, row: 21 } });

  // Old Town: the bonfire and the Old Well on the square, cottages below, the tall houses on the raised streets.
  t.fires.push({ col: 56, row: 40 });
  const below: [number, number][] = [[50, 36], [62, 36], [42, 46], [70, 46], [46, 50], [52, 50], [61, 50], [67, 50], [38, 50], [76, 50], [80, 47], [34, 47]];
  below.forEach(([c, r], i) => prop(`house${1 + (i % 3)}`, c, r, { color: "blue" }));
  for (const [c, r] of [[36, 35], [40, 35], [44, 36], [67, 34], [71, 34], [75, 35], [79, 34]] as const) prop("house2", c, r, { color: "blue" });
  prop("archery", 72, 38, { color: "blue" });
  crowd(t, rng, "pawn", { col: 56, row: 44 }, 6, 10, { color: "blue", act: "gold" });
  crowd(t, rng, "pawn", { col: 56, row: 47 }, 3, 8, { color: "yellow", act: "meat" });
  crowd(t, rng, "pawn", { col: 72, row: 36 }, 3, 5, { color: "blue" });
  who("pawn", 52, 41, { color: "blue", act: "hammer" });
  who("monk", 60, 42, { color: "blue" });
  who("warrior", 46, 45, { color: "blue", to: { col: 66, row: 45 } });

  // The Docks: fish huts on the shore, boats inside the Sea Wall, a light on each headland.
  for (const [c, r] of [[42, 55], [70, 55], [56, 54]] as const) prop("fishHut", c, r);
  for (const [c, r] of [[46, 59], [55, 59], [67, 59], [58, 67]] as const) prop("boat", c, r, { flip: c > 56 });
  prop("tower", 37, 61, { color: "blue" });
  prop("tower", 77, 61, { color: "blue" });
  crowd(t, rng, "pawn", { col: 56, row: 53 }, 4, 8, { color: "blue", act: "knife" });
  who("archer", 44, 62, { color: "blue", to: { col: 70, row: 62 } });
  who("turtle", 47, 54);
  who("rubberDuck", 52, 61);
  who("paddleShark", 4, 64, { to: { col: 30, row: 68 } });

  // West Fields: pens of sheep and pigs, farmhouses, the harvest.
  t.fences.push({ col: 8, row: 44, w: 6, h: 4 }, { col: 20, row: 50, w: 5, h: 4 }, { col: 10, row: 54, w: 5, h: 3 }, { col: 24, row: 56, w: 5, h: 3 });
  for (const [c, r] of [[10, 45], [11, 46], [12, 45], [21, 51], [22, 52]] as const) who("sheep", c, r);
  for (const [c, r] of [[11, 55], [12, 55], [26, 57]] as const) who("pig", c, r);
  for (const [c, r] of [[18, 46], [16, 58], [28, 51]] as const) prop("house3", c, r, { color: "blue" });
  crowd(t, rng, "pawn", { col: 18, row: 50 }, 4, 6, { color: "blue", act: "axe" });
  prop("tower", 17, 33, { color: "blue" });

  // The Northwood: woodcutters' cabins in the trees, and the knoll's watch.
  prop("house1", 30, 18, { color: "blue" });
  prop("house1", 22, 9, { color: "blue" });
  crowd(t, rng, "pawn", { col: 26, row: 14 }, 3, 4, { color: "blue", act: "axe" });
  who("bear", 40, 6, { to: { col: 52, row: 5 } });
  who("bear", 72, 7, { to: { col: 64, row: 5 } });

  // The Mine Hills: the gold mine on the slope, gold in the rock, a cave under the crest.
  prop("goldMine", 90, 31, {});
  for (const [c, r] of [[94, 20], [88, 18], [99, 25], [84, 25], [89, 12]] as const) prop("goldStone", c, r);
  prop("cave", 100, 30, {});
  crowd(t, rng, "pawn", { col: 90, row: 34 }, 4, 5, { color: "blue", act: "pickaxe", walk: false });
  who("pawn", 88, 35, { color: "blue", act: "gold", to: { col: 70, row: 44 } });

  // Moor Watch: the old graves on the bluff, a tower over the moor road.
  prop("tower", 104, 41, { color: "blue" });
  who("archer", 104, 42, { color: "blue" });
  for (const [c, r] of [[95, 51], [99, 50], [102, 53], [96, 56]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[93, 58], [104, 57], [100, 59]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[97, 53], [101, 55]] as const) prop("bones", c, r);
  who("skull", 98, 52, { to: { col: 102, row: 54 } });
  who("monk", 92, 49, { color: "blue" });

  const tier = t.finish({ harbour: 0.06 }, [{ col: 56, row: 44 }]);
  const exits: AreaExit[] = [
    { to: "saltreach", name: "Old Bridge", kind: "open", at: { col: 1, row: 42 } },
    { to: "barrowmoor", name: "Moor Gate", kind: "shortcut", at: { col: 110, row: 44 } },
    { to: "emberwood", name: "Ember Gate", kind: "gate", at: { col: 26, row: 1 } },
    { to: "undercroft", name: "Old Well", kind: "drop", at: { col: 56, row: 43 } },
    { to: "steps", name: "Watch Lift", kind: "shortcut", at: { col: 62, row: 15 } },
  ];
  const districts: District[] = [
    { name: "The Citadel", at: { col: 57, row: 33 }, palette: [3, 4, 1, 5], dress: "harbour", box: { x: 36, y: 12, w: 42, h: 19 } },
    { name: "Old Town", at: { col: 56, row: 46 }, palette: [3, 2, 2], dress: "harbour" },
    { name: "The Docks", at: { col: 56, row: 64 }, palette: [4, 3], dress: "saltreach" },
    { name: "West Fields", at: { col: 16, row: 52 }, palette: [1, 2, 2], dress: "harbour" },
    { name: "The Northwood", at: { col: 22, row: 12 }, palette: [2, 3, 3], dress: "emberwood" },
    { name: "The Keepwood", at: { col: 44, row: 8 }, palette: [2, 2, 2], dress: "emberwood" },
    { name: "Mine Hills", at: { col: 93, row: 24 }, palette: [4, 1, 3], dress: "crags" },
    { name: "Moor Watch", at: { col: 102, row: 56 }, palette: [5, 4, 3], dress: "barrowmoor" },
  ];
  return { ...tier, area: "harbour", entry: { col: 56, row: 44 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

const BUILT: Partial<Record<AreaId, () => AreaMap>> = { harbour };

/** The areas that have a map of their own so far. */
export const MAPPED_AREAS = Object.keys(BUILT) as AreaId[];

/** An area's own map, the same every time. */
const made = new Map<AreaId, AreaMap>();

export function areaMap(id: AreaId): AreaMap {
  const build = BUILT[id];
  if (!build) throw new Error(`${AREAS.find((a) => a.id === id)?.name ?? id} has no map yet`);
  if (!made.has(id)) made.set(id, build());
  return made.get(id)!;
}
