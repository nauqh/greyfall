/**
 * Skirmish as auto chess: a lobby of four clans buys from one shared pool,
 * merges three copies into a star level, places on its half board and fights
 * a paired rival each round until one clan is left. Pure and seeded, like the
 * battle it wraps: the same seed and the same actions give the same run.
 */

import { AUTO, BALANCE, CHAMPIONS, MONSTER_CLASSES, TRAIT_KEYS, traitTier, type Champion, type TraitKey } from "./balance.ts";
import { tilePreference } from "./army.ts";
import { makeRng, type Rng } from "./rng.ts";
import { simulate, traitCounts, type BattleResult, type Placement } from "./simulate.ts";

export interface Piece {
  id: number;
  class: Champion;
  stars: number;
}

export interface BoardPiece extends Piece {
  col: number;
  row: number;
}

/** A bench slot, or a cell on the seat's own 5x3 half. */
export type Spot = { bench: number } | { col: number; row: number };

export interface Seat {
  name: string;
  ai: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  /** Positive for a win streak, negative for a loss streak. */
  streak: number;
  shop: (Champion | null)[];
  bench: (Piece | null)[];
  board: BoardPiece[];
  /** Finishing place once knocked out, or 1 for the clan left standing. */
  place: number | null;
}

export interface Run {
  seed: string;
  round: number;
  seats: Seat[];
  pool: Record<Champion, number>;
  nextId: number;
  /** Every random draw takes the next number, so replays stay in step. */
  draws: number;
  over: boolean;
}

export type RunAction =
  | { type: "buy"; slot: number }
  | { type: "sell"; piece: number }
  | { type: "reroll" }
  | { type: "xp" }
  | { type: "move"; piece: number; to: Spot };

export interface Fight {
  a: number;
  b: number;
  /** Side b is a copy of another clan's board, which takes no damage. */
  ghost: boolean;
  /** Null when a side fielded nobody and there was nothing to fight. */
  result: BattleResult | null;
  winner: number | null;
  damage: number;
}

export interface Income {
  base: number;
  interest: number;
  streak: number;
  win: number;
  prospectors: number;
}

export interface LobbyRound {
  round: number;
  fights: Fight[];
  /** Gold paid to each seat for the next round, null once a seat is out. */
  income: (Income | null)[];
}

export const CLANS = ["Tidewardens", "Emberkin", "Dawnsworn", "The Unwritten"] as const;

export function copies(stars: number): number {
  return 3 ** (stars - 1);
}

export function sellValue(p: Piece): number {
  return AUTO.tier[p.class] * copies(p.stars);
}

export function xpToNext(level: number): number {
  return AUTO.xpToNext[level] ?? Infinity;
}

/** Traits a board switches on or is one unit short of, for the HUD. */
export function traitsOf(board: readonly Placement[]): { key: TraitKey; count: number; tier: number }[] {
  const counts = traitCounts(board);
  return TRAIT_KEYS.filter((k) => counts[k] > 0).map((k) => ({ key: k, count: counts[k], tier: traitTier(k, counts[k]) }));
}

function rng(run: Run): Rng {
  return makeRng(`${run.seed}:${run.draws++}`);
}

function emptySeat(name: string, ai: boolean): Seat {
  return {
    name,
    ai,
    hp: AUTO.startHp,
    gold: AUTO.startGold,
    level: AUTO.startLevel,
    xp: 0,
    streak: 0,
    shop: [],
    bench: Array.from({ length: AUTO.benchSlots }, () => null),
    board: [],
    place: null,
  };
}

/** `humans` seats, from seat 0, wait for actions; the rest are AI clans. */
export function newRun(seed: string | number, humans = 1): Run {
  const run: Run = {
    seed: String(seed),
    round: 1,
    seats: CLANS.slice(0, AUTO.seats).map((name, i) => emptySeat(name, i >= humans)),
    pool: { ...AUTO.pool },
    nextId: 1,
    draws: 0,
    over: false,
  };
  startPlanning(run);
  return run;
}

/** One shop slot: a tier by the seat's level, then a class by copies left. */
function rollSlot(run: Run, seat: Seat, r: Rng): Champion | null {
  const odds = AUTO.odds[seat.level]!;
  const tier = r.weighted(odds.map((w, i) => ({ item: i + 1, weight: w })));
  const inTier = CHAMPIONS.filter((c) => AUTO.tier[c] === tier && run.pool[c] > 0);
  const choices = inTier.length > 0 ? inTier : CHAMPIONS.filter((c) => run.pool[c] > 0);
  if (choices.length === 0) return null;
  return r.weighted(choices.map((c) => ({ item: c, weight: run.pool[c] })));
}

