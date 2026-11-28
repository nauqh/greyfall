import { describe, expect, it } from "vitest";

import { BOSS_KITS, bossAim, CLASSES, FOES, GIFTS, HERO, LENT, ITEMS, LOOT, lootDrop, NPCS, LEVEL_UP, NO_LEVELS, SOFT_CAP, savedLevels, heroLevel, swingWait, type Levels, kit, levelCost, onOffer, STAMINA, block, canAct, recover, spend, clearLine, clearShot, comboStep, drink, findPath, canReach, foeIntent, routeToward, smoothPath, struck, throughGuard, useIsland } from "../src/index.ts";

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

  it("chains three swings, then starts over, and a pause breaks the chain", () => {
    let step = 0;
    const steps = [];
    for (let i = 0; i < 4; i++) steps.push((step = comboStep(step, 0)));
    expect(steps).toEqual([1, 2, 3, 1]);
    expect(comboStep(1, HERO.combo + 0.1)).toBe(1);
  });

  it("is mostly turned by a raised shield, but never wholly", () => {
    for (const foe of Object.values(FOES)) {
      expect(throughGuard(foe!.attack)).toBeLessThan(foe!.attack);
      expect(throughGuard(foe!.attack)).toBeGreaterThanOrEqual(1);
    }
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
    expect(recover(105, 1, 5, false, 120)).toBe(120);
  });

  it("pays for a blow on the shield, and breaks the guard when it cannot", () => {
    expect(block(100, 8)).toEqual({ stamina: 100 - 8 * STAMINA.block, broken: false });
    expect(block(10, 8)).toEqual({ stamina: 0, broken: true });
    expect(block(100, 8, 1.75)).toEqual({ stamina: 86, broken: false });
  });
});

describe("the merchants' goods", () => {
  it("leave the hero as `ATLAS.md` has him with nothing bought", () => {
    const k = kit(new Set());
    expect(k).toMatchObject({ hp: HERO.hp, attack: HERO.attack, flasks: HERO.flasks, flask: HERO.flask, block: STAMINA.block, stamina: STAMINA.max, roll: STAMINA.roll });
    expect([k.greed, k.find, k.swing].map((n) => n.toFixed(2))).toEqual(["1.15", "1.15", "0.97"]);
  });

  it("add up: the edges on each other, both shards an ember each, an old save's Ember Shard by its name", () => {
    const all = kit(new Set(Object.keys(ITEMS).filter((k) => ![...GIFTS, ...LENT].includes(k as keyof typeof ITEMS))));
    expect(all).toMatchObject({ hp: 210, attack: 26, flasks: HERO.flasks + 4, flask: 85, block: 1.25, stamina: STAMINA.max + 20 });
    expect(all.greed).toBeCloseTo(1.9);
    expect(kit(new Set(["Ember Shard"])).flasks).toBe(HERO.flasks + 1);
  });

  it("show each edge once the one before is owned and its boss has fallen", () => {
    const stock = [{ item: "Brenna's Edge" }, { item: "Keener Edge", after: "stoneWarden" }, { item: "Grey-Iron Edge", after: "troll" }] as const;
    const shown = (bought: string[], slain: string[]) => onOffer(stock, new Set(bought), new Set(slain), new Set()).map((s) => s.item);
    expect(shown([], ["stoneWarden", "troll"])).toEqual(["Brenna's Edge"]);
    expect(shown(["Brenna's Edge"], [])).toEqual(["Brenna's Edge"]);
    expect(shown(["Brenna's Edge"], ["stoneWarden"])).toEqual(["Brenna's Edge", "Keener Edge"]);
    expect(shown(["Brenna's Edge", "Keener Edge"], ["stoneWarden", "troll"])).toEqual(["Brenna's Edge", "Keener Edge", "Grey-Iron Edge"]);
  });
});

