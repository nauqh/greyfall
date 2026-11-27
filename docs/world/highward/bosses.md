# Highward: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Rampart Boar

- **Where:** the Bull's Wall, the curtain wall alone, three wide over the drop, from the Ramparts' walk to the Chapel Door (area `bullwall`).
- **Who:** The garrison's iron-shod war boar, taken by the Grey at its post: it forgot who fed it but not the wall. Goblins running west for Emberwood came over the wall behind it, and one rides it; goblins know pit pigs. Folk still call it the Rampart Bull.
- **Guards:** The Ladder down to the Burg's square, and the Chapel Door.
- **Its fall:** The Ladder drops (`ladderDown`), a loop home through the wards.
- **Moves:** A gore up close and a buck round it after. A charge down one lane of the wall, stepped out of; run into the parapet, it stands dazed. The chief hauls it round to charge again where the hero went, then calls the goblins' cannons down on the wall while it turns. Past half the boar throws its chief: he lands rolling and fights on afoot (`FOES.boarChief`), and the boar, drawn riderless from then on, no longer wheels or calls the cannons; it only gores, bucks and charges, quicker.
- **Drawn with:** the pig rider's sheets.
- **In the code:** stats `FOES.rampartBull` and moves `BOSS_KITS.rampartBull` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `bullwall()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).

## The Stone Warden

- **Where:** the Belfry, the bell loft alone, cramped round the bell's timber frame (area `belfry`).
- **Who:** The belfry's bat, which roosted in the warm loft over the Keepers' bell. The bell roof is Highward's highest, coldest edge, so the Grey reached it first: the bell stopped, and the bat, taken, went on to the last stage and set as stone, still keeping the loft. It is what the end of the Grey looks like. In game, why the bell stopped is never said.
- **Guards:** The Postern down to the Emberwood.
- **Its fall:** The Postern opens: the way into the Emberwood.
- **Moves:** Stone-skinned: a blow takes a fifth but while it stands open after a move. It drops off the bell's frame onto the wanderer as they near it, like the troll. A wing buffet up close, the bell's toll in a ring round it, a dive over the bell's frame, the roof's stones shaken down. Past half its mate wakes on the far turret (`FOES.gargoyle`). A swing beside the bell rings it, and its toll dazes all the stone in the loft for a few seconds, once every twelve; the note at the stair says to ring it.
- **Drawn with:** the giant bat's sheets, in stone.
- **In the code:** stats `FOES.stoneWarden` and moves `BOSS_KITS.stoneWarden` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `belfry()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
