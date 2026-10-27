import { describe, expect, it } from "vitest";

import { AREAS, AREA_CODE, FLYING, SEA_KINDS, TIERS, WATER_ART, atlasMap, castsCliff, footprint, isSlope, level, cellKey, isWalkable, stepsFrom, useIsland, type AreaId, type AtlasTier, type Cell, type TierId } from "../src/index.ts";

const map = atlasMap();
const code = Object.fromEntries(AREAS.map((a, i) => [a.id, AREA_CODE[i]])) as Record<AreaId, string>;
const areaOf = (tier: AtlasTier, c: Cell): string => tier.areaAt[c.row]?.[c.col] ?? "-";
const tierOf = (id: AreaId): AtlasTier => map.tiers[AREAS.find((a) => a.id === id)!.tier];

/** Every tile walkable from `from` on the tier in use, never stepping on `blocked`. */
function reach(from: readonly Cell[], blocked: ReadonlySet<number> = new Set()): Set<number> {
  const seen = new Set(from.map(cellKey));
  const queue = [...from];
  for (let i = 0; i < queue.length; i++) {
    for (const n of stepsFrom(queue[i]!)) {
      if (seen.has(cellKey(n)) || blocked.has(cellKey(n))) continue;
      seen.add(cellKey(n));
      queue.push(n);
    }
  }
  return seen;
}

/** A walkable tile of an area, near its label. */
function heart(id: AreaId): Cell {
  const a = AREAS.find((x) => x.id === id)!;
  const tier = map.tiers[a.tier];
  useIsland(tier.island);
  for (let d = 0; d < 14; d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        const c = { col: a.label.col + dc, row: a.label.row + dr };
        if (isWalkable(c.col, c.row) && areaOf(tier, c) === code[id]) return c;
      }
    }
  }
  throw new Error(`no ground in ${id}`);
}

const gateCells = (tier: AtlasTier, except: readonly string[] = []) => new Set(tier.gates.filter((g) => !except.includes(g.id)).flatMap((g) => g.cells.map(cellKey)));

/** Areas reachable from `start`, walking each tier and riding lifts the way they go. */
function world(start: AreaId, opened = false): Set<AreaId> {
  const got = new Set<AreaId>();
  const queue: { tier: TierId; at: Cell }[] = [{ tier: tierOf(start).id, at: heart(start) }];
  const done = new Set<string>();
  while (queue.length > 0) {
    const { tier, at } = queue.shift()!;
    const k = `${tier}:${cellKey(at)}`;
    if (done.has(k)) continue;
    done.add(k);
    const t = map.tiers[tier];
    useIsland(t.island);
    const seen = reach([at]);
    for (const a of AREAS) if (a.tier === tier && seen.has(cellKey(heart(a.id)))) got.add(a.id);
    useIsland(t.island);
    for (const l of map.lifts) {
      // A drop goes down only; a shortcut goes down, and once opened, up too.
      const down = l.up.tier === tier && seen.has(cellKey(l.up.at));
      const up = l.down.tier === tier && seen.has(cellKey(l.down.at)) && (l.kind === "lift" || (l.kind === "shortcut" && opened));
      if (down) queue.push({ tier: l.down.tier, at: l.down.at });
      if (up) queue.push({ tier: l.up.tier, at: l.up.at });
    }
  }
  return got;
}


