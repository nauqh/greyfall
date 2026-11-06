# Greyfall: the game

A Souls-structured action RPG in which you lead a small warband through the
Shattered Reach. Diablo-style control and maze maps, Dark Souls structure:
bonfires, shortcuts, keys, bosses, and gold you drop when you die.

The world it plays in is the Atlas (`ATLAS.md`): three tiers of areas joined
by gates and lifts, each area its own large map. This file is the design of
the game played on it. Numbers here are starting values, to be tuned once it
is playable.

## The pitch

You are the last captain of Last Harbour. With a band of up to three
companions you push out through the Reach, take the boss keys, open the Grey
Gate and kill the Grey Warlord. Every road loops back to the bonfire in the
Harbour square.

## Controls

Keyboard and mouse after Dark Souls on a PC. The camera follows the hero
inside the area map.

| Input | Action |
| --- | --- |
| W A S D or the arrows | Walk the way they point, diagonals too, sliding along walls; in a merchant's menu, W and S move the pick |
| Left click | Attack, turned toward the cursor: the monster in reach nearest where it points. A press made mid-swing is kept |
| Right click (hold), or F | Guard: stand behind the shield, turned to the nearest monster; a blow from the front lets a fifth through and costs stamina |
| Shift (tap) | Roll the way you walk, or backstep standing still: nothing lands during it, costs stamina |
| Shift (hold, moving) | Sprint, draining stamina |
| E | Interact: talk and turn the page, rest at a bonfire, traverse the white light at a way out (or ride the lift, or drop) |
| R | Drink a flask |
| 1 | Band: Follow (stay close, defend the hero) |
| 2 | Band: Attack the monster you last struck |
| 3 | Band: Hold here (guard the spot) |
| Tab | The area map, showing what has been explored |

## The hero

A Warrior in blue, the captain.

| Stat | Start | Notes |
| --- | --- | --- |
| HP | 100 | |
| Stamina | 100 | As in Dark Souls: a swing 14, a roll 22, sprinting 15 a second, a blow on the shield 2.5 times its weight (too little left breaks the guard: it lands whole and staggers). Comes back 45 a second after half a second unspent, a third as fast behind the shield. At nothing, no swing or roll |
| Attack | 12 a swing | Combo of 3: the first two 0.65 s apart, the third knocks back and takes 1.1 s to recover |
| Flasks | 3 | Each heals 40 HP; refilled at a bonfire |

Levelling is Souls-style: spend gold at a bonfire. Each level adds +10 HP,
+2 attack or +10 stamina, the player's choice.

## The band

Up to three companions at once, all Tiny Swords units already drawn in blue.

| Companion | Role | Behaviour | How you get one |
| --- | --- | --- | --- |
| Lancer | Tank | Charges your target and draws aggro | Hire from Sergeant Corwin at the barracks, 75 gold: E beside him opens Talk / Hire / Leave |
| Archer | Ranged | Keeps 5 tiles back and shoots | Hire from Wren at the archery range, 60 gold, the same way |
| Monk | Healer | Heals whoever is lowest below 60%, 8 s cooldown | Freed from the Drowned Chapel (Undercroft) |
| Pawn | Utility | Carries more loot, picks up gold, repairs bridges | Recruit in Old Town, cheap |
| Gnome | Special | Throws bombs | Won after Old Bamboo (Tinker Crags) |

- A companion who falls stays down until the next bonfire rest. On Hardcore,
  a fallen companion is gone for good.
- Companion behaviour reuses the engine's existing combat rules (stats,
  targeting, damage): a fight is the same simulation, run in real time with
  the hero inside it.

## The Souls loop

- **Bonfires.** Resting fully heals the hero and the band, refills flasks,
  saves, and respawns every enemy in the area, but not bosses or opened
  shortcuts. Each area has 1 to 3; they already stand on the maps. After
  the rest the captain sits by the fire, as in Dark Souls 3: Travel opens
  the map, to go to any bonfire already lit, and Leave stands up.
- **Death.** You wake at the last bonfire you rested at. Your carried gold
  stays where you fell, marked on the map. Reach it again to get it back;
  die on the way and it is gone.
