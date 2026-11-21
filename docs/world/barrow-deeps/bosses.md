# Graveroad: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Weaver

- **Where:** the Weaver's Web, under Graveroad (area `web`).
- **Who:** A spider grown old and large on the warmth coming up from the Hearth, nesting in the deepest cave past the end of the kings' grave-roads. The key Lanternport threw down the Old Well fell into her web, and she keeps it as she keeps anything that falls in. She is a beast, not taken, and does not talk.
- **Guards:** The Sinking Stair on down to Hearthdeep.
- **Its fall:** Drops the Silk Key, the Grey Gate's other key, out of her silk.
- **Moves:** A bite, a leap over anything, venom that burns on, webs that hold whoever walks into them, and her brood let down, four at most.
- **Drawn with:** the spider's sheets.
- **In the code:** stats `FOES.weaver` and moves `BOSS_KITS.weaver` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `web()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
