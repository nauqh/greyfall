// Room procedures. A room holds one Skirmish run, and every change to it is a
// read-modify-write through store.mutate.

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AUTO, act, newRun, type Fight } from "@greyfall/engine";

import { CODE_PATTERN } from "../../shared/protocol.ts";

import { guestProcedure, publicProcedure, router } from "../trpc.ts";
import type { Player, RoomData, RoomRow } from "../schema.ts";
import * as store from "./store.ts";
import { PLANNING_MS, ownFight, settle } from "./resolve.ts";
import { viewFor, type RoomView } from "./view.ts";

const nameSchema = z.string().trim().min(1).max(20);
const codeSchema = z.string().trim().toUpperCase().regex(CODE_PATTERN, "not a room code");

/** One rival: a Versus run is two seats, both human, no AI clan. */
const SEATS = 2;

/** The envelope only. The engine checks the game; Zod checks the shape. */
const spotSchema = z.union([
  z.object({ bench: z.number().int() }),
  z.object({ col: z.number().int(), row: z.number().int() }),
]);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("buy"), slot: z.number().int().min(0).max(AUTO.shopSlots - 1) }),
  z.object({ type: z.literal("sell"), piece: z.number().int() }),
  z.object({ type: z.literal("reroll") }),
  z.object({ type: z.literal("xp") }),
  z.object({ type: z.literal("move"), piece: z.number().int(), to: spotSchema }),
]);

const notFound = (): never => {
  // The same error whether the code never existed or the room has been
  // evicted: there is nothing to tell apart, and nothing to leak.
  throw new TRPCError({ code: "NOT_FOUND", message: "no such room" });
};

const conflict = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};

function seatIn(row: RoomRow, token: string): number {
  const seat = store.seatOf(row.data, token);
  if (seat === null) throw new TRPCError({ code: "FORBIDDEN", message: "not your room" });
  return seat;
}

const settleNow = (row: RoomRow) => settle(row.state, row.deadline, row.data, Date.now());

/** store.mutate for a caller who must hold a seat; `change` gets that seat. */
async function change(
  code: string,
  token: string,
  fn: (row: RoomRow, seat: number) => store.Next | null,
): Promise<RoomView> {
  let seat = -1;
  const row = await store.mutate(code, (r) => fn(r, (seat = seatIn(r, token))));
  if (!row) return notFound();
  return viewFor(row, seat);
}

const newPlayer = (token: string, name: string): Player => ({ token, name, ready: false });