- **Shortcuts.** Gates and lifts that open from one side only, such as the
  Moor Gate and the Watch Lift. Opening one is permanent and turns the area
  into a loop.
- **Keys.** The Cinder Troll (Emberwood) drops the Troll Key; the Barrow King
  (Barrowmoor) drops the Horned Key. Together they open the Grey Gate. The
  Sky Bridge from the Crags is the other, harder way into the Greyfall.

## Enemies by area

All from the Tiny Swords enemy pack.

| Area | Rank and file | Elite | Boss |
| --- | --- | --- | --- |
| Emberwood | Torch and spear goblins | Shaman (fire) | Cinder Troll |
| Tinker Crags | Gnomes, slingers, cannons | Panda guard | Old Bamboo |
| Undercroft | Skeletons, spiders | Skull guard | Ossuary Warden (mini-boss) |
| Barrowmoor | Skeletons, bats | Skull guard | The Barrow King (minotaur) |
| The Greyfall | Black soldiers, gnolls | Minotaur champion | The Grey Warlord |
| Gilded Reach | Yellow guard | Lancers | The Sun Sentinel |

Gnolls, slingshot gnomes and hex shamans throw from four or five tiles
off rather than close in. Bats, imps and bees fly: no blade reaches them,
not the captain's nor a Lancer's, so only an Archer brings them down; a
captain alone can guard and walk away.
A thrown or shot missile needs a clear line: a house, a hut, a tower, a
dead tree or the woods hide whoever stands behind them, and a thrower
walks round for a clear shot. Archers in the band need one too.

A monster winds up before it strikes, its attack playing out with a
white flash at the start: roll or raise the shield then, and strike back
while it recovers. No more than two blades press one mark at a time;
the rest hold back and wait their turn. A hit breaks a light monster's
wind-up; gnolls, lizards and shamans do not flinch.

Camps sit in the maze rooms. An enemy chases up to 10 tiles from its post,
then walks back; the engine already has a guard leash.

## Loot and gold

- **Gold** drops from enemies where they fall, and lies in gold stones
  (25 each, taken once) and chests; walk up to it to pick it up. It is
  the only currency: levels, recruits, sword upgrades.
- **No gear.** The captain's sprite is fixed, so there are no weapons or
  armour to find or wear.
- **The blacksmith** in the Harbour upgrades the captain's sword +1 to +5
  for gold and ore from the Mine Hills and the Crags (see "Planned: a
  blacksmith" in `ATLAS.md`).

## The first slice

1. **The Landing:** the beach a new game starts on, south of the Harbour
   up the Shore Road. A bonfire, two goblins, and notes on the ground
   that teach the controls, read with E.
2. **The Harbour:** the hub. Bonfire, recruiting (Lancer, Archer), the
   blacksmith.
3. **Emberwood:** the first hostile area. Goblin camps through the maze, two
   bonfires, the Treetop Walk shortcut.
4. **The Cinder Troll** in Troll's Hollow, with three attacks:
   - **Club slam:** a ground circle that warns before it lands.
   - **Charge:** a straight line across the arena.
   - **Ember toss:** fire patches on the ground.
5. **Reward:** the Troll Key and its gold.

**Done when:** you can walk out of the Harbour, die in Emberwood, recover
your gold, open the shortcut, and kill the Troll with a band of two.

Build order: the hero walking and swinging in the Harbour with one enemy
camp; then death, bonfires and dropped gold; then companions; then
Emberwood and the Troll.

## How the code splits

- **Engine** (`packages/engine`, tested without a screen): stats, damage,
  aggro and leash, companion AI, bonfire and respawn rules, save data. Runs
  at 20 ticks a second, like the existing battle sim.
- **Scene** (`apps/web`): input, camera, animations, hit effects, the HUD
  (hearts, stamina, flasks, band portraits), boss warning circles.
- **Save:** browser storage first. One save holds opened shortcuts, keys,
  the dropped gold's spot, and the band.

## Open questions

Defaults in brackets, used until decided.

1. Hero class: Warrior only, or a pick at the start (Warrior, Lancer,
   Archer)? [Warrior only]
2. Fallen companions: back at the next bonfire, or gone for good outside
   Hardcore? [Back at the bonfire]
3. After the Warlord: a single campaign, or New Game+? [Single campaign]
