# The folk's questline

For checking. Kept by hand against `../../packages/engine/src/npcs.ts`, so the lines and places here are the ones in the game. Each land's folk and their full lines are in its folder's `questline.md` (see [README.md](README.md)).

## The Grey

The Grey is the cold that came up the Citadel's Deep Cut when the Hearth under Aurum was half put out: it takes colour, then name, then will, and the taken walk on by habit toward any warmth. Folk think the Grey Warlord is the Grey; he is only the drain it runs into, kept warm by his crown. Sunhold, the sky city, shut its gates and sent no aid. The wanderer comes up out of the sea cave under Lanternport with the tide, nameless and warm, and the folk measure them by what they do, not by a rank. The full canon is in [reach.md](reach.md).

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
| bullWon | falling to the Cinder Troll in the Bull's Ring, which washes the wanderer up at Lanternport's fire |
| wellDescended | arriving in Underwell |
| moorGateOpen | coming into Lanternport through the Moor Gate |
| watchLiftOpen | riding the Watch Lift from Cloudstair into the Keep |
| greyfallReached | arriving in Greyfall |
| ladderDown | kicking the Ramparts Ladder down to the Burg |
| hoistOpen | unbarring the Hoist from the Wheel Step |
| bambooDead | Old Bamboo (kind `oldBamboo`) slain, raised on entering any area |
| trollKey | the Ember Bull (kind `minotaur`) slain, raised on entering any area: the Ember Key |
| hornedKey | the Barrow King (kind `barrowKing`) slain, raised on entering any area |
| warlordDead | the Grey Warlord (kind `warlord`) slain, raised on entering any area |
| shellDead | the Shell Below (kind `shellBelow`) slain, raised on entering any area |
| monkFreed | hearing the Drowned Sister's second talk to its end; the Monk joins the band at once |
| tobinDown, tobinDeeper, ysoldeDeeper, sistersStair, anselRoused, anselAhead, watchmanOut, pennyFollows, wageOwed, ledgerSaved | hearing a talk to its end (marked below) |

## At a glance

| Who | Moved on by | Turns up | Ends |
| --- | --- | --- | --- |
| Tobin | his remark on the well, then a talk | Underwell, Smugglers' Nook; then Graveroad, Robbers' Camp | Stays below counting what his brother steals; gives the Thrown Coin |
| Mother Ysolde | the sister freed, then a talk | Underwell, the Drowned Chapel; then Hearthdeep, Pilgrims' Rest | Shell Below alive: kneels over her sisters for good, gives Hollow Water, and Jory sells her candle. Shell Below dead: walks home to the Upper Town and gives the Sister's Candle |
| A Drowned Sister | her second talk | Underwell, the Drowned Chapel | Freed, walks with the wanderer as the Monk |
| Ansel of the Wall | his remark on the Ember Key | Greyfall, the Ashen Approach | Hear him out twice and he goes ahead and dies in Greyfall's High City, and Brenna sells his edge; kill the Warlord first and he is back on the wall and gives Ansel's Edge |
| Penny | her crows talk, then reaching Greyfall | Greyfall, Gallows Yard, penned with her mum | Talked to: freed in the Yard when the Warlord falls. Never talked to: stays hidden, her mum walks home. Mum's Bread either way |
| Tally | his wage talk, then the Last Ledger | Greyfall, the Pits, at the Crater's lip | Ledger saved: reads it, laughs, gives the Digger's Torch. Warlord dead first: goes home unpaid, and Brenna sells the torch |
| Master Quill | Tally's wage talk | Greyfall, the High City, the Counting House | Asked after Tally's talk: gives up the Last Ledger. Warlord dead first: the last page already burned. Gives the Stilled Bell in the thaw |
| Sergeant Corwin | the Barrow King dead | Kingsrest, Barrow Field, digging out his forty | Watchman heard out: finds the fortieth and gives the Forty's Banner. Otherwise: stops at thirty-nine |
| The Moor Watchman | his remark on the open Moor Gate | Kingsrest, Gibbet Hill, watching the lights | Lies dead in Barrow Field once the King is dead, the fortieth of Corwin's spears |
| Wren | the Ember Key | Emberwood, at Smoke Bluff's foot | Stays, shooting; remarks on Penny gone |
| Dunn of the Gate Watch | the Ember Gate opened from the wood | Emberwood, the Palisade, at the gate | Finds the steward's note, and stands the gate he barred on him |
| Brother Fenn | | | Stays in Old Pines; points the way to the Drawn Plank and the East Bridge |
| Old Ferrow | | | Stays; walks you to the cold fire, and remarks on the folk's news |
| Brenna, Mags, Jory, Nim | | | Merchants: one talk each, never move; their stock is what the questlines turn up |
| Hale | | | Stays at his post in the Burg |
| Moss | Old Bamboo dead | Brasscrag, Tinker Peak, at the Gnome Lift's head | Keeps the lift in Wick's place; gives the Wheel Cog |

## Forks

Each turns on one thing the wanderer does, never on a choice in a menu.

| Fork | The player's action | Outcomes |
| --- | --- | --- |
| The Fortieth Spear | hear the Watchman out after opening the Moor Gate, or don't | forty and the Forty's Banner, or thirty-nine and nothing |
| Ansel | hear his `ahead` talk in Greyfall, or kill the Warlord first | dead and Ansel's Edge from Brenna for gold, or alive and the Edge free |
| The Clear Water | kill the Shell Below, or leave it | Ysolde home and the Sister's Candle free; or Ysolde kneeling, her Hollow Water, and the Candle from Jory for gold. Hear her kneel, then kill it, and both are had |
| The Loud Walker | talk Penny through her crows, or don't | penned in the Gallows Yard then freed, or safe at home; Mum's Bread either way |
