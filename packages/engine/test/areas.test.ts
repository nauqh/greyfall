import { describe, expect, it } from "vitest";

import { FLYING, MAPPED_AREAS, SEA_KINDS, WATER_ART, areaMap, castsCliff, cellKey, footprint, isSlope, isWalkable, level, stepsFrom, useIsland, type Cell } from "../src/index.ts";

function reach(from: Cell): Set<number> {
  const seen = new Set([cellKey(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const n of stepsFrom(queue[i]!)) {
      if (seen.has(cellKey(n))) continue;
      seen.add(cellKey(n));
      queue.push(n);
    }
  }
  return seen;
}

describe.each(MAPPED_AREAS)("the %s area map", (id) => {
  const m = areaMap(id);

  it("is a whole rectangle of tiles, every exit and every height walkable from the entry", () => {
    expect(m.island.rows.every((l) => l.length === m.island.rows[0]!.length)).toBe(true);
    useIsland(m.island);
    const all = reach(m.entry);
    for (const e of m.exits) expect(all.has(cellKey(e.at)), `${e.name} at ${e.at.col},${e.at.row}`).toBe(true);
    m.island.rows.forEach((line, r) =>
      [...line].forEach((ch, c) => {
        if ("#^45".includes(ch) && isWalkable(c, r)) expect(all.has(cellKey({ col: c, row: r })), `${ch} at ${c},${r}`).toBe(true);
      }),
    );
  });

  it("keeps every bridge deck raised, and every tile of land in a district", () => {
    useIsland(m.island);
    for (const d of m.decks) expect(level(d.col, d.row) >= 2 || isSlope(d.col, d.row), `deck at ${d.col},${d.row}`).toBe(true);
    m.areaAt.forEach((line, r) => [...line].forEach((ch, c) => ch !== "-" && expect(m.districtAt[r]![c], `${c},${r}`).not.toBe("-")));
  });

  it("walks every walker's beat on foot, round the cliffs and by the stairs", () => {
    useIsland(m.island);
    for (const d of m.dwellers) if (d.to && !SEA_KINDS.has(d.kind) && !FLYING.has(d.kind)) expect(reach(d).has(cellKey(d.to)), `${d.kind} at ${d.col},${d.row}`).toBe(true);
  });

  it("stands every building wholly on its ground, clear of edges and of each other", () => {
    useIsland(m.island);
    const under = new Set<string>();
    for (const p of m.props) {
      const name = `${p.art} at ${p.col},${p.row}`;
      const wet = WATER_ART.has(p.art);
      const base = level(p.col, p.row);
      for (const c of footprint(p)) {
        if (wet) expect(m.island.rows[c.row]![c.col], `${name}: hull over ${c.col},${c.row}`).toBe("~");
        else expect(isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && level(c.col, c.row) === base, `${name}: base over ${c.col},${c.row}`).toBe(true);
        expect(under.has(`${c.col},${c.row}`), `${name} overlaps`).toBe(false);
        under.add(`${c.col},${c.row}`);
      }
      if (wet) continue;
      for (const c of footprint(p, true)) {
        expect(m.island.rows[c.row]![c.col] !== "~" && !isSlope(c.col, c.row) && level(c.col, c.row) === base && !castsCliff(c.col, c.row - 1), `${name}: edge at ${c.col},${c.row}`).toBe(true);
      }
    }
  });
});

it("raises the harbour's citadel in terraces up to its keep", () => {
  const m = areaMap("harbour");
  useIsland(m.island);
  const castle = m.props.find((p) => p.art === "castle")!;
  expect(level(castle.col, castle.row)).toBe(4);
});
