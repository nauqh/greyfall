# The Atlas

Oct 26, 2026 · revised Oct 26: three tiers, lifts between them, and heights to five · Oct 27: natural terrain · Oct 31: every area mapped

## Summary

The Shattered Reach as one world. `/atlas` starts the game on the Landing;
the whole world is the travel map at `/atlas/map`, opened from a bonfire.
It stands in three tiers on one grid:

- **The Gilded Reach (sky):** a sky city overhead.
- **The Surface:** eight lands on the sea.
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
| Surface | The Landing (start) | the beach a new game starts on, notes in the sand that teach the controls, two goblins to learn on | Shore Minotaur |
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
  - Open: Shore Road, Old Bridge, Crag Stair, Fen Causeway, Barrow Path.
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
- **The page:** the map fills it, and the selected area's card floats over
  it: name, tier, blurb, keeper, and "Enter" to its own map. H hides the
  HUD. Lifts are the only way between tiers.

## Adding to it

- **Places:** each tier is built in its own function (`sky`, `surface` or
  `below` in `atlas.ts`). Every place is a line: `prop("goblinHut", col,
  row)`, or `who("bear", col, row, { to: { col, row } })` for a walker.
- **Lifts** go in `LIFTS`, with an up end and a down end.
- **Art** for a new name goes in `PROP` or `BEAST` in the scene.
- **Then run the tests:** they name any building in the sea, any walker on a
  cliff face, any gate that leaks, and any lift that lands nowhere.

## Area maps

Every area has its own large map (`areas.ts`, 112 x 72 tiles), built with
the same `tierBuilder`, at `/atlas/<area>`, and the camera stays inside
that map. An exit at its edge, or a lift or well inside it, takes you to
the next area's map. Resting at a bonfire sits the captain by it, with
Travel and Leave: Travel opens the map, whose area cards list the
bonfires lit there, each one a place to travel to.

