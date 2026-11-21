# Barrow Deeps: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Weaver

- **Where:** the Weaver's Web, under the Deeps (area `web`).
- **Who:** A giant spider in the tombs under the moor, keeping the deep seal and the second key.
- **Guards:** The Sinking Stair on down to the Drowned Hollow.
- **Its fall:** Drops the Silk Key, the Grey Gate's other key.
- **Moves:** A bite, a leap over anything, venom that burns on, webs that hold whoever walks into them, and her brood let down, four at most.
- **Drawn with:** the spider's sheets.
- **In the code:** stats `FOES.weaver` and moves `BOSS_KITS.weaver` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `web()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
