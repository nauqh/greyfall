// node --test src/server/room/resolve.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { newRun } from "@greyfall/engine";

import type { RoomData } from "../schema.ts";
import { PLANNING_MS, settle } from "./resolve.ts";

const now = 1_000_000;
const later = new Date(now + 10_000);

function room(ready: boolean[]): RoomData {
  return {
    seed: "s",
    version: 3,
    players: ready.map((r, i) => ({ token: `t${i}`, name: `p${i}`, ready: r })),
    run: newRun("s", ready.length, ready.length),
    last: null,
  };
}

test("waits while a human still in is not ready", () => {
  assert.equal(settle("planning", later, room([true, false]), now), null);
});

test("fights once every human is ready, and clears ready", () => {
  const next = settle("planning", later, room([true, true]), now)!;
  assert.equal(next.state, "planning");
  assert.equal(next.data.run!.round, 2);
  assert.equal(next.data.last!.round, 1);
  assert.deepEqual(next.data.players.map((p) => p.ready), [false, false]);
  assert.ok(next.deadline!.getTime() >= now + PLANNING_MS);
});

test("fights at the deadline whoever is ready", () => {
  assert.equal(settle("planning", new Date(now), room([false, false]), now)!.data.run!.round, 2);
});

test("settles nothing outside planning", () => {
  assert.equal(settle("waiting", null, { ...room([true, true]), run: null }, now), null);
  assert.equal(settle("result", null, room([true, true]), now), null);
});
