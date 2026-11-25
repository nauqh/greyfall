/**
 * The Atlas: the whole Shattered Reach, in three tiers on one grid. The
 * Surface is seven areas, each its own landmass, joined only at named gates
 * the way a Souls map joins its areas. Over it floats the Gilded City, the
 * shut sky city; under it the Underneath, caverns cut from the rock. Lifts,
 * wells and stairs join the tiers at the same spot on the grid, so what is
 * above a place is really above it, as in Dark Souls, where the depths lie
 * under the town and a city stands over the swamp.
 *
 * Each tier is pure data in the war island's height-map format (island.ts),
 * so the war's autotiler draws it and its pathing walks it. The web dresses it.
 */

// areas.ts imports this module too; areaMap() is only called inside the builders, after both have loaded.
import { areaMap } from "./areas.ts";
import { castsCliff, cellKey, isWalkable, level, stepsFrom, useIsland, type Cell, type Island } from "./island.ts";
import type { WorldFlag } from "./npcs.ts";
import { hashSeed, makeRng, type Rng } from "./rng.ts";

export type TierId = "sky" | "surface" | "below";

export type AreaId =
  | "saltreach"
  | "harbour"
  | "emberwood"
  | "crags"
  | "barrowmoor"
  | "fen"
  | "greyfall"
  | "steps"
  | "gilded"
  | "undercroft"
  | "deeps"
  | "hollow"
  | "landing"
  | "burg"
  | "ramparts"
  | "chapel"
  | "ring"
  | "keep"
  | "bullwall"
  | "belfry"
  | "trollpit"
  | "barrow"
  | "web"
  | "shellisle"
  | "throne"
  | "peak"
  | "sunhall";

/** The canon's lands, by tier and then in the order they are reached. */
export const LANDS = ["Lanternport", "Stiltwater", "Highward", "Emberwood", "Brasscrag", "Stillmere", "Kingsrest", "Greyfall", "Cloudstair", "Sunhold", "Tidewake", "Underwell", "Graveroad", "Hearthdeep"] as const;
export type Land = (typeof LANDS)[number];

export interface AtlasArea {
  id: AreaId;
  tier: TierId;
  name: string;
  land: Land;
  blurb: string;
  /** Tileset colours: lowland, plateau, and the heights above; one green for all, as the pack draws its own maps. */
  palette: readonly [number, number, number];
  /** The light over it, as a multiply colour; white for plain daylight. */
  mood: number;
  /** World height of its lowland, so ground shade and height agree on both sides of a crossing; none underground or in the sky. */
  rise?: number;
  /** A land of its own colour (moor, fen, crags, Greyfall): its ground keeps its palette, a way into it a change of country. */
  ownGround?: boolean;
  label: Cell;
}

/** open: a plain way through. gate: barred, opened once. shortcut: opens only
 *  from its far side. locked: needs keys. high: a road on the high ground. */
export type GateKind = "open" | "gate" | "shortcut" | "locked" | "high";

export interface AtlasGate {
  id: string;
  name: string;
  kind: GateKind;
  from: AreaId;
  to: AreaId;
  note: string;
  /** Where its name and its gatehouse stand. */
  at: Cell;
  /** The tiles cut through what parts the two areas: sea, sky or rock. */
  cells: Cell[];
}

/** lift: both ways. drop: down only, no climbing back. shortcut: works once
 *  opened from its upper end, the way a Souls elevator opens home. */
export type LiftKind = "lift" | "drop" | "shortcut";

export interface LiftEnd {
  tier: TierId;
  area: AreaId;
  at: Cell;
}

/** A way between tiers: `up` is its upper end, `down` its lower. */
export interface AtlasLift {
  id: string;
  name: string;
  kind: LiftKind;
  note: string;
  up: LiftEnd;
  down: LiftEnd;
}

/** A building or prop. `art` names the web's art; `color` picks a faction's building set. */
export interface Placed {
  art: string;
  col: number;
  row: number;
  color?: "blue" | "red" | "yellow" | "purple" | "black";
  flip?: boolean;
  scale?: number;
  /** A sheet's frame, for art with variants. */
  frame?: number;
  /** Placed by hand to the fraction of a tile, as a scene drew it: never moved to fit. */
  fixed?: boolean;
  /** Shown only while every when flag is set and no unless flag is. */
  when?: WorldFlag | readonly WorldFlag[];
  unless?: WorldFlag | readonly WorldFlag[];
}

/** A creature, or a knight with `color`. With `to`, it walks between the two; `act` picks a pose. */
export interface Dweller {
  kind: string;
  col: number;
  row: number;
  color?: "blue" | "red" | "yellow" | "purple" | "black";
  to?: Cell;
  act?: string;
  flip?: boolean;
  scale?: number;
  /** Shown only while every when flag is set and no unless flag is. */
  when?: WorldFlag | readonly WorldFlag[];
  unless?: WorldFlag | readonly WorldFlag[];
  /** Stands this many tiles up, on what is built on its tile: an archer on a tower's platform. */
  perch?: number;
}

/** Whether a prop or dweller stands, by the flags held. */
export function shown(x: Pick<Placed, "when" | "unless">, flags: ReadonlySet<WorldFlag>): boolean {
  return [x.when ?? []].flat().every((f) => flags.has(f)) && ![x.unless ?? []].flat().some((f) => flags.has(f));
}

/** What lies outside the land: sea round the Surface, open sky, solid rock. */
export type TierBase = "sea" | "sky" | "rock";

export interface AtlasTier {
  id: TierId;
  name: string;
  blurb: string;
  base: TierBase;
  island: Island;
  /** The area each tile belongs to, one character a tile (AREA_CODE), "-" for none. */
  areaAt: string[];
  gates: AtlasGate[];
  /** Paved ways, drawn two rows deep unless narrow. */
  roads: (Cell & { narrow?: boolean })[];
  props: Placed[];
  dwellers: Dweller[];
  /** Bonfires: where the warband would rest. */
  fires: Cell[];
  /** Campfires: lit like a bonfire, but no rest. */
  campfires: Cell[];
  bosses: { name: string; area: AreaId; col: number; row: number }[];
  /** Fence pens and barricades, as rectangles of tiles; `gate` opens `gateW` tiles (two when unset) of the south side,
   *  that many in from `col`. */
  fences: { col: number; row: number; w: number; h: number; gate?: number; gateW?: number }[];
  /** Each area laid from its own map by `real()`: its own map's cell (`col`, `row`) is atlas cell
   *  (`x0 + (col - c0) / scale`, `y0 + (row - r0) / scale`). */
  real?: Partial<Record<AreaId, RealPlace>>;
}

export interface RealPlace {
  x0: number;
  y0: number;
  c0: number;
  r0: number;
  scale: number;
}

export interface AtlasMap {
  tiers: Record<TierId, AtlasTier>;
  areas: AtlasArea[];
  lifts: AtlasLift[];
}

export const ATLAS_SIZE = { cols: 128, rows: 80 } as const;
export const TIERS: readonly TierId[] = ["sky", "surface", "below"];
/** One character a tile in `areaAt`, by the area's index in AREAS. */
export const AREA_CODE = "0123456789abcdefghijklmnopq";

