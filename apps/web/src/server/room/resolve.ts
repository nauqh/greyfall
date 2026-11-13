// Settling a round. The only place a battle is run. Pure, so it can run again
// on a fresh read when a write loses its race.

import { BALANCE, fightRound, type Fight, type LobbyRound } from "@greyfall/engine";

import type { RoomData, RoomState } from "../schema.ts";
import type { Next } from "./store.ts";

export const PLANNING_MS = 30_000;

/** The fight a seat watches. A ghost copy of its board on side b is not its fight. */
export function ownFight(report: LobbyRound, seat: number): Fight | null {
  return report.fights.find((f) => f.a === seat || (f.b === seat && !f.ghost)) ?? null;
}

function alive(data: RoomData): number[] {
  return data.players.flatMap((_, i) => (data.run!.seats[i]!.place === null ? [i] : []));
}

/**
 * Whether planning is over: every human still in has readied, or the clock
 * ran out. Knocked-out seats are never waited on.
 */
export function owed(state: RoomState, deadline: Date | null, data: RoomData, now: number): boolean {
  if (state !== "planning" || !data.run) return false;
  const everyone = alive(data).every((i) => data.players[i]!.ready);
  return everyone || (deadline !== null && deadline.getTime() <= now);
}

/** The room after the round it is owed, or null if it is owed nothing. */
export function settle(state: RoomState, deadline: Date | null, data: RoomData, now: number): Next | null {
  if (!owed(state, deadline, data, now)) return null;

  const { run, report } = fightRound(data.run!);

  const players = data.players.map((p) => ({ ...p, ready: false }));
  const next = { ...data, players, run, last: report };
  if (run.over) return { state: "result", deadline: null, data: next };

  // Nobody plans while still watching their own fight play out.
  const watching = data.players.map((_, i) => {
    const ticks = ownFight(report, i)?.result?.ticks ?? 0;
    return Math.min(ticks / BALANCE.tickRate, BALANCE.timeoutSeconds) * 1000;
  });
  return { state: "planning", deadline: new Date(now + Math.max(0, ...watching) + PLANNING_MS), data: next };
}
