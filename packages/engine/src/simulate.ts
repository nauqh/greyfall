/**
 * The battle simulation. A pure function: armies and a seed in, a result and
 * an event log out. No I/O, no clock, no globals, so the browser runs it for
 * previews now and the server runs it for official results in Phase 2.
 *
 * Geometry: a plain square grid. Each side owns a 5x3 half; both halves stack
 * into one 5x6 board. Side A fills the bottom half (battle rows 5,4,3 back to
 * front), side B the top (rows 0,1,2), so both front rows (own row 2) are
 * adjacent across the middle line. Distance is Chebyshev over the eight
 * neighbours, so a diagonal step costs the same as a straight one and range 1
 * means any touching cell.
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
 * Where a side's own cell sits on the shared 5x6 battle grid. The two halves
 * are point reflections of each other through the board centre, so side A
 * keeps its columns and mirrors its rows (bottom half), while side B keeps its
 * rows and mirrors its columns (top half). Both front rows (own row 2) face
 * the middle. Chebyshev distance is invariant under that reflection, which is
 * what lets a mirror match stay an exact draw.
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

/**
 * Chebyshev distance: the number of king moves between two cells, so a
 * diagonal costs the same as a straight step and every one of the eight
 * neighbours is exactly range 1.
 */
export function chebyshev(
  a: { col: number; row: number },
  b: { col: number; row: number },
): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function armyCost(army: Army): number {
  return army.reduce((sum, p) => sum + BALANCE.units[p.class].cost, 0);
}

/**
 * Trust boundary: armies arrive from a client, and in Phase 2 from the
 * database, so check them before they reach the simulation loop. Returns the
 * problems found; an empty array means the army is legal.
 */
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

  // Phase 1 has no covenants, so nothing in the battle rolls dice: no dodge,
  // no burn procs. The seed is threaded through anyway so that adding those in
  // Phase 2 does not change this signature or the call sites.
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

    // Every decision in a tick reads the state as it was at the start of that
    // tick: HP, who is alive, and where everyone stands. So two units that
    // kill each other on the same tick both connect, and no unit gets a free
    // first strike or a free step just for being earlier in the array.
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

      // A healer looks for the most wounded ally, itself included; everyone
      // else looks for the nearest enemy. Every key component is preserved by
      // the board's point reflection - distance, row and column offsets, and
      // the index order, which reads the same from either half - so a mirror
      // match is never decided by a tie-break.
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
        // Damage and healing accumulate unclamped and are squared up at the
        // end of the tick. Clamping each one as it lands would make the total
        // depend on whether the hit or the heal was processed first.
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

      // Out of reach: one step toward the target, over the eight neighbours,
      // ranked by how much closer each one lands. The final tie-break is
      // flipped by side: under the board's point reflection (col, row) maps to
      // (cols-1-col, rows-1-row), so (col+row, col) of a step maps to a
      // constant minus itself. Side A taking the smallest and side B the
      // largest therefore makes both armies curve around blockers as mirror
      // images, instead of both leaning the same way.
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

    // Moves are granted simultaneously as well, in rounds: a tile more than
    // one unit wants goes to nobody, and the units that missed out fall back
    // to their next choice in the following round. Handing a contested tile
    // to whoever came first in the array would quietly favour side A; denying
    // it with no fallback livelocks two units that keep asking for the same
    // tile every tick. Each round depends only on the claim counts, so the
    // outcome does not depend on the order units are iterated in.
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

  // A wipe and a timeout are decided the same way: whoever has more HP left.
  const winner: BattleResult["winner"] =
    hpRemaining.a === hpRemaining.b ? "draw" : hpRemaining.a > hpRemaining.b ? "a" : "b";

  return { winner, reason, ticks, hpRemaining, survivors, units: snapshots, events };
}
