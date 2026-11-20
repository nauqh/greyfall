import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_COOKIE, devKey, hash } from "../key";

// Only back into the dev route, so the login can't be used to bounce anyone elsewhere.
const safeNext = (next: unknown): string =>
  typeof next === "string" && next.startsWith("/atlas/dev/") && !next.startsWith("/atlas/dev/login") ? next : "/atlas/dev";

async function login(form: FormData) {
  "use server";
  const next = safeNext(form.get("next"));
  const key = await devKey();
  const given = await hash(String(form.get("password") ?? ""));
  if (!key || !timingSafeEqual(Buffer.from(given), Buffer.from(key))) {
    redirect(`/atlas/dev/login?wrong&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(DEV_COOKIE, key, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/atlas/dev",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; wrong?: string }> }) {
  const q = await searchParams;
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 16 }}>
      <form action={login} style={{ display: "grid", gap: 12, width: "min(320px, 100%)" }}>
        <label htmlFor="password">Dev password</label>
        <input id="password" name="password" type="password" autoFocus required autoComplete="current-password" />
        <input type="hidden" name="next" value={safeNext(q.next)} />
        {q.wrong !== undefined && <p role="alert">Wrong password.</p>}
        <button className="linkBtn" type="submit">
          Enter
        </button>
      </form>
    </main>
  );
}
