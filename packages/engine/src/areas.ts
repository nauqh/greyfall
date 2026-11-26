/**
 * Area maps: each area of the atlas as a large map of its own, the camera
 * kept inside it. Its exits run off its edges to the areas beside it, and
 * its lifts go up or down a tier. Built with the atlas's tier builder, so
 * the same terrain, placement and checks hold: natural relief where the
 * land is wild, authored blocks where it is built, like a fortress.
 */

import { AREAS, footprint, noise, tierBuilder, type AreaId, type AtlasTier, type Dweller, type GateKind, type LiftKind } from "./atlas.ts";
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
  /** Its way to the map's edge is a track, not paved. */
  unpaved?: boolean;
  /** Bosses' kinds: shut until every key those bosses drop is carried. */
  keys?: readonly string[];
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
  /** Its trees grow in clumps of pine and birch with stumps among them, as the pack draws a worked wood. */
  groves?: boolean;
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
  /** A boss room: fog across `gate`, crossed with E from outside to `inside`, shut behind until the `boss` kind falls.
   *  `bell`: a bell in it that a swing beside rings. */
  arena?: { boss: string; gate: Cell[]; inside: Cell; bell?: Cell };
  /** Ways shut until a boss's key is carried: `key` is the boss kind that drops it; `flag`, a world flag that opens it too.
   *  With `from`, a shortcut: no key, unbarred for good with E from the side nearer `from`, setting `flag`. */
  locks?: { key?: string; name: string; cells: Cell[]; flag?: string; from?: Cell }[];
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

/** Streets paved on the lowland only: up on a terrace a road reads painted on, so there its way stays bare ground. */
function lowStreets(tier: AtlasTier): AtlasTier {
  return { ...tier, roads: tier.roads.filter((c) => tier.island.rows[c.row]?.[c.col] === ".") };
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

/** A one-row notch under a cliff with its own height again below it is all cliff face and no ground, which the tileset
 *  cannot draw: it fills with the ground below, which the cliff then stands on, as in the Tiny Swords tilemap guide. */
function unnotch(tier: AtlasTier): AtlasTier {
  const rows = tier.island.rows.map((l) => [...l]);
  const areaAt = tier.areaAt.map((l) => [...l]);
  const lv = (c: number, r: number) => heightOf(rows[r]?.[c] ?? "~");
  const ramp = (c: number, r: number) => "<>[]{}()".includes(rows[r]?.[c] ?? "~");
  for (let r = 1; r < rows.length - 1; r++) {
    for (let c = 0; c < rows[r]!.length; c++) {
      const up = lv(c, r - 1);
      if (up < 2 || lv(c, r) >= up || lv(c, r + 1) < up || ramp(c, r - 1) || ramp(c, r) || ramp(c, r + 1)) continue;
      rows[r]![c] = rows[r + 1]![c]!;
      areaAt[r]![c] = areaAt[r + 1]![c]!;
    }
  }
  return { ...tier, island: { ...tier.island, rows: rows.map((l) => l.join("")) }, areaAt: areaAt.map((l) => l.join("")) };
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
      if (!lit && len > 12 && d > len / 3) (t.campfires.push({ col: c, row: r }), (lit = true));
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
      if (!e.unpaved) roads.push({ col: x, row: y });
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
    ...(m.arena && { arena: { ...m.arena, gate: m.arena.gate.map(at), inside: at(m.arena.inside), ...(m.arena.bell && { bell: at(m.arena.bell) }) } }),
    ...(m.locks && { locks: m.locks.map((l) => ({ ...l, cells: l.cells.map(at), ...(l.from && { from: at(l.from) }) })) }),
  };
}

/** A river: water `width` wide along a line of points. */
function river(t: Builder, points: readonly (readonly [number, number])[], width: number): void {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    t.cut({ col: a[0], row: a[1] }, { col: b[0], row: b[1] }, width, (c) => t.pond(c.col, c.row, 1, 1));
  }
}

/** Tileset colours by lightness, darkest first: teal, olive, green, fresh green, gold. Sunk ground's 6, darker than
 *  teal, reads as teal to the ground beside it. */
const LIGHT: Record<number, number> = { 6: 0, 5: 0, 4: 1, 3: 2, 2: 3, 1: 4 };
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

/** A bonfire's name: its own, else its district's, else its area's. */
export function fireName(m: AreaMap, f: Cell): string {
  const own = m.fires.find((x) => x.col === f.col && x.row === f.row)?.name;
  return own || districtOf(m, f.col, f.row)?.name || (AREAS.find((a) => a.id === m.area)?.name ?? "");
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

/**
 * The Lower Town: the title screen's island (introAtlas.ts MAP, its rows 2 to 18), tile for tile. Its sea west, north
 * and east is the town's ground ("~"); south of its beach, "w", is the bay, so its coast is the Harbour's shore.
 */
const LOWER_TOWN = [
  "~~~~~~55544444^^^^~~~~~~~~~",
  "~~~~~^555)4444^^^^^^~~~~~~~",
  "~~~~~^44444^^^^^^^^^##~~~~~",
  "~~~~[^^4444}^^^^^^^####~~~~",
  "~~~.#^^^^^^^^^^########.~~~",
  "~~.<##^^^##^^^^]######..~~~",
  "~~....#####..########....~~",
  "~~....#####..######......~~",
  "~~...<####....#####>.....~~",
  "~~.......................~~",
  "~~.......................~~",
  "~~w......................~~",
  "~~w.........wwww........w~~",
  "~~ww.......wwwwwww.....ww~~",
  "~~wwww...wwwwwwwwww...www~~",
  "~~wwwwwwwwwwwwwwwwwwwwwww~~",
  "~~wwwwwwwwwwwwwwwwwwwwwww~~",
];

const UPPER_TOWN = [
  "...4444.....55555....ww..44...",
  "..444444www555555555wwwww444..",
  ".4444444www5555555555wwww4444.",
  ".4444444ww555555555555www4444.",
  ".4444444ww555555555555www4444#",
  ".4444444w5555555555555www4444#",
  ".444444ww55555555555544www444#",
  "..44444ww555555555555)4ww4444#",
  "..44444www5555wwwwwww44ww4444#",
  ".^^4444wwww555wwwwwwwwww44444#",
  ".^{444wwwwwwwwwwwwwwwww4444^^#",
  ".^^^444wwwwwwww44444444444^^^#",
  "..^^44444444444444444444^^^^^#",
  ".^^^^^^^444444444444444^^^^^^#",
  "^^^^^^^^^^4444444444^^^^^^^^^#",
  "^^^^^^^^^{4444444444}^^^^^^^##",
  "^^^^^^^^^^^^44444^^^^^^^^^^^]#",
  "^^^^^^^^^^^^^^^^^^^^^^^^^^^###",
  "^^^^^^^^^^^^^^^^^^^^^^^^^^^###",
  "^^^###^^^^^^^^^^^^^^^^^^^^^###",
  "#########^^^^^^^^^^^^^^^^^^^##",
  "######..^^^^^^^^^^^^^^^^^^^^##",
  "######>.^^^^^^^^^^^^^^^^^^^###",
  "...##...^^^^^^^^^^^^^^^^^^####",
  "........^^^^^^^^^^^^^^^^^^####",
  "w.....^^^^^^^^^^^^^^^^^^^#####",
  "ww....^^^^^^^^^^^^^^^^^^######",
  "##...######^^^^^^^^^##########",
  "##########[^^^^^^^^^]#########",
  "#############^^^^^############",
];

/** Ground drawn row by row in the map alphabet, its top-left at `x0`, `y0`: every tile authored, "~" the lowland, "w"
 *  water, a stair on the ground under it. */
function stamp(t: Builder, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      t.drawn.add(`${x0 + c},${y0 + r}`);
      if (ch === "w") return t.pond(x0 + c, y0 + r, 1, 1);
      const way = "<>[]{}()".indexOf(ch);
      if (way < 0) return t.block((".#^45".indexOf(ch === "~" ? "." : ch) + 1) as 1 | 2 | 3 | 4 | 5, x0 + c, y0 + r, 1, 1);
      const level = ((way >> 1) + 2) as 2 | 3 | 4 | 5;
      t.block((level - 1) as 1 | 2 | 3 | 4, x0 + c, y0 + r, 1, 1);
      t.stair(level, x0 + c, y0 + r, way % 2 ? "R" : "L");
    }),
  );
}

/** Drawn rows widened to `w`, each column repeated where it falls; a stair keeps one copy, on its table's side, and
 *  the others are the ground under it. */
function widen(rows: readonly string[], w: number): string[] {
  const f = rows[0]!.length / w;
  return rows.map((line) =>
    Array.from({ length: w }, (_, x) => {
      const c = Math.floor(x * f);
      const ch = line[c]!;
      const way = "<>[]{}()".indexOf(ch);
      if (way < 0) return ch;
      const first = x === 0 || Math.floor((x - 1) * f) !== c;
      const last = Math.floor((x + 1) * f) !== c;
      return (way % 2 ? first : last) ? ch : ".#^4"[way >> 1]!;
    }).join(""),
  );
}

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

/** A way out three wide from `a` to `b` on the map's edge, at `level`, paved unless `track`: a gate the eye can follow
 *  off the map. */
