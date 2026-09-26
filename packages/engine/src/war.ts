/**
 * The war on the island: match state, and the actions a side takes on it.
 * Pure, like the rest of the engine: a state and an action in, a new state
 * or an error out, so the client can check a plan as it is made and the
 * server can replay the same actions to trust it.
 *
 * Two modes share it. In rounds, actions are the plan made while the world
 * stands still. In real time they arrive while the simulation runs
 * (battle.ts createSim), and training and building take time.
 */

import { BALANCE, WAR, type UnitClass } from "./balance.ts";
import {
  FOOTPRINT,
  MINES,
  START,
  buildSlots,
  castlePlot,
  cellKey,
  findRoute,
  isHome,
  isOpen,
  isSlope,
  isWalkable,
  level,
  mineSlots,
  plotCells,
  plotDistance,
  stepsFrom,
  tileDistance,
  type BuildingKind,
  type Cell,
  type Mine,
  type Plot,
  type WarSide,
} from "./island.ts";

export type Mode = "rounds" | "realtime";

export type Order =
  | { type: "attackMove"; to: Cell }
  | { type: "move"; to: Cell }
  | { type: "attack"; unit: number }
  | { type: "attackBuilding"; plot: string }
  | { type: "hold" }
  | { type: "gather"; mine: string }
  /** A Pawn raising or upgrading this building; set by the build and upgrade actions. */
  | { type: "build"; plot: string }
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
  /** Real time: gold a Pawn is carrying home. */
  carry?: number;
}

/** A unit waiting in a building's queue, real time only. */
export interface Training {
  cls: UnitClass;
  /** Ticks until it steps out. */
  left: number;
}

export interface Building extends Plot {
  /** 0 while it is still going up. */
  level: number;
  hp: number;
  /** Finishes at the end of the round, or once `progress` reaches its time. */
  pending: "build" | "upgrade" | null;
  /** Real time: ticks a Pawn has worked on the pending build or upgrade. */
  progress: number;
  queue: Training[];
  /** Where its new units go; a mine sends new Pawns to dig there. */
  rally: Cell | null;
}

export interface MatchState {
  seed: number | string;
  mode: Mode;
  /** Rounds: the round being played. Real time: the clock in round-sized steps. */
  round: number;
  /** Real time: ticks since the match began. */
  tick: number;
  gold: Record<WarSide, number>;
  units: WarUnit[];
  buildings: Record<string, Building>;
  /** Gold left in each mine. */
  mines: Record<string, number>;
  /** Per side, so two plans made from the same state never mint the same
   *  id: blue's units are odd, red's even. */
  nextId: Record<WarSide, number>;
  /** Per side, for building ids. */
  nextPlot: Record<WarSide, number>;
  winner: WarSide | "draw" | null;
  /** What arrived at the start of this round. */
  income: Record<WarSide, { base: number; mines: number }>;
}

export type Action =
  | { type: "train"; plot: string }
  | { type: "build"; kind: BuildingKind; col: number; row: number }
  | { type: "upgrade"; plot: string }
  /** Real time: take the last unit off a building's queue, gold back. */
  | { type: "cancel"; plot: string }
  | { type: "rally"; plot: string; to: Cell }
  | { type: "order"; units: number[]; order: Order }
  | { type: "stance"; units: number[]; stance: Stance };

/** A round's plan: the actions a side took, in order. */
export type Plan = Action[];

export type ActionResult = { ok: true; state: MatchState } | { ok: false; error: string };

export const SIDES: readonly WarSide[] = ["a", "b"];

export function enemyOf(side: WarSide): WarSide {
  return side === "a" ? "b" : "a";
}

export function plotById(state: MatchState, id: string): Building | undefined {
  return state.buildings[id];
}

export function mineById(id: string): Mine | undefined {
  return MINES.find((m) => m.id === id);
}

export function buildingHp(kind: BuildingKind): number {
  return kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other;
}

/** Built, not still going up, and not knocked down. */
export function standing(b: Building): boolean {
  return b.level > 0 && b.pending !== "build" && b.hp > 0;
}

export function ownBuildings(state: MatchState, side: WarSide): Building[] {
  return Object.values(state.buildings).filter((b) => b.side === side);
}

