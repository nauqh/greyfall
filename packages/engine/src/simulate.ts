/**
 * The battle simulation. Pure: armies and a seed in, a result and an event log
 * out. No I/O, no clock, no globals, so it runs unchanged on the server.
 *
 * A 5x6 square grid of two 5x3 halves. Side A holds the bottom rows (5,4,3
 * back to front), side B the top, so both front rows meet in the middle.
 * Distance is Chebyshev over the eight neighbours.
 */

import {
  BALANCE,
  MAX_TICKS,
  TICKS_PER_ACTION,
  damageAgainst,
  type UnitClass,
} from "./balance.ts";
import { makeRng } from "./rng.ts";

export type Side = "a" | "b";

/** A unit on its own 5x3 half. Row 0 is the back line, row 2 the front. */
export interface Placement {
  class: UnitClass;
  col: number;
  row: number;
}

export type Army = Placement[];

export type BattleEvent =
  | { t: number; type: "move"; unit: string; col: number; row: number }
  | { t: number; type: "attack"; unit: string; target: string }
  | { t: number; type: "hit"; unit: string; target: string; damage: number; hpAfter: number }
  | { t: number; type: "heal"; unit: string; target: string; amount: number; hpAfter: number }
  | { t: number; type: "death"; unit: string };

/** A unit as it stood when the battle began, for playback and the CLI. */
export interface UnitSnapshot {
  id: string;
  side: Side;
  class: UnitClass;
  maxHp: number;
  col: number;
  row: number;
}

export interface BattleResult {
  winner: Side | "draw";
  reason: "wipe" | "timeout";
  /** Ticks elapsed. Divide by BALANCE.tickRate for seconds. */
  ticks: number;
  hpRemaining: Record<Side, number>;
  survivors: Record<Side, number>;
  units: UnitSnapshot[];
  events: BattleEvent[];
}

interface SimUnit extends UnitSnapshot {
  hp: number;
  /** The tick this unit may next act on. */
  nextAt: number;
}

/**
 * Own cell to shared-grid cell. The halves are point reflections through the
 * board centre; Chebyshev is invariant under that, which is what keeps a
 * mirror match an exact draw.
 */
export function battleRow(side: Side, row: number): number {
  return side === "a" ? BALANCE.board.battleRows - 1 - row : row;
}

export function battleCol(side: Side, col: number): number {
  return side === "a" ? col : BALANCE.board.battleCols - 1 - col;
}

/** The eight neighbours of a square cell: orthogonal and diagonal alike. */
export function neighbors(col: number, row: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dc !== 0 || dr !== 0) out.push({ col: col + dc, row: row + dr });
    }
  }
  return out;
}

/** King moves: a diagonal costs the same as a straight step. */
export function chebyshev(
  a: { col: number; row: number },
  b: { col: number; row: number },
): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function armyCost(army: Army): number {
  return army.reduce((sum, p) => sum + BALANCE.units[p.class].cost, 0);
}

/** Trust boundary: armies arrive from a client. Empty result means legal. */
export function validateArmy(army: Army, budget: number = BALANCE.budget): string[] {
  const errors: string[] = [];
  const { cols, rows, maxUnits } = BALANCE.board;

  if (army.length === 0) errors.push("army is empty");
  if (army.length > maxUnits) errors.push(`army has ${army.length} units, max is ${maxUnits}`);

  const seen = new Set<string>();
  for (const [i, p] of army.entries()) {
    if (!(p.class in BALANCE.units)) errors.push(`unit ${i}: unknown class ${p.class}`);
    if (!Number.isInteger(p.col) || p.col < 0 || p.col >= cols)
      errors.push(`unit ${i}: col ${p.col} is off the board`);
    if (!Number.isInteger(p.row) || p.row < 0 || p.row >= rows)
      errors.push(`unit ${i}: row ${p.row} is off the board`);
    const tile = `${p.col},${p.row}`;
    if (seen.has(tile)) errors.push(`unit ${i}: tile ${tile} is taken`);
    seen.add(tile);
  }

  const cost = armyCost(army);
  if (cost > budget) errors.push(`army costs ${cost} gold, budget is ${budget}`);

  return errors;
}

