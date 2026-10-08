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
  AUTO,
  BALANCE,
  MAX_TICKS,
  CHAMPIONS,
  TICKS_PER_ACTION,
  TRAIT_KEYS,
  damageAgainst,
  traitTier,
  type Champion,
  type TraitKey,
} from "./balance.ts";
import { makeRng } from "./rng.ts";

export type Side = "a" | "b";

/** A unit on its own 5x3 half. Row 0 is the back line, row 2 the front. */
export interface Placement {
  class: Champion;
  col: number;
  row: number;
  /** Auto chess star level, 1 to 3. Absent is 1. */
  stars?: number;
}

export type Army = Placement[];

export type BattleEvent =
  | { t: number; type: "move"; unit: string; col: number; row: number }
  | { t: number; type: "attack"; unit: string; target: string }
  | { t: number; type: "hit"; unit: string; target: string; damage: number; hpAfter: number }
  | { t: number; type: "heal"; unit: string; target: string; amount: number; hpAfter: number }
  | { t: number; type: "death"; unit: string }
  /**
   * Guard and taunt name only the unit; pierce, ambush and hex name a target.
   * Splash and cleave come before the extra hits they cause. Reassemble carries
   * the HP the Skull gets up with.
   */
  | {
      t: number;
      type: "ability";
      unit: string;
      ability: "guard" | "taunt" | "pierce" | "splash" | "cleave" | "ambush" | "hex" | "reassemble";
      target?: string;
      hpAfter?: number;
    }
  | { t: number; type: "revive"; unit: string; target: string; hpAfter: number };

/** A unit as it stood when the battle began, for playback and the CLI. */
export interface UnitSnapshot {
  id: string;
  side: Side;
  class: Champion;
  stars: number;
  maxHp: number;
  col: number;
  row: number;
}

/** Skirmish's auto chess passes these; Duel leaves them off and plays the old rules. */
export interface SimOptions {
  budget?: number;
  /** Class traits by how many of a class each side fields. */
  traits?: boolean;
}

export interface BattleResult {
  winner: Side | "draw";
  reason: "wipe" | "timeout";
  /** Ticks elapsed. Divide by BALANCE.tickRate for seconds. */
  ticks: number;
  hpRemaining: Record<Side, number>;
  survivors: Record<Side, number>;
  /** Ids of the units still alive at the end. */
  standing: string[];
  units: UnitSnapshot[];
  events: BattleEvent[];
}

interface SimUnit extends UnitSnapshot {
  hp: number;
  /** Multipliers from stars and traits; all 1 under the old rules. */
  power: number;
  healPower: number;
  damageTaken: number;
  attackTicks: number;
  /** The tick this unit may next act on. */
  nextAt: number;
  /** Guard cuts damage for ticks in [guardFrom, guardUntil). */
  guardFrom: number;
  guardUntil: number;
  guardUsed: boolean;
  shots: number;
  reviveUsed: boolean;
  revived: boolean;
  reassembled: boolean;
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
    if (p.stars !== undefined && ![1, 2, 3].includes(p.stars))
      errors.push(`unit ${i}: ${p.stars} is not a star level`);
    const tile = `${p.col},${p.row}`;
    if (seen.has(tile)) errors.push(`unit ${i}: tile ${tile} is taken`);
    seen.add(tile);
  }

  const cost = armyCost(army);
  if (cost > budget) errors.push(`army costs ${cost} gold, budget is ${budget}`);

  return errors;
}

/** Class counts on a board. */
export function classCounts(army: readonly Placement[]): Record<Champion, number> {
  const counts = Object.fromEntries(CHAMPIONS.map((c) => [c, 0])) as Record<Champion, number>;
  for (const p of army) counts[p.class] += 1;
  return counts;
}

/** What each trait counts on a board: its members' units, or their kinds. */
export function traitCounts(army: readonly Placement[]): Record<TraitKey, number> {
  const counts = classCounts(army);
  return Object.fromEntries(
    TRAIT_KEYS.map((k) => {
      const { members, kinds } = AUTO.traits[k];
      return [k, members.reduce((n, c) => n + (kinds ? Math.min(1, counts[c]) : counts[c]), 0)];
    }),
  ) as Record<TraitKey, number>;
}

