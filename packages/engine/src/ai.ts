/**
 * The solo opponent. It plans a round with the same actions a player has and
 * never sees the other side's plan, only the island as it stands. Simple
 * rules on purpose: economy first, an army from its buildings, and it
 * attacks when it is clearly the stronger side.
 */

import { WAR, type UnitClass } from "./balance.ts";
import { PLOTS, castlePlot, isHome, isOpen, plotDistance, tileDistance, type Cell, type WarSide } from "./island.ts";
import { makeRng } from "./rng.ts";
import {
  applyAction,
  enemyOf,
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
const RALLY: Record<WarSide, Cell> = { a: { col: 6, row: 8 }, b: { col: 34, row: 8 } };
/** The ford, beside the rich mine. */
const MID: Cell = { col: 20, row: 18 };

/** How much stronger it must be before it marches on the enemy castle. */
const ATTACK_EDGE = 1.3;
/** It attacks anyway with this many fighters from this round on. */
const LATE = { round: 8, fighters: 6 };
/** It never marches on the enemy before this round, so a new player gets to build. */
const FIRST_ATTACK = 3;

function value(state: MatchState, units: readonly WarUnit[]): number {
  return units.reduce((sum, u) => sum + WAR.unitCost[u.class] * (u.hp / maxHp(state, u.side, u.class)), 0);
}

/** An open tile beside the enemy castle for the army to march on. */
function siegeTile(side: WarSide): Cell {
  const castle = castlePlot(enemyOf(side));
  for (let d = 1; d < 5; d++) {
    for (let r = castle.row - d; r <= castle.row + castle.h - 1 + d; r++) {
      for (let c = castle.col - d; c <= castle.col + castle.w - 1 + d; c++) {
        const cell = { col: c, row: r };
        if (plotDistance(castle, cell) === d && isOpen(cell)) return cell;
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
  const plotOf = (kind: string, n = "") => PLOTS.find((p) => p.side === side && p.id === `${side}-${kind}${n}`)!;
  const built = (id: string) => cur.buildings[id]!.level > 0 || cur.buildings[id]!.pending === "build";

  const homeMine = `mine-${side}`;

  // Supply: a house before the army runs out of room.
  if (supplyCap(cur, side) - supplyUsed(cur, side) <= 1) {
    for (const n of ["1", "2", "3"]) {
      const id = plotOf("house", n).id;
      if (!built(id) && tryDo({ type: "build", plot: id })) break;
    }
  }

  // One more Pawn a round while a mine has room for it.
  const pawns = own().filter((u) => u.class === "pawn").length;
  if (state.round >= 2 && pawns < WAR.pawns.max && openMine(cur, side) && cur.gold[side] >= WAR.unitCost.pawn + 3) {
    tryDo({ type: "train", plot: `${side}-castle` });
  }

  // Buildings, in an order the seed shuffles a little.
  const wanted = rng.next() < 0.5 ? ["archery", "tower"] : ["tower", "archery"];
  if (state.round >= 4) wanted.push("monastery");
  for (const kind of wanted) {
    const id = plotOf(kind).id;
    if (!built(id)) {
      tryDo({ type: "build", plot: id });
      break;
    }
  }

  // Army: fill every standing production building, weighted toward a mix.
  const weights: Partial<Record<UnitClass, number>> = { warrior: 3, archer: 3, lancer: 3, monk: 1 };
  const producers = PLOTS.filter((p) => p.side === side && p.kind !== "castle" && p.kind !== "house");
  for (let guard = 0; guard < 12; guard++) {
    const open = producers.filter((p) => {
      const cls = WAR.trains[p.kind];
      const b = cur.buildings[p.id]!;
      return (
        cls &&
        b.level > 0 &&
        b.pending !== "build" &&
        cur.gold[side] >= WAR.unitCost[cls]
      );
    });
    if (open.length === 0 || supplyUsed(cur, side) >= supplyCap(cur, side)) break;
    const pick = rng.weighted(open.map((p) => ({ item: p, weight: weights[WAR.trains[p.kind]!] ?? 1 })));
    if (!tryDo({ type: "train", plot: pick.id })) break;
  }

  // Spare gold with a full army goes into upgrades.
  if (supplyUsed(cur, side) >= supplyCap(cur, side)) {
    for (const p of producers) {
      if (cur.gold[side] < WAR.upgradeCost + 4) break;
      tryDo({ type: "upgrade", plot: p.id });
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
    goal = { order: "attackMove", to: siegeTile(side) };
  } else if (state.round >= 5 && ourValue >= theirValue && (cur.mines[homeMine] ?? 0) < 20) {
    goal = { order: "attackMove", to: MID };
  } else {
    goal = { order: "hold", to: RALLY[side] };
  }

  const heading = (u: WarUnit): Cell | null =>
    u.order.type === "attackMove" || u.order.type === "move" ? u.order.to : null;
  const target = isOpen(goal.to) ? goal.to : RALLY[side];
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

