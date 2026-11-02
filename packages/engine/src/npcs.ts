// The folk who talk, after Dark Souls: the captain never speaks; each talk plays the next conversation in a few short
// pages, the last one repeats, and something done out in the world turns up as a new thing to say.

import type { AreaId } from "./atlas.ts";
import type { Cell } from "./island.ts";

/** What the world remembers that folk remark on. */
export type WorldFlag = "died" | "wellDescended" | "monkFreed" | "moorGateOpen" | "watchLiftOpen" | "trollKey" | "warlordDead";

export interface Talk {
  id: string;
  /** Said once, after the first talk, when this has happened. */
  when?: WorldFlag;
  /** One page each. */
  lines: readonly string[];
}

export interface Npc {
  id: string;
  name: string;
  area: AreaId;
  /** On the map as areaMap() gives it: a surface map is padded with sea, so not the builder's own grid. */
  at: Cell;
  kind: "pawn" | "lancer" | "archer" | "monk" | "warrior";
  act?: string;
  flip?: boolean;
  /** Called out as the captain comes near. */
  greet: string;
  /** Called after a captain who walks off mid-talk. */
  part: string;
  talks: readonly Talk[];
}

/** Within this many tiles a dweller greets the captain and can be talked to. */
export const TALK_RANGE = 2;

