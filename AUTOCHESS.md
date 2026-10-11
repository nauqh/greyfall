# Skirmish as auto chess

Oct 8, 2026 · revised Oct 9, 2026: seven Enemy Pack monsters, a fourth tier, the Horde trait and an in-game handbook

## Summary

Skirmish moves from a one-off 20-gold draft to an auto chess run in the
Teamfight Tactics mould. You and three AI clans buy units from one shared
pool, three copies of a unit merge into a stronger star level, and each round
every clan fights a paired rival. Losing costs health, and the last clan
standing wins. The battle itself is the existing Skirmish simulation,
extended with stars, traits and the monsters' abilities. The war and Duel
keep the five knights and the old rules.

## What TFT and Dota Auto Chess do, and what Greyfall takes

| Mechanic | In TFT | In Greyfall |
| --- | --- | --- |
| Shared pool | Every player draws from one finite pool, so a contested unit runs dry and players pivot | Same. Copies by tier: 29, 22, 16, 10. Shops weight a class by copies left |
| Star levels | 3 copies make a 2-star, 9 a 3-star | Same, at 1.8x and 3.2x health, damage and healing. A buy that completes a merge works even off a full bench |
| Level = board size | XP bought 4 for 4 gold, 2 a round; level gates both board size and shop odds | Same, levels 2 to 8, over four tiers. Tier 4 first shows at level 4 |
| Interest | +1 gold per 10 held at round end, up to +5 | Same |
| Streaks | Win and loss streaks both pay, +1 to +3 | Same: 2-3 +1, 4-5 +2, 6+ +3. A win pays +1 more |
| Player damage | A stage amount plus the winner's surviving units | 3 + round/3, plus a point per surviving star |
| Odd lobby | One player fights a ghost copy of another board, which takes no damage | Same, shown as "(echo)" |
| Traits | Origins and classes, many per unit | One per knight class, and one origin, the Horde, shared by every monster. See below |

## The roster

Five knights and seven monsters from the Enemy Pack. With only the knights,
a shop of five slots drawn from five classes kept repeating itself and the
traits mostly rewarded stacking one class; the monsters add roles the
knights lack and a fourth, 4-gold tier that makes levelling worth more.
Each clan plays on a 6x4 half, a 12x4 battle grid, against Duel's 5x3. The
level cap stays 8, so the extra cells are room to position, not more units:
TFT's half is 7x4, and 6x4 is what fits beside the shop. Over 80 AI lobbies
it moved nothing: still 12 to 20 rounds, median 15, and no fight timed out.

| Unit | Tier, cost | Health | Damage | Range | Skill, every | Skill |
| --- | --- | --- | --- | --- | --- | --- |
| Pawn | 1 | 40 | 4 | 1 | 5s | Smash: hits its target for 250% |
| Lancer | 1 | 140 | 10 | 1 | 8s, from the start | Taunt: for 4s, enemies within 2 tiles must attack it |
| Skull | 1 | 90 | 9 | 1 | 12s, from the start | Reassemble: the blow that would kill it leaves it at 40% |
| Warrior | 2 | 120 | 14 | 1 | 8s, from the start | Guard: below 50%, takes 50% less damage for 3s |
| Archer | 2 | 60 | 10 | 5 | 3s | Piercing shot: also hits the enemy behind for 50% |
| Torch Goblin | 2 | 100 | 11 | 1 | 4s | Splash: also burns the target's neighbours for 100% |
| Gnoll | 2 | 75 | 11 | 4 | 3s | Hunter: 100% more damage to a target below 50% |
| Monk | 3 | 70 | heals 8 | 2 | 12s, from the start | Revive: raises the first fallen ally at 50% |
| Thief | 3 | 110 | 20 | 1 | 8s, from the start | Ambush: leaps beside the enemy furthest back |
| Hex Shaman | 3 | 80 | 14 | 3 | 3s | Hex: costs its target 1.5s before its next action |
| Troll | 4 | 360 | 20 | 1 | 5s | Regenerate: regains 12% of its health |
| Minotaur | 4 | 280 | 23 | 1 | 4s | Cleave: also hits every other enemy beside it for 100% |

Stats are at 1 star. Every unit acts once a second; the Archer's Volley is
the only thing that changes that. Monsters look the same on both teams, so
each stands on a disc in its team's colour.

## Skills

TFT and Dota Auto Chess give every unit an active ability, cast from a
second bar under the health bar. Both fill that bar with mana and cast
when it is full. TFT sets the rate by role: 10 a basic attack for
Fighters, Assassins and Marksmen, 7 plus 2 a second for Casters, and 5 for
Tanks, which alone also gain mana from damage taken. Dota Auto Chess casts
at 100 mana, earned from dealing damage and from taking it. Skirmish runs the
bar as a countdown instead: it drains, the unit casts when it is empty, and
the countdown starts over, so every skill recurs through a fight. A timer
is easier to read and to balance than mana income, and the mana model is
still open if the fights want more back-and-forth. Two rules come from TFT:

