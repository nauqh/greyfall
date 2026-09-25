import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  MAP,
  MINES,
  PLOTS,
  WAR,
  applyAction,
  battle,
  canStep,
  castlePlot,
  findPath,
  incomeFor,
  isHome,
  isOpen,
  maxHp,
  mineSlots,
  newMatch,
  planAi,
  plotCells,
  supplyCap,
  supplyUsed,
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

  it("puts the middle mine as far from one castle as the other", () => {
    const mid = MINES.find((m) => m.id === "mine-mid")!;
    const [slot] = mineSlots(mid);
    const a = findPath({ col: 8, row: 3 }, slot!, blocked)!.length;
    const b = findPath({ col: 24, row: 15 }, slot!, blocked)!.length;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  });

  it("gives every mine room for its Pawns", () => {
    for (const m of MINES) expect(mineSlots(m).length).toBeGreaterThanOrEqual(WAR.pawnsPerMine);
  });

  it("only changes level along a ramp", () => {
    expect(canStep({ col: 13, row: 5 }, { col: 13, row: 6 })).toBe(true);
    expect(canStep({ col: 14, row: 4 }, { col: 15, row: 4 })).toBe(false);
  });
});

describe("planning", () => {
  it("opens with a castle, a barracks, two Pawns and 24 gold", () => {
    const s = newMatch(1);
    for (const side of ["a", "b"] as const) {
      expect(s.gold[side]).toBe(WAR.startGold + WAR.income + WAR.startPawns * WAR.pawnIncome);
      expect(supplyUsed(s, side)).toBe(2);
      expect(supplyCap(s, side)).toBe(WAR.supply.start);
      expect(s.buildings[`${side}-castle`]!.level).toBe(1);
      expect(s.buildings[`${side}-barracks`]!.level).toBe(1);
      expect(s.buildings[`${side}-archery`]!.level).toBe(0);
    }
  });

  it("trains at a cost, beside the building, up to the round's limit", () => {
    let s = newMatch(1);
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    expect(s.gold.a).toBe(24 - 2 * WAR.unitCost.warrior);
    expect(s.units.filter((u) => u.class === "warrior")).toHaveLength(2);
    const third = applyAction(s, "a", { type: "train", plot: "a-barracks" });
    expect(third.ok).toBe(false);
  });

  it("stops training at the supply cap", () => {
    let s = newMatch(1);
    s = { ...s, gold: { a: 100, b: 100 } };
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-castle" });
    s = act(s, "a", { type: "train", plot: "a-castle" });
    expect(supplyUsed(s, "a")).toBe(6);
    expect(applyAction(s, "a", { type: "train", plot: "a-castle" })).toMatchObject({ ok: false });
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
    s = act(s, "a", { type: "order", units: ids, order: { type: "attackMove", to: { col: 20, row: 6 } } });
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
    expect(out.end.gold.a).toBe(s.gold.a + WAR.income + 2 * WAR.pawnIncome);
    expect(out.end.mines["mine-a"]).toBe(WAR.mineGold["mine-a"]! - 4 * WAR.pawnIncome);
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
    raider.col = 17;
    raider.row = 4;
    const raided = { ...s, units: [...s.units, raider] };
    expect(incomeFor(s, "a").mines).toBe(2 * WAR.pawnIncome);
    expect(incomeFor(raided, "a").mines).toBe(0);
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
