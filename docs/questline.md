# The folk's questline

For checking. Generated from `../packages/engine/src/npcs.ts`, so the lines and places here are the ones in the game.

## The Grey

The Grey is a condition, not an army: a rot in the ground that gets into the water, then the blood, and takes the shape of whoever holds on longest. In the Greyfall it has worn the Warlord a long time. The Gilded City, the sky city that glints above the clouds, shut its gates when the Grey came and sent no aid. The wanderer comes ashore with the tide, nameless, and the folk of Last Harbour measure them by what they do, not by a rank.

## How it works

After Dark Souls: no quest log, no choices, the wanderer never speaks.

- **Talks.** Each talk to someone plays their next conversation, a few short pages; once all are heard the last one repeats. A remark marked "once ... when" plays once, after the first talk there, when its flag has happened.
- **Moving on.** Where someone stands depends on world flags. Each NPC has a home and a list of later stations; the last station whose flags have all happened wins. A station with no place means they are gone for good; a dead one lies there and says nothing.
- **Flags from talks.** Some talks set a flag when heard to the end: that is what moves a questline on.
- **Gifts.** Some talks give an item when heard to the end the first time, free. Where a questline can end two ways, the same item reaches the wanderer either way: given by the one who lived, or sold by a merchant after the loss.
- **Stock.** A merchant's line can wait on a boss falling or on a world flag.
- **When they move.** Placement is worked out on entering an area, so someone moves between your visits, never in front of you.

## What sets each flag

| Flag | Set by |
| --- | --- |
| died | dying |
| bullWon | falling to the Shore Minotaur, which washes the wanderer up at the Harbour's fire |
| wellDescended | arriving in the Undercroft |
| moorGateOpen | coming into the Harbour through the Moor Gate |
| watchLiftOpen | riding the Watch Lift from the Steps into the Keep |
| greyfallReached | arriving in the Greyfall |
| ladderDown | kicking the Ramparts Ladder down to the Burg |
| trollKey | the Cinder Troll slain, raised on entering any area |
| hornedKey | the Barrow King (kind `barrowKing`) slain, raised on entering any area |
| warlordDead | the Grey Warlord (kind `warlord`) slain, raised on entering any area |
| shellDead | the Shell Below (kind `shellBelow`) slain, raised on entering any area |
| monkFreed | hearing the Drowned Sister's second talk to its end; the Monk joins the band at once |
| tobinDown, tobinDeeper, ysoldeDeeper, anselRoused, anselAhead, watchmanOut, marenSails, pennyFollows, drankClear | hearing a talk to its end (marked below) |

## At a glance

| Who | Moved on by | Turns up | Ends |
| --- | --- | --- | --- |
| Tobin | his remark on the well, then a talk | Undercroft, Smugglers' Nook; then the Deeps, Robbers' Camp | Stays below counting what his brother steals; gives the Thrown Coin |
| Jory | Tobin gone deeper and the Warlord dead | Barrow Deeps, Robbers' Camp, selling what his camp robbed; then the Old Well in Tobin's place | Stands at the well, Tobin left below |
| Mother Ysolde | the sister freed, then a talk | Undercroft, the Drowned Chapel; then the Hollow, Pilgrims' Rest | Shell Below alive: kneels over her sisters for good, and Jory sells her candle. Shell Below dead: walks home to the Upper Town and gives the Sister's Candle |
| A Drowned Sister | her second talk | Undercroft, the Drowned Chapel | Freed, walks with the wanderer as the Monk |
| The Pilgrim | | the Hollow, Pilgrims' Rest | Gives Hollow Water; lies dead once the Shell Below is killed |
| Ansel of the Wall | his remark on the Troll Key | The Greyfall, the Ashen Approach | Hear him out twice and he goes ahead and dies in the High City, and Brenna sells his edge; kill the Warlord first and he is back on the wall and gives Ansel's Edge |
| Penny | her crows talk, then reaching the Greyfall | The Greyfall, Gallows Yard, penned with her mum | Talked to: freed in the Yard when the Warlord falls. Never talked to: stays hidden, her mum walks home. Mum's Bread either way |
| Sergeant Corwin | the Barrow King dead | Barrowmoor, Barrow Field, digging out his forty | Watchman heard out: finds the fortieth and gives the Forty's Banner. Otherwise: stops at thirty-nine |
| The Moor Watchman | his remark on the open Moor Gate | Barrowmoor, Gibbet Hill, watching the lights | Lies dead in Barrow Field once the King is dead, the fortieth of Corwin's spears |
| Maren | her remark on the Warlord dead | | Sails on the first ship in three winters, and Mags stocks the Salt-Glass Flask; missed only by never hearing her sail talk |
| Wren | the Troll Key | Emberwood, Old Pines | Stays, shooting; remarks on Penny gone |
| The Last One | | Barrowmoor, the Grey Road, dead from the start | Ferrow's last one, who went east; never named |
| Old Ferrow, Brenna, Mags | | | Stay; remark on the folk's news. Brenna and Mags sell what the questlines turn up |
| Hale, Odo | | | Stay at their posts in the Burg and on the Ramparts |

