// tRPC setup. The only thing a request carries is the guest token, in a
// header; there is nothing else to authenticate with in this slice.

import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { TOKEN_HEADER } from "../shared/protocol.ts";

export { TOKEN_HEADER } from "../shared/protocol.ts";

export interface Context {
  /** Null until the client has been issued one. */
  token: string | null;
}

export function createContext({ req }: FetchCreateContextFnOptions): Context {
  return { token: req.headers.get(TOKEN_HEADER) };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Everything but `guest.issue` needs a token to say who is acting. */
export const guestProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "no guest token" });
  }
  return next({ ctx: { token: ctx.token } });
});
