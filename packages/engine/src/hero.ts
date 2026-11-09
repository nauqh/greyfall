// The hero and the monsters it fights on an area map: their numbers (GAME.md's starting values) and the rules a
// fight runs on. The scene moves the sprites; what a monster does next and what a blow takes off come from here.

import { canStep, cellKey, stepsFrom, tileDistance, type Cell } from "./island.ts";

/** The captain: a Warrior in blue. */
/** A walk, not a sprint: 2.8 tiles a second (4 read as running everywhere). */
/** Swings: the first two of a combo `chain` seconds apart, the finisher's recovery `every`; a swing within `combo` seconds of
 *  being ready again chains. A raised shield lets a fifth of a blow from the front through. */
export const HERO = { hp: 100, attack: 12, chain: 0.65, every: 1.1, hit: 0.2, speed: 2.8, sprint: 1.6, guard: 0.2, combo: 1.4, flasks: 3, flask: 40 } as const;

/**
 * The pace of a fight, after Dark Souls: a monster stands this long after striking, open to a punish, and no more
 * than `engage` close in on one mark at a time; the rest hold back and wait their turn.
 */
export const PACE = { recover: 0.45, engage: 2 } as const;

export interface FoeStats {
  hp: number;
  attack: number;
  /** Seconds between blows. */
  every: number;
  /** Seconds it winds up before a blow lands: the moment to roll or raise a shield. */
  windup: number;
  /** Unflinching: a hit does not break its wind-up. */
  poise?: boolean;
  /** Tiles within which it notices the hero. */
  aggro: number;
  /** Tiles from its post past which it gives up and walks back. */
  leash: number;
  /** Tiles a second. */
  speed: number;
  /** The gold it drops where it falls. */
  gold: number;
  /** Tiles it strikes from, throwing or shooting; beside it (1) when unset. */
  range?: number;
  /** On the wing: a blade cannot reach it, only a bow. */
  flies?: boolean;
}

/** What a gold stone on the map is worth, picked up once. */
export const GOLD_STONE = 25;

/** The monsters that fight, by dweller kind; everything else on a map is scenery or a bystander. Most are a little
 *  slower than the hero, so it can walk away from a fight; spiders and thieves are quicker. */
export const FOES: Partial<Record<string, FoeStats>> = {
  torch: { hp: 30, attack: 6, every: 2.4, windup: 0.6, aggro: 6, leash: 10, speed: 2.2, gold: 6 },
  spear: { hp: 40, attack: 8, every: 2.8, windup: 0.75, aggro: 6, leash: 10, speed: 2.2, gold: 9 },
  skull: { hp: 25, attack: 5, every: 2.2, windup: 0.55, aggro: 5, leash: 9, speed: 1.9, gold: 7 },
  spider: { hp: 22, attack: 5, every: 2.0, windup: 0.5, aggro: 5, leash: 8, speed: 3, gold: 5 },
  thief: { hp: 28, attack: 7, every: 2.0, windup: 0.45, aggro: 5, leash: 8, speed: 3, gold: 15 },
  lizard: { hp: 35, attack: 7, every: 2.6, windup: 0.7, poise: true, aggro: 5, leash: 9, speed: 2.2, gold: 8 },
  snake: { hp: 18, attack: 4, every: 2.2, windup: 0.5, aggro: 4, leash: 7, speed: 2.2, gold: 4 },
  // Throwers and shooters: they stop at range and let fly.
  gnoll: { hp: 45, attack: 9, every: 3.0, windup: 0.8, poise: true, aggro: 7, leash: 10, speed: 2.2, gold: 12, range: 4 },
  slingshot: { hp: 18, attack: 5, every: 2.6, windup: 0.6, aggro: 7, leash: 10, speed: 2.2, gold: 7, range: 5 },
  shaman: { hp: 35, attack: 9, every: 3.2, windup: 0.9, poise: true, aggro: 7, leash: 10, speed: 1.9, gold: 14, range: 5 },
  // On the wing, over anything, quick: only an archer brings them down.
  bat: { hp: 16, attack: 4, every: 2.2, windup: 0.5, aggro: 6, leash: 9, speed: 3, gold: 5, flies: true },
  imp: { hp: 22, attack: 6, every: 2.4, windup: 0.6, aggro: 6, leash: 9, speed: 3, gold: 9, flies: true },
  bee: { hp: 8, attack: 3, every: 2.0, windup: 0.45, aggro: 4, leash: 6, speed: 3.2, gold: 2, flies: true },
  // Bosses: never back once slain.
  // The Landing's end: plain blows, but heavy ones, to teach the roll and the guard before the Harbour.
  minotaur: { hp: 220, attack: 22, every: 2.6, windup: 0.9, poise: true, aggro: 6, leash: 8, speed: 1.9, gold: 80 },
  // The Ramparts' wall boss, after the Taurus Demon: an iron-shod bull on a wall too narrow to circle, so every blow is
  // rolled through or taken.
  rampartBull: { hp: 300, attack: 24, every: 2.4, windup: 0.85, poise: true, aggro: 6, leash: 9, speed: 2.0, gold: 120 },
  // The Chapel Ward's bell boss, after the Bell Gargoyles: a stone warden squatting on the bell roof, slow and very heavy.
  stoneWarden: { hp: 380, attack: 26, every: 2.8, windup: 1.0, poise: true, aggro: 6, leash: 8, speed: 1.6, gold: 160 },
  troll: { hp: 320, attack: 24, every: 2.4, windup: 1.1, poise: true, aggro: 7, leash: 9, speed: 1.6, gold: 150 },
};