Crossing between areas never leaves the page: the scene rebuilds itself
as the next map inside the same game (`travel` on its api) while the
address follows quietly (`/atlas/<area>?from=<area>`), and you arrive at
the exit back the way you came, not the area's front door. Each kind of
crossing has its own cover, held while the next map is built: walking
out draws the game's own cloud bank in and parts it on the next map
(a dark wipe read as ugly); a drop closes the dark in on the
hole, then the view falls onto the spot with a jolt; a lift passes rock
upward going down and cloud downward going up; a stair into the deep
closes in slowly on the stairway. The first time you take a one-way
drop, it asks first. The area's name is not announced again when you
step straight back into the area you just left. Each crossing is drawn as the
thing it is: the Old Well a ring of stones with posts and a rope beam,
the Fen Sinkhole a reed-ringed pool of black water drawing down, a lift
by its own building (the cave, the gnomes' tower, the keep) nothing
more, a lift standing alone a railed plank floor. The dark hole and the
white shaft of light that marked every crossing are gone.

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
- The Harbour was mapped first, in eight districts: the Citadel (three
  terraces up to the keep), Old Town (two raised streets round the square),
  the Docks (the Sea Wall across the bay), West Fields, the Northwood and the
  Keepwood, the Mine Hills and the Moor Watch. Three raised bridges: the Knoll
  Bridge, the Sky Bridge (upper bailey to the hills) and the Sea Wall.
  Emberwood is the second: the Ember Run (a river, cut with `river()`) splits
  it, crossed at the Cinder Ford, an east bridge, the Pine Ford, and the
  Treetop Walk raised from Smoke Bluff to the goblins' Warren Hill. The Cinder
  Troll waits in Troll's Hollow, a ring of rock with one gap. Exits carry no
  sign: a cloud bank lies across each, and E's prompt names where it goes.
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
  All gold and sunlight: the city climbs from fresh green to gold, with
  only the warlord's isle dark. The yellow guard hold the span's foot,
  a tower either side and archers on its landing, because the span is
  the one way the warlord's creatures can come in; the Gilded Gate isle
  is their garrison. The market keeps its livestock in a pen.
  Skyward Steps is the sixth, a descent after the Ringed City's broken
  stairs: from the Cloud Pier up the Broken Stair, across the raised Old
  Span to the Windward Rest, down its steps, then by rope bridges over the
  Hanging Graves and the Bell Isle to the Watch Isle and its lift onto the
  Harbour's castle; the Hermit's Rock and the Gold Wreck are dead ends off
  the way. The Gold Wreck's barge hangs off the
  isle's edge in the sky where it fell short, its timbers and gold
  spilt across the rock for the imps. A stair onto the third height must rise from second-height
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
- **The three underground maps are three different places.** The
  Undercroft is the one people built: square halls and straight
  corridors on a cross from the well (`ground()` rectangles, `tunnel()`
  lines), torches in brackets along the walls (`sconce`), lit warm amber
  on brown-black rock, with only the Dig left as ragged rock because it
  is the tunnel nobody admits to. Barrow Deeps is a tomb: the darkest map,
  cold black rock, its fires burning ghost-green, green grave-mist, and
  the dead laid in rows (the kings' two ranks before the Great Barrow,
  the Ossuary Galleries' rows, graves running into the Drowned Graves'
  pool). The Drowned Hollow is the quiet wonder: the brightest map, pale
  blue on deep-blue rock, few fires, the gold glowing far over the
  water, stone trees standing in the lake and in the Stone Grove. Each
  map's light is `UNDER` in `AtlasScene.ts`.
- **Every unit is under the light.** The cloud, light and HUD layers sit
  above any map up to 300 tiles tall: they once sat at 5000, so on a map
  over 63 tiles tall (Barrow Deeps is 96) everything south of row 63
  sorted above the darkness and shone at full brightness.
- **Underground maps are rooms and passages in the dark**, not mazes:
  separate chambers cut from solid rock, joined by bending `tunnel()`s
  three tiles wide (under rock a tile is a cliff face, so a narrower one
  cannot be walked), fallen rock (`rubble()`) in the larger chambers, and
  most of the canvas left as rock. The scene lights them near black but in
  pools round fires, exits and gold, and open water takes the area's own
  tone, dimmed. The Undercroft branches from the well, the Deeps zig-zag
  down to the Weaver, the Hollow is a lake with shores on three sides and
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
  is shaped to its place: the Harbour an open town with hedgerowed fields
  (`hedge()`), the Crags knolls, outcrops and scrub copses round the
  mountain's foot, the Greyfall open courts with clumps of dead wood in
  its bailey, the Gilded Reach plazas with tree avenues (`avenue()`) and
  one hanging garden, the Steps bare isles with lone trees, Barrowmoor
  clearings walled by dead thicket.
- **Lizard Fen** is a spiral that climbs: one causeway of reed coiling two
  turns inward through black water, each district a tier higher than the
  last (Causeway Landing on the lowland, the Eel Shallows, the Drowned
  Village, the Lizard Warren ringing the heart, the Chapel Mound on the
  fifth height at the centre over the sinkhole). The engine's heights stop
  at five, so five districts. A tier ends where the coil runs east-west,
  the only place a stair can stand (stairs sit beside a table's bottom
  row), and the higher tier's first two columns are cut back below the
  coil's centre line in a straight notch so the stair has lower ground
  above and below it; a notch following the ragged edge put the stair
  over water, and the engine then erased every tier above.
  The fen tells its story inward along the causeway, and each thing
  stands where its people would put it (`spot(turns, along, out)` places
  on the coil, `out` toward the water side): Saltreach's militia at the
  landing with a jetty, hut over the water and its boat below; the
  moor's dead buried at the Barrow Rise beside the Barrow Path, stakes in
  rows; the fishers' stilt village along Eel Shallows, each hut with its
  boat and catch, one shared fire; the Drowned Village's houses still
  lining both sides of its old street, no fire lit, reed closing over its
  end; the lizard-folk's stakes at the top of the stair, their huts
  ringing one fire; the cult's ring of stakes round the sinkhole under
  the chapel. Sharks keep to the deep channels, out of the shallows.
- **Saltreach** is a stilt town: no land to speak of, a web of a dozen
  small timber platforms on the shallows knotted by boardwalks into short
  ways and loops, each platform a room with one job (the toll landing,
  the fish market, the saltworks, the net lofts, the village, Gull Rock,
  Pirate Cove, the raised Lighthouse Rock and Militia Fort, Smugglers'
  Steps, the eel pens, the Shingle Spit out to the Fen). Compact, not an
  open world: the boardwalks are the only ways.
  The walks tell its story: the catch and the salt go out over the Old
  Bridge, so the market and saltworks crowd the landing; the fishers
  live at the heart where every walk meets; the pirates hold the far
  west, joined to the town by one plank off Gull Rock, where the
  militia keep a watch, and the fort's guns face the cove; the
  smugglers' landing under the village has no way on but the water.
  Boats are moored at the platforms, sharks keep offshore past the
  pirates, and the town stands on one green timber, the pirates' and
  smugglers' ground a shade darker.
- **Barrowmoor is clearings in dead thicket**, about a screen each, so
  every few steps is a new place: the Moor Gate, the Wayshrine (the first
  fire), Barrow Field's four mounds, Gibbet Hill, the Burned Hamlet, the
  Mourners' Way up to the King's Barrow (two steps, the Barrow King on its
  crown, the cave at its foot), the Robbers' Camp, the Troll's Grave, the
  Dead Mere, the Grey Road and the Fen Path. `finish()`'s `open` is the
  clearings' ragged ellipses; the lanes are roads, so they stay clear, with
  loops round the Mourners' Way and the Troll's Grave. It was a
  tableland, one plateau 88 by 50 with a few trees on it: up close it
  read as empty, and woods grow only on lowland, so nothing could wall
  it. Ground a landform names is never absorbed as a pocket, so a small
  barrow keeps its district's colour.
- **The Greyfall is a citadel-crag**: no walls or blocks, but one great
  rock rising out of the rot-marsh in four ragged tiers (the Lower City,
  the High City, the Warlord's Hall, the Keep on its crown), the tiers
  alternating stone colours, with a spur west for the gnomes' Sky Bridge
  to land on. Rotfield, the Crater shrine, the Ruined Chapel, the Gallows
  Yard and the Ashen Approach lie in the marsh round its foot.
- **Emberwood** keeps its maze, but its hills and Troll's Hollow (once a
  rectangular ring of blocks, now a raised arena of ash) are landforms.
  The whole wood has one floor colour: per-district colours met in
  straight lines through the trees and read as painted patches. Colour
  changes only up a cliff (Smoke Bluff, Troll's Hollow and the Burn's
  mound in ash-gold), the Burn is scorched by its dead trees, and the
  pines run through every wooded district with yellow among them. On
  every area map a forest tile takes its tree kind from a spot up to four
  tiles off, so two districts' woods mingle at their border. A fire at
  the Cinder Ford is the rest before the troll, and goblin posts hold the
  ford and the climb to Crag Foot.
- **No rectangles left.** The Gilded Reach's Sun Steps and Throne Isle,
  the Skyward Steps' Broken Stair, Windward Rest and Bell Isle, the
  Undercroft's Ossuary, the Deeps' Great Barrow and the Hollow's Shell
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
  stair can stand there; each landform finds its own stairs onto the
  ground under it. The Harbour is built from them: the Keep on the
  Citadel on the Upper Town on Old Town, the Northwood and the Mine Hills
  as uplands either side, the Moor Watch's bluff, with land run to the
  frame's edge (sea and sky maps keep a margin of only 3 tiles), except
  behind the castle, where open sea puts the Keep on a sea cliff. West
  Fields owns a `box` edged on its hedgerows: by nearest seed, flat
  ground met the Lower Town in a straight diagonal. A market of stock
  heaps and traders' houses fills the square's east side. The capital's
  tiers nest, each wholly inside the one below with ground all round,
  so a tier is reached only from the tier under it: overhanging tiers
  stood on the lowland with stairs from the ground to the third and
  fourth heights. The hub is the brightest map, green ground climbing
  through fresh green to a gold capital. The capital is a hill town, not
  a cake: the castle on a headland with the sea on two sides, the tiers
  stepping down to the south-east, each tier its own work (the garrison's
  soldiers drilling, the chapel and gardens, Old Town's market and trades). The
  Lower Town is clusters after the Witcher's Oxenfurt: a paved market
  round the Old Well, a west quarter thinning toward the archery butts,
  an east quarter of smithy, garden and barracks, the docks, a
  watchtower at each gate, joined by bending streets the map draws
  (`streets: true` on the area); a grid of houses read as two rows. Roads
  run on to the farm, the lumber camp, the miners' camp and the
  lighthouse, and carriers walk between them. West Fields is a farm of
  fenced fields drawn in crop rows (`crops` on a district) and fenced
  pastures, on the town's own green: painted field colours read as flat
  patches, and tree hedgerows as walls. Stacked
  rectangles and full-width bands both read as slabs and were dropped. A
  landform names its district (`shape(..., owner)`) and gives it every
  tile it covers, so one landform is one colour; a district's `levels`
  names the heights it takes on the lowland and elsewhere. Any patch of a
  district under 60 tiles that is not its main piece goes to the district
  round it, so the noise in the borders leaves no islands. `districtAt` is base-36, read with `districtOf()`.
- **One bonfire in the Harbour.** The market square's; the town's other
  fires are `campfires`, lit but no rest. The Lower Town is a bowl after
  Firelink: `rim()` rings the square with raised ground, cut a tile clear
  of every road, so the main road west and east and the docks lane south
  are the passes out, Old Town's cliff closes the north, and the rim's
  stairs stand in the passes. The houses sit on the rim; the Old Well is
  on its east ledge, off the square but in view of the fire. The two back
  lanes that cut the rim's corners are gone. The bonfire stands at the
  bowl's centre, copses on the rim and in its corners. Every way out
  starts on the bowl's floor; the high ground is the climb, after
  Firelink's stair to the Burg: twin stairs up the bowl's north wall onto
  Old Town, then the Upper Town, the Citadel and the Keep stacked up the
  bonfire's column to the castle on its sea cliff. Rim arms reaching out
  as ridges (`ridge()`) were tried and dropped: they read as nowhere.
  Lantern Point holds five ways, each with a tell: the Lantern Road
  west (`lanterns()` along it; golden motes drifting off the fire along
  it, after Elden Ring's guidance of grace, were tried and dropped as
  odd), the Graves up the hill north, the Old Well by the fire, the pier
  south and the cove east. `solidCells()` is what no one walks through
  (props but gold, bones and boats; fence posts); the scene adds rocks
  and stumps standing in open ground, never at an edge, so none seals a
  pass, and a test walks every area round the solid props.
- **The Citadel is a region, not a terrace stack.** After the Undead
  Burg, the Undead Parish and Dark Souls 3's Undead Settlement, the
  castle above the Harbour splits into areas of their own, joined in a
  climb: the Lower Burg, the Ramparts, the Chapel Ward, the Keep (laid
  out as hillsides now, below). On the Ramparts the Rampart Bull (the
  minotaur's sheets, iron-tinted, bigger, harder) holds the Bull's Wall.
  Past him the Ladder (`opens: "ladderDown"`) drops to the Burg's square,
  where its foot is `shut` until then, and the Gun Bridge crosses the
  ravine under slingshot gnomes to the Chapel Ward's door. A crossing
  lands at the exit of the same name (`greyfall.via`), since two ways
  join the Burg and the Ramparts. The bailey's back stair climbs to a
  landing on the Bull's Wall, fogged with the walk's two ends while he
  stands (an arena's `gate` holds any number of fog runs): a second way
  into the boss room, and once he falls a loop home through the bailey,
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
  comes after the Citadel. Every way between areas is a thing to see: a
  stair in the terrain's own tiles (the Burg Gate on its landing above
  Old Town), a gateway between towers or a bridge or causeway to it, and
  across it a fog gate from the pack's art, fence end-posts with the
  pack's white clouds banked between; a ladder is a run of fence, a lift
  its platform. Solid props block a base centred under their art (an
  even width rounds down), so none juts out to one side. The Keep
  (`keep`), the Citadel's crown, its own area where the harbour's Citadel
  and Keep terraces used to be: in at the Keep Gate off the Burg's Upper
  Streets (an exit with a `key`, barred by the pack's fence until the
  Troll Key is carried), the gate court, the bailey (Corwin at the
  barracks, the Keep's bonfire; no guns or drill, so after the Burg and
  the troll it reads as a rest, like Firelink), and the castle on its terrace a
  stair up, Ansel on the wall, the Watch Lift up to the Skyward Steps,
  shut until ridden down. The Landing is a sea cave on the underground
  tier, narrow tunnels from the grotto to the antechamber's fog; the
  Bull's Ring is its own cavern area past it, walked straight into with
  no fog (an arena with an empty `gate` has no fog, mist or seal; its
  boss bar shows once the captain stands in the room with the boss in
  view), and the boat out to the Harbour. Every
  fightable boss fights in a closed arena (the Ring, the Bull's Wall, the
  bell roof, Troll's Hollow); walking into its fog walks the captain two
  steps in, and it holds until the boss or the captain falls. The side a
  crossing comes out on is `plain`, no fog.
  The hub moved off the town to Lantern Point, a headland in the
  south-east corner (Firelink is a ledge at the edge, not the middle):
  the Shore Road from the Landing lands on it, the lighthouse fire is the
  Harbour's first bonfire, an inlet against the Moor Watch's bluff leaves
  the shore path the one way west, and the Moor Watch's hill behind the
  point is the Graves: a path up its slope through gnolls and gold bait
  to the Moor Gate on its seaward edge (the coast strip that once ran
  north to a lowland gate read as a dead end, and the hill as scenery). An
  exit's `shut` flag bars a shortcut from this side until it is opened
  from the far one (the Moor Gate, the Watch Lift). The market's fire is
  a campfire; the goblin camp's on the Ember road is the second bonfire.
  After Firelink, the bowl carries one axis through the fire: north the
  stair up to the castle and the sky, south the Old Well on the bowl's
  floor, down to the drowned. A gate tower marks each pass mouth. Ferrow
  at the fire says the goal (the Grey Gate's two keys), why the castle is
  shut, and warns off the well. The countryside is thresholds, each a
  taste of the region past it: Saltreach's fishers and yellow militia at
  the Old Bridge, the lumber and goblin camps on the Ember road, the
  moor's dead along the Moor Gate road, the mine's ore carried to the
  smith; the lighthouse keeps gold and a note. Notes on the ground at the
  well's lip, on the Keep looking east, and at the lighthouse. The Citadel's stairs are an
  area `lock`: shut until the Troll Key is carried, or opened from inside
  by coming down the Watch Lift.
  Reworked since, and what holds now: the hub is the bowl's fire in the
  village, the Harbour's one bonfire (a corner hub with the way on in the
  far corner was a cross-map trek), Ferrow and Tobin at it, the Old Well
  beside it. The captain comes from the Bull's Ring by boat (`The Boat`,
  a `lift` crossing drawn as a moored boat, E says "Sail to"), not a lift
  up through the rock, landing on the docks' pier below the bowl. The
  climb runs straight up from the fire to the Citadel Gate on the hill's
  crown, towers and the castle's keep beside it, and the road on north
  off the map's edge to the Burg; the sea behind the castle is gone, the
  Harbour's north border woods (`wooded(m, top)`), since a gate to an
  inland area must not lead into the sea. The Old Lift from the Chapel
  lands at Old Town's east foot, near the hub. The Citadel areas are no
  longer rooms in the void or terrace pyramids: each is a hillside of its
  own ground with woods round it (`HILL`, `wooded()`; the woods take the
  nearest district's dress, a boss room's excluded so its mist stays
  tight). The Burg is a town of blocks, each a yard or house a height
  above three-wide lanes up its own stair, dead hedges closing some
  lanes, the square sunk in a bay of the upper town's wall; the Ramparts
  a wall walk a height over the bailey, the east tower and Gun Bridge
  reachable only along it; the Chapel a cloister, a terrace and the bell
  roof, the forge yard raised with a pier to the Old Lift on its lip; the
  Keep a gate court, bailey and castle terrace. Every way out on foot is
  a path three wide to the map's edge (`edgeWay()`), its road painted,
  and needs no fog: a gate is seen by its path, fog is for boss rooms only
  (the Landing's antechamber gate lost its fog too). Two traps met on the way: high ground no
  stair reaches is lowered by `finish()`, so a stepped base with no
  stairs flattens; and a ground strip only reachable along a cliff's foot
  is no way at all, as the row under a terrace is its face.
- **A district is one colour.** A district's `palette` can be a single
  tileset colour for all its heights; the Harbour's districts each are, in
  the atlas's family (an olive lower town climbing to a gold citadel,
  fresh-green fields), and district borders are
  broad and gentle so the colours meet in curves, not a patchwork. A
  district's `decor` thickens its bushes and rocks, for the atlas's
  texture in the grass.
- **Each height a shade lighter.** `groundColours()` paints an area map:
  each shelf is at least one shade lighter than the ground just below it
  (teal, olive, green, fresh green, gold, darkest to lightest), so every
  cliff reads as a step up; only gold over gold is allowed, at the
  Harbour's Keep and the Crags' summit, five heights with no teal lowland
  (teal ground reads as the sea). Palettes start dark enough to climb, so
  the lift rarely changes a tile; a test holds every area to it.
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
  gnomes' Terraces, a raised shelf on the southern spur, are fenced plots with their stock.
- **Each area has its own frame and silhouette:** the Harbour taller,
  with Lighthouse Point curling round the bay; Emberwood a long valley
  with the sea biting its corners; the Crags tall, with the Southern Spur
  running into the sea; the Greyfall's coast broken into coves and
  stacks; the Undercroft a chain of caverns.
  `test/areas.test.ts` checks every mapped area: every exit and height can be
  reached from the entry, every bridge deck stays raised, all land belongs to
  a district, and every building sits wholly on its ground.

## Playing an area map

An area map is played: the hero (a blue Warrior) stands where you
arrived, the camera holds on it 15 rows tall; there is no minimap (dev mode
shows the whole map). The hero walks at 2.8 tiles a second, in straight legs (the grid
path pulled taut, `smoothPath`) at a steady speed rather than a hop a
cell; hold the mouse to keep walking toward it, or steer with WASD or
the arrows, sliding along what blocks. A click on the woods or the sea
walks to the nearest ground beside it (`routeToward`), and a ring marks
where a walk ends. Click the ground to walk there by the engine's own path, a
monster to walk up and fight it until it dies, an exit to
walk to it and through. With nothing else to do the hero turns on a
monster beside it. Monsters (`FOES` in `packages/engine/src/hero.ts`,
GAME.md's numbers) wait at their posts, chase a hero within their aggro
range, strike when beside it, and walk home past their leash. A hero at
nothing wakes where it arrived, whole; bonfires and dropped gold come
next. The first fight is the goblins' camp outside the Harbour's Ember
Gate: two torches and a spear, winnable with the sword alone (three
met at once killed in five seconds).

Dev mode (the backquote key, or "Dev: whole map" at the top) frees the
camera to show the whole area map, centred, with the wheel and drag
back; it is remembered on the browser and carries across crossings.

## Not done yet

- The hero walks, fights, rests at bonfires, drinks flasks, picks up
  gold and leads a band hired in the Harbour, but there is no dodge or
  keys yet, and gates and lifts all open.
- No boss can be killed and no monk freed yet, so the questline's stages
  past the Troll Key, the Horned Key, the Warlord and the Drowned Chapel
  wait on them.
- No minimap. Zoom out with the wheel; ride a lift to change tier.
- No blacksmith in the Harbour yet: the plan is below.

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

## The folk's questline

The Harbour's ten move out into the Reach as the captain does, after Dark Souls: no log, no choices, the captain never speaks. Where each stands is `whereabouts()` in `npcs.ts`, from world flags; some flags are set by hearing a talk to its end (`Talk.sets`). Positions change only on entering an area.

| Who | Moved on by | Turns up | Ends |
| --- | --- | --- | --- |
| Tobin | his remark on the well, then a talk | Undercroft, Smugglers' Nook; then the Deeps, Robbers' Camp | Stays with his brother, the thieves' captain. Never talked to, never leaves |
| Mother Ysolde | the monk freed, then a talk | Undercroft, the Drowned Chapel; then the Hollow, Pilgrims' Rest | Kneels over her drowned sisters and will not come back |
| Ansel of the Wall | his remark on the Troll Key | The Greyfall, the Ashen Approach | Hear him out twice and he goes ahead and dies in the High City, below the Warlord's Hall; kill the Warlord first and he is back on the wall |
| Penny | reaching the Greyfall | The Greyfall, Gallows Yard, penned with her mum | Freed when the Warlord falls |
| Sergeant Corwin | the Barrow King dead | Barrowmoor, Barrow Field, digging out his forty | Stays with them |
| The Moor Watchman | his remark on the open Moor Gate | Barrowmoor, Gibbet Hill, watching the lights | Gone into the barrows once the King is dead |
| Maren | her remark on the Warlord dead | | Sails on the first ship in three winters; missed if not talked to |
| Wren | the Troll Key | Emberwood, Old Pines | Stays, shooting |
| Old Ferrow, Brenna | | | Stay; both remark on Ansel leaving |
