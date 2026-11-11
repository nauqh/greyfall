// The folk who talk, after Dark Souls: the wanderer never speaks; each talk plays the next conversation in a few short
// pages, the last one repeats, and something done out in the world turns up as a new thing to say.

import type { AreaId } from "./atlas.ts";
import type { Stock } from "./hero.ts";
import type { Cell } from "./island.ts";

/** What the world remembers that folk remark on, and that moves them on. */
export type WorldFlag =
  | "died"
  // Felled by the bull in the Ring and washed up at the Harbour fire: it waits there still.
  | "bullWon"
  | "wellDescended"
  | "monkFreed"
  | "moorGateOpen"
  | "watchLiftOpen"
  | "trollKey"
  | "hornedKey"
  | "greyfallReached"
  | "warlordDead"
  | "ladderDown"
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
  /** Blue, the castle's, unless they are from elsewhere. */
  color?: "blue" | "red" | "yellow" | "purple" | "black";
  flip?: boolean;
  /** A merchant's goods, and what they say turning a sale down: short of gold, or already sold. */
  shop?: { stock: readonly Stock[]; poor: string; sold: string };
  /** Called out as the wanderer comes near. */
  greet: string;
  /** Called after a wanderer who walks off mid-talk. */
  part: string;
  talks: readonly Talk[];
  /** Where the questline takes them; until any applies they stand at home, above. */
  later?: readonly Station[];
}

