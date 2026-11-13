// Everything that touches the rooms, held in the server process.
//
// A match lasts minutes and dies with the process anyway, so the rooms are a
// Map, not a database: a read and the write that follows it cannot interleave,
// because neither awaits. One process only. Two instances would each hold half
// the rooms, which is why Versus wants a single long-lived node.

import type { RoomData, RoomRow, RoomState } from "../schema.ts";

import { CODE_ALPHABET, CODE_LEN } from "../../shared/protocol.ts";

/** No poll for this long means nobody is in the room. */
const EVICT_AFTER_MS = 2 * 60 * 60 * 1000;
const EVICT_EVERY_MS = 60_000;

interface Rooms {
  map: Map<string, RoomRow>;
  lastEvict: number;
}

// On globalThis so a dev hot reload keeps the rooms that are live.
const global = globalThis as typeof globalThis & { __greyfallRooms?: Rooms };
const rooms = (global.__greyfallRooms ??= { map: new Map(), lastEvict: 0 });

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

export function get(code: string): RoomRow | null {
  const row = rooms.map.get(code) ?? null;
  if (row) row.lastActivity = new Date();
  evictStale();
  return row;
}

export function insert(row: {
  code: string;
  state: RoomState;
  deadline: Date | null;
  data: RoomData;
}): void {
  if (rooms.map.has(row.code)) throw new Error("room code taken");
  rooms.map.set(row.code, { ...row, lastActivity: new Date() });
}

export interface Next {
  state: RoomState;
  /** Left out to keep the current one. */
  deadline?: Date | null;
  data: RoomData;
}

/**
 * Read the room, let `change` decide what it becomes, and write it back.
 * Nothing awaits between the read and the write, so two players acting in the
 * same tick land one after the other, never on top of each other. `change`
 * returns null to leave the room as it is, and may throw to refuse. Null when
 * there is no such room.
 */
export function mutate(code: string, change: (row: RoomRow) => Next | null): RoomRow | null {
  const row = rooms.map.get(code);
  if (!row) return null;
  const next = change(row);
  if (!next) return row;
  const updated: RoomRow = {
    ...row,
    state: next.state,
    deadline: next.deadline === undefined ? row.deadline : next.deadline,
    lastActivity: new Date(),
    data: next.data,
  };
  rooms.map.set(code, updated);
  return updated;
}

export function remove(code: string): void {
  rooms.map.delete(code);
}

/**
 * Lazy eviction, run off the same poll that does everything else. No cron and
 * no sweeper process: a room nobody is polling is a room nobody is in.
 */
export function evictStale(): void {
  const now = Date.now();
  if (now - rooms.lastEvict < EVICT_EVERY_MS) return;
  rooms.lastEvict = now;
  for (const [code, row] of rooms.map) {
    if (now - row.lastActivity.getTime() > EVICT_AFTER_MS) rooms.map.delete(code);
  }
}
