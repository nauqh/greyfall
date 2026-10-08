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
A bigger board was the alternative and was turned down: the 5x3 half holds
the level cap of 8, which no board reaches before round 15.

| Unit | Tier, cost | Health | Damage | Range | Ability |
| --- | --- | --- | --- | --- | --- |
| Pawn | 1 | 40 | 4 | 1 | - |
| Lancer | 1 | 140 | 10 | 1 | Taunt: enemies within 2 tiles must attack it |
| Skull | 1 | 90 | 9 | 1 | Reassemble: once a battle, the blow that would kill it leaves it at 40% |
| Warrior | 2 | 120 | 14 | 1 | Guard: once, below 50%, takes 50% less damage for 3s |
| Archer | 2 | 60 | 10 | 5 | Piercing shot: one arrow in 3 also hits the enemy behind for 50% |
| Torch Goblin | 2 | 100 | 11 | 1 | Splash: hits also burn the target's neighbours for 50% |
| Gnoll | 2 | 75 | 11 | 4 | Hunter: 50% more damage to targets below 50% health |
| Monk | 3 | 70 | heals 8 | 2 | Revive: once, raises the first fallen ally at 50% |
| Thief | 3 | 110 | 20 | 1 | Ambush: opens by leaping beside the enemy furthest back |
| Hex Shaman | 3 | 80 | 14 | 3 | Hex: one bolt in 3 costs its target 1.5s before its next action |
| Troll | 4 | 360 | 20 | 1 | Regenerate: regains 2% of its health every second |
| Minotaur | 4 | 280 | 23 | 1 | Cleave: each swing also hits every other enemy beside it for 50% |

Stats are at 1 star. Every unit acts once a second; the Archer's Volley is
the only thing that changes that. Monsters look the same on both teams, so
each stands on a disc in its team's colour.

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

Sources: [TFT economy: interest, streaks and gold (TFT Ninja)](https://tft.ninja/guides/game-mechanics/economy),
[TFT shop odds and pool sizes (MetaTFT)](https://www.metatft.com/tables/shop-odds),
[Star levels and the champion pool (metabot.gg)](https://metabot.gg/en/TFT/guides/tft-star-levels-champion-pool-explained),
[Win and loss streak values (tftraits.com)](https://tftraits.com/articles/win-loss-streak/),
[Dota Auto Chess (Wikipedia)](https://en.wikipedia.org/wiki/Dota_Auto_Chess).
Read Oct 8, 2026; TFT's numbers change every set.