export const AREAS: readonly AtlasArea[] = [
  {
    id: "saltreach",
    tier: "surface",
    name: "Stiltwater",
    land: "Stiltwater",
    blurb: "A stilt town on the western shallows. The salt is still cut and the boats still put in; the militia, in Sunhold's yellow and pay, keep the sea road, and the Grey has never come down to the water.",
    palette: [5, 5, 5],
    mood: 0xffffff,
    rise: 0,
    label: { col: 13, row: 45 },
  },
  {
    id: "harbour",
    tier: "surface",
    name: "Lanternport",
    land: "Lanternport",
    blurb: "The last town with a fire in it, under Highward, which the Grey took ward by ward from the outside in. Every road starts at the fire in its square and comes back to it: down the Old Well, up through Highward to the Watch Lift.",
    palette: [3, 3, 3],
    mood: 0xffffff,
    rise: 0,
    ownGround: true,
    label: { col: 44, row: 44 },
  },
  {
    id: "emberwood",
    tier: "surface",
    name: "Emberwood",
    land: "Emberwood",
    blurb: "A jungle over warm ground, steaming where no northern wood should grow. Everything that fears the cold has crowded into it: goblins in the trees, gnolls at its edge, and something horned in the hollow.",
    palette: [4, 4, 4],
    mood: 0xffe2c8,
    rise: 0,
    label: { col: 19, row: 10 },
  },
  {
    id: "crags",
    name: "Brasscrag",
    tier: "surface",
    land: "Brasscrag",
    blurb: "Gnome country: a rock that climbs in five steps to the Tinker Peak, and a lift off the peak into the clouds. The gnomes built the city up there, and own none of it. A high bridge runs off the rock to Greyfall.",
    palette: [2, 2, 2],
    mood: 0xfff8e6,
    rise: 0,
    ownGround: true,
    label: { col: 62, row: 15 },
  },
  {
    id: "barrowmoor",
    tier: "surface",
    name: "Kingsrest",
    land: "Kingsrest",
    blurb: "The old kings' barrows, dug no deeper than a grave. The dead keep their own roads after dusk, a masked king keeps the deepest barrow, and the cave goes down further than the moor has names for.",
    palette: [4, 4, 4],
    mood: 0xc4c4e4,
    rise: 1,
    ownGround: true,
    label: { col: 77, row: 47 },
  },
  {
    id: "fen",
    tier: "surface",
    name: "Stillmere",
    land: "Stillmere",
    blurb: "Reed and black water between the shore and the moor, colder every year. A chapel of the Order in the middle of it prays to the Grey as to a god, over a sinkhole that drinks the pools.",
    palette: [5, 5, 5],
    mood: 0xdcecdc,
    rise: 1,
    ownGround: true,
    label: { col: 54, row: 66 },
  },
  {
    id: "greyfall",
    tier: "surface",
    name: "Greyfall",
    land: "Greyfall",
    blurb: "The Citadel on its crag, where the Grey rose first and still falls like ash. Its lord wears a crown there yet, and what holds the walls was the garrison once. Two keys open the Grey Gate; the gnomes' high road is the other way in.",
    palette: [4, 4, 4],
    mood: 0x9c9fa8,
    rise: 2,
    ownGround: true,
    label: { col: 106, row: 12 },
  },
  {
    id: "steps",
    tier: "sky",
    name: "Cloudstair",
    land: "Cloudstair",
    blurb: "A chain of drifting isles, Highward's watch posts in the sky, from the Cloud Bridge west to a lift that drops onto its Keep. Nobody below can open it; whoever comes down it can.",
    palette: [1, 1, 1],
    mood: 0xfff4e0,
    label: { col: 42, row: 21 },
  },
  {
    id: "gilded",
    tier: "sky",
    name: "Sunhold",
    land: "Sunhold",
    blurb: "The sky city of the gnome-kings, gold and sunlight behind a shut gate. When the Grey rose it sent no spears; its yellow guard still holds the walls, the Sentinel keeps the hall of gold, and off its east end hangs the Throne Isle, the Citadel's old hall at court, barred off and left to the Grey.",
    palette: [1, 1, 1],
    mood: 0xfff0d0,
    label: { col: 102, row: 11 },
  },
  {
    id: "undercroft",
    tier: "below",
    name: "Underwell",
    land: "Underwell",
    blurb: "Lanternport's cisterns and catacombs, under its well. Black water, old bones, spiders in the pillars, and a tunnel east that nobody admits to digging.",
    palette: [4, 4, 4],
    mood: 0x8c88a8,
    label: { col: 48, row: 54 },
  },
  {
    id: "deeps",
    tier: "below",
    name: "Graveroad",
    land: "Graveroad",
    blurb: "The old kings' grave-roads under the moor, down as deep as a grave may go, and then deeper. The Weaver nests in the deepest cave, and the Sinking Stair goes on down past her.",
    palette: [4, 4, 4],
    mood: 0x8478a0,
    label: { col: 78, row: 60 },
  },
  {
    id: "hollow",
    tier: "below",
    name: "Hearthdeep",
    land: "Hearthdeep",
    blurb: "The bottom of the world: a still lake under the fen, warm, lit by gold in the rock, where stone trees stand in the shallows and something vast sleeps in its shell.",
    palette: [5, 5, 5],
    mood: 0x9ab4c8,
    label: { col: 44, row: 70 },
  },
  {
    id: "landing",
    tier: "below",
    name: "Tidewake",
    land: "Tidewake",
    blurb: "The sea cave under Lanternport where you wake with the tide. The water in it runs warm. Narrow ways through the rock, and notes scratched by those who woke there before.",
    palette: [5, 5, 5],
    mood: 0x8fb4c8,
    label: { col: 24, row: 45 },
  },
  {
    id: "burg",
    tier: "surface",
    name: "The Lower Burg",
    land: "Highward",
    blurb: "Highward's outer town on the hill above Lanternport, fallen to the Grey while the town below held. Thieves in the lanes, the dead in the yards, and the Ramparts above.",
    palette: [5, 5, 5],
    mood: 0xeee8e0,
    rise: 1,
    label: { col: 44, row: 29 },
  },
  {
    id: "ramparts",
    tier: "surface",
    name: "The Ramparts",
    land: "Highward",
    blurb: "Highward's curtain wall above the Burg, its walk running on to the wall the boar holds, and past him the Gun Bridge over the chasm to the Chapel Ward.",
    palette: [4, 4, 4],
    mood: 0xeee8e0,
    rise: 3,
    label: { col: 44, row: 19 },
  },
  {
    id: "chapel",
    tier: "surface",
    name: "The Chapel Ward",
    land: "Highward",
    blurb: "Highward's monastery behind the Gun Bridge: a cloister round a still pond, the chapel on its terrace, and on the bell roof a warden of stone. Its lift goes down to Old Town; its postern opens on Emberwood.",
    palette: [5, 5, 5],
    mood: 0xf2ece4,
    rise: 5,
    label: { col: 76, row: 30 },
  },
  {
    id: "ring",
    tier: "below",
    name: "The Bull's Ring",
    land: "Tidewake",
    blurb: "A cavern at the sea cave's end, round as an arena, where a troll sits in the warm water and keeps the boat out to Lanternport.",
    palette: [5, 5, 5],
    mood: 0xc8a888,
    label: { col: 40, row: 46 },
  },
  {
    id: "keep",
    tier: "surface",
    name: "The Keep",
    land: "Highward",
    blurb: "Highward's crown over Lanternport: its bailey and garrison, the hall, and the Watch Lift up to the sky. Its gate off the Burg opens to the Ember Key.",
    palette: [3, 3, 3],
    mood: 0xffffff,
    rise: 1,
    label: { col: 33, row: 24 },
  },
  {
    id: "bullwall",
    tier: "surface",
    name: "The Bull's Wall",
    land: "Highward",
    blurb: "The curtain wall past the Ramparts' walk, three paces wide over the drop. A goblin chief on the garrison's war boar holds it, the goblins' cannons trained on it; past him the Ladder down to the Burg and the Gun Bridge to the Chapel Ward.",
    palette: [4, 4, 4],
    mood: 0xe4dcd4,
    rise: 3,
    label: { col: 59, row: 25 },
  },
  {
    id: "belfry",
    tier: "surface",
    name: "The Belfry",
    land: "Highward",
    blurb: "The Chapel Ward's bell tower, climbed by its outside stair to the loft where the bell hangs silent and a gargoyle of stone squats under it, stone-skinned to all but a quick blade. The Postern stair goes down its back to Emberwood.",
    palette: [5, 5, 5],
    mood: 0xe8e4f0,
    rise: 5,
    label: { col: 60, row: 30 },
  },
  {
    id: "trollpit",
    tier: "surface",
    name: "The Ember Hollow",
    land: "Emberwood",
    blurb: "A pan of hot ash in the north of Emberwood, where the ground smokes and the jungle stands back. The Ember Bull lies in it, fed and crowned by the goblins, the steward's key on his harness; past him the gnomes' Crag Stair climbs out of the steam to the rock.",
    palette: [4, 4, 4],
    mood: 0xffc8a0,
    rise: 0,
    label: { col: 41, row: 4 },
  },
  {
    id: "barrow",
    tier: "below",
    name: "The King's Barrow",
    land: "Kingsrest",
    blurb: "Inside the greatest of the moor's barrows: a hall of the old kings' coffins, and the hex-king who will not lie in his, warded by the totems round his hall. Behind his throne the tomb goes on down to Graveroad.",
    palette: [4, 4, 4],
    mood: 0xa898c8,
    label: { col: 78, row: 35 },
  },
  {
    id: "web",
    tier: "below",
    name: "The Weaver's Web",
    land: "Graveroad",
    blurb: "A cavern under Graveroad strung from wall to wall, where the Weaver hangs over her brood. Its threads hold whoever walks into them, and the Sinking Stair goes on down past her to Hearthdeep.",
    palette: [5, 5, 5],
    mood: 0x8c84a8,
    label: { col: 70, row: 74 },
  },
  {
    id: "shellisle",
    tier: "below",
    name: "The Shell Isle",
    land: "Hearthdeep",
    blurb: "An isle in a lake under the fen, stone trees round its crown and something vast asleep in its shell. Past it the Shell Stair climbs to the fen, the one way back up from the bottom of the world.",
    palette: [5, 5, 5],
    mood: 0x9ab4c8,
    label: { col: 61, row: 69 },
  },
  {
    id: "throne",
    tier: "surface",
    name: "The Grey Keep",
    land: "Greyfall",
    blurb: "The Citadel's hall on Greyfall's crown, a nave of black towers up to the throne of its last lord, who kept his crown when he lost his name. He stands before it, and behind it the Throne Stair goes up into the sky.",
    palette: [4, 4, 4],
    mood: 0x9c9fa8,
    rise: 3,
    ownGround: true,
    label: { col: 103, row: 24 },
  },
  {
    id: "peak",
    tier: "surface",
    name: "The Tinker Peak",
    land: "Brasscrag",
    blurb: "The rock's summit, ringed in bamboo, where the bamboo-folk's grandsire sits and eats. Past him the gnomes' crane swings its basket up into the clouds.",
    palette: [2, 2, 2],
    mood: 0xfff8e6,
    rise: 5,
    ownGround: true,
    label: { col: 82, row: 11 },
  },
  {
    id: "sunhall",
    tier: "sky",
    name: "The Sun Hall",
    land: "Sunhold",
    blurb: "The gnome-kings' hall of gold, hung between the city and the Throne Isle. The Sun Sentinel keeps it behind its shield, and it holds the key to the span beyond.",
    palette: [1, 1, 1],
    mood: 0xfff0d0,
    label: { col: 102, row: 25 },
  },
];

export const TIER_INFO: Record<TierId, { name: string; blurb: string; base: TierBase }> = {
  sky: { name: "The Sky", blurb: "The sky over the rock and Greyfall, where the gnome-kings built in gold.", base: "sky" },
  surface: { name: "The Surface", blurb: "Seven lands on the sea and Highward over Lanternport, joined at their gates.", base: "sea" },
  below: { name: "The Underneath", blurb: "Caverns in the rock under the town, the moor and the fen.", base: "rock" },
};

const AREA_INDEX = Object.fromEntries(AREAS.map((a, i) => [a.id, i])) as Record<AreaId, number>;

/** The tops and stairs of each height above the lowland. */
const HEIGHT: Record<number, { top: string; left: string; right: string }> = {
  2: { top: "#", left: "<", right: ">" },
  3: { top: "^", left: "[", right: "]" },
  4: { top: "4", left: "{", right: "}" },
  5: { top: "5", left: "(", right: ")" },
};

const line = (a: Cell, b: Cell, each: (c: Cell) => void): void => {
  const n = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
  for (let i = 0; i <= n; i++) each({ col: Math.round(a.col + ((b.col - a.col) * i) / Math.max(1, n)), row: Math.round(a.row + ((b.row - a.row) * i) / Math.max(1, n)) });
};

/** What an area map is built from: the tier builder, sized for one area. */
export type TierBuilder = ReturnType<typeof tierBuilder>;

export interface Relief {
  area: AreaId;
  at: Cell;
  rx: number;
  ry: number;
  levels: 2 | 3 | 4 | 5;
  core?: { at: Cell; r: number };
}