describe("a flask", () => {
  it("heals its share, never past whole, and is used up", () => {
    expect(drink(30, HERO.hp, 3)).toEqual({ hp: 30 + HERO.flask, flasks: 2 });
    expect(drink(HERO.hp - 5, HERO.hp, 1)).toEqual({ hp: HERO.hp, flasks: 0 });
    expect(drink(30, HERO.hp, 3, 55)).toEqual({ hp: 85, flasks: 2 });
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

describe("levelling at a bonfire", () => {
  const lv = (l: Partial<Levels>): Levels => ({ ...NO_LEVELS, ...l });

  it("adds each level's share to the kit, and every level costs more than the last", () => {
    const k = kit(new Set(), lv({ vigour: 2, strength: 1, endurance: 3, warmth: 2, luck: 4 }));
    expect([k.hp, k.attack, k.stamina, k.flask]).toEqual([HERO.hp + 2 * LEVEL_UP.hp, HERO.attack + LEVEL_UP.attack, STAMINA.max + 3 * LEVEL_UP.stamina, HERO.flask + 2 * LEVEL_UP.flask]);
    expect(k.greed).toBeCloseTo(1.35);
    expect(k.find).toBeCloseTo(1.35);
    const costs = [0, 1, 2, 5, 10].map((n) => levelCost(lv({ agility: n })));
    expect(costs[0]).toBe(150);
    expect(costs.every((c, i) => i === 0 || c > costs[i - 1]!)).toBe(true);
    expect(heroLevel(lv({ vigour: 3, luck: 2 }))).toBe(6);
  });

  it("starts every class at level one on twenty attribute levels, each its own spread", () => {
    const sums = Object.values(CLASSES).map((c) => Object.values(c.start).reduce((a, b) => a + b, 0));
    expect(sums.every((n) => n === 20)).toBe(true);
    expect(heroLevel(NO_LEVELS)).toBe(1);
    expect(kit(new Set(), NO_LEVELS, "lancer").hp).toBeGreaterThan(kit(new Set(), NO_LEVELS, "monk").hp);
  });

  it("grows a class's attack only with the attributes it scales with", () => {
    const start = (cls: keyof typeof CLASSES) => kit(new Set(), NO_LEVELS, cls).attack;
    expect(kit(new Set(), lv({ intelligence: 5 }), "warrior").attack).toBe(start("warrior"));
    expect(kit(new Set(), lv({ intelligence: 4 }), "monk").attack).toBe(start("monk") + 6);
    expect(kit(new Set(), lv({ agility: 3 }), "archer").attack).toBe(start("archer") + 6);
  });

  it("quickens the swing and the roll with agility, never past the floor", () => {
    const quick = kit(new Set(), lv({ agility: 10 }));
    expect(quick.swing).toBeCloseTo(0.82);
    expect(quick.roll).toBe(17);
    expect(swingWait(3, "warrior", quick.swing)).toBeCloseTo(HERO.every * 0.82);
    const quickest = kit(new Set(), lv({ agility: 99 }));
    expect([quickest.swing, quickest.roll]).toEqual([0.7, 12]);
  });

  it("gives half as much past the soft cap", () => {
    // A Warrior's 5 Vigour and 21 bought: 26, the six past the cap worth three.
    expect(kit(new Set(), lv({ vigour: 21 })).hp).toBe(50 + (SOFT_CAP + 3) * LEVEL_UP.hp);
  });

  it("reads an old save's three levels as Vigour, Strength and Endurance", () => {
    expect(savedLevels({ hp: 2, attack: 1, stamina: 3 })).toEqual(lv({ vigour: 2, strength: 1, endurance: 3 }));
    expect(savedLevels({ luck: 2, junk: 9 })).toEqual(lv({ luck: 2 }));
  });
});

describe("a boss's moves", () => {
  const open = () => true;
  const boar = BOSS_KITS.rampartBull!;
  const calm = { snared: false, adds: 0, fallen: 0 };
  it("charges one lane, a little past the mark, and wheels round after", () => {
    useIsland({ rows: Array.from({ length: 12 }, () => ".".repeat(24)), start: { a: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } }, b: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } } }, mines: [], lair: { col: 1, row: 1 } });
    const line = bossAim(boar.moves.charge!, { col: 0, row: 5 }, { col: 8, row: 5 }, open);
    expect(line).toHaveLength(11);
    expect(line.at(-1)).toEqual({ col: 11, row: 5 });
    expect(new Set(line.map((c) => c.row))).toEqual(new Set([5]));
    expect(boar.pick(6, "charge", false, calm)).toBe("wheel");
    expect(boar.pick(6, "wheel", false, calm)).toBe("cannons");
    expect(boar.pick(6, "charge", true, calm)).toBe("charge");
  });
  it("stops the minotaur's rush at a rock, short of its reach", () => {
    useIsland({ rows: ["............", ".....%......", "............"], start: { a: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } }, b: { castle: { col: 1, row: 1 }, barracks: { col: 1, row: 1 } } }, mines: [], lair: { col: 1, row: 1 } });
    const rush = BOSS_KITS.minotaur!.moves.rush!;
    expect(bossAim(rush, { col: 0, row: 1 }, { col: 11, row: 1 }, () => true)).toHaveLength(4);
    expect(bossAim(rush, { col: 6, row: 1 }, { col: 9, row: 1 }, () => true).at(-1)).toEqual({ col: 10, row: 1 });
    expect(BOSS_KITS.minotaur!.pick(5, "rush", false, calm)).toBe(null);
    expect(BOSS_KITS.minotaur!.pick(5, "rush", true, calm)).toBe("again");
  });
  it("picks only moves each boss has, at any range and after any move, raging or not", () => {
    for (const [kind, kit] of Object.entries(BOSS_KITS)) {
      for (const last of [null, ...Object.keys(kit!.moves)])
        for (let d = 0; d <= 14; d++)
          for (const raging of [false, true])
            for (const sees of [calm, { snared: true, adds: 2, fallen: 1 }]) {
              const move = kit!.pick(d, last, raging, sees);
              if (move !== null) expect(kit!.moves[move], `${kind} picks ${move}`).toBeDefined();
            }
      expect(FOES[kind], kind).toBeDefined();
      if (kit!.rage?.opener) expect(kit!.moves[kit!.rage.opener], `${kind} opens with ${kit!.rage.opener}`).toBeDefined();
      for (const m of Object.values(kit!.moves)) if (m.summon) expect(FOES[m.summon.kind], m.summon.kind).toBeDefined();
    }
  });
  it("gives every boss but the troll a second phase", () => {
    expect(Object.entries(BOSS_KITS).filter(([, k]) => !k!.rage?.opener).map(([k]) => k)).toEqual(["troll"]);
  });
  it("pounces on a mark the web holds, and stands a broken totem up only while one of the dead stands", () => {
    expect(BOSS_KITS.weaver!.pick(5, "web", false, { ...calm, snared: true })).toBe("pounce");
    expect(BOSS_KITS.barrowKing!.pick(5, "hex", false, { snared: false, adds: 1, fallen: 1 })).toBe("rouse");
    expect(BOSS_KITS.barrowKing!.pick(5, "hex", false, { snared: false, adds: 0, fallen: 1 })).not.toBe("rouse");
    expect(BOSS_KITS.oldBamboo!.pick(5, "toss", false, calm)).toBe("eat");
  });
  it("tolls a ring round the warden, safe up close", () => {
    const ring = bossAim(BOSS_KITS.stoneWarden!.moves.toll!, { col: 5, row: 5 }, { col: 7, row: 5 }, open);
    expect(ring.every((c) => Math.max(Math.abs(c.col - 5), Math.abs(c.row - 5)) >= 2)).toBe(true);
    expect(ring).toHaveLength(49 - 9);
  });
  it("raises only while the king's raised dead are few, and leaves the cannons to the boar's chief", () => {
    expect(BOSS_KITS.barrowKing!.moves.raise!.summon).toEqual({ kind: "skull", n: 2, cap: 3 });
    expect(boar.pick(5, "wheel", false, calm)).toBe("cannons");
    expect(boar.pick(5, "wheel", true, calm)).toBe("charge");
  });
});

