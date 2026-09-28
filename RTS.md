# Greyfall as a real-time strategy game

Sep 26, 2026

## Summary

Greyfall moves from plan-then-battle rounds to real time, in three modes built on one tick-stepped simulation: **Rounds** (today's loop, with orders allowed during the battle), **Real time with pause** (solo), and **Real time** (no pause, the mode multiplayer would use later). The two sides become two knight clans, blue and red, and the island grows with free building placement. Every pattern below is taken from shipped RTS games, and every piece of art it needs is already in the Tiny Swords pack.

## Built

Landed on Sep 27, 2026.

- **Engine.** `createSim` steps the island a tick at a time; `battle()` and the new `startRound` / `roundDone` / `finishRound` run a round on it. Real time adds Pawn trips (10 gold a bag, never taxed), queues of up to 5, construction while a Pawn hammers, rally points, healing at home, and monster waves from minute 4. Gold is counted in tens throughout.
- **Free placement.** `canPlace` allows your own plateau or the lowland, never a ramp, forest, a mine's edge or a spot that walls off a road, a mine or a building; `findPlacement` is what the AI builds on.
- **Island.** 61x38, mirrored: home plateaus at mid-height with the ramp outside, the High Pass under the Crown, the Low Road past the watch cliffs to the ford, four mines a side plus the ford, forests and landmarks. Reworked the same day so both lanes get used; see below.
- **Two knight clans.** Red uses the pack's red knights, faces and buildings everywhere the monster host was.
- **Map screen.** A mode picker (Rounds, Real time with Space to pause, No pause); orders during a round's battle; a Pawn's build menu with a ghost footprint; training queues with cancel; right click sets a building's rally point; Ctrl+1-9 control groups; speed 1x/2x. The HUD redraws only the parts that changed, so a button is never rebuilt under the pointer.
- **Checks.** 81 engine tests, including placement, trips, queues, rally, construction, determinism and the real-time deadline; typecheck clean; asset check clean; all three modes driven in headless Chromium.
- **Numbers, 30 AI seeds.** Rounds: blue 5, red 10, draws 15; 367 of 467 battle phases hit the cap. Real time: blue 4, red 12, draws 14; matches end at 10.8 minutes on average. The High Pass was 48 steps and the Low Road 60, so play kept to the north (93% of fighter time in the middle).

Left for balance and later work: the draw rate and red's edge, the two roads' lengths, the AI's real-time play (it re-plans with its rounds logic every 5 seconds), units drawing over buildings they pass behind, a minimap for the bigger island, and lockstep multiplayer.

## Two lanes, both used

Sep 27, 2026. The bases sat at the top of the island, so the High Pass was 12 steps shorter than the Low Road and the south half went untouched. Melee map guides agree on the fix: attack paths of near-equal rush distance, each with its own reason to take it, and resources placed out between the bases so expanding pulls players into the map.

- **Bases at mid-height.** Each home plateau now spans rows 11-20, its ramp at its east side, so both lanes branch from one yard. Castle to castle is 52 steps over the High Pass and 50 by the Low Road; the pass costs two straight steps on its ramps, the price of its high ground.
- **A reason for each lane.** North: the Crown's high ground. South: the rich mine at the ford. Each side's expansions sit one toward each lane (north woods, south woods).
- **The AI picks a lane per push** from the seed and round, so it no longer always takes the shorter. 30 real-time seeds: fighters in the middle spend 43% of their time north, 57% south; blue 5, red 10, draws 15; 11.3 minutes on average.
- **Texture.** Seeded bushes and rocks strewn thicker along woods, shores and cliffs, hidden under any building placed on them; jittered, sometimes doubled forest trees; rocks in the shallows; a wooded islet in the lake; ragged coasts.

Sources: [SC2 level design: chokepoints and expansions](https://code.tutsplus.com/starcraft-ii-level-design-introduction-and-melee-maps--gamedev-3304t), [Time as a resource: multiplayer map design](https://waywardstrategy.com/2015/06/07/time-as-a-resource-part-2-multiplayer-map-design/), [Choke points in RTS games](https://game-design-snacks.fandom.com/wiki/Choke_points_in_Real_Time_Strategy_games_%E2%80%93_Helps_balance_gameplay).

## Fog of war

Sep 27, 2026. The match opens on the home plateau alone; the rest of the island is dark until someone walks there.

- **Warcraft's two layers.** Black where nobody has been, grey where someone has been but nobody looks now: terrain and enemy buildings as last seen, no enemy units ([Warcraft II's fog](http://classic.battle.net/war2/basic/fog.shtml)).
- **Sight in tiles** (`WAR.sight`): Pawn and Warrior 4, Lancer and Monk 5, Archer 6; castle 7, tower 8, other buildings 3-4. Pawns see least, so scouting costs a worker's trips.
- **Nobody sees up a cliff**, as in StarCraft II ([Liquipedia: High Ground](https://liquipedia.net/starcraft2/High_Ground_and_Low_Ground)): a scout below the enemy plateau sees the yard but not the castle, and the Crown hides whoever holds it.
- **Nothing is built on unexplored ground**, as in Warcraft.
- `visibleCells(state, side)` is pure engine code, so a server can filter what each player is sent; what a player has explored is the map scene's memory (`fog.ts`), drawn one texel a tile and stretched smooth.
- The red AI still sees the whole island.

## RTS patterns worth taking

| Pattern | Where it comes from | What Greyfall takes |
| --- | --- | --- |
| Deterministic lockstep: every machine runs the same simulation from the same commands, and only commands cross the network | Age of Empires, "1500 Archers on a 28.8" (GDC 2001): commands scheduled 2 turns ahead, 200 ms turns, seeded random numbers, checksums to catch desync | The engine already is one: seeded, integer grid, pure. Commands carry the tick they apply on, so lockstep can be added later without touching the rules |
| Fixed timestep, render interpolated | Glenn Fiedler, "Fix Your Timestep!" | The simulation steps at 10 ticks a second; the map scene slides sprites between ticks, so play looks smooth at any frame rate |
| Workers carry resources from mine to town hall | Warcraft III: a Peasant carries 10 gold a trip; 5 workers saturate a mine near its hall | Pawns dig at a mine, carry a bag back to the castle (the pack's Pawn "Run Gold" pose), and go again. A far mine means long, exposed trips |
| Upkeep as a tax on gathering | Warcraft III: 100% of gathered gold at 0-50 food, 70% at 51-80, 40% at 81-100 | Built, then removed on Sep 28, 2026: in AI-vs-AI runs it took 42% of all gold dug and was never shown to the player. Every bag pays 10, and rounds pay a flat base income |
| Production queues and train times | Warcraft III (Peasant 15 s), StarCraft | Each building queues up to 5 units, paid when queued, refunded when cancelled |
| Builders construct from outside | Warcraft III humans: the Peasant stands beside the site; walking away pauses the work | A Pawn walks to the site and hammers, but since Sep 28, 2026 the countdown starts when the building is placed, not when the Pawn arrives |
| Rally points | StarCraft, Warcraft: right click the ground with a building selected | Trained units walk to their building's rally point |
| Attack-move, stop, hold, shift-queue | StarCraft II conventions | Attack-move and hold exist; shift-queued waypoints come with the real-time modes |
| Control groups (Ctrl+number, number to recall) and an idle-worker key | StarCraft, Warcraft | Ctrl+1-9 to set, 1-9 to recall; F1 already picks Pawns |
| Group movement: a path per unit plus separation so groups do not stack | StarCraft II (GDC 2011, steering and flocking); howtorts pathing review | Kept grid-simple: one path per unit, friends pass through each other, and groups spread over separate tiles on arrival, as the engine does today |
| Build anywhere legal, not on fixed plots | Warcraft, StarCraft, Age of Empires | Free placement on buildable ground (own plateau and lowland), with a ghost footprint that turns red where a building cannot go |

Not taken: lumber (the pack supports it, see below; a later choice), navmeshes (the grid is small enough for breadth-first search).

## Checked against the pack

| Need | Asset | Verdict |
| --- | --- | --- |
| Two knight clans | `Units/Blue Units` and `Units/Red Units`: Warrior, Lancer, Archer, Monk, Pawn, same poses; `Buildings/Blue Buildings` and `Red Buildings`, all 8 | Yes. Purple, Yellow and Black clans are there too, for more players later |
| Worker trips | Pawn `Run Gold`, `Idle Gold`, `Interact Pickaxe` | Yes |
| Construction | Pawn `Interact Hammer`; no construction-stage building art | The building rises out of the ground, faded, as its countdown runs |
| Mine running low | `Gold Stone 1` to `6` | Yes: the mine shrinks as it empties |
| Projectiles and effects | `Arrow.png` per clan, Monk `Heal_Effect`, `Dust`, `Explosion`, `Fire` | Yes; fire is a one-shot burst, looped for a burning building |
| Health and selection | `UI Elements` bars, cursors, buttons, icons | Yes |
| Lumber, later | Pawn Axe and Wood poses, `Tree1`-`4`, stumps, `Wood Resource` | Supported if wanted |

## Design for Greyfall

- **One simulation, three modes.** The battle becomes a world that advances one tick at a time. Rounds runs it for a battle phase and stops, allowing orders while it runs. Real time runs it without end; Real time with pause stops it on Space and still takes orders.
- **Two knight clans.** Blue against red, both knights, everywhere the monster host appeared.
- **A larger island.** Room to build: big home plateaus, several expansion mines, the two roads kept.
- **Free placement.** Fixed plots go; a building goes wherever its footprint fits on buildable ground, without walling a mine or the castle off.
- **Real-time economy.** Pawns carry gold per trip, units train from queues, buildings take time and a Pawn.
- **The Greying by the clock.** In real time it starts at minute 8 and bites the halls every 30 seconds, harder each time, so a match still ends. Since replaced by monster waves from the Crown: from minute 4, one a minute, 2 more monsters each time, after the nearest player unit, 10 gold a kill.

## Sources

- [1500 Archers on a 28.8: Network Programming in Age of Empires and Beyond](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond), Terrano and Bettner, GDC 2001.
- [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/), Glenn Fiedler.
- [Warcraft III upkeep](http://classic.battle.net/war3/basics/upkeep.shtml) and [economy](http://classic.battle.net/war3/basics/economy.shtml), Blizzard's classic Battle.net guide.
- [Peasant (Warcraft III)](https://warcraft.wiki.gg/wiki/Peasant_(Warcraft_III)) and [Gold Mine (Warcraft III)](https://warcraft.wiki.gg/wiki/Gold_Mine_(Warcraft_III)), Warcraft Wiki.
- [How to RTS: pathing literature review](https://howtorts.github.io/2014/01/06/pathing-literature-review.html) and [Group Pathfinding and Movement in RTS Style Games](https://www.gamedeveloper.com/programming/group-pathfinding-movement-in-rts-style-games).
- [RTS control conventions](https://github.com/gunnargehtab/Echoes-of-the-Abyss/issues/435): attack-move, rally points, stop and hold, production queue.
- The Tiny Swords pack in `apps/web/public/tiny-swords`, listed on Sep 26, 2026.
