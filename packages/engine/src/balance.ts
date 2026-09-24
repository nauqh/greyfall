/**
 * Every tunable number. Nothing else in the engine hard-codes a stat.
 * Phase 1 uses only the battle half: no economy, buildings or covenants yet.
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
  /** Reach in cells, Chebyshev. 1 is melee: any of the eight neighbours. */
  range: number;
  /** Healing per action. Only the Monk heals. */
  heal: number;
}

export const BALANCE = {
  /** Gold the player and the AI each get in the Phase 1 prototype. */
  budget: 20,

  board: {
    /** Two 5x3 halves side by side in one 10x3 grid; side A is the left half. */
    cols: 5,
    rows: 3,
    battleCols: 10,
    battleRows: 3,
    maxUnits: 8,
  },

  /** Simulation ticks per second. */
  tickRate: 10,
  /** A battle is decided on total HP remaining if it runs this long. */
  timeoutSeconds: 45,

  /** One action a second for every class, so `damage` reads as damage per second. */
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
    warrior: { cost: 3, hp: 120, damage: 14, range: 1, heal: 0 },
    lancer: { cost: 3, hp: 140, damage: 10, range: 1, heal: 0 },
    // 5 is the gap between the two back columns and the enemy front line on a
    // 10-wide board, so an Archer left at the back never has to walk into the
    // melee to fire. It still advances once that front line is gone and only
    // the enemy's own back column is left.
    archer: { cost: 3, hp: 60, damage: 10, range: 5, heal: 0 },
    monk: { cost: 4, hp: 70, damage: 0, range: 2, heal: 8 },
  } as Record<UnitClass, UnitStats>,

  /**
   * One ability per class. The PRD sells these as level 3 building upgrades;
   * until buildings exist every unit has its ability, and `enabled` is the
   * switch the upgrade will flip.
   */
  abilities: {
    /** Warrior, once a battle below the HP threshold: spends an action to halve damage taken. */
    guard: { enabled: true, hpBelow: 0.5, damageTaken: 0.5, seconds: 3 },
    /** Lancer, always on: enemies within `radius` must attack the nearest Lancer. */
    taunt: { enabled: true, radius: 2 },
    /** Archer, every `every`th shot: also hits the enemy straight behind the target. */
    pierce: { enabled: true, every: 3, damage: 0.5 },
    /** Monk, once a battle: spends an action raising the first fallen ally at this HP fraction. */
    revive: { enabled: true, hp: 0.5 },
  },

  /**
   * Openers the AI buys first when the budget allows, so it fields real comps
   * instead of a random pile. Leftover gold rolls singles by aiPickWeights.
   */
  aiTemplates: [
    { weight: 3, units: ["lancer", "lancer", "archer", "archer", "archer", "archer"] },
    { weight: 3, units: ["warrior", "warrior", "warrior", "warrior", "archer", "archer"] },
    { weight: 2, units: ["warrior", "warrior", "warrior", "monk", "archer"] },
    { weight: 1, units: ["lancer", "lancer", "lancer", "warrior", "monk"] },
  ] as { weight: number; units: UnitClass[] }[],

  /** Weights for gold left after an opener. The Pawn is a miner, never bought. */
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
