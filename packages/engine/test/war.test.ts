import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  AI_EVERY_TICKS,
  BALANCE,
  MAP,
  MINES,
  START,
  STRAT_COLS,
  STRAT_ROWS,
  WAR,
  applyAction,
  at,
  battle,
  canPlace,
  canStep,
  castlePlot,
  createSim,
  findPath,
  findPlacement,
  freeIn,
  incomeFor,
  isHome,
  isWalkable,
  maxHp,
  mineSlots,
  newMatch,
  occupied,
  planAi,
  plotCells,
  plotDistance,
  runAi,
  supplyCap,
  supplyUsed,
  upkeepOf,
  type Action,
  type BuildingKind,
  type MatchState,
  type WarSide,
  type WarUnit,
} from "../src/index.ts";

function act(state: MatchState, side: WarSide, action: Action): MatchState {
  const r = applyAction(state, side, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Build a kind where the AI would put it. */
function build(state: MatchState, side: WarSide, kind: BuildingKind): { state: MatchState; id: string } {
  const spot = findPlacement(state, side, kind)!;
  const next = act(state, side, { type: "build", kind, col: spot.col, row: spot.row });
  const id = Object.keys(next.buildings).find((k) => !state.buildings[k])!;
  return { state: next, id };
}

/** A bare island: both castles and barracks, nobody on it. */
function empty(round = 1, mode: "rounds" | "realtime" = "rounds"): MatchState {
  const s = newMatch("empty", mode);
  return { ...s, round, units: [] };
}

function unit(side: WarSide, cls: WarUnit["class"], col: number, row: number, id: number, order: WarUnit["order"] = { type: "stop" }): WarUnit {
  return { id, side, class: cls, hp: BALANCE.units[cls].hp, col, row, order, stance: "firm", post: { col, row } };
}

const front = (side: WarSide) => ({ col: START[side].castle.col + 1, row: START[side].castle.row + 2 });

describe("island", () => {
  const free = freeIn(occupied(newMatch()));
  const blocked = (c: { col: number; row: number }) => !free(c);

  it("has rows of one width", () => {
    expect(new Set(MAP.map((r) => r.length)).size).toBe(1);
  });

  it("is the same island for both sides, mirrored left to right", () => {
    const flip: Record<string, string> = { "<": ">", ">": "<", "[": "]", "]": "[" };
    for (const line of MAP) expect([...line].reverse().map((ch) => flip[ch] ?? ch).join("")).toBe(line);
    expect(START.b.castle.col).toBe(STRAT_COLS - 1 - START.a.castle.col - 2);
    for (const m of MINES) {
      const twin = MINES.find((o) => o.col === STRAT_COLS - 1 - m.col && o.row === m.row);
      expect(twin, m.id).toBeDefined();
    }
  });

  it("starts each castle and barracks on its own home plateau", () => {
    const s = newMatch(1);
    for (const b of Object.values(s.buildings)) {
      for (const c of plotCells(b)) expect(isHome(b.side, c), `${b.id} ${c.col},${c.row}`).toBe(true);
    }
  });

  it("reaches every open tile from the castle", () => {
    for (let row = 0; row < STRAT_ROWS; row++) {
      for (let col = 0; col < STRAT_COLS; col++) {
        const c = { col, row };
        if (!blocked(c)) expect(findPath(front("a"), c, blocked), `${col},${row}`).not.toBeNull();
      }
    }
  });

  it("joins the bases by exactly two roads", () => {
    const without = (cells: [number, number][]) => (c: { col: number; row: number }) =>
      blocked(c) || cells.some(([col, row]) => c.col === col && c.row === row);
    const pass: [number, number][] = [[22, 13], [38, 13]];
    const ford: [number, number][] = [];
    for (let row = 25; row < 34; row++) ford.push([30, row]);
    // The Low Road runs round the yard; evening the two out is balance work.
    expect(findPath(front("a"), front("b"), without(ford))).toHaveLength(48);
    expect(findPath(front("a"), front("b"), without(pass))).toHaveLength(60);
    expect(findPath(front("a"), front("b"), without([...pass, ...ford]))).toBeNull();
  });

  it("puts each home mine on its home plateau, and gives every mine room", () => {
    expect(isHome("a", MINES.find((m) => m.id === "mine-a")!)).toBe(true);
    expect(isHome("b", MINES.find((m) => m.id === "mine-b")!)).toBe(true);
    for (const m of MINES) expect(mineSlots(m).length, m.id).toBeGreaterThanOrEqual(3);
  });

  it("only changes level along a ramp or the Crown's stairs, one level at a time", () => {
    expect(canStep({ col: 16, row: 15 }, { col: 16, row: 16 })).toBe(true);
    expect(canStep({ col: 15, row: 12 }, { col: 16, row: 12 })).toBe(false);
    expect(canStep({ col: 25, row: 9 }, { col: 25, row: 8 })).toBe(true);
    expect(canStep({ col: 25, row: 8 }, { col: 24, row: 8 })).toBe(false);
    expect(isWalkable(27, 9)).toBe(false);
  });

  it("keeps everyone out of the forest", () => {
    expect(at(2, 16)).toBe("T");
    expect(isWalkable(2, 16)).toBe(false);
  });
});

describe("placement", () => {
  it("builds on open ground of its own plateau or the lowland", () => {
    const s = newMatch(1);
    const spot = findPlacement(s, "a", "barracks")!;
    expect(canPlace(s, "a", "barracks", spot.col, spot.row)).toBeNull();
    expect(canPlace(s, "a", "house", 18, 20)).toBeNull();
  });

  it("refuses the enemy's plateau, high ground, a ramp, forest and a mine's edge", () => {
    const s = newMatch(1);
    expect(canPlace(s, "a", "house", 50, 12)).not.toBeNull();
    expect(canPlace(s, "a", "house", 27, 10)).not.toBeNull();
    expect(canPlace(s, "a", "house", 16, 15)).not.toBeNull();
    expect(canPlace(s, "a", "house", 2, 16)).not.toBeNull();
    const mine = MINES.find((m) => m.id === "mine-ya")!;
    expect(canPlace(s, "a", "house", mine.col + 1, mine.row)).not.toBeNull();
  });

  it("refuses to stand on another building or wall a road off", () => {
    const s = newMatch(1);
    const barracks = s.buildings["a-barracks"]!;
    expect(canPlace(s, "a", "house", barracks.col, barracks.row)).not.toBeNull();
    // The home ramp's foot is the only way down the plateau.
    expect(canPlace(s, "a", "house", 16, 16)).toBe("that would wall off the road");
  });
});

describe("planning", () => {
  it("opens with a castle, a barracks, three Pawns and 260 gold", () => {
    const s = newMatch(1);
    for (const side of ["a", "b"] as const) {
      expect(s.gold[side]).toBe(WAR.startGold + upkeepOf(s, side).income + WAR.pawns.start * WAR.pawnIncome);
      expect(s.gold[side]).toBe(260);
      expect(supplyUsed(s, side)).toBe(WAR.pawns.start);
      expect(supplyCap(s, side)).toBe(WAR.supply.start);
      expect(s.buildings[`${side}-castle`]!.level).toBe(1);
      expect(s.buildings[`${side}-barracks`]!.level).toBe(1);
    }
  });

  it("trains at a cost, beside the building", () => {
    let s = newMatch(1);
    for (let i = 0; i < 3; i++) s = act(s, "a", { type: "train", plot: "a-barracks" });
    expect(s.gold.a).toBe(260 - 3 * WAR.unitCost.warrior);
    const warriors = s.units.filter((u) => u.class === "warrior");
    expect(warriors).toHaveLength(3);
    for (const w of warriors) expect(plotDistance(s.buildings["a-barracks"]!, w)).toBeLessThanOrEqual(3);
  });

  it("trains Pawns at the castle up to the limit, each sent to the next mine with room", () => {
    let s = { ...newMatch(1), gold: { a: 1000, b: 1000 } };
    s = build(s, "a", "house").state;
    s = { ...s, buildings: Object.fromEntries(Object.entries(s.buildings).map(([k, b]) => [k, { ...b, level: 1, hp: 300, pending: null }])) };
    for (let i = WAR.pawns.start; i < WAR.pawns.max; i++) s = act(s, "a", { type: "train", plot: "a-castle" });
    const pawns = s.units.filter((u) => u.side === "a" && u.class === "pawn");
    expect(pawns).toHaveLength(WAR.pawns.max);
    const digging = (id: string) => pawns.filter((u) => u.order.type === "gather" && u.order.mine === id).length;
    expect([digging("mine-a"), digging("mine-ya"), digging("mine-na")]).toEqual([4, 4, 1]);
    expect(applyAction(s, "a", { type: "train", plot: "a-castle" }).ok).toBe(false);
  });

  it("stops training at the supply cap", () => {
    let s = { ...newMatch(1), gold: { a: 1000, b: 1000 } };
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
    expect(a.units.at(-1)!.id).not.toBe(b.units.at(-1)!.id);
  });

  it("spreads a group order over separate tiles", () => {
    let s = newMatch(1);
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    const ids = s.units.filter((u) => u.class === "warrior").map((u) => u.id);
    s = act(s, "a", { type: "order", units: ids, order: { type: "attackMove", to: { col: 19, row: 11 } } });
    const tiles = s.units
      .filter((u) => ids.includes(u.id))
      .map((u) => (u.order.type === "attackMove" ? `${u.order.to.col},${u.order.to.row}` : ""));
    expect(new Set(tiles).size).toBe(2);
  });

  it("does not change the state it was given", () => {
    const s = newMatch(1);
    const before = structuredClone(s);
    applyAction(s, "a", { type: "train", plot: "a-barracks" });
    build(s, "a", "house");
    expect(s).toEqual(before);
  });
});

describe("rounds", () => {
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
    const { state, id } = build(newMatch(1), "a", "house");
    const out = battle(state, [], []);
    expect(out.end.buildings[id]!.level).toBe(1);
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
    const mine = MINES.find((m) => m.id === "mine-a")!;
    const raided = { ...s, units: [...s.units, unit("b", "warrior", mine.col + 2, mine.row + 1, 99)] };
    expect(incomeFor(s, "a").mines).toBe(WAR.pawns.start * WAR.pawnIncome);
    expect(incomeFor(raided, "a").mines).toBe(0);
  });

  it("sends a Pawn to build, off its mine, and at most one building per Pawn", () => {
    let s = { ...newMatch(1), gold: { a: 1000, b: 1000 } };
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = build(s, "a", "house");
      s = r.state;
      ids.push(r.id);
    }
    const builders = s.units.filter((u) => u.side === "a" && u.order.type === "build");
    expect(builders).toHaveLength(WAR.pawns.start);
    const spot = findPlacement(s, "a", "archery")!;
    expect(applyAction(s, "a", { type: "build", kind: "archery", col: spot.col, row: spot.row }).ok).toBe(false);
    expect(applyAction(s, "a", { type: "order", units: [builders[0]!.id], order: { type: "gather", mine: "mine-a" } }).ok).toBe(false);
    const out = battle(s, [], []);
    for (const id of ids) expect(out.end.buildings[id]!.level).toBe(1);
    // Nobody dug this round, and every builder goes back to a mine.
    expect(out.end.income.a.mines).toBe(0);
    const pawns = out.end.units.filter((u) => u.side === "a" && u.class === "pawn");
    expect(pawns.every((u) => u.order.type === "gather")).toBe(true);
  });

  it("marches past enemy buildings rather than stopping to hit them", () => {
    const s = empty();
    const barracks = s.buildings["b-barracks"]!;
    const free = freeIn(occupied(s));
    const near = MAP.flatMap((line, row) => [...line].map((_, col) => ({ col, row }))).filter(free);
    const start = near.find((c) => plotDistance(barracks, c) === 1)!;
    const dest = near.find((c) => plotDistance(castlePlot("a"), c) === 2)!;
    const knight = unit("a", "warrior", start.col, start.row, 1, { type: "attackMove", to: dest });
    const out = battle({ ...s, units: [knight] }, [], []);
    expect(out.events.some((e) => e.type === "hitBuilding")).toBe(false);
    expect(out.events.some((e) => e.type === "move")).toBe(true);
  });

  it("builds from the site's own level, never from the ground below its cliff", () => {
    const { state, id } = build(newMatch(1), "a", "archery");
    const builder = state.units.find((u) => u.order.type === "build")!;
    const out = battle(state, [], []);
    const last = out.end.units.find((u) => u.id === builder.id)!;
    const site = out.end.buildings[id]!;
    expect(plotDistance(site, last)).toBeLessThanOrEqual(3);
    expect(isHome("a", last)).toBe(isHome("a", site));
  });

  it("never lets a Pawn strike, even beside an enemy, nor take an attack order", () => {
    const s = empty();
    const pawn = unit("a", "pawn", 18, 11, 1);
    const foe = unit("b", "warrior", 19, 11, 2);
    const out = battle({ ...s, units: [pawn, foe] }, [], []);
    expect(out.events.some((e) => e.type === "attack" && e.unit === 1)).toBe(false);
    expect(out.events.some((e) => e.type === "attack" && e.unit === 2)).toBe(true);
    const r = applyAction({ ...s, units: [pawn, foe] }, "a", { type: "order", units: [1], order: { type: "attack", unit: 2 } });
    expect(r.ok).toBe(false);
  });

  it("sends a wounded Fall back unit home, where it heals", () => {
    const s = empty();
    const hurt = { ...unit("a", "warrior", 19, 11, 1), hp: 30, stance: "fallBack" as const };
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
    const army = (n: number): MatchState => ({ ...s, units: Array.from({ length: n }, (_, i) => unit("a", "warrior", 0, 0, 2 * i + 1)) });
    expect([0, 6, 7, 10, 11].map((n) => upkeepOf(army(n), "a").income)).toEqual([100, 100, 70, 70, 40]);
  });

  it("takes orders during a battle, but nothing else", () => {
    let s = newMatch(1);
    s = act(s, "a", { type: "train", plot: "a-barracks" });
    const w = s.units.find((u) => u.class === "warrior")!;
    const sim = createSim(s);
    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.issue("a", { type: "order", units: [w.id], order: { type: "move", to: { col: 19, row: 11 } } })).toBeNull();
    expect(sim.issue("a", { type: "train", plot: "a-barracks" })).not.toBeNull();
    for (let i = 0; i < 300; i++) sim.step();
    const after = sim.snapshot().units.find((u) => u.id === w.id)!;
    expect(Math.max(Math.abs(after.col - 19), Math.abs(after.row - 11))).toBeLessThanOrEqual(1);
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
      { numRuns: 8 },
    );
  }, 120_000);
});

