/**
 * Every tunable number in the game lives here. Nothing else in the engine
 * hard-codes a stat, so balancing is a single-file edit.
 *
 * Phase 1 uses only the battle half of this: no economy, supply, buildings,
 * upgrades or covenants yet.
 */

export type UnitClass = "pawn" | "warrior" | "lancer" | "archer" | "monk";

export const UNIT_CLASSES: readonly UnitClass[] = [
  "pawn",
  "warrior",
  "lancer",
  "archer",
  "monk",
];

export interface UnitStats {
  /** Gold cost. */
  cost: number;
  hp: number;
  /** Damage per attack. */
  damage: number;
  /** Reach in tiles, Chebyshev. 1 is melee (any of the 8 neighbours). */
  range: number;
  /** Healing per action. Only the Monk heals. */
  heal: number;
}

export const BALANCE = {
  /** Gold the player and the AI each get in the Phase 1 prototype. */
  budget: 20,

  board: {
    /** Each side arranges on its own 4x3 board. */
    cols: 4,
    rows: 3,
    /** The two boards join into one 8x3 grid: side B's col c sits at 7 - c. */
    battleCols: 8,
    /** 4 x 3 = 12 tiles, so 12 units. */
    maxUnits: 12,
  },

  /** Simulation ticks per second. */
  tickRate: 10,
  /** A battle is decided on total HP remaining if it runs this long. */
  timeoutSeconds: 45,

  /**
   * One action per second for every class: an attack, a heal, or a one-tile
   * step. So the `damage` column below reads directly as damage per second.
   */
  actionSeconds: 1,

  /** Extra damage against the class you counter. */
  counterBonus: 0.25,

  /** Lancer beats Warrior, Warrior beats Archer, Archer beats Lancer. */
  counters: {
    lancer: "warrior",
    warrior: "archer",
    archer: "lancer",
  } as Partial<Record<UnitClass, UnitClass>>,

  units: {
    pawn: { cost: 2, hp: 40, damage: 4, range: 1, heal: 0 },
    warrior: { cost: 3, hp: 100, damage: 14, range: 1, heal: 0 },
    lancer: { cost: 3, hp: 140, damage: 8, range: 1, heal: 0 },
    archer: { cost: 3, hp: 60, damage: 10, range: 3, heal: 0 },
    monk: { cost: 4, hp: 70, damage: 0, range: 2, heal: 12 },
  } as Record<UnitClass, UnitStats>,

  /**
   * What the AI opponent buys, as pick weights. The Pawn is a miner, not a
   * board unit, so it is never bought for a generated army.
   */
  aiPickWeights: {
    warrior: 3,
    lancer: 3,
    archer: 3,
    monk: 1,
  } as Partial<Record<UnitClass, number>>,
} as const;

export const TICKS_PER_ACTION = BALANCE.actionSeconds * BALANCE.tickRate;
export const MAX_TICKS = BALANCE.timeoutSeconds * BALANCE.tickRate;

/** Damage `attacker` deals to `defender`, counter bonus included. */
export function damageAgainst(attacker: UnitClass, defender: UnitClass): number {
  const base = BALANCE.units[attacker].damage;
  const bonus = BALANCE.counters[attacker] === defender ? BALANCE.counterBonus : 0;
  return Math.round(base * (1 + bonus));
}