function build(army: Army, side: Side, traits: boolean): SimUnit[] {
  const counts = traitCounts(army);
  const live = traits ? TRAIT_KEYS.map((k) => ({ trait: AUTO.traits[k], tier: traitTier(k, counts[k]) })) : [];
  return army.map((p, i) => {
    const stats = BALANCE.units[p.class];
    const stars = p.stars ?? 1;
    const star = AUTO.starPower[stars]!;
    const boost = (effect: string): number =>
      live.reduce(
        (m, { trait, tier }) =>
          tier >= 0 && trait.effect === effect && trait.members.includes(p.class) ? m * trait.values[tier]! : m,
        1,
      );
    const maxHp = Math.round(stats.hp * star * boost("hp"));
    return {
      id: `${side}${i}`,
      side,
      class: p.class,
      stars,
      maxHp,
      hp: maxHp,
      power: star * boost("damage"),
      healPower: star * boost("heal"),
      damageTaken: boost("damageTaken"),
      attackTicks: Math.round(TICKS_PER_ACTION * boost("attackSeconds")),
      col: battleCol(side, p.col),
      row: battleRow(side, p.row),
      nextAt: 0,
      guardFrom: 0,
      guardUntil: 0,
      guardUsed: false,
      shots: 0,
      reviveUsed: false,
      revived: false,
      reassembled: false,
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

export function simulate(
  armyA: Army,
  armyB: Army,
  seed: number | string = 0,
  opts: SimOptions = {},
): BattleResult {
  for (const [side, army] of [["a", armyA], ["b", armyB]] as const) {
    const errors = validateArmy(army, opts.budget);
    if (errors.length > 0) throw new Error(`army ${side} is invalid: ${errors.join("; ")}`);
  }

  const rng = makeRng(seed);

  const traits = opts.traits ?? false;
  const units = [...build(armyA, "a", traits), ...build(armyB, "b", traits)];

  // A random first-action delay breaks the one-second lockstep that made every
  // unit swing on the same tick and pile overkill onto dying targets. Offsets
  // go by army index, the same for both sides, so a mirror match stays a draw.
  const offsets = Array.from({ length: BALANCE.board.maxUnits }, () => rng.int(TICKS_PER_ACTION));
  for (const u of units) u.nextAt = offsets[Number(u.id.slice(1))]!;
  const snapshots: UnitSnapshot[] = units.map((u) => ({
    id: u.id,
    side: u.side,
    class: u.class,
    stars: u.stars,
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
  const dealt = (target: SimUnit, rawIn: number, t: number) => {
    const raw = Math.round(rawIn * target.damageTaken);
    return t >= target.guardFrom && t < target.guardUntil ? Math.round(raw * ability.guard.damageTaken) : raw;
  };
  // The Gnoll's bonus reads the target's HP as the tick began, like every other decision.
  const strike = (unit: SimUnit, target: SimUnit, targetHp: number) => {
    const hunting =
      ability.hunter.enabled && unit.class === "gnoll" && targetHp < target.maxHp * ability.hunter.below;
    return Math.round(damageAgainst(unit.class, target.class) * unit.power * (hunting ? 1 + ability.hunter.bonus : 1));
  };

  if (ability.taunt.enabled) {
    for (const u of units) {
      if (u.class === "lancer") events.push({ t: 0, type: "ability", unit: u.id, ability: "taunt" });
    }
  }

  // Thieves open by leaping beside the enemy furthest back, behind it where there is room.
  if (ability.ambush.enabled) {
    const taken = new Set(units.map(tileKey));
    for (const u of units.filter((x) => x.class === "thief")) {
      // How deep into the enemy half a column is, seen from this Thief's side.
      const back = (col: number) => (u.side === "a" ? col : -col);
      const prey = units
        .filter((x) => x.side !== u.side)
        .sort((x, y) => back(y.col) - back(x.col) || Math.abs(x.row - u.row) - Math.abs(y.row - u.row))[0];
      if (!prey) continue;
      const spot = neighbors(prey.col, prey.row)
        .filter((c) => onBoard(c) && !taken.has(tileKey(c)))
        .sort((x, y) => back(y.col) - back(x.col) || Math.abs(x.row - prey.row) - Math.abs(y.row - prey.row))[0];
      if (!spot) continue;
      taken.delete(tileKey(u));
      taken.add(tileKey(spot));
      u.col = spot.col;
      u.row = spot.row;
      events.push({ t: 0, type: "ability", unit: u.id, ability: "ambush", target: prey.id });
      events.push({ t: 0, type: "move", unit: u.id, col: spot.col, row: spot.row });
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
    // Hexed this tick, applied once every unit has acted so order cannot matter.
    const hexed: number[] = [];

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
          unit.nextAt = t + unit.attackTicks;
          // Unclamped until the tick ends: clamping as each lands would make
          // the total depend on whether the hit or the heal came first.
          if (healer) {
            const amount = Math.min(Math.round(stats.heal * unit.healPower), target.maxHp - hpAtStart[hit.j]!);
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

          const damage = dealt(target, strike(unit, target, hpAtStart[hit.j]!), t);
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
              const raw = Math.round(strike(unit, second, hpAtStart[behind]!) * ability.pierce.damage);
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

          // Splash burns round the target, cleave sweeps round the Minotaur.
          const sweep =
            ability.splash.enabled && unit.class === "torch"
              ? { name: "splash" as const, around: startPos[hit.j]!, share: ability.splash.damage }
              : ability.cleave.enabled && unit.class === "minotaur"
                ? { name: "cleave" as const, around: startPos[i]!, share: ability.cleave.damage }
                : null;
          if (sweep) {
            const caught = units
              .map((u, j) => ({ u, j }))
              .filter(({ u, j }) => j !== hit.j && aliveAtStart[j] && u.side === target.side && chebyshev(startPos[j]!, sweep.around) === 1);
            if (caught.length > 0) events.push({ t, type: "ability", unit: unit.id, ability: sweep.name });
            for (const { u, j } of caught) {
              const extra = dealt(u, Math.round(strike(unit, u, hpAtStart[j]!) * sweep.share), t);
              u.hp -= extra;
              events.push({ t, type: "hit", unit: unit.id, target: u.id, damage: extra, hpAfter: clamp(u) });
            }
          }

          if (ability.hex.enabled && unit.class === "shaman" && unit.shots % ability.hex.every === 0) {
            hexed.push(hit.j);
            events.push({ t, type: "ability", unit: unit.id, ability: "hex", target: target.id });
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

    for (const j of hexed) {
      const u = units[j]!;
      u.nextAt = Math.max(u.nextAt, t + 1) + ability.hex.seconds * BALANCE.tickRate;
    }

    if (ability.regenerate.enabled && t > 0 && t % TICKS_PER_ACTION === 0) {
      for (const [i, u] of units.entries()) {
        if (u.class !== "troll" || !aliveAtStart[i]) continue;
        const amount = Math.min(Math.round(u.maxHp * ability.regenerate.perSecond), u.maxHp - hpAtStart[i]!);
        if (amount <= 0) continue;
        u.hp += amount;
        events.push({ t, type: "heal", unit: u.id, target: u.id, amount, hpAfter: clamp(u) });
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
      const u = units[i]!;
      if (aliveAtStart[i] && !alive(u) && ability.reassemble.enabled && u.class === "skull" && !u.reassembled) {
        u.reassembled = true;
        u.hp = Math.round(u.maxHp * ability.reassemble.hp);
        events.push({ t, type: "ability", unit: u.id, ability: "reassemble", hpAfter: u.hp });
        continue;
      }
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

  const standing = units.filter(alive).map((u) => u.id);
  return { winner, reason, ticks, hpRemaining, survivors, standing, units: snapshots, events };
}
