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
  hashSeed,
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
  it("matches the PRD stat table", () => {
    expect(BALANCE.units.warrior).toMatchObject({ cost: 3, hp: 120, damage: 14, range: 1 });
    expect(BALANCE.units.lancer).toMatchObject({ cost: 3, hp: 140, damage: 10, range: 1 });
    expect(BALANCE.units.archer).toMatchObject({ cost: 3, hp: 60, damage: 10, range: 5 });
    expect(BALANCE.units.monk).toMatchObject({ cost: 4, hp: 70, damage: 0, range: 2, heal: 8 });
    expect(BALANCE.units.pawn).toMatchObject({ cost: 2, hp: 40, damage: 4, range: 1 });
  });

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

  it("stops as soon as it is in range rather than walking all the way in", () => {
    const steps = pathSteps({ col: 0, row: 1 }, { col: 5, row: 1 }, 5, at([]), 1);
    expect(steps).toEqual([]);
  });

  it("mirrors with the side, so a mirror match stays a reflection", () => {
    const mirror = (c: { col: number; row: number }) => ({
      col: BALANCE.board.battleCols - 1 - c.col,
      row: c.row,
    });
    const blocked: [number, number][] = [
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const a = pathSteps({ col: 0, row: 1 }, { col: 5, row: 1 }, 1, at(blocked), 1);
    const b = pathSteps(
      mirror({ col: 0, row: 1 }),
      mirror({ col: 5, row: 1 }),
      1,
      at(blocked.map(([c, r]) => [BALANCE.board.battleCols - 1 - c, r]) as [number, number][]),
      -1,
    );
    expect(b.map(mirror)).toEqual(a);
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

  it("gives the counter its edge: a Warrior beats an Archer in melee", () => {
    const result = simulate(warriorAt(4, 1), [{ class: "archer", col: 4, row: 1 }], 1);
    expect(result.winner).toBe("a");
    expect(result.survivors).toEqual({ a: 1, b: 0 });
    // 18 a hit thanks to the counter, so 4 hits for the Archer's 60 hp.
    expect(result.events.filter((e) => e.type === "hit" && e.unit === "a0")).toHaveLength(4);
    expect(result.hpRemaining.a).toBe(120 - 4 * 10);
  });

  it("lets a back-column Archer open fire before a melee unit closes", () => {
    // Archer on its own back column, Warrior on the enemy front: out of reach,
    // so the Archer gets shots off while the Warrior walks in.
    const result = simulate([{ class: "archer", col: 0, row: 1 }], warriorAt(4, 1), 1);
    const firstHit = result.events.find((e) => e.type === "hit");
    expect(firstHit?.unit).toBe("a0");
    expect(result.events.some((e) => e.type === "move" && e.unit === "b0")).toBe(true);
  });

  it("two front lines start adjacent, so neither side walks first", () => {
    const result = simulate(warriorAt(4, 1), warriorAt(4, 1), 1);
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

  it("breaks a distance tie toward the weakest target, not the lowest index", () => {
    const b: Army = [
      { class: "warrior", col: 4, row: 0 },
      { class: "pawn", col: 4, row: 2 },
    ];
    const result = simulate([{ class: "archer", col: 0, row: 1 }], b, 1);
    const firstHit = result.events.find((e) => e.type === "hit" && e.unit === "a0");
    expect(firstHit?.type === "hit" && firstHit.target).toBe("b1");
  });

  it("taunt: a Lancer within 2 tiles pulls a melee unit off the Archer beside it", () => {
    const a: Army = [
      { class: "archer", col: 4, row: 0 },
      { class: "lancer", col: 3, row: 2 },
    ];
    const result = simulate(a, warriorAt(4, 0), 1);
    const firstHit = result.events.find((e) => e.type === "hit" && e.unit === "b0");
    expect(firstHit?.type === "hit" && firstHit.target).toBe("a1");
  });

  it("pierce: every third arrow also hits the unit straight behind at half damage", () => {
    const b: Army = [
      { class: "monk", col: 4, row: 1 },
      { class: "monk", col: 3, row: 1 },
    ];
    const result = simulate([{ class: "archer", col: 0, row: 1 }], b, 1);
    const shots = result.events.filter((e) => e.type === "hit" && e.unit === "a0");
    expect(shots.slice(0, 4).map((e) => e.type === "hit" && e.target)).toEqual(["b0", "b0", "b0", "b1"]);
    expect(shots[3]!.type === "hit" && shots[3]!.damage).toBe(5);
  });

  it("revive: a Monk raises the first fallen ally once, at half HP", () => {
    const a: Army = [
      { class: "warrior", col: 4, row: 1 },
      { class: "monk", col: 0, row: 1 },
    ];
    const b: Army = [
      { class: "lancer", col: 4, row: 0 },
      { class: "lancer", col: 4, row: 1 },
      { class: "lancer", col: 4, row: 2 },
    ];
    const result = simulate(a, b, 1);
    const revives = result.events.filter((e) => e.type === "revive");
    expect(revives).toHaveLength(1);
    expect(revives[0]).toMatchObject({ unit: "a1", target: "a0", hpAfter: 60 });
    const deaths = result.events.filter((e) => e.type === "death" && e.unit === "a0");
    expect(deaths[0]!.t).toBeLessThan(revives[0]!.t);
  });

  it("keeps an Archer on its own back column out of the melee entirely", () => {
    // Range 5 is the gap from the back column to the enemy front line, so the
    // Archer fires from where it was placed and never takes a step.
    const result = simulate([{ class: "archer", col: 0, row: 1 }], warriorAt(4, 1), 1);
    expect(result.events.some((e) => e.type === "move" && e.unit === "a0")).toBe(false);
    expect(result.events.some((e) => e.type === "hit" && e.unit === "a0")).toBe(true);
  });

  it("walks a unit round its own line rather than away from the enemy", () => {
    // The Lancer is boxed in behind two Warriors and can only reach the enemy
    // by going through the one free lane, row 2. Greedy stepping used to take
    // whichever neighbour was least bad, which on a blocked board meant
    // backwards.
    const a: Army = [
      { class: "warrior", col: 4, row: 0 },
      { class: "warrior", col: 4, row: 1 },
      { class: "lancer", col: 3, row: 1 },
    ];
    const b: Army = [{ class: "warrior", col: 4, row: 0 }];
    const result = simulate(a, b, 1);
    const path = result.events.filter((e) => e.type === "move" && e.unit === "a2");
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((e) => e.type === "move" && e.row === 2)).toBe(true);
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