## Forks

Each turns on one thing the wanderer does, never on a choice in a menu.

| Fork | The player's action | Outcomes |
| --- | --- | --- |
| The Fortieth Spear | hear the Watchman out after opening the Moor Gate, or don't | forty and the Forty's Banner, or thirty-nine and nothing |
| Ansel | hear his `ahead` talk in the Greyfall, or kill the Warlord first | dead and Ansel's Edge from Brenna for gold, or alive and the Edge free |
| The Clear Water | kill the Shell Below, or leave it | Ysolde home, the Sister's Candle free and the Pilgrim dead; or Ysolde kneeling, the Pilgrim's Hollow Water, and the Candle from Jory for gold. Drink first, then kill it, and both are had |
| The Loud Walker | talk Penny through her crows, or don't | penned in the Gallows Yard then freed, or safe at home; Mum's Bread either way |
| The First Sail | hear Maren's sail talk after the Warlord, or don't | she sails and Mags stocks the Salt-Glass Flask, or she stays |

## Old Ferrow

Greets you: *"Ah. Another one."* Walked away from: *"Mind the dark, then."*

### Home: Last Harbour, the Lower Town, by the bonfire (61, 48)

- **first**
  1. Another one the tide spat out. Hm.
  2. The last one sat where you're standing. Warmed his hands. Then he went east and did not come back.
  3. Go on, then. The fire doesn't ask what you were. Nor do I.
- **shore**
  1. Follow the lanterns up through Old Town and round the back of the hill, to the Burg Gate. Someone lit them before you came. They always do.
  2. The path up the hill runs through the graves to the Moor Gate. It's barred from this side. The dogs on that hill don't care that it's barred.
- **bull** (once, after meeting, when **bullWon**)
  1. The tide brought you back. The bull in the Ring did that.
  2. He'll keep. Go back by boat when your arm is stronger. What he guards is worth a fall or two.
- **goal**
  1. You'll be wanting the Grey Gate, east past the moor. Everyone does, in the end.
  2. Two keys open it. The king under the barrows keeps one.
  3. The other's down below, they say, in the Weaver's web. Down the well, then further down.
- **castle**
  1. The Keep? Shut since the Burg turned. Its steward ran for the wood with the key.
  2. A troll had him for supper, they say. Still has the key, I'd wager.
- **well**
  1. The well only goes one way. Down.
  2. Don't drink what's at the bottom. The Grey's in the water, then it's in you.
- **roads**
  1. Every road out of here comes back to this fire. The gates, the well, the lift.
  2. Folk think that's a comfort. I've never been sure.
- **rest**
  1. Rest, if you must. The roads are patient as stones.
- **died** (once, after meeting, when **died**)
  1. Back so soon? Don't look at me like that.
  2. Everyone comes back. That's the trouble with this place.
