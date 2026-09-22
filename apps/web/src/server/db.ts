// Neon over HTTP: one round trip per query, no socket to keep alive, and the
// same code on a long-running host or a serverless one, so the hosting choice
// stays open. It cannot do transactions, which costs nothing here - every
// write that races is a single conditional UPDATE.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const db = drizzle(neon(url), { schema });
