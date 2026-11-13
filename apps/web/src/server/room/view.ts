// What a caller is allowed to see.
//
// Redaction is a server rule, not a client courtesy: the seed would let a
// client predict every roll, and the other shops are nobody else's business.
// Battles are left out too, so a poll stays small; room.fight fetches one.

import { redactRun, type LobbyRound, type Run } from "@greyfall/engine";

import type { RoomRow, RoomState } from "../schema.ts";

export interface RoomView {
  code: string;
  state: RoomState;
  /** The caller's seat, the index into players and run.seats. */
  seat: number;
  host: boolean;
  players: { name: string; ready: boolean }[];
  /**
   * Time left in planning, from the server. The client counts down from this
   * and re-syncs on every poll: an absolute deadline measured against the
   * device's own clock would show one player 0:00 while another still had
   * twenty seconds.
   */
  msRemaining: number | null;
  /** Null while waiting. Redacted: seed is "", every other seat's shop is []. */
  run: Run | null;
  /** The latest fought round, with every fight's `result` set to null (fetch your own via room.fight). */
  last: LobbyRound | null;
}

export function viewFor(row: RoomRow, seat: number): RoomView {
  const { run, last } = row.data;
  return {
    code: row.code,
    state: row.state,
    seat,
    host: seat === 0,
    players: row.data.players.map((p) => ({ name: p.name, ready: p.ready })),
    msRemaining:
      row.state === "planning" && row.deadline
        ? Math.max(0, row.deadline.getTime() - Date.now())
        : null,
    run: run && redactRun(run, seat),
    last: last && { ...last, fights: last.fights.map((f) => ({ ...f, result: null })) },
  };
}
