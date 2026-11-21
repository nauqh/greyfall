# Tinker Crags

The design for `crags()` in `packages/engine/src/areas.ts`, after the
Harbour and Emberwood reworks. The map stays 112 by 90, entered from the
west off the Crag Stair out of the Ember Hollow.

## What the Crags are for

The wanderer comes up out of the Ember Hollow with the Ember Bull behind
them. The way on is the top of the rock: the Bridgehead on the fifth step,
where the Sky Bridge leaves for the Greyfall's wall, and above it the
summit path up to the Tinker Peak, its own area, where Old Bamboo stands
between the wanderer and the Gnome Lift into the Gilded City.

The story the ground tells: the gnomes worked the rock in five steps, a
town at its foot, a mine on the second step, guns on the third, the
wheel's ropes and their gear on the fourth, the bridge on the fifth and the
lift on the summit. Old Bamboo, their great panda, walked the wheel that
winds the Gnome Lift. Then the Grey came over the Sky Bridge. Gnolls took
the Bridgehead, the Grey got into Old Bamboo at his wheel, and the gnomes
fell back down the rock, barring the Hoist behind them. The tinkers keep
the town and the slingers keep the guns, and the slingers shoot anything
that comes up the steps, because the last thing that did was grey.

## Signature architecture

What no other area has: **a rock climbed on switchbacks and crossed on
gantries.**

- **Five steps, built, not grown.** Tinker Town on the lowland is the first
  step; the Tinker Rock rises four more, each a ledge cut round the rock and
  set back north from the one below. Each step is two or three overlapping
  `shape()` landforms, so no ledge runs an even width (as ATLAS records),
  not one round `relief()` whose stairs fall where they will.
- **Switchbacks.** Every stair stands on a step's south face (stairs sit
  beside a table's bottom row and climb diagonally along their ramp), and
  each is at the far end from the last: on at the west, up at the east, up
  at the west, up at the east. The climb walks the whole length of every
  ledge, past whatever that ledge holds.
- **Gantries.** Gnome timber decks (`span()`) on the fourth height reach out
  from the rock to the two outlying knobs, the Workshop to the north-west
  and the East Ridge to the east, over the steps below. Above them all, the
  Sky Bridge is the same idea made long: a deck on the fifth height off the
  Bridgehead's east end to the map's edge.
- **Guns on every rim.** Each step's south rim carries a battery, the guns
  turned out and down, so walking a ledge is walking along a gun line. At
  the Bridgehead the guns face east, at the Greyfall.
- **Gnome building.** Huts on every ledge that takes one, towers at the
  turns of the climb, fenced yards with wood, tools and ore. Wood and stone,
  no paving above the town.

Colour keeps the current ramp by height (`MOUNTAIN`: grass at the foot,
green slopes, bare rock, a gold summit), so every step reads as one band.

## Districts

Boxes are rough (x, y, w, h) on the 112 by 90 map; borders bend by noise.
Heights are 1 (lowland) to 5.

| District | Box | Heights | Job |
| --- | --- | --- | --- |
| Crag Gate | 0, 38, 16, 18 | 1 | Arrival and first fire |
| Bamboo Grove | 2, 10, 50, 32 | 1-3 | Pandas, loot, the West Shoulder lookout (a dead end) |
| Tinker Town | 22, 52, 50, 16 | 1 | Hub: fire, folk, the Hoist's foot |
| The Terraces | 44, 68, 40, 22 | 1-2 | Farm plots and the Sea Watch: loot, a note |
| The Works | 58, 40, 36, 12 | 2 | Step 2: the mine, the first stair of the climb |
| The Batteries | 50, 26, 44, 14 | 3 | Step 3: the gun line, slingers |
| The Wheel Step | 54, 14, 36, 12 | 4 | Step 4: the Hoist, both gantries, the stair to the Bridgehead |
| The Workshop | 48, 4, 14, 14 | 4 | Outlying knob: the tinkers' yard, a gift, a note |
| The Bridgehead | 64, 2, 24, 14 | 5 | Step 5: fire, gnolls, Sky Bridge, the summit path to The Tinker Peak |
| The East Ridge | 88, 12, 12, 34 | 2-4 | The back way up from the shore |
| Foothills | 70, 54, 30, 16 | 1 | Road from town to the shore and the ridge |
| Windward Shore | 98, 14, 14, 52 | 1 | Shore, tarn, fishers |

### Crag Gate

- **Job:** where the Crag Stair comes up out of the smoke. The first fire
  in the Crags, so a death on the steps is never sent back through the
  Hollow.
- **Why go:** you arrive here. Rest, and read the gnomes' warning.
- **Stands there:** the bonfire (10, 49), a gnome tower watching the stair,
  one gnome at the post. Bush and scrub.
- **Hooks:** NPC, a gate gnome who tells strangers to keep to the road and
  that the slingers shoot first. Note at the stair head: "Keep to the road.
  The guns don't."
- **Connects:** road east to Tinker Town (main route); road north over the
  stream's footbridge to the Grove.

### Bamboo Grove

- **Job:** Old Bamboo's own ground before the Grey, his cubs still in it,
  and the second way onto the rock.
