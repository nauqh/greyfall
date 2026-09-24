// The strategic map's grid: what each cell is, and where feet may go.
// Pure data and rules, no Phaser, so the pathing can be checked on its own
// (scripts/check-strat-map.ts).

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
  "~~.............~~...........~~~~",
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

/** Breadth-first over the eight neighbours. The cells after `from`, up to
 *  and including `to`; empty when already there, null when unreachable. */
export function findPath(from: Cell, to: Cell): Cell[] | null {
  const key = (c: Cell): number => c.row * STRAT_COLS + c.col;
  const prev = new Map<number, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.col === to.col && cur.row === to.row) {
      const path: Cell[] = [];
      for (let c: Cell | null = cur; c && key(c) !== key(from); c = prev.get(key(c)) ?? null) path.unshift(c);
      return path;
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const next = { col: cur.col + dc, row: cur.row + dr };
        if ((dc === 0 && dr === 0) || prev.has(key(next)) || !canStep(cur, next)) continue;
        prev.set(key(next), cur);
        queue.push(next);
      }
    }
  }
  return null;
}
