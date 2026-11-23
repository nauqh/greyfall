# The Atlas

Aurum and the game played on it. The game comes first, the world
second, the opening last. The map reference is in
[docs/atlas-map.md](docs/atlas-map.md).

## The game

A Souls-structured action RPG. You lead a small warband through Aurum with Diablo-style control and maze maps, and Dark Souls structure:
bonfires, shortcuts, keys, bosses, and gold you drop when you die.

The world is the Atlas below: three tiers of areas joined by gates and
lifts, each area its own large map. This section is the design of the game played
on it. The numbers are starting values, to be tuned once it is playable.

### The pitch

You come ashore at Lanternport with no name and no lord. With a band of up
to three companions you push out through Aurum, take the boss keys, open
the Grey Gate, and put an end to the thing the Grey made of the Citadel's
last lord. Every road loops back to the bonfire in Lanternport square.


### Controls

Keyboard and mouse after Dark Souls on a PC. The camera follows the hero
inside the area map.

| Input | Action |
| --- | --- |
| W A S D or the arrows | Walk the way they point, diagonals too, sliding along walls; in a merchant's menu, W and S move the pick |
| Left click | Attack, turned toward the cursor: the monster in reach nearest where it points. A press made mid-swing is kept |
| Shift or right click (hold) | Guard: walk at your pace behind the shield, turned to the nearest monster, stamina coming back at a third the speed; a blow from the front lets a fifth through and costs stamina. Space rolls straight out of it |
| Space (tap) | Roll the way you walk, or backstep standing still: nothing lands during it, costs stamina |
| Space (hold, moving) | Sprint, draining stamina |
| E | Interact: talk and turn the page, light or rest at a bonfire, traverse the clouds at a way out (or ride the lift, or drop) |
| R | Burn an ember |
| 1 | Band: Follow (stay close, defend the hero) |
| 2 | Band: Attack the monster you last struck |
| 3 | Band: Hold here (guard the spot) |
| M | The map, to look at; travel is from a bonfire |
| Tab | The sack: your numbers and the goods kept, beside play without pausing it. Told once, with the first good. A touch screen gets a Sack button instead |

### The hero

A knight in blue, with no banner. On the prologue's black before the
Landing, after Dark Souls' character creation, the player picks a class, a
gift and a name, all kept for the run. The name is the player's own; Aurum
does not know it, and the folk still never say it. Blank, it is
Nameless. A save from before the pick is a Warrior with no gift, and the
sack calls it the Wanderer.

| Class | HP | Attack | Swings | Reach | Walk |
| --- | --- | --- | --- | --- | --- |
| Warrior | 100 | 12 | 0.65 s, finisher 1.1 s | 1 tile | 2.8 tiles/s |
| Lancer | 120 | 15 | 0.85 s, finisher 1.4 s | 2 tiles | 2.5 tiles/s |

Both carry a shield. The Lancer trades pace for reach at about the
Warrior's damage a second; neither reaches what flies.

The gifts, one taken ashore, are goods like the merchants', never sold:

| Gift | Gives |
| --- | --- |
| Drowned Locket | +20 max health |
| Notched Whetstone | +2 attack |
| Tinder Tin | +1 ember |
| Gull-Picked Purse | +25% gold from kills |

| Stat | Start | Notes |
| --- | --- | --- |
| HP | 100 | The Warrior's; the class sets it |
| Stamina | 100 | As in Dark Souls: a swing 14, a roll 22, sprinting 15 a second, a blow on the shield 2.5 times its weight (too little left breaks the guard: it lands whole and staggers). Comes back 45 a second after half a second unspent, a third as fast behind the shield. At nothing, no swing or roll |
| Attack | 12 a swing | The Warrior's. Combo of 3: the first two 0.65 s apart, the third knocks back and takes 1.1 s to recover |
| Embers | 3 | Each heals 40 HP; refilled at a bonfire |

Levelling is Souls-style: spend gold at a bonfire. Each level adds +10 HP,
+2 attack or +10 stamina, the player's choice (Vigour, Strength, Endurance
under Level up when sat by the fire). The first costs 150 gold and each one
after costs 15% more.

### The band

Up to three companions at once, all Tiny Swords units already drawn in blue.

A new game from the New game button on an area map clears the save. You
come ashore alone.

| Companion | Role | Behaviour | How you get one |
| --- | --- | --- | --- |
| Lancer | Tank | Charges your target and draws aggro | Hire from Sergeant Corwin at the barracks, 75 gold: E beside him opens Talk / Hire / Leave |
| Archer | Ranged | Keeps 5 tiles back and shoots | Hire from Wren at the archery range, 60 gold, the same way |
| Monk | Healer | Heals whoever is lowest below 60% within 4 tiles for 30, 8 s cooldown; never fights | Joins free, for good, once the Drowned Sister in the Drowned Chapel (Underwell) is heard out, even past a full band |
| Pawn | Utility | Carries more loot, picks up gold, repairs bridges | Recruit in Old Town, cheap |
| Gnome | Special | Throws bombs | Won after Old Bamboo (Brasscrag) |

- A companion who falls stays down until the next bonfire rest. On Hardcore,
  a fallen companion is gone for good.
- Companions use the engine's own combat rules for stats, targeting and
  damage. A fight is the same simulation, run in real time with the hero
  inside it.

### The Souls loop

- **Bonfires.** Resting fully heals the hero and the band, refills embers, saves,
  and respawns every enemy in the area. Bosses and opened shortcuts stay as
  they are. Each area has 1 to 4 bonfires, standing cold on the maps until
  the hero lights one with E, which only kindles it: the next E rests.
  After a rest you sit by the fire, as in Dark Souls 3: Travel opens the
  map to any lit bonfire, and Leave stands you up.
- **Death.** You wake at the last bonfire you rested at. The exception is a
  boss who guards a way out, the Cinder Troll in the Ring: fall to him and you wake
  past him. Your carried gold stays where you fell, marked on the map. Reach
  it again and it is yours; die on the way and it is gone.
- **Shortcuts.** Gates and lifts that open from one side only, such as the
  Moor Gate and the Watch Lift, or the Coffin Stair from the Graves' crest
  down toward Lanternport's fire. Opening one is permanent and turns the area
  into a loop.
- **Keys.** Keys follow Firelink's two bells, one up and one down. The Troll
  Key is Highward's own. Its steward fled into Emberwood with it when
  the Grey came, and the Ember Bull has it now (the Ember Key). It opens the Keep Gate.
  Above it stand the bailey and the garrison (Corwin's Lancers), the Keep and
  the Watch Lift to the sky. The Grey Gate takes two other keys, one from each
  way out of Lanternport: the Barrow King's Horned Key, from Kingsrest out
  the Moor Gate, and the Weaver's Silk Key, from the Graveroad down the Old
  Well. The Sky Bridge from Brasscrag is the other, harder way into the
  Greyfall. The Warlord holds no key. He is the drain the Grey runs into. The Grey Gate is
  locked from Kingsrest until both keys are carried, and opens freely from
  Greyfall's side.

### Enemies by area

All from the Tiny Swords enemy pack.

| Area | Rank and file | Elite | Boss |
| --- | --- | --- | --- |
| Emberwood | Torch and spear goblins | Shaman (fire) | Ember Bull |
| Brasscrag | Gnomes, slingers, cannons | Bamboo-folk guard | Old Bamboo |
| Underwell | Skeletons, spiders | Skull guard | Ossuary Warden (mini-boss) |
| Kingsrest | Skeletons, bats | Skull guard | The Barrow King (a mask) |
| Greyfall | The taken, gnolls | Minotaur champion | The Grey Warlord |
| Sunhold | Yellow guard | Lancers | The Sun Sentinel |

The soldiers on Greyfall's walls are what the Grey left of the Citadel's
garrison. They keep their posts because the posts are all they remember.

Gnolls, slingshot gnomes and hex shamans throw from four or five tiles away
instead of closing in. Bats, imps and bees fly, and no blade reaches them,
not yours nor a Lancer's. Only an Archer brings them down. Alone, you can
guard and walk away.
A thrown or shot missile needs a clear line. A house, a hut, a tower, a dead
tree or the woods hide whoever stands behind them, and a thrower walks round
for a clear shot. Archers in the band need a clear line too.

A monster winds up before it strikes, its attack playing out with a white
flash at the start. Roll or raise the shield then, and strike back while it
recovers. No more than two blades press one mark at a time; the rest hold
back and wait their turn. A hit breaks a light monster's wind-up. Gnolls,
lizards and shamans do not flinch.

Camps sit in the maze rooms. An enemy chases up to 10 tiles from its post,
then walks back. The engine already has a guard leash.

### Loot and gold

- **Gold** drops from enemies where they fall. It also lies in gold stones
  (25 each, taken once) and in chests. Walk up to it to pick it up. Gold is
  the only currency: levels, recruits, sword upgrades.
- **No gear.** Your sprite is fixed, so there are no weapons or armour to
  find or wear.
- **Brenna**, in the Chapel Ward's forge yard, puts an edge on your sword,
  +1 to +5, for gold and ore from the Mine Hills and Brasscrag.

### The first slice

1. **Tidewake:** a sea cave under Lanternport, where a new game starts.
   You wake with the tide and find the way out through narrow lit tunnels,
   past two goblins and the notes, to the antechamber's gate and the Bull's
   Ring, a cavern of its own. From the Ring the boat goes out along the sea
   channel to Lanternport's docks. (Earlier, the beach south of Lanternport
   up the Shore Road.) You come ashore alone.

   A bonfire, two goblins, notes on the ground that teach the controls (read
   with E), and the Cinder Troll, a tutorial boss in the Bull's Ring. The
   Ring is a round cavern, walked straight into from the cave's tunnel, with
   no fog. It is the arena, and the troll guards the boat on. A boss bar with
   his name shows low and centred once you stand in the Ring with him in
   view. Kill him and the road opens. Fall to him and you wash up on the
   Lanternport's pier by Maren, as after Elden Ring's Grafted Scion: lost, not
   over, and wake at Lanternport's fire after the next death. The
   troll keeps the Ring, the boat goes back to him whenever you like, and
   his fall is worth a fourth ember for good. Either way the training is
   over.
