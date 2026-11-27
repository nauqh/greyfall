# Emberwood

The wood between Highward and the Ember Bull. A jungle over warm ground,
the old pines only on its west edge; goblins burned clearings for their
camps, the Bull took the hollow. The story is in [lore.md](lore.md). The
player comes down into it from the Belfry, after the Stone
Warden, and leaves it north for the Ember Hollow. Built by `emberwood()` in
`packages/engine/src/areas.ts`.

Coordinates here are the builder's, on the 128 by 72 map. `areaMap()` pads
the map three tiles, so a cell in play (an NPC's `at`, a test) is three more
on each axis: Wren's spot (29, 44) is (26, 41) here.

## The feel

After Bloodborne's Forbidden Woods, with Sekiro's Mibu Village under it
(see [../inspirations.md](../inspirations.md)).

- **Dusk under the canopy.** The wood is dark, and the goblins' torches are
  seen before the goblins are: firelight moving through the trees, campfires
  the only open light. Steam off the warm ground stands in for mist.
- **A village that worships what it feeds.** The goblins obey the Bull's
  horn and carry him meat. Their camps are a village round his road:
  horned skull totems, the Ash Road a pilgrim road.
- **The houses are the threat.** Goblins come out of the huts and the
  thickets, never stand in rows in front of them.
- **Held by the warmth.** Like Mibu's villagers and their water, the goblins
  never leave the hot ground and no longer know why. They sit in the hot
  pools and keep the great fire lit in a wood that needs no fire.
- **Outsiders are few.** The gnomes at Crag Foot are stragglers, a hut and
  a shaft, not a town.

## The wood's own architecture

Two storeys, cut by one river.

- **The floor** is the jungle maze: woods everywhere but the lanes `maze()`
  carves, the trees the walls. Steam off the warm ground, goblins in the
  clearings, no way to see far. Every road on it is a goblin path or Highward's old timber road.
- **The Boughs** are the goblins' second storey: raised tables of rock and
  timber (landforms at height 2 and 3) standing up out of the steam, the
  warrens and lookouts on them, joined by plank walks (raised `span` decks)
  over the floor and the water. Up there the goblins move fast and shoot
  down; down on the floor the player picks a way through the trees. The wood
  has three of them: Warren Hill and Smoke Bluff, joined by the Treetop Walk
  over the Run, and the Chief's Mound in the Burn, joined by the Ash Walk to
  the Postern Crag's first step.
- **The Ember Run** crosses the whole map west to east, edge to edge, so the
  south bank (Lanternport's side) and the north bank (the goblins' and the
  bull's) meet only at its crossings, and every way north picks one: the
  Pine Ford in the west, the Treetop Walk raised over it, the Cinder Ford in
  the middle, the East Bridge under Crag Foot.

No other area has the split: the floor a maze to read, the Boughs a faster
way to earn.

## The way through

The player arrives on the Postern Crag's crown and leaves by the Ash Road. In
between, three jobs pull them across the wood:

1. **Open the way home.** The Ember Gate is barred from Lanternport's side.
   Walking through it from the wood opens it for good (`emberGateOpen`), and
   Lanternport's fire is then one step from the wood.
2. **Rest before the bull.** The wood has two bonfires: one on the Postern
   Crag's crown, the rest after the Stone Warden, and the Cinder Ford's, on
   the north bank where the Ash Road starts. Every other fire is a goblin
   campfire: lit, no rest.
3. **Follow the steward.** He came out the same Postern with the Keep's key
   and never reached Lanternport. His notes run from the crag to the Ash
   Road, and the last one says where the key went.

### Main route

Postern Crag (arrive) down its three steps to the floor, west through the
Burn's camp (or round its south edge) to the Palisade, through the Ember Gate
(the shortcut home), then north up the gate road over the Cinder Ford to the
bonfire, and up the Ash Road out.

### Loops

- **East loop:** the Burn north over the East Bridge into Crag Foot, west
  along the crag road to the Cinder Ford. A second way to the bonfire that
  skips the Palisade.
- **West loop:** the Palisade west into Old Pines, north over the Pine Ford's
  stepping stones behind Warren Hill, round the hill and down its east side
  to the Cinder Ford's north bank.
- **The Boughs:** from the Postern Crag's first step west along the Ash Walk
  straight onto the Chief's Mound, over the Burn's floor; from Warren Hill
  south down the Treetop Walk onto Smoke Bluff, over the Run.

### Shortcuts opened from the far side

- **The Ember Gate** (exit, `opens: "emberGateOpen"`): the wood to
  Lanternport's square.
- **The Drawn Plank** (a `lock` with `from`, flag `drawnPlankDown`): the
  Treetop Walk's north end is barred. From Smoke Bluff it is a fence across
  the planks; reached the long way (the Pine Ford and Warren Hill), E on the
  hill's side drops the plank, and from then the walk runs from Smoke Bluff,
  a short way from the Palisade and Lanternport, straight onto the warrens.

No one-way drops: the engine's drops are area exits, and the wood has none.

## Districts

Boxes are rough, `x0-x1, y0-y1`; ground goes to the nearest seed, so borders
bend.

### Postern Crag (96-127, 44-71), the arrival

- **Job:** where the player comes in. The Belfry's Postern stair lands on
  the crag's crown (height 4); the crag steps down in three ledges to the
  floor, a stair at each end of every ledge, looking out over the Burn's
  smoke.
- **Why go:** it is the way in, and the way back to the Chapel Ward.
- **Stands there:** The Postern (exit to the Belfry) on the crown, Highward's
  blue tower over it and the bonfire beside it, lanterns at the second
  ledge; the steward's first note beside the exit; the bones of his escort on
  the second ledge, a goblin spear post on the first step's west end (spears
  in threes), out of the fire's reach; scorched trees on the ledges. The
  first step's west end carries the Ash Walk.
- **Note:** "Keep Gate barred behind me. The key is on my belt. The wood
  road to the Harbour, then."

### The Burn (60-95, 44-71), the goblins' war camp

- **Job:** the wood's big fight, between the arrival and the gate. The
  goblins cleared the jungle by fire: ash, stumps and dead trees, huts round one
  great fire.
- **Why go:** it lies between the crag and the Palisade; its Chief's Mound
  holds the goblins' plunder (gold).
- **Stands there:** the Chief's Mound (height 2) in the middle, the war
  band's shaman and a gnoll on it with the plunder under a lookout; two rings
  of huts round the fire; skulls in pairs
  where the roads come in; torches round the fire,
  thieves among the huts. The road from the Palisade passes the mound's
  north side on to the East Bridge; a second skirts its south foot toward
  the crag.
- **Hook:** the mound's crown, for a named goblin chief later.

### The Palisade (28-58, 54-71), the gate camp

- **Job:** the shortcut home. Highward's lumber camp at the Ember Gate,
  overrun: its fences broken, the woodcutters fled through the gate and the
  town barred it behind them. Goblins camp in it, in threes, as Wren warns.
- **Why go:** the Ember Gate (to Lanternport), and the gate road north.
- **Stands there:** the blue watchtower and the lumber house, the
  woodcutters' huts in a row along the camp's back, stumps and
  tools where they were dropped, the camp's fire (a campfire); torches and
  spears in threes. Once the gate is open (`emberGateOpen`) the woodcutters
  come back to fell and carry, and a lancer stands the gate.
- **Note:** "Ran for the gate. They barred it with us still outside. Can't
  blame them."

### Old Pines (0-27, 44-71), the cool edge

- **Job:** the quiet district. The west edge, where the ground runs cooler
  and the old pine wood still stands: thick pines, a pool, beasts, no goblins,
  who will not live where it is cold.
- **Why go:** the hermit, loot in the thicket behind the bears, and the Pine
  Ford north (the west loop).
- **Stands there:** the hermit's hut by the pool and the hermit (purple,
  the Order), the oldest pine over the pool; bears, bees, a turtle at the
  pool; gold in a thicket.