/** Value noise in -1..1, smooth over `scale` tiles, the same for the same seed. */
export function noise(seed: string, scale: number): (c: number, r: number) => number {
  const v = (x: number, y: number) => (hashSeed(`${seed}:${x}:${y}`) / 4294967296) * 2 - 1;
  const ease = (k: number) => k * k * (3 - 2 * k);
  return (c, r) => {
    const x = c / scale;
    const y = r / scale;
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [ease(x - x0), ease(y - y0)];
    const top = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx;
    const bottom = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

type Builder = ReturnType<typeof tierBuilder>;

/**
 * The ground a prop's base covers, measured off its art: width in tiles, and
 * rows back from its base row. `clear` props want a tile of open ground of
 * their own height all round, so nothing stands on a cliff's lip or the shore.
 */
const FOOT: Record<string, { w: number; d: number; clear: boolean }> = {
  castle: { w: 4, d: 2, clear: true },
  monastery: { w: 3, d: 2, clear: true },
  barracks: { w: 3, d: 2, clear: true },
  archery: { w: 3, d: 2, clear: true },
  tower: { w: 2, d: 1, clear: true },
  house1: { w: 2, d: 1, clear: true },
  house2: { w: 2, d: 1, clear: true },
  house3: { w: 2, d: 1, clear: true },
  goblinHut: { w: 3, d: 1, clear: true },
  gnomeHut: { w: 2, d: 1, clear: true },
  gnomeTower: { w: 2, d: 1, clear: true },
  cave: { w: 4, d: 2, clear: true },
  fishHut: { w: 3, d: 1, clear: true },
  goldMine: { w: 3, d: 1, clear: true },
  trollDead: { w: 3, d: 1, clear: false },
  deadTree: { w: 2, d: 1, clear: false },
  // A bonfire wants its own level ground round it too: never on a cliff's lip.
  fire: { w: 1, d: 1, clear: true },
  boat: { w: 3, d: 1, clear: true },
  pirateTowerWater: { w: 2, d: 1, clear: true },
  watchtower: { w: 2, d: 1, clear: true },
};

/** The tiles under a prop's base, and with `ring` the open ground it wants round them. */
export function footprint(p: Placed, ring = false): Cell[] {
  const f = FOOT[p.art] ?? { w: 1, d: 1, clear: false };
  const w = Math.max(1, Math.round(f.w * (p.scale ?? 1)));
  const m = ring && f.clear ? 1 : 0;
  const [col, row] = [Math.round(p.col), Math.round(p.row)];
  const left = col - Math.floor((w - 1) / 2);
  const out: Cell[] = [];
  for (let r = row - f.d + 1 - m; r <= row + m; r++) for (let c = left - m; c < left + w + m; c++) out.push({ col: c, row: r });
  return out;
}

/** Props walked over, not into: gold to pick up, ore nuggets, bones in the grass, a torch on the wall, and whatever floats. */
const UNDERFOOT: ReadonlySet<string> = new Set(["goldStone", "ore1", "ore2", "ore3", "bones", "sconce", "boat", "pirateTowerWater", "bush", "rock", "waterRock"]);

/** The tiles no one walks through: every prop's base but those underfoot, and every fence post, as "col,row". A base
 *  stands centred under the art, drawn on its tile's middle: an even width rounds down, so none juts out to one side. */
export function solidCells(t: Pick<AtlasTier, "props" | "fences">): Set<string> {
  const out = new Set<string>();
  for (const p of t.props) {
    if (UNDERFOOT.has(p.art)) continue;
    const f = FOOT[p.art] ?? { w: 1, d: 1 };
    const half = Math.floor((Math.max(1, Math.round(f.w * (p.scale ?? 1))) - 1) / 2);
    const [col, row] = [Math.round(p.col), Math.round(p.row)];
    for (let r = row - f.d + 1; r <= row; r++) for (let c = col - half; c <= col + half; c++) out.add(`${c},${r}`);
  }
  for (const f of t.fences) {
    for (let c = f.col; c < f.col + f.w; c++) for (const r of [f.row, f.row + f.h - 1]) if (r === f.row || !inGate(f, c)) out.add(`${c},${r}`);
    for (let r = f.row; r < f.row + f.h; r++) for (const c of [f.col, f.col + f.w - 1]) out.add(`${c},${r}`);
  }
  return out;
}

/** Whether column `c` of a fence's south side is its gate. */
export function inGate(f: { col: number; gate?: number; gateW?: number }, c: number): boolean {
  return f.gate !== undefined && c - f.col >= f.gate && c - f.col < f.gate + (f.gateW ?? 2);
}

/** Props that stand in the sea, creatures that swim in it, and those that fly over anything. */
export const WATER_ART: ReadonlySet<string> = new Set(["boat", "pirateTowerWater"]);
export const SEA_KINDS: ReadonlySet<string> = new Set(["harpoonShark", "paddleShark", "seahorseBoat", "bombFish", "rubberDuck"]);
export const FLYING: ReadonlySet<string> = new Set(["bat", "bee", "imp"]);

/**
 * Lay down every relief as terrain, the way the pack's own maps draw high
 * ground: broad irregular tables whose edges notch in and out, cliffs that
 * can drop straight into the sea, and each height a tile inside the one
 * below it. Then a stair onto every table; a table that can take none is
 * levelled.
 */
function terrain(t: Builder, rows: number, cols: number): void {
  const { area, at, put } = t;
  const height: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  // Roads and gates run through the high ground as valleys: keep it a tile clear of them.
  const valley = new Set<string>();
  const clearOf = (c: number, r: number): void => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) valley.add(`${c + dc},${r + dr}`);
  };
  for (const k of [...t.roadSet, ...t.paths]) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    clearOf(c, r);
  }
  for (const g of t.gates) if (g.kind !== "high") for (const c of g.cells) clearOf(c.col, c.row);

  // Each height its own outline: its own noise, drifting toward the summit and shrinking, so
  // the heights read as terraces stepping up one way and not as rings round a point.
  t.reliefs.forEach((rel, i) => {
    const own = AREA_INDEX[rel.area];
    const peak = rel.core?.at ?? rel.at;
    for (let k = 2; k <= rel.levels; k++) {
      const coarse = noise(`relief:${t.id}:${i}:${k}`, 4);
      const fine = noise(`relief:${t.id}:${i}:${k}:fine`, 1.8);
      const step = (k - 2) / Math.max(1, rel.levels - 1);
      // Higher terraces sit back to the north, so their cliffs, which face south, stack into one face.
      const cx = rel.at.col + (peak.col - rel.at.col) * step;
      const cy = rel.at.row + (peak.row - rel.at.row) * step - rel.ry * 0.3 * step;
      const shrink = 1 - 0.24 * (k - 2);
      for (let r = Math.floor(rel.at.row - rel.ry - 2); r <= rel.at.row + rel.ry + 2; r++) {
        for (let c = Math.floor(rel.at.col - rel.rx - 2); c <= rel.at.col + rel.rx + 2; c++) {
          if (area[r]?.[c] !== own || !".T".includes(at(c, r)) || valley.has(`${c},${r}`)) continue;
          const d = Math.hypot((c - cx) / (rel.rx * shrink), (r - cy) / (rel.ry * shrink));
          const f = 1 - d + 0.42 * coarse(c, r) + 0.18 * fine(c, r);
          // A core keeps a flat top of its radius, and each height under it three tiles wider: nesting erodes two
          // tiles with a square, and a circle needs the extra tile to keep its diagonals.
          const core = rel.core && Math.hypot(c - rel.core.at.col, r - rel.core.at.row) <= rel.core.r + 3 * (rel.levels - k);
          if (f > 0.12 || core) height[r]![c] = Math.max(height[r]![c]!, k);
        }
      }
    }
  });
  // A high road laid before the terrain is part of the second height, and so is the ground
  // two tiles round each of its ends, where it lands, so it always meets that height.
  const landing = new Set<string>();
  for (const g of t.gates) {
    if (g.kind !== "high" || g.cells.length === 0) continue;
    for (const end of [g.cells[0]!, g.cells.at(-1)!]) {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (".T".includes(at(end.col + dc, end.row + dr))) landing.add(`${end.col + dc},${end.row + dr}`);
    }
  }
  const road = (c: number, r: number) => at(c, r) === "#" || landing.has(`${c},${r}`);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (road(c, r)) height[r]![c] = 2;
  // Authored ground: the highest block over a tile sets it exactly.
  const authored = new Map<string, number>();
  for (const b of t.blocks) {
    for (let r = b.y; r < b.y + b.h; r++) {
      for (let c = b.x; c < b.x + b.w; c++) {
        if (!".T".includes(at(c, r))) continue;
        const k = `${c},${r}`;
        authored.set(k, Math.max(authored.get(k) ?? 1, b.level));
        height[r]![c] = Math.max(height[r]![c]!, b.level);
      }
    }
  }
  // Landforms: irregular authored ground, each its own shape at its own height, finding its own stairs.
  const organic = new Map<string, number>();
  t.shapes.forEach((sh, id) => {
    for (const k of sh.keys) {
      const [c, r] = k.split(",").map(Number) as [number, number];
      if (!".T".includes(at(c, r))) continue;
      if ((authored.get(k) ?? 0) < sh.level) organic.set(k, id);
      authored.set(k, Math.max(authored.get(k) ?? 1, sh.level));
      height[r]![c] = Math.max(height[r]![c]!, sh.level);
    }
  });
  // A bridge deck and the height it stands at: it joins tables of that height only, not those under it.
  const spanned = new Map(t.blocks.filter((b) => b.span).flatMap((b) => Array.from({ length: b.w * b.h }, (_, i): [string, number] => [`${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`, b.level])));
  // A notch cut back to the lowland under authored ground: a block of level 1. A deck over it stays up.
  for (const b of t.blocks) if (b.level === 1) for (let r = b.y; r < b.y + b.h; r++) for (let c = b.x; c < b.x + b.w; c++) if (!spanned.has(`${c},${r}`)) authored.set(`${c},${r}`, 1);
  const top = Math.max(1, ...height.flat(), ...t.blocks.map((b) => b.level), ...t.shapes.map((sh) => sh.level));
  if (top < 2) return;

  type Mask = boolean[][];
  const blank = (): Mask => Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const get = (m: Mask, c: number, r: number) => m[r]?.[c] ?? false;
  const cores = new Set<string>();
  for (const rel of t.reliefs) {
    if (!rel.core) continue;
    const { at: p, r: rad } = rel.core;
    const reach = rad + 2 * (rel.levels - 2);
    for (let r = Math.floor(p.row - reach); r <= p.row + reach; r++) for (let c = Math.floor(p.col - reach); c <= p.col + reach; c++) if (Math.hypot(c - p.col, r - p.row) <= rad) cores.add(`${c},${r}`);
  }

  const masks: Mask[] = [];
  for (let k = 2; k <= top; k++) {
    let m = blank();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) m[r]![c] = height[r]![c]! >= k;
    // Smooth: a tile keeps the majority of its neighbourhood.
    for (let pass = 0; pass < 2; pass++) {
      const next = blank();
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) n += get(m, c + dc, r + dr) ? 1 : 0;
          const ground = height[r]![c]! >= 1;
          next[r]![c] = ground && (n >= 5 || (cores.has(`${c},${r}`) && height[r]![c]! >= k) || (k === 2 && road(c, r)));
        }
      }
      m = next;
    }
    // Straight cliff runs, as the pack draws them: fill one- and two-tile gaps in each row and
    // column, and drop runs that short, so an edge steps in notches, not a zigzag.
    for (let pass = 0; pass < 2; pass++) {
      for (const along of ["row", "col"] as const) {
        const outer = along === "row" ? rows : cols;
        const inner = along === "row" ? cols : rows;
        const cell = (o: number, i: number): [number, number] => (along === "row" ? [i, o] : [o, i]);
        for (let o = 0; o < outer; o++) {
          let i = 0;
          while (i < inner) {
            const [c, r] = cell(o, i);
            const on = get(m, c, r);
            let j = i;
            while (j < inner && get(m, ...cell(o, j)) === on) j++;
            const len = j - i;
            const bounded = i > 0 && j < inner;
            // A short gap inside high ground fills; a short spur of high ground goes.
            if (len <= 2 && bounded) {
              for (let x = i; x < j; x++) {
                const [cc, rr] = cell(o, x);
                if (on && (cores.has(`${cc},${rr}`) || (k === 2 && road(cc, rr)))) continue;
                if (!on && (height[rr]![cc]! < 1 || valley.has(`${cc},${rr}`))) continue;
                m[rr]![cc] = !on;
              }
            }
            i = j;
          }
        }
      }
    }
    // Inside the height below, two tiles in all round, so its cliff, its stairs and a walk past
    // its foot all stand on that height.
    if (k > 2) {
      const under = masks[k - 3]!;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!m[r]![c]) continue;
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (!get(under, c + dc, r + dr)) m[r]![c] = false;
        }
      }
    }
    if (k > 2) for (const key of landing) {
      const [c, r] = key.split(",").map(Number) as [number, number];
      m[r]![c] = false;
    }
    // No slivers: every tile has a neighbour of its height above or below it, and to one side.
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!m[r]![c] || (k === 2 && road(c, r))) continue;
          if ((!get(m, c, r - 1) && !get(m, c, r + 1)) || (!get(m, c - 1, r) && !get(m, c + 1, r))) m[r]![c] = false;
        }
      }
    }
    // Authored ground is exactly as drawn.
    for (const [key, lv] of authored) {
      const [c, r] = key.split(",").map(Number) as [number, number];
      m[r]![c] = lv >= k;
    }
    masks.push(m);
  }

  const levelAt = (c: number, r: number): number => {
    if (!".T#".includes(at(c, r))) return 0;
    if (landing.has(`${c},${r}`) && height[r]![c]! >= 1 && !get(masks[0]!, c, r)) return 1;
    let l = 1;
    for (let k = 2; k <= top; k++) if (get(masks[k - 2]!, c, r)) l = k;
    return l;
  };
  const stairs = new Map<string, string>();
  const isStair = (c: number, r: number) => stairs.has(`${c},${r}`);

  for (let k = 2; k <= top; k++) {
    const m = masks[k - 2]!;
    const seen = blank();
    for (let r0 = 0; r0 < rows; r0++) {
      for (let c0 = 0; c0 < cols; c0++) {
        if (!m[r0]![c0] || seen[r0]![c0] || (spanned.get(`${c0},${r0}`) ?? k) > k) continue;
        const comp: Cell[] = [];
        const queue: Cell[] = [{ col: c0, row: r0 }];
        seen[r0]![c0] = true;
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i]!;
          comp.push(p);
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const q = { col: p.col + dc, row: p.row + dr };
            if (get(m, q.col, q.row) && !seen[q.row]![q.col] && (spanned.get(`${q.col},${q.row}`) ?? k) <= k) {
              seen[q.row]![q.col] = true;
              queue.push(q);
            }
          }
        }
        // A stair stands beside the table's bottom row, on open ground of the height below, with that ground above it and
        // below, and a row down off its open side, where its slope runs out.
        const lower = (c: number, r: number) => levelAt(c, r) === k - 1 && !isStair(c, r) && (k > 2 || ".T".includes(at(c, r)));
        const found: { c: number; r: number; side: "L" | "R"; own: string }[] = [];
        for (const p of comp) {
          if (get(m, p.col, p.row + 1)) continue;
          for (const s of ["L", "R"] as const) {
            const c = p.col + (s === "L" ? -1 : 1);
            const r = p.row;
            // Grouped by area and by landform: every landform gets its own way up.
            const o = c + (s === "L" ? -1 : 1);
            if (lower(c, r) && lower(c, r - 1) && lower(c, r + 1) && lower(o, r) && lower(o, r + 1) && levelAt(c, r + 2) >= 1) found.push({ c, r, side: s, own: `${area[r]![c]}:${organic.get(`${p.col},${p.row}`) ?? ""}` });
          }
        }
        // Authored ground takes only its authored stairs.
        if (comp.some((p) => authored.has(`${p.col},${p.row}`) && !spanned.has(`${p.col},${p.row}`) && !organic.has(`${p.col},${p.row}`))) continue;
        // An authored stair onto it keeps it, though no stair of its own fits.
        const kept = t.ways.some((w) => w.level === k && comp.some((p) => p.row === w.row && p.col === w.col + (w.side === "L" ? 1 : -1)));
        if (found.length === 0 && !kept) {
          for (const p of comp) for (let j = k - 2; j < masks.length; j++) masks[j]![p.row]![p.col] = false;
          continue;
        }
        const mid = comp.reduce((n, p) => n + p.col, 0) / comp.length;
        // Both ends, in each area the table spans: a high road joins two areas' tables, and each needs its own way up.
        for (const own of new Set(found.map((f) => f.own))) {
          const pick = (s: "L" | "R") => found.filter((f) => f.side === s && f.own === own).sort((a, b) => b.r - a.r || Math.abs(a.c - mid) - Math.abs(b.c - mid))[0];
          for (const st of [pick("L"), pick("R")]) if (st) stairs.set(`${st.c},${st.r}`, st.side === "L" ? HEIGHT[k]!.left : HEIGHT[k]!.right);
        }
      }
    }
  }

  for (const w of t.ways) stairs.set(`${w.col},${w.row}`, w.side === "L" ? HEIGHT[w.level]!.left : HEIGHT[w.level]!.right);

  // Write the ground: tops, then stairs, with open ground at each stair's head, foot and the end of its slope.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!".T#".includes(at(c, r))) continue;
      const l = levelAt(c, r);
      if (l >= 2) put(c, r, HEIGHT[l]!.top);
      else if (at(c, r) === "#") put(c, r, ".");
    }
  }
  for (const [k, ch] of stairs) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    put(c, r, ch);
    const o = c + ("<[{(".includes(ch) ? -1 : 1);
    for (const [x, y] of [[c, r - 1], [c, r + 1], [o, r], [o, r + 1]] as const) if (at(x, y) === "T") put(x, y, ".");
  }
}