- Every champion has one. The Pawn, which had none, gained Smash.
- A skill with nothing to do waits, armed, at an empty bar: a Gnoll holds
  Hunter until a target drops below half, a Monk holds Revive until
  someone falls. Reactive skills (Taunt, Guard, Reassemble, Revive,
  Ambush) start armed; the rest count down from the first second.

Duel keeps its once-a-battle knight abilities: the countdown is the
`skills` option on the simulation, and only Skirmish passes it. Over 80
all-AI lobbies, against the run before skills: 12 to 19 rounds (median
14, was 15), 1 timeout in 2,159 fights. Win rates when fielded moved by 5
points or fewer, except the Minotaur, 75% to 64%, since Cleave became a
cast and not every swing.

## Traits

Two or more of a knight class on the board switch its trait on, and a
second threshold makes it stronger. Monsters share one origin, the Horde,
which counts different kinds of monster rather than units, the way TFT
counts unique champions, so it rewards a spread instead of a stack.

| Trait | Who | At | Effect |
| --- | --- | --- | --- |
| Prospectors | Pawns | 2 / 4 | +1 / +3 gold after each round |
| Vanguard | Lancers | 2 / 4 | Lancers +20% / +45% health |
| Shieldwall | Warriors | 2 / 4 | Warriors take 15% / 30% less damage |
| Volley | Archers | 2 / 4 | Archers attack every 0.7s / 0.5s |
| Chorus | Monks | 2 / 3 | Monks heal 50% / 120% more |
| Horde | Monster kinds | 2 / 4 / 6 | Monsters deal 12% / 25% / 45% more damage |

Prospectors is the one idea TFT doesn't have: the Pawn mines, so a board
that fields Pawns gives up strength now for gold later. It is an economy
choice that lives on the board.

Every number above, and the shop odds, is in the in-game handbook (H, or the
? button), read straight off the balance tables.

## Numbers

All-AI lobbies, 80 seeds each, with the AI's favourite classes in two seat
orders so seat and class can be told apart:

- A run lasts 11 to 20 rounds, median 14 to 15, at 70 starting health.
  At 100 health it was a median of 17 to 19, too long for a call.
- With Warrior at 1 gold, the warrior-leaning AI won about 40% of
  lobbies from any seat. Lancer became the 1-cost tank and Warrior moved
  to 2 gold. After the trait retune, over 160 lobbies, the lancer-leaning
  AI wins 33% and the other three 21 to 24%, against an even 25%. Lancers
  are still a little strong.
- Under 1% of fights reach the 45s timeout.
- With the monsters in, over 80 lobbies: still 12 to 20 rounds, median 15,
  and no fight timed out. The four seats won 16, 18, 22 and 24 lobbies; the
  Horde-leaning AI won 24. Fielded, the Troll wins 63% of its fights and the
  Minotaur 70%, mostly because they only appear late on boards already
  winning; a trim to the Minotaur moved nothing measurable. The Archer is
  the weakest non-economy unit at 43%.

These measure the AI against itself, not people.

## Next, in order of value

1. **Multiplayer lobby.** The run is pure and seeded and takes one action
   at a time, so each AI seat can become a player whose actions go to the
   server, the way Duel's armies do now. This is the Discord goal.
2. **PvE rounds.** TFT opens each stage on neutral monsters that drop loot.
   The Enemy Pack has more bodies than the seven in the shop (Spear Goblin,
   Bear, Spider, Lizard, Panda, Turtle) to stock them.
3. **Augments.** TFT's three picks of a run-long perk (more interest, a free
   Monk, Pawns that fight). Cheap to add and they make runs differ.
4. **Items.** Component drops from PvE rounds, combined two at a time. The
   biggest job here, and it needs art the pack mostly lacks.
5. **Clan origins.** The pack draws every unit in five colours, so a unit
   could carry a clan as a second trait. Both teams would then show mixed
   colours, so the board needs another way to tell sides apart first.

Left out for now: shop locking, a sell value that discounts 2-stars, shop
copies reserved from the pool, and a carousel.

Skills: [TFT roles and mana (Riot)](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/roles-revamped-and-item-changes/),
[Mana in Dota Auto Chess (Fandom wiki)](https://dotaautochess.fandom.com/wiki/Mana).
Read Oct 11, 2026.

Sources: [TFT economy: interest, streaks and gold (TFT Ninja)](https://tft.ninja/guides/game-mechanics/economy),
[TFT shop odds and pool sizes (MetaTFT)](https://www.metatft.com/tables/shop-odds),
[Star levels and the champion pool (metabot.gg)](https://metabot.gg/en/TFT/guides/tft-star-levels-champion-pool-explained),
[Win and loss streak values (tftraits.com)](https://tftraits.com/articles/win-loss-streak/),
[Dota Auto Chess (Wikipedia)](https://en.wikipedia.org/wiki/Dota_Auto_Chess).
Read Oct 8, 2026; TFT's numbers change every set.
