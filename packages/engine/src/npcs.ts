// The folk who talk, after Dark Souls: the wanderer never speaks; each talk plays the next conversation in a few short
// pages, the last one repeats, and something done out in the world turns up as a new thing to say.

import type { AreaId } from "./atlas.ts";
import type { ItemName, Stock } from "./hero.ts";
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
  | "oldLiftDown"
  | "emberGateOpen"
  // Told of by Ysolde, or walked down from the Ward: the stair beside the Harbour's chapel.
  | "sistersStair"
  // Unbarred from the Graves' crest: the stair off its south-west corner toward the fire square.
  | "coffinStairOpen"
  | "shellDead"
  // Set by a talk, not by the world.
  | "tobinDown"
  | "tobinDeeper"
  | "ysoldeDeeper"
  | "anselRoused"
  | "anselAhead"
  | "watchmanOut"
  | "marenSails"
  | "pennyFollows"
  | "drankClear";

export interface Talk {
  id: string;
  /** Said once, after the first talk, when this has happened. */
  when?: WorldFlag;
  /** Heard to the end, this happens: how a questline moves on. */
  sets?: WorldFlag;
  /** Heard to the end the first time, the wanderer is given this. */
  gives?: ItemName;
  /** Heard to the end the first time, this is thrown down near the wanderer, to be picked up. */
  throws?: ItemName;
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

// Said at more than one station, so heard once wherever it was heard.
const corwinDig: readonly Talk[] = [
  {
    id: "barrows",
    lines: ["The Barrow King is dead... The barrows are only barrows now.", "My forty went into them. So I'm digging them out. One at a time."],
  },
  { id: "count", lines: ["Twenty-two. Dace still had his pipe on him.", "Holm had nothing. ...Holm always had nothing."] },
];
const corwinDone: Talk = {
  id: "done",
  when: "warlordDead",
  lines: ["So. It's finished, up in the Grey.", "Tell them at the gate, will you? I've no hands left for carving."],
};
const wrenPenny: Talk = {
  id: "penny",
  when: "greyfallReached",
  lines: [
    "Penny's gone from behind the butts. She used to sit there and count crows.",
    "If you see her, tell her I kept her seat. ...Don't tell her I said kept.",
  ],
};
const ysoldeClean: Talk = {
  id: "clean",
  when: "drankClear",
  lines: ["You drank from the lake, child. I can smell it on you. Clean, as nothing is.", "...Nothing down here is clean. Remember that."],
};

export const NPCS: readonly Npc[] = [
  {
    id: "ferrow",
    name: "Old Ferrow",
    area: "harbour",
    at: { col: 75, row: 52 },
    kind: "pawn",
    greet: "Ah. Another one.",
    part: "Mind the dark, then.",
    talks: [
      {
        id: "first",
        lines: [
          "...Hm. Another one the tide spat out.",
          "Name's Ferrow. I keep this fire. Someone has to.",
          "The last one sat right where you're standing. Warmed his hands, then went east.",
          "He didn't come back. They never do. Hah...",
        ],
      },
      {
        id: "shore",
        lines: [
          "You'll want the lanterns. They run up through Old Town and round the back of the hill, to the Burg Gate.",
          "Someone lit them before you came. ...Someone always does.",
          "There's a path up through the graves to the Moor Gate, too. Barred from this side.",
          "Not that the dogs on that hill care much for bars.",
        ],
      },
      {
        id: "bull",
        when: "bullWon",
        lines: [
          "So the tide brought you back. That bull in the Ring, I'd wager.",
          "He'll keep. Take the boat back when your arm is stronger.",
          "Whatever he guards is worth a fall or two. Hm.",
        ],
      },
      {
        id: "goal",
        lines: [
          "You'll be wanting the Grey Gate, east past the moor. Everyone does, in the end.",
          "Two keys open it. The king under the barrows keeps one.",
          "The other's far below, they say. In the Weaver's web, down the well and further down still.",
        ],
      },
      {
        id: "castle",
        lines: [
          "The Keep? Shut, since the Burg turned. Its steward ran for the wood with the key.",
          "A troll had him for supper, so they say... Still has the key, I'd wager.",
        ],
      },
      {
        id: "well",
        lines: ["The Old Well only goes one way. Down.", "And don't drink what's at the bottom. The Grey's in that water, and then it's in you."],
      },
      {
        id: "roads",
        lines: ["Every road out of here comes back to this fire. The gates, the well, the lift.", "Folk find that a comfort. ...I've never been sure."],
      },
      { id: "rest", lines: ["Rest, if you must. The roads are patient as stones."] },
      {
        id: "died",
        when: "died",
        lines: ["Back so soon? Don't look at me like that.", "Everyone comes back. That's the trouble with this place. Hah..."],
      },
      {
        id: "key",
        when: "trollKey",
        lines: ["That key's warm. Troll's blood, or the fire inside the brute.", "Either way, keep it away from my kindling."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["So the Warlord's dead, they're saying. Hm.", "The Grey's still in the ground, mind. I'll keep the fire going anyway. Habit."],
      },
      {
        id: "ansel",
        when: "anselRoused",
        lines: ["Ansel's off his wall. I can see it from here. First time in years.", "They come back, or they don't. The wall will keep."],
      },
      { id: "east", when: "greyfallReached", lines: ["You went east... and you came back.", "That's one more than the last one managed."] },
      {
        id: "gone",
        when: "anselAhead",
        lines: ["Ansel's not come back off the moor road. Nor will he, I'd wager.", "They go east. ...They always go east."],
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
      stock: [{ item: "Brenna's Edge" }, { item: "Keener Edge", after: "stoneWarden" }, { item: "Grey-Iron Edge", after: "troll" }, { item: "Banded Shield" }, { item: "Ansel's Edge", flag: "anselAhead" }],
      poor: "Gold first. Then sparks.",
      sold: "That's done. I don't make the same thing twice.",
    },
    greet: "Mind the sparks.",
    part: "Come back with gold.",
    talks: [
      {
        id: "first",
        lines: [
          "Hm? Don't stand so close. Sparks don't care whose eyes they find.",
          "I'm Brenna. Smith to the Ward, for what's left of it.",
          "Want an edge on that? Bring me gold. The rest is my business.",
          "There's a banded shield on the wall, too. Oak and iron. Takes the blow so your arm doesn't.",
        ],
      },
      {
        id: "ore",
        lines: [
          "Mine Hills ore is soft, but honest. The Crags have better, under the gnomes.",
          "Go and be rude to them. They'll understand. It's how they talk to each other.",
        ],
      },
      { id: "hammer", lines: ["Heat, hit. Heat, hit.", "Same as fighting. Only the iron never hits back."] },
      {
        id: "key",
        when: "trollKey",
        lines: ["Let me see that key... Hm. The Keep's. I cut that blank myself, years back.", "Smells of troll now. Wash it."],
      },
      {
        id: "ansel",
        when: "anselRoused",
        lines: [
          "Ansel came by. Paid for two edges on that old sword of his. Didn't even haggle.",
          "Took the sword with one edge on it. Said he'd be back for the other.",
        ],
      },
      {
        id: "second",
        when: "anselAhead",
        lines: ["He hasn't come back for the second edge.", "I don't keep things for the dead. I sell them. Gold first."],
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
    part: "Dismissed.",
    talks: [
      {
        id: "first",
        lines: [
          "You're not one of mine. ...No. Mine are all gone.",
          "Sergeant Corwin. We were forty spears once. Forty.",
          "Now I drill boys with broom handles and call it a garrison.",
          "Want a lance at your side? Pay, and I'll find you one who still stands.",
        ],
      },
      { id: "drill", lines: ["Point forward. Feet back.", "If they're charging you, you've already done it wrong."] },
      {
        id: "died",
        when: "died",
        lines: ["You fell. Don't tell me where.", "Bring me the ones still breathing. Not their names."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["Forty spears...", "I'll carve them into the gate, every one. Leave me to it."],
      },
      {
        id: "post",
        when: "watchmanOut",
        lines: ["The watchman on the Moor Gate's left his post. Good.", "He'll tell you he barred it on my orders. I never gave him any."],
      },
      { id: "ansel", when: "anselRoused", lines: ["Ansel's got his sword out. Took him long enough.", "Took me forty men. ...Don't tell him I said so."] },
    ],
    later: [
      {
        when: ["hornedKey"],
        area: "barrowmoor",
        at: { col: 29, row: 22 },
        talks: [...corwinDig, { id: "last", lines: ["Thirty-nine...", "The fortieth was me, I think. I ought to be down there with them."] }, corwinDone],
      },
      {
        when: ["hornedKey", "watchmanOut"],
        area: "barrowmoor",
        at: { col: 29, row: 22 },
        talks: [
          ...corwinDig,
          {
            id: "forty",
            gives: "The Forty's Banner",
            lines: [
              "Forty. Found him this morning, lying among them like he'd never left.",
              "He ran, the night the King came up. I let him go. I'd have run too, if I'd been quicker.",
              "This was rolled up under him. Take it.",
              "It never did come home. ...Take it further.",
            ],
          },
          corwinDone,
        ],
      },
    ],
  },
  {
    id: "wren",
    name: "Wren",
    area: "harbour",
    at: { col: 27, row: 57 },
    kind: "archer",
    greet: "You walk loud.",
    part: "Keep your head down!",
    talks: [
      {
        id: "first",
        lines: [
          "You walk loud, you know. That's fine. An archer likes a loud friend up front.",
          "I'm Wren. I keep the butts, and the bows.",
          "Put gold on the barrel, and I'll send you someone who doesn't miss. ...Much.",
        ],
      },
      {
        id: "goblins",
        lines: ["Goblins at the Ember Gate camp in threes.", "Shoot the torch first. Spears are slow. Torches are rude."],
      },
      { id: "back", lines: ["Five paces back, always.", "If you can smell it, you're too close."] },
      { id: "wings", when: "died", lines: ["Tobin sent you for a bow, didn't he? Wings?", "Steel goes up, and steel comes down. Only arrows keep going."] },
      wrenPenny,
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
              "Ha! The troll's dead! The goblins don't know which way to run.",
              "Best shooting in years. Don't tell the Harbour, they'll want me back being useful.",
            ],
          },
          { id: "torches", lines: ["Torches first. Always torches first."] },
          wrenPenny,
        ],
      },
    ],
  },
  {
    id: "tobin",
    name: "Tobin",
    area: "harbour",
    at: { col: 44, row: 53 },
    kind: "pawn",
    greet: "Don't lean on the rope.",
    part: "...Right. Off you go.",
    talks: [
      {
        id: "first",
        lines: [
          "Don't lean on that rope. It's older than me.",
          "That's the Old Well, in the hill there. Not for drawing water.",
          "My brother went down it after a dropped coin. ...Never came up.",
          "Says something about the coin, doesn't it?",
        ],
      },
      { id: "rule", lines: ["No climbing back up. That's the rule of the well.", "Funny, a hole having rules."] },
      {
        id: "wings",
        lines: [
          "Something else lives down there. Wings. You hear them before you see them.",
          "A sword's no use on a thing that won't come down to meet it.",
          "Wren hires out bows, at the butts by the west road. Take one, if you go.",
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
        lines: ["You came back? From down there?", "...Did you see him? Thin fellow. Quick hands. Always smiling.", "No. Course not. ...Forget I asked."],
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
              "Don't look so surprised. There's no rule against going down, is there?",
              "Smugglers keep this corner. One of them is wearing his coat.",
              "Says he swapped it, deeper in. Ha. My brother never swapped a thing in his life.",
            ],
          },
          {
            id: "deeper",
            sets: "tobinDeeper",
            lines: ["I'm going on, through the cisterns.", "Don't wait for me. ...Nobody ever has."],
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
          {
            id: "stay",
            gives: "The Thrown Coin",
            lines: [
              "I'm staying. Someone has to count what he steals.",
              "Here. The coin. I found it at the bottom, the day I came down. He never looked for it.",
              "Quick hands run in the family, turns out.",
            ],
          },
        ],
      },
    ],
  },
  {
    // Tobin's brother, after Patches: smiles, robs, sells it back.
    id: "jory",
    name: "Jory",
    area: "deeps",
    at: { col: 8, row: 68 },
    kind: "pawn",
    act: "gold",
    shop: {
      stock: [{ item: "Smuggler's Coat" }, { item: "Sister's Candle", flag: "ysoldeDeeper" }],
      poor: "Ha! Come back heavier, friend.",
      sold: "Gone. Things go, down here.",
    },
    greet: "Ha! Walk soft, friend.",
    part: "Mind your purse, friend.",
    talks: [
      {
        id: "first",
        lines: [
          "Well, well! Tobin's friend? Anyone who comes this deep is a friend of mine.",
          "Name's Jory. And friends buy things, don't they? Ha ha!",
          "Don't mind the lads. They only take what isn't watched.",
        ],
      },
      {
        id: "coin",
        lines: [
          "The coin? Oh, I threw it. Down the well, a long time ago.",
          "To see who'd come after. Two did. Him, and you.",
          "Didn't expect you, I'll admit. Ha ha!",
        ],
      },
    ],
    later: [
      {
        when: ["tobinDeeper", "warlordDead"],
        area: "harbour",
        at: { col: 44, row: 53 },
        talks: [{ id: "well", lines: ["Tobin? Still down there. Counting. Someone has to.", "Don't lean on that rope, friend. It's older than both of us."] }],
      },
    ],
  },
  {
    id: "ysolde",
    name: "Mother Ysolde",
    short: "Ysolde",
    area: "harbour",
    at: { col: 43, row: 24 },
    kind: "monk",
    greet: "Peace on you, child.",
    part: "Go gently.",
    talks: [
      {
        id: "first",
        lines: [
          "Peace on you, child. I am Ysolde, mother to the Order here.",
          "My sisters went down to the Drowned Chapel, to pray the Grey out of the water.",
          "The water did not clear. ...Nor did they come back.",
        ],
      },
      {
        id: "stair",
        sets: "sistersStair",
        lines: [
          "Beside the chapel there is a stair. The sisters climbed it to the Ward to pray, before the Grey.",
          "I've no knees for it now. The bar lifts from this side.",
          "Go up, if you've the stomach for what walks the cloister.",
        ],
      },
      { id: "candle", lines: ["I light a candle each night.", "The hour comes round, and my hands are already there."] },
      ysoldeClean,
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
              "You found one of us. Living. She walks with you now, so I came down to see where.",
              "I told her her name. She thanked me.",
              "She'll have lost it again by the next fire. ...Tell it to her, some nights.",
              "One is a mercy. I'll not ask the dark for more.",
            ],
          },
          {
            id: "lake",
            sets: "ysoldeDeeper",
            lines: [
              "She speaks in her sleep. Of a lake under all of this, clear as glass.",
              "The others went on to it. I must go too.",
              "Do not follow. ...Or do. I am too old to forbid things.",
            ],
          },
          ysoldeClean,
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
              "Look, child. The water is clear down here. Clear at last.",
              "I can see them at the bottom. All my sisters, kneeling. Still praying.",
              "...No. Don't pull me back. I have only just found them.",
            ],
          },
          { id: "kneel", lines: ["I have stopped lighting candles.", "There is light enough down here. Cold, but enough."] },
          ysoldeClean,
        ],
      },
      {
        when: ["ysoldeDeeper", "shellDead"],
        area: "harbour",
        at: { col: 43, row: 24 },
        talks: [
          {
            id: "ash",
            gives: "Sister's Candle",
            lines: [
              "The water went grey when it died. Then my sisters were only bones.",
              "I can leave bones, child. I couldn't leave them kneeling.",
              "Take this. I've stopped lighting it. Light it for the ones you lose.",
            ],
          },
          ysoldeClean,
        ],
      },
    ],
  },
  {
    // A sister of the Order, kept below by what she prayed to: freed, she walks with the wanderer as the Monk.
    id: "sister",
    name: "A Drowned Sister",
    short: "Sister",
    area: "undercroft",
    at: { col: 51, row: 55 },
    kind: "monk",
    color: "purple",
    greet: "...Mother?",
    part: "Don't go far...",
    talks: [
      {
        id: "first",
        lines: ["...Is it night? It's always night, down here.", "We came to pray the water clear... I don't remember the others' faces."],
      },
      {
        id: "warm",
        sets: "monkFreed",
        lines: ["You're warm. Nothing down here is warm.", "I'll walk with you... I've forgotten the way up. You haven't."],
      },
    ],
    later: [{ when: ["monkFreed"] }],
  },
  {
    id: "pilgrim",
    name: "The Pilgrim",
    short: "Pilgrim",
    area: "hollow",
    at: { col: 95, row: 49 },
    kind: "monk",
    color: "purple",
    greet: "Softly. It sleeps.",
    part: "Softly, going.",
    talks: [
      {
        id: "first",
        lines: [
          "Softly... The sisters came to pray the Grey out of the water.",
          "And it went out of the water. Look.",
          "It sleeps on the isle. The lake stays clear while it sleeps.",
        ],
      },
      {
        id: "water",
        sets: "drankClear",
        gives: "Hollow Water",
        lines: ["Drink. It is clear. Nothing clear is left up there.", "The old one by the harbour fire says not to. ...He has never been down."],
      },
    ],
    later: [{ when: ["shellDead"], area: "hollow", at: { col: 95, row: 49 }, dead: true }],
  },
  {
    id: "maren",
    name: "Maren the Harbourmaster",
    short: "Maren",
    area: "harbour",
    at: { col: 67, row: 63 },
    kind: "pawn",
    greet: "Tide's out.",
    part: "Fair winds. Ha.",
    talks: [
      {
        id: "first",
        lines: [
          "Tide's out. ...Maren. I keep the harbour, for all the good it does.",
          "No ships in three winters.",
          "The salt men down the coast still trade, if you can stomach their prices. And their pirates.",
          "Mostly the pirates. Ha.",
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
    id: "dunstan",
    name: "Dunstan the Foreman",
    short: "Dunstan",
    area: "harbour",
    at: { col: 96, row: 25 },
    kind: "pawn",
    greet: "Mind the carts.",
    part: "Back to it.",
    talks: [
      {
        id: "first",
        lines: [
          "Mind the carts. ...Dunstan. I run the Mine Hills, what's left to run.",
          "The good ore came off the deep face, under the crest. Forty loads a week.",
          "Then one shift it came up grey. Cold in the hand. Cold in July.",
          "The lads who worked it went slow. Slower every day. So I nailed it shut myself.",
        ],
      },
      { id: "face", lines: ["We work the old face now. Soft stuff. Brenna grumbles.", "Let her grumble. She's still got all her lads."] },
      { id: "boards", lines: ["Don't touch the boards.", "I count them every morning. Nineteen. ...Still nineteen."] },
      {
        id: "warm",
        when: "warlordDead",
        lines: ["Put my hand to the boards this morning. Warm. First time in three winters.", "Maybe I'll pull them. ...Maybe next year."],
      },
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
          "Gate stays barred from this side. Orders.",
          "Whatever's on the moor stays on the moor.",
          "Want it open? Then go round, and lift the bar from the far side yourself.",
        ],
      },
      { id: "barrows", lines: ["Lights on the barrows, some nights.", "I don't look. Looking is how it starts."] },
      {
        id: "open",
        when: "moorGateOpen",
        sets: "watchmanOut",
        lines: ["...You came through the barrows. On foot.", "Well. I'll stop barring it, then. You've made my post pointless.", "Thank you. ...I think."],
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
            lines: ["Thought I'd see the lights for myself, since the gate's open anyway.", "They're lanterns. Held by nobody. Swinging, all the same."],
          },
          { id: "look", lines: ["I'll just look a little longer.", "Looking is how it starts. I know. I said that."] },
          {
            id: "spear",
            lines: ["Sergeant Corwin. Is he still drilling boys at the Keep?", "Don't tell him you saw me. He'd want a count. He always wanted a count."],
          },
        ],
      },
      // Gone down to lie with the forty, where Corwin digs.
      { when: ["watchmanOut", "hornedKey"], area: "barrowmoor", at: { col: 31, row: 23 }, dead: true },
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
          "Shh! Don't tell them I'm here. The grey men.",
          "They took my mum. The whole east lane. Off to the Greyfall, where the Grey comes from.",
          "They keep them in a yard, with ropes. I squeezed out under the gate.",
        ],
      },
      {
        id: "crows",
        sets: "pennyFollows",
        lines: [
          "I count the crows. When there's more of them, they're bringing more people.",
          "Wren says you walk loud. You do.",
          "...I could follow you anywhere.",
        ],
      },
    ],
    // Followed the wanderer only if talked to; never met, she stays hidden and her mother walks home to her.
    later: [
      {
        when: ["pennyFollows", "greyfallReached"],
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
        area: "harbour",
        at: { col: 68, row: 71 },
        talks: [
          { id: "mum", lines: ["Mum came home! On her own feet!", "She says the grey ones just ran. She says it twice."] },
          { id: "bread", gives: "Mum's Bread", lines: ["Mum made bread. It's mostly ash.", "Here. ...She says it's for you."] },
        ],
      },
      {
        when: ["pennyFollows", "warlordDead"],
        area: "greyfall",
        at: { col: 73, row: 67 },
        talks: [
          {
            id: "free",
            lines: ["They ran! All the grey ones, they just ran!", "Mum says thank you. She says it twice. She's like that."],
          },
          { id: "home", gives: "Mum's Bread", lines: ["We're walking home. Mum says slowly.", "She's had enough of being hurried by ropes."] },
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
          "Look up. See that glint, past the clouds?",
          "The Gilded City. Gold walls, gold roofs. A city that never learned to bleed.",
          "When the Grey came, it shut its gates. Not one spear. Not one prayer.",
          "...Ansel. Of the wall, they call me now. I used to be of something else.",
        ],
      },
      {
        id: "lift",
        lines: ["The Watch Lift only comes down.", "Someone in the sky city decided who gets to visit."],
      },
      {
        id: "blue",
        lines: ["I wore that blue once. Had a band, a banner. The fire knew my name.", "Then I stopped going out. ...You'd be surprised how easy it is."],
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
              "I'd forgotten the smell of the Grey. Wet ash and old iron.",
              "Talk to me again and I'll go on up. So don't. Not unless you mean it.",
            ],
          },
          {
            id: "ahead",
            sets: "anselAhead",
            lines: ["The Warlord's Hall is up past the High City. I'll go first, this time.", "Let me have that. You've had all the others."],
          },
        ],
      },
      {
        when: ["anselRoused", "warlordDead"],
        area: "keep",
        at: { col: 43, row: 11 },
        talks: [
          {
            id: "without",
            lines: ["You went up without me. Good.", "I'd only have been in the way. ...I'd only have been brave."],
          },
          {
            id: "wall",
            gives: "Ansel's Edge",
            lines: [
              "Back on the wall. It's a good wall.",
              "Brenna was holding an edge I paid for. Here, it's yours.",
              "If she asks, tell her I sent you. She'll want it in writing. Hah...",
            ],
          },
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
      stock: [{ item: "Ember Shard" }, { item: "Smoked Haunch" }, { item: "Pine Resin" }, { item: "Prospector's Purse" }, { item: "Kindled Shard", after: "troll" }, { item: "Salt-Glass Flask", flag: "marenSails" }],
      poor: "Hehe. Come back richer, dearie.",
      sold: "That was the only one, dearie.",
    },
    greet: "Hehe. A live one.",
    part: "Come back with coin, dearie.",
    talks: [
      {
        id: "first",
        lines: [
          "Hehe. A live one! Don't mind old Mags, dearie.",
          "The Grey took the Burg. Not my trade. Hehe.",
          "A shard of the old fire, a haunch, a pot of resin, a purse that sews itself fatter.",
          "One of each, mind. Keep them in your sack, where your hands can find them.",
          "Kill whatever sits in the Emberwood, and I'll find you a warmer shard. Hehe.",
        ],
      },
      { id: "thieves", lines: ["The thieves in the market? Burg folk, all of them.", "Went bad when the bell stopped. Bad for business, worse for them."] },
      { id: "rest", lines: ["Hehe. Still breathing, dearie? Good.", "Breathing folk buy things."] },
      {
        id: "fence",
        when: "tobinDeeper",
        lines: ["Tobin's gone down after his brother? Hehe. Then he'll meet my best supplier.", "Don't ask what I buy from below, dearie. I don't."],
      },
      {
        id: "ship",
        when: "marenSails",
        lines: [
          "A ship in, and Maren off on it. Thirty years she waited. Hehe.",
          "Some of us don't wait.",
          "The salt men left me a crate. Glass, dearie. Salt-glass. One, mind.",
        ],
      },
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
          "Living? Then sit a while. ...Hale, of the Watch. Last of it.",
          "You came over the creek? Then you've met the bridges' keepers.",
          "I held this square with six men. The bell stopped, and they turned. One by one.",
          "The Rampart Gate's up the street. Or through the graves on the hill, if you'd sooner the dead than the dying.",
        ],
      },
      { id: "ladder", lines: ["There was a ladder down to here from the Ramparts, by the fire.", "Someone pulled it up. From above."] },
      {
        id: "keep",
        when: "trollKey",
        lines: ["That's the troll's key on your belt?", "The Keep Gate's off the west alley. Corwin's lancers are behind it, if any are left."],
      },
      { id: "rest", lines: ["Sit. The fire's the one thing in the Burg that's still ours."] },
    ],
  },
  {
    // At the Bull's Wall's east end past the boar, by the Gun Bridge: the gunner who outlived his powder.
    id: "odo",
    name: "Odo the Gunner",
    short: "Odo",
    area: "bullwall",
    at: { col: 72, row: 12 },
    kind: "warrior",
    greet: "Boar's dead, then. Good. I was running out of things to throw.",
    part: "Mind the ladder. It sticks.",
    talks: [
      {
        id: "first",
        lines: [
          "Two guns on that tower. The goblins found my powder, and turned them on the wall.",
          "The boar was the garrison's. The smiths shod him in iron for the parade.",
          "Then the goblins took him, and their chief rode him over the wall.",
        ],
      },
      { id: "ladder", lines: ["There's a ladder down the south face to the Burg's square.", "Kick it loose. Their fire is right under it, if you need one."] },
      { id: "died", when: "died", lines: ["You came back. They don't, usually.", "The wall remembers everyone who crossed it. It just doesn't care."] },
      { id: "kicked", when: "ladderDown", lines: ["You found it. The square's closer than it looks."] },
    ],
  },
  {
    // Ferrow's last one, who went east: laid on the Grey Road short of the Gate, and never named.
    id: "last",
    name: "The Last One",
    area: "barrowmoor",
    at: { col: 113, row: 37 },
    kind: "warrior",
    greet: "",
    part: "",
    talks: [],
    later: [{ when: [], area: "barrowmoor", at: { col: 113, row: 37 }, dead: true }],
  },
  {
    // The Landing's castaway, washed in before the wanderer on a broken leg: the sack and the map are learned from him.
    id: "hollis",
    name: "Hollis the Castaway",
    short: "Hollis",
    area: "landing",
    at: { col: 43, row: 11 },
    kind: "pawn",
    // Silent until spoken to.
    greet: "",
    part: "",
    talks: [
      {
        id: "first",
        throws: "Hollis's Gaff",
        lines: [
          "...Hm? Another one off the tide. And walking, no less.",
          "Not gone Grey yet, are you? Good. There's few enough of those left.",
          "I'm Hollis. Fished these waters, once. Now I just keep this fire.",
          "The rocks took my leg when I washed in. I'll not be leaving this cave.",
          "You, though... You'll be going on. They always do.",
          "Here, take this. My old gaff. Better in a living hand than rusting by mine.",
          "Only a loan, mind. Keep it in your sack, and keep it sharp.",
        ],
      },
      {
        id: "sack",
        lines: [
          "Still here? Hm. You found my gaff, then.",
          "Look through that sack of yours now and then. Every scrap in it tells you what it's good for.",
          "Little enough, most of it. But out there, little enough can be the difference.",
        ],
      },
      {
        id: "map",
        lines: [
          "These fires... Rest by one, and it remembers you.",
          "Sit by any of them, and you can go back to another you've lit. Don't ask me how.",
          "Only the two in this cave. Mine, and the one you woke by. Heh...",
        ],
      },
      {
        id: "way",
        lines: [
          "If you mean to leave, it's south. Through the flooded cave.",
          "Goblins in there. One slings stones from over the water. Don't give him a still mark.",
          "Past that, a ring. A bull lives in it. And behind the bull, a boat.",
          "...The sea will want my gaff back, when you cross. It takes back what it lends. Always has.",
        ],
      },
      { id: "still", lines: ["You again? I've nothing left to tell you.", "Go on. The bull won't come to you... Heh heh..."] },
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
