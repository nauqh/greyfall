// The folk who talk, after Dark Souls: the wanderer never speaks; each talk plays the next conversation in a few short
// pages, the last one repeats, and something done out in the world turns up as a new thing to say. Every line keeps to
// docs/world/reach.md "How we tell it" (its Voices too) and "Who knows what", and is copied into its land's questline.md.

import type { AreaId } from "./atlas.ts";
import type { ItemName, Stock } from "./hero.ts";
import type { Cell } from "./island.ts";

/** What the world remembers that folk remark on, and that moves them on. */
export type WorldFlag =
  | "died"
  // Felled by the troll in the Ring and washed up at the Harbour fire: it waits there still.
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
  | "drawnPlankDown"
  | "hoistOpen"
  | "bambooDead"
  | "shellDead"
  // Set by a talk, not by the world.
  | "tobinDown"
  | "tobinDeeper"
  | "ysoldeDeeper"
  | "anselRoused"
  | "anselAhead"
  | "watchmanOut"
  | "pennyFollows"
  | "wageOwed"
  | "ledgerSaved";

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
  /** Heard to the end the first time, they walk the wanderer to the area's cold bonfire and have them light it. */
  lights?: boolean;
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
  /** A gnome or a goblin (`torch`) is drawn as itself, in no colour. */
  kind: "pawn" | "lancer" | "archer" | "monk" | "warrior" | "gnome" | "torch";
  act?: string;
  /** Blue, Highward's, unless they are from elsewhere. */
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
    lines: ["Ahh, you. The Barrow King is dead, and the barrows are only barrows now.", "My forty went in after his key and never came out, so I'm digging them out myself, one at a time. As is proper."],
  },
  { id: "count", lines: ["Twenty-two. Dace still had his pipe on him.", "Holm had nothing. ...Holm always had nothing. Good lad, Holm."] },
];
const corwinDone: Talk = {
  id: "done",
  when: "warlordDead",
  lines: ["So the Warlord's down. My hands stopped aching this morning, and I knew before anyone told me.", "The cold's let go a little. Tell them at the Keep to leave the gate bare for me. I've forty names to carve, and slow hands.", "Forty, and one Tidewashed. I'll leave you a space at the bottom, name or no name."],
};
const wrenPenny: Talk = {
  id: "penny",
  when: "greyfallReached",
  lines: [
    "Penny's gone from behind the butts. She used to sit there and count crows.",
    "If you happen upon her, tell her I've kept her barrel for her. Don't tell her I've been sitting on it.",
  ],
};

