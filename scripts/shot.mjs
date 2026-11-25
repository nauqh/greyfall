// A screenshot of one page of the running dev server (pnpm dev), for an agent to look at before calling a visual change
// done. pnpm shot <path> [out.png] [wait ms], e.g. pnpm shot atlas/dev/landing, or "atlas/landing?create" for creation.
// No leading slash: Git Bash turns one into a Windows path.
// A dev route takes the cookie the middleware wants, hashed from DEV_PASSWORD in apps/web/.env; it is never printed.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const [path = "", out = "shot.png", wait = "4000"] = process.argv.slice(2);
const base = process.env.SHOT_BASE ?? "http://localhost:3000";
const env = (() => {
  try {
    return readFileSync(new URL("../apps/web/.env", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();
const password = process.env.DEV_PASSWORD ?? env.match(/^DEV_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (password) await context.addCookies([{ name: "greyfall-dev", value: createHash("sha256").update(password).digest("hex"), url: base }]);
const page = await context.newPage();
await page.goto(new URL(path, `${base}/`).href);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log(out);
