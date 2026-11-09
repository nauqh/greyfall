// The folk who talk, after Dark Souls: the captain never speaks; each talk plays the next conversation in a few short
// pages, the last one repeats, and something done out in the world turns up as a new thing to say.

import type { AreaId } from "./atlas.ts";
import type { Cell } from "./island.ts";

/** What the world remembers that folk remark on, and that moves them on. */
export type WorldFlag =
  | "died"
  // Felled by the Landing's bull and washed up on the point: he waits there still.
  | "bullWon"
  | "wellDescended"
  | "monkFreed"
  | "moorGateOpen"
  | "watchLiftOpen"
  | "trollKey"
  | "hornedKey"
  | "greyfallReached"
  | "warlordDead"
  // Set by a talk, not by the world.
  | "tobinDown"
  | "tobinDeeper"
  | "ysoldeDeeper"
  | "anselRoused"
  | "anselAhead"
  | "watchmanOut"
  | "marenSails";

export interface Talk {
  id: string;
  /** Said once, after the first talk, when this has happened. */
  when?: WorldFlag;
  /** Heard to the end, this happens: how a questline moves on. */
  sets?: WorldFlag;
  /** One page each. */
  lines: readonly string[];
}

/** Where a dweller is once all of `when` has happened; of several, the last listed wins. */
export interface Station {
  when: readonly WorldFlag[];
  /** Left out: moved on for good. */
  area?: AreaId;
  at?: Cell;
  flip?: boolean;
  /** Lies here dead and says nothing. */
  dead?: boolean;
  talks?: readonly Talk[];
}

export interface Whereabouts {
  area: AreaId;
  at: Cell;
  flip: boolean;
  dead: boolean;
  talks: readonly Talk[];
}

export interface Npc {
  id: string;
  name: string;
  /** Over their head when the name carries a title; the full name shows once spoken to. */
  short?: string;
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
  /** Where the questline takes them; until any applies they stand at home, above. */
  later?: readonly Station[];
}

/** Within this many tiles a dweller greets the captain and can be talked to. */
export const TALK_RANGE = 2;

