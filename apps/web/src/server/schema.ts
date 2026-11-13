// One table. The room object is stored whole in `data`; only the fields a
// query filters on are columns, because nothing else is ever read without
// reading the rest of the room with it.

import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  /** Bumped on every write; each write is conditional on the one it read. */
  version: number;
  players: Player[];
  /** The Skirmish run, from start on. */
  run: Run | null;
  /** The latest fought round, battles included. */
  last: LobbyRound | null;
}

export const rooms = pgTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    state: text("state").$type<RoomState>().notNull(),
    /** End of the current planning phase; null outside planning. */
    deadline: timestamp("deadline", { withTimezone: true }),
    lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").$type<RoomData>().notNull(),
  },
  (t) => [index("rooms_last_activity_idx").on(t.lastActivity)],
);

export type RoomRow = typeof rooms.$inferSelect;
