// A screenshot of one page of the running dev server (pnpm dev), for an agent to look at before calling a visual change
// done. pnpm shot <path> [out.png] [wait ms] [--keys k1,k2], e.g. pnpm shot atlas/dev/landing, or "atlas/landing?create"
// for creation. --keys presses playwright key names in order after the wait, to reach a menu: --keys Escape,d,s.
// On the dev route it first waits for the clouds to open (minutes, in headless), then the wait (default 1000ms there);
// --at col,row flies the free camera onto that cell first, in the map's own cells (pnpm area's plus 3 on the surface).
// No leading slash: Git Bash turns one into a Windows path.
// A dev route takes the cookie the middleware wants, hashed from DEV_PASSWORD in apps/web/.env; it is never printed.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const at = args.indexOf("--keys");
const keys = at < 0 ? [] : (args.splice(at, 2)[1] ?? "").split(",").filter(Boolean);
const aim = args.indexOf("--at");
const cell = aim < 0 ? null : (args.splice(aim, 2)[1] ?? "").split(",").map(Number);
const [path = "", out = "shot.png", waitArg] = args;
const dev = /^atlas\/dev(\/(?!login)|\?|$)/.test(path);
const wait = waitArg ?? (dev ? "1000" : "4000");
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
if (dev) await page.waitForFunction(() => window.greyfallShot?.opened, null, { timeout: 150000, polling: 500 });
if (cell) {
  // A 1ms fly: at headless's few frames a second the usual 900ms pan is still under way at the shot.
  await page.evaluate(([c, r]) => window.greyfallShot?.look(c, r, 1), cell);
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(Number(wait));
for (const key of keys) {
  await page.keyboard.press(key);
  // Past a side panel's 300ms delay and 600ms entrance (panel.css .sideDock).
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: out });
await browser.close();
console.log(out);
