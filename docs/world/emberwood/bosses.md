# The Emberwood: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Ember Bull

- **Where:** the Ember Hollow, a round floor of ash walled by pines and ringed by the goblins' fires (area `trollpit`).
- **Who:** The lumber camp's own hauling bull, left in its traces the night the goblins came over the Palisade fence. The Grey was in the burning wood and the embers took to its hide and stayed; the goblins fed it, walled it in the hollow and called it lord. It gored the steward on the Ash Road, and the Keep's key hangs from its harness.
- **Guards:** The Crag Stair up to Tinker Crags.
- **Its fall:** Drops the Ember Key (`trollKey`), which opens the Keep Gate. Brenna's Grey-Iron Edge and the merchants' later stock come in. Wren goes shooting by Smoke Bluff; Fenn, Tam, Garth and Dunn each remark on it.
- **Moves:** A horn swipe and a stomp round him after it up close; from four tiles off a rush that ends a tile past the mark and leaves him open, never two running. The pines round the hollow stop a rush and daze him.
- **Drawn with:** the minotaur's sheets, ember-tinted.
- **In the code:** stats `FOES.minotaur` and moves `BOSS_KITS.minotaur` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `trollpit()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