- **Why go:** loot (gold stones in the thicket, the bones of gnomes the bees
  caught), a note, and the West Shoulder: two heights over the bamboo with
  two guns and a gold stone on its crown. It does not join the rock: a way
  onto the Batteries from here would skip the Works and the Hoist.
- **Stands there:** the bamboo thicket (`grove()`), the stream off the
  rock's west face with its footbridge, pandas (bystanders), bees (foes),
  the West Shoulder around (36, 26).
- **Hooks:** note by the bones: "They weren't eaten. The cubs just sit with
  them." A place for an NPC who cuts bamboo, or a panda cub that follows a
  flag (`when: <Bamboo dead>`) back to the grove.
- **Connects:** north road from Crag Gate; dead end.

### Tinker Town

- **Job:** the hub. The tinkers' town at the rock's foot, the Crags' Last
  Harbour.
- **Why go:** the bonfire (48, 63), the folk (merchant and quest hooks
  live here), the first stair of the climb at its north-east, and the foot
  of the Hoist, the shortcut down from step 4.
- **Stands there:** huts and towers round a square with the fire, the
  tinkers' fenced yard (tools, wood), the town's gnome crowd. One slinger at
  the north edge where the climb starts, turned up the rock, not at the
  town.
- **Hooks:** a tinker selling gnome work (bombs, a crossbow); the
  lift-keeper's family, who say Old Bamboo stopped walking the wheel and
  never came down; the barred Hoist foot ("barred from up top since the
  gnolls").
- **Connects:** road west to Crag Gate, east to the Foothills, south to the
  Terraces; stair north-east onto the Works (main route); the Hoist's foot.

### The Terraces

- **Job:** the gnomes' fields on the southern spur, and the Sea Watch at
  its end.
- **Why go:** loot and lore, not the way on: gold stones on the spur, the
  watchtower's note, the farm's folk.
- **Stands there:** the raised plot (height 2) with three fenced pens,
  sheep and pigs, gnome farmers; scrub down the spur; the watchtower at
  (70, 83) over the sea.
- **Hooks:** note at the Sea Watch: "Ships? Not in three winters. Watch the
  bridge instead." A farmer NPC slot.
- **Connects:** road south from town; dead end.

### The Works (step 2)

- **Job:** the first step and the mine. The climb is on at its west end
  from the town and up at its east end.
- **Why go:** it is the main route, and the mine's gold.
- **Stands there:** the gold mine cut into its face at the town's back
  (70, 48), gold stones and an ore yard,
  miners (bystanders), a battery on the south rim, the first slingers.
- **Hooks:** note at the mine mouth, a miner who will not go higher.
- **Connects:** stair on at the west end from Tinker Town, stair up at the
  east end to the Batteries.

### The Batteries (step 3)

- **Job:** the gun line. Walked east to west under fire.
- **Why go:** main route; the slingers' stores at the turns.
- **Stands there:** cannons the length of the south rim, slingshot gnomes
  in twos, huts and a tower at each end, woodpiles and shot.
- **Hooks:** none for NPCs; this is a fight.
- **Connects:** on at the east end from the Works; up at the west end to
  the Wheel Step; the Hoist comes up at the west end from the Works.

### The Wheel Step (step 4)

- **Job:** the branch ledge. The climb arrives at its west end, and
  everything else on the rock goes off from here: the Hoist down, both
  gantries out, the stair up to the Bridgehead at its east end.
- **Why go:** the main route crosses it west to east. The Hoist, barred at
  its head, drops straight to Tinker Town: unbar it and a death above
  walks back from the town's fire in a minute, not the whole climb.
- **Stands there:** the Hoist head on the south face at the west end; the
  Workshop gantry going off north-west; along the ledge the lift's ropes
  running up the rock toward the summit, broken wheel timbers, bones and
  the slingers' last post; at the east end the East Ridge gantry and the
  open stair up to step 5.
- **Hooks:** note at the Hoist head: "Lift the bar. Save the walk."
- **Connects:** stair up from the Batteries (west); the Hoist down to town
  (shortcut); gantry to the Workshop; gantry to the East Ridge; stair up to
  the Bridgehead (east, open).

### The Workshop

- **Job:** the tinkers' yard on the North Crag, a knob of its own at
  height 4, reached only by its gantry.
- **Why go:** a reward off the main line: the master tinker, or what is
  left of the yard, and something only a tinker makes.
- **Stands there:** fenced yard, woodpiles, tools, a half-built lift cage,
  one gnome.
- **Hooks:** NPC slot for the master tinker who built the lift (a gift on
  talk, or after Old Bamboo falls). Note: "Wheel first, cage second, gnome
  last. Never the other way."
- **Connects:** the gantry from the Wheel Step only; dead end.

### The Bridgehead (step 5)

- **Job:** the top of the Crags and the way on, both ways: the Sky Bridge
  east and the summit path north out of the map to the Tinker Peak.
- **Why go:** the bonfire (74, 11), the rest before Old Bamboo; the Sky
  Bridge onto the Greyfall; and The Tinker Peak exit, with Old Bamboo and
  the Gnome Lift beyond it.
- **Stands there:** the gnomes' two towers and the fire; at the east end
  the gatehouse over the Sky Bridge's deck, towers and guns turned east,
  held by gnolls come over the bridge from the Greyfall (foes, the only
  gnolls in the Crags); the summit path climbing north from the fire to
  the map's edge, the lift's ropes beside it.
- **Hooks:** Moss and Pip's later spots; gnomes come back up once Old
  Bamboo is dead (`when:` his flag). Note at the gatehouse: "They came over
  in the fog. Light the guns."
- **Connects:** stair down to the Wheel Step (west, open); summit path to
  The Tinker Peak (exit, north); Sky Bridge deck east (exit).

### The East Ridge

- **Job:** the back way. A long thin ridge, three heights, joined to the
  Wheel Step by its gantry at height 4 and stepping down its south end to
  the Foothills.
- **Why go:** a route up that skips the Works and the Batteries, harder
  (slingers on the wind, the watchtower's gun) but open from the start; its
  watchtower over the Greyfall.
- **Stands there:** watchtower (93, 20), two side guns over the shore,
  slingers walking the ridge. The Sky Bridge passes over its north end.
- **Hooks:** note at the watchtower: "You can see the Citadel from here.
  It can see you."
- **Connects:** gantry to the Wheel Step; stairs down the south end to the
  Foothills (loop with the main climb).

### Foothills

- **Job:** the road east from town to the shore, and the ridge's foot.
- **Why go:** the back way's start; lizards and a snake on the road.
- **Stands there:** a low two-height knoll, lizards, a snake, scrub copses.
- **Connects:** road from Tinker Town east to the Windward Shore; the East
  Ridge's stairs.

### Windward Shore

- **Job:** the Crags' sea edge, a fishers' strand under the ridge.
- **Why go:** loot along the strand, a fisher NPC slot.
- **Stands there:** fish hut, boat, turtle.
- **Hooks:** a gnome fisher who saw the gnolls cross the bridge.
- **Connects:** road from the Foothills; dead end north under the bridge.

## How it connects

**Main route.** Crag Stair, Crag Gate (fire), road east, Tinker Town
(fire), the Works (on west, up east), the Batteries (on east, up west), the
Wheel Step (on west, up east), the Bridgehead (fire), then the Sky Bridge
to the Greyfall, or the summit path to The Tinker Peak, Old Bamboo and the
Gnome Lift.

**Loops.**

- *The back way:* Tinker Town, the Foothills, the East Ridge's stairs, the
  ridge, its gantry onto the Wheel Step's east end. Skips the Works and the
  Batteries.

**Shortcut.** *The Hoist:* the stair from a strip off the Works' west end
up onto the Batteries' west end, at (49, 33), right under the Wheel Step's
stair, barred from above (`locks` with `from` on the Batteries, flag
`hoistOpen`). Unbarred, the town's fire is three stairs from the Wheel
Step.

**Locks.**

| Lock | Where | Opens by |
| --- | --- | --- |
| The Hoist | (49, 33), Works west strip onto the Batteries' west end | unbarred from above, `hoistOpen` |

**One-way drops.** None. The engine has no in-area drop; the Hoist's bar
is the one-way piece.

**Dead ends with a reason.** The Terraces and Sea Watch (loot, note), the
Workshop (tinker, gift), Windward Shore (fisher, loot).

## Folk

crag-folk's NPCs, as `crags()` cells (the padded map in `areaMap()` adds 3
to each). Phase 2 keeps every one on open ground the hero can reach.

| Who | Cell | District |
| --- | --- | --- |
| Pell | (9, 45) | Crag Gate, by the tower; moved off (6, 46), the entry cell |
| Nim | (44, 60) | Tinker Town square |
| Moss | (58, 55), then (71, 14) | the Hoist foot, then the Bridgehead |
| Pip | (60, 56), then (76, 13) | Tinker Town by the Hoist, then the Bridgehead |
| Hask | (66, 47) | the Works, by the mine |
| Fennick | (54, 10) | the Workshop |
| Quill | (99, 50) | Windward Shore; (102, 54) is the sea's edge |

## Exits

Exactly three.

| Exit | To | Kind | At | Notes |
| --- | --- | --- | --- | --- |
| Crag Stair | trollpit | open | (1, 46) | Entry; the Hollow's side is guarded by the minotaur |
| The Tinker Peak | peak | open | (74, 1) | Head of the summit path, north edge above the Bridgehead's fire; Old Bamboo's arena |
| Sky Bridge | greyfall | high | (110, 9) | Deck on height 5 off the Bridgehead's east end |

## Settled with the lead

1. Old Bamboo's arena is the area `peak`, the summit itself, entered by
   The Tinker Peak and not a way back into the Crags. The Gnome Lift
   leaves from inside it, so the Crags have no Gnome Lift exit.
2. The stair from the Wheel Step onto the Bridgehead is open; the Hoist
   (`hoistOpen`) is the Crags' one shortcut.
3. The Sky Bridge stays as it is.
4. Old Bamboo's boss marker in `atlas.ts` belongs to late-arenas.
