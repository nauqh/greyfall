import { describe, expect, it } from "vitest";

import { AREAS, FLYING, MAPPED_AREAS, NPCS, districtOf, groundColours, SEA_KINDS, WATER_ART, areaMap, castsCliff, cellKey, footprint, isForest, isSlope, isWalkable, level, solidCells, stepsFrom, useIsland, type Cell } from "../src/index.ts";

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

  it("reads each height a shade lighter than the ground below", () => {
    useIsland(m.island);
    const light: Record<number, number> = { 5: 0, 4: 1, 3: 2, 2: 3, 1: 4 };
    const g = groundColours(m);
    g.forEach((line, r) =>
      line.forEach((a, c) => {
        for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          const b = g[r + dr]?.[c + dc];
          if (a == null || b == null || m.island.rows[r]![c] === "%" || level(c, r) <= level(c + dc, r + dr) || districtOf(m, c, r)?.gloom) continue;
          expect(light[a]! > light[b]! || a === 1, `${c},${r} colour ${a} over ${b}`).toBe(true);
        }
      }),
    );
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

  it("stands every fence on open ground of one height, clear of buildings, walkers and other fences", () => {
    useIsland(m.island);
    const built = new Set(m.props.flatMap((p) => footprint(p, true).map(cellKey)));
    const fenced = new Set<number>();
    for (const f of m.fences) {
      const name = `fence at ${f.col},${f.row}`;
      const base = level(f.col, f.row);
      const line: Cell[] = [];
      for (let r = f.row; r < f.row + f.h; r++) for (let c = f.col; c < f.col + f.w; c++) if (r === f.row || r === f.row + f.h - 1 || c === f.col || c === f.col + f.w - 1) line.push({ col: c, row: r });
      for (const c of line) {
        expect(isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && level(c.col, c.row) === base && !castsCliff(c.col, c.row - 1), `${name}: post over ${c.col},${c.row}`).toBe(true);
        expect(built.has(cellKey(c)), `${name}: post on a building's ground at ${c.col},${c.row}`).toBe(false);
        expect(m.dwellers.some((d) => d.col === c.col && d.row === c.row), `${name}: a walker stands on its line at ${c.col},${c.row}`).toBe(false);
      }
      for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) expect(fenced.has(cellKey({ col: c, row: r })), `${name} touches another fence`).toBe(false);
      for (let r = f.row; r < f.row + f.h; r++) for (let c = f.col; c < f.col + f.w; c++) fenced.add(cellKey({ col: c, row: r }));
    }
  });
});

it("stands the castle on the Keep's raised terrace, a height above its bailey", () => {
  const m = areaMap("keep");
  useIsland(m.island);
  const castle = m.props.find((p) => p.art === "castle")!;
  expect(level(castle.col, castle.row)).toBe(2);
  expect(level(m.entry.col, m.entry.row)).toBe(1);
});

it("puts the harbour's hub in the village: the boat's pier and the climb to the Burg Gate near its one bonfire, the Graves held, the Moor Gate shut", () => {
  const m = areaMap("harbour");
  const near = (a: Cell, b: Cell, d: number) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) <= d;
  const boat = m.exits.find((e) => e.name === "The Boat")!;
  const burg = m.exits.find((e) => e.name === "Burg Gate")!;
  const moor = m.exits.find((e) => e.name === "Moor Gate")!;
  expect(m.fires).toHaveLength(1);
  expect(near(m.fires[0]!, boat.at, 18)).toBe(true);
  expect(near(m.fires[0]!, m.entry, 3)).toBe(true);
  expect(Math.abs(burg.at.col - m.fires[0]!.col)).toBeLessThanOrEqual(3);
  expect(moor.shut).toBe("moorGateOpen");
  expect(m.dwellers.filter((d) => d.kind === "gnoll" && d.col > m.fires[0]!.col + 30).length).toBeGreaterThanOrEqual(3);
});

it("shuts the Keep behind its gate off the Burg until the troll's key, and its Watch Lift until ridden down from the sky", () => {
  const gate = areaMap("burg").exits.find((e) => e.to === "keep")!;
  expect(gate.keys).toEqual(["troll"]);
  const lift = areaMap("keep").exits.find((e) => e.name === "Watch Lift")!;
  expect(lift.shut).toBe("watchLiftOpen");
  expect(areaMap("harbour").exits.some((e) => e.to === "steps")).toBe(false);
});

// A tree two rows south of a note draws its canopy over the paper; underground walls are only rubble.
it.each(MAPPED_AREAS)("leaves every note in %s clear of woods that would stand over it", (id) => {
  const m = areaMap(id);
  if (m.base === "rock") return;
  useIsland(m.island);
  for (const n of m.notes ?? []) {
    for (let dr = 0; dr <= 2; dr++) for (let dc = -1; dc <= 1; dc++) expect(isForest(n.at.col + dc, n.at.row + dr), `${id} note ${n.at.col},${n.at.row}`).toBe(false);
  }
});

// One hill, not a stack of maps each starting from its floor: a crossing meets the height and the green it left.
describe("crossings between the surface lands", () => {
  // Ways that go down the hill by design: a lift, a ladder off a tower, and the Postern road down the Ward's back.
  const DESCENTS = new Set(["The Old Lift", "The Ladder", "The Postern"]);
  const LIGHT: Record<number, number> = { 5: 0, 4: 1, 3: 2, 2: 3, 1: 4 };
  const area = (id: string) => AREAS.find((a) => a.id === id)!;
  const ends = MAPPED_AREAS.flatMap((a) =>
    areaMap(a).exits.flatMap((e) => {
      const back = MAPPED_AREAS.includes(e.to) ? areaMap(e.to).exits.find((x) => x.to === a && x.name === e.name) : undefined;
      return back && a < e.to && area(a).rise !== undefined && area(e.to).rise !== undefined ? [{ a, b: e.to, name: e.name, at: e.at, back: back.at }] : [];
    }),
  );
  const side = (id: (typeof MAPPED_AREAS)[number], at: Cell) => {
    const m = areaMap(id);
    useIsland(m.island);
    const shade = groundColours(m);
    return { world: area(id).rise! + level(at.col, at.row), shade: shade[at.row]?.[at.col] ?? null };
  };

  it.each(ends.map((e) => [`${e.a} ${e.name} ${e.b}`, e] as const))("%s meets the height it left", (_, e) => {
    const [x, y] = [side(e.a, e.at), side(e.b, e.back)];
    if (DESCENTS.has(e.name)) return;
    expect(Math.abs(x.world - y.world), `${x.world} against ${y.world}`).toBeLessThanOrEqual(1);
    if (area(e.a).ownGround || area(e.b).ownGround || x.shade === null || y.shade === null) return;
    expect(Math.abs(LIGHT[x.shade]! - LIGHT[y.shade]!), `shade ${x.shade} against ${y.shade}`).toBeLessThanOrEqual(1);
  });
});