export const NPCS: readonly Npc[] = [
  {
    id: "ferrow",
    name: "Old Ferrow",
    area: "harbour",
    at: { col: 61, row: 48 },
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
        id: "shore",
        lines: [
          "Follow the lanterns, captain. West along the shore, through the town, up to the Ember Gate. Someone lit them for you.",
          "The path up the hill goes through the graves to the Moor Gate. Shut from this side, and the dogs up there don't care that it's shut.",
        ],
      },
      {
        id: "bull",
        when: "bullWon",
        lines: [
          "Washed up with the tide, did you? The bull did that.",
          "He'll keep. Take the boat back when your arm's stronger. What he guards is worth a fall or two.",
        ],
      },
      {
        id: "goal",
        lines: [
          "You'll be wanting the Grey Gate. East, past the moor. They all do.",
          "Two keys open it. The king under the barrows keeps one.",
          "The other's down below, where the spider weaves. Down the well, and further down.",
        ],
      },
      {
        id: "castle",
        lines: [
          "The castle? Shut since the grey came. The steward ran for the wood with its key.",
          "Troll had him for supper, they say. Has the key still, I'd think.",
        ],
      },
      {
        id: "well",
        lines: ["The well only goes one way. Down, to the drowned.", "Not yet, captain. Not that way. Not yet."],
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
      {
        id: "ansel",
        when: "anselRoused",
        lines: [
          "Ansel's stool is empty. First time in years.",
          "I'll leave it where it is. They come back, or they don't, and it's still a good stool.",
        ],
      },
    ],
  },
  {
    id: "brenna",
    name: "Brenna the Smith",
    short: "Brenna",
    area: "chapel",
    at: { col: 73, row: 29 },
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
      {
        id: "ansel",
        when: "anselRoused",
        lines: [
          "Ansel came by. Wanted an edge on a sword I'd forgotten he had.",
          "He didn't haggle. That worried me.",
        ],
      },
    ],
  },
  {
    id: "corwin",
    name: "Sergeant Corwin",
    short: "Corwin",
    area: "keep",
    at: { col: 21, row: 29 },
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
    later: [
      {
        when: ["hornedKey"],
        area: "barrowmoor",
        at: { col: 29, row: 22 },
        talks: [
          {
            id: "barrows",
            lines: [
              "Captain. The king's dead, so the barrows are only barrows now.",
              "My forty went into them. I'm digging them out. One at a time.",
            ],
          },
          { id: "count", lines: ["Twenty-two. Dace still had his pipe.", "Holm had nothing. Holm always had nothing."] },
          { id: "last", lines: ["Thirty-nine.", "The fortieth was me, I think. I ought to be down there with them."] },
          {
            id: "done",
            when: "warlordDead",
            lines: ["So it's finished. Up in the grey.", "Tell them at the gate. I've no hands left for carving."],
          },
        ],
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
    later: [
      {
        when: ["trollKey"],
        area: "emberwood",
        at: { col: 29, row: 44 },
        talks: [
          {
            id: "bluff",
            lines: [
              "Captain! Troll's dead, the goblins don't know which way to run. Best shooting in years.",
              "Don't tell the Harbour. They'll want me back being useful.",
            ],
          },
          { id: "torches", lines: ["Torches first. Always torches first."] },
        ],
      },
    ],
  },
  {
    id: "tobin",
    name: "Tobin",
    area: "harbour",
    at: { col: 57, row: 51 },
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
        id: "wings",
        lines: [
          "Something else lives down there. Wings. You hear them before you see them.",
          "A sword's no use on a thing that won't come down to meet it.",
          "Wren hires out bows, at the butts by the west road. Take one with you, if you go.",
        ],
      },
      {
        id: "chewed",
        when: "died",
        lines: ["You look chewed on, captain.", "If it had wings, steel won't reach it. Wren's bows will."],
      },
      {
        id: "below",
        when: "wellDescended",
        sets: "tobinDown",
        lines: [
          "You came back? From down there?",
          "...Did you see him? Thin fellow. Quick hands. Always smiling.",
          "No. Course not. Forget I asked.",
        ],
      },
    ],
    later: [
      {
        when: ["tobinDown"],
        area: "undercroft",
        at: { col: 11, row: 9 },
        talks: [
          {
            id: "nook",
            lines: [
              "Captain. Don't look so surprised. No rule against going down, is there?",
              "Smugglers keep this corner. One of them wore his coat. Said he swapped it, deeper in.",
              "Swapped it. Ha. He never swapped a thing in his life.",
            ],
          },
          {
            id: "deeper",
            sets: "tobinDeeper",
            lines: ["I'm going on, through the cisterns.", "Don't wait for me. Nobody ever has."],
          },
        ],
      },
      {
        when: ["tobinDeeper"],
        area: "deeps",
        at: { col: 7, row: 69 },
        talks: [
          {
            id: "camp",
            lines: [
              "Found him, captain. He runs this camp. Thin as ever. Smiling.",
              "He says the coin was never dropped. He threw it, to see who'd come after.",
              "...I came after.",
            ],
          },
          { id: "stay", lines: ["I'm staying. Someone has to count what he steals.", "Quick hands run in the family. Turns out."] },
        ],
      },
    ],
  },
  {
    id: "ysolde",
    name: "Mother Ysolde",
    short: "Ysolde",
    area: "harbour",
    at: { col: 54, row: 29 },
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
    ],
    later: [
      {
        when: ["monkFreed"],
        area: "undercroft",
        at: { col: 49, row: 55 },
        talks: [
          {
            id: "freed",
            lines: [
              "You found one of us. Living. So I came down the well. Old knees, long drop.",
              "She does not remember her name yet. I tell it to her, and she thanks me, every time.",
              "One is a mercy. I'll not ask the dark for more than it gives.",
            ],
          },
          {
            id: "lake",
            sets: "ysoldeDeeper",
            lines: [
              "She speaks in her sleep. Of a lake under all of this, clear as glass.",
              "The others went on to it. I must go too.",
              "Do not follow, captain. Or do. I am too old to forbid things.",
            ],
          },
        ],
      },
      {
        when: ["ysoldeDeeper"],
        area: "hollow",
        at: { col: 94, row: 49 },
        talks: [
          {
            id: "clear",
            lines: [
              "Look, captain. The water is clear down here. Clear at last.",
              "I can see them at the bottom. All my sisters, kneeling. Still praying.",
              "...No. Don't pull me back. I have only just found them.",
            ],
          },
          { id: "kneel", lines: ["I have stopped lighting candles.", "There is light enough down here. Cold, but enough."] },
        ],
      },
    ],
  },
  {
    id: "maren",
    name: "Maren the Harbourmaster",
    short: "Maren",
    area: "harbour",
    at: { col: 55, row: 60 },
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
      {
        id: "sail",
        when: "warlordDead",
        sets: "marenSails",
        lines: [
          "A sail. Off the point, this morning. First in three winters.",
          "Salt men, likely. Pirates, likelier. I don't care.",
          "Thirty years I've watched that water. I'd like to be on it once, before it leaves for good.",
        ],
      },
    ],
    later: [{ when: ["marenSails"] }],
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
        sets: "watchmanOut",
        lines: [
          "...You came through the barrows. On foot.",
          "Well. I'll stop barring it, then. You've made my post pointless.",
          "Thank you. I think.",
        ],
      },
    ],
    later: [
      {
        when: ["watchmanOut"],
        area: "barrowmoor",
        at: { col: 38, row: 57 },
        flip: true,
        talks: [
          {
            id: "lights",
            lines: [
              "Captain. Thought I'd see the lights for myself, since the gate's open anyway.",
              "They're lanterns. Held by nobody. Swinging, all the same.",
            ],
          },
          { id: "look", lines: ["I'll just look a little longer.", "Looking is how it starts. I know. I said that."] },
        ],
      },
      { when: ["watchmanOut", "hornedKey"] },
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
    ],
    later: [
      {
        when: ["greyfallReached"],
        area: "greyfall",
        at: { col: 73, row: 67 },
        talks: [
          {
            id: "penned",
            lines: [
              "Shh! Captain! I followed you through the gate. You walk loud, it's easy.",
              "They caught me straight off. But they put me in the yard. Same yard as mum!",
              "So that's alright. Mostly.",
            ],
          },
          { id: "fewer", lines: ["Fewer crows here today.", "You're killing them, aren't you? The black ones, I mean."] },
        ],
      },
      {
        when: ["warlordDead"],
        area: "greyfall",
        at: { col: 73, row: 67 },
        talks: [
          {
            id: "free",
            lines: ["They ran! All the black soldiers, they just ran!", "Mum says thank you. She says it twice. She's like that."],
          },
          { id: "home", lines: ["We're walking home. Mum says slowly.", "She's had enough of being hurried by ropes."] },
        ],
      },
    ],
  },
  {
    id: "ansel",
    name: "Ansel of the Wall",
    short: "Ansel",
    area: "keep",
    at: { col: 43, row: 11 },
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
      {
        id: "roused",
        when: "trollKey",
        sets: "anselRoused",
        lines: [
          "The troll. You killed it. With that.",
          "...I had a sword once. It's under the bed, I think.",
          "Maybe I've sat long enough. Don't say anything. You'll talk me out of it.",
        ],
      },
    ],
    later: [
      {
        when: ["anselRoused"],
        area: "greyfall",
        at: { col: 14, row: 54 },
        talks: [
          {
            id: "out",
            lines: [
              "Captain. Don't look at me like that. I said I'd come out.",
              "I'd forgotten the smell of the grey. Wet ash and old iron.",
            ],
          },
          {
            id: "ahead",
            sets: "anselAhead",
            lines: [
              "The warlord's hall is up past the keep. I'll go first, this time.",
              "Let me have that. You've had all the others.",
            ],
          },
        ],
      },
      {
        when: ["warlordDead"],
        area: "keep",
        at: { col: 43, row: 11 },
        talks: [
          {
            id: "without",
            lines: ["You went up without me. Good.", "I'd only have been in the way. I'd only have been brave."],
          },
          { id: "wall", lines: ["Back on the wall. It's a good wall.", "You can see the gold from here. Doesn't glint so much now."] },
        ],
      },
      { when: ["anselAhead"], area: "greyfall", at: { col: 95, row: 25 }, dead: true },
    ],
  },
];

