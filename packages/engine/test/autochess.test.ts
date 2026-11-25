import { describe, expect, it } from "vitest";

import { AUTO, BALANCE, CHAMPIONS, act, copies, fightRound, newRun, redactRun, simulate, type Placement, type Run } from "../src/index.ts";

/** Copies in shops are not reserved, so the pool plus every owned copy is the whole pool. */
function poolIntact(run: Run): boolean {
  return CHAMPIONS.every((c) => {
    const held = run.seats
      .flatMap((s) => [...s.board, ...s.bench])
      .filter((p) => p?.class === c)
      .reduce((n, p) => n + copies(p!.stars), 0);
    return run.pool[c] + held === AUTO.pool[c];
  });
}

function playOut(seed: number): Run {
  let run = newRun(seed, 0);
  while (!run.over && run.round < 60) run = fightRound(run).run;
  return run;
}

describe("auto chess run", () => {
  // Two whole runs: 0.8s alone, 4s in the full suite's contention, so the 5s default timed out now and then.
  it("is the same run for the same seed", () => {
    expect(playOut(5)).toEqual(playOut(5));
  }, 20_000);

  it("ends with every clan placed once and the pool intact", () => {
    for (const seed of [1, 2, 3]) {
      const run = playOut(seed);
      expect(run.over).toBe(true);
      expect(run.seats.map((s) => s.place).sort()).toEqual([1, 2, 3, 4]);
      expect(poolIntact(run)).toBe(true);
    }
  });

  it("merges three copies into a 2-star, even off a full bench", () => {
    let run = newRun(1);
    const seat = run.seats[0]!;
    seat.gold = 100;
    seat.bench = seat.bench.map((_, i) => (i < 6 ? { id: 900 + i, class: "monk", stars: 1 } : null));
    seat.bench[6] = { id: 950, class: "lancer", stars: 1 };
    seat.bench[7] = { id: 951, class: "lancer", stars: 1 };
    run.pool.lancer -= 2;
    run.pool.monk -= 6;
    seat.shop = ["lancer", null, null, null, null];
    run = act(run, 0, { type: "buy", slot: 0 }).run;
    const lancers = run.seats[0]!.bench.filter((p) => p?.class === "lancer");
    expect(lancers).toEqual([{ id: 950, class: "lancer", stars: 2 }]);
    expect(run.seats[0]!.gold).toBe(100 - AUTO.tier.lancer);
    expect(poolIntact(run)).toBe(true);
  });

  it("refuses a buy with a full bench and nothing to merge", () => {
    const run = newRun(1);
    const seat = run.seats[0]!;
    seat.gold = 100;
    seat.bench = seat.bench.map((_, i) => ({ id: 900 + i, class: "monk", stars: 2 }));
    seat.shop = ["pawn", null, null, null, null];
    expect(act(run, 0, { type: "buy", slot: 0 }).error).toBe("The bench is full.");
  });

  it("caps the board at the seat's level and swaps on an occupied cell", () => {
    let run = newRun(1);
    const seat = run.seats[0]!;
    seat.bench = seat.bench.map((_, i) => (i < 3 ? { id: 900 + i, class: "pawn", stars: 1 } : null));
    run = act(run, 0, { type: "move", piece: 900, to: { col: 4, row: 0 } }).run;
    run = act(run, 0, { type: "move", piece: 901, to: { col: 4, row: 1 } }).run;
    expect(run.seats[0]!.board).toHaveLength(AUTO.startLevel);
    expect(act(run, 0, { type: "move", piece: 902, to: { col: 4, row: 2 } }).error).toMatch(/fit on the board/);
    run = act(run, 0, { type: "move", piece: 902, to: { col: 4, row: 0 } }).run;
    expect(run.seats[0]!.board.map((p) => p.id).sort()).toEqual([901, 902]);
    expect(run.seats[0]!.bench).toContainEqual({ id: 900, class: "pawn", stars: 1 });
  });

  it("never changes the run it is given", () => {
    const run = newRun(1);
    const before = structuredClone(run);
    act(run, 0, { type: "reroll" });
    fightRound(run);
    expect(run).toEqual(before);
  });

  it("redacts the seed and every other seat's shop, leaving the input alone", () => {
    const run = newRun(9, 2);
    const before = structuredClone(run);
    const seen = redactRun(run, 1);
    expect(seen.seed).toBe("");
    expect(seen.seats[1]!.shop).toEqual(run.seats[1]!.shop);
    expect(seen.seats[1]!.shop.length).toBe(AUTO.shopSlots);
    for (const i of [0, 2, 3]) expect(seen.seats[i]!.shop).toEqual([]);
    expect(run).toEqual(before);
  });
});

describe("stars and traits", () => {

  it("switches a trait on at its threshold of different members, and only when asked", () => {
    const pawn = { class: "pawn" as const, col: 4, row: 0 };
    const mixed = [pawn, { class: "thief" as const, col: 4, row: 1 }];
    const twins = [pawn, { ...pawn, row: 1 }];
    const foe = [{ class: "lancer" as const, col: 0, row: 0 }];
    const hp = (traits: boolean, army: Placement[]) => simulate(army, foe, 1, { budget: Infinity, traits }).units[0]!.maxHp;
    const base = BALANCE.units.pawn.hp;
    expect(hp(false, mixed)).toBe(base);
    expect(hp(true, mixed)).toBe(Math.round(base * AUTO.traits.brute.values[0]!));
    // A second copy of the same unit is not a second kind.
    expect(hp(true, twins)).toBe(base);
  });
});
