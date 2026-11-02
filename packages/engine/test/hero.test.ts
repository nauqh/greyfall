import { describe, expect, it } from "vitest";

import { FOES, HERO, foeIntent, struck } from "../src/index.ts";

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
});
