import { describe, expect, it } from "vitest";

import {
  AI_EVERY_TICKS,
  BALANCE,
  START,
  STRAT_COLS,
  STRAT_ROWS,
  battle,
  createSim,
  findPath,
  freeIn,
  newMatch,
  occupied,
  planAi,
  runAi,
  type WarSide,
} from "../src/index.ts";

const front = (side: WarSide) => ({ col: START[side].castle.col + 1, row: START[side].castle.row + 2 });

describe("island", () => {
  const free = freeIn(occupied(newMatch()));
  const blocked = (c: { col: number; row: number }) => !free(c);

  it("reaches every open tile from the castle", () => {
    for (let row = 0; row < STRAT_ROWS; row++) {
      for (let col = 0; col < STRAT_COLS; col++) {
        const c = { col, row };
        if (!blocked(c)) expect(findPath(front("a"), c, blocked), `${col},${row}`).not.toBeNull();
      }
    }
  });
});



describe("rounds", () => {

  it("is the same battle for the same state and plans", () => {
    const s = newMatch("same");
    const pa = planAi(s, "a");
    const pb = planAi(s, "b");
    expect(battle(s, pa, pb)).toEqual(battle(s, pa, pb));
  });
});

describe("real time", () => {
  const seconds = (n: number) => n * BALANCE.tickRate;

  it("is the same match for the same actions", () => {
    const play = () => {
      const sim = createSim(newMatch("same", "realtime"));
      for (let i = 0; i < seconds(90); i++) {
        if (i % AI_EVERY_TICKS === 0) for (const side of ["a", "b"] as const) runAi(sim, side);
        sim.step();
      }
      return sim.snapshot();
    };
    expect(play()).toEqual(play());
  });

  it("ends by the monster waves, AI against AI", () => {
    const sim = createSim(newMatch(7, "realtime"));
    // The diagonal island runs 10-16 minutes over 30 seeds; 20 is the CLI's cap.
    const deadline = seconds(20 * 60);
    while (sim.world.winner === null && sim.t < deadline) {
      if (sim.t % AI_EVERY_TICKS === 0) for (const side of ["a", "b"] as const) runAi(sim, side);
      sim.step();
      sim.events.length = 0;
    }
    expect(sim.world.winner).not.toBeNull();
  }, 60_000);
});
