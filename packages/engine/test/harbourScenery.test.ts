import { expect, it } from "vitest";

import { areaMap, cellKey, isSlope, isWalkable, solidCells, stepsFrom, useIsland, type Cell } from "../src/index.ts";

const m = areaMap("harbour");

function reach(shut: ReadonlySet<string>): number {
  const seen = new Set([cellKey(m.entry)]);
  const queue = [m.entry];
  for (let i = 0; i < queue.length; i++) {
    for (const n of stepsFrom(queue[i]!)) {
      if (seen.has(cellKey(n)) || shut.has(`${n.col},${n.row}`)) continue;
      seen.add(cellKey(n));
      queue.push(n);
    }
  }
  return seen.size;
}

const scenery = m.props.filter((p) => ["tree", "rock", "bush"].includes(p.art)).map((p): Cell & { art: string } => ({ art: p.art, col: Math.round(p.col), row: Math.round(p.row) }));

it("keeps the Harbour's trees, rocks and bushes off its stairs' landings", () => {
  useIsland(m.island);
  const onStair = scenery.filter((p) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => isSlope(p.col + dc, p.row + dr))));
  expect(onStair).toEqual([]);
});

it("shuts no ground off behind a Harbour tree", () => {
  useIsland(m.island);
  const solid = solidCells(m);
  const all = reach(solid);
  const sealing = scenery.filter((p) => p.art === "tree" && isWalkable(p.col, p.row)).filter((p) => {
    const without = new Set(solid);
    without.delete(`${p.col},${p.row}`);
    return reach(without) > all + 1;
  });
  expect(sealing).toEqual([]);
});

it("stands no Harbour tree across a way, where walking round it costs more than a step or two", () => {
  useIsland(m.island);
  const solid = solidCells(m);
  const dist = (from: Cell, shut: ReadonlySet<string>): Map<number, number> => {
    const d = new Map([[cellKey(from), 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (const n of stepsFrom(queue[i]!)) {
        if (d.has(cellKey(n)) || shut.has(`${n.col},${n.row}`)) continue;
        d.set(cellKey(n), d.get(cellKey(queue[i]!))! + 1);
        queue.push(n);
      }
    }
    return d;
  };
  const ways = [...m.exits.map((e) => e.at), ...m.fires, ...m.campfires];
  m.island.rows.forEach((line, row) => [...line].forEach((_, col) => isSlope(col, row) && ways.push({ col, row })));
  const before = ways.map((w) => dist(w, solid));
  const across = scenery.filter((p) => p.art === "tree" && isWalkable(p.col, p.row)).filter((p) => {
    const without = new Set(solid);
    without.delete(`${p.col},${p.row}`);
    return ways.some((from, i) => {
      const after = dist(from, without);
      return ways.some((w) => (before[i]!.get(cellKey(w)) ?? Infinity) - (after.get(cellKey(w)) ?? Infinity) > 3);
    });
  });
  expect(across).toEqual([]);
});
