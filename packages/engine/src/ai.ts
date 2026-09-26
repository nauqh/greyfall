/**
 * The solo opponent. It plans a round with the same actions a player has and
 * never sees the other side's plan, only the island as it stands. Simple
 * rules on purpose: economy first, an army from its buildings, and it
 * attacks when it is clearly the stronger side.
 */

import { WAR, type UnitClass } from "./balance.ts";
import { STRAT_COLS, castlePlot, isHome, plotDistance, tileDistance, type BuildingKind, type Cell, type WarSide } from "./island.ts";
import type { Sim } from "./battle.ts";
import { makeRng } from "./rng.ts";
import {
  applyAction,
  enemyOf,
  findPlacement,
  freeIn,
  occupied,
  ownBuildings,
  standing,
  maxHp,
  openMine,
  pawnOrder,
  supplyCap,
  supplyUsed,
  type Action,
  type MatchState,
  type Order,
  type Plan,
  type WarUnit,
} from "./war.ts";

/** Where each side's army waits: the plateau lip above its own ramp. */
const RALLY: Record<WarSide, Cell> = { a: { col: 13, row: 13 }, b: { col: STRAT_COLS - 1 - 13, row: 13 } };
/** The ford, beside the rich mine. */
const MID: Cell = { col: 30, row: 28 };

/** How much stronger it must be before it marches on the enemy castle. */
const ATTACK_EDGE = 1.3;
/** It attacks anyway with this many fighters from this round on. */
const LATE = { round: 8, fighters: 6 };
/** It never marches on the enemy before this round, so a new player gets to build. */
const FIRST_ATTACK = 3;

function value(state: MatchState, units: readonly WarUnit[]): number {
  return units.reduce((sum, u) => sum + WAR.unitCost[u.class] * (u.hp / maxHp(state, u.side, u.class)), 0);
}

/** A free tile beside the enemy castle for the army to march on. */
function siegeTile(state: MatchState, side: WarSide): Cell {
  const castle = castlePlot(enemyOf(side));
  const free = freeIn(occupied(state));
  for (let d = 1; d < 5; d++) {
    for (let r = castle.row - d; r <= castle.row + castle.h - 1 + d; r++) {
      for (let c = castle.col - d; c <= castle.col + castle.w - 1 + d; c++) {
        const cell = { col: c, row: r };
        if (plotDistance(castle, cell) === d && free(cell)) return cell;
      }
    }
  }
  return RALLY[enemyOf(side)];
}

