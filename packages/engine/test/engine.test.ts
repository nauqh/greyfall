import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  BALANCE,
  MAX_TICKS,
  TICKS_PER_ACTION,
  armyCost,
  battleCol,
  battleRow,
  chebyshev,
  damageAgainst,
  generateArmy,
  makeRng,
  neighbors,
  pathSteps,
  simulate,
  validateArmy,
  type Army,
  type UnitClass,
} from "../src/index.ts";

const BUYABLE: UnitClass[] = ["pawn", "warrior", "lancer", "archer", "monk"];

/** Arbitrary legal army: unique tiles, within the budget, never empty. */
const armyArb = (budget = BALANCE.budget) =>
  fc
    .uniqueArray(
      fc.record({
        class: fc.constantFrom(...BUYABLE),
        col: fc.integer({ min: 0, max: BALANCE.board.cols - 1 }),
        row: fc.integer({ min: 0, max: BALANCE.board.rows - 1 }),
      }),
      {
        minLength: 1,
        maxLength: BALANCE.board.maxUnits,
        selector: (p) => `${p.col},${p.row}`,
      },
    )
    .map((units) => {
      // Drop units from the back until the army is inside the budget.
      const kept: Army = [];
      let gold = budget;
      for (const u of units) {
        const cost = BALANCE.units[u.class].cost;
        if (cost > gold) continue;
        gold -= cost;
        kept.push(u);
      }
      return kept;
    })
    .filter((army) => army.length > 0);

const seedArb = fc.oneof(fc.integer({ min: 0, max: 2 ** 31 }), fc.string({ minLength: 1 }));

describe("balance", () => {

  it("applies the counter bonus only to the class it counters", () => {
    // Lancer beats Warrior, Warrior beats Archer, Archer beats Lancer.
    expect(damageAgainst("lancer", "warrior")).toBe(13); // 10 * 1.25, rounded
    expect(damageAgainst("warrior", "archer")).toBe(18); // 14 * 1.25, rounded
    expect(damageAgainst("archer", "lancer")).toBe(13); // 10 * 1.25, rounded
    expect(damageAgainst("lancer", "archer")).toBe(10);
    expect(damageAgainst("warrior", "lancer")).toBe(14);
    expect(damageAgainst("archer", "warrior")).toBe(10);
    expect(damageAgainst("monk", "warrior")).toBe(0);
  });

  it("counters are a cycle, and the Monk is outside it", () => {
    expect(BALANCE.counters.monk).toBeUndefined();
    for (const cls of ["warrior", "lancer", "archer"] as const) {
      expect(BALANCE.counters[BALANCE.counters[cls]!]).toBeDefined();
    }
  });
});

describe("rng", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = makeRng("hollow");
    const b = makeRng("hollow");
    const c = makeRng("ember");
    const rollsA = Array.from({ length: 16 }, () => a.next());
    const rollsB = Array.from({ length: 16 }, () => b.next());
    const rollsC = Array.from({ length: 16 }, () => c.next());
    expect(rollsA).toEqual(rollsB);
    expect(rollsA).not.toEqual(rollsC);
  });

  it("stays in [0, 1) and int() stays in range", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const rng = makeRng(seed);
        for (let i = 0; i < 200; i++) {
          const v = rng.next();
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
          const n = rng.int(7);
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(7);
        }
      }),
      { numRuns: 20 },
    );
  });
});