export const NPCS: readonly Npc[] = [
  {
    id: "ferrow",
    name: "Old Ferrow",
    area: "harbour",
    at: { col: 51, row: 56 },
    kind: "pawn",
    greet: "Ahh. Another one.",
    part: "Mind the dark, then.",
    talks: [
      {
        id: "first",
        lines: [
          "Ahh... Another one the tide spat out. Tidewashed, they call your sort.",
          "I am Ferrow, of Lanternport. I keep its fire. Someone has to, don't they?",
          "The last one sat on that stone where you're standing, warmed his hands at my fire, and went east in the morning.",
          "He never came back, and nor did the one before him. They always go east. Hah...",
          "Ahh, and it's gone cold on me again while I dozed. Put your hand to it, would you? Mine are too old to coax it.",
        ],
        lights: true,
      },
      {
        id: "shore",
        lines: [
          "A road, is it? Follow the lanterns. They run straight up from the fire, to the Burg Gate on the crown.",
          "Somebody lit them before you came up out of the cave. Somebody always does, and I've never once caught them at it.",
          "There's a path up through the graves to the Moor Gate as well, but the watchman keeps it barred from this side.",
          "Not that the dogs on that hill have much respect for bars. Hah...",
        ],
      },
      {
        id: "bull",
        when: "bullWon",
        lines: [
          "Ahh, so the tide's brought you back to me. It was the troll in the Ring, I'd wager.",
          "There's no shame in it. He's sat in that ring a long while and he'll sit a while longer. Take the boat back when your arm is stronger.",
          "Whatever he's sitting on must be worth a fall or two. Hm.",
        ],
      },
      {
        id: "goal",
        lines: [
          "You'll be wanting the Grey Gate, east past the moor. Everyone does, in the end.",
          "Two locks it has, and two keys. Kingsrest buried one under its barrows with its king, and he's not known for giving things back.",
          "The other key we threw down our own Old Well, so nobody would fetch it. It caught in the Weaver's web, they say, further down than anyone knew the well went.",
        ],
      },
      {
        id: "castle",
        lines: [
          "The Keep? It's been shut since the Burg went grey. Its steward barred it behind him and fled for the wood with the Ember Key on his belt.",
          "A bull had him for supper, or so they say, and still has the key, I'd wager. Bulls were never much for locks.",
        ],
      },
      {
        id: "well",
        lines: ["The Old Well only goes one way, Tidewashed. Down.", "And don't drink what's at the bottom. Water that cold has the Grey in it. Mark me."],
      },
      {
        id: "roads",
        lines: ["Every road out of here comes back to this fire, the gates and the well and the lift alike.", "Some folk find that a comfort. I've kept this fire longer than you've been alive, and I've never been sure."],
      },
      { id: "rest", lines: ["Rest, if you must. The roads are patient. Patient as stones."] },
      {
        id: "died",
        when: "died",
        lines: ["Back so soon? Oh, don't look at me like that.", "Whatever put you down, this fire had you back by morning. It's done it before, and I've stopped asking how. Hah..."],
      },
      {
        id: "key",
        when: "trollKey",
        lines: ["Ahh, that key's warm. Bull's blood, or the fire inside the brute.", "Either way, keep it well clear of my kindling."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["So the Warlord's dead, they're saying. Hm.", "The wind off the moor came in warmer this morning. Not warm, mind you, only less cold. I'll keep the fire going all the same, from habit."],
      },
      {
        id: "ansel",
        when: "anselRoused",
        lines: ["Ansel's come down off his wall. I can see the gap on the ramparts from here, the first in years.", "They come back from the east or they don't, and the wall will keep either way."],
      },
      { id: "east", when: "greyfallReached", lines: ["You went east, and you came back on your own two feet.", "That's one more than the last one managed, and the one before him. Hah..."] },
      {
        id: "gone",
        when: "anselAhead",
        lines: ["Ansel's not come back down the moor road. Nor will he, I'd wager.", "They go east. ...They always go east."],
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
      stock: [{ item: "Brenna's Edge" }, { item: "Keener Edge", after: "stoneWarden" }, { item: "Grey-Iron Edge", after: "minotaur" }, { item: "Banded Shield" }, { item: "Ansel's Edge", flag: "anselAhead" }, { item: "Digger's Torch", flag: "warlordDead" }],
      poor: "Gold first, love. Then sparks.",
      sold: "That's done. I don't make the same thing twice, I'm a smith, not a mill.",
    },
    greet: "Mind the sparks, love.",
    part: "Come back with gold, y' hear?",
    talks: [
      {
        id: "first",
        lines: [
          "Ahh, a newcomer. Don't stand so close. Sparks don't care whose eyes they find.",
          "I'm Brenna. Smith to the Ward, for what's left of it.",
          "Off into all that grey, are y'? Then you'll want a proper edge. Bring me gold, and I'll do the smithing.",
          "There's a banded shield on the wall, too. Oak and iron. Takes the blow so y' arm doesn't.",
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
    greet: "Halt. You're not one of mine.",
    part: "Dismissed.",
    talks: [
      {
        id: "first",
        lines: [
          "You're not one of mine. No, mine are all gone, and I'd know their walk anywhere.",
          "I am Corwin, Sergeant of the Keep. I took forty spears onto the moor once. Forty.",
          "Now I drill boys with broom handles and call it a garrison. A sorry business.",
          "Want a lance at your side? Pay, and I'll find you one who still stands.",
        ],
      },
      { id: "drill", lines: ["Point forward. Feet back.", "If they're charging you, you've already done it wrong. Remember that, and you might live."] },
      {
        id: "died",
        when: "died",
        lines: ["You fell. Don't tell me where.", "Bring back the lances I lend you still breathing. I've names enough to carve as it is."],
      },
      {
        id: "warlord",
        when: "warlordDead",
        lines: ["The Warlord's down, then. Forty spears, and not one of them here to see it.", "I'll carve their names into the Keep gate, every one. Leave me to it, soldier."],
      },
      {
        id: "post",
        when: "watchmanOut",
        lines: ["The watchman on the Moor Gate's left his post. Good.", "He'll tell you he barred it on my orders. I never gave him any. ...Fear gave them."],
      },
      { id: "ansel", when: "anselRoused", lines: ["Ansel's got his sword out. Took him long enough.", "I lost forty men and stopped telling anyone to go out there. Don't tell him I'm glad."] },
    ],
    later: [
      {
        when: ["hornedKey"],
        area: "barrowmoor",
        at: { col: 29, row: 22 },
        talks: [...corwinDig, { id: "last", lines: ["Thirty-nine, and I've turned every barrow on the field for the fortieth.", "Maybe the fortieth was me. By rights I ought to be down there with them."] }, corwinDone],
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
              "Forty. I found him this morning, lying among the others as if he'd never left them.",
              "He ran, the night the King came up. I let him go. I'd have run too, had I been quicker.",
              "This was rolled up beneath him. The Forty's banner. Take it.",
              "It never did come home with us. Carry it further than we got.",
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
    greet: "Oh, you walk loud.",
    part: "Keep your head down!",
    talks: [
      {
        id: "first",
        lines: [
          "You walk loud, you know. Oh, that's fine. An archer likes a loud friend up front.",
          "I'm Wren, of the butts. I keep the targets, and the bows.",
          "Put gold on the barrel, and I'll send you someone who doesn't miss. ...Much. What do you say?",
        ],
      },
      {
        id: "goblins",
        lines: ["The goblins camp behind the Northwood, and they always go about in threes. Joyous little bunch.", "Shoot the one with the torch first. Spears are slow, and torches are rude."],
      },
      { id: "back", lines: ["Keep five paces back from whatever you're shooting, always.", "If you can smell it, you're too close. If it can smell you, you're dead."] },
      { id: "wings", when: "died", lines: ["Tobin sent you for a bow, didn't he? Wings, was it?", "Steel goes up, and steel comes down. Only arrows keep going."] },
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
              "Ha! Oh, it's you. The bull's dead! The goblins don't know which way to run.",
              "And the dogs come down off Smoke Bluff one at a time to see what's changed. Best shooting I've had in years.",
              "Don't tell Lanternport, will you? They'll want me back being useful.",
            ],
          },
          { id: "torches", lines: ["Torches first. Always torches first. Didn't I tell you?"] },
          wrenPenny,
        ],
      },
    ],
  },
  {
    id: "dunn",
    name: "Dunn of the Gate Watch",
    short: "Dunn",
    area: "harbour",
    at: { col: 30, row: 44 },
    kind: "lancer",
    greet: "Halt. ...Oh. You.",
    part: "As you were.",
    talks: [
      {
        id: "first",
        lines: [
          "Halt. ...You're no goblin. More's the pity. I'd know what to do with a goblin.",
          "I am Dunn, of the Gate Watch, or what's left of it. I keep the woodcutters alive, mostly.",
          "The Ember Gate stays barred. Orders.",
        ],
      },
      {
        id: "orders",
        lines: ["Whose orders? Mine. I barred it that night, with the goblins at the fence.", "There was knocking on it after, a long while, and I stood on this side and didn't open."],
      },
      { id: "barred", lines: ["Barred. Orders. Don't ask me again."] },
    ],
    later: [
      {
        when: ["emberGateOpen"],
        area: "emberwood",
        at: { col: 44, row: 68 },
        talks: [
          {
            id: "watch",
            lines: ["The gate's open, and I'm stood on the wrong side of it. Hah. Orders.", "The woodcutters are back at their trunks, and I watch the trees for them. The goblins still come in threes, same as ever."],
          },
          {
            id: "steward",
            lines: [
              "I found a note pinned up in the woodcutters' old camp. \"They barred it with us still outside.\"",
              "Fine, careful letters, the kind they teach up at the Keep. That was the steward knocking at my gate that night, with the Keep's key on his belt.",
              "Had I opened, that key would be hanging in the Keep now, not lying somewhere up the Ash Road.",
              "...Go on, then. Say it.",
            ],
          },
          { id: "trees", lines: ["Watch the trees. The goblins sleep up in them, and they'll be watching you."] },
          {
            id: "bull",
            when: "trollKey",
            lines: [
              "The key was on the bull? The goblins' bull?",
              "So the steward got past my gate, and the goblins, and the heat. And their beast had him at the end of it.",
              "And I barred the gate on him. Hm. A fine watchman I make.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fenn",
    name: "Brother Fenn",
    short: "Fenn",
    area: "emberwood",
    at: { col: 23, row: 64 },
    kind: "monk",
    color: "purple",
    greet: "Softly. The pines listen.",
    part: "Go softly, Tidewashed.",
    talks: [
      {
        id: "first",
        lines: [
          "Softly, softly. You'll wake the bears. ...Or they'll wake you.",
          "I am Fenn, of the Order once, and of these pines now. The pines ask less of me.",
          "The goblins burn everything but here. They will not come under these trees. I have never asked why.",
        ],
      },
      {
        id: "plank",
        lines: [
          "The goblins drew their plank up off the tree walk. Stand on the bluff all you like, it will not come down.",
          "Go round. North over the stones, behind their hill. Then drop it from their side.",
        ],
      },
      {
        id: "bridge",
        lines: [
          "There is a bridge under the rock to the east, by the gnomes' hut. It goes round the goblins' camp to the ford.",
          "There is a fire at the ford, the last warm thing before the bull. Go softly, Tidewashed.",
        ],
      },
      { id: "thicket", lines: ["The bears keep something in the thicket behind them. Gold, by the shine.", "Bears do not spend it. ...Nor do I."] },
      {
        id: "hearth",
        lines: [
          "Put your hand to the ground, past the pines. Warm, is it not? The Order calls it the Hearth, the warmth under everything.",
          "Here it rises near the top. That is why the whole wood crowds in. ...Cold things know where warm is.",
        ],
      },
      { id: "pray", lines: ["I pray for the pines. Someone should.", "Go softly. May the Hearth keep you."] },
      {
        id: "cooling",
        when: "trollKey",
        lines: ["The bull is dead? Then the goblins will spill out of the hollow, seeking a new lord.", "Or a new fire. ...Pray it is not these pines."],
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
          "Oh, d-don't lean on that rope. It's older than me.",
          "That's the Old Well, in the hill there. Not for drawing water, mind.",
          "My brother went down it after a coin he'd d-dropped, and he never came up.",
          "It must have been a f-fine coin. He never went to that much trouble for anything else.",
        ],
      },
      { id: "rule", lines: ["No climbing back up. That's the rule of the well.", "Funny, a hole having rules. Funnier still that everyone keeps them."] },
      {
        id: "wings",
        lines: [
          "Something else lives down there, something with wings. You hear them b-beating before you see them.",
          "A sword's no use on a thing that won't come down to meet it.",
          "Wren hires out bows, at the butts by the west road. Take one, if you go. Please.",
        ],
      },
      {
        id: "chewed",
        when: "died",
        lines: ["Oh, you look ch-chewed on.", "If it had wings, your steel won't reach it. Wren's bows will."],
      },
      {
        id: "below",
        when: "wellDescended",
        sets: "tobinDown",
        lines: ["You came back? From d-down there?", "Did you see him down there? A thin fellow with quick hands, always smiling.", "No, course you didn't. Forget I asked."],
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
              "Oh, it's you. Don't look so surprised. There's no rule against going down, is there?",
              "Smugglers keep this corner, and one of them is wearing my brother's coat.",
              "He says he swapped for it, deeper in. Ha. My brother never swapped a thing in his life.",
            ],
          },
          {
            id: "deeper",
            sets: "tobinDeeper",
            lines: ["I'm going on, through the cisterns.", "Don't wait for me. Nobody ever has, and I'd not know what to do with it."],
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
              "I found him. He runs this camp, thin as ever, and smiling like he'd been expecting me.",
              "He says the coin was never dropped. He threw it, to see who'd come after.",
              "And I came after it, d-didn't I?",
            ],
          },
          {
            id: "stay",
            gives: "The Thrown Coin",
            lines: [
              "I'm staying. Someone has to count what he steals.",
              "Here. The coin. I found it at the bottom, the day I came down. He never once looked for it.",
              "Quick hands run in the family, turns out. Stay safe, you hear?",
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
      poor: "Ha! Come back heavier, friend. No hard feelings.",
      sold: "Gone. Things go, down here. Funny, that.",
    },
    greet: "Ha! Walk soft, friend.",
    part: "Mind your purse, friend. Ha ha!",
    talks: [
      {
        id: "first",
        lines: [
          "Well, well! Tobin's friend? Oh, no need for that face. Anyone who comes this deep is a friend of mine.",
          "Name's Jory. Jory the Smiling, if you like. And friends buy things, don't they? Ha ha!",
          "Don't mind the lads. They only take what isn't watched. Honest work, really.",
        ],
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
    greet: "Peace on thee, child.",
    part: "May the Hearth keep thee.",
    talks: [
      {
        id: "first",
        lines: [
          "Peace on thee, child. I am Ysolde, a Keeper of the Order, and mother to it here.",
          "My sisters went down to the Drowned Chapel. The warmth lay below us, they said, and they would kneel by it.",
          "I tend the fire up here, and tend to them in my prayers. Not one of them hath come back up.",
        ],
      },
      {
        id: "stair",
        sets: "sistersStair",
        lines: [
          "Beside the chapel there is a stair. The sisters climbed it to the Ward to pray, afore the Grey.",
          "I have no knees for it now. The bar lifteth from this side.",
          "Go up, if thou hast the stomach for what walks the cloister. May the Hearth keep thee.",
        ],
      },
      { id: "candle", lines: ["I light a candle each night.", "The hour comes round, and my hands are already there. 'Tis all that is left of prayer."] },
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
              "Thou'st found one of us, and living. She walketh with thee now, so I came down to see where she had been.",
              "I told her her name. She thanked me.",
              "She will have lost it again by the next fire. Tell it to her, some nights, as thou sittest.",
              "One is a mercy. I shall not ask the dark for more.",
            ],
          },
          {
            id: "lake",
            sets: "ysoldeDeeper",
            lines: [
              "She speaketh in her sleep, of water under all of this, warm as a banked hearth, and gold shining in the rock.",
              "The others went on down to it, and I must go after them.",
              "Follow me not. Or do, as thou wilt. I am too old to forbid things.",
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
              "Look, child. The water is warm down here. Warm, at last.",
              "I see them at the bottom, child, all my sisters on their knees, praying still.",
              "...No. Pull me not back. I have only just found them.",
            ],
          },
          {
            id: "kneel",
            gives: "Hollow Water",
            lines: [
              "I have stopped lighting candles.",
              "There is warmth enough down here. More than enough.",
              "Here, child, drink. 'Tis warm as a hearthstone, and the old man by the fire above hath never been down to taste it.",
            ],
          },
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
              "The thing they knelt to is dead, child, and nothing woke. It was a beast, and my sisters are only bones now.",
              "I can leave bones, child. I could not leave them kneeling.",
              "Take this. I have stopped lighting it. Light it for the ones thou losest. May the Hearth keep thee.",
            ],
          },
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
        lines: [
          "Ahh, who's there? Is it night up above? It's always night down here.",
          "We sisters came down to kneel where the stones were warm. Then the cold came in under the door and nibbled at us, and now I can't remember the others' faces.",
        ],
      },
      {
        id: "warm",
        sets: "monkFreed",
        lines: [
          "Please, hold out your hand and let me touch it. Ahh. Your sleeve smells of woodsmoke. Someone up there still keeps a fire.",
          "Then I am not entirely alone, just yet.",
          "I'll walk with you, if you'll have me. I've forgotten the way up, but you came down it, so you must know.",
        ],
      },
    ],
    later: [{ when: ["monkFreed"] }],
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
          "Whatever's on the moor stays on the moor. That's the whole of my duty, and I'm good at it.",
          "Want it open? Then go round, and lift the bar from the far side yourself. If you've the stones for it.",
        ],
      },
      { id: "barrows", lines: ["There are lights out on the barrows, some nights, moving about.", "I don't look. Looking is how it starts."] },
      {
        id: "open",
        when: "moorGateOpen",
        sets: "watchmanOut",
        lines: ["You came through the barrows, on foot, and lifted my bar from the far side.", "Well. I'll stop barring it, then. You've made my post pointless.", "Thank you. ...I think."],
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
            lines: ["Ahh, you. Thought I'd see the lights for myself, since the gate's open anyway.", "They're lanterns, and nobody's holding them, and they swing all the same."],
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
          "Shh! Don't tell the grey men I'm here.",
          "They took my mum, and the whole east lane with her, off to Greyfall where the cold comes from.",
          "They keep them in a yard, with ropes. I squeezed out under the gate. I'm small. It's useful.",
        ],
      },
      {
        id: "crows",
        sets: "pennyFollows",
        lines: [
          "I count the crows. When there's more of them, they're bringing more people.",
          "Wren says you walk loud. You do.",
          "I could follow you anywhere, you know. Nobody'd ever hear me.",
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
          { id: "mum", lines: ["Mum came home! On her own feet!", "She says the grey ones just stopped. Stood like posts. She walked out between them. She says it twice."] },
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
            lines: ["They stopped! All the grey ones, they just stopped!", "Mum says thank you. She says it twice. She's like that."],
          },
          { id: "home", gives: "Mum's Bread", lines: ["We're walking home. Mum says slowly.", "She's had enough of being hurried by ropes."] },
        ],
      },
    ],
  },
  {
    id: "tally",
    name: "Tally",
    area: "greyfall",
    at: { col: 39, row: 52 },
    kind: "torch",
    greet: "Not one step down. Not one.",
    part: "Count's not done!",
    talks: [
      {
        id: "first",
        lines: [
          "Not one step down. Not for you, not for nobody.",
          "Tally, me. I dug here. Forty seasons, coal and fire for pay.",
          "The last season, the Citadel never paid us. I came back up for it. Tally always comes back.",
        ],
      },
      {
        id: "wage",
        sets: "wageOwed",
        lines: [
          "Three hundred and twelve loads I hauled up that last season, a scuttle of coal owed for each, and fire for the long shifts.",
          "It's all written down. The paymaster wrote everything in his books, up in the Counting House.",
          "Get me that page and I'll know I'm not mad. Then I'll go home. Tally promises.",
        ],
      },
      {
        id: "lip",
        lines: [
          "Men say we goblins dug that hole. We did, every shovel of it. Men ask why. Go ask who paid.",
          "Not one step down. Count's not done.",
        ],
      },
    ],
    // Paid only if Quill gives up the ledger before the Warlord falls; after, it is ash, and Brenna sells his torch.
    later: [
      { when: ["warlordDead"] },
      {
        when: ["ledgerSaved"],
        area: "greyfall",
        at: { col: 39, row: 52 },
        talks: [
          {
            id: "ledger",
            gives: "Digger's Torch",
            lines: [
              "That's my mark. Three hundred and twelve. Hah! Hah! Tally's not mad.",
              "And look how deep. They wrote it down. They wrote down how deep.",
              "Here, take the torch. I'm paid. I don't need to see down there any more.",
            ],
          },
          { id: "paid", lines: ["Paid. Late. Paid."] },
        ],
      },
    ],
  },
  {
    id: "quill",
    name: "Master Quill",
    short: "Quill",
    area: "greyfall",
    at: { col: 65, row: 18 },
    kind: "pawn",
    color: "black",
    greet: "Close the door. The draught.",
    part: "The door, please.",
    talks: [
      {
        id: "first",
        lines: [
          "Close the door. Every draught costs me a page.",
          "Well, this is unexpected. I don't often have visitors. I am Quill, Paymaster to the Citadel.",
          "I kept the accounts, and now the accounts keep me. Coal and fire, the goblins were paid in. I pay myself the same way.",
        ],
      },
      {
        id: "stove",
        lines: [
          "I have forty years of ledgers and one small stove, and the arithmetic of that is not in my favour.",
          "I started burning with the oldest year. Fair's fair. One must keep some kind of order.",
        ],
      },
      {
        id: "cold",
        lines: [
          "The taken come to my window some nights, drawn to the stove's light.",
          "They don't knock. They used to queue for their pay just like that. How very orderly.",
        ],
      },
      {
        id: "ledger",
        when: "wageOwed",
        sets: "ledgerSaved",
        lines: [
          "A goblin wants his page, after all this? Then he wants the last season, and that one I kept back.",
          "It is the season of the Deep Cut. I could not bring myself to burn that one. Nor to read it.",
          "Take it to him. He was owed. They were all owed. Every account has its consequence, it seems.",
        ],
      },
    ],
    later: [
      {
        when: ["warlordDead"],
        area: "greyfall",
        at: { col: 65, row: 18 },
        talks: [
          {
            id: "thaw",
            lines: [
              "Oh, you're back, then. The stove's gone out, and my ink hasn't frozen in the pot. First time in years.",
              "The last ledger went in on the coldest night. I'm sorry for that one.",
              "All that's left of the Cut's accounts is what the goblins remember, and the hole itself. Hmph. Some paymaster I was.",
            ],
          },
          {
            id: "bell",
            gives: "Stilled Bell",
            lines: [
              "One of the Stilled left this on my sill, the night before the thaw. A bell, for ringing the warm ones quiet.",
              "I have no use for quiet now. My ink is thawing. Take it, and close the door behind you.",
            ],
          },
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
          "That's Sunhold. Gold walls and gold roofs, up where the Grey can't reach, and not a soul in it has ever bled for any of it.",
          "When the Grey came it shut its gates, and it never sent down one spear, or so much as a prayer.",
          "I'm Ansel. Ansel of the Wall, they call me now. I was Ansel of something else once, but it doesn't matter now.",
        ],
      },
      {
        id: "lift",
        lines: ["The Watch Lift only comes down. Sunhold built it so, and Sunhold decides who goes up.", "So far they've decided on nobody. Joyous bunch, really."],
      },
      {
        id: "blue",
        lines: ["I wore that blue once. Had a band, a banner. The fire knew my name.", "Then one morning I didn't go out, and the next morning it was easier. You'd be surprised how easy it gets."],
      },
      { id: "watch", lines: ["Still here, still watching the sky city. Someone ought to.", "Go on. I'll keep watch. It's all I'm good for."] },
      {
        id: "lifted",
        when: "watchLiftOpen",
        lines: ["So you went up. Were they kind?", "No, don't tell me. The sky city never is."],
      },
      {
        id: "roused",
        when: "trollKey",
        sets: "anselRoused",
        lines: [
          "You killed the bull, with that? The Ember Key's on your belt, so you must have.",
          "I had a sword once. It's under my bed, I think, if the rust hasn't had it.",
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
              "Don't look at me like that. I said I'd come out, didn't I?",
              "I'd forgotten the smell of the Grey. Cold ash and old iron.",
              "Talk to me again and I'll go on up. So don't. Not unless you mean it.",
            ],
          },
          {
            id: "ahead",
            sets: "anselAhead",
            lines: [
              "The Warlord's Hall is up past the High City. I'll go first, this time.",
              "I've decided to stop running from it. Let me have this one. You've had every other fight on the road here.",
            ],
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
            lines: ["You went up without me. Good.", "I'd only have been in the way. ...I'd only have been brave. What a bloody joke."],
          },
          {
            id: "wall",
            gives: "Ansel's Edge",
            lines: [
              "Back on the wall, you see. It's a good wall, and it's never once asked me to be brave.",
              "Brenna was holding an edge I paid for. Here, it's yours. You can make better use of it.",
              "If she asks, tell her I sent you. She'll want it in writing. Hah...",
            ],
          },
        ],
      },
      { when: ["anselAhead"], area: "greyfall", at: { col: 95, row: 27 }, dead: true },
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
    // Everything that is not a blade; the deeper fire only once the bull that lay on it is gone, the ship's lantern once the Warlord is.
    shop: {
      stock: [{ item: "Ember Shard" }, { item: "Smoked Haunch" }, { item: "Pine Resin" }, { item: "Prospector's Purse" }, { item: "Kindled Shard", after: "minotaur" }, { item: "Salt-Glass Lantern", flag: "warlordDead" }],
      poor: "Hehe. Thy purse is light, dearie. Come back richer.",
      sold: "That was the only one, dearie. Kee hee.",
    },
    greet: "Hehe. A live one.",
    part: "Come back with coin, dearie. As is thy wont, no?",
    talks: [
      {
        id: "first",
        lines: [
          "Hehe. A live one! Oh, don't mind old Mags, dearie. I'm but a humble peddler.",
          "The Grey took the Burg. Not my trade, though. Nor am I so charitable as to give my wares away. Hehe.",
          "A shard of the old fire, a haunch, a pot of resin, a purse that sews itself fatter. Little things, to ease a weary traveller.",
          "One of each, mind. Keep them in thy sack, where thy hands can find them.",
          "Kill whatever sits in Emberwood, and I'll find thee a warmer shard. Hehe.",
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
          "Living? Oh, thank the fire. Sit a while, then. I am Hale, of the Watch, and the last of it.",
          "You came over the creek? Then you've met the bridges' keepers.",
          "I held this square with six men. Then the bell stopped, and one by one the colour went out of them.",
          "The Rampart Gate's up the street. Or through the graves on the hill, if you'd sooner the dead than the dying.",
        ],
      },
      { id: "ladder", lines: ["There was a ladder down to here from the Ramparts, by the fire.", "Someone pulled it up from above, and I'd like a word with whoever it was."] },
      {
        id: "keep",
        when: "trollKey",
        lines: ["Is that the Ember Key on your belt?", "The Keep Gate's off the west alley. Corwin's lancers are behind it, if any are left. Mind the bridges."],
      },
      { id: "rest", lines: ["Sit. The fire's the one thing in the Burg that's still ours.", "I am well pleased to see you safe."] },
    ],
  },
  {
    // The Landing's castaway, a knight of Lanternport washed in before the wanderer on a broken leg: drawn as a lancer,
    // the fishers' gaff for his lance. The sack and the map are learned from him.
    id: "hollis",
    name: "Hollis the Castaway",
    short: "Hollis",
    area: "landing",
    at: { col: 43, row: 11 },
    kind: "lancer",
    // Silent until spoken to.
    greet: "",
    part: "",
    talks: [
      {
        id: "first",
        throws: "Hollis's Gaff",
        lines: [
          "...Oh. Another one off the tide, and up on your own two feet, which is more than the tide left me.",
          "You've your colour yet, and there's still someone home behind your eyes. Thank goodness. I'd begun to think the Grey had all of us but me.",
          "I am Hollis, a knight of Lanternport's watch, once. How I came into the water I don't ask. I'll not ask it of you, either.",
          "The rocks broke my leg when I washed in, and it set wrong. It will not carry me past this fire, so I keep the fire, and it keeps me.",
          "Put your own hand to it before you go on. A fire you've lit knows you, and it's by that fire you'll wake when the cave has the better of you.",
          "You, though, you'll be going on, Tidewashed. The ones who wake here always do, and I've stopped trying to talk them out of it.",
          "Here, take my gaff. The fishers left it in the cave when they gave up their boat, and it's served me for a sword since mine went down.",
          "Only a loan, mind. Keep it in your sack and its hook sharp, and don't grow fond of it. The sea takes back what it lends.",
        ],
      },
      {
        id: "sack",
        lines: [
          "Still here? Then you've found my gaff in your sack, and the rest of what you carry with it.",
          "Turn that sack out now and then and look at what's in it. Every scrap you pick up says plainly what it's good for, if you'll read it.",
          "Most of it is little enough, a crust or a stone. But out past the Ring, a crust at the right hour has kept better men than me on their feet.",
        ],
      },
      {
        id: "map",
        lines: [
          "You'll have noticed the fires. Rest by one, and it knows you after, the way a dog knows the hand that fed it.",
          "Sit by any fire you've lit and you can go to any other you've lit before. How, I couldn't tell you. The Order will have a word for it.",
          "In this cave there's only the one, mine. Light the others as you find them, and come back to sit a while. I'll not have gone anywhere.",
        ],
      },
      {
        id: "way",
        lines: [
          "If you mean to leave, the way is south, through the flooded cave where the sea comes in over the floor.",
          "There are goblins in there, and one sits across the water slinging stones. Keep moving and he misses. Stand still and he won't.",
          "Past them is a round cavern they call the Bull's Ring, and a troll sits in it where the water comes up warmest. Behind him is the boat.",
          "When you cross, the sea will take my gaff back. It takes back what it lends, it always has. Don't mourn it.",
        ],
      },
      { id: "still", lines: ["You again? I've told you all I know, and a good deal of what I only guess.", "Go on, then. The troll won't come to you, and I'd not keep him waiting... Heh."] },
    ],
  },
  {
    id: "nim",
    name: "Nim the Tinker",
    short: "Nim",
    area: "crags",
    at: { col: 47, row: 63 },
    kind: "gnome",
    shop: {
      stock: [{ item: "Gnome Powder" }, { item: "Tinker's Buckler" }],
      poor: "Gold first. Fuses after.",
      sold: "One of each. Gnome work takes a winter.",
    },
    greet: "Mind the fuses.",
    part: "Tick, tick. Off you go.",
    talks: [
      {
        id: "first",
        lines: [
          "Mind the fuses. No, that one. ...Fine. All of them.",
          "Nim, tinker. Powder, springs, brass. Gnome work. Finest in Aurum, and the only.",
          "Gnome work costs gold, at the old rate. The gnome-kings set it themselves, before they went up the lift with all of it.",
        ],
      },
    ],
  },
  {
    id: "moss",
    name: "Moss, the Lift-Keeper's Wife",
    short: "Moss",
    area: "crags",
    at: { col: 61, row: 58 },
    kind: "gnome",
    greet: "Wick? ...No.",
    part: "If you see him...",
    talks: [
      {
        id: "first",
        lines: [
          "Wick? ...No. You're too tall.",
          "Moss. My Wick kept the lift, up on the wheel step. Old Bamboo walked the wheel for him.",
          "Then one morning the wheel stopped turning, and Old Bamboo never came down off it.",
          "Nor did Wick. Have you seen him up there? A small fellow, with brass buttons all down his coat.",
        ],
      },
      {
        id: "hoist",
        lines: [
          "The Hoist was how we came home of an evening, in a basket straight down the face of the rock.",
          "It's been barred from the top since the gnolls came over the bridge. If you happen up there, lift the bar for me.",
          "Then I'll know the way down is open, if Wick should want it. Please, I beg of you.",
        ],
      },
      {
        id: "wait",
        lines: [
          "I sit here at the Hoist's foot, because it's where he'd come down.",
          "Wick is a careful gnome. He checks every rope twice, and he'd not leave me sitting here without a word. No. What a horrible thought.",
        ],
      },
      {
        id: "hoisted",
        when: "hoistOpen",
        lines: ["You lifted the bar. I heard it go, all the way down here.", "...Only you came down it, though."],
      },
    ],
    later: [
      {
        when: ["bambooDead"],
        area: "crags",
        at: { col: 74, row: 17 },
        talks: [
          {
            id: "coat",
            lines: [
              "Wick's coat was on the wheel, brass buttons and all, and no Wick in it. He'd never have let Old Bamboo walk alone.",
              "Someone has to keep the lift, and I watched him do it twenty winters. I'll keep it till he comes back for his coat.",
            ],
          },
          {
            id: "cog",
            gives: "Wheel Cog",
            lines: [
              "This was in his coat pocket, a cog off the wheel. Old Bamboo's feet wore it bright.",
              "Wick always kept a spare. Take it. The lift turns on the new one now.",
            ],
          },
          { id: "up", lines: ["Step in, if you're going up.", "The kings won't thank you. They never thanked him."] },
        ],
      },
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
