/**
 * The island the war is fought on: what each cell is, and where feet may go.
 * Moved here from the web app so the server can run a battle phase; the map
 * scene draws from the same rows.
 */

/** `~` water, `.` lowland (level 1), `T` forest (lowland no one walks
 *  through; arrows fly over), `#` plateau (level 2), `%` wooded high ground
 *  (level 2, a terrace no one walks on), `^` the Crown (level
 *  3). `<` / `>` are ramps up to a plateau and `[` / `]` stairs up to the
 *  Crown. As in the pack's tilemap guide, a ramp stands just outside the
 *  higher ground, beside its bottom row: that ground on one side (right of
 *  `<`, left of `>`), lower ground above it and on the other side. It runs
 *  down into the row below, beside the cliff. The row under higher ground's
 *  bottom edge is its cliff face, so it is drawn as stone and nothing stands
 *  there. Red's half is blue's turned half round, bases in opposite corners,
 *  except the high ground: cliffs only face south, so every plateau is wide
 *  on top and a tile narrower each side every two rows, which shows its
 *  sides as short cliffs, and each ramp and stair stands on its own south
 *  edge. Walks stay within two steps of even. */
export const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~%%########....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..TTTT~~~~~",
  "~~~%%########....~~~TT.....~~~......~~~..~~.~~~~....TTTT..~~~",
  "~~~#########..............TTTTT....TTTTT..................~~~",
  "~~~#########>.............................................T~~",
  "~~~########.............................................%%%~~",
  "~~~########.....................%%............%%........%%%~~",
  "~~~.######......................%%......................%%%~~",
  "~~~.######...........TTT..................TT..............T~~",
  "~~...................TTT..................TT...............~~",
  "~~..........................TTTTT......~~~~~~.............~~~",
  "~~TT..............TTT..................~~~~~~~............~~~",
  "~~TT.........TT...TTT.....TT.....TTT...~~~~TT~......###....~~",
  "~~~.....TTT..TT...........TT.....TTT...~~~~~~~..TT.<###..TT~~",
  "~~~.....TTT............................~~~~~~~..TT.......TT~~",
  "~~~....................................~~~~~~~..TT........~~~",
  "~~~...................#################~~~~~..............~~~",
  "~~~....TTT...........<#####^^^^^^^#####>..~~~~.....TTT....~~~",
  "~~~....TTT.....~~~~...~###[^^^^^^^]###.............TTT....~~~",
  "~~~..............~~~~~~#####^^^^^#####....................~~~",
  "~~~........TT..~~~~~~~..####^^^^^####.....................~~~",
  "~~TT.......TT..~~~~~~~..#############.............TTT.....~~~",
  "~~TT..###..TT..~~~~~~~...###########..........TT..TTT.....~~~",
  "~~....###>.....~TT~~~~...###########....TTT...TT.........TT~~",
  "~~~............~~~~~~~..................TTT..............TT~~",
  "~~~.............~~~~~~......TTTTT..........................~~",
  "~~...............TT..................TTT...................~~",
  "~~T..............TT..................TTT........##########~~~",
  "~~%%%......................%%..................<##########~~~",
  "~~%%%........%%............%%....................#########~~~",
  "~~%%%............................................#########~~~",
  "~~T...............................................########~~~",
  "~~~..................TTTTT....TTTTT...............########~~~",
  "~~~..TTTT....~~~~.~~..~~~......~~~.....TT~~~.......####%%~~~~",
  "~~~~~TTTT..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.......####%%~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
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
export function level(col: number, row: number): number {
  const ch = at(col, row);
  return "^[]".includes(ch) ? 3 : "#<>%".includes(ch) ? 2 : ch === "~" ? 0 : 1;
}
/** Any ground above the lowland: a plateau, the Crown, or a ramp onto either. */
export function isHigh(col: number, row: number): boolean {
  return level(col, row) >= 2;
}
export function isSlope(col: number, row: number): boolean {
  return "<>[]".includes(at(col, row));
}
export function isForest(col: number, row: number): boolean {
  return "T%".includes(at(col, row));
}
/** High ground, not a ramp, whose south side drops. */
export function castsCliff(col: number, row: number): boolean {
  return "#^%".includes(at(col, row)) && level(col, row + 1) < level(col, row);
}
/** Land that is neither forest nor a cliff face. A slope's lower half is the
 *  ramp, so it stays walkable. */
export function isWalkable(col: number, row: number): boolean {
  return isLand(col, row) && !isForest(col, row) && !castsCliff(col, row - 1);
}

/** One move to a neighbouring cell. The level only changes on a ramp, one
 *  level at a time, from a slope's top straight down to its foot or back up.
 *  Diagonals stay on one level and never cut a corner. */
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
  const [top, foot] = dr > 0 ? [from, to] : [to, from];
  return dc === 0 && isSlope(top.col, top.row) && level(top.col, top.row) - level(foot.col, foot.row) === 1;
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

