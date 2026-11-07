import { describe, expect, it } from "vitest";

import { FOES, GOLD_STONE, HERO, PACE, TROLL, chargeLine, trollMove, mayEngage, STAMINA, block, canAct, recover, spend, clearLine, clearShot, comboStep, drink, findPath, canReach, swingWait, foeIntent, routeToward, smoothPath, struck, throughGuard, useIsland } from "../src/index.ts";

const goblin = FOES.torch!;
const home = { col: 10, row: 10 };

describe("a monster's intent", () => {
  it("idles at its post with no hero about", () => {
    expect(foeIntent(home, home, null, goblin)).toBe("idle");
    expect(foeIntent(home, home, { col: 30, row: 30 }, goblin)).toBe("idle");
  });

  it("strikes a hero beside it, diagonals included", () => {
    expect(foeIntent(home, home, { col: 11, row: 11 }, goblin)).toBe("attack");
  });

  it("chases a hero it has noticed", () => {
    expect(foeIntent(home, home, { col: 10 + goblin.aggro, row: 10 }, goblin)).toBe("chase");
    expect(foeIntent(home, home, { col: 10 + goblin.aggro + 1, row: 10 }, goblin)).toBe("idle");
  });

  it("gives up past its leash and walks home, even with the hero beside it", () => {
    const far = { col: 10 + goblin.leash + 1, row: 10 };
    expect(foeIntent(far, home, { col: far.col + 1, row: 10 }, goblin)).toBe("return");
  });

  it("does not chase a hero who has run beyond its leash", () => {
    const near = { col: 10 + goblin.leash - 1, row: 10 };
    expect(foeIntent(near, home, { col: 10 + goblin.leash + 2, row: 10 }, goblin)).toBe("return");
  });
});