describe("the classes past the Warrior", () => {
  it("leaves a guard only to the Warrior and the Lancer", () => {
    expect(Object.entries(CLASSES).filter(([, c]) => c.shield).map(([k]) => k)).toEqual(["warrior", "lancer"]);
  });

  it("gives each one thing of its own", () => {
    expect(CLASSES.lancer.knockAll).toBe(true);
    expect(CLASSES.archer.pin).toBe(true);
    expect(CLASSES.monk.mend).toBeGreaterThan(0);
  });

  it("lets only the bow and the prayer reach a flier", () => {
    const bat = FOES.bat!;
    expect(Object.entries(CLASSES).filter(([, c]) => canReach(c.reach, bat)).map(([k]) => k)).toEqual(["archer", "monk"]);
  });
});

describe("trade goods", () => {
  it("come off a monster that fights, each kind leaving one good at most", () => {
    const kinds = Object.values(LOOT).flatMap((l) => [...l.from]);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of kinds) expect(FOES[k], k).toBeDefined();
  });

  it("are bought by a merchant", () => {
    for (const [name, l] of Object.entries(LOOT)) expect(NPCS.find((n) => n.id === l.buyer)?.shop, name).toBeDefined();
  });

  it("drop on a roll under the chance, never off a monster with none", () => {
    expect(lootDrop("spider", 0)).toBe("Spider Silk");
    expect(lootDrop("spider", LOOT["Spider Silk"].chance)).toBeUndefined();
    expect(lootDrop("minotaur", 0)).toBeUndefined();
  });
});