function rollShop(run: Run, seat: Seat): void {
  const r = rng(run);
  seat.shop = Array.from({ length: AUTO.shopSlots }, () => rollSlot(run, seat, r));
}

function owned(seat: Seat): Piece[] {
  return [...seat.board, ...seat.bench.filter((p): p is Piece => p !== null)];
}

function findPiece(seat: Seat, id: number): { piece: Piece; spot: Spot } | null {
  const b = seat.board.find((p) => p.id === id);
  if (b) return { piece: b, spot: { col: b.col, row: b.row } };
  const i = seat.bench.findIndex((p) => p?.id === id);
  return i === -1 ? null : { piece: seat.bench[i]!, spot: { bench: i } };
}

function removePiece(seat: Seat, id: number): void {
  seat.board = seat.board.filter((p) => p.id !== id);
  const i = seat.bench.findIndex((p) => p?.id === id);
  if (i !== -1) seat.bench[i] = null;
}

/** Three of a class at one star become one a star higher, where the board copy stood. */
function merge(seat: Seat): void {
  for (let changed = true; changed; ) {
    changed = false;
    for (const cls of CHAMPIONS) {
      for (const stars of [1, 2]) {
        const same = owned(seat).filter((p) => p.class === cls && p.stars === stars);
        if (same.length < 3) continue;
        const [keep, ...gone] = same.slice(0, 3);
        for (const g of gone) removePiece(seat, g!.id);
        keep!.stars += 1;
        changed = true;
      }
    }
  }
}

function levelUp(seat: Seat): void {
  while (seat.level < AUTO.maxLevel && seat.xp >= xpToNext(seat.level)) {
    seat.xp -= xpToNext(seat.level);
    seat.level += 1;
  }
  if (seat.level >= AUTO.maxLevel) seat.xp = 0;
}

function buy(run: Run, seat: Seat, slot: number): string | null {
  const cls = seat.shop[slot];
  if (!cls) return "That slot is empty.";
  const cost = AUTO.tier[cls];
  if (seat.gold < cost) return "Not enough gold.";
  if (run.pool[cls] <= 0) return "None left in the pool.";
  const free = seat.bench.indexOf(null);
  const completes = owned(seat).filter((p) => p.class === cls && p.stars === 1).length >= 2;
  if (free === -1 && !completes) return "The bench is full.";

  seat.gold -= cost;
  run.pool[cls] -= 1;
  seat.shop[slot] = null;
  // A buy that completes a merge needs no slot of its own: it borrows one past the end.
  const at = free === -1 ? seat.bench.length : free;
  seat.bench[at] = { id: run.nextId++, class: cls, stars: 1 };
  merge(seat);
  const spill = seat.bench[AUTO.benchSlots];
  seat.bench.length = AUTO.benchSlots;
  if (spill) seat.bench[seat.bench.indexOf(null)] = spill;
  return null;
}

function sell(run: Run, seat: Seat, id: number): string | null {
  const found = findPiece(seat, id);
  if (!found) return "No such unit.";
  removePiece(seat, id);
  seat.gold += sellValue(found.piece);
  run.pool[found.piece.class] += copies(found.piece.stars);
  return null;
}

function reroll(run: Run, seat: Seat): string | null {
  if (seat.gold < AUTO.reroll) return "Not enough gold.";
  seat.gold -= AUTO.reroll;
  rollShop(run, seat);
  return null;
}

function buyXp(seat: Seat): string | null {
  if (seat.level >= AUTO.maxLevel) return "Already at the top level.";
  if (seat.gold < AUTO.xpBuy.gold) return "Not enough gold.";
  seat.gold -= AUTO.xpBuy.gold;
  seat.xp += AUTO.xpBuy.xp;
  levelUp(seat);
  return null;
}

function onBoard(to: Spot): to is { col: number; row: number } {
  return "col" in to;
}

function move(seat: Seat, id: number, to: Spot): string | null {
  const found = findPiece(seat, id);
  if (!found) return "No such unit.";
  if (onBoard(to)) {
    if (!Number.isInteger(to.col) || !Number.isInteger(to.row) || to.col < 0 || to.col >= AUTO.board.cols || to.row < 0 || to.row >= AUTO.board.rows)
      return "Off the board.";
  } else if (!Number.isInteger(to.bench) || to.bench < 0 || to.bench >= AUTO.benchSlots) return "Off the bench.";

  const there = onBoard(to)
    ? seat.board.find((p) => p.col === to.col && p.row === to.row)
    : seat.bench[to.bench];
  if (there?.id === id) return null;
  if (onBoard(to) && !onBoard(found.spot) && !there && seat.board.length >= seat.level)
    return `Only ${seat.level} fit on the board at level ${seat.level}.`;

  const { piece, spot } = found;
  removePiece(seat, piece.id);
  if (there) removePiece(seat, there.id);
  const put = (p: Piece, s: Spot): void => {
    const plain = { id: p.id, class: p.class, stars: p.stars };
    if (onBoard(s)) seat.board.push({ ...plain, col: s.col, row: s.row });
    else seat.bench[s.bench] = plain;
  };
  put(piece, to);
  if (there) put(there, spot);
  return null;
}