type Fence = AtlasTier["fences"][number];

/** Anything left on a cliff face or a stair by the terrain steps off it, onto the nearest open ground. */
function settleAll(t: Builder): void {
  const islandNow = (): Island => {
    const c0 = { col: 0, row: 0 };
    return { rows: t.grid.map((l) => l.join("")), start: { a: { castle: c0, barracks: c0 }, b: { castle: c0, barracks: c0 } }, mines: [], lair: c0 };
  };
  useIsland(islandNow());
  const slope = (c: Cell) => "<>[]{}()".includes(t.at(c.col, c.row));
  const key = (c: Cell) => `${c.col},${c.row}`;
  // A stair's head and the ground its slope runs down to stay clear, or the stair leads nowhere.
  const left = (x: number, y: number) => "<[{(".includes(t.at(x, y));
  const right = (x: number, y: number) => ">]})".includes(t.at(x, y));
  const byStair = (c: Cell) => left(c.col - 1, c.row) || right(c.col + 1, c.row) || left(c.col + 1, c.row - 1) || right(c.col - 1, c.row - 1);
  // Ground a building stands on, and the ground round it: taken once a building is placed.
  const under = new Set<string>();
  const taken = new Set<string>();

  /**
   * A building sits wholly on open ground of one height in its own area, with
   * a tile of that ground round it, clear of every other building: never on a
   * cliff's lip, a stair or the shore. A boat sits wholly in open water.
   */
  const fits = (p: Placed, own: number, height?: number): boolean => {
    const wet = WATER_ART.has(p.art);
    const base = level(p.col, p.row);
    if (!wet && height !== undefined && base !== height) return false;
    for (const c of footprint(p)) {
      if (taken.has(key(c))) return false;
      // A building is never on a road, a building in a street reads as one dropped there; stock and stalls may be.
      if (wet ? t.at(c.col, c.row) !== "~" : !isWalkable(c.col, c.row) || slope(c) || byStair(c) || level(c.col, c.row) !== base || t.area[c.row]?.[c.col] !== own || (FOOT[p.art]?.clear && t.roadSet.has(key(c)))) return false;
    }
    for (const c of footprint(p, true)) {
      if (under.has(key(c))) return false;
      if (wet) {
        if (t.at(c.col, c.row) !== "~") return false;
        continue;
      }
      const ch = t.at(c.col, c.row);
      // Woods may stand at its side; sea, a cliff face, a stair or other ground may not.
      if (ch === "~" || slope(c) || level(c.col, c.row) !== base || castsCliff(c.col, c.row - 1) || t.area[c.row]?.[c.col] !== own) return false;
    }
    return true;
  };
  const place = (p: Placed): void => {
    for (const c of footprint(p)) under.add(key(c));
    for (const c of footprint(p, true)) taken.add(key(c));
  };
  // Buildings that already fit stay; the rest move to the nearest place that fits, on the height meant for them when there is one.
  const own = (p: Placed) => (WATER_ART.has(p.art) ? -1 : t.area[p.row]?.[p.col] ?? -1);
  const fitted = t.props.map((p) => {
    const ok = p.fixed || fits(p, own(p));
    if (ok) place(p);
    return ok;
  });
  const site = (p: Placed): Placed => {
    const area = own(p);
    const meant = level(p.col, p.row);
    for (const height of [meant, undefined]) {
      for (let d = 1; d <= 14; d++) {
        const ring: Placed[] = [];
        for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) if (Math.max(Math.abs(dr), Math.abs(dc)) === d) ring.push({ ...p, col: p.col + dc, row: p.row + dr });
        ring.sort((a, b) => Math.hypot(a.col - p.col, a.row - p.row) - Math.hypot(b.col - p.col, b.row - p.row));
        // A building keeps to its area; a boat to the water near where it was moored.
        const q = ring.find((c) => (area < 0 || t.area[c.row]?.[c.col] === area) && fits(c, area < 0 ? own(c) : area, height));
        if (q) {
          place(q);
          return q;
        }
      }
    }
    return p;
  };
  t.props = t.props.map((p, i) => (fitted[i] ? p : site(p)));
  // Bonfires after the buildings, on ground of their own.
  const seat = (f: Cell): Cell => {
    const p: Placed = { art: "fire", ...f };
    if (fits(p, own(p))) {
      place(p);
      return f;
    }
    const q = site(p);
    return { col: q.col, row: q.row };
  };
  t.fires = t.fires.map(seat);
  t.campfires = t.campfires.map(seat);
  // Fences after the fires: every post on open ground of one height, a tile clear of any building or fire and of
  // each other; one that does not fit moves to the nearest place that does, or is left out.
  const posts = (f: Fence): Cell[] => {
    const out: Cell[] = [];
    for (let r = f.row; r < f.row + f.h; r++) for (let c = f.col; c < f.col + f.w; c++) if (r === f.row || (r === f.row + f.h - 1 && !inGate(f, c)) || c === f.col || c === f.col + f.w - 1) out.push({ col: c, row: r });
    return out;
  };
  const fenceFits = (f: Fence): boolean => {
    const base = level(f.col, f.row);
    const area = t.area[f.row]?.[f.col];
    return posts(f).every((c) => isWalkable(c.col, c.row) && !slope(c) && level(c.col, c.row) === base && !castsCliff(c.col, c.row - 1) && t.area[c.row]?.[c.col] === area && !taken.has(key(c)) && !t.roadSet.has(key(c)));
  };
  const fenced: Fence[] = [];
  for (const f of t.fences) {
    let at: Fence | undefined = fenceFits(f) ? f : undefined;
    for (let d = 1; d <= 6 && !at; d++) {
      for (let dr = -d; dr <= d && !at; dr++) for (let dc = -d; dc <= d && !at; dc++) {
        const q = { ...f, col: f.col + dc, row: f.row + dr };
        if (Math.max(Math.abs(dr), Math.abs(dc)) === d && fenceFits(q)) at = q;
      }
    }
    if (!at) continue;
    fenced.push(at);
    for (const c of posts(at)) under.add(key(c));
    for (let r = at.row - 1; r <= at.row + at.h; r++) for (let c = at.col - 1; c <= at.col + at.w; c++) taken.add(key({ col: c, row: r }));
  }
  t.fences = fenced;

  const open = (c: Cell) => isWalkable(c.col, c.row) && !slope(c) && !under.has(key(c));
  const settle = <T extends Cell>(p: T, wet = false): T => {
    if (open(p) || (wet && t.at(p.col, p.row) === "~")) return p;
    for (let d = 1; d < 8; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          const q = { col: p.col + dc, row: p.row + dr };
          if (open(q)) return { ...p, ...q };
        }
      }
    }
    return p;
  };
  // Flyers hover where they are put; swimmers stay in the sea.
  t.dwellers = t.dwellers.map((d) => (FLYING.has(d.kind) ? d : { ...settle(d, SEA_KINDS.has(d.kind)), ...(d.to && { to: settle(d.to, SEA_KINDS.has(d.kind)) }) }));
  // A walker whose beat the terrain cut keeps to its spot.
  const walks = (a: Cell, b: Cell): boolean => {
    const seen = new Set([key(a)]);
    const queue = [a];
    for (let i = 0; i < queue.length && i < 4000; i++) {
      for (const n of stepsFrom(queue[i]!)) {
        if (n.col === b.col && n.row === b.row) return true;
        if (!seen.has(key(n))) (seen.add(key(n)), queue.push(n));
      }
    }
    return false;
  };
  t.dwellers = t.dwellers.map((d) => {
    if (!d.to || FLYING.has(d.kind) || SEA_KINDS.has(d.kind) || walks(d, d.to)) return d;
    const { to: _cut, ...rest } = d;
    return rest;
  });
  t.bosses = t.bosses.map((b) => settle(b));
}

