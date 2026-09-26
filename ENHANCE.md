# Greyfall enhancement plan

Sep 26, 2026 · @Wan

> Since Sep 27, 2026 the island, the economy and the modes have moved on: see [RTS.md](RTS.md). The 41x24 map and the fixed plots below are superseded by a 61x38 island with free placement, and the sides are two knight clans.

## Summary

Greyfall keeps its plan-then-battle rounds and adds a light layer of Warcraft: a new island with two roads over three land levels, bonfires to hold, neutral camps to clear, one hero, a real economy choice, and a Greying that eats the map instead of just the halls. Each change answers something 30 AI-vs-AI wars on today's map showed (`pnpm war`, seeds 1 to 30):

| Finding | Measured today | Answered by |
| --- | --- | --- |
| One road joins the bases; the west half is a dead end | 1 road | Two-road island |
| Red is favoured; blue's home mine sits on the only road | Red 29, blue 0, draws 1. Pawns lost: blue 449, red 29 | Mirrored island, home mine on the plateau |
| Battles run out the clock | 201 of 302 battle phases hit the 45 s cap | Bonfires as forward rally points and objectives; the cause still needs diagnosing |
| Gold piles up late | 31 of 302 rounds began with a side holding over 30 gold | Upkeep, trainable Pawns, the Keeper's revive cost |
| Stalemates end only by the Greying | The one draw went to round 17 | The Greying spreads over the map |

These are AI-vs-AI numbers, so they show what the rules and the map allow, not how people play. They were measured on `4b7ab95`. One commit earlier, before `cd4b147` made Pawns build from the plot's own plateau, the same seeds gave red 20, blue 5, draws 5, 231 of 339 phases capped, Pawns lost 403 vs 151 and 67 rounds over 30 gold. A pathing fix swinging blue from 5 wins to 0 points at the AI as much as the map, so that swing is diagnosed before it is used to justify a new island. The draft map is drawn on [The two-road island](https://claude.ai/artifact/7vdW13ihBKpNfqS1gdjg4H).

## Built so far

Phases 0 to 3 landed on Sep 26, 2026; bonfires, camps, the Keeper and the spreading Greying are next, once the island has been played.

- **Island.** The 41x24 island is in the engine with levels 0 to 3, forest, ramps and stairs, drawn per level in `islandMap.ts` after the pack's tilemap guide, which was read directly this time: a ramp stands just outside the ground it climbs to, beside its bottom row and cliff, with nothing drawn behind it; the Crown sits on a level-2 shelf on every side; plateau sides step down so their edges show cliffs.
- **Warcraft dressing.** Dirt roads (`Tilemap_color4`) traced from the engine's own two roads across the lowland, forest borders and a forest islet, and neutral landmarks from the Enemy Pack on forest or water: a cave, goblin hut, gnome hut and tower, skull spikes, a dead tree, a fish hut and water towers.
- **Economy.** The castle trains Pawns (4 gold, up to 6), sent to the next mine with room: home, yard, then the ford. Dead Pawns stay dead unless a side has none. Upkeep sets base income 10 / 7 / 4 by fighters. Supply 8 + 4 per house, up to 20.
- **Numbers after the change** (30 seeds, AI against AI): blue 17, red 11, draws 2; 190 of 307 battle phases hit the cap; Pawns lost 347 vs 355; no round began with a side over 30 gold; matches end in round 10 on average.

## What stays

The core loop and its limits stay as they are; every new system has to fit inside them.

- **Rounds.** Plan with the world frozen, then both plans play out at once. Rounds repeat until a main hall falls.
- **One click order.** Click ground to move, click an enemy to attack it, right click a mine to gather. Nothing is commanded during a battle, so new systems use passives and auras, never aimed spells.
- **Roster and rules.** The 5 classes, their counters, the two stances (Stand firm, Fall back), the settle rule, and determinism: the same state, plans and seed always give the same result.
- **Art.** The Tiny Swords pack plus effects made in code. Everything below reuses pack art (grey tints, fire, trees, stairs, ribbons), so nothing needs new sprites.
- **Non-goals.** No fog of war, no shops or items, no monetisation.

## The two-road island

