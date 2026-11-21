// The hero and the monsters it fights on an area map: their numbers (`ATLAS.md`'s starting values) and the rules a
// fight runs on. The scene moves the sprites; what a monster does next and what a blow takes off come from here.

import { canStep, cellKey, stepsFrom, tileDistance, type Cell } from "./island.ts";
import type { WorldFlag } from "./npcs.ts";

/** The player: a Warrior in blue, nameless here. */
/** A walk, not a sprint: 2.8 tiles a second (4 read as running everywhere). */
/** Swings: the first two of a combo `chain` seconds apart, the finisher's recovery `every`; a swing within `combo` seconds of
 *  being ready again chains. A raised shield lets a fifth of a blow from the front through. */
export const HERO = { hp: 100, attack: 12, chain: 0.65, every: 1.1, hit: 0.2, speed: 2.8, sprint: 1.6, guard: 0.2, combo: 1.4, flasks: 3, flask: 40 } as const;

/** The class picked at a new game's start. */
export type HeroClass = "warrior" | "lancer";
/** What a class changes of `HERO`: the Lancer's thrust reaches two tiles and bites deeper, but it recovers and walks
 *  slower, on more health; about the Warrior's damage a second, traded for reach. */
export const CLASSES: Record<HeroClass, { hp: number; attack: number; chain: number; every: number; speed: number; reach: number }> = {
  warrior: { hp: HERO.hp, attack: HERO.attack, chain: HERO.chain, every: HERO.every, speed: HERO.speed, reach: 1 },
  lancer: { hp: 120, attack: 15, chain: 0.85, every: 1.4, speed: 2.5, reach: 2 },
};

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
  // A grave totem in the King's Barrow: it never moves or strikes, only stands, and while one does the king is warded.
  graveTotem: { hp: 60, attack: 2, every: 99, windup: 1, poise: true, aggro: 0, leash: 0, speed: 0, gold: 0 },
  shaman: { hp: 35, attack: 9, every: 3.2, windup: 0.9, poise: true, aggro: 7, leash: 10, speed: 1.9, gold: 14, range: 5 },
  // On the wing, over anything, quick: only an archer brings them down.
  bat: { hp: 16, attack: 4, every: 2.2, windup: 0.5, aggro: 6, leash: 9, speed: 3, gold: 5, flies: true },
  imp: { hp: 22, attack: 6, every: 2.4, windup: 0.6, aggro: 6, leash: 9, speed: 3, gold: 9, flies: true },
  bee: { hp: 8, attack: 3, every: 2.0, windup: 0.45, aggro: 4, leash: 6, speed: 3.2, gold: 2, flies: true },
  // Bosses: never back once slain.
  // The Ember Hollow's boss, the Ember Bull: its moves are BOSS_KITS'. The Ember Key.
  minotaur: { hp: 340, attack: 24, every: 2.4, windup: 0.9, poise: true, aggro: 9, leash: 14, speed: 2.0, gold: 150 },
  // The Bull's Wall's boss, after the Taurus Demon: a goblin chief on a war boar, on a wall too narrow to circle. Its
  // moves are BOSS_KITS'; it sees the length of its wall.
  rampartBull: { hp: 300, attack: 24, every: 2.4, windup: 0.85, poise: true, aggro: 10, leash: 40, speed: 2.4, gold: 120 },
  // The Belfry's boss, after the Bell Gargoyles: a stone gargoyle on the bell loft.
  stoneWarden: { hp: 380, attack: 26, every: 2.6, windup: 1.0, poise: true, aggro: 9, leash: 14, speed: 2.0, gold: 160 },
  // The Landing's end, the Cinder Troll in the Bull's Ring: its moves are BOSS_KITS', warned long, to teach the roll.
  troll: { hp: 220, attack: 18, every: 2.8, windup: 1.1, poise: true, aggro: 7, leash: 9, speed: 1.5, gold: 80 },
  // The King's Barrow's hex-priest king, after Gaping Dragon's slowness: the Horned Key.
  barrowKing: { hp: 480, attack: 28, every: 2.6, windup: 1.0, poise: true, aggro: 9, leash: 14, speed: 1.6, gold: 220 },
  // The Deeps' web, after Quelaag: quick and often, lighter blows. The Silk Key.
  weaver: { hp: 360, attack: 18, every: 1.6, windup: 0.6, poise: true, aggro: 6, leash: 8, speed: 2.6, gold: 200 },
  // Optional, asleep on its isle: slow, the heaviest blows in the Reach. Killing it greys the lake.
  shellBelow: { hp: 600, attack: 32, every: 3.4, windup: 1.3, poise: true, aggro: 5, leash: 7, speed: 1.2, gold: 260 },
  // The last: a knight the Grey wore longest, quick for his weight.
  warlord: { hp: 700, attack: 30, every: 2.0, windup: 0.75, poise: true, aggro: 7, leash: 10, speed: 2.2, gold: 400 },
};

