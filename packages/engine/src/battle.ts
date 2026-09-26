/**
 * The island in motion. createSim advances the world one tick at a time, at
 * 10 ticks a second, and takes actions between ticks. Rounds run it for one
 * battle phase (battle()): until the fighting settles or the cap, then the
 * aftermath: buildings finish, units at home heal, the Greying bites, and the
 * next round's income is paid. Real time runs it without end, and the
 * economy, training, building and the Greying all happen tick by tick.
 * Pure and seeded, so the same state and actions always give the same match.
 */

import { BALANCE, TICKS_PER_ACTION, WAR, damageAgainst, type UnitClass } from "./balance.ts";
import {
  MINES,
  buildSlots,
  canStep,
  castlePlot,
  cellKey,
  findRoute,
  isHome,
  isOpen,
  isSlope,
  level,
  mineSlots,
  plotCells,
  plotDistance,
  sameCell,
  tileDistance,
  type Cell,
  type Plot,
  type WarSide,
} from "./island.ts";
import { makeRng } from "./rng.ts";
import {
  SIDES,
  addUnit,
  applyInPlace,
  applyPlan,
  buildingHp,
  gatherers,
  healOf,
  maxHp,
  mineById,
  occupied,
  ownBuildings,
  payIncome,
  pawnOrder,
  rangeOf,
  restorePawns,
  standing,
  tilesBeside,
  trainsAt,
  upkeepOf,
  type Action,
  type Building,
  type MatchState,
  type Order,
  type Plan,
  type WarUnit,
} from "./war.ts";

export type WarEvent =
  | { t: number; type: "move"; unit: number; col: number; row: number }
  | { t: number; type: "attack"; unit: number; target: number; damage: number; hpAfter: number }
  | { t: number; type: "hitBuilding"; unit: number; plot: string; damage: number; hpAfter: number }
  | { t: number; type: "heal"; unit: number; target: number; amount: number; hpAfter: number }
  | { t: number; type: "fallBack"; unit: number; hp: number }
  | { t: number; type: "death"; unit: number }
  | { t: number; type: "destroyed"; plot: string }
  // Real time only.
  | { t: number; type: "spawn"; unit: number }
  | { t: number; type: "built"; plot: string }
  | { t: number; type: "upgraded"; plot: string }
  | { t: number; type: "deliver"; unit: number; side: WarSide; gold: number }
  | { t: number; type: "greying"; hp: number };

export interface RoundReport {
  round: number;
  seconds: number;
  /** False when the cap cut a fight off; it carries on next round. */
  settled: boolean;
  losses: Record<WarSide, UnitClass[]>;
  fellBack: { side: WarSide; class: UnitClass; hpPercent: number }[];
  destroyed: string[];
  built: string[];
  upgraded: string[];
  /** HP the Greying took from each main hall this round. */
  greying: number;
}

export interface BattleOutcome {
  /** The island as the battle opens: both plans applied. Playback starts here. */
  start: MatchState;
  /** The next round, income paid, or the finished match. */
  end: MatchState;
  events: WarEvent[];
  ticks: number;
  report: RoundReport;
}

interface SimUnit extends WarUnit {
  nextAt: number;
  /** Where an attack move left its path, so the chase is measured from there. */
  anchor: Cell;
  fellBack: boolean;
  /** The last tick it moved or struck. A unit that has done neither for the
   *  settle time is stuck, and stops holding the battle open. */
  lastProgress: number;
  dead: boolean;
  /** Real time: seconds a Pawn has dug toward its next bag. */
  dig: number;
}

type Hit = { by: SimUnit; unit?: SimUnit; plot?: Building; amount: number };

export interface Sim {
  /** The live world. Its units carry the simulation's own bookkeeping; use
   *  snapshot() for a plain copy. */
  readonly world: MatchState;
  /** Ticks run so far. */
  readonly t: number;
  /** Everything that happened, in order; the caller may empty it. */
  events: WarEvent[];
  report: RoundReport;
  step(): void;
  /** Apply one side's action between ticks; why not, or null. A round's
   *  battle takes orders and stances only. */
  issue(side: WarSide, action: Action): string | null;
  /** Rounds: quiet for the settle time, with nobody still on the way. */
  settled(): boolean;
  snapshot(): MatchState;
}