describe("geometry", () => {
  it("keeps row as a lane and mirrors column, side A left, side B right", () => {
    expect(battleRow("a", 0)).toBe(0);
    expect(battleRow("a", 2)).toBe(2);
    expect(battleRow("b", 0)).toBe(0);
    expect(battleRow("b", 2)).toBe(2);
    expect(battleCol("a", 0)).toBe(0);
    expect(battleCol("a", 4)).toBe(4); // A's front
    expect(battleCol("b", 4)).toBe(5); // B's front, adjacent to A's
    expect(battleCol("b", 0)).toBe(9); // B's back
  });

  it("measures Chebyshev distance, so a diagonal costs one step", () => {
    // The two front columns, same row: touching.
    expect(chebyshev({ col: 4, row: 1 }, { col: 5, row: 1 })).toBe(1);
    // Diagonals cost the same as straight steps.
    expect(chebyshev({ col: 4, row: 0 }, { col: 5, row: 1 })).toBe(1);
    expect(chebyshev({ col: 1, row: 0 }, { col: 2, row: 1 })).toBe(1);
    // A back-column unit is 5 cells from the enemy front line.
    expect(chebyshev({ col: 0, row: 1 }, { col: 5, row: 1 })).toBe(5);
    // Opposite back columns are the full width of the board apart.
    expect(chebyshev({ col: 0, row: 1 }, { col: 9, row: 1 })).toBe(9);
  });

  it("gives every cell eight neighbours, all one step away", () => {
    for (const row of [0, 1, 2]) {
      const ns = neighbors(4, row);
      expect(ns).toHaveLength(8);
      expect(new Set(ns.map((n) => `${n.col},${n.row}`)).size).toBe(8);
      for (const n of ns) expect(chebyshev({ col: 4, row }, n)).toBe(1);
    }
  });

  it("is symmetric, zero on itself, and never negative", () => {
    fc.assert(
      fc.property(
        fc.record({ col: fc.integer({ min: 0, max: 9 }), row: fc.integer({ min: 0, max: 2 }) }),
        fc.record({ col: fc.integer({ min: 0, max: 9 }), row: fc.integer({ min: 0, max: 2 }) }),
        (a, b) => {
          expect(chebyshev(a, b)).toBe(chebyshev(b, a));
          expect(chebyshev(a, a)).toBe(0);
          expect(chebyshev(a, b)).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe("validateArmy", () => {
  const ok: Army = [{ class: "warrior", col: 3, row: 1 }];

  it("accepts a legal army", () => {
    expect(validateArmy(ok)).toEqual([]);
  });

  it("rejects an empty army, a full board overflow and a stacked tile", () => {
    expect(validateArmy([]).join()).toMatch(/empty/);
    expect(
      validateArmy(
        [
          { class: "warrior", col: 3, row: 1 },
          { class: "archer", col: 3, row: 1 },
        ],
        99,
      ).join(),
    ).toMatch(/taken/);
  });

  it("rejects cells off the 5x3 half", () => {
    expect(validateArmy([{ class: "warrior", col: 5, row: 0 }]).join()).toMatch(/col 5/);
    expect(validateArmy([{ class: "warrior", col: 0, row: 3 }]).join()).toMatch(/row 3/);
  });

  it("rejects an army over budget", () => {
    const greedy: Army = Array.from({ length: 8 }, (_, i) => ({
      class: "monk" as const,
      col: i % BALANCE.board.cols,
      row: Math.floor(i / BALANCE.board.cols),
    }));
    expect(validateArmy(greedy).join()).toMatch(/budget/);
  });

  it("simulate refuses an invalid army rather than simulating it", () => {
    expect(() => simulate([], ok)).toThrow(/army a is invalid/);
    expect(() => simulate(ok, [{ class: "warrior", col: 9, row: 0 }])).toThrow(/army b is invalid/);
  });
});

describe("generateArmy", () => {
  it("is deterministic per seed and varies across seeds", () => {
    expect(generateArmy(20, 42)).toEqual(generateArmy(20, 42));
    const seeds = Array.from({ length: 12 }, (_, i) => JSON.stringify(generateArmy(20, i)));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("always produces a legal army inside the budget", () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 3, max: 60 }), (seed, budget) => {
        const army = generateArmy(budget, seed);
        expect(validateArmy(army, budget)).toEqual([]);
        expect(armyCost(army)).toBeLessThanOrEqual(budget);
      }),
      { numRuns: 200 },
    );
  });
});

describe("pathSteps", () => {
  const at = (cells: [number, number][]) => new Set(cells.map(([c, r]) => `${c},${r}`));

  it("steps toward the target across an empty board", () => {
    const steps = pathSteps({ col: 0, row: 1 }, { col: 5, row: 1 }, 1, at([]), 1);
    expect(steps[0]).toEqual({ col: 1, row: 1 });
  });

  it("goes round a wall of its own instead of backwards", () => {
    // Blocked dead ahead and diagonally up, the only lane is row 2. The
    // greedy version took whichever neighbour was least bad, which here is
    // the cell behind it.
    const blocked = at([
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    const steps = pathSteps({ col: 0, row: 1 }, { col: 5, row: 1 }, 1, blocked, 1);
    expect(steps[0]).toEqual({ col: 1, row: 2 });
  });

  it("gives nothing when there is no route at all", () => {
    // Walled off by a full column, on a board only three rows deep.
    const blocked = at([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(pathSteps({ col: 0, row: 1 }, { col: 5, row: 1 }, 1, blocked, 1)).toEqual([]);
  });
});

describe("simulate", () => {
  const warriorAt = (col: number, row: number): Army => [{ class: "warrior", col, row }];

  it("trades evenly in a mirror match: nobody gets a free first strike", () => {
    const result = simulate(warriorAt(4, 1), warriorAt(4, 1), 1);
    expect(result.winner).toBe("draw");
    expect(result.reason).toBe("wipe");
    expect(result.hpRemaining).toEqual({ a: 0, b: 0 });
    // 120 hp at 14 a hit: under half after the 5th, so each raises Guard once,
    // and both still fall on the same tick.
    const hits = result.events.filter((e) => e.type === "hit" && e.unit === "a0");
    const guards = result.events.filter((e) => e.type === "ability" && e.ability === "guard");
    expect(guards.map((e) => e.unit).sort()).toEqual(["a0", "b0"]);
    expect(hits[0]!.t).toBeLessThan(TICKS_PER_ACTION);
    expect(hits.filter((e) => e.type === "hit" && e.damage === 7).length).toBeGreaterThan(0);
  });

  it("never stacks two live units on one tile", () => {
    fc.assert(
      fc.property(armyArb(), armyArb(), seedArb, (a, b, seed) => {
        const result = simulate(a, b, seed);
        const pos = new Map(result.units.map((u) => [u.id, { col: u.col, row: u.row }]));
        const dead = new Set<string>();
        for (const e of result.events) {
          if (e.type === "move") pos.set(e.unit, { col: e.col, row: e.row });
          if (e.type === "death") dead.add(e.unit);
          const live = [...pos].filter(([id]) => !dead.has(id));
          const tiles = new Set(live.map(([, p]) => `${p.col},${p.row}`));
          expect(tiles.size).toBe(live.length);
        }
      }),
      { numRuns: 30 },
    );
  });

  // The invariants the milestone calls for.

  it("property: the same armies and seed give the same result", () => {
    fc.assert(
      fc.property(armyArb(), armyArb(), seedArb, (a, b, seed) => {
        const first = simulate(a, b, seed);
        const second = simulate(structuredClone(a), structuredClone(b), seed);
        expect(second).toEqual(first);
      }),
      { numRuns: 150 },
    );
    // 300 whole battles: 1.3s alone, past the 5s default when the area-map tests share the CPU.
  }, 20_000);

  it("property: a battle always ends by the timeout", () => {
    fc.assert(
      fc.property(armyArb(), armyArb(), seedArb, (a, b, seed) => {
        const result = simulate(a, b, seed);
        expect(result.ticks).toBeGreaterThan(0);
        expect(result.ticks).toBeLessThanOrEqual(MAX_TICKS);
        expect(result.events.every((e) => e.t < MAX_TICKS)).toBe(true);
        if (result.reason === "wipe") {
          expect(result.survivors.a === 0 || result.survivors.b === 0).toBe(true);
        } else {
          expect(result.ticks).toBe(MAX_TICKS);
        }
        expect(["a", "b", "draw"]).toContain(result.winner);
      }),
      { numRuns: 150 },
    );
  });
});
