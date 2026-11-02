// The hero and the monsters it fights on an area map: their numbers (GAME.md's starting values) and the rules a
// fight runs on. The scene moves the sprites; what a monster does next and what a blow takes off come from here.

import { tileDistance, type Cell } from "./island.ts";

/** The captain: a Warrior in blue. */
export const HERO = { hp: 100, attack: 12, every: 0.8, speed: 4 } as const;

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
}

/** The monsters that fight, by dweller kind; everything else on a map is scenery or a bystander. */
export const FOES: Partial<Record<string, FoeStats>> = {
  torch: { hp: 30, attack: 6, every: 1.2, aggro: 6, leash: 10, speed: 3 },
  spear: { hp: 40, attack: 8, every: 1.4, aggro: 6, leash: 10, speed: 3 },
  skull: { hp: 25, attack: 5, every: 1.0, aggro: 5, leash: 9, speed: 2.5 },
  spider: { hp: 22, attack: 5, every: 0.9, aggro: 5, leash: 8, speed: 4 },
  gnoll: { hp: 45, attack: 9, every: 1.5, aggro: 6, leash: 10, speed: 3 },
  thief: { hp: 28, attack: 7, every: 1.0, aggro: 5, leash: 8, speed: 4 },
  lizard: { hp: 35, attack: 7, every: 1.2, aggro: 5, leash: 9, speed: 3 },
  snake: { hp: 18, attack: 4, every: 1.0, aggro: 4, leash: 7, speed: 3 },
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

/** What a blow leaves: never below nothing. */
export function struck(hp: number, attack: number): number {
  return Math.max(0, hp - attack);
}
