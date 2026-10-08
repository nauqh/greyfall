/**
 * Every tunable number. Nothing else in the engine hard-codes a stat.
 * Phase 1 uses only the battle half: no economy, buildings or clans yet.
 */

export type UnitClass = "pawn" | "warrior" | "lancer" | "archer" | "monk";

export const UNIT_CLASSES: readonly UnitClass[] = [
  "pawn",
  "warrior",
  "lancer",
  "archer",
  "monk",
];

/** Skirmish's monsters, from the Enemy Pack. The war and Duel field knights only. */
export type MonsterClass = "skull" | "torch" | "gnoll" | "thief" | "shaman" | "troll" | "minotaur";

export const MONSTER_CLASSES: readonly MonsterClass[] = ["skull", "torch", "gnoll", "thief", "shaman", "troll", "minotaur"];

/** Anything that can stand on the Skirmish board. */
export type Champion = UnitClass | MonsterClass;

export const CHAMPIONS: readonly Champion[] = [...UNIT_CLASSES, ...MONSTER_CLASSES];

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
    // Skirmish only; the cost is the auto chess tier.
    skull: { cost: 1, hp: 90, damage: 9, range: 1, heal: 0 },
    torch: { cost: 2, hp: 100, damage: 11, range: 1, heal: 0 },
    gnoll: { cost: 2, hp: 75, damage: 11, range: 4, heal: 0 },
    thief: { cost: 3, hp: 110, damage: 20, range: 1, heal: 0 },
    shaman: { cost: 3, hp: 80, damage: 14, range: 3, heal: 0 },
    troll: { cost: 4, hp: 360, damage: 20, range: 1, heal: 0 },
    minotaur: { cost: 4, hp: 280, damage: 23, range: 1, heal: 0 },
  } as Record<Champion, UnitStats>,

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
    /** Skull, once a battle: the blow that would kill it leaves it at this HP fraction instead. */
    reassemble: { enabled: true, hp: 0.4 },
    /** Torch Goblin: every hit also burns the target's neighbours for this share. */
    splash: { enabled: true, damage: 0.5 },
    /** Gnoll: this much more damage against targets below the HP fraction. */
    hunter: { enabled: true, below: 0.5, bonus: 0.5 },
    /** Thief, at the start of a battle: leaps beside the enemy furthest back. */
    ambush: { enabled: true },
    /** Hex Shaman, every `every`th bolt: the target loses this long before its next action. */
    hex: { enabled: true, every: 3, seconds: 1.5 },
    /** Troll: regains this share of its max HP every second. */
    regenerate: { enabled: true, perSecond: 0.02 },
    /** Minotaur: every swing also hits each other enemy beside it for this share. */
    cleave: { enabled: true, damage: 0.5 },
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

export type TraitEffect = "damageTaken" | "hp" | "attackSeconds" | "heal" | "gold" | "damage";

/** A class trait for each knight, and the monsters' shared one. */
export type TraitKey = UnitClass | "horde";

export interface Trait {
  name: string;
  /** Who it counts and who it helps. */
  members: readonly Champion[];
  /** Counts different classes among the members rather than units. */
  kinds: boolean;
  /** Members on the board, units or kinds, that switch each tier on. */
  at: readonly number[];
  effect: TraitEffect;
  /** One per tier: a multiplier, or for gold the coins paid after a round. */
  values: readonly number[];
}

/** Tier is also the price. */
const TIER: Record<Champion, number> = {
  pawn: 1,
  lancer: 1,
  skull: 1,
  warrior: 2,
  archer: 2,
  torch: 2,
  gnoll: 2,
  monk: 3,
  thief: 3,
  shaman: 3,
  troll: 4,
  minotaur: 4,
};
/** Copies of each unit in the shared pool, by tier. Nine make a 3-star. */
const POOL_BY_TIER = [0, 29, 22, 16, 10];

const knight = (cls: UnitClass, name: string, at: number[], effect: TraitEffect, values: number[]): Trait => ({
  name,
  members: [cls],
  kinds: false,
  at,
  effect,
  values,
});

/**
 * Skirmish's auto chess run: a lobby of four drafting from one shared pool.
 * The economy follows Teamfight Tactics (interest per 10 held, streak pay,
 * XP bought in fours), cut to five classes and a 5x3 half board.
 */
