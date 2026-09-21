import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  BALANCE,
  MAX_TICKS,
  armyCost,
  battleCol,
  chebyshev,
  damageAgainst,
  generateArmy,
  hashSeed,
  makeRng,
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
  it("matches the PRD stat table", () => {
    expect(BALANCE.units.warrior).toMatchObject({ cost: 3, hp: 100, damage: 14, range: 1 });
    expect(BALANCE.units.lancer).toMatchObject({ cost: 3, hp: 140, damage: 8, range: 1 });
    expect(BALANCE.units.archer).toMatchObject({ cost: 3, hp: 60, damage: 10, range: 3 });
    expect(BALANCE.units.monk).toMatchObject({ cost: 4, hp: 70, damage: 0, range: 2, heal: 12 });
    expect(BALANCE.units.pawn).toMatchObject({ cost: 2, hp: 40, damage: 4, range: 1 });
  });

  it("applies the counter bonus only to the class it counters", () => {
    // Lancer beats Warrior, Warrior beats Archer, Archer beats Lancer.
    expect(damageAgainst("lancer", "warrior")).toBe(10); // 8 * 1.25
    expect(damageAgainst("warrior", "archer")).toBe(18); // 14 * 1.25, rounded
    expect(damageAgainst("archer", "lancer")).toBe(13); // 10 * 1.25, rounded
    expect(damageAgainst("lancer", "archer")).toBe(8);
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

  it("hashes string seeds to a 32-bit unsigned int", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const h = hashSeed(s);
        expect(Number.isInteger(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(2 ** 32);
      }),
    );
  });
});

