/**
 * The battle simulation. Pure: armies and a seed in, a result and an event log
 * out. No I/O, no clock, no globals, so it runs unchanged on the server.
 *
 * A 10x3 square grid of two 5x3 halves. Side A holds the left columns (4,3,2
 * back to front), side B the right, so both front columns meet in the middle.
 * Row is a lane and means the same thing for both sides; only column, the
 * forward axis, flips between them. Distance is Chebyshev over the eight
 * neighbours.
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
  | { t: number; type: "death"; unit: string }
  /** Guard and taunt name only the unit; pierce names the second target, whose hit follows. */
  | { t: number; type: "ability"; unit: string; ability: "guard" | "taunt" | "pierce"; target?: string }
  | { t: number; type: "revive"; unit: string; target: string; hpAfter: number };

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
  /** Guard cuts damage for ticks in [guardFrom, guardUntil). */
  guardFrom: number;
  guardUntil: number;
  guardUsed: boolean;
  shots: number;
  reviveUsed: boolean;
  revived: boolean;
  diedAt: number;
}

/** Row is a lane: the same meaning for both sides, no reflection. */
export function battleRow(_side: Side, row: number): number {
  return row;
}

/** Column is the forward axis: side A keeps its own, side B mirrors. */
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
      guardFrom: 0,
      guardUntil: 0,
      guardUsed: false,
      shots: 0,
      reviveUsed: false,
      revived: false,
      diedAt: 0,
    };
  });
}

/** Lexicographic compare of two target-ranking keys. Lower wins. */
function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}

/**
 * Who gets a cell that more than one unit stepped for.
 *
 * Whichever side the cell's own column favours, and then the lowest index on
 * that side. Column parity rather than a fixed side because mirroring a cell
 * flips it - battleCols is even, so col and battleCols-1-col never share a
 * parity - and that is what keeps a mirror match an exact reflection, and so a
 * draw. Granting to the lowest index outright would hand every head-on contest
 * to side A.
 *
 * Granting to nobody, which this used to do, deadlocks two lines facing each
 * other across one free column: every cell either side could step into is
 * contested, so none is ever given out and neither line ever closes. Greedy
 * movement hid that, because a denied unit always had a backward cell to take
 * instead.
 */
function pickClaim(idxs: readonly number[], units: SimUnit[], col: number): number {
  const want: Side = col % 2 === 0 ? "a" : "b";
  const preferred = idxs.filter((i) => units[i]!.side === want);
  return Math.min(...(preferred.length > 0 ? preferred : idxs));
}

function onBoard(p: { col: number; row: number }): boolean {
  const { battleCols, battleRows } = BALANCE.board;
  return p.col >= 0 && p.col < battleCols && p.row >= 0 && p.row < battleRows;
}

/**
 * Where to step to get within `range` of `target`, best first.
 *
 * A breadth-first flood over free cells, so a unit walled in by its own line
 * walks round through another row. The old greedy version took whichever
 * neighbour left it nearest and never checked that this was nearer than where
 * it already stood, so a blocked unit stepped sideways or backwards and paid a
 * full action for it - about a third of all movement on a crowded board.
 *
 * An empty result means there is no route at all. The caller then holds
 * position, which costs nothing, and re-plans next tick against a board that
 * has moved on.
 *
 * `flip` mirrors the tie-breaks with the side, exactly as the ranking keys do,
 * so side B walks side A's route reflected and a mirror match stays a draw.
 */
export function pathSteps(
  from: { col: number; row: number },
  target: { col: number; row: number },
  range: number,
  occupied: ReadonlySet<string>,
  flip: number,
): { col: number; row: number }[] {
  const key = (p: { col: number; row: number }) => `${p.col},${p.row}`;
  const order = (a: { col: number; row: number }, b: { col: number; row: number }) =>
    flip * (a.col - b.col) || a.row - b.row;
  const free = (p: { col: number; row: number }) => onBoard(p) && !occupied.has(key(p));
  const open = (p: { col: number; row: number }) =>
    neighbors(p.col, p.row).filter(free).sort(order);

  if (chebyshev(from, target) <= range) return [];

  // Which of this unit's own neighbours each reached cell came in through.
  // The first step is seeded nearest-the-target first, and every later cell
  // inherits whichever seed reached it, so a unit crossing open ground holds
  // its row instead of sliding to row 0 along an equally short route.
  const toward = (a: { col: number; row: number }, b: { col: number; row: number }) =>
    chebyshev(a, target) - chebyshev(b, target) ||
    Math.abs(a.row - target.row) - Math.abs(b.row - target.row) ||
    order(a, b);

  const via = new Map<string, { col: number; row: number }>();
  const seen = new Set<string>([key(from)]);
  let frontier = open(from).sort(toward);
  for (const s of frontier) {
    via.set(key(s), s);
    seen.add(key(s));
  }

  let best: { col: number; row: number } | undefined;
  while (frontier.length > 0 && best === undefined) {
    // Every cell in a layer is the same number of steps out, so which of them
    // to aim for is settled by the same nearest-first order.
    const goals = frontier.filter((c) => chebyshev(c, target) <= range).sort(toward);
    if (goals.length > 0) {
      best = via.get(key(goals[0]!));
      break;
    }
    const next: { col: number; row: number }[] = [];
    for (const c of frontier) {
      for (const s of open(c)) {
        if (seen.has(key(s))) continue;
        seen.add(key(s));
        via.set(key(s), via.get(key(c))!);
        next.push(s);
      }
    }
    frontier = next;
  }
  if (best === undefined) return [];

  // The route's own first step, then any other free neighbour that is at least
  // strictly closer. Those are only ever fallbacks: the claim rounds below
  // hand a contested cell to nobody, and a unit with one option and no
  // fallback would ask for the same cell every tick forever.
  const here = chebyshev(from, target);
  const rest = open(from).filter((s) => key(s) !== key(best) && chebyshev(s, target) < here);
  return [best, ...rest];
}

