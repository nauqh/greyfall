import { describe, expect, it } from "vitest";

import { footprint } from "../src/atlas.ts";
import { areaMap, findPath, isWalkable, useIsland } from "../src/index.ts";
import { NPCS, nextTalk, talkKey, type WorldFlag } from "../src/npcs.ts";

const ferrow = NPCS.find((n) => n.id === "ferrow")!;
const heardAll = (ids: string[]): Set<string> => new Set(ids.map((id) => `ferrow.${id}`));

describe("talking", () => {
  it("plays the conversations in order, then repeats the last", () => {
    expect(nextTalk(ferrow, new Set(), new Set()).id).toBe("first");
    expect(nextTalk(ferrow, heardAll(["first"]), new Set()).id).toBe("roads");
    expect(nextTalk(ferrow, heardAll(["first", "roads", "rest"]), new Set()).id).toBe("rest");
  });

  it("remarks on the world only once met, and only once", () => {
    const died = new Set<WorldFlag>(["died"]);
    expect(nextTalk(ferrow, new Set(), died).id).toBe("first");
    expect(nextTalk(ferrow, heardAll(["first"]), died).id).toBe("died");
    expect(nextTalk(ferrow, heardAll(["first", "died"]), died).id).toBe("roads");
  });

  it("keys every conversation apart", () => {
    const keys = NPCS.flatMap((n) => n.talks.map((t) => talkKey(n, t)));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("where the folk stand", () => {
  it("each on open ground the captain can walk to", () => {
    for (const area of new Set(NPCS.map((n) => n.area))) {
      const map = areaMap(area);
      useIsland(map.island);
      const taken = new Set(map.props.flatMap((p) => footprint(p)).map((c) => `${c.col},${c.row}`));
      for (const n of NPCS.filter((n) => n.area === area)) {
        expect(isWalkable(n.at.col, n.at.row), n.id).toBe(true);
        expect(taken.has(`${n.at.col},${n.at.row}`), n.id).toBe(false);
        expect(findPath(map.entry, n.at), n.id).not.toBeNull();
      }
    }
  });

  it("by what they talk about, on the map's own grid", () => {
    const map = areaMap("harbour");
    const at = (id: string) => NPCS.find((n) => n.id === id)!.at;
    const near = (a: { col: number; row: number }, b: { col: number; row: number }) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) <= 3;
    expect(map.fires.some((f) => near(f, at("ferrow")))).toBe(true);
    expect(near(map.exits.find((e) => e.name === "Old Well")!.at, at("tobin"))).toBe(true);
    expect(map.props.some((p) => p.art === "barracks" && near(p, at("corwin")))).toBe(true);
    expect(map.props.some((p) => p.art === "monastery" && near(p, at("ysolde")))).toBe(true);
  });
});