describe("a blow", () => {
  it("takes its attack off and never goes below nothing", () => {
    expect(struck(30, HERO.attack)).toBe(18);
    expect(struck(5, HERO.attack)).toBe(0);
  });

  it("takes three of the hero's swings to drop a torch goblin", () => {
    let hp = goblin.hp;
    let swings = 0;
    while (hp > 0) (hp = struck(hp, HERO.attack)), swings++;
    expect(swings).toBe(3);
  });

  it("chains three swings, then starts over, and a pause breaks the chain", () => {
    let step = 0;
    const steps = [];
    for (let i = 0; i < 4; i++) steps.push((step = comboStep(step, 0)));
    expect(steps).toEqual([1, 2, 3, 1]);
    expect(comboStep(1, HERO.combo + 0.1)).toBe(1);
  });

  it("swings the first two quickly and recovers longer after the finisher", () => {
    expect(swingWait(1)).toBe(swingWait(2));
    expect(swingWait(3)).toBeGreaterThan(swingWait(1));
  });

  it("is mostly turned by a raised shield, but never wholly", () => {
    for (const foe of Object.values(FOES)) {
      expect(throughGuard(foe!.attack)).toBeLessThan(foe!.attack);
      expect(throughGuard(foe!.attack)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("the pace of a fight", () => {
  it("gives every monster a wind-up to read, shorter than the wait between its blows", () => {
    for (const foe of Object.values(FOES)) {
      expect(foe!.windup).toBeGreaterThanOrEqual(0.4);
      expect(foe!.every).toBeGreaterThan(foe!.windup + PACE.recover);
    }
  });

  it("lets no more than two close in on one mark at a time", () => {
    expect(mayEngage(0)).toBe(true);
    expect(mayEngage(PACE.engage - 1)).toBe(true);
    expect(mayEngage(PACE.engage)).toBe(false);
  });
});

describe("a thrower and a flyer", () => {
  it("throws from its range instead of walking up", () => {
    const gnoll = FOES.gnoll!;
    expect(foeIntent(home, home, { col: 10 + gnoll.range!, row: 10 }, gnoll)).toBe("attack");
    expect(foeIntent(home, home, { col: 10 + gnoll.range! + 1, row: 10 }, gnoll)).toBe("chase");
  });

  it("needs a clear line: a house or a wood between hides the mark", () => {
    const house = (c: { col: number; row: number }) => c.col === 12 && c.row === 10;
    expect(clearShot({ col: 10, row: 10 }, { col: 14, row: 10 }, house)).toBe(false);
    expect(clearShot({ col: 10, row: 10 }, { col: 14, row: 12 }, house)).toBe(true);
    // Standing in the doorway is not hiding behind the wall.
    expect(clearShot({ col: 10, row: 10 }, { col: 12, row: 10 }, house)).toBe(true);
  });

  it("is out of a blade's reach on the wing, but not a bow's", () => {
    expect(canReach(1, FOES.bat!)).toBe(false);
    expect(canReach(5, FOES.bat!)).toBe(true);
    expect(canReach(1, FOES.torch!)).toBe(true);
    for (const foe of Object.values(FOES)) if (foe!.range) expect(foe!.aggro).toBeGreaterThanOrEqual(foe!.range);
  });
});

describe("gold", () => {
  it("drops from every monster, and a stone is worth more than any but a boss", () => {
    for (const [kind, foe] of Object.entries(FOES)) {
      expect(foe!.gold).toBeGreaterThan(0);
      if (kind !== "troll" && kind !== "minotaur") expect(foe!.gold).toBeLessThan(GOLD_STONE);
    }
    for (const boss of ["troll", "minotaur"]) expect(FOES[boss]!.gold).toBeGreaterThan(GOLD_STONE);
  });
});

describe("stamina", () => {
  it("lets an action start on any stamina at all, and never goes below nothing", () => {
    expect(canAct(1)).toBe(true);
    expect(canAct(0)).toBe(false);
    expect(spend(5, STAMINA.roll)).toBe(0);
  });

  it("comes back only after a pause, slower behind a shield, never past full", () => {
    expect(recover(50, 1, STAMINA.delay / 2, false)).toBe(50);
    expect(recover(50, 1, STAMINA.delay, false)).toBe(50 + STAMINA.regen);
    expect(recover(50, 1, STAMINA.delay, true)).toBeCloseTo(50 + STAMINA.regen * STAMINA.guarded);
    expect(recover(99, 1, 5, false)).toBe(STAMINA.max);
  });

  it("pays for a blow on the shield, and breaks the guard when it cannot", () => {
    expect(block(100, 8)).toEqual({ stamina: 100 - 8 * STAMINA.block, broken: false });
    expect(block(10, 8)).toEqual({ stamina: 0, broken: true });
  });
});

describe("a flask", () => {
  it("heals its share, never past whole, and is used up", () => {
    expect(drink(30, HERO.hp, 3)).toEqual({ hp: 30 + HERO.flask, flasks: 2 });
    expect(drink(HERO.hp - 5, HERO.hp, 1)).toEqual({ hp: HERO.hp, flasks: 0 });
  });

  it("is not drunk with none left or nothing to heal", () => {
    expect(drink(30, HERO.hp, 0)).toEqual({ hp: 30, flasks: 0 });
    expect(drink(HERO.hp, HERO.hp, 3)).toEqual({ hp: HERO.hp, flasks: 3 });
  });
});

describe("the hero's walking", () => {
  // Open ground with a wall down the middle and a gap at the bottom; woods (T) block.
  const island = (rows: string[]) => ({ rows, start: { a: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } }, b: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } } }, mines: [], lair: { col: 1, row: 1 } });
  const ground = ["~~~~~~~~~~", "~...T....~", "~...T....~", "~...T....~", "~........~", "~~~~~~~~~~"];

  it("pulls a path across open ground straight to its end", () => {
    useIsland(island(ground));
    const from = { col: 1, row: 1 };
    const to = { col: 3, row: 3 };
    expect(smoothPath(from, findPath(from, to)!)).toEqual([to]);
  });

  it("keeps the corner a wall forces, and never cuts through it", () => {
    useIsland(island(ground));
    const from = { col: 2, row: 1 };
    const to = { col: 6, row: 1 };
    const legs = smoothPath(from, findPath(from, to)!);
    expect(legs.length).toBeGreaterThan(1);
    let at = from;
    for (const leg of legs) (expect(clearLine(at, leg)).toBe(true), (at = leg));
    expect(at).toEqual(to);
  });

  it("walks a click on the woods to the nearest ground beside them", () => {
    useIsland(island(ground));
    const way = routeToward({ col: 1, row: 2 }, { col: 4, row: 2 });
    expect(way.at(-1)).toEqual({ col: 3, row: 2 });
  });

  it("walks a click on the sea to the nearest shore", () => {
    useIsland(island(ground));
    const way = routeToward({ col: 2, row: 2 }, { col: 2, row: 0 });
    expect(way.at(-1)).toEqual({ col: 2, row: 1 });
  });
});

describe("the cinder troll", () => {
  it("slams up close, and further out charges and tosses embers in turn", () => {
    expect(trollMove(1, null)).toBe("slam");
    expect(trollMove(4, null)).toBe("charge");
    expect(trollMove(4, "charge")).toBe("toss");
    expect(trollMove(4, "toss")).toBe("charge");
    expect(trollMove(TROLL.charge.tiles + 1, null)).toBeNull();
  });

  it("charges as far as its reach, and stops short of a wall", () => {
    const island = (rows: string[]) => ({ rows, start: { a: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } }, b: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } } }, mines: [], lair: { col: 1, row: 1 } });
    useIsland(island(["~~~~~~~~~~", "~........~", "~...T....~", "~~~~~~~~~~"]));
    expect(chargeLine({ col: 1, row: 1 }, { col: 3, row: 1 }).at(-1)).toEqual({ col: 7, row: 1 });
    expect(chargeLine({ col: 1, row: 2 }, { col: 8, row: 2 })).toEqual([{ col: 2, row: 2 }, { col: 3, row: 2 }]);
  });
});