/**
 * A boss's blow, warned on the ground for `windup` seconds before it lands, where `shape` says:
 * - mark: a circle `radius` round the mark;
 * - self: a circle `radius` round the boss;
 * - ring: round the boss from `inner` out to `radius`, safe up close and far off;
 * - front: within `radius` of the boss, on the mark's side;
 * - line: a charge `tiles` long and `width` wide at the mark, the boss carried down it at `speed`; stopped by a wall
 *   unless it `flies`;
 * - scatter: `patches` cells within `radius` of the mark, the mark's own first;
 * - trail: the cells from the boss to the mark;
 * - summon: `n` of `kind` raised beside the boss, while fewer than `cap` it raised still stand.
 * With `burn`, the cells stay alight that many seconds, hurting `damage` every `tick`, guard or no.
 */
export interface BossMove {
  shape: "mark" | "self" | "ring" | "front" | "line" | "scatter" | "trail" | "summon";
  windup: number;
  damage: number;
  radius?: number;
  inner?: number;
  tiles?: number;
  width?: number;
  speed?: number;
  flies?: boolean;
  patches?: number;
  burn?: number;
  tick?: number;
  summon?: { kind: string; n: number; cap: number };
  /** A charge cut short by a wall leaves the boss dazed: this many seconds more standing open. */
  stun?: number;
  /** A charge runs only this many tiles past the mark, so it ends near enough to punish. */
  past?: number;
  /** Seconds it stands open after this move, in place of its kit's. */
  recover?: number;
}

/** A boss's moves, the seconds it stands open after each, and how it picks the next: by how far off its mark is, what
 *  it did last, and whether it rages, below `rage.at` of its health, winding up in `rage.haste` of the time.
 *  `stone`: the share of a blow it takes except while it stands open after a move. `wards`: a dweller kind that keeps
 *  it from all harm while any of them stands in its arena. */
export interface BossKit {
  moves: Record<string, BossMove>;
  recover: number;
  rage?: { at: number; haste: number };
  stone?: number;
  wards?: string;
  pick(distance: number, last: string | null, raging: boolean): string | null;
}

