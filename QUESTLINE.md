# The folk's questline

For checking. Generated from `packages/engine/src/npcs.ts`, so the lines and places here are the ones in the game.

## How it works

After Dark Souls: no quest log, no choices, the captain never speaks.

- **Talks.** Each talk to someone plays their next conversation, a few short pages; once all are heard the last one repeats. A remark marked "once ... when" plays one time, after the first talk at that spot, once that has happened.
- **Moving on.** Where someone stands depends on world flags. Each NPC has a home in the Harbour and a list of later stations; the last station whose flags have all happened wins. A station with no place means they are gone for good; a dead one lies there and says nothing.
- **Flags from talks.** Some talks set a flag when heard to the end: that is what moves a questline on.
- **When they move.** Placement is worked out on entering an area, so someone moves between your visits, never in front of you.

## What sets each flag

| Flag | Set by |
| --- | --- |
| died | dying (works now) |
| bullWon | falling to the Shore Minotaur, which washes the captain up on Lantern Point |
| wellDescended | arriving in the Undercroft (works now) |
| moorGateOpen | coming into the Harbour through the Moor Gate (works now) |
| watchLiftOpen | riding the Watch Lift down into the Harbour (works now) |
| greyfallReached | arriving in the Greyfall (works now) |
| trollKey | killing the Cinder Troll (not built yet) |
| hornedKey | killing the Barrow King (not built yet) |
| warlordDead | killing the Grey Warlord (not built yet) |
| monkFreed | freeing the Monk in the Drowned Chapel (not built yet) |
| tobinDown, tobinDeeper, ysoldeDeeper, anselRoused, anselAhead, watchmanOut, marenSails | hearing a talk to its end (marked below) |

## At a glance

| Who | Moved on by | Turns up | Ends |
| --- | --- | --- | --- |
| Tobin | his remark on the well, then a talk | Undercroft, Smugglers' Nook; then the Deeps, Robbers' Camp | Stays with his brother, the thieves' captain. Never talked to, never leaves |
| Mother Ysolde | the monk freed, then a talk | Undercroft, the Drowned Chapel; then the Hollow, Pilgrims' Rest | Kneels over her drowned sisters and will not come back |
| Ansel of the Wall | his remark on the Troll Key | The Greyfall, the Ashen Approach | Hear him out twice and he goes ahead and dies in the High City, below the Warlord's Hall; kill the Warlord first and he is back on the wall |
| Penny | reaching the Greyfall | The Greyfall, Gallows Yard, penned with her mum | Freed when the Warlord falls |
| Sergeant Corwin | the Barrow King dead | Barrowmoor, Barrow Field, digging out his forty | Stays with them |
| The Moor Watchman | his remark on the open Moor Gate | Barrowmoor, Gibbet Hill, watching the lights | Gone into the barrows once the King is dead |
| Maren | her remark on the Warlord dead | | Sails on the first ship in three winters; missed if not talked to |
| Wren | the Troll Key | Emberwood, Old Pines | Stays, shooting |
| Old Ferrow, Brenna | | | Stay; both remark on Ansel leaving |

## Old Ferrow

Greets you: *"Ah. Another one."* Walked away from: *"Mind the dark, then."*

### Home: Last Harbour, Lantern Point, by the lighthouse fire (96, 73)

- **first**
  1. Another captain. Hm.
  2. The last one sat right where you're standing. Warmed his hands, same as you.
  3. Go on, then. The fire doesn't ask who you were. Nor do I.
- **shore**
  1. Follow the lanterns, captain. West along the shore, through the town, up to the Ember Gate. Someone lit them for you.
  2. The path up the hill goes through the graves to the Moor Gate. Shut from this side, and the dogs up there don't care that it's shut.
- **bull** (once, after meeting, when **bullWon**)
  1. Washed up with the tide, did you? The bull did that.
  2. He'll keep. Go back down the pier when your arm's stronger. What he guards is worth a fall or two.
- **goal**
  1. You'll be wanting the Grey Gate. East, past the moor. They all do.
  2. Two keys open it. The king under the barrows keeps one.
  3. The other's down below, where the spider weaves. Down the well, and further down.
- **castle**
  1. The castle? Shut since the grey came. The steward ran for the wood with its key.
  2. Troll had him for supper, they say. Has the key still, I'd think.
