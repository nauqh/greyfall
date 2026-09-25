/**
 * The war on the island: match state, and the planning half of a round.
 * Pure, like the rest of the engine: a state and an action in, a new state
 * or an error out, so the client can check a plan as it is made and the
 * server can replay the same actions to trust it.
 */

import { BALANCE, WAR, type UnitClass } from "./balance.ts";
import {
  MINES,
  PLOTS,
  castlePlot,
  cellKey,
  isOpen,
  mineSlots,
  plotDistance,
  stepsFrom,
  tileDistance,
  type BuildingKind,
  type Cell,
  type Mine,
  type Plot,
  type WarSide,
} from "./island.ts";

export type Order =
  | { type: "attackMove"; to: Cell }
  | { type: "move"; to: Cell }
  | { type: "attack"; unit: number }
  | { type: "attackBuilding"; plot: string }
  | { type: "hold" }
  | { type: "gather"; mine: string }
  | { type: "stop" };

export type Stance = "firm" | "fallBack";

export interface WarUnit {
  id: number;
  side: WarSide;
  class: UnitClass;
  hp: number;
  col: number;
  row: number;
  order: Order;
  stance: Stance;
  /** Where a stopped unit guards and returns to. */
  post: Cell;
}

export interface Building {
  plot: string;
  /** 0 is an empty plot. */
  level: number;
  hp: number;
  /** Finishes at the end of this round's battle phase. */
  pending: "build" | "upgrade" | null;
}

export interface MatchState {
  seed: number | string;
  round: number;
  gold: Record<WarSide, number>;
  units: WarUnit[];
  buildings: Record<string, Building>;
  /** Gold left in each mine. */
  mines: Record<string, number>;
  /** Per side, so two plans made from the same state never mint the same
   *  id: blue's units are odd, red's even. */
  nextId: Record<WarSide, number>;
  winner: WarSide | "draw" | null;
  /** What arrived at the start of this round. */
  income: Record<WarSide, { base: number; mines: number }>;
}

export type Action =
  | { type: "train"; plot: string }
  | { type: "build"; plot: string }
  | { type: "upgrade"; plot: string }
  | { type: "order"; units: number[]; order: Order }
  | { type: "stance"; units: number[]; stance: Stance };

/** A round's plan: the actions a side took, in order. */
export type Plan = Action[];

export type ActionResult = { ok: true; state: MatchState } | { ok: false; error: string };

export const SIDES: readonly WarSide[] = ["a", "b"];

export function enemyOf(side: WarSide): WarSide {
  return side === "a" ? "b" : "a";
}

export function plotById(id: string): Plot | undefined {
  return PLOTS.find((p) => p.id === id);
}

export function mineById(id: string): Mine | undefined {
  return MINES.find((m) => m.id === id);
}

function buildingHp(kind: BuildingKind): number {
  return kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other;
}

/** The level of a side's building of this kind, 0 when absent or unfinished. */
export function levelOf(state: MatchState, side: WarSide, kind: BuildingKind): number {
  const p = PLOTS.find((x) => x.side === side && x.kind === kind);
  const b = p && state.buildings[p.id];
  if (!b || b.level === 0 || b.pending === "build") return 0;
  return b.level;
}

export function maxHp(state: MatchState, side: WarSide, cls: UnitClass): number {
  const base = BALANCE.units[cls].hp;
  if (cls === "warrior" && levelOf(state, side, "barracks") >= 2) return Math.round(base * (1 + WAR.level2.warriorHp));
  if (cls === "lancer" && levelOf(state, side, "tower") >= 2) return Math.round(base * (1 + WAR.level2.lancerHp));
  return base;
}

export function rangeOf(state: MatchState, side: WarSide, cls: UnitClass): number {
  const base = WAR.range[cls];
  return cls === "archer" && levelOf(state, side, "archery") >= 2 ? base + WAR.level2.archerRange : base;
}

export function healOf(state: MatchState, side: WarSide, cls: UnitClass): number {
  const base = BALANCE.units[cls].heal;
  return levelOf(state, side, "monastery") >= 2 ? Math.round(base * (1 + WAR.level2.monkHeal)) : base;
}