2. **Lanternport:** the hub is the village's bowl, after Firelink. The
   Lanternport's one bonfire stands cold on the Lower Town's shore, under the
   Old Well in the hill's cave (going down; bats below, only bows reach them),
   with Old Ferrow beside it saying where to go. The boat's pier lies east, on
   the docks; Maren meets you there, walks you to the fire and has you light it. The
   climb runs straight up from the fire through Old Town and the Upper Town
   to the Burg Gate, Highward's gatehouse on the hill's crown, its door
   facing the climb and opening into the Lower Burg. Behind the town is
   only woods.

   The Lower Burg is a town of walled yards and lanes, with the square's
   fire. The Ramparts lead to the Rampart Boar on the Bull's Wall. The Chapel
   Ward holds the Stone Warden, the Old Lift home to Old Town's foot, and
   the Postern to Emberwood. The Keep comes last, shut until the Ember Key.
   West, the Lantern Road runs to the fields and the Old Bridge to Stiltwater
   (hard). North-west, the Ember Gate is shut from this side and opens later
   from the wood. East, past Lantern Point's lighthouse, the Graves stand on
   the hill: gold in plain view, three gnolls and a shaman among the graves,
   and the Moor Gate on the hill's edge, shut from this side. That is the way
   that kills a new arrival. Every way out on foot is a path running off the
   map's edge. Buildings, heaps, fence posts and rocks in open ground are
   solid: no one walks through them.
3. **Emberwood:** the first hostile area. Goblin camps through the maze,
   two bonfires, the Treetop Walk shortcut.
4. **The Ember Bull** in the Ember Hollow (it was the Cinder Troll's,
   who now keeps the Ring): a horn swipe, a stomp, a rush that ends by you.
5. **Reward:** the Ember Key and its gold.

**Done when:** you can walk out of Lanternport, die in Emberwood, recover
your gold, open the shortcut, and kill the Troll with a band of two.

Build order: the hero walking and swinging in Lanternport with one enemy
camp; then death, bonfires and dropped gold; then companions; then the
Emberwood and the Troll.

### How the code splits

- **Engine** (`packages/engine`, tested without a screen): stats, damage,
  aggro and leash, companion AI, bonfire and respawn rules, save data. Runs
  at 20 ticks a second, like the existing battle sim.
- **Scene** (`apps/web`): input, camera, animations, hit effects, the HUD
  (hearts, stamina, embers, band portraits), boss warning circles.
- **Save:** browser storage first. One save holds opened shortcuts, keys,
  the dropped gold's spot, and the band.

### Open questions

Defaults in brackets, used until decided.

1. Fallen companions: back at the next bonfire, or gone for good outside
   Hardcore? [Back at the bonfire]
2. After the Warlord: a single campaign, or New Game+? [Single campaign]

## Summary

Aurum as one world. `/atlas` starts the game on Tidewake;
the whole world is the travel map at `/atlas/map`, opened from a bonfire.
It stands in three tiers on one grid:

- **The Sky:** Sunhold and the Cloudstair overhead.
- **The Surface:** seven lands on the sea.
- **The Underneath:** caverns cut from the rock below.

Within a tier, areas are joined only at named gates, the way a Souls map
joins them. Between tiers, lifts, wells, a sinkhole and a stair join them at
the same spot on the grid, so what is above a place is really above it.


The map format, terrain, buildings and tests are in [docs/atlas-map.md](docs/atlas-map.md).

## Aurum

The world and its story are told in full in [docs/world/reach.md](docs/world/reach.md),
which wins wherever this file disagrees. In short:

Under Aurum lies the Hearth, the warmth the land lives on, and every grain of
gold is a little of it. The old kings' law was to dig no deeper than a grave.
The lords of the Citadel broke it: the gnomes raised Sunhold into the sky on
warm gold, goblins dug the shafts, and the last of them, the Deep Cut, broke
into the Hearth. Stillmere drained down onto it and half put it out. The cold
that came up is the Grey. It takes colour, then name, then will; the taken
walk on by habit toward any warmth, and last of all go to stone. Fire holds it
off, salt slows it, gold pushes it back.

The Citadel's last lord ordered the Cut and wears a crown of the Hearth's own
gold, which drinks warmth from everything round him to keep one man warm. Folk
think he is the Grey. He is only the drain it runs into: kill him and the Grey
thins, the way a fever thins, and Aurum is left to bury what it lost.

Sunhold shut its gate and sent no spears, because it floats on the same gold
and will not spend it. Lanternport held, on the salt, under Highward, round one
fire. The wanderer comes up out of the sea cave beneath it, one of the drowned
given back warm by the Hearth's water; no text in the game says so.

## From Dark Souls

