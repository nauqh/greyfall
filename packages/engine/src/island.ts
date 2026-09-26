/**
 * The island the war is fought on: what each cell is, and where feet may go.
 * Moved here from the web app so the server can run a battle phase; the map
 * scene draws from the same rows.
 */

/** `~` water, `.` ground, `#` plateau. `<` / `>` are ramps, cut into a
 *  cliff where it steps down a row: plateau above the ramp, the deeper part
 *  of the plateau beside it (right of `<`, left of `>`), and the shallower
 *  part's cliff face on the other side. The ramp runs down into the row
 *  below. The row under a plateau's bottom edge is its cliff face, so it is
 *  drawn as stone and nothing stands there. */
export const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~#########~~~~~~~~~~~.....~~~~",
  "~~#############~~~~~~~.........~",
  "~~#############....~~~..######.~",
  "~~#############.....~...####>..~",
  "~~..#########>..........~~.....~",
  "~~..............~...........~~~~",
  "~~~...######.....~~~~........~~~",
  "~~~...####>.....~~~~~~.......~~~",
  "~~~.............~~~..~~.......~~",
  "~~..........~~~~~~~~~~~.......~~",
  "~~..#####..~~~~~.~~~~~~~......~~",
  "~~..###>..~~~~~~~~~~..........~~",
  "~~.......~~~~~~~..........###.~~",
  "~~~~.....~~~~~~......#########~~",
  "~~~~.....~~~~~.......#########~~",
  "~~~~~~~..~~~..........<#######~~",
  "~~~~~~~~~~~~~..........~~~~~~~~~",
  "~~..~~~~~~~~~~~~~.....~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
export const STRAT_COLS = MAP[0]!.length;
export const STRAT_ROWS = MAP.length;

export interface Cell {
  col: number;
  row: number;
}

export function at(col: number, row: number): string {
  return MAP[row]?.[col] ?? "~";
}
export function isLand(col: number, row: number): boolean {
  return at(col, row) !== "~";
}
export function isHigh(col: number, row: number): boolean {
  return "#<>".includes(at(col, row));
}
export function isSlope(col: number, row: number): boolean {
  return "<>".includes(at(col, row));
}
/** A plateau cell or slope whose south side drops. */
export function castsCliff(col: number, row: number): boolean {
  return isHigh(col, row) && !isHigh(col, row + 1);
}
/** Land that is not a cliff face. A slope's lower half is the ramp, so it
 *  stays walkable. */
export function isWalkable(col: number, row: number): boolean {
  return isLand(col, row) && !(at(col, row - 1) === "#" && castsCliff(col, row - 1));
}
export function level(col: number, row: number): number {
  return isHigh(col, row) ? 2 : isLand(col, row) ? 1 : 0;
}

/** One move to a neighbouring cell. The level only changes on a ramp, from
 *  a slope's top straight down to its foot or back up. Diagonals stay on
 *  one level and never cut a corner. */
export function canStep(from: Cell, to: Cell): boolean {
  if (!isWalkable(to.col, to.row)) return false;
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (dc !== 0 && dr !== 0) {
    const lv = level(from.col, from.row);
    return (
      [to, { col: to.col, row: from.row }, { col: from.col, row: to.row }].every(
        (c) => isWalkable(c.col, c.row) && level(c.col, c.row) === lv,
      )
    );
  }
  if (level(from.col, from.row) === level(to.col, to.row)) return true;
  const top = dr > 0 ? from : to;
  return dc === 0 && isSlope(top.col, top.row);
}

const STEPS = new Map<number, readonly Cell[]>();

/** The neighbours one legal step away, in the fixed order routes use.
 *  The map never changes, so each cell's list is worked out once. */
export function stepsFrom(c: Cell): readonly Cell[] {
  const key = c.row * STRAT_COLS + c.col;
  let out = STEPS.get(key);
  if (!out) {
    const list: Cell[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const next = { col: c.col + dc, row: c.row + dr };
        if ((dc || dr) && canStep(c, next)) list.push(next);
      }
    }
    out = list;
    STEPS.set(key, out);
  }
  return out;
}

