import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MAPPED_AREAS, areaMap } from "../src/areas.ts";
import { ITEMS } from "../src/hero.ts";
import { NPCS } from "../src/npcs.ts";
import { PROLOGUE } from "../src/prologue.ts";

// reach.md rules 11 and 12; "hollow" is left out, as the Hollow Water is a thing's name.
const outside = /\b(feudal|tutorial|boss|quest|npc|zombie|undead|magic|destiny|fate|prophecy)\b|[–—]/i;

const world = join(import.meta.dirname, "../../../docs/world");
const docs = readdirSync(world, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => readFileSync(join(world, d.name, "questline.md"), "utf8"))
  .join("\n");
const said = NPCS.flatMap((n) =>
  [n.greet, n.part, ...[n.talks, ...(n.later ?? []).map((s) => s.talks ?? [])].flat().flatMap((t) => t.lines)]
    .filter(Boolean)
    .map((line) => ({ id: n.id, line })),
);

describe("folk's lines", () => {
  it("are all written in their land's questline.md", () => {
    expect(said.filter(({ line }) => !docs.includes(line))).toEqual([]);
  });

  it("keep to the telling's words", () => {
    expect(said.filter(({ line }) => outside.test(line))).toEqual([]);
  });
});

describe("the rest of the player's text", () => {
  // The prologue, the notes on the ground and the item text, under the same rules as the folk.
  const text = [
    ...PROLOGUE.screens.flat(),
    ...MAPPED_AREAS.flatMap((a) => (areaMap(a).notes ?? []).map((n) => n.text)),
    ...Object.values(ITEMS).map((i) => i.about),
  ];

  it("keeps to the telling's words", () => {
    expect(text.filter((line) => outside.test(line))).toEqual([]);
  });
});