describe("geometry", () => {
  it("mirrors side B onto the shared 8x3 grid", () => {
    expect(battleCol("a", 0)).toBe(0);
    expect(battleCol("a", 3)).toBe(3);
    expect(battleCol("b", 3)).toBe(4); // both front lines meet in the middle
    expect(battleCol("b", 0)).toBe(7);
  });

  it("measures distance with Chebyshev, so diagonals cost one step", () => {
    expect(chebyshev({ col: 3, row: 0 }, { col: 4, row: 1 })).toBe(1);
    expect(chebyshev({ col: 3, row: 1 }, { col: 6, row: 0 })).toBe(3); // archer reach
    expect(chebyshev({ col: 3, row: 1 }, { col: 7, row: 1 })).toBe(4); // out of reach
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

  it("rejects tiles off the 4x3 board", () => {
    expect(validateArmy([{ class: "warrior", col: 4, row: 0 }]).join()).toMatch(/col 4/);
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

  it("spends down to less than the cheapest unit it can buy", () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 3, max: 36 }), (seed, budget) => {
        const army = generateArmy(budget, seed);
        const cheapest = Math.min(
          ...Object.keys(BALANCE.aiPickWeights).map((c) => BALANCE.units[c as UnitClass].cost),
        );
        // Either the gold is spent down or the board is full.
        const leftover = budget - armyCost(army);
        expect(leftover < cheapest || army.length === BALANCE.board.maxUnits).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("never buys Pawns and keeps melee ahead of ranged", () => {
    for (let seed = 0; seed < 50; seed++) {
      const army = generateArmy(20, seed);
      expect(army.some((u) => u.class === "pawn")).toBe(false);

      const frontOfRanged = Math.max(
        0,
        ...army.filter((u) => BALANCE.units[u.class].range > 1).map((u) => u.col),
      );
      const backOfMelee = Math.min(
        BALANCE.board.cols,
        ...army.filter((u) => BALANCE.units[u.class].range <= 1).map((u) => u.col),
      );
      expect(backOfMelee).toBeGreaterThanOrEqual(frontOfRanged);
    }
  });
});

describe("simulate", () => {
  const warriorAt = (col: number, row: number): Army => [{ class: "warrior", col, row }];

  it("trades evenly in a mirror match: nobody gets a free first strike", () => {
    const result = simulate(warriorAt(3, 1), warriorAt(3, 1), 1);
    expect(result.winner).toBe("draw");
    expect(result.reason).toBe("wipe");
    expect(result.hpRemaining).toEqual({ a: 0, b: 0 });
    // 100 hp at 14 damage a second: both fall on the 8th exchange, which
    // lands at t = 70, so the battle ends on tick 71.
    expect(result.events.filter((e) => e.type === "hit" && e.unit === "a0")).toHaveLength(8);
    expect(result.ticks).toBe(7 * BALANCE.tickRate + 1);
  });

  it("gives the counter its edge: a Warrior beats an Archer in melee", () => {
    const result = simulate(warriorAt(3, 1), [{ class: "archer", col: 3, row: 1 }], 1);
    expect(result.winner).toBe("a");
    expect(result.survivors).toEqual({ a: 1, b: 0 });
    // 18 a hit thanks to the counter, so 4 hits for the Archer's 60 hp.
    expect(result.events.filter((e) => e.type === "hit" && e.unit === "a0")).toHaveLength(4);
    expect(result.hpRemaining.a).toBe(100 - 4 * 10);
  });

  it("lets a back-line Archer open fire before a melee unit closes", () => {
    // Archer on its back column, Warrior on its front: 7 tiles apart, so the
    // Archer gets shots off while the Warrior walks in.
    const result = simulate([{ class: "archer", col: 0, row: 1 }], warriorAt(3, 1), 1);
    const firstHit = result.events.find((e) => e.type === "hit");
    expect(firstHit?.unit).toBe("a0");
    expect(result.events.some((e) => e.type === "move" && e.unit === "b0")).toBe(true);
  });

  it("two front lines start adjacent, so neither side walks first", () => {
    const result = simulate(warriorAt(3, 1), warriorAt(3, 1), 1);
    expect(result.events.some((e) => e.type === "move")).toBe(false);
  });

  it("emits the event types the client needs for playback", () => {
    const a: Army = [
      { class: "lancer", col: 3, row: 1 },
      { class: "monk", col: 0, row: 1 },
    ];
    const result = simulate(a, generateArmy(20, 5), 3);
    const kinds = new Set(result.events.map((e) => e.type));
    for (const kind of ["move", "attack", "hit", "death"]) expect(kinds).toContain(kind);
  });

  it("stalemate between two healers times out as a draw", () => {
    const monks: Army = [{ class: "monk", col: 0, row: 1 }];
    const result = simulate(monks, monks, 1);
    expect(result.reason).toBe("timeout");
    expect(result.ticks).toBe(MAX_TICKS);
    expect(result.winner).toBe("draw");
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

  // The three invariants the milestone calls for.

  it("property: the same armies and seed give the same result", () => {
    fc.assert(
      fc.property(armyArb(), armyArb(), seedArb, (a, b, seed) => {
        const first = simulate(a, b, seed);
        const second = simulate(structuredClone(a), structuredClone(b), seed);
        expect(second).toEqual(first);
      }),
      { numRuns: 150 },
    );
  });

  it("property: HP never exceeds a unit's maximum and never goes negative", () => {
    fc.assert(
      fc.property(armyArb(), armyArb(), seedArb, (a, b, seed) => {
        const result = simulate(a, b, seed);
        const maxHp = new Map(result.units.map((u) => [u.id, u.maxHp]));
        for (const e of result.events) {
          if (e.type !== "hit" && e.type !== "heal") continue;
          expect(e.hpAfter).toBeGreaterThanOrEqual(0);
          expect(e.hpAfter).toBeLessThanOrEqual(maxHp.get(e.target)!);
          if (e.type === "heal") expect(e.amount).toBeGreaterThan(0);
          if (e.type === "hit") expect(e.damage).toBeGreaterThanOrEqual(0);
        }
        for (const side of ["a", "b"] as const) {
          const cap = result.units
            .filter((u) => u.side === side)
            .reduce((sum, u) => sum + u.maxHp, 0);
          expect(result.hpRemaining[side]).toBeGreaterThanOrEqual(0);
          expect(result.hpRemaining[side]).toBeLessThanOrEqual(cap);
        }
      }),
      { numRuns: 150 },
    );
  });

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

  it("property: a mirror match is always a draw", () => {
    fc.assert(
      fc.property(armyArb(), seedArb, (army, seed) => {
        const result = simulate(army, structuredClone(army), seed);
        expect(result.hpRemaining.a).toBe(result.hpRemaining.b);
        expect(result.winner).toBe("draw");
      }),
      { numRuns: 100 },
    );
  });
});
