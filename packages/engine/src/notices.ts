import type { AreaId } from "./atlas.ts";
import type { Cell } from "./island.ts";

/** A note pinned up in the Lane House: a foe and how many of it, paid once that many have fallen where it says. */
export interface Notice {
  id: string;
  title: string;
  /** Who pinned it: an office or a hall, never a name. */
  from: string;
  text: string;
  reward: number;
  area: AreaId;
  kind: string;
  count: number;
}

/** The Lane House door, at the head of the east lane: the notices are read there. */
export const LANE_HOUSE: { area: AreaId; at: Cell } = { area: "harbour", at: { col: 73, row: 15 } };

export const NOTICES: Notice[] = [
  {
    id: "torches",
    title: "Torches in the Emberwood",
    from: "The Lane House",
    text: "Goblins carry fire through the Emberwood, eight of them or more. The wood is burnt already. They light it again anyway.",
    reward: 40,
    area: "emberwood",
    kind: "torch",
    count: 8,
  },
  {
    id: "thieves",
    title: "Two in the Emberwood",
    from: "The market",
    text: "Two thieves wait in the Emberwood for whoever goes in. The last man came back with everything but his boots.",
    reward: 30,
    area: "emberwood",
    kind: "thief",
    count: 2,
  },
  {
    id: "webs",
    title: "Webs down the Old Well",
    from: "The town watch",
    text: "Spiders nest under the Old Well. The bucket comes up with web in it, and twice now with a rat wrapped in the web.",
    reward: 25,
    area: "undercroft",
    kind: "spider",
    count: 5,
  },
  {
    id: "diggers",
    title: "Diggers on the moor",
    from: "The Moor Watch",
    text: "Gnolls are digging in the barrows past the Moor Gate. Leave whatever they dug up where it lies.",
    reward: 60,
    area: "barrowmoor",
    kind: "gnoll",
    count: 3,
  },
];

/** The board's notes sit two to a row. */
const NOTICE_COLS = 2;

/** The pick after one step on the board: A/D across a row, W/S between rows, held at the edges. */
export function stepNotice(pick: number, count: number, dx: number, dy: number): number {
  const to = pick + dx + dy * NOTICE_COLS;
  const sameRow = Math.floor(to / NOTICE_COLS) === Math.floor(pick / NOTICE_COLS);
  if (to < 0 || to >= count || (dx && !sameRow)) return dy > 0 && Math.floor(pick / NOTICE_COLS) < Math.floor((count - 1) / NOTICE_COLS) ? count - 1 : pick;
  return to;
}