- **key** (once, after meeting, when **trollKey**)
  1. That key's warm. Troll's blood, or the fire inside it.
  2. Either way, keep it away from my kindling.
- **warlord** (once, after meeting, when **warlordDead**)
  1. So the Warlord's dead, they're saying.
  2. The Grey's still in the ground. I'll keep the fire going anyway. Habit. Someone ought to.
- **ansel** (once, after meeting, when **anselRoused**)
  1. Ansel's off the wall. I can see it from here. First time in years.
  2. They come back, or they don't. The wall will keep.
- **east** (once, after meeting, when **greyfallReached**)
  1. You went east. You came back.
  2. That's one more than the last one managed.
- **gone** (once, after meeting, when **anselAhead**)
  1. Ansel's not come back off the moor road. Nor will he, I'd wager.
  2. They go east. They always go east.

## Brenna the Smith

Greets you: *"Mind the sparks."* Walked away from: *"Come back with ore."*

Sells: Brenna's Edge; Keener Edge (once the Stone Warden falls); Grey-Iron Edge (once the Cinder Troll falls); Banded Shield; Ansel's Edge (once **anselAhead**).

### Home: The Chapel Ward, the Forge Yard (73, 29)

- **first**
  1. You want an edge on that? Bring me gold and ore.
  2. The gold's for me. The ore's for the blade. Mostly.
  3. There's a banded shield on the wall too, oak and iron. Takes a blow so your arm doesn't.
- **ore**
  1. Mine Hills ore is soft, but honest. The Crags have better, under the gnomes.
  2. Go and be rude to them. They'll understand. It's how they talk to each other.
- **hammer**
  1. Heat, hit. Heat, hit. Same as fighting, only the iron never hits back.
- **key** (once, after meeting, when **trollKey**)
  1. Let me see that key. ...The Keep's. I cut that blank myself, years back.
  2. Smells of troll now. Wash it.
- **ansel** (once, after meeting, when **anselRoused**)
  1. Ansel came by. Paid for two edges on that old sword of his. Didn't haggle.
  2. Took the sword with one. Said he'd be back for the other.
- **second** (once, after meeting, when **anselAhead**)
  1. He hasn't come back for the second edge.
  2. I don't keep things for the dead. I sell them. Gold first.

## Sergeant Corwin

Greets you: *"You're not one of mine."* Walked away from: *"Dismissed, then."*

### Home: The Keep, the Bailey, by the barracks (21, 29)

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
  2. I'll carve them into the gate. Every one. Leave me to it.
- **post** (once, after meeting, when **watchmanOut**)
  1. The Watch on the Moor Gate's gone off his post. Good.
  2. He barred it on my orders, he'll tell you. I never gave him any.
- **ansel** (once, after meeting, when **anselRoused**)
  1. Ansel's got his sword out. Took him long enough.
  2. Took me forty men. Don't tell him I said so.

### At Barrowmoor, Barrow Field (29, 22), once **hornedKey**

- **barrows**
  1. The Barrow King's dead. The barrows are only barrows now.
  2. My forty went into them. I'm digging them out. One at a time.
- **count**
  1. Twenty-two. Dace still had his pipe.
  2. Holm had nothing. Holm always had nothing.
- **last**
  1. Thirty-nine.
  2. The fortieth was me, I think. I ought to be down there with them.
- **done** (once, after meeting, when **warlordDead**)
  1. So it's finished. Up in the Grey.
  2. Tell them at the gate. I've no hands left for carving.

### At Barrowmoor, Barrow Field (29, 22), once **hornedKey** and **watchmanOut**

- **barrows**
  1. The Barrow King's dead. The barrows are only barrows now.
  2. My forty went into them. I'm digging them out. One at a time.
- **count**
  1. Twenty-two. Dace still had his pipe.
  2. Holm had nothing. Holm always had nothing.
