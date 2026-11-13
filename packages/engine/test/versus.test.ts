import { describe, expect, it } from "vitest";

import { CHAMPIONS, VERSUS, armyCost, simulate, validateArmy, type Army } from "../src/index.ts";

const check = (army: Army) => validateArmy(army, VERSUS.budget, VERSUS.board, VERSUS.maxCopies);

const army: Army = [
  { class: "troll", col: 5, row: 1 },
  { class: "warrior", col: 5, row: 2 },
  { class: "lancer", col: 5, row: 0 },
  { class: "thief", col: 4, row: 1 },
  { class: "shaman", col: 2, row: 1 },
  { class: "archer", col: 2, row: 2 },
  { class: "monk", col: 1, row: 1 },
  { class: "skull", col: 0, row: 3 },
];

describe("Versus", () => {
  it("fields every champion", () => {
    for (const cls of CHAMPIONS) expect(check([{ class: cls, col: 5, row: 3 }])).toEqual([]);
  });

  it("accepts a full mixed army within the budget", () => {
    expect(armyCost(army)).toBeLessThanOrEqual(VERSUS.budget);
    expect(check(army)).toEqual([]);
  });

  it("rejects an army over the budget", () => {
    const rich: Army = Array.from({ length: 8 }, (_, i) => ({ class: "troll", col: i % 6, row: Math.floor(i / 6) }));
    expect(check(rich).some((e) => e.includes("budget"))).toBe(true);
  });

  it("caps copies of one champion", () => {
    const skulls = (n: number): Army => Array.from({ length: n }, (_, i) => ({ class: "skull", col: i, row: 0 }));
    expect(check(skulls(2))).toEqual([]);
    expect(check(skulls(3))).not.toEqual([]);
  });

  it("rejects a unit off the board", () => {
    expect(check([{ class: "skull", col: VERSUS.board.cols, row: 0 }])).not.toEqual([]);
    expect(check([{ class: "skull", col: 0, row: VERSUS.board.rows }])).not.toEqual([]);
  });

  it("plays the same battle from the same seed", () => {
    const other: Army = army.map((p) => ({ ...p, class: p.class === "troll" ? "minotaur" : p.class }));
    const one = simulate(army, other, 42, VERSUS);
    expect(simulate(army, other, 42, VERSUS)).toEqual(one);
    expect(one.events.some((e) => e.type === "ability")).toBe(true);
  });
});