/** One tier under construction: its grid, and the tools that shape and fill it. */
export function tierBuilder(id: TierId, rng: Rng, size: { cols: number; rows: number } = ATLAS_SIZE) {
  const { cols, rows } = size;
  const base = TIER_INFO[id].base;
  /** What parts two areas: water round land, solid rock round caverns. */
  const wall = base === "rock" ? "%" : "~";
  const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(wall));
  const area: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const put = (c: number, r: number, ch: string): void => {
    if (r >= 1 && c >= 1 && r < rows - 1 && c < cols - 1) grid[r]![c] = ch;
  };
  const at = (c: number, r: number): string => grid[r]?.[c] ?? wall;

  const t = {
    id,
    grid,
    area,
    put,
    at,
    gates: [] as AtlasGate[],
    roadSet: new Set<string>(),
    lanes: new Set<string>(),
    props: [] as Placed[],
    dwellers: [] as Dweller[],
    fires: [] as Cell[],
    campfires: [] as Cell[],
    fences: [] as AtlasTier["fences"],
    bosses: [] as AtlasTier["bosses"],
    reliefs: [] as Relief[],
    placed: {} as Partial<Record<AreaId, RealPlace>>,
    /** Authored high ground: exact rectangles at a height, for a fortress's terraces. */
    blocks: [] as { level: number; x: number; y: number; w: number; h: number; span?: boolean }[],
    /** Landforms: irregular authored ground at a height, each finding its own stairs. */
    shapes: [] as { level: number; keys: Set<string>; owner?: string }[],
    /** Authored stairs onto authored ground; a table of authored ground takes no others. */
    ways: [] as { level: number; col: number; row: number; side: "L" | "R" }[],
    /** Ground copied tile for tile from a drawn scene: kept as drawn though no stair reaches it. */
    drawn: new Set<string>(),
    /** Ways the high ground keeps clear of, drawn or not: roads, and the bridges between isles. */
    paths: new Set<string>(),
    /** The bridge tiles laid over water, sky or rock: the crossing itself, not the land at its ends. */
    gaps: new Set<string>(),
    /** Each bridge tile's cross-section, one bridge and one step along it: a crossing changes colour across, never along. */
    across: new Map<string, string>(),

    /** Land, or a cavern: ragged ellipses of lowland for an area. */
    blob(a: AreaId, cx: number, cy: number, rx: number, ry: number): void {
      const wobble = Array.from({ length: 24 }, () => 0.86 + rng.next() * 0.22);
      for (let r = cy - ry - 2; r <= cy + ry + 2; r++) {
        for (let c = cx - rx - 2; c <= cx + rx + 2; c++) {
          const ang = Math.atan2(r - cy, c - cx);
          const w = wobble[Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 24) % 24]!;
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 > w * w) continue;
          if (r < 2 || c < 2 || r >= rows - 2 || c >= cols - 2) continue;
          grid[r]![c] = ".";
          area[r]![c] = AREA_INDEX[a];
        }
      }
    },
    /** Land in an exact rectangle, for a fortress whose walls must stand on ground to their corners. */
    ground(a: AreaId, x0: number, y0: number, w: number, h: number): void {
      for (let r = Math.max(2, y0); r < Math.min(rows - 2, y0 + h); r++) {
        for (let c = Math.max(2, x0); c < Math.min(cols - 2, x0 + w); c++) {
          grid[r]![c] = ".";
          area[r]![c] = AREA_INDEX[a];
        }
      }
    },
    /**
     * An area's own map, cropped to its land and shrunk `scale` times, laid down as its lowland with its top left
     * at `x0`, `y0`: an atlas tile is land where over a quarter of its `scale` by `scale` block is, so a causeway
     * a tile or two wide survives the shrink. With `framed`, the map's woods are its frame, not its land. Returns the size laid.
     */
    real(a: AreaId, x0: number, y0: number, scale = 4, framed = false): { cols: number; rows: number } {
      const src = areaMap(a).island.rows;
      const land = (c: number, r: number): boolean => !(framed ? "~%T" : "~%").includes(src[r]?.[c] ?? "~");
      let [c0, c1, r0, r1] = [Infinity, -Infinity, Infinity, -Infinity];
      src.forEach((l, r) => [...l].forEach((_, c) => land(c, r) && ([c0, c1, r0, r1] = [Math.min(c0, c), Math.max(c1, c), Math.min(r0, r), Math.max(r1, r)])));
      t.placed[a] = { x0, y0, c0, r0, scale };
      const w = Math.ceil((c1 - c0 + 1) / scale);
      const h = Math.ceil((r1 - r0 + 1) / scale);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let n = 0;
          for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) n += land(c0 + x * scale + dx, r0 + y * scale + dy) ? 1 : 0;
          const [c, r] = [x0 + x, y0 + y];
          if (4 * n <= scale * scale || r < 2 || c < 2 || r >= rows - 2 || c >= cols - 2) continue;
          grid[r]![c] = ".";
          area[r]![c] = AREA_INDEX[a];
        }
      }
      return { cols: w, rows: h };
    },
    /** Channels: land within two tiles of another area's goes back to sea, sky or rock. */
    separate(): void {
      const owner = area.map((l) => [...l]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const me = owner[r]![c]!;
          if (me < 0) continue;
          let other = false;
          for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) other ||= (owner[r + dr]?.[c + dc] ?? -1) >= 0 && owner[r + dr]![c + dc] !== me;
          if (other) {
            grid[r]![c] = wall;
            area[r]![c] = -1;
          }
        }
      }
    },
    /**
     * High ground for an area: a summit at `at`, falling away over `rx` by
     * `ry` tiles, broken up by noise, in `levels` heights. `core` forces the
     * top height round a spot, for a lift or a keep. Laid down in finish().
     */
    relief(spec: Relief): void {
      t.reliefs.push(spec);
    },
    /** Ground set to exactly `level` over a rectangle, past anything the reliefs make there; 1 cuts a notch back to the lowland. */
    /**
     * A landform: ground of its own shape at `level`, an ellipse whose rim wanders by noise into bays and
     * headlands. Where it overlaps ground one height lower, it finds stairs onto it.
     */
    shape(level: 2 | 3 | 4 | 5, cx: number, cy: number, rx: number, ry: number, wander = 0.45, owner?: string): void {
      const n = noise(`shape:${cx},${cy},${level}`, Math.max(3, Math.min(rx, ry) * 0.7));
      const keys = new Set<string>();
      for (let r = Math.floor(cy - ry * 1.5); r <= cy + ry * 1.5; r++) {
        for (let c = Math.floor(cx - rx * 1.5); c <= cx + rx * 1.5; c++) {
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 <= 1 + n(c, r) * wander) keys.add(`${c},${r}`);
        }
      }
      // A smooth rim has no corner a stair can stand in: on each lower flank, square one off,
      // two rows ending in the same column with the row under them cut back.
      const rs = Math.round(cy + ry * 0.5);
      const cols = [...keys].map((k) => k.split(",").map(Number) as [number, number]).filter(([, r]) => r === rs).map(([c]) => c);
      if (cols.length > 0) {
        for (const [edge, out] of [[Math.min(...cols), -1], [Math.max(...cols), 1]] as const) {
          for (const k of [...keys]) {
            const [c, r] = k.split(",").map(Number) as [number, number];
            if ((r === rs - 1 && (c - edge) * out > 0) || (r === rs + 1 && (c - edge) * out >= 0)) keys.delete(k);
          }
        }
      }
      t.shapes.push({ level, keys, owner });
    },
    block(level: 1 | 2 | 3 | 4 | 5, x: number, y: number, w: number, h: number): void {
      t.blocks.push({ level, x, y, w, h });
    },
    /** A raised bridge deck between two tables of `level`, over low ground or water; the tables keep their own stairs. */
    span(level: 2 | 3 | 4 | 5, x: number, y: number, w: number, h: number): Cell[] {
      const deck: Cell[] = [];
      for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) deck.push({ col: c, row: r });
      // Over water the deck belongs to the area of the land it leaves from.
      const own = deck.map((c) => area[c.row]?.[c.col] ?? -1).find((a) => a >= 0) ?? -1;
      for (const c of deck) {
        if (at(c.col, c.row) !== "~") continue;
        put(c.col, c.row, ".");
        area[c.row]![c.col] = own;
      }
      t.blocks.push({ level, x, y, w, h, span: true });
      return deck;
    },
    /** A stair onto `level` at a tile beside a table's bottom row: L with the table to its right, R to its left. */
    stair(level: 2 | 3 | 4 | 5, col: number, row: number, side: "L" | "R"): void {
      t.ways.push({ level, col, row, side });
    },
    /** A grove: lowland woods over an ellipse, `density` of its open ground. */
    grove(cx: number, cy: number, rx: number, ry: number, density: number): void {
      for (let r = Math.floor(cy - ry); r <= cy + ry; r++) {
        for (let c = Math.floor(cx - rx); c <= cx + rx; c++) {
          if (((c - cx) / rx) ** 2 + ((r - cy) / ry) ** 2 <= 1 && at(c, r) === "." && rng.next() < density) put(c, r, "T");
        }
      }
    },
    pond(x0: number, y0: number, w: number, h: number): void {
      for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "~");
    },
    /** Rock left standing in a cavern: pillars and walls. */
    pillar(x0: number, y0: number, w: number, h: number): void {
      for (let r = y0; r < y0 + h; r++) for (let c = x0; c < x0 + w; c++) put(c, r, "%");
    },
    /** A strip of ground across water or sky, or through rock, inside one area. */
    bridge(a: Cell, b: Cell, width = 2): void {
      const id = `${a.col},${a.row}>${b.col},${b.row}`;
      const horizontal = Math.abs(b.col - a.col) >= Math.abs(b.row - a.row);
      t.cut(a, b, width, (c) => {
        if (at(c.col, c.row) === wall) t.gaps.add(`${c.col},${c.row}`);
        t.across.set(`${c.col},${c.row}`, `${id}:${horizontal ? c.col : c.row}`);
        put(c.col, c.row, ".");
        // A path: the high ground keeps clear of it.
        t.paths.add(`${c.col},${c.row}`);
      });
    },
    cut(a: Cell, b: Cell, width: number, each: (c: Cell, through: boolean) => void): void {
      const seen = new Set<string>();
      const horizontal = Math.abs(b.col - a.col) >= Math.abs(b.row - a.row);
      line(a, b, (p) => {
        for (let d = -Math.floor(width / 2); d <= Math.floor((width - 1) / 2); d++) {
          const c = horizontal ? { col: p.col, row: p.row + d } : { col: p.col + d, row: p.row };
          const k = `${c.col},${c.row}`;
          if (seen.has(k)) continue;
          seen.add(k);
          each(c, at(c.col, c.row) === wall);
        }
      });
    },
    /** A gate: a strip cut across what parts two areas. */
    gate(gid: string, name: string, kind: GateKind, from: AreaId, to: AreaId, a: Cell, b: Cell, note: string, width = 3): void {
      const cells: Cell[] = [];
      t.cut(a, b, width, (c, through) => {
        if (through) {
          put(c.col, c.row, kind === "high" ? "#" : ".");
          cells.push(c);
        } else if (kind !== "high" && at(c.col, c.row) === "T") put(c.col, c.row, ".");
      });
      t.gates.push({ id: gid, name, kind, from, to, note, at: cells[Math.floor(cells.length / 2)] ?? a, cells });
    },
    road(...pts: [number, number][]): void {
      for (let i = 1; i < pts.length; i++) line({ col: pts[i - 1]![0], row: pts[i - 1]![1] }, { col: pts[i]![0], row: pts[i]![1] }, (c) => t.roadSet.add(`${c.col},${c.row}`));
    },
    /** A road paved one row deep, where two would run past what it meets. */
    lane(...pts: [number, number][]): void {
      for (let i = 1; i < pts.length; i++)
        line({ col: pts[i - 1]![0], row: pts[i - 1]![1] }, { col: pts[i]![0], row: pts[i]![1] }, (c) => (t.roadSet.add(`${c.col},${c.row}`), t.lanes.add(`${c.col},${c.row}`)));
    },
    /** A way kept as clear as a road but never paved: a track across the country, where a street would read painted on. */
    track(...pts: [number, number][]): void {
      for (let i = 1; i < pts.length; i++) line({ col: pts[i - 1]![0], row: pts[i - 1]![1] }, { col: pts[i]![0], row: pts[i]![1] }, (c) => t.paths.add(`${c.col},${c.row}`));
    },
    prop(art: string, col: number, row: number, more: Omit<Placed, "art" | "col" | "row"> = {}): void {
      t.props.push({ art, col, row, ...more });
    },
    who(kind: string, col: number, row: number, more: Omit<Dweller, "kind" | "col" | "row"> = {}): void {
      t.dwellers.push({ kind, col, row, ...more });
    },

    /**
     * Woods on open ground nothing else uses, by area; then a path cut from
     * any pocket they sealed off; then every tile given its area. `from` is
     * where the walkable world starts, for the pocket check.
     */
    /** With `open`, a maze: every lowland tile it leaves shut is woods, walling the clearings and lanes it opens. */
    finish(density: Partial<Record<AreaId, number>>, from: readonly Cell[], open?: (c: number, r: number) => boolean): AtlasTier {
      terrain(t, rows, cols);
      // Woods laid before the terrain existed (a hedge, a grove) never stand on a cliff face.
      for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === "T" && "#^45".includes(at(c, r - 1))) put(c, r, ".");
      const keep = new Set<string>();
      const clear = (c: number, r: number, rad: number): void => {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) keep.add(`${c + dc},${r + dr}`);
      };
      for (const p of t.props) clear(p.col, p.row, p.art === "castle" || p.art === "monastery" ? 3 : 2);
      for (const d of t.dwellers) clear(d.col, d.row, 1);
      for (const d of t.dwellers) if (d.to) line(d, d.to, (c) => clear(c.col, c.row, 1));
      for (const f of [...t.fires, ...t.campfires]) clear(f.col, f.row, 2);
      for (const b of t.bosses) clear(b.col, b.row, 3);
      for (const f of t.fences) for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) keep.add(`${c},${r}`);
      for (const k of [...t.roadSet, ...t.paths]) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        clear(c, r, 1);
      }
      for (const g of t.gates) for (const c of g.cells) clear(c.col, c.row, 1);
      for (const c of from) clear(c.col, c.row, 2);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const a = area[r]![c]!;
          // Woods are lowland only: trees on the high ground are the scene's dressing, so they never wall a ledge off.
          if (a < 0 || at(c, r) !== "." || keep.has(`${c},${r}`)) continue;
          // Never on a cliff face, by a stair, or where a slope's head or foot is.
          const slope = (x: number, y: number) => "<>[]{}()".includes(at(x, y));
          if ("#^%45".includes(at(c, r - 1)) || slope(c, r - 1) || slope(c, r + 1) || slope(c - 1, r) || slope(c + 1, r)) continue;
          // Nor where a slope ends, checked after the draw so the woods elsewhere keep their shape.
          if ((open ? !open(c, r) : rng.next() < (density[AREAS[a]!.id] ?? 0)) && !slope(c - 1, r - 1) && !slope(c + 1, r - 1)) put(c, r, "T");
        }
      }

      const centre = from[0]!;
      const islandOf = (): Island => ({
        rows: grid.map((l) => l.join("")),
        start: { a: { castle: centre, barracks: centre }, b: { castle: centre, barracks: centre } },
        mines: [],
        lair: centre,
        diagonalStairs: true,
      });
      // Woods never wall a clearing off: a pocket nobody can reach gets a path cut to the rest.
      for (let pass = 0; pass < 300; pass++) {
        useIsland(islandOf());
        const seen = new Set(from.map(cellKey));
        const queue = [...from];
        for (let i = 0; i < queue.length; i++) for (const n of stepsFrom(queue[i]!)) if (!seen.has(cellKey(n))) (seen.add(cellKey(n)), queue.push(n));
        // Every pocket this pass: one tile of each, its own ground marked so it is linked once.
        const pockets: Cell[][] = [];
        const mine = new Set<number>();
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const p = { col: c, row: r };
            if (at(c, r) !== "." || !isWalkable(c, r) || seen.has(cellKey(p)) || mine.has(cellKey(p))) continue;
            const flood = [p];
            pockets.push(flood);
            mine.add(cellKey(p));
            for (let i = 0; i < flood.length; i++) for (const n of stepsFrom(flood[i]!)) if (!seen.has(cellKey(n)) && !mine.has(cellKey(n))) (mine.add(cellKey(n)), flood.push(n));
          }
        }
        if (pockets.length === 0) break;
        for (const flood of pockets) {
          const pocket = flood[0]!;
          const prev = new Map<number, Cell | null>([[cellKey(pocket), null]]);
          const q = [pocket];
          let found: Cell | null = null;
          for (let i = 0; i < q.length && !found; i++) {
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const n = { col: q[i]!.col + dc, row: q[i]!.row + dr };
              // Never along a cliff's face: a path there walks nowhere.
              if (prev.has(cellKey(n)) || !".T".includes(at(n.col, n.row)) || castsCliff(n.col, n.row - 1)) continue;
              prev.set(cellKey(n), q[i]!);
              if (seen.has(cellKey(n))) {
                found = n;
                break;
              }
              q.push(n);
            }
          }
          // Out through the trees to the rest; an islet with no way out goes to the woods, all of it.
          if (!found) for (const c of flood) put(c.col, c.row, "T");
          else for (let c: Cell | null = found; c; c = prev.get(cellKey(c)) ?? null) if (at(c.col, c.row) === "T") put(c.col, c.row, ".");
        }
      }
      // High ground no stair reaches, cut off by a terrace's cliff or the woods on it, comes down a height.
      const lower: Record<string, string> = { "#": ".", "%": ".", "^": "#", "4": "^", "5": "4" };
      for (let pass = 0; pass < 40; pass++) {
        useIsland(islandOf());
        const seen = new Set(from.map(cellKey));
        const queue = [...from];
        for (let i = 0; i < queue.length; i++) for (const n of stepsFrom(queue[i]!)) if (!seen.has(cellKey(n))) (seen.add(cellKey(n)), queue.push(n));
        let changed = false;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const ch = at(c, r);
            if (!"#^45".includes(ch) || !isWalkable(c, r) || seen.has(cellKey({ col: c, row: r })) || t.drawn.has(`${c},${r}`)) continue;
            put(c, r, lower[ch]!);
            changed = true;
          }
        }
        if (!changed) break;
      }
      settleAll(t);

      // Gate tiles and land the carving made outside every outline join the nearest area.
      const owned = area.map((l) => [...l]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r]![c] === wall || owned[r]![c]! >= 0) continue;
          let best = -1;
          for (let d = 1; d < 14 && best < 0; d++) for (let dr = -d; dr <= d && best < 0; dr++) for (let dc = -d; dc <= d && best < 0; dc++) best = area[r + dr]?.[c + dc] ?? -1;
          owned[r]![c] = best;
        }
      }
      for (const g of t.gates) {
        const ids = [AREA_INDEX[g.from], AREA_INDEX[g.to]];
        for (const c of g.cells) {
          let best = ids[0]!;
          for (let d = 1; d < 30; d++) {
            const hit = ids.find((i) => [[d, 0], [-d, 0], [0, d], [0, -d]].some(([dc, dr]) => area[c.row + dr!]?.[c.col + dc!] === i));
            if (hit !== undefined) {
              best = hit;
              break;
            }
          }
          owned[c.row]![c.col] = best;
        }
      }
      const info = TIER_INFO[id];
      return {
        id,
        name: info.name,
        blurb: info.blurb,
        base: info.base,
        // Built on the war's step rule, so no pocket leans on a stair a prop may later fill; climbed along its slope.
        island: { ...islandOf(), diagonalStairs: true },
        areaAt: owned.map((l, r) => l.map((a, c) => (a >= 0 && grid[r]![c] !== wall && grid[r]![c] !== "~" ? AREA_CODE[a]! : "-")).join("")),
        gates: t.gates,
        roads: [...t.roadSet]
          .map((k) => ({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]), ...(t.lanes.has(k) ? { narrow: true } : {}) }))
          .filter((c) => ".#^45".includes(at(c.col, c.row))),
        props: t.props,
        dwellers: t.dwellers,
        fires: t.fires,
        campfires: t.campfires,
        bosses: t.bosses,
        fences: t.fences,
        ...(Object.keys(t.placed).length ? { real: t.placed } : {}),
      };
    },
  };
  return t;
}