- **forty** (heard to the end the first time, gives *The Forty's Banner*)
  1. Forty. Found him this morning, lying down among them like he'd never left.
  2. He ran, the night the King came up. I let him. I'd have run, if I'd been quicker.
  3. This was rolled up under him. Take it. It never did come home. Take it further.
- **done** (once, after meeting, when **warlordDead**)
  1. So it's finished. Up in the Grey.
  2. Tell them at the gate. I've no hands left for carving.

## Wren

Greets you: *"You walk loud."* Walked away from: *"Keep your head down!"*

### Home: Last Harbour, West Fields (36, 58)

- **first**
  1. You walk loud. That's fine. Archers like a loud friend up front.
  2. Gold on the barrel, and I'll send you someone who doesn't miss. Much.
- **goblins**
  1. Goblins at the Ember Gate camp in threes.
  2. Shoot the torch first. Spears are slow. Torches are rude.
- **back**
  1. Five paces back, always. If you can smell it, you're too close.
- **wings** (once, after meeting, when **died**)
  1. Tobin sent you for a bow, didn't he? Wings?
  2. Steel goes up. Steel comes down. Arrows only go up.
- **penny** (once, after meeting, when **greyfallReached**)
  1. Penny's gone from behind the butts. She'd sit there and count crows.
  2. If you see her, tell her I kept her seat. Don't tell her I said kept.

### At Emberwood, Old Pines (29, 44), once **trollKey**

- **bluff**
  1. Troll's dead! The goblins don't know which way to run. Best shooting in years.
  2. Don't tell the Harbour. They'll want me back being useful.
- **torches**
  1. Torches first. Always torches first.
- **penny** (once, after meeting, when **greyfallReached**)
  1. Penny's gone from behind the butts. She'd sit there and count crows.
  2. If you see her, tell her I kept her seat. Don't tell her I said kept.

## Tobin

Greets you: *"Don't lean on the rope."* Walked away from: *"...Right. Off you go."*

### Home: Last Harbour, the Lower Town, by the Old Well (57, 51)

- **first**
  1. Don't lean on the rope. It's older than me.
  2. That well's not for drawing water. My brother went down it after a dropped coin.
  3. Never came up. Says something about the coin, doesn't it?
- **rule**
  1. No climbing back. That's the rule of the well.
  2. Funny, a hole having rules.
- **wings**
  1. Something else lives down there. Wings. You hear them before you see them.
  2. A sword's no use on a thing that won't come down to meet it.
  3. Wren hires out bows, at the butts by the west road. Take one with you, if you go.
- **chewed** (once, after meeting, when **died**)
  1. You look chewed on.
  2. If it had wings, your steel won't reach it. Wren's bows will.
- **below** (once, after meeting, when **wellDescended**; heard to the end, sets **tobinDown**)
  1. You came back? From down there?
  2. ...Did you see him? Thin fellow. Quick hands. Always smiling.
  3. No. Course not. Forget I asked.

### At The Undercroft, Smugglers' Nook (11, 9), once **tobinDown**

- **nook**
  1. Don't look so surprised. No rule against going down, is there?
  2. Smugglers keep this corner. One of them is wearing his coat. Said he swapped it, deeper in.
  3. Swapped it. Ha. He never swapped a thing in his life.
- **deeper** (heard to the end, sets **tobinDeeper**)
  1. I'm going on, through the cisterns.
  2. Don't wait for me. Nobody ever has.

### At Barrow Deeps, Robbers' Camp (7, 69), once **tobinDeeper**

- **camp**
  1. Found him. He runs this camp. Thin as ever. Smiling.
  2. He says the coin was never dropped. He threw it, to see who'd come after.
  3. ...I came after.
- **stay** (heard to the end the first time, gives *The Thrown Coin*)
  1. I'm staying. Someone has to count what he steals.
  2. Here. The coin. I found it at the bottom, the day I came down. He never looked for it.
  3. Quick hands run in the family. Turns out.

## Jory

Greets you: *"Ha. Walk soft, friend."* Walked away from: *"Mind your purse."*

Sells: Smuggler's Coat; Sister's Candle (once **ysoldeDeeper**).

### Home: Barrow Deeps, Robbers' Camp (8, 68)

- **first**
  1. Tobin's friend? Anyone who comes this deep is a friend. Friends buy things.
  2. Don't mind the lads. They only take what's not watched.
- **coin**
  1. The coin? I threw it. Down the well, a long time ago. To see who'd come after.
  2. Two did. Him and you. I didn't expect you.

### At Last Harbour, the Lower Town, by the Old Well (57, 51), once **tobinDeeper** and **warlordDead**

- **well**
  1. Tobin? Down there. Counting. Someone has to.
  2. Don't lean on the rope. It's older than both of us.

## Mother Ysolde

Greets you: *"Peace on you."* Walked away from: *"Go gently."*

### Home: Last Harbour, The Upper Town (54, 29)

- **first**
  1. My sisters went down to the Drowned Chapel, to pray the Grey out of the water.
  2. The water did not clear. Nor did they come back.
- **candle**
  1. I light a candle each night.
  2. The hour comes round and my hands are already there.
- **clean** (once, after meeting, when **drankClear**)
  1. You drank from the lake. I can smell it on you. Clean, like nothing is.
  2. Nothing down here is clean, child.

### At The Undercroft, The Drowned Chapel (49, 55), once **monkFreed**

- **freed**
  1. You found one of us. Living. She walks with you now, so I came down to see where.
  2. I told her her name. She thanked me. She'll have lost it again by the next fire.
  3. Tell it to her, some nights. One is a mercy. I'll not ask the dark for more.
- **lake** (heard to the end, sets **ysoldeDeeper**)
  1. She speaks in her sleep. Of a lake under all of this, clear as glass.
  2. The others went on to it. I must go too.
  3. Do not follow. Or do. I am too old to forbid things.
- **clean** (once, after meeting, when **drankClear**)
  1. You drank from the lake. I can smell it on you. Clean, like nothing is.
  2. Nothing down here is clean, child.

### At The Drowned Hollow, Pilgrims' Rest (94, 49), once **ysoldeDeeper**

- **clear**
  1. Look. The water is clear down here. Clear at last.
  2. I can see them at the bottom. All my sisters, kneeling. Still praying.
  3. ...No. Don't pull me back. I have only just found them.
- **kneel**
  1. I have stopped lighting candles.
  2. There is light enough down here. Cold, but enough.
- **clean** (once, after meeting, when **drankClear**)
  1. You drank from the lake. I can smell it on you. Clean, like nothing is.
  2. Nothing down here is clean, child.

### At Last Harbour, The Upper Town (54, 29), once **ysoldeDeeper** and **shellDead**

- **ash** (heard to the end the first time, gives *Sister's Candle*)
  1. The water went grey when it died. Then my sisters were only bones.
  2. I can leave bones. I couldn't leave them kneeling.
  3. Take this. I've stopped lighting it. Light it for the ones you lose.
- **clean** (once, after meeting, when **drankClear**)
  1. You drank from the lake. I can smell it on you. Clean, like nothing is.
  2. Nothing down here is clean, child.

## A Drowned Sister

Greets you: *"...Mother?"* Walked away from: *"Don't go far."*

### Home: The Undercroft, The Drowned Chapel (51, 55)

- **first**
  1. Is it night? It's always night, down here.
  2. We came to pray the water clear. I don't remember the others' faces.
- **warm** (heard to the end, sets **monkFreed**)
  1. You're warm. Nothing down here is warm.
  2. I'll walk with you. I've forgotten the way up. You haven't.

### Gone, once **monkFreed**

## The Pilgrim

Greets you: *"Softly. It sleeps."* Walked away from: *"Softly, going."*

### Home: The Drowned Hollow, Pilgrims' Rest (95, 49)

- **first**
  1. The sisters came to pray the Grey out of the water. It went out of the water. Look.
  2. It sleeps on the isle, and the lake stays clear while it sleeps.
- **water** (heard to the end, sets **drankClear**; heard to the end the first time, gives *Hollow Water*)
  1. Drink. It is clear. Nothing clear is left up there.
  2. The old one by the harbour fire says not to. He has never been down.

### Dead at The Drowned Hollow, Pilgrims' Rest (95, 49), once **shellDead**

Says nothing.

## Maren the Harbourmaster

Greets you: *"Tide's out."* Walked away from: *"Fair winds. Ha."*

### Home: Last Harbour, the Docks, at the boat's pier (55, 60)

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
  1. The gate stays barred from this side. Orders.
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
  1. Thought I'd see the lights for myself, since the gate's open anyway.
  2. They're lanterns. Held by nobody. Swinging, all the same.
- **look**
  1. I'll just look a little longer.
  2. Looking is how it starts. I know. I said that.
- **spear**
  1. Sergeant Corwin. Is he still drilling boys at the Keep?
  2. Don't tell him you saw me. He'd want a count. He always wanted a count.

### Dead at Barrowmoor, Barrow Field, beside Corwin's dig (31, 23), once **watchmanOut** and **hornedKey**

Says nothing.

## Penny

Greets you: *"Shh!"* Walked away from: *"Don't tell them I'm here!"*

### Home: Last Harbour, West Fields (24, 62)

- **first**
  1. Don't tell them I'm here. The grey men.
  2. They took my mum. The whole east lane. Off to the Greyfall, where the Grey comes from.
  3. They keep them in a yard with ropes. I squeezed out under the gate.
- **crows** (heard to the end, sets **pennyFollows**)
  1. I count the crows.
  2. When there's more of them, they're bringing more people.
  3. Wren says you walk loud. You do. I could follow you anywhere.

### At The Greyfall, Gallows Yard (73, 67), once **pennyFollows** and **greyfallReached**

- **penned**
  1. Shh! I followed you through the gate. You walk loud, so it's easy.
  2. They caught me straight off. But they put me in the yard. Same yard as mum!
  3. So that's alright. Mostly.
- **fewer**
  1. Fewer crows here today.
  2. You're killing them, aren't you? The grey ones, I mean.

### At Last Harbour, West Fields (24, 62), once **warlordDead**

- **mum**
  1. Mum came home! On her own feet!
  2. She says the grey ones just ran. She says it twice.
- **bread** (heard to the end the first time, gives *Mum's Bread*)
  1. Mum made bread. It's mostly ash. Here.

### At The Greyfall, Gallows Yard (73, 67), once **pennyFollows** and **warlordDead**

- **free**
  1. They ran! All the grey ones, they just ran!
  2. Mum says thank you. She says it twice. She's like that.
- **home** (heard to the end the first time, gives *Mum's Bread*)
  1. We're walking home. Mum says slowly.
  2. She's had enough of being hurried by ropes.

## Ansel of the Wall

Greets you: *"Look up."* Walked away from: *"Go on. I'll keep watch. It's all I'm good for."*

### Home: The Keep, on the hall's terrace (43, 11)

- **first**
  1. Look up. See that glint past the clouds?
  2. The Gilded City. Gold walls, gold roofs, a city that never learned to bleed.
  3. When the Grey came, it shut its gates. Not one spear. Not one prayer.
- **lift**
  1. The Watch Lift only comes down.
  2. Someone in the sky city decided who gets to visit.
- **blue**
  1. I wore that blue once. Had a band, a banner. The fire knew my name.
  2. Then I stopped going out. You'd be surprised how easy it is.
- **watch**
  1. Still here. Still watching. Someone ought to.
- **lifted** (once, after meeting, when **watchLiftOpen**)
  1. So you went up. Were they kind?
  2. ...No. The sky city never is.
- **roused** (once, after meeting, when **trollKey**; heard to the end, sets **anselRoused**)
  1. The troll. You killed it. With that.
  2. ...I had a sword once. It's under the bed, I think.
  3. Maybe I've sat long enough. Don't say anything. You'll talk me out of it.

### At The Greyfall, The Ashen Approach (14, 54), once **anselRoused**

- **out**
  1. Don't look at me like that. I said I'd come out.
  2. I'd forgotten the smell of the Grey. Wet ash and old iron.
  3. Talk to me again and I'll go on up. So don't. Not unless you mean it.
- **ahead** (heard to the end, sets **anselAhead**)
  1. The Warlord's Hall is up past the High City. I'll go first, this time.
  2. Let me have that. You've had all the others.

### At The Keep, on the hall's terrace (43, 11), once **anselRoused** and **warlordDead**

- **without**
  1. You went up without me. Good.
  2. I'd only have been in the way. I'd only have been brave.
- **wall** (heard to the end the first time, gives *Ansel's Edge*)
  1. Back on the wall. It's a good wall.
  2. Brenna's holding an edge I paid for. Here. Tell her I sent you, she'll want it in writing.

### Dead at The Greyfall, The High City (95, 25), once **anselAhead**

Says nothing.

## Mags the Peddler

Greets you: *"Hehe. A live one."* Walked away from: *"Come back with coin, dearie."*

Sells: Ember Shard; Smoked Haunch; Pine Resin; Prospector's Purse; Kindled Shard (once the Cinder Troll falls); Salt-Glass Flask (once **marenSails**).

### Home: The Lower Burg, Market Row, in a nook under the wall (37, 39)

- **first**
  1. Don't mind old Mags. The Grey took the Burg, not my trade.
  2. A shard of the old fire, a haunch, a pot of resin, a purse that sews itself fatter. One of each, mind. Keep them in your sack, where your hands can find them.
  3. Kill whatever sits in the Emberwood and I'll find you a warmer shard. Hehe.
- **thieves**
  1. The thieves in the market? Burg folk, all of them.
  2. Went bad when the bell stopped. Bad for business, worse for them.
- **rest**
  1. Hehe. Still breathing, dearie? Good. Breathing folk buy things.
- **fence** (once, after meeting, when **tobinDeeper**)
  1. Tobin's gone down after his brother? Hehe. Then he'll meet my best supplier.
  2. Don't ask what I buy from below, dearie. I don't.
- **ship** (once, after meeting, when **marenSails**)
  1. A ship in, and Maren off on it. Thirty years she waited. Hehe. Some of us don't wait.
  2. The salt men left me a crate. Glass, dearie. Salt-glass. One, mind.

## Hale of the Watch

Greets you: *"Living? Then sit a while."* Walked away from: *"Mind the bridges."*

### Home: The Lower Burg, The Burg Square, by the fire (51, 32)

- **first**
  1. You came over the creek? Then you've met the bridges' keepers.
  2. I held this square with six men. The bell stopped, and they turned, one by one.
  3. The Rampart Gate's up the street. Or through the graves on the hill, if you'd sooner the dead than the dying.
- **ladder**
  1. There was a ladder down to here from the Ramparts, by the fire.
  2. Someone pulled it up. From above.
- **keep** (once, after meeting, when **trollKey**)
  1. That's the troll's key on your belt?
  2. The Keep Gate's off the west alley. Corwin's lancers are behind it, if any are left.
- **rest**
  1. Sit. The fire's the one thing in the Burg that's still ours.

## Odo the Gunner

Greets you: *"Bull's dead, then. Good. I was running out of things to throw."* Walked away from: *"Mind the ladder. It sticks."*

### Home: The Ramparts, The East Tower (70, 14)

- **first**
  1. Two guns on this tower. No powder since the Grey came.
  2. The bull was the garrison's. The smiths shod him in iron for the parade.
  3. Then he forgot who fed him, and the goblins came over the wall.
- **ladder**
  1. There's a ladder down the south face to the Burg's square.
  2. Kick it loose. Their fire is right under it, if you need one.
- **died** (once, after meeting, when **died**)
  1. You came back. They don't, usually.
  2. The wall remembers everyone who crossed it. It just doesn't care.
- **kicked** (once, after meeting, when **ladderDown**)
  1. You found it. The square's closer than it looks.

## The Last One

### Dead at Barrowmoor, The Grey Road, short of the Grey Gate (113, 37), from the start

Says nothing.