export function simulate(armyA: Army, armyB: Army, seed: number | string = 0): BattleResult {
  for (const [side, army] of [["a", armyA], ["b", armyB]] as const) {
    const errors = validateArmy(army);
    if (errors.length > 0) throw new Error(`army ${side} is invalid: ${errors.join("; ")}`);
  }

  const rng = makeRng(seed);

  const units = [...build(armyA, "a"), ...build(armyB, "b")];

  // A random first-action delay breaks the one-second lockstep that made every
  // unit swing on the same tick and pile overkill onto dying targets. Offsets
  // go by army index, the same for both sides, so a mirror match stays a draw.
  const offsets = Array.from({ length: BALANCE.board.maxUnits }, () => rng.int(TICKS_PER_ACTION));
  for (const u of units) u.nextAt = offsets[Number(u.id.slice(1))]!;
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

  const ability = BALANCE.abilities;
  // Guard starts the tick after it is raised, so a hit landing in the same
  // tick does not depend on whether the attacker or the Warrior came first.
  const dealt = (target: SimUnit, raw: number, t: number) =>
    t >= target.guardFrom && t < target.guardUntil ? Math.round(raw * ability.guard.damageTaken) : raw;

  if (ability.taunt.enabled) {
    for (const u of units) {
      if (u.class === "lancer") events.push({ t: 0, type: "ability", unit: u.id, ability: "taunt" });
    }
  }

  let ticks = 0;
  let reason: BattleResult["reason"] = "timeout";

  for (let t = 0; t < MAX_TICKS; t++) {
    ticks = t + 1;

    // Every decision in a tick reads the tick's starting state, so units that
    // kill each other both connect and array order grants no free first strike.
    const hpAtStart = units.map((u) => u.hp);
    const aliveAtStart = units.map(alive);
    const revivedAtStart = units.map((u) => u.revived);
    const startPos = units.map((u) => ({ col: u.col, row: u.row }));
    const occupied = new Set(units.filter(alive).map(tileKey));
    const intents: { i: number; steps: { col: number; row: number }[] }[] = [];
    // Tiles a Monk is raising someone on this tick; nobody may step into them.
    const raising = new Set<string>();

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      if (!aliveAtStart[i] || t < unit.nextAt) continue;

      const stats = BALANCE.units[unit.class];
      const healer = stats.heal > 0;

      if (
        ability.guard.enabled &&
        unit.class === "warrior" &&
        !unit.guardUsed &&
        hpAtStart[i]! < unit.maxHp * ability.guard.hpBelow
      ) {
        unit.guardUsed = true;
        unit.guardFrom = t + 1;
        unit.guardUntil = t + 1 + ability.guard.seconds * BALANCE.tickRate;
        unit.nextAt = t + TICKS_PER_ACTION;
        events.push({ t, type: "ability", unit: unit.id, ability: "guard" });
        continue;
      }

      if (ability.revive.enabled && unit.class === "monk" && !unit.reviveUsed) {
        // The first ally to fall whose tile is still free. Index order is the
        // same on both sides, so a mirror match raises the mirror unit.
        // A cell holding a corpse from each side goes by column parity, as
        // contested steps do; first come would hand it to side A every time.
        const contested = (u: SimUnit) =>
          units.some(
            (o, j) => o.side !== u.side && !aliveAtStart[j] && !revivedAtStart[j] && tileKey(o) === tileKey(u),
          ) && (u.col % 2 === 0 ? "a" : "b") !== u.side;
        const fallen = units
          .filter((u, j) => u.side === unit.side && !aliveAtStart[j] && !u.revived)
          .filter((u) => !occupied.has(tileKey(u)) && !raising.has(tileKey(u)) && !contested(u))
          .sort((x, y) => x.diedAt - y.diedAt)[0];
        if (fallen) {
          unit.reviveUsed = true;
          unit.nextAt = t + TICKS_PER_ACTION;
          fallen.revived = true;
          fallen.hp = Math.round(fallen.maxHp * ability.revive.hp);
          fallen.nextAt = t + TICKS_PER_ACTION;
          raising.add(tileKey(fallen));
          events.push({ t, type: "revive", unit: unit.id, target: fallen.id, hpAfter: fallen.hp });
          continue;
        }
      }

      // Healers rank allies by HP missing, itself included, so a mauled tank
      // outranks a scratched archer. Everyone else ranks enemies by how near
      // they are, then the weakest, so a line whose targets are all equally
      // near focuses one down instead of splitting by lane. Every key
      // component survives the left-right mirror, so a mirror match is never
      // decided by a tie-break.
      const ranked: { j: number; dist: number; key: number[] }[] = [];
      for (let j = 0; j < units.length; j++) {
        const other = units[j]!;
        if (!aliveAtStart[j]) continue;
        if (healer ? other.side !== unit.side : other.side === unit.side) continue;
        if (healer && hpAtStart[j]! >= other.maxHp) continue;

        const pos = startPos[j]!;
        const dist = chebyshev(unit, pos);
        const lane = [Math.abs(pos.row - unit.row), Math.abs(pos.col - unit.col), j];
        const key = healer
          ? [hpAtStart[j]! - other.maxHp, dist, ...lane]
          : [dist, hpAtStart[j]!, ...lane];
        ranked.push({ j, dist, key });
      }
      ranked.sort((x, y) => compareRanks(x.key, y.key));

      // A healer with nobody to heal holds position and re-checks next tick.
      if (ranked.length === 0) continue;

      // Taunted: the Lancers close by come first, and the rest of the ranking
      // only once there is no way to hit or reach any of them.
      const taunting =
        !healer && ability.taunt.enabled
          ? ranked.filter((c) => units[c.j]!.class === "lancer" && c.dist <= ability.taunt.radius)
          : [];
      const tiers = taunting.length > 0 ? [taunting, ranked] : [ranked];

      const flip = unit.side === "a" ? 1 : -1;
      for (const tier of tiers) {
        // The best target that can be hit from where the unit already stands.
        // For an attacker the ranking is by distance, so this is the nearest
        // and nothing else could be in range; for a healer it is the worst
        // hurt within reach, which is what the PRD asks of the Monk.
        const hit = tier.find((c) => c.dist <= stats.range);
        if (hit) {
          const target = units[hit.j]!;
          unit.nextAt = t + TICKS_PER_ACTION;
          // Unclamped until the tick ends: clamping as each lands would make
          // the total depend on whether the hit or the heal came first.
          if (healer) {
            const amount = Math.min(stats.heal, target.maxHp - hpAtStart[hit.j]!);
            target.hp += amount;
            events.push({
              t,
              type: "heal",
              unit: unit.id,
              target: target.id,
              amount,
              hpAfter: clamp(target),
            });
            break;
          }

          const damage = dealt(target, damageAgainst(unit.class, target.class), t);
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

          unit.shots += 1;
          if (ability.pierce.enabled && unit.class === "archer" && unit.shots % ability.pierce.every === 0) {
            const tpos = startPos[hit.j]!;
            const dir = Math.sign(tpos.col - unit.col);
            const behind = units.findIndex(
              (u, j) =>
                aliveAtStart[j] &&
                u.side === target.side &&
                startPos[j]!.col === tpos.col + dir &&
                startPos[j]!.row === tpos.row,
            );
            if (dir !== 0 && behind !== -1) {
              const second = units[behind]!;
              const raw = Math.round(damageAgainst(unit.class, second.class) * ability.pierce.damage);
              const damage2 = dealt(second, raw, t);
              second.hp -= damage2;
              events.push({ t, type: "ability", unit: unit.id, ability: "pierce", target: second.id });
              events.push({
                t,
                type: "hit",
                unit: unit.id,
                target: second.id,
                damage: damage2,
                hpAfter: clamp(second),
              });
            }
          }
          break;
        }

        // Nothing in reach, so walk - to the best target there is actually a
        // route to. Falling down the ranking is what stops a unit walled off
        // from the nearest enemy standing and staring at one it cannot get to.
        let routed = false;
        for (const cand of tier) {
          const steps = pathSteps(unit, startPos[cand.j]!, stats.range, occupied, flip);
          if (steps.length > 0) {
            intents.push({ i, steps });
            routed = true;
            break;
          }
        }
        if (routed) break;
      }
    }

    // Moves are granted in rounds: one unit takes each contested cell and the
    // rest fall back to their next step next round.
    const granted = new Map<number, { col: number; row: number }>();
    const taken = new Set<string>(raising);
    let pending = intents.filter((m) => alive(units[m.i]!));

    for (let round = 0; round < 3 && pending.length > 0; round++) {
      const claims = new Map<string, number[]>();
      for (const m of pending) {
        const step = m.steps.find((s) => !taken.has(tileKey(s)));
        if (step === undefined) continue; // out of options, stays put this tick
        const key = tileKey(step);
        claims.set(key, [...(claims.get(key) ?? []), m.i]);
      }
      const missed: typeof pending = [];
      for (const [key, idxs] of claims) {
        const [col, row] = key.split(",").map(Number) as [number, number];
        const winner = pickClaim(idxs, units, col);
        granted.set(winner, { col, row });
        taken.add(key);
        missed.push(...pending.filter((m) => m.i !== winner && idxs.includes(m.i)));
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
        units[i]!.diedAt = t;
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
