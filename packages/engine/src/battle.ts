/**
 * The battle half of a round. Both plans are applied, then the island runs
 * at 10 ticks a second until the fighting settles or the cap, then the
 * aftermath: buildings finish, units at home heal, the Greying bites, and
 * the next round's income is paid. Pure and seeded, so the same state and
 * plans always give the same round.
 */

import { BALANCE, TICKS_PER_ACTION, WAR, damageAgainst, type UnitClass } from "./balance.ts";
import {
  PLOTS,
  canStep,
  cellKey,
  findRoute,
  isHome,
  isOpen,
  isSlope,
  level,
  buildSlots,
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
  applyPlan,
  healOf,
  maxHp,
  mineById,
  payIncome,
  pawnOrder,
  plotById,
  rangeOf,
  restorePawns,
  type MatchState,
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
  | { t: number; type: "destroyed"; plot: string };

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

interface Sim extends WarUnit {
  nextAt: number;
  /** Where an attack move left its path, so the chase is measured from there. */
  anchor: Cell;
  fellBack: boolean;
  /** The last tick it moved or struck. A unit that has done neither for the
   *  settle time is stuck, and stops holding the battle open. */
  lastProgress: number;
  dead: boolean;
}

type Hit = { by: Sim; unit?: Sim; plot?: Plot; amount: number };

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

function atBuildSlot(plot: Plot, c: Cell): boolean {
  return buildSlots(plot).some((s) => sameCell(s, c));
}

function standing(state: MatchState, plot: Plot): boolean {
  const b = state.buildings[plot.id]!;
  return b.level > 0 && b.pending !== "build" && b.hp > 0;
}

export function battle(state: MatchState, planA: Plan, planB: Plan): BattleOutcome {
  if (state.winner !== null) throw new Error("the match is over");
  const start = applyPlan(applyPlan(state, "a", planA), "b", planB);
  const world = structuredClone(start);
  const rng = makeRng(`${String(state.seed)}:${state.round}`);

  const units: Sim[] = world.units
    .map((u) => ({
      ...u,
      nextAt: rng.int(TICKS_PER_ACTION),
      anchor: { col: u.col, row: u.row },
      fellBack: false,
      lastProgress: 0,
      dead: false,
    }))
    .sort((x, y) => x.id - y.id);
  const events: WarEvent[] = [];
  const report: RoundReport = {
    round: state.round,
    seconds: 0,
    settled: true,
    losses: { a: [], b: [] },
    fellBack: [],
    destroyed: [],
    built: [],
    upgraded: [],
    greying: 0,
  };

  // Friends pass through each other while walking, so a tile can briefly
  // hold two; nobody stops on a tile someone else stands on.
  const crowd = new Map<number, Sim[]>();
  const enter = (u: Sim): void => {
    const k = cellKey(u);
    crowd.set(k, [...(crowd.get(k) ?? []), u]);
  };
  const leave = (u: Sim): void => {
    const k = cellKey(u);
    const rest = (crowd.get(k) ?? []).filter((o) => o !== u);
    if (rest.length > 0) crowd.set(k, rest);
    else crowd.delete(k);
  };
  for (const u of units) enter(u);
  const on = (c: Cell): Sim[] => crowd.get(cellKey(c)) ?? [];
  const enemyOn = (c: Cell, side: WarSide) => on(c).some((o) => o.side !== side);
  const othersOn = (c: Cell, u: Sim) => on(c).some((o) => o !== u);

  const byId = new Map<number, Sim>(units.map((u) => [u.id, u]));
  const live = (u: Sim | undefined): u is Sim => u !== undefined && !u.dead;

  const place = (u: Sim, to: Cell, t: number): void => {
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
  const stepToward = (u: Sim, goal: (c: Cell) => boolean, t: number): boolean => {
    const free = (c: Cell) => goal(c) && !othersOn(c, u);
    const route =
      findRoute(u, free, (c) => !isOpen(c) || enemyOn(c, u.side)) ?? findRoute(u, free, (c) => !isOpen(c));
    const step = route?.[0];
    if (!step || enemyOn(step, u.side)) return false;
    place(u, step, t);
    return true;
  };

  /** The tile an order walks to, or a free one beside it when a friend
   *  already stands there. */
  const arrivalGoal = (to: Cell) => (c: Cell) => sameCell(c, to) || (tileDistance(c, to) <= 1 && on(to).length > 0);
  const arrived = (u: Sim, to: Cell): boolean => !othersOn(u, u) && arrivalGoal(to)(u);

  /** Whether this unit still has somewhere it means to be, and is getting there. */
  const busy = (u: Sim, t: number): boolean => {
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
        const p = plotById(o.plot);
        return p !== undefined && standing(world, p);
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
        const p = plotById(o.plot);
        return p !== undefined && !atBuildSlot(p, u);
      }
    }
  };

  /** Walk the unit's order when there is nothing to fight. */
  const walkOrder = (u: Sim, t: number): boolean => {
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
        const moved = stepToward(u, arrivalGoal(o.to), t);
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
        return stepToward(u, (c) => sameCell(c, u.post) || tileDistance(c, u.post) <= 1, t);
      case "hold":
        // A hold never corks a ramp or shares a tile: step off first.
        if (!isSlope(u.col, u.row) && !othersOn(u, u)) return false;
        return stepToward(u, (c) => !isSlope(c.col, c.row), t);
      case "gather": {
        const mine = mineById(o.mine);
        if (!mine || (tileDistance(u, mine) <= 1 && !othersOn(u, u))) return false;
        const slots = new Set(mineSlots(mine).map(cellKey));
        return stepToward(u, (c) => slots.has(cellKey(c)), t);
      }
      case "attack":
      case "attackBuilding":
        u.order = { type: "stop" };
        u.post = { col: u.col, row: u.row };
        return false;
      case "build": {
        // Beside the plot, hammering, until the round ends; in front of the
        // art rather than behind it when a front tile is free.
        const p = plotById(o.plot);
        if (!p) return false;
        const slot = (c: Cell) => atBuildSlot(p, c);
        const front = (c: Cell) => slot(c) && c.row >= p.row + p.h;
        if (front(u) && !othersOn(u, u)) return false;
        if (stepToward(u, front, t)) return true;
        if (slot(u) && !othersOn(u, u)) return false;
        return stepToward(u, slot, t);
      }
    }
  };

  const enemyUnits = (u: Sim) => units.filter((o) => live(o) && o.side !== u.side);
  const enemyPlots = (u: Sim) => PLOTS.filter((p) => p.side !== u.side && standing(world, p));

  const damageTo = (by: Sim, target: Sim): number => {
    const raw = damageAgainst(by.class, target.class);
    const uphill = level(by.col, by.row) < level(target.col, target.row);
    return Math.round(raw * (uphill ? WAR.highGround : 1));
  };

  /** Who a fighter may take on under its order, units before buildings. */
  const targetsFor = (u: Sim): { units: Sim[]; plots: Plot[] } => {
    const range = rangeOf(world, u.side, u.class);
    const o = u.order;
    // Pawns dig and walk; they never strike, only get struck.
    if (u.class === "pawn" || o.type === "move" || o.type === "gather") return { units: [], plots: [] };
    if (o.type === "attack") {
      const target = byId.get(o.unit);
      return { units: live(target) ? [target] : [], plots: [] };
    }
    if (o.type === "attackBuilding") {
      const p = plotById(o.plot);
      return { units: [], plots: p && standing(world, p) ? [p] : [] };
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

  let lastFight = 0;
  let ticks = 0;
  let settled = false;

  for (let t = 0; t < CAP_TICKS; t++) {
    ticks = t + 1;
    const hits: Hit[] = [];
    const heals: { by: Sim; unit: Sim; amount: number }[] = [];

    for (const u of units) {
      if (u.dead || t < u.nextAt) continue;
      const act = (): void => {
        u.nextAt = t + TICKS_PER_ACTION;
      };
      const strike = (): void => {
        u.lastProgress = t;
        act();
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
        if (!home && stepToward(u, (c) => isHome(u.side, c), t)) act();
        else wait();
        continue;
      }

      const range = rangeOf(world, u.side, u.class);
      const heal = healOf(world, u.side, u.class);

      if (heal > 0) {
        const hurt = units
          .filter((o) => live(o) && o.side === u.side && o.hp < maxHp(world, o.side, o.class))
          .map((o) => ({ o, missing: maxHp(world, o.side, o.class) - o.hp }));
        const inReach = hurt
          .filter(({ o }) => reaches(u, o, range))
          .sort((x, y) => y.missing - x.missing || x.o.id - y.o.id)[0];
        if (inReach) {
          heals.push({ by: u, unit: inReach.o, amount: Math.min(heal, inReach.missing) });
          strike();
          continue;
        }
        // A guarding Monk goes to the wounded near its post, as a fighter would to an enemy.
        const o = u.order;
        if (o.type === "stop" || o.type === "attackMove") {
          const from = o.type === "stop" ? u.post : u.anchor;
          const near = hurt
            .filter(({ o: a }) => tileDistance(from, a) <= WAR.chase + range)
            .sort((x, y) => tileDistance(u, x.o) - tileDistance(u, y.o) || x.o.id - y.o.id)[0];
          if (near && stepToward(u, (c) => reaches(c, near.o, range), t)) {
            act();
            continue;
          }
        }
        if (walkOrder(u, t)) act();
        else wait();
        continue;
      }

      // Units before buildings, nearest first. Strike the first in reach;
      // otherwise walk toward the first there is a way to, falling down the
      // list so a target whose every side is taken does not freeze the unit.
      const { units: foes, plots } = targetsFor(u);
      const ranked: ({ unit: Sim } | { plot: Plot })[] = [
        ...[...foes]
          .sort((x, y) => tileDistance(u, x) - tileDistance(u, y) || x.hp - y.hp || x.id - y.id)
          .map((unit) => ({ unit })),
        ...[...plots]
          .sort((x, y) => plotDistance(x, u) - plotDistance(y, u) || x.id.localeCompare(y.id))
          .map((plot) => ({ plot })),
      ];
      const inReach = (c: Cell, r: (typeof ranked)[number]) =>
        "unit" in r ? reaches(c, r.unit, range) : reachesPlot(c, r.plot, range);
      const first = ranked[0];
      if (first && inReach(u, first)) {
        if ("unit" in first) hits.push({ by: u, unit: first.unit, amount: damageTo(u, first.unit) });
        else hits.push({ by: u, plot: first.plot, amount: Math.round(BALANCE.units[u.class].damage * WAR.buildingDamage) });
        strike();
        continue;
      }
      const hittable = ranked.find((r) => inReach(u, r));
      if (hittable && ranked.slice(0, ranked.indexOf(hittable)).every((r) => !stepToward(u, (c) => inReach(c, r), t))) {
        if ("unit" in hittable) hits.push({ by: u, unit: hittable.unit, amount: damageTo(u, hittable.unit) });
        else hits.push({ by: u, plot: hittable.plot, amount: Math.round(BALANCE.units[u.class].damage * WAR.buildingDamage) });
        strike();
        continue;
      }
      if (hittable) {
        // It stepped toward a nearer target instead.
        act();
        continue;
      }
      if (ranked.some((r) => stepToward(u, (c) => inReach(c, r), t))) {
        act();
        continue;
      }
      if (walkOrder(u, t)) act();
      else wait();
    }

    // Every hit and heal of a tick lands together, so two units that kill
    // each other both connect and the order of the loop grants nothing.
    for (const h of hits) {
      if (h.unit) h.unit.hp -= h.amount;
      if (h.plot) world.buildings[h.plot.id]!.hp -= h.amount;
    }
    for (const h of heals) h.unit.hp += h.amount;
    for (const h of hits) {
      if (h.unit) {
        events.push({ t, type: "attack", unit: h.by.id, target: h.unit.id, damage: h.amount, hpAfter: Math.max(0, h.unit.hp) });
      } else if (h.plot) {
        const hp = Math.max(0, world.buildings[h.plot.id]!.hp);
        events.push({ t, type: "hitBuilding", unit: h.by.id, plot: h.plot.id, damage: h.amount, hpAfter: hp });
      }
    }
    for (const h of heals) {
      h.unit.hp = Math.min(maxHp(world, h.unit.side, h.unit.class), h.unit.hp);
      events.push({ t, type: "heal", unit: h.by.id, target: h.unit.id, amount: h.amount, hpAfter: h.unit.hp });
    }
    if (hits.length > 0 || heals.length > 0) lastFight = t;

    for (const u of units) {
      if (u.dead || u.hp > 0) continue;
      u.dead = true;
      leave(u);
      report.losses[u.side].push(u.class);
      events.push({ t, type: "death", unit: u.id });
    }
    for (const p of PLOTS) {
      const b = world.buildings[p.id]!;
      if (b.level > 0 && b.pending !== "build" && b.hp <= 0) {
        b.hp = 0;
        b.level = 0;
        b.pending = null;
        report.destroyed.push(p.id);
        events.push({ t, type: "destroyed", plot: p.id });
      }
    }

    const fallen = SIDES.filter((s) => world.buildings[`${s}-castle`]!.level === 0);
    if (fallen.length > 0) {
      world.winner = fallen.length === 2 ? "draw" : fallen[0] === "a" ? "b" : "a";
      settled = true;
      break;
    }
    if (t - lastFight >= SETTLE_TICKS && !units.some((u) => !u.dead && busy(u, t))) {
      settled = true;
      break;
    }
  }

  report.seconds = ticks / BALANCE.tickRate;
  report.settled = settled;

  // Back to plain units: the battle's own bookkeeping ends with it.
  world.units = units
    .filter((u) => !u.dead)
    .map(({ id, side, class: cls, hp, col, row, order, stance, post }) => ({
      id,
      side,
      class: cls,
      hp,
      col,
      row,
      order,
      stance,
      post,
    }));

  const end = world.winner === null ? aftermath(world, report) : world;
  return { start, end, events, ticks, report };
}

/** Buildings finish, units at home heal, the Greying bites, income arrives. */
function aftermath(world: MatchState, report: RoundReport): MatchState {
  for (const p of PLOTS) {
    const b = world.buildings[p.id]!;
    if (b.pending === "build") {
      b.level = 1;
      b.hp = p.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other;
      report.built.push(p.id);
    } else if (b.pending === "upgrade" && b.level > 0) {
      const cls = WAR.trains[p.kind];
      const before = cls ? maxHp(world, p.side, cls) : 0;
      b.level += 1;
      if (cls) {
        const gain = maxHp(world, p.side, cls) - before;
        for (const u of world.units) if (u.side === p.side && u.class === cls) u.hp += gain;
      }
      report.upgraded.push(p.id);
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
    if (u.order.type === "build" && !next.buildings[u.order.plot]!.pending) u.order = pawnOrder(next, u.side);
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
