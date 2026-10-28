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

Mouse first, as in Diablo. The camera follows the hero inside the area map.

| Input | Action |
| --- | --- |
| Left click on ground | Move; hold to keep walking toward the cursor |
| Left click on an enemy | Walk up and attack until it dies |
| Right click | The hero's skill, aimed at the cursor |
| Space | Dodge-roll a short way: brief invulnerability, costs stamina |
| 1 | Band: Follow (stay close, defend the hero) |
| 2 | Band: Attack my target |
| 3 | Band: Hold here (guard the spot) |
| Q | Drink a flask |
| E | Interact: gate, lever, lift, chest, bonfire, NPC |
| Tab | The area map, showing what has been explored |

## The hero

A Warrior in blue, the captain.

| Stat | Start | Notes |
| --- | --- | --- |
| HP | 100 | |
| Stamina | 100 | Dodge costs 25, heavy swing 30; refills in about 2 s |
| Attack | 12 a swing, 0.8 s apart | Light combo of 3 swings; the third knocks back |
| Skill | Shield Bash | Stuns for 1.5 s, 6 s cooldown |
| Flasks | 3 | Each heals 40 HP; refilled at a bonfire |

Levelling is Souls-style: spend gold at a bonfire. Each level adds +10 HP,
+2 attack or +10 stamina, the player's choice.

## The band

Up to three companions at once, all Tiny Swords units already drawn in blue.

| Companion | Role | Behaviour | How you get one |
| --- | --- | --- | --- |
| Lancer | Tank | Charges your target and draws aggro | Recruit at the Harbour barracks |
| Archer | Ranged | Keeps 5 tiles back and shoots | Recruit at the archery range |
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
  shortcuts. Each area has 1 to 3; they already stand on the maps.
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

Camps sit in the maze rooms. An enemy chases up to 10 tiles from its post,
then walks back; the engine already has a guard leash.

## Loot and gold

- **Gold** drops from enemies, gold stones and chests. It is the only
  currency: levels, recruits, upgrades.
- **Gear**, three slots, deliberately small:
  - **Weapon:** sword, axe, or spear (longer reach, slower).
  - **Charm:** for example +1 flask, +10% gold, or stamina back on a hit.
  - **Banner:** a buff for the whole band, such as +15% companion HP.
- **The blacksmith** in the Harbour upgrades weapons +1 to +5 for gold and
  ore from the Mine Hills and the Crags (see "Planned: a blacksmith" in
  `ATLAS.md`).

## The first slice

1. **The Harbour:** the hub. Bonfire, recruiting (Lancer, Archer), the
   blacksmith.
2. **Emberwood:** the first hostile area. Goblin camps through the maze, two
   bonfires, the Treetop Walk shortcut.
3. **The Cinder Troll** in Troll's Hollow, with three attacks:
   - **Club slam:** a ground circle that warns before it lands.
   - **Charge:** a straight line across the arena.
   - **Ember toss:** fire patches on the ground.
4. **Reward:** the Troll Key and a new weapon.

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
