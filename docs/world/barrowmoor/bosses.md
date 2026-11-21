# Barrowmoor: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Barrow King

- **Where:** the King's Barrow under the moor, the throne hall alone round its ring of pillars; the Barrow Cave's lift lands in it (area `barrow`).
- **Who:** One of the old kings, on the King's Barrow, keeping the barrow seal for the Citadel's house.
- **Guards:** The King's Stair down to the Deeps' Great Barrow.
- **Its fall:** Drops the Horned Key (`hornedKey`), one of the Grey Gate's two. Corwin goes to dig his forty out of Barrow Field.
- **Moves:** Warded from all harm while the three grave totems round his hall stand. A hex burst under the mark, grave fire along the ground to it that burns on, and the dead raised, three at most.
- **Drawn with:** the hex shaman's sheets, huge.
- **In the code:** stats `FOES.barrowKing` and moves `BOSS_KITS.barrowKing` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `barrow()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
