import { describe, expect, it } from "vitest";

import { FLYING, MAPPED_AREAS, NPCS, canStep, SEA_KINDS, areaMap, cellKey, isSlope, isWalkable, level, solidCells, stairLean, stepsFrom, useIsland, type Cell } from "../src/index.ts";

function reach(from: Cell, shut: ReadonlySet<number> = new Set()): Set<number> {
  const seen = new Set([cellKey(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const n of stepsFrom(queue[i]!)) {
      if (seen.has(cellKey(n)) || shut.has(cellKey(n))) continue;
      seen.add(cellKey(n));
      queue.push(n);
    }
  }
  return seen;
}

it.each(MAPPED_AREAS)("leaves every way out, fire, note and dweller of %s in reach round the solid props", (id) => {
  const m = areaMap(id);
  useIsland(m.island);
  const shut = new Set([...solidCells(m)].map((k) => cellKey({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]) })));
  const seen = reach(m.entry, shut);
  const byOne = (c: Cell) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => seen.has(cellKey({ col: c.col + dc, row: c.row + dr }))));
  for (const e of m.exits) expect(byOne(e.at), `${id} exit ${e.name}`).toBe(true);
  for (const f of m.fires) expect(byOne(f), `${id} fire ${f.col},${f.row}`).toBe(true);
  for (const n of m.notes ?? []) expect(byOne(n.at), `${id} note ${n.at.col},${n.at.row}`).toBe(true);
  for (const n of NPCS.flatMap((x) => [{ id: x.id, area: x.area, at: x.at }, ...(x.later ?? []).map((s) => ({ id: x.id, area: s.area, at: s.at }))])) {
    if (n.area === id && n.at) expect(byOne(n.at), `${id} ${n.id}`).toBe(true);
  }
});

describe.each(MAPPED_AREAS)("the %s area map", (id) => {
  const m = areaMap(id);

  it("tops every stair with ground that goes on, not a tile whose one way off is back down", () => {
    useIsland(m.island);
    m.island.rows.forEach((line, row) =>
      [...line].forEach((ch, col) => {
        if (!isSlope(col, row)) return;
        const top = { col: col + ("<[{(".includes(ch) ? 1 : -1), row };
        expect(stepsFrom(top).some((n) => n.col !== col || n.row !== row), `${ch} at ${col},${row}`).toBe(true);
      }),
    );
  });

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

  it("keeps trees, rocks and bushes off its stairs' landings", () => {
    useIsland(m.island);
    const near = (col: number, row: number) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => isSlope(col + dc, row + dr)));
    const on = m.props.filter((p) => ["tree", "rock", "bush"].includes(p.art) && near(Math.round(p.col), Math.round(p.row)));
    expect(on.map((p) => `${p.art} at ${p.col},${p.row}`)).toEqual([]);
  });

  it("walks every walker's beat on foot, round the cliffs and by the stairs", () => {
    useIsland(m.island);
    for (const d of m.dwellers) if (d.to && !SEA_KINDS.has(d.kind) && !FLYING.has(d.kind)) expect(reach(d).has(cellKey(d.to)), `${d.kind} at ${d.col},${d.row}`).toBe(true);
  });

});

it("shuts the Keep behind its gate off the Burg until the troll's key, and its Watch Lift until ridden down from the sky", () => {
  const gate = areaMap("burg").exits.find((e) => e.to === "keep")!;
  expect(gate.keys).toEqual(["troll"]);
  const lift = areaMap("keep").exits.find((e) => e.name === "Watch Lift")!;
  expect(lift.shut).toBe("watchLiftOpen");
  expect(areaMap("harbour").exits.some((e) => e.to === "steps")).toBe(false);
});

describe("the Harbour's stairs", () => {
  const m = areaMap("harbour");
  const take = () => useIsland(m.island);

  it("climb every stair along its slope, never straight across or straight up", () => {
    take();
    for (let row = 0; row < m.island.rows.length; row++)
      for (let col = 0; col < m.island.rows[0]!.length; col++) {
        const ch = m.island.rows[row]![col]!;
        if (!isSlope(col, row)) continue;
        const top = { col, row };
        const open = col + ("<[{(".includes(ch) ? -1 : 1);
        expect(level(open, row), `${ch} at ${col},${row} open side`).toBe(level(col, row) - 1);
        expect(canStep(top, { col: open, row }) || canStep({ col: open, row }, top), `${ch} at ${col},${row} across`).toBe(false);
        expect(canStep(top, { col, row: row + 1 }) || canStep({ col, row: row + 1 }, top), `${ch} at ${col},${row} up its foot`).toBe(false);
        const low = { col: open, row: row + 1 };
        expect(canStep(top, low) && canStep(low, top), `${ch} at ${col},${row} along its slope`).toBe(true);
      }
  });

  it("turn any push that leans into a stair up or down its slope", () => {
    take();
    for (let row = 0; row < m.island.rows.length; row++)
      for (let col = 0; col < m.island.rows[0]!.length; col++) {
        const ch = m.island.rows[row]![col]!;
        if (!isSlope(col, row)) continue;
        const t = "<[{(".includes(ch) ? 1 : -1;
        const top = { col, row };
        const up: [number, number] = [t, -1];
        const down: [number, number] = [-t, 1];
        for (const from of [{ col: col - t, row }, { col: col - t, row: row + 1 }, { col, row: row + 1 }]) {
          expect(stairLean(from, 0, -1), `up from ${from.col},${from.row} to ${ch} at ${col},${row}`).toEqual(up);
          expect(stairLean(from, t, 0), `${t > 0 ? "right" : "left"} from ${from.col},${from.row} to ${ch} at ${col},${row}`).toEqual(up);
        }
        expect(stairLean(top, 0, 1), `down off ${ch} at ${col},${row}`).toEqual(down);
        expect(stairLean(top, -t, 0), `off the open side of ${ch} at ${col},${row}`).toEqual(down);
      }
  });

});
