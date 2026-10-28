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
  /** The heights it takes, so its colour follows the cliffs; any height when unset. */
  levels?: readonly number[];
  /** In an area map, how thick its high ground is with trees, 0 to 1; the area's own when unset. */
  trees?: number;
  /** How thick its ground is with bushes and rocks, against the area's own; 1 when unset. */
  decor?: number;
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
  /** The district each tile belongs to, one base-36 character a tile (past ten a digit would take two), "-" for water. */
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

/** A passage through rock along a bending line of points; three wide, as the top row under rock is a cliff face. */
function tunnel(t: Builder, points: readonly (readonly [number, number])[], width = 3): void {
  for (let i = 1; i < points.length; i++) t.bridge({ col: points[i - 1]![0], row: points[i - 1]![1] }, { col: points[i]![0], row: points[i]![1] }, width);
}

/** Fallen rock in a chamber: single pillars scattered round its rim, its middle left open. */
function rubble(t: Builder, rng: Rng, cx: number, cy: number, rx: number, ry: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 0.55 + rng.next() * 0.35;
    t.pillar(Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d), 1, 1);
  }
}

/** A hedgerow: a line of trees between two points, never across a road. */
function hedge(t: Builder, a: readonly [number, number], b: readonly [number, number]): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  for (let i = 0; i <= n; i++) {
    const c = Math.round(a[0] + ((b[0] - a[0]) * i) / n);
    const r = Math.round(a[1] + ((b[1] - a[1]) * i) / n);
    if (!t.roadSet.has(`${c},${r}`) && !t.paths.has(`${c},${r}`)) t.grove(c, r, 0.6, 0.6, 1);
  }
}

/** An avenue: trees in step along both sides of a road, `off` tiles out from it. */
function avenue(t: Builder, points: readonly (readonly [number, number])[], off = 2, step = 3): void {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    for (let d = 0; d <= len; d += step) {
      for (const side of [-1, 1]) {
        const c = Math.round(a[0] + ((b[0] - a[0]) * d) / len + nx * off * side);
        const r = Math.round(a[1] + ((b[1] - a[1]) * d) / len + ny * off * side);
        if (!t.roadSet.has(`${c},${r}`) && !t.paths.has(`${c},${r}`)) t.grove(c, r, 0.6, 0.6, 1);
      }
    }
  }
}

/**
 * A map afloat: `n` tiles of its sea or sky on every side, so the land never fills the frame,
 * and each exit at an edge carried out along a causeway to the new edge.
 */
function pad(m: AreaMap, n: number): AreaMap {
  const [cols, rows] = [m.island.rows[0]!.length, m.island.rows.length];
  const [W, H] = [cols + 2 * n, rows + 2 * n];
  const at = <T extends { col: number; row: number }>(c: T): T => ({ ...c, col: c.col + n, row: c.row + n });
  const grid = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => m.island.rows[r - n]?.[c - n] ?? "~"));
  const area = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => m.areaAt[r - n]?.[c - n] ?? "-"));
  const district = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => m.districtAt[r - n]?.[c - n] ?? "-"));
  const roads = m.roads.map(at);
  const exits = m.exits.map((e) => {
    const [c, r] = [e.at.col + n, e.at.row + n];
    const side = e.at.col <= 1 ? [-1, 0] : e.at.col >= cols - 2 ? [1, 0] : e.at.row <= 1 ? [0, -1] : e.at.row >= rows - 2 ? [0, 1] : null;
    if (!side) return { ...e, at: { col: c, row: r } };
    const [dc, dr] = side as [number, number];
    // At the exit's own height: a raised high road stays raised to the edge.
    const ground = grid[r]![c]!;
    let [x, y] = [c, r];
    while (x + dc >= 1 && x + dc < W - 1 && y + dr >= 1 && y + dr < H - 1) {
      [x, y] = [x + dc, y + dr];
      for (let k = -1; k <= 1; k++) {
        const [px, py] = dc ? [x, y + k] : [x + k, y];
        grid[py]![px] = ground;
        area[py]![px] = area[r]![c]!;
        district[py]![px] = district[r]![c]!;
      }
      roads.push({ col: x, row: y });
    }
    return { ...e, at: { col: x, row: y } };
  });
  return {
    ...m,
    island: { ...m.island, rows: grid.map((l) => l.join("")) },
    areaAt: area.map((l) => l.join("")),
    districtAt: district.map((l) => l.join("")),
    gates: m.gates.map((g) => ({ ...g, at: at(g.at), cells: g.cells.map(at) })),
    roads,
    props: m.props.map(at),
    dwellers: m.dwellers.map((d) => ({ ...at(d), ...(d.to && { to: at(d.to) }) })),
    fires: m.fires.map(at),
    bosses: m.bosses.map(at),
    fences: m.fences.map(at),
    entry: at(m.entry),
    exits,
    districts: m.districts.map((d) => ({ ...d, at: at(d.at), ...(d.box && { box: { ...d.box, x: d.box.x + n, y: d.box.y + n } }) })),
    decks: m.decks.map(at),
  };
}

/** A river: water `width` wide along a line of points. */
function river(t: Builder, points: readonly (readonly [number, number])[], width: number): void {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    t.cut({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, width, (c) => t.pond(c.col, c.row, 1, 1));
  }
}

/** The district a tile of an area map belongs to, if any. */
export function districtOf(m: AreaMap, c: number, r: number): District | undefined {
  const ch = m.districtAt[r]?.[c];
  return ch && ch !== "-" ? m.districts[parseInt(ch, 36)] : undefined;
}

