/**
 * Area maps: each area of the atlas as a large map of its own, the camera
 * kept inside it. Its exits run off its edges to the areas beside it, and
 * its lifts go up or down a tier. Built with the atlas's tier builder, so
 * the same terrain, placement and checks hold: natural relief where the
 * land is wild, authored blocks where it is built, like a fortress.
 */

import { AREAS, footprint, noise, tierBuilder, type AreaId, type AtlasTier, type GateKind, type LiftKind } from "./atlas.ts";
import type { Cell } from "./island.ts";
import { makeRng, type Rng } from "./rng.ts";


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
  /** Radius of the open clearing round its seed in a maze; 6 when unset. */
  clearing?: number;
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

/**
 * Diablo-style ground for finish(): woods everywhere but winding corridors,
 * a randomized depth-first tree over a jittered grid of waypoints with a few
 * extra links for loops, small clearings at some waypoints, and the rooms.
 */
function maze(t: Builder, rng: Rng, rooms: readonly { at: Cell; r: number }[], cell = 11): (c: number, r: number) => boolean {
  const [cols, rows] = [t.grid[0]!.length, t.grid.length];
  const open = new Set<number>();
  const ragged = noise(`maze:${rng.int(1_000_000)}`, 3);
  const stamp = (x: number, y: number, rad: number): void => {
    for (let dr = -Math.ceil(rad); dr <= rad; dr++) for (let dc = -Math.ceil(rad); dc <= rad; dc++) if (dc * dc + dr * dr <= rad * rad) open.add((y + dr) * cols + x + dc);
  };
  const gw = Math.floor(cols / cell);
  const gh = Math.floor(rows / cell);
  const node: (Cell | null)[] = [];
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const p = { col: i * cell + 2 + rng.int(cell - 3), row: j * cell + 2 + rng.int(cell - 3) };
      node.push(t.at(p.col, p.row) === "~" ? null : p);
    }
  }
  const near = (k: number): number[] =>
    [k % gw > 0 ? k - 1 : -1, k % gw < gw - 1 ? k + 1 : -1, k - gw, k + gw].filter((n) => n >= 0 && n < node.length && node[n]);
  const linked = new Set<number>();
  const edges: [number, number][] = [];
  node.forEach((p, k0) => {
    if (!p || linked.has(k0)) return;
    const stack = [k0];
    linked.add(k0);
    while (stack.length > 0) {
      const k = stack[stack.length - 1]!;
      const free = near(k).filter((n) => !linked.has(n));
      if (free.length === 0) {
        stack.pop();
        continue;
      }
      const n = free[rng.int(free.length)]!;
      linked.add(n);
      edges.push([k, n]);
      stack.push(n);
    }
  });
  node.forEach((p, k) => p && near(k).forEach((n) => n > k && rng.next() < 0.12 && edges.push([k, n])));
  for (const [ka, kb] of edges) {
    const [a, b] = [node[ka]!, node[kb]!];
    const steps = Math.ceil(Math.hypot(b.col - a.col, b.row - a.row) * 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a.col + ((b.col - a.col) * i) / steps);
      const y = Math.round(a.row + ((b.row - a.row) * i) / steps);
      stamp(x, y, 1.2 + ragged(x, y) * 0.6);
    }
  }
  for (const p of node) if (p && rng.next() < 0.3) stamp(p.col, p.row, 2.2 + rng.next() * 1.4);
  for (const room of rooms) {
    for (let r = Math.floor(room.at.row - room.r); r <= room.at.row + room.r; r++) {
      for (let c = Math.floor(room.at.col - room.r - 3); c <= room.at.col + room.r + 3; c++) {
        if (Math.hypot(c - room.at.col, (r - room.at.row) * 1.3) < room.r + ragged(c, r) * 2.5) open.add(r * cols + c);
      }
    }
  }
  return (c, r) => open.has(r * cols + c);
}

/** A lake: a ragged ellipse of water, its shore wandered by noise. */
function lake(t: Builder, cx: number, cy: number, rx: number, ry: number): void {
  const shore = noise(`lake:${cx},${cy}`, 3);
  for (let r = Math.floor(cy - ry - 1); r <= cy + ry + 1; r++) {
    for (let c = Math.floor(cx - rx - 1); c <= cx + rx + 1; c++) {
      if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 <= 1 + shore(c, r) * 0.35) t.pond(c, r, 1, 1);
    }
  }
}

/** Underground, the maze's woods are rock: a wall tile becomes standing stone wherever its south face lands on more wall, a fringe of rubble left at its foot. */
function stone(tier: AtlasTier): AtlasTier {
  // Never a face on the ground a building keeps round it, though that ground be woods.
  const kept = new Set(tier.props.flatMap((p) => footprint(p, true).map((c) => `${c.col},${c.row}`)));
  const shut = (c: number, r: number) => "T%~".includes(tier.island.rows[r]?.[c] ?? "%") && !kept.has(`${c},${r}`);
  const rows = tier.island.rows.map((l, r) => [...l].map((ch, c) => (ch === "T" && shut(c, r + 1) ? "%" : ch)).join(""));
  return { ...tier, island: { ...tier.island, rows } };
}

