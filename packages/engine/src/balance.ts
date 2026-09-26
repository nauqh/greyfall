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

/**
 * The war on the island. Kept apart from BALANCE so the battle prototype,
 * which still ships, keeps its own board and budget untouched. Unit HP,
 * damage and counters come from BALANCE; only what the island changes is
 * here.
 */
export const WAR = {
  /** Gold is counted in Warcraft-sized sums, tens not ones, so upkeep can
   *  tax a single bag in whole coins. */
  startGold: 100,
  /** A bigger army pays upkeep: the first tier whose fighter count (Pawns
   *  not counted) the side has reached, from the top, applies. In rounds it
   *  sets the base income paid at the start of every round; in real time it
   *  is Warcraft III's tax on every bag of gold brought home (keep). */
  upkeep: [
    { fighters: 11, income: 40, keep: 0.4, name: "high" },
    { fighters: 7, income: 70, keep: 0.7, name: "low" },
    { fighters: 0, income: 100, keep: 1, name: "none" },
  ],
  /** Per Pawn digging at a mine, while the mine holds gold. */
  pawnIncome: 20,
  /** Each side starts with `start` Pawns and the castle trains more up to
   *  `max`. Dead ones stay dead, unless a side has none left. */
  pawns: { start: 3, max: 10 },
  mineGold: {
    "mine-a": 1500,
    "mine-b": 1500,
    "mine-ya": 1000,
    "mine-yb": 1000,
    "mine-na": 1000,
    "mine-nb": 1000,
    "mine-sa": 1000,
    "mine-sb": 1000,
    "mine-mid": 2500,
  } as Record<string, number>,
  pawnsPerMine: 4,
  /** An enemy fighter this close to a mine at the end of a battle stops its income. */
  raidRadius: 2,

  /** Three houses reach 20: six Pawns and fourteen others. */
  supply: { start: 8, perHouse: 4, max: 20 },

  unitCost: { pawn: 40, warrior: 30, lancer: 30, archer: 30, monk: 40 } as Record<UnitClass, number>,
  /** The board's archer range was set for a 10-wide board; the island uses the PRD's 3. */
  range: { pawn: 1, warrior: 1, lancer: 1, archer: 3, monk: 2 } as Record<UnitClass, number>,

  /** What each building trains. Houses train nothing. */
  trains: {
    castle: "pawn",
    barracks: "warrior",
    archery: "archer",
    tower: "lancer",
    monastery: "monk",
  } as Partial<Record<string, UnitClass>>,
  /** Barracks and castle start built. */
  buildCost: { castle: 0, barracks: 40, archery: 40, tower: 40, monastery: 50, house: 40 } as Record<string, number>,
  upgradeCost: 60,
  /** Level 3 and the castle upgrade land with abilities, after Phase 2. */
  maxLevel: 2,
  /** A castle outlasts one battle phase against a small army that marched
   *  from home, so a siege always leaves its defender a plan to answer it. */
  buildingHp: { castle: 1000, other: 300 },

  /** What a level 2 production building gives its class. */
  level2: { warriorHp: 0.2, archerRange: 1, lancerHp: 0.2, monkHeal: 0.3 },

  /** Units deal this share of their damage to buildings. */
  buildingDamage: 0.5,
  /** Damage from lowland onto a plateau is scaled by this. */
  highGround: 0.75,
  /** How far an attack move chases off its path, and a stopped unit off its tile. */
  chase: 3,
  /** A Fall back unit leaves the fight below this share of its HP. */
  fallBackBelow: 0.5,

  /** A battle phase ends this long after the last fight, or at the cap. */
  settleSeconds: 3,
  capSeconds: 45,
  /** From this round both main halls lose a growing share of their HP each round. */
  greying: { fromRound: 12, step: 0.05 },

  /** Real time: the clock replaces the round. */
  realtime: {
    /** Gold a Pawn carries home a trip, after digging this long. */
    carry: 10,
    digSeconds: 2,
    trainSeconds: { pawn: 8, warrior: 10, archer: 10, lancer: 12, monk: 14 } as Record<UnitClass, number>,
    buildSeconds: { castle: 0, house: 10, barracks: 20, archery: 20, tower: 20, monastery: 25 } as Record<string, number>,
    upgradeSeconds: 25,
    /** Units a building can have waiting to be trained, paid when queued. */
    queue: 5,
    /** Share of max HP a unit on its home plateau regains a second. */
    homeHeal: 0.05,
    /** A round's worth of clock, for the AI's pacing and the HUD. */
    roundSeconds: 45,
    /** From here the halls lose a growing share of their HP every interval,
     *  so a match still ends: about four and a half minutes later. */
    greying: { fromSeconds: 480, everySeconds: 30, step: 0.025 },
  },
} as const;