export const roomRouter = router({
  /**
   * A token is issued rather than chosen, so holding one means the server gave
   * it to you. The client keeps it in localStorage and sends it from then on.
   */
  issueToken: publicProcedure.mutation(() => ({ token: store.newToken() })),

  create: guestProcedure
    .input(z.object({ name: nameSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const data: RoomData = { seed: store.newSeed(), players: [newPlayer(ctx.token, input.name)], run: null, last: null };
      // A collision would be a primary key error; six characters over a
      // 32-letter alphabet makes one round of retries plenty.
      for (let tries = 0; tries < 5; tries++) {
        const code = store.newCode();
        try {
          await store.insert({ code, state: "waiting", deadline: null, data });
          return viewFor({ code, state: "waiting", deadline: null, lastActivity: new Date(), data }, 0);
        } catch {
          continue;
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "could not pick a room code" });
    }),

  join: guestProcedure
    .input(z.object({ code: codeSchema, name: nameSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      let seat = -1;
      const row = await store.mutate(input.code, (r) => {
        // Rejoining your own room is a no-op, not an error: a refresh mid-room
        // lands here, and the room is the unit of truth, not the session.
        const already = store.seatOf(r.data, ctx.token);
        if (already !== null) {
          seat = already;
          return null;
        }
        if (r.state !== "waiting") return conflict("that game has already started");
        if (r.data.players.length >= SEATS) return conflict("that room is full");
        seat = r.data.players.length;
        return { state: "waiting", data: { ...r.data, players: [...r.data.players, newPlayer(ctx.token, input.name)] } };
      });
      if (!row) return notFound();
      return viewFor(row, seat);
    }),

  /**
   * In the lobby, frees the seat, and the last one out closes the room. In a
   * run the seat stays and keeps its board; it just never readies again.
   */
  leave: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }): Promise<{ left: true }> => {
      const row = await store.mutate(input.code, (r) => {
        const seat = seatIn(r, ctx.token);
        if (r.state !== "waiting") return null;
        const players = r.data.players.filter((_, i) => i !== seat);
        return { state: players.length === 0 ? "closed" : "waiting", data: { ...r.data, players } };
      });
      if (!row) return notFound();
      if (row.state === "closed") await store.remove(input.code);
      return { left: true };
    }),

  start: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(({ ctx, input }) =>
      change(input.code, ctx.token, (row, seat) => {
        if (seat !== 0) return conflict("only the host can start");
        if (row.state !== "waiting") return conflict("the game has already started");
        if (row.data.players.length < 2) return conflict("waiting for a second player");
        return {
          state: "planning",
          deadline: new Date(Date.now() + PLANNING_MS),
          data: { ...row.data, run: newRun(row.data.seed, row.data.players.length, SEATS) },
        };
      }),
    ),

  /** One shop or board action. An action that arrives after the clock ran out is dropped, and the round is fought. */
  act: guestProcedure
    .input(z.object({ code: codeSchema, action: actionSchema }))
    .mutation(({ ctx, input }) =>
      change(input.code, ctx.token, (row, seat) => {
        const settled = settleNow(row);
        if (settled) return settled;
        if (row.state !== "planning") return conflict("planning is over");
        const { run, error } = act(row.data.run!, seat, input.action);
        if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
        return { state: "planning", data: { ...row.data, run } };
      }),
    ),

  /** The last human still in to ready starts the fight; nobody waits out the clock. */
  ready: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(({ ctx, input }) =>
      change(input.code, ctx.token, (row, seat) => {
        if (row.state !== "planning") return conflict("planning is over");
        if (row.data.players[seat]!.ready) return settleNow(row);
        const players = row.data.players.map((p, i) => (i === seat ? { ...p, ready: true } : p));
        const data = { ...row.data, players };
        return settle(row.state, row.deadline, data, Date.now()) ?? { state: row.state, data };
      }),
    ),

  /**
   * Drives all polling, and carries the housekeeping with it: the poll is the
   * scheduler, so there is no cron and no sweeper.
   */
  get: guestProcedure
    .input(z.object({ code: codeSchema }))
    .query(async ({ ctx, input }): Promise<RoomView> => {
      let seat = -1;
      const row = await store.mutate(input.code, (r) => {
        seat = seatIn(r, ctx.token);
        return settleNow(r);
      });
      if (!row) return notFound();
      return viewFor(row, seat);
    }),

  /** The caller's own fight from `round`, battle included. Fetched once a round, so polls stay small. */
  fight: guestProcedure
    .input(z.object({ code: codeSchema, round: z.number().int() }))
    .query(async ({ ctx, input }): Promise<Fight | null> => {
      const row = await store.get(input.code);
      if (!row) return notFound();
      const seat = seatIn(row, ctx.token);
      const last = row.data.last;
      return last?.round === input.round ? ownFight(last, seat) : null;
    }),

  /** A fresh seed and a fresh run for the same players. */
  rematch: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(({ ctx, input }) =>
      change(input.code, ctx.token, (row, seat) => {
        if (seat !== 0) return conflict("only the host can start a rematch");
        if (row.state !== "result") return conflict("the game is not over");
        const seed = store.newSeed();
        const players = row.data.players.map((p) => ({ ...p, ready: false }));
        return {
          state: "planning",
          deadline: new Date(Date.now() + PLANNING_MS),
          data: { ...row.data, seed, players, run: newRun(seed, players.length, SEATS), last: null },
        };
      }),
    ),
});