export const talkKey = (npc: Npc, talk: Talk): string => `${npc.id}.${talk.id}`;

/**
 * What a dweller says when talked to: a remark on something new in the world once it has met the captain, else the
 * next unheard conversation, else the last one again.
 */
export function nextTalk(npc: Npc, heard: ReadonlySet<string>, flags: ReadonlySet<WorldFlag>): Talk {
  const talks = whereabouts(npc, flags)?.talks ?? npc.talks;
  const plain = talks.filter((t) => !t.when);
  const unheard = (t: Talk): boolean => !heard.has(talkKey(npc, t));
  if (!unheard(plain[0]!)) {
    const news = talks.find((t) => t.when && flags.has(t.when) && unheard(t));
    if (news) return news;
  }
  return plain.find(unheard) ?? plain.at(-1)!;
}

/** Where a dweller stands given what has happened, or null once they have moved on. */
export function whereabouts(npc: Npc, flags: ReadonlySet<WorldFlag>): Whereabouts | null {
  const s = [...(npc.later ?? [])].reverse().find((s) => s.when.every((f) => flags.has(f)));
  if (!s) return { area: npc.area, at: npc.at, flip: !!npc.flip, dead: false, talks: npc.talks };
  return s.area && s.at ? { area: s.area, at: s.at, flip: !!s.flip, dead: !!s.dead, talks: s.talks ?? [] } : null;
}