/** The ways between tiers. Each end stands where it says, and the two ends sit close on the grid. */
export const LIFTS: readonly AtlasLift[] = [
  {
    id: "old-well",
    name: "Old Well",
    kind: "drop",
    note: "A dry well in the hill's cave, west of the square. A rope goes down; nothing comes back up it.",
    up: { tier: "surface", area: "harbour", at: { col: 43, row: 48 } },
    down: { tier: "below", area: "undercroft", at: { col: 45, row: 51 } },
  },
  {
    id: "barrow-cave",
    name: "Barrow Cave",
    kind: "lift",
    note: "The moor's cave at the King's Barrow's foot, down a long ramp of bones into the barrow, and back up.",
    up: { tier: "surface", area: "barrowmoor", at: { col: 78, row: 39 } },
    down: { tier: "below", area: "barrow", at: { col: 78, row: 36 } },
  },
  {
    id: "sinkhole",
    name: "Fen Sinkhole",
    kind: "drop",
    note: "The pools drain into it, and so does anyone who steps too close. Hearthdeep is a long fall down.",
    up: { tier: "surface", area: "fen", at: { col: 52, row: 69 } },
    down: { tier: "below", area: "hollow", at: { col: 50, row: 70 } },
  },
  {
    id: "gnome-lift",
    name: "Gnome Lift",
    kind: "lift",
    note: "A basket on a gnome-built crane, off the Tinker Peak up into the clouds.",
    up: { tier: "sky", area: "gilded", at: { col: 82, row: 8 } },
    down: { tier: "surface", area: "peak", at: { col: 82, row: 10 } },
  },
  {
    id: "throne-stair",
    name: "Throne Stair",
    kind: "lift",
    note: "From the Grey Keep, a stair of floating stones up to the Throne Isle, the Citadel's old seat at the gnome-kings' court.",
    up: { tier: "sky", area: "gilded", at: { col: 104, row: 17 } },
    down: { tier: "surface", area: "throne", at: { col: 103, row: 21 } },
  },
  {
    id: "shell-stair",
    name: "The Shell Stair",
    kind: "lift",
    note: "From the Shell Isle up through the rock to the fen's east edge: the one way back up from Hearthdeep, shut until the Shell Below has fallen.",
    up: { tier: "surface", area: "fen", at: { col: 58, row: 68 } },
    down: { tier: "below", area: "shellisle", at: { col: 60, row: 68 } },
  },
  {
    id: "ring-lift",
    name: "The Boat",
    kind: "lift",
    note: "The fishers' boat out of the Bull's Ring, along the sea channel and round to Lanternport's docks.",
    up: { tier: "surface", area: "harbour", at: { col: 44, row: 49 } },
    down: { tier: "below", area: "ring", at: { col: 42, row: 46 } },
  },
  {
    id: "watch-lift",
    name: "Watch Lift",
    kind: "shortcut",
    note: "Highward's old lift to its watch posts in the sky, chained from above. Ride it down once from Cloudstair and it runs both ways for good: the road home.",
    up: { tier: "sky", area: "steps", at: { col: 31, row: 22 } },
    down: { tier: "surface", area: "keep", at: { col: 31, row: 22 } },
  },
];

