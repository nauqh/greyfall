# The Barrow-warden, a class that hexes

Nov 23, 2026

## Summary

A fifth class that fights from range instead of striking. The hero comes
ashore as a mask, a barrow-warden of Kingsrest, and casts the hex: a bolt at
the nearest foe, every third one bursting and slowing what it hits. It is
one more row in `CLASSES`, not a spell system. The word "magic" never
reaches player text (`reach.md` rule 12); the craft is the hex.

## Canon

- The power is the masks' hex, kept for the Old Law. The Hearth stays off
  screen, only ever spoken of (rule 13).
- Telling: "A barrow-warden of Kingsrest, sent after the gold the Citadel
  dug from the old kings' graves. It took ship behind the last gold ship,
  and the sea took both."

## Rules

| | hp | attack | every | speed | reach | shield |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 100 | 12 | 1.1 | 2.8 | 1 | yes |
| Barrow-warden | 80 | 9 | 1.3 | 2.6 | 5 | no |

- **Cost:** a cast takes the same stamina as a swing. No new bar.
- **Combo:** the existing three-step `comboStep`. Casts 1 and 2 are a bolt
  at the nearest foe faced, up to 5 tiles, stopped by cover (`clearShot`).
  Cast 3 is the hex: the bolt bursts on hit and costs the target 1.5s
  before its next action, as the Hex Shaman's Hex does in Skirmish. A
  boss takes the burst but not the hold, as it shrugs off a knock-back.
- **Fliers:** reach above 1 hits them (`canReach`). Only this class can
  strike bats, imps and bees; low health and no guard pay for it.
- **Up close:** nothing extra. Guard does what it does for the other
  unshielded classes; distance is kept with the roll and sprint.
- **Items and levels:** `attack` from edges and level-ups applies as is.

## Art, all already in the pack

- Body: Hex Shaman idle, run and attack, already loaded as the `shaman`
  beast (`AtlasScene.ts:451`), washed blue like the other folk classes.
- Bolt: `Hex Shaman_Projectile.png`, already the `missile_shaman` sheet.
- Burst: the bosses' `blast` (`Particle FX/Explosion_01.png`), tinted
  violet.

## Build

1. `packages/engine/src/hero.ts`: add `barrowWarden` to `HeroClass` and
   `CLASSES` (reach 5, plus a `hex` flag for the third-cast slow), and
   cover it in `test/hero.test.ts`.
2. `apps/web/src/game/AtlasScene.ts`: a `HERO_ART` entry, and a ranged
   branch in the hero's attack that fires the missile instead of hitting
   the adjacent cell, bursting and slowing on the third.
3. `apps/web/src/app/atlas/Creation.tsx` and `CreationScene.tsx`: a
   `CLASS_ROWS` row with the telling, and its `MOVES`.

## Later, if play asks for it

- A push hex for when foes close in (`knockAll`), if the class is
  miserable up close.
- Bone and charm items in place of the edges, if the blade tellings read
  wrong on a caster.
