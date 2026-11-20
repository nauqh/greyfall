import { NextResponse, type NextRequest } from "next/server";

import { DEV_COOKIE, devKey } from "./app/atlas/dev/key";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/atlas/dev/login") return NextResponse.next();
  const key = await devKey();
  if (key && req.cookies.get(DEV_COOKIE)?.value === key) return NextResponse.next();
  const login = new URL("/atlas/dev/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = { matcher: "/atlas/dev/:path*" };