describe("real time", () => {
  const seconds = (n: number) => n * BALANCE.tickRate;

  it("carries gold home a bag at a time, taxed by upkeep", () => {
    const s = newMatch(1, "realtime");
    const sim = createSim(s);
    const before = sim.world.gold.a;
    for (let i = 0; i < seconds(60); i++) sim.step();
    const bags = sim.events.filter((e) => e.type === "deliver" && e.side === "a");
    expect(bags.length).toBeGreaterThan(3);
    expect(bags.every((e) => e.type === "deliver" && e.gold === WAR.realtime.carry)).toBe(true);
    expect(sim.world.gold.a).toBe(before + bags.length * WAR.realtime.carry);
    expect(sim.world.mines["mine-a"]).toBe(WAR.mineGold["mine-a"]! - bags.length * WAR.realtime.carry - sim.world.units.filter((u) => u.side === "a" && u.carry).length * WAR.realtime.carry);
  });

  it("trains from a queue, counting its supply, and refunds a cancel", () => {
    const sim = createSim(newMatch(1, "realtime"));
    const gold = sim.world.gold.a;
    expect(sim.issue("a", { type: "train", plot: "a-barracks" })).toBeNull();
    expect(sim.issue("a", { type: "train", plot: "a-barracks" })).toBeNull();
    expect(sim.world.gold.a).toBe(gold - 2 * WAR.unitCost.warrior);
    expect(supplyUsed(sim.world, "a")).toBe(WAR.pawns.start + 2);
    expect(sim.issue("a", { type: "cancel", plot: "a-barracks" })).toBeNull();
    expect(sim.world.gold.a).toBe(gold - WAR.unitCost.warrior);
    for (let i = 0; i < seconds(WAR.realtime.trainSeconds.warrior) - 1; i++) sim.step();
    expect(sim.world.units.some((u) => u.side === "a" && u.class === "warrior")).toBe(false);
    for (let i = 0; i < 3; i++) sim.step();
    expect(sim.world.units.filter((u) => u.side === "a" && u.class === "warrior")).toHaveLength(1);
  });

  it("sends new units to the rally point", () => {
    const sim = createSim(newMatch(1, "realtime"));
    const to = { col: 19, row: 11 };
    sim.issue("a", { type: "rally", plot: "a-barracks", to });
    sim.issue("a", { type: "train", plot: "a-barracks" });
    for (let i = 0; i < seconds(WAR.realtime.trainSeconds.warrior + 30); i++) sim.step();
    const w = sim.world.units.find((u) => u.side === "a" && u.class === "warrior")!;
    expect(Math.max(Math.abs(w.col - to.col), Math.abs(w.row - to.row))).toBeLessThanOrEqual(1);
  });

  it("raises a building only while a Pawn hammers beside it", () => {
    const s = newMatch(1, "realtime");
    const spot = findPlacement(s, "a", "house")!;
    const sim = createSim(s);
    expect(sim.issue("a", { type: "build", kind: "house", col: spot.col, row: spot.row })).toBeNull();
    const id = Object.keys(sim.world.buildings).find((k) => k.startsWith("a-house"))!;
    for (let i = 0; i < seconds(WAR.realtime.buildSeconds.house! + 20); i++) sim.step();
    expect(sim.world.buildings[id]!.level).toBe(1);
    expect(sim.events.some((e) => e.type === "built" && e.plot === id)).toBe(true);
    expect(supplyCap(sim.world, "a")).toBe(WAR.supply.start + WAR.supply.perHouse);
  });

  it("is the same match for the same actions", () => {
    const play = () => {
      const sim = createSim(newMatch("same", "realtime"));
      for (let i = 0; i < seconds(90); i++) {
        if (i % AI_EVERY_TICKS === 0) for (const side of ["a", "b"] as const) runAi(sim, side);
        sim.step();
      }
      return sim.snapshot();
    };
    expect(play()).toEqual(play());
  });

  it("ends by the Greying's deadline, AI against AI", () => {
    const sim = createSim(newMatch(7, "realtime"));
    const g = WAR.realtime.greying;
    const deadline = seconds(g.fromSeconds + 10 * g.everySeconds);
    while (sim.world.winner === null && sim.t < deadline) {
      if (sim.t % AI_EVERY_TICKS === 0) for (const side of ["a", "b"] as const) runAi(sim, side);
      sim.step();
      sim.events.length = 0;
    }
    expect(sim.world.winner).not.toBeNull();
  }, 60_000);
});