describe("the atlas's tiers", () => {
  it("lie on one grid, a tile for a tile", () => {
    for (const id of TIERS) {
      const t = map.tiers[id];
      expect(t.island.rows).toHaveLength(80);
      expect(t.areaAt.map((l) => l.length)).toEqual(t.island.rows.map((l) => l.length));
    }
  });

  it.each(TIERS)("%s: joins its areas only at gates, and each gate joins the two it names", (id) => {
    const t = map.tiers[id];
    const mine = AREAS.filter((a) => a.tier === id);
    const hearts = new Map(mine.map((a) => [a.id, heart(a.id)]));
    useIsland(t.island);
    for (const a of mine) {
      const seen = reach([hearts.get(a.id)!], gateCells(t));
      for (const b of mine) if (b !== a) expect(seen.has(cellKey(hearts.get(b.id)!)), `${a.id} reaches ${b.id} past the gates`).toBe(false);
    }
    for (const g of t.gates) {
      expect(g.cells.length, g.id).toBeGreaterThan(0);
      expect(reach([hearts.get(g.from)!], gateCells(t, [g.id])).has(cellKey(hearts.get(g.to)!)), g.id).toBe(true);
    }
  });

  it("joins the tiers only at lifts, each end standing where it says", () => {
    for (const l of map.lifts) {
      for (const end of [l.up, l.down]) {
        const t = map.tiers[end.tier];
        useIsland(t.island);
        expect(isWalkable(end.at.col, end.at.row), `${l.id} ${end.tier}`).toBe(true);
        expect(areaOf(t, end.at), `${l.id} ${end.tier}`).toBe(code[end.area]);
        // The two ends sit close on the grid: what is below a place is really below it.
      }
      expect(Math.abs(l.up.at.col - l.down.at.col) + Math.abs(l.up.at.row - l.down.at.row), l.id).toBeLessThanOrEqual(5);
      expect(TIERS.indexOf(l.up.tier), l.id).toBeLessThan(TIERS.indexOf(l.down.tier));
    }
  });

  it("is one world from the hub: every area of every tier, walking and riding the lifts the way they go", () => {
    expect([...world("harbour")].sort()).toEqual(AREAS.map((a) => a.id).sort());
  });

  it("loops like a Souls map", () => {
    // The Watch Lift can't be ridden up before it is opened from above, and the sky is still reached the long way.
    expect(world("harbour").has("steps")).toBe(true);
    // Down the well there is no climbing back, but the Underneath has its own way up: the Barrow Cave.
    expect(world("undercroft").has("barrowmoor")).toBe(true);
    // The Hollow at the bottom is reached by the drop and by the stair from the tombs.
    expect(world("deeps").has("hollow")).toBe(true);
    // On the surface, the moor without its shortcut, and the citadel each of its two ways.
    useIsland(map.tiers.surface.island);
    const s = map.tiers.surface;
    expect(reach([heart("harbour")], gateCells(s).size ? new Set(s.gates.filter((g) => g.id === "moor-gate").flatMap((g) => g.cells.map(cellKey))) : new Set()).has(cellKey(heart("barrowmoor")))).toBe(true);
    for (const way of ["grey-gate", "sky-bridge"]) {
      const shut = new Set(s.gates.filter((g) => g.id === way).flatMap((g) => g.cells.map(cellKey)));
      expect(reach([heart("harbour")], shut).has(cellKey(heart("greyfall"))), way).toBe(true);
    }
  });

  it.each(TIERS)("%s: stands every building on ground, every boat at sea, every walker where it can walk", (id) => {
    const t = map.tiers[id];
    useIsland(t.island);
    const ground = (c: Cell) => !"~%".includes(t.island.rows[c.row]![c.col]!);
    for (const p of t.props) expect(ground(p), `${p.art} at ${p.col},${p.row}`).toBe(!WATER_ART.has(p.art));
    for (const d of t.dwellers) {
      for (const c of [d, ...(d.to ? [d.to] : [])]) {
        if (SEA_KINDS.has(d.kind)) expect(t.island.rows[c.row]![c.col], `${d.kind} at ${c.col},${c.row}`).toBe("~");
        else if (!FLYING.has(d.kind)) expect(isWalkable(c.col, c.row), `${d.kind} at ${c.col},${c.row}`).toBe(true);
      }
      if (d.to && !SEA_KINDS.has(d.kind) && !FLYING.has(d.kind)) expect(reach([d]).has(cellKey(d.to)), `${d.kind} ${d.col},${d.row}`).toBe(true);
    }
  });

  it.each(TIERS)("%s: stands every building wholly on its ground, clear of edges and of each other", (id) => {
    const t = map.tiers[id];
    useIsland(t.island);
    const under = new Map<string, string>();
    for (const p of t.props) {
      const name = `${p.art} at ${p.col},${p.row}`;
      const wet = WATER_ART.has(p.art);
      const base = level(p.col, p.row);
      for (const c of footprint(p)) {
        const ch = t.island.rows[c.row]![c.col]!;
        if (wet) expect(ch, `${name}: hull over ${c.col},${c.row}`).toBe("~");
        else {
          expect(isWalkable(c.col, c.row) && !isSlope(c.col, c.row), `${name}: base over ${c.col},${c.row}`).toBe(true);
          expect(level(c.col, c.row), `${name}: base over two heights`).toBe(base);
        }
        expect(under.get(`${c.col},${c.row}`), `${name} overlaps`).toBeUndefined();
        under.set(`${c.col},${c.row}`, name);
      }
      if (wet) continue;
      // A tile of its own ground round it: no cliff's lip, stair or shore.
      for (const c of footprint(p, true)) {
        const ch = t.island.rows[c.row]![c.col]!;
        expect(ch !== "~" && !isSlope(c.col, c.row) && level(c.col, c.row) === base && !castsCliff(c.col, c.row - 1), `${name}: edge at ${c.col},${c.row}`).toBe(true);
      }
    }
  });

  it.each(TIERS)("%s: lights every bonfire on its own level ground, off any edge", (id) => {
    const t = map.tiers[id];
    useIsland(t.island);
    for (const f of t.fires) {
      const base = level(f.col, f.row);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const [c, r] = [f.col + dc, f.row + dr];
          expect(t.island.rows[r]![c] !== "~" && !isSlope(c, r) && level(c, r) === base && !castsCliff(c, r - 1), `fire at ${f.col},${f.row}: edge at ${c},${r}`).toBe(true);
        }
      }
    }
  });

  it.each(TIERS)("%s: every height can be climbed to", (id) => {
    const t = map.tiers[id];
    const starts = AREAS.filter((a) => a.tier === id).map((a) => heart(a.id));
    useIsland(t.island);
    const all = reach(starts);
    t.island.rows.forEach((line, r) =>
      [...line].forEach((ch, c) => {
        if ("#^45".includes(ch) && isWalkable(c, r)) expect(all.has(cellKey({ col: c, row: r })), `${ch} at ${c},${r}`).toBe(true);
      }),
    );
    if (id === "surface") expect(t.island.rows.some((l) => l.includes("^"))).toBe(true);
  });
});