function apply(run: Run, seat: Seat, a: RunAction): string | null {
  switch (a.type) {
    case "buy":
      return buy(run, seat, a.slot);
    case "sell":
      return sell(run, seat, a.piece);
    case "reroll":
      return reroll(run, seat);
    case "xp":
      return buyXp(seat);
    case "move":
      return move(seat, a.piece, a.to);
  }
}

/** A seat's plan-phase action. The run passed in is never changed. */
export function act(run: Run, seatIndex: number, a: RunAction): { run: Run; error: string | null } {
  const next = structuredClone(run);
  const seat = next.seats[seatIndex];
  if (!seat || seat.place !== null || next.over) return { run, error: "That clan is out." };
  const error = apply(next, seat, a);
  return error ? { run, error } : { run: next, error: null };
}

export function armyOf(seat: Seat): Placement[] {
  return seat.board.map((p) => ({ class: p.class, col: p.col, row: p.row, stars: p.stars }));
}

// --- the AI clans ----------------------------------------------------------

/** Each AI clan leans toward one class, or toward a Horde of different monsters, so they contest the pool differently. */
const FAVOURITE: readonly (Champion | "horde")[] = ["archer", "horde", "lancer", "warrior"];

function targetLevel(round: number): number {
  return round <= 2 ? 2 : round <= 4 ? 3 : round <= 6 ? 4 : round <= 9 ? 5 : round <= 12 ? 6 : round <= 15 ? 7 : 8;
}

function value(p: Piece): number {
  return copies(p.stars) * AUTO.tier[p.class];
}

/** Believable, not optimal: level on a schedule, chase pairs, keep interest, line up melee in front. */
function planAiSeat(run: Run, i: number): void {
  const seat = run.seats[i]!;
  const fav = FAVOURITE[i % FAVOURITE.length]!;
  while (seat.level < targetLevel(run.round) && buyXp(seat) === null);
  const reserve = run.round <= 3 ? 0 : Math.min(30, (run.round - 3) * 10);

  for (let rolls = 0; rolls < 3; rolls++) {
    const score = (cls: Champion): number => {
      const have = owned(seat).filter((p) => p.class === cls && p.stars < 3).length;
      const monster = (MONSTER_CLASSES as readonly Champion[]).includes(cls);
      const leaning = fav === "horde" ? (monster ? 2 + (have === 0 ? 2 : 0) : 0) : cls === fav ? 2 : 0;
      return have * 3 + leaning + AUTO.tier[cls];
    };
    const slots = seat.shop
      .map((cls, slot) => ({ cls, slot }))
      .filter((s): s is { cls: Champion; slot: number } => s.cls !== null)
      .sort((x, y) => score(y.cls) - score(x.cls));
    for (const { cls, slot } of slots) {
      const pairs = owned(seat).filter((p) => p.class === cls && p.stars === 1).length;
      const room = owned(seat).length < seat.level + 3 || pairs >= 2;
      if (!room) continue;
      if (seat.gold - AUTO.tier[cls] < reserve && pairs < 2) continue;
      buy(run, seat, slot);
    }
    if (run.round < 6 || seat.gold < reserve + 12) break;
    reroll(run, seat);
  }

  // Best pieces fight; melee takes the front cells, ranged the back.
  const all = owned(seat).sort((x, y) => value(y) - value(x) || x.id - y.id);
  seat.board = [];
  seat.bench = Array.from({ length: AUTO.benchSlots }, () => null);
  const taken = new Set<string>();
  const fighting = all.slice(0, seat.level).sort((x, y) => (x.class === "monk" ? 1 : 0) - (y.class === "monk" ? 1 : 0));
  for (const p of fighting) {
    const tile = tilePreference(BALANCE.units[p.class].range <= 1, AUTO.board).find((t) => !taken.has(`${t.col},${t.row}`))!;
    taken.add(`${tile.col},${tile.row}`);
    seat.board.push({ ...p, col: tile.col, row: tile.row });
  }
  const rest = all.slice(seat.level);
  for (const [k, p] of rest.entries()) {
    if (k < AUTO.benchSlots) seat.bench[k] = { id: p.id, class: p.class, stars: p.stars };
    else sell(run, seat, p.id);
  }
}

function startPlanning(run: Run): void {
  for (const [i, seat] of run.seats.entries()) {
    if (seat.place !== null) continue;
    rollShop(run, seat);
    if (seat.ai) planAiSeat(run, i);
  }
}

