// Room procedures. Milestone 1: seats and polling. Planning, resolution and
// rematch land on top of the same room object.

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CODE_PATTERN } from "../../shared/protocol.ts";

import { guestProcedure, publicProcedure, router } from "../trpc.ts";
import { type RoomData, type RoomRow } from "../schema.ts";
import * as store from "./store.ts";
import { viewFor, type RoomView } from "./view.ts";

const nameSchema = z.string().trim().min(1).max(20);
const codeSchema = z.string().trim().toUpperCase().regex(CODE_PATTERN, "not a room code");

const notFound = (): never => {
  // The same error whether the code never existed or the room has been
  // evicted: there is nothing to tell apart, and nothing to leak.
  throw new TRPCError({ code: "NOT_FOUND", message: "no such room" });
};

/** Load the room and the caller's seat, or fail the way the client expects. */
async function seated(code: string, token: string): Promise<{ row: RoomRow; seat: 0 | 1 }> {
  const row = await store.get(code);
  if (!row) return notFound();
  const seat = store.seatOf(row.data, token);
  if (seat === null) throw new TRPCError({ code: "FORBIDDEN", message: "not your room" });
  return { row, seat };
}

export const roomRouter = router({
  /**
   * A token is issued rather than chosen, so holding one means the server gave
   * it to you. The client keeps it in localStorage and sends it from then on.
   */
  issueToken: publicProcedure.mutation(() => ({ token: store.newToken() })),

  create: guestProcedure
    .input(z.object({ name: nameSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const data: RoomData = {
        seed: store.newSeed(),
        seats: [store.makeSeat(ctx.token, input.name), null],
        battle: null,
        walkover: null,
      };
      // A collision would be a primary key error; six characters over a
      // 32-letter alphabet makes one round of retries plenty.
      for (let tries = 0; tries < 5; tries++) {
        const code = store.newCode();
        try {
          await store.insert({ code, state: "waiting", deadline: null, data });
          const row = await store.get(code);
          return viewFor(row!, 0);
        } catch {
          continue;
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "could not pick a room code" });
    }),

  join: guestProcedure
    .input(z.object({ code: codeSchema, name: nameSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const row = await store.get(input.code);
      if (!row) return notFound();

      // Rejoining your own room is a no-op, not an error: a refresh mid-room
      // lands here, and the room is the unit of truth, not the session.
      const already = store.seatOf(row.data, ctx.token);
      if (already !== null) return viewFor(row, already);

      if (row.state !== "waiting") {
        throw new TRPCError({ code: "CONFLICT", message: "that room is full" });
      }
      const seat = store.freeSeat(row.data);
      if (seat === null) throw new TRPCError({ code: "CONFLICT", message: "that room is full" });

      const seats = [...row.data.seats] as RoomData["seats"];
      seats[seat] = store.makeSeat(ctx.token, input.name);
      const deadline = new Date(Date.now() + store.PLANNING_MS);

      // Conditional on the room still being `waiting`. Two people entering the
      // same code at the same moment: one takes the seat, the other re-reads
      // and is told the room is full.
      const won = await store.update(input.code, "waiting", {
        state: "planning",
        deadline,
        data: { ...row.data, seats },
      });
      if (!won) throw new TRPCError({ code: "CONFLICT", message: "that room is full" });

      const fresh = await store.get(input.code);
      return viewFor(fresh!, seat);
    }),

  /**
   * Drives all polling, and carries the housekeeping with it: the poll is the
   * scheduler, so there is no cron and no sweeper.
   */
  get: guestProcedure
    .input(z.object({ code: codeSchema }))
    .query(async ({ ctx, input }): Promise<RoomView> => {
      const { row, seat } = await seated(input.code, ctx.token);
      void store.evictStale();
      void store.touch(input.code);
      return viewFor(row, seat);
    }),
});