const SETTLE_TICKS = WAR.settleSeconds * BALANCE.tickRate;
const CAP_TICKS = WAR.capSeconds * BALANCE.tickRate;
/** A blocked unit looks again this often rather than every tick. */
const RETRY_TICKS = TICKS_PER_ACTION / 2;

/** In reach: ranged units shoot up and down cliffs, melee only strikes on its
 *  own level or along a ramp, never across a cliff's side. */
function reaches(from: Cell, to: Cell, range: number): boolean {
  const d = tileDistance(from, to);
  if (d > range) return false;
  return range > 1 || level(from.col, from.row) === level(to.col, to.row) || canStep(from, to);
}

function reachesPlot(from: Cell, plot: Plot, range: number): boolean {
  if (range > 1) return plotDistance(plot, from) <= range;
  return plotCells(plot).some((c) => reaches(from, c, range));
}

function plain(u: WarUnit): WarUnit {
  const out: WarUnit = { id: u.id, side: u.side, class: u.class, hp: u.hp, col: u.col, row: u.row, order: u.order, stance: u.stance, post: u.post };
  if (u.carry) out.carry = u.carry;
  return structuredClone(out);
}

export function createSim(start: MatchState): Sim {
  const world = structuredClone(start);
  const realtime = world.mode === "realtime";
  const rng = makeRng(realtime ? `${String(world.seed)}:rt` : `${String(world.seed)}:${world.round}`);
  let t = 0;
  let lastFight = 0;
  let quiet = false;
  const events: WarEvent[] = [];
  const report: RoundReport = {
    round: world.round,
    seconds: 0,
    settled: true,
    losses: { a: [], b: [] },
    fellBack: [],
    destroyed: [],
    built: [],
    upgraded: [],
    greying: 0,
  };

  let occ = occupied(world);
  const free = (c: Cell): boolean => isOpen(c) && !occ.has(cellKey(c));

  // Friends pass through each other while walking, so a tile can briefly
  // hold two; nobody stops on a tile someone else stands on.
  const crowd = new Map<number, SimUnit[]>();
  const enter = (u: SimUnit): void => {
    const k = cellKey(u);
    crowd.set(k, [...(crowd.get(k) ?? []), u]);
  };
  const leave = (u: SimUnit): void => {
    const k = cellKey(u);
    const rest = (crowd.get(k) ?? []).filter((o) => o !== u);
    if (rest.length > 0) crowd.set(k, rest);
    else crowd.delete(k);
  };
  const on = (c: Cell): SimUnit[] => crowd.get(cellKey(c)) ?? [];
  const enemyOn = (c: Cell, side: WarSide) => on(c).some((o) => o.side !== side);
  const othersOn = (c: Cell, u: SimUnit) => on(c).some((o) => o !== u);

  const byId = new Map<number, SimUnit>();
  const live = (u: SimUnit | undefined): u is SimUnit => u !== undefined && !u.dead;
  const units = (): SimUnit[] => world.units as SimUnit[];

  /** Give a plain unit the simulation's bookkeeping, in place. */
  const adopt = (w: WarUnit): SimUnit => {
    const u = w as SimUnit;
    if (byId.has(u.id)) return u;
    u.nextAt = t + rng.int(TICKS_PER_ACTION);
    u.anchor = { col: u.col, row: u.row };
    u.fellBack = false;
    u.lastProgress = t;
    u.dead = false;
    u.dig = 0;
    byId.set(u.id, u);
    enter(u);
    return u;
  };
  world.units.sort((x, y) => x.id - y.id).forEach(adopt);

  const place = (u: SimUnit, to: Cell): void => {
    leave(u);
    u.col = to.col;
    u.row = to.row;
    enter(u);
    u.lastProgress = t;
    events.push({ t, type: "move", unit: u.id, col: to.col, row: to.row });
  };

  /**
   * One step toward the nearest tile that satisfies `goal` and nobody else
   * stands on. Friends are walked through; enemies block. When enemies wall
   * the way off entirely the unit walks on as if they were not there, so an
   * army meets a held ramp and fights rather than waiting at home. False
   * when no step was taken.
   */
  const stepToward = (u: SimUnit, goal: (c: Cell) => boolean): boolean => {
    const clear = (c: Cell) => goal(c) && !othersOn(c, u);
    const route =
      findRoute(u, clear, (c) => !free(c) || enemyOn(c, u.side)) ?? findRoute(u, clear, (c) => !free(c));
    const step = route?.[0];
    if (!step || enemyOn(step, u.side)) return false;
    place(u, step);
    return true;
  };

  const slotsOf = (p: Plot): Cell[] => buildSlots(p, (c) => !free(c));
  const atBuildSlot = (p: Plot, c: Cell): boolean => slotsOf(p).some((s) => sameCell(s, c));

  /** The tile an order walks to, or a free one beside it when a friend
   *  already stands there. */
  const arrivalGoal = (to: Cell) => (c: Cell) => sameCell(c, to) || (tileDistance(c, to) <= 1 && on(to).length > 0);
  const arrived = (u: SimUnit, to: Cell): boolean => !othersOn(u, u) && arrivalGoal(to)(u);

  /** Whether this unit still has somewhere it means to be, and is getting there. */
  const busy = (u: SimUnit): boolean => {
    if (t - u.lastProgress >= SETTLE_TICKS) return false;
    if (othersOn(u, u)) return true;
    if (u.fellBack) return !isHome(u.side, u);
    const o = u.order;
    switch (o.type) {
      case "move":
      case "attackMove":
        return !arrived(u, o.to);
      case "attack":
        return live(byId.get(o.unit));
      case "attackBuilding": {
        const b = world.buildings[o.plot];
        return b !== undefined && standing(b);
      }
      case "stop":
        return !sameCell(u, u.post);
      case "gather": {
        const mine = mineById(o.mine);
        return mine !== undefined && tileDistance(u, mine) > 1;
      }
      case "hold":
        return false;
      case "build": {
        const b = world.buildings[o.plot];
        return b !== undefined && !atBuildSlot(b, u);
      }
    }
  };

  /** Real time: a Pawn's round trip, mine to castle and back. */
  const gatherTrip = (u: SimUnit, mineId: string): boolean => {
    const castle = castlePlot(u.side);
    if (u.carry) {
      if (plotDistance(castle, u) <= 1) {
        const gold = Math.round(u.carry * upkeepOf(world, u.side).keep);
        world.gold[u.side] += gold;
        events.push({ t, type: "deliver", unit: u.id, side: u.side, gold });
        u.carry = 0;
        return true;
      }
      const slots = new Set(slotsOf(castle).map(cellKey));
      return stepToward(u, (c) => slots.has(cellKey(c)));
    }
    const mine = mineById(mineId)!;
    if ((world.mines[mine.id] ?? 0) <= 0) {
      u.order = pawnOrder(world, u.side);
      return false;
    }
    if (tileDistance(u, mine) <= 1 && !othersOn(u, u)) {
      u.dig += 1;
      if (u.dig >= WAR.realtime.digSeconds) {
        const take = Math.min(WAR.realtime.carry, world.mines[mine.id]!);
        world.mines[mine.id] = world.mines[mine.id]! - take;
        u.carry = take;
        u.dig = 0;
      }
      return true;
    }
    const slots = new Set(mineSlots(mine).map(cellKey));
    return stepToward(u, (c) => slots.has(cellKey(c)));
  };

  /** Walk the unit's order when there is nothing to fight. */
  const walkOrder = (u: SimUnit): boolean => {
    const o = u.order;
    switch (o.type) {
      case "move":
      case "attackMove": {
        if (arrived(u, o.to)) {
          // Arrived: from here it guards the tile it reached.
          u.order = { type: "stop" };
          u.post = { col: u.col, row: u.row };
          return false;
        }
        const moved = stepToward(u, arrivalGoal(o.to));
        if (moved) u.anchor = { col: u.col, row: u.row };
        return moved;
      }
      case "stop":
        if (sameCell(u, u.post) && !othersOn(u, u)) return false;
        if (othersOn(u.post, u) && tileDistance(u, u.post) <= 1 && !othersOn(u, u)) {
          // Someone took its post; this tile will do.
          u.post = { col: u.col, row: u.row };
          return false;
        }
        return stepToward(u, (c) => sameCell(c, u.post) || tileDistance(c, u.post) <= 1);
      case "hold":
        // A hold never corks a ramp or shares a tile: step off first.
        if (!isSlope(u.col, u.row) && !othersOn(u, u)) return false;
        return stepToward(u, (c) => !isSlope(c.col, c.row));
      case "gather": {
        if (realtime) return gatherTrip(u, o.mine);
        const mine = mineById(o.mine);
        if (!mine || (tileDistance(u, mine) <= 1 && !othersOn(u, u))) return false;
        const slots = new Set(mineSlots(mine).map(cellKey));
        return stepToward(u, (c) => slots.has(cellKey(c)));
      }
      case "attack":
      case "attackBuilding":
        u.order = { type: "stop" };
        u.post = { col: u.col, row: u.row };
        return false;
      case "build": {
        // Beside the site, hammering; in front of the art rather than
        // behind it when a front tile is free.
        const p = world.buildings[o.plot];
        if (!p || !p.pending) {
          if (realtime) u.order = pawnOrder(world, u.side);
          return false;
        }
        const slot = (c: Cell) => atBuildSlot(p, c);
        const front = (c: Cell) => slot(c) && c.row >= p.row + p.h;
        if (front(u) && !othersOn(u, u)) return false;
        if (stepToward(u, front)) return true;
        if (slot(u) && !othersOn(u, u)) return false;
        return stepToward(u, slot);
      }
    }
  };

  const enemyUnits = (u: SimUnit) => units().filter((o) => live(o) && o.side !== u.side);
  const enemyPlots = (u: SimUnit) => Object.values(world.buildings).filter((p) => p.side !== u.side && standing(p));

  const damageTo = (by: SimUnit, target: SimUnit): number => {
    const raw = damageAgainst(by.class, target.class);
    const uphill = level(by.col, by.row) < level(target.col, target.row);
    return Math.round(raw * (uphill ? WAR.highGround : 1));
  };

  /** Who a fighter may take on under its order, units before buildings. */
  const targetsFor = (u: SimUnit): { units: SimUnit[]; plots: Building[] } => {
    const range = rangeOf(world, u.side, u.class);
    const o = u.order;
    // Pawns dig and walk; they never strike, only get struck.
    if (u.class === "pawn" || o.type === "move" || o.type === "gather") return { units: [], plots: [] };
    if (o.type === "attack") {
      const target = byId.get(o.unit);
      return { units: live(target) ? [target] : [], plots: [] };
    }
    if (o.type === "attackBuilding") {
      const p = world.buildings[o.plot];
      return { units: [], plots: p && standing(p) ? [p] : [] };
    }
    const from = o.type === "hold" ? (u as Cell) : o.type === "stop" ? u.post : u.anchor;
    const reach = o.type === "hold" ? range : WAR.chase + range;
    return {
      units: enemyUnits(u).filter((e) => tileDistance(from, e) <= reach),
      // On the march only troops stop it; a building beside the road would
      // hold an army there while the enemy's army walks on. Buildings are
      // struck once it arrives, or when it is sent at one.
      plots: o.type === "attackMove" ? [] : enemyPlots(u).filter((p) => plotDistance(p, from) <= reach),
    };
  };

  /** One unit's turn: fall back, heal, strike or walk. */
  const act = (u: SimUnit, hits: Hit[], heals: { by: SimUnit; unit: SimUnit; amount: number }[]): void => {
    const done = (): void => {
      u.nextAt = t + TICKS_PER_ACTION;
    };
    const strike = (): void => {
      u.lastProgress = t;
      done();
    };
    const wait = (): void => {
      u.nextAt = t + RETRY_TICKS;
    };

    if (u.stance === "fallBack" && !u.fellBack && u.hp < maxHp(world, u.side, u.class) * WAR.fallBackBelow) {
      u.fellBack = true;
      events.push({ t, type: "fallBack", unit: u.id, hp: u.hp });
      report.fellBack.push({
        side: u.side,
        class: u.class,
        hpPercent: Math.round((100 * u.hp) / maxHp(world, u.side, u.class)),
      });
    }
    if (u.fellBack) {
      const home = isHome(u.side, u) && !othersOn(u, u);
      if (!home && stepToward(u, (c) => isHome(u.side, c))) done();
      else if (home && realtime) u.fellBack = false;
      else wait();
      return;
    }

    const range = rangeOf(world, u.side, u.class);
    const heal = healOf(world, u.side, u.class);

    if (heal > 0) {
      const hurt = units()
        .filter((o) => live(o) && o.side === u.side && o.hp < maxHp(world, o.side, o.class))
        .map((o) => ({ o, missing: maxHp(world, o.side, o.class) - o.hp }));
      const inReach = hurt
        .filter(({ o }) => reaches(u, o, range))
        .sort((x, y) => y.missing - x.missing || x.o.id - y.o.id)[0];
      if (inReach) {
        heals.push({ by: u, unit: inReach.o, amount: Math.min(heal, inReach.missing) });
        strike();
        return;
      }
      // A guarding Monk goes to the wounded near its post, as a fighter would to an enemy.
      const o = u.order;
      if (o.type === "stop" || o.type === "attackMove") {
        const from = o.type === "stop" ? u.post : u.anchor;
        const near = hurt
          .filter(({ o: a }) => tileDistance(from, a) <= WAR.chase + range)
          .sort((x, y) => tileDistance(u, x.o) - tileDistance(u, y.o) || x.o.id - y.o.id)[0];
        if (near && stepToward(u, (c) => reaches(c, near.o, range))) {
          done();
          return;
        }
      }
      if (walkOrder(u)) done();
      else wait();
      return;
    }

    // Units before buildings, nearest first. Strike the first in reach;
    // otherwise walk toward the first there is a way to, falling down the
    // list so a target whose every side is taken does not freeze the unit.
    const { units: foes, plots } = targetsFor(u);
    const ranked: ({ unit: SimUnit } | { plot: Building })[] = [
      ...[...foes]
        .sort((x, y) => tileDistance(u, x) - tileDistance(u, y) || x.hp - y.hp || x.id - y.id)
        .map((unit) => ({ unit })),
      ...[...plots]
        .sort((x, y) => plotDistance(x, u) - plotDistance(y, u) || x.id.localeCompare(y.id))
        .map((plot) => ({ plot })),
    ];
    const inReach = (c: Cell, r: (typeof ranked)[number]) =>
      "unit" in r ? reaches(c, r.unit, range) : reachesPlot(c, r.plot, range);
    const hit = (r: (typeof ranked)[number]): void => {
      if ("unit" in r) hits.push({ by: u, unit: r.unit, amount: damageTo(u, r.unit) });
      else hits.push({ by: u, plot: r.plot, amount: Math.round(BALANCE.units[u.class].damage * WAR.buildingDamage) });
      strike();
    };
    const first = ranked[0];
    if (first && inReach(u, first)) return hit(first);
    const hittable = ranked.find((r) => inReach(u, r));
    if (hittable && ranked.slice(0, ranked.indexOf(hittable)).every((r) => !stepToward(u, (c) => inReach(c, r)))) {
      return hit(hittable);
    }
    if (hittable) {
      // It stepped toward a nearer target instead.
      done();
      return;
    }
    if (ranked.some((r) => stepToward(u, (c) => inReach(c, r)))) {
      done();
      return;
    }
    if (walkOrder(u)) done();
    else wait();
  };

  const remove = (b: Building): void => {
    report.destroyed.push(b.id);
    events.push({ t, type: "destroyed", plot: b.id });
    if (b.kind === "castle") {
      b.hp = 0;
      b.level = 0;
      b.pending = null;
      b.queue = [];
      return;
    }
    delete world.buildings[b.id];
    occ = occupied(world);
  };

  const checkWinner = (): void => {
    const fallen = SIDES.filter((s) => world.buildings[`${s}-castle`]!.level === 0);
    if (fallen.length > 0) world.winner = fallen.length === 2 ? "draw" : fallen[0] === "a" ? "b" : "a";
  };

  /** A new unit steps out beside its building, headed for the rally point. */
  const orderFor = (b: Building, cls: UnitClass): Order => {
    const rally = b.rally;
    if (cls === "pawn") {
      const mine = rally && MINES.find((m) => sameCell(m, rally));
      if (mine && gatherers(world, mine.id, b.side).length < WAR.pawnsPerMine) return { type: "gather", mine: mine.id };
      return pawnOrder(world, b.side);
    }
    return rally ? { type: "attackMove", to: rally } : { type: "stop" };
  };

  /** Real time: a tick of the economy and the clock. */
  const tickRealtime = (): void => {
    // Construction: a build or upgrade moves on while a Pawn hammers beside it.
    for (const b of Object.values(world.buildings)) {
      if (!b.pending) continue;
      const working = units().some(
        (u) => live(u) && u.side === b.side && u.order.type === "build" && u.order.plot === b.id && atBuildSlot(b, u),
      );
      if (!working) continue;
      b.progress += 1;
      const total = (b.pending === "build" ? WAR.realtime.buildSeconds[b.kind]! : WAR.realtime.upgradeSeconds) * BALANCE.tickRate;
      if (b.progress < total) continue;
      if (b.pending === "build") {
        b.level = 1;
        b.hp = buildingHp(b.kind);
        events.push({ t, type: "built", plot: b.id });
      } else {
        const cls = trainsAt(b);
        const before = cls ? maxHp(world, b.side, cls) : 0;
        b.level += 1;
        if (cls) {
          const gain = maxHp(world, b.side, cls) - before;
          for (const u of units()) if (u.side === b.side && u.class === cls && live(u)) u.hp += gain;
        }
        events.push({ t, type: "upgraded", plot: b.id });
      }
      b.pending = null;
      b.progress = 0;
      for (const u of units()) {
        if (u.order.type === "build" && u.order.plot === b.id) u.order = pawnOrder(world, u.side);
      }
    }

    // Training: the front of each queue counts down, then steps out.
    for (const b of Object.values(world.buildings)) {
      const front = b.queue[0];
      if (!front || !standing(b)) continue;
      if (front.left > 0) front.left -= 1;
      if (front.left > 0) continue;
      const [at] = tilesBeside(world, b, 1);
      if (!at) continue;
      b.queue.shift();
      const u = adopt(addUnit(world, b.side, front.cls, at, { type: "stop" }));
      u.order = orderFor(b, front.cls);
      events.push({ t, type: "spawn", unit: u.id });
    }

    const second = world.tick % BALANCE.tickRate === 0;
    if (second) {
      // Home heals, a little a second.
      for (const u of units()) {
        if (!live(u) || !isHome(u.side, u)) continue;
        const max = maxHp(world, u.side, u.class);
        u.hp = Math.min(max, u.hp + Math.ceil(max * WAR.realtime.homeHeal));
      }
      // A side left with no Pawns gets one.
      for (const side of SIDES) {
        if (units().some((u) => live(u) && u.side === side && u.class === "pawn")) continue;
        if (ownBuildings(world, side).some((b) => b.queue.some((q) => q.cls === "pawn"))) continue;
        const [at] = tilesBeside(world, castlePlot(side), 1);
        if (at) {
          const u = adopt(addUnit(world, side, "pawn", at, { type: "stop" }));
          u.order = pawnOrder(world, side);
          events.push({ t, type: "spawn", unit: u.id });
        }
      }
    }

    // The Greying bites the halls on the clock, harder each time.
    const g = WAR.realtime.greying;
    const from = g.fromSeconds * BALANCE.tickRate;
    const every = g.everySeconds * BALANCE.tickRate;
    if (world.tick >= from && (world.tick - from) % every === 0) {
      const k = (world.tick - from) / every + 1;
      const bite = Math.round(WAR.buildingHp.castle * g.step * k);
      events.push({ t, type: "greying", hp: bite });
      for (const side of SIDES) {
        const hall = world.buildings[`${side}-castle`]!;
        hall.hp -= bite;
        if (hall.hp <= 0 && hall.level > 0) remove(hall);
      }
    }

    world.tick += 1;
    world.round = 1 + Math.floor(world.tick / (WAR.realtime.roundSeconds * BALANCE.tickRate));
  };

  const step = (): void => {
    if (world.winner !== null) return;
    const hits: Hit[] = [];
    const heals: { by: SimUnit; unit: SimUnit; amount: number }[] = [];

    for (const u of [...units()]) {
      if (u.dead || t < u.nextAt) continue;
      act(u, hits, heals);
    }

    // Every hit and heal of a tick lands together, so two units that kill
    // each other both connect and the order of the loop grants nothing.
    for (const h of hits) {
      if (h.unit) h.unit.hp -= h.amount;
      if (h.plot) h.plot.hp -= h.amount;
    }
    for (const h of heals) h.unit.hp += h.amount;
    for (const h of hits) {
      if (h.unit) {
        events.push({ t, type: "attack", unit: h.by.id, target: h.unit.id, damage: h.amount, hpAfter: Math.max(0, h.unit.hp) });
      } else if (h.plot) {
        events.push({ t, type: "hitBuilding", unit: h.by.id, plot: h.plot.id, damage: h.amount, hpAfter: Math.max(0, h.plot.hp) });
      }
    }
    for (const h of heals) {
      h.unit.hp = Math.min(maxHp(world, h.unit.side, h.unit.class), h.unit.hp);
      events.push({ t, type: "heal", unit: h.by.id, target: h.unit.id, amount: h.amount, hpAfter: h.unit.hp });
    }
    if (hits.length > 0 || heals.length > 0) lastFight = t;

    for (const u of [...units()]) {
      if (u.dead || u.hp > 0) continue;
      u.dead = true;
      leave(u);
      world.units.splice(world.units.indexOf(u), 1);
      report.losses[u.side].push(u.class);
      events.push({ t, type: "death", unit: u.id });
    }
    for (const b of Object.values(world.buildings)) {
      if (standing(b) && b.hp <= 0) remove(b);
    }

    if (realtime) tickRealtime();
    checkWinner();
    quiet = world.winner !== null || (t - lastFight >= SETTLE_TICKS && !units().some((u) => !u.dead && busy(u)));
    t += 1;
  };

  const issue = (side: WarSide, action: Action): string | null => {
    if (!realtime && action.type !== "order" && action.type !== "stance") return "only orders and stances during a battle";
    const error = applyInPlace(world, side, action);
    if (error !== null) return error;
    for (const u of world.units) adopt(u);
    if (action.type === "order") {
      for (const id of action.units) {
        const u = byId.get(id);
        if (!u) continue;
        // A fresh order starts its chase from here, and calls a retreat off.
        u.anchor = { col: u.col, row: u.row };
        u.fellBack = false;
        u.nextAt = Math.min(u.nextAt, t);
      }
    }
    occ = occupied(world);
    return null;
  };

  return {
    world,
    get t() {
      return t;
    },
    events,
    report,
    step,
    issue,
    settled: () => quiet,
    snapshot: () => ({ ...structuredClone({ ...world, units: [] }), units: world.units.filter((u) => !(u as SimUnit).dead).map(plain) }),
  };
}