function edgeWay(t: Builder, a: Cell, b: Cell, level: 1 | 2 | 3 | 4 | 5 = 1, track = false): void {
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
  if (track) t.track([a.col, a.row], [b.col, b.row]);
  else t.road([a.col, a.row], [b.col, b.row]);
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

/** A pawn at its knife facing the sheep it butchers, a tile off on its right, or on its left with `left`. */
function butcher(t: Builder, col: number, row: number, left = false): void {
  t.who("sheep", col + (left ? -1 : 1), row);
  t.who("pawn", col, row, { color: "blue", act: "knife", flip: left });
}

/** A woodcutter out from `home` to the tree beside `chop` on its right, or its left with `left`: it fells it, carries
 *  the logs home, rests, and goes again. */
function fell(t: Builder, home: Cell, chop: Cell, more: { left?: boolean } & Pick<Dweller, "when" | "unless"> = {}): void {
  const { left = false, ...shown } = more;
  // A tree stands at its tile's top-left corner. The axe's blade lands 52px out and 22px up from the pawn's feet, so
  // the trunk goes 0.875 tile off the pawn's middle and a sixth of a tile behind its feet: the blade bites the bark.
  t.prop("tree", chop.col + (left ? -0.375 : 1.375), chop.row + 0.6, { fixed: true });
  t.who("pawn", home.col, home.row, { color: "blue", act: "fell", to: chop, flip: left, ...shown });
}

/** A gold heap as the pack piles it, in tiles off its front stone: big rock behind it, nuggets about. Measured off the
 *  pack's own Pawn and Resources sheet. */
const HEAP = [[0, 0, 3], [1.2, -0.4, 5], [1.6, 0.3, 4], [2.2, 0.15, 4], [2.85, -0.55, 6], [3.1, 0.05, 2], [0.8, 0.7, 1], [1.75, -0.4, 2]] as const;

/** A heap running off to the right of the tile at `col`, `row`. */
function heap(t: Builder, col: number, row: number): void {
  for (const [dc, dr, n] of HEAP) t.prop(`ore${n}`, col + 0.8 + dc, row + dr - 0.25, { fixed: true });
}

/**
 * The Keep, the castle's crown: the castle between the Harbour and the Burg, its
 * gate off the Burg's west ward shut until the Ember Key is carried. In through
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
  // The bailey road from the gate to the fire, the way up branching north to meet the stair along its foot, and off its
  // head along the terrace to the hall's door.
  t.road([59, 30], [26, 30]);
  t.road([51, 30], [51, 17], [50, 17]);
  t.road([49, 16], [47, 16], [47, 11], [29, 11]);

  // The Keep Gate court: a tower each side of the way in.
  for (const [c, r] of [[52, 27], [52, 34]] as const) prop("tower", c, r, blue);
  // The bailey, kept quiet after the Burg: the barracks Corwin keeps, the Keep's fire.
  prop("barracks", 16, 24, blue);
  t.fires.push({ col: 24, row: 28 });
  // The hall: the castle on its terrace, a guard at its door, the Watch Lift at the terrace's west end.
  prop("castle", 30, 10, blue);
  who("lancer", 26, 14, { ...blue, to: { col: 36, row: 14 } });

  const notes: Note[] = [{ at: { col: 44, row: 6 }, text: "Look east. In the Citadel a crown keeps one man warm." }];
  const exits: AreaExit[] = [
    { to: "burg", name: "Keep Gate", kind: "open", at: { col: 62, row: 30 } },
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
 * starts at it. West along the terrace, the Bell Stair up into the Belfry, where
 * the Stone Warden keeps the bell; east along the terrace, the forge yard, Brenna
 * at her anvil, and the Old Lift on the pier at the yard's south lip, down the hill
 * to the Harbour; the yard's own stair down to the cloister closes the loop.
 */
function chapel(): AreaMap {
  const rng = makeRng("area:chapel");
  const t = tierBuilder("surface", rng, { cols: 92, rows: 60 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  // The precinct's own grounds only, its walls the hill's woods: the gate court, the cloister round its pond, the chapel
  // terrace a height up north of it and the Bell Stair's landing a height above that; east, the forge yard a height up its stair
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
  // The chapel terrace ragged rock; the chapel's pad, and the Bell Stair's landing a height up at its west end, exact.
  t.shape(2, 34, 11, 15, 5, 0.45, "The Chapel");
  t.shape(2, 21, 10, 6, 5, 0.4, "The Chapel");
  t.shape(2, 46, 13, 6, 4, 0.4, "The Chapel");
  t.block(2, 37, 8, 9, 6);
  t.block(2, 47, 13, 5, 4);
  t.stair(2, 52, 16, "R");
  t.block(2, 16, 6, 14, 6);
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
  // The way out to the map's edge: the Cloister Gate west.
  edgeWay(t, { col: 4, row: 30 }, { col: 1, row: 30 });
  // The Sisters' Stair off the Alcove's south wall, down the hill to the Harbour's chapel.
  edgeWay(t, { col: 33, row: 50 }, { col: 33, row: 58 });
  // Under the terrace clear of its cliff, then along the stair's foot from its open side.
  t.road([4, 30], [22, 30]);
  t.road([22, 19], [53, 19], [53, 17], [52, 17]);
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
  // The Bell Stair's landing: the belfry's foot, the bell tower stood over the terrace's west end.
  prop("tower", 20, 8, blue);
  // The forge yard: the forge and its stock; the Old Lift at the pier's end over the drop.
  prop("house3", 72, 23, blue);
  for (const [c, r, art] of [[75, 27, "tools"], [77, 31, "goldStone"], [70, 33, "woodPile"]] as const) prop(art, c, r);
  for (const [c, r] of [[60, 22], [80, 36]] as const) who("skull", c, r, { to: { col: c + 3, row: r } });

  const notes: Note[] = [
    { at: { col: 6, row: 31 }, text: "The bell has not rung since the Grey came." },
  ];
  const exits: AreaExit[] = [
    { to: "bullwall", name: "Chapel Door", kind: "open", at: { col: 1, row: 30 } },
    { to: "harbour", name: "The Old Lift", kind: "shortcut", at: { col: 68, row: 55 }, opens: "oldLiftDown" },
    { to: "belfry", name: "The Bell Stair", kind: "open", at: { col: 27, row: 6 } },
    { to: "harbour", name: "The Sisters' Stair", kind: "open", at: { col: 33, row: 58 }, opens: "sistersStair" },
  ];
  const districts: District[] = [
    { name: "The Cloister Gate", at: { col: 9, row: 30 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Cloister", at: { col: 34, row: 22 }, levels: [1], palette: [3], dress: "harbour", decor: 1 },
    { name: "The Chapel", at: { col: 40, row: 10 }, levels: [2, 3], palette: [2], dress: "harbour", decor: 1 },
    { name: "The Forge Yard", at: { col: 68, row: 28 }, levels: [2], palette: [3], dress: "harbour", decor: 1.5 },
    { name: "The Alcove", at: { col: 33, row: 46 }, levels: [1], palette: [4], dress: "harbour", decor: 1.5 },
  ];
  const tier = lowStreets(t.finish({ chapel: 0.02 }, [{ col: 6, row: 30 }]));
  return { ...tier, area: "chapel", entry: { col: 6, row: 30 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes };
}

/**
 * The Ramparts, the castle's second area, after Dark Souls' Undead Burg: the
 * castle's curtain wall over its bailey. In at the gate yard from the Burg's
 * crest, up the gate tower onto the wall, along its walk to the Bull's Gate at
 * its east end, the way onto the Bull's Wall. Three heights: the lower ward's
 * yards and houses, the upper ward's tenements under the wall, and the wall. The
 * upper ward has its own stair up onto the walk.
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
  t.ground("ramparts", 62, 7, 20, 3);
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
  // The gate tower a height up again off the ward, and the walk off its top on to the Bull's Gate.
  t.block(3, 4, 5, 14, 10);
  t.stair(3, 18, 14, "R");
  t.block(3, 18, 7, 64, 3);
  // The back stair: a landing off the walk down onto the upper ward.
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
  t.road([10, 36], [59, 36], [59, 24], [58, 24]);
  t.road([19, 17], [56, 17], [56, 22]);
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
  // The wall walk: the goblins who took it, and kept off its far end.
  for (const [c, r] of [[24, 8], [32, 8], [60, 8]] as const) who("spear", c, r);
  for (const [c, r] of [[45, 7], [57, 9], [76, 8]] as const) prop("bones", c, r);
  // The rest before the Bull's Gate, on the end of the walk the goblins kept off.
  t.fires.push({ col: 74, row: 7 });
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
  for (const [c, r] of [[21, 40], [24, 40], [34, 39], [37, 40], [40, 39], [47, 39], [50, 40], [53, 39], [22, 43], [26, 44], [36, 43], [55, 43]] as const) prop(`house${((c + r) % 3) + 1}`, c, r, blue);
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

  const notes: Note[] = [
    { at: { col: 10, row: 44 }, text: "A narrow wall. What holds it does not turn aside." },
  ];
  const exits: AreaExit[] = [
    { to: "burg", name: "Rampart Gate", kind: "open", at: { col: 10, row: 48 } },
    { to: "bullwall", name: "The Bull's Gate", kind: "open", at: { col: 82, row: 8 } },
  ];
  const districts: District[] = [
    { name: "The Gate Yard", at: { col: 10, row: 38 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.5 },
    { name: "The Lower Ward", at: { col: 40, row: 36 }, levels: [1], palette: [4], dress: "greyfall", decor: 1.2 },
    { name: "The Drill Yard", at: { col: 38, row: 30 }, levels: [2], palette: [3], dress: "greyfall", decor: 0.8 },
    { name: "The Upper Ward", at: { col: 36, row: 17 }, levels: [2], palette: [3], dress: "greyfall", decor: 1 },
    { name: "The Gate Tower", at: { col: 10, row: 10 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.5 },
    { name: "The Wall Walk", at: { col: 28, row: 8 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.3 },
  ];
  const tier = lowStreets(t.finish({ ramparts: 0.02 }, [{ col: 10, row: 46 }]));
  return { ...tier, area: "ramparts", entry: { col: 10, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], streets: true, notes };
}

/**
 * The Lower Burg, the first area of the castle, after Dark Souls' Undead Burg and
 * Dark Souls 3's Undead Settlement: the castle's outer town on the hill north of
 * the Harbour, fallen to the Grey, a warren of alleys walled by houses and dead
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
    { to: "harbour", name: "Burg Gate", kind: "open", at: { col: 48, row: 62 } },
    { to: "ramparts", name: "Rampart Gate", kind: "open", at: { col: 52, row: 1 } },
    { to: "bullwall", name: "The Ladder", kind: "shortcut", at: { col: 56, row: 32 }, shut: "ladderDown" },
    { to: "keep", name: "Keep Gate", kind: "locked", at: { col: 1, row: 20 }, keys: ["minotaur"] },
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

  // One climb from the bonfire, after Firelink's stair: the bowl's north stairs onto Old Town, the Upper Town above
  // it, and the Burg Gate, Highward's gatehouse, on the hill's crown, its door facing the climb.
  t.shape(2, 57, 23, 21, 18, 0.3, "Old Town");
  t.shape(2, 70, 11, 8, 5, 0.3, "Old Town");
  t.shape(2, 56, 6, 16, 5, 0.2, "Old Town");
  stamp(t, UPPER_TOWN, 40, 4);
  // The gatehouse's one bridge, over the moat from the Wind Ward onto the ledge under its stair.
  const keepBridge = t.span(4, 61, 13, 2, 2);
  // Behind the citadel, and north of the east lane's head, is only woods: nothing to find round there.
  t.block(1, 30, 0, 57, 4);
  t.block(1, 70, 4, 17, 4);
  for (let r = 0; r < 8; r++) for (let c = 30; c < 87; c++) if (t.at(c, r) === "." && (r < 4 || c >= 70 || t.drawn.has(`${c},${r}`))) t.put(c, r, "T");
  // The Northwood: a wooded upland west of the castle, the lookout crag on its crown, the empty cabins on a ledge
  // of their own by the Ember Gate road.
  stamp(t, [
    ".......^^^^...............",
    "....##^^^^^##.............",
    "..####^^^^^^###...........",
    ".####^^^^^^^^###..####....",
    ".####^^^^^^^^^#..######...",
    "####^^^^^^^^^^#..#######..",
    "####^^^^^^^^^###..######..",
    "#######^^^^^^]##..######..",
    ".#####[^^^^####..#######..",
    ".##############..########.",
    "..##############..#######.",
    "..##############..#######>",
    ".################..######.",
    "#################..#####..",
    "##################..####..",
    ".#################........",
    ".###################......",
    "..##################......",
    ".....#################....",
    ".......################>..",
    ".........#############....",
    ".............#####........",
    "............<#####........",
    ".............####.........",
  ], 5, 8);
  // The Mine Hills east: a worked hill, its quarried face stepping up in benches to a crest pushed north-east and a crag
  // on the crest, the lookout's, mines cut into the benches' corners and the crag's face, the cave under the crest, the
  // sea biting its east foot.
  stamp(t, [
    "~~~~~~~~~~~~~~55~~~~~~~~~~~~",
    "~~~~~~~~~~~^^55555^~~~~~~~~~",
    "~~~~~~~~~~^^555555^^^~~~~~~~",
    "~~~~~~~^^^^55555555^^^~~~~~~",
    "~~~~~^^^4(55545455544^^~~~~~",
    "~~~~~^444444^^4444444^^^^~~~",
    "~~~~^^4444444^^44444444}^~~~",
    "~~~~^{444444^^^^4444^^^^^^~~",
    "~~~~^^^4444^^^^^^^^^^^^^^^~~",
    "~~~~^^^^^^^^^^^^^^^^^^^##~~~",
    "~~~~#^^^^^^^^#^^^^^^^^^]#~~~",
    "~~~#[^^^^^^^##^^^^^^^^###~~~",
    "~~~###^^^^^^##^^^^^^^#####~~",
    "~~~####^^^#####^^^#######~~~",
    "~~~~###################~~~~~",
    "~~~~###############~~~~~~~~~",
    "~~~~~#############~~~~~~~~~~",
    "~~~~~################~~~~~~~",
    "~~~~~##################~~~~~",
    "~~~~~~################~~~~~~",
    "~~~~~~#################~~~~~",
    "~~~~~<###############~~~~~~~",
    "~~~~~~~############~~~~~~~~~",
    "~~~~~~~~~########~~~~~~~~~~~",
    "~~~~~~~~~~~####~~~~~~~~~~~~~",
  ], 82, 11);
  // The Moor Watch, Lantern Point's hill: the graves on its slope, the old watchtower on its crest, and sunk in the crest
  // the Charnel, where the hill's dead were stacked, two heights down. Up from the lychgate, onto the shoulder at its
  // south-west corner and the crest above it; then down off the crest's north wall onto the Charnel's ledge and down
  // again to its floor, the Moor Gate at its seaward end. Cliffs face south, so the way down runs south.
  const graves = [
    ".......#######.......~~~",
    ".....###############....",
    ".....###^^^^^^^########.",
    ".....###^^^^^^^########.",
    "....####^^^444444444####",
    "...#####^^444444444444##",
    "..#####^^444444444^^4444",
    "..#####^^444444##^^{4444",
    "...####^^4444###[^^^^^^^",
    "....##^^^444############",
    "...##^^^^444############",
    "...##^^^^444############",
    "....##^^^^444###########",
    ".....##^^^44444#########",
    "..#####^^{4444444~~####~",
    "...####^^^^^^^^^^~~~~~~~",
    "..####[^^^#########~~~~~",
    "~.#################~~~~~",
    "~..#################~#~~",
    "~...##################.~",
    "~...###################.",
    "~....#################..",
    "~.....###############...",
    "~......#############....",
    "~..........#######......",
    "~.........<#####........",
    "~.......................",
    "........................",
  ];
  stamp(t, graves, 86, 39);
  // The hill names its district, so the Graves' colour runs to its edges rather than meeting Mine Hills' by distance.
  t.shapes.push({ level: 2, keys: new Set(graves.flatMap((l, r) => [...l].flatMap((ch, c) => (".~".includes(ch) ? [] : [`${86 + c},${39 + r}`])))), owner: "The Graves" });
  // The knoll in West Fields.
  t.shape(2, 16, 56, 6, 3.5, 0.45, "West Fields");
  // The Lower Town is the title screen's island, its beach on the bay: the first thing seen from the fire.
  // Widened from the title's island to span the bowl from the fields to the bend where the coast turns south.
  const [X0, W] = [30, 39];
  const sx = (c: number) => X0 + (c * W) / LOWER_TOWN[0]!.length;
  // Notches cut into the widened cliffs, top and foot, so no edge runs on straight.
  const ground = widen(LOWER_TOWN, W).map((l) => [...l]);
  for (const [c, r, ch] of [[47, 43, "."], [48, 43, "."], [54, 43, "."], [55, 43, "."], [41, 46, "^"], [42, 46, "^"], [48, 48, "#"], [49, 48, "#"], [53, 51, "."], [54, 51, "."], [39, 45, "^"], [39, 46, "{"], [40, 46, "4"], [41, 46, "4"], [42, 46, "4"]] as const) ground[r - 43]![c - X0] = ch;
  // Lookout Hill's foot runs on west and down the bay's west shore toward West Fields, its stair moved to the new end.
  for (const [r, line] of [[46, "...####"], [47, "..######"], [48, ".<######"], [49, "..#######"], [50, "..#######"], [51, ".######"], [52, "#####"], [53, "###"], [54, "###"], [55, "###"], [56, "##"]] as const) {
    [...line].forEach((ch, i) => ch === "." || (ground[r - 43]![i] = ch));
  }
  stamp(t, ground.map((l) => l.join("")), X0, 43);

  // Paved only where the town is: the high street from the Old Bridge's toll post along the bowl's foot to the Old
  // Lift, turning down into the fire square, and the castle's climb off it. Out in the country the ways are tracks,
  // kept clear but grass: the Ember Gate road north through the wood, and the farm road down between the fields.
  t.road([1, 42], [58, 42]);
  // East of the deck it starts at the foot of the landing's stair, never under its head.
  t.road([64, 42], [72, 42]);
  t.road([71, 42], [71, 46]);
  t.track([26, 42], [33, 41], [34, 30], [28, 4], [26, 1]);
  t.track([26, 42], [27, 54], [27, 66], [3, 66]);
  t.track([15, 66], [15, 61]);
  // The citadel's terraces go unpaved: only the east ring's town keeps its streets, the alley two tiles wide between its
  // two rows of houses.
  t.road([73, 10], [73, 29]);
  t.road([74, 10], [74, 29]);
  // The village's shore street, two wide and straight from the fire square down between its houses, round the inlet's
  // head and along the burned east lane to the Shore Road off Lantern Point's tip. The track out to the mine, and the
  // climb up the Graves to the Moor Gate, stay grass.
  for (const c of [71, 72]) t.road([c, 50], [c, 70]);
  t.road([71, 70], [77, 70], [77, 73], [95, 73], [95, 78]);
  t.track([76, 46], [86, 46], [86, 34]);
  t.track([95, 73], [96, 71], [97, 66], [97, 64]);
  t.track([98, 63], [99, 58], [101, 54], [104, 51], [109, 50]);
  t.bridge({ col: 95, row: 76 }, { col: 95, row: 78 }, 3);
  t.bridge({ col: 8, row: 42 }, { col: 1, row: 42 }, 3);
  t.bridge({ col: 28, row: 7 }, { col: 26, row: 1 }, 3);
  t.bridge({ col: 62, row: 58 }, { col: 62, row: 62 });
  // The climb starts at the fire: a landing at the foot of the bowl's north wall, a tile wider than the wall over it
  // and a stair up each of its outer ends onto Old Town, the castle above.
  t.block(2, 52, 40, 10, 1);
  t.stair(2, 51, 40, "L");
  // The east end steps down two rows onto the high street, its stair on the lower; the Old Lift lands in the corner
  // over it, by the watch tower.
  t.block(2, 61, 41, 1, 1);
  t.block(2, 61, 42, 2, 1);
  t.stair(2, 63, 42, "R");
  // Old Town goes unpaved, so the only streets on the heights are the east ring's crossroads. Off the landing a bridge
  // deck crosses the high street onto the island's east rim, so the two first heights meet; a walker along the street
  // goes up the landing's stairs and over.
  t.road([48, 41], [51, 41]);
  const decks = t.span(2, 59, 41, 2, 4);
  // A gate tower at the mouth of each pass, so from the fire the bowl's sides read as its ways out.
  for (const [c, r] of [[43, 44], [69, 45], [60, 52]] as const) prop("watchtower", c, r);
  // Copses on the rim and in the bowl's corners, so the hollow is green round the fire.
  for (const [x, y, rx, ry, d] of [[44, 39.5, 2, 1.5, 0.6], [65.5, 39.5, 1.5, 1, 0.7]] as const) t.grove(x, y, rx, ry, d);

  // The Harbour's one bonfire, first, so a fall at the Ring wakes here: on the Lower Town's shore under the Old Well, by the monk.
  t.fires.push({ col: 47, row: 53 });

  // The Upper Town, after Whiterun, drawn tile by tile (UPPER_TOWN), three districts each a height up: the wide lower
  // circle with the gate, the chapel and the garrison; the Wind Ward's horseshoe round a moat; and on its own crag in
  // the moat the crown, Highward's gatehouse, reached only by its bridge and the stair off the ledge under it.
  // The Great Gate, a bastion jutting off the lower circle: a tower either side of the road through it, a stair up
  // each of its outer corners, a lantern at each stair's foot and the watch at its head.
  // Watchtowers round the outer wall and the town, and one at the crown's east front corner.
  // Each with its archer: on the platform of the crown's and of the outer towers, walking the foot of the rest. A
  // perched archer stands a quarter tile in front of its tower's base, so it draws over the tower.
  const watch = [[72, 8], [67, 29], [60, 39], [42, 32], [66, 11], [65, 18], [46.5, 23], [60, 29], [58, 9]] as const;
  const atop = new Set(["72,8", "60,39", "58,9", "46.5,23"]);
  // The landing's pinned against its stair's head, the first thing seen coming up it; the square's west corner tower
  // on the lip over the stair below, in line with the lancers' barracks, too tight a corner for the ground a tower keeps.
  const pinnedTowers = new Set(["60,39", "46.5,23"]);
  for (const [c, r] of watch) prop("tower", c, r, pinnedTowers.has(`${c},${r}`) ? { ...blue, fixed: true } : blue);
  for (const [c, r] of watch) {
    if (atop.has(`${c},${r}`)) who("archer", c, r + 0.25, { ...blue, perch: 1.85 });
    else who("archer", c - 1, r + 1, { ...blue, to: { col: c + 1, row: r + 1 } });
  }
  for (const [c, r] of [[49, 32], [61, 32]] as const) prop("sconce", c, r);
  for (const [c, r] of [[52, 32], [58, 32]] as const) who("lancer", c, r, blue);
  // The west wedge, between the rim and the Wind Ward, is the Chapel Close, run out west into the Chapel Spur: the
  // almshouse at the spur's root, the pilgrims' walk along its ridge between churchyard trees on the valley side, the
  // chapel alone at its tip.
  prop("monastery", 37, 21, blue);
  for (const x of [41.4, 44.4, 47.4]) prop("tree", x, 19.6, { fixed: true });
  // Under the spur: the sisters' headstones in a row along the ledge; their pool at the foot, and the door under the
  // altar staked shut till Ysolde tells of the way.
  for (const x of [36.4, 37.8, 41.2, 44.2]) prop("rock", x, 25.4, { scale: 0.55, fixed: true });
  for (const [c, r] of [[37, 30], [42, 28]] as const) prop("bush", c, r);
  prop("bones", 44, 30);
  for (const r of [28, 30]) prop("skullSpike", 35, r, { unless: "sistersStair" });
  who("warrior", 41, 10, { ...blue, to: { col: 45, row: 12 } });
  // The Chapel Spur: a blade of rock run west off the Close over the valley, the pilgrims' walk along its ridge to the
  // chapel alone at its tip. The Sisters' Stair folds back under it: off the tip onto a ledge of the sisters' graves
  // along its south flank, down at the ledge's east end, and west along its foot past their pool to the door cut in the
  // rock beneath the altar, the sisters' old way to the Chapel Ward, shut until Ysolde tells of it. The castle's own
  // columns are in UPPER_TOWN.
  stamp(t, [
    "........",
    "........",
    "........",
    "......^^",
    "...^^^^^",
    "..^^^^^^",
    ".##^^^^^",
    ".#[^^^^^",
    ".####^^^",
    ".#######",
    ".#######",
    "..######",
    "..#.....",
    ".##.....",
    ".##...ww",
    "..#....w",
    "..######",
  ], 32, 15);
  // The Northwood's plateau bridged over the Ember Gate track onto the spur's landing; the track climbs over it, up the
  // plateau's stair and down the landing's.
  const sistersBridge = t.span(2, 29, 21, 4, 2);
  // The gate square is the garrison's training ground, a watchtower either side of its foot: its barracks on the east
  // rim and the lancers' in the south-west corner, pinned. The troops idle by their barracks till the drill is called,
  // then fall in: swordsmen sparring in pairs, a block of lancers at the thrust. Their sergeant walks the ranks. The
  // archers' range is behind the church, the butts on the meadow under the spur.
  prop("barracks", 64, 22, { ...blue, fixed: true });
  prop("barracks", 47, 30, { ...blue, fixed: true });
  prop("archery", 38, 12, { ...blue, fixed: true });
  const drill = { ...blue, act: "drill" } as const;
  const swordPosts = [[58, 22], [59, 22], [61, 22], [58, 23], [61, 23], [62, 23], [58, 24], [61, 24]] as const;
  const swordSpots = [52, 55].flatMap((c) => [22, 24].flatMap((r) => [[c, r, false], [c + 1, r, true]] as const));
  swordSpots.forEach(([c, r, flip], i) => who("warrior", swordPosts[i]![0], swordPosts[i]![1], { ...drill, flip, to: { col: c, row: r } }));
  const lancePosts = [[48, 27], [49, 26], [51, 27], [50, 28], [51, 30], [52, 31]] as const;
  const lanceSpots = [53, 55, 57].flatMap((c) => [[c, 28], [c, 30]] as const);
  lanceSpots.forEach(([c, r], i) => who("lancer", lancePosts[i]![0], lancePosts[i]![1], { ...drill, flip: false, to: { col: c, row: r } }));
  const bowPosts = [[35, 15], [34, 16], [36, 16], [33, 17], [35, 17], [37, 16]] as const;
  const bowSpots = [[34, 10], [34, 12], [34, 14], [32, 11], [32, 13], [32, 15]] as const;
  bowSpots.forEach(([c, r], i) => who("archer", bowPosts[i]![0], bowPosts[i]![1], { ...drill, flip: false, to: { col: c, row: r } }));
  // The sergeant's beat stops the day the Warlord falls.
  who("warrior", 51, 26, { ...blue, unless: "warlordDead", to: { col: 57, row: 26 } });
  // The Wind Ward, after Whiterun's: the town's great tree on a plaza facing the keep's bridge, and its drinkers; the
  // captains' houses out on the horseshoe's two arms, and a lancer at each stair head.
  prop("tree", 57.5, 17.4, { scale: 1.6, fixed: true });
  who("warrior", 52, 20, { ...blue, to: { col: 54, row: 20 } });
  prop("house2", 66, 7, blue);
  // The west arm is the town's woodyard: the Northwood's logs in one stack in a pen fenced close round it, and in the
  // arm's north-east corner behind it the yard's office, where the carrier waits and reports each full pile it brings
  // up from the cabins. A one-tile gate in the middle leaves a rail and a post either side of it, as the farm's pens
  // have. The office stands wholly on the plateau, the wood at its back, so it is pinned, the corner being too tight
  // for the clear ground a house keeps; the pen keeps a row off it, as that ground may not take a post.
  t.fences.push({ col: 41, row: 7, w: 5, h: 3, gate: 2, gateW: 1 });
  prop("logStack", 43, 8.3);
  prop("house1", 46, 5, { ...blue, fixed: true });
  who("pawn", 46, 6, { ...blue, act: "carry" });
  for (const [c, r] of [[44, 14], [59, 18], [61, 15]] as const) who("lancer", c, r, blue);
  who("lancer", 63, 14, { ...blue, to: { col: 66, row: 14 } });
  // The crown, after Dragonsreach: the keep behind a forecourt, the guardhouse on its west side and a tower at its east
  // corner, a garden either side, and off the south-west corner a porch over the drop where the watch looks down the
  // whole climb to the bay. The guardhouse is pinned against the crown's west edge, a row clear of the keep and the
  // gate's lancers: the crown is too narrow there for the ground a barracks keeps round it.
  prop("castle", 55, 7, blue);
  prop("barracks", 50, 10, { ...blue, fixed: true });
  for (const [c, r] of [[51.4, 5.6], [52.2, 6.8], [59.6, 6.6]] as const) prop("tree", c, r, { fixed: true });
  for (const [c, r] of [[50, 7], [61, 8]] as const) prop("bush", c, r);
  who("archer", 52, 13, blue);
  who("lancer", 62, 12, blue);
  // The Burg Gate stands open: a lancer either side of its door, the guard in the forecourt.
  for (const [c, r] of [[54, 10], [58, 11]] as const) who("lancer", c, r, blue);
  for (const c of [54, 57]) who("lancer", c, 9, blue);

  // Old Town: the busiest ground in the Reach. The market under the terraces, a smithy corner, cottages on every
  // spare ledge, folk at their trades, and the watch walking the stairs between the tiers.
  // Houses either side of the market row at the stairs' head.
  for (const [c, r, art] of [[44, 34, "house1"], [48, 35, "house3"], [64, 36, "house2"], [67, 35, "house1"]] as const) prop(art, c, r, blue);
  // The east ring's town: the east lane as its alley, a terrace of six houses down each side, and the ring's market
  // halfway along, a paved square with a street out of each side: the alley north and south, a stair east down to the
  // back street, a stair west up into the garrison's ward.
  // The terrace's head house is a hall under the east lane's tower: the Lane House, where the east lane's last folk
  // sleep. Pinned, as the strip between the rock and the road is its own width and no wider.
  // The east row is pinned a tile off the road, along the ring's lip.
  for (const c of [70, 76])
    for (const r of [12, 15, 18, 23, 26, 29])
      if (c === 70 && r === 12) prop("barracks", c, r, { ...blue, fixed: true });
      else prop(["house1", "house2", "house3"][(r + c) % 3]!, c, r, c === 76 ? { ...blue, fixed: true } : blue);
  // One row deep each side of the alley, level with the stair it heads for: low to the west, high to the east, each
  // stopping a tile short of it.
  t.lane([70, 21], [72, 21]);
  t.lane([75, 20], [77, 20]);
  prop("goldStone", 76, 21);
  // The ring's east lip pushed out under the right-hand row, stepping as it goes.
  for (const [r, c] of [[14, 78], [15, 77], [17, 78]] as const) t.block(2, c, r, 1, 1);
  // Off the market a cross street down a stair off the ring to a back street along the lowland under it, a row of houses
  // down each side, the west row broken where the stair comes down.
  for (const [c, r, art] of [[80, 14, "house1"], [80, 17, "house3"], [80, 23, "house2"], [80, 26, "house1"], [80, 29, "house3"]] as const) prop(art, c, r, blue);
  // The east row stands only where the Mine Hills' foot leaves it room: the lower two pinned against it, clear of the
  // street, and last the Weighhouse, where the hill's loads are weighed before the castle road, clear of the landing
  // under the bench stair.
  prop("house2", 84, 15, blue);
  for (const [r, art] of [[18, "house3"], [21, "house1"]] as const) prop(art, 84, r, { ...blue, fixed: true });
  prop("barracks", 84, 30, { ...blue, fixed: true });
  t.block(1, 79, 20, 1, 1);
  t.stair(2, 79, 20, "R");
  t.road([82, 13], [82, 21], [82, 29]);
  t.road([80, 20], [82, 20]);

  // The Lower Town, as clusters each with its own life (after the Witcher's Oxenfurt): the paved market round the fire,
  // the Old Well in the hill's cave west of the square (up is the castle and the sky, down is the drowned), the west quarter's houses thinning out toward the archery butts, the east quarter's smithy,
  // garden and garrison, and the docks on the shore; a watchtower at each gate. Folk walk between them at their work.
  prop("goldStone", 61, 48);
  // The work is done out where its stuff is, the woods, the hills, the farm and the village's houses; the market
  // keeps a trader. The crowd that stood here once drew from rng, drawn still so the woods grown after keep their places.
  for (let i = 0; i < 10; i++) rng.next();
  who("pawn", 58, 47, { color: "yellow", act: "meat", to: { col: 54, row: 47 } });
  // The west quarter: close round the square, sparser toward the fields.
  for (const [c, r, art] of [[47, 44, "house2"], [44, 44, "house1"], [40, 44, "house3"], [36, 44, "house2"], [48, 50, "house3"], [45, 50, "house2"], [35, 50, "house1"], [48, 53, "house1"], [45, 53, "house3"], [51, 53, "house2"], [36, 54, "house3"]] as const) prop(art, c, r, blue);
  // Wren's butts: once the troll is dead Wren goes shooting in the Emberwood, and the target stands alone.
  prop("archery", 22, 50, blue);
  who("archer", 24, 52, { ...blue, unless: "trollKey" });
  prop("watchtower", 21, 45);
  who("lancer", 18, 46, { ...blue, to: { col: 24, row: 47 } });
  // The east quarter, where the shore street leaves the square: houses on the inlet's shore, the barracks, the gate's
  // watchtower.
  for (const [c, r, art] of [[81, 51, "house2"], [84, 51, "house1"], [78, 55, "house3"], [82, 55, "house2"]] as const) prop(art, c, r, blue);
  prop("barracks", 77, 52, blue);
  who("warrior", 75, 50, { ...blue, to: { col: 80, row: 50 } });
  prop("watchtower", 85, 43);
  // The watch along the main way.
  who("warrior", 30, 48, { ...blue, to: { col: 82, row: 48 } });

  // The Docks: fish huts along both shores of the bay, boats out on the water.
  for (const [c, r] of [[42, 58], [47, 59]] as const) prop("fishHut", c, r);
  for (const [c, r] of [[46, 65], [62, 66], [56, 69], [60, 61]] as const) prop("boat", c, r, { flip: c > 56 });
  // The boat to the sea cave, moored at the pier's end.
  prop("boat", 64, 62);
  // The merchant berth below Maren's post, empty three winters: the first ship ties up once the Warlord falls, and
  // sails with her.
  prop("boat", 66, 66, { when: "warlordDead", unless: "marenSails" });
  who("pawn", 45, 61, { ...blue, act: "meat" });
  who("turtle", 44, 60);
  who("rubberDuck", 52, 66);

  // The Northwood: woodcutters' cabins in the trees, a lookout on the crag.
  prop("house1", 22, 24, blue);
  prop("house1", 10, 22, blue);
  prop("house2", 25, 15, blue);
  prop("tower", 15, 13, blue);
  const gateOpen = { ...blue, when: "emberGateOpen" } as const;
  // The woodcutters out from their cabins' doors into the plateau's trees, and back with the logs to the pile by each
  // door. The ledge is narrow round the north cabin: one tree there clears the cabin's own roof.
  for (const [c, r] of [[12, 23], [24, 26], [26, 16]] as const) prop("logPile", c, r);
  // Each at its own spot round the door and the pile, never in a row.
  fell(t, { col: 9, row: 24 }, { col: 7, row: 13 });
  fell(t, { col: 11, row: 23 }, { col: 8, row: 18 });
  fell(t, { col: 21, row: 26 }, { col: 18, row: 19 });
  fell(t, { col: 23, row: 27 }, { col: 17, row: 26 });
  fell(t, { col: 24, row: 25 }, { col: 20, row: 29 });
  fell(t, { col: 25, row: 16 }, { col: 25, row: 20 }, { left: true });
  who("bear", 8, 18, { to: { col: 14, row: 26 } });
  t.grove(18, 22, 13, 9, 0.5);
  // The cleft between the Northwood and the cabins' ledge let out at its foot, one walker wide, onto the track, and
  // cleared of the wood along it so it reads as a way through.
  t.block(1, 25, 22, 1, 1);
  for (let r = 10; r <= 24; r++) for (let c = 20; c <= 25; c++) if (t.grid[r]![c] === "T") t.grid[r]![c] = ".";
  for (const [c, r] of [[26, 25], [27, 25], [28, 25], [27, 26]] as const) t.grid[r]![c] = ".";
  // The lumber camp at the wood's foot by the Ember Gate road, the cabins' logs stacked for the road.
  prop("logPile", 24, 38);

  // The goblins' camp in the meadow behind the Northwood: Emberwood's raiders dug in on the Harbour's side of the
  // Ember Gate, out of the town's sight.
  prop("goblinHut", 6, 7);
  // Two torches and a spear: winnable at the start, with nothing but the sword (three met at once killed in five seconds).
  for (const [c, r] of [[4, 9], [8, 9]] as const) who("torch", c, r, { unless: "emberGateOpen" });
  who("spear", 6, 10, { unless: "emberGateOpen" });
  // The gate open, the town keeps a watch on it.
  who("warrior", 27, 4, gateOpen);

  // The Mine Hills, the outside of a working mine: a mine cut into each bench's corner and the crag's face, the gold dug
  // out of sight inside, and diggers in and out of the doors with it, down the stairs to the stockpile at the camp. The
  // workings' grey spoil lies by each door. The deep face's cave under the crest is boarded up since its ore came up grey.
  prop("cave", 100, 20, { fixed: true });
  // The upper bench: the old mine in the crest's face, in its west corner.
  prop("goldMine", 91, 21, { fixed: true });
  for (const [c, r] of [[88.4, 21.3], [93.3, 21.3]] as const) prop("rock", c, r, { fixed: true });
  // The draws of the crowd that stood here once, so the woods grown after keep their places.
  for (let i = 0; i < 12; i++) rng.next();
  // The crest, split by a gully under the crag: its west half up the west stair, its east half only by the long way round
  // to the east stair, a mine cut into the crag's face on each, and the lookout on the crag's peak, up its stair off the
  // west half, over the sea the ships stopped coming in on.
  prop("watchtower", 97, 13, { fixed: true });
  who("archer", 97, 13.25, { ...blue, perch: 1.85 });
  for (const c of [93, 99]) prop("goldMine", c, 17, { fixed: true });
  for (const [c, r] of [[90.6, 17.4], [101.4, 17.4]] as const) prop("rock", c, r, { fixed: true });
  // The lower bench: the new mine in the corner between the upper bench's face and the sea, and a shed for the tools.
  prop("goldMine", 98, 26, { fixed: true });
  for (const [c, r] of [[95.6, 26.4], [96.3, 27.3]] as const) prop("rock", c, r, { fixed: true });
  prop("house3", 99, 29, blue);
  // The far shelf down the east stair, a step off the lower bench's corner: a mine over the sea.
  prop("goldMine", 104, 24, { fixed: true });
  prop("rock", 106.4, 23.4, { fixed: true });
  // Trees in clumps where the work leaves room: on the crag and its north slope, the east crest's end, the upper bench
  // below the cave, and the lower bench's corners.
  for (const [c, r] of [[95, 12], [99.2, 12.3], [93, 12], [101.6, 13.3], [101, 15], [102.2, 15.3], [101, 22], [102.3, 22.4], [99.2, 23.1],
    [89, 26], [90.2, 26.4], [89.4, 27.2], [101, 28], [102.4, 28.3], [102, 29.2], [93, 32], [94.3, 32.3], [93.6, 33.1]] as const)
    prop("tree", c, r, { fixed: true });
  // The miners' camp at the foot of the bench stair: their houses, the stockpile the diggers bring the gold down to,
  // and a carrier taking it on up the castle road to the forge. The one heap of gold on the hill is here.
  for (const [c, r, art] of [[92, 39, "house1"], [96, 38, "house2"]] as const) prop(art, c, r, blue);
  heap(t, 87, 37);
  for (const [c, r] of [[87, 38], [89, 38], [88, 35], [85, 38]] as const) prop("goldStone", c, r);
  // Each digger rests somewhere of its own about the camp between trips, not in a row.
  who("pawn", 86, 36, { ...blue, act: "dig", to: { col: 91, row: 22 } });
  who("pawn", 90, 35, { ...blue, act: "dig", to: { col: 98, row: 27 }, flip: true });
  who("pawn", 84, 38, { ...blue, act: "dig", to: { col: 104, row: 25 } });
  who("pawn", 89, 39, { ...blue, act: "dig", to: { col: 93, row: 18 }, flip: true });
  who("pawn", 94, 37, { ...blue, act: "dig", to: { col: 99, row: 18 }, flip: true });
  who("pawn", 56, 30, { ...blue, act: "fetch", to: { col: 92, row: 37 }, flip: true });

  // The Old Bridge: Saltreach's toll and trade post, its yellow militia looking over every load that crosses, the
  // carriers waiting their turn.
  prop("fishHut", 14, 39);
  prop("goldStone", 16, 37);
  who("lancer", 10, 43, { color: "yellow", to: { col: 10, row: 41 } });
  who("pawn", 13, 41, { color: "yellow", act: "meat" });
  who("pawn", 15, 43, { ...blue, act: "gold", flip: true });

  // West Fields: a farm on the farm road. The farmstead on its knoll with a copse beside it, paddocks of sheep and
  // pigs, and below them fenced fields in crop rows and fenced pastures, worked by farmhands.
  prop("house3", 16, 55, blue);
  prop("house1", 26, 58, blue);
  t.grove(25, 51, 2.5, 2, 0.9);
  t.fences.push({ col: 8, row: 46, w: 6, h: 4, gate: 2 }, { col: 15, row: 47, w: 5, h: 4, gate: 2 });
  for (const [c, r] of [[9, 47], [11, 48], [10, 48]] as const) who("sheep", c, r);
  for (const [c, r] of [[16, 48], [17, 49]] as const) who("pig", c, r);
  // The pastures, fenced to the fields' own edges, the flocks grazing in them. Every pen on the farm is gated at its foot.
  t.fences.push({ col: 4, row: 68, w: 10, h: 6, gate: 4 }, { col: 16, row: 68, w: 8, h: 5, gate: 3 });
  t.fences.push({ col: 4, row: 61, w: 10, h: 5, gate: 4 }, { col: 16, row: 61, w: 10, h: 5, gate: 4 }, { col: 28, row: 61, w: 9, h: 5, gate: 3 });
  for (const [c, r] of [[8, 71], [10, 70], [7, 72]] as const) who("sheep", c, r);
  butcher(t, 5, 70);
  butcher(t, 12, 72, true);
  for (const [c, r] of [[18, 70], [20, 71], [21, 70]] as const) who("pig", c, r);
  who("pawn", 26, 66, { ...blue, act: "meat", to: { col: 26, row: 60 } });

  // The Graves, after Firelink's graveyard on the slope behind the shrine: the path up from the point crosses the town's
  // own dead and goes down into the Charnel, the Moor Gate at its seaward end, shut from this side. The Grey's dogs,
  // come over the moor and not through the gate, in the Charnel, far past a new captain (three
  // gnolls and a shaman, 45 hp and 9 a blow apiece, two of them throwing). Foes rise again at every rest, so the gate
  // opened from Barrowmoor is what clears the hill for good: the dogs and the walking dead go, and a gravedigger comes up
  // to put it right.
  const held = { unless: "moorGateOpen" } as const;
  // The foot: a lantern either side of the lychgate where the road starts up, the gravedigger's cottage and yard, and a
  // grave half dug.
  for (const [c, r] of [[94, 66], [99, 66]] as const) prop("sconce", c, r);
  prop("house2", 103, 66, blue);
  prop("woodPile", 106, 65);
  prop("tools", 100, 68);
  prop("bones", 99, 67);
  who("pawn", 101, 68, { ...blue, act: "pickaxe", unless: "moorGateOpen" });
  // The town's dead on the slope, a plot either side of the road up: a stake at each grave's head in rows, as every
  // graveyard in the pack's art is marked, a gap between to walk them, bones the dead left climbing out, and a lantern
  // on up to the shoulder. No trees on the hill: a dead tree's art spans a tile each side, over the stakes and the cliffs.
  for (const [c, r] of [[90, 58], [92, 58], [94, 58], [92, 60], [94, 60], [99, 58], [101, 58], [103, 58], [105, 58], [99, 60], [101, 60], [103, 60], [105, 60]] as const) prop("skullSpike", c, r, { fixed: true });
  for (const [c, r] of [[93, 59], [100, 59], [104, 59]] as const) prop("bones", c, r);
  for (const [c, r] of [[100, 61], [91, 56]] as const) prop("sconce", c, r);
  // The dead walk the plots.
  who("skull", 95, 61, { ...held, to: { col: 100, row: 62 } });
  who("skull", 92, 62, { ...held, to: { col: 95, row: 62 } });
  who("gnoll", 100, 55, { ...held, to: { col: 103, row: 55 } });
  prop("goldStone", 97, 62);
  // The crest: the old watch still held, its tower and beacon the highest thing east of the castle, so the fire square
  // sees it, the last of the Moor Watch's bows on its roof, skulls staked at the head of the stair down.
  prop("tower", 100, 44, blue);
  who("archer", 100, 44.25, { ...blue, perch: 1.85 });
  prop("sconce", 103, 44);
  for (const [c, r] of [[107, 45], [108, 46]] as const) prop("skullSpike", c, r);
  who("bat", 97, 45, held);
  // The back shelf, under the crest's west wall: the hill's oldest dead along it, bones the walking dead dropped, and at
  // its dead end the crypt of the house that kept the Watch, its plot before it, one grave robbed and its gold left lying,
  // and one of the Watch's dead still crouched behind his shield over it.
  prop("house1", 99, 42, { color: "black", fixed: true });
  for (const [c, r] of [[92, 49], [92, 50], [93, 52], [95, 41], [97, 41]] as const) prop("skullSpike", c, r, { fixed: true });
  for (const [c, r] of [[95, 43], [93, 46], [94, 51]] as const) prop("bones", c, r);
  who("skullGuard", 94, 41);
  prop("goldStone", 96, 41);
  who("skull", 94, 49, { ...held, to: { col: 94, row: 43 } });
  // Below the shelf on the west, the last two graves dug before the Grey by the stair down, and up the strip the dead
  // who keep them, crouched at their shields with a lane either side.
  for (const r of [44, 48]) who("skullGuard", 90, r);
  for (const [c, r] of [[89, 53], [91, 53]] as const) prop("skullSpike", c, r, { fixed: true });
  for (const [c, r] of [[91, 43], [89, 54]] as const) prop("bones", c, r);
  // Behind the crest, the paupers' field: one row of graves with no names, dug up by robbers come over the moor with
  // the dogs, their hide hut pitched at the far end; gone with the dogs when the gate is opened.
  for (const c of [101, 103, 105]) prop("skullSpike", c, 41, { fixed: true });
  for (const c of [102, 104]) prop("bones", c, 42);
  prop("goblinHut", 107, 42, { ...held, fixed: true });
  who("thief", 101, 42, { ...held, to: { col: 105, row: 42 } });
  // The Charnel: the dogs' den on its floor, graves dug up for the rings and bones flung about. The Moor Gate's
  // barricade at its seaward end, timber stacked by it and a skull staked either side for its posts.
  for (const [c, r] of [[101, 50], [104, 49], [106, 51], [104, 52]] as const) prop("bones", c, r);
  // Their den a hide hut in the floor's west corner, gone with them when the gate is opened.
  prop("goblinHut", 99, 50, { ...held, fixed: true });
  for (const [c, r] of [[103, 51], [106, 50]] as const) who("gnoll", c, r, held);
  who("shaman", 104, 50, held);
  prop("woodPile", 108, 49);
  for (const r of [49, 51]) prop("skullSpike", 109, r, { fixed: true });
  // The gate open, the dead put back and the gravedigger at the plots.
  who("pawn", 96, 60, { ...blue, act: "pickaxe", when: "moorGateOpen", to: { col: 97, row: 62 } });

  // Lantern Point, the lighthouse on the south-east headland at the Graves road's foot, the cove's gold behind it. Dark
  // three winters, with no ship to light in; lit again the day the Warlord falls.
  prop("tower", 101, 71, blue);
  prop("sconce", 99, 72, { when: "warlordDead" });
  prop("house1", 92, 69, blue);
  prop("fishHut", 87, 71);
  who("archer", 99, 75, { ...blue, to: { col: 103, row: 74 } });
  for (const [c, r] of [[91, 78], [98, 78]] as const) prop("boat", c, r, { flip: c > 95 });
  prop("goldStone", 108, 73);
  t.grove(106, 71, 1.5, 1.5, 0.8);
  t.grove(107, 68, 1.5, 1.5, 0.6);

  // Copses in the lowland's corners and between the clusters, so the town sits in a country, not on bare grass.
  for (const [x, y, rx, ry, d] of [[104, 8, 5, 4, 0.7], [6, 34, 3, 3, 0.7], [81, 75.5, 3, 1, 0.6]] as const) t.grove(x, y, rx, ry, d);
  for (const [x, y, rx, ry, d] of [[32, 72, 5, 3, 0.55], [104, 36, 3, 4, 0.6], [8, 30, 4, 4, 0.6], [80, 41, 2.5, 1.5, 0.5]] as const) t.grove(x, y, rx, ry, d);

  // The island is the Lower Town: what stood on its ground before goes, and its own folk and scenery come, as the
  // title screen draws them (introAtlas.ts, widened from X0, shifted down 41).
  const old = (c: number, r: number) => c >= X0 + 1 && c <= X0 + W - 2 && r >= 42 && r <= 59;
  t.props = t.props.filter((p) => !old(p.col, p.row));
  t.dwellers = t.dwellers.filter((d) => !old(d.col, d.row));
  t.fences = t.fences.filter((f) => !old(f.col, f.row));
  const pinned = { fixed: true } as const;
  prop("tower", sx(6.9), 43.9, { ...blue, ...pinned });
  prop("cave", sx(9.5), 48.9, { ...pinned, scale: 0.85 });
  prop("goldMine", sx(18), 43.9, { ...pinned, scale: 0.89 });
  // As the title draws the landfall now: a chapel on the ridge's first terrace, the butts a step above, the barracks on
  // the high terrace (a row down from the title's, whose top row is the high street here), a house at the climb's foot.
  prop("monastery", sx(20), 47.85, { ...blue, ...pinned });
  prop("barracks", sx(10.4), 43.85, { ...blue, ...pinned });
  prop("archery", sx(15.7), 44.85, { ...blue, ...pinned });
  prop("house1", sx(21.8), 52.85, { ...blue, ...pinned });
  prop("house2", sx(19.1), 55.65, { ...blue, ...pinned });
  prop("boat", sx(13.5), 55.6, pinned);
  // The title's trees and stones, less those that land on a stair here, shut a nook off or stand on the causeway.
  for (const [c, r] of [[12.4, 3.6], [2.8, 10.4], [20.8, 4.8], [22.4, 6.2], [23, 8], [12.4, 10.8], [7, 10.2], [4.4, 15.4]] as const) prop("tree", sx(c), 41 + r, pinned);
  for (const [c, r] of [[9.4, 10.6], [6.4, 10.6], [18.6, 12.5], [3.3, 12.6], [21.4, 10.6], [6.3, 6.6]] as const) prop("bush", sx(c), 41 + r, pinned);
  for (const [c, r] of [[23, 11.6], [14.6, 9.7]] as const) prop("rock", sx(c), 41 + r, pinned);
  for (const [c, r] of [[12.2, 16.8], [16.4, 16.4], [8.6, 17.4], [24.6, 17]] as const) prop("waterRock", sx(c), 41 + r, pinned);
  who("monk", sx(11), 53, blue);
  who("pawn", sx(14), 53, { ...blue, flip: true });
  who("warrior", sx(15), 54, { ...blue, flip: true });
  who("pawn", sx(17), 45, { ...blue, act: "pickaxe", flip: false });
  who("pawn", sx(18), 48, { ...blue, act: "gold", to: { col: sx(16), row: 48 } });
  who("pawn", sx(21), 56, { ...blue, act: "hammer", flip: true });
  who("archer", sx(8), 50, blue);
  who("lancer", sx(5), 54, { ...blue, to: { col: sx(8), row: 54 } });
  who("warrior", sx(18), 49, { ...blue, to: { col: sx(16), row: 49 } });
  for (const [c, r] of [[4, 52], [5, 53], [22, 51], [21, 50]] as const) who("sheep", sx(c), r);
  // The hill's west foot: a hamlet on the shelf, and a watchtower on the shore spur looking over the bay to the farm.
  for (const [c, r, art] of [[34, 49, "house1"], [38, 49, "house3"], [36, 52, "house2"]] as const) prop(art, c, r, blue);
  prop("watchtower", 31, 55, pinned);
  who("archer", 30, 54, blue);
  // The island's terraces carried round the bay's upper curve, the shore left as it lies: the west terrace down to the
  // north-west corner, its stair moved to the beach, and the east plateau out to the square.
  // Each row a run of its own length, so the cliffs step in and out like the island's.
  const raised = [[51, 36, 41], [52, 35, 40], [53, 35, 39], [54, 36, 39], [55, 37, 38], [48, 62, 64], [49, 61, 65], [50, 62, 64], [51, 63, 65]] as const;
  const under = (c: number, r: number) => raised.some(([y, a, b]) => r === y && c >= a && c <= b);
  t.blocks = t.blocks.filter((b) => !(b.level === 1 && under(b.x, b.y)));
  t.ways = t.ways.filter((w) => !(w.col === 38 && w.row === 51));
  for (const [y, a, b] of raised) t.block(2, a, y, b - a + 1, 1);
  t.block(1, 40, 54, 1, 1);
  t.stair(2, 40, 54, "R");

  // The fire square at the island's east foot, the hub: the Harbour's bonfire on its paving, a lancer,
  // the shore street leaving it south.
  for (const r of [46, 48, 50]) t.road([66, r], [75, r]);
  t.fences.push({ col: 79, row: 47, w: 4, h: 3 });
  t.grove(80.5, 48, 0.8, 0.6, 1);
  who("lancer", 69, 45, blue);

  // The village down the bay's east coast, on the one shore street from the fire to the lighthouse, lit by lanterns:
  // its head between a house and the garrison, houses down both sides, the docks, the market and Maren's pier on the
  // bay side, and the burned east lane where it turns for the point.
  for (const [c, r] of [[73, 52], [73, 57], [72, 64], [76, 69]] as const) prop("sconce", c, r);
  prop("house1", 68, 53, blue);
  prop("house3", 69, 56, blue);
  prop("fishHut", 75, 55);
  // A fish hut on stilts in the pond above Maren's post.
  prop("fishHut", 64, 58, pinned);
  for (const [c, r, art] of [[75, 58, "house2"], [75, 62, "house1"], [76, 66, "house3"]] as const) prop(art, c, r, blue);
  // A trader for each road opened, so the market by the docks fills as the captain's work goes on: Saltreach's fish
  // once the bull is beaten, ore down from the hills once the troll is dead.
  who("pawn", 68, 58, { color: "yellow", act: "meat", when: "bullWon", to: { col: 70, row: 58 } });
  who("pawn", 69, 63, { ...blue, act: "gold", when: "trollKey" });
  // The village builds: hammers at the houses down the street, timber carried down to them.
  who("pawn", 71, 56, { ...blue, act: "hammer", flip: true });
  who("pawn", 73, 58, { ...blue, act: "hammer", flip: false });
  who("pawn", 75, 66, { ...blue, act: "hammer", flip: true });
  who("pawn", 73, 60, { ...blue, act: "wood", to: { col: 73, row: 55 } });

  // The east lane, the village's last houses before the point, taken in the first nights: the taken carried its folk
  // off to the Gallows Yard and burned what they left. Its doors stay shut and no one walks it; the Warlord dead, they
  // come home.
  for (const [c, r, art] of [[65, 69, "house1"], [69, 69, "house2"], [67, 72, "house3"]] as const) prop(art, c, r, blue);
  for (const [c, r, art] of [[79, 70, "house1"], [83, 70, "house3"]] as const) prop(art, c, r, blue);
  const home = { ...blue, when: "warlordDead" } as const;
  who("pawn", 66, 70, home);
  who("pawn", 70, 71, { ...home, act: "hammer", flip: true });

  const exits: AreaExit[] = [
    { to: "saltreach", name: "Old Bridge", kind: "open", at: { col: 1, row: 42 } },
    { to: "barrowmoor", name: "Moor Gate", kind: "shortcut", at: { col: 109, row: 50 }, shut: "moorGateOpen" },
    { to: "emberwood", name: "Ember Gate", kind: "gate", at: { col: 26, row: 1 }, shut: "emberGateOpen" },
    { to: "chapel", name: "The Old Lift", kind: "shortcut", at: { col: 63, row: 41 }, shut: "oldLiftDown" },
    { to: "chapel", name: "The Sisters' Stair", kind: "gate", at: { col: 35, row: 29 }, shut: "sistersStair" },
    { to: "burg", name: "Burg Gate", kind: "open", at: { col: 55, row: 8 } },
    { to: "undercroft", name: "The Old Well", kind: "drop", at: { col: Math.round(sx(10)), row: 50 } },
    { to: "ring", name: "The Boat", kind: "lift", at: { col: 62, row: 61 } },
  ];
  // One shade by height over the whole Harbour, as the title paints its island: salt grass by the sea, greening up the
  // hills to a gold capital. Only the fenced crops and the Graves keep colours of their own.
  const ramp = [5, 3, 2, 1, 1];
  const districts: District[] = [
    { name: "The Upper Town", at: { col: 55, row: 28 }, levels: [2, 3], palette: ramp, dress: "harbour", decor: 2 },
    { name: "Old Town", at: { col: 60, row: 39 }, levels: [2], palette: ramp, dress: "harbour", decor: 2 },
    { name: "The Chapel Close", at: { col: 45, row: 22 }, levels: [3], palette: ramp, dress: "chapel", decor: 1.5 },
    { name: "The Lower Town", at: { col: Math.round(sx(13)), row: 53 }, levels: [1], palette: ramp, dress: "harbour", decor: 0 },
    { name: "Lookout Hill", at: { col: Math.round(sx(13)), row: 46 }, levels: [2, 3, 4, 5], palette: ramp, dress: "harbour", decor: 0 },
    { name: "The Docks", at: { col: 56, row: 75 }, levels: [1], palette: ramp, dress: "saltreach", decor: 2 },
    { name: "West Fields", at: { col: 16, row: 60 }, palette: ramp, dress: "harbour", decor: 1 },
    // The fields and pastures, on the farm's own green (painted patches read as flat colour): the fields drawn in crop
    // rows, each fenced, a track between; unnamed, so no label sits on them.
    ...([[4, 61, 10, 5, true], [16, 61, 10, 5, true], [28, 61, 9, 5, true], [4, 68, 10, 6, false], [16, 68, 8, 5, false]] as const).map(([x, y, w, h, crops]): District => ({ name: "", at: { col: x + (w >> 1), row: y + (h >> 1) }, palette: [3], dress: "harbour", decor: 0.4, crops, box: { x, y, w, h } })),
    { name: "The Northwood", at: { col: 18, row: 30 }, levels: [1, 2, 3], palette: ramp, dress: "emberwood", decor: 1.5, groves: true },
    { name: "Mine Hills", at: { col: 95, row: 26 }, levels: [1, 2, 3, 4], palette: ramp, dress: "crags", decor: 2.5, trees: 0.06 },
    { name: "Lantern Point", at: { col: 97, row: 71 }, levels: [1], palette: ramp, dress: "saltreach", decor: 1.5 },
    { name: "The Burg Gate", at: { col: 55, row: 11 }, levels: [2, 3, 4, 5], palette: ramp, dress: "harbour", decor: 0 },
    // Down into the Charnel the ground darkens a shade a height: the crest as the hill has it, the ledge teal, the
    // floor the web's dimmed teal (6), darker than any ground outside.
    { name: "The Charnel", at: { col: 104, row: 49 }, palette: [6, 6, 5, 4], dress: "barrowmoor", decor: 1, trees: 0, gloom: true, box: { x: 98, y: 45, w: 12, h: 9 } },
    // The Graves alone of the Harbour's hills keep no green: dead grass from the lychgate to the crest, the town's own
    // greens stopping at its foot.
    { name: "The Graves", at: { col: 100, row: 56 }, levels: [1, 2, 3, 4], palette: [4], dress: "barrowmoor", decor: 1.5, trees: 0, gloom: true },
  ];
  // Messages on the ground, after the Souls games: at the Old Well's cave, on the pier, at the Graves road's foot and on
  // the Watch's rock, and on the boards over the Mine Hills' deep face.
  const notes: Note[] = [
    { at: { col: Math.round(sx(9)), row: 51 }, text: "The Old Well, sunk in the hill's cave. A rope down; no way back up." },
    { at: { col: 63, row: 59 }, text: "Seek church ahead" },
    { at: { col: 95, row: 67 }, text: "Our own dead up there. The dogs came over the hill, not through the gate. Not yet." },
    { at: { col: 102, row: 45 }, text: "Three winters on this rock. The beacon stays lit. Someone has to see it." },
    { at: { col: 98, row: 21 }, text: "SHUT. The rock is grey past here. Do not dig it. - D." },
  ];
  const tier = unnotch(t.finish({}, [{ col: 71, row: 49 }]));
  // The bridge is the island's own ground run out to the landing, not half Old Town's.
  const districtAt = districtGrid(tier, districts, t);
  const rim = districtAt[45]![59]!;
  for (const d of decks) districtAt[d.row] = districtAt[d.row]!.slice(0, d.col) + rim + districtAt[d.row]!.slice(d.col + 1);
  return { ...tier, area: "harbour", entry: { col: 71, row: 49 }, exits, districts, districtAt, decks: [...decks, ...keepBridge, ...sistersBridge], streets: true, notes };
}

/**
 * The Emberwood (docs/world/emberwood/design.md): two storeys cut by one river. The floor is the burnt maze; the Boughs are the
 * goblins' tables standing out of the smoke, joined by plank walks; the Ember Run splits the Harbour's bank from the
 * goblins', met only at its crossings. In off the Belfry at the Postern Crag, out by the Ash Road to the bull.
 */
function emberwood(): AreaMap {
  const rng = makeRng("area:emberwood");
  const t = tierBuilder("surface", rng, { cols: 128, rows: 72 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  t.blob("emberwood", 56, 36, 52, 31);
  t.blob("emberwood", 22, 52, 18, 14);
  t.blob("emberwood", 18, 20, 16, 15);
  t.blob("emberwood", 96, 16, 14, 12);
  t.blob("emberwood", 114, 18, 13, 8);
  t.blob("emberwood", 110, 58, 16, 12);
  lake(t, 6, 6, 12, 9);
  // The Ember Run, edge to edge: the Pine Ford, the Treetop Walk, the Cinder Ford and the East Bridge are the crossings.
  river(t, [[0, 42], [18, 38], [34, 37], [50, 40], [66, 38], [82, 32], [98, 34], [127, 30]], 3);
  lake(t, 11, 58, 4, 3);

  // The Boughs. Warren Hill in two heights and Smoke Bluff across the Run, the Treetop Walk between them over the water.
  t.shape(2, 25, 23, 12, 10, 0.45, "Warren Hill");
  t.shape(3, 25, 20, 7, 5, 0.4, "Warren Hill");
  t.shape(2, 26, 46, 8, 5, 0.4, "Smoke Bluff");
  const treetop = t.span(2, 27, 32, 2, 10);
  // The Chief's Mound in the Burn, and the Ash Walk off it east onto the Postern Crag's first step.
  t.shape(2, 78, 56, 7, 5, 0.4, "The Burn");
  // The Postern Crag: the Belfry's stair lands on its crown, and it steps down in three ledges to the floor.
  t.shape(2, 111, 60, 11, 7, 0.3, "Postern Crag");
  t.shape(3, 112, 58, 7, 4.5, 0.25, "Postern Crag");
  t.shape(4, 113, 56, 3.5, 2, 0.15, "Postern Crag");
  const ashWalk = t.span(2, 85, 56, 15, 2);
  // Crag Foot: the rock rising in the north-east, two steps toward the Crags.
  t.shape(2, 92, 14, 11, 7, 0.45, "Crag Foot");
  t.shape(3, 93, 11, 6, 4, 0.4, "Crag Foot");

  // Old Pines thick in the south-west, the north wood under the Ash Road, copses in the east.
  t.grove(14, 56, 12, 12, 0.75);
  t.grove(36, 8, 16, 4, 0.6);
  t.grove(84, 44, 9, 5, 0.45);
  t.grove(44, 52, 6, 5, 0.4);

  // The gate road north over the Cinder Ford and up the Ash Road; the crag road east to Crag Foot; the Burn's road
  // round the mound to the crag's foot, and its track north over the East Bridge.
  t.road([40, 64], [40, 56], [44, 46], [44, 34], [52, 28], [62, 25], [62, 8]);
  edgeWay(t, { col: 62, row: 8 }, { col: 62, row: 1 });
  t.road([52, 28], [76, 24], [88, 26], [100, 20]);
  t.road([40, 56], [62, 54], [76, 48], [88, 40], [88, 26]);
  t.road([62, 54], [68, 64], [92, 65], [100, 64]);
  t.bridge({ col: 44, row: 35 }, { col: 44, row: 43 }, 3);
  t.bridge({ col: 13, row: 34 }, { col: 13, row: 41 }, 2);
  t.bridge({ col: 88, row: 28 }, { col: 88, row: 37 }, 3);
  t.bridge({ col: 40, row: 64 }, { col: 40, row: 70 }, 3);
  t.road([28, 33], [28, 40]);

  // Postern Crag: the steward came this way with the Keep's key; his escort fell on the second ledge.
  for (const [c, r] of [[106, 56], [118, 60], [103, 63]] as const) prop("deadTree", c, r, { scale: 0.7 });
  prop("bones", 109, 59);
  prop("bones", 111, 60);
  crowd(t, rng, "spear", { col: 105, row: 61 }, 3, 2);

  // The Burn: the goblins' war camp in the ash, huts round one great fire, the plunder on the Chief's Mound.
  for (const [c, r] of [[64, 50], [70, 47], [66, 60], [86, 52], [88, 60]] as const) prop("goblinHut", c, r);
  for (const [c, r] of [[60, 46], [72, 64], [86, 48], [58, 60], [92, 54]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[62, 62], [68, 44], [84, 62], [90, 50]] as const) prop("stump", c, r);
  t.campfires.push({ col: 68, row: 52 });
  crowd(t, rng, "torch", { col: 68, row: 51 }, 6, 6);
  crowd(t, rng, "thief", { col: 66, row: 58 }, 2, 4);
  who("shaman", 77, 55);
  who("gnoll", 80, 57, { to: { col: 75, row: 57 } });
  for (const [c, r] of [[78, 54], [79, 54]] as const) prop("goldStone", c, r);

  // The Palisade: the Harbour's lumber camp at the gate, overrun. Goblins camp in it in threes until the gate opens
  // (Garth and Dunn are in npcs.ts).
  t.campfires.push({ col: 43, row: 61 });
  t.fences.push({ col: 45, row: 60, w: 6, h: 2 });
  prop("tower", 36, 64, blue);
  prop("house1", 47, 65, blue);
  for (const [c, r] of [[34, 56], [37, 53], [48, 57], [51, 62]] as const) prop("stump", c, r);
  for (const [c, r] of [[33, 63], [50, 58]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[42, 59], [44, 59], [43, 58]] as const) who("torch", c, r, { unless: "emberGateOpen" });
  for (const [c, r] of [[37, 57], [38, 58], [36, 58]] as const) who("spear", c, r, { unless: "emberGateOpen" });

  // Old Pines: the one stand the goblins have not burnt. The hermit's hut by the pool, beasts, gold behind the bears.
  prop("house3", 18, 60, { color: "purple" });
  who("bear", 10, 48, { to: { col: 20, row: 46 } });
  who("bear", 6, 64);
  who("turtle", 13, 61);
  for (const [c, r] of [[8, 52], [22, 54]] as const) who("bee", c, r, { to: { col: c + 4, row: r - 2 } });
  prop("goldStone", 4, 66);

  // Smoke Bluff: the gnolls' perch over the Run, the Treetop Walk's south end.
  for (const [c, r] of [[22, 46], [31, 47]] as const) prop("goblinHut", c, r);
  for (const [c, r] of [[24, 44], [30, 44]] as const) who("gnoll", c, r, { to: { col: c, row: r + 3 } });
  crowd(t, rng, "spear", { col: 26, row: 48 }, 3, 2);
  prop("skullSpike", 26, 43);

  // Warren Hill: warrens on both heights, the hoard on the crest, a slinger on the walk, a watchtower over its end.
  for (const [c, r] of [[18, 26], [24, 30], [33, 27], [20, 20], [30, 20], [25, 16]] as const) prop("goblinHut", c, r);
  t.campfires.push({ col: 26, row: 24 });
  crowd(t, rng, "torch", { col: 25, row: 24 }, 5, 6);
  who("slingshot", 27, 35, { to: { col: 28, row: 39 } });
  who("shaman", 27, 21);
  prop("watchtower", 31, 30);
  for (const [c, r] of [[24, 18], [26, 18]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[20, 23], [33, 23], [23, 33], [22, 31], [31, 33]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[19, 28], [31, 21]] as const) prop("meat", c, r);
  for (const [c, r] of [[22, 28], [29, 22]] as const) prop("woodPile", c, r);

  // Cinder Ford: the wood's one bonfire, on the north bank where the Ash Road starts; goblins watch the crossing.
  t.fires.push({ col: 48, row: 31 });
  who("lizard", 50, 39, { to: { col: 60, row: 38 } });
  prop("goblinHut", 50, 46);
  crowd(t, rng, "spear", { col: 48, row: 45 }, 3, 2);

  // The Ash Road: the goblins' way north to the bull they feed, its skulls and its watch; halfway, the steward's end.
  for (const [c, r] of [[59, 24], [65, 24], [59, 12], [65, 12]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[60, 18], [64, 20]] as const) who("spear", c, r);
  prop("deadTree", 58, 18, { scale: 0.7 });
  prop("bones", 64, 15);

  // Crag Foot: the gnome prospectors cut off on their rock, gold in its seams, a goblin post where the road leaves the wood.
  prop("gnomeHut", 92, 10);
  prop("gnomeTower", 98, 14);
  crowd(t, rng, "gnome", { col: 94, row: 12 }, 3, 3);
  who("gnome", 104, 19, { to: { col: 96, row: 22 } });
  for (const [c, r] of [[86, 8], [100, 8], [108, 14]] as const) prop("goldStone", c, r);
  prop("goblinHut", 80, 26);
  crowd(t, rng, "torch", { col: 82, row: 27 }, 3, 2);
  prop("skullSpike", 78, 24);

  // The Drawn Plank: the Treetop Walk barred at its north end, dropped for good from Warren Hill's side.
  const locks = [{ name: "The Drawn Plank", cells: [{ col: 27, row: 35 }, { col: 28, row: 35 }], flag: "drawnPlankDown", from: { col: 28, row: 32 } }];
  const notes: Note[] = [
    { at: { col: 111, row: 55 }, text: "Keep Gate barred behind me. The key is on my belt. The wood road round to Lanternport, then." },
    { at: { col: 38, row: 61 }, text: "Ran for the gate. They barred it with us still outside. Can't blame them." },
    { at: { col: 63, row: 16 }, text: "Goblins on the ford. Round by the north road. Something big breathing in the smoke." },
  ];

  const districts: District[] = [
    // One wood floor, so district borders never cut the forest into patches; only raised ground changes colour,
    // following its cliffs. The Burn is scorched by its dead trees, its mound ash.
    { name: "The Palisade", at: { col: 40, row: 61 }, levels: [1], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Old Pines", at: { col: 12, row: 52 }, levels: [1], palette: [3], dress: "emberwood", decor: 1.5 },
    { name: "Smoke Bluff", at: { col: 26, row: 46 }, levels: [2], palette: [1], dress: "emberwood", decor: 2 },
    { name: "Warren Hill", at: { col: 24, row: 17 }, levels: [2, 3], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Cinder Ford", at: { col: 48, row: 34 }, levels: [1], palette: [3], dress: "emberwood", decor: 2 },
    { name: "The Ash Road", at: { col: 62, row: 16 }, levels: [1], palette: [3], dress: "greyfall", decor: 2 },
    { name: "The Burn", at: { col: 72, row: 54 }, levels: [1, 2], palette: [3, 1], dress: "greyfall", decor: 2 },
    { name: "Crag Foot", at: { col: 94, row: 22 }, levels: [1, 2, 3], palette: [3], dress: "emberwood", decor: 2 },
    { name: "Postern Crag", at: { col: 110, row: 62 }, levels: [1, 2, 3, 4], palette: [3], dress: "crags", decor: 1 },
  ];
  const rooms = districts.map((d) => ({ at: d.at, r: d.clearing ?? 6 }));
  const tier = t.finish({}, [{ col: 40, row: 64 }], maze(t, rng, rooms));
  const exits: AreaExit[] = [
    { to: "harbour", name: "Ember Gate", kind: "gate", at: { col: 40, row: 70 }, opens: "emberGateOpen" },
    { to: "belfry", name: "The Postern", kind: "open", at: { col: 113, row: 55 } },
    { to: "trollpit", name: "The Ash Road", kind: "open", at: { col: 62, row: 1 } },
  ];
  return { ...tier, area: "emberwood", entry: { col: 40, row: 64 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [...treetop, ...ashWalk], notes, locks };
}

const MOUNTAIN = [4, 3, 2, 1, 1] as const;

/**
 * The Tinker Rock, drawn: the gnomes' steps cut back north one above the other, Tinker Town's ground the first. The
 * climb switches back, every stair at the far end of its ledge from the last: on at the Works' west end, up at its
 * east, up at the Batteries' west, up at the Wheel Step's east onto the Bridgehead. The Hoist joins the Works' west end
 * to the Batteries' straight under the Wheel Step's stair. The Workshop knob to the north-west and the East Ridge to
 * the east stand apart on the fourth height, reached by gantries; the ridge steps down its south end to the Foothills.
 */
const TINKER_ROCK = [
  "wwwwwwwwwwwwwwwwwwwwwwwwwww555wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwwwwwwwwwwwwww555wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwwwwwwwwwwwwww555wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "wwww44444444wwwwwwwwwwwwwww555wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "www444444444wwwwwwwwww5555w555wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "www4444444444wwwwwww555555555555wwww55wwwwwwwwwwwwwwwwwwwwww",
  "wwww444444444wwwwwww555555555555555555555wwwwwwwwwwwwwwwwwww",
  "www4444444444wwwww55555555555555555555555wwwwwwwwwwwwwwwwwww",
  "www4444444444wwwww55555555555555555555555wwwwwwwwwwwwwwwwwww",
  "wwww444444444wwwwww5555555555555555555555wwwwwwwwwwwwwwwwwww",
  "www4444444444wwwwww5555555555555555555555wwwwwwwwwwwwwwwwwww",
  "www444444444wwwwwwww5555555555555555555554444wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwwwwwww5555555555555555555554444wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwww444ww55555555555555555555554444wwwwwwwwwwwwwww",
  "wwwwwwwwww44444444455555555555555555555554444wwwwwwwwwwwwwww",
  "wwwwwwwwwww4444444445544455544455555555554444wwwwwwwwwwwwwww",
  "...........444444444444445554445555555555)444wwwww444444^^##",
  "..........44444444444444444444444444444444444wwwww444444^^##",
  "......^^^^44444444444444444444444444444444444wwwww444444^^##",
  ".....^^^^^44444444444444444444444444444444444www#^444444^^##",
  "....^^^^^^44444444444444444444444444444444444www#^444444^^##",
  "...^^^^^^^44444444444444444444444444444444444www#^444444^^#>",
  "...^^^^^^^44444444444444444444444444444444444www#^444444^^##",
  "...^^^^^^^444444^^^^^^4444^^^444444^^^4444444www#^444444^^##",
  "....^^^^^{4444^^^^^^^^^^^^^^^^^4444^^^4444444www#^444444^^##",
  "....^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^www#^444444^^##",
  ".....^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^www#^444444^^##",
  ".....^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##w#^444444^^##",
  "...#^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^##w#^444444}^##",
  "...#^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^]#w#^^^^^^^^^##",
  "..##^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^###w#^^^^^^^^^##",
  "..##^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^###w#^^^^^^^^^##",
  "..##^^^^^^^^^^^^#####^^^^^^^^^^^^^^^^^^^^^^^#www#^^^^^^^^^##",
  "..#[^^^^^^^^^^#######^^^^########^^^^###^^^^#www#^^^^^^^^^##",
  "..#######^^^#################################www#^^^^^^^^^]#",
  "..###########################################www############",
  "...##########################################www############",
  "...##########################################www############",
  "..###########################################www############",
  "#############################################...############",
  "#############################################..<############",
  "..###########################################...............",
  "....###...###################################...............",
  "..........############...####################...............",
  ".........<############...#####....####...####...............",
  ".............####.........###...............................",
];

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
  // Land under the Workshop knob and the East Ridge, where the sea would take it, and the summit path out to the Peak.
  t.ground("crags", 47, 2, 13, 11);
  t.ground("crags", 92, 14, 15, 28);
  edgeWay(t, { col: 74, row: 6 }, { col: 74, row: 1 }, 5, true);

  stamp(t, TINKER_ROCK, 46, 0);
  // Sea under the Sky Bridge: the shore ends at the ridge's stair, not in a dead end under the deck.
  t.pond(92, 11, 18, 7);
  // The gantries: timber decks on the fourth height out to the Workshop and the East Ridge, and the Sky Bridge, the
  // same made long, off the Bridgehead on the fifth.
  const decks = [...t.span(4, 56, 12, 2, 2), ...t.span(4, 91, 19, 5, 2), ...t.span(5, 87, 9, 24, 2)];

  // The foothills south-east, a knoll in the grove, and the West Shoulder over the bamboo.
  t.relief({ area: "crags", at: { col: 80, row: 64 }, rx: 9, ry: 4, levels: 2 });
  t.relief({ area: "crags", at: { col: 12, row: 30 }, rx: 6, ry: 5, levels: 2 });
  t.relief({ area: "crags", at: { col: 36, row: 26 }, rx: 7, ry: 5, levels: 3, core: { at: { col: 36, row: 25 }, r: 1.6 } });

  // Roads: in from the Crag Stair to the foot of the climb, Tinker Town, the grove and round to the shore; the town's
  // alley north off its square to the first stair.
  t.road([2, 46], [20, 46], [36, 56], [45, 57]);
  t.road([36, 56], [36, 63], [70, 63], [98, 57]);
  t.road([20, 46], [20, 26]);
  for (const c of [50, 51]) t.road([c, 61], [c, 47], [54, 45]);
  t.bridge({ col: 6, row: 46 }, { col: 1, row: 46 }, 3);
  const pinned = { fixed: true } as const;

  // Crag Gate: the old toll on the goods going up, a watch now on what comes up. A tower either side of the road, the
  // toll hut, lanterns at the stair head, the first fire.
  t.fires.push({ col: 10, row: 49 });
  for (const c of [8, 14]) prop("gnomeTower", c, 42, pinned);
  for (const [c, r] of [[5, 40], [18, 52], [3, 51]] as const) prop("rock", c, r);
  for (const [c, r] of [[12, 53], [17, 40]] as const) prop("bush", c, r);
  prop("gnomeHut", 16, 49);
  prop("woodPile", 17, 44);
  for (const r of [44, 48]) prop("sconce", 4, r, pinned);
  who("gnome", 9, 44, { to: { col: 16, row: 46 } });

  // The Bamboo Grove: pandas in the thicket, their old one's cubs, the bees' bones; the cane they cut for the gnomes'
  // gantry poles stacked where it was never fetched; two guns on the Shoulder's crown.
  for (const [c, r] of [[16, 22], [24, 24], [19, 30]] as const) who("panda", c, r, { to: { col: c + 3, row: r + 2 } });
  for (const [c, r] of [[10, 36], [28, 34]] as const) who("bee", c, r, { to: { col: c + 3, row: r - 2 } });
  for (const [c, r] of [[14, 26], [26, 28], [22, 31], [9, 32]] as const) prop("bones", c, r);
  for (const [c, r] of [[31, 31], [33, 31], [30, 20]] as const) prop("logPile", c, r);
  for (const c of [34, 38]) prop("cannon", c, 24);
  for (const [c, r] of [[36, 27], [11, 29]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[6, 30], [40, 22]] as const) prop("rock", c, r);

  // Tinker Town at the rock's foot, after Lanternport: the main street in two rows of huts, broken by the square with
  // the fire and the town's great tree; an alley north off the square to the first stair, lanterns paired up it; a
  // tinkers' yard either side of the alley's foot, full of gear for a lift that does not run.
  t.fires.push({ col: 48, row: 63 });
  for (const c of [28, 32, 36, 40, 58, 62, 66, 70]) prop("gnomeHut", c, 60, pinned);
  for (const c of [28, 32, 36, 40, 44, 54, 58, 62, 66]) prop("gnomeHut", c, 67, pinned);
  for (const c of [42, 56]) prop("gnomeTower", c, 57, pinned);
  prop("tree", 50.5, 65.6, { scale: 1.6, fixed: true });
  for (const r of [49, 52, 55]) for (const c of [47, 54]) prop("gnomeHut", c, r, pinned);
  for (const r of [48, 54]) for (const c of [49, 52]) prop("sconce", c, r, pinned);
  for (const r of [62, 65]) for (const c of [30, 38, 60, 68]) prop("sconce", c, r, pinned);
  t.fences.push({ col: 32, row: 49, w: 6, h: 3 }, { col: 62, row: 51, w: 6, h: 3 });
  for (const [art, c, r] of [["tools", 33, 50], ["woodPile", 36, 50], ["logPile", 63, 52], ["tools", 66, 52], ["goldStone", 65, 52]] as const) prop(art, c, r, pinned);
  crowd(t, rng, "gnome", { col: 48, row: 62 }, 7, 9);
  for (const [c, r, to] of [[33, 56, [44, 61]], [64, 55, [53, 62]], [50, 58, [52, 46]]] as const) who("gnome", c, r, { to: { col: to[0], row: to[1] } });

  // The mine cut into the Works' face at the town's back, its ore carried out to the heap and stacked for a lift that
  // no longer takes it.
  prop("goldMine", 69, 44, pinned);
  heap(t, 72, 47);
  for (const [c, r] of [[71, 46], [74, 48], [70, 48]] as const) who("gnome", c, r, { to: { col: 69, row: 45 } });
  for (const [c, r] of [[66, 49], [78, 46]] as const) prop("rock", c, r);

  // The Works, the second step: the miners' huts along its back, ore, a battery the length of the rim, the first
  // slingers turned down the stair.
  for (const c of [55, 59, 63, 80, 84]) prop("gnomeHut", c, 37, pinned);
  for (const [c, r] of [[62, 39], [80, 40], [88, 36], [67, 38]] as const) prop("goldStone", c, r);
  prop("woodPile", 74, 37);
  for (const [c, r] of [[77, 38], [70, 37]] as const) prop("tools", c, r);
  for (const c of [58, 62, 66, 72, 78, 82, 88]) prop("cannon", c, 42);
  crowd(t, rng, "gnome", { col: 70, row: 39 }, 3, 3, { walk: false });
  who("slingshot", 82, 39, { to: { col: 88, row: 39 } });
  who("slingshot", 58, 40, { to: { col: 64, row: 40 } });
  // The Hoist's foot on the Works' west strip, its tower, the stair up barred from the Batteries.
  prop("gnomeTower", 51, 38);
  // The rock's west face over the grove, a wall walk: guns out over the bamboo, a lantern at the Hoist's foot. Under
  // it the cane yard, where the bamboo-folk stacked gantry poles for the gnomes and still do; scree off the face, a
  // stand of cane by the stream.
  for (const [c, r] of [[50, 22], [51, 30], [47, 39]] as const) prop("cannonSide", c, r);
  prop("sconce", 48, 35, pinned);
  for (const [c, r] of [[42, 37], [44, 38], [42, 40], [44, 41]] as const) prop("logPile", c, r);
  who("panda", 40, 39, { to: { col: 45, row: 40 } });
  for (const [c, r] of [[49, 18], [48, 24], [49, 27], [47, 30], [46, 43]] as const) prop("rock", c, r);
  for (const [c, r] of [[45, 21], [46, 27], [44, 31]] as const) prop("bush", c, r);
  t.grove(43, 23, 3, 4, 0.55);

  // The Batteries, the third step, a garrison in one line: the slingers' huts and stores along the back, the gun line
  // along the rim, a tower at each end.
  for (const c of [52, 55, 58, 61, 64, 67, 70, 73, 76, 79, 82, 85, 88]) prop("cannon", c, 30);
  for (const c of [60, 66, 72, 78]) prop("gnomeHut", c, 26, pinned);
  prop("gnomeTower", 52, 20);
  prop("gnomeTower", 85, 26, pinned);
  prop("gnomeHut", 88, 27);
  for (const c of [54, 63]) prop("woodPile", c, 27);
  for (const c of [57, 69, 75, 81, 87]) prop("rock", c, 28);
  who("slingshot", 60, 28, { to: { col: 72, row: 28 } });
  who("slingshot", 76, 29, { to: { col: 88, row: 29 } });
  who("slingshot", 52, 25, { to: { col: 52, row: 31 } });

  // The Wheel Step: the wheel-keepers' huts along the back, the wheel's timbers laid out where the gnomes cut them
  // loose, guns on the rim, the slingers' last post at its east end.
  for (const c of [60, 64, 68]) prop("gnomeHut", c, 18, pinned);
  for (const [c, r] of [[60, 21], [66, 20]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[62, 20], [70, 21], [73, 20]] as const) prop("logPile", c, r);
  for (const [c, r] of [[70, 19], [78, 21], [75, 22]] as const) prop("bones", c, r);
  for (const c of [62, 66, 74, 80, 86]) prop("cannon", c, 22);
  prop("gnomeTower", 85, 19, pinned);
  for (const [c, r] of [[71, 19], [77, 20]] as const) prop("tools", c, r);
  who("slingshot", 83, 20, { to: { col: 87, row: 22 } });

  // The Workshop on its knob: the master tinker's yard, the half-built cage in it, wood and tools.
  t.fences.push({ col: 50, row: 4, w: 5, h: 3 });
  prop("gnomeHut", 51, 9, pinned);
  prop("woodPile", 56, 5);
  prop("tools", 56, 8);
  prop("logPile", 52, 5);
  prop("rock", 57, 10);

  // The Bridgehead: the fire, the gnomes' towers and toll huts either side of the summit path's foot, lanterns up the
  // path; guns on the south rim; the gatehouse over the Sky Bridge held by gnolls come over from Greyfall, the toll
  // gnomes' bones in its gate. The gnomes come back up once Old Bamboo falls.
  t.fires.push({ col: 74, row: 11 });
  for (const [c, r] of [[68, 7], [80, 6]] as const) prop("gnomeTower", c, r);
  for (const c of [71, 77]) prop("gnomeHut", c, 7, pinned);
  for (const c of [72, 76]) prop("sconce", c, 5, pinned);
  for (const c of [67, 80, 84]) prop("cannon", c, 14);
  for (const r of [7, 12]) prop("tower", 85, r, { color: "black" });
  for (const r of [9, 11]) prop("cannonSide", 84, r);
  for (const [c, r] of [[83, 8], [86, 13], [82, 12]] as const) prop("bones", c, r);
  who("gnoll", 84, 10, { to: { col: 84, row: 13 } });
  who("gnoll", 86, 11, { to: { col: 83, row: 11 } });
  for (const [c, r] of [[71, 12], [77, 10]] as const) who("gnome", c, r, { when: "bambooDead", to: { col: c, row: r + 2 } });

  // The East Ridge: a watch the length of the ridge, guns over the shore, the watch's hut, slingers on the wind.
  prop("watchtower", 98, 20);
  for (const r of [21, 24, 27]) prop("cannonSide", 100, r);
  prop("gnomeHut", 97, 26, pinned);
  prop("woodPile", 99, 27);
  prop("bones", 98, 31);
  who("slingshot", 98, 22, { to: { col: 98, row: 27 } });

  // The Southern Spur: the gnomes' farms and the far watch over the sea.
  prop("watchtower", 70, 83);
  prop("gnomeHut", 67, 84, pinned);
  prop("sconce", 72, 82);
  for (const [c, r] of [[61, 70], [66, 72]] as const) prop("gnomeHut", c, r);
  prop("logPile", 62, 78);
  for (const [c, r] of [[60, 81], [63, 84], [74, 85]] as const) prop("bush", c, r);
  for (const [c, r] of [[57, 82], [76, 80]] as const) prop("rock", c, r);
  prop("goldStone", 64, 79);
  who("gnome", 66, 80, { to: { col: 74, row: 82 } });

  // The Foothills and the Windward Shore under the ridge: rock and scrub on the road, the fishers' huts and boats.
  for (const [c, r] of [[78, 60], [86, 63]] as const) who("lizard", c, r, { to: { col: c - 6, row: r + 2 } });
  who("snake", 92, 64);
  for (const [c, r] of [[76, 58], [88, 60], [92, 52], [84, 50]] as const) prop("rock", c, r);
  for (const [c, r] of [[80, 56], [90, 58], [74, 61]] as const) prop("bush", c, r);
  prop("bones", 86, 57);
  for (const [c, r] of [[101, 52], [106, 30]] as const) prop("fishHut", c, r, pinned);
  prop("boat", 106, 49, {});
  prop("boat", 110, 36, {});
  prop("logPile", 105, 47);
  prop("rock", 108, 26);
  prop("bones", 107, 22);
  who("turtle", 101, 46);

  const notes: Note[] = [
    { at: { col: 8, row: 48 }, text: "Keep to the road. The guns don't." },
    { at: { col: 15, row: 27 }, text: "They weren't eaten. The cubs just sit with them." },
    { at: { col: 52, row: 30 }, text: "Lift the bar. Save the walk." },
    { at: { col: 53, row: 10 }, text: "Wheel first, cage second, gnome last. Never the other way." },
    { at: { col: 83, row: 11 }, text: "They came over in the fog. Light the guns." },
    { at: { col: 97, row: 22 }, text: "You can see the Citadel from here. It can see you." },
    { at: { col: 68, row: 82 }, text: "Ships? Not in three winters. Watch the bridge instead." },
  ];
  const locks = [{ name: "The Hoist", cells: [{ col: 49, row: 33 }], flag: "hoistOpen", from: { col: 51, row: 31 } }];
  const exits: AreaExit[] = [
    { to: "trollpit", name: "Crag Stair", kind: "open", at: { col: 1, row: 46 } },
    { to: "peak", name: "The Tinker Peak", kind: "open", at: { col: 74, row: 1 } },
    { to: "greyfall", name: "Sky Bridge", kind: "high", at: { col: 110, row: 9 } },
  ];
  const districts: District[] = [
    // The rock's steps share one ramp by height: grass at the foot, green slopes, bare rock, a gold summit.
    { name: "The Bridgehead", at: { col: 76, row: 9 }, levels: [5], palette: MOUNTAIN, dress: "crags", decor: 2 },
    { name: "The Wheel Step", at: { col: 72, row: 20 }, levels: [4], palette: MOUNTAIN, dress: "crags", decor: 2.5 },
    { name: "The Workshop", at: { col: 53, row: 7 }, levels: [4], palette: MOUNTAIN, dress: "crags", decor: 1.5 },
    { name: "The Batteries", at: { col: 70, row: 29 }, levels: [3], palette: MOUNTAIN, dress: "crags", decor: 3 },
    { name: "The Works", at: { col: 72, row: 39 }, levels: [2], palette: MOUNTAIN, dress: "crags", decor: 3 },
    { name: "The East Ridge", at: { col: 99, row: 28 }, levels: [2, 3, 4], palette: MOUNTAIN, dress: "crags", decor: 3 },
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
  t.fences.push({ col: 50, row: 73, w: 5, h: 3 }, { col: 57, row: 73, w: 5, h: 3 });
  for (const [c, r] of [[51, 74], [53, 74]] as const) who("sheep", c, r);
  for (const [c, r] of [[58, 74], [60, 74]] as const) who("pig", c, r);
  crowd(t, rng, "gnome", { col: 56, row: 77 }, 3, 2);
  // A mountain's foot, not a maze: rocky knolls with passes between, a bamboo thicket, scrub on the spur.
  for (const [c, r] of [[14, 34], [40, 48], [24, 56], [86, 70], [70, 76]] as const) {
    t.relief({ area: "crags", at: { col: c, row: r }, rx: 3.5, ry: 2.5, levels: 2, core: { at: { col: c, row: r }, r: 1.2 } });
  }
  t.grove(20, 26, 9, 7, 0.7);
  t.grove(60, 80, 8, 3, 0.3);
  // A rock outcrop standing up from the foot, a step higher than the knolls, and scrub copses in their lee.
  t.relief({ area: "crags", at: { col: 10, row: 54 }, rx: 4.5, ry: 3.5, levels: 3, core: { at: { col: 10, row: 54 }, r: 1.4 } });
  for (const [x, y, rx, ry] of [[16, 46, 3, 3], [100, 56, 4, 3], [28, 62, 4, 2], [80, 74, 3, 2]] as const) t.grove(x, y, rx, ry, 0.75);
  const tier = t.finish({}, [{ col: 6, row: 46 }]);
  return { ...tier, area: "crags", entry: { col: 6, row: 46 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks, notes, locks };
}

/** The Citadel's crag from builder (44, 2): the Lower City (#), the High City (^) and its sunk Champions' Pit, the Warlord's Hall (4)
 *  round its chasm (w), the Grey Keep (5) on its crag in the chasm. */
const CITADEL = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~wwww~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~wwwwwwwwwwwwwwww~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~4444wwww55555555wwww44444~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~4444wwww55555555wwww44444~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~##~~~~~~~~~4444wwww55555555wwww44444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~~4444wwww55555555wwww44444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~~4444wwww5555555544ww44444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~44444wwww55555555)4ww44444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~44444wwww5555555544ww44444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~44444wwww4444444444www4444~~~~~~~~~~~~~~~~~~",
  "##############~~~~~~~~44444wwww4444444444www4444^^^^^^^~~~~~~~~~~~",
  "~~~~~~~######^^^^^^^^^44444wwwwwwwwwwwwwwwww4444^^^^^^^#~~~~~~~~~~",
  "~~~~~~~######^^^^^^^^^444444444444wwww4444444444^^^^^^^#####~~~~~~",
  "~~~~~~~######^^^^^^^^^444444444444444444444444444^^^^^^#####~~~~~~",
  "~~~~~~~#####^^^^^^^^^^444444444444444444444444444^^^^^^^####~~~~~~",
  "~~~~~~######^^^^^^^^^{444444444444444444444444444}^^^^^^####~~~~~~",
  "~~~~~~#####[^^^^^^^^^^444444444444444444444444444^^^^^^^####~~~~~~",
  "~~~~~~######^^^^^^^^^^444444444444444444444444444^^^^^^^####~~~~~~",
  "~~~~~~######^^^^^^^^^^44444444444444444444444444^^^^^^^^####~~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^4444^^^^^^^^^^^^^^^^^^#####~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^]####~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~",
  "~~~~~~~###^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~~",
  "~~~~~~~###^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~~",
  "~~~~~~~###^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^44444^^^^^^^#####~~~~~~",
  "~~~~~~~###^^^^^^^^^^^^^###########^^^^^^^^^444444^^^^^^#####~~~~~~",
  "~~~~~~~######^^^^^^^^^^###########^^^^^^^^{444444^^^^^^######~~~~~",
  "~~~~~~~######^^^^^^^^^^]#########[^^^^^^^^^444444^^^^^^######>~~~~",
  "~~~~~~~#####^^^^^^^^^^^###########^^^^^^^^^^4444^^^^^^^^^^###~~~~~",
  "~~~~~~######^^^^^^^^^^^###########^^^^^^^^^^^^^^^^^^^^^^^^###~~~~~",
  "~~~~~~#####[^^^^^^^^^^^###########^^^^^^^^^^^^^^^^^^^^^^^^##~~~~~~",
  "~~~~~~######^^^^^^^^^^^###########^^^^^^^^^^^^^^^^^^^^^^^^##~~~~~~",
  "~~~~~~######^^^^^^^^^^^###########^^^^^^^^^^^^^^^^^^^^^^^^##~~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#####~~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^###^^^^^^^^^^^^###^^^^^#######~~~~~~",
  "~~~~~~~#####^^^^^^^^^^^^^^^^^^###^^^^^^^^^^^^###^^^^^#######~~~~~~",
  "~~~~~~~########^^^^^###############^^^^^^^^#####^^^^^#######~~~~~~",
  "~~~~~~~########^^^^^###############^^^^^^^^#####^^^^^#######~~~~~~",
  "~~~~~~~###########################[^^^^^^^^]################~~~~~~",
  "~~~~~~~~###########################^^^^^^^^###############~~~~~~~~",
  "~~~~~~~~##################################################~~~~~~~~",
  "~~~~~~######################################################~~~~~~",
  "~~~~~<######################################################~~~~~~",
  "~~~~~~######################################################>~~~~~",
  "~~~~~~######################################################~~~~~~",
  "~~~~~~~###################################################~~~~~~~~",
  "~~~~~~~###################################################~~~~~~~~",
  "~~~~~~~###################################################~~~~~~~~",
  "~~~~~~~###################################################~~~~~~~~",
  "~~~~~~~~~~################################################~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

/** The Pits from builder (16, 44): the spoil rim (^), the bench (#), the floor round the Crater's water (w). */
const PITS = [
  "~~~~~~~~~~~~~~~www~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~www~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~www~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~www~~~~~~~~~~~~~",
  "~~~~~~~~~^^^^^^www^^^~~~~~~~~~~",
  "~~~~~~~~~^^^^^^www^^^^^^^^^^~~~",
  "~~~~~~~^^^^^^^^www^^^^^^^^^^^~~",
  "~~~~~~^^^^^####www####^^^^^^~~~",
  "~~~~~^^^^######www####^^^^~~##~",
  "~~~~~^^^#######www#####^^^~~##~",
  "~~###^^#####~~~www~~~###^^^~##~",
  "~~###^^^###~~~~www~~~~###^^^]#~",
  "~~###^^^###~~~wwwww~~~###^^^##>",
  "~<###^^^]#~~~~wwwww~~~~#[^^^##~",
  "~~##[^^^###>~~wwwww~~<###^^^##~",
  "~~###^^^###~~~wwwww~~~###^^^~~~",
  "~~###~^^^#####~~~~~~#####^^^~~~",
  "~~~~~~~^^^##############^^^~~~~",
  "~~~~~~~^^^^############^^^^~~~~",
  "~~~~~~~^^^^^^########^^^^^^~~~~",
  "~~~~~~^^^^^^^^^^^^^^^^^^^^^~~~~",
  "~~~~~~^^^^^^^^^^^^^^^^^~~~~~~~~",
  "~~~~~~~~~~~~^^^^^^^^^~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

function greyfall(): AreaMap {
  const rng = makeRng("area:greyfall");
  const t = tierBuilder("surface", rng, { cols: 124, rows: 72 });
  const { prop, who } = t;
  const black = { color: "black" } as const;
  const pinned = { fixed: true } as const;
  const dark = { ...black, ...pinned } as const;
  // The taken at the last work they were doing, harmless: only the garrison fights. The Warlord dead, they stop where
  // they stand.
  const grey = (c: number, r: number, more: Pick<Dweller, "act" | "to" | "flip"> = {}): void => {
    who("pawn", c, r, { ...black, ...more, unless: "warlordDead" });
    who("pawn", c, r, { ...black, flip: more.flip ?? false, when: "warlordDead" });
  };

  // The rot-marsh round the Citadel's rock, and the ashen ground before its gate.
  t.blob("greyfall", 62, 36, 58, 34);
  for (const [x, y, rx, ry] of [[24, 62, 18, 10], [96, 8, 20, 7], [92, 64, 22, 8]] as const) t.blob("greyfall", x, y, rx, ry);
  t.blob("greyfall", 11, 44, 12, 18);
  // The east coast: coves bitten out of it, sea stacks off it.
  lake(t, 114, 34, 6, 10);
  for (const [x, y, rx, ry] of [[118, 18, 4, 6], [118, 56, 4, 5], [112, 66, 4, 3]] as const) t.blob("greyfall", x, y, rx, ry);
  // Rotfield: the rot the Cut spilled, winding down the old fields to the Pits, where it falls through the rim.
  river(t, [[27, 14], [33, 24], [29, 34], [32, 40], [32, 46]], 3);

  // The Citadel's crag, after Stormveil and Windhelm, drawn tile by tile (CITADEL). The Lower City's terraces on its
  // skirts; the High City walled on the second step, the Champions' Pit sunk in it and a bastion jutting off its south
  // face for the gate; the Warlord's Hall a horseshoe round a chasm of rot; in the chasm, on its own crag, the Grey
  // Keep, reached only by its bridge off the Hall and the stair off the ledge under it. A spur runs west from the Lower
  // City as a ridge for the gnomes' Sky Bridge to land on.
  t.shape(2, 38, 9, 12, 4, 0.35, "The Lower City");
  stamp(t, CITADEL, 44, 2);
  const keepBridge = t.span(4, 79, 13, 2, 2);
  // The Pits, after Iron Keep, drawn tile by tile (PITS): the Cut's works, a rim of spoil round a bench round the floor
  // and the Crater's black water, the rot falling through a gorge in the rim; spoil ramps up its outside west and east.
  stamp(t, PITS, 16, 44);
  // The Sky Bridge: the gnomes' high road from the west, landing on the spur, a fire where it lands.
  const decks = t.span(2, 1, 8, 36, 2);
  t.fires.push({ col: 39, row: 6 });
  t.shape(2, 15, 34, 5, 4, 0.4, "The Ashen Approach");

  // Roads: in at the Grey Gate over the rot to the Lower City's stair; along the Lower City; round the Pits' east ramp
  // down the Gallows avenue; the old farm road north to the chapel. On the heights, the gate avenue up off the bastion
  // to the Hall, the cross street under the Hall, and Lords' Row, two wide, from the Counting House down the west ward.
  t.road([1, 44], [24, 44], [40, 44], [48, 47]);
  t.road([50, 48], [103, 48]);
  t.road([47, 57], [54, 60], [100, 60]);
  t.road([30, 44], [30, 20], [36, 16]);
  for (const c of [82, 83]) t.road([c, 22], [c, 43]);
  t.road([57, 25], [98, 25]);
  for (const c of [61, 62]) t.road([c, 15], [c, 38]);
  t.bridge({ col: 6, row: 44 }, { col: 1, row: 44 }, 3);
  t.bridge({ col: 30, row: 44 }, { col: 34, row: 44 }, 3);

  // The Ashen Approach: Highward's last sortie dead before the gate, and the dogs that eat them.
  prop("trollDead", 12, 38);
  for (const [c, r] of [[8, 38], [16, 41], [14, 50], [6, 52], [18, 55]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[10, 41], [18, 48], [9, 55], [15, 31], [4, 46], [7, 42], [13, 46]] as const) prop("bones", c, r);
  for (const [c, r] of [[5, 34], [17, 54], [8, 58]] as const) prop("deadTree", c, r, { scale: 0.7 });
  // The sortie's own camp, where it broke: its banners' poles, a tent's wreck, the dead in their line.
  prop("house2", 4, 39, black);
  for (const [c, r] of [[6, 40], [8, 40], [10, 40]] as const) who("skullGuard", c, r);
  for (const [c, r] of [[3, 36], [6, 36]] as const) prop("house1", c, r, black);
  for (const [c, r] of [[2, 41], [11, 36], [12, 42]] as const) prop("skullSpike", c, r);
  prop("woodPile", 9, 37);
  // The fire on the road in, between the gate and the Pits.
  t.fires.push({ col: 20, row: 44 });
  crowd(t, rng, "gnoll", { col: 10, row: 57 }, 4, 4);
  who("bat", 10, 50);
  who("bat", 14, 31);

  // Rotfield, after West Fields gone grey: the Citadel's fields in fenced plots of dead rows, a stake for a scarecrow in
  // each, the taken hoeing them, the farms in ruin, the dogs and the dead between.
  const fields = [[34, 20, 7, 5], [34, 31, 7, 5], [18, 20, 7, 5], [18, 31, 7, 5]] as const;
  for (const [c, r, w, h] of fields) {
    t.fences.push({ col: c, row: r, w, h, gate: 3, gateW: 1 });
    prop("skullSpike", c + 3, r + 1, pinned);
    grey(c + 1, r + 2, { act: "pickaxe" });
    grey(c + 5, r + 3, { act: "pickaxe", flip: true });
  }
  grey(26, 26, { act: "wood", to: { col: 26, row: 38 } });
  for (const [c, r, art] of [[27, 27, "house1"], [44, 24, "house2"], [44, 37, "house3"], [24, 37, "house1"]] as const) prop(art, c, r, black);
  for (const [c, r] of [[45, 30], [26, 42], [44, 20], [16, 27], [40, 40]] as const) prop("deadTree", c, r, { scale: 0.7 });
  for (const [c, r] of [[38, 42], [27, 46], [35, 38], [22, 28]] as const) prop("bones", c, r);
  crowd(t, rng, "skull", { col: 38, row: 39 }, 3, 3);
  crowd(t, rng, "gnoll", { col: 45, row: 33 }, 3, 3);
  who("troll", 46, 27, { to: { col: 47, row: 30 } });
  for (const [c, r] of [[32, 37], [28, 22]] as const) who("snake", c, r);

  // The Ruined Chapel under the spur, the Stilled's now: the Order's chapel, their dead staked in rows either side, a
  // bell's stake at the door, the brothers kneeling to the Grey.
  prop("monastery", 39, 16, { color: "purple" });
  for (const r of [14, 16]) for (const c of [31, 33, 35, 43, 45, 47]) prop("skullSpike", c, r, pinned);
  for (const [c, r] of [[32, 15], [46, 15]] as const) prop("bones", c, r);
  prop("sconce", 37, 18);
  who("monk", 40, 18, { color: "purple", to: { col: 44, row: 18 } });
  who("monk", 34, 17, { color: "purple" });
  who("shaman", 48, 17);

  // The Pits: headframes over the gorge on the rim, a shaft cut into the cliff under each ledge, spoil and timber and
  // tools on the bench. The diggers go in and out of the shafts and up the east ramp to the ore pile at its foot, where
  // nothing comes to take it; the overseers and a horned stand over them. On the rim by the gorge a goblin's fire.
  for (const [c, r] of [[23, 53], [40, 51]] as const) prop("watchtower", c, r, pinned);
  for (const [c, r] of [[26, 52], [36, 51], [28, 55], [36, 55]] as const) prop("cave", c, r, pinned);
  for (const [c, r] of [[25, 49], [41, 50], [23, 61], [42, 63]] as const) prop("rock", c, r);
  for (const [c, r] of [[29, 62], [39, 52]] as const) prop("woodPile", c, r);
  for (const [c, r] of [[34, 62], [25, 56]] as const) prop("tools", c, r);
  for (const [c, r] of [[27, 63], [37, 62], [31, 63]] as const) prop("rock", c, r);
  for (const [c, r] of [[22, 59], [42, 58]] as const) prop("skullSpike", c, r);
  heap(t, 47, 51);
  for (const [door, home] of [[[26, 53], [47, 53]], [[36, 52], [48, 54]], [[28, 56], [46, 54]], [[36, 56], [49, 53]]] as const) grey(home[0], home[1], { act: "dig", to: { col: door[0], row: door[1] } });
  for (const [c, r] of [[25, 60], [39, 60]] as const) who("taken", c, r);
  who("minotaurGuard", 30, 60, { to: { col: 35, row: 60 } });
  for (const [c, r] of [[31, 57], [33, 58]] as const) who("bombFish", c, r);
  t.campfires.push({ col: 35, row: 49 });
  prop("goblinHut", 39, 50, pinned);

  // The Lower City, Iron Keep's smelters along the foot of the High City's wall: a furnace house a bay, its furnace
  // banked in front, a smith at each hammering cold iron; carriers bringing the ore up the Pits' road to furnaces that
  // never take it. Under the bastion the gate square; down the street's south side the diggers' houses; east, the
  // goblins' quarter, a row of huts each side of its alley, empty since the night they ran.
  for (const c of [54, 60, 66, 72]) {
    prop("house1", c, 42, dark);
    t.campfires.push({ col: c, row: 44 });
    grey(c - 1, 45, { act: "hammer" });
  }
  for (const c of [57, 69]) prop("woodPile", c, 43);
  prop("tools", 63, 45);
  grey(55, 46, { act: "fetch", to: { col: 48, row: 52 } });
  grey(67, 46, { act: "fetch", to: { col: 49, row: 52 }, flip: true });
  for (const [c, r] of [[77, 44], [88, 44]] as const) prop("sconce", c, r);
  for (const c of [79, 86]) who("lancer", c, 45, black);
  for (const c of [56, 61, 66, 71]) prop(["house2", "house3"][c % 2]!, c, 52, black);
  grey(58, 50, { to: { col: 70, row: 50 } });
  for (const r of [42, 45, 51]) for (const c of [91, 97]) prop("goblinHut", c, r);
  for (const [c, r] of [[93, 44], [96, 50], [94, 47]] as const) prop("bones", c, r);
  who("gnoll", 94, 50, { to: { col: 94, row: 42 } });
  for (const [c, art] of [[78, "house1"], [84, "house2"]] as const) prop(art, c, 52, black);
  prop("bones", 81, 51);
  crowd(t, rng, "warrior", { col: 87, row: 50 }, 3, 3, black);
  // The east ledge under the Garrison: the guns out over the sea, the walk.
  for (const r of [26, 34]) prop("cannon", 103, r);
  who("archer", 102, 18, { ...black, to: { col: 102, row: 38 } });

  // The west ledge under the High City's wall, the wall walk: guns out over Rotfield, a lantern at each stair's foot, the
  // watch walking it.
  for (const r of [16, 26, 38]) prop("cannonSide", 52, r);
  for (const r of [19, 34]) prop("sconce", 53, r);
  who("lancer", 52, 14, { ...black, to: { col: 52, row: 40 } });
  // The Sky Bridge's head on the spur: the gnomes' toll hut, shut since Sunhold stopped sending, and the posts of the
  // Citadel's watch on it.
  prop("gnomeHut", 45, 8);
  for (const c of [42, 48]) prop("skullSpike", c, 11);
  prop("woodPile", 47, 11);
  // The High City, after Windhelm: towers with an archer on each at its north-east corner, on the bastions off either
  // end of its south face, and on its west buttress, a gun beside it out over Rotfield.
  for (const [c, r] of [[97, 14], [61, 39], [94, 39], [56, 27]] as const) {
    prop("tower", c, r, dark);
    who("archer", c, r + 0.25, { ...black, perch: 1.85 });
  }
  prop("cannonSide", 55, 25);
  // Lords' Row: the Counting House at its head, where the Citadel paid for the Cut, a clerk still at its door; down the
  // row the lords' houses either side, broken halfway by the Ash Square, where the city's great tree stands dead and
  // the lords' taken still stand drinking under it.
  prop("house3", 60, 15, dark);
  for (const c of [58, 63]) prop("sconce", c, 16);
  grey(59, 17);
  for (const r of [20, 23, 32, 35]) prop(["house1", "house2", "house3"][r % 3]!, 58, r, dark);
  for (const r of [21, 32, 35, 38]) prop(["house2", "house1", "house3"][r % 3]!, 65, r, dark);
  prop("deadTree", 59.5, 27.4, { scale: 1.6, fixed: true });
  for (const [c, r] of [[57, 26], [57, 29]] as const) prop("sconce", c, r);
  for (const [c, r] of [[60, 29], [63, 28], [63, 26]] as const) grey(c, r, { flip: c > 61 });
  for (const [c, r] of [[60, 33], [63, 36]] as const) grey(c, r, { flip: c > 61 });
  who("taken", 61, 31, { to: { col: 62, row: 19 } });
  // The Champions' Pit, sunk a height into the city, its gallery bridged across it: the horned fighting on its floor
  // for the lords still watching from the gallery and the rim.
  const gallery = t.span(3, 72, 28, 2, 8);
  who("minotaurGuard", 69, 32, { to: { col: 70, row: 34 } });
  for (const [c, r] of [[66, 27], [78, 27], [66, 36], [78, 36]] as const) prop("skullSpike", c, r, pinned);
  for (const [c, r] of [[69, 30], [76, 34]] as const) prop("bones", c, r);
  for (const [c, r] of [[72, 30], [73, 33], [69, 27], [76, 27], [70, 36]] as const) grey(c, r, { flip: c > 72 });
  // The gate avenue, lanterns paired up it from the bastion to the Hall; the bastion's towers either side of its head.
  for (const r of [31, 35]) for (const c of [80, 85]) prop("sconce", c, r, pinned);
  for (const c of [80, 85]) prop("tower", c, 41, dark);
  for (const c of [81, 84]) who("lancer", c, 39, black);
  who("taken", 82, 33, { to: { col: 82, row: 39 } });
  // The Gilt Market where the avenue meets the cross street under the Hall: the gold on its stalls cold to the touch,
  // its traders holding it out still to nobody.
  for (const [c, r] of [[77, 23], [80, 24], [85, 23], [78, 27]] as const) prop("goldStone", c, r);
  for (const [c, r] of [[76, 24], [86, 24]] as const) grey(c, r, { act: "gold", flip: c > 80 });
  for (const [c, art] of [[70, "house2"], [74, "house1"]] as const) prop(art, c, 24, black);
  // The Treasury Rock, raised a height out of the city east of the avenue: the Citadel's gold still heaped on it,
  // the warmest thing left after the crown, and the guard who never left it.
  for (const [c, r] of [[88, 28], [90, 28], [91, 30], [89, 30]] as const) prop("goldStone", c, r);
  who("skullGuard", 90, 29);
  for (const c of [88, 91]) prop("sconce", c, 27, pinned);
  // The Garrison in one line along the east rim: barracks, stores, the butts on the east bastion, the guns; the drill on
  // the yard in front, stopped the day the Warlord falls.
  prop("barracks", 96, 18, dark);
  prop("woodPile", 97, 21);
  prop("house1", 96, 26, dark);
  prop("archery", 98, 32, dark);
  prop("meat", 95, 30);
  for (const r of [16, 35]) prop("cannon", 99, r);
  for (let i = 0; i < 4; i++) who("warrior", 87 + i * 2, 34, { ...black, unless: "warlordDead", to: { col: 87 + i * 2, row: 36 } });
  for (const r of [33, 35]) who("archer", 95, r, black);
  who("lancer", 57, 24, { ...black, to: { col: 78, row: 24 } });
  prop("woodPile", 86, 38);
  // The fire in the forecourt by the Hall's east stair, the nearest to the Keep.
  t.fires.push({ col: 90, row: 23 });

  // The Warlord's Hall, the Palace of Kings: the court on the horseshoe's foot facing the Keep's bridge, its courtiers in
  // their rows bowing to the bridge and the seat past it; the old hall on the west arm, the stewards' house on the east,
  // a tower on each arm's end. The Warlord sits up in the Keep now, nearer his crown than them.
  for (const r of [17, 19]) for (const c of [73, 75, 77, 82, 84, 86]) grey(c, r, { flip: c > 80 });
  for (const c of [78, 81]) prop("sconce", c, 16, pinned);
  for (const c of [78, 81]) who("skullGuard", c, 20);
  prop("monastery", 68, 12, dark);
  prop("house3", 90, 12, dark);
  for (const [c, r] of [[68, 4], [90, 4]] as const) {
    prop("tower", c, r, dark);
    who("archer", c, r + 0.25, { ...black, perch: 1.85 });
  }
  crowd(t, rng, "monk", { col: 69, row: 17 }, 2, 2, { color: "purple" });

  // The Grey Keep on its crag: the black castle, its guard at the door, a lantern either end of the ledge.
  prop("castle", 78, 7, dark);
  for (const c of [76, 80]) who("skullGuard", c, 9);
  for (const c of [76, 83]) prop("sconce", c, 12, pinned);

  // The Gallows Yard under the crag's south face: an avenue of gibbets, the pens on its south side, the Lanternport
  // folk penned in them till the Warlord falls and they walk home; the yard's barracks and its watch.
  for (const c of [56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96]) prop("skullSpike", c, c % 8 === 0 ? 58 : 62, pinned);
  for (const c of [74, 82, 90]) t.fences.push({ col: c, row: 63, w: 6, h: 4, gate: 2 });
  for (const [c, r] of [[75, 64], [77, 65], [83, 65], [85, 64], [91, 64], [93, 65]] as const) who("pawn", c, r, { color: "blue", unless: "warlordDead" });
  for (const [c, r] of [[60, 60], [64, 61], [57, 59]] as const) who("pawn", c, r, { color: "blue", when: "warlordDead", to: { col: 48, row: 58 } });
  prop("barracks", 58, 56, black);
  t.fires.push({ col: 70, row: 58 });
  prop("tower", 101, 61, black);
  who("lancer", 58, 60, { ...black, to: { col: 96, row: 60 } });
  crowd(t, rng, "warrior", { col: 86, row: 58 }, 3, 3, black);
  for (const c of [34, 50, 66, 94]) prop("cannon", c, 68);
  // West of the pens the old gallows field, its posts in a row and its timber stacked; along the shore the yard's
  // quarters, the watch's houses, where nobody sleeps.
  for (const c of [50, 54, 58, 62]) prop("skullSpike", c, 65, pinned);
  for (const [c, r] of [[52, 66], [60, 66], [56, 64]] as const) prop("bones", c, r);
  prop("woodPile", 51, 63);
  prop("tools", 64, 64);
  for (const [c, art] of [[70, "house1"], [76, "house3"], [94, "house2"], [100, "barracks"]] as const) prop(art, c, 67, black);
  t.campfires.push({ col: 82, row: 68 });
  who("warrior", 78, 68, { ...black, to: { col: 90, row: 68 } });
  // The east shore, the sea the Citadel's barges put out on: two wrecks in the cove, gulls' bones on the strand.
  for (const [c, r] of [[112, 30], [115, 39]] as const) prop("boat", c, r, { flip: r > 35 });
  for (const [c, r] of [[107, 22], [106, 46], [108, 52]] as const) prop("bones", c, r);

  // The ramparts' last towers on the marsh, archers on the walk.
  for (const [c, r] of [[25, 9], [14, 63]] as const) prop("tower", c, r, black);
  who("archer", 40, 7, { ...black, to: { col: 50, row: 7 } });
  who("lancer", 23, 30, { ...black, to: { col: 23, row: 16 } });

  const exits: AreaExit[] = [
    { to: "barrowmoor", name: "Grey Gate", kind: "locked", at: { col: 1, row: 44 } },
    { to: "crags", name: "Sky Bridge", kind: "high", at: { col: 1, row: 8 } },
    { to: "throne", name: "The Grey Keep", kind: "open", at: { col: 78, row: 8 } },
  ];
  // The rock's tiers alternate stone colours so each step reads; the marsh below in its own; the fields their own.
  const districts: District[] = [
    { name: "The Grey Keep", at: { col: 78, row: 7 }, levels: [5], palette: [1], dress: "greyfall", decor: 1 },
    { name: "The Warlord's Hall", at: { col: 79, row: 18 }, levels: [4], palette: [2], dress: "greyfall", decor: 1 },
    { name: "The Counting House", at: { col: 61, row: 20 }, levels: [3], palette: [3], dress: "greyfall", decor: 1.5 },
    { name: "The Garrison", at: { col: 94, row: 30 }, levels: [3], palette: [3], dress: "greyfall", decor: 1.5 },
    { name: "The High City", at: { col: 82, row: 32 }, levels: [3], palette: [3], dress: "greyfall", decor: 1.5 },
    { name: "The Champions' Pit", at: { col: 72, row: 31 }, levels: [2], palette: [4], dress: "greyfall", decor: 1 },
    { name: "The Treasury Rock", at: { col: 89, row: 29 }, levels: [4], palette: [1], dress: "greyfall", decor: 0.5 },
    { name: "The Lower City", at: { col: 70, row: 48 }, levels: [2], palette: [5, 4], dress: "greyfall", decor: 2 },
    { name: "Rotfield", at: { col: 30, row: 30 }, levels: [1, 2], palette: [4, 3], dress: "greyfall", decor: 2.5 },
    ...fields.map(([x, y, w, h]): District => ({ name: "", at: { col: x + (w >> 1), row: y + (h >> 1) }, palette: [4], dress: "greyfall", decor: 0.4, crops: true, box: { x, y, w, h } })),
    { name: "The Pits", at: { col: 32, row: 56 }, levels: [1, 2, 3], palette: [5, 4, 3], dress: "crags", decor: 1.5, trees: 0 },
    { name: "Ruined Chapel", at: { col: 39, row: 15 }, levels: [1], palette: [5], dress: "barrowmoor", decor: 2, gloom: true },
    { name: "Gallows Yard", at: { col: 75, row: 62 }, levels: [1], palette: [5], dress: "greyfall", decor: 2 },
    { name: "The Ashen Approach", at: { col: 12, row: 52 }, levels: [1, 2], palette: [5, 4], dress: "barrowmoor", decor: 2.5 },
  ];
  // Dead wood in the fields' margins and before the gate; behind the crag only woods.
  for (const [x, y, rx, ry, d] of [[29, 30, 3, 5, 0.4], [10, 52, 6, 6, 0.3], [47, 22, 2, 3, 0.4], [104, 58, 4, 4, 0.4], [14, 26, 4, 4, 0.5], [50, 34, 3, 4, 0.5], [10, 18, 5, 4, 0.4], [22, 12, 4, 3, 0.4], [108, 40, 3, 6, 0.5], [108, 18, 3, 5, 0.5], [46, 64, 3, 3, 0.5]] as const) t.grove(x, y, rx, ry, d);
  const tier = t.finish({}, [{ col: 6, row: 44 }]);
  const notes: Note[] = [
    { at: { col: 30, row: 60 }, text: "The lamps in the Cut went out from the bottom up. Then the cold came up the ladders after us." },
    { at: { col: 62, row: 16 }, text: "Paid the diggers in coal and fire for the Deep Cut. Deeper next year. By his order." },
    { at: { col: 63, row: 47 }, text: "Banked, not out. By order. The ore comes up. It waits." },
    { at: { col: 70, row: 61 }, text: "They walked us here for the warmth. It is warm. That is the worst of it." },
    { at: { col: 37, row: 19 }, text: "Ring once for the warm ones. Hush them. Ring twice for yourself." },
    { at: { col: 80, row: 22 }, text: "Bow. He sees from up there. He does not look." },
  ];
  return { ...tier, area: "greyfall", entry: { col: 6, row: 44 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [...decks, ...keepBridge, ...gallery], notes };
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
    { to: "peak", name: "Gnome Lift", kind: "lift", at: { col: 26, row: 58 } },
    { to: "throne", name: "Throne Stair", kind: "lift", at: { col: 99, row: 34 } },
    { to: "sunhall", name: "The Sun Hall", kind: "open", at: { col: 65, row: 27 } },
    { to: "sunhall", name: "The Gilded Span", kind: "open", at: { col: 95, row: 32 } },
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
  // The Gilded Span barred at the city's end until the Sentinel's Sun Key is carried: the Throne Isle is the far side of its hall.
  const locks = [{ key: "sunSentinel", name: "The Gilded Span", cells: [{ col: 81, row: 33 }, { col: 81, row: 34 }] }];
  return { ...tier, area: "gilded", entry: { col: 6, row: 36 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks, locks, notes: [{ at: { col: 32, row: 34 }, text: "The isles ride lower. Heap the gold in the Hall, and spend none." }] };
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
  return { ...tier, area: "steps", entry: { col: 104, row: 16 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks, notes: [{ at: { col: 88, row: 59 }, text: "Left the gold one night. By morning the sparks were in it. More every night it lies." }] };
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
  return { ...tier, area: "undercroft", entry: { col: 52, row: 14 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes: [{ at: { col: 99, row: 72 }, text: "By the town's order: dig east till the gold runs warm. The moor is not to know." }] };
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
  for (const [c, r] of [[30, 79], [46, 79]] as const) prop("goldStone", c, r);

  const exits: AreaExit[] = [
    { to: "undercroft", name: "Cistern Run", kind: "open", at: { col: 1, row: 22 } },
    { to: "barrow", name: "The King's Stair", kind: "open", at: { col: 46, row: 14 } },
    { to: "web", name: "The Web", kind: "open", at: { col: 38, row: 94 } },
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
  return { ...tier, area: "deeps", entry: { col: 12, row: 22 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes: [{ at: { col: 30, row: 18 }, text: "Cut over the arch: NO DEEPER THAN A GRAVE." }] };
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
  for (const [c, r] of [[40, 40], [74, 42]] as const) prop("goldStone", c, r);

  const exits: AreaExit[] = [
    { to: "web", name: "Sinking Stair", kind: "open", at: { col: 50, row: 2 } },
    { to: "shellisle", name: "The Shell", kind: "open", at: { col: 54, row: 38 } },
  ];
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

  // The Wayshrine: a shrine fire at the crossroads, bones round it; too near the gate's to rest at.
  t.campfires.push({ col: 31, row: 46 });
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

  // The Mourners' Way: an avenue of skulls up to the King's Barrow, a fire where the mourners stopped; the rest is at the barrow.
  for (const r of [38, 46]) for (const c of [55, 61]) prop("skullSpike", c, r);
  t.campfires.push({ col: 62, row: 43 });
  who("bat", 54, 41);

  // The King's Barrow: the dead kings' guard round its steps, the cave at its foot down into it, where the Barrow King lies.
  for (const [c, r] of [[52, 15], [72, 15], [54, 24], [70, 24]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[58, 14], [66, 14], [62, 21]] as const) prop("bones", c, r);
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
    // After the Lordvessel: the King's horn and the Weaver's silk, one from each way out of the Harbour. Open from the Greyfall's side.
    { to: "greyfall", name: "Grey Gate", kind: "locked", at: { col: 118, row: 36 }, keys: ["barrowKing", "weaver"] },
    { to: "fen", name: "Barrow Path", kind: "open", at: { col: 60, row: 78 } },
    { to: "barrow", name: "Barrow Cave", kind: "lift", at: { col: 62, row: 26 } },
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
  // water took, the lizard-folk who guard the way, and the chapel praying to the Grey over the sinkhole.

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

  // The Chapel Mound: the purple chapel on its crown prays to the Grey over the sinkhole at its foot. A ring of stakes
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
    { to: "shellisle", name: "The Shell Stair", kind: "lift", at: { col: 55, row: 33 }, guard: "shellBelow" },
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
  return { ...tier, area: "fen", entry: { col: 6, row: cy }, exits, districts, districtAt, decks: [], notes: [{ at: { col: cx, row: cy + 6 }, text: "Keep the eggs dry. Keep the water going down. Soon everything rests." }] };
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
  // The draws of the axemen who stood here once, so the woods grown after keep their places.
  for (let i = 0; i < 10; i++) rng.next();
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

  // The Eel Pens: an eel-hole off the east walk, its keeper's hut.
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
  const t = tierBuilder("below", rng, { cols: 80, rows: 50 });
  const { prop, who } = t;
  const l = "landing";

  // Where you wake with the tide, after the Asylum and the Stranded Graveyard: a sea cave, the way out of it narrow and
  // found, not shown. The grotto the boat drifted into, the first fire; a tunnel to the goblins' chamber, another up to
  // the hall where they keep watch, then the castaway's camp, its fire and the cleft of gold beside it; south through
  // the flooded gallery to the antechamber, the Ring Gate at its end. Notes scratched on the rock by those who washed in
  // before, each where its lesson is needed; the sack and the map are Hollis's to teach.
  for (const [x, y, w, h] of [[26, 40, 16, 7], [12, 26, 12, 9], [14, 8, 16, 9], [38, 7, 13, 10], [55, 6, 6, 5], [36, 24, 18, 9], [60, 24, 10, 9]] as const) t.ground(l, x, y, w, h);
  t.pond(26, 46, 16, 2);
  // The gallery's flood: a pool in its middle, to be fought round.
  t.pond(42, 26, 5, 5);
  for (const way of [[[32, 40], [32, 31], [20, 31]], [[18, 26], [18, 17]], [[29, 12], [38, 12]], [[50, 8], [55, 8]], [[44, 16], [44, 24]], [[53, 28], [60, 28]]] as const) tunnel(t, way);
  // The Ring Gate: the antechamber opens east into a tunnel running on off the map, straight into the Ring's own.
  tunnel(t, [[69, 28], [78, 28]]);
  openEdge(t, 79, 28);
  // Torches in the rock along the way, so the way out is the lit one.
  for (const [c, r] of [[30, 36], [26, 29], [16, 21], [34, 10], [46, 20], [56, 26], [74, 26], [27, 41], [41, 41], [13, 27], [22, 34], [15, 9], [28, 9], [15, 15], [39, 15], [49, 15], [60, 10], [37, 31], [52, 25], [61, 31], [68, 31]] as const) prop("sconce", c, r);

  // The grotto: the boat that drifted in, the first fire.
  prop("boat", 33, 46);
  t.fires.push({ col: 38, row: 42, name: "Waking Shore" });
  // The goblins' chamber: one goblin, to learn the swing on.
  who("torch", 17, 30, { to: { col: 20, row: 29 } });
  for (const [c, r] of [[14, 33], [21, 28]] as const) prop("bones", c, r);
  // The watch hall: two goblins together, to learn the roll and the guard.
  who("torch", 19, 11, { to: { col: 24, row: 11 } });
  who("spear", 25, 13);
  prop("woodPile", 15, 9);
  // The castaway's camp: Hollis's fire, the second, for the map's travel to be tried between the two.
  t.fires.push({ col: 46, row: 10, name: "Castaway's Camp" });
  // The cleft off the camp: gold, for whoever looks.
  prop("goldStone", 58, 8);
  // The flooded gallery: three together round the pool, one slinging from across it.
  who("torch", 39, 29, { to: { col: 39, row: 26 } });
  who("spear", 49, 26);
  who("slingshot", 51, 31);
  // The antechamber before the Ring: the dead who went in before.
  for (const [c, r] of [[63, 26], [66, 31], [64, 31]] as const) prop("bones", c, r);
  for (const [c, r] of [[61, 25], [68, 25]] as const) prop("skullSpike", c, r);

  const notes: Note[] = [
    { at: { col: 34, row: 42 }, text: "E: rest at fire" },
    { at: { col: 32, row: 37 }, text: "Hold Space: run" },
    { at: { col: 27, row: 31 }, text: "Left click: attack" },
    { at: { col: 18, row: 24 }, text: "Tap Space: dash" },
    { at: { col: 18, row: 21 }, text: "Hold right click: guard" },
    { at: { col: 33, row: 12 }, text: "R: heal" },
    { at: { col: 63, row: 28 }, text: "Gold lost upon death. Reclaim it where you fell" },
  ];
  const exits: AreaExit[] = [{ to: "ring", name: "Ring Gate", kind: "open", at: { col: 78, row: 28 } }];
  // Unnamed: no room's name shows walking in, and both fires go by the Landing's own.
  const districts: District[] = [
    { name: "", at: { col: 34, row: 42 }, palette: [5], dress: "saltreach", decor: 1 },
    { name: "", at: { col: 17, row: 30 }, palette: [5], dress: "undercroft", decor: 1 },
    { name: "", at: { col: 21, row: 12 }, palette: [5], dress: "undercroft", decor: 1 },
    { name: "", at: { col: 44, row: 11 }, palette: [5], dress: "saltreach", decor: 0.8 },
    { name: "", at: { col: 44, row: 28 }, palette: [5], dress: "fen", decor: 0.8 },
    { name: "", at: { col: 64, row: 28 }, palette: [5], dress: "barrowmoor", decor: 0.6 },
  ];
  // Ashore beside the first fire, where a new game wakes too.
  const entry = { col: 37, row: 42 };
  const tier = stone(t.finish({}, [entry]));
  return { ...tier, area: "landing", entry, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes };
}

/**
 * The Bull's Ring, the sea cave's end and its own area: a round cavern, an arena,
 * fog across both its ways while the Cinder Troll holds it, the tunnel in from
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
  t.bosses.push({ name: "Cinder Troll", area: "ring", col: 26, row: 20 });
  who("troll", 26, 20, { to: { col: 27, row: 20 } });
  // A note by the first rock in from the cave, (19,22) of the rubble: the lesson in the Ring's rocks.
  // And one a step short of where he comes down, 2 tiles round (26,20).
  const notes: Note[] = [
    { at: { col: 18, row: 21 }, text: "Lure charge into rock" },
    { at: { col: 23, row: 20 }, text: "RUNN!" },
  ];

  const exits: AreaExit[] = [
    { to: "landing", name: "Ring Gate", kind: "open", at: { col: 1, row: 20 } },
    { to: "harbour", name: "The Boat", kind: "lift", at: { col: 45, row: 20 }, guard: "troll" },
  ];
  const districts: District[] = [
    { name: "The Bull's Ring", at: { col: 26, row: 20 }, palette: [5], dress: "barrowmoor", decor: 0.6 },
    { name: "The Sea Channel", at: { col: 46, row: 20 }, palette: [5], dress: "undercroft", decor: 0.5, box: { x: 40, y: 17, w: 12, h: 7 } },
    { name: "The Cave Tunnel", at: { col: 6, row: 20 }, palette: [5], dress: "undercroft", decor: 0.5, box: { x: 0, y: 17, w: 12, h: 7 } },
  ];
  const tier = stone(t.finish({}, [{ col: 3, row: 20 }]));
  // No fog: the Ring is the arena, walked straight into from the cave; the bull's guard on the boat holds the way on.
  const arena = { boss: "troll", gate: [], inside: { col: 24, row: 20 } };
  return { ...tier, area: "ring", entry: { col: 3, row: 20 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Bull's Wall, after Dark Souls' Taurus Demon: a boss room of its own, a land apart. The castle's curtain wall
 * alone, three tiles wide over the drop, in off the Ramparts' walk at its west end and out over the Gun Bridge to
 * the Chapel Ward at its east, the Rampart Boar holding the middle: no way round him. Past him
 * the Ladder drops off the wall's south face to the Burg's square.
 */
function bullwall(): AreaMap {
  const rng = makeRng("area:bullwall");
  const t = tierBuilder("surface", rng, { cols: 72, rows: 20 });
  const { prop, who } = t;

  t.ground("bullwall", 2, 9, 68, 3);
  t.block(3, 2, 9, 68, 3);
  edgeWay(t, { col: 3, row: 10 }, { col: 1, row: 10 }, 3);
  edgeWay(t, { col: 68, row: 10 }, { col: 70, row: 10 }, 3);
  t.road([1, 10], [70, 10]);
  for (const [c, r] of [[14, 11], [22, 9], [47, 11], [56, 9]] as const) prop("bones", c, r);
  who("rampartBull", 35, 10);
  t.bosses.push({ name: "The Rampart Boar", area: "bullwall", col: 35, row: 10 });

  const notes: Note[] = [{ at: { col: 3, row: 9 }, text: "No way round him. Only through." }];
  const exits: AreaExit[] = [
    { to: "ramparts", name: "The Bull's Gate", kind: "open", at: { col: 1, row: 10 } },
    { to: "burg", name: "The Ladder", kind: "shortcut", at: { col: 60, row: 11 }, opens: "ladderDown", guard: "rampartBull" },
    { to: "chapel", name: "Chapel Door", kind: "open", at: { col: 70, row: 10 }, guard: "rampartBull" },
  ];
  const districts: District[] = [
    { name: "The Bull's Wall", at: { col: 35, row: 10 }, palette: [5, 4, 3], gloom: true, dress: "barrowmoor", decor: 0.3, box: { x: 7, y: 8, w: 57, h: 5 } },
    { name: "The Bull's Gate", at: { col: 3, row: 10 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.3 },
    { name: "The Gun Bridge", at: { col: 67, row: 10 }, levels: [3], palette: [2], dress: "greyfall", decor: 0.3 },
  ];
  const tier = t.finish({}, [{ col: 3, row: 10 }]);
  // No fog: the whole land is the arena, walked straight into; the boar's guard on the Chapel Door holds the way on.
  const arena = { boss: "rampartBull", gate: [], inside: { col: 35, row: 10 } };
  return { ...tier, area: "bullwall", entry: { col: 3, row: 10 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Belfry, after Dark Souls' Bell Gargoyles: a boss room of its own, a land apart. The bell loft on top of the
 * Chapel Ward's tower, in off the Bell Stair at its east side and out by the Postern stair at its west, the Stone
 * Warden squatting under the bell: cramped round the bell's timber frame, a turret at each back corner.
 */
function belfry(): AreaMap {
  const rng = makeRng("area:belfry");
  const t = tierBuilder("surface", rng, { cols: 30, rows: 22 });
  const { prop, who } = t;
  const blue = { color: "blue" } as const;

  t.ground("belfry", 6, 4, 18, 13);
  edgeWay(t, { col: 23, row: 11 }, { col: 28, row: 11 });
  edgeWay(t, { col: 6, row: 11 }, { col: 1, row: 11 });
  t.fences.push({ col: 12, row: 7, w: 5, h: 3 });
  for (const c of [7, 22]) prop("tower", c, 5, blue);
  for (const [c, r] of [[9, 14], [20, 15]] as const) prop("bones", c, r);
  who("stoneWarden", 14, 13);
  t.bosses.push({ name: "The Stone Warden", area: "belfry", col: 14, row: 13 });

  const notes: Note[] = [{ at: { col: 27, row: 10 }, text: "Ring the bell. Stone cannot stand its toll." }];
  const exits: AreaExit[] = [
    { to: "chapel", name: "The Bell Stair", kind: "open", at: { col: 28, row: 11 } },
    { to: "emberwood", name: "The Postern", kind: "gate", at: { col: 1, row: 11 }, guard: "stoneWarden" },
  ];
  const districts: District[] = [
    { name: "The Bell Loft", at: { col: 14, row: 11 }, palette: [5, 3, 2], dress: "barrowmoor", decor: 0.3, box: { x: 5, y: 3, w: 19, h: 15 } },
    { name: "The Bell Stair", at: { col: 26, row: 11 }, palette: [3], dress: "harbour", decor: 0.3 },
    { name: "The Postern", at: { col: 2, row: 11 }, palette: [3], dress: "emberwood", decor: 0.3 },
  ];
  const tier = t.finish({}, [{ col: 27, row: 11 }]);
  // No fog: the whole land is the arena, walked straight into; the warden's guard on the Postern holds the way on.
  const arena = { boss: "stoneWarden", gate: [], inside: { col: 14, row: 11 }, bell: { col: 14, row: 8 } };
  return { ...tier, area: "belfry", entry: { col: 27, row: 11 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * Troll's Hollow: a boss room of its own, a land apart. A round floor of ash in the burning pines, ringed by the
 * goblins' fires, room for every rush the Ember Bull has; in by the Ash Road from the Emberwood at its south gap,
 * out by the gnomes' Crag Stair at its north.
 */
function trollpit(): AreaMap {
  const rng = makeRng("area:trollpit");
  const t = tierBuilder("surface", rng, { cols: 60, rows: 46 });
  const { prop, who } = t;

  t.ground("trollpit", 2, 2, 56, 42);
  edgeWay(t, { col: 30, row: 38 }, { col: 30, row: 44 });
  edgeWay(t, { col: 30, row: 6 }, { col: 30, row: 1 });
  const hollow = { col: 30, row: 22, rx: 18, ry: 13 };
  const ragged = noise("trollpit:hollow", 3);
  // The pines wall all but the hollow and the road through it.
  const open = (c: number, r: number): boolean =>
    r < 11 || r > 33 ? c >= 29 && c <= 31 : ((c - hollow.col) / hollow.rx) ** 2 + ((r - hollow.row) / hollow.ry) ** 2 < 1 + ragged(c, r) * 0.12;

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    t.campfires.push({ col: Math.round(hollow.col + Math.cos(a) * 15), row: Math.round(hollow.row + Math.sin(a) * 10) });
  }
  for (const [c, r] of [[25, 18], [36, 25], [28, 29], [34, 16], [21, 24], [40, 21]] as const) prop("bones", c, r);
  for (const [c, r] of [[18, 15], [43, 28], [17, 29]] as const) prop("deadTree", c, r, { scale: 0.7 });
  who("minotaur", 30, 21, { to: { col: 34, row: 23 } });
  t.bosses.push({ name: "The Ember Bull", area: "trollpit", col: 30, row: 21 });

  const notes: Note[] = [{ at: { col: 31, row: 40 }, text: "Every rush he makes, the ash burns behind him. Keep him near the gap." }];
  const exits: AreaExit[] = [
    { to: "emberwood", name: "The Ash Road", kind: "open", at: { col: 30, row: 44 } },
    { to: "crags", name: "Crag Stair", kind: "open", at: { col: 30, row: 1 }, guard: "minotaur" },
  ];
  const districts: District[] = [
    { name: "The Ember Hollow", at: { col: 30, row: 22 }, palette: [1], dress: "greyfall", decor: 1.5, box: { x: 10, y: 8, w: 41, h: 29 } },
    { name: "The Ash Road", at: { col: 30, row: 40 }, levels: [1], palette: [3], dress: "emberwood", decor: 1 },
    { name: "The Crag Stair", at: { col: 30, row: 4 }, levels: [1], palette: [3], dress: "crags", decor: 1 },
  ];
  const tier = t.finish({}, [{ col: 30, row: 42 }], open);
  // No fog: the whole land is the arena, walked straight into; the bull's guard on the Crag Stair holds the way on.
  const arena = { boss: "minotaur", gate: [], inside: { col: 30, row: 22 } };
  return { ...tier, area: "trollpit", entry: { col: 30, row: 42 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The King's Barrow: a boss room of its own, under the moor. The throne hall inside the greatest of the barrows,
 * round under its dome on a ring of pillars, the Barrow King risen off his throne in the middle; in by the Barrow
 * Cave's lift at its south, out by the King's Stair east and down into the Deeps.
 */
function barrow(): AreaMap {
  const rng = makeRng("area:barrow");
  const t = tierBuilder("below", rng, { cols: 50, rows: 36 });
  const { prop, who } = t;

  t.blob("barrow", 25, 17, 13, 9);
  tunnel(t, [[25, 25], [25, 34]]);
  tunnel(t, [[37, 17], [49, 17]]);
  openEdge(t, t.grid[0]!.length - 1, 17);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    t.pillar(Math.round(25 + Math.cos(a) * 8), Math.round(17 + Math.sin(a) * 5.5), 2, 1);
  }
  for (const [c, r] of [[14, 13], [36, 13], [14, 21], [36, 21], [20, 9], [30, 9], [20, 25], [30, 25]] as const) prop("sconce", c, r);
  for (const [c, r] of [[22, 10], [28, 10]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[21, 20], [30, 15], [26, 22]] as const) prop("bones", c, r);
  who("barrowKing", 25, 16);
  // The grave totems round the hall: while one stands, no blade bites the king.
  for (const [c, r] of [[25, 10], [16, 21], [34, 21]] as const) who("graveTotem", c, r);
  t.bosses.push({ name: "The Barrow King", area: "barrow", col: 25, row: 16 });

  const notes: Note[] = [{ at: { col: 26, row: 32 }, text: "Break what he leans on, and cut down the dead who stand it up again." }];
  const exits: AreaExit[] = [
    { to: "barrowmoor", name: "Barrow Cave", kind: "lift", at: { col: 25, row: 33 } },
    { to: "deeps", name: "The King's Stair", kind: "open", at: { col: 48, row: 17 }, guard: "barrowKing" },
  ];
  const districts: District[] = [
    { name: "The King's Barrow", at: { col: 25, row: 17 }, palette: [5, 4], dress: "barrowmoor", box: { x: 10, y: 6, w: 30, h: 24 } },
    { name: "The Barrow Cave", at: { col: 25, row: 32 }, palette: [4], dress: "deeps" },
    { name: "The King's Stair", at: { col: 45, row: 17 }, palette: [4], dress: "deeps" },
  ];
  const tier = stone(t.finish({}, [{ col: 25, row: 32 }]));
  // No fog: the whole land is the arena, walked straight into; the king's guard on the King's Stair holds the way on.
  const arena = { boss: "barrowKing", gate: [], inside: { col: 25, row: 17 } };
  return { ...tier, area: "barrow", entry: { col: 25, row: 32 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Weaver's Web: a boss room of its own under the Deeps, a land apart. A cavern strung between stalagmites, in from
 * the Deeps' bottom at its north and out by the Sinking Stair at its south, down to the Drowned Hollow.
 */
function web(): AreaMap {
  const rng = makeRng("area:web");
  const t = tierBuilder("below", rng, { cols: 60, rows: 44 });
  const { prop, who } = t;

  t.blob("web", 30, 22, 18, 12);
  tunnel(t, [[30, 2], [30, 11]]);
  tunnel(t, [[30, 33], [30, 42]]);
  rubble(t, rng, 30, 22, 18, 12, 14);
  for (const [c, r] of [[22, 18], [37, 26], [26, 29], [35, 15], [19, 25]] as const) prop("bones", c, r);
  for (const [c, r] of [[29, 4], [29, 39]] as const) prop("sconce", c, r);
  who("weaver", 30, 21, { scale: 2.2 });
  t.bosses.push({ name: "The Weaver", area: "web", col: 30, row: 21 });

  const notes: Note[] = [{ at: { col: 31, row: 6 }, text: "White ground holds you, and she comes for whoever it holds." }];
  const exits: AreaExit[] = [
    { to: "deeps", name: "The Web", kind: "open", at: { col: 30, row: 3 } },
    { to: "hollow", name: "Sinking Stair", kind: "open", at: { col: 30, row: 42 }, guard: "weaver" },
  ];
  const districts: District[] = [
    { name: "The Weaver's Web", at: { col: 30, row: 22 }, palette: [5], dress: "deeps", box: { x: 10, y: 8, w: 41, h: 28 } },
    { name: "The Deeps' Floor", at: { col: 30, row: 4 }, palette: [5], dress: "deeps" },
    { name: "Sinking Stair", at: { col: 30, row: 40 }, palette: [4], dress: "hollow" },
  ];
  const tier = stone(t.finish({}, [{ col: 30, row: 5 }]));
  const arena = { boss: "weaver", gate: [], inside: { col: 30, row: 22 } };
  return { ...tier, area: "web", entry: { col: 30, row: 5 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Shell Isle: the Shell Below's room of its own, an isle in a lake under the fen, a land apart. Over the causeway
 * from the Drowned Hollow, the stone trees on the isle, the turtle asleep in the middle of it; past it the Shell
 * Stair up to the Fen, the one way back up from the bottom of the world.
 */
function shellisle(): AreaMap {
  const rng = makeRng("area:shellisle");
  const t = tierBuilder("below", rng, { cols: 64, rows: 48 });
  const { prop, who } = t;

  t.blob("shellisle", 34, 24, 27, 19);
  lake(t, 34, 24, 23, 16);
  t.blob("shellisle", 34, 24, 13, 9);
  t.bridge({ col: 1, row: 24 }, { col: 22, row: 24 }, 3);
  openEdge(t, 0, 24);
  t.bridge({ col: 34, row: 15 }, { col: 34, row: 8 }, 3);
  t.blob("shellisle", 34, 6, 4, 3);
  for (const [c, r] of [[27, 20], [41, 20], [28, 29], [40, 29]] as const) prop("deadTree", c, r, { scale: 0.55 });
  for (const [c, r] of [[31, 27], [38, 22]] as const) prop("goldStone", c, r);
  who("shellBelow", 34, 24, { scale: 1.3 });
  t.bosses.push({ name: "The Shell Below", area: "shellisle", col: 34, row: 24 });

  const notes: Note[] = [{ at: { col: 6, row: 23 }, text: "Strike it while it sleeps. After that, only a spin into the lake opens its shell." }];
  const exits: AreaExit[] = [
    { to: "hollow", name: "The Shell", kind: "open", at: { col: 1, row: 24 } },
    { to: "fen", name: "The Shell Stair", kind: "lift", at: { col: 34, row: 5 }, guard: "shellBelow" },
  ];
  const districts: District[] = [
    { name: "The Shell Isle", at: { col: 34, row: 24 }, palette: [5, 3], dress: "hollow", box: { x: 19, y: 13, w: 31, h: 22 } },
    { name: "The Causeway", at: { col: 8, row: 24 }, palette: [4], dress: "hollow" },
    { name: "The Shell Stair", at: { col: 34, row: 6 }, palette: [4], dress: "undercroft" },
  ];
  const tier = stone(t.finish({}, [{ col: 4, row: 24 }]));
  const arena = { boss: "shellBelow", gate: [], inside: { col: 34, row: 24 } };
  return { ...tier, area: "shellisle", entry: { col: 4, row: 24 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Grey Keep's hall: the Grey Warlord's room of its own, a land apart. In off the Greyfall's crown at the hall's
 * south door, down the nave between the black towers, to the dais with the throne he does not sit in; behind it the
 * Throne Stair up to the Throne Isle in the sky.
 */
function throne(): AreaMap {
  const rng = makeRng("area:throne");
  const t = tierBuilder("surface", rng, { cols: 64, rows: 44 });
  const { prop, who } = t;
  const black = { color: "black" } as const;

  t.ground("throne", 8, 5, 48, 33);
  t.block(2, 20, 5, 24, 8);
  t.stair(2, 19, 12, "L");
  t.stair(2, 44, 12, "R");
  edgeWay(t, { col: 32, row: 37 }, { col: 32, row: 42 });
  t.road([32, 42], [32, 14]);
  for (const r of [18, 28]) for (const c of [14, 23, 41, 50]) prop("tower", c, r, black);
  prop("castle", 32, 7, black);
  for (const [c, r] of [[24, 10], [40, 10], [17, 33], [47, 33]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[28, 22], [38, 26], [20, 24]] as const) prop("bones", c, r);
  who("warlord", 32, 21);
  t.bosses.push({ name: "The Grey Warlord", area: "throne", col: 32, row: 21 });

  const exits: AreaExit[] = [
    { to: "greyfall", name: "The Grey Keep", kind: "open", at: { col: 32, row: 42 } },
    { to: "gilded", name: "Throne Stair", kind: "lift", at: { col: 36, row: 9 }, guard: "warlord" },
  ];
  const districts: District[] = [
    { name: "The Grey Keep", at: { col: 32, row: 22 }, palette: [5, 4], gloom: true, dress: "greyfall", decor: 0.5, box: { x: 7, y: 4, w: 50, h: 35 } },
    { name: "The Keep Door", at: { col: 32, row: 40 }, levels: [1], palette: [4], dress: "greyfall", decor: 0.5 },
  ];
  const tier = t.finish({}, [{ col: 32, row: 40 }]);
  const notes: Note[] = [{ at: { col: 33, row: 39 }, text: "Near him the warmth leaves you. Strike once and step back." }];
  const arena = { boss: "warlord", gate: [], inside: { col: 32, row: 22 } };
  return { ...tier, area: "throne", entry: { col: 32, row: 40 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Tinker Peak: Old Bamboo's room of its own, the rock's summit, a land apart. Up off the Crags' top step onto the
 * bamboo-ringed summit where the old panda sits, and past him the gnomes' crane, the Gnome Lift up into the clouds.
 */
function peak(): AreaMap {
  const rng = makeRng("area:peak");
  const t = tierBuilder("surface", rng, { cols: 56, rows: 44 });
  const { prop, who } = t;

  t.blob("peak", 28, 22, 18, 13);
  edgeWay(t, { col: 28, row: 34 }, { col: 28, row: 42 });
  t.ground("peak", 25, 4, 7, 6);
  t.grove(28, 22, 21, 16, 0.08);
  for (const [c, r] of [[20, 16], [36, 15], [19, 28], [37, 29]] as const) prop("stump", c, r);
  prop("gnomeTower", 31, 6);
  who("oldBamboo", 28, 22);
  t.bosses.push({ name: "Old Bamboo", area: "peak", col: 28, row: 22 });

  const notes: Note[] = [{ at: { col: 29, row: 39 }, text: "He sits down to eat after he throws. Strike him while he eats." }];
  const exits: AreaExit[] = [
    { to: "crags", name: "The Tinker Peak", kind: "open", at: { col: 28, row: 42 } },
    { to: "gilded", name: "Gnome Lift", kind: "lift", at: { col: 28, row: 6 }, guard: "oldBamboo" },
  ];
  const districts: District[] = [
    { name: "The Tinker Peak", at: { col: 28, row: 22 }, palette: [2], dress: "crags", decor: 1, box: { x: 9, y: 10, w: 38, h: 25 } },
    { name: "The Crane", at: { col: 28, row: 6 }, palette: [2], dress: "crags", decor: 0.5 },
    { name: "The Summit Path", at: { col: 28, row: 38 }, palette: [2], dress: "crags", decor: 1 },
  ];
  const tier = t.finish({}, [{ col: 28, row: 38 }]);
  const arena = { boss: "oldBamboo", gate: [], inside: { col: 28, row: 22 } };
  return { ...tier, area: "peak", entry: { col: 28, row: 38 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

/**
 * The Sun Hall: the Sun Sentinel's room of its own, hung in the sky between the Gilded City and the Throne Isle, a
 * land apart. In over the west bridge from the city's crown, the hall of gold between its two rows of towers, the
 * Sentinel behind its shield; out over the Gilded Span to the Throne Isle, its key in hand.
 */
function sunhall(): AreaMap {
  const rng = makeRng("area:sunhall");
  const t = tierBuilder("sky", rng, { cols: 64, rows: 30 });
  const { prop, who } = t;
  const gold = { color: "yellow" } as const;

  t.ground("sunhall", 9, 7, 46, 16);
  t.bridge({ col: 1, row: 15 }, { col: 9, row: 15 }, 3);
  t.bridge({ col: 54, row: 15 }, { col: 62, row: 15 }, 3);
  t.road([1, 15], [62, 15]);
  for (const r of [9, 21]) for (const c of [16, 26, 38, 48]) prop("tower", c, r, gold);
  for (const [c, r] of [[22, 13], [42, 17]] as const) prop("goldStone", c, r);
  who("sunSentinel", 32, 15);
  t.bosses.push({ name: "The Sun Sentinel", area: "sunhall", col: 32, row: 15 });

  const notes: Note[] = [{ at: { col: 4, row: 14 }, text: "Its shield faces you. Be where it does not." }];
  const exits: AreaExit[] = [
    { to: "gilded", name: "The Sun Hall", kind: "open", at: { col: 1, row: 15 } },
    { to: "gilded", name: "The Gilded Span", kind: "open", at: { col: 62, row: 15 }, guard: "sunSentinel" },
  ];
  const districts: District[] = [
    { name: "The Sun Hall", at: { col: 32, row: 15 }, palette: [1], dress: "gilded", decor: 0.5, box: { x: 9, y: 6, w: 46, h: 18 } },
    { name: "The West Bridge", at: { col: 4, row: 15 }, palette: [1], dress: "gilded" },
    { name: "The Gilded Span", at: { col: 59, row: 15 }, palette: [1], dress: "gilded" },
  ];
  const tier = t.finish({}, [{ col: 4, row: 15 }]);
  const arena = { boss: "sunSentinel", gate: [], inside: { col: 32, row: 15 } };
  return { ...tier, area: "sunhall", entry: { col: 4, row: 15 }, exits, districts, districtAt: districtGrid(tier, districts, t), decks: [], notes, arena };
}

const BUILT: Partial<Record<AreaId, () => AreaMap>> = { harbour, emberwood, crags, greyfall, gilded, steps, undercroft, deeps, hollow, barrowmoor, fen, saltreach, landing, burg, ramparts, chapel, ring, keep: keepArea, bullwall, belfry, trollpit, barrow, web, shellisle, throne, peak, sunhall };

/** The areas that have a map of their own so far. */
export const MAPPED_AREAS = Object.keys(BUILT) as AreaId[];

/** An area's own map, the same every time. */
const made = new Map<AreaId, AreaMap>();

/** Areas up on the hill or deep in the wood, not on the shore: the sea round them is woods instead. */
const HILL: ReadonlySet<AreaId> = new Set(["burg", "ramparts", "chapel", "keep", "bullwall", "belfry", "trollpit", "throne", "peak"]);

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
    // The Harbour's north edge is woods behind the castle hill, not the sea.
    made.set(id, m.base === "rock" ? m : HILL.has(id) ? wooded(pad(m, 3)) : id === "harbour" ? wooded(pad(m, 3), 6) : pad(m, 3));
  }
  return made.get(id)!;
}
