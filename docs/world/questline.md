# The folk's questline

For checking. Kept by hand against `../../packages/engine/src/npcs.ts`, so the lines and places here are the ones in the game. Each land's folk and their full lines are in its folder's `questline.md` (see [README.md](README.md)).

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
| hoistOpen | unbarring the Hoist from the Wheel Step |
| bambooDead | Old Bamboo (kind `oldBamboo`) slain, raised on entering any area |
| trollKey | the Ember Bull (kind `minotaur`) slain, raised on entering any area: the Ember Key |
| hornedKey | the Barrow King (kind `barrowKing`) slain, raised on entering any area |
| warlordDead | the Grey Warlord (kind `warlord`) slain, raised on entering any area |
| shellDead | the Shell Below (kind `shellBelow`) slain, raised on entering any area |
| monkFreed | hearing the Drowned Sister's second talk to its end; the Monk joins the band at once |
| tobinDown, tobinDeeper, ysoldeDeeper, sistersStair, anselRoused, anselAhead, watchmanOut, marenSails, pennyFollows, drankClear | hearing a talk to its end (marked below) |

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
| Wren | the Ember Key | Emberwood, at Smoke Bluff's foot | Stays, shooting; remarks on Penny gone |
| Garth the Woodcutter | the Ember Gate opened from the wood | Emberwood, the Palisade | Back at work; finds the steward's note and knows whose knocking it was |
| Dunn of the Gate Watch | the Ember Gate opened from the wood | Emberwood, the Palisade, at the gate | Stands the gate he barred on the steward |
| Brother Fenn, Tam the Prospector | | | Stay in Old Pines and on Crag Foot; point the way to the Drawn Plank and the East Bridge |
| The Last One | | Barrowmoor, the Grey Road, dead from the start | Ferrow's last one, who went east; never named |
| Old Ferrow, Brenna, Mags | | | Stay; remark on the folk's news. Brenna and Mags sell what the questlines turn up |
| Hale, Odo | | | Stay at their posts in the Burg and on the Ramparts |
| Moss, Pip | Old Bamboo dead | Tinker Crags, Tinker Peak, at the Gnome Lift's head | Moss keeps the lift in Tam's place; Pip means to, when he's big |
| Pell, Nim, Hask, Fennick, Quill | | | Stay in the Crags; remark on Old Bamboo dead. Nim sells gnome work; Fennick gives the Wheel Cog |

## Forks

Each turns on one thing the wanderer does, never on a choice in a menu.

| Fork | The player's action | Outcomes |
| --- | --- | --- |
| The Fortieth Spear | hear the Watchman out after opening the Moor Gate, or don't | forty and the Forty's Banner, or thirty-nine and nothing |
| Ansel | hear his `ahead` talk in the Greyfall, or kill the Warlord first | dead and Ansel's Edge from Brenna for gold, or alive and the Edge free |
| The Clear Water | kill the Shell Below, or leave it | Ysolde home, the Sister's Candle free and the Pilgrim dead; or Ysolde kneeling, the Pilgrim's Hollow Water, and the Candle from Jory for gold. Drink first, then kill it, and both are had |
| The Loud Walker | talk Penny through her crows, or don't | penned in the Gallows Yard then freed, or safe at home; Mum's Bread either way |
| The First Sail | hear Maren's sail talk after the Warlord, or don't | she sails and Mags stocks the Salt-Glass Flask, or she stays |
