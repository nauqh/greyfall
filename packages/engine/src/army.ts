/**
 * The AI opponent: believable, not optimal. Weighted picks give variety
 * between seeds; a role template keeps tanks in front of archers.
 */

import { BALANCE, type UnitClass } from "./balance.ts";
import { makeRng, type Rng } from "./rng.ts";
import type { Army, Placement } from "./simulate.ts";

/** Cells a role wants, best first: melee front and centre, ranged back corners. */
function tilePreference(melee: boolean): { col: number; row: number }[] {
  const rows = melee ? [2, 1, 0] : [0, 1, 2];
  const cols = melee ? [2, 1, 3, 0, 4] : [0, 4, 1, 3, 2];
  return rows.flatMap((row) => cols.map((col) => ({ col, row })));
}

function buy(budget: number, rng: Rng): UnitClass[] {
  const weights = Object.entries(BALANCE.aiPickWeights) as [UnitClass, number][];
  const picked: UnitClass[] = [];
  let gold = budget;

  while (picked.length < BALANCE.board.maxUnits) {
    const affordable = weights
      .filter(([cls]) => BALANCE.units[cls].cost <= gold)
      .map(([item, weight]) => ({ item, weight }));
    if (affordable.length === 0) break;

    const cls = rng.weighted(affordable);
    picked.push(cls);
    gold -= BALANCE.units[cls].cost;
  }

  return picked;
}

/** Same seed always gives the same army, so a replay need only store the seed. */
export function generateArmy(
  budget: number = BALANCE.budget,
  seed: number | string = 0,
): Army {
  const rng = makeRng(seed);
  const picked = buy(budget, rng);

  // Heaviest first, so a Lancer takes the front cell ahead of a Warrior.
  picked.sort((a, b) => BALANCE.units[b].hp - BALANCE.units[a].hp);

  const taken = new Set<string>();
  const army: Army = [];

  for (const cls of picked) {
    const melee = BALANCE.units[cls].range <= 1;
    const tile = tilePreference(melee).find((t) => !taken.has(`${t.col},${t.row}`));
    if (tile === undefined) break; // board full; cannot happen within budget
    taken.add(`${tile.col},${tile.row}`);
    army.push({ class: cls, col: tile.col, row: tile.row } satisfies Placement);
  }

  return army;
}
