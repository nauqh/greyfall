// Self-check for the strategic map's pathing: node scripts/check-strat-map.ts
import assert from "node:assert/strict";

import { canStep, findPath, isWalkable, type Cell } from "../src/game/stratMap.ts";

const c = (col: number, row: number): Cell => ({ col, row });

// Off a plateau's side is a drop, not a step.
assert.equal(canStep(c(14, 4), c(15, 4)), false);
// The ramp works both ways, straight down its slope only.
assert.equal(canStep(c(13, 5), c(13, 6)), true);
assert.equal(canStep(c(13, 6), c(13, 5)), true);
assert.equal(canStep(c(13, 5), c(14, 5)), false);
// The ramp's head is reached from the plateau above it and beside it.
assert.equal(canStep(c(13, 4), c(13, 5)), true);
assert.equal(canStep(c(12, 5), c(13, 5)), true);
// A cliff face is not ground.
assert.equal(isWalkable(5, 6), false);

function walk(from: Cell, to: Cell): Cell[] {
  const path = findPath(from, to);
  assert.ok(path, `no path ${JSON.stringify([from, to])}`);
  [from, ...path].forEach((cell, i, all) => i > 0 && assert.ok(canStep(all[i - 1]!, cell)));
  return path;
}
const has = (path: Cell[], col: number, row: number): boolean => path.some((p) => p.col === col && p.row === row);

// Blue plateau down to the lowland goes by its ramp; red's by its own.
assert.ok(has(walk(c(6, 2), c(14, 7)), 13, 5));
assert.ok(has(walk(c(26, 15), c(18, 14)), 22, 16));
// The bases are joined: blue's ramp foot runs east to red's ramp.
assert.ok(walk(c(8, 4), c(24, 15)));
// The sea islet is out of reach.
assert.equal(findPath(c(6, 2), c(3, 18)), null);

console.log("strat map ok");
