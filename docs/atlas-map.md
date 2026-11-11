# The Atlas map

The map format, terrain, buildings, tests and dressing. The game and world are
in [../ATLAS.md](../ATLAS.md).

## The map format

Each tier is the war island's height-map format (`island.ts`), so the war's
autotiler draws it (foam, south cliffs, irregular plateaus, up to five heights,
roads) and its pathing walks it. The data is
`../packages/engine/src/atlas.ts`; the dressing is
`../apps/web/src/game/AtlasScene.ts`.

### Lands in their real shape

Every land on the atlas is its own area map, shrunk: `t.real(area, x0, y0,
scale)` crops the area map to its land, shrinks it `scale` times (an atlas tile
is land where over a quarter of its block is, so a causeway a tile or two wide
survives) and lays it as the area's lowland with its top left at `x0, y0`.

- **One scale:** 4 for every land, 8 for the castle wards (Burg, Ramparts,
  Chapel, Keep) and the Ring, which sit as small lands between the Harbour and
  the north.
- **Placement is recorded** on the tier as `real[area] = { x0, y0, c0, r0,
  scale }`: an area map's cell (`col`, `row`) is atlas cell (`x0 + (col - c0) /
  scale`, `y0 + (row - r0) / scale`). Gates, lift ends and the scene's bonfire
  marks all use it.
- **Lands stand at least three tiles apart,** or `separate()` eats the shore
  between them.
- **Lifts line up on the grid,** so the lands of the sky and the Underneath are
  placed under or over the surface land each lift joins. The Gilded City's two
  lifts are too far apart on the surface for one city to span, so the Gnome
  Lift lands on a small Gilded islet over the Crags, bridged to the city.


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

`../packages/engine/test/atlas.test.ts`:

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
  the drop and by the stair. The moor and the Greyfall each have two ways in.
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
- **The page:** the map fills it. A click on a land outlines it and opens its
  panel: tier, blurb, keeper, and every bonfire in it as a checkpoint. A
  checkpoint is active once its bonfire is lit (rested at,
  `greyfall.kindled`); a lit one glows and travels on click, an unlit one is a
  grey ember marked "Unlit". Lifts, drops and shortcuts are not shown: the
  player finds them. The tier tabs switch tiers.

## Adding to it

- **Places:** each tier is built in its own function (`sky`, `surface` or
  `below` in `atlas.ts`). Every place is a line: `prop("goblinHut", col,
  row)`, or `who("bear", col, row, { to: { col, row } })` for a walker.
- **Lifts** go in `LIFTS`, with an up end and a down end.
- **Art** for a new name goes in `PROP` or `BEAST` in the scene.
- **Then run the tests:** they name any building in the sea, any walker on a
  cliff face, any gate that leaks, and any lift that lands nowhere.

