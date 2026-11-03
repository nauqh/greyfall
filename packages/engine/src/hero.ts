// The hero and the monsters it fights on an area map: their numbers (GAME.md's starting values) and the rules a
// fight runs on. The scene moves the sprites; what a monster does next and what a blow takes off come from here.

import { canStep, cellKey, stepsFrom, tileDistance, type Cell } from "./island.ts";

/** The captain: a Warrior in blue. */
/** A walk, not a sprint: 2.8 tiles a second (4 read as running everywhere). */
/** Swings: the first two of a combo `chain` seconds apart, the finisher's recovery `every`; a swing within `combo` seconds of
 *  being ready again chains. A raised shield lets a fifth of a blow from the front through. */
export const HERO = { hp: 100, attack: 12, chain: 0.45, every: 0.9, speed: 2.8, guard: 0.2, combo: 1.4, flasks: 3, flask: 40 } as const;

export interface FoeStats {
  hp: number;
  attack: number;
  /** Seconds between blows. */
  every: number;
  /** Tiles within which it notices the hero. */
  aggro: number;
  /** Tiles from its post past which it gives up and walks back. */
  leash: number;
  /** Tiles a second. */
  speed: number;
  /** The gold it drops where it falls. */
  gold: number;
}

/** What a gold stone on the map is worth, picked up once. */
export const GOLD_STONE = 25;

/** The monsters that fight, by dweller kind; everything else on a map is scenery or a bystander. Most are a little
 *  slower than the hero, so it can walk away from a fight; spiders and thieves are quicker. */
export const FOES: Partial<Record<string, FoeStats>> = {
  torch: { hp: 30, attack: 6, every: 1.2, aggro: 6, leash: 10, speed: 2.2, gold: 6 },
  spear: { hp: 40, attack: 8, every: 1.4, aggro: 6, leash: 10, speed: 2.2, gold: 9 },
  skull: { hp: 25, attack: 5, every: 1.0, aggro: 5, leash: 9, speed: 1.9, gold: 7 },
  spider: { hp: 22, attack: 5, every: 0.9, aggro: 5, leash: 8, speed: 3, gold: 5 },
  gnoll: { hp: 45, attack: 9, every: 1.5, aggro: 6, leash: 10, speed: 2.2, gold: 12 },
  thief: { hp: 28, attack: 7, every: 1.0, aggro: 5, leash: 8, speed: 3, gold: 15 },
  lizard: { hp: 35, attack: 7, every: 1.2, aggro: 5, leash: 9, speed: 2.2, gold: 8 },
  snake: { hp: 18, attack: 4, every: 1.0, aggro: 4, leash: 7, speed: 2.2, gold: 4 },
};

export type Intent = "attack" | "chase" | "return" | "idle";

/**
 * What a monster does now. It strikes a hero beside it, chases one it has noticed while within its leash, and
 * otherwise walks back to its post. A dead hero, or none, is ignored.
 */
export function foeIntent(foe: Cell, home: Cell, hero: Cell | null, stats: FoeStats): Intent {
  const leashed = tileDistance(foe, home) <= stats.leash;
  if (hero && leashed && tileDistance(foe, hero) <= 1) return "attack";
  if (hero && leashed && tileDistance(foe, hero) <= stats.aggro && tileDistance(hero, home) <= stats.leash) return "chase";
  return foe.col === home.col && foe.row === home.row ? "idle" : "return";
}

/** Which swing of the three-swing combo comes next, 1 to 3, given how long the hero has been ready: the third knocks
 *  back, and a pause starts over. */
export function comboStep(last: number, secondsReady: number): number {
  return last >= 3 || secondsReady > HERO.combo ? 1 : last + 1;
}

/** Seconds until the hero can swing again after swing `step`: quick between the first two, a longer recovery after the finisher. */
export function swingWait(step: number): number {
  return step >= 3 ? HERO.every : HERO.chain;
}

/** A flask drunk: `HERO.flask` back, never past whole; none drunk with none left or nothing to heal. */
export function drink(hp: number, max: number, flasks: number): { hp: number; flasks: number } {
  if (flasks <= 0 || hp >= max) return { hp, flasks };
  return { hp: Math.min(max, hp + HERO.flask), flasks: flasks - 1 };
}

/** What of a blow gets through a raised shield: a share of it, never nothing. */
export function throughGuard(attack: number): number {
  return Math.max(1, Math.ceil(attack * HERO.guard));
}

/** What a blow leaves: never below nothing. */
export function struck(hp: number, attack: number): number {
  return Math.max(0, hp - attack);
}

/** Whether a straight walk from `a` to `b` stays on ground, each cell it crosses a step from the last. */
export function clearLine(a: Cell, b: Cell): boolean {
  const n = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row)) * 2;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const c = { col: Math.round(a.col + ((b.col - a.col) * i) / n), row: Math.round(a.row + ((b.row - a.row) * i) / n) };
    if (c.col === prev.col && c.row === prev.row) continue;
    if (!canStep(prev, c)) return false;
    prev = c;
  }
  return true;
}

/** A grid path pulled straight: from each point, on to the farthest later cell in a clear line, so a walk is a few
 *  straight legs rather than a staircase of cells. */
export function smoothPath(from: Cell, path: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  let at = from;
  for (let i = 0; i < path.length; ) {
    let j = path.length - 1;
    while (j > i && !clearLine(at, path[j]!)) j--;
    out.push(path[j]!);
    at = path[j]!;
    i = j + 1;
  }
  return out;
}

/**
 * The shortest walk from `from` to the reachable cell nearest `to`: `to` itself when it can be walked to, else the
 * closest the walker can get (the edge of a wood, the shore), so a click on what blocks the way still goes somewhere.
 * The cells after `from`; empty when nothing nearer is reachable.
 */
export function routeToward(from: Cell, to: Cell, limit = 6000): Cell[] {
  const prev = new Map<number, Cell | null>([[cellKey(from), null]]);
  const queue = [from];
  // Nearest in a straight line, so a click beside a corner goes to the side it was on.
  const far = (c: Cell) => Math.hypot(c.col - to.col, c.row - to.row);
  let best = from;
  let bestD = far(from);
  for (let i = 0; i < queue.length && i < limit && bestD > 0; i++) {
    for (const n of stepsFrom(queue[i]!)) {
      if (prev.has(cellKey(n))) continue;
      prev.set(cellKey(n), queue[i]!);
      queue.push(n);
      const d = far(n);
      if (d < bestD) [best, bestD] = [n, d];
    }
  }
  const way: Cell[] = [];
  for (let c: Cell | null = best; c && cellKey(c) !== cellKey(from); c = prev.get(cellKey(c)) ?? null) way.unshift(c);
  return way;
}