/** The bosses with moves of their own, after `ATLAS.md`. Tiles, seconds and points. */
export const BOSS_KITS: Partial<Record<string, BossKit>> = {
  // The Cinder Troll, the Landing's lesson: a club slam on a ground circle, a charge down a line, embers tossed to
  // burn, each warned long; a charge a rock in the Ring stops dead leaves him dazed and open.
  troll: {
    moves: {
      slam: { shape: "mark", windup: 1.4, radius: 1, damage: 16 },
      charge: { shape: "line", windup: 1.2, tiles: 6, width: 1, speed: 10, damage: 14, stun: 2.5 },
      toss: { shape: "scatter", windup: 1.3, patches: 3, radius: 2, damage: 4, burn: 3, tick: 0.6 },
    },
    recover: 1.6,
    pick: (d, last) => (d <= 2 ? "slam" : d > 6 ? null : last === "charge" ? "toss" : "charge"),
  },
  // The Ember Bull: a horn swipe up close and a stomp round him after it, so beside him is no safe place; from four
  // tiles off a rush that ends a tile past the mark and leaves him open, never two rushes running; a rush the pines
  // round the hollow stop dead leaves him dazed.
  minotaur: {
    moves: {
      swipe: { shape: "front", windup: 0.8, radius: 1, damage: 18 },
      stomp: { shape: "self", windup: 0.9, radius: 2, damage: 20 },
      rush: { shape: "line", windup: 1.0, tiles: 9, width: 1, speed: 11, damage: 22, past: 1, recover: 2, stun: 2.5 },
    },
    recover: 1.1,
    rage: { at: 0.5, haste: 0.75 },
    pick: (d, last) => (d <= 1 ? (last === "swipe" ? "stomp" : "swipe") : d >= 4 && d <= 9 && last !== "rush" ? "rush" : null),
  },
  // The Rampart Boar: a goblin chief on the garrison's war boar. On a wall three wide its charge takes the whole wall,
  // rolled through or taken; up close it gores; at range it calls the goblins' cannons down on the wall; raging, it
  // horns up its spearmen onto the wall after each charge.
  rampartBull: {
    moves: {
      gore: { shape: "front", windup: 0.7, radius: 2, damage: 20 },
      charge: { shape: "line", windup: 1.0, tiles: 10, width: 3, speed: 14, damage: 26 },
      cannons: { shape: "scatter", windup: 1.4, patches: 6, radius: 3, damage: 18 },
      rally: { shape: "summon", windup: 1.0, damage: 0, summon: { kind: "spear", n: 2, cap: 2 } },
    },
    recover: 1.1,
    rage: { at: 0.5, haste: 0.7 },
    pick: (d, last, raging) =>
      raging && last === "charge" ? "rally" : d <= 2 ? (last === "gore" ? "charge" : "gore") : last === "charge" || d > 10 ? "cannons" : "charge",
  },
  // The Stone Warden: a gargoyle on the bell loft, its skin stone: a blow takes a fifth off it but while it stands open
  // after a move. Up close its wings beat; a step off, the bell tolls round it, safe only hugging it or past the ring;
  // further, it dives the length of the loft over the bell's frame; and it shakes the roof's stones down.
  stoneWarden: {
    moves: {
      buffet: { shape: "self", windup: 0.7, radius: 1, damage: 18 },
      toll: { shape: "ring", windup: 1.2, inner: 2, radius: 3, damage: 20 },
      dive: { shape: "line", windup: 0.9, tiles: 8, width: 1, speed: 16, flies: true, damage: 22 },
      rubble: { shape: "scatter", windup: 1.5, patches: 7, radius: 4, damage: 16 },
    },
    recover: 1.6,
    rage: { at: 0.5, haste: 0.75 },
    stone: 0.2,
    pick: (d, last) =>
      d <= 1 ? (last === "buffet" ? "rubble" : "buffet") : d <= 3 ? (last === "toll" ? "dive" : "toll") : d <= 8 ? (last === "dive" ? "rubble" : "dive") : "rubble",
  },
  // The Barrow King: the old kings' hex-priest, dead and still crowned, and no blade bites him while the grave totems
  // round his hall stand. A curse bursts under the mark, grave fire runs the ground from him to it and burns on, and he
  // raises the barrow's dead; raging, he raises them more often.
  barrowKing: {
    moves: {
      hex: { shape: "mark", windup: 1.0, radius: 1, damage: 22 },
      gravefire: { shape: "trail", windup: 1.1, damage: 6, burn: 5, tick: 0.6 },
      raise: { shape: "summon", windup: 1.4, damage: 0, summon: { kind: "skull", n: 2, cap: 3 } },
    },
    recover: 1.2,
    rage: { at: 0.5, haste: 0.75 },
    wards: "graveTotem",
    pick: (d, last, raging) => (d > 9 ? null : last === "hex" ? (raging ? "raise" : "gravefire") : last === "gravefire" || last === null ? "raise" : "hex"),
  },
};

/**
 * The cells a boss's blow falls on, from where the boss stands at the mark: `open` says where a body could stand, and
 * `rnd` (0 to 1) scatters. A charge's cells run in order, so the last is where the boss ends up.
 */