export const AUTO = {
  seats: 4,
  startHp: 70,
  startGold: 4,
  startLevel: 2,
  maxLevel: BALANCE.board.maxUnits,
  /** XP from level L to L+1, indexed by L. */
  xpToNext: [0, 2, 2, 6, 10, 20, 36, 48] as readonly number[],
  xpPerRound: 2,
  xpBuy: { gold: 4, xp: 4 },
  income: 5,
  winGold: 1,
  /** One coin per 10 held at the end of a round, up to this many. */
  interestMax: 5,
  /** Streak pay by streak length, wins or losses alike: 2-3 +1, 4-5 +2, 6+ +3. */
  streakGold: [0, 0, 1, 1, 2, 2, 3] as readonly number[],
  reroll: 2,
  shopSlots: 5,
  benchSlots: 8,
  tier: TIER,
  pool: Object.fromEntries(CHAMPIONS.map((c) => [c, POOL_BY_TIER[TIER[c]]!])) as Record<Champion, number>,
  /** Chance of each tier per shop slot, in percent, indexed by level. */
  odds: [
    [100, 0, 0, 0],
    [75, 25, 0, 0],
    [75, 25, 0, 0],
    [55, 35, 10, 0],
    [45, 38, 15, 2],
    [35, 40, 20, 5],
    [25, 40, 27, 8],
    [18, 35, 32, 15],
    [12, 30, 35, 23],
  ] as readonly (readonly number[])[],
  /** HP, damage and healing by star level, indexed by stars. */
  starPower: [0, 1, 1.8, 3.2] as readonly number[],
  /** A loss costs this plus a point per star still standing on the winner's side. */
  damage: { base: 3, perRounds: 3 },
  traits: {
    warrior: knight("warrior", "Shieldwall", [2, 4], "damageTaken", [0.85, 0.7]),
    lancer: knight("lancer", "Vanguard", [2, 4], "hp", [1.2, 1.45]),
    archer: knight("archer", "Volley", [2, 4], "attackSeconds", [0.7, 0.5]),
    monk: knight("monk", "Chorus", [2, 3], "heal", [1.5, 2.2]),
    pawn: knight("pawn", "Prospectors", [2, 4], "gold", [1, 3]),
    // TFT counts unique champions toward an origin; the Horde counts kinds of monster.
    horde: {
      name: "Horde",
      members: MONSTER_CLASSES,
      kinds: true,
      at: [2, 4, 6],
      effect: "damage",
      values: [1.12, 1.25, 1.45],
    },
  } as Record<TraitKey, Trait>,
} as const;

export const TICKS_PER_ACTION = BALANCE.actionSeconds * BALANCE.tickRate;
export const MAX_TICKS = BALANCE.timeoutSeconds * BALANCE.tickRate;

/** Damage `attacker` deals to `defender`, counter bonus included. */
export function damageAgainst(attacker: Champion, defender: Champion): number {
  const base = BALANCE.units[attacker].damage;
  const counters: Partial<Record<Champion, Champion>> = BALANCE.counters;
  const bonus = counters[attacker] === defender ? BALANCE.counterBonus : 0;
  return Math.round(base * (1 + bonus));
}

/** Highest trait tier `count` units reach, or -1 for none. */
export function traitTier(key: TraitKey, count: number): number {
  return AUTO.traits[key].at.filter((n) => count >= n).length - 1;
}

export const TRAIT_KEYS = Object.keys(AUTO.traits) as TraitKey[];

/**
 * The war on the island. Kept apart from BALANCE so the battle prototype,
 * which still ships, keeps its own board and budget untouched. Unit HP,
 * damage and counters come from BALANCE; only what the island changes is
 * here.
 */
export const WAR = {
  /** Gold is counted in tens, not ones. */
  startGold: 100,
  /** Rounds: the base income paid at the start of every round. */
  income: 100,
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
    "mine-ca": 1000,
    "mine-cb": 1000,
    "mine-fa": 1000,
    "mine-fb": 1000,
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

  /** What each building trains. Houses and towers train nothing. */
  trains: {
    castle: ["pawn"],
    barracks: ["warrior", "lancer", "archer", "monk"],
  } as Partial<Record<string, readonly UnitClass[]>>,
  /** Barracks and castle start built. */
  buildCost: { castle: 0, barracks: 40, tower: 60, cannon: 80, house: 40 } as Record<string, number>,
  upgradeCost: 60,
  /** Level 3 and the castle upgrade land with abilities, after Phase 2. */
  maxLevel: 2,
  /** A castle outlasts one battle phase against a small army that marched
   *  from home, so a siege always leaves its defender a plan to answer it. */
  buildingHp: { castle: 1000, tower: 400, other: 300 },

  /** What a level 2 barracks gives every class it trains. */
  level2: { warriorHp: 0.2, archerRange: 1, lancerHp: 0.2, monkHeal: 0.3 },

  /** A tower's archer: shoots as an Archer does, further, and cannot be hit
   *  apart from the tower. */
  tower: { range: 4 },
  /** A cannon: slow, and the blast also hits the enemies round its target,
   *  but nothing closer than `minRange`, so melee that reaches it wins. */
  cannon: { range: 4, minRange: 2, damage: 30, seconds: 3, blast: 1 },

  /** Tiles a unit or building sees, round it. Pawns see least, so scouting
   *  costs a worker's trips; a tower on the high ground sees farthest. */
  sight: {
    units: { pawn: 4, warrior: 4, lancer: 5, archer: 6, monk: 5 } as Record<UnitClass, number>,
    buildings: { castle: 7, barracks: 4, tower: 8, cannon: 4, house: 3 } as Record<string, number>,
  },

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
    buildSeconds: { castle: 0, house: 10, barracks: 20, tower: 20, cannon: 25 } as Record<string, number>,
    upgradeSeconds: 25,
    /** Units a building can have waiting to be trained, paid when queued. */
    queue: 5,
    /** Share of max HP a unit on its home plateau regains a second. */
    homeHeal: 0.05,
    /** A round's worth of clock, for the AI's pacing and the HUD. */
    roundSeconds: 45,
    /** Monster waves from the Crown, each `growth` bigger than the last, so
     *  a match still ends. A kill pays `bounty` to the side that landed it. */
    monsters: { firstSeconds: 240, everySeconds: 60, first: 2, growth: 2, bounty: 10 },
  },
} as const;