// --- the round -------------------------------------------------------------

function survivingStars(result: BattleResult, side: "a" | "b"): number {
  const standing = new Set(result.standing);
  return result.units.filter((u) => u.side === side && standing.has(u.id)).reduce((n, u) => n + u.stars, 0);
}

function pairUp(run: Run, alive: number[]): { a: number; b: number; ghost: boolean }[] {
  const r = rng(run);
  const order = [...alive];
  for (let k = order.length - 1; k > 0; k--) {
    const j = r.int(k + 1);
    [order[k], order[j]] = [order[j]!, order[k]!];
  }
  const pairs: { a: number; b: number; ghost: boolean }[] = [];
  for (let k = 0; k + 1 < order.length; k += 2) {
    const [x, y] = [order[k]!, order[k + 1]!];
    pairs.push({ a: Math.min(x, y), b: Math.max(x, y), ghost: false });
  }
  if (order.length % 2 === 1) {
    const odd = order[order.length - 1]!;
    pairs.push({ a: odd, b: r.pick(alive.filter((s) => s !== odd)), ghost: true });
  }
  return pairs;
}

/** Every clan still in fights; losers bleed, the knocked out are placed, and the next plan phase opens. */
export function fightRound(prev: Run): { run: Run; report: LobbyRound } {
  const run = structuredClone(prev);
  const alive = run.seats.flatMap((s, i) => (s.place === null ? [i] : []));
  const fights: Fight[] = [];
  const won = new Set<number>();

  for (const [k, { a, b, ghost }] of pairUp(run, alive).entries()) {
    const [armyA, armyB] = [armyOf(run.seats[a]!), armyOf(run.seats[b]!)];
    const base = AUTO.damage.base + Math.floor(run.round / AUTO.damage.perRounds);
    let result: BattleResult | null = null;
    let winner: number | null = null;
    let damage = 0;
    if (armyA.length > 0 && armyB.length > 0) {
      result = simulate(armyA, armyB, `${run.seed}:r${run.round}:${k}`, { budget: Infinity, traits: true, board: AUTO.board, skills: true });
      if (result.winner !== "draw") {
        winner = result.winner === "a" ? a : b;
        damage = base + survivingStars(result, result.winner);
      }
    } else if (armyA.length + armyB.length > 0) {
      winner = armyA.length > 0 ? a : b;
      damage = base + (winner === a ? armyA : armyB).reduce((n, p) => n + (p.stars ?? 1), 0);
    }
    const loser = winner === null ? null : winner === a ? b : a;
    if (loser !== null && !(ghost && loser === b)) run.seats[loser]!.hp -= damage;
    for (const [s, isWinner] of [[a, winner === a], [b, winner === b]] as const) {
      if (ghost && s === b) continue;
      const seat = run.seats[s]!;
      if (winner === null) continue;
      seat.streak = isWinner ? Math.max(0, seat.streak) + 1 : Math.min(0, seat.streak) - 1;
      if (isWinner) won.add(s);
    }
    fights.push({ a, b, ghost, result, winner, damage });
  }

  // The deepest in the red places last; one clan left standing takes first.
  const out = alive.filter((i) => run.seats[i]!.hp <= 0).sort((x, y) => run.seats[x]!.hp - run.seats[y]!.hp);
  let place = alive.length;
  for (const i of out) run.seats[i]!.place = place--;
  const left = alive.filter((i) => run.seats[i]!.place === null);
  if (left.length <= 1) {
    for (const i of left) run.seats[i]!.place = 1;
    if (left.length === 0 && out.length > 0) run.seats[out[out.length - 1]!]!.place = 1;
    run.over = true;
  }

  const income = run.seats.map((seat, i): Income | null => {
    if (seat.place !== null) return null;
    const pawns = traitCounts(armyOf(seat)).pawn;
    const tier = traitTier("pawn", pawns);
    const pay: Income = {
      base: AUTO.income,
      interest: Math.min(AUTO.interestMax, Math.floor(seat.gold / 10)),
      streak: AUTO.streakGold[Math.min(Math.abs(seat.streak), AUTO.streakGold.length - 1)]!,
      win: won.has(i) ? AUTO.winGold : 0,
      prospectors: tier >= 0 ? AUTO.traits.pawn.values[tier]! : 0,
    };
    seat.gold += pay.base + pay.interest + pay.streak + pay.win + pay.prospectors;
    seat.xp += AUTO.xpPerRound;
    levelUp(seat);
    return pay;
  });

  const report: LobbyRound = { round: run.round, fights, income };
  if (!run.over) {
    run.round += 1;
    startPlanning(run);
  }
  return { run, report };
}
