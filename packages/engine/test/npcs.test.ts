import { describe, expect, it } from "vitest";

import { footprint } from "../src/atlas.ts";
import { ITEMS, areaMap, findPath, isWalkable, useIsland } from "../src/index.ts";
import { NPCS, nextTalk, talkKey, whereabouts, type Npc, type WorldFlag } from "../src/npcs.ts";

const ferrow = NPCS.find((n) => n.id === "ferrow")!;
const heardAll = (ids: string[]): Set<string> => new Set(ids.map((id) => `ferrow.${id}`));
const npc = (id: string): Npc => NPCS.find((n) => n.id === id)!;
const flags = (...f: WorldFlag[]): Set<WorldFlag> => new Set(f);
const stations = (n: Npc) => [{ area: n.area, at: n.at, talks: n.talks }, ...(n.later ?? [])];

describe("talking", () => {
  it("plays the conversations in order, then repeats the last", () => {
    expect(nextTalk(ferrow, new Set(), new Set()).id).toBe("first");
    expect(nextTalk(ferrow, heardAll(["first"]), new Set()).id).toBe("shore");
    expect(nextTalk(ferrow, heardAll(["first", "shore", "goal", "castle", "well"]), new Set()).id).toBe("roads");
    expect(nextTalk(ferrow, heardAll(["first", "shore", "goal", "castle", "well", "roads", "rest"]), new Set()).id).toBe("rest");
  });

  it("remarks on the world only once met, and only once", () => {
    const died = new Set<WorldFlag>(["died"]);
    expect(nextTalk(ferrow, new Set(), died).id).toBe("first");
    expect(nextTalk(ferrow, heardAll(["first"]), died).id).toBe("died");
    expect(nextTalk(ferrow, heardAll(["first", "died"]), died).id).toBe("shore");
  });

  it("has Tobin warn of the flyers down the well, and point to Wren's bows, until the wanderer listens", () => {
    const tobin = NPCS.find((n) => n.id === "tobin")!;
    const heard = new Set(["tobin.first", "tobin.rule"]);
    const wings = nextTalk(tobin, heard, new Set());
    expect(wings.id).toBe("wings");
    expect(wings.lines.join(" ")).toMatch(/Wren/);
    expect(nextTalk(tobin, new Set([...heard, "tobin.wings"]), new Set()).id).toBe("wings");
  });

  it("keys every conversation apart", () => {
    const keys = NPCS.flatMap((n) => stations(n).flatMap((s) => (s.talks ?? []).map((t) => talkKey(n, t))));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never calls the wanderer a captain or a sailor", () => {
    const said = NPCS.flatMap((n) => [
      n.greet,
      n.part,
      ...(n.shop ? [n.shop.poor, n.shop.sold] : []),
      ...stations(n).flatMap((s) => (s.talks ?? []).flatMap((t) => t.lines)),
    ]);
    expect(said.join(" ")).not.toMatch(/\b(captain|sailor)\b/i);
  });
});

describe("the merchants", () => {
  it("sell every good, each by one merchant only, and none on the Ramparts", () => {
    const sold = NPCS.flatMap((n) => (n.shop?.stock ?? []).map((s) => s.item));
    expect(sold.sort()).toEqual(Object.keys(ITEMS).sort());
    expect(NPCS.filter((n) => n.shop && n.area === "ramparts")).toEqual([]);
  });
});