export function supplyUsed(state: MatchState, side: WarSide): number {
  return state.units.filter((u) => u.side === side).length;
}

export function supplyCap(state: MatchState, side: WarSide): number {
  const houses = PLOTS.filter((p) => p.side === side && p.kind === "house").filter((p) => {
    const b = state.buildings[p.id]!;
    return b.level > 0 && b.pending !== "build";
  }).length;
  return Math.min(WAR.supply.max, WAR.supply.start + houses * WAR.supply.perHouse);
}

/** A trainable plot's class, when it trains one. */
export function trainsAt(plot: Plot): UnitClass | undefined {
  return WAR.trains[plot.kind];
}

/** Open tiles in walking order out from `seeds`, skipping any in `skip`. */
function floodOpen(seeds: readonly Cell[], n: number, skip: ReadonlySet<number>): Cell[] {
  const out: Cell[] = [];
  const seen = new Set(seeds.map(cellKey));
  const queue = [...seeds];
  for (let head = 0; head < queue.length && out.length < n; head++) {
    const cur = queue[head]!;
    if (!skip.has(cellKey(cur))) out.push(cur);
    for (const next of stepsFrom(cur)) {
      if (seen.has(cellKey(next)) || !isOpen(next)) continue;
      seen.add(cellKey(next));
      queue.push(next);
    }
  }
  return out;
}

/** The nearest open, empty tiles to a plot, nearest first. */
function tilesBeside(state: MatchState, plot: Plot, n: number): Cell[] {
  const seeds: Cell[] = [];
  // South row first: a unit stepping out stands in front of the art, not on its roof.
  for (let r = plot.row + plot.h; r >= plot.row - 1; r--) {
    for (let c = plot.col - 1; c <= plot.col + plot.w; c++) {
      const cell = { col: c, row: r };
      if (plotDistance(plot, cell) === 1 && isOpen(cell)) seeds.push(cell);
    }
  }
  return floodOpen(seeds, n, new Set(state.units.map(cellKey)));
}

/**
 * Distinct open tiles around `to` for a group, one each, so a group order
 * lands as a clump rather than a queue for one tile. The flood only crosses
 * ground a unit could walk, so a clump at a cliff edge stays on its level.
 * Tiles held by the group's own members stay available to them.
 */
export function spreadAround(state: MatchState, to: Cell, units: readonly WarUnit[]): Cell[] {
  const mine = new Set(units.map((u) => u.id));
  return floodOpen([to], units.length, new Set(state.units.filter((u) => !mine.has(u.id)).map(cellKey)));
}

/** Pawns of `side` with a gather order on this mine. */
function gatherers(state: MatchState, mineId: string, side?: WarSide): WarUnit[] {
  return state.units.filter(
    (u) => u.order.type === "gather" && u.order.mine === mineId && (side === undefined || u.side === side),
  );
}

/**
 * Income for the round about to start: the base, plus each Pawn standing at
 * a mine it gathers from, unless an enemy fighter is near that mine.
 */
export function incomeFor(state: MatchState, side: WarSide): { base: number; mines: number; drawn: Record<string, number> } {
  const drawn: Record<string, number> = {};
  let mines = 0;
  for (const mine of MINES) {
    const raided = state.units.some(
      (u) =>
        u.side !== side &&
        u.class !== "pawn" &&
        u.class !== "monk" &&
        tileDistance(u, mine) <= WAR.raidRadius,
    );
    if (raided) continue;
    const digging = gatherers(state, mine.id, side).filter((u) => tileDistance(u, mine) <= 1);
    const take = Math.min(digging.length * WAR.pawnIncome, state.mines[mine.id] ?? 0);
    if (take > 0) {
      drawn[mine.id] = take;
      mines += take;
    }
  }
  return { base: WAR.income, mines, drawn };
}

