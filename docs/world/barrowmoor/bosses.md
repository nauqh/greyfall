# Kingsrest: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Barrow King

- **Where:** the King's Barrow under the moor, the throne hall alone round its ring of pillars; the Barrow Cave's lift lands in it (area `barrow`).
- **Who:** The eldest of the barrow-wardens, the masks, in an old king's bone face. Kingsrest buried the Horned Key with him in the King's Barrow when it barred the Grey Gate, and he will not lie down on it: he keeps the Old Law, and opening the gate east is digging toward the Cut. Folk think him one of the old kings risen.
- **Guards:** The King's Stair down to Graveroad's Great Barrow.
- **Its fall:** Drops the Horned Key (`hornedKey`), one of the Grey Gate's two keys. Corwin goes to dig his forty out of Barrow Field.
- **Moves:** Warded from all harm while the three grave totems round his hall stand. A hex burst under the mark, grave fire along the ground to it that burns on, and the dead raised, three at most.
- **Drawn with:** the hex shaman's sheets, huge.
- **In the code:** stats `FOES.barrowKing` and moves `BOSS_KITS.barrowKing` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `barrow()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
