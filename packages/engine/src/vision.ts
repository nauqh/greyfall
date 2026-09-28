/**
 * Fog of war: what a side sees right now. Pure, so the map scene draws it
 * today and a server can filter what it sends each player later.
 */

import { WAR } from "./balance.ts";
import { STRAT_COLS, STRAT_ROWS, castlePlot, cellKey, level, plateauOf, type Cell, type WarSide } from "./island.ts";
import type { MatchState } from "./war.ts";

/** Where a side looks from: each unit, and each building from its
 *  footprint's middle, reaching as far past its edge as a unit would. `eye`
 *  is the level it stands on. */
export interface Sight {
  col: number;
  row: number;
  radius: number;
  eye: number;
}

/** The middle of a side's home plateau, where its castle looks out from, so
 *  the castle lights its plateau evenly rather than mostly north of it. */
const HALL_EYE: Record<WarSide, Cell> = {
  a: middle(plateauOf(castlePlot("a"))),
  b: middle(plateauOf(castlePlot("b"))),
};

function middle(cells: Cell[]): Cell {
  const span = (pick: (c: Cell) => number) => (Math.min(...cells.map(pick)) + Math.max(...cells.map(pick))) / 2;
  return { col: span((c) => c.col), row: span((c) => c.row) };
}

export function sightsOf(state: MatchState, side: WarSide): Sight[] {
  const out: Sight[] = [];
  for (const u of state.units) {
    if (u.side === side) out.push({ col: u.col, row: u.row, radius: WAR.sight.units[u.class], eye: level(u.col, u.row) });
  }
  for (const b of Object.values(state.buildings)) {
    if (b.side !== side) continue;
    const mid: Cell = b.kind === "castle" ? HALL_EYE[b.side] : { col: b.col + (b.w - 1) / 2, row: b.row + (b.h - 1) / 2 };
    out.push({ ...mid, radius: (WAR.sight.buildings[b.kind] ?? 4) + (b.w - 1) / 2, eye: level(b.col, b.row) });
  }
  return out;
}

/** Whether a sight reaches a tile, level aside: off the map there is only sea. */
export function reaches(s: Sight, col: number, row: number): boolean {
  return (col - s.col) ** 2 + (row - s.row) ** 2 <= (s.radius + 0.5) ** 2;
}

/** Every tile within sight of one of `side`'s units or buildings, as
 *  cellKeys. Nobody sees up a cliff, as in StarCraft: a tile higher than the
 *  one looking at it stays hidden, so the High Pass and the Crown hide what
 *  stands on them until someone climbs. */
export function visibleCells(state: MatchState, side: WarSide, sights = sightsOf(state, side)): Set<number> {
  const out = new Set<number>();
  for (const s of sights) {
    for (let r = Math.max(0, Math.ceil(s.row - s.radius)); r <= Math.min(STRAT_ROWS - 1, s.row + s.radius); r++) {
      for (let c = Math.max(0, Math.ceil(s.col - s.radius)); c <= Math.min(STRAT_COLS - 1, s.col + s.radius); c++) {
        if (reaches(s, c, r) && level(c, r) <= s.eye) out.add(cellKey({ col: c, row: r }));
      }
    }
  }
  return out;
}