/** Pay a new round's income into both purses and draw it from the mines. */
export function payIncome(state: MatchState): MatchState {
  const next = structuredClone(state);
  for (const side of SIDES) {
    const inc = incomeFor(state, side);
    next.gold[side] += inc.base + inc.mines;
    for (const [id, g] of Object.entries(inc.drawn)) next.mines[id] = (next.mines[id] ?? 0) - g;
    next.income[side] = { base: inc.base, mines: inc.mines };
  }
  return next;
}

function addUnit(state: MatchState, side: WarSide, cls: UnitClass, at: Cell, order: Order): WarUnit {
  const unit: WarUnit = {
    id: 2 * state.nextId[side]++ + (side === "a" ? 1 : 2),
    side,
    class: cls,
    hp: maxHp(state, side, cls),
    col: at.col,
    row: at.row,
    order,
    stance: cls === "pawn" ? "fallBack" : "firm",
    post: { col: at.col, row: at.row },
  };
  state.units.push(unit);
  return unit;
}

function homeMine(side: WarSide): Mine {
  return mineById(`mine-${side}`)!;
}

/** Pawns that died stand beside the castle again, back to digging at home. */
export function restorePawns(state: MatchState): MatchState {
  const next = structuredClone(state);
  for (const side of SIDES) {
    const missing = WAR.pawns - next.units.filter((u) => u.side === side && u.class === "pawn").length;
    if (missing <= 0) continue;
    const mine = homeMine(side);
    for (const at of tilesBeside(next, castlePlot(side), missing)) {
      addUnit(next, side, "pawn", at, { type: "gather", mine: mine.id });
    }
  }
  return next;
}

