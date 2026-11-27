# Emberwood: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Ember Bull

- **Where:** the Ember Hollow, a pan of hot ash over the vents, walled by jungle and ringed by the goblins' fires (area `trollpit`).
- **Who:** One of the horned, the Citadel's oathsworn guard over its pits, and the one who left his post when the cold came up the Cut. He walked west to the warmest ground in Aurum and lay down in it until the hot ash took to his hide. The goblins, who dug under the horn for a hundred years, still obey one: they feed him, wall him in and call him lord. He met the steward on the Ash Road, and the Ember Key hangs from his harness. He is not taken. Folk think him a beast the goblins keep.
- **Guards:** The Crag Stair up to Brasscrag.
- **Its fall:** Drops the Ember Key (`trollKey`), which opens the Keep Gate. Brenna's Grey-Iron Edge and the merchants' later stock come in. Wren goes shooting by Smoke Bluff; Fenn and Dunn each remark on it.
- **Moves:** A horn swipe and a stomp round him after it up close; from three tiles off a rush that ends a tile past the mark and leaves him open, and sets the ash alight along its line, so every rush dodged leaves less floor. Past half he bellows, and each rush gets a second one after it, aimed at where the wanderer went. A note at the hollow's mouth says the ash burns.
- **Drawn with:** the minotaur's sheets, ember-tinted.
- **In the code:** stats `FOES.minotaur` and moves `BOSS_KITS.minotaur` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `trollpit()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
