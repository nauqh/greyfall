# Sunhold: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Sun Sentinel

- **Where:** the Sun Hall, hung in the sky between the city's crown and the Throne Isle (area `sunhall`).
- **Who:** Sunhold's keeper of the Sun Hall, behind its shield. The hoard heaped in the hall keeps the isles in the air; the Sentinel guards the city's height, not its treasure. Who rules Sunhold now the gnome-kings are not seen is left open.
- **Guards:** The Gilded Span over to the Throne Isle.
- **Its fall:** Drops the Sun Key, which unbars the Gilded Span.
- **Moves:** Its shield parries every blow from the side it faces, so it is beaten from behind. A thrust that runs it past you, a sunburst ring, sunfire that burns on. Past half it throws the shield down with a flare round it: every blow lands from then on, but it winds up in half the time.
- **Drawn with:** the yellow lancer's sheets, behind its shield.
- **In the code:** stats `FOES.sunSentinel` and moves `BOSS_KITS.sunSentinel` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `sunhall()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
