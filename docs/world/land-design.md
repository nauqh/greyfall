# Building a land's map

How to make a land's area map read as a place rather than a level: the bar, the order of work, the patterns that carry it and the traps in the builder. Learned reworking Greyfall after Lanternport (`harbour()`, the bar every land is held to). A land's own layout lives in its `design.md`; the builder's API is under "Area maps" in [ATLAS.md](../../ATLAS.md).

## The bar

Run `pnpm area <id>` (add `--map` for the grid) before and after. It prints density against Lanternport's, runback from each way out to the nearest bonfire, and foes in resting range of a fire, all in builder coordinates.

Lanternport sits near 4 props per 100 land tiles, 100 buildings and 50 folk at work. Greyfall read as empty at 1.7 props and 36 buildings, and was accepted at 3.6 and 65. Density is the symptom; the cause is in the patterns below.

## The order of work

1. **Lore first.** Give each area of interest one job in the land's `lore.md`: what was done there, and what is left doing it. The map is built to the lore, never the other way.
2. **Map.** Each area of interest becomes its own structure (below).
3. **Folk.** Residents with questlines go on the drawn ground last, once their spots exist.

## Patterns

**One landform per place.** Each area of interest is a shape of its own, not a band of a wide tier. The kit:

- an island in a moat or chasm, one bridge (`span`) onto it, a stair off a ledge under it (Lanternport's crown, Greyfall's Keep);
- a court sunk a height into a tier, a rock raised a height out of it (the Champions' Pit, the Treasury Rock);
- a gallery `span` across a sunk court;
- a spur, mine benches stepping up, a spoil ring round a crater (the Chapel Spur, the Mine Hills, the Pits).

**Narrow and packed.** Ground is ledges, terraces and alleys. A tier of open flat reads empty however many props it holds.

**Buildings in rows.**

- An alley two wide: houses at its west column minus 3 and its east column plus 2, three rows apart, pinned.
- A garrison in one line along a rim: barracks, stores, butts, guns, the drill on the ground in front.
- A gate bastion jutting off a face: a tower either side of the road, a stair up each outer corner, a lantern at each stair's foot.
- Lanterns (`sconce`) in pairs up an avenue.
- An archer perched on each tower: `who("archer", c, r + 0.25, { perch: 1.85 })`.

**A landmark breaks every grid**: a great tree on a square (`deadTree` or `tree`, `scale: 1.6`, pinned), a market at a crossroads.

**Work moves things between places.** Diggers go in at a shaft and haul to a heap (`act: "dig"`, `heap()`), carriers fetch from it (`act: "fetch"`), woodcutters fell and stack (`fell()`). Folk standing at an act on the spot (`hammer`, `pickaxe`) fill a corner; folk walking between places make it a town.

**Flags change the scene.** `when` and `unless` on a dweller or prop: the drill stops, the pens empty, the lighthouse is lit when the land's boss falls.

**No edge runs straight.** Step each side of a tier in or out a tile in runs of two to four rows, and round a crater or a ring as a wobbling ellipse. Lay each tier on an underlay of the tier below, so a notch drops one height rather than opening a hole to the marsh. Hold straight only the rows a stair or a bridge needs.

## Bonfires

- Place them by measured runback (`pnpm area`): Greyfall keeps its farthest walkable tile at 46, the Keep door 33 from a fire.
- A fire is rested at only with no live foe within `REST_CLEAR` (8, Chebyshev) of it. Foes in range make it a fire to clear first, which many lands use; the fire a player arrives at, and the one before a boss, should be clear.
- A camp's fire that is not a rest is a `campfire`: lit, no rest.

## Traps in the builder

- A prop with a `color` is drawn from a building sheet; only buildings have one. A coloured `watchtower` crashed the scene (a test guards it now).
- A `cave` or `goldMine` door reads right only with a cliff over it.
- A stamp writes every tile it covers: its `~` is lowland and overwrites a `shape()` under it. Draw a join into the stamp itself.
- The fitter moves an unpinned prop that lacks clear ground, sometimes across a gorge. Pin (`fixed: true`) every prop a scene depends on, and check `--map`.
- The row under a raised tile is its cliff foot, not ground: an NPC or a fire there is unwalkable.
- An NPC's `at` is in play coordinates: builder plus 3 on each axis on a padded map (the surface and the sky), the same underneath.
- A cavern is `chamber`s joined by `burrow`s, then one `erode` pass (Tidewake). Water laid across a chamber wall to wall cuts off its far side, and the finisher turns floor nobody can reach into rock.
- A stair needs lower ground at its open side and a row below that ([stairs climb diagonally](../../packages/engine/src/island.ts) along their ramp); `areas.test.ts` fails a stair whose top goes nowhere.
