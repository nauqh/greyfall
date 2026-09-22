// What a caller is allowed to see.
//
// Redaction is a server rule, not a client courtesy: hiding the opponent's
// army in the UI would not hide it at all. Until the room reaches `result`,
// the other seat is a name and a lock flag and nothing else.

import type { BattleResult, Placement } from "@greyfall/engine";

import type { RoomRow, RoomState } from "../schema.ts";

export interface SeatView {
  name: string;
  locked: boolean;
  /** Only ever set once the room has resolved. */
  army: Placement[] | null;
}

export interface RoomView {
  code: string;
  state: RoomState;
  round: number;
  /** Which seat the caller holds, 0 or 1. */
  seat: 0 | 1;
  you: SeatView & { army: Placement[] };
  opponent: SeatView | null;
  /**
   * Time left in planning, from the server. The client counts down from this
   * and re-syncs on every poll: an absolute deadline measured against the
   * device's own clock would show one player 0:00 while the other still had
   * forty seconds.
   */
  msRemaining: number | null;
  battle: BattleResult | null;
  walkover: "a" | "b" | "draw" | null;
}

export function viewFor(row: RoomRow, seat: 0 | 1): RoomView {
  const done = row.state === "result";
  const you = row.data.seats[seat]!;
  const them = row.data.seats[seat === 0 ? 1 : 0];

  return {
    code: row.code,
    state: row.state,
    round: row.data.round,
    seat,
    you: { name: you.name, locked: you.locked, army: you.army },
    opponent: them ? { name: them.name, locked: them.locked, army: done ? them.army : null } : null,
    msRemaining:
      row.state === "planning" && row.deadline
        ? Math.max(0, row.deadline.getTime() - Date.now())
        : null,
    battle: done ? row.data.battle : null,
    walkover: done ? row.data.walkover : null,
  };
}