/** A river: water `width` wide along a line of points. */
function river(t: Builder, points: readonly (readonly [number, number])[], width: number): void {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    t.cut({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, width, (c) => t.pond(c.col, c.row, 1, 1));
  }
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
  const t = tierBuilder("surface", rng, { cols: 112, rows: 80 });
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
  // Lighthouse Point: a headland curling south-west round the bay's mouth, and rocks offshore.
  for (const [x, y, rx, ry] of [[100, 64, 8, 6], [92, 71, 9, 4], [80, 75, 8, 3]] as const) t.blob("harbour", x, y, rx, ry);
  for (const [x, y, rx, ry] of [[8, 72, 5, 4], [106, 6, 4, 3], [30, 76, 4, 2]] as const) t.blob("harbour", x, y, rx, ry);

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

  // Lighthouse Point: the light at the headland's tip.
  prop("tower", 80, 74, { color: "blue" });
  t.fires.push({ col: 86, row: 72 });
  who("archer", 82, 75, { color: "blue", to: { col: 96, row: 70 } });

  // Moor Watch: the old graves on the bluff, a tower over the moor road.
  prop("tower", 104, 41, { color: "blue" });
  who("archer", 104, 42, { color: "blue" });
  for (const [c, r] of [[95, 51], [99, 50], [102, 53], [96, 56]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[93, 58], [104, 57], [100, 59]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[97, 53], [101, 55]] as const) prop("bones", c, r);
  who("skull", 98, 52, { to: { col: 102, row: 54 } });
  who("monk", 92, 49, { color: "blue" });

  // The Citadel's walks: a trail from the gate round both baileys to every stair, guns on the walls.
  t.road([56, 28], [43, 27], [42, 24]);
  t.road([56, 28], [70, 27], [71, 24]);
  t.road([44, 20], [50, 19]);
  t.road([69, 20], [52, 20]);
  for (const c of [40, 46, 66, 72]) prop("cannon", c, 30);
  for (const c of [48, 64]) prop("cannon", c, 22);
  prop("cannon", 61, 17);
  prop("woodPile", 51, 25);
  prop("tools", 62, 25);
  prop("meat", 63, 28);
  // Old Town's raised streets, paved along their fronts.
  t.road([34, 39], [47, 39]);
  t.road([65, 39], [81, 39]);

  const districts: District[] = [
    { name: "The Citadel", at: { col: 57, row: 33 }, palette: [3, 4, 1, 5], dress: "harbour", box: { x: 36, y: 12, w: 42, h: 19 } },
    { name: "Old Town", at: { col: 56, row: 46 }, palette: [3, 2, 2], dress: "harbour", clearing: 11 },
    { name: "The Docks", at: { col: 56, row: 64 }, palette: [4, 3], dress: "saltreach", clearing: 8 },
    { name: "West Fields", at: { col: 16, row: 52 }, palette: [1, 2, 2], dress: "harbour", clearing: 10 },
    { name: "The Northwood", at: { col: 22, row: 12 }, palette: [2, 3, 3], dress: "emberwood" },
    { name: "The Keepwood", at: { col: 44, row: 8 }, palette: [2, 2, 2], dress: "emberwood" },
    { name: "Mine Hills", at: { col: 93, row: 24 }, palette: [4, 1, 3], dress: "crags" },
    { name: "Lighthouse Point", at: { col: 90, row: 76 }, palette: [3, 2], dress: "saltreach", clearing: 4 },
    { name: "Moor Watch", at: { col: 102, row: 56 }, palette: [5, 4, 3], dress: "barrowmoor" },
  ];
  const rooms = districts.map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 56, row: 44 }], maze(t, rng, rooms));
  const exits: AreaExit[] = [
    { to: "saltreach", name: "Old Bridge", kind: "open", at: { col: 1, row: 42 } },
    { to: "barrowmoor", name: "Moor Gate", kind: "shortcut", at: { col: 110, row: 44 } },
    { to: "emberwood", name: "Ember Gate", kind: "gate", at: { col: 26, row: 1 } },
    { to: "undercroft", name: "Old Well", kind: "drop", at: { col: 56, row: 43 } },
    { to: "steps", name: "Watch Lift", kind: "shortcut", at: { col: 62, row: 15 } },
  ];
  return { ...tier, area: "harbour", entry: { col: 56, row: 44 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function emberwood(): AreaMap {
  const rng = makeRng("area:emberwood");
  const t = tierBuilder("surface", rng, { cols: 128, rows: 72 });
  const { prop, who } = t;

  t.blob("emberwood", 56, 36, 52, 31);
  t.blob("emberwood", 22, 52, 18, 14);
  t.blob("emberwood", 96, 16, 14, 12);
  t.blob("emberwood", 114, 18, 13, 8);
  lake(t, 108, 62, 16, 11);
  lake(t, 6, 6, 12, 9);
  // The Ember Run: a river across the wood, west to east, so every way north picks its crossing.
  river(t, [[2, 42], [18, 38], [34, 37], [50, 40], [66, 38], [82, 32], [98, 34], [110, 30]], 3);
  t.pond(10, 57, 7, 4);

  // Warren Hill: the goblins' hill, its warrens stacked up three heights.
  t.relief({ area: "emberwood", at: { col: 25, row: 23 }, rx: 12, ry: 10, levels: 3, core: { at: { col: 28, row: 29 }, r: 1.6 } });
  // Smoke Bluff across the river from it, and the Treetop Walk between them over the water.
  t.relief({ area: "emberwood", at: { col: 26, row: 46 }, rx: 8, ry: 5, levels: 2, core: { at: { col: 28, row: 43 }, r: 1.8 } });
  const decks = t.span(2, 27, 32, 2, 10);

  // Troll's Hollow: the biggest clearing, walled by a ring of rock, one gap in its south side.
  t.block(2, 52, 6, 22, 3);
  t.block(2, 52, 6, 3, 18);
  t.block(2, 71, 6, 3, 18);
  t.block(2, 52, 21, 9, 3);
  t.block(2, 65, 21, 9, 3);
  t.stair(2, 51, 23, "L");
  t.stair(2, 74, 23, "R");

  // Crag Foot: the rock rising in the north-east, and an ash mound in the Burn.
  t.relief({ area: "emberwood", at: { col: 92, row: 12 }, rx: 11, ry: 7, levels: 3 });
  t.relief({ area: "emberwood", at: { col: 80, row: 58 }, rx: 7, ry: 5, levels: 2 });

  // Woods: the Old Pines in the west, the north wood, copses in the east.
  t.grove(16, 52, 13, 13, 0.75);
  t.grove(36, 8, 16, 4, 0.6);
  t.grove(84, 44, 9, 5, 0.45);
  t.grove(100, 50, 6, 8, 0.5);
  t.grove(44, 52, 6, 5, 0.4);

  // Roads: north from the gate over the Cinder Ford to the Hollow, on to the Crag Stair,
  // and round through the Burn and the east bridge: a loop back to the gate.
  t.road([40, 64], [40, 56], [44, 44], [44, 34], [52, 28], [62, 25], [62, 18]);
  t.road([52, 28], [76, 24], [88, 26], [100, 20], [126, 18]);
  t.road([40, 56], [62, 54], [76, 48], [88, 40], [88, 26]);
  t.bridge({ col: 44, row: 35 }, { col: 44, row: 43 }, 3);
  // The Pine Ford: stepping stones from the Old Pines into the wood behind Warren Hill.
  t.bridge({ col: 13, row: 34 }, { col: 13, row: 41 }, 2);
  t.bridge({ col: 88, row: 28 }, { col: 88, row: 37 }, 3);
  t.bridge({ col: 40, row: 64 }, { col: 40, row: 70 }, 3);
  t.bridge({ col: 118, row: 18 }, { col: 126, row: 18 }, 3);

  // The Palisade: the Harbour's side of the gate, woodcutters and a watch fire.
  t.fires.push({ col: 43, row: 61 });
  t.fences.push({ col: 32, row: 60, w: 6, h: 2 }, { col: 45, row: 60, w: 6, h: 2 });
  prop("tower", 36, 64, { color: "blue" });
  prop("house1", 47, 65, { color: "blue" });
  for (const [c, r] of [[34, 56], [37, 53], [48, 57], [51, 62]] as const) prop("stump", c, r);
  crowd(t, rng, "pawn", { col: 40, row: 58 }, 4, 5, { color: "blue", act: "axe" });
  who("archer", 36, 62, { color: "blue" });
  who("lancer", 42, 66, { color: "blue", to: { col: 42, row: 58 } });

  // Old Pines: the deep wood the goblins have not burnt yet, a hermit's hut by the pool.
  prop("house3", 18, 60, { color: "purple" });
  who("monk", 20, 61, { color: "purple" });
  who("bear", 10, 48, { to: { col: 20, row: 44 } });
  who("bear", 24, 56);
  who("turtle", 13, 59);
  for (const [c, r] of [[8, 52], [26, 50]] as const) who("bee", c, r, { to: { col: c + 4, row: r - 2 } });

  // Smoke Bluff and Warren Hill: goblin warrens on every height, slingers on the Treetop Walk.
  for (const [c, r] of [[24, 45], [30, 46]] as const) prop("goblinHut", c, r);
  for (const [c, r] of [[18, 26], [24, 30], [32, 26], [20, 20], [30, 20], [25, 16]] as const) prop("goblinHut", c, r);
  t.fires.push({ col: 26, row: 24 });
  crowd(t, rng, "torch", { col: 25, row: 24 }, 5, 6);
  crowd(t, rng, "spear", { col: 26, row: 44 }, 3, 3);
  who("slingshot", 27, 34, { to: { col: 28, row: 40 } });
  who("shaman", 27, 21);
  prop("skullSpike", 22, 31);
  prop("skullSpike", 31, 31);

  // Troll's Hollow: the Cinder Troll in the ash, bones of everything it caught, goblins on the rim.
  t.bosses.push({ name: "Cinder Troll", area: "emberwood", col: 62, row: 13 });
  who("troll", 62, 13, { to: { col: 66, row: 15 } });
  for (const [c, r] of [[57, 11], [68, 12], [59, 17], [66, 18], [63, 10]] as const) prop("bones", c, r);
  for (const [c, r] of [[56, 15], [69, 16]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[54, 8], [72, 8], [53, 22], [72, 22]] as const) who("spear", c, r);
  prop("skullSpike", 60, 24);
  prop("skullSpike", 65, 24);

  // The Burn: the goblins' cleared ground, huts and fires in the ash, the mound their chief holds.
  for (const [c, r] of [[64, 50], [70, 47], [66, 57], [74, 52], [80, 57]] as const) prop("goblinHut", c, r);
  for (const [c, r] of [[60, 46], [72, 60], [86, 52], [58, 58], [76, 44]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[62, 60], [68, 44], [84, 56], [78, 50]] as const) prop("stump", c, r);
  t.fires.push({ col: 70, row: 53 });
  crowd(t, rng, "torch", { col: 70, row: 52 }, 6, 7);
  crowd(t, rng, "thief", { col: 66, row: 56 }, 2, 4);
  who("shaman", 80, 56);
  who("gnoll", 76, 49, { to: { col: 86, row: 46 } });

  // Crag Foot: the gnomes' path up out of the smoke, their hut on the rock.
  prop("gnomeHut", 92, 10);
  prop("gnomeTower", 98, 14);
  crowd(t, rng, "gnome", { col: 94, row: 12 }, 3, 3);
  who("gnome", 104, 19, { to: { col: 96, row: 22 } });
  for (const [c, r] of [[86, 8], [100, 8]] as const) prop("goldStone", c, r);

  // The Cinder Ford: where the road crosses the Run.
  who("lizard", 50, 39, { to: { col: 60, row: 38 } });
  who("thief", 46, 30, { to: { col: 40, row: 28 } });

  // The goblins' works: planks on the Treetop Walk, a lookout on Warren Hill's crest, their larders and trophies.
  t.road([28, 33], [28, 40]);
  prop("watchtower", 28, 29);
  for (const [c, r] of [[20, 23], [33, 23], [23, 33], [31, 33], [26, 42]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[19, 28], [31, 21]] as const) prop("meat", c, r);
  for (const [c, r] of [[22, 28], [29, 22], [24, 46]] as const) prop("woodPile", c, r);
  // Troll's Hollow: skulls on the corners of its rim.
  for (const [c, r] of [[53, 7], [73, 7], [52, 23], [73, 23]] as const) prop("skullSpike", c, r);

  const districts: District[] = [
    { name: "The Palisade", at: { col: 40, row: 61 }, palette: [3, 2], dress: "harbour" },
    { name: "Old Pines", at: { col: 13, row: 50 }, palette: [2, 3], dress: "emberwood" },
    { name: "Smoke Bluff", at: { col: 26, row: 41 }, palette: [3, 4], dress: "emberwood" },
    { name: "Warren Hill", at: { col: 24, row: 17 }, palette: [4, 5, 1], dress: "emberwood" },
    { name: "Cinder Ford", at: { col: 46, row: 32 }, palette: [3, 2], dress: "fen" },
    { name: "Troll's Hollow", at: { col: 63, row: 19 }, palette: [4, 1], dress: "barrowmoor", box: { x: 52, y: 6, w: 22, h: 18 } },
    { name: "The Burn", at: { col: 72, row: 54 }, palette: [4, 1], dress: "greyfall" },
    { name: "Crag Foot", at: { col: 94, row: 22 }, palette: [2, 3, 1], dress: "crags" },
  ];
  const rooms = districts.map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 40, row: 64 }], maze(t, rng, rooms));
  const exits: AreaExit[] = [
    { to: "harbour", name: "Ember Gate", kind: "gate", at: { col: 40, row: 70 } },
    { to: "crags", name: "Crag Stair", kind: "open", at: { col: 126, row: 18 } },
  ];
  return { ...tier, area: "emberwood", entry: { col: 40, row: 64 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function crags(): AreaMap {
  const rng = makeRng("area:crags");
  const t = tierBuilder("surface", rng, { cols: 112, rows: 90 });
  const { prop, who } = t;

  t.blob("crags", 72, 33, 40, 34);
  t.blob("crags", 24, 42, 22, 24);
  t.blob("crags", 56, 60, 40, 10);
  // The Southern Spur: a ridge running down off the town into the sea.
  for (const [x, y, rx, ry] of [[60, 74, 16, 7], [70, 82, 10, 5]] as const) t.blob("crags", x, y, rx, ry);
  for (const [x, y, rx, ry] of [[20, 80, 5, 3], [100, 82, 4, 3]] as const) t.blob("crags", x, y, rx, ry);
  t.pond(100, 30, 10, 14);

  // The Tinker Rock: five gnome-built steps, each leaving only a ledge round the next,
  // and each stair at the far end from the last, so the climb walks every ledge.
  // Each step is two blocks overlapping, so no ledge runs an even width round a box.
  t.block(2, 46, 10, 52, 46);
  t.block(3, 52, 10, 30, 37);
  t.block(3, 60, 10, 36, 40);
  t.block(4, 54, 10, 30, 34);
  t.block(4, 54, 10, 36, 24);
  t.block(5, 64, 10, 18, 16);
  // On at the south-west and the south-east; up at the east, the west, the east again.
  t.stair(2, 45, 55, "L");
  t.stair(2, 98, 55, "R");
  t.stair(3, 96, 49, "R");
  t.stair(4, 53, 43, "L");
  t.stair(5, 82, 25, "R");
  // The Gun Platform: a raised battery on the Cog Terrace, its own stair up, apart from the peak.
  t.block(5, 70, 32, 10, 6);
  t.stair(5, 69, 37, "L");
  // The Sky Bridge: the gnomes' high road off the peak, east over the ledges to the map's edge.
  const decks = t.span(5, 82, 10, 29, 2);

  // The foothills south-east, a knoll in the grove.
  t.relief({ area: "crags", at: { col: 80, row: 64 }, rx: 9, ry: 4, levels: 2 });
  t.relief({ area: "crags", at: { col: 12, row: 30 }, rx: 6, ry: 5, levels: 2 });

  // Roads: in from the Crag Stair to the foot of the climb, Tinker Town, the grove and round to the far stair.
  t.road([2, 46], [20, 46], [36, 56], [45, 57]);
  t.road([36, 56], [36, 63], [70, 63], [98, 57]);
  t.road([20, 46], [20, 26]);
  // The climb's trail, worn along each ledge from one stair to the next.
  t.road([47, 53], [95, 53], [96, 51]);
  t.road([94, 47], [60, 47], [56, 45], [53, 45]);
  t.road([55, 42], [66, 40], [82, 30], [82, 27]);
  t.road([57, 40], [57, 33]);
  t.road([80, 23], [76, 16]);
  t.bridge({ col: 6, row: 46 }, { col: 1, row: 46 }, 3);

  // Crag Gate: where the path from the Emberwood comes up out of the trees.
  t.fires.push({ col: 10, row: 49 });
  prop("gnomeTower", 8, 42);
  who("gnome", 9, 44, { to: { col: 16, row: 46 } });

  // The Bamboo Grove: pandas in the thicket, their old one's cubs.
  for (const [c, r] of [[16, 22], [24, 24], [19, 30]] as const) who("panda", c, r, { to: { col: c + 3, row: r + 2 } });
  for (const [c, r] of [[10, 36], [28, 34]] as const) who("bee", c, r, { to: { col: c + 3, row: r - 2 } });
  for (const [c, r] of [[14, 26], [26, 28]] as const) prop("bones", c, r);

  // Tinker Town at the rock's foot: gnome huts and towers, the tinkers at work.
  for (const [c, r] of [[28, 60], [34, 66], [44, 62], [52, 66], [60, 62], [66, 66]] as const) prop("gnomeHut", c, r);
  for (const [c, r] of [[40, 66], [58, 66]] as const) prop("gnomeTower", c, r);
  t.fires.push({ col: 48, row: 63 });
  t.fences.push({ col: 30, row: 63, w: 5, h: 2 });
  crowd(t, rng, "gnome", { col: 48, row: 62 }, 7, 9);
  who("slingshot", 42, 58, { to: { col: 54, row: 58 } });

  // The Lower Works on the first step: the gnomes' gold mine and their ore.
  prop("goldMine", 62, 51);
  for (const [c, r] of [[50, 53], [74, 53], [84, 52], [48, 30], [49, 40]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnome", { col: 66, row: 53 }, 3, 3, { walk: false });
  who("gnome", 52, 54, { to: { col: 90, row: 54 } });

  // The Ledges of the second step: slingers on the wind.
  who("slingshot", 60, 47, { to: { col: 92, row: 47 } });
  who("slingshot", 94, 20, { to: { col: 94, row: 40 } });
  prop("gnomeTower", 92, 46);

  // The Cog Terrace on the third step: Old Bamboo waits where the climb arrives, before the last stair.
  t.bosses.push({ name: "Old Bamboo", area: "crags", col: 58, row: 30 });
  who("pandaGuard", 58, 30);
  who("panda", 56, 26, { flip: true });
  who("panda", 60, 35);
  prop("gnomeHut", 58, 18);
  prop("gnomeHut", 76, 40);
  who("slingshot", 66, 41, { to: { col: 86, row: 41 } });

  // Tinker Peak: the gnomes' towers, the fire at the top, the lift into the clouds.
  t.fires.push({ col: 74, row: 22 });
  for (const [c, r] of [[67, 13], [79, 19]] as const) prop("gnomeTower", c, r);
  prop("gnomeHut", 68, 22);
  crowd(t, rng, "gnome", { col: 74, row: 18 }, 4, 4);
  prop("goldStone", 80, 13);
  // The Cog Terrace's far side: the tinkers' sheds, their gold, and the stair to the peak.
  for (const [c, r] of [[72, 32], [80, 38], [66, 40]] as const) prop("gnomeHut", c, r);
  prop("gnomeTower", 86, 20);
  for (const [c, r] of [[84, 28], [62, 36]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnome", { col: 76, row: 35 }, 3, 4);

  // The Southern Spur: the gnomes' far watch over the sea.
  prop("watchtower", 70, 83);
  prop("goldStone", 64, 78);
  who("gnome", 66, 80, { to: { col: 74, row: 82 } });

  // The Foothills and the Windward Shore.
  for (const [c, r] of [[78, 60], [86, 63]] as const) who("lizard", c, r, { to: { col: c - 6, row: r + 2 } });
  who("snake", 92, 64);
  prop("fishHut", 104, 50);
  prop("boat", 104, 34, {});
  who("turtle", 101, 46);

  // Batteries on every rim, aimed down the climb, and guns on the flanks.
  for (const c of [52, 58, 68, 76, 84, 92]) prop("cannon", c, 55);
  for (const c of [64, 72, 80, 88]) prop("cannon", c, 49);
  for (const c of [58, 66, 76]) prop("cannon", c, 43);
  for (const c of [66, 72, 78]) prop("cannon", c, 25);
  for (const r of [20, 30, 40]) prop("cannonSide", 46, r, { flip: true });
  for (const r of [20, 30, 40]) prop("cannonSide", 97, r);
  // Watchtowers on the corners of the climb, and one over the Gun Platform.
  for (const [c, r] of [[48, 50], [93, 52], [92, 36], [86, 14]] as const) prop("watchtower", c, r);
  prop("watchtower", 74, 35);
  prop("cannon", 71, 37);
  prop("cannon", 78, 37);
  who("slingshot", 76, 33, { to: { col: 72, row: 33 } });
  // Workshop yards: the tinkers' fenced sheds, wood, tools and stores.
  t.fences.push({ col: 55, row: 13, w: 8, h: 6 }, { col: 84, row: 40, w: 8, h: 5 });
  for (const [c, r] of [[56, 14], [61, 14], [86, 41], [90, 43]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[57, 17], [88, 41], [70, 52], [55, 52]] as const) prop("tools", c, r);
  for (const [c, r] of [[60, 17], [89, 43]] as const) prop("meat", c, r);
  who("gnome", 58, 15, { to: { col: 61, row: 16 } });
  who("gnome", 87, 42);

  const exits: AreaExit[] = [
    { to: "emberwood", name: "Crag Stair", kind: "open", at: { col: 1, row: 46 } },
    { to: "gilded", name: "Gnome Lift", kind: "lift", at: { col: 76, row: 14 } },
    { to: "greyfall", name: "Sky Bridge", kind: "high", at: { col: 110, row: 10 } },
  ];
  const districts: District[] = [
    { name: "Tinker Peak", at: { col: 73, row: 24 }, palette: [3, 4, 1, 5, 2], dress: "crags", box: { x: 64, y: 10, w: 18, h: 16 } },
    { name: "The Climb", at: { col: 70, row: 47 }, palette: [3, 4, 1, 5, 2], dress: "crags", box: { x: 46, y: 10, w: 52, h: 46 } },
    { name: "Crag Gate", at: { col: 8, row: 48 }, palette: [3, 2], dress: "crags" },
    { name: "Bamboo Grove", at: { col: 20, row: 26 }, palette: [2, 3], dress: "emberwood", clearing: 7 },
    { name: "Tinker Town", at: { col: 48, row: 63 }, palette: [1, 2], dress: "harbour", clearing: 9 },
    { name: "Foothills", at: { col: 82, row: 63 }, palette: [4, 3], dress: "crags" },
    { name: "Windward Shore", at: { col: 104, row: 47 }, palette: [5, 4], dress: "saltreach" },
  ];
  const rooms = districts.filter((d) => !d.box).map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 6, row: 46 }], maze(t, rng, rooms));
  return { ...tier, area: "crags", entry: { col: 6, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function greyfall(): AreaMap {
  const rng = makeRng("area:greyfall");
  const t = tierBuilder("surface", rng, { cols: 124, rows: 72 });
  const { prop, who } = t;
  const black = { color: "black" } as const;

  // The citadel's rock, walled to its corners, and the ashen ground before its gate.
  t.ground("greyfall", 19, 4, 89, 63);
  t.blob("greyfall", 62, 36, 52, 36);
  t.blob("greyfall", 11, 44, 12, 18);
  // The east coast: coves bitten out of it, sea stacks off it.
  lake(t, 114, 34, 6, 10);
  for (const [x, y, rx, ry] of [[118, 18, 4, 6], [118, 56, 4, 5], [112, 66, 4, 3]] as const) t.blob("greyfall", x, y, rx, ry);

  // Rotfield: a river of rot winding down the bailey into the Crater, a lake with a shrine on its isle.
  river(t, [[27, 14], [33, 24], [29, 34], [34, 44], [36, 50]], 3);
  lake(t, 37, 55, 9, 5);
  t.ground("greyfall", 35, 54, 5, 3);

  // The curtain wall: walkable ramparts round the whole castle, a bastion on each corner,
  // and the Grey Gate a gap in the west wall.
  t.block(2, 22, 6, 83, 3);
  t.block(2, 22, 62, 83, 3);
  t.block(2, 22, 6, 3, 36);
  t.block(2, 22, 47, 3, 18);
  t.block(2, 102, 6, 3, 59);
  for (const [x, y] of [[22, 6], [98, 6], [22, 58], [98, 58]] as const) t.block(2, x, y, 7, 7);
  t.stair(2, 25, 41, "R");

  // The High City, after Sellia and Redmane: six raised blocks, a street on every side of each so none fuses
  // with its neighbour or the walls, every stair at a block's corner with the street at its foot.
  const blocks: [number, number, number, number][] = [[52, 11, 14, 11], [70, 11, 17, 11], [91, 11, 9, 11], [52, 27, 14, 13], [70, 27, 17, 13], [91, 27, 9, 13]];
  for (const [x, y, w, h] of blocks) {
    t.block(2, x, y, w, h);
    t.stair(2, x - 1, y + h - 1, "L");
    t.stair(2, x + w, y + h - 1, "R");
  }
  // A spur off the north rampart and its stair: the Sky Bridge's way down into the city.
  t.block(2, 67, 9, 2, 2);
  t.stair(2, 66, 10, "L");
  // The Keep's tier, and the Keep on the fourth height with a stair either side.
  t.block(3, 72, 11, 13, 9);
  t.stair(3, 71, 19, "L");
  t.stair(3, 85, 19, "R");
  t.block(4, 75, 11, 8, 6);
  t.stair(4, 74, 16, "L");
  t.stair(4, 83, 16, "R");
  // The Warlord's Hall's tier.
  t.block(3, 73, 29, 11, 9);
  t.stair(3, 72, 37, "L");
  t.stair(3, 84, 37, "R");
  // Raised walkways over the streets: Garrison to Keep, the Keep's tier to the Hall's, Archers to Drill.
  const decks = [
    ...t.span(2, 66, 15, 4, 2),
    ...t.span(3, 77, 20, 2, 9),
    ...t.span(2, 94, 22, 2, 5),
    // The Sky Bridge: the gnomes' high road from the west, landing on the north rampart.
    ...t.span(2, 1, 6, 21, 2),
  ];

  // Crags of the old rock, standing out of the rot.
  t.relief({ area: "greyfall", at: { col: 44, row: 28 }, rx: 6, ry: 4, levels: 2 });
  t.relief({ area: "greyfall", at: { col: 15, row: 34 }, rx: 5, ry: 4, levels: 2 });

  // Roads: in at the Grey Gate over the rot, to the city's stairs and round to the Gallows; the causeway to the shrine.
  t.road([1, 44], [24, 44], [40, 44], [48, 41], [51, 41]);
  t.road([40, 44], [44, 50], [66, 52], [90, 52]);
  t.road([30, 44], [30, 20], [36, 16]);
  t.bridge({ col: 6, row: 44 }, { col: 1, row: 44 }, 3);
  t.bridge({ col: 31, row: 44 }, { col: 38, row: 44 }, 3);
  t.bridge({ col: 37, row: 49 }, { col: 37, row: 54 }, 2);
  // The climb's trail over the roofs: block to bridge to tier to the keep.
  t.road([70, 38], [86, 38]);
  t.road([70, 20], [86, 20]);
  t.road([72, 18], [84, 18]);

  // The Ashen Approach: the war dead before the gate, and the dogs that eat them.
  prop("trollDead", 12, 38);
  for (const [c, r] of [[8, 38], [16, 41], [14, 50], [6, 52], [18, 55]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[10, 41], [18, 48], [9, 55], [15, 31], [4, 46]] as const) prop("bones", c, r);
  for (const [c, r] of [[5, 34], [17, 54], [8, 58]] as const) prop("deadTree", c, r, { scale: 0.7 });
  t.fires.push({ col: 9, row: 47 });
  crowd(t, rng, "gnoll", { col: 12, row: 52 }, 4, 4);
  who("bat", 10, 50);
  who("bat", 16, 36);

  // Rotfield: the bailey gone to rot, ruins in the dead wood, the dead and the dogs.
  for (const [c, r, art] of [[27, 28, "house1"], [42, 20, "house2"], [27, 52, "house3"], [44, 38, "house1"], [47, 58, "house2"]] as const) prop(art, c, r, black);
  for (const [c, r] of [[36, 30], [40, 34], [46, 46], [26, 38], [44, 24]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[38, 42], [27, 46], [46, 44], [35, 36], [41, 28]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 38, row: 38 }, 5, 6);
  crowd(t, rng, "gnoll", { col: 42, row: 32 }, 3, 3);
  who("skullGuard", 44, 48);
  who("troll", 45, 27, { to: { col: 47, row: 30 } });
  for (const [c, r] of [[32, 40], [28, 22]] as const) who("snake", c, r);

  // The Crater: the rot lake, and on its isle the shrine where the grey is prayed to, a fire to rest by.
  t.fires.push({ col: 37, row: 55 });
  for (const [c, r] of [[35, 54], [39, 54], [35, 56], [39, 56]] as const) prop("skullSpike", c, r);
  who("skullGuard", 38, 55);
  who("bombFish", 31, 56);
  who("bombFish", 43, 54);

  // The Ruined Chapel: a purple monastery praying to the grey, and its graves.
  prop("monastery", 38, 13, { color: "purple" });
  for (const [c, r] of [[33, 17], [36, 19], [42, 18], [45, 15], [32, 12]] as const) prop("skullSpike", c, r);
  who("monk", 40, 17, { color: "purple", to: { col: 44, row: 18 } });
  who("shaman", 44, 12);

  // The Gallows Yard: gibbets in rows, the warlord's barracks, and the Harbour's folk penned.
  for (let c = 56; c <= 76; c += 4) prop("skullSpike", c, 59);
  prop("barracks", 62, 48, black);
  prop("archery", 76, 48, black);
  t.fences.push({ col: 84, row: 52, w: 7, h: 5 });
  for (const [c, r] of [[86, 54], [88, 53], [89, 55]] as const) who("pawn", c, r, { color: "blue" });
  who("lancer", 58, 55, { ...black, to: { col: 80, row: 55 } });
  crowd(t, rng, "warrior", { col: 70, row: 55 }, 3, 4, black);
  for (const c of [34, 50, 66, 82, 94]) prop("cannon", c, 64);

  // The ramparts: a black tower on every bastion, archers on the walk.
  for (const [c, r] of [[25, 9], [101, 9], [25, 61], [101, 61]] as const) prop("tower", c, r, black);
  who("archer", 40, 7, { ...black, to: { col: 50, row: 7 } });
  who("archer", 103, 30, { ...black, to: { col: 103, row: 50 } });
  who("lancer", 23, 30, { ...black, to: { col: 23, row: 16 } });

  // The High City's blocks, each its own quarter.
  // The Garrison: barracks, stores, the watch drilling, guns over the street.
  prop("barracks", 58, 14, black);
  prop("house1", 63, 14, black);
  prop("house3", 55, 19, black);
  for (const [c, r] of [[60, 19], [62, 19]] as const) prop("woodPile", c, r);
  prop("tools", 57, 17);
  crowd(t, rng, "warrior", { col: 59, row: 17 }, 3, 2, black);
  for (const c of [54, 63]) prop("cannon", c, 21);
  prop("tower", 54, 14, black);
  prop("meat", 64, 17);
  who("archer", 54, 16, { ...black, to: { col: 54, row: 19 } });
  // The Archers' Yard: the tower, the butts, guns at its foot.
  prop("tower", 95, 13, black);
  prop("archery", 95, 19, black);
  who("archer", 93, 16, { ...black, to: { col: 98, row: 16 } });
  for (const c of [92, 98]) prop("cannon", c, 21);
  prop("house1", 98, 15, black);
  prop("tools", 92, 16);
  // The Champions' Pit: the minotaur in its pen, the champions' houses round it.
  t.fences.push({ col: 54, row: 29, w: 8, h: 5 });
  who("minotaurGuard", 57, 31, { to: { col: 59, row: 31 } });
  for (const [c, r] of [[63, 30], [56, 37], [62, 37]] as const) prop("house2", c, r, black);
  prop("meat", 64, 35);
  for (const [c, r] of [[55, 35], [60, 35]] as const) prop("bones", c, r);
  for (const [c, r] of [[53, 28], [62, 28], [53, 34], [62, 34]] as const) prop("skullSpike", c, r);
  crowd(t, rng, "warrior", { col: 58, row: 36 }, 3, 2, black);
  // The Warlord's Hall on its tier, its guard, guns on the block's rim.
  prop("monastery", 78, 33, black);
  for (const [c, r] of [[74, 30], [82, 30], [73, 36], [83, 36]] as const) prop("skullSpike", c, r);
  prop("house3", 76, 36, black);
  prop("house3", 81, 36, black);
  who("skullGuard", 78, 35);
  crowd(t, rng, "monk", { col: 78, row: 30 }, 2, 2, { color: "purple" });
  for (const c of [71, 85]) prop("cannon", c, 39);
  // The Drill Yard: barracks, the fire, the line, guns over the Gallows.
  prop("barracks", 95, 30, black);
  t.fires.push({ col: 95, row: 35 });
  for (let i = 0; i < 3; i++) who("warrior", 92 + i * 3, 37, black);
  for (const c of [92, 98]) prop("cannon", c, 39);
  prop("house2", 98, 34, black);
  prop("woodPile", 92, 33);
  prop("tools", 92, 35);
  // The streets: the dead patrol them, a lancer rides the long one.
  who("skull", 68, 14, { to: { col: 68, row: 38 } });
  who("skull", 88, 24, { to: { col: 88, row: 38 } });
  who("lancer", 55, 24, { ...black, to: { col: 85, row: 24 } });

  // The Keep: the black castle on the fourth height, the Warlord on the tier before it, his guard, guns on the tier.
  prop("castle", 78, 13, black);
  t.bosses.push({ name: "The Grey Warlord", area: "greyfall", col: 78, row: 18 });
  who("warrior", 78, 18, black);
  for (const [c, r] of [[75, 18], [81, 18]] as const) who("skullGuard", c, r);
  for (const [c, r] of [[72, 17], [84, 17], [73, 12], [84, 12]] as const) prop("skullSpike", c, r);
  for (const c of [70, 86]) prop("cannon", c, 21);

  const exits: AreaExit[] = [
    { to: "barrowmoor", name: "Grey Gate", kind: "locked", at: { col: 1, row: 44 } },
    { to: "crags", name: "Sky Bridge", kind: "high", at: { col: 1, row: 6 } },
    { to: "gilded", name: "Throne Stair", kind: "lift", at: { col: 81, row: 12 } },
  ];
  const districts: District[] = [
    { name: "The Keep", at: { col: 78, row: 8 }, palette: [4, 5, 3, 1], dress: "greyfall", box: { x: 75, y: 11, w: 8, h: 6 } },
    { name: "The High City", at: { col: 88, row: 24 }, palette: [4, 5, 3, 1], dress: "greyfall", box: { x: 52, y: 9, w: 50, h: 32 } },
    { name: "Rotfield", at: { col: 36, row: 32 }, palette: [4, 5], dress: "greyfall", clearing: 7 },
    { name: "The Crater", at: { col: 37, row: 60 }, palette: [5, 4], dress: "barrowmoor", clearing: 4 },
    { name: "Ruined Chapel", at: { col: 38, row: 18 }, palette: [3, 5], dress: "barrowmoor", clearing: 6 },
    { name: "Gallows Yard", at: { col: 72, row: 55 }, palette: [4, 5], dress: "greyfall", clearing: 8 },
    { name: "The Ashen Approach", at: { col: 12, row: 52 }, palette: [4, 5], dress: "barrowmoor", clearing: 5 },
  ];
  const rooms = districts.filter((d) => !d.box).map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const wild = maze(t, rng, rooms);
  // The High City's streets are paved, not wood: open between every block.
  const tier = t.finish({}, [{ col: 6, row: 44 }], (c, r) => wild(c, r) || (c >= 51 && c <= 101 && r >= 9 && r <= 41));
  return { ...tier, area: "greyfall", entry: { col: 6, row: 44 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function gilded(): AreaMap {
  const rng = makeRng("area:gilded");
  const t = tierBuilder("sky", rng, { cols: 112, rows: 72 });
  const { prop, who } = t;
  const gold = { color: "yellow" } as const;
  const black = { color: "black" } as const;

  // A city of isles in the sky, after Anor Londo and Leyndell: each quarter its own isle, joined by narrow bridges.
  t.blob("gilded", 12, 36, 7, 6);
  t.blob("gilded", 32, 34, 11, 10);
  t.blob("gilded", 36, 10, 12, 7);
  t.blob("gilded", 26, 58, 9, 7);
  t.blob("gilded", 64, 34, 20, 16);
  t.ground("gilded", 50, 20, 30, 26);
  t.blob("gilded", 70, 8, 11, 5);
  t.blob("gilded", 64, 61, 11, 6);
  // The throne isle: nothing but the warlord's black plaza, hung off the city's east end.
  t.ground("gilded", 92, 28, 13, 13);

  t.bridge({ col: 17, row: 36 }, { col: 23, row: 35 });
  t.bridge({ col: 32, row: 26 }, { col: 34, row: 16 });
  t.bridge({ col: 28, row: 43 }, { col: 26, row: 52 });
  t.bridge({ col: 42, row: 34 }, { col: 47, row: 34 });
  t.bridge({ col: 66, row: 19 }, { col: 68, row: 12 });
  t.bridge({ col: 64, row: 49 }, { col: 64, row: 56 });
  t.bridge({ col: 47, row: 10 }, { col: 60, row: 9 });
  t.bridge({ col: 6, row: 36 }, { col: 1, row: 36 }, 3);

  // The Sun Steps: the capital climbs in three terraces to the Sun Hall, a stair either side of each.
  t.block(2, 52, 22, 26, 22);
  t.stair(2, 51, 43, "L");
  t.stair(2, 78, 43, "R");
  t.block(3, 56, 22, 18, 15);
  t.stair(3, 55, 36, "L");
  t.stair(3, 74, 36, "R");
  t.block(4, 60, 22, 10, 8);
  t.stair(4, 70, 29, "R");
  // The throne isle, raised to the lower city's height and reached only by the Gilded Span.
  t.block(2, 92, 28, 13, 13);
  const decks = t.span(2, 78, 32, 14, 2);

  // Trails: up the Sun Steps, and along the Span.
  t.road([50, 43], [53, 41], [54, 37]);
  t.road([56, 35], [60, 31], [71, 30]);
  t.road([78, 32], [92, 32]);
  // The main way through the isles: landing, market, the capital's west stair.
  t.road([6, 36], [20, 36], [32, 35], [48, 34], [50, 43]);

  // Cloud Landing: where the rope bridge from the Steps comes in.
  t.fires.push({ col: 11, row: 38 });
  prop("tower", 14, 33, gold);
  who("archer", 14, 34, gold);
  who("bee", 9, 33);

  // The Gold Market: the gnome-kings' traders, their gold in heaps, their stores.
  for (const [c, r, art] of [[26, 30, "house1"], [30, 28, "house2"], [37, 29, "house3"], [25, 39, "house2"], [36, 40, "house1"]] as const) prop(art, c, r, gold);
  for (const [c, r] of [[29, 34], [34, 36], [39, 33], [27, 36]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[32, 31], [24, 34]] as const) prop("meat", c, r);
  prop("woodPile", 38, 37);
  t.fences.push({ col: 28, row: 38, w: 5, h: 3 });
  t.fires.push({ col: 33, row: 33 });
  crowd(t, rng, "gnome", { col: 32, row: 34 }, 5, 6);
  crowd(t, rng, "pawn", { col: 31, row: 35 }, 3, 5, { ...gold, act: "gold" });

  // The Bee Gardens: the kings' hives in a hanging grove.
  t.grove(36, 9, 10, 5, 0.35);
  prop("house3", 32, 8, gold);
  prop("house1", 41, 12, gold);
  crowd(t, rng, "bee", { col: 36, row: 10 }, 6, 6);
  who("monk", 38, 11, { ...gold, to: { col: 34, row: 12 } });

  // Gnome Landing: where the lift comes up off the Tinker Peak.
  prop("gnomeTower", 22, 56);
  prop("gnomeHut", 30, 56);
  prop("gnomeHut", 24, 61);
  for (const [c, r] of [[29, 61], [21, 60]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnome", { col: 26, row: 59 }, 4, 4);

  // The Gilded Gate, north: the yellow guard's barracks and drill yard.
  prop("barracks", 66, 7, gold);
  prop("tower", 60, 8, gold);
  prop("tower", 78, 8, gold);
  t.fires.push({ col: 72, row: 9 });
  for (let i = 0; i < 3; i++) who("lancer", 70 + i * 2, 7, gold);
  who("warrior", 74, 10, { ...gold, to: { col: 64, row: 10 } });

  // The Sun Steps: the lower city, the guard's terrace, and the Sun Hall where the Sentinel stands.
  for (const [c, r, art] of [[54, 40, "house2"], [58, 41, "house1"], [71, 41, "house3"], [75, 40, "house2"], [54, 26, "house1"], [76, 26, "house3"]] as const) prop(art, c, r, gold);
  for (const [c, r] of [[53, 23], [77, 23]] as const) prop("tower", c, r, gold);
  prop("barracks", 59, 34, gold);
  prop("archery", 71, 34, gold);
  prop("monastery", 58, 27, gold);
  prop("castle", 65, 26, gold);
  for (const [c, r] of [[57, 33], [72, 31]] as const) prop("goldStone", c, r);
  t.bosses.push({ name: "The Sun Sentinel", area: "gilded", col: 65, row: 29 });
  who("lancer", 65, 29, { ...gold, scale: 1.8 });
  for (const [c, r] of [[57, 23], [73, 23]] as const) who("archer", c, r, gold);
  who("warrior", 60, 38, { ...gold, to: { col: 70, row: 38 } });
  who("monk", 66, 33, gold);

  // The Sun Chapel, south: monks at the shrine fire under open sky.
  prop("monastery", 64, 60, gold);
  t.fires.push({ col: 64, row: 64 });
  for (const [c, r] of [[58, 62], [70, 62]] as const) prop("goldStone", c, r);
  crowd(t, rng, "monk", { col: 64, row: 63 }, 3, 4, gold);

  // The Throne Isle: black stone over the gold, imps round the warlord's empty seat.
  for (const [c, r] of [[95, 31], [102, 31]] as const) prop("tower", c, r, black);
  for (const [c, r] of [[94, 37], [98, 38], [102, 37]] as const) prop("skullSpike", c, r);
  crowd(t, rng, "imp", { col: 98, row: 34 }, 3, 3);
  who("skullGuard", 93, 33);

  const exits: AreaExit[] = [
    { to: "steps", name: "Cloud Bridge", kind: "open", at: { col: 1, row: 36 } },
    { to: "crags", name: "Gnome Lift", kind: "lift", at: { col: 26, row: 58 } },
    { to: "greyfall", name: "Throne Stair", kind: "lift", at: { col: 99, row: 34 } },
  ];
  const districts: District[] = [
    { name: "The Sun Steps", at: { col: 65, row: 46 }, palette: [1, 2, 4, 5], dress: "gilded", box: { x: 50, y: 20, w: 30, h: 26 } },
    { name: "The Throne Isle", at: { col: 98, row: 42 }, palette: [4, 4, 5], dress: "greyfall", box: { x: 92, y: 28, w: 13, h: 13 } },
    { name: "Cloud Landing", at: { col: 12, row: 40 }, palette: [2, 1], dress: "gilded", clearing: 4 },
    { name: "The Gold Market", at: { col: 32, row: 34 }, palette: [1, 2], dress: "gilded", clearing: 7 },
    { name: "The Bee Gardens", at: { col: 36, row: 10 }, palette: [2, 3], dress: "emberwood", clearing: 5 },
    { name: "Gnome Landing", at: { col: 26, row: 63 }, palette: [3, 2], dress: "crags", clearing: 5 },
    { name: "The Gilded Gate", at: { col: 70, row: 8 }, palette: [1, 4], dress: "gilded", clearing: 5 },
    { name: "The Sun Chapel", at: { col: 64, row: 61 }, palette: [5, 1], dress: "gilded", clearing: 5 },
  ];
  const rooms = districts.filter((d) => !d.box).map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 6, row: 36 }], maze(t, rng, rooms));
  return { ...tier, area: "gilded", entry: { col: 6, row: 36 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function steps(): AreaMap {
  const rng = makeRng("area:steps");
  const t = tierBuilder("sky", rng, { cols: 112, rows: 64 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;
  const gold = { color: "yellow" } as const;

  // A chain of drifting isles stepping down westward from the Cloud Bridge to the Harbour's lift,
  // after the Ringed City's broken stairs: rope bridges between, raised spans across the ruined steps.
  t.blob("steps", 100, 16, 9, 6);
  t.blob("steps", 80, 22, 10, 7);
  t.ground("steps", 72, 16, 16, 12);
  t.blob("steps", 58, 18, 8, 6);
  t.ground("steps", 50, 12, 18, 14);
  t.blob("steps", 58, 40, 11, 8);
  t.blob("steps", 36, 32, 10, 8);
  t.blob("steps", 14, 46, 9, 7);
  // Two side isles, dead ends off the way down: the hermit's rock, and a wreck of gold.
  t.blob("steps", 26, 10, 6, 5);
  t.blob("steps", 88, 54, 8, 6);

  // The Broken Stair: the second isle rises in two steps; the Windward Rest stands level with its top.
  t.block(2, 73, 17, 14, 10);
  t.stair(2, 72, 26, "L");
  t.stair(2, 87, 26, "R");
  t.block(3, 76, 17, 8, 5);
  t.stair(3, 75, 21, "L");
  // The Windward Rest steps down too: its top, a ledge round it, then the lowland where the way goes on.
  t.block(2, 51, 13, 16, 10);
  t.block(3, 53, 14, 12, 6);
  t.stair(3, 52, 19, "L");
  t.stair(2, 50, 22, "L");
  // The Old Span: across the gap from the Broken Stair's top to the Windward Rest.
  const decks = t.span(3, 65, 17, 11, 2);
  // The Bell Isle: a raised ruin with a stair either side.
  t.block(2, 31, 27, 11, 7);
  t.stair(2, 30, 33, "L");
  t.stair(2, 42, 33, "R");

  // Every bridge runs from well inside one isle to a stair's foot or deep into the next: a ragged rim never leaves one short.
  t.bridge({ col: 100, row: 16 }, { col: 110, row: 16 }, 3);
  t.bridge({ col: 97, row: 18 }, { col: 88, row: 27 });
  t.bridge({ col: 60, row: 24 }, { col: 58, row: 38 });
  t.bridge({ col: 54, row: 41 }, { col: 43, row: 35 });
  t.bridge({ col: 30, row: 36 }, { col: 15, row: 46 });
  t.bridge({ col: 36, row: 25 }, { col: 26, row: 11 });
  t.bridge({ col: 64, row: 43 }, { col: 88, row: 55 });

  // Trails: down the Broken Stair, along the Span, and down the Bell Isle.
  t.road([88, 26], [80, 25], [77, 22]);
  t.road([76, 18], [64, 18]);
  t.road([31, 32], [41, 32]);

  // Cloud Pier: where the rope bridge from the Gilded Reach lands; the guard's last post.
  t.fires.push({ col: 99, row: 18 });
  prop("tower", 103, 13, gold);
  who("archer", 102, 15, gold);
  who("bee", 96, 13);

  // The Broken Stair: a ruined way-tower on each step, the wind's harpies (bats) about it.
  prop("tower", 75, 25, blue);
  prop("watchtower", 80, 19);
  for (const [c, r] of [[78, 27], [84, 22]] as const) prop("bones", c, r);
  who("bat", 82, 18);
  who("bat", 78, 28);
  who("skull", 84, 25, { to: { col: 76, row: 25 } });

  // The Windward Rest: a fire on the high isle, an old house where the steps' keepers slept.
  t.fires.push({ col: 58, row: 18 });
  prop("house3", 55, 15, gold);
  prop("goldStone", 62, 15);
  who("monk", 60, 17, { ...gold, to: { col: 56, row: 19 } });

  // The Hanging Graves: the fallen of the Steps, laid out on a drifting field.
  for (const [c, r] of [[52, 38], [56, 36], [60, 37], [64, 39], [54, 43], [62, 44]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[58, 41], [50, 42], [66, 42]] as const) prop("bones", c, r);
  for (const [c, r] of [[50, 36], [67, 38]] as const) prop("deadTree", c, r, { scale: 0.7 });
  crowd(t, rng, "skull", { col: 58, row: 40 }, 4, 5);
  who("skullGuard", 58, 44);

  // The Bell Isle: the ruin of the Steps' bell tower, its warden on the raised floor.
  prop("monastery", 36, 30, blue);
  for (const [c, r] of [[33, 29], [40, 29]] as const) prop("tower", c, r, blue);
  who("warrior", 36, 32, { ...blue, to: { col: 38, row: 32 } });
  who("bat", 32, 36);

  // Watch Isle: the Harbour castle's old sky-lift, chained from here.
  t.fires.push({ col: 12, row: 47 });
  prop("tower", 17, 43, blue);
  prop("house2", 9, 44, blue);
  who("archer", 16, 45, blue);
  who("lancer", 11, 49, { ...blue, to: { col: 18, row: 49 } });

  // The Hermit's Rock: an old monk who never went down, and what he kept.
  prop("house1", 26, 9, gold);
  prop("goldStone", 29, 12);
  who("monk", 24, 11, gold);

  // The Gold Wreck: a gnome barge that fell short, its gold spilt, and what came for it.
  for (const [c, r] of [[86, 52], [90, 55], [84, 56], [92, 51]] as const) prop("goldStone", c, r);
  prop("woodPile", 88, 53);
  prop("trollDead", 90, 58);
  crowd(t, rng, "imp", { col: 88, row: 55 }, 3, 3);

  const exits: AreaExit[] = [
    { to: "gilded", name: "Cloud Bridge", kind: "open", at: { col: 110, row: 16 } },
    { to: "harbour", name: "Watch Lift", kind: "shortcut", at: { col: 14, row: 46 } },
  ];
  const districts: District[] = [
    { name: "The Broken Stair", at: { col: 80, row: 31 }, palette: [2, 4, 1], dress: "crags", box: { x: 72, y: 16, w: 16, h: 12 } },
    { name: "Windward Rest", at: { col: 58, row: 10 }, palette: [2, 1, 1], dress: "gilded", box: { x: 50, y: 12, w: 18, h: 14 } },
    { name: "Cloud Pier", at: { col: 100, row: 21 }, palette: [1, 2], dress: "gilded", clearing: 4 },
    { name: "The Hanging Graves", at: { col: 58, row: 47 }, palette: [4, 5], dress: "barrowmoor", clearing: 5 },
    { name: "The Bell Isle", at: { col: 36, row: 38 }, palette: [3, 4], dress: "harbour", clearing: 5 },
    { name: "Watch Isle", at: { col: 14, row: 52 }, palette: [3, 2], dress: "harbour", clearing: 5 },
    { name: "The Hermit's Rock", at: { col: 26, row: 14 }, palette: [2, 1], dress: "gilded", clearing: 4 },
    { name: "The Gold Wreck", at: { col: 88, row: 59 }, palette: [1, 4], dress: "saltreach", clearing: 4 },
  ];
  const rooms = districts.filter((d) => !d.box).map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 104, row: 16 }], maze(t, rng, rooms));
  return { ...tier, area: "steps", entry: { col: 104, row: 16 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function undercroft(): AreaMap {
  const rng = makeRng("area:undercroft");
  const t = tierBuilder("below", rng, { cols: 124, rows: 72 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;

  // The Harbour's cisterns and catacombs, after the Depths and Diablo's crypts: halls cut from the rock, black water between.
  for (const [x, y, rx, ry] of [[26, 22, 14, 10], [14, 15, 8, 6], [23, 49, 18, 13], [60, 15, 20, 9], [50, 56, 12, 9], [79, 52, 15, 9], [76, 32, 16, 9], [102, 39, 14, 9]] as const) t.blob("undercroft", x, y, rx, ry);
  t.ground("undercroft", 104, 37, 19, 7);
  // Tunnels between the caverns, each from well inside one to well inside the next.
  const tunnels = [[[26, 22], [56, 16]], [[24, 26], [23, 46]], [[34, 53], [40, 58]], [[60, 58], [79, 60]], [[66, 18], [74, 30]], [[66, 36], [66, 50]], [[88, 34], [100, 39]]] as const;
  for (const [a, b] of tunnels) t.bridge({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, 3);

  // The Cisterns: three black channels across the west, walkways over them.
  t.pond(8, 40, 30, 3);
  t.pond(8, 48, 30, 3);
  t.pond(8, 56, 30, 3);
  for (const c of [14, 30]) t.bridge({ col: c, row: 37 }, { col: c, row: 61 });

  // The Spider Pillars: a hall of standing rock, a grid of pillars to lose the eye in.
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) t.pillar(46 + i * 8, 9 + j * 8, 3, 3);

  // The Ossuary: a raised bone terrace, a stair at each end.
  t.block(2, 70, 46, 18, 12);
  t.stair(2, 69, 57, "L");
  t.stair(2, 88, 57, "R");

  // The Drowned Chapel: a chapel on an isle in a sunken pool, a causeway out to it.
  lake(t, 50, 57, 7, 4);
  t.ground("undercroft", 47, 55, 7, 4);
  t.bridge({ col: 50, row: 50 }, { col: 50, row: 56 }, 2);

  // Roads: from the well's foot through the pillars and the halls to the tunnel east; trails onto the ossuary.
  t.road([30, 24], [44, 28], [62, 30], [80, 34], [96, 40], [122, 40]);
  t.road([30, 24], [22, 34], [22, 44]);
  t.road([62, 30], [64, 44], [69, 58]);
  t.road([71, 56], [86, 56]);
  t.bridge({ col: 116, row: 40 }, { col: 122, row: 40 }, 3);

  // The Well Bottom: where the rope comes down, a fire under the shaft of light.
  t.fires.push({ col: 30, row: 26 });
  for (const [c, r] of [[26, 22], [34, 28]] as const) prop("bones", c, r);
  prop("woodPile", 33, 22);
  who("rubberDuck", 28, 28);

  // The Cisterns: what lives in the black water, and the dead on the walkways.
  for (const [c, r] of [[10, 41], [26, 49], [18, 57]] as const) who("bombFish", c, r, { to: { col: c + 6, row: r } });
  who("turtle", 34, 41);
  crowd(t, rng, "skull", { col: 22, row: 46 }, 3, 5);
  for (const [c, r] of [[12, 45], [28, 53], [20, 61]] as const) prop("bones", c, r);

  // Smugglers' Nook: the thieves' cache in the north-west, their gold and stores.
  for (const [c, r] of [[12, 12], [16, 15], [10, 17]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[14, 10], [18, 18]] as const) prop("meat", c, r);
  prop("woodPile", 9, 14);
  crowd(t, rng, "thief", { col: 14, row: 14 }, 3, 3);

  // The Spider Pillars: webs of the rock's spiders, and what they caught.
  crowd(t, rng, "spider", { col: 58, row: 16 }, 5, 9);
  for (const [c, r] of [[50, 14], [62, 22], [70, 13], [54, 22]] as const) prop("bones", c, r);
  who("bat", 66, 18);
  who("bat", 52, 12);

  // The Ossuary: the Harbour's dead stacked on the terrace, their warden among them.
  for (const [c, r] of [[72, 48], [76, 47], [80, 48], [84, 47], [74, 53], [82, 53]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[78, 50], [86, 50], [72, 51]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 78, row: 51 }, 3, 4);
  who("skullGuard", 79, 54, { scale: 1.4 });

  // The Drowned Chapel: a purple chapel praying to the grey, under the Harbour's own streets.
  prop("monastery", 50, 56, purple);
  who("monk", 48, 57, purple);
  who("shaman", 52, 57);

  // The Dig: the tunnel east that nobody admits to, its diggers, their tools and spoil.
  prop("cave", 100, 34);
  for (const [c, r] of [[96, 38], [102, 42]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[98, 42], [104, 38]] as const) prop("tools", c, r);
  for (const [c, r] of [[94, 32], [106, 44]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnoll", { col: 99, row: 40 }, 4, 4);
  who("lizard", 92, 44);

  const exits: AreaExit[] = [{ to: "deeps", name: "Cistern Run", kind: "open", at: { col: 122, row: 40 } }];
  const districts: District[] = [
    { name: "The Ossuary", at: { col: 79, row: 60 }, palette: [4, 5], dress: "barrowmoor", box: { x: 70, y: 46, w: 18, h: 12 } },
    { name: "The Well Bottom", at: { col: 30, row: 22 }, palette: [3, 4], dress: "undercroft", clearing: 5 },
    { name: "The Cisterns", at: { col: 22, row: 52 }, palette: [5, 4], dress: "undercroft", clearing: 8 },
    { name: "Smugglers' Nook", at: { col: 14, row: 14 }, palette: [4, 1], dress: "undercroft", clearing: 5 },
    { name: "The Spider Pillars", at: { col: 58, row: 15 }, palette: [4, 5], dress: "undercroft", clearing: 12 },
    { name: "The Drowned Chapel", at: { col: 50, row: 62 }, palette: [5, 3], dress: "undercroft", clearing: 6 },
    { name: "The Dig", at: { col: 100, row: 46 }, palette: [4, 1], dress: "undercroft", clearing: 6 },
  ];
  const rooms = districts.filter((d) => !d.box).map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = stone(t.finish({}, [{ col: 30, row: 24 }], maze(t, rng, rooms)));
  return { ...tier, area: "undercroft", entry: { col: 30, row: 24 }, exits, districts, districtAt: districtGrid(tier, districts), decks: [] };
}

const BUILT: Partial<Record<AreaId, () => AreaMap>> = { harbour, emberwood, crags, greyfall, gilded, steps, undercroft };

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
