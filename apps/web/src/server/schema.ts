// One table. The room object is stored whole in `data`; only the fields a
// query filters on are columns, because nothing else is ever read without
// reading the rest of the room with it.

import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { BattleResult, Placement } from "@greyfall/engine";

export type RoomState = "waiting" | "planning" | "result" | "closed";

/** One side of a duel. `army` is what the deadline resolves from. */
export interface Seat {
  token: string;
  name: string;
  army: Placement[];
  locked: boolean;
}

export interface RoomData {
  /** Regenerated on creation and on every rematch, so neither player can aim it. */
  seed: number;
  /** Bumped per rematch. The client keys its canvas on it, so a new round
      builds a new game and a poll during one never disturbs it. */
  round: number;
  /** Index 0 is side A, index 1 side B. A free seat is null. */
  seats: [Seat | null, Seat | null];
  /** Set once the room resolves; ~16KB of event log. */
  battle: BattleResult | null;
  /** Set when a side wins without a battle: no legal army at the deadline. */
  walkover: "a" | "b" | "draw" | null;
}

export const rooms = pgTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    state: text("state").$type<RoomState>().notNull(),
    /** Null outside planning. */
    deadline: timestamp("deadline", { withTimezone: true }),
    lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data").$type<RoomData>().notNull(),
  },
  (t) => [index("rooms_last_activity_idx").on(t.lastActivity)],
);

export type RoomRow = typeof rooms.$inferSelect;