/** Every cell joined to `start` without leaving its level of high ground. */
export function plateauOf(start: Cell): Cell[] {
  if (!isHigh(start.col, start.row)) return [];
  const lv = level(start.col, start.row);
  const seen = new Set<number>([cellKey(start)]);
  const out: Cell[] = [start];
  for (let head = 0; head < out.length; head++) {
    const cur = out[head]!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { col: cur.col + dc, row: cur.row + dr };
      if (seen.has(cellKey(next)) || level(next.col, next.row) !== lv) continue;
      seen.add(cellKey(next));
      out.push(next);
    }
  }
  return out;
}

export type WarSide = "a" | "b";
/** A unit's side: a player's, or "m", the monsters, hostile to both. */
export type UnitSide = WarSide | "m";

export type BuildingKind = "castle" | "barracks" | "tower" | "cannon" | "house";

/** A building's footprint: the base the art stands on, not the art itself.
 *  Nobody walks through one. */
export interface Plot {
  id: string;
  side: WarSide;
  kind: BuildingKind;
  col: number;
  row: number;
  w: number;
  h: number;
}

export const FOOTPRINT: Record<BuildingKind, { w: number; h: number }> = {
  castle: { w: 3, h: 2 },
  barracks: { w: 2, h: 1 },
  tower: { w: 2, h: 1 },
  cannon: { w: 1, h: 1 },
  house: { w: 1, h: 1 },
};

export function plotCells(p: { col: number; row: number; w: number; h: number }): Cell[] {
  const out: Cell[] = [];
  for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) out.push({ col: c, row: r });
  return out;
}

/** Tiles from `c` to the nearest tile of a footprint. */
export function plotDistance(p: { col: number; row: number; w: number; h: number }, c: Cell): number {
  const dc = c.col < p.col ? p.col - c.col : c.col >= p.col + p.w ? c.col - (p.col + p.w - 1) : 0;
  const dr = c.row < p.row ? p.row - c.row : c.row >= p.row + p.h ? c.row - (p.row + p.h - 1) : 0;
  return Math.max(dc, dr);
}

/** Where each clan's castle and first barracks stand; the castle's plateau
 *  is that side's home. Blue holds the north-west corner, red the south-east. */
export const START: Record<WarSide, { castle: Cell; barracks: Cell }> = {
  a: { castle: { col: 5, row: 4 }, barracks: { col: 8, row: 7 } },
  b: { castle: { col: 53, row: 32 }, barracks: { col: 51, row: 30 } },
};

/** A side's castle. It never moves and cannot be rebuilt, so its footprint
 *  is fixed. */
export function castlePlot(side: WarSide): Plot {
  return { id: `${side}-castle`, side, kind: "castle", ...START[side].castle, ...FOOTPRINT.castle };
}

export interface Mine {
  id: string;
  col: number;
  row: number;
}

/** Per side, in the order a Pawn looks for work: home on the plateau, the
 *  yard below its ramp, then the two expansions in the side's own flank
 *  corner, near and far, which the enemy's flank road passes. The rich mine
 *  under the Lair, on the Crown, belongs to nobody. */
export const MINES: readonly Mine[] = [
  { id: "mine-a", col: 5, row: 8 },
  { id: "mine-b", col: 55, row: 29 },
  { id: "mine-ya", col: 17, row: 12 },
  { id: "mine-yb", col: 43, row: 26 },
  { id: "mine-ca", col: 4, row: 26 },
  { id: "mine-cb", col: 55, row: 12 },
  { id: "mine-fa", col: 10, row: 33 },
  { id: "mine-fb", col: 50, row: 5 },
  { id: "mine-mid", col: 30, row: 21 },
];

const HOME: Record<WarSide, Set<number>> = {
  a: new Set(plateauOf(START.a.castle).map(cellKey)),
  b: new Set(plateauOf(START.b.castle).map(cellKey)),
};

export function isHome(side: UnitSide, c: Cell): boolean {
  return side !== "m" && HOME[side].has(cellKey(c));
}

/** Where monster waves spawn: the middle of the Crown. */
export const LAIR: Cell = { col: 30, row: 18 };

const MINE_CELLS = new Set<number>(MINES.map(cellKey));

/** Terrain that is walkable and holds no mine. Buildings come and go, so the
 *  war's own checks add theirs on top (war.ts isFree). */
export function isOpen(c: Cell): boolean {
  return isWalkable(c.col, c.row) && !MINE_CELLS.has(cellKey(c));
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

/** Where a Pawn stands to build a footprint: the nearest open tiles on the
 *  footprint's own level, never down its cliff. */
export function buildSlots(p: Plot, blocked: (c: Cell) => boolean = () => false): Cell[] {
  const lv = level(p.col, p.row);
  for (let d = 1; d <= 3; d++) {
    const out: Cell[] = [];
    for (let r = p.row - d; r < p.row + p.h + d; r++) {
      for (let c = p.col - d; c < p.col + p.w + d; c++) {
        const cell = { col: c, row: r };
        if (plotDistance(p, cell) === d && isOpen(cell) && !blocked(cell) && level(c, r) === lv) out.push(cell);
      }
    }
    if (out.length > 0) return out;
  }
  return [];
}
