"use client";

// The tRPC client, and the guest token it sends with every call.
//
// The token is issued by the server, not made up here, so holding one means
// the server handed it over. It lives in localStorage: clearing storage makes
// you a new guest, which is the whole of the identity model in this slice.

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";

import type { AppRouter } from "../server/index.ts";
import { TOKEN_HEADER } from "../shared/protocol.ts";

export const api = createTRPCReact<AppRouter>();

const KEY = "greyfall.token";

let cached: string | null = null;

export function storedToken(): string | null {
  if (cached) return cached;
  try {
    cached = window.localStorage.getItem(KEY);
  } catch {
    // Private windows and blocked site data: the session still works, it just
    // will not survive a reload.
    cached = null;
  }
  return cached;
}

export function rememberToken(token: string): void {
  cached = token;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* held in memory for this session only */
  }
}

export function links() {
  return [
    httpBatchLink({
      url: "/api/trpc",
      headers: () => {
        const token = storedToken();
        return token ? { [TOKEN_HEADER]: token } : {};
      },
    }),
  ];
}