/** Round 1: castle, barracks, three Pawns at the home mine, and the first income. */
export function newMatch(seed: number | string = 0): MatchState {
  const state: MatchState = {
    seed,
    round: 1,
    gold: { a: WAR.startGold, b: WAR.startGold },
    units: [],
    buildings: {},
    mines: { ...WAR.mineGold },
    nextId: { a: 0, b: 0 },
    winner: null,
    income: { a: { base: 0, mines: 0 }, b: { base: 0, mines: 0 } },
  };
  for (const p of PLOTS) {
    const standing = p.kind === "castle" || p.kind === "barracks";
    state.buildings[p.id] = {
      plot: p.id,
      level: standing ? 1 : 0,
      hp: standing ? buildingHp(p.kind) : 0,
      pending: null,
    };
  }
  for (const side of SIDES) {
    const mine = homeMine(side);
    for (const slot of mineSlots(mine).slice(0, WAR.pawns)) {
      addUnit(state, side, "pawn", slot, { type: "gather", mine: mine.id });
    }
  }
  return payIncome(state);
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function ownPlot(side: WarSide, id: string): Plot | undefined {
  const p = plotById(id);
  return p && p.side === side ? p : undefined;
}

/** Whether a unit of this class may take this kind of order. */
function allows(cls: UnitClass, order: Order): boolean {
  switch (order.type) {
    case "gather":
      return cls === "pawn";
    case "attack":
    case "attackBuilding":
      return cls !== "monk";
    default:
      return true;
  }
}

/**
 * One planning action for one side. Checks it against the rules and returns
 * the state after it, or why not. Never touches the other side.
 */
export function applyAction(state: MatchState, side: WarSide, action: Action): ActionResult {
  if (state.winner !== null) return fail("the match is over");
  const next = structuredClone(state);

  switch (action.type) {
    case "train": {
      const plot = ownPlot(side, action.plot);
      if (!plot) return fail("not your building");
      const cls = trainsAt(plot);
      if (!cls) return fail(`a ${plot.kind} trains nothing`);
      const b = next.buildings[plot.id]!;
      if (b.level === 0 || b.pending === "build") return fail(`the ${plot.kind} is not built`);
      const cost = WAR.unitCost[cls];
      if (next.gold[side] < cost) return fail(`a ${cls} costs ${cost} gold`);
      if (supplyUsed(next, side) >= supplyCap(next, side)) return fail("no supply left; build a house");
      const [at] = tilesBeside(next, plot, 1);
      if (!at) return fail(`no room beside the ${plot.kind}`);
      next.gold[side] -= cost;
      addUnit(next, side, cls, at, { type: "stop" });
      return { ok: true, state: next };
    }

    case "build": {
      const plot = ownPlot(side, action.plot);
      if (!plot) return fail("not your plot");
      const b = next.buildings[plot.id]!;
      if (b.level > 0 || b.pending) return fail(`the ${plot.kind} already stands`);
      const cost = WAR.buildCost[plot.kind]!;
      if (plot.kind === "castle") return fail("the castle cannot be rebuilt");
      if (next.gold[side] < cost) return fail(`a ${plot.kind} costs ${cost} gold`);
      next.gold[side] -= cost;
      b.pending = "build";
      return { ok: true, state: next };
    }

    case "upgrade": {
      const plot = ownPlot(side, action.plot);
      if (!plot) return fail("not your building");
      if (!trainsAt(plot) || plot.kind === "castle") return fail(`a ${plot.kind} has no upgrade yet`);
      const b = next.buildings[plot.id]!;
      if (b.level === 0 || b.pending) return fail(`the ${plot.kind} is not ready`);
      if (b.level >= WAR.maxLevel) return fail(`the ${plot.kind} is at its highest level`);
      if (next.gold[side] < WAR.upgradeCost) return fail(`an upgrade costs ${WAR.upgradeCost} gold`);
      next.gold[side] -= WAR.upgradeCost;
      b.pending = "upgrade";
      return { ok: true, state: next };
    }

    case "order": {
      const ids = new Set(action.units);
      const units = next.units.filter((u) => ids.has(u.id));
      if (units.length === 0 || units.length !== ids.size) return fail("no such units");
      if (units.some((u) => u.side !== side)) return fail("not your units");
      const order = action.order;
      const bad = units.find((u) => !allows(u.class, order));
      if (bad) return fail(`a ${bad.class} cannot take that order`);

      if (order.type === "move" || order.type === "attackMove") {
        if (!isOpen(order.to)) return fail("nobody can stand there");
        const spots = spreadAround(next, order.to, units);
        // Nearest unit to the target takes the target tile, and so on out.
        const byDistance = [...units].sort(
          (x, y) => tileDistance(x, order.to) - tileDistance(y, order.to) || x.id - y.id,
        );
        byDistance.forEach((u, i) => {
          u.order = { type: order.type, to: spots[i] ?? order.to };
        });
        return { ok: true, state: next };
      }
      if (order.type === "attack") {
        const target = next.units.find((u) => u.id === order.unit);
        if (!target || target.side === side) return fail("not an enemy");
      }
      if (order.type === "attackBuilding") {
        const plot = plotById(order.plot);
        const b = plot && next.buildings[plot.id];
        if (!plot || plot.side === side || !b || b.level === 0) return fail("not an enemy building");
      }
      if (order.type === "gather") {
        const mine = mineById(order.mine);
        if (!mine) return fail("no such mine");
        const already = gatherers(next, mine.id, side).filter((u) => !ids.has(u.id)).length;
        if (already + units.length > WAR.pawnsPerMine) {
          return fail(`a mine takes ${WAR.pawnsPerMine} Pawns`);
        }
      }
      for (const u of units) {
        u.order = order;
        if (order.type === "stop") u.post = { col: u.col, row: u.row };
      }
      return { ok: true, state: next };
    }

    case "stance": {
      const ids = new Set(action.units);
      const units = next.units.filter((u) => ids.has(u.id));
      if (units.length === 0 || units.length !== ids.size) return fail("no such units");
      if (units.some((u) => u.side !== side)) return fail("not your units");
      for (const u of units) u.stance = action.stance;
      return { ok: true, state: next };
    }
  }
}

/** A whole plan, action by action. Throws on the first illegal one: a plan
 *  reaching the server has already been checked by the client. */
export function applyPlan(state: MatchState, side: WarSide, plan: Plan): MatchState {
  let cur = state;
  for (const [i, action] of plan.entries()) {
    const r = applyAction(cur, side, action);
    if (!r.ok) throw new Error(`side ${side} action ${i} (${action.type}): ${r.error}`);
    cur = r.state;
  }
  return cur;
}