/** Within this many tiles a dweller greets the wanderer and can be talked to. */
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
          "Another one the tide spat out. Hm.",
          "The last one sat where you're standing. Warmed his hands. Then he went east and did not come back.",
          "Go on, then. The fire doesn't ask what you were. Nor do I.",
        ],
      },
      {
        id: "shore",
        lines: [
          "Follow the lanterns up through Old Town, to the Burg Gate. Someone lit them before you came. They always do.",
          "The path up the hill runs through the graves to the Moor Gate. It's barred from this side. The dogs on that hill don't care that it's barred.",
        ],
      },
      {
        id: "bull",
        when: "bullWon",
        lines: [
          "The tide brought you back. The bull in the Ring did that.",
          "He'll keep. Go back by boat when your arm is stronger. What he guards is worth a fall or two.",
        ],
      },
      {
        id: "goal",
        lines: [
          "You'll be wanting the Grey Gate, east past the moor. Everyone does, in the end.",
          "Two keys open it. The king under the barrows keeps one.",
          "The other's down below, they say, in the Weaver's web. Down the well, then further down.",
        ],
      },
      {
        id: "castle",
        lines: [
          "The Keep? Shut since the Burg turned. Its steward ran for the wood with the key.",
          "A troll had him for supper, they say. Still has the key, I'd wager.",
        ],
      },
      {
        id: "well",
        lines: ["The well only goes one way. Down.", "Don't drink what's at the bottom. The grey's in the water, then it's in you."],
      },
      {
        id: "roads",
        lines: [
          "Every road out of here comes back to this fire. The gates, the well, the lift.",
          "Folk think that's a comfort. I've never been sure.",
        ],
      },
      { id: "rest", lines: ["Rest, if you must. The roads are patient as stones."] },
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
        lines: ["So the Warlord's dead, they're saying.", "The grey's still in the ground. I'll keep the fire going anyway. Habit. Someone ought to."],
      },
      {
        id: "ansel",
        when: "anselRoused",
        lines: [
          "Ansel's off the wall. I can see it from here. First time in years.",
          "They come back, or they don't. The wall will keep.",
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
    // Each edge a little later, as Andre's titanite and Elden Ring's bell bearings: the better one once a boss falls.
    shop: {
      stock: [{ item: "Brenna's Edge" }, { item: "Keener Edge", after: "stoneWarden" }, { item: "Grey-Iron Edge", after: "troll" }, { item: "Banded Shield" }],
      poor: "Gold first. Then sparks.",
      sold: "That's done. I don't make the same thing twice.",
    },
    greet: "Mind the sparks.",
    part: "Come back with ore.",
    talks: [
      {
        id: "first",
        lines: [
          "You want an edge on that? Bring me gold and ore.",
          "The gold's for me. The ore's for the blade. Mostly.",
          "There's a banded shield on the wall too, oak and iron. Takes a blow so your arm doesn't.",
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
        lines: ["Let me see that key. ...The Keep's. I cut that blank myself, years back.", "Smells of troll now. Wash it."],
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
    greet: "You're not one of mine.",
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
        lines: ["Forty spears.", "I'll carve them into the gate. Every one. Leave me to it."],
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
              "The Barrow King's dead. The barrows are only barrows now.",
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
    greet: "You walk loud.",
    part: "Keep your head down!",
    talks: [
      {
        id: "first",
        lines: [
          "You walk loud. That's fine. Archers like a loud friend up front.",
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
              "Troll's dead! The goblins don't know which way to run. Best shooting in years.",
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
          "That well's not for drawing water. My brother went down it after a dropped coin.",
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
        lines: ["You look chewed on.", "If it had wings, your steel won't reach it. Wren's bows will."],
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
              "Don't look so surprised. No rule against going down, is there?",
              "Smugglers keep this corner. One of them is wearing his coat. Said he swapped it, deeper in.",
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
              "Found him. He runs this camp. Thin as ever. Smiling.",
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
    part: "Go gently.",
    talks: [
      {
        id: "first",
        lines: [
          "My sisters went down to the Drowned Chapel, to pray the grey out of the water.",
          "The water did not clear. Nor did they come back.",
        ],
      },
      { id: "candle", lines: ["I light a candle each night.", "The hour comes round and my hands are already there."] },
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
              "Do not follow. Or do. I am too old to forbid things.",
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
              "Look. The water is clear down here. Clear at last.",
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
          "The gate stays barred from this side. Orders.",
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
              "Thought I'd see the lights for myself, since the gate's open anyway.",
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
          "Don't tell them I'm here. The grey men.",
          "They took my mum. The whole east lane. Off to the Greyfall, where the grey comes from.",
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
              "Shh! I followed you through the gate. You walk loud, so it's easy.",
              "They caught me straight off. But they put me in the yard. Same yard as mum!",
              "So that's alright. Mostly.",
            ],
          },
          { id: "fewer", lines: ["Fewer crows here today.", "You're killing them, aren't you? The grey ones, I mean."] },
        ],
      },
      {
        when: ["warlordDead"],
        area: "greyfall",
        at: { col: 73, row: 67 },
        talks: [
          {
            id: "free",
            lines: ["They ran! All the grey ones, they just ran!", "Mum says thank you. She says it twice. She's like that."],
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
    greet: "Look up.",
    part: "Go on. I'll keep watch. It's all I'm good for.",
    talks: [
      {
        id: "first",
        lines: [
          "Look up. See that glint past the clouds?",
          "The Gilded City. Gold walls, gold roofs, a city that never learned to bleed.",
          "When the grey came, it shut its gates. Not one spear. Not one prayer.",
        ],
      },
      {
        id: "lift",
        lines: ["The Watch Lift only comes down.", "Someone in the sky city decided who gets to visit."],
      },
      {
        id: "blue",
        lines: [
          "I wore that blue once. Had a band, a banner. The fire knew my name.",
          "Then I stopped going out. You'd be surprised how easy it is.",
        ],
      },
      { id: "watch", lines: ["Still here. Still watching. Someone ought to."] },
      {
        id: "lifted",
        when: "watchLiftOpen",
        lines: ["So you went up. Were they kind?", "...No. The sky city never is."],
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
              "Don't look at me like that. I said I'd come out.",
              "I'd forgotten the smell of the grey. Wet ash and old iron.",
            ],
          },
          {
            id: "ahead",
            sets: "anselAhead",
            lines: [
              "The Warlord's Hall is up past the High City. I'll go first, this time.",
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
          { id: "wall", lines: ["Back on the wall. It's a good wall.", "You can see the Gilded City from here. Doesn't glint so much now."] },
        ],
      },
      { when: ["anselAhead"], area: "greyfall", at: { col: 95, row: 25 }, dead: true },
    ],
  },
  {
    // After Dark Souls' Undead Merchant: tucked in a nook under the wall, trading through the end of the world.
    id: "mags",
    name: "Mags the Peddler",
    short: "Mags",
    area: "burg",
    at: { col: 37, row: 39 },
    kind: "pawn",
    act: "gold",
    color: "yellow",
    // Everything that is not a blade; the deeper fire only once the troll that sat on it is gone.
    shop: {
      stock: [{ item: "Ember Shard" }, { item: "Smoked Haunch" }, { item: "Pine Resin" }, { item: "Prospector's Purse" }, { item: "Kindled Shard", after: "troll" }],
      poor: "Hehe. Come back richer, dearie.",
      sold: "That was the only one, dearie.",
    },
    greet: "Hehe. A live one.",
    part: "Come back with coin, dearie.",
    talks: [
      {
        id: "first",
        lines: [
          "Don't mind old Mags. The grey took the Burg, not my trade.",
          "A shard of the old fire, a haunch, a pot of resin, a purse that sews itself fatter. One of each, mind.",
          "Kill whatever sits in the Emberwood and I'll find you a warmer shard. Hehe.",
        ],
      },
      { id: "thieves", lines: ["The thieves in the market? Burg folk, all of them.", "Went bad when the bell stopped. Bad for business, worse for them."] },
      { id: "rest", lines: ["Hehe. Still breathing, dearie? Good. Breathing folk buy things."] },
    ],
  },
  {
    // The square's last guard, after the Undead Burg's soldiers who held out: tired, and not taken yet.
    id: "hale",
    name: "Hale of the Watch",
    short: "Hale",
    area: "burg",
    at: { col: 51, row: 32 },
    kind: "lancer",
    greet: "Living? Then sit a while.",
    part: "Mind the bridges.",
    talks: [
      {
        id: "first",
        lines: [
          "You came over the creek? Then you've met the bridges' keepers.",
          "I held this square with six men. The bell stopped, and they turned, one by one.",
          "The Rampart Gate's up the street. Or through the graves on the hill, if you'd sooner the dead than the dying.",
        ],
      },
      { id: "ladder", lines: ["There was a ladder down to here from the Ramparts, by the fire.", "Someone pulled it up. From above."] },
      { id: "keep", when: "trollKey", lines: ["That's the troll's key on your belt?", "The Keep Gate's off the west alley. Corwin's lancers are behind it, if any are left."] },
      { id: "rest", lines: ["Sit. The fire's the one thing in the Burg that's still ours."] },
    ],
  },
  {
    // On the Ramparts' east tower past the bull, between the silent guns: the gunner who outlived his powder.
    id: "odo",
    name: "Odo the Gunner",
    short: "Odo",
    area: "ramparts",
    at: { col: 70, row: 14 },
    kind: "warrior",
    greet: "Bull's dead, then. Good. I was running out of things to throw.",
    part: "Mind the ladder. It sticks.",
    talks: [
      {
        id: "first",
        lines: [
          "Two guns on this tower. No powder since the grey came.",
          "The bull was the garrison's. The smiths shod him in iron for the parade.",
          "Then he forgot who fed him, and the goblins came over the wall.",
        ],
      },
      { id: "ladder", lines: ["There's a ladder down the south face to the Burg's square.", "Kick it loose. Their fire is right under it, if you need one."] },
      { id: "died", when: "died", lines: ["You came back. They don't, usually.", "The wall remembers everyone who crossed it. It just doesn't care."] },
      { id: "kicked", when: "ladderDown", lines: ["You found it. The square's closer than it looks."] },
    ],
  },
];

export const talkKey = (npc: Npc, talk: Talk): string => `${npc.id}.${talk.id}`;

/**
 * What a dweller says when talked to: a remark on something new in the world once it has met the wanderer, else the
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
