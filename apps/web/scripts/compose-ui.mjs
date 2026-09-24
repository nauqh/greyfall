#!/usr/bin/env node
// The kit's nine-slices are spread over a sheet with empty bands between the
// pieces, which CSS border-image cannot read: it takes its slices from the
// edges of the source, so it would cut gap as often as art. ui.ts already
// packs them edge to edge for Phaser at runtime; this does the same thing on
// disk, so the DOM half of the game can be dressed in the same art.
//
// Output lands under public/tiny-swords/ui/, which is inside the gitignored
// pack directory: these are derived pack art and must not be committed either.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(APP_ROOT, "public", "tiny-swords");
const OUT = join(PACK, "ui");

if (!existsSync(join(PACK, "Units"))) {
  console.log("[compose-ui] pack not fetched; nothing to compose");
  process.exit(0);
}

const art = await import(pathToFileURL(join(APP_ROOT, "src", "game", "art.ts")).href);

const read = (rel) => PNG.sync.read(readFileSync(join(PACK, rel)));

/** Blit a rectangle of `src` into `dst`, keeping alpha as-is. */
function blit(dst, src, sx, sy, w, h, dx, dy) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((sy + y) * src.width + (sx + x)) * 4;
      const d = ((dy + y) * dst.width + (dx + x)) * 4;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = src.data[s + 3];
    }
  }
}

function write(name, png) {
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  return `${name}.png ${png.width}x${png.height}`;
}

/** A gapped nine-slice sheet, packed into one contiguous frame. */
function nineSlice(spec) {
  const src = read(spec.file);
  const w = spec.colW[0] + spec.colW[1] + spec.colW[2];
  const h = spec.rowH[0] + spec.rowH[1] + spec.rowH[2];
  const out = new PNG({ width: w, height: h });
  let dy = 0;
  for (let r = 0; r < 3; r++) {
    let dx = 0;
    for (let c = 0; c < 3; c++) {
      blit(out, src, spec.colX[c], spec.rowY[r], spec.colW[c], spec.rowH[r], dx, dy);
      dx += spec.colW[c];
    }
    dy += spec.rowH[r];
  }
  return out;
}

/** The slate title ribbon: three 64px pieces off one row of SmallRibbons. */
function ribbon() {
  const R = art.RIBBON;
  const src = read(R.file);
  const out = new PNG({ width: R.w * 3, height: R.h });
  blit(out, src, 0, R.rowY, R.w, R.h, 0, 0);
  blit(out, src, R.midX, R.rowY, R.w, R.h, R.w, 0);
  blit(out, src, R.rightX, R.rowY, R.w, R.h, R.w * 2, 0);
  return out;
}

/** First row from the top with opaque art. */
function alphaTop(png) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > 10) return y;
    }
  }
  return 0;
}

/** Shift every row up by n rows, clearing what vacates the bottom. */
function shiftUp(png, n) {
  const row = png.width * 4;
  png.data.copy(png.data, 0, row * n, row * png.height);
  png.data.fill(0, row * (png.height - n));
}

mkdirSync(OUT, { recursive: true });

const made = [];
for (const [name, spec] of Object.entries(art.PANELS)) {
  const png = nineSlice(spec);
  // The pressed sheets draw their art lower in the canvas than the regular
  // ones, which would make the DOM border-image swap jump down on hover.
  // Align the top rim to the regular sheet's so the swap is seamless.
  const up = name.replace(/Down$/, "");
  if (up !== name && art.PANELS[up]) shiftUp(png, alphaTop(png) - alphaTop(nineSlice(art.PANELS[up])));
  made.push(write(name, png));
}
made.push(write("ribbon", ribbon()));
// Banner_Slots is already contiguous (192px, 64px corners), just copied here
// so the CSS has one directory.
made.push(write("bannerSlots", read("UI Elements/UI Elements/Banners/Banner_Slots.png")));

// One icon per file already, but copied here so the CSS has one directory.
// ICON_FILES names the pack file directly; the numbered ones live in the
// Icons sheet.
for (const [key, n] of Object.entries(art.ICON)) {
  const src = read(art.ICON_FILES[n] ?? `${art.ICONS.file}${n}.png`);
  made.push(write(`icon_${key}`, src));
}

console.log(`[compose-ui] wrote ${made.length} files to public/tiny-swords/ui`);
