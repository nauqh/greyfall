import { describe, expect, it } from "vitest";

import { BAND_SIZE, COMPANIONS, companionPlan, foeTarget, hire, mendTarget } from "../src/band.ts";

const at = (col: number, row: number) => ({ col, row });

describe("hiring", () => {
  it("takes the gold and adds to the band", () => {
    expect(hire(100, [], "lancer")).toEqual({ gold: 100 - COMPANIONS.lancer.cost, band: ["lancer"] });
  });

  it("refuses without the gold or the room", () => {
    expect(hire(COMPANIONS.archer.cost - 1, [], "archer")).toBeNull();
    expect(hire(999, Array(BAND_SIZE).fill("archer"), "lancer")).toBeNull();
  });
});

describe("a companion's plan", () => {
  const captain = at(10, 10);

  it("on follow keeps close, and fights what comes near the captain", () => {
    expect(companionPlan(at(20, 10), "lancer", "follow", captain, -1, [], at(0, 0))).toEqual({ do: "go", to: captain });
    expect(companionPlan(at(11, 10), "lancer", "follow", captain, -1, [], at(0, 0))).toEqual({ do: "stay" });
    expect(companionPlan(at(11, 10), "lancer", "follow", captain, -1, [at(30, 30), at(13, 10)], at(0, 0))).toEqual({ do: "close", foe: 1 });
    expect(companionPlan(at(12, 10), "lancer", "follow", captain, -1, [at(13, 10)], at(0, 0))).toEqual({ do: "strike", foe: 0 });
  });

  it("shoots from range as an archer", () => {
    expect(companionPlan(at(9, 10), "archer", "follow", captain, -1, [at(13, 10)], at(0, 0))).toEqual({ do: "strike", foe: 0 });
  });

  it("on attack goes for the captain's target, however far", () => {
    expect(companionPlan(at(11, 10), "lancer", "attack", captain, 1, [at(12, 10), at(30, 10)], at(0, 0))).toEqual({ do: "close", foe: 1 });
  });

  it("on hold never leaves its spot, striking only what reaches it", () => {
    const post = at(5, 5);
    expect(companionPlan(at(7, 5), "lancer", "hold", captain, -1, [], post)).toEqual({ do: "go", to: post });
    expect(companionPlan(post, "lancer", "hold", captain, -1, [at(8, 5)], post)).toEqual({ do: "stay" });
    expect(companionPlan(post, "lancer", "hold", captain, -1, [at(6, 5)], post)).toEqual({ do: "strike", foe: 0 });
  });
});

describe("a monster's mark", () => {
  it("goes for a lancer it can see before anyone nearer", () => {
    const bodies = [{ at: at(11, 10), draws: false }, { at: at(14, 10), draws: true }];
    expect(foeTarget(at(10, 10), 6, bodies)).toBe(1);
  });

  it("else the nearest it can see, and none out of sight", () => {
    const bodies = [{ at: at(15, 10), draws: false }, { at: at(12, 10), draws: false }];
    expect(foeTarget(at(10, 10), 6, bodies)).toBe(1);
    expect(foeTarget(at(10, 10), 1, bodies)).toBe(-1);
  });
});

describe("the Monk", () => {
  const at = (col: number) => ({ col, row: 0 });
  it("mends the lowest share of health below 60% in reach, and no one whole, fallen or far", () => {
    expect(mendTarget(at(0), 4, [{ at: at(1), hp: 50, max: 100 }, { at: at(2), hp: 30, max: 120 }])).toBe(1);
    expect(mendTarget(at(0), 4, [{ at: at(1), hp: 70, max: 100 }, { at: at(1), hp: 0, max: 100 }, { at: at(9), hp: 10, max: 100 }])).toBe(-1);
  });
});
