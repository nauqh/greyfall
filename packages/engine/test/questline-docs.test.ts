import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NPCS } from "../src/npcs.ts";

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

  // reach.md rules 11 and 12; "hollow" is left out, as the Hollow Water is a thing's name.
  it("keep to the telling's words", () => {
    const outside = /\b(feudal|tutorial|boss|quest|npc|zombie|undead|magic|destiny|fate|prophecy)\b|[–—]/i;
    expect(said.filter(({ line }) => outside.test(line))).toEqual([]);
  });
});