export function bossAim(move: BossMove, self: Cell, mark: Cell, open: (c: Cell) => boolean, rnd: () => number = Math.random): Cell[] {
  const round = (at: Cell, r: number, keep: (dc: number, dr: number) => boolean = () => true): Cell[] => {
    const out: Cell[] = [];
    for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (keep(dc, dr) && open({ col: at.col + dc, row: at.row + dr })) out.push({ col: at.col + dc, row: at.row + dr });
    return out;
  };
  const [dc, dr] = [mark.col - self.col, mark.row - self.row];
  const n = Math.max(Math.abs(dc), Math.abs(dr));
  switch (move.shape) {
    case "mark":
      return round(mark, move.radius ?? 1);
    case "self":
      return round(self, move.radius ?? 1);
    case "ring":
      return round(self, move.radius ?? 3, (x, y) => Math.max(Math.abs(x), Math.abs(y)) >= (move.inner ?? 2));
    case "front":
      return round(self, move.radius ?? 1, (x, y) => (x !== 0 || y !== 0) && x * dc + y * dr >= 0);
    case "scatter": {
      const near = round(mark, move.radius ?? 2, (x, y) => x !== 0 || y !== 0);
      const picked = open(mark) ? [mark] : [];
      while (picked.length < (move.patches ?? 3) && near.length) picked.push(near.splice(Math.floor(rnd() * near.length), 1)[0]!);
      return picked;
    }
    case "trail": {
      const out: Cell[] = [];
      for (let i = 1; i <= n; i++) {
        const c = { col: self.col + Math.round((dc * i) / n), row: self.row + Math.round((dr * i) / n) };
        if (open(c)) out.push(c);
      }
      return out;
    }
    case "summon": {
      const ring = round(self, 2, (x, y) => Math.max(Math.abs(x), Math.abs(y)) === 2);
      const picked: Cell[] = [];
      while (picked.length < (move.summon?.n ?? 1) && ring.length) picked.push(ring.splice(Math.floor(rnd() * ring.length), 1)[0]!);
      return picked;
    }
    case "line": {
      // Each step of the charge: its centre cell, and the cells abreast of it across its way.
      const out: Cell[] = [];
      const half = Math.floor((move.width ?? 1) / 2);
      const across = Math.abs(dc) >= Math.abs(dr) ? [0, 1] : [1, 0];
      let prev = self;
      for (let i = 1; n > 0 && i <= Math.min(move.tiles ?? 6, n + (move.past ?? Infinity)); i++) {
        const c = { col: self.col + Math.round((dc * i) / n), row: self.row + Math.round((dr * i) / n) };
        if (move.flies ? !open(c) : !canStep(prev, c)) break;
        for (let k = -half; k <= half; k++) {
          const side = { col: c.col + across[0]! * k, row: c.row + across[1]! * k };
          if (k !== 0 && open(side)) out.push(side);
        }
        out.push((prev = c));
      }
      return out;
    }
  }
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
export function swingWait(step: number, cls: HeroClass = "warrior"): number {
  return step >= 3 ? CLASSES[cls].every : CLASSES[cls].chain;
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
  stamina: number;
}

/** Levels bought at a bonfire, by what each raised. */
export type Levels = Record<"hp" | "attack" | "stamina", number>;
export const NO_LEVELS: Levels = { hp: 0, attack: 0, stamina: 0 };
/** What one level adds, `ATLAS.md`'s choice of three. */
export const LEVEL_UP: Levels = { hp: 10, attack: 2, stamina: 10 };

/** Gold for the next level, rising with every one bought, as souls do. */
export function levelCost(levels: Levels): number {
  const n = levels.hp + levels.attack + levels.stamina;
  return Math.round((150 * 1.15 ** n) / 10) * 10;
}

/**
 * What the merchants sell, after the Souls games: upgrades bought once and kept, never a bag of clutter. Keyed by
 * name, which is what a save keeps; each adds to the player's numbers, an edge only on top of the one before.
 */
export const ITEMS = {
  "Smoked Haunch": { cost: 250, adds: { hp: 25 }, about: "Salt meat hung over a harbour fire, enough to keep a wanderer on their feet through one more bad night." },
  "Ember Shard": { cost: 300, adds: { flasks: 1 }, about: "A splinter of the fire that was old before the Grey came. Pressed to a flask, it holds one more draught." },
  "Brenna's Edge": { cost: 400, adds: { attack: 3 }, about: "Brenna ground this edge and will not say on what. It bites deeper than it looks." },
  "Keener Edge": { cost: 800, adds: { attack: 3 }, needs: "Brenna's Edge", about: "Honed again once the warden on the bell roof fell silent, as if the stone had taught it something." },
  "Grey-Iron Edge": { cost: 1200, adds: { attack: 4 }, needs: "Keener Edge", about: "Iron from the chapel's own bell, quenched cold. What it cuts does not quite mend." },
  "Pine Resin": { cost: 450, adds: { flask: 15 }, about: "Sap boiled thick and stirred into the flask. Bitter, but it closes wounds the faster for it." },
  "Banded Shield": { cost: 600, adds: { block: -0.75 }, about: "Oak bound in iron bands. A blow on it jars the arm far less than it ought to." },
  "Kindled Shard": { cost: 900, adds: { flasks: 1 }, about: "A shard of the fire the bull lay on, burning again now it is gone. One more flask." },
  "Prospector's Purse": { cost: 500, adds: { greed: 0.25 }, about: "A dead prospector's purse, never quite full. Coin finds its way into it." },
  // Given by the folk, or sold once their questline goes the hard way; a cost of nothing is never sold.
  "The Forty's Banner": { cost: 0, adds: { hp: 40 }, about: "The forty's banner, kept dry under the one who ran. It has been carried further since." },
  "Ansel's Edge": { cost: 700, adds: { attack: 2 }, about: "The second of two edges a wall sitter paid for. He came back for one." },
  "The Thrown Coin": { cost: 0, adds: { greed: 0.25 }, about: "Thrown down the Old Well to see who would come after. Coin follows it now." },
  "Smuggler's Coat": { cost: 400, adds: { hp: 25 }, about: "Swapped, its last wearer said, deeper in. Nobody down there ever swapped a thing." },
  "Sister's Candle": { cost: 600, adds: { flask: 15 }, about: "A sister's candle, burned down a winter of nights. Its light closes wounds, or seems to." },
  "Hollow Water": { cost: 0, adds: { flasks: 1 }, about: "Lake water from under the fen, clear as glass. The Order's pilgrims drink nothing else. Ferrow would not." },
  "Mum's Bread": { cost: 0, adds: { hp: 20 }, about: "Baked in an east lane oven that sat cold a long while. Mostly ash. Eaten anyway." },
  "Salt-Glass Flask": { cost: 600, adds: { flasks: 1 }, about: "Blown on the salt coast, thick as a thumb. It came in on the first ship in three winters." },
  "Hollis's Gaff": { cost: 0, adds: { attack: 3 }, about: "A fishing gaff, its hook filed to an edge. Lent, not given: the sea wants it back past the Ring." },
  // The gifts: one picked at a new game's start, come ashore with the captain; never sold.
  "Drowned Locket": { cost: 0, adds: { hp: 20 }, about: "Salt in the hinge. Whoever's face was in it, the sea kept. It still sits warm against the chest." },
  "Notched Whetstone": { cost: 0, adds: { attack: 2 }, about: "Worn hollow by a hand that is not yours. An edge kept on it bites a little deeper." },
  "Brine Flask": { cost: 0, adds: { flasks: 1 }, about: "Stoppered tight before the ship went down. One more draught, and it tastes of the sea." },
  "Gull-Picked Purse": { cost: 0, adds: { greed: 0.25 }, about: "The gulls had the coins and left the purse. It has a knack for filling again." },
} as const satisfies Record<string, { cost: number; adds: Partial<Kit>; needs?: string; about: string }>;
export type ItemName = keyof typeof ITEMS;
/** The gifts a new game offers: one taken ashore, kept for the run. */
export const GIFTS: readonly ItemName[] = ["Drowned Locket", "Notched Whetstone", "Brine Flask", "Gull-Picked Purse"];
/** Lent on the Landing, to learn the sack on: gone once the captain is ashore past the Ring. */
export const LENT: readonly ItemName[] = ["Hollis's Gaff"];

/** The player's numbers with their class, what has been bought, and the levels. */
export function kit(bought: ReadonlySet<string>, levels: Levels = NO_LEVELS, cls: HeroClass = "warrior"): Kit {
  const k: Kit = {
    hp: CLASSES[cls].hp + levels.hp * LEVEL_UP.hp,
    attack: CLASSES[cls].attack + levels.attack * LEVEL_UP.attack,
    flasks: HERO.flasks,
    flask: HERO.flask,
    block: STAMINA.block,
    greed: 1,
    stamina: STAMINA.max + levels.stamina * LEVEL_UP.stamina,
  };
  for (const [name, item] of Object.entries(ITEMS)) {
    if (!bought.has(name)) continue;
    for (const [stat, n] of Object.entries(item.adds) as [keyof Kit, number][]) k[stat] += n;
  }
  return k;
}

/** One line of a merchant's stock: on sale once `after`, a boss kind, has fallen, and once `flag`, a world flag, has happened. */
export interface Stock {
  item: ItemName;
  after?: string;
  flag?: WorldFlag;
}

/** What a merchant shows: each line whose boss has fallen and whose lesser edge is owned, bought ones included. */
export function onOffer(stock: readonly Stock[], bought: ReadonlySet<string>, slain: ReadonlySet<string>, flags: ReadonlySet<string>): Stock[] {
  return stock.filter((s) => (!s.after || slain.has(s.after)) && (!s.flag || flags.has(s.flag)) && (!("needs" in ITEMS[s.item]) || bought.has((ITEMS[s.item] as { needs: string }).needs)));
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

/** Stamina after `dt` seconds, `idle` seconds since any was last spent, the shield up or not; never past `max`. */
export function recover(stamina: number, dt: number, idle: number, guarding: boolean, max: number = STAMINA.max): number {
  if (idle < STAMINA.delay) return stamina;
  return Math.min(max, stamina + STAMINA.regen * dt * (guarding ? STAMINA.guarded : 1));
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
