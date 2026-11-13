// Everything that touches the rooms table.
//
// A single Node process made the old in-memory plan race-free by accident:
// no await sat between a read and its write, so nothing could interleave.
// A database means awaits, and therefore real races. Every write is a
// read-modify-write of the whole room, made a single UPDATE conditional on
// the version it read, and redone from a fresh read when it loses.

import { TRPCError } from "@trpc/server";
import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "../db.ts";
import { rooms, type RoomData, type RoomRow, type RoomState } from "../schema.ts";

import { CODE_ALPHABET, CODE_LEN } from "../../shared/protocol.ts";

const EVICT_AFTER = "2 hours";

export function newCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** 32 hex characters of crypto randomness. */
function randomHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const newSeed = randomHex;

/** Server-issued, so a token is a credential and not a claim any client can make up. */
export const newToken = randomHex;

export function seatOf(data: RoomData, token: string): number | null {
  const i = data.players.findIndex((p) => p.token === token);
  return i === -1 ? null : i;
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

export interface Next {
  state: RoomState;
  /** Left out to keep the current one. */
  deadline?: Date | null;
  data: RoomData;
}

const TRIES = 5;

/**
 * Read the room, let `change` decide what it becomes, and write that only if
 * nobody else wrote in between; otherwise start over from a fresh read.
 *
 * This is the whole concurrency story: two players buying in the same second
 * both land, one on top of the other. `change` returns null to leave the room
 * as it is, and may throw to refuse. Null when there is no such room.
 */
export async function mutate(code: string, change: (row: RoomRow) => Next | null): Promise<RoomRow | null> {
  for (let tries = 0; tries < TRIES; tries++) {
    const row = await get(code);
    if (!row) return null;
    const next = change(row);
    if (!next) return row;

    const lastActivity = new Date();
    const data = { ...next.data, version: row.data.version + 1 };
    const deadline = next.deadline === undefined ? row.deadline : next.deadline;
    const result = await db
      .update(rooms)
      .set({ state: next.state, deadline, data, lastActivity })
      .where(and(eq(rooms.code, code), sql`(${rooms.data}->>'version')::int = ${row.data.version}`));
    if ((result.rowCount ?? 0) > 0) return { ...row, state: next.state, deadline, data, lastActivity };
  }
  throw new TRPCError({ code: "CONFLICT", message: "the room is busy, try again" });
}

/** Eviction is measured in hours, so a minute-stale lastActivity costs nothing. */
const TOUCH_EVERY_MS = 60_000;
const EVICT_EVERY_MS = 60_000;
let lastEvict = 0;

/** Every poll lands here; only one a minute per room actually writes. */
export async function touch(row: RoomRow): Promise<void> {
  if (Date.now() - row.lastActivity.getTime() < TOUCH_EVERY_MS) return;
  await db.update(rooms).set({ lastActivity: new Date() }).where(eq(rooms.code, row.code));
}

export async function remove(code: string): Promise<void> {
  await db.delete(rooms).where(eq(rooms.code, code));
}

/**
 * Lazy eviction, run off the same poll that does everything else. No cron and
 * no sweeper process: a room nobody is polling is a room nobody is in.
 */
export async function evictStale(): Promise<void> {
  if (Date.now() - lastEvict < EVICT_EVERY_MS) return;
  lastEvict = Date.now();
  await db
    .delete(rooms)
    .where(lt(rooms.lastActivity, sql`now() - interval '${sql.raw(EVICT_AFTER)}'`));
}
