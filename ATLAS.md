# The Atlas

Oct 26, 2026 · revised Oct 26: three tiers, lifts between them, and heights to five · Oct 27: natural terrain

## Summary

The Shattered Reach as one world, at `/atlas`. It isn't a game yet: it's the
world to build one in. It stands in three tiers on one grid:

- **The Gilded Reach (sky):** a sky city overhead.
- **The Surface:** seven lands on the sea.
- **The Underneath:** caverns cut from the rock below.

Within a tier, areas are joined only at named gates, the way a Souls map
joins them. Between tiers, lifts, wells, a sinkhole and a stair join them at
the same spot on the grid, so what is above a place is really above it.

Each tier is the war island's height-map format (`island.ts`), so the war's
autotiler draws it (foam, south cliffs, irregular plateaus, up to five heights,
roads) and its pathing walks it. The data is
`packages/engine/src/atlas.ts`; the dressing is
`apps/web/src/game/AtlasScene.ts`.

## From Dark Souls

| Dark Souls | Here |
| --- | --- |
| Areas stacked over each other: Anor Londo over Blighttown, the Depths under the Burg ([TheGamer](https://www.thegamer.com/dark-souls-1-fromsoftwares-magnum-opus-of-interconnected-level-design/), [James Roha](https://medium.com/@Jamesroha/world-design-lessons-from-fromsoftware-78cadc8982df)) | The Gilded Reach floats over the Crags and the citadel; the Undercroft lies under the town, the Deeps under the moor, the Hollow under the fen |
| Firelink as the hub every road returns to | Last Harbour: the Old Bridge, the Ember Gate, the Moor Gate, the Old Well down and the Watch Lift up all start in it |
| Elevators that open as shortcuts home | The Moor Gate opens from the moor; the Watch Lift opens from the sky and drops you on the castle |
| Ash Lake: a quiet wonder at the very bottom ([Medium](https://medium.com/@bramasolejm030206/preface-ec08bc1459d0)) | The Drowned Hollow: a still lake under the fen, stone trees, gold in the rock, and the Shell Below asleep |
| One-way drops that commit you | The Old Well and the Fen Sinkhole go down only. The Underneath has its own way back up: the Barrow Cave. |

## The tiers and areas

| Tier | Area | Who's there | Keeper |
| --- | --- | --- | --- |
| Sky | Skyward Steps | drifting isles with watch posts, a lift down onto the castle | |
| Sky | The Gilded Reach | the gnome-kings' golden hall on its own height, yellow guard, a monastery, bees, the warlord's throne isle with imps | The Sun Sentinel |
| Surface | Saltreach | yellow militia, fishing villages, turtles, sharks offshore, pirate towers | |
| Surface | Last Harbour (hub) | the blue castle on its own height above the town, the bonfire square, the Old Well, pawns at work | |
| Surface | Emberwood | goblin warrens, the big pines (standing still), gnolls on Smoke Ridge | Cinder Troll |
| Surface | Tinker Crags | a mesa that steps up three heights to the Tinker Peak, gnomes, bears, pandas, the Gnome Lift up | Old Bamboo |
| Surface | Barrowmoor | barrows, bones, the cave down to the Deeps | The Barrow King |
| Surface | Lizard Fen | the purple chapel, lizards, the sinkhole | |
| Surface | The Greyfall | the citadel, its keep on the fourth height, the black legion, the Throne Stair up | The Grey Warlord |
| Below | The Undercroft | cisterns and pillars under the well, a crypt, spiders, a thief | |
| Below | Barrow Deeps | tomb daises, skull guards, a dead troll's bones | The Weaver (a giant spider) |
| Below | The Drowned Hollow | the underground lake, stone trees, turtles, glowing gold | The Shell Below (a giant turtle) |

## Gates and lifts

```
SKY       Skyward Steps ──Cloud Bridge── The Gilded Reach
               │ Watch Lift (shortcut)       │ Gnome Lift      │ Throne Stair
SURFACE   Last Harbour ...(gates as before)... Tinker Crags ... The Greyfall
               │ Old Well (drop)      │ Barrow Cave (lift)  │ Fen Sinkhole (drop)
BELOW     The Undercroft ──Cistern Run── Barrow Deeps ──Sinking Stair── The Drowned Hollow
```

- **Surface gates:**
  - Open: Old Bridge, Crag Stair, Fen Causeway, Barrow Path.
  - Barred: the Ember Gate.
  - Shortcut: the Moor Gate.
  - Locked: the Grey Gate.
  - High road: the Sky Bridge.
- **Lifts:**
  - **Both ways:** the Gnome Lift off the Tinker Peak, the Throne Stair from
    the keep, the Barrow Cave.
  - **Down only:** the Old Well and the Fen Sinkhole.
  - **Shortcut:** the Watch Lift, opened from the Steps, after which it is
    the road home.

## Heights

The engine now reads five heights:

| Height | Tops | Stairs |
| --- | --- | --- |
| Lowland | `.` | |
| 2 | `#` | `<` `>` |
| 3, the Crown | `^` | `[` `]` |
| 4 | `4` | `{` `}` |
| 5 | `5` | `(` `)` |

The renderer draws every height the map has.

### Terrain

High ground is generated, not drawn as rectangles, after the pack's own map
art (the Tiny Swords banner):
- **Shape:** broad, irregular tables whose cliffs run straight and notch in
  and out, can drop straight into the sea, and share the lowland's green,
  so the cliff and its shadow alone show the height.
- **Placing it:** an area asks for it with `t.relief({ area, at, rx, ry,
  levels, core })`: a summit at `at`, falling away over `rx` by `ry` tiles,
  in up to `levels` heights. `core` holds the top height round a lift or a
  keep.

How `terrain()` in `atlas.ts` lays it down:

1. **Outlines:** each height gets its own outline from a falloff plus two
   octaves of value noise. Higher heights drift north, because cliffs face
   south and so stack into one face, and shrink, so they read as terraces,
   not rings.
2. **Smoothing:** a majority filter, then a straightening pass that fills
   and drops one- and two-tile runs in every row and column, so edges step
   in notches, not zigzags.
3. **Nesting:** each height stands two tiles inside the one below, so its
   cliff, its stairs and a walk past its foot all stand on that height.
   Slivers under two tiles wide go.
4. **Valleys:** roads, gates and bridges are kept a tile clear, so they run
   through the high ground as valleys. A high road's two ends are forced to
   the second height, where it lands.
5. **Stairs:** each table gets a stair at both ends of its bottom row in
   every area it spans. A table that can take none is levelled.
6. **Repairs:** after the woods are planted, any high ground no stair
   reaches comes down a height, and anything standing on a cliff face or a
   stair steps off it onto open ground.

### Placing buildings

Every building has a footprint measured off its art (`FOOT` and
`footprint()` in `atlas.ts`): its width in tiles and its depth back from its
base row.

- **Its base:** every tile of it is open, walkable ground of one height in
  the building's own area.
- **The ring round it:** a tile of that same ground all round. Woods may
  stand at its side, but not the sea, a cliff face, a stair or another
  height, so nothing sits on a cliff's lip or the shore.
- **Neighbours:** no two buildings touch.
- **Boats:** a boat sits wholly in open water.
- **Bonfires:** follow the same ring rule.

A building that doesn't fit where it's written moves to the nearest spot that
does, on the height meant for it when there is one. The scene keeps every
footprint clear of bushes, rocks and trees. A test checks all of this on
every tier.

Woods are lowland only. Trees on the high ground are the scene's dressing,
so they never wall a ledge off.

## What the tests guarantee

`packages/engine/test/atlas.test.ts`:

- **The grid:** the three tiers lie on one grid, a tile for a tile.
- **Gates:** in each tier, bar every gate and no area reaches another, and
  each gate alone joins exactly its two areas.
- **Lifts:** every end stands on walkable ground in the area it names, the
  two ends sit within five tiles of each other on the grid, and the up end
  is always the higher tier.
- **One world:** from the Harbour, walking and riding lifts only the way
  they go, you reach every area of every tier.
- **The loops:** the sky is reached the long way before the Watch Lift is
  opened. The Underneath has its own way up. The Hollow is reached both by
  the drop and by the stair. The moor and the citadel each have two ways in.
- **Placements:** every building stands on ground, every boat at sea, and
  every walker's patrol is walkable, on every tier.
- **Heights:** every height on every tier can be climbed to, and the Surface
  has a third.

## Dressing

- **The Surface** is as before: per-area ground, woods, clutter, faction
  buildings, bonfires, fenced gates, life, and light.
- **Each tier shows alone.** The sky gets sunlit gold ground, cloud clinging
  to the isles' rims, and a cloud bank over open blue beneath them.
- **The Underneath** is bare rock in near-black, with its caverns lit by
  their area's light. Its lakes are dark water, and the gold in the walls
  and the bonfires glow.
- **Lift ends:** an up end is a shaft of light, a down end a dark mouth in
  the ground. Each is labelled with where it goes and which way it runs.
  Click one to ride it.
- **The page:** tabs for Sky, Surface and Below, an area index by tier, and
  cards that list each area's gates and lifts.

## Adding to it

- **Places:** each tier is built in its own function (`sky`, `surface` or
  `below` in `atlas.ts`). Every place is a line: `prop("goblinHut", col,
  row)`, or `who("bear", col, row, { to: { col, row } })` for a walker.
- **Lifts** go in `LIFTS`, with an up end and a down end.
- **Art** for a new name goes in `PROP` or `BEAST` in the scene.
- **Then run the tests:** they name any building in the sea, any walker on a
  cliff face, any gate that leaks, and any lift that lands nowhere.

## Area maps

Each area also gets its own large map (`areas.ts`, 112 x 72 tiles), built
with the same `tierBuilder`. "Enter" on an area's card opens it, and the
camera stays inside that map. An exit at its edge, or a lift or well inside
it, takes you to the next area. If that area has no map yet, you go back to
the atlas, focused on it.

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
  (its `clearing`, 6 by default; the Harbour's town and fields are wider).
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
- Only the Harbour is mapped so far, in eight districts: the Citadel (three
  terraces up to the keep), Old Town (two raised streets round the square),
  the Docks (the Sea Wall across the bay), West Fields, the Northwood and the
  Keepwood, the Mine Hills and the Moor Watch. Three raised bridges: the Knoll
  Bridge, the Sky Bridge (upper bailey to the hills) and the Sea Wall.
  Emberwood is the second: the Ember Run (a river, cut with `river()`) splits
  it, crossed at the Cinder Ford, an east bridge, the Pine Ford, and the
  Treetop Walk raised from Smoke Bluff to the goblins' Warren Hill. The Cinder
  Troll waits in Troll's Hollow, a ring of rock with one gap. An exit's sign
  is clickable as well as its tile, since an exit on the map's edge can sit
  off-screen.
  Tinker Crags is the third: the Tinker Rock climbs in five gnome-built
  steps, each two overlapping blocks so no ledge runs an even width, with
  every stair at the far end from the last, so the climb walks each ledge
  (on at the south-west, up at the east, the west, the east again). Old
  Bamboo holds the fourth step where the climb arrives; the Gnome Lift
  rises off the summit, and the Sky Bridge runs off it east, raised, to the
  map's edge toward the Greyfall. Its terraces carry cannon batteries on every rim, watchtowers, a raised Gun Platform with
  its own stair, and fenced workshop yards with wood, tools and stores.
  The Greyfall is the fourth, a castle that is the level, after Stormveil:
  a walkable curtain wall with a bastion on each corner, the locked Grey
  Gate a gap in its west side over the Ashen Approach, and the Sky Bridge
  landing on the north rampart, which runs straight into the Middle Ward:
  the other way in, past the bailey. Inside, the ruined Outer Bailey, the
  Ruined Chapel and the Gallows Yard (the Harbour's folk penned); then the
  Middle Ward, the Upper Ward with the Warlord's hall, and the Keep on the
  fourth height, its stairs changing sides each step. `ground()` lays exact
  rectangles of land, so walls stand on ground to their corners.
  Reworked after Caelid and Sellia: a river of rot down the bailey into the Crater, a lake (`lake()`) with a
  shrine and bonfire on its isle, crags standing out of the rot, gnolls for
  its dogs; and the wards are now the High City: six raised blocks, each
  standing alone with a street on every side and a stair at both front
  corners (blocks that touched each other or the walls fused into one
  slab and stranded their stairs), raised walkways over the streets, the
  Warlord's Hall and the Keep's tier above, and the Keep on the fourth
  height, each block furnished as its own quarter.
  The Harbour's citadel and Old Town and Emberwood's warrens got the same
  furnishing as the Crags: trails, guns on the walls, stores and trophies.
  The Gilded Reach is the fifth, a city of isles in the sky after Anor
  Londo and Leyndell: each quarter its own isle (Cloud Landing, the Gold
  Market, the Bee Gardens, Gnome Landing, the Gilded Gate, the Sun Chapel)
  joined by narrow bridges over open sky, and the capital climbing the Sun
  Steps in three terraces to the Sun Hall, where the Sun Sentinel stands.
  The Throne Isle hangs off the east end, reached only by the raised
  Gilded Span.
  Skyward Steps is the sixth, a descent after the Ringed City's broken
  stairs: from the Cloud Pier up the Broken Stair, across the raised Old
  Span to the Windward Rest, down its steps, then by rope bridges over the
  Hanging Graves and the Bell Isle to the Watch Isle and its lift onto the
  Harbour's castle; the Hermit's Rock and the Gold Wreck are dead ends off
  the way. A stair onto the third height must rise from second-height
  ground, so a high isle steps down through a ledge to its lowland; and a
  bridge must run from well inside one isle, as a ragged rim leaves one
  that stops at the edge joined to nothing.
  The Undercroft is the seventh and the first underground: a chain of
  caverns joined by tunnels (Well Bottom, Cisterns, Spider Pillars,
  Drowned Chapel, the raised Ossuary, Smugglers' Nook, the Dig), its maze
  walls turned to standing rock by `stone()`, dressed in rubble, not
  trees. A tunnel must run from well inside one cavern to well inside the
  next: one ending at a ragged rim joins nothing, and everything past it
  goes to wall.
  Barrow Deeps is the eighth, a tall shaft of tombs after the Catacombs
  and the Tomb of Giants: the Barrow Cave lift lands on the crown of the
  Great Barrow, a tomb in two steps, and every way from it goes down, past
  the Ossuary Galleries, the Drowned Graves, the Robbers' Camp and the
  Collapsed Hall, to the Weaver's Web, a pillared vault where the Weaver
  waits, and the Sinking Stair on toward the Hollow.
  The Drowned Hollow is the ninth, the bottom of the world after Ash
  Lake: a great still lake with a ring of shore round it (the Stair Foot,
  the Stone Grove, the West Shallows, Pilgrims' Rest, Sinkhole Landing),
  two causeways over the Gold Shoals out to the raised Shell Isle where
  the Shell Below sleeps. Two rules came out of it: shores that only
  graze each other count as sealed and go to rock, so join them with
  tunnels centre to centre; and underground, rock is high ground, so a
  tile directly under rock is a cliff face: an exit at a map's top edge
  stands a row down.
  Barrowmoor is the tenth, the old kings' moor after Limgrave's heath and
  Lordran's graveyards: a broad moor with three tongues out to its gates
  (the Moor Gate, the Grey Road to the Grey Gate, the Fen Path), grassy
  barrows rising out of the dead wood of the Heath and Barrow Field,
  Gibbet Hill, the Dead Mere, and the King's Barrow, two exact steps with
  the Barrow King on its crown and the Barrow Cave at its foot. A grown
  relief lost its top step there, so the great mound is built from blocks,
  with land of its own under it so its back does not stand in the sea.
- **Underground maps are rooms and passages in the dark**, not mazes:
  separate chambers cut from solid rock, joined by bending `tunnel()`s
  three tiles wide (under rock a tile is a cliff face, so a narrower one
  cannot be walked), fallen rock (`rubble()`) in the larger chambers, and
  most of the canvas left as rock. The scene lights them near black but in
  pools round fires, exits and gold, and open water takes the area's own
  tone, dimmed. The Undercroft branches from the well, the Deeps zig-zag
  down to the Weaver, the Hollow is a lake with shores on three sides and
  bare rock on the fourth.
- **Every area is built its own way, and floats.** Sea and sky maps are
  padded 10 tiles with open sea or sky (`pad()`, which runs each edge
  exit out along a causeway to the new edge), so land never fills the
  frame. Only Emberwood keeps the wooded `maze()`; elsewhere the ground
  is shaped to its place: the Harbour an open town with hedgerowed fields
  (`hedge()`), the Crags knolls, outcrops and scrub copses round the
  mountain's foot, the Greyfall open courts with clumps of dead wood in
  its bailey, the Gilded Reach plazas with tree avenues (`avenue()`) and
  one hanging garden, the Steps bare isles with lone trees, Barrowmoor an
  open heath of barrows and thickets.
- **Lizard Fen** is a wheel, unlike any other area: a ring of reed and
  mud round a great black basin, the Chapel Mound on its isle at the hub
  (two steps, the purple chapel, the sinkhole down to the Hollow), six
  duckboard spokes out across hummocks with a stilt hut on each to the
  rim, where the districts sit: Causeway Landing, the Reedbeds, the
  Barrow Rise climbing to the moor, the Eel Shallows, the Drowned
  Village and the Lizard Warren's mound.
- **Saltreach** is the twelfth and last, and unlike any other area a
  crescent of isles round an open lagoon: Old Bridge Landing where the
  road comes in from the Harbour, the fenced Saltworks, the Shingle Spit
  the Fen Causeway runs out along, Netmakers' Village, the yellow
  militia's Fort on its two-step crown, Pirate Cove round its hidden cove,
  Lighthouse Rock at the tip, and the Reef, a broken ring of islets across
  the lagoon's mouth, with the Drowned Shrine on its islet in the middle.
  On an isle map, lowland goes only to a district whose seed is on the
  same isle (bridges do not join isles for this), so the sounds are the
  colour borders; a bridge takes the colour of the land at each end. A
  district's seed must stand on its own isle, or the isle takes a
  neighbour's colour. An exit must not sit on a map's last row, which the
  builder never writes.
- **Barrowmoor is a tableland**, unlike any other area: one great plateau
  ringed by cliffs over a skirt of bog (the Moor Gate, the Grey Road, the
  Fen Path), the Heath across its top in dead thickets, lesser barrows and
  Gibbet Hill rising out of it as mounds of their own, the Dead Mere sunk
  into it, and the King's Barrow two steps higher at its heart with the
  Barrow King on its crown and the Barrow Cave at its foot. Ground a
  landform names is never absorbed as a pocket, so a small barrow keeps
  its district's colour.
- **The Greyfall is a citadel-crag**: no walls or blocks, but one great
  rock rising out of the rot-marsh in four ragged tiers (the Lower City,
  the High City, the Warlord's Hall, the Keep on its crown), the tiers
  alternating stone colours, with a spur west for the gnomes' Sky Bridge
  to land on. Rotfield, the Crater shrine, the Ruined Chapel, the Gallows
  Yard and the Ashen Approach lie in the marsh round its foot.
- **Emberwood** keeps its maze, but its hills and Troll's Hollow (once a
  rectangular ring of blocks, now a raised arena of ash) are landforms.
- **Area maps carry no banner**: an area's name is on its land, and
  "Back to the atlas" is the one control left at the top.
- **Area maps draw no roads.** A road there is open ground in the
  district's own colour: the engine's roads still keep woods and buildings
  off it, but a road tile's other colour read as a stripe painted across
  the districts. The atlas keeps its drawn roads.
- **Districts are landforms, packed like the atlas.** `shape(level, cx,
  cy, rx, ry)` lays irregular ground at an exact height, an ellipse whose
  rim wanders by noise, with a corner squared off on each lower flank so a
  stair can stand there; each landform finds its own stairs onto the
  ground under it. The Harbour is built from them: the Keep on the
  Citadel on the Upper Town on Old Town, the Northwood and the Mine Hills
  as uplands either side, the Moor Watch's bluff, with land run to the
  frame's edge (sea and sky maps keep a margin of only 3 tiles). Stacked
  rectangles and full-width bands both read as slabs and were dropped. A
  landform names its district (`shape(..., owner)`) and gives it every
  tile it covers, so one landform is one colour; a district's `levels`
  names the heights it takes on the lowland and elsewhere. Any patch of a
  district under 60 tiles that is not its main piece goes to the district
  round it, so the noise in the borders leaves no islands. `districtAt` is base-36, read with `districtOf()`.
- **A district is one colour.** A district's `palette` can be a single
  tileset colour for all its heights; the Harbour's districts each are, in
  the atlas's family (green town, citadel and docks, gold fields, fresh
  woods, dusty Mine Hills, teal Moor Watch), and district borders are
  broad and gentle so the colours meet in curves, not a patchwork. A
  district's `decor` thickens its bushes and rocks, for the atlas's
  texture in the grass.
- **Tinker Crags is a mountain, not a pyramid:** five reliefs of their own
  shapes grown into each other (the summit massif, a broad west shoulder
  where Old Bamboo waits, a long thin east ridge, a squat north crag with
  the workshop yard, a low south spur with the gold mine), outlines
  wandered by noise, the stairs placed by the terrain. Nested rectangular
  blocks read as a stepped pyramid and were dropped. The mountain's
  districts share one ramp by height (`MOUNTAIN`: fresh grass, green
  slopes, bare rock, a gold summit) so its tiers read without a patchwork;
  scrub dresses its lower slopes and boulders its upper. A stream runs off
  its west face under a footbridge, a tarn sits under the outcrops, and the
  gnomes' Terraces on the southern spur are fenced plots with their stock.
- **Each area has its own frame and silhouette:** the Harbour taller,
  with Lighthouse Point curling round the bay; Emberwood a long valley
  with the sea biting its corners; the Crags tall, with the Southern Spur
  running into the sea; the Greyfall's coast broken into coves and
  stacks; the Undercroft a chain of caverns.
  `test/areas.test.ts` checks every mapped area: every exit and height can be
  reached from the entry, every bridge deck stays raised, all land belongs to
  a district, and every building sits wholly on its ground.

## Not done yet

- Nothing is playable on it: no warband, no keys, no gates or lifts that
  open.
- No minimap. Zoom out with the wheel, and switch tiers with the tabs.

## Planned: a blacksmith

The pack has no smithy, forge or anvil, but it has enough to compose one.

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

Plan: compose it in Last Harbour from `House3` as the shed, a hammering pawn
at an anvil out front, a looping fire with sparks and chimney smoke, and the
tool icons and ore laid out beside it.