/** The highest level a side has of a kind of building, 0 when it has none standing. */
export function levelOf(state: MatchState, side: WarSide, kind: BuildingKind): number {
  return Math.max(0, ...ownBuildings(state, side).filter((b) => b.kind === kind && standing(b)).map((b) => b.level));
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

/** Units on the field plus those waiting in queues: a queued unit has its supply. */
export function supplyUsed(state: MatchState, side: WarSide): number {
  const queued = ownBuildings(state, side).reduce((n, b) => n + b.queue.length, 0);
  return state.units.filter((u) => u.side === side).length + queued;
}

export function supplyCap(state: MatchState, side: WarSide): number {
  const houses = ownBuildings(state, side).filter((b) => b.kind === "house" && standing(b)).length;
  return Math.min(WAR.supply.max, WAR.supply.start + houses * WAR.supply.perHouse);
}

/** A building's class, when it trains one. */
export function trainsAt(plot: Plot): UnitClass | undefined {
  return WAR.trains[plot.kind];
}

/** Every tile a building or a mine stands on. */
export function occupied(state: MatchState): Set<number> {
  const out = new Set<number>(MINES.map(cellKey));
  for (const b of Object.values(state.buildings)) for (const c of plotCells(b)) out.add(cellKey(c));
  return out;
}

/** Open ground with no building on it, against a precomputed `occupied`. */
export function freeIn(occ: ReadonlySet<number>): (c: Cell) => boolean {
  return (c) => isOpen(c) && !occ.has(cellKey(c));
}

/** Free tiles in walking order out from `seeds`, skipping any in `skip`. */
function floodFree(seeds: readonly Cell[], n: number, skip: ReadonlySet<number>, free: (c: Cell) => boolean): Cell[] {
  const out: Cell[] = [];
  const seen = new Set(seeds.map(cellKey));
  const queue = [...seeds];
  for (let head = 0; head < queue.length && out.length < n; head++) {
    const cur = queue[head]!;
    if (!skip.has(cellKey(cur))) out.push(cur);
    for (const next of stepsFrom(cur)) {
      if (seen.has(cellKey(next)) || !free(next)) continue;
      seen.add(cellKey(next));
      queue.push(next);
    }
  }
  return out;
}

/** The nearest free, empty tiles to a building, nearest first. */
export function tilesBeside(state: MatchState, plot: Plot, n: number): Cell[] {
  const free = freeIn(occupied(state));
  // South row first: a unit stepping out stands in front of the art, not on its roof.
  const seeds = [...buildSlots(plot, (c) => !free(c))].sort((a, b) => b.row - a.row);
  return floodFree(seeds, n, new Set(state.units.map(cellKey)), free);
}

/**
 * Distinct free tiles around `to` for a group, one each, so a group order
 * lands as a clump rather than a queue for one tile. The flood only crosses
 * ground a unit could walk, so a clump at a cliff edge stays on its level.
 * Tiles held by the group's own members stay available to them.
 */
export function spreadAround(state: MatchState, to: Cell, units: readonly WarUnit[]): Cell[] {
  const mine = new Set(units.map((u) => u.id));
  return floodFree([to], units.length, new Set(state.units.filter((u) => !mine.has(u.id)).map(cellKey)), freeIn(occupied(state)));
}

/** Pawns of `side` with a gather order on this mine. */
export function gatherers(state: MatchState, mineId: string, side?: WarSide): WarUnit[] {
  return state.units.filter(
    (u) => u.order.type === "gather" && u.order.mine === mineId && (side === undefined || u.side === side),
  );
}

export function upkeepOf(state: MatchState, side: WarSide): (typeof WAR.upkeep)[number] {
  const fighters = state.units.filter((u) => u.side === side && u.class !== "pawn").length;
  return WAR.upkeep.find((t) => fighters >= t.fighters)!;
}

/**
 * Rounds: income for the round about to start. The base, plus each Pawn
 * standing at a mine it gathers from, unless an enemy fighter is near it.
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
  return { base: upkeepOf(state, side).income, mines, drawn };
}

/** Rounds: pay a new round's income into both purses and draw it from the mines. */
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

export function addUnit(state: MatchState, side: WarSide, cls: UnitClass, at: Cell, order: Order): WarUnit {
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

/** Where a Pawn looking for work goes: home first, then the yard, the north
 *  corridor, the south-west woods and the ford; the first with gold and room. */
export function openMine(state: MatchState, side: WarSide): Mine | undefined {
  return [`mine-${side}`, `mine-y${side}`, `mine-n${side}`, `mine-s${side}`, "mine-mid"]
    .map((id) => mineById(id)!)
    .find((m) => (state.mines[m.id] ?? 0) > 0 && gatherers(state, m.id, side).length < WAR.pawnsPerMine);
}

/** Work for a Pawn, or a wait where it stands when every mine is full. */
export function pawnOrder(state: MatchState, side: WarSide): Order {
  const mine = openMine(state, side);
  return mine ? { type: "gather", mine: mine.id } : { type: "stop" };
}

/** A side left with no Pawns, and none on the way, gets one beside the
 *  castle, so nobody is locked out of the economy. Otherwise the dead stay dead. */
export function restorePawns(state: MatchState): MatchState {
  const next = structuredClone(state);
  for (const side of SIDES) {
    if (next.units.some((u) => u.side === side && u.class === "pawn")) continue;
    if (ownBuildings(next, side).some((b) => b.queue.some((q) => q.cls === "pawn"))) continue;
    for (const at of tilesBeside(next, castlePlot(side), 1)) addUnit(next, side, "pawn", at, pawnOrder(next, side));
  }
  return next;
}

function newBuilding(side: WarSide, id: string, kind: BuildingKind, at: Cell, level: number): Building {
  return {
    id,
    side,
    kind,
    ...at,
    ...FOOTPRINT[kind],
    level,
    hp: level > 0 ? buildingHp(kind) : 0,
    pending: null,
    progress: 0,
    queue: [],
    rally: null,
  };
}

/** A castle, a barracks and three Pawns at the home mine a side, and the
 *  first round's income. Real time starts with the same purse but full
 *  mines: from here on gold only comes home in bags. */
export function newMatch(seed: number | string = 0, mode: Mode = "rounds"): MatchState {
  const state: MatchState = {
    seed,
    mode,
    round: 1,
    tick: 0,
    gold: { a: WAR.startGold, b: WAR.startGold },
    units: [],
    buildings: {},
    mines: { ...WAR.mineGold },
    nextId: { a: 0, b: 0 },
    nextPlot: { a: 0, b: 0 },
    winner: null,
    income: { a: { base: 0, mines: 0 }, b: { base: 0, mines: 0 } },
  };
  for (const side of SIDES) {
    state.buildings[`${side}-castle`] = newBuilding(side, `${side}-castle`, "castle", START[side].castle, 1);
    state.buildings[`${side}-barracks`] = newBuilding(side, `${side}-barracks`, "barracks", START[side].barracks, 1);
    const mine = mineById(`mine-${side}`)!;
    for (const slot of mineSlots(mine).slice(0, WAR.pawns.start)) {
      addUnit(state, side, "pawn", slot, { type: "gather", mine: mine.id });
    }
  }
  const paid = payIncome(state);
  return mode === "realtime" ? { ...paid, mines: { ...WAR.mineGold } } : paid;
}

/** Why a building of this kind cannot stand with its top-left tile here, or
 *  null when it can: on open, level ground (a side's own plateau or the
 *  lowland), clear of mines, buildings and units, and walling nothing off. */
export function canPlace(state: MatchState, side: WarSide, kind: BuildingKind, col: number, row: number): string | null {
  const { w, h } = FOOTPRINT[kind];
  const cells = plotCells({ col, row, w, h });
  const lv = level(col, row);
  const occ = occupied(state);
  for (const c of cells) {
    if (!isWalkable(c.col, c.row) || isSlope(c.col, c.row) || level(c.col, c.row) !== lv) return "the ground is not open and level";
    if (occ.has(cellKey(c))) return "something already stands there";
    if (MINES.some((m) => tileDistance(m, c) <= 1)) return "too close to a mine";
    if (state.units.some((u) => u.col === c.col && u.row === c.row)) return "a unit is in the way";
  }
  if (lv !== 1 && !(lv === 2 && cells.every((c) => isHome(side, c)))) return "build on your own plateau or the lowland";

  // Nothing walled off: the castles still meet, every mine keeps a way in,
  // and every building of this side keeps a free side.
  const blocked = new Set([...occ, ...cells.map(cellKey)]);
  const free = freeIn(blocked);
  const seeds = buildSlots(castlePlot(side), (c) => !free(c));
  const reach = new Set(floodFree(seeds, Infinity, new Set(), free).map(cellKey));
  const touches = (p: Plot) => buildSlots(p, (c) => !free(c)).some((c) => reach.has(cellKey(c)));
  if (!touches(castlePlot(enemyOf(side)))) return "that would wall off the road";
  if (!MINES.every((m) => mineSlots(m).some((c) => reach.has(cellKey(c))))) return "that would wall off a mine";
  if (!ownBuildings(state, side).every(touches)) return "that would wall in a building";
  return null;
}

/** A spot for a building near the castle, home plateau first, leaving a free
 *  tile around it so lanes stay open; what the AI builds on. */
export function findPlacement(state: MatchState, side: WarSide, kind: BuildingKind): Cell | null {
  const castle = castlePlot(side);
  const { w, h } = FOOTPRINT[kind];
  const occ = occupied(state);
  const candidates: { at: Cell; score: number }[] = [];
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 70; col++) {
      const at = { col, row };
      if (!isWalkable(col, row)) continue;
      const d = plotDistance(castle, at);
      if (d < 2 || d > 12) continue;
      candidates.push({ at, score: d + (isHome(side, at) ? 0 : 20) });
    }
  }
  candidates.sort((x, y) => x.score - y.score || x.at.row - y.at.row || x.at.col - y.at.col);
  for (const { at } of candidates) {
    const ring = plotCells({ col: at.col - 1, row: at.row - 1, w: w + 2, h: h + 2 });
    if (ring.some((c) => occ.has(cellKey(c)) && !MINES.some((m) => m.col === c.col && m.row === c.row))) continue;
    if (canPlace(state, side, kind, at.col, at.row) === null) return at;
  }
  return null;
}

