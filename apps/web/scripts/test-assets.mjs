#!/usr/bin/env node
// Fails the build if the fetched pack is missing any file the game loads.
// art.ts is the source of truth for pack paths; the script imports it and
// regexes the remaining .png literals out of the other game sources, since
// those files cannot be imported outside a browser (Phaser needs a DOM).

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(APP_ROOT, "public", "tiny-swords");
const SRC = join(APP_ROOT, "src");
// Every source file that names a pack path directly.
const SOURCES = [
  "game/art.ts",
  "game/sprites.ts",
  "game/BattleScene.ts",
  "game/IntroScene.ts",
  "game/terrain.ts",
  "game/ui.ts",
  "app/page.tsx",
];

const die = (msg) => {
  console.error(`[test-assets] ${msg}`);
  process.exit(1);
};

if (!existsSync(PACK)) die("pack not fetched: run `pnpm assets` first");

const art = await import(pathToFileURL(join(SRC, "game/art.ts")).href);

const wanted = new Set();
for (const p of Object.values(art.PANELS)) wanted.add(p.file);
wanted.add(art.BAR.base);
wanted.add(art.BAR.fill);
wanted.add(art.RIBBON.file);
wanted.add(art.TERRAIN.tileset);
wanted.add(art.TERRAIN.water);
wanted.add(art.TERRAIN.foam);
wanted.add(art.TERRAIN.shadow);
for (const group of Object.values(art.DECOR)) for (const d of group) wanted.add(d.file);
// Buildings name only their file; the faction directory is applied at load.
for (const b of Object.values(art.BUILDINGS))
  for (const dir of ["Blue Buildings", "Red Buildings"]) wanted.add(`Buildings/${dir}/${b.file}`);
wanted.add(art.FX.dust.file);
wanted.add(art.FX.explosion.file);
const seq = (prefix, count, pad) =>
  [...Array(count).keys()].forEach((i) =>
    wanted.add(`${prefix}${pad ? String(i + 1).padStart(2, "0") : i + 1}.png`),
  );
seq(art.CLOUDS.file, art.CLOUDS.count, false);
seq(art.AVATARS.file, art.AVATARS.count, true);
seq(art.ICONS.file, art.ICONS.count, true);

// String literals ending in .png from the sources art.ts cannot cover.
const LITERAL = /["']([^"'\\]+\.png)["']/g;
for (const rel of SOURCES.slice(1)) {
  const text = readFileSync(join(SRC, rel), "utf8");
  for (const [, path] of text.matchAll(LITERAL)) wanted.add(path);
}

// Unit poses are written relative to `Units/<side>/`; both sides load them.
const SIDE = (p) => join(PACK, "Units", "Blue Units", p) && [
  join(PACK, "Units", "Blue Units", p),
  join(PACK, "Units", "Red Units", p),
];

const missing = [];
for (const rel of wanted) {
  if (existsSync(join(PACK, rel))) continue;
  if (rel.includes("/") && SIDE(rel).every((p) => existsSync(p))) continue;
  missing.push(rel);
}

if (missing.length > 0) {
  die(`the pack is missing ${missing.length} file(s) the game loads:\n  ` + missing.join("\n  "));
}
console.log(`[test-assets] ok: all ${wanted.size} referenced files present`);
