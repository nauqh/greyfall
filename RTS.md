# Greyfall as a real-time strategy game

Sep 26, 2026

## Summary

Greyfall moves from plan-then-battle rounds to real time, in three modes built on one tick-stepped simulation: **Rounds** (today's loop, with orders allowed during the battle), **Real time with pause** (solo), and **Real time** (no pause, the mode multiplayer would use later). The two sides become two knight clans, blue and red, and the island grows with free building placement. Every pattern below is taken from shipped RTS games, and every piece of art it needs is already in the Tiny Swords pack.

## Built

Landed on Sep 27, 2026.

- **Engine.** `createSim` steps the island a tick at a time; `battle()` and the new `startRound` / `roundDone` / `finishRound` run a round on it. Real time adds Pawn trips (10 gold a bag, taxed 100% / 70% / 40% by upkeep), queues of up to 5, construction while a Pawn hammers, rally points, healing at home, and the Greying from minute 8. Gold is counted in tens throughout.
- **Free placement.** `canPlace` allows your own plateau or the lowland, never a ramp, forest, a mine's edge or a spot that walls off a road, a mine or a building; `findPlacement` is what the AI builds on.
- **Island.** 61x38, mirrored: stepped home plateaus with the ramp outside, the High Pass under the Crown, the Low Road past the watch cliffs to the ford, four mines a side plus the ford, forests and landmarks.
- **Two knight clans.** Red uses the pack's red knights, faces and buildings everywhere the monster host was.
- **Map screen.** A mode picker (Rounds, Real time with Space to pause, No pause); orders during a round's battle; a Pawn's build menu with a ghost footprint; training queues with cancel; right click sets a building's rally point; Ctrl+1-9 control groups; speed 1x/2x. The HUD redraws only the parts that changed, so a button is never rebuilt under the pointer.
- **Checks.** 81 engine tests, including placement, trips, queues, rally, construction, determinism and the real-time deadline; typecheck clean; asset check clean; all three modes driven in headless Chromium.
- **Numbers, 30 AI seeds.** Rounds: blue 5, red 10, draws 15; 367 of 467 battle phases hit the cap. Real time: blue 4, red 12, draws 14; matches end at 10.8 minutes on average. The High Pass is 48 steps and the Low Road 60.

Left for balance and later work: the draw rate and red's edge, the two roads' lengths, the AI's real-time play (it re-plans with its rounds logic every 5 seconds), units drawing over buildings they pass behind, a minimap for the bigger island, and lockstep multiplayer.

## RTS patterns worth taking

| Pattern | Where it comes from | What Greyfall takes |
| --- | --- | --- |
| Deterministic lockstep: every machine runs the same simulation from the same commands, and only commands cross the network | Age of Empires, "1500 Archers on a 28.8" (GDC 2001): commands scheduled 2 turns ahead, 200 ms turns, seeded random numbers, checksums to catch desync | The engine already is one: seeded, integer grid, pure. Commands carry the tick they apply on, so lockstep can be added later without touching the rules |
| Fixed timestep, render interpolated | Glenn Fiedler, "Fix Your Timestep!" | The simulation steps at 10 ticks a second; the map scene slides sprites between ticks, so play looks smooth at any frame rate |
| Workers carry resources from mine to town hall | Warcraft III: a Peasant carries 10 gold a trip; 5 workers saturate a mine near its hall | Pawns dig at a mine, carry a bag back to the castle (the pack's Pawn "Run Gold" pose), and go again. A far mine means long, exposed trips |
| Upkeep as a tax on gathering | Warcraft III: 100% of gathered gold at 0-50 food, 70% at 51-80, 40% at 81-100 | Real-time modes tax each bag: 100% / 70% / 40% by fighters (0-6 / 7-10 / 11+). Rounds keep today's base-income tiers |
| Production queues and train times | Warcraft III (Peasant 15 s), StarCraft | Each building queues up to 5 units, paid when queued, refunded when cancelled |
| Builders construct from outside | Warcraft III humans: the Peasant stands beside the site; walking away pauses the work | A Pawn walks to the site and hammers; the building rises while it stays |
| Rally points | StarCraft, Warcraft: right click the ground with a building selected | Trained units walk to their building's rally point |
| Attack-move, stop, hold, shift-queue | StarCraft II conventions | Attack-move and hold exist; shift-queued waypoints come with the real-time modes |
| Control groups (Ctrl+number, number to recall) and an idle-worker key | StarCraft, Warcraft | Ctrl+1-9 to set, 1-9 to recall; F1 already picks Pawns |
| Group movement: a path per unit plus separation so groups do not stack | StarCraft II (GDC 2011, steering and flocking); howtorts pathing review | Kept grid-simple: one path per unit, friends pass through each other, and groups spread over separate tiles on arrival, as the engine does today |
| Build anywhere legal, not on fixed plots | Warcraft, StarCraft, Age of Empires | Free placement on buildable ground (own plateau and lowland), with a ghost footprint that turns red where a building cannot go |

Not taken: fog of war (a non-goal in ENHANCE.md), lumber (the pack supports it, see below; a later choice), navmeshes (the grid is small enough for breadth-first search).

## Checked against the pack

| Need | Asset | Verdict |
| --- | --- | --- |
| Two knight clans | `Units/Blue Units` and `Units/Red Units`: Warrior, Lancer, Archer, Monk, Pawn, same poses; `Buildings/Blue Buildings` and `Red Buildings`, all 8 | Yes. Purple, Yellow and Black clans are there too, for more players later |
| Worker trips | Pawn `Run Gold`, `Idle Gold`, `Interact Pickaxe` | Yes |
| Construction | Pawn `Interact Hammer`; no construction-stage building art | The building rises out of the ground, faded, while a Pawn hammers |
| Mine running low | `Gold Stone 1` to `6` | Yes: the mine shrinks as it empties |
| Projectiles and effects | `Arrow.png` per clan, Monk `Heal_Effect`, `Dust`, `Explosion`, `Fire` | Yes; fire is a one-shot burst, looped for a burning building |
| Health and selection | `UI Elements` bars, cursors, buttons, icons | Yes |
| Lumber, later | Pawn Axe and Wood poses, `Tree1`-`4`, stumps, `Wood Resource` | Supported if wanted |

## Design for Greyfall

- **One simulation, three modes.** The battle becomes a world that advances one tick at a time. Rounds runs it for a battle phase and stops, allowing orders while it runs. Real time runs it without end; Real time with pause stops it on Space and still takes orders.
- **Two knight clans.** Blue against red, both knights, everywhere the monster host appeared.
- **A larger island.** Room to build: big home plateaus, several expansion mines, the two roads kept.
- **Free placement.** Fixed plots go; a building goes wherever its footprint fits on buildable ground, without walling a mine or the castle off.
- **Real-time economy.** Pawns carry gold per trip, upkeep taxes each bag, units train from queues, buildings take time and a Pawn.
- **The Greying by the clock.** In real time it starts at minute 8 and bites the halls every 30 seconds, harder each time, so a match still ends.

## Sources

- [1500 Archers on a 28.8: Network Programming in Age of Empires and Beyond](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond), Terrano and Bettner, GDC 2001.
- [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/), Glenn Fiedler.
- [Warcraft III upkeep](http://classic.battle.net/war3/basics/upkeep.shtml) and [economy](http://classic.battle.net/war3/basics/economy.shtml), Blizzard's classic Battle.net guide.
- [Peasant (Warcraft III)](https://warcraft.wiki.gg/wiki/Peasant_(Warcraft_III)) and [Gold Mine (Warcraft III)](https://warcraft.wiki.gg/wiki/Gold_Mine_(Warcraft_III)), Warcraft Wiki.
- [How to RTS: pathing literature review](https://howtorts.github.io/2014/01/06/pathing-literature-review.html) and [Group Pathfinding and Movement in RTS Style Games](https://www.gamedeveloper.com/programming/group-pathfinding-movement-in-rts-style-games).
- [RTS control conventions](https://github.com/gunnargehtab/Echoes-of-the-Abyss/issues/435): attack-move, rally points, stop and hold, production queue.
- The Tiny Swords pack in `apps/web/public/tiny-swords`, listed on Sep 26, 2026.