- **well**
  1. The well only goes one way. Down, to the drowned.
  2. Not yet, captain. Not that way. Not yet.
- **roads**
  1. Every road out of here comes back to this fire. The gates, the well, the lift.
  2. Folk think that's a comfort. I've never been sure.
- **rest**
  1. Rest, if you must. The roads are patient. Patient as stones.
- **died** (once, after meeting, when **died**)
  1. Back so soon? Don't look at me like that.
  2. Everyone comes back. That's the trouble with this place.
- **key** (once, after meeting, when **trollKey**)
  1. That key's warm. Troll's blood, or the fire inside it.
  2. Either way, keep it away from my kindling.
- **warlord** (once, after meeting, when **warlordDead**)
  1. So. The grey is lifting.
  2. ...I'll keep the fire going anyway. Habit. Someone ought to.
- **ansel** (once, after meeting, when **anselRoused**)
  1. Ansel's stool is empty. First time in years.
  2. I'll leave it where it is. They come back, or they don't, and it's still a good stool.

## Brenna the Smith

Greets you: *"Mind the sparks."* Walked away from: *"Come back with ore."*

### Home: The Chapel Ward, the Forge Yard (58, 27)

- **first**
  1. You want an edge on that? Bring me gold and ore.
  2. The gold's for me. The ore's for the blade. Mostly.
- **ore**
  1. Mine Hills ore is soft, but honest. The Crags have better, under the gnomes.
  2. Go and be rude to them. They'll understand. It's how they talk to each other.
- **hammer**
  1. Heat, hit. Heat, hit. Same as fighting, only the iron never hits back.
- **key** (once, after meeting, when **trollKey**)
  1. Let me see that key. ...No. I won't touch it.
  2. Whatever forged that wasn't a smith.
- **ansel** (once, after meeting, when **anselRoused**)
  1. Ansel came by. Wanted an edge on a sword I'd forgotten he had.
  2. He didn't haggle. That worried me.

## Sergeant Corwin

Greets you: *"Captain."* Walked away from: *"Dismissed, then."*

### Home: The Keep, the Bailey, by the barracks (20, 29)

- **first**
  1. We were forty spears once. Forty.
  2. Now I drill boys with broom handles and call it a garrison.
  3. You want a lance at your side? Pay, and I'll find you one who still stands.
- **drill**
  1. Point forward, feet back.
  2. If they're charging you, you've already done it wrong.
- **died** (once, after meeting, when **died**)
  1. You fell. Don't tell me where.
  2. Bring me the ones still breathing. Not their names.
- **warlord** (once, after meeting, when **warlordDead**)
  1. Forty spears.
  2. I'll carve them into the gate. Every one. Leave me to it, captain.

### At Barrowmoor, Barrow Field (29, 22), once **hornedKey**

- **barrows**
  1. Captain. The king's dead, so the barrows are only barrows now.
  2. My forty went into them. I'm digging them out. One at a time.
- **count**
  1. Twenty-two. Dace still had his pipe.
  2. Holm had nothing. Holm always had nothing.
- **last**
  1. Thirty-nine.
  2. The fortieth was me, I think. I ought to be down there with them.
- **done** (once, after meeting, when **warlordDead**)
  1. So it's finished. Up in the grey.
  2. Tell them at the gate. I've no hands left for carving.

## Wren

Greets you: *"You walk loud, captain."* Walked away from: *"Keep your head down!"*

### Home: Last Harbour, West Fields (36, 58)

- **first**
  1. You walk loud for a captain. That's fine. Archers like a loud friend up front.
  2. Gold on the barrel, and I'll send you someone who doesn't miss. Much.
- **goblins**
  1. Goblins at the Ember Gate camp in threes.
  2. Shoot the torch first. Spears are slow. Torches are rude.
- **back**
  1. Five paces back, always. If you can smell it, you're too close.

### At Emberwood, Old Pines (29, 44), once **trollKey**

- **bluff**
  1. Captain! Troll's dead, the goblins don't know which way to run. Best shooting in years.
  2. Don't tell the Harbour. They'll want me back being useful.
- **torches**
  1. Torches first. Always torches first.

## Tobin