export function cellKey(c: Cell): number {
  return c.row * STRAT_COLS + c.col;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

/** King moves: a diagonal costs the same as a straight step. */
export function tileDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/**
 * Breadth-first over the eight neighbours, in a fixed order so every caller
 * gets the same route. The cells after `from`, up to and including the
 * first that satisfies `goal`; empty when `from` already does, null when
 * none can be reached. `blocked` cells are never entered, though a goal
 * cell may be blocked-free only if the caller says so.
 */
export function findRoute(
  from: Cell,
  goal: (c: Cell) => boolean,
  blocked: (c: Cell) => boolean = () => false,
): Cell[] | null {
  if (goal(from)) return [];
  const prev = new Map<number, Cell | null>([[cellKey(from), null]]);
  const queue: Cell[] = [from];
  for (let head = 0; head < queue.length; head++) {
    for (const next of stepsFrom(queue[head]!)) {
      if (prev.has(cellKey(next)) || blocked(next)) continue;
      prev.set(cellKey(next), queue[head]!);
      if (goal(next)) {
        const path: Cell[] = [];
        for (let c: Cell | null = next; c && cellKey(c) !== cellKey(from); c = prev.get(cellKey(c)) ?? null) {
          path.unshift(c);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** The cells after `from`, up to and including `to`; empty when already
 *  there, null when unreachable. */
export function findPath(from: Cell, to: Cell, blocked?: (c: Cell) => boolean): Cell[] | null {
  return findRoute(from, (c) => sameCell(c, to), blocked);
}

/** Every plateau cell joined to `start` without leaving the high ground. */
export function plateauOf(start: Cell): Cell[] {
  if (!isHigh(start.col, start.row)) return [];
  const seen = new Set<number>([cellKey(start)]);
  const out: Cell[] = [start];
  for (let head = 0; head < out.length; head++) {
    const cur = out[head]!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { col: cur.col + dc, row: cur.row + dr };
      if (seen.has(cellKey(next)) || !isHigh(next.col, next.row)) continue;
      seen.add(cellKey(next));
      out.push(next);
    }
  }
  return out;
}

export type WarSide = "a" | "b";

export type BuildingKind = "castle" | "barracks" | "archery" | "tower" | "monastery" | "house";

/** A fixed building site. The footprint is the base the art stands on, not
 *  the art itself: the castle's 3x2, a production building's 2x1, a house's
 *  one tile. Nobody walks through a plot, built or not. */
export interface Plot {
  id: string;
  side: WarSide;
  kind: BuildingKind;
  col: number;
  row: number;
  w: number;
  h: number;
}

function plot(side: WarSide, kind: BuildingKind, col: number, row: number, n = ""): Plot {
  const [w, h] = kind === "castle" ? [3, 2] : kind === "house" ? [1, 1] : [2, 1];
  return { id: `${side}-${kind}${n}`, side, kind, col, row, w, h };
}

/** Blue holds the north-west plateau, red the south-east one. Red's plateau
 *  is half the size of blue's, so its plots pack tighter; both leave a lane
 *  from every plot to their ramp (checked in the tests). */
export const PLOTS: readonly Plot[] = [
  plot("a", "castle", 5, 2),
  plot("a", "barracks", 10, 3),
  plot("a", "archery", 8, 1),
  plot("a", "tower", 2, 2),
  plot("a", "monastery", 12, 2),
  plot("a", "house", 4, 5, "1"),
  plot("a", "house", 6, 5, "2"),
  plot("a", "house", 8, 5, "3"),
  plot("b", "castle", 25, 14),
  plot("b", "barracks", 28, 14),
  plot("b", "archery", 28, 16),
  plot("b", "tower", 23, 14),
  plot("b", "monastery", 27, 13),
  plot("b", "house", 26, 13, "1"),
  plot("b", "house", 21, 14, "2"),
  plot("b", "house", 29, 15, "3"),
];

export function plotCells(p: Plot): Cell[] {
  const out: Cell[] = [];
  for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) out.push({ col: c, row: r });
  return out;
}

/** Tiles from `c` to the nearest tile of a plot's footprint. */
export function plotDistance(p: Plot, c: Cell): number {
  const dc = c.col < p.col ? p.col - c.col : c.col >= p.col + p.w ? c.col - (p.col + p.w - 1) : 0;
  const dr = c.row < p.row ? p.row - c.row : c.row >= p.row + p.h ? c.row - (p.row + p.h - 1) : 0;
  return Math.max(dc, dr);
}

export interface Mine {
  id: string;
  col: number;
  row: number;
}

/** One by each base and one contested on the eastern lowland, the only
 *  ground both ramps reach; the lake between the bases has no shore to stand on. */
export const MINES: readonly Mine[] = [
  { id: "mine-a", col: 15, row: 3 },
  { id: "mine-b", col: 16, row: 14 },
  { id: "mine-mid", col: 24, row: 8 },
];

/** Where a side's own castle stands; its plateau is that side's home. */
export function castlePlot(side: WarSide): Plot {
  return PLOTS.find((p) => p.side === side && p.kind === "castle")!;
}

const HOME: Record<WarSide, Set<number>> = {
  a: new Set(plateauOf(castlePlot("a")).map(cellKey)),
  b: new Set(plateauOf(castlePlot("b")).map(cellKey)),
};

export function isHome(side: WarSide, c: Cell): boolean {
  return HOME[side].has(cellKey(c));
}

/** Tiles no unit may stand on: every plot and every mine. */
const STATIC_BLOCKED = new Set<number>([
  ...PLOTS.flatMap((p) => plotCells(p).map(cellKey)),
  ...MINES.map(cellKey),
]);

export function isStaticBlocked(c: Cell): boolean {
  return STATIC_BLOCKED.has(cellKey(c));
}

/** Walkable and free of buildings and mines. */
export function isOpen(c: Cell): boolean {
  return isWalkable(c.col, c.row) && !isStaticBlocked(c);
}

/** The open tiles beside a mine, on the mine's own level: where Pawns dig. */
export function mineSlots(mine: Mine): Cell[] {
  const out: Cell[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = { col: mine.col + dc, row: mine.row + dr };
      if ((dc || dr) && isOpen(c) && level(c.col, c.row) === level(mine.col, mine.row)) out.push(c);
    }
  }
  return out;
}

const BUILD_SLOTS = new Map<string, Cell[]>();

/** Where a Pawn stands to build a plot: the nearest open tiles on the plot's
 *  own plateau, never down its cliff. */
export function buildSlots(p: Plot): Cell[] {
  let out = BUILD_SLOTS.get(p.id);
  if (out) return out;
  out = [];
  for (let d = 1; out.length === 0 && d <= 3; d++) {
    for (let r = p.row - d; r < p.row + p.h + d; r++) {
      for (let c = p.col - d; c < p.col + p.w + d; c++) {
        const cell = { col: c, row: r };
        if (plotDistance(p, cell) === d && isOpen(cell) && isHome(p.side, cell)) out.push(cell);
      }
    }
  }
  BUILD_SLOTS.set(p.id, out);
  return out;
}
