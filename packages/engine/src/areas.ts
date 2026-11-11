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
  /** A boss's kind: the way stays shut while it lives. */
  guard?: string;
  /** A world flag: shut from this side until it has happened, as a shortcut opened from the far side. */
  shut?: string;
  /** A world flag set by going through it: the far side's way back opens, as a ladder kicked down. */
  opens?: string;
  /** No fog across it: the side a crossing comes out on, or a passage straight to a boss's own fog. */
  plain?: boolean;
  /** A boss's kind: shut until the key that boss drops is carried. */
  key?: string;
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
  /** A planted field: its ground is drawn in crop rows, not strewn with bushes and rocks. */
  crops?: boolean;
  /** Its high ground keeps its own dark shades, where a height otherwise reads a shade lighter than the ground below. */
  gloom?: boolean;
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
  /** Draws its roads as streets in the road colour: a town's, where a way should read as a way. */
  streets?: boolean;
  /** Notes left on the ground, after the Souls games' messages: read with E. */
  notes?: Note[];
  /** A boss room: fog across `gate`, crossed with E from outside to `inside`, shut behind until the `boss` kind falls. */
  arena?: { boss: string; gate: Cell[]; inside: Cell };
  /** Ways shut until a boss's key is carried: `key` is the boss kind that drops it; `flag`, a world flag that opens it too. */
  locks?: { key: string; name: string; cells: Cell[]; flag?: string }[];
}

export interface Note {
  at: Cell;
  text: string;
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
  // No trees grow down here: the rest of the woods is bare floor.
  const rows = tier.island.rows.map((l, r) => [...l].map((ch, c) => (ch === "T" ? (shut(c, r + 1) ? "%" : ".") : ch)).join(""));
  return { ...tier, island: { ...tier.island, rows } };
}

/** A passage through rock along a bending line of points; three wide, as the top row under rock is a cliff face. */
function tunnel(t: Builder, points: readonly (readonly [number, number])[], width = 3): void {
  for (let i = 1; i < points.length; i++) t.bridge({ col: points[i - 1]![0], row: points[i - 1]![1] }, { col: points[i]![0], row: points[i]![1] }, width);
}

/** A tunnel's three rows carried through the map's frame column at `col` (0 or the last), so it runs off the edge
 *  instead of ending at a cap of rock; the builder keeps its own frame shut. */
function openEdge(t: Builder, col: number, row: number): void {
  // The area of the first ground in from the edge: a tunnel's own carved tiles carry none yet.
  const step = col === 0 ? 1 : -1;
  let own = -1;
  for (let c = col + step; own < 0 && c >= 0 && c < t.area[row]!.length; c += step) own = t.area[row]![c]!;
  for (let r = row - 1; r <= row + 1; r++) {
    t.grid[r]![col] = ".";
    t.area[r]![col] = own;
    t.paths.add(`${col},${r}`);
  }
}

/** A tunnel with alcoves cut into its walls every few tiles, side to side, the dead laid in some and a torch in one. */
function passage(t: Builder, rng: Rng, a: AreaId, points: readonly (readonly [number, number])[]): void {
  tunnel(t, points);
  let side = rng.next() < 0.5 ? 1 : -1;
  let lit = false;
  for (let i = 1; i < points.length; i++) {
    const [[x0, y0], [x1, y1]] = [points[i - 1]!, points[i]!];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const [nx, ny] = [-(y1 - y0) / len, (x1 - x0) / len];
    for (let d = 4; d < len - 3; d += 6 + Math.floor(rng.next() * 3)) {
      const [c, r] = [Math.round(x0 + ((x1 - x0) * d) / len + nx * side * 3), Math.round(y0 + ((y1 - y0) * d) / len + ny * side * 3)];
      t.blob(a, c, r, 2, 2);
      if (!lit && len > 12 && d > len / 3) (t.fires.push({ col: c, row: r }), (lit = true));
      else if (rng.next() < 0.6) t.prop(rng.next() < 0.75 ? "bones" : "skullSpike", c, r);
      side = -side;
    }
  }
}

/** Fallen rock in a chamber: single pillars scattered round its rim, its middle left open. */
function rubble(t: Builder, rng: Rng, cx: number, cy: number, rx: number, ry: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 0.55 + rng.next() * 0.35;
    t.pillar(Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d), 1, 1);
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
    let [ex, ey] = [c, r];
    // Painted out to the frame itself, so a raised way never ends a tile short over low ground; the exit stays a tile in.
    while (x + dc >= 0 && x + dc < W && y + dr >= 0 && y + dr < H) {
      [x, y] = [x + dc, y + dr];
      for (let k = -1; k <= 1; k++) {
        const [px, py] = dc ? [x, y + k] : [x + k, y];
        grid[py]![px] = ground;
        area[py]![px] = area[r]![c]!;
        district[py]![px] = district[r]![c]!;
      }
      roads.push({ col: x, row: y });
      if (x >= 1 && x < W - 1 && y >= 1 && y < H - 1) [ex, ey] = [x, y];
    }
    return { ...e, at: { col: ex, row: ey } };
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
    campfires: m.campfires.map(at),
    bosses: m.bosses.map(at),
    fences: m.fences.map(at),
    entry: at(m.entry),
    exits,
    districts: m.districts.map((d) => ({ ...d, at: at(d.at), ...(d.box && { box: { ...d.box, x: d.box.x + n, y: d.box.y + n } }) })),
    decks: m.decks.map(at),
    ...(m.notes && { notes: m.notes.map((x) => ({ ...x, at: at(x.at) })) }),
    ...(m.arena && { arena: { ...m.arena, gate: m.arena.gate.map(at), inside: at(m.arena.inside) } }),
    ...(m.locks && { locks: m.locks.map((l) => ({ ...l, cells: l.cells.map(at) })) }),
  };
}

/** A river: water `width` wide along a line of points. */
function river(t: Builder, points: readonly (readonly [number, number])[], width: number): void {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    t.cut({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, width, (c) => t.pond(c.col, c.row, 1, 1));
  }
}

/** Tileset colours by lightness, darkest first: teal, olive, green, fresh green, gold. */
const LIGHT: Record<number, number> = { 5: 0, 4: 1, 3: 2, 2: 3, 1: 4 };
const SHADES = [5, 4, 3, 2, 1];
const heightOf = (g: string): number => ("5()".includes(g) ? 5 : "4{}".includes(g) ? 4 : "^[]".includes(g) ? 3 : "#<>".includes(g) ? 2 : g === "~" ? 0 : 1);
/** The green at a world height: two heights to a shade, the Harbour's floor green, the castle's heights gold. */
const worldShade = (h: number): number => (h <= 2 ? 3 : h <= 4 ? 2 : 1);

/**
 * The tileset colour of every tile of an area map: its district's colour at its height, except that ground
 * reads lighter as it climbs. Each shelf (a district's ground at one height) resolved lowest first is at least
 * a shade lighter than any lower ground it stands over, gold being the lightest.
 *
 * In the green lands the starting colour is the world height instead (the area's rise and the tile's height),
 * so a crossing meets the green it left: a map's floor is only as dark as where it stands on the hill.
 */
export function groundColours(m: AreaMap): (number | null)[][] {
  const rows = m.island.rows;
  const [W, H] = [rows[0]!.length, rows.length];
  const area = AREAS.find((a) => a.id === m.area)!;
  const rise = area.rise !== undefined && !area.ownGround ? area.rise : null;
  const out: (number | null)[][] = rows.map((l, r) =>
    [...l].map((g, c) => {
      const d = districtOf(m, c, r);
      if (!d) return null;
      if (rise !== null && !d.gloom) return worldShade(rise + heightOf(g));
      return d.palette[Math.min(d.palette.length - 1, Math.max(1, heightOf(g)) - 1)]!;
    }),
  );
  const seen = rows.map((l) => [...l].map(() => false));
  const shelves: { lv: number; tiles: [number, number][] }[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (seen[r]![c] || out[r]![c] === null) continue;
      const lv = heightOf(rows[r]![c]!);
      const id = m.districtAt[r]![c];
      const tiles: [number, number][] = [[c, r]];
      seen[r]![c] = true;
      for (let i = 0; i < tiles.length; i++) {
        const [x, y] = tiles[i]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny]![nx] || out[ny]![nx] === null) continue;
          if (heightOf(rows[ny]![nx]!) !== lv || m.districtAt[ny]![nx] !== id) continue;
          seen[ny]![nx] = true;
          tiles.push([nx, ny]);
        }
      }
      shelves.push({ lv, tiles });
    }
  }
  shelves.sort((a, b) => a.lv - b.lv);
  for (const { lv, tiles } of shelves) {
    if (districtOf(m, tiles[0]![0], tiles[0]![1])?.gloom) continue;
    let best = out[tiles[0]![1]]![tiles[0]![0]]!;
    for (const [x, y] of tiles) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = out[y + dy]?.[x + dx];
        if (n == null || heightOf(rows[y + dy]![x + dx]!) >= lv) continue;
        const up = SHADES[Math.min(4, LIGHT[n]! + 1)]!;
        if (LIGHT[up]! > LIGHT[best]!) best = up;
      }
    }
    for (const [x, y] of tiles) out[y]![x] = best;
  }
  return out;
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
  // A bridge or deck takes the colour of the land at its ends, each half its own end's, spreading in along it from
  // both: over the gap never from the bank beside it, and never from the low ground under a deck.
  const decks = new Set((t?.blocks ?? []).filter((b) => b.span).flatMap((b) => Array.from({ length: b.w * b.h }, (_, i) => `${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`)));
  const crossing = (c: number, r: number) => bridged(c, r) || decks.has(`${c},${r}`);
  const along = (x: number, y: number, nx: number, ny: number) =>
    lvOf(rows[y]![x]!) === lvOf(rows[ny]![nx]!) && (!t?.gaps.has(`${nx},${ny}`) || crossing(x, y));
  const front: [number, number][] = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (grid[r]![c]! >= 0 && !crossing(c, r)) front.push([c, r]);
  const done = new Set(front.map(([c, r]) => r * W + c));
  for (let i = 0; i < front.length; i++) {
    const [x, y] = front[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || done.has(ny * W + nx) || grid[ny]![nx]! < 0 || !crossing(nx, ny) || !along(x, y, nx, ny)) continue;
      done.add(ny * W + nx);
      grid[ny]![nx] = grid[y]![x]!;
      front.push([nx, ny]);
    }
  }
  // Then each cross-section of a bridge one colour, its most common: the seam runs across a bridge, not along it.
  const sections = new Map<string, [number, number][]>();
  for (const [k, sec] of t?.across ?? []) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    if (grid[r]![c]! >= 0) sections.set(sec, [...(sections.get(sec) ?? []), [c, r]]);
  }
  for (const cells of sections.values()) {
    const own = most(cells.map(([c, r]) => grid[r]![c]!));
    for (const [c, r] of cells) grid[r]![c] = own;
  }
  const all = pieces(([x, y], [nx, ny]) => grid[y]![x] === grid[ny]![nx]);
  const biggest = new Map<number, number>();
  for (const p of all) {
    const own = grid[p[0]![1]]![p[0]![0]]!;
    biggest.set(own, Math.max(biggest.get(own) ?? 0, p.length));
  }
  for (const piece of all) {
    // A district's own main piece is never a pocket, however small: the Keep is small.
    // Nor is ground a landform names: a small barrow is still its district's.
    if (piece.length >= 60 || piece.length === biggest.get(grid[piece[0]![1]]![piece[0]![0]]!) || owned.has(`${piece[0]![0]},${piece[0]![1]}`)) continue;
    const own = grid[piece[0]![1]]![piece[0]![0]]!;
    const round = piece.flatMap(([x, y]) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => grid[y + dy!]?.[x + dx!] ?? -1).filter((i) => i >= 0 && i !== own),
    );
    if (round.length > 0) for (const [c, r] of piece) grid[r]![c] = most(round);
  }
  return grid.map((l) => l.map((i) => (i < 0 ? "-" : i.toString(36))).join(""));
}

type Builder = ReturnType<typeof tierBuilder>;

/** A ring of raised ground `width` thick round a hollow, a tile clear of every road laid so far, so each street is a pass. */
function rim(t: Builder, cx: number, cy: number, rx: number, ry: number, width: number, owner: string): void {
  const n = noise(`rim:${cx},${cy}`, 3);
  const keys = new Set<string>();
  for (let r = Math.floor(cy - ry - 1); r <= cy + ry + 1; r++) {
    for (let c = Math.floor(cx - rx - 1); c <= cx + rx + 1; c++) {
      const d = Math.hypot((c - cx) / rx, (r - cy) / ry) + n(c, r) * 0.06;
      if (d <= 1 && d >= 1 - width / ry) keys.add(`${c},${r}`);
    }
  }
  clearRoads(t, keys);
  t.shapes.push({ level: 2, keys, owner });
}

/** A way out three wide from `a` to `b` on the map's edge, at `level`, paved: a gate the eye can follow off the map. */
function edgeWay(t: Builder, a: Cell, b: Cell, level: 1 | 2 | 3 | 4 | 5 = 1): void {
  const own = t.area[a.row]![a.col]!;
  t.cut(a, b, 3, (c) => {
    t.put(c.col, c.row, ".");
    t.area[c.row]![c.col] = own;
  });
  if (level > 1) {
    const [x0, x1, y0, y1] = [Math.min(a.col, b.col), Math.max(a.col, b.col), Math.min(a.row, b.row), Math.max(a.row, b.row)];
    const across = Math.abs(b.col - a.col) >= Math.abs(b.row - a.row);
    t.block(level, across ? x0 : x0 - 1, across ? y0 - 1 : y0, across ? x1 - x0 + 1 : 3, across ? 3 : y1 - y0 + 1);
  }
  t.road([a.col, a.row], [b.col, b.row]);
}

function clearRoads(t: Builder, keys: Set<string>): void {
  for (const k of t.roadSet) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) keys.delete(`${c + dc},${r + dr}`);
  }
}

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
 * The Keep, the castle's crown: the castle between the Harbour and the Burg, its
 * gate off the Burg's west ward shut until the Troll Key is carried. In through
 * the Keep Gate court on the east, the quiet bailey where the Keep's fire burns,
 * the rest after the climb and the troll; up the stair to the castle on its terrace,
 * the wall Ansel watches from, and the Watch Lift up to the sky, shut until ridden
 * down from it.
 */