Greets you: *"Don't lean on the rope."* Walked away from: *"...Right. Off you go."*

### Home: Last Harbour, Lantern Point, by the Old Well (93, 77)

- **first**
  1. Don't lean on the rope. It's older than me.
  2. That well doesn't go to water. My brother went down it after a dropped coin.
  3. Never came up. Says something about the coin, doesn't it?
- **rule**
  1. No climbing back. That's the rule of the well.
  2. Funny, a hole having rules.
- **wings**
  1. Something else lives down there. Wings. You hear them before you see them.
  2. A sword's no use on a thing that won't come down to meet it.
  3. Wren hires out bows, at the butts by the west road. Take one with you, if you go.
- **chewed** (once, after meeting, when **died**)
  1. You look chewed on, captain.
  2. If it had wings, steel won't reach it. Wren's bows will.
- **below** (once, after meeting, when **wellDescended**; heard to the end, sets **tobinDown**)
  1. You came back? From down there?
  2. ...Did you see him? Thin fellow. Quick hands. Always smiling.
  3. No. Course not. Forget I asked.

### At The Undercroft, Smugglers' Nook (11, 9), once **tobinDown**

- **nook**
  1. Captain. Don't look so surprised. No rule against going down, is there?
  2. Smugglers keep this corner. One of them wore his coat. Said he swapped it, deeper in.
  3. Swapped it. Ha. He never swapped a thing in his life.
- **deeper** (heard to the end, sets **tobinDeeper**)
  1. I'm going on, through the cisterns.
  2. Don't wait for me. Nobody ever has.

### At Barrow Deeps, Robbers' Camp (7, 69), once **tobinDeeper**

- **camp**
  1. Found him, captain. He runs this camp. Thin as ever. Smiling.
  2. He says the coin was never dropped. He threw it, to see who'd come after.
  3. ...I came after.
- **stay**
  1. I'm staying. Someone has to count what he steals.
  2. Quick hands run in the family. Turns out.

## Mother Ysolde

Greets you: *"Peace on you."* Walked away from: *"Go gently, captain."*

### Home: Last Harbour, The Upper Town (54, 29)

- **first**
  1. Peace on you, captain.
  2. My sisters went down to the chapel under the fen, to pray the water clear.
  3. The water did not clear. Nor did they come back.
- **candle**
  1. I light a candle each night.
  2. It is not hope. It is habit, which outlasts hope.

### At The Undercroft, The Drowned Chapel (49, 55), once **monkFreed**

- **freed**
  1. You found one of us. Living. So I came down the well. Old knees, long drop.
  2. She does not remember her name yet. I tell it to her, and she thanks me, every time.
  3. One is a mercy. I'll not ask the dark for more than it gives.
- **lake** (heard to the end, sets **ysoldeDeeper**)
  1. She speaks in her sleep. Of a lake under all of this, clear as glass.
  2. The others went on to it. I must go too.
  3. Do not follow, captain. Or do. I am too old to forbid things.

### At The Drowned Hollow, Pilgrims' Rest (94, 49), once **ysoldeDeeper**

- **clear**
  1. Look, captain. The water is clear down here. Clear at last.
  2. I can see them at the bottom. All my sisters, kneeling. Still praying.
  3. ...No. Don't pull me back. I have only just found them.
- **kneel**
  1. I have stopped lighting candles.
  2. There is light enough down here. Cold, but enough.

## Maren the Harbourmaster

Greets you: *"Tide's out."* Walked away from: *"Fair winds. Ha."*

### Home: Last Harbour, Lantern Point, on the pier (98, 81)

- **first**
  1. No ships in three winters.
  2. The salt men down the coast still trade, if you can stomach their prices. And their pirates.
  3. Mostly the pirates.
- **sharks**
  1. Sharks off the Saltreach shore. Don't swim there.
  2. Don't even think wet thoughts.
- **tide**
  1. Tide's out. It's always out, lately.
  2. As if the sea's leaving too.
- **sail** (once, after meeting, when **warlordDead**; heard to the end, sets **marenSails**)
  1. A sail. Off the point, this morning. First in three winters.
  2. Salt men, likely. Pirates, likelier. I don't care.
  3. Thirty years I've watched that water. I'd like to be on it once, before it leaves for good.