The new island is 41x24 tiles, mirrored left to right, with three land levels and two roads of equal length over different ground. Blue holds the west, red the east. The full draft, with both roads traced and a tile readout, is on [The two-road island](https://claude.ai/artifact/7vdW13ihBKpNfqS1gdjg4H).

|  | High Pass (north) | Low Road (south) |
| --- | --- | --- |
| Castle to castle | 34 steps | 34 steps |
| Ground | Up a ramp onto a ridge (level 2), under the Crown (level 3), down the far ramp. The ridge drops into a lake, so there is no way around it | Flat fields, forest groves that split a column, and a river crossed at one ford |
| Narrowest point | 1-tile ramps; 2 tiles wide under the Crown | The ford, 3 tiles wide |
| Watched from | The Crown, 2 to 3 tiles from the pass | Both watch cliffs, 2 to 4 tiles from the ford |
| Prize | The Crown, the highest ground on the map | The rich mine, 120 gold |
| Suits | Small forces, Archers and Lancers holding a choke | Big melee armies, flanks around the groves |

### Landmarks

Coordinates are for blue's half; red's mirror sits at column 40 minus the column.

- **Home plateau** (level 2, cols 2-11 at rows 5-6, stepping in to cols 2-9 below): 61 tiles, the same for both sides. One ramp at (10,10), outside the plateau. The castle and home mine (2,7) sit on top, so Pawns dig out of reach until the ramp falls.
- **Yard** (level 1, cols 4-13, rows 11-14): below the ramp, where the roads split, with the yard mine at (5,13) and a cave in the woods behind it.
- **North corridor** (level 1, cols 10-15, rows 5-9): beside the home plateau's east step. Archers on the plateau shoot into it; melee in it cannot hit back.
- **Ridge** (level 2, cols 15-25 at rows 2-3, cols 16-24 below): the High Pass. Ramps at (15,8) and (25,8), outside the ridge.
- **The Crown** (level 3, cols 18-22, rows 3-5): 15 tiles, stairs at (17,5) and (23,5), on a level-2 shelf on every side. Drawn in the darkest ground colour, where the grey is thickest.
- **Lake** (centre, rows 9-16): splits north from south. Away from the yards, nothing on one road can reach the other.
- **Watch cliff** (level 2, cols 15-17, rows 15-16): a 6-tile archer nest, its ramp at (18,16) facing the ford.
- **Groves** (forest, cols 10-12, rows 17-18): trees block walking, not arrows.
- **Ford and rich mine** (cols 19-21, rows 17-19): the Low Road's only crossing. The mine at (20,20) has 3 digging spots on the ford's south row.

### Measured on the draft

- 458 walkable tiles, none unreachable; mirrored tile for tile (checked in the tests).
- Exactly two roads: block either and the bases still connect, block both and they do not.
- Castle to castle is 34 steps over the High Pass and 38 by the Low Road, which dips under the watch cliff; the draft had 34 both ways, before the ramps moved outside their plateaus. Evening them out is balance work.
- From the foot of the home ramp: 6 steps to the ridge ramp, 13 to the ford and to the Crown's top, 15 to the watch cliff top.

### What the art allows

Checked against the pack in `apps/web/public/tiny-swords` on Sep 26, 2026, with a composite of the draft's Crown and west half built from the pack's own tiles and `islandMap.ts`'s layer rules (flat ground, a shadow a tile down, elevated tops, cliff walls in the colour of the ground they stand on, ramps last), repeated once per level.

- **Level 3 draws.** Each `Tilemap_colorN.png` is a 9x6 sheet of 64 px tiles: flat ground, the two ramp pieces, elevated tops and a cliff wall for grass or for water. Repeating the elevated layer on a level-2 top, with the wall in level 2's colour, reads as a clear third step. The Crown's stairs are the same ramp pieces in the Crown's colour.
- **Colours.** Lowland `color3` (deep green, as today), level 2 `color1` (sunlit, as today), the Crown `color5` (teal-grey, the darkest). `color2` and `color4` are spare.
- **Faces.** The pack has south cliff walls only, as the engine assumes; east and west plateau edges are a grass rim with no wall, as on today's map. Mirroring left to right keeps every ramp on a south face.
- **Plateau room.** 53 tiles per home plateau, between today's blue (58) and red (29, which already fits all 8 plots and their lanes).
- **Trees.** `Tree1` to `Tree4`, animated sheets already loaded as decor; forest tiles need only placement.
- **Camps.** `Units/Black Units` has the full roster (Warrior, Archer, Lancer, Monk, Pawn), and `Black Buildings` is already the Greying set, so camps need a tint and no new sprites.
- **Bonfires.** `Particle FX/Fire_01` to `03` are one-shot bursts that burn out into smoke, not a looping campfire. A lit bonfire loops the rising frames or is drawn in code; `Rock1` to `Rock4` make the ring.
- **The Keeper.** Small ribbons come in five colours. The host's Warrior is already the Skull, so a scaled Skull would read as a big Warrior: the host's Keeper is the Minotaur (idle, walk, attack, avatar). The covenant's is the Yellow (gold) Warrior at 1.3 times, which stands apart from its own blue Warriors.
- **Grey ground.** Phaser 3.90 is installed, so grey tiles can be a tint or a colour-matrix effect in code; the scene already tints units and faces grey.
- **Not found.** No stairs sprite apart from the ramp pieces, no bridge, no looping fire.

## Bonfires

Four bonfires on neutral ground turn the Keeper story into objectives: one on the Crown (20,4), one at the ford (20,18), and one on each watch cliff (16,15) and (24,15). A bonfire marks a tile but does not block it.

- **Lighting.** At the end of a battle phase, a bonfire goes to the side with a fighter within 2 tiles, if the other side has none there. Both present: it stays as it was. Today's mine raid (`incomeFor`) has the distance test but is one-sided and runs at round start; the contested version is new, and like the raid it ignores Pawns and Monks.
- **A lit bonfire:**
  - pays its side 2 gold at the start of each round;
  - heals that side's units ending the round within 2 tiles to full, like the home plateau;
  - is a rally point: a production building can send the units it trains this round toward a lit bonfire; they walk there from the building.
  - shelters the ground within 3 tiles from the spreading Greying (see below).
- **Losing one.** It changes hands when the enemy lights it. It has no HP and cannot be destroyed.
- **Why.** It gives the middle game places worth holding, a way back for the side that is behind, and shorter marches, which should cut how often battles hit the 45 s cap.
- **Art.** The rising frames of the pack's fire burst, looped, over a ring of pack rocks; the flame is tinted to its side's colour, grey when unlit.

## Greyed camps

Every bonfire starts guarded by a camp of hollowed knights, which gives rounds 1 to 3 something to do while the AI holds back, the way creeping does in Warcraft.

| Camp | Guards | Units | Bounty |
| --- | --- | --- | --- |
| The Crown | Crown bonfire | 2 Warriors, 2 Archers | 10 gold |
| The ford | Ford bonfire and the rich mine | 3 Warriors, 1 Lancer | 6 gold |
| Each watch cliff | Its bonfire | 1 Lancer, 1 Archer | 6 gold |

- **Behaviour.** Neutral, kept as their own list in the match state rather than a third `WarSide`: gold, income, losses and the odd/even unit ids are all keyed on two sides. Camp units attack anyone within 2 tiles of their camp, never chase further, and walk back when nothing is in reach. Stats are 80% of a trained unit's.
- **Clearing.** The bounty goes to the side whose unit kills the last camp member. A bonfire can be lit only once its camp is gone, and the rich mine pays nobody while its camp stands. Camps never come back.
- **Why the Crown is hardest.** Its archers stand on level 3, so attackers from the ridge deal 25% less; taking it is a real early investment.
- **The AI** clears the nearest camp from round 1 when its army's value is at least 1.5 times the camp's.
- **Art.** The Black knights (the Forsaken) drawn with a grey tint, so no new sprites. The PRD's death effect, a grey soul floating up, already fits them.

## The Keeper

Each side gets one hero, the Keeper: a single unit worth caring about, which grows over the match and makes the army around it stronger. It has no aimed spells, since nothing is commanded during a battle.

- **Getting one.** Trained at the castle, which trains nothing today: 5 gold, 2 supply, one at a time.
- **Body.** The covenant's Keeper is the pack's Yellow (gold) Warrior at 1.3 times the size with a small pack ribbon over its head. The monster host's is the Minotaur, since its Warrior is already the Skull.
- **Level 1.** 200 HP, 16 damage, melee. Like the Monk it counters nothing and nothing counters it.
- **Aura.** Allied fighters within 2 tiles deal 15% more damage; 20% at level 2, 25% at level 3.
- **Experience.** 1 point for each enemy fighter that dies within 3 tiles of it, 2 for each camp cleared nearby. Level 2 at 3 points, level 3 at 8. Each level also adds 25% HP and 3 damage.
- **Death.** It returns beside the castle at the start of a later round once its side pays 3 gold per level. It keeps its level.
- **Stance.** Fall back by default, so a new player does not lose it in the first fight.
- **Why.** A unit with a name and a level is most of what makes Warcraft feel like Warcraft, and the revive price is a gold sink that grows with success.

## Trainable Pawns and expansions

Pawns become trainable, which brings in Warcraft's core economy choice: spend on miners now for gold later, or spend on the army.

- **Training.** The castle trains Pawns for 4 gold and 1 supply each, up to 6 per side. Each side still starts with 3.
- **Why a second mine.** A mine takes 3 Pawns, so Pawns 4 to 6 need another mine: the rich mine at the ford (120 gold, once its camp is cleared) or a small mine in each yard (40 gold).
- **Income.** Unchanged: 2 gold per Pawn per round, so a Pawn pays for itself in 2 rounds while its mine lasts.
- **Death.** Pawns no longer come back for free. A side left with no Pawns gets one free beside the castle each round, so nobody is locked out of the economy.
- **Raids matter again.** With the home mine on the plateau, the exposed Pawns are the ones a player chose to send out to the ford or the yard.

## Upkeep and supply

Upkeep replaces the hard stop at 15 supply: a bigger army lowers your base income, so banking gold and maxing the army are both choices with a cost.

| Fighters (Pawns not counted) | Base income per round |
| --- | --- |
| 0 to 6 | 10 gold |
| 7 to 10 | 7 gold |
| 11 or more | 4 gold |

- **Supply.** The start rises from 7 to 8 and each house gives 4 instead of 3, so three houses reach a cap of 20. That fits 6 Pawns, the Keeper's 2 and 12 fighters.
- **On screen.** The HUD shows the upkeep tier next to gold ("Upkeep: none / low / high"), and the round report names it when it drops income.
- **Why.** A side that is behind keeps full income and can catch up; a side sitting on a big army pays for it. Together with Pawns and the Keeper's revive, late gold has somewhere to go.

## The Greying spreads

The Greying becomes a clock you can see on the map: from round 6 it creeps inland from the water one ring of tiles every other round, and only lit bonfires hold it back.

| Round | Ground that turns grey | Land tiles on the draft |
| --- | --- | --- |
| 6 | Tiles 1 step from water | 163 |
| 8 | 2 steps | 155 |
| 10 | 3 steps | 114 |
| 12 | 4 steps | 68 |
| 14 | 5 steps, the last open ground | 40 |

- **On grey ground,** a unit that ends the round there loses 20% of its max HP, nothing heals, and a mine stops paying.
- **Shelter.** Tiles within 3 of a lit bonfire stay clear while it burns. The rich mine is 2 tiles from the ford bonfire, so it pays only while that bonfire is lit. Home plateaus never turn grey.
- **Halls.** Today's bite on both main halls from round 12 stays as the backstop, so no match outlasts round 17.
- **Why.** Turtling loses ground by itself, holding bonfires matters more each round, and the end of a match shows on the map before it arrives.
- **Art.** Grey tiles are the same tiles desaturated in code, the PRD's region colour idea turned into the clock. The HUD shows which ring goes next.

## Starting numbers

Every new value lives in `balance.ts` next to today's, so tuning stays a one-file job. These are first guesses for the headless runs to correct.

| System | Setting | Today | Proposed |
| --- | --- | --- | --- |
| Map | Size | 32x20 | 41x24 |
| Map | High ground | Attacker on a lower level: x0.75 | Same rule, now across 3 land levels |
| Bonfires | Count, light radius | None | 4, within 2 tiles |
| Bonfires | Income, heal | None | 2 gold per round, full heal within 2 tiles |
| Camps | Stats, leash | None | 80% of trained units, 2 tiles |
| Camps | Bounty | None | 6 gold, Crown 10 |
| Keeper | Cost, supply | None | 5 gold, 2 supply |
| Keeper | Level 1 stats | None | 200 HP, 16 damage, melee |
| Keeper | Aura by level | None | +15%, +20%, +25% damage within 2 tiles |
| Keeper | Level up, revive | None | 3 and 8 points; 3 gold per level |
| Pawns | Cost, limit | Not trained, 3 | 4 gold, 6 |
| Pawns | Respawn | Free next round | Only when a side has none |
| Mines | Gold held | Home 60, middle 120 | Home 60, ford 120, yards 40 |
| Economy | Base income | 10 | 10 / 7 / 4 by fighters (0-6 / 7-10 / 11+) |
| Supply | Start, per house, cap | 7, 3, 15 | 8, 4, 20 |
| Greying | Spread | Halls only, from round 12 | One ring every 2 rounds from round 6; halls from round 12 |
| Greying | Grey ground | None | 20% max HP per round, no healing, no mining |
| Greying | Bonfire shelter | None | 3 tiles |
| Battle | Phase cap | 45 s | 45 s, revisited after the island's headless run |

## Changes by file

Most of the work is in the engine, which stays a pure function; the map scene then draws what the engine decides.

| File | Change | For |
| --- | --- | --- |
| `packages/engine/src/island.ts` | New 41x24 `MAP`; tiles `^` summit, `[` `]` summit stairs, `T` forest; `level()` 0 to 3; a cliff face is any tile under higher ground (`castsCliff` and `isWalkable` only look for `#` today); stairs change one level. `isHigh`, `plateauOf` and `isHome` equate high with level 2 and need a level-aware rule. New `PLOTS`, `MINES`, bonfire and camp positions, and each tile's grey round from its distance to water | Island, Greying |
| `packages/engine/src/balance.ts` | The new values in Starting numbers; `WAR.trains` maps a building to one class, so the castle's Pawn and Keeper need a list; a supply cost per class | All |
| `packages/engine/src/war.ts` | Match state gains bonfire owners, camps, the Keeper's level and points; castle trains Pawns and the Keeper; upkeep income; `supplyUsed` counts supply cost, not units, so the Keeper takes 2; rally target on production buildings | Economy, Keeper, bonfires |
| `packages/engine/src/battle.ts` | Camp units as a separate list; aura; experience; at phase end: bonfire lighting, bounties, grey damage. New events `lit`, `campCleared`, `levelUp`, `greyed`. High ground already compares levels, so it covers level 3 unchanged (a flat x0.75, however many levels below) | Camps, Keeper, bonfires, Greying |
| `packages/engine/src/ai.ts` | Rally and siege tiles from map data instead of constants; picks a road per attack; clears camps early; takes bonfires; buys Pawns and the Keeper; respects upkeep | All |
| `packages/engine/test/war.test.ts` | Mirror symmetry, exactly two roads, a lane from every plot to its ramp, no unreachable tiles, bonfire and camp rules, upkeep tiers, grey spread | All |
| `packages/engine/src/warCli.ts` | Print bonfires, camps, the Keeper and the grey front; a flag to print the map | All |
| `apps/web/src/game/islandMap.ts` | Draws the terrain today, knowing only `#` and one tileset (`Tilemap_color3`): one shadow plus elevated-ground layer per level, a colour per level, stairs, trees on forest tiles, grey tiles | Island, Greying |
| `apps/web/src/game/IntroScene.ts` | The title screen frames a corner of the war map with fixed columns and rows, including a Pawn at today's blue mine; reframe it on the new island | Island |
| `apps/web/src/game/StrategicScene.ts` | Bonfire fire, grey-tinted camps, the Keeper's scale and ribbon, playback of the new events | All visuals |
| `apps/web/src/game/StrategicHud.ts` | Castle card with Pawn and Keeper, upkeep tier, bonfires held, grey countdown | Economy, Keeper, bonfires, Greying |
| `apps/web/src/game/art.ts` | Load the per-level ground colours and the fire effect | Island, bonfires |
| `apps/web/src/game/tutorial.ts` | Steps for camps, bonfires and choosing a road | All |
| `PRD.md` | Rewrite the affected sections once the open decisions are settled | All |

## Build order

The island comes first because every other system is placed on it; after that, each system lands alone so its effect shows up in the numbers.

Each phase's gate is 30 AI-vs-AI seeds compared against the numbers in Summary. Every phase also has to pass `pnpm test` and `pnpm typecheck`, and the map screen is played through before the next phase starts.

0. **Art check.** A test patch in the map scene: lowland, a plateau with the Crown on top, stairs beside a cliff, shadows one tile down. Decides whether level 3 goes ahead.
1. **Engine island.** The engine terrain, the plots and mines on the new plateaus, and the AI's rally and siege tiles, all headless before any drawing.
2. **Map scene.** Each level autotiled in its own colour, stairs, trees, the title screen reframed, tutorial lines updated.
3. **Economy.** Upkeep and trainable Pawns together, since both change what gold buys.
4. **Bonfires and camps.**
5. **The Keeper.** Its gate watches the win split for snowballing.
6. **The Greying spreads.** Last, because it changes how every match ends and needs bonfires to exist.

## Risks

The biggest risk is choosing a road: with both the same length, one click on the enemy castle always takes the same one.

| Risk | Mitigation |
| --- | --- |
| Clicking the enemy castle always takes the pathfinder's tie-break road | First version: stage, then strike (send the army to the ridge or the ford, click the castle next round). Later: a waypoint click on the drawn path |
| Units jam on the 1-tile ramps and the 2-tile squeeze under the Crown | The PRD already flags ramp jams. Friendly units walk through each other; test headless in phase 1 before drawing anything |
| The Crown becomes a turtle spot | Only 17 tiles, stairs from both sides, a 25% high-ground penalty, and the spreading grey makes waiting costly |
| Level 3 does not look right in the pack's art | A composite from the pack's tiles reads well (What the art allows); phase 0 confirms it in the live scene. Fallback: keep two land levels and make the Crown a plain plateau |
| Too many systems for a new player | Each lands in its own phase with its own tutorial step; any phase that does not pay off in the numbers is dropped |
| The Keeper snowballs: the first to level wins | Its aura and level bonuses are small, and it only gains points from kills near it. Phase 5's gate watches the win split |
| Camps make the neutral side a third player in `battle()` | Camps are their own list, not a third `WarSide`; they never leave a 2-tile leash and never target buildings |
| Screen size | The world is 28% wider and 20% taller, so the fully zoomed-out view is about 15% smaller than today. The minimap was removed because the small island fit on screen zoomed out; the bigger island reopens that |
| Code tied to today's map | AI rally points, tutorial text, war tests, the CLI and the title screen all use today's coordinates; phases 1 and 2 replace them |
| Plateau sides have no cliff wall | East and west edges are a grass rim, as today; the engine already forbids walking across them, and the level colours mark them |

## Decisions

Settled on Sep 26, 2026, all on the recommended choice.

- [x] AI imbalance: diagnose blue's 0 wins since `cd4b147` before phase 1, and remeasure the baseline after the fix.
- [x] Scope: phases 0 to 3 (island and economy), then play it and decide on bonfires, camps, the Keeper and the spreading Greying.
- [x] Level 3: keep the Crown, subject to phase 0 in the live scene.
- [x] Map size: 41x24 as drafted.
- [x] Home mine: on the home plateau.
- [x] Forest: terrain that blocks walking, not arrows.
- [x] Choosing a road: stage then strike now, waypoints later.
- [x] Yard mines: add them, 40 gold each.
- [x] Rally to a lit bonfire: units walk from their building.
- [x] Minimap: decide after phase 2, once the island is drawn.

## Sources

- [Tiny Swords tilemap guide](https://pixelfrog-assets.itch.io/tiny-swords/devlog/1138989/tilemap-guide), Pixel Frog. Read through search results only; the claims it supports were then checked against the pack itself (What the art allows).
- [Tinyswords tileset guide for AI](https://dwzeref.itch.io/tinyswords-tileset-guide), a community summary of the same rules.
- Game numbers: 30 runs of `pnpm war` at `4b7ab95` and at `8677964`, seeds 1 to 30, and a scratch check of the draft map using the engine's walking rules.
