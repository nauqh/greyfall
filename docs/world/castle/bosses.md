# The Castle: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Rampart Boar

- **Where:** the Bull's Wall, the curtain wall alone, three wide over the drop, from the Ramparts' walk to the Chapel Door (area `bullwall`).
- **Who:** The garrison's iron-shod beast that forgot who fed him; with it turned, goblins came over the wall. The lore still calls it the Rampart Bull, and Odo saw it turn.
- **Guards:** The Ladder down to the Burg's square, and the Chapel Door.
- **Its fall:** The Ladder drops (`ladderDown`), a loop home through the wards.
- **Moves:** A gore up close, a charge the whole width of its wall, the goblins' cannons scattered down on the wall, and raging, its spearmen called up onto the wall.
- **Drawn with:** the pig rider's sheets.
- **In the code:** stats `FOES.rampartBull` and moves `BOSS_KITS.rampartBull` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `bullwall()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).

## The Stone Warden

- **Where:** the Belfry, the bell loft alone, cramped round the bell's timber frame (area `belfry`).
- **Who:** A warden of stone that squats on the bell roof. The chapel's bell stopped first of all, and the castle fell from there; why it stopped is kept a mystery.
- **Guards:** The Postern down to the Emberwood.
- **Its fall:** The Postern opens: the way into the Emberwood.
- **Moves:** Stone-skinned: a blow takes a fifth but while it stands open after a move. A wing buffet up close, the bell's toll in a ring round it, a dive over the bell's frame, the roof's stones shaken down.
- **Drawn with:** the giant bat's sheets, in stone.
- **In the code:** stats `FOES.stoneWarden` and moves `BOSS_KITS.stoneWarden` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `belfry()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