/** Rounds: both plans applied, and the battle phase ready to run. */
export function startRound(state: MatchState, planA: Plan, planB: Plan): { sim: Sim; start: MatchState } {
  if (state.winner !== null) throw new Error("the match is over");
  const start = applyPlan(applyPlan(state, "a", planA), "b", planB);
  return { sim: createSim(start), start };
}

/** Rounds: a hall fell, the fighting settled, or the cap came. */
export function roundDone(sim: Sim): boolean {
  return sim.world.winner !== null || sim.settled() || sim.t >= CAP_TICKS;
}

/** Rounds: close the battle phase into its report and the next round. */
export function finishRound(sim: Sim, start: MatchState): BattleOutcome {
  const report = sim.report;
  report.seconds = sim.t / BALANCE.tickRate;
  report.settled = sim.world.winner !== null || sim.settled();
  const world = sim.snapshot();
  const end = world.winner === null ? aftermath(world, report) : world;
  return { start, end, events: sim.events, ticks: sim.t, report };
}

export function battle(state: MatchState, planA: Plan, planB: Plan): BattleOutcome {
  const { sim, start } = startRound(state, planA, planB);
  do sim.step();
  while (!roundDone(sim));
  return finishRound(sim, start);
}

/** Rounds: buildings finish, units at home heal, the Greying bites, income arrives. */
function aftermath(world: MatchState, report: RoundReport): MatchState {
  for (const b of Object.values(world.buildings)) {
    if (b.pending === "build") {
      b.level = 1;
      b.hp = buildingHp(b.kind);
      report.built.push(b.id);
    } else if (b.pending === "upgrade" && b.level > 0) {
      const cls = trainsAt(b);
      const before = cls ? maxHp(world, b.side, cls) : 0;
      b.level += 1;
      if (cls) {
        const gain = maxHp(world, b.side, cls) - before;
        for (const u of world.units) if (u.side === b.side && u.class === cls) u.hp += gain;
      }
      report.upgraded.push(b.id);
    }
    b.pending = null;
  }

  // A fallen level 2 building takes its bonus HP with it.
  for (const u of world.units) {
    u.hp = isHome(u.side, u) ? maxHp(world, u.side, u.class) : Math.min(u.hp, maxHp(world, u.side, u.class));
  }

  if (world.round >= WAR.greying.fromRound) {
    const share = WAR.greying.step * (world.round - WAR.greying.fromRound + 1);
    report.greying = Math.round(WAR.buildingHp.castle * share);
    for (const side of SIDES) {
      const hall = world.buildings[`${side}-castle`]!;
      hall.hp -= report.greying;
      if (hall.hp <= 0) {
        hall.hp = 0;
        hall.level = 0;
        report.destroyed.push(`${side}-castle`);
      }
    }
    const fallen = SIDES.filter((s) => world.buildings[`${s}-castle`]!.level === 0);
    if (fallen.length > 0) {
      world.winner = fallen.length === 2 ? "draw" : fallen[0] === "a" ? "b" : "a";
      return world;
    }
  }

  world.round += 1;
  const next = payIncome(restorePawns(world));
  // Builders go back to digging, home first, once this round's income is in:
  // a builder that finished beside a mine dug nothing this round.
  for (const u of next.units) {
    if (u.order.type === "build" && !next.buildings[u.order.plot]?.pending) u.order = pawnOrder(next, u.side);
  }
  return next;
}

/** Concede: the other side wins at once. */
export function concede(state: MatchState, side: WarSide): MatchState {
  if (state.winner !== null) return state;
  const next = structuredClone(state);
  next.winner = side === "a" ? "b" : "a";
  return next;
}