/** Pawns of `side` not already building something. */
export function freeBuilders(state: MatchState, side: WarSide): WarUnit[] {
  return state.units.filter((u) => u.side === side && u.class === "pawn" && u.order.type !== "build");
}

/** The free Pawn nearest the site goes to build it, leaving whatever it was
 *  doing: a Pawn building earns nothing meanwhile. */
function sendBuilder(state: MatchState, side: WarSide, plot: Plot): boolean {
  // By the walk, not the crow's flight: a Pawn below the cliff is far.
  const free = freeIn(occupied(state));
  const slots = new Set(buildSlots(plot, (c) => !free(c)).map(cellKey));
  const walk = (u: WarUnit) => findRoute(u, (c) => slots.has(cellKey(c)), (c) => !free(c))?.length ?? Infinity;
  const pawn = freeBuilders(state, side)
    .map((u) => ({ u, d: walk(u) }))
    .filter((x) => x.d < Infinity)
    .sort((a, b) => a.d - b.d || a.u.id - b.u.id)[0]?.u;
  if (!pawn) return false;
  pawn.order = { type: "build", plot: plot.id };
  return true;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Whether a unit of this class may take this kind of order. */
function allows(cls: UnitClass, order: Order): boolean {
  switch (order.type) {
    case "gather":
      return cls === "pawn";
    case "build":
      return false;
    case "attack":
    case "attackBuilding":
      return cls !== "monk" && cls !== "pawn";
    default:
      return true;
  }
}

/**
 * One action for one side, applied to `state` itself. Checks it against the
 * rules first and returns why not, or null once applied. The simulation calls
 * this on its live world; applyAction wraps it for everyone else.
 */
export function applyInPlace(next: MatchState, side: WarSide, action: Action): string | null {
  if (next.winner !== null) return "the match is over";
  const realtime = next.mode === "realtime";
  const own = (id: string): Building | undefined => {
    const b = next.buildings[id];
    return b && b.side === side ? b : undefined;
  };

  switch (action.type) {
    case "train": {
      const plot = own(action.plot);
      if (!plot) return "not your building";
      const cls = trainsAt(plot);
      if (!cls) return `a ${plot.kind} trains nothing`;
      if (!standing(plot)) return `the ${plot.kind} is not built`;
      const cost = WAR.unitCost[cls];
      if (next.gold[side] < cost) return `a ${cls} costs ${cost} gold`;
      if (supplyUsed(next, side) >= supplyCap(next, side)) return "no supply left; build a house";
      const pawns = next.units.filter((u) => u.side === side && u.class === "pawn").length +
        ownBuildings(next, side).reduce((n, b) => n + b.queue.filter((q) => q.cls === "pawn").length, 0);
      if (cls === "pawn" && pawns >= WAR.pawns.max) return `a side keeps at most ${WAR.pawns.max} Pawns`;
      if (realtime) {
        if (plot.queue.length >= WAR.realtime.queue) return `the ${plot.kind} can queue ${WAR.realtime.queue}`;
        next.gold[side] -= cost;
        plot.queue.push({ cls, left: WAR.realtime.trainSeconds[cls] * BALANCE.tickRate });
        return null;
      }
      const [at] = tilesBeside(next, plot, 1);
      if (!at) return `no room beside the ${plot.kind}`;
      next.gold[side] -= cost;
      addUnit(next, side, cls, at, cls === "pawn" ? pawnOrder(next, side) : { type: "stop" });
      return null;
    }

    case "build": {
      if (action.kind === "castle") return "the castle cannot be rebuilt";
      const cost = WAR.buildCost[action.kind]!;
      if (next.gold[side] < cost) return `a ${action.kind} costs ${cost} gold`;
      const why = canPlace(next, side, action.kind, action.col, action.row);
      if (why) return why;
      const id = `${side}-${action.kind}-${next.nextPlot[side]++}`;
      const plot = newBuilding(side, id, action.kind, { col: action.col, row: action.row }, 0);
      plot.pending = "build";
      next.buildings[id] = plot;
      if (!sendBuilder(next, side, plot)) {
        delete next.buildings[id];
        return "no free Pawn can reach it";
      }
      next.gold[side] -= cost;
      return null;
    }

    case "upgrade": {
      const plot = own(action.plot);
      if (!plot) return "not your building";
      if (!trainsAt(plot) || plot.kind === "castle") return `a ${plot.kind} has no upgrade yet`;
      if (!standing(plot) || plot.pending) return `the ${plot.kind} is not ready`;
      if (plot.level >= WAR.maxLevel) return `the ${plot.kind} is at its highest level`;
      if (next.gold[side] < WAR.upgradeCost) return `an upgrade costs ${WAR.upgradeCost} gold`;
      if (!sendBuilder(next, side, plot)) return "every Pawn is already building";
      next.gold[side] -= WAR.upgradeCost;
      plot.pending = "upgrade";
      plot.progress = 0;
      return null;
    }

    case "cancel": {
      const plot = own(action.plot);
      if (!plot) return "not your building";
      const last = plot.queue.pop();
      if (!last) return "nothing is queued there";
      next.gold[side] += WAR.unitCost[last.cls];
      return null;
    }

    case "rally": {
      const plot = own(action.plot);
      if (!plot) return "not your building";
      const onMine = MINES.some((m) => m.col === action.to.col && m.row === action.to.row);
      if (!onMine && !isOpen(action.to)) return "nobody can stand there";
      plot.rally = { col: action.to.col, row: action.to.row };
      return null;
    }

    case "order": {
      const ids = new Set(action.units);
      const units = next.units.filter((u) => ids.has(u.id));
      if (units.length === 0 || units.length !== ids.size) return "no such units";
      if (units.some((u) => u.side !== side)) return "not your units";
      const order = action.order;
      const bad = units.find((u) => !allows(u.class, order));
      if (bad) return `a ${bad.class} cannot take that order`;
      if (!realtime && units.some((u) => u.order.type === "build")) return "a Pawn that is building stays until the round ends";

      if (order.type === "move" || order.type === "attackMove") {
        if (!freeIn(occupied(next))(order.to)) return "nobody can stand there";
        const spots = spreadAround(next, order.to, units);
        // Nearest unit to the target takes the target tile, and so on out.
        const byDistance = [...units].sort(
          (x, y) => tileDistance(x, order.to) - tileDistance(y, order.to) || x.id - y.id,
        );
        byDistance.forEach((u, i) => {
          u.order = { type: order.type, to: spots[i] ?? order.to };
        });
        return null;
      }
      if (order.type === "attack") {
        const target = next.units.find((u) => u.id === order.unit);
        if (!target || target.side === side) return "not an enemy";
      }
      if (order.type === "attackBuilding") {
        const b = next.buildings[order.plot];
        if (!b || b.side === side || b.hp <= 0) return "not an enemy building";
      }
      if (order.type === "gather") {
        const mine = mineById(order.mine);
        if (!mine) return "no such mine";
        const already = gatherers(next, mine.id, side).filter((u) => !ids.has(u.id)).length;
        if (already + units.length > WAR.pawnsPerMine) return `a mine takes ${WAR.pawnsPerMine} Pawns`;
      }
      for (const u of units) {
        u.order = order;
        if (order.type === "stop") u.post = { col: u.col, row: u.row };
      }
      return null;
    }

    case "stance": {
      const ids = new Set(action.units);
      const units = next.units.filter((u) => ids.has(u.id));
      if (units.length === 0 || units.length !== ids.size) return "no such units";
      if (units.some((u) => u.side !== side)) return "not your units";
      for (const u of units) u.stance = action.stance;
      return null;
    }
  }
}

/** One action for one side. Returns the state after it, or why not, and
 *  never changes the state it was given. */
export function applyAction(state: MatchState, side: WarSide, action: Action): ActionResult {
  const next = structuredClone(state);
  const error = applyInPlace(next, side, action);
  return error === null ? { ok: true, state: next } : fail(error);
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
