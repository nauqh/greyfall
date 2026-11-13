// The room as it lives in the server process.
//
// A match lasts minutes, so the room is held in memory for its lifetime and
// never written to disk. This file is the shape only; store.ts owns the Map.

import type { LobbyRound, Run } from "@greyfall/engine";

export type RoomState = "waiting" | "planning" | "result" | "closed";

/** A human in the room. Their index is their seat in the run. */
export interface Player {
  token: string;
  name: string;
  /** Ready for the current planning phase. */
  ready: boolean;
}

export interface RoomData {
  /** Server only: with it a client could predict every roll. */
  seed: string;
  players: Player[];
  /** The Skirmish run, from start on. */
  run: Run | null;
  /** The latest fought round, battles included. */
  last: LobbyRound | null;
}

export interface RoomRow {
  code: string;
  state: RoomState;
  /** End of the current planning phase; null outside planning. */
  deadline: Date | null;
  lastActivity: Date;
  data: RoomData;
}