export function planAi(state: MatchState, side: WarSide): Plan {
  const rng = makeRng(`${String(state.seed)}:${state.round}:${side}:ai`);
  const plan: Plan = [];
  let cur = state;
  const tryDo = (action: Action): boolean => {
    const r = applyAction(cur, side, action);
    if (!r.ok) return false;
    cur = r.state;
    plan.push(action);
    return true;
  };
  const own = (): WarUnit[] => cur.units.filter((u) => u.side === side);
  const has = (kind: BuildingKind) => ownBuildings(cur, side).some((b) => b.kind === kind);
  const build = (kind: BuildingKind): boolean => {
    const at = findPlacement(cur, side, kind);
    return at !== null && tryDo({ type: "build", kind, col: at.col, row: at.row });
  };

  const homeMine = `mine-${side}`;

  // Supply: a house before the army runs out of room.
  const building = (kind: BuildingKind) => ownBuildings(cur, side).some((b) => b.kind === kind && b.pending === "build");
  if (supplyCap(cur, side) - supplyUsed(cur, side) <= 1 && supplyCap(cur, side) < WAR.supply.max && !building("house")) {
    build("house");
  }

  // Workers before the army, as every RTS opens: one more Pawn a round up
  // to six, then only with gold to spare, while a mine has room for it.
  const pawns = own().filter((u) => u.class === "pawn").length +
    ownBuildings(cur, side).reduce((n, b) => n + b.queue.filter((q) => q.cls === "pawn").length, 0);
  const spare = pawns < 6 ? 0 : 30;
  if (state.round >= 2 && pawns < WAR.pawns.max && openMine(cur, side) && cur.gold[side] >= WAR.unitCost.pawn + spare) {
    tryDo({ type: "train", plot: `${side}-castle` });
  }

  // Buildings, in an order the seed shuffles a little.
  const wanted: BuildingKind[] = rng.next() < 0.5 ? ["archery", "tower"] : ["tower", "archery"];
  if (state.round >= 4) wanted.push("monastery");
  const next = wanted.find((kind) => !has(kind));
  if (next) build(next);

  // Army: fill every standing production building, weighted toward a mix.
  const weights: Partial<Record<UnitClass, number>> = { warrior: 3, archer: 3, lancer: 3, monk: 1 };
  const producers = () => ownBuildings(cur, side).filter((b) => b.kind !== "castle" && WAR.trains[b.kind] && standing(b));
  for (let guard = 0; guard < 12; guard++) {
    const open = producers().filter((b) => cur.gold[side] >= WAR.unitCost[WAR.trains[b.kind]!]);
    if (open.length === 0 || supplyUsed(cur, side) >= supplyCap(cur, side)) break;
    const pick = rng.weighted(open.map((b) => ({ item: b, weight: weights[WAR.trains[b.kind]!] ?? 1 })));
    if (!tryDo({ type: "train", plot: pick.id })) break;
  }

  // Spare gold with a full army goes into upgrades.
  if (supplyUsed(cur, side) >= supplyCap(cur, side)) {
    for (const b of producers()) {
      if (cur.gold[side] < WAR.upgradeCost + 40) break;
      tryDo({ type: "upgrade", plot: b.id });
    }
  }

  // Orders.
  const fighters = own().filter((u) => u.class !== "pawn");
  const enemies = cur.units.filter((u) => u.side !== side && u.class !== "pawn");
  for (const u of own().filter((p) => p.class === "pawn" && p.order.type === "stop")) {
    const order = pawnOrder(cur, side);
    if (order.type === "gather") tryDo({ type: "order", units: [u.id], order });
  }

  const intruders = cur.units.filter((u) => u.side !== side && isHome(side, u));
  const ourValue = value(cur, fighters);
  const theirValue = value(cur, enemies);

  let goal: { order: "attackMove" | "hold"; to: Cell } | null;
  if (intruders.length > 0) {
    const near = [...intruders].sort((x, y) => tileDistance(x, RALLY[side]) - tileDistance(y, RALLY[side]))[0]!;
    goal = { order: "attackMove", to: { col: near.col, row: near.row } };
  } else if (
    state.round >= FIRST_ATTACK &&
    fighters.length >= 4 &&
    (ourValue >= theirValue * ATTACK_EDGE || (state.round >= LATE.round && fighters.length >= LATE.fighters))
  ) {
    goal = { order: "attackMove", to: siegeTile(cur, side) };
  } else if (state.round >= 5 && ourValue >= theirValue && (cur.mines[homeMine] ?? 0) < 200) {
    goal = { order: "attackMove", to: MID };
  } else {
    goal = { order: "hold", to: RALLY[side] };
  }

  const heading = (u: WarUnit): Cell | null =>
    u.order.type === "attackMove" || u.order.type === "move" ? u.order.to : null;
  const target = freeIn(occupied(cur))(goal.to) ? goal.to : RALLY[side];
  // Only units not already on their way there get a new order, so the plan stays short.
  const movers = fighters.filter((u) => {
    const h = heading(u);
    const there = (u.order.type === "stop" || u.order.type === "hold") && tileDistance(u, target) <= 2;
    return !(h && tileDistance(h, target) <= 2) && !there;
  });
  if (goal.order === "hold") {
    if (movers.length > 0) tryDo({ type: "order", units: movers.map((u) => u.id), order: { type: "attackMove", to: target } });
    // Archers already at the rally hold the high ground there.
    const settled = fighters.filter((u) => u.class === "archer" && u.order.type === "stop" && tileDistance(u, target) <= 2);
    if (settled.length > 0) tryDo({ type: "order", units: settled.map((u) => u.id), order: { type: "hold" } });
  } else if (movers.length > 0) {
    tryDo({ type: "order", units: movers.map((u) => u.id), order: { type: "attackMove", to: target } as Order });
  }

  // The front line falls back when wounded; archers and Monks stay put.
  const front = fighters.filter((u) => (u.class === "warrior" || u.class === "lancer") && u.stance !== "fallBack");
  if (front.length > 0) tryDo({ type: "stance", units: front.map((u) => u.id), stance: "fallBack" });

  return plan;
}


/** Real time: how often the AI looks at the island and plans again. */
export const AI_EVERY_TICKS = 50;

/** Real time: plan on what the island looks like now and issue the plan
 *  into the running simulation. An action the world has moved past since
 *  the plan was made is dropped. */
export function runAi(sim: Sim, side: WarSide): void {
  for (const action of planAi(sim.snapshot(), side)) sim.issue(side, action);
}
