import { describe, expect, it } from "vitest";

import { AREAS, atlasMap, cellKey, isWalkable, stepsFrom, useIsland, type AreaId, type Cell } from "../src/index.ts";

const map = atlasMap();
useIsland(map.island);
const index = Object.fromEntries(AREAS.map((a, i) => [a.id, String(i)])) as Record<AreaId, string>;
const areaOf = (c: Cell): string => map.areaAt[c.row]?.[c.col] ?? "-";

/** Every tile walkable from `from`, never stepping on `blocked`. */
function reach(from: Cell, blocked: ReadonlySet<number> = new Set()): Set<number> {
  const seen = new Set([cellKey(from)]);
  const queue = [from];
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
  for (let d = 0; d < 12; d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        const c = { col: a.label.col + dc, row: a.label.row + dr };
        if (isWalkable(c.col, c.row) && areaOf(c) === index[id]) return c;
      }
    }
  }
  throw new Error(`no ground in ${id}`);
}

const WATER_ART = new Set(["boat", "pirateTowerWater"]);
const SEA_KINDS = new Set(["harpoonShark", "paddleShark", "seahorseBoat", "bombFish", "rubberDuck"]);
const FLYING = new Set(["bat", "bee", "imp"]);

describe("the atlas", () => {
  it("is one world: every area reaches every other", () => {
    const all = reach(heart("harbour"));
    for (const a of AREAS) expect(all.has(cellKey(heart(a.id))), a.id).toBe(true);
  });

  it("joins its areas only at gates", () => {
    // Bar every gate and no area reaches another: each is a room, the gates its doors.
    const blocked = new Set(map.gates.flatMap((g) => g.cells.map(cellKey)));
    for (const a of AREAS) {
      const seen = reach(heart(a.id), blocked);
      for (const b of AREAS) if (b.id !== a.id) expect(seen.has(cellKey(heart(b.id))), `${a.id} reaches ${b.id} past the gates`).toBe(false);
    }
  });

  it("opens each gate onto the two areas it names", () => {
    for (const g of map.gates) {
      expect(g.cells.length, g.id).toBeGreaterThan(0);
      // Through this gate alone, its two areas meet.
      const others = new Set(map.gates.filter((o) => o !== g).flatMap((o) => o.cells.map(cellKey)));
      expect(reach(heart(g.from), others).has(cellKey(heart(g.to))), g.id).toBe(true);
    }
  });

  it("loops like a Souls map: the moor is reachable without the shortcut, and the citadel two ways", () => {
    const without = (...ids: string[]) => new Set(map.gates.filter((g) => ids.includes(g.id)).flatMap((g) => g.cells.map(cellKey)));
    expect(reach(heart("harbour"), without("moor-gate")).has(cellKey(heart("barrowmoor")))).toBe(true);
    expect(reach(heart("harbour"), without("grey-gate")).has(cellKey(heart("greyfall")))).toBe(true);
    expect(reach(heart("harbour"), without("sky-bridge")).has(cellKey(heart("greyfall")))).toBe(true);
  });

  it("stands every building on ground and every boat in the sea", () => {
    for (const p of map.props) {
      const land = map.island.rows[p.row]![p.col] !== "~";
      expect(land, `${p.art} at ${p.col},${p.row}`).toBe(!WATER_ART.has(p.art));
    }
  });

  it("puts every creature where it can be: walkers on open ground, swimmers in the sea", () => {
    for (const d of map.dwellers) {
      for (const c of [d, ...(d.to ? [d.to] : [])]) {
        const sea = map.island.rows[c.row]![c.col] === "~";
        if (SEA_KINDS.has(d.kind)) expect(sea, `${d.kind} at ${c.col},${c.row}`).toBe(true);
        else if (!FLYING.has(d.kind)) expect(isWalkable(c.col, c.row), `${d.kind} at ${c.col},${c.row}`).toBe(true);
      }
      // A walker's beat is a walk it can make.
      if (d.to && !SEA_KINDS.has(d.kind) && !FLYING.has(d.kind)) expect(reach(d).has(cellKey(d.to)), `${d.kind} ${d.col},${d.row}`).toBe(true);
    }
  });

  it("has every high place reachable: each plateau and Crown tile is walked to from the hub", () => {
    const all = reach(heart("harbour"));
    map.island.rows.forEach((line, r) =>
      [...line].forEach((ch, c) => {
        if ("#^".includes(ch) && isWalkable(c, r)) expect(all.has(cellKey({ col: c, row: r })), `${ch} at ${c},${r}`).toBe(true);
      }),
    );
  });
});
