# Greyfall: the keepers

Each boss fights in an arena area of its own and holds the way on until it falls. Numbers live in the code, not here.

## The Grey Warlord

- **Where:** the Grey Keep, off Greyfall's crown (area `throne`).
- **Who:** The Citadel's last lord, who ordered the Deep Cut. When the cold came up it he set the warm stone the miners lifted out of the Hearth as a crown and put it on. It keeps him warm by drinking warmth from everything near him, so the Grey lies thickest round him. He has forgotten his name and kept his crown. He is not the Grey; he is the drain it runs into. Folk think he is the Grey itself.
- **Guards:** The Throne Stair up behind his throne to the Throne Isle.
- **Its fall:** Raises `warlordDead`: the crown stops drinking and the Grey thins; it does not go, because the Hearth is still under water. Maren sails, Penny is freed in the Gallows Yard, Ansel is back on the wall if he lived, Jory takes Tobin's place at the well, Dunstan feels his boards warm.
- **Moves:** A cleave, a lunge that ends at the mark, the Grey run along the ground to burn on, and past half his taken garrison called to him after every lunge. His crown drinks their warmth: he mends while any of them stands, so they go first.
- **Drawn with:** the Black Warrior's sheets, half again as big and tinted warm gold: the one thing in Greyfall that has kept its colour. His taken are Black Warriors tinted grey (`FOES.taken`).
- **In the code:** stats `FOES.warlord` and moves `BOSS_KITS.warlord` in [hero.ts](../../../packages/engine/src/hero.ts); the arena is `throne()` in [areas.ts](../../../packages/engine/src/areas.ts); its look, key and flag in `BEAST`, `BOSS_KEY` and `BOSS_FLAG` in [AtlasScene.ts](../../../apps/web/src/game/AtlasScene.ts).
