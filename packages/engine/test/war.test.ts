import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  MAP,
  MINES,
  PLOTS,
  STRAT_COLS,
  STRAT_ROWS,
  WAR,
  at,
  applyAction,
  battle,
  buildSlots,
  canStep,
  castlePlot,
  findPath,
  incomeFor,
  isHome,
  isOpen,
  isWalkable,
  maxHp,
  mineSlots,
  newMatch,
  planAi,
  plotCells,
  plotDistance,
  plotById,
  supplyCap,
  supplyUsed,
  upkeepOf,
  type Action,
  type MatchState,
  type WarSide,
} from "../src/index.ts";

const blocked = (c: { col: number; row: number }) => !isOpen(c);

function act(state: MatchState, side: WarSide, action: Action): MatchState {
  const r = applyAction(state, side, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A bare island: both castles and barracks, nobody on it. */
function empty(round = 1): MatchState {
  const s = newMatch("empty");
  return { ...s, round, units: [] };
}

describe("island", () => {
  it("has rows of one width", () => {
    expect(new Set(MAP.map((r) => r.length)).size).toBe(1);
  });

  it("puts every plot on its own home plateau, with no two overlapping", () => {
    const seen = new Set<string>();
    for (const p of PLOTS) {
      for (const c of plotCells(p)) {
        expect(isHome(p.side, c), `${p.id} ${c.col},${c.row}`).toBe(true);
        expect(seen.has(`${c.col},${c.row}`), `${p.id} overlaps`).toBe(false);
        seen.add(`${c.col},${c.row}`);
      }
    }
  });

  it("joins the two bases, and every plot to the enemy's", () => {
    for (const p of PLOTS) {
      const beside = [
        { col: p.col - 1, row: p.row },
        { col: p.col + p.w, row: p.row },
        { col: p.col, row: p.row + p.h },
        { col: p.col, row: p.row - 1 },
      ].find(isOpen);
      expect(beside, `${p.id} has no open side`).toBeDefined();
      const enemy = castlePlot(p.side === "a" ? "b" : "a");
      expect(findPath(beside!, { col: enemy.col - 1, row: enemy.row + 1 }, blocked), p.id).not.toBeNull();
    }
  });

  it("is the same island for both sides, mirrored left to right", () => {
    const flip: Record<string, string> = { "<": ">", ">": "<", "[": "]", "]": "[" };
    for (const line of MAP) expect([...line].reverse().map((ch) => flip[ch] ?? ch).join("")).toBe(line);
    for (const p of PLOTS.filter((x) => x.side === "a")) {
      const twin = plotById(p.id.replace(/^a/, "b"))!;
      expect([twin.col, twin.row], p.id).toEqual([STRAT_COLS - 1 - p.col - (p.w - 1), p.row]);
    }
  });

  it("reaches every open tile from the castle", () => {
    const front = { col: castlePlot("a").col + 1, row: castlePlot("a").row + 2 };
    for (let row = 0; row < STRAT_ROWS; row++) {
      for (let col = 0; col < STRAT_COLS; col++) {
        const c = { col, row };
        if (isOpen(c)) expect(findPath(front, c, blocked), `${col},${row}`).not.toBeNull();
      }
    }
  });

  it("joins the bases by exactly two roads", () => {
    const front = (side: WarSide) => ({ col: castlePlot(side).col + 1, row: castlePlot(side).row + 2 });
    const without = (cells: [number, number][]) => (c: { col: number; row: number }) =>
      blocked(c) || cells.some(([col, row]) => c.col === col && c.row === row);
    const pass: [number, number][] = [[15, 8]];
    const ford: [number, number][] = [[20, 17], [20, 18], [20, 19]];
    const viaFord = findPath(front("a"), front("b"), without(pass));
    const viaPass = findPath(front("a"), front("b"), without(ford));
    // The Low Road dips under the watch cliff; evening it out is balance work.
    expect(viaPass).toHaveLength(34);
    expect(viaFord).toHaveLength(38);
    expect(findPath(front("a"), front("b"), without([...pass, ...ford]))).toBeNull();
  });

  it("puts the ford mine as far from one castle as the other", () => {
    const mid = MINES.find((m) => m.id === "mine-mid")!;
    const slot = { col: mid.col, row: mid.row - 1 };
    expect(mineSlots(mid)).toContainEqual(slot);
    const a = findPath({ col: 5, row: 7 }, slot, blocked)!.length;
    const b = findPath({ col: 35, row: 7 }, slot, blocked)!.length;
    expect(a).toBe(b);
  });

  it("puts each home mine on its home plateau", () => {
    expect(isHome("a", MINES.find((m) => m.id === "mine-a")!)).toBe(true);
    expect(isHome("b", MINES.find((m) => m.id === "mine-b")!)).toBe(true);
  });

  it("gives every mine room for its Pawns", () => {
    for (const m of MINES) expect(mineSlots(m).length).toBeGreaterThanOrEqual(WAR.pawnsPerMine);
  });

  it("gives every plot build slots on its own plateau, none down the cliff", () => {
    for (const p of PLOTS) {
      expect(buildSlots(p).length, p.id).toBeGreaterThan(0);
      for (const c of buildSlots(p)) expect(isHome(p.side, c), `${p.id} ${c.col},${c.row}`).toBe(true);
    }
  });

  it("only changes level along a ramp or the Crown's stairs, one level at a time", () => {
    expect(canStep({ col: 10, row: 10 }, { col: 10, row: 11 })).toBe(true);
    expect(canStep({ col: 9, row: 9 }, { col: 10, row: 9 })).toBe(false);
    expect(canStep({ col: 17, row: 6 }, { col: 17, row: 5 })).toBe(true);
    expect(canStep({ col: 18, row: 5 }, { col: 18, row: 6 })).toBe(false);
    expect(canStep({ col: 17, row: 5 }, { col: 16, row: 5 })).toBe(false);
    expect(isWalkable(20, 6)).toBe(false);
  });

  it("keeps everyone out of the forest", () => {
    expect(at(2, 12)).toBe("T");
    expect(isWalkable(2, 12)).toBe(false);
  });
});

describe("planning", () => {
  it("opens with a castle, a barracks, three Pawns and 26 gold", () => {
    const s = newMatch(1);
    for (const side of ["a", "b"] as const) {
      expect(s.gold[side]).toBe(WAR.startGold + upkeepOf(s, side).income + WAR.pawns.start * WAR.pawnIncome);
      expect(s.gold[side]).toBe(26);
      expect(supplyUsed(s, side)).toBe(WAR.pawns.start);
      expect(supplyCap(s, side)).toBe(WAR.supply.start);
      expect(s.buildings[`${side}-castle`]!.level).toBe(1);
      expect(s.buildings[`${side}-barracks`]!.level).toBe(1);
      expect(s.buildings[`${side}-archery`]!.level).toBe(0);
    }
  });

  it("trains at a cost, beside the building", () => {
    let s = newMatch(1);
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    expect(s.gold.a).toBe(26 - 3 * WAR.unitCost.warrior);
    expect(s.units.filter((u) => u.class === "warrior")).toHaveLength(3);
  });

  it("trains Pawns at the castle up to the limit, each sent to the next mine with room", () => {
    let s = { ...newMatch(1), gold: { a: 100, b: 100 } };
    for (let i = WAR.pawns.start; i < WAR.pawns.max; i++) s = act(s, "a", { type: "train", plot: "a-castle" });
    const pawns = s.units.filter((u) => u.side === "a" && u.class === "pawn");
    expect(pawns).toHaveLength(WAR.pawns.max);
    expect(s.gold.a).toBe(100 - (WAR.pawns.max - WAR.pawns.start) * WAR.unitCost.pawn);
    const digging = (id: string) => pawns.filter((u) => u.order.type === "gather" && u.order.mine === id).length;
    expect([digging("mine-a"), digging("mine-ya")]).toEqual([3, 3]);
    expect(applyAction(s, "a", { type: "train", plot: "a-castle" }).ok).toBe(false);
  });

  it("stops training at the supply cap", () => {
    let s = newMatch(1);
    s = { ...s, gold: { a: 100, b: 100 } };
    for (let i = 0; i < WAR.supply.start - WAR.pawns.start; i++) s = act(s, "a", { type: "train", plot: "a-barracks" });
    expect(supplyUsed(s, "a")).toBe(WAR.supply.start);
    expect(applyAction(s, "a", { type: "train", plot: "a-barracks" })).toMatchObject({ ok: false });
  });

  it("refuses the other side's buildings and units", () => {
    const s = newMatch(1);
    expect(applyAction(s, "a", { type: "train", plot: "b-barracks" }).ok).toBe(false);
    const theirs = s.units.find((u) => u.side === "b")!;
    expect(applyAction(s, "a", { type: "stance", units: [theirs.id], stance: "firm" }).ok).toBe(false);
  });

  it("never gives two sides' new units the same id", () => {
    const s = newMatch(1);
    const a = act(s, "a", { type: "train", plot: "a-barracks" });
    const b = act(s, "b", { type: "train", plot: "b-barracks" });
    const newA = a.units.at(-1)!.id;
    const newB = b.units.at(-1)!.id;
    expect(newA).not.toBe(newB);
  });

  it("spreads a group order over separate tiles", () => {
    let s = newMatch(1);
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    const ids = s.units.filter((u) => u.class === "warrior").map((u) => u.id);
    s = act(s, "a", { type: "order", units: ids, order: { type: "attackMove", to: { col: 20, row: 7 } } });
    const tiles = s.units
      .filter((u) => ids.includes(u.id))
      .map((u) => (u.order.type === "attackMove" ? `${u.order.to.col},${u.order.to.row}` : ""));
    expect(new Set(tiles).size).toBe(2);
  });

  it("does not change the state it was given", () => {
    const s = newMatch(1);
    const before = structuredClone(s);
    applyAction(s, "a", { type: "train", plot: "a-barracks" });
    expect(s).toEqual(before);
  });
});

describe("battle", () => {
  it("settles a quiet round at once and pays the next round's income", () => {
    const s = newMatch(1);
    const out = battle(s, [], []);
    expect(out.report.settled).toBe(true);
    expect(out.report.seconds).toBeLessThanOrEqual(WAR.settleSeconds + 0.5);
    expect(out.end.round).toBe(2);
    expect(out.end.gold.a).toBe(s.gold.a + upkeepOf(s, "a").income + WAR.pawns.start * WAR.pawnIncome);
    expect(out.end.mines["mine-a"]).toBe(WAR.mineGold["mine-a"]! - 2 * WAR.pawns.start * WAR.pawnIncome);
  });

  it("finishes buildings at the end of the round", () => {
    const s = act(newMatch(1), "a", { type: "build", plot: "a-house1" });
    const out = battle(s, [], []);
    expect(out.end.buildings["a-house1"]!.level).toBe(1);
    expect(supplyCap(out.end, "a")).toBe(WAR.supply.start + WAR.supply.perHouse);
  });

  it("is the same battle for the same state and plans", () => {
    const s = newMatch("same");
    const pa = planAi(s, "a");
    const pb = planAi(s, "b");
    expect(battle(s, pa, pb)).toEqual(battle(s, pa, pb));
  });

  it("leaves the state it was given alone", () => {
    const s = newMatch(2);
    const before = structuredClone(s);
    battle(s, planAi(s, "a"), planAi(s, "b"));
    expect(s).toEqual(before);
  });

  it("stops a mine's income while an enemy fighter stands near it", () => {
    const s = newMatch(1);
    const raider = { ...s.units[0]!, id: 99, side: "b" as const, class: "warrior" as const, hp: 120 };
    raider.col = 4;
    raider.row = 9;
    const raided = { ...s, units: [...s.units, raider] };
    expect(incomeFor(s, "a").mines).toBe(WAR.pawns.start * WAR.pawnIncome);
    expect(incomeFor(raided, "a").mines).toBe(0);
  });

  it("sends a Pawn to build, off its mine, and at most one building per Pawn", () => {
    let s = { ...newMatch(1), gold: { a: 100, b: 100 } };
    s = act(s, "a", { type: "build", plot: "a-house1" });
    s = act(s, "a", { type: "build", plot: "a-house2" });
    s = act(s, "a", { type: "build", plot: "a-house3" });
    const builders = s.units.filter((u) => u.side === "a" && u.order.type === "build");
    expect(builders).toHaveLength(WAR.pawns.start);
    expect(applyAction(s, "a", { type: "build", plot: "a-archery" }).ok).toBe(false);
    expect(applyAction(s, "a", { type: "order", units: [builders[0]!.id], order: { type: "gather", mine: "mine-a" } }).ok).toBe(false);
    const out = battle(s, [], []);
    for (const id of ["a-house1", "a-house2", "a-house3"]) expect(out.end.buildings[id]!.level).toBe(1);
    // Nobody dug this round, and every builder goes back to its mine.
    expect(out.end.income.a.mines).toBe(0);
    const pawns = out.end.units.filter((u) => u.side === "a" && u.class === "pawn");
    expect(pawns.every((u) => u.order.type === "gather")).toBe(true);
  });

  it("marches past enemy buildings rather than stopping to hit them", () => {
    const s = empty();
    const barracks = plotById("b-barracks")!;
    const near = MAP.flatMap((line, row) => [...line].map((_, col) => ({ col, row }))).filter(isOpen);
    const start = near.find((c) => plotDistance(barracks, c) === 1)!;
    const dest = near.find((c) => plotDistance(castlePlot("a"), c) === 2)!;
    const knight = { id: 1, side: "a" as const, class: "warrior" as const, hp: 120, ...start, order: { type: "attackMove" as const, to: dest }, stance: "firm" as const, post: start };
    const out = battle({ ...s, units: [knight] }, [], []);
    expect(out.events.some((e) => e.type === "hitBuilding")).toBe(false);
    expect(out.events.some((e) => e.type === "move")).toBe(true);
  });

  it("walks the builder to its plot during the battle", () => {
    const s = act(newMatch(1), "a", { type: "build", plot: "a-archery" });
    const builder = s.units.find((u) => u.order.type === "build")!;
    const out = battle(s, [], []);
    const moved = out.events.filter((e) => e.type === "move" && e.unit === builder.id);
    expect(moved.length).toBeGreaterThan(0);
    const last = moved.at(-1) as { col: number; row: number };
    const plot = plotById("a-archery")!;
    // In front of the plot, not on a neighbour's roof.
    expect(plotDistance(plot, last)).toBe(1);
    expect(last.row).toBe(plot.row + plot.h);
  });

  it("builds from the plot's own plateau, not from the ground below its cliff", () => {
    for (const id of ["a-house1", "a-house2", "a-house3"]) {
      const s = act(newMatch(1), "a", { type: "build", plot: id });
      const builder = s.units.find((u) => u.order.type === "build")!;
      const out = battle(s, [], []);
      const last = out.end.units.find((u) => u.id === builder.id)!;
      expect(isHome("a", last), `${id} built from ${last.col},${last.row}`).toBe(true);
    }
  });

  it("never lets a Pawn strike, even beside an enemy, nor take an attack order", () => {
    const s = empty();
    const at = (col: number, row: number) => ({ col, row });
    const pawn = { id: 1, side: "a" as const, class: "pawn" as const, hp: 40, ...at(20, 5), order: { type: "stop" as const }, stance: "firm" as const, post: at(20, 5) };
    const foe = { id: 2, side: "b" as const, class: "warrior" as const, hp: 120, ...at(21, 5), order: { type: "stop" as const }, stance: "firm" as const, post: at(21, 5) };
    const out = battle({ ...s, units: [pawn, foe] }, [], []);
    expect(out.events.some((e) => e.type === "attack" && e.unit === 1)).toBe(false);
    expect(out.events.some((e) => e.type === "attack" && e.unit === 2)).toBe(true);
    const r = applyAction({ ...s, units: [pawn, foe] }, "a", { type: "order", units: [1], order: { type: "attack", unit: 2 } });
    expect(r.ok).toBe(false);
  });

  it("sends a wounded Fall back unit home, where it heals", () => {
    const s = empty();
    const hurt = {
      id: 1,
      side: "a" as const,
      class: "warrior" as const,
      hp: 30,
      col: 20,
      row: 5,
      order: { type: "stop" as const },
      stance: "fallBack" as const,
      post: { col: 20, row: 5 },
    };
    const out = battle({ ...s, units: [hurt] }, [], []);
    expect(out.events.some((e) => e.type === "fallBack")).toBe(true);
    const after = out.end.units[0]!;
    expect(isHome("a", after)).toBe(true);
    expect(after.hp).toBe(maxHp(out.end, "a", "warrior"));
  });

  it("leaves dead Pawns dead, unless a side has none left", () => {
    const s = newMatch(1);
    const one = s.units.find((u) => u.side === "a" && u.class === "pawn")!;
    const out = battle({ ...s, units: s.units.filter((u) => u !== one) }, [], []);
    expect(out.end.units.filter((u) => u.side === "a" && u.class === "pawn")).toHaveLength(WAR.pawns.start - 1);

    const none = battle({ ...s, units: s.units.filter((u) => !(u.side === "a" && u.class === "pawn")) }, [], []);
    const back = none.end.units.filter((u) => u.side === "a" && u.class === "pawn");
    expect(back).toHaveLength(1);
    expect(back[0]!.order).toEqual({ type: "gather", mine: "mine-a" });
    expect(isHome("a", back[0]!)).toBe(true);
  });

  it("lowers base income as the army grows", () => {
    const s = empty();
    const army = (n: number): MatchState => ({
      ...s,
      units: Array.from({ length: n }, (_, i) => ({ ...newMatch(1).units[0]!, id: 2 * i + 1, class: "warrior" as const })),
    });
    expect([0, 6, 7, 10, 11].map((n) => upkeepOf(army(n), "a").income)).toEqual([10, 10, 7, 7, 4]);
  });

  it("brings the Greying down on both halls from its round", () => {
    const s = empty(WAR.greying.fromRound);
    const out = battle(s, [], []);
    const bite = Math.round(WAR.buildingHp.castle * WAR.greying.step);
    expect(out.report.greying).toBe(bite);
    expect(out.end.buildings["a-castle"]!.hp).toBe(WAR.buildingHp.castle - bite);
    expect(out.end.buildings["b-castle"]!.hp).toBe(WAR.buildingHp.castle - bite);
  });

  it("property: AI against AI always ends, by the Greying's last round at the latest", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        let s = newMatch(seed);
        while (s.winner === null) {
          const out = battle(s, planAi(s, "a"), planAi(s, "b"));
          for (const u of out.end.units) {
            expect(u.hp).toBeGreaterThan(0);
            expect(u.hp).toBeLessThanOrEqual(maxHp(out.end, u.side, u.class));
          }
          s = out.end;
          expect(s.round).toBeLessThanOrEqual(17);
        }
      }),
      { numRuns: 12 },
    );
  }, 60_000);
});
