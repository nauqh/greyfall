# The Atlas

Oct 26, 2026

## Summary

The Shattered Reach on one map, at `/atlas`. It isn't a game yet: it's the
world to build one in. Seven areas, each its own landmass in its own colours
and light, are joined only at named gates, the way a Souls map joins its
areas. Every building and creature the pack has a use for stands somewhere
on it, and most of them move.

The map is the war island's height-map format (`island.ts`), so the war's
autotiler draws it (foam, south cliffs, stepped plateaus, the Crown, roads)
and its pathing walks it. The data is `packages/engine/src/atlas.ts`; the
dressing is `apps/web/src/game/AtlasScene.ts`.

## The areas

| Area | Ground | Who's there | Keeper |
| --- | --- | --- | --- |
| Saltreach | teal shore, a lighthouse bluff | yellow militia, fishing villages, turtles, sharks and a seahorse boat offshore, pirate towers in the shallows | |
| Last Harbour (hub) | lush green, the castle hill | the blue castle and town round the bonfire square, monastery, barracks, gold mine, a sheep pen, pawns chopping, mining, carrying and hammering | |
| Emberwood | dusty olive under the big pines | three goblin warrens with fires, torch and spear goblins, a thief, gnolls on Smoke Ridge, a pig pen, logging stumps | Cinder Troll |
| Tinker Crags | bright lime rock to the Crown | gnome huts on a stepped plateau, a gnome tower on the Crown, gnomes and slingshot gnomes, bears, bees, pandas | Old Bamboo (panda guard) |
| Barrowmoor | olive moor under a dusk light | three barrows, the cave, dead trees, skull spikes and bones, skulls, skull guards, hex shamans, spiders, a snake, giant bats | The Barrow King (minotaur guard) |
| Lizard Fen | teal reeds and black pools in a pale mist | the purple chapel and its monks, lizards, snakes, a turtle, and a rubber duck | |
| The Greyfall | dusty grey under rolling murk | the walled citadel, the black castle on its Crown, the black legion drilling, imps, a troll, a burned village, bomb fish in the moat | The Grey Warlord |

## The gates

```
        Emberwood ──Crag Stair── Tinker Crags ──Sky Bridge (high road)──┐
            │                                                     The Greyfall
      Ember Gate (barred)                                               │
            │                                                           │
Saltreach ─Old Bridge─ Last Harbour ─Moor Gate (shortcut)─ Barrowmoor ─Grey Gate (locked)┘
    │                     (hub)                                │
    └──────────── Fen Causeway ──── Lizard Fen ──Barrow Path───┘
```

- **Open:** the Old Bridge, Crag Stair, Fen Causeway and Barrow Path.
- **Barred:** the Ember Gate, a palisade across the causeway north.
- **Shortcut:** the Moor Gate, barred from the moor side. You first reach
  Barrowmoor the long way round, through the Fen. Opening it from there
  makes a one-step way home to the hub.
- **Locked:** the Grey Gate, needing the Troll's and the Minotaur's keys.
- **High road:** the Sky Bridge runs off the top of the Crags straight onto
  the citadel's wall, the other way into the Greyfall.

## What the tests guarantee

`packages/engine/test/atlas.test.ts`:

- Every area reaches every other.
- **Bar every gate and no area reaches another.** Each area is a sealed
  room, and the gates are its only doors.
- Each gate, on its own, joins exactly the two areas it names.
- The loops are real. The moor is reachable without the shortcut, and the
  Greyfall without either of its two ways in.
- Every building stands on ground and every boat in the sea. Walkers stand
  on open ground, and each one's patrol is a walk it can make.
- Every plateau and Crown tile can be climbed to from the hub.
- The forest never seals a clearing off. Any pocket gets a path cut out of
  it when the woods are planted.

## Dressing

- **Ground:** each area's palette, tile by tile. Ramps and bridge ends take
  the nearest area's colours.
- **Woods by area:**
  - Emberwood: the big animated pines.
  - Barrowmoor and the Greyfall: dead trees.
  - The Fen: reed-thick bushes.
  - Elsewhere: the slim trees.
- **Ground clutter by area:** bones on the moor, stumps in Emberwood, more
  undergrowth in the Fen, less in the grey. Shrubs and stones at the foot
  of every cliff, and rocks in the shallows.
- **Buildings:** each in its faction's colours: blue for the Harbour, yellow
  for the militia, purple for the cult, black for the legion.
- **Bonfires** with a soft light that breathes.
- **Fences** round the pens, and across every barred, shortcut and locked
  gate.
- **Life:** knights and beasts walk their beats, pawns work, flyers hover,
  and sharks and boats cruise.
- **Light:** a light per area multiplied over everything, fading out across
  the water. Grey murk rolls over the Greyfall, with mist on the moor and
  the fen.
- **The page:** click an area, or pick one from the index, to fly there and
  read its card: what it is, its keeper, and where each of its gates leads.
  "Show the routes" overlays the Souls map.

## Adding to it

- **Places** go in `atlasMap()`. Every place is a line: `prop("goblinHut",
  col, row)`, or `who("bear", col, row, { to: { col, row } })` for a walker.
- **Art** for a new name goes in `PROP` or `BEAST` in the scene.
- **Then run the tests:** they name any building in the sea, any walker on a
  tree, and any gate that leaks.

## Not done yet

- Nothing is playable on it: no warband, no keys, no gates that open.
- No minimap. Zoom out with the wheel to see it all.
