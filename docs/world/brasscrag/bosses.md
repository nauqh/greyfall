# Brasscrag: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## Old Bamboo

- **Where:** the Tinker Peak, the rock's bamboo-ringed summit, a land of its own (area `peak`).
- **Who:** The bamboo-folk's grandsire, who walked the wheel that winds the Gnome Lift for the gnomes, paid in bamboo. The Grey came over the Sky Bridge and got into him at his wheel, the highest, coldest place on the rock; he is taken, and eats from habit. His cubs are not taken and stand round him, and run at the first blow.
- **Guards:** The Gnome Lift up to Sunhold.
- **Its fall:** Raises `bambooDead`: Moss and Pip go up to the peak, Fennick gives the Wheel Cog, and Brasscrag's folk remark on it.
- **Moves:** A roll, a belly slam, bamboo hurled, and his cubs called down; struck once, a cub runs off. After every throw he sits to eat, mending as he chews, until a blow startles him out of it. Past half he calls the cubs back.
- **Drawn with:** the panda's sheets.
- **In the code:** stats `FOES.oldBamboo` and moves `BOSS_KITS.oldBamboo` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `peak()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