### Gone, once **marenSails**

## The Moor Watchman

Greets you: *"Gate stays shut."* Walked away from: *"Back to the wall, then."*

### Home: Last Harbour, the Moor Watch, by the Moor Gate on the hill (109, 49)

- **first**
  1. The gate stays barred from this side, captain. Orders.
  2. Whatever's on the moor stays on the moor.
  3. You want it open, you'll have to go round and lift the bar yourself.
- **barrows**
  1. Lights on the barrows some nights.
  2. I don't look. Looking is how it starts.
- **open** (once, after meeting, when **moorGateOpen**; heard to the end, sets **watchmanOut**)
  1. ...You came through the barrows. On foot.
  2. Well. I'll stop barring it, then. You've made my post pointless.
  3. Thank you. I think.

### At Barrowmoor, Gibbet Hill (38, 57), once **watchmanOut**

- **lights**
  1. Captain. Thought I'd see the lights for myself, since the gate's open anyway.
  2. They're lanterns. Held by nobody. Swinging, all the same.
- **look**
  1. I'll just look a little longer.
  2. Looking is how it starts. I know. I said that.

### Gone, once **watchmanOut** and **hornedKey**

## Penny

Greets you: *"Shh!"* Walked away from: *"Don't tell them I'm here!"*

### Home: Last Harbour, West Fields (24, 62)

- **first**
  1. Don't tell them I'm here. The black soldiers.
  2. They took my mum. The whole east lane. Off to the castle with the grey walls.
  3. They keep them in a yard with ropes. I squeezed out under the gate.
- **crows**
  1. I count the crows.
  2. When there's more of them, they're bringing more people.

### At The Greyfall, Gallows Yard (73, 67), once **greyfallReached**

- **penned**
  1. Shh! Captain! I followed you through the gate. You walk loud, it's easy.
  2. They caught me straight off. But they put me in the yard. Same yard as mum!
  3. So that's alright. Mostly.
- **fewer**
  1. Fewer crows here today.
  2. You're killing them, aren't you? The black ones, I mean.

### At The Greyfall, Gallows Yard (73, 67), once **warlordDead**

- **free**
  1. They ran! All the black soldiers, they just ran!
  2. Mum says thank you. She says it twice. She's like that.
- **home**
  1. We're walking home. Mum says slowly.
  2. She's had enough of being hurried by ropes.

## Ansel of the Wall

Greets you: *"Look up, captain."* Walked away from: *"Go on. I'll keep watch. It's all I'm good for."*

### Home: The Keep, on the hall's terrace (25, 10)

- **first**
  1. Look up, captain. See that glint? Past the clouds.
  2. Gold. A whole city of it, up there.
  3. It never sent us a single spear when the grey came.
- **lift**
  1. The Watch Lift only comes down.
  2. Someone up there decided who gets to visit.
- **captain**
  1. I wore that blue once. Had a band, a banner. The fire knew my name.
  2. Then I stopped going out. You'd be surprised how easy it is.
- **watch**
  1. Still here. Still watching. Someone ought to.
- **lifted** (once, after meeting, when **watchLiftOpen**)
  1. So you went up. Were they kind?
  2. ...No. Gold never is.
- **roused** (once, after meeting, when **trollKey**; heard to the end, sets **anselRoused**)
  1. The troll. You killed it. With that.
  2. ...I had a sword once. It's under the bed, I think.
  3. Maybe I've sat long enough. Don't say anything. You'll talk me out of it.

### At The Greyfall, The Ashen Approach (14, 54), once **anselRoused**

- **out**
  1. Captain. Don't look at me like that. I said I'd come out.
  2. I'd forgotten the smell of the grey. Wet ash and old iron.
- **ahead** (heard to the end, sets **anselAhead**)
  1. The warlord's hall is up past the keep. I'll go first, this time.
  2. Let me have that. You've had all the others.

### At The Keep, on the hall's terrace (25, 10), once **warlordDead**

- **without**
  1. You went up without me. Good.
  2. I'd only have been in the way. I'd only have been brave.
- **wall**
  1. Back on the wall. It's a good wall.
  2. You can see the gold from here. Doesn't glint so much now.

### Dead at The Greyfall, The High City (95, 25), once **anselAhead**

Says nothing.