describe("where the folk stand", () => {
  const spots = NPCS.flatMap((n) => stations(n).flatMap((s) => (s.area && s.at ? [{ id: n.id, area: s.area, at: s.at }] : [])));
  it.each([...new Set(spots.map((s) => s.area))])("each on open ground the captain can walk to, in %s", (area) => {
    const map = areaMap(area);
    useIsland(map.island);
    const taken = new Set(map.props.flatMap((p) => footprint(p)).map((c) => `${c.col},${c.row}`));
    for (const { id, at } of spots.filter((s) => s.area === area)) {
      expect(isWalkable(at.col, at.row), id).toBe(true);
      expect(taken.has(`${at.col},${at.row}`), id).toBe(false);
      expect(findPath(map.entry, at), id).not.toBeNull();
    }
  });

  it("by what they talk about, on the map's own grid", () => {
    const map = areaMap("harbour");
    const at = (id: string) => NPCS.find((n) => n.id === id)!.at;
    const near = (a: { col: number; row: number }, b: { col: number; row: number }) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) <= 3;
    expect(map.fires.some((f) => near(f, at("ferrow")))).toBe(true);
    expect(near(map.exits.find((e) => e.name === "Old Well")!.at, at("tobin"))).toBe(true);
    expect(areaMap("keep").props.some((p) => p.art === "barracks" && near(p, at("corwin")))).toBe(true);
    expect(map.props.some((p) => p.art === "monastery" && near(p, at("ysolde")))).toBe(true);
  });
});

describe("the questline", () => {
  it("keeps everyone home until something happens", () => {
    for (const n of NPCS) expect(whereabouts(n, new Set())?.area, n.id).toBe(n.area);
  });

  it("moves folk on as the world changes, the last station that applies winning", () => {
    expect(whereabouts(npc("tobin"), flags("wellDescended"))?.area).toBe("harbour");
    expect(whereabouts(npc("tobin"), flags("tobinDown"))?.area).toBe("undercroft");
    expect(whereabouts(npc("tobin"), flags("tobinDown", "tobinDeeper"))?.area).toBe("deeps");
    expect(whereabouts(npc("penny"), flags("greyfallReached", "warlordDead"))?.talks[0]?.id).toBe("free");
  });

  it("asks for every flag a station names", () => {
    expect(whereabouts(npc("watchman"), flags("hornedKey"))?.area).toBe("harbour");
    expect(whereabouts(npc("watchman"), flags("watchmanOut"))?.area).toBe("barrowmoor");
    expect(whereabouts(npc("watchman"), flags("watchmanOut", "hornedKey"))).toBeNull();
  });

  it("lets Ansel live only if the warlord falls before he goes ahead", () => {
    const ansel = npc("ansel");
    expect(whereabouts(ansel, flags("anselRoused", "warlordDead"))).toMatchObject({ area: "keep", dead: false });
    expect(whereabouts(ansel, flags("anselRoused", "anselAhead"))).toMatchObject({ area: "greyfall", dead: true, talks: [] });
    expect(whereabouts(ansel, flags("anselRoused", "anselAhead", "warlordDead"))?.dead).toBe(true);
  });

  it("talks where they stand, a remark waiting on the first talk there", () => {
    const tobin = npc("tobin");
    const down = flags("wellDescended", "tobinDown");
    expect(nextTalk(tobin, new Set(["tobin.first"]), flags("wellDescended")).id).toBe("below");
    expect(nextTalk(tobin, new Set(["tobin.first", "tobin.below"]), down).id).toBe("nook");
    expect(nextTalk(tobin, new Set(["tobin.nook"]), down).id).toBe("deeper");
    const corwin = npc("corwin");
    const won = flags("hornedKey", "warlordDead");
    expect(nextTalk(corwin, new Set(["corwin.first"]), won).id).toBe("barrows");
    expect(nextTalk(corwin, new Set(["corwin.barrows"]), won).id).toBe("done");
  });

  it("sets each quest flag from a talk that can be reached", () => {
    const set = new Map(NPCS.flatMap((n) => stations(n).flatMap((s) => (s.talks ?? []).filter((t) => t.sets).map((t) => [t.sets!, talkKey(n, t)] as const))));
    expect(Object.fromEntries(set)).toEqual({
      tobinDown: "tobin.below",
      tobinDeeper: "tobin.deeper",
      ysoldeDeeper: "ysolde.lake",
      anselRoused: "ansel.roused",
      anselAhead: "ansel.ahead",
      watchmanOut: "watchman.open",
      marenSails: "maren.sail",
    });
  });
});