/**
 * The Cinder Troll's three blows, after GAME.md: a club slam on a ground circle, a charge down a line, embers tossed
 * to burn. Each warns for its `windup` seconds, then it stands `recover` seconds, open. Tiles, seconds and points.
 */
export const TROLL = {
  slam: { windup: 1.1, radius: 1, damage: 24 },
  charge: { windup: 0.9, tiles: 6, damage: 20, speed: 12 },
  toss: { windup: 1.0, patches: 3, damage: 5, burn: 4, tick: 0.5 },
  recover: 1.3,
} as const;
export type TrollMove = "slam" | "charge" | "toss";

/** The troll's next blow at a mark `distance` tiles off: a slam up close, a charge or embers in turn further out, none past a charge's reach. */
export function trollMove(distance: number, last: TrollMove | null): TrollMove | null {
  if (distance <= 2) return "slam";
  if (distance > TROLL.charge.tiles) return null;
  return last === "charge" ? "toss" : "charge";
}

/** The cells a charge crosses from `from` toward `to`, up to its reach, stopping where a step is barred (a wall, a cliff). */
export function chargeLine(from: Cell, to: Cell): Cell[] {
  const [dc, dr] = [to.col - from.col, to.row - from.row];
  const n = Math.max(Math.abs(dc), Math.abs(dr));
  const line: Cell[] = [];
  let prev = from;
  for (let i = 1; n > 0 && i <= TROLL.charge.tiles; i++) {
    const c = { col: from.col + Math.round((dc * i) / n), row: from.row + Math.round((dr * i) / n) };
    if (!canStep(prev, c)) break;
    line.push((prev = c));
  }
  return line;
}

/** Whether a missile flies clear from `a` to `b`: no tile it crosses, the two ends aside, is cover (a wall, a wood). */
export function clearShot(a: Cell, b: Cell, cover: (c: Cell) => boolean): boolean {
  const n = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row)) * 2;
  for (let i = 1; i < n; i++) {
    const c = { col: Math.round(a.col + ((b.col - a.col) * i) / n), row: Math.round(a.row + ((b.row - a.row) * i) / n) };
    if (!(c.col === a.col && c.row === a.row) && !(c.col === b.col && c.row === b.row) && cover(c)) return false;
  }
  return true;
}

/** Whether a monster may start a blow at its mark: only while fewer than `PACE.engage` others are already at it. */
export function mayEngage(engaged: number): boolean {
  return engaged < PACE.engage;
}

/** Whether a striker reaching `range` tiles can hit a monster: one on the wing only from afar, with a bow. */
export function canReach(range: number, foe: FoeStats): boolean {
  return !foe.flies || range > 1;
}

export type Intent = "attack" | "chase" | "return" | "idle";

/**
 * What a monster does now. It strikes a hero within its reach (beside it, or as far as it throws), chases one it has
 * noticed while within its leash, and otherwise walks back to its post. A dead hero, or none, is ignored.
 */