/** Land to its district: a box first, else the nearest seed, the border wandered by noise. */
function districtGrid(tier: AtlasTier, districts: readonly District[], t?: Builder): string[] {
  // A landform that names its district gives it every tile it covers: the highest such landform over a tile wins.
  const owned = new Map<string, number>();
  const ownedAt = new Map<string, number>();
  for (const sh of t?.shapes ?? []) {
    const i = districts.findIndex((d) => d.name === sh.owner);
    if (i < 0) continue;
    for (const k of sh.keys) if ((ownedAt.get(k) ?? 0) <= sh.level) (owned.set(k, i), ownedAt.set(k, sh.level));
  }
  // Broad, gentle borders: a district reads as one piece of ground, not a patchwork.
  const wander = noise(`districts:${tier.id}`, 16);
  const rows = tier.island.rows;
  const [W, H] = [rows[0]!.length, rows.length];
  // Isles: land joined without its bridges. Ground goes only to a district whose seed is on its own isle.
  const isle = rows.map((l) => [...l].map(() => -1));
  const bridged = (c: number, r: number) => t?.paths.has(`${c},${r}`) ?? false;
  let isles = 0;
  for (let r0 = 0; r0 < rows.length; r0++) {
    for (let c0 = 0; c0 < rows[0]!.length; c0++) {
      if (rows[r0]![c0] === "~" || isle[r0]![c0]! >= 0 || bridged(c0, r0)) continue;
      const q: [number, number][] = [[c0, r0]];
      isle[r0]![c0] = isles;
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const [nx, ny] = [x + dx, y + dy];
          if (rows[ny]?.[nx] === undefined || rows[ny]![nx] === "~" || isle[ny]![nx]! >= 0 || bridged(nx, ny)) continue;
          isle[ny]![nx] = isles;
          q.push([nx, ny]);
        }
      }
      isles++;
    }
  }
  const lvOf = (g: string) => ("5()".includes(g) ? 5 : "4{}".includes(g) ? 4 : "^[]".includes(g) ? 3 : "#<>".includes(g) ? 2 : 1);
  const grid = tier.areaAt.map((line, r) =>
    [...line].map((ch, c) => {
      if (ch === "-") return -1;
      const boxed = districts.findIndex((d) => d.box && c >= d.box.x && c < d.box.x + d.box.w && r >= d.box.y && r < d.box.y + d.box.h);
      if (boxed >= 0) return boxed;
      const mine = owned.get(`${c},${r}`);
      if (mine !== undefined && lvOf(rows[r]![c]!) >= 2) return mine;
      // The nearest district that takes this tile's height: colour changes where the ground steps.
      const lv = lvOf(rows[r]![c]!);
      let best = 0;
      let near = Infinity;
      const here = isle[r]![c]!;
      const takes = (d: District) => !d.box && (!d.levels || d.levels.includes(lv));
      const local = here >= 0 && districts.some((d) => takes(d) && isle[d.at.row]?.[d.at.col] === here);
      districts.forEach((d, i) => {
        if (!takes(d) || (local && isle[d.at.row]?.[d.at.col] !== here)) return;
        const dist = Math.hypot(c - d.at.col, r - d.at.row) + wander(c + i * 31, r) * 12;
        if (dist < near) [best, near] = [i, dist];
      });
      return best;
    }),
  );
  /** Connected pieces of the grid, 4 ways, where `same` holds between neighbours. */
  const pieces = (same: (a: [number, number], b: [number, number]) => boolean): [number, number][][] => {
    const seen = grid.map((l) => l.map(() => false));
    const out: [number, number][][] = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (seen[r]![c] || grid[r]![c]! < 0) continue;
        const piece: [number, number][] = [[c, r]];
        seen[r]![c] = true;
        for (let i = 0; i < piece.length; i++) {
          const [x, y] = piece[i]!;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const [nx, ny] = [x + dx, y + dy];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny]![nx] || grid[ny]![nx]! < 0 || !same([x, y], [nx, ny])) continue;
            seen[ny]![nx] = true;
            piece.push([nx, ny]);
          }
        }
        out.push(piece);
      }
    }
    return out;
  };
  const most = (ids: number[]): number => {
    const n = new Map<number, number>();
    for (const i of ids) n.set(i, (n.get(i) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]![0];
  };
  // No pockets: a district's patch smaller than a building's plot goes to the district round it.
  // A bridge takes the colour of the land at its ends, each half its own isle's, spreading in from both.
  const front: [number, number][] = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (grid[r]![c]! >= 0 && !bridged(c, r)) front.push([c, r]);
  const done = new Set(front.map(([c, r]) => r * W + c));
  for (let i = 0; i < front.length; i++) {
    const [x, y] = front[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || done.has(ny * W + nx) || grid[ny]![nx]! < 0 || !bridged(nx, ny)) continue;
      done.add(ny * W + nx);
      grid[ny]![nx] = grid[y]![x]!;
      front.push([nx, ny]);
    }
  }
  const all = pieces(([x, y], [nx, ny]) => grid[y]![x] === grid[ny]![nx]);
  const biggest = new Map<number, number>();
  for (const p of all) {
    const own = grid[p[0]![1]]![p[0]![0]]!;
    biggest.set(own, Math.max(biggest.get(own) ?? 0, p.length));
  }
  for (const piece of all) {
    // A district's own main piece is never a pocket, however small: the Keep is small.
    if (piece.length >= 60 || piece.length === biggest.get(grid[piece[0]![1]]![piece[0]![0]]!)) continue;
    const own = grid[piece[0]![1]]![piece[0]![0]]!;
    const round = piece.flatMap(([x, y]) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => grid[y + dy!]?.[x + dx!] ?? -1).filter((i) => i >= 0 && i !== own),
    );
    if (round.length > 0) for (const [c, r] of piece) grid[r]![c] = most(round);
  }
  return grid.map((l) => l.map((i) => (i < 0 ? "-" : i.toString(36))).join(""));
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
  const blue = { color: "blue" } as const;

  // Land to the frame's edge, as the atlas packs its areas: only the bay, a creek and the coves are water.
  for (const [x, y, rx, ry] of [[56, 40, 54, 38], [14, 14, 14, 12], [98, 14, 14, 12], [14, 66, 14, 12], [98, 66, 14, 12], [56, 6, 30, 6]] as const) t.blob("harbour", x, y, rx, ry);
  lake(t, 54, 64, 14, 7);
  t.pond(50, 70, 8, 8);
  lake(t, 4, 40, 4, 6);
  lake(t, 110, 30, 3, 5);

  // Districts as landforms, each its own shape at its own height, nested as the town climbs to its castle.
  // Old Town on the hillside, the Upper Town on it, the Citadel on that, the Keep on the crown.
  t.shape(2, 56, 33, 30, 9, 0.45, "Old Town");
  t.shape(3, 56, 24, 21, 8, 0.45, "The Upper Town");
  t.shape(4, 58, 15, 13, 7, 0.45, "The Citadel");
  t.shape(5, 58, 10, 6, 3.5, 0.3, "The Keep");
  // The Northwood: a wooded upland of its own west of the castle, a crag on its crown.
  t.shape(2, 18, 20, 14, 11, 0.45, "The Northwood");
  t.shape(3, 15, 14, 6, 4, 0.45, "The Northwood");
  // The Mine Hills east: a broad hill, its working face, the crest.
  t.shape(2, 94, 24, 14, 11, 0.45, "Mine Hills");
  t.shape(3, 93, 18, 9, 6, 0.45, "Mine Hills");
  t.shape(4, 92, 14, 4, 3, 0.3, "Mine Hills");
  // The Moor Watch's bluff over the south-east coves, and the knoll in West Fields.
  t.shape(2, 96, 58, 9, 7, 0.45, "Moor Watch");
  t.shape(3, 97, 55, 4, 3, 0.45, "Moor Watch");
  t.shape(2, 16, 58, 6, 4, 0.45, "West Fields");

  // Roads: the lower town's streets from the square to the docks and both gates; the creek crossed by the Old Bridge.
  t.road([56, 46], [56, 56]);
  t.road([56, 46], [30, 46], [10, 42], [1, 42]);
  t.road([56, 46], [84, 46], [110, 44]);
  t.road([30, 46], [34, 40], [34, 30], [28, 4], [26, 1]);
  t.bridge({ col: 8, row: 42 }, { col: 1, row: 42 }, 3);
  t.bridge({ col: 28, row: 7 }, { col: 26, row: 1 }, 3);
  t.bridge({ col: 100, row: 44 }, { col: 110, row: 44 }, 3);
  t.bridge({ col: 50, row: 58 }, { col: 50, row: 62 });
  t.bridge({ col: 62, row: 58 }, { col: 62, row: 62 });

  // The Keep: the castle on the crown, the lift to the sky beside it.
  prop("castle", 58, 10, blue);
  t.fires.push({ col: 55, row: 12 });
  who("lancer", 55, 11, { ...blue, to: { col: 61, row: 11 } });

  // The Citadel: towers, barracks, archery and chapel round the keep's foot, guns over its cliffs.
  for (const [c, r] of [[48, 14], [68, 14]] as const) prop("tower", c, r, blue);
  prop("barracks", 51, 18, blue);
  prop("archery", 65, 18, blue);
  for (const c of [50, 58, 66]) prop("cannon", c, 21);
  crowd(t, rng, "warrior", { col: 58, row: 18 }, 3, 3, blue);
  for (const [c, r] of [[48, 16], [68, 16]] as const) who("archer", c, r, blue);

  // The Upper Town: the chapel and the old families' tall houses on the third height.
  prop("monastery", 44, 24, blue);
  for (const [c, r, art] of [[38, 26, "house2"], [50, 27, "house1"], [64, 27, "house2"], [70, 25, "house3"], [76, 27, "house2"]] as const) prop(art, c, r, blue);
  t.fires.push({ col: 57, row: 28 });
  crowd(t, rng, "pawn", { col: 58, row: 27 }, 3, 6, { ...blue, act: "gold" });
  who("monk", 46, 28, blue);

  // Old Town: cottages along the hillside, the archery butts, a fire where the stairs come down.
  for (const [c, r, art] of [[30, 35, "house1"], [36, 37, "house3"], [44, 37, "house2"], [70, 37, "house1"], [78, 36, "house3"], [84, 34, "house2"], [26, 32, "house3"]] as const) prop(art, c, r, blue);
  prop("archery", 58, 37, blue);
  t.fires.push({ col: 50, row: 38 });
  crowd(t, rng, "pawn", { col: 64, row: 37 }, 3, 6, blue);
  who("warrior", 34, 38, { ...blue, to: { col: 80, row: 38 } });

  // The lower town: the square, its fire and the Old Well, the market, houses down to the water.
  t.fires.push({ col: 56, row: 43 });
  for (const [c, r, art] of [[42, 49, "house1"], [48, 52, "house2"], [64, 52, "house3"], [70, 49, "house1"], [38, 53, "house2"], [76, 53, "house3"], [82, 49, "house1"], [32, 49, "house2"]] as const) prop(art, c, r, blue);
  crowd(t, rng, "pawn", { col: 56, row: 47 }, 6, 9, { ...blue, act: "gold" });
  crowd(t, rng, "pawn", { col: 56, row: 50 }, 3, 7, { color: "yellow", act: "meat" });
  who("pawn", 52, 44, { ...blue, act: "hammer" });
  who("warrior", 46, 47, { ...blue, to: { col: 66, row: 47 } });

  // The Docks: fish huts on the bay's shore, piers, boats on the water.
  for (const [c, r] of [[42, 58], [70, 58], [56, 57]] as const) prop("fishHut", c, r);
  for (const [c, r] of [[46, 65], [62, 66], [56, 69]] as const) prop("boat", c, r, { flip: c > 56 });
  crowd(t, rng, "pawn", { col: 56, row: 56 }, 4, 7, { ...blue, act: "knife" });
  who("turtle", 44, 60);
  who("rubberDuck", 52, 66);

  // The Northwood: woodcutters' cabins in the trees, a lookout on the crag.
  prop("house1", 22, 24, blue);
  prop("house1", 10, 22, blue);
  prop("tower", 15, 13, blue);
  crowd(t, rng, "pawn", { col: 20, row: 22 }, 3, 3, { ...blue, act: "axe" });
  who("bear", 8, 18, { to: { col: 14, row: 26 } });
  t.grove(18, 22, 13, 9, 0.5);

  // The Mine Hills: the mine in the working face, ore in the rock, a cave under the crest.
  prop("goldMine", 90, 22);
  for (const [c, r] of [[86, 16], [98, 18], [100, 26], [88, 28]] as const) prop("goldStone", c, r);
  prop("cave", 100, 20);
  crowd(t, rng, "pawn", { col: 92, row: 25 }, 4, 4, { ...blue, act: "pickaxe", walk: false });

  // West Fields: pens of sheep and pigs, farmhouses, hedgerows between the fields.
  t.fences.push({ col: 8, row: 48, w: 6, h: 4 }, { col: 22, row: 52, w: 5, h: 4 }, { col: 8, row: 64, w: 5, h: 3 }, { col: 24, row: 64, w: 5, h: 3 });
  for (const [c, r] of [[10, 49], [11, 50], [12, 49], [23, 53], [24, 54]] as const) who("sheep", c, r);
  for (const [c, r] of [[9, 65], [10, 65], [26, 65]] as const) who("pig", c, r);
  for (const [c, r] of [[18, 50], [16, 68], [30, 60]] as const) prop("house3", c, r, blue);
  crowd(t, rng, "pawn", { col: 18, row: 56 }, 4, 6, { ...blue, act: "axe" });
  for (const [a, b] of [[[4, 46], [24, 46]], [[4, 62], [34, 62]], [[28, 50], [28, 70]], [[6, 72], [26, 72]]] as const) hedge(t, a, b);

  // The Moor Watch and Lighthouse Point: the old graves on the bluff, the light on the far headland.
  prop("tower", 104, 44, blue);
  who("archer", 104, 46, blue);
  for (const [c, r] of [[94, 55], [99, 53], [101, 57], [95, 60]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[90, 62], [104, 62], [100, 64]] as const) prop("deadTree", c, r, { scale: 0.7 });
  who("skull", 96, 57, { to: { col: 100, row: 58 } });
  prop("tower", 86, 74, blue);
  t.fires.push({ col: 92, row: 74 });
  who("archer", 88, 74, { ...blue, to: { col: 100, row: 72 } });

  // Copses in the lowland's corners.
  for (const [x, y, rx, ry, d] of [[78, 66, 6, 4, 0.55], [100, 70, 6, 4, 0.5], [32, 72, 5, 3, 0.55], [104, 36, 3, 4, 0.6], [8, 30, 4, 4, 0.6], [74, 42, 3, 2, 0.5]] as const) t.grove(x, y, rx, ry, d);

  const exits: AreaExit[] = [
    { to: "saltreach", name: "Old Bridge", kind: "open", at: { col: 1, row: 42 } },
    { to: "barrowmoor", name: "Moor Gate", kind: "shortcut", at: { col: 110, row: 44 } },
    { to: "emberwood", name: "Ember Gate", kind: "gate", at: { col: 26, row: 1 } },
    { to: "undercroft", name: "Old Well", kind: "drop", at: { col: 56, row: 45 } },
    { to: "steps", name: "Watch Lift", kind: "shortcut", at: { col: 62, row: 11 } },
  ];
  // One colour a district; a district's heights share it, so the landforms' own cliffs carry the steps.
  const districts: District[] = [
    { name: "The Keep", at: { col: 58, row: 4 }, levels: [5], palette: [4], dress: "harbour", decor: 1.5 },
    { name: "The Citadel", at: { col: 58, row: 20 }, levels: [4], palette: [4], dress: "harbour", decor: 1.5 },
    { name: "The Upper Town", at: { col: 70, row: 30 }, levels: [3], palette: [2], dress: "harbour", decor: 2 },
    { name: "Old Town", at: { col: 40, row: 40 }, levels: [2], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Lower Town", at: { col: 56, row: 52 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Docks", at: { col: 56, row: 75 }, levels: [1], palette: [5], dress: "saltreach", decor: 2 },
    { name: "West Fields", at: { col: 16, row: 62 }, levels: [1, 2], palette: [1], dress: "harbour", decor: 2.5 },
    { name: "The Northwood", at: { col: 18, row: 30 }, levels: [1, 2, 3], palette: [2], dress: "emberwood", decor: 1.5, trees: 0.4 },
    { name: "Mine Hills", at: { col: 96, row: 34 }, levels: [1, 2, 3, 4], palette: [4], dress: "crags", decor: 2.5, trees: 0.06 },
    { name: "Lighthouse Point", at: { col: 92, row: 77 }, levels: [1], palette: [3], dress: "saltreach", decor: 2 },
    { name: "Moor Watch", at: { col: 98, row: 66 }, levels: [1, 2, 3], palette: [5], dress: "barrowmoor", decor: 1.5 },
  ];
  const tier = t.finish({}, [{ col: 56, row: 46 }]);
  return { ...tier, area: "harbour", entry: { col: 56, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
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

const MOUNTAIN = [2, 3, 4, 4, 1] as const;

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

  // The Tinker Rock: not steps but a mountain, five landforms of their own shapes grown into each other,
  // each outline wandered by noise: the summit massif, a broad west shoulder, a long thin east ridge,
  // a squat crag to the north-west and a low spur running south. Stairs find their own way up.
  t.relief({ area: "crags", at: { col: 72, row: 28 }, rx: 22, ry: 18, levels: 5, core: { at: { col: 74, row: 15 }, r: 3.5 } });
  t.relief({ area: "crags", at: { col: 52, row: 38 }, rx: 11, ry: 9, levels: 3, core: { at: { col: 51, row: 36 }, r: 2.2 } });
  t.relief({ area: "crags", at: { col: 93, row: 28 }, rx: 6, ry: 15, levels: 4, core: { at: { col: 93, row: 21 }, r: 1.8 } });
  t.relief({ area: "crags", at: { col: 57, row: 17 }, rx: 7, ry: 6, levels: 4, core: { at: { col: 57, row: 15 }, r: 1.6 } });
  t.relief({ area: "crags", at: { col: 78, row: 46 }, rx: 12, ry: 6, levels: 2 });
  // The Sky Bridge: the gnomes' high road off the summit, east over the ridge to the map's edge.
  const decks = t.span(5, 78, 15, 33, 2);

  // The foothills south-east, a knoll in the grove.
  t.relief({ area: "crags", at: { col: 80, row: 64 }, rx: 9, ry: 4, levels: 2 });
  t.relief({ area: "crags", at: { col: 12, row: 30 }, rx: 6, ry: 5, levels: 2 });

  // Roads: in from the Crag Stair to the foot of the climb, Tinker Town, the grove and round to the far stair.
  t.road([2, 46], [20, 46], [36, 56], [45, 57]);
  t.road([36, 56], [36, 63], [70, 63], [98, 57]);
  t.road([20, 46], [20, 26]);
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

  // The Lower Works on the south spur's slope: the gnomes' gold mine and their ore.
  prop("goldMine", 70, 50);
  for (const [c, r] of [[64, 48], [84, 50], [76, 44]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnome", { col: 72, row: 52 }, 3, 3, { walk: false });

  // The West Shoulder: Old Bamboo waits on its crown, his pandas on its slopes.
  t.bosses.push({ name: "Old Bamboo", area: "crags", col: 51, row: 36 });
  who("pandaGuard", 51, 36);
  who("panda", 48, 40, { flip: true });
  who("panda", 56, 42);
  for (const c of [47, 55]) prop("cannon", c, 38);

  // The North Crag: the tinkers' workshop yard on a knob of its own.
  t.fences.push({ col: 54, row: 13, w: 6, h: 4 });
  for (const [c, r] of [[55, 14], [58, 16]] as const) prop("woodPile", c, r);
  prop("tools", 57, 14);
  who("gnome", 56, 15, { to: { col: 58, row: 15 } });

  // The East Ridge: a watch the length of the ridge, guns over the shore, slingers on the wind.
  prop("watchtower", 93, 20);
  for (const r of [26, 32]) prop("cannonSide", 95, r);
  who("slingshot", 92, 24, { to: { col: 92, row: 34 } });

  // Tinker Peak: the gnomes' towers, the fire at the top, the lift into the clouds.
  t.fires.push({ col: 74, row: 17 });
  for (const [c, r] of [[71, 14], [77, 17]] as const) prop("gnomeTower", c, r);
  crowd(t, rng, "gnome", { col: 74, row: 16 }, 3, 2);
  prop("goldStone", 76, 13);

  // The slopes between: huts wherever a ledge takes one, guns on the shoulders of the massif.
  for (const [c, r] of [[64, 26], [82, 30], [70, 36], [62, 34], [80, 22], [86, 38]] as const) prop("gnomeHut", c, r);
  for (const [c, r] of [[66, 20], [82, 18], [72, 40], [60, 28]] as const) prop("cannon", c, r);
  for (const [c, r] of [[66, 30], [78, 34], [88, 26]] as const) prop("goldStone", c, r);
  crowd(t, rng, "gnome", { col: 72, row: 30 }, 4, 6);
  who("slingshot", 64, 32, { to: { col: 76, row: 38 } });

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

  const exits: AreaExit[] = [
    { to: "emberwood", name: "Crag Stair", kind: "open", at: { col: 1, row: 46 } },
    { to: "gilded", name: "Gnome Lift", kind: "lift", at: { col: 73, row: 15 } },
    { to: "greyfall", name: "Sky Bridge", kind: "high", at: { col: 110, row: 15 } },
  ];
  const districts: District[] = [
    // One colour a district: the bare rock of the climb, a gold summit, green town and grove, the shore's teal.
    // No boxes: the mountain's districts are as ragged as its rock.
    // The mountain's three share one ramp by height: grass at the foot, green slopes, bare rock, a gold summit.
    { name: "Tinker Peak", at: { col: 74, row: 11 }, palette: MOUNTAIN, dress: "crags", decor: 2 },
    { name: "The Climb", at: { col: 68, row: 34 }, palette: MOUNTAIN, dress: "crags", decor: 3 },
    { name: "The East Ridge", at: { col: 93, row: 30 }, palette: MOUNTAIN, dress: "crags", decor: 3 },
    { name: "Crag Gate", at: { col: 8, row: 48 }, palette: [2], dress: "crags", decor: 2 },
    { name: "Bamboo Grove", at: { col: 20, row: 22 }, palette: [3], dress: "emberwood", decor: 2, clearing: 7 },
    { name: "Tinker Town", at: { col: 48, row: 63 }, palette: [2], dress: "harbour", decor: 2, clearing: 9 },
    { name: "Foothills", at: { col: 82, row: 63 }, palette: [4], dress: "crags", decor: 2.5 },
    { name: "The Terraces", at: { col: 58, row: 79 }, palette: [1], dress: "harbour", decor: 1.5 },
    { name: "Windward Shore", at: { col: 104, row: 47 }, palette: [5], dress: "saltreach", decor: 2 },
  ];
  // The mountain stream: off the rock's west face, down past the bamboo to the sea, a footbridge where the north road crosses.
  river(t, [[45, 34], [38, 36], [30, 34], [22, 37], [12, 36], [2, 38]], 2);
  t.bridge({ col: 20, row: 33 }, { col: 20, row: 41 });
  // A tarn under the outcrops, and the gnomes' terraced plots on the southern spur, fenced, with their stock.
  lake(t, 14, 60, 3, 2);
  t.fences.push({ col: 48, row: 70, w: 6, h: 3 }, { col: 56, row: 70, w: 6, h: 3 }, { col: 52, row: 75, w: 6, h: 3 });
  for (const [c, r] of [[50, 71], [52, 72], [58, 71]] as const) who("sheep", c, r);
  for (const [c, r] of [[54, 76], [56, 76]] as const) who("pig", c, r);
  crowd(t, rng, "gnome", { col: 58, row: 74 }, 3, 3);
  // A mountain's foot, not a maze: rocky knolls with passes between, a bamboo thicket, scrub on the spur.
  for (const [c, r] of [[30, 40], [36, 24], [14, 34], [40, 48], [24, 56], [86, 70], [70, 76]] as const) {
    t.relief({ area: "crags", at: { col: c, row: r }, rx: 3.5, ry: 2.5, levels: 2, core: { at: { col: c, row: r }, r: 1.2 } });
  }
  t.grove(20, 26, 9, 7, 0.7);
  t.grove(60, 80, 8, 3, 0.3);
  // Rock outcrops standing up from the foot, a step higher than the knolls, and scrub copses in their lee.
  for (const [c, r] of [[30, 30], [10, 54], [104, 24], [106, 44]] as const) {
    t.relief({ area: "crags", at: { col: c, row: r }, rx: 4.5, ry: 3.5, levels: 3, core: { at: { col: c, row: r }, r: 1.4 } });
  }
  for (const [x, y, rx, ry] of [[36, 36, 4, 3], [16, 46, 3, 3], [44, 56, 4, 2], [108, 32, 3, 4], [100, 54, 4, 3], [28, 62, 4, 2], [80, 74, 3, 2]] as const) t.grove(x, y, rx, ry, 0.75);
  const tier = t.finish({}, [{ col: 6, row: 46 }]);
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
  // A castle, not a maze: open courts and streets, only clumps of dead wood in the bailey and before the gate.
  for (const [x, y, rx, ry, d] of [[40, 30, 5, 7, 0.35], [10, 52, 6, 6, 0.3], [44, 18, 4, 3, 0.3], [92, 56, 7, 4, 0.3], [26, 46, 3, 4, 0.4]] as const) t.grove(x, y, rx, ry, d);
  const tier = t.finish({}, [{ col: 6, row: 44 }]);
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
  // A city, not a maze: open plazas, trees in avenues along its ways, and the Bee Gardens hanging thick.
  avenue(t, [[10, 36], [20, 36], [32, 35], [46, 34]]);
  avenue(t, [[52, 45], [78, 45]], 1, 3);
  t.grove(36, 9, 10, 5, 0.6);
  const tier = t.finish({}, [{ col: 6, row: 36 }]);
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
  // Isles, not a maze: bare and wind-scoured, a lone tree here and there.
  const tier = t.finish({ steps: 0.04 }, [{ col: 104, row: 16 }]);
  return { ...tier, area: "steps", entry: { col: 104, row: 16 }, exits, districts, districtAt: districtGrid(tier, districts), decks };
}

function undercroft(): AreaMap {
  const rng = makeRng("area:undercroft");
  const t = tierBuilder("below", rng, { cols: 104, rows: 80 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;

  // The Harbour's catacombs, after Diablo's cathedral crypts: chambers cut from the rock under the well,
  // joined by narrow passages, the dark between them solid.
  const chambers: [number, number, number, number][] = [[52, 14, 7, 5], [20, 36, 12, 8], [10, 12, 5, 4], [84, 22, 10, 7], [50, 46, 9, 6], [74, 58, 13, 8], [90, 72, 8, 5]];
  for (const [x, y, rx, ry] of chambers) t.blob("undercroft", x, y, rx, ry);
  // Passages: west to the Cisterns and on to the Nook, east to the Pillars, south down to the Chapel,
  // the Pillars on down to the Ossuary, the Ossuary to the Dig, and a long way round from the Cisterns to the Chapel.
  tunnel(t, [[48, 15], [36, 18], [30, 26], [24, 32]]);
  tunnel(t, [[14, 32], [12, 24], [10, 14]]);
  tunnel(t, [[56, 14], [66, 12], [76, 18], [82, 22]]);
  tunnel(t, [[52, 18], [54, 28], [50, 36], [50, 44]]);
  tunnel(t, [[86, 26], [90, 38], [82, 48], [76, 56]]);
  tunnel(t, [[82, 62], [88, 68], [90, 72]]);
  tunnel(t, [[24, 42], [30, 52], [42, 50], [48, 48]]);
  tunnel(t, [[96, 72], [102, 72]], 3);

  // The Cisterns: three black channels with walkways across them.
  for (const r of [31, 36, 41]) t.pond(10, r, 22, 2);
  for (const c of [14, 26]) t.bridge({ col: c, row: 29 }, { col: c, row: 43 });
  // The Spider Pillars: a hall of standing rock.
  for (const [x, y] of [[78, 18], [84, 18], [90, 18], [78, 25], [84, 25], [90, 25]] as const) t.pillar(x, y, 2, 2);
  // The Drowned Chapel: its isle in a sunken pool, a causeway out.
  lake(t, 50, 48, 6, 3);
  t.ground("undercroft", 48, 47, 5, 3);
  t.bridge({ col: 50, row: 42 }, { col: 50, row: 47 });
  // The Ossuary: a raised bone terrace, a stair at each front corner.
  t.block(2, 66, 54, 16, 6);
  t.stair(2, 65, 59, "L");
  t.stair(2, 82, 59, "R");
  // Fallen rock in the larger chambers.
  rubble(t, rng, 20, 36, 12, 8, 5);
  rubble(t, rng, 74, 58, 13, 8, 6);
  rubble(t, rng, 90, 72, 8, 5, 3);

  // The Well Bottom: where the rope comes down, a fire under the shaft of light.
  t.fires.push({ col: 52, row: 16 });
  for (const [c, r] of [[48, 12], [56, 13]] as const) prop("bones", c, r);
  prop("woodPile", 55, 17);
  who("rubberDuck", 49, 16);

  // The Cisterns: what lives in the black water, and the dead on the walkways.
  for (const [c, r] of [[12, 31], [20, 36], [16, 41]] as const) who("bombFish", c, r, { to: { col: c + 6, row: r } });
  who("turtle", 28, 31);
  crowd(t, rng, "skull", { col: 20, row: 38 }, 3, 4);
  for (const [c, r] of [[12, 34], [28, 39]] as const) prop("bones", c, r);
  t.fires.push({ col: 20, row: 44 });

  // Smugglers' Nook: a dead end off the Cisterns, the thieves' cache.
  for (const [c, r] of [[8, 11], [12, 12]] as const) prop("goldStone", c, r);
  prop("meat", 10, 14);
  crowd(t, rng, "thief", { col: 10, row: 12 }, 2, 2);

  // The Spider Pillars: webs in the rock, what they caught, bats in the roof.
  crowd(t, rng, "spider", { col: 84, row: 22 }, 5, 6);
  for (const [c, r] of [[81, 21], [87, 23], [80, 27]] as const) prop("bones", c, r);
  who("bat", 88, 20);

  // The Drowned Chapel: a purple chapel under the Harbour's own streets.
  prop("monastery", 50, 48, purple);
  who("monk", 46, 44, { ...purple, to: { col: 54, row: 44 } });
  who("shaman", 55, 51);
  prop("goldStone", 44, 48);

  // The Ossuary: the Harbour's dead stacked on the terrace, their warden among them.
  for (const [c, r] of [[68, 55], [72, 55], [76, 55], [80, 55]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[70, 57], [78, 57]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 74, row: 62 }, 3, 4);
  who("skullGuard", 74, 57, { scale: 1.4 });
  t.fires.push({ col: 64, row: 62 });

  // The Dig: the tunnel east that nobody admits to, its diggers and their spoil.
  prop("cave", 88, 70);
  prop("woodPile", 94, 72);
  prop("tools", 86, 74);
  prop("goldStone", 92, 75);
  crowd(t, rng, "gnoll", { col: 90, row: 73 }, 3, 3);

  const exits: AreaExit[] = [{ to: "deeps", name: "Cistern Run", kind: "open", at: { col: 102, row: 72 } }];
  const districts: District[] = [
    { name: "The Well Bottom", at: { col: 52, row: 7 }, palette: [5, 4], dress: "undercroft" },
    { name: "The Cisterns", at: { col: 20, row: 47 }, palette: [5, 3], dress: "undercroft" },
    { name: "Smugglers' Nook", at: { col: 10, row: 5 }, palette: [4, 1], dress: "undercroft" },
    { name: "The Spider Pillars", at: { col: 84, row: 13 }, palette: [4, 5], dress: "undercroft" },
    { name: "The Drowned Chapel", at: { col: 50, row: 55 }, palette: [5, 3], dress: "undercroft" },
    { name: "The Ossuary", at: { col: 74, row: 68 }, palette: [4, 5], dress: "deeps" },
    { name: "The Dig", at: { col: 92, row: 79 }, palette: [4, 1], dress: "undercroft" },
  ];
  const tier = stone(t.finish({}, [{ col: 52, row: 14 }]));
  return { ...tier, area: "undercroft", entry: { col: 52, row: 14 }, exits, districts, districtAt: districtGrid(tier, districts), decks: [] };
}

function deeps(): AreaMap {
  const rng = makeRng("area:deeps");
  const t = tierBuilder("below", rng, { cols: 80, rows: 96 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;

  // The tombs under the moor, after the Catacombs and the Tomb of Giants: a descent that zig-zags down
  // the dark, each chamber below the last, the Weaver's at the bottom and the Sinking Stair under it.
  const chambers: [number, number, number, number][] = [[12, 22, 6, 4], [44, 16, 18, 10], [66, 40, 8, 10], [24, 46, 11, 7], [8, 64, 6, 5], [62, 62, 8, 6], [38, 78, 14, 9]];
  for (const [x, y, rx, ry] of chambers) t.blob("deeps", x, y, rx, ry);
  tunnel(t, [[8, 22], [1, 22]]);
  tunnel(t, [[16, 22], [24, 22], [34, 23]]);
  tunnel(t, [[52, 23], [60, 28], [66, 36]]);
  tunnel(t, [[38, 23], [32, 32], [26, 42]]);
  tunnel(t, [[18, 52], [10, 58], [8, 62]]);
  tunnel(t, [[66, 50], [64, 56], [62, 60]]);
  tunnel(t, [[26, 52], [30, 64], [34, 72]]);
  tunnel(t, [[58, 66], [50, 72], [46, 76]]);
  tunnel(t, [[38, 86], [38, 94]]);

  // The Great Barrow: a tomb in two steps, the lift on its crown, a stair at each front corner of each.
  t.block(2, 32, 10, 24, 12);
  t.stair(2, 31, 21, "L");
  t.stair(2, 56, 21, "R");
  t.block(3, 37, 10, 14, 6);
  t.stair(3, 36, 15, "L");
  t.stair(3, 51, 15, "R");
  // The Drowned Graves' black pool; the Weaver's vault pillared with webbed rock; fallen rock elsewhere.
  lake(t, 30, 46, 4, 2);
  for (const [x, y] of [[30, 74], [45, 74], [28, 82], [47, 82]] as const) t.pillar(x, y, 2, 2);
  rubble(t, rng, 66, 40, 8, 10, 4);
  rubble(t, rng, 62, 62, 8, 6, 4);
  rubble(t, rng, 24, 46, 11, 7, 3);

  // Cistern Mouth: where the Undercroft's tunnel comes up, a fire at the end of it.
  t.fires.push({ col: 12, row: 23 });
  prop("bones", 14, 20);

  // The Great Barrow: the old kings laid in rows, their guard still standing.
  t.fires.push({ col: 42, row: 12 });
  for (const [c, r] of [[38, 11], [49, 11], [38, 14], [49, 14]] as const) prop("skullSpike", c, r);
  prop("monastery", 46, 12, purple);
  for (const [c, r] of [[34, 19], [40, 19], [48, 19], [54, 19]] as const) prop("skullSpike", c, r);
  prop("bones", 44, 17);
  crowd(t, rng, "skull", { col: 44, row: 24 }, 3, 5);
  who("skullGuard", 34, 16);
  who("skullGuard", 53, 16, { flip: true });

  // The Ossuary Galleries: the common dead, stacked; their keepers.
  for (const [c, r] of [[63, 34], [69, 34], [63, 44], [69, 44]] as const) prop("skullSpike", c, r);
  prop("bones", 66, 38);
  crowd(t, rng, "skull", { col: 66, row: 41 }, 3, 3);
  who("skullGuard", 66, 46);

  // The Drowned Graves: the shrine on the shore, snakes at the water's edge.
  prop("tower", 20, 44, purple);
  who("shaman", 22, 48);
  who("snake", 28, 50);
  t.fires.push({ col: 18, row: 49 });

  // Robbers' Camp: a dead end, grave-robbers round their fire with their haul.
  t.fires.push({ col: 8, row: 65 });
  for (const [c, r] of [[5, 63], [11, 66]] as const) prop("goldStone", c, r);
  prop("meat", 10, 62);
  crowd(t, rng, "thief", { col: 8, row: 64 }, 2, 2);

  // The Collapsed Hall: the roof come down, and what nests in the rubble.
  prop("cave", 62, 61);
  crowd(t, rng, "gnoll", { col: 62, row: 65 }, 3, 3);
  prop("goldStone", 67, 64);

  // The Weaver's Web: the deepest vault, bones of what it caught, its brood, the Weaver at the heart.
  for (const [c, r] of [[34, 76], [42, 76], [32, 80], [44, 81], [38, 84]] as const) prop("bones", c, r);
  crowd(t, rng, "spider", { col: 38, row: 78 }, 5, 6);
  t.bosses.push({ name: "The Weaver", area: "deeps", col: 38, row: 78 });
  who("spider", 38, 78, { scale: 2.2 });
  for (const [c, r] of [[30, 79], [46, 79]] as const) prop("goldStone", c, r);

  const exits: AreaExit[] = [
    { to: "undercroft", name: "Cistern Run", kind: "open", at: { col: 1, row: 22 } },
    { to: "barrowmoor", name: "Barrow Cave", kind: "lift", at: { col: 44, row: 11 } },
    { to: "hollow", name: "Sinking Stair", kind: "open", at: { col: 38, row: 94 } },
  ];
  const districts: District[] = [
    { name: "Cistern Mouth", at: { col: 12, row: 29 }, palette: [3, 4], dress: "undercroft" },
    { name: "The Great Barrow", at: { col: 44, row: 30 }, palette: [1, 4, 5], dress: "deeps" },
    { name: "Ossuary Galleries", at: { col: 66, row: 53 }, palette: [1, 4], dress: "deeps" },
    { name: "The Drowned Graves", at: { col: 24, row: 56 }, palette: [3, 4], dress: "deeps" },
    { name: "Robbers' Camp", at: { col: 8, row: 72 }, palette: [1, 4], dress: "undercroft" },
    { name: "The Collapsed Hall", at: { col: 62, row: 71 }, palette: [4, 1], dress: "deeps" },
    { name: "The Weaver's Web", at: { col: 38, row: 90 }, palette: [4, 3], dress: "deeps" },
  ];
  const tier = stone(t.finish({}, [{ col: 12, row: 22 }]));
  return { ...tier, area: "deeps", entry: { col: 12, row: 22 }, exits, districts, districtAt: districtGrid(tier, districts), decks: [] };
}

function hollow(): AreaMap {
  const rng = makeRng("area:hollow");
  const t = tierBuilder("below", rng, { cols: 112, rows: 76 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;

  // The bottom of the world, after Ash Lake: a great still lake in the dark, shores on three sides
  // and bare rock on the fourth, the Shell Isle in the middle reached by two causeways.
  lake(t, 54, 38, 32, 16);
  const shores: [number, number, number, number][] = [[50, 8, 8, 4], [54, 18, 22, 5], [22, 36, 8, 12], [84, 16, 9, 6], [92, 42, 9, 7], [28, 62, 7, 5]];
  for (const [x, y, rx, ry] of shores) t.blob("hollow", x, y, rx, ry);
  // The Shell Isle and the Gold Shoals that carry the causeways.
  for (const [x, y, rx, ry] of [[54, 40, 9, 6], [40, 40, 3, 2], [74, 42, 3, 2]] as const) t.blob("hollow", x, y, rx, ry);
  // Stone pillars standing in the water: the drowned trees.
  for (const [x, y] of [[32, 30], [72, 30], [36, 50], [68, 52], [80, 34]] as const) t.pillar(x, y, 1, 2);

  tunnel(t, [[50, 8], [50, 1]]);
  tunnel(t, [[50, 10], [52, 18]]);
  tunnel(t, [[40, 18], [28, 24], [22, 32]]);
  tunnel(t, [[68, 18], [84, 16]]);
  tunnel(t, [[86, 20], [92, 30], [92, 40]]);
  tunnel(t, [[22, 44], [24, 54], [28, 62]]);
  t.bridge({ col: 24, row: 40 }, { col: 50, row: 42 });
  t.bridge({ col: 90, row: 42 }, { col: 58, row: 42 });

  // The Shell Isle rises in one step, a stair at each front corner; the Shell Below sleeps on top.
  t.block(2, 48, 36, 13, 6);
  t.stair(2, 47, 41, "L");
  t.stair(2, 61, 41, "R");

  // The Stair Foot: where the Sinking Stair comes down from the tombs; the last fire before the water.
  t.fires.push({ col: 52, row: 9 });
  prop("skullSpike", 47, 7);
  prop("skullSpike", 54, 7);

  // The North Shore: the long beach under the stair, the lake's turtles hauled out on it.
  for (const [c, r] of [[40, 18], [62, 19]] as const) who("turtle", c, r);
  prop("goldStone", 46, 16);
  prop("goldStone", 66, 17);

  // The Stone Grove: trees turned to stone, and what roots among them.
  for (const [c, r] of [[80, 13], [86, 12], [90, 16], [82, 19]] as const) prop("deadTree", c, r, { scale: 0.7 });
  who("lizard", 84, 16, { to: { col: 88, row: 18 } });
  prop("goldStone", 88, 19);

  // The West Shallows: gold glowing in the rock, snakes at the edge.
  for (const [c, r] of [[18, 30], [20, 42], [16, 36]] as const) prop("goldStone", c, r);
  who("snake", 24, 34);
  t.fires.push({ col: 22, row: 38 });

  // Pilgrims' Rest: those come down to pray to what sleeps here, their shrine on the east shore.
  prop("monastery", 95, 40, purple);
  t.fires.push({ col: 90, row: 46 });
  crowd(t, rng, "monk", { col: 92, row: 44 }, 2, 3, purple);
  who("shaman", 97, 45);
  prop("goldStone", 98, 47);

  // Sinkhole Landing: a dead end where the Fen's water falls in, and whatever fell with it.
  t.fires.push({ col: 28, row: 63 });
  for (const [c, r] of [[25, 61], [31, 64]] as const) prop("bones", c, r);
  who("rubberDuck", 30, 60);
  crowd(t, rng, "skull", { col: 28, row: 62 }, 2, 2);

  // The lake: what swims in the still water.
  for (const [c, r] of [[36, 32], [70, 50], [62, 28]] as const) who("bombFish", c, r, { to: { col: c + 5, row: r } });
  who("paddleShark", 30, 46, { to: { col: 40, row: 48 } });
  who("harpoonShark", 76, 36, { to: { col: 68, row: 34 } });

  // The Shell Isle: gold round the sleeper, its young in the shallows, the Shell Below on the height.
  for (const [c, r] of [[48, 44], [60, 44]] as const) prop("goldStone", c, r);
  who("turtle", 54, 45);
  t.bosses.push({ name: "The Shell Below", area: "hollow", col: 54, row: 38 });
  who("turtleGuard", 54, 38, { scale: 2.4 });
  for (const [c, r] of [[40, 40], [74, 42]] as const) prop("goldStone", c, r);

  const exits: AreaExit[] = [{ to: "deeps", name: "Sinking Stair", kind: "open", at: { col: 50, row: 2 } }];
  const districts: District[] = [
    { name: "The Stair Foot", at: { col: 60, row: 8 }, palette: [4, 5], dress: "deeps" },
    { name: "The North Shore", at: { col: 54, row: 25 }, palette: [5, 3], dress: "hollow" },
    { name: "The Stone Grove", at: { col: 86, row: 24 }, palette: [5, 4], dress: "hollow" },
    { name: "The West Shallows", at: { col: 22, row: 50 }, palette: [3, 5], dress: "hollow" },
    { name: "Pilgrims' Rest", at: { col: 92, row: 52 }, palette: [3, 1], dress: "hollow" },
    { name: "Sinkhole Landing", at: { col: 42, row: 62 }, palette: [4, 5], dress: "undercroft" },
    { name: "The Shell Isle", at: { col: 54, row: 49 }, palette: [5, 1], dress: "hollow", box: { x: 44, y: 34, w: 21, h: 13 } },
  ];
  const tier = stone(t.finish({}, [{ col: 50, row: 8 }]));
  return { ...tier, area: "hollow", entry: { col: 50, row: 8 }, exits, districts, districtAt: districtGrid(tier, districts), decks: [] };
}

function barrowmoor(): AreaMap {
  const rng = makeRng("area:barrowmoor");
  const t = tierBuilder("surface", rng, { cols: 120, rows: 76 });
  const { prop, who } = t;
  const black = { color: "black" } as const;

  // The old kings' moor, after Limgrave's heath and the graveyards of Lordran: a broad moor,
  // three tongues of it running out to its gates, barrows rising out of the dead wood.
  for (const [x, y, rx, ry] of [[58, 36, 40, 24], [14, 40, 12, 8], [102, 30, 14, 8], [60, 64, 10, 9], [85, 19, 17, 11]] as const) t.blob("barrowmoor", x, y, rx, ry);
  for (const [a, b] of [[[14, 40], [30, 40]], [[102, 30], [86, 30]], [[60, 64], [60, 50]]] as const) t.bridge({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, 3);
  // The Dead Mere, still water in the moor's south-east.
  lake(t, 72, 45, 7, 4);

  // The barrows: grass mounds over the old dead, and the King's Barrow, greatest of them, in three steps.
  for (const [c, r, rx, ry] of [[32, 24, 5, 3.5], [46, 18, 4.5, 3], [58, 24, 5, 3.5], [38, 50, 5, 3.5], [24, 32, 4, 3]] as const) {
    t.relief({ area: "barrowmoor", at: { col: c, row: r }, rx, ry, levels: 2, core: { at: { col: c, row: r }, r: 1.6 } });
  }
  // The King's Barrow is built, not grown: two exact steps, a stair at each front corner of each.
  t.block(2, 74, 15, 22, 12);
  t.stair(2, 73, 26, "L");
  t.stair(2, 96, 26, "R");
  t.block(3, 78, 15, 13, 7);
  t.stair(3, 77, 21, "L");
  t.stair(3, 91, 21, "R");

  // Roads: the old way from the Moor Gate across the heath to the Grey Gate, and the path down to the Fen.
  t.road([1, 40], [20, 40], [40, 38], [62, 38], [74, 34], [96, 30], [118, 30]);
  t.road([62, 38], [60, 52], [60, 74]);
  t.bridge({ col: 6, row: 40 }, { col: 1, row: 40 }, 3);
  t.bridge({ col: 112, row: 30 }, { col: 118, row: 30 }, 3);
  t.bridge({ col: 60, row: 70 }, { col: 60, row: 74 }, 3);

  // The Moor Gate: the Harbour's barred gate, a watch fire on the moor side.
  t.fires.push({ col: 12, row: 42 });
  prop("tower", 9, 36, { color: "blue" });
  who("lancer", 14, 38, { color: "blue", to: { col: 20, row: 38 } });
  t.fences.push({ col: 4, row: 35, w: 3, h: 3 });

  // The Heath: open moor, dead trees, the dead walking it at dusk.
  for (const [c, r] of [[30, 40], [44, 44], [50, 30], [36, 30]] as const) prop("deadTree", c, r, { scale: 0.7 });
  crowd(t, rng, "skull", { col: 42, row: 36 }, 4, 7);
  who("bat", 34, 36);
  who("bat", 50, 40);

  // Barrow Field: the lesser mounds, a ring of stones on each, the dead raised round them.
  for (const [c, r] of [[32, 24], [46, 18], [58, 24]] as const) {
    for (const [dc, dr] of [[-3, -1], [3, -1], [-3, 2], [3, 2]] as const) prop("skullSpike", c + dc, r + dr);
  }
  for (const [c, r] of [[36, 20], [52, 22], [42, 26]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 46, row: 22 }, 3, 5);
  who("skullGuard", 46, 18);

  // Gibbet Hill: the moor's hanging mound in the south-west, and the gnolls that pick at it.
  for (const [c, r] of [[36, 49], [40, 49]] as const) prop("deadTree", c, r, { scale: 0.8 });
  for (const [c, r] of [[34, 52], [42, 52], [38, 53]] as const) prop("skullSpike", c, r);
  crowd(t, rng, "gnoll", { col: 40, row: 56 }, 3, 4);

  // The Dead Mere: mist on the water, things in the reeds, a drowned watchtower.
  for (const [c, r] of [[64, 48], [80, 44]] as const) who("lizard", c, r, { to: { col: c + 3, row: r } });
  who("snake", 76, 50);
  who("bombFish", 72, 45, { to: { col: 75, row: 45 } });
  prop("watchtower", 64, 44);

  // The King's Barrow: the great mound, its guard of dead kings, the Barrow King on its crown;
  // at its foot the Barrow Cave, the way down into the tombs.
  for (const [c, r] of [[79, 16], [89, 16], [75, 24], [94, 24]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[81, 19], [87, 19], [84, 24]] as const) prop("bones", c, r);
  t.bosses.push({ name: "The Barrow King", area: "barrowmoor", col: 84, row: 20 });
  who("minotaurGuard", 84, 20, { scale: 1.6 });
  for (const [c, r] of [[80, 29], [88, 29]] as const) who("skullGuard", c, r);
  prop("cave", 84, 36);
  t.fires.push({ col: 78, row: 37 });

  // The Grey Road: the way east to the Grey Gate, skulls staked along it, the warlord's outpost.
  for (const c of [96, 100, 104, 108]) for (const r of [27, 33]) prop("skullSpike", c, r);
  prop("tower", 106, 24, black);
  crowd(t, rng, "warrior", { col: 104, row: 30 }, 2, 2, black);
  who("lancer", 98, 30, { ...black, to: { col: 110, row: 30 } });

  // The Fen Path: duckboards down to the reeds, a fire at the top of them.
  t.fires.push({ col: 62, row: 62 });
  for (const [c, r] of [[56, 66], [64, 68]] as const) prop("deadTree", c, r, { scale: 0.6 });
  who("lizard", 58, 68, { to: { col: 62, row: 70 } });

  const exits: AreaExit[] = [
    { to: "harbour", name: "Moor Gate", kind: "shortcut", at: { col: 1, row: 40 } },
    { to: "greyfall", name: "Grey Gate", kind: "locked", at: { col: 118, row: 30 } },
    { to: "fen", name: "Barrow Path", kind: "open", at: { col: 60, row: 74 } },
    { to: "deeps", name: "Barrow Cave", kind: "lift", at: { col: 84, row: 37 } },
  ];
  const districts: District[] = [
    { name: "The Moor Gate", at: { col: 12, row: 47 }, palette: [3, 4], dress: "harbour", clearing: 5 },
    { name: "The Heath", at: { col: 42, row: 38 }, palette: [4, 5], dress: "barrowmoor", clearing: 7 },
    { name: "Barrow Field", at: { col: 46, row: 13 }, palette: [4, 3], dress: "barrowmoor", clearing: 6 },
    { name: "Gibbet Hill", at: { col: 38, row: 58 }, palette: [4, 5], dress: "greyfall", clearing: 5 },
    { name: "The Dead Mere", at: { col: 72, row: 52 }, palette: [5, 4], dress: "fen", clearing: 5 },
    { name: "The King's Barrow", at: { col: 84, row: 12 }, palette: [4, 5, 1], dress: "barrowmoor", clearing: 7 },
    { name: "The Grey Road", at: { col: 104, row: 37 }, palette: [4, 5], dress: "greyfall", clearing: 5 },
    { name: "The Fen Path", at: { col: 60, row: 66 }, palette: [5, 3], dress: "fen", clearing: 4 },
  ];
  // A heath, not a maze: open moor dotted with lesser barrows and thickets of dead wood.
  for (const [c, r] of [[70, 28], [30, 46], [50, 56], [56, 44], [44, 28], [20, 34]] as const) {
    t.relief({ area: "barrowmoor", at: { col: c, row: r }, rx: 3, ry: 2, levels: 2, core: { at: { col: c, row: r }, r: 1 } });
  }
  for (const [x, y, rx, ry] of [[40, 32, 4, 3], [54, 50, 3, 2], [26, 54, 4, 3], [64, 20, 3, 2], [18, 46, 3, 3], [96, 40, 4, 3], [36, 42, 3, 2]] as const) t.grove(x, y, rx, ry, 0.8);
  const tier = t.finish({}, [{ col: 12, row: 40 }]);
  return { ...tier, area: "barrowmoor", entry: { col: 12, row: 40 }, exits, districts, districtAt: districtGrid(tier, districts), decks: [] };
}

function fen(): AreaMap {
  const rng = makeRng("area:fen");
  const t = tierBuilder("surface", rng, { cols: 120, rows: 80 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;
  const yellow = { color: "yellow" } as const;

  // A marsh packed to the frame's edge, after Blighttown's swamp and the Valley of Defilement: black pools
  // in the reed, the Chapel Mound in the middle over the sinkhole, the Barrow Rise climbing north-east to the moor.
  for (const [x, y, rx, ry] of [[60, 40, 58, 38], [14, 14, 14, 12], [106, 14, 14, 12], [14, 66, 14, 12], [106, 66, 14, 12]] as const) t.blob("fen", x, y, rx, ry);
  for (const [x, y, rx, ry] of [[32, 20, 9, 5], [52, 66, 10, 5], [88, 36, 7, 6], [86, 62, 9, 5], [18, 48, 6, 4], [40, 40, 5, 3], [102, 46, 5, 4], [70, 14, 6, 3]] as const) lake(t, x, y, rx, ry);
  // The sinkhole the chapel prays over: a pool off the mound's foot that drinks the fen.
  lake(t, 72, 46, 3, 2);

  // Landforms, each its own district's ground.
  t.shape(2, 60, 32, 13, 8, 0.45, "The Chapel Mound");
  t.shape(3, 60, 28, 6, 4, 0.35, "The Chapel Mound");
  t.shape(2, 22, 64, 10, 6, 0.45, "Lizard Warren");
  t.shape(2, 104, 22, 13, 10, 0.45, "The Barrow Rise");
  t.shape(3, 106, 16, 7, 5, 0.4, "The Barrow Rise");

  // Duckboards: the way in from the shore, across the fen past the chapel's foot, up to the moor.
  t.road([1, 40], [24, 40], [46, 46], [64, 44], [82, 46], [84, 26], [84, 2]);
  t.bridge({ col: 6, row: 40 }, { col: 1, row: 40 }, 3);
  t.bridge({ col: 84, row: 8 }, { col: 84, row: 1 }, 3);
  for (const [a, b] of [[[40, 34], [40, 46]], [[28, 26], [36, 14]], [[52, 58], [52, 74]], [[82, 36], [94, 36]], [[72, 62], [100, 62]], [[18, 44], [18, 52]], [[100, 46], [108, 46]], [[64, 14], [76, 14]]] as const) t.bridge({ col: a[0], row: a[1] }, { col: b[0], row: b[1] });

  // Causeway Landing: the militia's last post on the fen side of the shingle spit.
  t.fires.push({ col: 10, row: 42 });
  prop("tower", 8, 36, yellow);
  prop("fishHut", 14, 44);
  who("lancer", 12, 38, { ...yellow, to: { col: 20, row: 38 } });
  crowd(t, rng, "pawn", { col: 12, row: 41 }, 2, 3, { ...yellow, act: "knife" });

  // The Reedbeds: the north-west reed, what hides in it.
  for (const [c, r] of [[24, 12], [40, 22], [16, 22]] as const) who("lizard", c, r, { to: { col: c + 4, row: r + 2 } });
  for (const [c, r] of [[30, 8], [12, 28]] as const) who("snake", c, r);
  for (const [c, r] of [[20, 16], [36, 28]] as const) who("bee", c, r, { to: { col: c + 3, row: r - 2 } });
  prop("fishHut", 26, 26);
  for (const [x, y, rx, ry] of [[18, 14, 8, 6], [42, 12, 6, 4], [10, 30, 4, 4]] as const) t.grove(x, y, rx, ry, 0.5);

  // Lizard Warren: the lizard-folk's huts on their mound, their shaman, their kills.
  for (const [c, r] of [[18, 62], [26, 62], [22, 66]] as const) prop("goblinHut", c, r);
  t.fires.push({ col: 22, row: 64 });
  crowd(t, rng, "lizard", { col: 22, row: 66 }, 5, 5);
  who("shaman", 22, 61);
  for (const [c, r] of [[14, 60], [30, 66], [18, 70]] as const) prop("bones", c, r);
  prop("skullSpike", 16, 66);
  prop("skullSpike", 28, 64);

  // The Drowned Village: houses the fen took, roofs above the water, boats tied to nothing.
  for (const [c, r] of [[42, 62], [62, 62], [44, 72], [60, 72]] as const) prop("house1", c, r, purple);
  for (const [c, r] of [[48, 66], [56, 68]] as const) prop("boat", c, r, { flip: c > 52 });
  for (const [c, r] of [[40, 68], [64, 66]] as const) prop("deadTree", c, r, { scale: 0.7 });
  crowd(t, rng, "skull", { col: 52, row: 62 }, 3, 5);
  who("turtle", 50, 70);
  who("bombFish", 54, 66, { to: { col: 58, row: 66 } });

  // The Chapel Mound: the purple chapel on the crown, its priests, the grey they pray to; the sinkhole at its foot.
  prop("monastery", 60, 27, purple);
  for (const [c, r] of [[55, 30], [65, 30], [54, 35], [66, 35]] as const) prop("skullSpike", c, r);
  t.fires.push({ col: 58, row: 36 });
  crowd(t, rng, "monk", { col: 60, row: 34 }, 3, 4, purple);
  who("shaman", 64, 36);
  who("skullGuard", 62, 38);
  for (const [c, r] of [[70, 44], [74, 48]] as const) prop("bones", c, r);

  // The Black Pools: still water, dead wood, what drowned in it and still walks.
  for (const [c, r] of [[80, 32], [96, 40], [92, 30], [78, 40]] as const) prop("deadTree", c, r, { scale: 0.7 });
  crowd(t, rng, "skull", { col: 88, row: 44 }, 3, 4);
  who("bombFish", 88, 36, { to: { col: 92, row: 36 } });
  who("bat", 84, 30);

  // Eel Shallows: the south-east reed, sharks in the deeper pool, a fisher's hut.
  prop("fishHut", 96, 66);
  who("harpoonShark", 86, 62, { to: { col: 80, row: 62 } });
  for (const [c, r] of [[100, 70], [76, 70]] as const) who("turtle", c, r);
  for (const [x, y, rx, ry] of [[100, 72, 6, 4], [74, 72, 5, 3]] as const) t.grove(x, y, rx, ry, 0.5);

  // The Barrow Rise: the duckboards' end, the ground climbing to the moor, its watch and its dead.
  prop("watchtower", 106, 15);
  for (const [c, r] of [[98, 22], [110, 26], [102, 28]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[100, 18], [112, 20]] as const) prop("skullSpike", c, r);
  who("skull", 104, 24, { to: { col: 108, row: 24 } });
  who("lizard", 96, 28, { to: { col: 90, row: 28 } });

  const exits: AreaExit[] = [
    { to: "saltreach", name: "Fen Causeway", kind: "open", at: { col: 1, row: 40 } },
    { to: "barrowmoor", name: "Barrow Path", kind: "open", at: { col: 84, row: 1 } },
    { to: "hollow", name: "Fen Sinkhole", kind: "drop", at: { col: 68, row: 46 } },
  ];
  const districts: District[] = [
    { name: "Causeway Landing", at: { col: 10, row: 48 }, levels: [1], palette: [3], dress: "saltreach", decor: 2 },
    { name: "The Reedbeds", at: { col: 26, row: 8 }, levels: [1], palette: [2], dress: "fen", decor: 2 },
    { name: "Lizard Warren", at: { col: 22, row: 74 }, levels: [1, 2], palette: [4], dress: "fen", decor: 2 },
    { name: "The Drowned Village", at: { col: 52, row: 76 }, levels: [1], palette: [5], dress: "fen", decor: 2 },
    { name: "The Chapel Mound", at: { col: 60, row: 21 }, levels: [2, 3], palette: [1], dress: "fen", decor: 1.5 },
    { name: "The Black Pools", at: { col: 88, row: 48 }, levels: [1], palette: [5], dress: "barrowmoor", decor: 2 },
    { name: "Eel Shallows", at: { col: 100, row: 60 }, levels: [1], palette: [3], dress: "fen", decor: 2 },
    { name: "The Barrow Rise", at: { col: 106, row: 34 }, levels: [1, 2, 3], palette: [4], dress: "barrowmoor", decor: 2 },
  ];
  const tier = t.finish({}, [{ col: 6, row: 40 }]);
  return { ...tier, area: "fen", entry: { col: 6, row: 40 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
}

function saltreach(): AreaMap {
  const rng = makeRng("area:saltreach");
  const t = tierBuilder("surface", rng, { cols: 120, rows: 80 });
  const { prop, who } = t;
  const yellow = { color: "yellow" } as const;

  // Fishing isles packed to the frame's edge, split by narrow sounds, after Tortuga and the Ringed City's docks:
  // the Militia Fort on the north isle, Lighthouse Rock to the west, the villages and the saltworks south.
  for (const [x, y, rx, ry] of [[60, 40, 58, 38], [14, 14, 14, 12], [106, 14, 14, 12], [14, 66, 14, 12], [106, 66, 14, 12]] as const) t.blob("saltreach", x, y, rx, ry);
  river(t, [[40, 1], [38, 20], [42, 40], [38, 60], [40, 79]], 3);
  river(t, [[42, 40], [62, 38], [82, 42], [100, 40], [119, 42]], 3);
  river(t, [[82, 42], [80, 60], [84, 79]], 3);
  // Coves cut into the isles: the pirates' anchorage, the netmakers' harbour, the saltpans' bay.
  for (const [x, y, rx, ry] of [[18, 60, 7, 5], [60, 62, 6, 4], [100, 58, 6, 4], [92, 18, 5, 4], [24, 38, 4, 3]] as const) lake(t, x, y, rx, ry);

  // Landforms, each its own district's ground.
  t.shape(2, 66, 18, 15, 9, 0.45, "The Militia Fort");
  t.shape(3, 66, 14, 7, 4, 0.35, "The Militia Fort");
  t.shape(2, 18, 20, 11, 10, 0.45, "Lighthouse Rock");
  t.shape(3, 17, 15, 6, 5, 0.4, "Lighthouse Rock");
  t.shape(4, 16, 12, 2.5, 2, 0.3, "Lighthouse Rock");
  t.shape(2, 112, 68, 5, 4, 0.4, "The Shingle Spit");

  // Roads and bridges: in at the Old Bridge from the Harbour, across every sound, out along the spit to the Fen.
  t.road([118, 28], [96, 30], [66, 30], [50, 26], [30, 30], [20, 34]);
  t.road([60, 30], [62, 50], [62, 56]);
  t.road([30, 30], [28, 48], [26, 66]);
  t.road([62, 50], [96, 50], [104, 66], [104, 78]);
  t.bridge({ col: 112, row: 28 }, { col: 118, row: 28 }, 3);
  t.bridge({ col: 104, row: 72 }, { col: 104, row: 78 }, 3);
  for (const [a, b] of [[[46, 26], [32, 28]], [[60, 34], [62, 46]], [[30, 44], [26, 52]], [[76, 50], [88, 50]], [[34, 48], [46, 48]]] as const) t.bridge({ col: a[0], row: a[1] }, { col: b[0], row: b[1] });

  // Old Bridge Landing: the way in from the Harbour, the toll post, carts of fish going east.
  t.fires.push({ col: 108, row: 31 });
  prop("tower", 110, 24, yellow);
  for (const [c, r] of [[104, 34], [112, 34]] as const) prop("house1", c, r, yellow);
  crowd(t, rng, "pawn", { col: 106, row: 30 }, 3, 4, { ...yellow, act: "meat" });
  who("lancer", 102, 28, { ...yellow, to: { col: 114, row: 28 } });

  // The Militia Fort: the yellow militia's barracks on the north isle's crown, guns on its cliffs.
  prop("barracks", 64, 13, yellow);
  prop("archery", 74, 18, yellow);
  for (const [c, r] of [[56, 16], [78, 14]] as const) prop("tower", c, r, yellow);
  for (const c of [58, 66, 74]) prop("cannon", c, 25);
  crowd(t, rng, "warrior", { col: 64, row: 19 }, 3, 3, yellow);
  for (const [c, r] of [[56, 18], [78, 16]] as const) who("archer", c, r, yellow);
  t.fires.push({ col: 70, row: 21 });

  // The Gull Cliffs: the north isle's east end, birds, nests and bones over the cove.
  for (const [c, r] of [[96, 10], [102, 14], [88, 8]] as const) prop("bones", c, r);
  for (const [c, r] of [[92, 18], [86, 22]] as const) who("bombFish", c, r, { to: { col: c + 3, row: r } });
  who("bat", 98, 12);

  // Lighthouse Rock: a crag in three steps to the light, its keeper, wreckers' plunder at its foot.
  prop("tower", 16, 11, yellow);
  t.fires.push({ col: 18, row: 15 });
  who("monk", 14, 17, yellow);
  for (const [c, r] of [[10, 28], [26, 26]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[24, 38]] as const) prop("boat", c, r);

  // Pirate Cove: the south-west isle's anchorage, the thieves' tower in the water, their stores.
  prop("pirateTowerWater", 18, 60);
  prop("boat", 14, 62, {});
  for (const [c, r] of [[8, 52], [28, 56]] as const) prop("woodPile", c, r);
  prop("meat", 26, 70);
  crowd(t, rng, "thief", { col: 20, row: 70 }, 4, 5);
  t.fires.push({ col: 26, row: 66 });

  // Turtle Strand: the west isle's south shore, turtles hauled out, the duck.
  for (const [c, r] of [[8, 74], [16, 76], [30, 76]] as const) who("turtle", c, r);
  who("rubberDuck", 4, 70);

  // Netmakers' Village: the south isle's houses round their little harbour, nets drying, boats in.
  for (const [c, r, art] of [[50, 54, "house1"], [56, 52, "house2"], [70, 54, "house3"], [48, 66, "house2"], [74, 66, "house1"], [52, 72, "house3"], [70, 72, "house2"]] as const) prop(art, c, r, yellow);
  for (const [c, r] of [[54, 60], [68, 60]] as const) prop("fishHut", c, r);
  prop("boat", 60, 63, {});
  t.fires.push({ col: 62, row: 56 });
  crowd(t, rng, "pawn", { col: 62, row: 58 }, 5, 6, { ...yellow, act: "knife" });
  who("monk", 58, 70, yellow);

  // The Saltworks: the south-east isle's saltpans, fenced, the salters and their piles.
  t.fences.push({ col: 88, row: 48, w: 6, h: 4 }, { col: 96, row: 48, w: 6, h: 4 }, { col: 88, row: 66, w: 6, h: 3 });
  for (const [c, r] of [[90, 54], [98, 54], [92, 70]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[94, 64], [86, 58]] as const) prop("house3", c, r, yellow);
  crowd(t, rng, "pawn", { col: 94, row: 56 }, 4, 5, { ...yellow, act: "axe" });
  who("harpoonShark", 100, 58, { to: { col: 96, row: 58 } });

  // The Shingle Spit: the long stony tongue the Fen Causeway runs out along, a watch at its tip.
  prop("watchtower", 112, 67);
  who("archer", 102, 72, { ...yellow, to: { col: 108, row: 72 } });
  who("lizard", 112, 74, { to: { col: 108, row: 76 } });

  // Scrub and pines where the isles are left wild.
  for (const [x, y, rx, ry, d] of [[30, 10, 6, 4, 0.5], [6, 36, 3, 6, 0.5], [112, 50, 4, 6, 0.5], [74, 76, 5, 2, 0.5], [46, 10, 4, 3, 0.5], [32, 72, 4, 3, 0.5]] as const) t.grove(x, y, rx, ry, d);

  const exits: AreaExit[] = [
    { to: "harbour", name: "Old Bridge", kind: "open", at: { col: 118, row: 28 } },
    { to: "fen", name: "Fen Causeway", kind: "open", at: { col: 104, row: 78 } },
  ];
  const districts: District[] = [
    // One lowland district an isle, so the channels are the borders; the raised ground is each isle's crown.
    { name: "Old Bridge Landing", at: { col: 104, row: 22 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Militia Fort", at: { col: 66, row: 5 }, levels: [2, 3], palette: [1], dress: "harbour", decor: 1.5 },
    { name: "Lighthouse Rock", at: { col: 18, row: 32 }, levels: [2, 3, 4], palette: [4], dress: "crags", decor: 2 },
    { name: "Pirate Cove", at: { col: 16, row: 50 }, levels: [1], palette: [5], dress: "saltreach", decor: 2 },
    { name: "Netmakers' Village", at: { col: 62, row: 76 }, levels: [1], palette: [2], dress: "harbour", decor: 2 },
    { name: "The Saltworks", at: { col: 96, row: 54 }, levels: [1], palette: [1], dress: "harbour", decor: 1.5 },
    { name: "The Shingle Spit", at: { col: 112, row: 75 }, levels: [2], palette: [4], dress: "saltreach", decor: 2.5 },
  ];
  const tier = t.finish({}, [{ col: 112, row: 28 }]);
  return { ...tier, area: "saltreach", entry: { col: 112, row: 28 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
}

const BUILT: Partial<Record<AreaId, () => AreaMap>> = { harbour, emberwood, crags, greyfall, gilded, steps, undercroft, deeps, hollow, barrowmoor, fen, saltreach };

/** The areas that have a map of their own so far. */
export const MAPPED_AREAS = Object.keys(BUILT) as AreaId[];

/** An area's own map, the same every time. */
const made = new Map<AreaId, AreaMap>();

export function areaMap(id: AreaId): AreaMap {
  const build = BUILT[id];
  if (!build) throw new Error(`${AREAS.find((a) => a.id === id)?.name ?? id} has no map yet`);
  // A map on the sea or in the sky floats in it; underground, the rock round the caverns already does.
  if (!made.has(id)) {
    const m = build();
    made.set(id, m.base === "rock" ? m : pad(m, 3));
  }
  return made.get(id)!;
}