function surface(rng: Rng): AtlasTier {
  const t = tierBuilder("surface", rng);
  // Each land in its own map's shape, all at one scale; the castle wards at half that, as insets, and the boss rooms
  // smaller again.
  const LAY: [AreaId, number, number, number][] = [
    ["emberwood", 4, 2, 4], ["crags", 50, 2, 4], ["greyfall", 92, 2, 4],
    ["burg", 38, 25, 8], ["ramparts", 41, 17, 8], ["chapel", 70, 27, 8], ["keep", 30, 22, 8],
    ["bullwall", 56, 25, 10], ["belfry", 58, 29, 8], ["trollpit", 40, 3, 10],
    ["saltreach", 3, 38, 4], ["harbour", 29, 35, 4], ["barrowmoor", 62, 38, 4], ["fen", 40, 60, 4],
    ["peak", 80, 9, 8], ["throne", 100, 21, 8],
  ];
  // The wards' and boss rooms' maps are framed in woods; the Keep west of the Burg, the Ramparts over it, the Bull's
  // Wall east of them, the Chapel past it and the Belfry off the Chapel's west; Troll's Hollow between the wood and the rock.
  for (const [a, x, y, s] of LAY) t.real(a, x, y, s, s >= 8);
  // Saltreach's isles are joined by causeways too thin to survive the shrink: a tile of each, kept clear of woods.
  for (const [c, r] of [[6, 41], [16, 40], [20, 44], [13, 41], [14, 43], [10, 46], [4, 41], [4, 42], [13, 47], [14, 47]] as const) {
    t.ground("saltreach", c, r, 1, 1);
    t.paths.add(`${c},${r}`);
  }
  t.separate();

  // Tinker Crags: the rock climbs to the Tinker Peak, where the Gnome Lift stands.
  t.relief({ area: "crags", at: { col: 68, row: 8 }, rx: 11, ry: 6, levels: 3, core: { at: { col: 69, row: 5 }, r: 2.2 } });
  // The Bridgehead's ledge out to the Sky Bridge, too thin after the shrink for the relief to raise.
  t.block(2, 73, 5, 5, 1);
  // Barrowmoor: three barrows on the moor.
  t.relief({ area: "barrowmoor", at: { col: 68, row: 44 }, rx: 3.5, ry: 2.5, levels: 2 });
  t.relief({ area: "barrowmoor", at: { col: 87, row: 43 }, rx: 4, ry: 3, levels: 2 });
  t.relief({ area: "barrowmoor", at: { col: 72, row: 52 }, rx: 3.5, ry: 2.5, levels: 2 });
  // The Greyfall: the Citadel's crag, the Grey Keep on its crown.
  t.relief({ area: "greyfall", at: { col: 112, row: 7 }, rx: 9, ry: 5, levels: 3, core: { at: { col: 112, row: 5 }, r: 2.2 } });

  t.gate("old-bridge", "Old Bridge", "open", "saltreach", "harbour", { col: 25, row: 40 }, { col: 33, row: 46 }, "The way in from the shore, always open.");
  t.gate("burg-gate", "Burg Gate", "open", "harbour", "burg", { col: 43, row: 35 }, { col: 44, row: 32 }, "Up out of Old Town, through Highward's outer wall into the Lower Burg.");
  t.gate("rampart-gate", "Rampart Gate", "open", "burg", "ramparts", { col: 45, row: 26 }, { col: 43, row: 21 }, "Up off the Burg's crest through the gatehouse onto Highward's curtain wall.");
  t.gate("bulls-gate", "The Bull's Gate", "open", "ramparts", "bullwall", { col: 46, row: 21 }, { col: 58, row: 25 }, "Off the walk's east end onto the wall the boar holds.");
  t.gate("chapel-door", "Chapel Door", "open", "bullwall", "chapel", { col: 62, row: 25 }, { col: 71, row: 29 }, "Over the Gun Bridge into the Chapel Ward's cloister.");
  t.gate("bell-stair", "The Bell Stair", "open", "chapel", "belfry", { col: 71, row: 31 }, { col: 60, row: 30 }, "Up off the chapel terrace's west end into the bell tower.");
  t.gate("keep-gate", "Keep Gate", "locked", "burg", "keep", { col: 40, row: 27 }, { col: 35, row: 25 }, "Off the Burg's Upper Streets, west into Highward's bailey. The Ember Key fits it.");
  t.gate("ember-gate", "Ember Gate", "shortcut", "harbour", "emberwood", { col: 33, row: 36 }, { col: 13, row: 17 }, "A palisade on the causeway north. The town bars it at night.");
  t.gate("ash-road", "The Ash Road", "open", "emberwood", "trollpit", { col: 32, row: 6 }, { col: 42, row: 6 }, "North out of the steaming wood to the Bull's hollow.");
  t.gate("crag-stair", "Crag Stair", "open", "trollpit", "crags", { col: 43, row: 5 }, { col: 55, row: 8 }, "A gnome path past the Bull, out of the steam and up to the rock.");
  t.gate("moor-gate", "Moor Gate", "shortcut", "harbour", "barrowmoor", { col: 56, row: 47 }, { col: 63, row: 47 }, "Barred from the moor side. Whoever comes through the moor can open it, and come home the short way.");
  t.gate("fen-causeway", "Fen Causeway", "open", "saltreach", "fen", { col: 16, row: 51 }, { col: 41, row: 68 }, "A long spit of shingle along the south shore.", 2);
  t.gate("barrow-path", "Barrow Path", "open", "fen", "barrowmoor", { col: 48, row: 61 }, { col: 77, row: 56 }, "Duckboards over the reeds, up onto the moor.");
  t.gate("grey-gate", "Grey Gate", "locked", "barrowmoor", "greyfall", { col: 92, row: 45 }, { col: 97, row: 18 }, "Two locks, one key from each way out of Lanternport: the Barrow King's Horned Key, and the Weaver's Silk Key from below.");
  t.gate("tinker-peak", "The Tinker Peak", "open", "crags", "peak", { col: 76, row: 11 }, { col: 81, row: 11 }, "Off the rock's top step onto the summit, where Old Bamboo sits.");
  t.gate("grey-keep", "The Grey Keep", "open", "greyfall", "throne", { col: 104, row: 17 }, { col: 103, row: 22 }, "Off Greyfall's crown into the Citadel's hall.");
  t.gate("sky-bridge", "Sky Bridge", "high", "crags", "greyfall", { col: 79, row: 5 }, { col: 96, row: 5 }, "The gnomes' high road off the top of the rock, straight onto Greyfall's wall.", 2);

  t.road([22, 41], [25, 40], [33, 46], [40, 45], [44, 47]);
  t.road([44, 47], [43, 40], [43, 35], [44, 31], [45, 26], [43, 21], [46, 21], [58, 25], [62, 25], [71, 29], [76, 30]);
  t.road([43, 40], [36, 38], [33, 36], [13, 17], [14, 15]);
  t.road([14, 15], [22, 9], [32, 6], [42, 6], [43, 5], [55, 8], [60, 15]);
  t.road([44, 47], [50, 47], [56, 47], [63, 47], [70, 47], [78, 46], [92, 45], [97, 18]);
  t.road([16, 48], [16, 51], [41, 68], [48, 66], [48, 61], [77, 56], [78, 50]);
  const { prop, who } = t;

  // Saltreach: fishing isles too narrow to build on but for a hut, the militia on them, pirates offshore.
  prop("fishHut", 7, 47);
  prop("boat", 10, 50);
  prop("pirateTowerWater", 1, 55);
  t.fires.push({ col: 16, row: 48 });
  who("warrior", 24, 41, { color: "yellow", to: { col: 20, row: 41 } });
  who("pawn", 13, 46, { color: "yellow", act: "meat" });
  who("archer", 5, 40, { color: "yellow" });
  who("harpoonShark", 2, 34, { to: { col: 10, row: 34 } });
  who("rubberDuck", 22, 55);

  // Last Harbour: the town round its square, the castle on the height, the docks.
  prop("castle", 46, 38, { color: "blue" });
  prop("monastery", 40, 42, { color: "blue" });
  prop("house1", 47, 42, { color: "blue" });
  prop("house2", 50, 42, { color: "blue" });
  prop("house3", 38, 47, { color: "blue" });
  prop("barracks", 49, 50, { color: "blue" });
  prop("archery", 37, 50, { color: "blue" });
  prop("goldMine", 53, 41);
  prop("tower", 55, 48, { color: "blue" });
  prop("boat", 46, 57);
  t.fires.push({ col: 44, row: 47 });
  who("warrior", 43, 37, { color: "blue" });
  who("lancer", 41, 45, { color: "blue", to: { col: 47, row: 45 } });
  who("monk", 36, 44, { color: "blue" });
  who("pawn", 52, 44, { color: "blue", act: "pickaxe" });
  who("pawn", 45, 52, { color: "blue", act: "gold", to: { col: 51, row: 46 } });
  who("seahorseBoat", 60, 64, { to: { col: 50, row: 65 } });

  // The castle wards over the town, each dressed as its own map is.
  // The Lower Burg: the fallen outer town, its yards spiked, thieves in the lanes.
  prop("skullSpike", 40, 32);
  t.fires.push({ col: 45, row: 29 });
  who("thief", 42, 30, { to: { col: 48, row: 32 } });
  who("skull", 43, 32);
  // The Ramparts: the curtain wall's towers and guns.
  prop("tower", 42, 18, { color: "blue" });
  prop("tower", 45, 21, { color: "blue" });
  prop("cannon", 42, 21);
  prop("bones", 45, 19);
  // The Bull's Wall past them, the bull on it.
  t.bosses.push({ name: "The Rampart Boar", area: "bullwall", col: 59, row: 25 });
  // The Chapel Ward: the monastery and the cloister; the Belfry off its west end, the warden in it.
  prop("monastery", 76, 31, { color: "blue" });
  t.fires.push({ col: 79, row: 31 });
  who("thief", 74, 32, { to: { col: 78, row: 32 } });
  prop("tower", 61, 30, { color: "blue" });
  t.bosses.push({ name: "The Stone Warden", area: "belfry", col: 60, row: 30 });
  // The Keep: the castle's crown, its bailey round it.
  prop("castle", 32, 24, { color: "blue" });
  t.fires.push({ col: 31, row: 25 });
  who("archer", 35, 26, { color: "blue" });

  // Emberwood: goblin warrens, cinders; Troll's Hollow past its north road.
  for (const [c, r, f] of [[9, 12, 0], [11, 6, 3], [20, 12, 6], [24, 7, 9]] as const) prop("goblinHut", c, r, { frame: f });
  prop("deadTree", 28, 14);
  prop("trollDead", 30, 9, { scale: 0.6 });
  t.fires.push({ col: 14, row: 15 }, { col: 16, row: 9 });
  who("torch", 12, 9, { to: { col: 12, row: 13 } });
  who("spear", 22, 10);
  who("gnoll", 26, 12);
  who("thief", 18, 15, { to: { col: 23, row: 15 } });
  t.bosses.push({ name: "The Ember Bull", area: "trollpit", col: 41, row: 4 });

  // Tinker Crags: huts on the low rock, gold on the steps, the lift on the peak.
  prop("gnomeTower", 54, 10);
  for (const [c, r] of [[58, 17], [62, 18], [66, 18]] as const) prop("gnomeHut", c, r);
  prop("goldMine", 72, 15);
  for (const [c, r] of [[60, 9], [75, 9]] as const) prop("goldStone", c, r);
  t.fires.push({ col: 54, row: 14 });
  who("gnome", 57, 15, { to: { col: 63, row: 15 } });
  who("slingshot", 64, 13);
  who("bear", 70, 19);
  who("bee", 60, 20);
  who("panda", 76, 13);
  t.bosses.push({ name: "Old Bamboo", area: "peak", col: 82, row: 11 });

  // Barrowmoor: barrows, bones, the cave, and the minotaur's grave.
  prop("cave", 80, 42);
  prop("tower", 65, 46, { color: "purple" });
  for (const [c, r] of [[75, 49], [84, 50], [90, 48]] as const) prop("deadTree", c, r, { scale: 0.5 });
  for (const [c, r] of [[67, 41], [86, 40], [71, 50]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[74, 45], [82, 47], [79, 53]] as const) prop("bones", c, r);
  t.fires.push({ col: 71, row: 47 }, { col: 77, row: 54 });
  who("skull", 74, 47, { to: { col: 80, row: 48 } });
  who("skullGuard", 70, 42);
  who("shaman", 85, 46);
  who("bat", 76, 42);

  // Lizard Fen: the purple chapel among the pools.
  prop("tower", 49, 70, { color: "purple" });
  prop("house1", 56, 66, { color: "purple" });
  t.fires.push({ col: 46, row: 66 });
  who("monk", 51, 72, { color: "purple" });
  who("lizard", 54, 64);
  who("snake", 57, 69);
  who("turtle", 43, 70);

  // The Greyfall: the black legion on the walls, the castle on the crown, imps round it.
  prop("castle", 112, 5, { color: "black" });
  for (const [c, r] of [[99, 17], [118, 17]] as const) prop("tower", c, r, { color: "black" });
  prop("house1", 96, 10, { color: "black" });
  prop("house3", 100, 14, { color: "black" });
  t.fires.push({ col: 95, row: 14 }, { col: 104, row: 16 });
  for (let i = 0; i < 4; i++) who("warrior", 106 + i * 2, 15, { color: "black" });
  who("lancer", 120, 13, { color: "black", to: { col: 114, row: 15 } });
  who("imp", 108, 8);
  who("imp", 117, 6);
  who("bombFish", 125, 22, { to: { col: 115, row: 22 } });
  t.bosses.push({ name: "The Grey Warlord", area: "throne", col: 103, row: 24 });

  return t.finish(
    { saltreach: 0.07, harbour: 0.05, emberwood: 0.5, crags: 0.12, barrowmoor: 0.05, fen: 0.14, greyfall: 0.03 },
    [{ col: 44, row: 47 }, ...LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "surface").map((e) => e.at)],
  );
}

