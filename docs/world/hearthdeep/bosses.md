# Hearthdeep: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Shell Below

- **Where:** the Shell Isle, off Hearthdeep's lake (area `shellisle`).
- **Who:** A turtle that came down for the warmth long ago and grew old and vast on it, asleep on its isle over the Hearth's warmest water. The Pilgrims at Pilgrims' Rest pray to it as the Hearth's keeper and want it woken. It is only a beast, and only warm.
- **Guards:** The Shell Stair up to Stillmere, shut from the fen until it falls.
- **Its fall:** Raises `shellDead`: the Pilgrim lies dead, and Ysolde walks home to the Upper Town and gives the Sister's Candle.
- **Moves:** No blade gets through its shell but while it stands open. A bite, a stamp round it, a spin that the lake stops dead and flips it open.
- **Drawn with:** the turtle's sheets.
- **In the code:** stats `FOES.shellBelow` and moves `BOSS_KITS.shellBelow` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `shellisle()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
