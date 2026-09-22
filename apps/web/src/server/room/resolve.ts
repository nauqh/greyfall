// Deciding a room. The only place a battle is run.

import { simulate, validateArmy, type BattleResult, type Placement } from "@greyfall/engine";

import type { RoomData, RoomRow } from "../schema.ts";

export interface Outcome {
  battle: BattleResult | null;
  walkover: "a" | "b" | "draw" | null;
}

/** Whether the engine will accept this seat's army at all. */
function fit(army: Placement[]): boolean {
  return army.length > 0 && validateArmy(army).length === 0;
}

/**
 * Whether the room is owed a decision: both seats ready, or the clock out.
 *
 * Both locked resolves immediately - the deadline is only ever a floor under
 * a stalling or absent opponent, never something two ready players wait out.
 */
export function ready(row: RoomRow): boolean {
  if (row.state !== "planning") return false;
  const both = row.data.seats.every((s) => s?.locked === true);
  const expired = row.deadline !== null && row.deadline.getTime() <= Date.now();
  return both || expired;
}

export function resolve(data: RoomData): Outcome {
  const [a, b] = data.seats;
  const canA = a !== null && fit(a.army);
  const canB = b !== null && fit(b.army);

  // The engine throws on an empty or illegal army rather than returning a
  // loss, so a seat that never fielded one is a walkover and nothing is
  // simulated at all. Resolving it any other way would wedge the room in
  // planning, which is the exact thing the deadline exists to prevent.
  if (!canA && !canB) return { battle: null, walkover: "draw" };
  if (!canA) return { battle: null, walkover: "b" };
  if (!canB) return { battle: null, walkover: "a" };

  try {
    return { battle: simulate(a.army, b.army, data.seed), walkover: null };
  } catch {
    // Both armies passed validateArmy on the way in and again just now, so
    // reaching here is a bug in the engine, not a bad army. It still must not
    // leave the room stuck: the room lands in result either way.
    return { battle: null, walkover: "draw" };
  }
}