function sky(rng: Rng): AtlasTier {
  const t = tierBuilder("sky", rng);
  // The Gilded City over the Greyfall, its Throne Stair over the Grey Keep's; the Steps over the castle, the Watch Lift over the Keep's.
  t.real("gilded", 88, 2);
  t.real("steps", 29, 13);
  // The Sun Hall hung under the city's south edge, between the Sun Steps and the Throne Isle.
  t.real("sunhall", 99, 24, 8);
  // The Gnome Landing: an islet over the Tinker Peak, out of the city's line, the lift's basket at it.
  t.blob("gilded", 70, 6, 4, 3);
  t.separate();
  t.bridge({ col: 73, row: 7 }, { col: 89, row: 10 });
  t.gate("sun-hall", "The Sun Hall", "open", "gilded", "sunhall", { col: 96, row: 16 }, { col: 101, row: 25 }, "Down off the Sun Steps onto the bridge to the hall of gold.");
  t.gate("gilded-span", "The Gilded Span", "open", "sunhall", "gilded", { col: 105, row: 25 }, { col: 106, row: 16 }, "From the hall of gold over to the Throne Isle, the Sentinel's key in hand.");
  // The Steps' path from the Watch Lift's isle to the Cloud Bridge, kept clear of the woods.
  t.road([42, 21], [48, 15], [54, 15]);
  t.gate("cloud-bridge", "Cloud Bridge", "open", "steps", "gilded", { col: 54, row: 15 }, { col: 67, row: 7 }, "A rope bridge over nothing at all, from Cloudstair to the gnome-kings' landing.", 2);

  const { prop, who } = t;
  // The Gilded City: the high hall, its gnomes and guards; the Throne Isle's black stone at its east end.
  prop("castle", 104, 10, { color: "yellow" });
  prop("tower", 97, 3, { color: "yellow" });
  prop("house2", 96, 16, { color: "yellow" });
  prop("gnomeTower", 70, 6);
  prop("skullSpike", 114, 10);
  t.fires.push({ col: 105, row: 13 });
  who("archer", 99, 8, { color: "yellow" });
  who("warrior", 92, 10, { color: "yellow", to: { col: 100, row: 10 } });
  t.bosses.push({ name: "The Sun Sentinel", area: "sunhall", col: 102, row: 25 });
  who("bee", 96, 12);
  who("gnome", 71, 7, { to: { col: 68, row: 7 } });
  who("imp", 112, 10);
  // The Steps: a watch post on the big isle, the lift's isle over the Keep.
  prop("tower", 46, 16, { color: "yellow" });
  t.fires.push({ col: 42, row: 21 }, { col: 31, row: 23 });
  who("archer", 37, 20, { color: "blue" });
  who("bat", 39, 14);
  return t.finish({ steps: 0.05, gilded: 0.04 }, LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "sky").map((e) => e.at));
}

function below(rng: Rng): AtlasTier {
  const t = tierBuilder("below", rng);
  // Under the town the Undercroft, its well bottom under the Old Well; the Ring at the Boat's end, the Landing west of it;
  // the King's Barrow under the moor's cave, the Deeps below it; the Hollow under the fen's sinkhole.
  t.real("undercroft", 34, 50);
  t.real("ring", 37, 45, 8);
  t.real("landing", 19, 43);
  t.real("barrow", 76, 34, 8);
  t.real("deeps", 68, 43);
  t.real("hollow", 31, 66);
  // The Weaver's Web between the Deeps and the Hollow; the Shell Isle off the Hollow's east shore, under the fen's.
  t.real("web", 66, 70, 8);
  t.real("shellisle", 57, 66, 8);
  // Rock casts a cliff on the row under it: a back wall a tile high over every cavern keeps its laid floor walkable.
  for (let r = 3; r < t.grid.length - 2; r++) {
    for (let c = 2; c < t.grid[r]!.length - 2; c++) {
      if (t.area[r]![c]! < 0 || t.area[r - 1]![c]! >= 0) continue;
      t.grid[r - 1]![c] = ".";
      t.area[r - 1]![c] = t.area[r]![c]!;
    }
  }
  t.separate();
  // The shrink leaves the Hollow's east shore on a diagonal thread to its lake; a ledge joins them.
  t.bridge({ col: 48, row: 70 }, { col: 50, row: 75 });
  t.gate("ring-gate", "Ring Gate", "open", "landing", "ring", { col: 33, row: 46 }, { col: 37, row: 46 }, "The sea cave's last passage, into the troll's cavern.");
  t.gate("kings-stair", "The King's Stair", "open", "barrow", "deeps", { col: 79, row: 35 }, { col: 81, row: 43 }, "Behind the Barrow King's throne, down out of his barrow into the tombs.");
  t.gate("cistern-run", "Cistern Run", "open", "undercroft", "deeps", { col: 56, row: 52 }, { col: 68, row: 47 }, "A tunnel east out of the cisterns. It comes up in the tombs.");
  t.gate("the-web", "The Web", "open", "deeps", "web", { col: 76, row: 63 }, { col: 69, row: 71 }, "Down off Graveroad's floor into the Weaver's cavern.");
  t.gate("sinking-stair", "Sinking Stair", "open", "web", "hollow", { col: 67, row: 75 }, { col: 51, row: 75 }, "Steps cut on down past the Weaver to Hearthdeep's shore.");
  t.gate("the-shell", "The Shell", "open", "hollow", "shellisle", { col: 51, row: 71 }, { col: 58, row: 69 }, "Over the causeway to the Shell Isle.");

  const { prop, who } = t;
  // The Undercroft.
  for (const [c, r] of [[38, 57], [50, 55], [52, 63]] as const) prop("bones", c, r);
  t.fires.push({ col: 51, row: 52 });
  who("spider", 37, 58, { to: { col: 39, row: 58 } });
  who("skull", 44, 54);
  who("bat", 40, 55);
  // The King's Barrow: the king in his hall.
  t.bosses.push({ name: "The Barrow King", area: "barrow", col: 78, row: 35 });
  // Barrow Deeps.
  for (const [c, r] of [[76, 46], [80, 46]] as const) prop("skullSpike", c, r);
  for (const [c, r] of [[72, 52], [84, 51], [77, 60]] as const) prop("bones", c, r);
  t.fires.push({ col: 81, row: 46 });
  who("skullGuard", 75, 45);
  who("skull", 83, 50, { to: { col: 83, row: 53 } });
  t.bosses.push({ name: "The Weaver", area: "web", col: 69, row: 73 });
  // The Drowned Hollow.
  for (const [c, r] of [[36, 70], [49, 76]] as const) prop("deadTree", c, r, { scale: 0.55 });
  prop("goldStone", 46, 70);
  t.fires.push({ col: 40, row: 70 });
  who("turtle", 42, 76);
  who("lizard", 44, 69, { to: { col: 48, row: 69 } });
  t.bosses.push({ name: "The Shell Below", area: "shellisle", col: 60, row: 68 });
  return t.finish({ undercroft: 0.02, deeps: 0.03, hollow: 0.06 }, LIFTS.flatMap((l) => [l.up, l.down]).filter((e) => e.tier === "below").map((e) => e.at));
}

/** The atlas, the same every time: three tiers and the lifts between them. */
let atlas: AtlasMap | null = null;

/** Built once: the page and the scene both want it, and each build is a quarter of a second. */
export function atlasMap(): AtlasMap {
  // A seed a tier, so reshaping one never moves another; the surface keeps the atlas's first.
  atlas ??= { tiers: { sky: sky(makeRng("atlas:sky")), surface: surface(makeRng("atlas")), below: below(makeRng("atlas:below")) }, areas: [...AREAS], lifts: [...LIFTS] };
  useIsland(atlas.tiers.surface.island);
  return atlas;
}