export const NPCS: readonly Npc[] = [
  {
    id: "ferrow",
    name: "Old Ferrow",
    area: "harbour",
    at: { col: 57, row: 46 },
    kind: "pawn",
    greet: "Ah. Another one.",
    part: "Mind the dark, then.",
    talks: [
      {
        id: "first",
        lines: [
          "Another captain. Hm.",
          "The last one sat right where you're standing. Warmed his hands, same as you.",
          "Go on, then. The fire doesn't ask who you were. Nor do I.",
        ],
      },
      {
        id: "roads",
        lines: [
          "Every road out of here comes back to this fire. The gates, the well, the lift.",
          "Folk think that's a comfort. I've never been sure.",
        ],
      },
      { id: "rest", lines: ["Rest, if you must. The roads are patient. Patient as stones."] },
      {
        id: "died",
        when: "died",
        lines: [
          "Back so soon? Don't look at me like that.",
          "Everyone comes back. That's the trouble with this place.",
        ],
      },
      {
        id: "key",
        when: "trollKey",
        lines: ["That key's warm. Troll's blood, or the fire inside it.", "Either way, keep it away from my kindling."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["So. The grey is lifting.", "...I'll keep the fire going anyway. Habit. Someone ought to."],
      },
    ],
  },
  {
    id: "brenna",
    name: "Brenna the Smith",
    area: "harbour",
    at: { col: 70, row: 59 },
    kind: "pawn",
    act: "hammer",
    greet: "Mind the sparks.",
    part: "Come back with ore.",
    talks: [
      {
        id: "first",
        lines: [
          "You want an edge on that? Bring me gold and ore.",
          "The gold's for me. The ore's for the blade. Mostly.",
        ],
      },
      {
        id: "ore",
        lines: [
          "Mine Hills ore is soft, but honest. The Crags have better, under the gnomes.",
          "Go and be rude to them. They'll understand. It's how they talk to each other.",
        ],
      },
      { id: "hammer", lines: ["Heat, hit. Heat, hit. Same as fighting, only the iron never hits back."] },
      {
        id: "key",
        when: "trollKey",
        lines: ["Let me see that key. ...No. I won't touch it.", "Whatever forged that wasn't a smith."],
      },
    ],
  },
  {
    id: "corwin",
    name: "Sergeant Corwin",
    area: "harbour",
    at: { col: 59, row: 14 },
    kind: "lancer",
    greet: "Captain.",
    part: "Dismissed, then.",
    talks: [
      {
        id: "first",
        lines: [
          "We were forty spears once. Forty.",
          "Now I drill boys with broom handles and call it a garrison.",
          "You want a lance at your side? Pay, and I'll find you one who still stands.",
        ],
      },
      { id: "drill", lines: ["Point forward, feet back.", "If they're charging you, you've already done it wrong."] },
      {
        id: "died",
        when: "died",
        lines: ["You fell. Don't tell me where.", "Bring me the ones still breathing. Not their names."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["Forty spears.", "I'll carve them into the gate. Every one. Leave me to it, captain."],
      },
    ],
  },
  {
    id: "wren",
    name: "Wren",
    area: "harbour",
    at: { col: 36, row: 58 },
    kind: "archer",
    greet: "You walk loud, captain.",
    part: "Keep your head down!",
    talks: [
      {
        id: "first",
        lines: [
          "You walk loud for a captain. That's fine. Archers like a loud friend up front.",
          "Gold on the barrel, and I'll send you someone who doesn't miss. Much.",
        ],
      },
      {
        id: "goblins",
        lines: [
          "Goblins at the Ember Gate camp in threes.",
          "Shoot the torch first. Spears are slow. Torches are rude.",
        ],
      },
      { id: "back", lines: ["Five paces back, always. If you can smell it, you're too close."] },
    ],
  },
  {
    id: "tobin",
    name: "Tobin",
    area: "harbour",
    at: { col: 61, row: 49 },
    kind: "pawn",
    greet: "Don't lean on the rope.",
    part: "...Right. Off you go.",
    talks: [
      {
        id: "first",
        lines: [
          "Don't lean on the rope. It's older than me.",
          "That well doesn't go to water. My brother went down it after a dropped coin.",
          "Never came up. Says something about the coin, doesn't it?",
        ],
      },
      { id: "rule", lines: ["No climbing back. That's the rule of the well.", "Funny, a hole having rules."] },
      {
        id: "below",
        when: "wellDescended",
        lines: [
          "You came back? From down there?",
          "...Did you see him? Thin fellow. Quick hands. Always smiling.",
          "No. Course not. Forget I asked.",
        ],
      },
    ],
  },
  {
    id: "ysolde",
    name: "Mother Ysolde",
    area: "harbour",
    at: { col: 50, row: 26 },
    kind: "monk",
    greet: "Peace on you.",
    part: "Go gently, captain.",
    talks: [
      {
        id: "first",
        lines: [
          "Peace on you, captain.",
          "My sisters went down to the chapel under the fen, to pray the water clear.",
          "The water did not clear. Nor did they come back.",
        ],
      },
      { id: "candle", lines: ["I light a candle each night.", "It is not hope. It is habit, which outlasts hope."] },
      {
        id: "freed",
        when: "monkFreed",
        lines: [
          "You found one of us. Living.",
          "Then the others... no.",
          "One is a mercy. I'll not ask the dark for more than it gives.",
        ],
      },
    ],
  },
  {
    id: "maren",
    name: "Maren the Harbourmaster",
    area: "harbour",
    at: { col: 48, row: 60 },
    kind: "pawn",
    greet: "Tide's out.",
    part: "Fair winds. Ha.",
    talks: [
      {
        id: "first",
        lines: [
          "No ships in three winters.",
          "The salt men down the coast still trade, if you can stomach their prices. And their pirates.",
          "Mostly the pirates.",
        ],
      },
      { id: "sharks", lines: ["Sharks off the Saltreach shore. Don't swim there.", "Don't even think wet thoughts."] },
      { id: "tide", lines: ["Tide's out. It's always out, lately.", "As if the sea's leaving too."] },
    ],
  },
  {
    id: "watchman",
    name: "The Moor Watchman",
    area: "harbour",
    at: { col: 109, row: 49 },
    kind: "archer",
    flip: true,
    greet: "Gate stays shut.",
    part: "Back to the wall, then.",
    talks: [
      {
        id: "first",
        lines: [
          "The gate stays barred from this side, captain. Orders.",
          "Whatever's on the moor stays on the moor.",
          "You want it open, you'll have to go round and lift the bar yourself.",
        ],
      },
      { id: "barrows", lines: ["Lights on the barrows some nights.", "I don't look. Looking is how it starts."] },
      {
        id: "open",
        when: "moorGateOpen",
        lines: [
          "...You came through the barrows. On foot.",
          "Well. I'll stop barring it, then. You've made my post pointless.",
          "Thank you. I think.",
        ],
      },
    ],
  },
  {
    id: "penny",
    name: "Penny",
    area: "harbour",
    at: { col: 24, row: 62 },
    kind: "pawn",
    greet: "Shh!",
    part: "Don't tell them I'm here!",
    talks: [
      {
        id: "first",
        lines: [
          "Don't tell them I'm here. The black soldiers.",
          "They took my mum. The whole east lane. Off to the castle with the grey walls.",
          "They keep them in a yard with ropes. I squeezed out under the gate.",
        ],
      },
      { id: "crows", lines: ["I count the crows.", "When there's more of them, they're bringing more people."] },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["Is the yard open? Is it really?", "I'm going. I'm going right now. Don't you stop me!"],
      },
    ],
  },
  {
    id: "ansel",
    name: "Ansel of the Wall",
    area: "harbour",
    at: { col: 53, row: 19 },
    kind: "warrior",
    greet: "Look up, captain.",
    part: "Go on. I'll keep watch. It's all I'm good for.",
    talks: [
      {
        id: "first",
        lines: [
          "Look up, captain. See that glint? Past the clouds.",
          "Gold. A whole city of it, up there.",
          "It never sent us a single spear when the grey came.",
        ],
      },
      {
        id: "lift",
        lines: ["The Watch Lift only comes down.", "Someone up there decided who gets to visit."],
      },
      {
        id: "captain",
        lines: [
          "I wore that blue once. Had a band, a banner. The fire knew my name.",
          "Then I stopped going out. You'd be surprised how easy it is.",
        ],
      },
      { id: "watch", lines: ["Still here. Still watching. Someone ought to."] },
      {
        id: "lifted",
        when: "watchLiftOpen",
        lines: ["So you went up. Were they kind?", "...No. Gold never is."],
      },
    ],
  },
];

export const talkKey = (npc: Npc, talk: Talk): string => `${npc.id}.${talk.id}`;

/**
 * What a dweller says when talked to: a remark on something new in the world once it has met the captain, else the
 * next unheard conversation, else the last one again.
 */
export function nextTalk(npc: Npc, heard: ReadonlySet<string>, flags: ReadonlySet<WorldFlag>): Talk {
  const plain = npc.talks.filter((t) => !t.when);
  const unheard = (t: Talk): boolean => !heard.has(talkKey(npc, t));
  if (!unheard(plain[0]!)) {
    const news = npc.talks.find((t) => t.when && flags.has(t.when) && unheard(t));
    if (news) return news;
  }
  return plain.find(unheard) ?? plain.at(-1)!;
}
