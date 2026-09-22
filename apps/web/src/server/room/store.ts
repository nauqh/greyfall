// Everything that touches the rooms table.
//
// A single Node process made the old in-memory plan race-free by accident:
// no await sat between a read and its write, so nothing could interleave.
// A database means awaits, and therefore real races. Every write that two
// callers can reach at once is a single conditional UPDATE guarded on the
// state it expects to find, and the caller re-reads when it loses.

import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "../db.ts";
import { rooms, type RoomData, type RoomRow, type RoomState, type Seat } from "../schema.ts";

import { CODE_ALPHABET, CODE_LEN } from "../../shared/protocol.ts";

export const PLANNING_MS = 60_000;
const EVICT_AFTER = "2 hours";

export function newCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function newToken(): string {
  // Server-issued, so a token is a credential and not a claim any client can
  // make up. 32 hex characters of crypto randomness.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function emptySeats(): RoomData["seats"] {
  return [null, null];
}

export function seatOf(data: RoomData, token: string): 0 | 1 | null {
  if (data.seats[0]?.token === token) return 0;
  if (data.seats[1]?.token === token) return 1;
  return null;
}

export function freeSeat(data: RoomData): 0 | 1 | null {
  if (data.seats[0] === null) return 0;
  if (data.seats[1] === null) return 1;
  return null;
}

export function makeSeat(token: string, name: string): Seat {
  return { token, name, army: [], locked: false };
}

export async function get(code: string): Promise<RoomRow | null> {
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return row ?? null;
}

export async function insert(row: {
  code: string;
  state: RoomState;
  deadline: Date | null;
  data: RoomData;
}): Promise<void> {
  await db.insert(rooms).values(row);
}

/**
 * Write a room only if it is still in the state the caller read it in.
 *
 * This is the whole concurrency story. Two joins for one seat, or two polls
 * arriving together past the deadline, both funnel through here and exactly
 * one of them sees a row change.
 */
export async function update(
  code: string,
  expected: RoomState,
  next: { state: RoomState; deadline?: Date | null; data: RoomData },
): Promise<boolean> {
  const result = await db
    .update(rooms)
    .set({
      state: next.state,
      ...(next.deadline === undefined ? {} : { deadline: next.deadline }),
      data: next.data,
      lastActivity: new Date(),
    })
    .where(and(eq(rooms.code, code), eq(rooms.state, expected)));
  return (result.rowCount ?? 0) > 0;
}

export async function touch(code: string): Promise<void> {
  await db.update(rooms).set({ lastActivity: new Date() }).where(eq(rooms.code, code));
}

export async function remove(code: string): Promise<void> {
  await db.delete(rooms).where(eq(rooms.code, code));
}

/**
 * Lazy eviction, run off the same poll that does everything else. No cron and
 * no sweeper process: a room nobody is polling is a room nobody is in.
 */
export async function evictStale(): Promise<void> {
  await db
    .delete(rooms)
    .where(lt(rooms.lastActivity, sql`now() - interval '${sql.raw(EVICT_AFTER)}'`));
}
