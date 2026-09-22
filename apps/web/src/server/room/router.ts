// Room procedures. Milestone 1: seats and polling. Planning, resolution and
// rematch land on top of the same room object.

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { BALANCE, UNIT_CLASSES, validateArmy } from "@greyfall/engine";

import { CODE_PATTERN } from "../../shared/protocol.ts";

import { guestProcedure, publicProcedure, router } from "../trpc.ts";
import { type RoomData, type RoomRow } from "../schema.ts";
import * as store from "./store.ts";
import { ready, resolve } from "./resolve.ts";
import { viewFor, type RoomView } from "./view.ts";

const nameSchema = z.string().trim().min(1).max(20);
const codeSchema = z.string().trim().toUpperCase().regex(CODE_PATTERN, "not a room code");

/** The envelope only. The engine checks the game; Zod checks the shape. */
const armySchema = z
  .array(
    z.object({
      class: z.enum(UNIT_CLASSES as unknown as [string, ...string[]]),
      col: z
        .number()
        .int()
        .min(0)
        .max(BALANCE.board.cols - 1),
      row: z
        .number()
        .int()
        .min(0)
        .max(BALANCE.board.rows - 1),
    }),
  )
  .max(BALANCE.board.maxUnits);

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

/**
 * Decide the room if it is owed a decision, and hand back whatever the room
 * is now. The write is conditional on the room still being in planning, so
 * two polls arriving together past the deadline produce one battle between
 * them and the loser simply re-reads the finished room.
 */
async function settle(row: RoomRow): Promise<RoomRow> {
  if (!ready(row)) return row;
  await store.update(row.code, "planning", {
    state: "result",
    deadline: null,
    data: { ...row.data, ...resolve(row.data) },
  });
  return (await store.get(row.code)) ?? row;
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
        round: 0,
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
      return viewFor(await settle(row), seat);
    }),

  /**
   * Autosave. Every board change lands here, so the deadline always has
   * something to resolve from even if the player never locks in.
   */
  setArmy: guestProcedure
    .input(z.object({ code: codeSchema, army: armySchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const { row, seat } = await seated(input.code, ctx.token);
      if (row.state !== "planning") {
        throw new TRPCError({ code: "CONFLICT", message: "planning is over" });
      }
      const mine = row.data.seats[seat]!;
      if (mine.locked) throw new TRPCError({ code: "CONFLICT", message: "you are locked in" });

      // Validated on every write, not only on lock-in. An illegal army left
      // sitting on a room is a wedged room waiting for the deadline.
      const army = input.army as typeof mine.army;
      if (army.length > 0) {
        const errors = validateArmy(army);
        if (errors.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: errors[0]! });
        }
      }

      const seats = [...row.data.seats] as RoomData["seats"];
      seats[seat] = { ...mine, army };
      await store.update(input.code, "planning", {
        state: "planning",
        data: { ...row.data, seats },
      });
      const fresh = await store.get(input.code);
      return viewFor(fresh ?? row, seat);
    }),

  /** Freezes the army already held. There is no separate submission. */
  lock: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const { row, seat } = await seated(input.code, ctx.token);
      if (row.state !== "planning") {
        throw new TRPCError({ code: "CONFLICT", message: "planning is over" });
      }
      const seats = [...row.data.seats] as RoomData["seats"];
      seats[seat] = { ...row.data.seats[seat]!, locked: true };
      await store.update(input.code, "planning", {
        state: "planning",
        data: { ...row.data, seats },
      });

      // Both locked means the fight starts now. Nobody waits out the clock.
      const fresh = (await store.get(input.code)) ?? row;
      return viewFor(await settle(fresh), seat);
    }),

  /** Fresh seed, both armies cleared, both locks cleared, back to planning. */
  rematch: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }): Promise<RoomView> => {
      const { row, seat } = await seated(input.code, ctx.token);
      if (row.state !== "result") {
        throw new TRPCError({ code: "CONFLICT", message: "no battle to rematch" });
      }
      const seats = row.data.seats.map((s) =>
        s === null ? null : { ...s, army: [], locked: false },
      ) as RoomData["seats"];

      // Conditional on `result`, so both players tapping rematch at once
      // starts one new round rather than two.
      await store.update(input.code, "result", {
        state: "planning",
        deadline: new Date(Date.now() + store.PLANNING_MS),
        data: {
          seed: store.newSeed(),
          round: row.data.round + 1,
          seats,
          battle: null,
          walkover: null,
        },
      });
      const fresh = await store.get(input.code);
      return viewFor(fresh ?? row, seat);
    }),

  /**
   * Frees the seat. The last one out closes the room; the one left behind
   * goes back to waiting with their lock cleared, since they are waiting for
   * an opponent again rather than holding a submission against nobody.
   */
  leave: guestProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }): Promise<{ left: true }> => {
      const { row, seat } = await seated(input.code, ctx.token);
      const seats = [...row.data.seats] as RoomData["seats"];
      seats[seat] = null;
      const other = seats[seat === 0 ? 1 : 0];

      if (other === null) {
        await store.remove(input.code);
        return { left: true };
      }
      seats[seat === 0 ? 1 : 0] = { ...other, army: [], locked: false };
      await store.update(input.code, row.state, {
        state: "waiting",
        deadline: null,
        data: { ...row.data, seats, battle: null, walkover: null },
      });
      return { left: true };
    }),
});