function keepArea(): AreaMap {
  const rng = makeRng("area:keep");
  const t = tierBuilder("surface", rng, { cols: 64, rows: 44 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  // The castle's own ground, the hill's woods round it: the gate court, the bailey, and the hall's terrace a height up.
  t.ground("keep", 44, 24, 16, 13);
  t.ground("keep", 8, 18, 44, 21);
  // The hall's terrace a ragged hill shoulder: the castle's pad, the lift's head and the stair's landing drawn exact.
  t.blob("keep", 30, 11, 22, 9);
  t.ground("keep", 10, 3, 7, 6);
  t.ground("keep", 44, 12, 8, 6);
  t.shape(2, 29, 10, 15, 5, 0.45, "The Keep");
  t.shape(2, 15, 8, 5, 4, 0.4, "The Keep");
  t.shape(2, 43, 9, 6, 5, 0.4, "The Keep");
  t.shape(2, 22, 14, 5, 2, 0.35, "The Keep");
  t.block(2, 26, 6, 12, 9);
  t.block(2, 11, 4, 5, 4);
  t.block(2, 46, 13, 4, 4);
  t.stair(2, 50, 16, "R");
  edgeWay(t, { col: 59, row: 30 }, { col: 62, row: 30 });
  t.road([59, 30], [40, 30], [30, 26], [50, 18], [50, 17]);

  // The Keep Gate court: a tower each side of the way in.
  for (const [c, r] of [[52, 27], [52, 34]] as const) prop("tower", c, r, blue);
  // The bailey, kept quiet after the Burg: the barracks Corwin keeps, the Keep's fire.
  prop("barracks", 16, 24, blue);
  t.fires.push({ col: 24, row: 28 });
  // The hall: the castle on its terrace, a guard at its door, the Watch Lift at the terrace's west end.
  prop("castle", 30, 10, blue);
  who("lancer", 26, 14, { ...blue, to: { col: 36, row: 14 } });

  const notes: Note[] = [{ at: { col: 44, row: 6 }, text: "Look east. The grey wears a crown in the Citadel." }];
  const exits: AreaExit[] = [
    { to: "burg", name: "Keep Gate", kind: "open", at: { col: 62, row: 30 }, plain: true },
    { to: "steps", name: "Watch Lift", kind: "shortcut", at: { col: 13, row: 6 }, shut: "watchLiftOpen" },
  ];
  const districts: District[] = [
    { name: "The Keep Gate", at: { col: 54, row: 30 }, levels: [1], palette: [3], dress: "greyfall", decor: 1 },
    { name: "The Bailey", at: { col: 26, row: 30 }, levels: [1], palette: [3], dress: "harbour", decor: 1 },
    { name: "The Keep", at: { col: 30, row: 9 }, levels: [2], palette: [2], dress: "harbour", decor: 1 },
  ];
  const tier = t.finish({ keep: 0.02 }, [{ col: 58, row: 30 }]);
  return { ...tier, area: "keep", entry: { col: 58, row: 30 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes };
}

/**
 * The Chapel Ward, the castle's third area, after Dark Souls' Undead Parish: the
 * castle's monastery past the Gun Bridge. In through the Cloister Gate, round the
 * cloister walk about its still pond, up onto the chapel terrace and the Ward's
 * bonfire at the chapel door, after the Cleansing Chapel: every way in the Ward
 * starts at it. West along the terrace, the bell roof, the Stone Warden, and past
 * him the Postern out to the Emberwood; east along the terrace, the forge yard, Brenna
 * at her anvil, and the Old Lift on the pier at the yard's south lip, down the hill
 * to the Harbour; the yard's own stair down to the cloister closes the loop.
 */
function chapel(): AreaMap {
  const rng = makeRng("area:chapel");
  const t = tierBuilder("surface", rng, { cols: 92, rows: 60 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  // The precinct's own grounds only, its walls the hill's woods: the gate court, the cloister round its pond, the chapel
  // terrace a height up north of it and the bell roof a height above that; east, the forge yard a height up its stair
  // and its pier running to the cliff; an alcove off the cloister's south walk.
  t.ground("chapel", 4, 26, 16, 9);
  t.ground("chapel", 20, 18, 30, 24);
  t.blob("chapel", 33, 11, 19, 7);
  t.ground("chapel", 16, 6, 14, 6);
  t.ground("chapel", 44, 12, 8, 6);
  t.ground("chapel", 20, 16, 30, 2);
  t.ground("chapel", 50, 14, 6, 28);
  // The forge yard a ragged spur of the hill, its pier a rocky tongue narrowing south to the lift.
  t.ground("chapel", 56, 18, 10, 23);
  t.blob("chapel", 70, 29, 16, 13);
  t.blob("chapel", 68, 44, 7, 6);
  t.blob("chapel", 68, 51, 4, 6);
  t.ground("chapel", 30, 42, 7, 9);
  t.pond(28, 24, 14, 10);
  // The chapel terrace and the bell roof over it ragged rock; the chapel's pad, the bell tower's and the stairs' landings exact.
  t.shape(2, 34, 11, 15, 5, 0.45, "The Chapel");
  t.shape(2, 21, 10, 6, 5, 0.4, "The Chapel");
  t.shape(2, 46, 13, 6, 4, 0.4, "The Chapel");
  t.block(2, 37, 8, 9, 6);
  t.block(2, 47, 13, 5, 4);
  t.stair(2, 52, 16, "R");
  t.shape(3, 24, 9, 6, 3, 0.35, "The Bell Roof");
  t.block(3, 18, 6, 6, 3);
  t.block(3, 26, 8, 4, 3);
  t.stair(3, 30, 10, "R");
  t.shape(2, 70, 29, 13, 10, 0.45, "The Forge Yard");
  t.shape(2, 62, 21, 6, 4, 0.4, "The Forge Yard");
  t.shape(2, 80, 36, 5, 4, 0.45, "The Forge Yard");
  t.shape(2, 68, 43, 5, 4, 0.4, "The Forge Yard");
  t.shape(2, 68, 49, 3, 4, 0.35, "The Forge Yard");
  t.shape(2, 61, 37, 6, 3, 0.3, "The Forge Yard");
  // The forge's own knoll a height up behind it; the stair's landing and the lift's head drawn exact.
  t.shape(3, 78, 23, 4, 3, 0.35, "The Forge Yard");
  t.block(2, 56, 38, 4, 3);
  t.block(2, 67, 52, 3, 4);
  t.stair(2, 55, 40, "L");
  // The terrace carried east at its own height onto a shelf of the forge yard, so the yard is a walk from the fire.
  t.ground("chapel", 52, 11, 14, 7);
  t.block(2, 52, 11, 4, 3);
  t.block(2, 56, 11, 10, 7);
  // The ways out to the map's edge: the Cloister Gate west, the Postern north off the bell roof.
  edgeWay(t, { col: 4, row: 30 }, { col: 1, row: 30 });
  // The Postern road goes down the back of the hill, a stair at each step, so it leaves the Ward at its lowest, nearer
  // the wood below: a walk north off the bell roof, west to a ledge a height down, and a ledge at the foot. None of
  // it touches the terrace, so the fog stays the one way onto the roof.
  t.ground("chapel", 21, 1, 3, 5);
  t.ground("chapel", 14, 2, 7, 3);
  t.ground("chapel", 10, 1, 4, 7);
  t.ground("chapel", 4, 1, 6, 10);
  t.block(3, 21, 2, 3, 4);
  t.block(3, 14, 2, 7, 3);
  t.block(2, 10, 1, 4, 7);
  t.stair(3, 13, 4, "L");
  t.stair(2, 9, 7, "L");
  edgeWay(t, { col: 6, row: 4 }, { col: 6, row: 1 });
  t.road([4, 30], [20, 30], [22, 20], [50, 18], [52, 17]);
  t.road([22, 20], [22, 40], [48, 40], [55, 40]);
  t.road([46, 14], [53, 12], [60, 16], [64, 22]);

  // The Cloister Gate: a tower each side.
  for (const [c, r] of [[9, 27], [9, 33]] as const) prop("tower", c, r, blue);
  // The cloister: trees at the pond's corners, the dead monks walking their round, a thief in the east walk.
  for (const [x, y] of [[24, 21], [45, 21], [24, 37], [45, 37]] as const) t.grove(x, y, 1, 1, 1);
  for (const [c, r, tc, tr] of [[22, 24, 22, 36], [30, 20, 40, 20], [40, 39, 28, 39]] as const) who("skull", c, r, { to: { col: tc, row: tr } });
  who("thief", 47, 30, { to: { col: 47, row: 22 } });
  for (const [c, r] of [[26, 40], [46, 19], [21, 19]] as const) prop("bones", c, r);
  // The alcove: gold left in the south wall, a thief who knows it.
  prop("goldStone", 33, 49);
  who("thief", 32, 45, { to: { col: 35, row: 45 } });
  // The chapel on its terrace, the Ward's fire at its door; the shaman keeps the stair up to it from the cloister.
  prop("monastery", 40, 11, blue);
  t.fires.push({ col: 46, row: 14 });
  who("shaman", 48, 20);
  // The bell roof: the bell tower, the Stone Warden on the bell.
  prop("tower", 20, 7, blue);
  who("stoneWarden", 25, 8);
  t.bosses.push({ name: "The Stone Warden", area: "chapel", col: 25, row: 8 });
  // The forge yard: the forge and its stock; the Old Lift at the pier's end over the drop.
  prop("house3", 72, 23, blue);
  for (const [c, r, art] of [[75, 27, "tools"], [77, 31, "goldStone"], [70, 33, "woodPile"]] as const) prop(art, c, r);
  for (const [c, r] of [[60, 22], [80, 36]] as const) who("skull", c, r, { to: { col: c + 3, row: r } });

  const notes: Note[] = [
    { at: { col: 6, row: 31 }, text: "The bell has not rung since the grey came." },
    { at: { col: 32, row: 14 }, text: "No room to run on the bell roof." },
  ];
  const exits: AreaExit[] = [
    { to: "ramparts", name: "Chapel Door", kind: "open", at: { col: 1, row: 30 }, plain: true },
    { to: "harbour", name: "The Old Lift", kind: "shortcut", at: { col: 68, row: 55 }, opens: "oldLiftDown" },
    { to: "emberwood", name: "The Postern", kind: "gate", at: { col: 6, row: 1 }, guard: "stoneWarden", plain: true },
  ];
  const districts: District[] = [
    { name: "The Cloister Gate", at: { col: 9, row: 30 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Cloister", at: { col: 34, row: 22 }, levels: [1], palette: [3], dress: "harbour", decor: 1 },
    { name: "The Chapel", at: { col: 40, row: 10 }, levels: [2], palette: [2], dress: "harbour", decor: 1 },
    { name: "The Bell Roof", at: { col: 24, row: 8 }, palette: [5, 3, 2], dress: "barrowmoor", decor: 0.3, box: { x: 18, y: 1, w: 12, h: 10 } },
    { name: "The Forge Yard", at: { col: 68, row: 28 }, levels: [2], palette: [3], dress: "harbour", decor: 1.5 },
    { name: "The Alcove", at: { col: 33, row: 46 }, levels: [1], palette: [4], dress: "harbour", decor: 1.5 },
  ];
  const tier = t.finish({ chapel: 0.02 }, [{ col: 6, row: 30 }]);
  const arena = { boss: "stoneWarden", gate: [{ col: 30, row: 10 }], inside: { col: 27, row: 9 } };
  return { ...tier, area: "chapel", entry: { col: 6, row: 30 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes, arena };
}

/**
 * The Ramparts, the castle's second area, after Dark Souls' Undead Burg: the
 * castle's curtain wall over its bailey. In at the gate yard from the Burg's
 * crest, up the gate tower onto the wall, along its walk, too narrow to circle, to
 * the Bull's Wall, where an iron-shod bull holds the only way on behind fog. Past
 * him the east tower, where the Ladder drops back to the Burg's square, and the
 * Gun Bridge over the ravine under the slingers to the Chapel Ward's door. Three
 * heights: the lower ward's yards and houses, the upper ward's tenements under
 * the wall, and the wall. The upper ward has its own stair up onto the Bull's
 * Wall, fogged while he stands: a back way in, and once he falls, a loop.
 */
function ramparts(): AreaMap {
  const rng = makeRng("area:ramparts");
  const t = tierBuilder("surface", rng, { cols: 84, rows: 50 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  // Three heights, after the Undead Burg: the lower ward (1), the upper ward under the wall (2), the wall and its towers (3).
  t.ground("ramparts", 4, 5, 14, 15);
  t.ground("ramparts", 18, 7, 44, 3);
  t.ground("ramparts", 18, 10, 40, 14);
  t.ground("ramparts", 4, 20, 56, 26);
  t.ground("ramparts", 62, 3, 10, 13);
  t.ground("ramparts", 72, 7, 4, 3);
  t.ground("ramparts", 76, 4, 6, 10);
  // The upper ward: the gate tower's foot and the tenement terrace under the wall, a ragged shelf of earth and rock,
  // a stair up at each end; the stair pads and the tower stair's footing drawn exact.
  t.shape(2, 10, 15, 8, 5, 0.4, "The Upper Ward");
  t.shape(2, 28, 15, 12, 8, 0.4, "The Upper Ward");
  t.shape(2, 46, 15, 12, 8, 0.45, "The Upper Ward");
  t.shape(2, 34, 21, 8, 3, 0.4, "The Upper Ward");
  t.shape(2, 51, 20, 6, 4, 0.4, "The Upper Ward");
  t.block(2, 18, 20, 4, 4);
  t.block(2, 54, 20, 4, 4);
  t.block(2, 17, 12, 4, 5);
  t.block(2, 53, 10, 3, 5);
  t.stair(2, 17, 23, "L");
  t.stair(2, 58, 23, "R");
  // The gate tower a height up again off the ward, the walk off its top, the east tower, the Gun Bridge and the door's landing.
  t.block(3, 4, 5, 14, 10);
  t.stair(3, 18, 14, "R");
  t.block(3, 18, 7, 44, 3);
  t.block(3, 62, 3, 10, 13);
  t.block(3, 72, 7, 4, 3);
  t.block(3, 76, 4, 6, 10);
  // The back stair: a landing off the Bull's Wall down onto the upper ward.
  t.block(3, 50, 10, 3, 3);
  t.stair(3, 53, 12, "R");
  // The lower ward's two raised yards, rocky knolls each crossed by a stair at either end, its pads drawn exact.
  t.shape(2, 31, 30, 8, 4, 0.4, "The Drill Yard");
  t.shape(2, 48, 30, 7, 4, 0.4, "The Drill Yard");
  for (const x of [24, 35, 42, 51]) t.block(2, x, 31, 3, 3);
  t.stair(2, 23, 33, "L");
  t.stair(2, 38, 33, "R");
  t.stair(2, 41, 33, "L");
  t.stair(2, 54, 33, "R");

  edgeWay(t, { col: 10, row: 45 }, { col: 10, row: 48 });
  edgeWay(t, { col: 81, row: 8 }, { col: 82, row: 8 }, 3);
  t.road([10, 48], [10, 26], [16, 24], [17, 23]);
  t.road([10, 36], [58, 36], [58, 23]);
  t.road([17, 23], [19, 17], [56, 17], [56, 22], [58, 23]);
  t.road([19, 17], [18, 14], [14, 10], [18, 8], [82, 8]);
  t.road([53, 12], [53, 17]);

  // The Gate Yard: towers at the gate, the guardhouse, the gallows at the cross lane.
  for (const [c, r] of [[7, 43], [13, 43]] as const) prop("tower", c, r, blue);
  prop("barracks", 7, 31, blue);
  for (const [c, r] of [[14, 38], [16, 39], [13, 40]] as const) prop("skullSpike", c, r);
  // The pound, where the garrison kept its horses: fenced, empty but for what the dead left.
  t.fences.push({ col: 13, row: 28, w: 6, h: 4 });
  for (const [c, r] of [[15, 29], [16, 30]] as const) prop("bones", c, r);
  prop("deadTree", 19, 39, { scale: 0.8 });
  // The garrison's woodyard by the guardhouse.
  t.fences.push({ col: 4, row: 35, w: 5, h: 4 });
  for (const [c, r, art] of [[5, 36, "stump"], [7, 37, "woodPile"], [5, 41, "meat"], [8, 26, "tools"]] as const) prop(art, c, r);
  for (const [c, r] of [[6, 40], [12, 22]] as const) who("skull", c, r, { to: { col: c + 3, row: r } });
  who("spear", 15, 25);
  // The gate tower's top: its watch, a slinger over the stair.
  prop("tower", 9, 9, blue);
  who("slingshot", 13, 11);
  for (const [c, r] of [[6, 13], [11, 13]] as const) prop("cannon", c, r);
  for (const [c, r, art] of [[15, 6, "woodPile"], [6, 7, "bones"], [16, 12, "skullSpike"]] as const) prop(art, c, r);
  // Its foot a height down: the gatekeepers' houses.
  for (const [c, r] of [[6, 18], [11, 18]] as const) prop(`house${(c % 3) + 1}`, c, r, blue);
  // The upper ward: tenements shoulder to shoulder both sides of the street, burned by the goblins who took the wall.
  [21, 25, 29, 33, 37, 41, 45].forEach((c, i) => prop(`house${(i % 3) + 1}`, c, 13 + (i % 2), blue));
  [20, 24, 28, 39, 43, 47, 55].forEach((c, i) => prop(`house${((i + 1) % 3) + 1}`, c, 20 + (i % 2), blue));
  prop("barracks", 34, 21, blue);
  for (const [c, r] of [[31, 16], [48, 18]] as const) who("torch", c, r, { to: { col: c + 4, row: r } });
  who("spear", 44, 17);
  who("thief", 51, 20, { to: { col: 51, row: 16 } });
  prop("goldStone", 40, 12);
  for (const [c, r, art] of [[23, 18, "woodPile"], [36, 18, "meat"], [52, 15, "woodPile"]] as const) prop(art, c, r);
  // The wall walk: the goblins who took it.
  for (const [c, r] of [[24, 8], [32, 8]] as const) who("spear", c, r);
  // The drill yard: the dead still drilling in ranks at the butts; the stores, a thrower over the lanes.
  prop("archery", 31, 31, blue);
  for (const [c, r] of [[26, 31], [35, 31]] as const) prop("house1", c, r, blue);
  for (const c of [26, 29, 32, 35]) who("skull", c, 29);
  who("skullGuard", 30, 28);
  for (const [c, r] of [[45, 31], [50, 31]] as const) prop(c % 2 ? "house3" : "house2", c, r, blue);
  for (const [c, r, art] of [[44, 29, "woodPile"], [48, 29, "tools"]] as const) prop(art, c, r);
  prop("goldStone", 52, 29);
  who("gnoll", 47, 30);
  // Smith's Row south of the cross lane, the Shambles in its middle: the thieves' fire and their loot.
  // Houses in twos and threes, a step off each other, with the smith's yard and a dead garden between the runs.
  for (const [c, r] of [[21, 39], [24, 40], [34, 39], [37, 40], [40, 39], [47, 39], [50, 40], [53, 39], [22, 43], [26, 44], [36, 43], [55, 43]] as const) prop(`house${((c + r) % 3) + 1}`, c, r, blue);
  t.fences.push({ col: 27, row: 38, w: 5, h: 4 }, { col: 29, row: 43, w: 5, h: 3 });
  for (const [c, r, art] of [[28, 39, "tools"], [30, 40, "woodPile"], [57, 39, "deadTree"]] as const) prop(art, c, r);
  prop("deadTree", 31, 44, { scale: 0.6 });
  t.campfires.push({ col: 46, row: 43 });
  for (const [c, r, art] of [[43, 42, "meat"], [49, 42, "woodPile"], [44, 44, "goldStone"]] as const) prop(art, c, r);
  for (const [c, r] of [[44, 43], [48, 44], [47, 41]] as const) who("thief", c, r, { flip: c > 46 });
  who("skull", 30, 37, { to: { col: 38, row: 37 } });
  for (const [c, r] of [[20, 44], [57, 41]] as const) prop("bones", c, r);
  // Dead hedges: between the runs of houses, along the north lane under the ward wall, and behind the pound.
  for (const [x, y, rx, ry] of [[43.5, 39, 1.5, 1], [30, 26, 1.5, 1], [50, 26, 1.5, 1], [21, 30, 1, 1.5], [5, 25, 1.5, 1], [15, 34, 1.5, 1], [57, 30, 1, 2]] as const) t.grove(x, y, rx, ry, 1);
  // The north lane: the ward's stores stacked against the wall it runs under.
  for (const [c, r, art] of [[23, 25, "woodPile"], [25, 25, "tools"], [36, 25, "woodPile"], [44, 25, "meat"], [55, 25, "woodPile"]] as const) prop(art, c, r);
  // The Bull's Wall.
  who("rampartBull", 51, 8);
  t.bosses.push({ name: "The Rampart Bull", area: "ramparts", col: 51, row: 8 });
  for (const [c, r] of [[45, 7], [57, 9]] as const) prop("bones", c, r);
  // The east tower: the guns silent, the Ladder down its south face.
  for (const [c, r] of [[64, 12], [70, 12]] as const) prop("cannon", c, r);
  prop("tower", 67, 6, blue);
  // The Gun Bridge: slingers on the far landing, a shaman at the door.
  for (const [c, r] of [[78, 5], [78, 12]] as const) who("slingshot", c, r);
  who("shaman", 80, 9);
  prop("skullSpike", 77, 10);

  const notes: Note[] = [
    { at: { col: 10, row: 44 }, text: "A narrow wall. What holds it does not turn aside." },
  ];
  const exits: AreaExit[] = [
    { to: "burg", name: "Rampart Gate", kind: "open", at: { col: 10, row: 48 }, plain: true },
    { to: "burg", name: "The Ladder", kind: "shortcut", at: { col: 67, row: 15 }, opens: "ladderDown" },
    { to: "chapel", name: "Chapel Door", kind: "open", at: { col: 82, row: 8 }, plain: true },
  ];
  const districts: District[] = [
    { name: "The Gate Yard", at: { col: 10, row: 38 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Lower Ward", at: { col: 40, row: 36 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.2 },
    { name: "The Drill Yard", at: { col: 38, row: 30 }, levels: [2], palette: [3], dress: "greyfall", decor: 0.8 },
    { name: "The Upper Ward", at: { col: 36, row: 17 }, levels: [2], palette: [3], dress: "greyfall", decor: 1 },
    { name: "The Gate Tower", at: { col: 10, row: 10 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.5 },
    { name: "The Wall Walk", at: { col: 28, row: 8 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.3 },
    { name: "The Bull's Wall", at: { col: 51, row: 8 }, palette: [5, 4, 3], gloom: true, dress: "barrowmoor", decor: 0.3, box: { x: 40, y: 7, w: 22, h: 3 } },
    { name: "The East Tower", at: { col: 67, row: 10 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.5 },
    { name: "The Chapel Door", at: { col: 79, row: 9 }, levels: [3], palette: [2], dress: "greyfall", decor: 1 },
  ];
  const tier = t.finish({ ramparts: 0.02 }, [{ col: 10, row: 46 }]);
  // The Bull's Wall closes in fog while he stands: the walk across at its two edge columns, and the back stair's landing.
  const across = (c: number) => [7, 8, 9].map((row) => ({ col: c, row }));
  const landing = [50, 51, 52].map((col) => ({ col, row: 10 }));
  const arena = { boss: "rampartBull", gate: [...across(40), ...across(61), ...landing], inside: { col: 43, row: 8 } };
  return { ...tier, area: "ramparts", entry: { col: 10, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes, arena };
}

/**
 * The Lower Burg, the first area of the castle, after Dark Souls' Undead Burg and
 * Dark Souls 3's Undead Settlement: the castle's outer town on the hill north of
 * the Harbour, fallen to the grey, a warren of alleys walled by houses and dead
 * wood, small squares where they meet. In at the Burg Gate onto Market Row; the
 * creek across the town, its two bridges found only through the alleys; the
 * tanneries and the mill on its north bank, and the square on its promontory over
 * the creek, the Burg's fire. Behind it the back lanes, Church Hill west and the
 * garrison east; the upper street is climbed only from the garrison or the far
 * end of Bell Lane, and the crest above it holds the Rampart Gate. The Keep Gate
 * is off the west alley.
 */
function burg(): AreaMap {
  const rng = makeRng("area:burg");
  const t = tierBuilder("surface", rng, { cols: 96, rows: 64 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  // A town grown over the hill, not a walled rectangle: lobes of ground, the ways out drawn exact.
  for (const [x, y, rx, ry] of [[48, 55, 40, 8], [48, 42, 46, 9], [26, 22, 22, 14], [72, 22, 22, 14], [52, 9, 20, 9], [50, 26, 16, 12], [12, 10, 10, 7], [14, 55, 8, 6], [82, 54, 8, 6], [14, 45, 8, 7], [84, 44, 8, 7], [14, 33, 8, 7]] as const) t.blob("burg", x, y, rx, ry);
  t.ground("burg", 2, 16, 12, 9);
  t.ground("burg", 44, 56, 9, 8);
  t.ground("burg", 48, 0, 9, 6);
  river(t, [[17, 45], [20, 44], [34, 47], [48, 45], [62, 48], [76, 45], [81, 46]], 3);
  t.bridge({ col: 40, row: 41 }, { col: 40, row: 50 }, 3);
  t.bridge({ col: 64, row: 42 }, { col: 64, row: 51 }, 3);

  // The square on its promontory, a stair down either side; nothing else of its height touches it.
  t.shape(2, 52, 31, 9, 4, 0.25, "The Burg Square");
  t.block(2, 44, 28, 16, 6);
  t.block(2, 40, 32, 4, 4);
  t.block(2, 60, 32, 4, 4);
  t.stair(2, 39, 35, "L");
  t.stair(2, 64, 35, "R");
  // The upper street round the crest, climbed from Bell Lane at its west end or across from the garrison.
  t.shape(2, 52, 7, 11, 4.5, 0.3, "The Upper Street");
  t.block(2, 38, 11, 7, 3);
  t.stair(2, 37, 13, "L");
  t.block(2, 58, 10, 14, 3);
  t.shape(3, 52, 3, 7, 2.5, 0.25, "The Crest");
  t.block(3, 47, 3, 10, 4);
  t.stair(3, 57, 6, "R");
  // Church Hill, a side climb off the west alley: the burned chapel on its top, gold for whoever goes up.
  t.shape(2, 22, 21, 8, 6, 0.35, "Church Hill");
  t.block(2, 13, 23, 4, 3);
  t.stair(2, 12, 25, "L");
  t.block(3, 19, 17, 8, 5);
  t.stair(3, 27, 21, "R");
  // The garrison, a rise a stair up at each end, the barracks on a core above it.
  t.shape(2, 77, 17, 10, 7, 0.35, "The Garrison");
  t.block(2, 68, 21, 3, 3);
  t.block(2, 84, 21, 3, 3);
  t.stair(2, 67, 23, "L");
  t.stair(2, 87, 23, "R");
  t.block(3, 72, 14, 10, 4);
  t.stair(3, 71, 17, "L");
  t.stair(3, 82, 17, "R");

  edgeWay(t, { col: 48, row: 61 }, { col: 48, row: 62 });
  edgeWay(t, { col: 52, row: 2 }, { col: 52, row: 1 }, 3);
  edgeWay(t, { col: 6, row: 20 }, { col: 1, row: 20 });

  // The alleys and squares the maze leaves open, each a line of points stamped `rad` round; a lone point is a square.
  const open = new Set<string>();
  const ragged = noise("burg:alleys", 3);
  const lane = (rad: number, ...pts: (readonly [number, number])[]): void => {
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[Math.max(0, i - 1)]!, pts[i]!];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let s = 0; s <= steps; s++) {
        const [x, y] = [Math.round(a[0] + ((b[0] - a[0]) * s) / steps), Math.round(a[1] + ((b[1] - a[1]) * s) / steps)];
        const rr = rad + Math.abs(ragged(x, y)) * 0.6;
        for (let dr = -Math.ceil(rr); dr <= rr; dr++) for (let dc = -Math.ceil(rr); dc <= rr; dc++) if (dc * dc + dr * dr <= rr * rr) open.add(`${x + dc},${y + dr}`);
      }
    }
  };
  // South bank: Market Row in from the gate, its north alley ending at the water, east through the thieves' yard and
  // back north to the east bridge; the stalls west of it walled off, reached over the west bridge from the far bank.
  lane(1, [48, 61], [48, 59]);
  lane(2.5, [48, 57]);
  lane(1, [48, 55], [48, 49]);
  lane(2, [30, 58]);
  lane(1, [27, 59], [20, 59], [16, 57], [15, 53], [19, 51], [27, 51], [34, 52], [38, 51], [40, 51]);
  lane(1, [16, 58], [11, 59], [8, 56]);
  lane(1.5, [8, 55]);
  lane(1, [51, 58], [57, 59]);
  lane(2, [60, 58]);
  lane(1, [63, 59], [70, 59], [76, 57], [77, 53], [72, 51], [66, 52]);
  lane(1, [76, 57], [83, 58], [86, 55]);
  lane(1.5, [86, 54]);
  // North bank, two pockets joined only over the square: off the west bridge, Mags's nook under its west stair and
  // the thieves' camp under the promontory; off the east bridge, its east stair and the way to the mill.
  lane(1, [40, 40], [38, 38], [38, 35]);
  lane(2, [35, 37]);
  lane(1, [41, 41], [48, 41]);
  lane(2.5, [55, 40]);
  lane(1, [64, 41], [65, 38], [65, 35]);
  lane(2.5, [18, 39]);
  lane(1, [15, 41], [12, 43]);
  lane(1.5, [11, 43]);
  lane(1, [66, 39], [70, 37], [74, 38], [77, 40]);
  lane(2.5, [80, 40]);
  lane(1, [83, 41], [88, 42]);
  lane(1.5, [89, 42]);
  // The tanneries off the west alley, which runs north past Church Hill's stair and the Keep Gate to a blind yard, and Bell Lane
  // off it east under the upper street to its west stair.
  lane(1, [16, 36], [11, 32], [10, 26], [8, 21], [3, 20]);
  lane(1, [8, 21], [8, 14], [9, 11], [9, 7]);
  lane(1.5, [9, 5]);
  lane(1, [9, 11], [16, 10], [24, 11], [31, 9], [36, 13]);
  // The back lanes: Church Lane along the hill's foot to the Well, a blind alley under the upper street's wall, on
  // east to the garrison's stair; the mill's alley up to its other stair.
  lane(1, [11, 30], [20, 30], [31, 29], [37, 25]);
  lane(2, [41, 22]);
  lane(1, [42, 20], [45, 17]);
  lane(1, [44, 23], [52, 25], [58, 22], [63, 24], [66, 23]);
  lane(1, [80, 37], [83, 31], [88, 27], [88, 23]);
  // The well lane: from the Well down behind Mags to the square's stair, the way home.
  lane(1, [39, 24], [37, 29], [36, 34]);

  // The Burg Gate's towers; Market Row's gallows, where the Burg hanged its own once the bell stopped.
  for (const [c, r] of [[44, 60], [52, 60]] as const) prop("tower", c, r, blue);
  for (const [c, r] of [[45, 56], [46, 55]] as const) prop("skullSpike", c, r);
  prop("bones", 47, 56);
  prop("deadTree", 51, 55, { scale: 0.8 });
  // Houses round the squares, each a wall of the warren.
  for (const [c, r, n] of [[27, 60, 3], [33, 60, 1], [57, 60, 2], [63, 60, 3], [78, 38, 3], [83, 38, 1]] as const) prop(`house${n}`, c, r, blue);
  // The stalls, and the thieves who work them.
  for (const [c, r, art] of [[29, 57, "meat"], [32, 58, "tools"], [59, 57, "woodPile"], [62, 58, "meat"]] as const) prop(art, c, r);
  who("thief", 31, 59, { to: { col: 24, row: 59 } });
  who("thief", 60, 59, { to: { col: 53, row: 58 } });
  // Blind yards: gold for whoever turns down them, a walker on each.
  prop("goldStone", 7, 55);
  who("skull", 10, 59, { to: { col: 8, row: 56 } });
  prop("goldStone", 87, 54);
  who("thief", 84, 57, { to: { col: 78, row: 57 } });
  // The bridges, each held at its north end.
  for (const [c, r] of [[38, 40], [66, 41]] as const) who("spear", c, r);
  // Mags the Peddler's nook.
  for (const [c, r, art] of [[32, 36, "woodPile"], [37, 37, "tools"]] as const) prop(art, c, r);
  // The thieves' camp under the promontory: their fire, their loot, three of them round it.
  t.campfires.push({ col: 55, row: 40 });
  for (const [c, r, art] of [[52, 39, "woodPile"], [53, 42, "meat"], [57, 42, "goldStone"]] as const) prop(art, c, r);
  for (const [c, r] of [[52, 41], [56, 38], [58, 41]] as const) who("thief", c, r, { flip: c > 55 });
  // The tanneries: hides and racks in the yard, the dead at work, gold where the creek turns.
  for (const [c, r, art] of [[16, 41, "meat"], [16, 37, "woodPile"], [21, 37, "meat"]] as const) prop(art, c, r);
  who("skull", 17, 39, { to: { col: 21, row: 39 } });
  prop("goldStone", 10, 43);
  who("skull", 12, 42);
  // The mill: its yard, and a gnoll over the gold in the blind yard past it.
  for (const [c, r, art] of [[77, 42, "woodPile"], [81, 42, "tools"]] as const) prop(art, c, r);
  prop("goldStone", 90, 42);
  who("gnoll", 88, 41, { to: { col: 84, row: 41 } });
  // The west alley and the Keep Gate at its north end; gold in the yard past it.
  who("spear", 8, 24);
  prop("goldStone", 9, 4);
  who("skull", 9, 7, { to: { col: 8, row: 12 } });
  // The back lanes: the Well where the market's dead were thrown, and gold under the upper street's wall.
  for (const [c, r] of [[40, 22], [42, 23]] as const) prop("bones", c, r);
  prop("goldStone", 46, 16);
  who("skull", 44, 18);
  // The square on the promontory: the Burg's fire over the creek, slingers on its rim shooting down onto the stairs.
  t.fires.push({ col: 52, row: 32 });
  for (const [c, r] of [[45, 31], [59, 31]] as const) who("slingshot", c, r);
  // Church Hill: the burned chapel, its graves, an archer over the west alley.
  prop("monastery", 22, 19, blue);
  for (const [c, r] of [[17, 24], [20, 26], [24, 25], [28, 23]] as const) prop("skullSpike", c, r);
  prop("deadTree", 15, 21, { scale: 0.7 });
  who("archer", 16, 24, { color: "black" });
  who("skull", 24, 23, { to: { col: 27, row: 23 } });
  prop("goldStone", 25, 18);
  // The upper street: the better houses, the dead and a thief.
  for (const [c, r, art] of [[61, 11, "house3"], [46, 9, "house2"], [59, 7, "house1"]] as const) prop(art, c, r, blue);
  who("thief", 47, 9, { to: { col: 57, row: 9 } });
  who("skull", 63, 11, { to: { col: 69, row: 11 } });
  // The garrison: the barracks on its core, the butts below, the dead still drilling and their sergeant.
  prop("barracks", 76, 16, blue);
  prop("archery", 77, 22, blue);
  for (const [c, r] of [[72, 19], [74, 19], [80, 19], [82, 19]] as const) who("skull", c, r);
  who("skullGuard", 77, 17);
  prop("goldStone", 80, 15);
  // The crest: the castle's gate towers.
  for (const [c, r] of [[49, 4], [55, 4]] as const) prop("tower", c, r, blue);

  const notes: Note[] = [
    { at: { col: 49, row: 57 }, text: "Thieves in the stalls." },
    { at: { col: 48, row: 50 }, text: "Too deep to wade. Find a bridge." },
  ];
  const exits: AreaExit[] = [
    { to: "harbour", name: "Burg Gate", kind: "open", at: { col: 48, row: 62 }, plain: true },
    { to: "ramparts", name: "Rampart Gate", kind: "open", at: { col: 52, row: 1 }, plain: true },
    { to: "ramparts", name: "The Ladder", kind: "shortcut", at: { col: 56, row: 32 }, shut: "ladderDown" },
    { to: "keep", name: "Keep Gate", kind: "locked", at: { col: 1, row: 20 }, key: "troll" },
  ];
  const districts: District[] = [
    { name: "Market Row", at: { col: 48, row: 56 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Creek", at: { col: 48, row: 46 }, levels: [1], palette: [4], dress: "greyfall", decor: 1 },
    { name: "The Tanneries", at: { col: 20, row: 39 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Mill", at: { col: 80, row: 40 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Burg Square", at: { col: 52, row: 31 }, levels: [2], palette: [4, 3], dress: "greyfall", decor: 1 },
    { name: "The Upper Street", at: { col: 52, row: 10 }, levels: [1, 2], palette: [4, 3], dress: "greyfall", decor: 1.5 },
    { name: "Church Hill", at: { col: 22, row: 20 }, levels: [2, 3], palette: [4, 3, 2], dress: "barrowmoor", decor: 1.5 },
    { name: "The Garrison", at: { col: 76, row: 18 }, levels: [2, 3], palette: [4, 3, 2], dress: "greyfall", decor: 1 },
    { name: "The Crest", at: { col: 52, row: 4 }, levels: [3], palette: [4, 3, 2], dress: "greyfall", decor: 1 },
  ];
  const tier = t.finish({}, [{ col: 48, row: 60 }], (c, r) => open.has(`${c},${r}`));
  return { ...tier, area: "burg", entry: { col: 48, row: 60 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes };
}

/**
 * Last Harbour. Its hub is Lantern Point, after Firelink: a small headland in
 * the south-east corner where the Shore Road from the Landing comes in, the
 * lighthouse fire its bonfire. A shore path west to the town, and the Graves
 * road north to the Moor Gate, too hard to walk early and shut at its end.
 * The town is the bowl round the market, the castle climbing above it.
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
  // Lantern Point's inlet: water from the Moor Watch's foot to the bay, so the shore path is the one way west.
  lake(t, 81, 64, 5, 6.5);
  t.pond(83, 56, 4, 10);

  // One climb from the bonfire, after Firelink's stair to the Burg: the bowl's north stairs onto Old Town, the Upper
  // Town above it, and the Castle Gate on the hill's crown, the Burg Gate through it and the road on north off the map
  // to the Lower Burg.
  t.shape(2, 57, 23, 21, 18, 0.3, "Old Town");
  t.shape(2, 70, 11, 8, 5, 0.3, "Old Town");
  t.shape(2, 56, 6, 16, 5, 0.2, "Old Town");
  t.shape(3, 56, 18, 13, 12, 0.3, "The Upper Town");
  edgeWay(t, { col: 56, row: 6 }, { col: 56, row: 1 });
  t.shape(4, 56, 6, 8, 6, 0.15, "The Castle Gate");
  // The Northwood: a wooded upland of its own west of the castle, a crag on its crown.
  t.shape(2, 18, 20, 14, 11, 0.45, "The Northwood");
  t.shape(3, 15, 14, 6, 4, 0.45, "The Northwood");
  // The Mine Hills east: a broad hill, its working face, the crest.
  t.shape(2, 94, 24, 14, 11, 0.45, "Mine Hills");
  t.shape(3, 93, 18, 9, 6, 0.45, "Mine Hills");
  t.shape(4, 92, 14, 4, 3, 0.3, "Mine Hills");
  // The Moor Watch, Lantern Point's hill: the graves on its slope, the old watchtower on its crest, the Moor Gate on its
  // seaward edge; and the knoll in West Fields.
  t.shape(2, 100, 53, 10, 11, 0.3, "The Graves");
  t.shape(3, 101, 48, 5, 3.5, 0.3, "The Graves");
  // The climb in plain sight from the fire: a notch cut into the hill's face straight above it, a stair up its side.
  t.block(1, 96, 61, 2, 4);
  t.stair(2, 97, 64, "L");
  t.shape(2, 16, 56, 6, 3.5, 0.45, "West Fields");

  // Roads: the lower town's streets from the square to the docks and both gates; the creek crossed by the Old Bridge.
  // Streets that bend with the ground, not a grid: the main way from the Old Bridge through the square to the Moor
  // Gate, the Ember Gate road north, the docks lane curving down to the shore, and the farm road.
  t.road([1, 42], [12, 43], [26, 47], [40, 47], [50, 46]);
  t.road([62, 46], [72, 48], [86, 47]);
  t.road([26, 47], [33, 41], [34, 30], [28, 4], [26, 1]);
  t.road([56, 48], [55, 52], [56, 56]);
  t.road([57, 48], [56, 52], [57, 56]);
  t.road([26, 47], [28, 54], [37, 58], [37, 66], [3, 66]);
  t.road([15, 66], [15, 61]);
  // The Burg road: up from the bowl's north stairs, straight up the hill to the Castle Gate.
  t.road([55, 39], [56, 30], [56, 20], [56, 6]);
  // The path out to the mine, and Lantern Point's ways: the shore path west to the docks, the climb up the Graves to the
  // Moor Gate, and the Shore Road off its tip to the Landing.
  t.road([86, 47], [86, 34]);
  t.road([95, 74], [86, 73], [77, 73], [73, 68], [70, 61], [72, 55], [72, 49], [70, 47]);
  t.road([96, 71], [97, 66], [97, 64]);
  t.road([98, 63], [99, 58], [101, 54], [104, 51], [109, 50]);
  t.road([95, 74], [95, 78]);
  t.bridge({ col: 95, row: 76 }, { col: 95, row: 78 }, 3);
  // The market square, paved.
  for (const r of [44, 46, 48]) t.road([50, r], [62, r]);
  t.bridge({ col: 8, row: 42 }, { col: 1, row: 42 }, 3);
  t.bridge({ col: 28, row: 7 }, { col: 26, row: 1 }, 3);
  t.bridge({ col: 50, row: 58 }, { col: 50, row: 62 });
  t.bridge({ col: 62, row: 58 }, { col: 62, row: 62 });
  // The Lower Town is a bowl, after Firelink: the bonfire square sunk in the middle, the houses up on a rim round it,
  // Old Town's cliff its north side, and the streets the passes out of it.
  rim(t, 56, 45, 15, 9, 4, "The Lower Town");
  // The climb starts at the fire: twin stairs up the bowl's north wall onto Old Town, the castle straight above.
  t.stair(2, 54, 40, "R");
  t.stair(2, 56, 40, "L");
  // A gate tower at the mouth of each pass, so from the fire the bowl's sides read as its ways out.
  for (const [c, r] of [[43, 44], [69, 44], [60, 52]] as const) prop("watchtower", c, r);
  // Copses on the rim and in the bowl's corners, so the hollow is green round the fire.
  for (const [x, y, rx, ry, d] of [[44, 41, 2, 1.5, 0.6], [46, 51, 2.5, 1.5, 0.6], [66, 51, 2.5, 1.5, 0.6], [69, 50, 1.5, 1.5, 0.6], [50, 41, 1.5, 1, 0.7], [62, 41, 1.5, 1, 0.7]] as const) t.grove(x, y, rx, ry, d);

  // The bowl's fire is the hub, after Firelink: the Harbour's one bonfire, first, so a fall at the Ring wakes here.
  t.fires.push({ col: 56, row: 45 });

  // The Castle Gate: a tower either side of the road through it, the castle's keep looming over the wall beside it.
  for (const [c, r] of [[53, 7], [59, 7]] as const) prop("tower", c, r, blue);
  prop("castle", 64, 9, blue);
  who("lancer", 55, 10, { ...blue, to: { col: 57, row: 10 } });

  // The Upper Town: the chapel and its close of trees, the old families' houses along the terrace, a garden.
  prop("monastery", 48, 24, blue);
  for (const [c, r, art] of [[53, 27, "house2"], [59, 27, "house1"], [64, 24, "house3"], [66, 20, "house2"], [46, 19, "house1"]] as const) prop(art, c, r, blue);
  t.fences.push({ col: 61, row: 21, w: 4, h: 2 });
  for (const [c, r] of [[62, 22], [63, 22]] as const) who("sheep", c, r);
  who("monk", 51, 25, { ...blue, to: { col: 55, row: 25 } });
  who("pawn", 58, 23, { ...blue, act: "gold", to: { col: 61, row: 25 } });
  t.campfires.push({ col: 57, row: 25 });

  // Old Town: the busiest ground in the Reach. The market under the terraces, a smithy corner, cottages on every
  // spare ledge, folk at their trades, and the watch walking the stairs between the tiers.
  for (const [c, r, art] of [[40, 28, "house1"], [42, 34, "house3"], [48, 37, "house2"], [70, 34, "house1"], [75, 26, "house3"], [73, 14, "house2"], [66, 38, "house3"]] as const) prop(art, c, r, blue);
  for (const [c, r, art] of [[54, 32, "woodPile"], [58, 33, "meat"], [62, 32, "goldStone"], [56, 36, "tools"]] as const) prop(art, c, r);
  crowd(t, rng, "pawn", { col: 58, row: 34 }, 2, 3, { ...blue, act: "meat" });
  prop("house3", 46, 30, blue);
  who("pawn", 48, 31, { ...blue, act: "hammer" });
  t.campfires.push({ col: 52, row: 38 });
  who("warrior", 44, 38, { ...blue, to: { col: 70, row: 30 } });
  who("archer", 72, 30, { ...blue, to: { col: 64, row: 22 } });

  // The Lower Town, as clusters each with its own life (after the Witcher's Oxenfurt): the paved market round the fire,
  // the Old Well on the bowl's floor opposite the climb (up is the castle and the sky, down is the drowned), the west quarter's houses thinning out toward the archery butts, the east quarter's smithy,
  // garden and garrison, and the docks on the shore; a watchtower at each gate. Folk walk between them at their work.
  for (const [c, r, art] of [[51, 45, "woodPile"], [61, 45, "meat"], [61, 48, "goldStone"], [59, 49, "woodPile"]] as const) prop(art, c, r);
  // A few at the market, not a crowd: a town this size reads busy with a handful.
  crowd(t, rng, "pawn", { col: 56, row: 46 }, 2, 4, { ...blue, act: "gold" });
  who("pawn", 58, 47, { color: "yellow", act: "meat", to: { col: 54, row: 47 } });
  // The west quarter: close round the square, sparser toward the fields.
  for (const [c, r, art] of [[47, 44, "house2"], [44, 44, "house1"], [40, 44, "house3"], [36, 44, "house2"], [48, 50, "house3"], [45, 50, "house2"], [35, 50, "house1"], [48, 53, "house1"], [45, 53, "house3"], [51, 53, "house2"], [36, 54, "house3"]] as const) prop(art, c, r, blue);
  prop("archery", 31, 51, blue);
  who("archer", 30, 53, blue);
  prop("watchtower", 21, 44);
  who("lancer", 18, 46, { ...blue, to: { col: 24, row: 47 } });
  // The east quarter: the smithy and its yard, a fenced garden, the barracks, the gate's watchtower.
  for (const [c, r, art] of [[65, 44, "house1"], [68, 44, "house3"], [71, 44, "house2"], [76, 44, "house1"], [80, 44, "house3"], [81, 51, "house2"], [84, 51, "house1"], [78, 55, "house3"], [82, 55, "house2"]] as const) prop(art, c, r, blue);
  prop("house3", 66, 52, blue);
  for (const [c, r, art] of [[65, 54, "tools"], [68, 54, "goldStone"], [63, 55, "woodPile"]] as const) prop(art, c, r);
  who("pawn", 67, 54, { ...blue, act: "hammer" });
  t.fences.push({ col: 59, row: 51, w: 5, h: 4 });
  t.grove(61, 52, 0.6, 0.6, 1);
  prop("barracks", 77, 52, blue);
  who("warrior", 75, 50, { ...blue, to: { col: 80, row: 50 } });
  prop("watchtower", 89, 43);
  // The rounds: wood from the farm to the smithy, fish up the lane to the market, the watch along the main way.
  who("pawn", 30, 56, { ...blue, act: "wood", to: { col: 64, row: 50 } });
  who("pawn", 57, 55, { ...blue, act: "meat", to: { col: 57, row: 49 } });
  who("warrior", 30, 48, { ...blue, to: { col: 82, row: 48 } });

  // The Docks: fish huts along both shores of the bay, the catch heaped and gutted, boats out on the water.
  for (const [c, r] of [[42, 58], [70, 58], [47, 59], [65, 59]] as const) prop("fishHut", c, r);
  for (const [c, r] of [[58, 56], [44, 60], [68, 60]] as const) prop("meat", c, r);
  for (const [c, r] of [[46, 65], [62, 66], [56, 69], [60, 61]] as const) prop("boat", c, r, { flip: c > 56 });
  // The boat to the sea cave, moored at the pier's end.
  prop("boat", 52, 62);
  for (const [c, r] of [[45, 61], [67, 61]] as const) who("pawn", c, r, { ...blue, act: "knife" });
  who("turtle", 44, 60);
  who("rubberDuck", 52, 66);

  // The Northwood: woodcutters' cabins in the trees, a lookout on the crag.
  prop("house1", 22, 24, blue);
  prop("house1", 10, 22, blue);
  prop("tower", 15, 13, blue);
  crowd(t, rng, "pawn", { col: 20, row: 22 }, 3, 3, { ...blue, act: "axe" });
  who("bear", 8, 18, { to: { col: 14, row: 26 } });
  t.grove(18, 22, 13, 9, 0.5);
  // The lumber camp at the wood's foot by the Ember Gate road: felled trunks stacked, stumps, a fire, the axes going.
  for (const [c, r] of [[24, 37], [27, 38], [22, 39]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[20, 35], [29, 35], [25, 34]] as const) prop("stump", c, r);
  t.campfires.push({ col: 25, row: 40 });
  for (const [c, r] of [[21, 36], [28, 36]] as const) who("pawn", c, r, { ...blue, act: "axe" });
  who("pawn", 26, 39, { ...blue, act: "wood", to: { col: 40, row: 46 } });

  // The goblins' camp outside the Ember Gate: Emberwood's raiders dug in on the Harbour's side of the road, the first
  // fight a captain walking north meets.
  prop("goblinHut", 35, 6);
  // The camp's fire: a campfire, the gate it guards shut from this side until it is opened from the wood.
  t.campfires.push({ col: 33, row: 9 });
  // Two torches and a spear: winnable at the start, with nothing but the sword (three met at once killed in five seconds).
  for (const [c, r] of [[35, 10], [36, 12]] as const) who("torch", c, r);
  who("spear", 34, 13);
  prop("skullSpike", 31, 5);

  // The Mine Hills: the mine in the working face, ore in the rock, a cave under the crest.
  prop("goldMine", 90, 22);
  for (const [c, r] of [[86, 16], [98, 18], [100, 26], [88, 28]] as const) prop("goldStone", c, r);
  prop("cave", 100, 20);
  crowd(t, rng, "pawn", { col: 92, row: 25 }, 4, 4, { ...blue, act: "pickaxe", walk: false });
  // The miners' camp at the hill's foot where the mine road ends, and the ore carried down to the smith.
  for (const [c, r, art] of [[84, 36, "tools"], [89, 37, "woodPile"], [88, 35, "goldStone"]] as const) prop(art, c, r);
  t.campfires.push({ col: 86, row: 37 });
  for (const [c, r] of [[90, 33], [96, 31]] as const) who("pawn", c, r, { ...blue, act: "pickaxe" });
  who("pawn", 87, 38, { ...blue, act: "gold", to: { col: 66, row: 54 } });

  // The Old Bridge: Saltreach's fishers and its yellow militia come over to trade, a taste of the shore beyond.
  prop("fishHut", 14, 39);
  prop("meat", 17, 40);
  who("lancer", 10, 45, { color: "yellow", to: { col: 15, row: 45 } });
  who("pawn", 13, 41, { color: "yellow", act: "knife" });

  // West Fields: a farm on the farm road. The farmstead on its knoll with a copse beside it, paddocks of sheep and
  // pigs, and below them fenced fields in crop rows and fenced pastures, worked by farmhands.
  prop("house3", 16, 55, blue);
  for (const [c, r] of [[19, 56], [13, 56]] as const) prop(c === 19 ? "woodPile" : "meat", c, r);
  prop("house1", 26, 58, blue);
  t.grove(25, 51, 2.5, 2, 0.9);
  t.fences.push({ col: 8, row: 46, w: 6, h: 4 }, { col: 15, row: 47, w: 5, h: 4 });
  for (const [c, r] of [[9, 47], [11, 48], [10, 48]] as const) who("sheep", c, r);
  for (const [c, r] of [[16, 48], [17, 49]] as const) who("pig", c, r);
  // The pastures, fenced to the fields' own edges, the flocks grazing in them.
  t.fences.push({ col: 4, row: 68, w: 10, h: 6 }, { col: 16, row: 68, w: 8, h: 5 });
  t.fences.push({ col: 4, row: 61, w: 10, h: 5 }, { col: 16, row: 61, w: 10, h: 5 }, { col: 28, row: 61, w: 9, h: 5 });
  for (const [c, r] of [[6, 70], [8, 71], [10, 70], [11, 72], [7, 72]] as const) who("sheep", c, r);
  for (const [c, r] of [[18, 70], [20, 71], [21, 70]] as const) who("pig", c, r);
  for (const [c, r] of [[6, 63], [11, 64], [18, 63], [23, 64], [31, 63]] as const) who("pawn", c, r, { ...blue, act: "knife" });
  who("pawn", 34, 64, { ...blue, act: "axe" });
  who("pawn", 13, 67, { ...blue, act: "wood", to: { col: 16, row: 58 } });
  who("pawn", 26, 66, { ...blue, act: "meat", to: { col: 26, row: 60 } });

  // The Graves, after Firelink's graveyard on the slope behind the shrine: the path up from the point crosses the moor's
  // dead to the Moor Gate on the hill's seaward edge, shut from this side. Gold in plain view and the moor's dogs among
  // the graves, far past a new captain (three gnolls and a shaman, 45 hp and 9 a blow apiece, two of them throwing).
  // Opened later from Barrowmoor, the gate brings the captain down this hill straight to the fire.
  prop("tower", 101, 47, blue);
  who("archer", 103, 49, blue);
  for (const [c, r] of [[93, 55], [97, 58], [103, 58], [106, 57]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[93, 58], [100, 60], [94, 61]] as const) prop("deadTree", c, r, { scale: 0.7 });
  who("skull", 96, 60, { to: { col: 100, row: 61 } });
  for (const [c, r] of [[99, 57], [104, 56], [98, 54]] as const) who("gnoll", c, r);
  who("shaman", 102, 53);
  prop("goldStone", 99, 61);
  for (const [c, r] of [[95, 61], [105, 61]] as const) prop("bones", c, r);

  // Lantern Point, the lighthouse on the south-east headland at the Graves road's foot, the cove's gold behind it.
  prop("tower", 101, 71, blue);
  prop("house1", 92, 69, blue);
  prop("fishHut", 87, 71);
  prop("meat", 89, 72);
  who("archer", 99, 75, { ...blue, to: { col: 103, row: 74 } });
  for (const [c, r] of [[101, 66], [104, 67]] as const) prop("skullSpike", c, r);
  prop("deadTree", 98, 66, { scale: 0.7 });
  prop("bones", 102, 68);
  for (const [c, r] of [[91, 78], [98, 78]] as const) prop("boat", c, r, { flip: c > 95 });
  prop("goldStone", 108, 73);
  t.grove(106, 71, 1.5, 1.5, 0.8);
  t.grove(107, 68, 1.5, 1.5, 0.6);

  // Copses in the lowland's corners and between the clusters, so the town sits in a country, not on bare grass.
  for (const [x, y, rx, ry, d] of [[104, 8, 5, 4, 0.7], [82, 14, 3, 5, 0.6], [6, 34, 3, 3, 0.7], [76, 72, 4, 2, 0.6]] as const) t.grove(x, y, rx, ry, d);
  for (const [x, y, rx, ry, d] of [[78, 66, 6, 4, 0.55], [32, 72, 5, 3, 0.55], [104, 36, 3, 4, 0.6], [8, 30, 4, 4, 0.6], [74, 42, 3, 2, 0.5]] as const) t.grove(x, y, rx, ry, d);

  const exits: AreaExit[] = [
    { to: "saltreach", name: "Old Bridge", kind: "open", at: { col: 1, row: 42 }, plain: true },
    { to: "barrowmoor", name: "Moor Gate", kind: "shortcut", at: { col: 109, row: 50 }, shut: "moorGateOpen" },
    { to: "emberwood", name: "Ember Gate", kind: "gate", at: { col: 26, row: 1 }, shut: "emberGateOpen" },
    { to: "chapel", name: "The Old Lift", kind: "shortcut", at: { col: 72, row: 41 }, shut: "oldLiftDown" },
    { to: "burg", name: "Burg Gate", kind: "open", at: { col: 56, row: 1 }, plain: true },
    { to: "undercroft", name: "Old Well", kind: "drop", at: { col: 52, row: 48 } },
    { to: "ring", name: "The Boat", kind: "lift", at: { col: 50, row: 61 } },
  ];
  // The hub is the brightest place in the game: green ground climbing through fresh green to a gold capital, no olive or teal.
  const districts: District[] = [
    { name: "The Upper Town", at: { col: 56, row: 27 }, levels: [3], palette: [1], dress: "harbour", decor: 2 },
    { name: "Old Town", at: { col: 60, row: 39 }, levels: [2], palette: [2], dress: "harbour", decor: 2 },
    { name: "The Lower Town", at: { col: 56, row: 52 }, levels: [1, 2], palette: [3, 2], dress: "harbour", decor: 2 },
    { name: "The Docks", at: { col: 56, row: 75 }, levels: [1], palette: [3], dress: "saltreach", decor: 2 },
    { name: "West Fields", at: { col: 16, row: 60 }, palette: [3], dress: "harbour", decor: 1 },
    // The fields and pastures, on the farm's own green (painted patches read as flat colour): the fields drawn in crop
    // rows, each fenced, a track between; unnamed, so no label sits on them.
    ...([[4, 61, 10, 5, true], [16, 61, 10, 5, true], [28, 61, 9, 5, true], [4, 68, 10, 6, false], [16, 68, 8, 5, false]] as const).map(([x, y, w, h, crops]): District => ({ name: "", at: { col: x + (w >> 1), row: y + (h >> 1) }, palette: [3], dress: "harbour", decor: 0.4, crops, box: { x, y, w, h } })),
    { name: "The Northwood", at: { col: 18, row: 30 }, levels: [1, 2, 3], palette: [3, 2, 1], dress: "emberwood", decor: 1.5, trees: 0.4 },
    { name: "Mine Hills", at: { col: 96, row: 34 }, levels: [1, 2, 3, 4], palette: [3, 2, 1, 1], dress: "crags", decor: 2.5, trees: 0.06 },
    { name: "Lantern Point", at: { col: 97, row: 71 }, levels: [1], palette: [3], dress: "saltreach", decor: 1.5 },
    { name: "The Castle Gate", at: { col: 56, row: 8 }, levels: [4], palette: [1], dress: "harbour", decor: 1 },
    // The Graves read dark against the point's green: the hill's foot keeps the green, its slope and crest go grey-teal and olive.
    { name: "The Graves", at: { col: 97, row: 57 }, levels: [1, 2, 3], palette: [3, 5, 4], dress: "barrowmoor", decor: 1.5, gloom: true },
  ];
  // Messages on the ground, after the Souls games: at the well's lip, on the pier and at the Graves road's foot.
  const notes: Note[] = [
    { at: { col: 53, row: 47 }, text: "The rope is cut. No way back up." },
    { at: { col: 51, row: 59 }, text: "Back to the Ring. If the bull lives, he waits." },
    { at: { col: 95, row: 67 }, text: "Dogs on the hill, and its gate is shut. Not yet." },
  ];
  const tier = t.finish({}, [{ col: 56, row: 46 }]);
  return { ...tier, area: "harbour", entry: { col: 56, row: 47 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes };
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

  // Landforms, each its own district's ground. Warren Hill: the goblins' hill, its warrens stacked in two heights.
  t.shape(2, 25, 23, 12, 10, 0.45, "Warren Hill");
  t.shape(3, 25, 20, 7, 5, 0.4, "Warren Hill");
  // Smoke Bluff across the river from it, and the Treetop Walk between them over the water.
  t.shape(2, 26, 46, 8, 5, 0.4, "Smoke Bluff");
  const decks = t.span(2, 27, 32, 2, 10);
  // Troll's Hollow: a raised arena of ash in the north wood, the troll's ground.
  t.shape(2, 63, 14, 11, 8, 0.35, "Troll's Hollow");
  // Crag Foot: the rock rising in the north-east, two steps toward the Crags; an ash mound in the Burn.
  t.shape(2, 92, 14, 11, 7, 0.45, "Crag Foot");
  t.shape(3, 93, 11, 6, 4, 0.4, "Crag Foot");
  t.shape(2, 80, 58, 7, 5, 0.4, "The Burn");

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
  // The Postern Crag: the Chapel Ward stands high on its hill, so its back road comes down onto a crag's top ledge
  // west of the Burn, and on down a stair at each step to the wood floor.
  t.shape(2, 60, 59, 9, 6, 0.3, "Postern Crag");
  t.shape(3, 60, 58, 5.5, 3.5, 0.25, "Postern Crag");
  t.shape(4, 60, 57, 2.5, 1.5, 0.15, "Postern Crag");
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

  // The Cinder Ford: where the road crosses the Run, the last fire before the troll, goblins watching the crossing.
  who("lizard", 50, 39, { to: { col: 60, row: 38 } });
  who("thief", 46, 30, { to: { col: 40, row: 28 } });
  t.fires.push({ col: 48, row: 31 });
  prop("goblinHut", 52, 30);
  crowd(t, rng, "spear", { col: 53, row: 33 }, 3, 2);

  // The climb to Crag Foot: a goblin post where the road leaves the wood.
  prop("goblinHut", 80, 26);
  crowd(t, rng, "torch", { col: 82, row: 27 }, 3, 2);
  prop("skullSpike", 78, 24);

  // The goblins' works: planks on the Treetop Walk, a lookout on Warren Hill's crest, their larders and trophies.
  t.road([28, 33], [28, 40]);
  prop("watchtower", 28, 29);
  for (const [c, r] of [[20, 23], [33, 23], [23, 33], [31, 33], [26, 42]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[19, 28], [31, 21]] as const) prop("meat", c, r);
  for (const [c, r] of [[22, 28], [29, 22], [24, 46]] as const) prop("woodPile", c, r);
  // Troll's Hollow: skulls on the corners of its rim.
  for (const [c, r] of [[53, 7], [73, 7], [52, 23], [73, 23]] as const) prop("skullSpike", c, r);

  const districts: District[] = [
    // One wood floor, so district borders never cut the forest into patches; only raised ground changes colour,
    // following its cliffs. The Burn is scorched by its dead trees, its mound and the arena are ash.
    { name: "The Palisade", at: { col: 40, row: 61 }, levels: [1], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Old Pines", at: { col: 13, row: 50 }, levels: [1], palette: [3], dress: "emberwood", decor: 1.5 },
    { name: "Smoke Bluff", at: { col: 26, row: 41 }, levels: [2], palette: [1], dress: "emberwood", decor: 2 },
    { name: "Warren Hill", at: { col: 24, row: 17 }, levels: [2, 3], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Cinder Ford", at: { col: 46, row: 32 }, levels: [1], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Troll's Hollow", at: { col: 63, row: 19 }, levels: [2], palette: [1], dress: "barrowmoor", decor: 2 },
    { name: "The Burn", at: { col: 72, row: 54 }, levels: [1, 2], palette: [3, 1], dress: "greyfall", decor: 2 },
    { name: "Crag Foot", at: { col: 94, row: 22 }, levels: [1, 2, 3], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Postern Crag", at: { col: 60, row: 58 }, levels: [2, 3, 4], palette: [3], dress: "crags", decor: 1 },
  ];
  const rooms = districts.map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 40, row: 64 }], maze(t, rng, rooms));
  const exits: AreaExit[] = [
    { to: "harbour", name: "Ember Gate", kind: "gate", at: { col: 40, row: 70 }, opens: "emberGateOpen" },
    { to: "chapel", name: "The Postern", kind: "open", at: { col: 60, row: 57 }, plain: true },
    { to: "crags", name: "Crag Stair", kind: "open", at: { col: 126, row: 18 } },
  ];
  // Troll's Hollow is the troll's arena: a plateau ringed by cliffs, fog across every stair up onto it while he lives.
  const districtAt = districtGrid(tier, districts, t);
  const hollow = String(districts.findIndex((d) => d.name === "Troll's Hollow"));
  const gate = tier.island.rows.flatMap((l, r) => [...l].flatMap((ch, c) => ("<>".includes(ch) && [c - 1, c + 1].some((x) => districtAt[r]?.[x] === hollow) ? [{ col: c, row: r }] : [])));
  const arena = { boss: "troll", gate, inside: { col: 63, row: 14 } };
  return { ...tier, area: "emberwood", entry: { col: 40, row: 64 }, exits, districts, districtAt, decks, arena };
}

const MOUNTAIN = [4, 3, 2, 1, 1] as const;

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
  t.fences.push({ col: 59, row: 12, w: 6, h: 4 });
  for (const [c, r] of [[60, 13], [63, 14]] as const) prop("woodPile", c, r);
  prop("tools", 62, 13);
  who("gnome", 60, 14, { to: { col: 62, row: 14 } });

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
    { name: "Crag Gate", at: { col: 8, row: 48 }, palette: [4], dress: "crags", decor: 2 },
    { name: "Bamboo Grove", at: { col: 20, row: 22 }, palette: [4, 3, 2], dress: "emberwood", decor: 2, clearing: 7 },
    { name: "Tinker Town", at: { col: 48, row: 63 }, palette: [4, 3, 2], dress: "harbour", decor: 2, clearing: 9 },
    { name: "Foothills", at: { col: 82, row: 63 }, palette: [4], dress: "crags", decor: 2.5 },
    { name: "The Terraces", at: { col: 57, row: 73 }, levels: [2], palette: [1], dress: "harbour", decor: 1.5 },
    { name: "Windward Shore", at: { col: 104, row: 47 }, palette: [5], dress: "saltreach", decor: 2 },
  ];
  // The mountain stream: off the rock's west face, down past the bamboo to the sea, a footbridge where the north road crosses.
  river(t, [[45, 34], [38, 36], [30, 34], [22, 37], [12, 36], [2, 38]], 2);
  t.bridge({ col: 20, row: 33 }, { col: 20, row: 41 });
  // A tarn under the outcrops, and the gnomes' terraced plots on the southern spur, fenced, with their stock.
  lake(t, 14, 60, 3, 2);
  // The Terraces stand a step up off the spur, so their gold follows a cliff: as flat ground the colour met its neighbours in straight lines.
  t.shape(2, 57, 75, 9, 4, 0.4, "The Terraces");
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
  return { ...tier, area: "crags", entry: { col: 6, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks };
}

function greyfall(): AreaMap {
  const rng = makeRng("area:greyfall");
  const t = tierBuilder("surface", rng, { cols: 124, rows: 72 });
  const { prop, who } = t;
  const black = { color: "black" } as const;

  // The rot-marsh round the Citadel's rock, and the ashen ground before its gate.
  t.blob("greyfall", 62, 36, 58, 34);
  for (const [x, y, rx, ry] of [[24, 62, 18, 10], [96, 8, 20, 7], [92, 64, 22, 8]] as const) t.blob("greyfall", x, y, rx, ry);
  t.blob("greyfall", 11, 44, 12, 18);
  // The east coast: coves bitten out of it, sea stacks off it.
  lake(t, 114, 34, 6, 10);
  for (const [x, y, rx, ry] of [[118, 18, 4, 6], [118, 56, 4, 5], [112, 66, 4, 3]] as const) t.blob("greyfall", x, y, rx, ry);

  // Rotfield: a river of rot winding down the bailey into the Crater, a lake with a shrine on its isle.
  river(t, [[27, 14], [33, 24], [29, 34], [34, 44], [36, 50]], 3);
  lake(t, 37, 55, 9, 5);
  t.ground("greyfall", 35, 54, 5, 3);

  // The Citadel's crag, after Stormveil and Sellia: one great rock rising out of the rot in four ragged tiers,
  // the Lower City on its skirts, the High City, the Warlord's Hall, the Grey Keep on its crown. A spur runs west
  // from it as a ridge for the gnomes' Sky Bridge to land on.
  t.shape(2, 78, 33, 30, 24, 0.45, "The Lower City");
  t.shape(2, 42, 9, 18, 4, 0.35, "The Lower City");
  t.shape(3, 79, 28, 20, 15, 0.4, "The High City");
  t.shape(4, 79, 21, 11, 8, 0.35, "The Warlord's Hall");
  t.shape(5, 79, 15, 6, 3.5, 0.25, "The Grey Keep");
  // The Sky Bridge: the gnomes' high road from the west, landing on the spur.
  const decks = t.span(2, 1, 8, 36, 2);

  // Crags of the old rock, standing out of the rot.
  t.shape(2, 44, 28, 6, 4, 0.4, "Rotfield");
  t.shape(2, 15, 34, 5, 4, 0.4, "The Ashen Approach");

  // Roads: in at the Grey Gate over the rot, to the city's stairs and round to the Gallows; the causeway to the shrine.
  t.road([1, 44], [24, 44], [40, 44], [48, 41], [51, 41]);
  t.road([40, 44], [44, 50], [66, 52], [90, 52]);
  t.road([30, 44], [30, 20], [36, 16]);
  t.bridge({ col: 6, row: 44 }, { col: 1, row: 44 }, 3);
  t.bridge({ col: 31, row: 44 }, { col: 38, row: 44 }, 3);
  t.bridge({ col: 37, row: 49 }, { col: 37, row: 54 }, 2);


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

  // The Gallows Yard: gibbets in rows, the Warlord's barracks, and the Harbour's folk penned.
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
  t.fences.push({ col: 62, row: 30, w: 8, h: 5 });
  who("minotaurGuard", 64, 32, { to: { col: 67, row: 32 } });
  for (const [c, r] of [[56, 37], [62, 37]] as const) prop("house2", c, r, black);
  prop("meat", 64, 36);
  for (const [c, r] of [[55, 35], [60, 35]] as const) prop("bones", c, r);
  for (const [c, r] of [[61, 29], [70, 29], [61, 35], [70, 35]] as const) prop("skullSpike", c, r);
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

  // The Grey Keep: the black castle on the fourth height, the Warlord on the tier before it, his guard, guns on the tier.
  prop("castle", 78, 13, black);
  t.bosses.push({ name: "The Grey Warlord", area: "greyfall", col: 78, row: 18 });
  who("warrior", 78, 18, black);
  for (const [c, r] of [[75, 18], [81, 18]] as const) who("skullGuard", c, r);
  for (const [c, r] of [[72, 17], [84, 17], [73, 12], [84, 12]] as const) prop("skullSpike", c, r);
  for (const c of [70, 86]) prop("cannon", c, 21);

  const exits: AreaExit[] = [
    { to: "barrowmoor", name: "Grey Gate", kind: "locked", at: { col: 1, row: 44 } },
    { to: "crags", name: "Sky Bridge", kind: "high", at: { col: 1, row: 8 } },
    { to: "gilded", name: "Throne Stair", kind: "lift", at: { col: 81, row: 12 } },
  ];
  // The rock's tiers alternate stone colours so each step reads; the marsh below in its own.
  const districts: District[] = [
    { name: "The Grey Keep", at: { col: 79, row: 8 }, levels: [5], palette: [1], dress: "greyfall", decor: 1.5 },
    { name: "The Warlord's Hall", at: { col: 92, row: 22 }, levels: [4], palette: [2], dress: "greyfall", decor: 1.5 },
    { name: "The High City", at: { col: 64, row: 34 }, levels: [3], palette: [3], dress: "greyfall", decor: 2 },
    { name: "The Lower City", at: { col: 96, row: 48 }, levels: [2], palette: [5, 4], dress: "greyfall", decor: 2 },
    { name: "Rotfield", at: { col: 34, row: 30 }, levels: [1, 2], palette: [4, 3], dress: "greyfall", decor: 2.5 },
    { name: "The Crater", at: { col: 37, row: 62 }, levels: [1], palette: [5], dress: "barrowmoor", decor: 2 },
    { name: "Ruined Chapel", at: { col: 38, row: 18 }, levels: [1], palette: [5], dress: "barrowmoor", decor: 2 },
    { name: "Gallows Yard", at: { col: 70, row: 64 }, levels: [1], palette: [5], dress: "greyfall", decor: 2 },
    { name: "The Ashen Approach", at: { col: 12, row: 52 }, levels: [1, 2], palette: [5, 4], dress: "barrowmoor", decor: 2.5 },
  ];
  // A castle, not a maze: open courts and streets, only clumps of dead wood in the bailey and before the gate.
  for (const [x, y, rx, ry, d] of [[40, 30, 5, 7, 0.35], [10, 52, 6, 6, 0.3], [44, 18, 4, 3, 0.3], [92, 56, 7, 4, 0.3], [26, 46, 3, 4, 0.4]] as const) t.grove(x, y, rx, ry, d);
  const tier = t.finish({}, [{ col: 6, row: 44 }]);
  return { ...tier, area: "greyfall", entry: { col: 6, row: 44 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks };
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
  t.blob("gilded", 64, 34, 22, 17);
  t.blob("gilded", 70, 8, 11, 5);
  t.blob("gilded", 64, 61, 11, 6);
  // The Throne Isle: nothing but its black plaza, hung off the city's east end.
  t.blob("gilded", 98, 34, 8, 7);

  t.bridge({ col: 17, row: 36 }, { col: 23, row: 35 });
  t.bridge({ col: 32, row: 26 }, { col: 34, row: 16 });
  t.bridge({ col: 28, row: 43 }, { col: 26, row: 52 });
  t.bridge({ col: 42, row: 34 }, { col: 47, row: 34 });
  t.bridge({ col: 66, row: 19 }, { col: 68, row: 12 });
  t.bridge({ col: 64, row: 49 }, { col: 64, row: 56 });
  t.bridge({ col: 47, row: 10 }, { col: 60, row: 9 });
  t.bridge({ col: 6, row: 36 }, { col: 1, row: 36 }, 3);

  // The Sun Steps: the capital rises in three ragged tiers to the Sun Hall, each its own landform.
  t.shape(2, 64, 32, 16, 12, 0.4, "The Sun Steps");
  t.shape(3, 65, 29, 11, 8, 0.35, "The Sun Steps");
  t.shape(4, 65, 26, 6, 4, 0.3, "The Sun Steps");
  // The Throne Isle, raised to the lower city's height and reached only by the Gilded Span.
  t.shape(2, 98, 34, 7, 6, 0.3, "The Throne Isle");
  const decks = t.span(2, 79, 33, 13, 2);

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
  // The livestock pen at the market's edge: the city eats what it can keep on an isle.
  t.fences.push({ col: 28, row: 38, w: 5, h: 3 });
  for (const c of [29, 31]) who("sheep", c, 39);
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

  // The Gilded Gate, north: the yellow guard's garrison isle, its barracks and drill yard, off the city's ways.
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

  // The span's head: the guard hold the one way in from the Throne Isle, a tower either side, archers watching it.
  for (const [c, r] of [[83, 31], [81, 37]] as const) prop("tower", c, r, gold);
  for (const [c, r] of [[79, 32], [79, 35]] as const) who("archer", c, r, gold);
  who("lancer", 78, 34, { ...gold, to: { col: 75, row: 34 } });

  // The Throne Isle: black stone over the gold, imps round a seat the Warlord does not sit in.
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
    // All gold and sunlight: the city in fresh green climbing to gold, the market, gate and chapel gold; the gardens
    // green; only the Throne Isle dark.
    { name: "The Sun Steps", at: { col: 64, row: 48 }, levels: [1, 2, 3, 4], palette: [2, 1, 1, 1], dress: "gilded", decor: 2 },
    { name: "The Throne Isle", at: { col: 98, row: 43 }, levels: [1, 2], palette: [4], dress: "greyfall", decor: 2 },
    { name: "Cloud Landing", at: { col: 12, row: 40 }, palette: [2], dress: "gilded", clearing: 4 },
    { name: "The Gold Market", at: { col: 32, row: 34 }, palette: [1], dress: "gilded", clearing: 7 },
    { name: "The Bee Gardens", at: { col: 36, row: 10 }, palette: [2], dress: "emberwood", clearing: 5 },
    { name: "Gnome Landing", at: { col: 26, row: 63 }, palette: [2], dress: "crags", clearing: 5 },
    { name: "The Gilded Gate", at: { col: 70, row: 8 }, palette: [1], dress: "gilded", clearing: 5 },
    { name: "The Sun Chapel", at: { col: 64, row: 61 }, palette: [1], dress: "gilded", clearing: 5 },
  ];
  // A city, not a maze: open plazas, trees in avenues along its ways, and the Bee Gardens hanging thick.
  avenue(t, [[10, 36], [20, 36], [32, 35], [46, 34]]);
  avenue(t, [[52, 45], [78, 45]], 1, 3);
  t.grove(36, 9, 10, 5, 0.6);
  const tier = t.finish({}, [{ col: 6, row: 36 }]);
  return { ...tier, area: "gilded", entry: { col: 6, row: 36 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks };
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
  t.blob("steps", 80, 21, 11, 8);
  t.blob("steps", 58, 18, 11, 9);
  t.blob("steps", 58, 40, 11, 8);
  t.blob("steps", 36, 32, 10, 8);
  t.blob("steps", 14, 46, 9, 7);
  // Two side isles, dead ends off the way down: the hermit's rock, and a wreck of gold.
  t.blob("steps", 26, 10, 6, 5);
  t.blob("steps", 88, 54, 8, 6);

  // The Broken Stair rises in two ragged steps; the Windward Rest stands level with its top, the Old Span between.
  t.shape(2, 80, 20, 9, 6, 0.4, "The Broken Stair");
  t.shape(3, 79, 18, 5, 3, 0.3, "The Broken Stair");
  t.shape(2, 58, 17, 9, 7, 0.4, "Windward Rest");
  t.shape(3, 59, 16, 5, 3, 0.3, "Windward Rest");
  const decks = t.span(3, 63, 17, 13, 2);
  // The Bell Isle: a raised ruin on its own mound.
  t.shape(2, 36, 30, 6, 4, 0.35, "The Bell Isle");

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

  // Cloud Pier: where the rope bridge from the Gilded City lands; the guard's last post.
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

  // Watch Isle: the Watch Lift down to the Keep, chained from here.
  t.fires.push({ col: 12, row: 47 });
  prop("tower", 17, 43, blue);
  prop("house2", 9, 44, blue);
  who("archer", 16, 45, blue);
  who("lancer", 11, 49, { ...blue, to: { col: 18, row: 49 } });

  // The Hermit's Rock: an old monk who never went down, and what he kept.
  prop("house1", 26, 9, gold);
  prop("goldStone", 29, 12);
  who("monk", 24, 11, gold);

  // The Gold Wreck: a gnome barge that fell short of the isle and hangs off its edge in the sky, its timbers and gold
  // spilt across the rock, the imps picking it over.
  prop("boat", 97, 55, { scale: 1.6 });
  for (const [c, r] of [[86, 52], [90, 55], [84, 56], [92, 51], [93, 56]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[88, 53], [92, 54], [86, 57]] as const) prop("woodPile", c, r);
  crowd(t, rng, "imp", { col: 89, row: 55 }, 3, 3);

  const exits: AreaExit[] = [
    { to: "gilded", name: "Cloud Bridge", kind: "open", at: { col: 110, row: 16 } },
    { to: "keep", name: "Watch Lift", kind: "shortcut", at: { col: 14, row: 46 } },
  ];
  const districts: District[] = [
    // One colour an isle; the isles step from gold at the pier down to the Harbour's green.
    { name: "The Broken Stair", at: { col: 80, row: 30 }, levels: [1, 2, 3], palette: [4, 2, 1], dress: "crags", decor: 2.5 },
    { name: "Windward Rest", at: { col: 58, row: 8 }, levels: [1, 2, 3], palette: [3, 2, 1], dress: "gilded", decor: 2 },
    { name: "Cloud Pier", at: { col: 100, row: 21 }, levels: [1], palette: [3], dress: "gilded", decor: 2 },
    { name: "The Hanging Graves", at: { col: 58, row: 47 }, levels: [1], palette: [4], dress: "barrowmoor", decor: 2.5 },
    { name: "The Bell Isle", at: { col: 36, row: 39 }, levels: [1, 2], palette: [3], dress: "harbour", decor: 2 },
    { name: "Watch Isle", at: { col: 14, row: 52 }, levels: [1], palette: [2], dress: "harbour", decor: 2 },
    { name: "The Hermit's Rock", at: { col: 26, row: 14 }, levels: [1], palette: [2], dress: "gilded", decor: 2 },
    { name: "The Gold Wreck", at: { col: 88, row: 59 }, levels: [1], palette: [4], dress: "saltreach", decor: 2 },
  ];
  // Isles, not a maze: bare and wind-scoured, a lone tree here and there.
  const tier = t.finish({ steps: 0.04 }, [{ col: 104, row: 16 }]);
  return { ...tier, area: "steps", entry: { col: 104, row: 16 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks };
}

function undercroft(): AreaMap {
  const rng = makeRng("area:undercroft");
  const t = tierBuilder("below", rng, { cols: 104, rows: 80 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;
  const u = "undercroft";

  // The Harbour's catacombs are the one place underground that people built: square halls and straight corridors
  // laid out on a cross from the well, torches in brackets along the walls. Only the Dig, the tunnel east that nobody
  // admits to, is rough rock, so it reads as the thing that does not belong.
  const halls: [number, number, number, number][] = [[46, 8, 13, 11], [8, 8, 13, 9], [8, 32, 28, 16], [70, 12, 28, 20], [40, 40, 24, 16], [68, 50, 22, 16]];
  for (const [x, y, w, h] of halls) t.ground(u, x, y, w, h);
  const corridors: (readonly (readonly [number, number])[])[] = [
    [[52, 18], [52, 40]],
    [[14, 27], [74, 27]],
    [[14, 27], [14, 16]],
    [[24, 27], [24, 32]],
    [[86, 31], [86, 50]],
    [[63, 52], [68, 52]],
    [[20, 47], [20, 52], [40, 52]],
  ];
  for (const way of corridors) tunnel(t, way);
  /** Torches along a corridor, on its north or west edge, every few tiles. */
  const sconces = (way: readonly (readonly [number, number])[]): void => {
    for (let i = 1; i < way.length; i++) {
      const [[x0, y0], [x1, y1]] = [way[i - 1]!, way[i]!];
      const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let d = 3; d < len - 1; d += 6) {
        const [c, r] = [x0 + Math.sign(x1 - x0) * d, y0 + Math.sign(y1 - y0) * d];
        prop("sconce", y0 === y1 ? c : c - 1, y0 === y1 ? r - 1 : r);
      }
    }
  };
  for (const way of corridors) sconces(way);

  // The Cisterns: three straight channels across the hall, two walkways bridging them.
  for (const r of [35, 39, 43]) river(t, [[10, r], [33, r]], 2);
  for (const c of [16, 28]) t.bridge({ col: c, row: 33 }, { col: c, row: 46 });
  // The Spider Pillars: a hall of square pillars in two rows.
  for (const x of [75, 81, 87, 93]) for (const y of [16, 22]) t.pillar(x, y, 2, 2);
  // The Drowned Chapel: a square pool, the chapel on its platform, a causeway out from the spine.
  lake(t, 52, 48, 9, 5);
  t.ground(u, 49, 46, 7, 5);
  t.bridge({ col: 52, row: 41 }, { col: 52, row: 46 });
  // The Ossuary: two shelves of bone raised against its north wall.
  t.shape(2, 74, 54, 4, 2.5, 0.3, "The Ossuary");
  t.shape(2, 83, 54, 4, 2.5, 0.3, "The Ossuary");
  // The Dig: hacked out of the rock, ragged, off the Ossuary's corner.
  t.blob(u, 90, 72, 8, 5);
  passage(t, rng, u, [[84, 65], [86, 68], [88, 70]]);
  rubble(t, rng, 90, 72, 8, 5, 3);
  tunnel(t, [[96, 72], [102, 72]], 3);

  // The Well Bottom: where the rope comes down, a fire under the shaft of light, and what fell down the well.
  t.fires.push({ col: 52, row: 16 });
  for (const [c, r] of [[48, 10], [56, 10]] as const) prop("bones", c, r);
  prop("woodPile", 56, 17);
  who("rubberDuck", 49, 16);

  // The Cisterns: what lives in the black water, and the dead on the walkways.
  for (const r of [35, 39, 43]) who("bombFish", 12, r, { to: { col: 20, row: r } });
  who("turtle", 30, 39);
  crowd(t, rng, "skull", { col: 22, row: 37 }, 3, 2);
  for (const [c, r] of [[12, 37], [30, 41]] as const) prop("bones", c, r);
  t.fires.push({ col: 22, row: 46 });

  // Smugglers' Nook: a storeroom off the end of the gallery, the thieves' cache.
  for (const [c, r] of [[10, 10], [18, 10]] as const) prop("goldStone", c, r);
  prop("meat", 14, 14);
  crowd(t, rng, "thief", { col: 14, row: 12 }, 2, 2);

  // The Spider Pillars: webs between the pillars, what they caught, bats in the roof.
  crowd(t, rng, "spider", { col: 84, row: 20 }, 5, 6);
  for (const [c, r] of [[78, 19], [90, 25], [80, 29]] as const) prop("bones", c, r);
  who("bat", 88, 14);

  // The Drowned Chapel: a purple chapel under the Harbour's own streets, its priests walking the pool's edge.
  prop("monastery", 52, 49, purple);
  who("monk", 42, 42, { ...purple, to: { col: 62, row: 42 } });
  who("shaman", 60, 54);
  prop("goldStone", 44, 54);

  // The Ossuary: the Harbour's dead laid out in rows on the floor, skulls staked on the shelves, their warden.
  for (const [c, r] of [[72, 53], [76, 53], [81, 53], [85, 53]] as const) prop("skullSpike", c, r);
  for (const r of [59, 63]) for (const c of [71, 75, 79, 83, 87]) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 78, row: 61 }, 3, 3);
  who("skullGuard", 78, 57, { scale: 1.4 });
  t.fires.push({ col: 70, row: 56 });

  // The Dig: the tunnel east that nobody admits to, its diggers and their spoil.
  prop("cave", 88, 70);
  prop("woodPile", 94, 72);
  prop("tools", 86, 74);
  prop("goldStone", 92, 75);
  crowd(t, rng, "gnoll", { col: 90, row: 73 }, 3, 3);

  const exits: AreaExit[] = [{ to: "deeps", name: "Cistern Run", kind: "open", at: { col: 102, row: 72 } }];
  const districts: District[] = [
    { name: "The Well Bottom", at: { col: 52, row: 6 }, palette: [4], dress: "undercroft" },
    { name: "The Cisterns", at: { col: 22, row: 50 }, palette: [4], dress: "undercroft" },
    { name: "Smugglers' Nook", at: { col: 14, row: 6 }, palette: [4], dress: "undercroft" },
    { name: "The Spider Pillars", at: { col: 84, row: 10 }, palette: [4], dress: "undercroft" },
    { name: "The Drowned Chapel", at: { col: 52, row: 58 }, palette: [4], dress: "undercroft" },
    { name: "The Ossuary", at: { col: 78, row: 68 }, palette: [5], dress: "deeps" },
    { name: "The Dig", at: { col: 92, row: 79 }, palette: [5], dress: "undercroft" },
  ];
  const tier = stone(t.finish({}, [{ col: 52, row: 14 }]));
  return { ...tier, area: "undercroft", entry: { col: 52, row: 14 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
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
  for (const way of [
    [[16, 22], [24, 22], [34, 23]],
    [[52, 23], [60, 28], [66, 36]],
    [[38, 23], [32, 32], [26, 42]],
    [[18, 52], [10, 58], [8, 62]],
    [[66, 50], [64, 56], [62, 60]],
    [[26, 52], [30, 64], [34, 72]],
    [[58, 66], [50, 72], [46, 76]],
  ] as const) passage(t, rng, "deeps", way);
  tunnel(t, [[38, 86], [38, 94]]);

  // The Great Barrow: a tomb in two steps, the lift on its crown, a stair at each front corner of each.
  t.shape(2, 44, 16, 12, 6, 0.5, "The Great Barrow");
  t.shape(3, 46, 13, 6, 3, 0.4, "The Great Barrow");
  // The Drowned Graves' black pool; the Weaver's vault pillared with webbed rock; fallen rock elsewhere.
  lake(t, 29, 46, 6, 3);
  lake(t, 24, 49, 3, 2);
  // The Weaver's vault: webbed rock standing in a ragged ring round her.
  for (const [x, y, w, h] of [[29, 74, 2, 1], [36, 72, 1, 1], [45, 74, 2, 2], [27, 81, 1, 2], [48, 81, 2, 1], [33, 85, 1, 1], [43, 85, 2, 1]] as const) t.pillar(x, y, w, h);
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
  // The kings' graves in two ranks before the barrow, a stake at each head, facing the way down.
  for (const c of [32, 36, 40, 48, 52, 56]) for (const r of [22, 25]) prop("skullSpike", c, r);
  crowd(t, rng, "skull", { col: 44, row: 24 }, 3, 5);
  who("skullGuard", 34, 16);
  who("skullGuard", 53, 16, { flip: true });

  // The Ossuary Galleries: the common dead laid in rows down the gallery, a stake at the head of each row; their keepers.
  for (const [c, r] of [[63, 34], [69, 34], [63, 44], [69, 44]] as const) prop("skullSpike", c, r);
  for (const r of [36, 39, 42]) for (const c of [62, 65, 68, 71]) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 66, row: 41 }, 3, 3);
  who("skullGuard", 66, 46);

  // The Drowned Graves: the shrine on the shore, its graves running down into the water, snakes at the water's edge.
  prop("tower", 20, 44, purple);
  for (const [c, r] of [[30, 42], [33, 43], [34, 46], [33, 49]] as const) prop("skullSpike", c, r);
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
    { name: "Cistern Mouth", at: { col: 12, row: 29 }, palette: [4], dress: "undercroft" },
    { name: "The Great Barrow", at: { col: 44, row: 4 }, palette: [5, 4, 3], dress: "deeps" },
    { name: "Ossuary Galleries", at: { col: 66, row: 53 }, palette: [4], dress: "deeps" },
    { name: "The Drowned Graves", at: { col: 24, row: 56 }, palette: [4], dress: "deeps" },
    { name: "Robbers' Camp", at: { col: 8, row: 72 }, palette: [4], dress: "undercroft" },
    { name: "The Collapsed Hall", at: { col: 62, row: 71 }, palette: [5], dress: "deeps" },
    { name: "The Weaver's Web", at: { col: 38, row: 90 }, palette: [5], dress: "deeps" },
  ];
  const tier = stone(t.finish({}, [{ col: 12, row: 22 }]));
  return { ...tier, area: "deeps", entry: { col: 12, row: 22 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
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
  for (const [x, y] of [[32, 30], [72, 30], [36, 50], [68, 52], [80, 34], [44, 26], [64, 25], [28, 42], [82, 46], [46, 54], [62, 55]] as const) t.pillar(x, y, 1, 2);

  tunnel(t, [[50, 8], [50, 1]]);
  tunnel(t, [[50, 10], [52, 18]]);
  for (const way of [
    [[40, 18], [28, 24], [22, 32]],
    [[68, 18], [84, 16]],
    [[86, 20], [92, 30], [92, 40]],
    [[22, 44], [24, 54], [28, 62]],
  ] as const) passage(t, rng, "hollow", way);
  t.bridge({ col: 24, row: 40 }, { col: 50, row: 42 });
  t.bridge({ col: 90, row: 42 }, { col: 58, row: 42 });

  // The Shell Isle rises in one step, a stair at each front corner; the Shell Below sleeps on top.
  t.shape(2, 54, 39, 7, 3.5, 0.55, "The Shell Isle");

  // The Stair Foot: where the Sinking Stair comes down from the tombs; the last fire before the water.
  t.fires.push({ col: 52, row: 9 });
  prop("skullSpike", 47, 7);
  prop("skullSpike", 54, 7);

  // The North Shore: the long beach under the stair, the lake's turtles hauled out on it.
  for (const [c, r] of [[40, 18], [62, 19]] as const) who("turtle", c, r);
  prop("goldStone", 46, 16);
  prop("goldStone", 66, 17);

  // The Stone Grove: trees turned to stone, and what roots among them.
  for (const [c, r] of [[80, 13], [86, 12], [90, 16], [82, 19], [78, 17], [88, 20], [84, 11]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [x, y] of [[83, 15], [87, 17], [80, 20]] as const) t.pillar(x, y, 1, 1);
  who("lizard", 84, 16, { to: { col: 88, row: 18 } });
  prop("goldStone", 88, 19);

  // The West Shallows: no fire, only the gold glowing in the rock and the water, snakes at the edge.
  for (const [c, r] of [[18, 30], [20, 42], [16, 36], [24, 46], [20, 33]] as const) prop("goldStone", c, r);
  who("snake", 24, 34);

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
    { name: "Pilgrims' Rest", at: { col: 92, row: 52 }, palette: [4], dress: "hollow" },
    { name: "Sinkhole Landing", at: { col: 42, row: 62 }, palette: [4, 5], dress: "undercroft" },
    { name: "The Shell Isle", at: { col: 54, row: 49 }, palette: [5, 3], dress: "hollow", box: { x: 44, y: 34, w: 21, h: 13 } },
  ];
  const tier = stone(t.finish({}, [{ col: 50, row: 8 }]));
  return { ...tier, area: "hollow", entry: { col: 50, row: 8 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
}

function barrowmoor(): AreaMap {
  const rng = makeRng("area:barrowmoor");
  const t = tierBuilder("surface", rng, { cols: 120, rows: 80 });
  const { prop, who } = t;
  const black = { color: "black" } as const;

  // The old kings' moor, walled by dead thickets into clearings about a screen across, each its own place,
  // joined by lanes with loops; only the barrows rise out of it.
  for (const [x, y, rx, ry] of [[60, 40, 56, 34], [14, 40, 12, 12], [108, 36, 11, 12], [60, 72, 14, 8]] as const) t.blob("barrowmoor", x, y, rx, ry);
  // Each clearing's centre and half-size, with thicket at least four tiles thick between them.
  const rooms = [
    [12, 40, 6, 6], // the Moor Gate
    [30, 44, 5, 4], // the Wayshrine
    [26, 20, 10, 7], // Barrow Field
    [34, 57, 6, 5], // Gibbet Hill
    [56, 61, 7, 5], // the Burned Hamlet
    [58, 42, 6, 5], // the Mourners' Way
    [62, 18, 13, 9], // the King's Barrow
    [92, 18, 8, 6], // the Diggings
    [88, 40, 7, 5], // the Troll's Grave
    [82, 59, 8, 6], // the Dead Mere
    [110, 36, 5, 5], // the Grey Road
    [62, 72, 6, 3], // the Fen Path
  ] as const;
  const ragged = noise("barrowmoor:rooms", 3);
  const open = (c: number, r: number): boolean => rooms.some(([x, y, rx, ry]) => ((c - x) / rx) ** 2 + ((r - y) / ry) ** 2 < 1 + ragged(c, r) * 0.3);

  // The barrows: lesser mounds in Barrow Field, Gibbet Hill, and the King's Barrow two steps up.
  for (const [x, y] of [[20, 16], [30, 15], [21, 24], [32, 24]] as const) t.shape(2, x, y, 3, 2, 0.35, "Barrow Field");
  t.shape(2, 31, 58, 4, 2.5, 0.4, "Gibbet Hill");
  t.shape(2, 62, 18, 8, 5, 0.4, "The King's Barrow");
  t.shape(3, 62, 16, 4, 2.5, 0.3, "The King's Barrow");
  lake(t, 82, 60, 5, 3);
  lake(t, 66, 72, 2.5, 1.5);

  // The lanes, stopping at a clearing's edge where it holds a barrow or water.
  t.road([1, 40], [6, 40], [12, 40], [20, 43], [30, 44]);
  t.road([30, 44], [30, 36], [28, 28], [26, 20]);
  t.road([30, 44], [32, 50], [33, 53]);
  t.road([30, 44], [42, 41], [50, 43], [58, 42]);
  t.road([26, 20], [38, 18], [51, 18]);
  t.road([58, 42], [60, 34], [62, 27]);
  t.road([58, 42], [56, 50], [56, 61]);
  t.road([38, 58], [44, 60], [56, 61]);
  t.road([56, 61], [58, 66], [60, 70], [60, 78]);
  t.road([56, 61], [66, 62], [74, 61]);
  t.road([58, 42], [68, 38], [76, 41], [88, 40]);
  t.road([73, 14], [82, 16], [92, 18]);
  t.road([92, 18], [94, 28], [88, 40]);
  t.road([88, 40], [98, 38], [110, 36], [118, 36]);
  t.road([84, 55], [88, 48], [88, 40]);
  t.bridge({ col: 6, row: 40 }, { col: 1, row: 40 }, 3);
  t.bridge({ col: 112, row: 36 }, { col: 118, row: 36 }, 3);
  t.bridge({ col: 60, row: 74 }, { col: 60, row: 78 }, 3);

  // The Moor Gate: the Harbour's barred gate, a watch fire, a blue lancer pacing.
  t.fires.push({ col: 10, row: 43 });
  prop("tower", 9, 36, { color: "blue" });
  t.fences.push({ col: 14, row: 36, w: 4, h: 2 });
  who("lancer", 13, 38, { color: "blue", to: { col: 16, row: 42 } });

  // The Wayshrine: the first fire past the gate, at the crossroads, bones round it.
  t.fires.push({ col: 31, row: 46 });
  for (const [c, r] of [[26, 42], [34, 42], [27, 47]] as const) prop("bones", c, r);
  prop("deadTree", 34, 46, { scale: 0.9 });

  // Barrow Field: skulls staked on every mound, the dead raised round them.
  for (const [c, r] of [[20, 16], [30, 15], [21, 24], [32, 24]] as const) {
    for (const dc of [-2, 2]) prop("skullSpike", c + dc, r - 1);
    prop("bones", c, r);
  }
  crowd(t, rng, "skull", { col: 26, row: 19 }, 4, 3);
  who("skullGuard", 29, 21);

  // Gibbet Hill: the hanging mound, its gallows trees, the gnolls that pick at it.
  for (const [c, r] of [[29, 58], [33, 58]] as const) prop("deadTree", c, r, { scale: 0.9 });
  for (const [c, r] of [[28, 60], [34, 60]] as const) prop("skullSpike", c, r);
  crowd(t, rng, "gnoll", { col: 38, row: 55 }, 3, 2);
  for (const [c, r] of [[37, 60], [36, 53]] as const) prop("bones", c, r);

  // The Burned Hamlet: the moor's last village, black with old fire, the dead at its doors.
  for (const [c, r, art] of [[50, 58, "house1"], [58, 57, "house2"], [61, 61, "house3"], [52, 64, "house2"]] as const) prop(art, c, r, black);
  for (const [c, r] of [[56, 64], [50, 61]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[59, 64], [54, 56]] as const) prop("stump", c, r);
  for (const [c, r] of [[56, 60], [51, 62]] as const) who("skull", c, r, { to: { col: c + 2, row: r } });

  // The Mourners' Way: an avenue of skulls up to the King's Barrow, a fire where the mourners stopped.
  for (const r of [38, 46]) for (const c of [55, 61]) prop("skullSpike", c, r);
  t.fires.push({ col: 62, row: 43 });
  who("bat", 54, 41);

  // The King's Barrow: the dead kings' guard round its steps, the Barrow King on its crown, the cave at its foot.
  for (const [c, r] of [[52, 15], [72, 15], [54, 24], [70, 24]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[58, 14], [66, 14], [62, 21]] as const) prop("bones", c, r);
  t.bosses.push({ name: "The Barrow King", area: "barrowmoor", col: 62, row: 15 });
  who("minotaurGuard", 62, 15, { scale: 1.6 });
  for (const [c, r] of [[52, 20], [72, 20]] as const) who("skullGuard", c, r);
  prop("cave", 62, 25);
  t.fires.push({ col: 67, row: 26 });

  // The Diggings: grave-robbers dug in by the barrow, their spoil and their tools.
  t.fires.push({ col: 92, row: 19 });
  for (const [c, r] of [[88, 16], [96, 16]] as const) prop("woodPile", c, r);
  prop("tools", 89, 21);
  for (const [c, r] of [[95, 21], [97, 19], [86, 19]] as const) prop("goldStone", c, r);
  who("thief", 90, 18, { to: { col: 94, row: 20 } });
  who("thief", 95, 15);

  // The Troll's Grave: a troll the dead brought down, its bones picked, the dead still round it.
  prop("trollDead", 88, 39);
  for (const [c, r] of [[83, 38], [93, 42], [85, 43], [92, 37]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 90, row: 43 }, 4, 2);
  who("skullGuard", 84, 41);

  // The Dead Mere: mist on the sunk water, a drowned watch, things in the reeds.
  prop("watchtower", 75, 55);
  for (const [c, r] of [[75, 62], [89, 59]] as const) who("lizard", c, r, { to: { col: c + 2, row: r } });
  who("bombFish", 82, 60, { to: { col: 85, row: 60 } });

  // The Grey Road: skulls staked along it, the Warlord's outpost before his gate.
  for (const c of [106, 110, 114]) for (const r of [33, 39]) prop("skullSpike", c, r);
  prop("tower", 107, 31, black);
  crowd(t, rng, "warrior", { col: 111, row: 36 }, 3, 2, black);
  who("lancer", 105, 37, { ...black, to: { col: 114, row: 37 } });

  // The Fen Path: duckboards down to the reeds, a fire at the top of them.
  t.fires.push({ col: 58, row: 71 });
  who("lizard", 58, 74, { to: { col: 63, row: 74 } });
  who("snake", 63, 70);

  const exits: AreaExit[] = [
    { to: "harbour", name: "Moor Gate", kind: "shortcut", at: { col: 1, row: 40 } },
    { to: "greyfall", name: "Grey Gate", kind: "locked", at: { col: 118, row: 36 } },
    { to: "fen", name: "Barrow Path", kind: "open", at: { col: 60, row: 78 } },
    { to: "deeps", name: "Barrow Cave", kind: "lift", at: { col: 62, row: 26 } },
  ];
  // One colour a clearing, olive or green, never teal (it reads as water); the barrows a shade up.
  const districts: District[] = [
    { name: "The Moor Gate", at: { col: 12, row: 40 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Wayshrine", at: { col: 30, row: 42 }, levels: [1], palette: [4], dress: "barrowmoor", decor: 2 },
    { name: "Barrow Field", at: { col: 26, row: 19 }, levels: [1, 2], palette: [4], dress: "barrowmoor", decor: 2 },
    { name: "Gibbet Hill", at: { col: 35, row: 54 }, levels: [1, 2], palette: [4], dress: "greyfall", decor: 2 },
    { name: "The Burned Hamlet", at: { col: 56, row: 60 }, levels: [1], palette: [3], dress: "greyfall", decor: 1.5 },
    { name: "The Mourners' Way", at: { col: 58, row: 41 }, levels: [1], palette: [4], dress: "barrowmoor", decor: 2.5 },
    { name: "The King's Barrow", at: { col: 62, row: 10 }, levels: [1, 2, 3], palette: [3], dress: "barrowmoor", decor: 1.5 },
    { name: "The Diggings", at: { col: 92, row: 14 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Troll's Grave", at: { col: 88, row: 36 }, levels: [1], palette: [4], dress: "barrowmoor", decor: 2.5 },
    { name: "The Dead Mere", at: { col: 82, row: 54 }, levels: [1], palette: [4], dress: "fen", decor: 2 },
    { name: "The Grey Road", at: { col: 110, row: 41 }, levels: [1], palette: [4], dress: "greyfall", decor: 2 },
    { name: "The Fen Path", at: { col: 62, row: 70 }, levels: [1], palette: [3], dress: "fen", decor: 2 },
  ];
  const tier = t.finish({}, [{ col: 6, row: 40 }], open);
  return { ...tier, area: "barrowmoor", entry: { col: 6, row: 40 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
}

function fen(): AreaMap {
  const rng = makeRng("area:fen");
  const t = tierBuilder("surface", rng, { cols: 92, rows: 62 });
  const { prop, who } = t;
  const purple = { color: "purple" } as const;
  const yellow = { color: "yellow" } as const;

  // A spiral, unlike any other area: one narrow causeway of reed coiling inward through the black water,
  // two full turns, to the Chapel Mound and the sinkhole at its heart. In at the west, the moor's path off the north.
  const [cx, cy] = [46, 31];
  const coil: { c: number; r: number; a: number }[] = [];
  for (let a = Math.PI; a <= 4.3 * Math.PI; a += 0.05) {
    const rad = 30 - 2 * (a - Math.PI);
    coil.push({ c: cx + rad * Math.cos(a), r: cy + 0.72 * rad * Math.sin(a), a });
  }
  for (const p of coil) t.blob("fen", Math.round(p.c), Math.round(p.r), 4, 3);
  t.blob("fen", cx, cy, 8, 6);
  /** A point on the coil, `turns` of a turn past its outer end. */
  const on = (turns: number): Cell => {
    const p = coil[Math.min(coil.length - 1, Math.round((turns * 2 * Math.PI) / 0.05))]!;
    return { col: Math.round(p.c), row: Math.round(p.r) };
  };

  // The ways out, both off the lowest tier: the shingle causeway west to Saltreach, the duckboards north to the moor.
  const moor = on(0.17);
  t.bridge({ col: 14, row: cy }, { col: 1, row: cy }, 3);
  t.bridge({ col: moor.col, row: moor.row - 2 }, { col: moor.col, row: 1 }, 3);

  // The coil climbs a tier a district, each tier its own landform. A tier ends where the coil runs east-west,
  // the only place a stair can stand, and its first two columns are cut back off the coil's lower edge so
  // the stair up has lower ground above and below it.
  const near = (c: number, r: number) => {
    let best = coil[0]!;
    for (const p of coil) if ((p.c - c) ** 2 + (p.r - r) ** 2 < (best.c - c) ** 2 + (best.r - r) ** 2) best = p;
    return best;
  };
  const steps = [
    { k: 1, a: 1.5 * Math.PI, east: true },
    { k: 2, a: 2.5 * Math.PI, east: false },
    { k: 3, a: 3.5 * Math.PI, east: true },
  ];
  const heart = (c: number, r: number) => Math.hypot(c - cx, (r - cy) * 1.3) < 9;
  /** The tier a tile of the coil belongs to, 0 to 3; the mound on the heart is the fifth height. */
  const tierAt = (c: number, r: number): number => {
    if (heart(c, r)) return 3;
    for (const st of steps) {
      const p = coil.find((q) => q.a >= st.a)!;
      if (Math.hypot(c - p.c, r - p.r) > 7) continue;
      const b = Math.round(p.c);
      const high = st.east ? c >= b : c < b;
      if (!high) return st.k - 1;
      // The notch: the higher tier's first two columns give everything below the coil's centre line to the
      // tier below, a straight cut, as the coil's ragged edge would leave the stair standing over water.
      const lip = st.east ? c - b < 2 : b - 1 - c < 2;
      return lip && r > p.r ? st.k - 1 : st.k;
    }
    const a = near(c, r).a;
    return a < 1.5 * Math.PI ? 0 : a < 2.5 * Math.PI ? 1 : a < 3.5 * Math.PI ? 2 : 3;
  };
  const tierNames = ["Causeway Landing", "Eel Shallows", "The Drowned Village", "Lizard Warren"];
  for (let k = 1; k <= 3; k++) {
    const keys = new Set<string>();
    t.grid.forEach((line, r) => line.forEach((ch, c) => ch !== "~" && tierAt(c, r) >= k && keys.add(`${c},${r}`)));
    t.shapes.push({ level: k + 1, keys, owner: tierNames[k] });
  }
  // The Chapel Mound: the fifth height on the heart, the chapel on top, the sinkhole at its foot.
  t.shape(5, cx, cy - 1, 5, 3, 0.2, "The Chapel Mound");

  /**
   * A spot on the causeway: `turns` along the coil from its outer end, `along` tiles further on the way in, `out`
   * tiles toward the water outside the turn (negative: toward the inner side). Huts stand on the water side, boats
   * just off it, so each thing sits where the fen's folk would put it.
   */
  const spot = (turns: number, along = 0, out = 0): [number, number] => {
    const p = coil[Math.min(coil.length - 1, Math.round((turns * 2 * Math.PI) / 0.05))]!;
    const [nx, ny] = [Math.cos(p.a), 0.72 * Math.sin(p.a)];
    const [tx, ty] = [-Math.sin(p.a), 0.72 * Math.cos(p.a)];
    const [nl, tl] = [Math.hypot(nx, ny), Math.hypot(tx, ty)];
    return [Math.round(p.c + (tx / tl) * along + (nx / nl) * out), Math.round(p.r + (ty / tl) * along + (ny / nl) * out)];
  };
  const to = (c: [number, number]): Cell => ({ col: c[0], row: c[1] });

  // The fen's story runs inward along the causeway, from the living to the cult at its heart:
  // the militia's landing, the moor's dead buried at the Barrow Rise, the fishers of Eel Shallows, the village the
  // water took, the lizard-folk who guard the way, and the chapel praying to the grey over the sinkhole.

  // Reed along the coil's outer edge where no one lives, and closing over the drowned village's end.
  for (const turns of [0.13, 0.28, 0.72, 1.06, 1.12, 1.18, 1.66]) {
    const [c, r] = spot(turns, 0, 2);
    t.grove(c, r, 3, 2, 0.4);
  }

  // Causeway Landing: Saltreach's militia holds the last dry ground where the shingle spit comes in. Their tower,
  // the fire they sit at, and a jetty on the water side: a fish hut, its boat moored below, the catch and the firewood.
  const landing = on(0.05);
  prop("tower", landing.col + 1, landing.row - 3, yellow);
  t.fires.push({ col: landing.col + 2, row: landing.row + 1 });
  who("lancer", 10, cy, { ...yellow, to: { col: 18, row: cy } });
  prop("fishHut", ...spot(0.09, 0, 2));
  prop("boat", ...spot(0.09, 0, 6), {});
  prop("meat", ...spot(0.09, -2, 1));
  prop("woodPile", ...spot(0.09, 2, 0));
  who("pawn", ...spot(0.09, 0, 0), { ...yellow, act: "knife" });

  // The Barrow Rise: the moor's dead come down the Barrow Path, so the fen buries them here beside it, in a graveyard
  // laid out in rows: a stake for each grave, bones turned up between them, dead trees at its corners, the dead
  // risen and walking it.
  for (const along of [-2, 0, 2]) for (const out of [-2, 1]) prop("skullSpike", ...spot(0.2, along, out));
  for (const along of [-1, 1]) prop("bones", ...spot(0.2, along, -0.5));
  for (const along of [-4, 4]) prop("deadTree", ...spot(0.2, along, -1), { scale: 0.6 });
  who("skull", ...spot(0.2, -3, 2), { to: to(spot(0.2, 3, 2)) });
  who("skull", ...spot(0.2, 3, -2.5));

  // Eel Shallows: the fishers' stilt village along the outer turn's water side. Each hut has its boat moored off it
  // and its catch beside it; the village shares one fire and one woodpile at its middle, where the fishers gather.
  for (const turns of [0.38, 0.45, 0.55, 0.62]) {
    prop("fishHut", ...spot(turns, 0, 2));
    prop("boat", ...spot(turns, 0, 6), {});
    prop("meat", ...spot(turns, 2, 0));
  }
  t.fires.push(to(spot(0.5, 0, -1)));
  prop("woodPile", ...spot(0.5, 2, -2));
  for (const turns of [0.4, 0.6]) who("pawn", ...spot(turns, 0, 0), { ...yellow, act: "knife" });
  who("pawn", ...spot(0.5, -2, -1), { ...yellow, act: "wood", to: to(spot(0.5, 1, -2)) });
  who("bombFish", ...spot(0.5, 0, 7), { to: to(spot(0.55, 0, 7)) });
  who("turtle", ...spot(0.45, 0, 4));

  // The Drowned Village: the fen's old village, left as the water rose. Its houses still line both sides of the old
  // street, no fire lit, the drowned walking the lane; at its far end the reed has closed over it, snakes in the reed.
  for (const [turns, out, art] of [[0.82, 2, "house1"], [0.86, -2, "house2"], [0.9, 2, "house3"], [0.94, -2, "house1"], [0.98, 2, "house2"]] as const) prop(art, ...spot(turns, 0, out), purple);
  for (const turns of [0.84, 0.96]) prop("deadTree", ...spot(turns, 0, -3.5), { scale: 0.6 });
  prop("bones", ...spot(0.92, 0, 0));
  who("skull", ...spot(0.83, 0, 0), { to: to(spot(0.97, 0, 0)) });
  who("skull", ...spot(0.9, 2, 0));
  for (const turns of [1.08, 1.16]) who("snake", ...spot(turns, 0, -1));

  // Lizard Warren: the lizard-folk guard the last turn for the chapel. A line of stakes at the top of the stair
  // warns the way off; past it their huts ring a fire, the kills and the bones round it, the shaman at its side.
  for (const out of [-2.5, 2.5]) prop("skullSpike", ...spot(1.3, 0, out));
  const hearth = spot(1.47, 0, 0);
  t.fires.push(to(hearth));
  for (const [along, out] of [[-5, 2], [-3, -2.5], [3, -2.5], [5, 2], [0, 3]] as const) prop("goblinHut", ...spot(1.47, along, out));
  for (const [along, out] of [[-1, 1], [1, 1]] as const) prop("meat", ...spot(1.47, along, out));
  for (const [along, out] of [[-2, -1], [2, -1]] as const) prop("bones", ...spot(1.47, along, out));
  who("shaman", ...spot(1.47, 1, 0));
  crowd(t, rng, "lizard", to(spot(1.47, 0, 0)), 3, 3);
  for (const out of [-1.5, 1.5]) who("lizard", ...spot(1.32, 0, out));
  who("monk", ...spot(1.6, 0, 0), { ...purple, to: to(spot(1.66, 0, 0)) });

  // The Chapel Mound: the purple chapel on its crown prays to the grey over the sinkhole at its foot. A ring of stakes
  // round the sinkhole, offerings of bones at its rim, the cult's houses facing it, monks between, a guard on the stair.
  prop("monastery", cx, cy - 2, purple);
  t.fires.push({ col: cx - 4, row: cy + 3 });
  for (const [dc, dr] of [[-3, 3], [3, 3], [-3, 6], [3, 6]] as const) prop("skullSpike", cx + dc, cy + dr);
  for (const dc of [-1, 1]) prop("bones", cx + dc, cy + 6);
  for (const [dc, dr, art] of [[-7, 3, "house2"], [7, 3, "house3"]] as const) prop(art, cx + dc, cy + dr, purple);
  crowd(t, rng, "monk", { col: cx, row: cy + 2 }, 2, 1, purple);
  who("monk", cx - 5, cy + 5, { ...purple, to: { col: cx + 5, row: cy + 5 } });
  who("skullGuard", cx + 4, cy + 1);

  // The black water: sharks keep to the deep channels between the turns, out of the fishers' shallows.
  for (const turns of [0.85, 1.35]) who("harpoonShark", ...spot(turns, 0, -6), { to: to(spot(turns + 0.05, 0, -6)) });

  const exits: AreaExit[] = [
    { to: "saltreach", name: "Fen Causeway", kind: "open", at: { col: 1, row: cy } },
    { to: "barrowmoor", name: "Barrow Path", kind: "open", at: { col: moor.col, row: 1 } },
    { to: "hollow", name: "Fen Sinkhole", kind: "drop", at: { col: cx, row: cy + 4 } },
  ];
  // Lighter as it climbs: the tileset's teal, olive, green, fresh green and gold, darkest to lightest.
  const districts: District[] = [
    { name: "Causeway Landing", at: on(0.08), palette: [5], dress: "saltreach", decor: 2.5 },
    { name: "Eel Shallows", at: on(0.5), palette: [4], dress: "fen", decor: 2.5 },
    { name: "The Drowned Village", at: on(1.0), palette: [3], dress: "fen", decor: 2.5 },
    { name: "Lizard Warren", at: on(1.45), palette: [2], dress: "fen", decor: 2.5 },
    { name: "The Chapel Mound", at: { col: cx, row: cy + 6 }, palette: [2], dress: "fen", decor: 1.5 },
  ];
  const tier = t.finish({}, [{ col: 6, row: cy }]);
  // Colour follows the tiers: each district one height of the climb.
  const districtAt = tier.areaAt.map((line, r) =>
    [...line].map((ch, c) => (ch === "-" ? "-" : "5()".includes(tier.island.rows[r]![c]!) || (heart(c, r) && Math.hypot(c - cx, (r - cy + 1) * 1.6) < 6) ? "4" : String(tierAt(c, r)))).join(""),
  );
  return { ...tier, area: "fen", entry: { col: 6, row: cy }, exits, districts, districtAt, decks: [] };
}

function saltreach(): AreaMap {
  const rng = makeRng("area:saltreach");
  const t = tierBuilder("surface", rng, { cols: 92, rows: 60 });
  const { prop, who } = t;
  const yellow = { color: "yellow" } as const;

  // A stilt town over the shallows, unlike any other area: no land to speak of, only timber platforms on piles,
  // each a room of its own, knotted together by boardwalks into a web of short ways and loops.
  const P = {
    landing: [80, 14, 6, 4],
    market: [66, 8, 5, 3],
    saltworks: [68, 26, 8, 5],
    lofts: [52, 16, 4, 3],
    village: [46, 32, 7, 5],
    gull: [30, 20, 4, 3],
    fort: [22, 43, 11, 7],
    cove: [10, 28, 5, 4],
    light: [13, 11, 8, 6],
    steps: [40, 48, 5, 3],
    spit: [58, 48, 6, 4],
    pens: [78, 40, 5, 3],
  } as const;
  for (const [x, y, rx, ry] of Object.values(P)) t.blob("saltreach", x, y, rx, ry);
  // The story the boardwalks tell. Saltreach lives off the sea and sells to the Harbour: the catch and the salt go
  // out over the Old Bridge, so the market and the saltworks crowd the landing. The fishers live at the heart, where
  // every walk meets. Pirates hold the far west; the militia hold the line against them, just: their fort faces the
  // cove, a watch on Gull Rock looks down on it, and the cove is joined to the town by one plank walk off that rock,
  // nothing else. The smugglers who deal with the pirates keep a hidden landing under the village with no way on.
  const walk = (a: keyof typeof P, b: keyof typeof P) => t.bridge({ col: P[a][0], row: P[a][1] }, { col: P[b][0], row: P[b][1] });
  for (const [a, b] of [["landing", "market"], ["landing", "saltworks"], ["market", "lofts"], ["saltworks", "lofts"], ["lofts", "gull"], ["lofts", "village"], ["saltworks", "pens"], ["pens", "spit"], ["village", "spit"], ["village", "steps"], ["gull", "light"], ["gull", "cove"]] as const) walk(a, b);
  // The fort's walk lands at its east foot, so it never cuts through the piled rock.
  t.bridge({ col: 46, row: 34 }, { col: 29, row: 45 });
  t.bridge({ col: 84, row: 14 }, { col: 90, row: 14 }, 3);
  t.bridge({ col: 58, row: 50 }, { col: 58, row: 58 }, 3);

  // The raised rooms: the militia's fort on its piled rock, the lighthouse on its crag.
  // Each lower tier stands well out round the one above, so a stair off the top lands on open ground with room to
  // walk, never on a sliver straight over the next stair down.
  t.shape(2, 22, 42, 8.5, 5, 0.3, "The Militia Fort");
  t.shape(3, 22, 40, 4, 2.6, 0.25, "The Militia Fort");
  t.shape(2, 13, 10, 6.5, 4.2, 0.3, "Lighthouse Rock");
  t.shape(3, 12, 8, 2.5, 1.6, 0.25, "Lighthouse Rock");

  // Old Bridge Landing: the toll post where the Harbour's road comes in, the carts loading the town's goods for it.
  prop("tower", 84, 11, yellow);
  prop("house1", 77, 12, yellow);
  t.fires.push({ col: 80, row: 15 });
  for (const [c, r, art] of [[76, 15, "meat"], [78, 17, "woodPile"]] as const) prop(art, c, r);
  who("lancer", 82, 14, { ...yellow, to: { col: 88, row: 14 } });
  who("pawn", 66, 10, { ...yellow, act: "meat", to: { col: 77, row: 15 } });

  // The Fish Market: on the platform nearest the landing, the boats in against its edge to sell, the catch on display.
  prop("fishHut", 66, 7);
  for (const [c, r] of [[62, 9], [65, 10], [68, 10], [70, 9]] as const) prop("meat", c, r);
  crowd(t, rng, "pawn", { col: 66, row: 9 }, 3, 2, { ...yellow, act: "knife" });
  for (const [c, r] of [[60, 5], [72, 5]] as const) prop("boat", c, r, { flip: c > 66 });

  // The Saltworks: two fenced salt pans, each a shallow pond of seawater left to dry, fuel stacked for boiling,
  // the salt carried to the landing.
  t.fences.push({ col: 63, row: 24, w: 4, h: 3 }, { col: 69, row: 24, w: 4, h: 3 });
  for (const c of [64, 70]) t.pond(c, 25, 2, 1);
  for (const [c, r] of [[64, 28], [72, 28]] as const) prop("woodPile", c, r);
  crowd(t, rng, "pawn", { col: 68, row: 28 }, 2, 2, { ...yellow, act: "axe" });
  who("pawn", 68, 23, { ...yellow, act: "gold", to: { col: 79, row: 16 } });

  // The Net Lofts: the boatwrights' platform, where every walk crosses: a hull on the slip, timber, tools.
  prop("house3", 52, 15, yellow);
  for (const [c, r, art] of [[49, 17, "woodPile"], [55, 18, "tools"]] as const) prop(art, c, r);
  prop("boat", 57, 16, {});
  who("pawn", 54, 17, { ...yellow, act: "hammer" });

  // Netmakers' Village: the fishers' homes crowded round the fire at the heart of the town, the day's catch drying.
  for (const [c, r, art] of [[42, 30, "house1"], [48, 29, "house2"], [52, 32, "house3"], [42, 35, "house2"], [50, 35, "house1"]] as const) prop(art, c, r, yellow);
  t.fires.push({ col: 46, row: 33 });
  for (const [c, r] of [[44, 31], [49, 32]] as const) prop("meat", c, r);
  crowd(t, rng, "pawn", { col: 46, row: 32 }, 4, 3, { ...yellow, act: "knife" });
  who("monk", 44, 33, yellow);
  for (const [c, r] of [[38, 33], [54, 30]] as const) prop("boat", c, r, { flip: c > 46 });

  // Gull Rock: the militia's watch over the cove, the one walk to it running off its west side.
  prop("watchtower", 30, 18);
  who("archer", 28, 21, { ...yellow, to: { col: 32, row: 21 } });
  prop("bones", 33, 20);

  // Pirate Cove: the pirates' shacks, their tower standing in the water, their stolen haul and the boats they took it in.
  prop("pirateTowerWater", 4, 34);
  for (const [c, r] of [[8, 26], [12, 26]] as const) prop("house1", c, r, { color: "black" });
  for (const [c, r] of [[9, 30], [13, 29]] as const) prop("goldStone", c, r);
  crowd(t, rng, "thief", { col: 10, row: 29 }, 3, 2);
  for (const [c, r] of [[3, 27], [6, 33]] as const) prop("boat", c, r, {});

  // Lighthouse Rock: the light on its crag at the town's north-west corner, warning ships off the pirates' water.
  prop("tower", 12, 7, yellow);
  t.fires.push({ col: 14, row: 10 });
  who("monk", 10, 11, yellow);

  // The Militia Fort: the barracks on the piled rock, its guns turned west to the cove, the garrison drilling.
  prop("barracks", 23, 40, yellow);
  // A battery on the lower tier's west ledge toward the cove, three tiles apart, clear of the stairs' landings.
  for (const [c, r] of [[14, 40], [14, 43]] as const) prop("cannon", c, r, { flip: true });
  crowd(t, rng, "warrior", { col: 24, row: 45 }, 3, 2, yellow);
  who("archer", 16, 45, { ...yellow, to: { col: 28, row: 45 } });

  // Smugglers' Steps: a low landing under the village, no way on but the water: crates, a lookout, a boat waiting.
  for (const [c, r] of [[37, 48], [39, 50]] as const) prop("woodPile", c, r);
  prop("goldStone", 43, 50);
  who("thief", 41, 48, { to: { col: 43, row: 48 } });
  prop("boat", 34, 50, {});

  // The Shingle Spit: the way out to the Fen, a militia post at its root, lizards coming up off the causeway.
  prop("watchtower", 54, 46);
  t.fires.push({ col: 60, row: 49 });
  who("lancer", 56, 48, { ...yellow, to: { col: 62, row: 48 } });
  who("lizard", 62, 52, { to: { col: 58, row: 55 } });

  // The Eel Pens: a fenced eel-hole off the east walk, its keeper's hut.
  t.fences.push({ col: 76, row: 39, w: 4, h: 3 });
  prop("fishHut", 83, 41);
  who("pawn", 78, 42, { ...yellow, act: "knife" });

  // The sea: sharks keep offshore to the west, past the pirates; turtles in the quiet east water.
  for (const [c, r] of [[2, 18], [2, 44], [16, 54]] as const) who("harpoonShark", c, r, { to: { col: c + 4, row: r + 2 } });
  for (const [c, r] of [[86, 28], [88, 48]] as const) who("turtle", c, r);
  who("rubberDuck", 74, 34);

  const exits: AreaExit[] = [
    { to: "harbour", name: "Old Bridge", kind: "open", at: { col: 90, row: 14 } },
    { to: "fen", name: "Fen Causeway", kind: "open", at: { col: 58, row: 58 } },
  ];
  // One town on one timber: every platform the same green, the pirates' and smugglers' ground a shade darker.
  const districts: District[] = [
    { name: "Old Bridge Landing", at: { col: 80, row: 19 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "The Fish Market", at: { col: 66, row: 4 }, levels: [1], palette: [3], dress: "saltreach", decor: 2 },
    { name: "The Saltworks", at: { col: 68, row: 31 }, levels: [1], palette: [3], dress: "harbour", decor: 1.5 },
    { name: "The Net Lofts", at: { col: 52, row: 12 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "Netmakers' Village", at: { col: 46, row: 38 }, levels: [1], palette: [3], dress: "harbour", decor: 2 },
    { name: "Gull Rock", at: { col: 30, row: 24 }, levels: [1], palette: [3], dress: "saltreach", decor: 2.5 },
    { name: "Pirate Cove", at: { col: 10, row: 33 }, levels: [1], palette: [4], dress: "saltreach", decor: 2 },
    { name: "Lighthouse Rock", at: { col: 12, row: 15 }, levels: [1, 2, 3], palette: [3], dress: "crags", decor: 2 },
    { name: "The Militia Fort", at: { col: 22, row: 48 }, levels: [1, 2, 3], palette: [3], dress: "harbour", decor: 1.5 },
    { name: "Smugglers' Steps", at: { col: 40, row: 52 }, levels: [1], palette: [4], dress: "saltreach", decor: 2 },
    { name: "The Shingle Spit", at: { col: 58, row: 52 }, levels: [1], palette: [3], dress: "saltreach", decor: 2.5 },
    { name: "The Eel Pens", at: { col: 78, row: 44 }, levels: [1], palette: [3], dress: "fen", decor: 2 },
  ];
  const tier = t.finish({}, [{ col: 86, row: 14 }]);
  return { ...tier, area: "saltreach", entry: { col: 86, row: 14 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [] };
}

function landing(): AreaMap {
  const rng = makeRng("area:landing");
  const t = tierBuilder("below", rng, { cols: 70, rows: 50 });
  const { prop, who } = t;
  const l = "landing";

  // Where you wake with the tide, after the Asylum and the Stranded Graveyard: a sea cave, the way out of it narrow and
  // found, not shown. The grotto the boat drifted into, the first fire; a tunnel to the goblins' chamber, another up to
  // the hall where they keep watch, a side passage to gold; and the long way round to the antechamber, the Ring Gate at
  // its end. Notes scratched on the rock by those who washed in before, each where its lesson is needed.
  for (const [x, y, w, h] of [[26, 40, 16, 7], [12, 26, 12, 9], [14, 8, 16, 9], [40, 9, 6, 5], [46, 14, 10, 8]] as const) t.ground(l, x, y, w, h);
  t.pond(26, 46, 16, 2);
  for (const way of [[[32, 40], [32, 31], [20, 31]], [[18, 26], [18, 17]], [[29, 12], [40, 12]], [[22, 8], [22, 4], [51, 4], [51, 14]]] as const) tunnel(t, way);
  // The Ring Gate: the antechamber opens east into a tunnel running on off the map, straight into the Ring's own.
  tunnel(t, [[54, 18], [68, 18]]);
  openEdge(t, 69, 18);
  // Torches in the rock along the way, so the way out is the lit one.
  for (const [c, r] of [[30, 36], [26, 30], [17, 21], [35, 11], [30, 3], [45, 3], [52, 9], [60, 17], [27, 41], [41, 41], [13, 27], [22, 34], [15, 9], [28, 9], [15, 15], [44, 10], [55, 15], [47, 21], [38, 3], [22, 5], [54, 21]] as const) prop("sconce", c, r);

  // The grotto: the boat that drifted in, the first fire.
  prop("boat", 33, 46);
  t.fires.push({ col: 38, row: 42 });
  // The goblins' chamber: one goblin, to learn the swing on.
  who("torch", 17, 30, { to: { col: 20, row: 29 } });
  for (const [c, r] of [[14, 33], [21, 28]] as const) prop("bones", c, r);
  // The watch hall: two goblins together, to learn the roll and the guard.
  who("torch", 19, 11, { to: { col: 24, row: 11 } });
  who("spear", 25, 13);
  prop("woodPile", 15, 9);
  // The side passage's end: gold, for whoever looks.
  prop("goldStone", 43, 12);
  // The antechamber before the Ring: the dead who went in before, and the fog.
  for (const [c, r] of [[48, 16], [53, 20], [50, 21]] as const) prop("bones", c, r);
  for (const [c, r] of [[47, 15], [54, 15]] as const) prop("skullSpike", c, r);

  const notes: Note[] = [
    { at: { col: 33, row: 43 }, text: "Hold Space while walking to run." },
    { at: { col: 30, row: 41 }, text: "R to drink a flask. Rest at a fire to refill." },
    { at: { col: 22, row: 32 }, text: "Left click to attack." },
    { at: { col: 18, row: 18 }, text: "Tap Space to roll." },
    { at: { col: 49, row: 18 }, text: "Hold Shift to guard." },
    { at: { col: 52, row: 20 }, text: "Die, and your gold stays where you fell." },
  ];
  const exits: AreaExit[] = [{ to: "ring", name: "Ring Gate", kind: "open", at: { col: 68, row: 18 }, plain: true }];
  const districts: District[] = [
    { name: "The Grotto", at: { col: 34, row: 42 }, palette: [5], dress: "saltreach", decor: 1 },
    { name: "The Goblins' Chamber", at: { col: 17, row: 30 }, palette: [5], dress: "undercroft", decor: 1 },
    { name: "The Watch Hall", at: { col: 21, row: 12 }, palette: [5], dress: "undercroft", decor: 1 },
    { name: "The Antechamber", at: { col: 51, row: 18 }, palette: [5], dress: "barrowmoor", decor: 0.6 },
  ];
  const entry = { col: 34, row: 43 };
  const tier = stone(t.finish({}, [entry]));
  return { ...tier, area: "landing", entry, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes };
}

/**
 * The Bull's Ring, the sea cave's end and its own area: a round cavern, an arena,
 * fog across both its ways while the Shore Minotaur holds it, the tunnel in from
 * the cave and the tunnel out to the sea channel, where the fishers' boat crosses to the Harbour.
 * Fall to him and you wash up in the Harbour; he waits, and the boat
 * sails back to him.
 */
function ring(): AreaMap {
  const rng = makeRng("area:ring");
  const t = tierBuilder("below", rng, { cols: 52, rows: 40 });
  const { prop, who } = t;

  t.blob("ring", 26, 20, 13, 10);
  tunnel(t, [[1, 20], [13, 20]]);
  // No rock capping the tunnel's west end: it runs on off the map, back to the Landing's.
  openEdge(t, 0, 20);
  tunnel(t, [[33, 20], [48, 20]]);
  // The sea channel at the tunnel's end, the fishers' boat moored in it.
  t.pond(47, 18, 4, 5);
  rubble(t, rng, 26, 20, 13, 10, 7);
  // Braziers round the floor, and the spikes and bones of the drowned who washed in before.
  for (const [c, r] of [[17, 13], [35, 13], [17, 27], [35, 27], [26, 11], [26, 29], [14, 17], [14, 23], [38, 17], [38, 23]] as const) prop("sconce", c, r);
  for (const [c, r] of [[20, 15], [32, 15], [20, 25], [32, 25]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[23, 22], [29, 17], [27, 24], [22, 18]] as const) prop("bones", c, r);
  for (const [c, r] of [[6, 19], [43, 18]] as const) prop("sconce", c, r);
  prop("boat", 48, 20);
  t.bosses.push({ name: "Shore Minotaur", area: "ring", col: 26, row: 20 });
  who("minotaur", 26, 20, { to: { col: 27, row: 20 } });

  const exits: AreaExit[] = [
    { to: "landing", name: "Ring Gate", kind: "open", at: { col: 1, row: 20 }, plain: true },
    { to: "harbour", name: "The Boat", kind: "lift", at: { col: 45, row: 20 }, guard: "minotaur" },
  ];
  const districts: District[] = [
    { name: "The Bull's Ring", at: { col: 26, row: 20 }, palette: [5], dress: "barrowmoor", decor: 0.6 },
    { name: "The Sea Channel", at: { col: 46, row: 20 }, palette: [5], dress: "undercroft", decor: 0.5, box: { x: 40, y: 17, w: 12, h: 7 } },
    { name: "The Cave Tunnel", at: { col: 6, row: 20 }, palette: [5], dress: "undercroft", decor: 0.5, box: { x: 0, y: 17, w: 12, h: 7 } },
  ];
  const tier = stone(t.finish({}, [{ col: 3, row: 20 }]));
  // No fog: the Ring is the arena, walked straight into from the cave; the bull's guard on the boat holds the way on.
  const arena = { boss: "minotaur", gate: [], inside: { col: 24, row: 20 } };
  return { ...tier, area: "ring", entry: { col: 3, row: 20 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], arena };
}

const BUILT: Partial<Record<AreaId, () => AreaMap>> = { harbour, emberwood, crags, greyfall, gilded, steps, undercroft, deeps, hollow, barrowmoor, fen, saltreach, landing, burg, ramparts, chapel, ring, keep: keepArea };

/** The areas that have a map of their own so far. */
export const MAPPED_AREAS = Object.keys(BUILT) as AreaId[];

/** An area's own map, the same every time. */
const made = new Map<AreaId, AreaMap>();

/** Areas up on the hill, not on the shore: the sea round them is woods instead. */
const HILL: ReadonlySet<AreaId> = new Set(["burg", "ramparts", "chapel", "keep"]);

/** Every tile of open sea reached from the map's edge (above row `top`, if given) turned to woods of the nearest
 *  district's kind; a pond stays water. */
function wooded(m: AreaMap, top = Infinity): AreaMap {
  const rows = m.island.rows.map((l) => [...l]);
  const queue: Cell[] = [];
  const take = (col: number, row: number): void => {
    if (rows[row]?.[col] !== "~" || row >= top) return;
    rows[row]![col] = "T";
    queue.push({ col, row });
  };
  for (let c = 0; c < rows[0]!.length; c++) (take(c, 0), take(c, rows.length - 1));
  for (let r = 0; r < rows.length; r++) (take(0, r), take(rows[0]!.length - 1, r));
  for (let i = 0; i < queue.length; i++) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) take(queue[i]!.col + dc, queue[i]!.row + dr);
  // A boss room's mist covers its district: the woods take only the open districts round it.
  const owner = m.districtAt.map((l) => [...l].map((ch) => (ch !== "-" && m.districts[parseInt(ch, 36)]?.box ? "-" : ch)));
  const spread = queue.filter((c) => owner[c.row]![c.col] === "-" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => (owner[c.row + dr!]?.[c.col + dc!] ?? "-") !== "-"));
  for (const c of spread) owner[c.row]![c.col] = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => owner[c.row + dr!]?.[c.col + dc!] ?? "-").find((x) => x !== "-")!;
  for (let i = 0; i < spread.length; i++) {
    const c = spread[i]!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [x, y] = [c.col + dc, c.row + dr];
      if (rows[y]?.[x] !== "T" || owner[y]![x] !== "-") continue;
      owner[y]![x] = owner[c.row]![c.col]!;
      spread.push({ col: x, row: y });
    }
  }
  const districtAt = owner.map((l, r) => l.map((ch, c) => (rows[r]![c] === "T" && m.island.rows[r]![c] === "~" ? ch : m.districtAt[r]![c]!)).join(""));
  return { ...m, island: { ...m.island, rows: rows.map((l) => l.join("")) }, districtAt };
}

/** No scattered woods on a note or the two rows south of it, whose canopy would draw over the paper: the scatter in
 *  finish() runs before an area's notes are known, so which tiles it wooded shifts with every prop added. */
function clearNotes(m: AreaMap): AreaMap {
  if (m.base === "rock" || !m.notes?.length) return m;
  const rows = m.island.rows.map((l) => [...l]);
  for (const n of m.notes) for (let dr = 0; dr <= 2; dr++) for (let dc = -1; dc <= 1; dc++) if (rows[n.at.row + dr]?.[n.at.col + dc] === "T") rows[n.at.row + dr]![n.at.col + dc] = ".";
  return { ...m, island: { ...m.island, rows: rows.map((l) => l.join("")) } };
}

export function areaMap(id: AreaId): AreaMap {
  const build = BUILT[id];
  if (!build) throw new Error(`${AREAS.find((a) => a.id === id)?.name ?? id} has no map yet`);
  // A map on the sea or in the sky floats in it; underground, the rock round the caverns already does.
  if (!made.has(id)) {
    const m = clearNotes(build());
    // The Harbour's north edge is the hill on up to the Burg, not the sea.
    made.set(id, m.base === "rock" ? m : HILL.has(id) ? wooded(pad(m, 3)) : id === "harbour" ? wooded(pad(m, 3), 6) : pad(m, 3));
  }
  return made.get(id)!;
}