function build(army: Army, side: Side): SimUnit[] {
  return army.map((p, i) => {
    const stats = BALANCE.units[p.class];
    return {
      id: `${side}${i}`,
      side,
      class: p.class,
      maxHp: stats.hp,
      hp: stats.hp,
      col: battleCol(side, p.col),
      row: battleRow(side, p.row),
      nextAt: 0,
    };
  });
}

/** Lexicographic compare of two target-ranking keys. Lower wins. */
function ranksBetter(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

export function simulate(armyA: Army, armyB: Army, seed: number | string = 0): BattleResult {
  for (const [side, army] of [["a", armyA], ["b", armyB]] as const) {
    const errors = validateArmy(army);
    if (errors.length > 0) throw new Error(`army ${side} is invalid: ${errors.join("; ")}`);
  }

  // No covenants yet, so nothing rolls dice. The seed is threaded through so
  // Phase 2 dodge and burn need no signature change.
  void makeRng(seed);

  const units = [...build(armyA, "a"), ...build(armyB, "b")];
  const snapshots: UnitSnapshot[] = units.map((u) => ({
    id: u.id,
    side: u.side,
    class: u.class,
    maxHp: u.maxHp,
    col: u.col,
    row: u.row,
  }));
  const events: BattleEvent[] = [];

  const alive = (u: SimUnit) => u.hp > 0;
  const clamp = (u: SimUnit) => Math.max(0, Math.min(u.maxHp, u.hp));
  const tileKey = (u: { col: number; row: number }) => `${u.col},${u.row}`;
  const onBoard = (p: { col: number; row: number }) =>
    p.col >= 0 && p.col < BALANCE.board.battleCols && p.row >= 0 && p.row < BALANCE.board.battleRows;

  let ticks = 0;
  let reason: BattleResult["reason"] = "timeout";

  for (let t = 0; t < MAX_TICKS; t++) {
    ticks = t + 1;

    // Every decision in a tick reads the tick's starting state, so units that
    // kill each other both connect and array order grants no free first strike.
    const hpAtStart = units.map((u) => u.hp);
    const aliveAtStart = units.map(alive);
    const startPos = units.map((u) => ({ col: u.col, row: u.row }));
    const occupied = new Set(units.filter(alive).map(tileKey));
    const intents: { i: number; steps: { col: number; row: number }[] }[] = [];

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      if (!aliveAtStart[i] || t < unit.nextAt) continue;

      const stats = BALANCE.units[unit.class];
      const healer = stats.heal > 0;

      // Healers take the most wounded ally, itself included; everyone else the
      // nearest enemy. Every key component survives the point reflection, so a
      // mirror match is never decided by a tie-break.
      let targetIdx = -1;
      let targetKey: number[] = [];
      let targetDist = 0;
      for (let j = 0; j < units.length; j++) {
        const other = units[j]!;
        if (!aliveAtStart[j]) continue;
        if (healer ? other.side !== unit.side : other.side === unit.side) continue;
        if (healer && hpAtStart[j]! >= other.maxHp) continue;

        const pos = startPos[j]!;
        const dist = chebyshev(unit, pos);
        const key = healer
          ? [hpAtStart[j]!, dist, Math.abs(pos.row - unit.row), Math.abs(pos.col - unit.col), j]
          : [dist, Math.abs(pos.row - unit.row), Math.abs(pos.col - unit.col), j];
        if (targetIdx === -1 || ranksBetter(key, targetKey)) {
          targetIdx = j;
          targetKey = key;
          targetDist = dist;
        }
      }

      // A healer with nobody to heal holds position and re-checks next tick.
      if (targetIdx === -1) continue;
      const target = units[targetIdx]!;
      const targetPos = startPos[targetIdx]!;

      if (targetDist <= stats.range) {
        unit.nextAt = t + TICKS_PER_ACTION;
        // Unclamped until the tick ends: clamping as each lands would make the
        // total depend on whether the hit or the heal came first.
        if (healer) {
          const amount = Math.min(stats.heal, target.maxHp - hpAtStart[targetIdx]!);
          target.hp += amount;
          events.push({
            t,
            type: "heal",
            unit: unit.id,
            target: target.id,
            amount,
            hpAfter: clamp(target),
          });
        } else {
          const damage = damageAgainst(unit.class, target.class);
          target.hp -= damage;
          events.push({ t, type: "attack", unit: unit.id, target: target.id });
          events.push({
            t,
            type: "hit",
            unit: unit.id,
            target: target.id,
            damage,
            hpAfter: clamp(target),
          });
        }
        continue;
      }

      // One step toward the target, nearest first. The tie-break flips by side
      // because the reflection maps (col+row, col) to a constant minus itself,
      // so both armies curve around blockers as mirror images.
      const flip = unit.side === "a" ? 1 : -1;
      const steps = neighbors(unit.col, unit.row)
        .filter((s) => onBoard(s) && !occupied.has(tileKey(s)))
        .sort(
          (p, q) =>
            chebyshev(p, targetPos) - chebyshev(q, targetPos) ||
            flip * (p.col + p.row) - flip * (q.col + q.row) ||
            flip * p.col - flip * q.col,
        );
      if (steps.length > 0) intents.push({ i, steps });
    }

    // Moves are granted in rounds: a contested cell goes to nobody and the
    // losers fall back next round. First-come would favour side A; denying with
    // no fallback livelocks two units wanting the same cell every tick.
    const granted = new Map<number, { col: number; row: number }>();
    const taken = new Set<string>();
    const contested = new Set<string>();
    let pending = intents.filter((m) => alive(units[m.i]!));

    for (let round = 0; round < 3 && pending.length > 0; round++) {
      const claims = new Map<string, number[]>();
      for (const m of pending) {
        const step = m.steps.find((s) => !taken.has(tileKey(s)) && !contested.has(tileKey(s)));
        if (step === undefined) continue; // out of options, stays put this tick
        const key = tileKey(step);
        claims.set(key, [...(claims.get(key) ?? []), m.i]);
      }
      const missed: typeof pending = [];
      for (const [key, idxs] of claims) {
        if (idxs.length === 1) {
          const [col, row] = key.split(",").map(Number) as [number, number];
          granted.set(idxs[0]!, { col, row });
          taken.add(key);
        } else {
          contested.add(key);
          missed.push(...pending.filter((m) => idxs.includes(m.i)));
        }
      }
      pending = missed;
    }

    for (const m of intents) {
      const tile = granted.get(m.i);
      if (tile === undefined) continue;
      const unit = units[m.i]!;
      unit.col = tile.col;
      unit.row = tile.row;
      unit.nextAt = t + TICKS_PER_ACTION;
      events.push({ t, type: "move", unit: unit.id, col: tile.col, row: tile.row });
    }

    for (const u of units) u.hp = clamp(u);

    for (let i = 0; i < units.length; i++) {
      if (aliveAtStart[i] && !alive(units[i]!)) {
        events.push({ t, type: "death", unit: units[i]!.id });
      }
    }

    const aliveA = units.some((u) => u.side === "a" && alive(u));
    const aliveB = units.some((u) => u.side === "b" && alive(u));
    if (!aliveA || !aliveB) {
      reason = "wipe";
      break;
    }
  }

  const hpRemaining: Record<Side, number> = { a: 0, b: 0 };
  const survivors: Record<Side, number> = { a: 0, b: 0 };
  for (const u of units) {
    if (!alive(u)) continue;
    hpRemaining[u.side] += u.hp;
    survivors[u.side] += 1;
  }

  // Wipe and timeout are decided the same way: whoever has more HP left.
  const winner: BattleResult["winner"] =
    hpRemaining.a === hpRemaining.b ? "draw" : hpRemaining.a > hpRemaining.b ? "a" : "b";

  return { winner, reason, ticks, hpRemaining, survivors, units: snapshots, events };
}
