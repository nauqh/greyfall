#!/usr/bin/env node
// Fails when a stylesheet types a hex colour instead of a globals.css :root
// token (docs/ui/menus.md "Colours"), when a token is defined as itself, or
// when a text token reads under 4.5:1 (WCAG AA) on the paper it sits on.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "src");
// ponytail: whole files skipped while they still hold literals; drop each as it is tokenized.
const UNCHECKED = {
  "app/globals.css": "HUD, talk and lobby rules not yet on tokens (its :root is still checked)",
  "app/atlas/dev.css": "dev panel only",
};
// Black and white only ever feed masks here, never a visible colour.
const ALLOWED = new Set(["#000", "#fff"]);
const OWN = "own colour";
const TEXT_ON_PAPER = [["brown", "bark", "mute", "gold", "good", "bad"], ["paper", "paperRaised"]];
const TEXT_ON_PICKED = [["onPicked", "onPickedNote", "goodOnPicked"], ["brown"]];

const fail = [];
const cssFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : [],
  );

for (const file of cssFiles(SRC)) {
  const name = relative(SRC, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const self = line.match(/^\s*--([\w-]+)\s*:\s*var\(--([\w-]+)\)\s*;/);
    if (self && self[1] === self[2]) fail.push(`${name}:${i + 1} --${self[1]} is defined as itself`);
    if (name in UNCHECKED) return;
    if (line.includes(OWN) || lines[i - 1]?.includes(OWN)) return;
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
      if (!ALLOWED.has(hex.toLowerCase())) fail.push(`${name}:${i + 1} ${hex}: use a :root token, or mark it /* ${OWN}: why */`);
  });
}

const root = readFileSync(join(SRC, "app/globals.css"), "utf8").match(/:root\s*\{([^}]*)\}/)[1];
const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1], m[2]]));

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const [texts, grounds] of [TEXT_ON_PAPER, TEXT_ON_PICKED])
  for (const t of texts)
    for (const g of grounds) {
      if (!tokens[t] || !tokens[g]) {
        fail.push(`globals.css :root has no hex for --${tokens[t] ? g : t}`);
        continue;
      }
      const r = contrast(tokens[t], tokens[g]);
      if (r < 4.5) fail.push(`--${t} on --${g} is ${r.toFixed(2)}:1, under 4.5:1`);
    }

if (fail.length) {
  console.error(`[check-colours]\n${fail.join("\n")}`);
  process.exit(1);
}
console.log("[check-colours] ok");
