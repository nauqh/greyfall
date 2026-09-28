// Self-check for the strategic map's pathing: node scripts/check-strat-map.ts
import assert from "node:assert/strict";

import { canStep, findPath, isWalkable, type Cell } from "../src/game/stratMap.ts";

const c = (col: number, row: number): Cell => ({ col, row });

// Off a plateau's side is a drop, not a step.
assert.equal(canStep(c(11, 5), c(12, 5)), false);
// The ramp works both ways, straight down its slope only.
assert.equal(canStep(c(14, 9), c(14, 10)), true);
assert.equal(canStep(c(14, 10), c(14, 9)), true);
assert.equal(canStep(c(14, 9), c(15, 9)), false);
// The ramp's head is reached from the plateau beside it.
assert.equal(canStep(c(13, 9), c(14, 9)), true);
// A cliff face is not ground.
assert.equal(isWalkable(5, 10), false);

function walk(from: Cell, to: Cell): Cell[] {
  const path = findPath(from, to);
  assert.ok(path, `no path ${JSON.stringify([from, to])}`);
  [from, ...path].forEach((cell, i, all) => i > 0 && assert.ok(canStep(all[i - 1]!, cell)));
  return path;
}
const has = (path: Cell[], col: number, row: number): boolean => path.some((p) => p.col === col && p.row === row);

// Blue's plateau down to the lowland goes by its ramp; red's by its own.
assert.ok(has(walk(c(6, 6), c(20, 12)), 14, 9));
assert.ok(has(walk(c(54, 33), c(40, 26)), 46, 28));
// The bases are joined, corner to corner.
assert.ok(walk(c(6, 6), c(53, 33)));
// Blue climbs the Crown by its west stairs.
assert.ok(has(walk(c(6, 6), c(30, 16)), 26, 16));

console.log("strat map ok");