export function foeIntent(foe: Cell, home: Cell, hero: Cell | null, stats: FoeStats): Intent {
  const leashed = tileDistance(foe, home) <= stats.leash;
  if (hero && leashed && tileDistance(foe, hero) <= (stats.range ?? 1)) return "attack";
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

/** A flask drunk: `heal` back, never past whole; none drunk with none left or nothing to heal. */
export function drink(hp: number, max: number, flasks: number, heal: number = HERO.flask): { hp: number; flasks: number } {
  if (flasks <= 0 || hp >= max) return { hp, flasks };
  return { hp: Math.min(max, hp + heal), flasks: flasks - 1 };
}

/** The captain's numbers that a merchant's goods raise. */
export interface Kit {
  hp: number;
  attack: number;
  flasks: number;
  /** What a flask gives back. */
  flask: number;
  /** Stamina a blow on the shield costs, a point of its weight. */
  block: number;
  /** A felled monster's gold, times this. */
  greed: number;
}

/**
 * What the merchants sell, after the Souls games: upgrades bought once and kept, never a bag of clutter. Keyed by
 * name, which is what a save keeps; each adds to the captain's numbers, an edge only on top of the one before.
 */
export const ITEMS = {
  "Smoked Haunch": { cost: 250, adds: { hp: 25 } },
  "Ember Shard": { cost: 300, adds: { flasks: 1 } },
  "Brenna's Edge": { cost: 400, adds: { attack: 3 } },
  "Keener Edge": { cost: 800, adds: { attack: 3 }, needs: "Brenna's Edge" },
  "Grey-Iron Edge": { cost: 1200, adds: { attack: 4 }, needs: "Keener Edge" },
  "Pine Resin": { cost: 450, adds: { flask: 15 } },
  "Banded Shield": { cost: 600, adds: { block: -0.75 } },
  "Kindled Shard": { cost: 900, adds: { flasks: 1 } },
  "Prospector's Purse": { cost: 500, adds: { greed: 0.25 } },
} as const satisfies Record<string, { cost: number; adds: Partial<Kit>; needs?: string }>;
export type ItemName = keyof typeof ITEMS;

/** The captain's numbers with what has been bought. */
export function kit(bought: ReadonlySet<string>): Kit {
  const k: Kit = { hp: HERO.hp, attack: HERO.attack, flasks: HERO.flasks, flask: HERO.flask, block: STAMINA.block, greed: 1 };
  for (const [name, item] of Object.entries(ITEMS)) {
    if (!bought.has(name)) continue;
    for (const [stat, n] of Object.entries(item.adds) as [keyof Kit, number][]) k[stat] += n;
  }
  return k;
}

/** One line of a merchant's stock: on sale once `after`, a boss kind, has fallen. */
export interface Stock {
  item: ItemName;
  after?: string;
}

/** What a merchant shows: each line whose boss has fallen and whose lesser edge is owned, bought ones included. */
export function onOffer(stock: readonly Stock[], bought: ReadonlySet<string>, slain: ReadonlySet<string>): Stock[] {
  return stock.filter((s) => (!s.after || slain.has(s.after)) && (!("needs" in ITEMS[s.item]) || bought.has((ITEMS[s.item] as { needs: string }).needs)));
}

/**
 * Stamina, after Dark Souls: every swing, roll and blow on the shield spends it, sprinting drains it, and it comes back
 * quickly once nothing has been spent for a moment, a third as fast behind a raised shield. Seconds and points.
 */
export const STAMINA = { max: 100, regen: 45, delay: 0.5, guarded: 1 / 3, swing: 14, roll: 22, sprint: 15, block: 2.5 } as const;

/** Whether an action can start: any stamina at all will do, as in Dark Souls; the cost may take it to nothing. */
export function canAct(stamina: number): boolean {
  return stamina > 0;
}

/** Stamina after spending: never below nothing. */
export function spend(stamina: number, cost: number): number {
  return Math.max(0, stamina - cost);
}

/** Stamina after `dt` seconds, `idle` seconds since any was last spent, the shield up or not. */
export function recover(stamina: number, dt: number, idle: number, guarding: boolean): number {
  if (idle < STAMINA.delay) return stamina;
  return Math.min(STAMINA.max, stamina + STAMINA.regen * dt * (guarding ? STAMINA.guarded : 1));
}

/** A blow on the shield: it costs stamina by its weight, `rate` a point, and with too little left the guard breaks and it lands whole. */
export function block(stamina: number, attack: number, rate: number = STAMINA.block): { stamina: number; broken: boolean } {
  const cost = attack * rate;
  return stamina >= cost ? { stamina: stamina - cost, broken: false } : { stamina: 0, broken: true };
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
