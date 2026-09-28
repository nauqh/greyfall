import { describe, expect, it } from "vitest";

import { BALANCE, MAP, START, cellKey, isLand, newMatch, visibleCells, type MatchState, type WarSide, type WarUnit } from "../src/index.ts";

function pawnAt(side: WarSide, col: number, row: number, id: number): WarUnit {
  return { id, side, class: "pawn", hp: BALANCE.units.pawn.hp, col, row, order: { type: "stop" }, stance: "firm", post: { col, row } };
}

/** Castles and barracks only, nobody on the island. */
function bare(): MatchState {
  return { ...newMatch("fog", "realtime"), units: [] };
}

const sees = (s: MatchState, side: WarSide, col: number, row: number) => visibleCells(s, side).has(cellKey({ col, row }));

describe("fog of war", () => {
  it("opens on a small part of the island round your own base", () => {
    const s = newMatch("fog", "realtime");
    const land = MAP.flatMap((line, row) => [...line].map((_, col) => ({ col, row }))).filter((c) => isLand(c.col, c.row));
    const seen = visibleCells(s, "a");
    expect(sees(s, "a", START.a.castle.col, START.a.castle.row)).toBe(true);
    expect(sees(s, "a", START.b.castle.col, START.b.castle.row)).toBe(false);
    expect(sees(s, "a", 30, 30)).toBe(false);
    expect(land.filter((c) => seen.has(cellKey(c))).length / land.length).toBeLessThan(0.2);
  });

  it("gives vision only to its own side", () => {
    const s = { ...bare(), units: [pawnAt("b", 30, 28, 2)] };
    expect(sees(s, "b", 30, 28)).toBe(true);
    expect(sees(s, "a", 30, 28)).toBe(false);
  });

  it("does not see up a cliff, but sees down one", () => {
    const below = { ...bare(), units: [pawnAt("a", 20, 16, 1)] };
    expect(sees(below, "a", 20, 15)).toBe(true);
    expect(sees(below, "a", 23, 17)).toBe(false);
    const above = { ...bare(), units: [pawnAt("a", 23, 17, 1)] };
    expect(sees(above, "a", 20, 15)).toBe(true);
    expect(sees(above, "a", 23, 17)).toBe(true);
  });
});