| Dark Souls | Here |
| --- | --- |
| Areas stacked over each other: Anor Londo over Blighttown, the Depths under the Burg ([TheGamer](https://www.thegamer.com/dark-souls-1-fromsoftwares-magnum-opus-of-interconnected-level-design/), [James Roha](https://medium.com/@Jamesroha/world-design-lessons-from-fromsoftware-78cadc8982df)) | Sunhold floats over Brasscrag and Greyfall; Underwell lies under the town, Graveroad under the moor, Hearthdeep under the fen |
| Firelink as the hub every road returns to | Lanternport: the Old Bridge, the Ember Gate, the Moor Gate, the Old Well down and the Watch Lift up all start in it |
| Elevators that open as shortcuts home | The Moor Gate opens from the moor; the Watch Lift opens from the sky and drops you on Highward |
| Ash Lake: a quiet wonder at the very bottom ([Medium](https://medium.com/@bramasolejm030206/preface-ec08bc1459d0)) | Hearthdeep: a still lake under the fen, stone trees, gold in the rock, and the Shell Below asleep |
| One-way drops that commit you | The Old Well and the Fen Sinkhole go down only. The Underneath has its own way back up: the Barrow Cave. |


## The tiers and areas

| Tier | Area | Who's there | Keeper |
| --- | --- | --- | --- |
| Sky | Cloudstair | drifting isles with watch posts, a lift down onto Highward | |
| Sky | Sunhold | the gnome-kings' sky city, its gate shut, yellow guard, a monastery, bees, the Throne Isle, given up to the Grey, with imps | The Sun Sentinel |
| Surface | Stiltwater | militia in Sunhold's yellow and pay, fishing villages, turtles, sharks offshore, pirate towers | |
| Surface | Lanternport (hub) | Highward on its own height above the town, the bonfire square, the Old Well, pawns at work | |
| Surface | Emberwood | goblin warrens in pine the Grey burned, the big pines (standing still), gnolls on Smoke Bluff | |
| Surface | The Ember Hollow | a round floor of ash in the pines, the goblins' fires round it | The Ember Bull |
| Surface | Brasscrag | a rock that climbs in five steps to the Tinker Peak, gnomes, bears, pandas, the Gnome Lift up | Old Bamboo |
| Surface | Kingsrest | barrows, bones, the cave down into the King's Barrow | |
| Surface | Stillmere | a chapel of the Order that prays to the Grey, lizards, the sinkhole | |
| Surface | Greyfall | the Citadel, the Grey Keep on its crown, the Warlord kept warm by his crown, the Throne Stair up | The Grey Warlord |
| Below | Tidewake (start) | the sea cave where a new game starts, notes in the tunnels that teach the controls, two goblins to learn on | Cinder Troll (in the Ring) |
| Below | The King's Barrow | the throne hall round its ring of pillars | The Barrow King |
| Below | Underwell | cisterns and pillars under the well, a crypt, spiders, a thief | |
| Below | Graveroad | tomb daises, skull guards, a dead troll's bones | The Weaver (a giant spider) |
| Below | Hearthdeep | the underground lake, stone trees, turtles, glowing gold | The Shell Below (a giant turtle) |


## Gates and lifts

```
SKY       Cloudstair ──Cloud Bridge── Sunhold
               │ Watch Lift (shortcut)       │ Gnome Lift      │ Throne Stair
SURFACE   Lanternport ...(gates as before)... Brasscrag ... Greyfall
               │ Old Well (drop)      │ Barrow Cave (lift)  │ Fen Sinkhole (drop)
BELOW     Underwell ──Cistern Run── Graveroad ──Sinking Stair── Hearthdeep
                                   King's Barrow ──King's Stair──┘
```

- **Surface gates:**
  - Open: Old Bridge, Crag Stair (from the Ember Hollow), Fen Causeway, Barrow Path.
  - Barred: the Ember Gate.
  - Shortcut: the Moor Gate.
  - Locked: the Grey Gate.
  - High road: the Sky Bridge.
- **Lifts:**
  - **Both ways:** the Gnome Lift off the Tinker Peak, the Throne Stair from
    the Grey Keep, the Barrow Cave.
  - **Down only:** the Old Well and the Fen Sinkhole.
  - **Shortcut:** the Watch Lift, opened from the Steps, after which it is
    the road home.


## Area maps

Every area has its own large map (`areas.ts`, 112 x 72 tiles), built with
the same `tierBuilder`, at `/atlas/<area>`, and the camera stays inside
that map. An exit at its edge, or a lift or well inside it, takes you to
the next area's map. Resting at a bonfire sits you by it, with
Travel and Leave: Travel opens the map, and a click on a lit bonfire
travels there.

Crossing between areas never leaves the page. The scene rebuilds itself as
the next map inside the same game (`travel` on its api), while the address
follows quietly (`/atlas/<area>?from=<area>`). You arrive at the exit back
the way you came, not the area's front door. Each kind of crossing has its
own cover, held while the next map is built. Walking out draws the game's
own cloud bank in and parts it on the next map (a dark wipe read as ugly).
A drop closes the dark in on the hole, then the view falls onto the spot
with a jolt. A lift passes rock upward going down and cloud downward going
up. A stair into the deep closes in slowly on the stairway. The first time
you take a one-way drop, it asks first. The area's name is not announced
again when you step straight back into the area you just left.
Each crossing is drawn as the thing it is: the Old Well a ring of stones
with posts and a rope beam, the Fen Sinkhole a reed-ringed pool of black
water drawing down, a lift by its own building (the cave, the gnomes'
tower, the keep) and nothing more, and a lift standing alone a railed plank
floor. The dark hole and the white shaft of light that marked every
crossing are gone.

- `block(level, x, y, w, h)` lays out exact terraces. A castle is nested
  blocks, each with its own cliff faces. `block(1, ...)` cuts a notch back to
  the ground, as for a gatehouse.
- `stair(level, col, row, side)` puts in an authored stair. Terraces built
  from blocks only get the stairs you author, so the way up is designed.
- `span(level, x, y, w, h)` raises a bridge deck between two tables of that
  height, over water or a ravine. A deck joins tables of its own height only:
  the hills at each end keep their own stairs. Over the sea, give it
  `stair()`s at its ends. The deck takes its height's colour, the same as
  the land at its ends (a contrasting colour was tried and read as a
  stripe that did not belong to either side).
- `grove(cx, cy, rx, ry, density)` plants woods on lowland.
- **Mazes, not fields.** An area map's lowland is woods unless carved
  open, as in Diablo: `maze()` links a jittered grid of waypoints (one per
  11 tiles) with a randomized depth-first tree plus a few extra links for
  loops, carves those corridors about 3 tiles wide with ragged edges, opens
  small clearings at some waypoints and a room round each district's seed
  (its `clearing`, 6 by default; Lanternport's town and fields are wider).
  Roads, buildings, fires and stairs stay clear. Woods block, so the trees
  are the walls; cliffs wall the high ground.
- After the woods, every pocket nobody can reach gets a path cut to the rest,
  all pockets in one pass and never along a cliff's face, and a pocket with
  no way out at all goes to woods whole.
- **Districts** split a big area into quarters. Each has its own name on the
  land, its own tileset colour per height (lowland first, following the
  Tiny Swords tilemap guide's advice to colour each level differently) and
  the decor style of an atlas area it borrows (`dress`). Land goes to a
  district's `box` if it has one, otherwise to the nearest seed, with borders
  bent by noise.
- Lanternport was mapped first, in eight districts: Highward (three
  terraces up to the keep), Old Town (two raised streets round the square),
  the Docks (the Sea Wall across the bay), West Fields, the Northwood and the
  Keepwood, the Mine Hills and the Moor Watch. Two raised bridges: the Knoll
  Bridge and the Sea Wall.
  Emberwood is the second: the Ember Run (a river, cut with `river()`) splits
  it, crossed at the Cinder Ford, an east bridge, the Pine Ford, and the
  Treetop Walk raised from Smoke Bluff to the goblins' Warren Hill. The Cinder
  Troll waits in Troll's Hollow, a ring of rock with one gap. Exits carry no
  sign: a cloud bank lies across each, and E's prompt names where it goes.
  The castle wards sit on the atlas where their gates say: the Burg over the
  Burg Gate, the Keep west of it, the Ramparts north of it, and the Chapel
  east past the Gun Bridge, joined by the drawn road from the Burg Gate into
  the Chapel.
  Brasscrag is the third: the Tinker Rock climbs in five gnome-built
  steps, each two overlapping blocks so no ledge runs an even width, with
  every stair at the far end from the last, so the climb walks each ledge
  (on at the south-west, up at the east, the west, the east again). Old
  Bamboo holds the fourth step where the climb arrives; the Gnome Lift
  rises off the summit, and the Sky Bridge runs off it east, raised, to the
  map's edge toward Greyfall. Its terraces carry cannon batteries on every rim, watchtowers, a raised Gun Platform with
  its own stair, and fenced workshop yards with wood, tools and stores.
  Reworked after Lanternport and Emberwood (`docs/world/tinker-crags/design.md`): the rock
  is stamped whole (`TINKER_ROCK`) and climbed on switchbacks, gnome
  gantries reaching off the fourth step to the Workshop's knob and the
  East Ridge. Tinker Town at its foot is the hub (fire, Nim's goods, the
  lift-keeper's family); the Works, the Batteries and the Wheel Step are
  steps two to four; the Bridgehead on the fifth holds the gnolls come
  over the Sky Bridge, a fire, and the summit path to The Tinker Peak,
  Old Bamboo's own area (`peak`), which the Gnome Lift now leaves from.
  The Hoist (`hoistOpen`) drops from the Wheel Step to the town, unbarred
  from above; the East Ridge is a back way up past the first steps. Old
  Bamboo's fall raises `bambooDead`, and the gnomes come back up the rock.
  Greyfall began as the fourth, a castle that is the level, after
  Stormveil: a walkable curtain wall with a bastion on each corner, the
  locked Grey Gate a gap in its west side over the Ashen Approach, and the
  Sky Bridge landing on the north rampart. The rampart runs straight into
  the Middle Ward, the other way in, past the bailey. Inside were the
  ruined Outer Bailey, the Ruined Chapel and the Gallows Yard (the
  Lanternport's folk penned), then the Middle Ward, the Upper Ward with the
  Warlord's hall, and the Grey Keep on the fourth height, its stairs changing
  sides each step. `ground()` lays exact rectangles of land, so walls stand
  on ground to their corners.
  It was reworked after Caelid and Sellia. A river of rot runs down the
  bailey into the Crater. A lake (`lake()`) holds a shrine and bonfire on
  its isle, crags stand out of the rot, and gnolls serve as its dogs. The
  wards are now the High City: six raised blocks, each standing alone with
  a street on every side and a stair at both front corners (blocks that
  touched each other or the walls fused into one slab and stranded their
  stairs), raised walkways over the streets, the Warlord's Hall and the
  Grey Keep's tier above, and the Grey Keep on the fourth height, each block
  furnished as its own quarter.
  Highward and Old Town and Emberwood's warrens got the same
  furnishing as Brasscrag: trails, guns on the walls, stores and trophies.
  Sunhold is the fifth, a city of isles in the sky after Anor Londo
  and Leyndell. Each quarter has its own isle (Cloud Landing, the Gold
  Market, the Bee Gardens, Gnome Landing, the Gilded Gate, the Sun Chapel),
  joined by narrow bridges over open sky. The capital climbs the Sun Steps
  in three terraces to the Sun Hall, where the Sun Sentinel stands. The
  Throne Isle hangs off the east end, reached only by the raised Gilded
  Span.
  The city climbs from fresh green to gold, and only the Throne Isle is
  dark. The yellow guard hold the span's foot, with a tower either side and
  archers on its landing, because the span is the one way the Grey's
  creatures can come in. The Gilded Gate isle is their garrison. The market
  keeps its livestock in a pen.
  Cloudstair is the sixth, a descent after the Ringed City's broken
  stairs. From the Cloud Pier, the way runs up the Broken Stair, across the
  raised Old Span to the Windward Rest, down its steps, then by rope bridges
  over the Hanging Graves and the Bell Isle to the Watch Isle and its lift
  onto Highward. The Hermit's Rock and the Gold Wreck are dead
  ends off the way. The Gold Wreck's barge hangs off the isle's edge where
  it fell short, its timbers and gold spilt across the rock for the imps. A
  stair onto the third height must rise from second-height ground, so a high
  isle steps down through a ledge to its lowland. A bridge must run from
  well inside one isle, as a ragged rim leaves one that stops at the edge
  joined to nothing.
  Underwell is the seventh and the first underground: a chain of
  caverns joined by tunnels (Well Bottom, Cisterns, Spider Pillars,
  Drowned Chapel, the raised Ossuary, Smugglers' Nook, the Dig), its maze
  walls turned to standing rock by `stone()`, dressed in rubble, not
  trees. A tunnel must run from well inside one cavern to well inside the
  next: one ending at a ragged rim joins nothing, and everything past it
  goes to wall.
  Graveroad is the eighth, a tall shaft of tombs after the Catacombs
  and the Tomb of Giants: the Barrow Cave lift lands on the crown of the
  Great Barrow, a tomb in two steps, and every way from it goes down, past
  the Ossuary Galleries, the Drowned Graves, the Robbers' Camp and the
  Collapsed Hall, to the Weaver's Web, a pillared vault where the Weaver
  waits, and the Sinking Stair on toward Hearthdeep.
  Hearthdeep is the ninth, the bottom of the world after Ash
  Lake: a great still lake with a ring of shore round it (the Stair Foot,
  the Stone Grove, the West Shallows, Pilgrims' Rest, Sinkhole Landing),
  two causeways over the Gold Shoals out to the raised Shell Isle where
  the Shell Below sleeps. Two rules came out of it: shores that only
  graze each other count as sealed and go to rock, so join them with
  tunnels centre to centre; and underground, rock is high ground, so a
  tile directly under rock is a cliff face: an exit at a map's top edge
  stands a row down.
  Kingsrest is the tenth, the old kings' moor after Limgrave's heath and
  Lordran's graveyards: a broad moor with three tongues out to its gates
  (the Moor Gate, the Grey Road to the Grey Gate, the Fen Path), grassy
  barrows rising out of the dead wood of the Heath and Barrow Field,
  Gibbet Hill, the Dead Mere, and the King's Barrow, two exact steps with
  the Barrow King on its crown and the Barrow Cave at its foot. A grown
  relief lost its top step there, so the great mound is built from blocks,
  with land of its own under it so its back does not stand in the sea.
- **The three underground maps are three different places.** The
  Underwell is the one people built: square halls and straight
  corridors on a cross from the well (`ground()` rectangles, `tunnel()`
  lines), torches in brackets along the walls (`sconce`), lit warm amber
  on brown-black rock, with only the Dig left as ragged rock because it
  is the tunnel nobody admits to. Graveroad is a tomb: the darkest map,
  cold black rock, its fires burning ghost-green, green grave-mist, and
  the dead laid in rows (the kings' two ranks before the Great Barrow,
  the Ossuary Galleries' rows, graves running into the Drowned Graves'
  pool). Hearthdeep is the quiet wonder: the brightest map, pale
  blue on deep-blue rock, few fires, the gold glowing far over the
  water, stone trees standing in the lake and in the Stone Grove. Each
  map's light is `UNDER` in `AtlasScene.ts`.
- **Every unit is under the light.** The cloud, light and HUD layers sit
  above any map up to 300 tiles tall: they once sat at 5000, so on a map
  over 63 tiles tall (Graveroad is 96) everything south of row 63
  sorted above the darkness and shone at full brightness.
- **Underground maps are rooms and passages in the dark**, not mazes:
  separate chambers cut from solid rock, joined by bending `tunnel()`s
  three tiles wide (under rock a tile is a cliff face, so a narrower one
  cannot be walked), fallen rock (`rubble()`) in the larger chambers, and
  most of the canvas left as rock. The scene lights them near black but in
  pools round fires, exits and gold, and open water takes the area's own
  tone, dimmed. Underwell branches from the well, Graveroad zig-zag
  down to the Weaver, Hearthdeep is a lake with shores on three sides and
  bare rock on the fourth. Passages are `passage()`s: a tunnel with
  alcoves cut into alternate walls every few tiles, bones or a spike in
  most and a torch in one. Pools are ragged `lake()`s and winding
  `river()`s, never `pond()` strips; no trees grow below (`stone()` turns
  leftover woods to floor); floors stay teal, olive and at most mid green,
  the light coming from the fires.
- **Every area is built its own way, and floats.** Sea and sky maps are
  padded 10 tiles with open sea or sky (`pad()`, which runs each edge
  exit out along a causeway to the new edge), so land never fills the
  frame. Only Emberwood keeps the wooded `maze()`; elsewhere the ground
  is shaped to its place: Lanternport an open town with hedgerowed fields
  (`hedge()`), Brasscrag knolls, outcrops and scrub copses round the
  mountain's foot, Greyfall open courts with clumps of dead wood in
  its bailey, Sunhold plazas with tree avenues (`avenue()`) and
  one hanging garden, the Steps bare isles with lone trees, Kingsrest
  clearings walled by dead thicket.
- **Stillmere** is a spiral that climbs: one causeway of reed coiling two
  turns inward through black water, each district a tier higher than the
  last (Causeway Landing on the lowland, the Eel Shallows, the Drowned
  Village, the Lizard Warren ringing the heart, the Chapel Mound on the
  fifth height at the centre over the sinkhole). The engine's heights stop
  at five, so five districts. A tier ends where the coil runs east-west,
  the only place a stair can stand (stairs sit beside a table's bottom
  row). The higher tier's first two columns are cut back below the coil's
  centre line in a straight notch, so the stair has lower ground above and
  below it. A notch that followed the ragged edge put the stair over water,
  and the engine then erased every tier above.
  The fen tells its story inward along the causeway, and each thing stands
  where its people would put it (`spot(turns, along, out)` places on the
  coil, `out` toward the water side). Stiltwater's militia hold the landing,
  with a jetty, a hut over the water and its boat below. The moor's dead
  are buried at the Barrow Rise beside the Barrow Path, stakes in rows. The
  fishers' stilt village runs along Eel Shallows, each hut with its boat and
  catch, one shared fire. The Drowned Village's houses still line both
  sides of its old street, no fire lit, reed closing over its end. The
  lizard-folk's stakes stand at the top of the stair, their huts ringing
  one fire. The cult's ring of stakes circles the sinkhole under the chapel.
  Sharks keep to the deep channels, out of the shallows.
- **Stiltwater** is a stilt town: no land to speak of, a web of a dozen
  small timber platforms on the shallows knotted by boardwalks into short
  ways and loops. Each platform is a room with one job (the toll landing,
  the fish market, the saltworks, the net lofts, the village, Gull Rock,
  Pirate Cove, the raised Lighthouse Rock and Militia Fort, Smugglers'
  Steps, the eel pens, the Shingle Spit out to the Fen). It is compact, not
  an open world: the boardwalks are the only ways.
  The walks tell its story. The catch and the salt go out over the Old
  Bridge, so the market and saltworks crowd the landing. The fishers live
  at the heart, where every walk meets. The pirates hold the far west,
  joined to the town by one plank off Gull Rock, where the militia keep a
  watch, and the fort's guns face the cove. The smugglers' landing under
  the village has no way on but the water. Boats are moored at the
  platforms, sharks keep offshore past the pirates, and the town stands on
  one green timber, the pirates' and smugglers' ground a shade darker.
- **Kingsrest is clearings in dead thicket**, about a screen each, so
  every few steps is a new place: the Moor Gate, the Wayshrine (the first
  fire), Barrow Field's four mounds, Gibbet Hill, the Burned Hamlet, the
  Mourners' Way up to the King's Barrow (two steps, the Barrow King on its
  crown, the cave at its foot), the Diggings, the Troll's Grave, the
  Dead Mere, the Grey Road and the Fen Path. `finish()`'s `open` is the
  clearings' ragged ellipses; the lanes are roads, so they stay clear, with
  loops round the Mourners' Way and the Troll's Grave. It was a
  tableland, one plateau 88 by 50 with a few trees on it: up close it
  read as empty, and woods grow only on lowland, so nothing could wall
  it. Ground a landform names is never absorbed as a pocket, so a small
  barrow keeps its district's colour.
- **Greyfall is now a citadel-crag**: no walls or blocks, but one
  great rock rising out of the rot-marsh in four ragged tiers (the Lower
  City, the High City, the Warlord's Hall, the Grey Keep on its crown), the
  tiers alternating stone colours, with a spur west for the gnomes' Sky
  Bridge to land on. Rotfield, the Crater shrine, the Ruined Chapel, the
  Gallows Yard and the Ashen Approach lie in the marsh round its foot.
- **Greyfall is drawn after Lanternport** (`CITADEL`, `PITS`): each
  place its own landform, packed narrow, not tiers of open flat. The Grey
  Keep on its own crag in a chasm of rot, reached by one bridge off the
  Warlord's Hall, a horseshoe round the chasm (Lanternport's crown in its
  moat); the High City walled, towers and perched archers at its corners,
  Lords' Row as a two-wide alley of houses under the Counting House, the
  Champions' Pit sunk a height into it, the Garrison in one line on the
  east rim, a gate bastion off its south face; the Lower City's smelter
  row along the wall's foot and the goblins' alley of huts; the Pits a
  spoil rim round a bench round the Crater's floor, the rot falling
  through a gorge in the rim, diggers hauling to an ore heap nothing
  takes; Rotfield's fenced crop boxes; the Gallows' gibbet avenue and
  pens. No side runs straight: `jrect` steps each tier's edges in by a
  tile or two in runs of two to four, on an underlay of the tier below
  so a notch drops one height, holding the rows and columns a stair or
  bridge needs. The High City breaks its grid with the Ash Square's dead
  great tree on Lords' Row, the Gilt Market at the crossroads, the
  Treasury Rock raised a height, and a gallery bridged over the
  Champions' Pit. The taken at work are black pawns, harmless, and stand still once
  the Warlord falls; the pens empty and the drill stops.
  Fires by runback: the road in (Grey Gate 21), the Sky Bridge's head
  (40), the Gallows, and the Hall's forecourt (Keep door 34); farthest
  tile 48. Tally's fire on the Pits' rim is a campfire. No foe stands
  within REST_CLEAR of a fire.
- **Emberwood** keeps its maze, but its hills and Troll's Hollow (once a
  rectangular ring of blocks, now a raised arena of ash) are landforms.
  The whole wood has one floor colour: per-district colours met in
  straight lines through the trees and read as painted patches. Colour
  changes only up a cliff (Smoke Bluff, Troll's Hollow and the Burn's
  mound in ash-gold), the Burn is scorched by its dead trees, and the
  pines run through every wooded district with yellow among them. On
  every area map a forest tile takes its tree kind from a spot up to four
  tiles off, so two districts' woods mingle at their border. A fire at
  the Cinder Ford is the rest before the bull, and goblin posts hold the
  ford and the climb to Crag Foot.
  Reworked after Lanternport (`docs/world/emberwood/design.md`): two storeys cut by one
  river. The floor is the burnt maze; the Boughs are the goblins' raised
  tables over it, Warren Hill and Smoke Bluff joined by the Treetop Walk
  over the Run, the Chief's Mound in the Burn by the Ash Walk to the
  Postern Crag. The Run now crosses edge to edge, so every way north picks
  a crossing: the Pine Ford, the Treetop Walk, the Cinder Ford, the East
  Bridge. The Postern lands on the crag's crown in the south-east and
  steps down three ledges over the Burn. Three jobs pull the player across:
  open the Ember Gate home through the overrun Palisade, rest at the
  Cinder Ford (the wood's one bonfire, every other fire a campfire), and
  follow the steward's notes from the crag to his bones on the Ash Road.
  The Drawn Plank (`drawnPlankDown`) bars the Treetop Walk from the bluff
  until dropped from Warren Hill. Folk back each place: Garth and Dunn
  return to the Palisade once the gate opens, Brother Fenn in Old Pines,
  Tam the Prospector at Crag Foot, Wren at Smoke Bluff's foot.
- **No rectangles left.** Sunhold's Sun Steps and Throne Isle,
  the Cloudstair' Broken Stair, Windward Rest and Bell Isle, the
  Underwell's Ossuary, Graveroad's Great Barrow and Hearthdeep's Shell
  Isle are landforms now; no area map calls `block()`.
- **Fences, buildings and woods keep their distance.** A fence stands on
  open ground of one height, a tile clear of any building, fire or other
  fence, off the roads, and moves to the nearest place that fits; a
  building never stands on a road (stock may); authored woods on a cliff
  face are cleared once the terrain is laid; a thin line of woods is
  drawn as a hedgerow of bushes, and only a mass of woods mingles its
  trees with the next district's.
- **Area maps carry no banner**: an area's name is on its land, and
  "Leave to the title" is the one control left at the top.
- **Area maps draw no roads.** A road there is open ground in the
  district's own colour: the engine's roads still keep woods and buildings
  off it, but a road tile's other colour read as a stripe painted across
  the districts. The atlas keeps its drawn roads.
- **Districts are landforms, packed like the atlas.** `shape(level, cx,
  cy, rx, ry)` lays irregular ground at an exact height, an ellipse whose
  rim wanders by noise, with a corner squared off on each lower flank so a
  stair can stand there. Each landform finds its own stairs onto the ground
  under it. Lanternport is built from them: the Keep on Highward's crown,
  the Upper Town and Old Town below it, the Northwood and the Mine Hills as
  uplands either side, and the Moor Watch's bluff. Land runs to the frame's
  edge (sea and sky maps keep a margin of only 3 tiles), except behind Highward, where
  open sea puts the Keep on a sea cliff. West Fields owns a `box` edged on
  its hedgerows: by nearest seed, flat ground met the Lower Town in a
  straight diagonal. A market of stock heaps and traders' houses fills the
  square's east side.
  The capital's tiers nest, each wholly inside the one below with ground all
  round, so a tier is reached only from the tier under it. Overhanging tiers
  stood on the lowland with stairs from the ground to the third and fourth
  heights. The hub is the brightest map, green ground climbing through fresh
  green to a gold capital. The capital is a hill town: Highward on a
  headland with the sea on two sides, the tiers stepping down to the
  south-east, each tier its own work (the garrison's soldiers drilling, the
  chapel and gardens, Old Town's market and trades). The Lower Town is
  clusters after the Witcher's Oxenfurt: a paved market round the Old Well,
  a west quarter thinning toward the archery butts, an east quarter of
  smithy, garden and barracks, the docks, and a watchtower at each gate,
  joined by bending streets the map draws (`streets: true` on the area). A
  grid of houses read as two rows. Roads run on to the farm, the lumber
  camp, the miners' camp and the lighthouse, and carriers walk between them.
  West Fields is a farm of fenced fields drawn in crop rows (`crops` on a
  district) and fenced pastures, on the town's own green: painted field
  colours read as flat patches, and tree hedgerows as walls. Stacked
  rectangles and full-width bands both read as slabs and were dropped. A
  landform names its district (`shape(..., owner)`) and gives it every tile
  it covers, so one landform is one colour. A district's `levels` names the
  heights it takes on the lowland and elsewhere. Any patch of a district
  under 60 tiles that is not its main piece goes to the district round it,
  so the noise in the borders leaves no islands. `districtAt` is base-36,
  read with `districtOf()`.
- **One bonfire in Lanternport.** It stands in the market square; the
  town's other fires are `campfires`, lit but no rest. The Lower Town is a
  bowl after Firelink: `rim()` rings the square with raised ground, cut a
  tile clear of every road. The main road west and east and the docks lane
  south are the passes out, Old Town's cliff closes the north, and the
  rim's stairs stand in the passes. The houses sit on the rim. The Old Well
  is on its east ledge, off the square but in view of the fire. The two
  back lanes that cut the rim's corners are gone. The bonfire stands at the
  bowl's centre, with copses on the rim and in its corners.
  Every way out starts on the bowl's floor. The high ground is the climb,
  after Firelink's stair to the Burg: twin stairs up the bowl's north wall
  onto Old Town, then the Upper Town, Highward and the Keep stacked up
  the bonfire's column to Highward on its sea cliff. Rim arms reaching
  out as ridges (`ridge()`) were tried and dropped: they read as nowhere.
  Lantern Point holds five ways, each with a tell: the Lantern Road west
  (`lanterns()` along it; golden motes drifting off the fire along it,
  after Elden Ring's guidance of grace, were tried and dropped as odd), the
  Graves up the hill north, the Old Well by the fire, the pier south and the
  cove east. `solidCells()` is what no one walks through (props but gold,
  bones and boats; fence posts). The scene adds rocks and stumps standing
  in open ground, never at an edge, so none seals a pass, and a test walks
  every area round the solid props.
- **The castle is a region, not a terrace stack.** After the Undead
  Burg, the Undead Parish and Dark Souls 3's Undead Settlement, the
  castle above Lanternport splits into areas of their own, joined in a
  climb: the Lower Burg, the Ramparts, the Chapel Ward, the Keep (laid
  out as hillsides now, below). On the Ramparts the Rampart Bull (the
  minotaur's sheets, iron-tinted, bigger, harder) holds the Bull's Wall.
  Past him the Ladder (`opens: "ladderDown"`) drops to the Burg's square,
  where its foot is `shut` until then, and the Gun Bridge crosses the
  ravine under slingshot gnomes to the Chapel Ward's door. A crossing
  lands at the exit of the same name (`greyfall.via`), since two ways
  join the Burg and the Ramparts. The upper ward's back stair climbs to a
  landing on the Bull's Wall, fogged with the walk's two ends while he
  stands (an arena's `gate` holds any number of fog runs): a second way
  into the boss room, and once he falls a loop home through the wards,
  its gold at the wall's foot where the walk looks down on it.
  The Chapel Ward (`chapel`), after the Undead Parish: the cloister walk
  round a square pond (dead monks on their rounds), up to the chapel
  terrace and the Ward's bonfire at the monastery's door, after Dark
  Souls 3's Cleansing Chapel, one fire every way starts from. West along
  the terrace, the bell roof a height above, fogged while the Stone
  Warden (the troll's sheets in stone, no troll's moves) holds it, the
  Postern to Emberwood off the roof, barred until he falls; east along
  the terrace at its own height, the forge yard, Brenna, and the pier to
  the Old Lift (opened by riding it); the yard's stair down to the
  cloister closes the loop. The town's Ember Gate is now a shortcut, opened from the wood: Emberwood
  comes after Highward. Every way between areas is a thing to see: a
  stair in the terrain's own tiles, a gateway between towers or a bridge or causeway to it, and
  no fog across it (fog marks only a boss room): a road off the map's edge ends between two
  torch posts, a way in the map's middle is a building's door or an arch in the rock, gone
  into with E; a ladder is a run of fence, a lift its platform. Solid props block a base centred under their art (an
  even width rounds down), so none juts out to one side. The Keep
  (`keep`), Highward's crown, its own area where the harbour's castle
  and Keep terraces used to be: in at the Keep Gate off the Burg's Upper
  Streets (an exit with a `key`, barred by the pack's fence until the
  Ember Key is carried), the gate court, the bailey (Corwin at the
  barracks, the Keep's bonfire; no guns or drill, so after the Burg and
  the troll it reads as a rest, like Firelink), and Highward on its terrace a
  stair up, Ansel on the wall, the Watch Lift up to the Cloudstair,
  shut until ridden down. Tidewake is a sea cave on the underground
  tier, narrow tunnels from the grotto to the antechamber's fog; the
  Bull's Ring is its own cavern area past it, walked straight into with
  no fog (an arena with an empty `gate` has no fog, mist or seal; its
  boss bar shows once you stand in the room with the boss in
  view), and the boat out to Lanternport. Every
  fightable boss fights in a closed arena; walking into its fog walks you
  two steps in, and it holds until the boss or you fall.
  Since then, after the Ring, the first four bosses each hold an area of
  their own, and that area is the arena and nothing else, a land apart:
  in at a gate from the land before, straight into the room, and
  past the boss his exit (`guard`) into a new land. Like the Ring, each is
  walked straight into with no fog (an empty `gate`): the land is the
  room. The Bull's Wall (`bullwall`): the curtain wall alone, three wide
  over the drop, from the Ramparts' walk to the Chapel
  Door, no way round him; the Ladder to the Burg drops off it past him.
  The Belfry (`belfry`): the bell loft alone, cramped round the bell's
  timber frame (a fence), from the chapel terrace's Bell Stair to the
  Postern down to Emberwood. The Ember Hollow (`trollpit`): a round floor
  of ash walled by pines and ringed by fires, room for every charge, from
  Emberwood's Ash Road to the Crag Stair, so Brasscrag now come after
  the troll. The King's Barrow (`barrow`, under the moor): the throne hall
  alone round its ring of pillars; the Barrow Cave's lift lands in it, not
  Graveroad, and the King's Stair goes on down to Graveroad's Great Barrow.
  On the world map the Chapel moved east and Emberwood six tiles west
  to make room.
  For a time, the hub moved off the town to Lantern Point, a headland in
  the south-east corner (Firelink is a ledge at the edge, not the middle):
  the Shore Road from Tidewake lands on it, the lighthouse fire is the
  Lanternport's first bonfire, an inlet against the Moor Watch's bluff leaves
  the shore path the one way west, and the Moor Watch's hill behind the
  point is the Graves: a path up its slope through gnolls and gold bait
  to the Moor Gate on its seaward edge (the coast strip that once ran
  north to a lowland gate read as a dead end, and the hill as scenery). An
  exit's `shut` flag bars a shortcut from this side until it is opened
  from the far one (the Moor Gate, the Watch Lift). The market's fire is
  a campfire; the goblin camp's on the Ember road is the second bonfire.
  After Firelink, the bowl carries one axis through the fire: north the
  stair up to Highward and the sky, south the Old Well on the bowl's
  floor, down to the drowned. A gate tower marks each pass mouth. Ferrow
  at the fire says the goal (the Grey Gate's two keys), why Highward is
  shut, and warns off the well. The countryside is thresholds, each a
  taste of the region past it: Stiltwater's fishers and yellow militia at
  the Old Bridge, the lumber and goblin camps on the Ember road, the
  moor's dead along the Moor Gate road, the mine's ore carried to the
  smith; the lighthouse keeps gold and a note. Notes on the ground at the
  well's lip, on the Keep looking east, and at the lighthouse. The castle's stairs are an
  area `lock`: shut until the Ember Key is carried, or opened from inside
  by coming down the Watch Lift.
  Reworked since, and what holds now: the hub is Lanternport's one
  bonfire on the Lower Town's shore (a corner hub with the way on in the
  far corner was a cross-map trek; the bowl's fire was moved down here),
  Ferrow and Tobin at it, the Old Well above it. You come from the Bull's Ring by boat (`The Boat`,
  a `lift` crossing drawn as a moored boat, E says "Take the boat to"), not a lift
  up through the rock, landing on the docks' pier below the bowl. The
  climb runs straight up from the fire to the Burg Gate, Highward's
  gatehouse on the hill's crown, towers beside it. The way to the Burg is
  the gatehouse's door, on its front facing the bridge, so the climb ends at
  the gate and not round the back. The woods run right up to the citadel's
  back wall (`wooded(m, top)`), with no way along there. The Upper Town is
  three heights in one line and every stair goes on: the Great Gate's
  stairs onto the Lower Circle, the gate square's two and a west one
  onto the Wind Ward, its bridge over the moat to the crown. The sea is gone, since a gate to an
  inland area must not lead into the sea. The Old Lift from the Chapel
  lands at Old Town's east foot, near the hub. The castle areas are no
  longer rooms in the void or terrace pyramids: each is a hillside of its
  own ground with woods round it (`HILL`, `wooded()`; the woods take the
  nearest district's dress, a boss room's excluded so its mist stays
  tight). The Burg is a town of blocks, each a yard or house a height
  above three-wide lanes up its own stair, dead hedges closing some
  lanes, the square sunk in a bay of the upper town's wall; the Ramparts
  three heights, the lower ward with its gate yard, drill yard and
  stores, the upper ward's burned tenements under the wall, and the wall
  walk over both, the east tower and Gun Bridge reachable only along it; the Chapel a cloister, a terrace and the bell
  roof, the forge yard raised with a pier to the Old Lift on its lip; the
  Keep a gate court, bailey and castle terrace. Every way out on foot is
  a path three wide to the map's edge (`edgeWay()`), its road painted,
  and needs no fog: a gate is seen by its path, fog is for boss rooms only
  (Tidewake's antechamber gate lost its fog too). Two traps met on the way: high ground no
  stair reaches is lowered by `finish()`, so a stepped base with no
  stairs flattens; and a ground strip only reachable along a cliff's foot
  is no way at all, as the row under a terrace is its face.
- **A district is one colour.** A district's `palette` can be a single
  tileset colour for all its heights; Lanternport's districts each are, in
  the atlas's family (an olive lower town climbing to a gold castle,
  fresh-green fields), and district borders are
  broad and gentle so the colours meet in curves, not a patchwork. A
  district's `decor` thickens its bushes and rocks, for the atlas's
  texture in the grass.
- **Each height a shade lighter.** `groundColours()` paints an area map:
  each shelf is at least one shade lighter than the ground just below it
  (teal, olive, green, fresh green, gold, darkest to lightest), so every
  cliff reads as a step up; only gold over gold is allowed, at the
  Lanternport's Keep and Brasscrag's summit, five heights with no teal lowland
  (teal ground reads as the sea). Palettes start dark enough to climb, so
  the lift rarely changes a tile; a test holds every area to it.
- **Brasscrag is a mountain, not a pyramid:** five reliefs of their own
  shapes grown into each other (the summit massif, a broad west shoulder
  where Old Bamboo waits, a long thin east ridge, a squat north crag with
  the workshop yard, a low south spur with the gold mine), outlines
  wandered by noise, the stairs placed by the terrain. Nested rectangular
  blocks read as a stepped pyramid and were dropped. The mountain's
  districts share one ramp by height (`MOUNTAIN`: fresh grass, green
  slopes, bare rock, a gold summit) so its tiers read without a patchwork;
  scrub dresses its lower slopes and boulders its upper. A stream runs off
  its west face under a footbridge, a tarn sits under the outcrops, and the
  gnomes' Terraces, a raised shelf on the southern spur, are fenced plots with their stock.
- **Each area has its own frame and silhouette:** Lanternport taller,
  with Lighthouse Point curling round the bay; Emberwood a long valley
  with the sea biting its corners; Brasscrag tall, with the Southern Spur
  running into the sea; Greyfall's coast broken into coves and
  stacks; Underwell a chain of caverns.
  `test/areas.test.ts` checks every mapped area: every exit and height can be
  reached from the entry, every bridge deck stays raised, all land belongs to
  a district, and every building sits wholly on its ground.


## Playing an area map

An area map is played. The hero (a blue Warrior or Lancer) stands where you arrived,
and the camera holds on it 15 rows tall. There is no minimap (dev mode
shows the whole map). The hero walks at 2.8 tiles a second in straight legs
(the grid path pulled taut, `smoothPath`), at a steady speed rather than a
hop a cell. Hold the mouse to keep walking toward it, or steer with WASD or
the arrows, sliding along what blocks. A click on the woods or the sea
walks to the nearest ground beside it (`routeToward`), and a ring marks
where a walk ends. Click the ground to walk there by the engine's own path,
a monster to walk up and fight it until it dies, an exit to walk to it and
through. With nothing else to do, the hero turns on a monster beside it.
Monsters (`FOES` in `packages/engine/src/hero.ts`, the game section's numbers) wait
at their posts, chase a hero within their aggro range, strike when beside
it, and walk home past their leash. A hero at nothing wakes where it
arrived, whole. Bonfires and dropped gold come next. The first fight is the
goblins' camp outside Lanternport's Ember Gate: two torches and a spear,
winnable with the sword alone (three met at once killed in five seconds).

Dev mode (`/atlas/dev/<area>`, behind `DEV_PASSWORD`) plays as the game
does, with a side panel to go to any area (grouped by land), talk to
anyone from anywhere and set the save; H hides it with the HUD. Its free camera (the backquote
key, or "Free camera" at the top) shows the whole area map, centred,
with the wheel and drag back, and stands the hero still; it carries
across crossings.


## Not done yet

- The hero walks, fights, rolls, rests at bonfires, burns embers, picks
  up gold and leads a band hired in Lanternport. The Ember Bull drops
  the Ember Key, which opens the Keep Gate.
- Ten bosses can be killed: the Cinder Troll, Rampart Boar, Stone
  Warden, Ember Bull, Barrow King, Weaver, Shell Below, Old Bamboo, the
  Sun Sentinel and the Grey Warlord.
  Ten bosses fight with moves of their own (`BOSS_KITS` in `hero.ts`),
  each warned on the ground for its wind-up; all but the first two
  hurry below half health:
  - The Cinder Troll, in the Ring, the lesson: club slam, charge, embers
    that burn, all warned long and light; a charge cut short by the Ring's
    rocks leaves him dazed and open; a note at the Ring's mouth says so.
  - The Ember Bull, in the Ember Hollow: a horn swipe and a stomp round
    him after it up close; from four tiles off a rush that ends a tile past
    the mark and leaves him open, never two running; the pines round the
    hollow stop a rush and daze him.
  - The Rampart Boar (the pig rider's sheets): a gore up close, a charge
    the whole width of its wall, the goblins' cannons scattered down on
    the wall, and raging, its spearmen called up onto the wall.
  - The Stone Warden (the giant bat's sheets, in stone): stone-skinned,
    a blow takes a fifth but while it stands open after a move; a wing
    buffet up close, the bell's toll in a ring round it, a dive over the
    bell's frame, the roof's stones shaken down.
  - The Barrow King (the hex shaman's sheets, huge): warded from all harm
    while the three grave totems round his hall stand; a hex burst under
    the mark, grave fire along the ground to it that burns on, and the
    dead raised, three at most.
  - The Weaver, in the Weaver's Web (`web`, under Graveroad, the Sinking
    Stair on past her to Hearthdeep): a bite, a leap over anything,
    venom that burns on, webs that hold whoever walks into them (a
    `snare` on the burning ground), and her brood let down, four at most.
  - The Shell Below, on the Shell Isle (`shellisle`, off Hearthdeep): no
    blade gets through its shell but while it stands open (`stone` 0); a
    bite, a stamp round it, a spin that the lake stops dead and flips it
    open. Past it the Shell Stair up to the Fen, shut from the Fen until
    it falls (a `guard` on the Fen's side).
  - The Grey Warlord, in the Grey Keep (`throne`, off Greyfall's
    crown, the Throne Stair up behind his throne): a cleave, a lunge that
    ends at the mark, the Grey run along the ground to burn on, and past
    half the Grey's dead raised after every lunge.
  - Old Bamboo, on the Tinker Peak (`peak`, the Gnome Lift up past him):
    now fought (the panda's sheets). A roll, a belly slam, bamboo hurled,
    and his cubs called down: he heals while any of them stands.
  - The Sun Sentinel, in the Sun Hall (`sunhall`, in the sky between the
    city and the Throne Isle): now fought (the yellow lancer's sheets
    behind its shield). Its shield parries every blow from the side it
    faces, so it is beaten from behind; a thrust that runs it past you,
    a sunburst ring, sunfire that burns on. It drops the Sun Key, which
    unbars the Gilded Span to the Throne Isle.
  Every boss now has an arena area of its own. On the world map the Fen
  moved ten tiles east for the Shell Stair, and the Steps keep a road to
  the Cloud Bridge so its scattered woods never cut it.
- No minimap. Zoom out with the wheel; ride a lift to change tier.


## The forge yard

Built in the Chapel Ward, where Brenna works. The pack has no smithy, forge
or anvil, but it has enough to compose one.

| Piece | Asset | Use |
| --- | --- | --- |
| Workshop | `Buildings/<Colour> Buildings/House3.png`, open-fronted and timber-framed | The forge shed |
| Armoury look | `Barracks.png`, crossed swords over the door | A bigger weapon smith |
| The smith | `Units/<Colour> Units/Pawn/Pawn_Interact Hammer.png`, 6 frames (plus `Idle Hammer`, `Run Hammer`) | A pawn hammering at the forge |
| Forge fire | `Effects/Fire/Fire.png`, 7 frames; `Particle FX/Fire_01..03` | The glow, and sparks |
| Smoke | `Particle FX/Dust_01`, `Dust_02` | Smoke from the chimney |
| Tools | `Terrain/Resources/Tools/Tool_01..04`: hammer, axe, knife, pickaxe (64px) | A tool rack beside the shed |
| Ore and stock | `Terrain/Resources/Gold/Gold Stones/Gold Stone 1..6`, the wood and meat piles | Stockpiles |
| Swords | `UI Elements/UI Elements/Swords/Swords.png` | A UI icon for a smith's menu, not world art |

Missing:
- **An anvil.** The one piece that says "blacksmith" at a glance. Use a
  decor rock as a stand-in, or draw a 32x32 anvil in the pack's style.
- **A forge, furnace, chimney or bellows.**
- **A smith character.** The hammering pawn is a builder; it reads as a
  smith only beside a forge.

The plan it was built from: `House3` as the shed, a hammering pawn
at an anvil out front, a looping fire with sparks and chimney smoke, and the
tool icons and ore laid out beside it.


## The folk's questline

The folk move out into Aurum as you do, after Dark Souls. There is no log and no choice, and you never speak. Where each stands comes from `whereabouts()` in `npcs.ts`, read from world flags. Some flags are set by hearing a talk to its end (`Talk.sets`). Positions change only on entering an area.

The full lines and stations are in [docs/world/](docs/world/README.md), each land's folk in its own `questline.md`.


| Who | Moved on by | Turns up | Ends |
| --- | --- | --- | --- |
| Tobin | his remark on the well, then a talk | Underwell, Smugglers' Nook; then Graveroad, Robbers' Camp | Stays below counting what his brother steals; gives the Thrown Coin |
| Jory | Tobin gone deeper and the Warlord dead | Graveroad, Robbers' Camp, selling what his camp robbed; then the Old Well in Tobin's place | Stands at the well, Tobin left below |
| Mother Ysolde | the sister freed, then a talk | Underwell, the Drowned Chapel; then Hearthdeep, Pilgrims' Rest | Shell Below alive: kneels over her sisters for good, and Jory sells her candle. Shell Below dead: walks home to the Upper Town and gives the Sister's Candle |
| A Drowned Sister | her second talk | Underwell, the Drowned Chapel | Freed, walks with the wanderer as the Monk |
| The Pilgrim | | Hearthdeep, Pilgrims' Rest | Gives Hollow Water; lies dead once the Shell Below is killed |
| Ansel of the Wall | his remark on the Ember Key | Greyfall, the Ashen Approach | Hear him out twice and he goes ahead and dies in the High City, and Brenna sells his edge; kill the Warlord first and he is back on the wall and gives Ansel's Edge |
| Penny | her crows talk, then reaching Greyfall | Greyfall, Gallows Yard, penned with her mum | Talked to: freed in the Yard when the Warlord falls. Never talked to: stays hidden, her mum walks home. Mum's Bread either way |
| Sergeant Corwin | the Barrow King dead | Kingsrest, Barrow Field, digging out his forty | Watchman heard out: finds the fortieth and gives the Forty's Banner. Otherwise: stops at thirty-nine |
| The Moor Watchman | his remark on the open Moor Gate | Kingsrest, Gibbet Hill, watching the lights | Lies dead in Barrow Field once the King is dead, the fortieth of Corwin's spears |
| Maren | her remark on the Warlord dead | | Sails on the first ship in three winters, and Mags stocks the Salt-Glass Lantern; missed only by never hearing her sail talk |
| Wren | the Ember Key | Emberwood, at Smoke Bluff's foot | Stays, shooting; remarks on Penny gone |
| The Last One | | Kingsrest, the Grey Road, dead from the start | Ferrow's last one, who went east; never named |
| Old Ferrow, Brenna, Mags | | | Stay; remark on the folk's news. Brenna and Mags sell what the questlines turn up |
| Hale, Odo | | | Stay at their posts in the Burg and on the Ramparts |


## The opening

What plays before a new game begins at Tidewake. The script is `PROLOGUE`
in `apps/web/src/app/atlas/prologue.ts`, played by `ProloguePlayer.tsx`; this
file is the why.

### Tone

- **Dark Souls, the opening.** A grave narrator over slow, near-still shots.
  It runs in three movements: an age, its fall, the last ember. Lore is told as
  fact and never explained, names are dropped and not glossed, and the hero is
  not in it until the end, when the game cuts to an undead in a cell.
  [Fandom: Opening (Dark Souls)](https://darksouls.fandom.com/wiki/Opening_(Dark_Souls)),
  [transcript](https://game-scripts-wiki.blogspot.com/2021/10/dark-souls-transcript.html).
- **Skyrim, the cold open.** The player wakes bound in a cart, carried to an
  execution for reasons they do not know. The hero is nameless, a captive,
  moved by others.
  [Game Rant: the opening scene](https://gamerant.com/skyrim-15th-anniversary-opening-scene/),
  [Symbolically Speaking: In the Beginning](https://symbolicallyspeaking.substack.com/p/symbolism-in-skyrim-in-the-beginning).

Taken from both: plain declaratives, no simile, and a turn to the player as a
captive given to the tide. Unlike Dark Souls, each name is said with what it
does (the Grey takes, the Warlord is what it wears, Sunhold refused),
because a cold reader lost the thread when names were only dropped. The cart becomes the tide. Every
paragraph earns its place by carrying one fact: what the realm was, what broke
it, who did not come, what is left, who the player is.

The cutscene is words on black, no shots. An earlier draft cut between the
narration and a live war played by `StrategicScene`; the war read as a trailer
competing with the words, so the film mode was dropped and the screen stays
black. The wording and the pace of its reveal are the whole cutscene.

#### The story it tells

Aurum was a land of lords, bound by oaths and roads. The Grey rose in the
east: not an army but a rot, and what it took went on walking. In the Citadel
it took the first of the lords and wears him still, as the Grey Warlord. The
lords asked Sunhold for aid, were refused, and rode against him alone.
They did not come back. Only Lanternport held, with one fire still burning.
Now the tide has carried a stranger into the caves beneath it. That is the
whole opening: a realm, the Grey, its Warlord, a refusal, a last fire, and the
one left at its foot, who still has to climb to it.

### Storytelling and pacing

- **Reach the game quickly.** A common exercise puts an opening cutscene under
  300 words from fade in to gameplay; this one is 145. Fewer words also mean
  fewer facts to hold before the first choice.
  [Opening Cutscene, Kelsey Reyes](https://www.kelseyfoxreyes.com/post/opening-cutscene)
- **Leave something unknown.** Mystery holds attention better than a complete
  explanation; each paragraph should open a question it does not answer.
  [Writing a More Compelling Game Narrative](https://www.gamedeveloper.com/game-platforms/writing-a-more-compelling-game-narrative)
- **One idea per paragraph.** Readers skip the rest once they lose the thread,
  so each paragraph carries one turn: the realm of lords, the Grey, the
  Warlord it wears, Sunhold's refusal, the last fire, the nameless
  survivor. The Grey and its Warlord used to share one paragraph, and readers
  could not tell who the Warlord was; they have one each now.
  [How Users Read on the Web, NN/g](https://www.nngroup.com/articles/how-users-read-on-the-web/)
- **Read off the screen, not the page.** BBC guidance is 160-180 words a minute
  (about 0.3 s a word) with at least a 1.5 s gap between captions; Netflix caps
  adult subtitles at 20 characters a second. This runs at 360 ms a word, about
  165 wpm, with a 1.5 s black gap, so the text sits below the ceiling rather
  than at it.
  [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/),
  [Netflix English Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)
- **Mixed case, left edge, room to breathe.** For blocks longer than a few
  words, mixed case, unjustified left alignment, 1.5 line spacing and about 70
  characters a line are the readable defaults; all caps is not meant for full
  paragraphs. The narration is therefore Georgia, mixed case, left aligned in
  a centred block, at 1.55 line height, while Cinzel stays for the title.
  [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-simple-clear-text-formatting/),
  [Typography for Glanceable Reading, NN/g](https://www.nngroup.com/articles/glanceable-fonts/)

### Lore it rests on

The game and world sections above are the authority for places and mechanics. The opening is the
front-facing telling, and it uses the names survivors would use: the Grey, the
Sunhold, a nameless survivor for the hero the game later gives a class.
Where it chooses different words, it says why.

- Aurum is a realm of lords in the world section above; Last
  Lanternport is its hub, and every road out of it comes back to Lanternport's
  fire (Ferrow: "Every road out of here comes back to this fire").
- The Grey rose from the deeps under Greyfall; Lanternport, west of it,
  says it came out of the east, and the script keeps Lanternport's telling.
  It is thickest in Greyfall. It crowned the Grey Warlord. The black
  soldiers are the taken, and the gnolls run with the Grey as its dogs. Ansel
  says the Grey smells of "wet ash and old iron".
- Sunhold is the sky city. Ansel says it "never sent us a single
  spear when the Grey came"; the script turns that into "sent no aid", which is
  what Aurum remembers.
- Old Ferrow keeps Lanternport's fire, and the script's "one fire still
  burning" is his. He is not named in it: the player meets him a minute later
  and hears "Ah. Another one." from him, which the opening should not spoil.
- The Grey Warlord has no personal name in the world; the script calls him
  only by his title. He is the Grey's crown, not its general.
- The player is the survivor the tide brings in. The game's docs give the hero
  a class, not a rank; the opening refuses even the name. It ends in the
  caves, not the town, because that is where the game starts: Tidewake,
  with Lanternport's fire still to reach.

### The beats

Six short paragraphs, shown one at a time, then the title. The spine is a
chain anyone can follow: the lords held Aurum, the Grey rose, it took the
first lord and wears him as the Grey Warlord, Sunhold sent no aid, the
lords rode against him alone and did not return, Lanternport held with one
fire, and the tide left a stranger in the caves beneath it.

Six names at most: Aurum, the Grey, the Citadel, the Grey Warlord, the
Sunhold, Lanternport. An earlier draft also named the old kings, their
barrows and Old Ferrow; none paid off inside the opening, and a cold reader
could not hold them all. Each beat is shown alone on black, so none leans on
the one before it for its meaning ("the town", not "it").

The forty spears and the Citadel were cut from an earlier draft. Corwin's forty
died in the barrows, not at the Citadel, and "the Citadel" was easy to confuse
with Highward, so the line was both confusing and wrong. What remains is
Ansel's plain claim: Sunhold sent no aid.

| # | Paragraph | Why |
| --- | --- | --- |
| 1 | Aurum was a land of lords. Each kept his own hall, and oaths and roads bound the halls together. | The world before |
| 2 | Then the Grey rose in the east. It was no army. It was a rot. The fields it touched went grey, and the men it took went on walking after their names were gone. | What the Grey is, and what it does to people |
| 3 | In the Citadel it took the first of the lords, and wears him still. He is called the Grey Warlord, and where he stands, the Grey is thickest. | Who the Warlord is, and where the player must go |
| 4 | The lords asked Sunhold in the sky for aid. Its gates stayed shut, and they rode against the Warlord alone. Their banners did not return. | The refusal, then the cost after a pause |
| 5 | Only Lanternport held: a town at the edge of the sea, its gates barred, one fire still burning. | The last hold, and the fire the player will rest at |
| 6 | Now the tide has carried a stranger into the caves beneath the town. Nameless, half-drowned, and alive. | The player, below the last hold, not yet in it; "Now" marks the turn from history to the present |

Then the title card, **GREYFALL**, *Ashen Crown*, and the black fades
out on Tidewake: the sea cave behind the overlay is the arrival.

### Playing it

- Each paragraph opens on 1.5 s of black, fades in whole over 1.8 s, holds
  fully visible for 360 ms a word, then fades out over 1.2 s. The next
  paragraph starts on black again, so nothing is read while it moves. The
  Sunhold card opens on 2.5 s of black; its paragraph holds, fades out
  over 1.2 s, and after 1 s of black its last sentence fades in alone in the
  same place, the cost given a card of its own. The whole run is about 90 s
  including the title.
- The title holds 5.2 s, then the overlay fades over 1.6 s, not onto the
  hero but onto the whole Landing at once, the camera pulled out to fit it
  (`intro()` in `AtlasScene.ts`). The wide shot holds 2.2 s from the title's
  end, then the camera flies in to the hero over 3.4 s, eased in and out,
  and lands exactly where the bounded follow camera sits, so play takes over
  without a jump. Only then do the HUD fade up (0.9 s), Tidewake's name
  rise, and the hero answer the keys. This is the camera handoff of
  cutscene-led games (Uncharted 4, God of War 2018): the scripted camera
  blends into the gameplay one, and the interface comes last.
  [Game Anim: Interactive Cinematics in Uncharted 4](https://www.gameanim.com/2018/03/09/interactive-cinematics-in-uncharted-4/),
  [80.lv: the evolution of game cinematics](https://80.lv/articles/from-pixel-scenes-to-one-shot-cameras-the-evolution-of-game-cinematics)
- A click or any key moves to the next card; holding Esc, Space or Enter for a
  second skips to the end.
