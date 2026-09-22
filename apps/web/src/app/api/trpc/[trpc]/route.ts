import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "../../../../server/index.ts";
import { createContext } from "../../../../server/trpc.ts";

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({ endpoint: "/api/trpc", req, router: appRouter, createContext });

export { handler as GET, handler as POST };