- **Hook:** the hermit, for an NPC.

### Smoke Bluff (18-40, 40-53), the gnolls' perch

- **Job:** a Bough on the south bank: a raised bluff over the Run, the
  Treetop Walk's south end.
- **Why go:** the Drawn Plank, once dropped, is the short way from the
  Palisade onto Warren Hill; the gnolls on it shoot down on the Pine Ford
  road.
- **Stands there:** gnolls and a goblin spear post, four huts, a lookout over
  the walk. Wren stands at its foot once the bull is dead (26, 41).

### Warren Hill (0-40, 0-34), the goblins' home

- **Job:** the goblins' warrens stacked on a hill in two heights, the
  biggest Bough.
- **Why go:** the warren hoard on its crest (gold), and the Drawn Plank's
  lever: from here the Treetop Walk is opened for good.
- **Stands there:** huts on both heights, the shaman by the crest fire (a
  campfire), torches, a slinger on the Treetop Walk, a watchtower over the
  walk's end, trophies. Its foot opens east onto the Cinder Ford
  and west onto the Pine Ford.

### Cinder Ford (40-58, 26-50), the crossing and the fire

- **Job:** where the gate road crosses the Run, and the last rest before the
  bull.
- **Why go:** the bonfire, on the north bank at the foot of the Ash Road;
  every loop comes back here.
- **Stands there:** the bridge over the Run, the bonfire on the north bank,
  a goblin post (two huts and spears) watching the crossing from the south,
  skulls either side of the bridge's foot.

### The Ash Road (52-76, 0-25), the way to the bull

- **Job:** the goblins' road north to the bull they feed, skull-lined.
- **Why go:** The Ash Road exit (to the Ember Hollow) at its head, and the
  steward's end.
- **Stands there:** skull spikes in pairs the length of it, spears on watch
  and their hut, dead trees; halfway
  up, the steward's bones and his last note.
- **Note:** "Goblins on the ford. Round by the north road. Something big
  breathing in the smoke."

### Crag Foot (77-127, 0-30), the gnomes' rock

- **Job:** the rock rising toward Brasscrag in two steps, the gnome
  prospectors cut off on it.
- **Why go:** gold in the seams, and the East Bridge: the east loop from the
  Burn to the Cinder Ford.
- **Stands there:** the gnomes' hut and tower on the rock, gnomes, gold
  stones; the shaft under the rock's south face, its ore heaped in the yard
  and the prospectors walking between them, their huts in a row along the
  yard's back; a goblin post where the crag road leaves the wood.
- **Hook:** a gnome prospector at the hut, for an NPC.

## Exits

| Name | Target | Where | Kind |
| --- | --- | --- | --- |
| Ember Gate | harbour | the Palisade, south edge (40, 70) | gate, `opens: "emberGateOpen"` |
| The Postern | belfry | Postern Crag's crown | open, plain |
| The Ash Road | trollpit | the Ash Road's head, north edge (62, 1) | open |
