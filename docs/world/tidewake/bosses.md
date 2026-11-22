# Tidewake: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Cinder Troll

- **Where:** the Bull's Ring, a cavern past Tidewake's tunnels, walked straight into with no fog (area `ring`).
- **Who:** The Ring's keeper, and the first fight that is a lesson. The folk call him the troll in the Ring. A troll sits where water runs warm, and the Hearth's water comes up through the Ring's floor; he is not guarding the boat, it is only in his way. In game, why he is there is not told.
- **Guards:** The Boat to Lanternport.
- **Its fall:** Falling to him washes the wanderer up at Lanternport's fire (`bullWon`), and Ferrow remarks on it. Killing him is worth an ember more, for good.
- **Moves:** Club slam, charge, the outflow's hot water flung to scald where it lands, all warned long and light. A charge cut short by the Ring's rocks leaves him dazed and open; a note at the Ring's mouth says so.
- **Drawn with:** the troll's sheets.
- **In the code:** stats `FOES.troll` and moves `BOSS_KITS.troll` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `ring()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
