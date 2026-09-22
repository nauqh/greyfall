import { roomRouter } from "./room/router.ts";
import { router } from "./trpc.ts";

export const appRouter = router({ room: roomRouter });

export type AppRouter = typeof appRouter;
