import { describe, expect, it } from "vitest";

import { AUTO, BALANCE, CHAMPIONS, TICKS_PER_ACTION, act, copies, fightRound, newRun, simulate, traitCounts, type Placement, type Run } from "../src/index.ts";

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
  it("is the same run for the same seed", () => {
    expect(playOut(5)).toEqual(playOut(5));
  });

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

  it("plays on its own 6x4 half, wider and deeper than Duel's", () => {
    let run = newRun(1);
    run.seats[0]!.bench[0] = { id: 900, class: "pawn", stars: 1 };
    run = act(run, 0, { type: "move", piece: 900, to: { col: 5, row: 3 } }).run;
    expect(run.seats[0]!.board).toContainEqual({ id: 900, class: "pawn", stars: 1, col: 5, row: 3 });
    expect(act(run, 0, { type: "move", piece: 900, to: { col: 6, row: 0 } }).error).not.toBeNull();
    const r = simulate([{ class: "pawn", col: 0, row: 3 }], [{ class: "pawn", col: 0, row: 3 }], 1, { board: AUTO.board });
    expect(r.units.map((u) => u.col)).toEqual([0, 2 * AUTO.board.cols - 1]);
  });

  it("never changes the run it is given", () => {
    const run = newRun(1);
    const before = structuredClone(run);
    act(run, 0, { type: "reroll" });
    fightRound(run);
    expect(run).toEqual(before);
  });
});

describe("stars and traits", () => {
  it("gives a 2-star 1.8x the health, enough to beat its 1-star self", () => {
    const r = simulate([{ class: "warrior", col: 4, row: 1, stars: 2 }], [{ class: "warrior", col: 4, row: 1 }], 1, {
      budget: Infinity,
    });
    expect(r.units[0]!.maxHp).toBe(Math.round(120 * AUTO.starPower[2]!));
    expect(r.winner).toBe("a");
  });

  it("switches a trait on only at its threshold, and only when asked", () => {
    const two = [
      { class: "lancer" as const, col: 4, row: 0 },
      { class: "lancer" as const, col: 4, row: 1 },
    ];
    const foe = [{ class: "pawn" as const, col: 0, row: 0 }];
    const hp = (traits: boolean, army = two) => simulate(army, foe, 1, { budget: Infinity, traits }).units[0]!.maxHp;
    expect(hp(false)).toBe(140);
    expect(hp(true)).toBe(Math.round(140 * AUTO.traits.lancer.values[0]!));
    expect(hp(true, two.slice(0, 1))).toBe(140);
  });
});

describe("monsters", () => {
  const opts = { budget: Infinity, traits: true };
  const at = (cls: Placement["class"], col: number, row: number): Placement => ({ class: cls, col, row });
  const abilities = (r: ReturnType<typeof simulate>, name: string) =>
    r.events.filter((e) => e.type === "ability" && e.ability === name);

  it("counts the Horde by kinds of monster, not by units", () => {
    expect(traitCounts([at("skull", 0, 0), at("skull", 1, 0), at("gnoll", 2, 0)]).horde).toBe(2);
    expect(traitCounts([at("skull", 0, 0), at("lancer", 1, 0)]).horde).toBe(1);
  });

  it("raises a Skull once, at the reassemble share of its health", () => {
    const r = simulate([at("skull", 4, 1)], [at("minotaur", 4, 1)], 1, opts);
    const [up] = abilities(r, "reassemble");
    expect(abilities(r, "reassemble")).toHaveLength(1);
    expect(up && "hpAfter" in up ? up.hpAfter : 0).toBe(Math.round(BALANCE.units.skull.hp * BALANCE.abilities.reassemble.hp));
  });

  it("sends a Thief beside the enemy furthest back on its first action", () => {
    const r = simulate([at("thief", 4, 1)], [at("lancer", 4, 1), at("archer", 0, 2)], 1, opts);
    const leap = r.events.find((e) => e.type === "move" && e.unit === "a0")!;
    expect(leap.t).toBeLessThan(TICKS_PER_ACTION);
    expect(leap.type === "move" && Math.max(Math.abs(leap.col - 9), Math.abs(leap.row - 2))).toBe(1);
  });

  it("lets a Troll regain health and a Minotaur cleave everyone beside it", () => {
    const m = simulate([at("minotaur", 4, 1)], [at("warrior", 4, 0), at("warrior", 4, 1), at("warrior", 4, 2)], 1, opts);
    expect(abilities(m, "cleave").length).toBeGreaterThan(0);
    const hurt = new Set(m.events.flatMap((e) => (e.type === "hit" && e.unit === "a0" ? [e.target] : [])));
    expect(hurt).toEqual(new Set(["b0", "b1", "b2"]));
    const t = simulate([at("troll", 4, 1)], [at("warrior", 4, 1), at("warrior", 4, 0)], 2, opts);
    expect(t.events.some((e) => e.type === "heal" && e.unit === "a0" && e.target === "a0")).toBe(true);
  });

  it("recasts a skill each time its countdown runs out, and only then", () => {
    const r = simulate([{ class: "lancer", col: 4, row: 1, stars: 3 }], [at("troll", 4, 1)], 1, { ...opts, skills: true });
    for (const [name, cls] of [["taunt", "lancer"], ["regenerate", "troll"]] as const) {
      const casts = abilities(r, name).map((e) => e.t);
      expect(casts.length).toBeGreaterThan(1);
      for (let k = 1; k < casts.length; k++)
        expect(casts[k]! - casts[k - 1]!).toBeGreaterThanOrEqual(AUTO.skills[cls].cooldown * BALANCE.tickRate);
    }
  });

  it("keeps Duel's knights to one taunt a battle without skills", () => {
    const r = simulate([{ class: "lancer", col: 4, row: 1, stars: 3 }], [at("troll", 4, 1)], 1, opts);
    expect(abilities(r, "taunt").map((e) => e.t)).toEqual([0]);
  });

  it("delays a hexed unit's next action", () => {
    const r = simulate([at("shaman", 2, 1)], [at("troll", 4, 1)], 3, opts);
    const hex = abilities(r, "hex")[0]!;
    const next = r.events.find((e) => e.type === "attack" && e.unit === "b0" && e.t > hex.t)
      ?? r.events.find((e) => e.type === "move" && e.unit === "b0" && e.t > hex.t);
    expect(next!.t - hex.t).toBeGreaterThanOrEqual(BALANCE.abilities.hex.seconds * BALANCE.tickRate);
  });
});
