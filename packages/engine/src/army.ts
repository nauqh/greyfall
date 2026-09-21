/**
 * The AI opponent. Given the same budget as the player, buys an army and
 * arranges it on its 4x3 board.
 *
 * The goal is a believable opponent, not an optimal one: weighted picks give
 * variety between seeds, and a fixed role template keeps the tanks in front of
 * the archers so the prototype never looks untuned.
 */

import { BALANCE, type UnitClass } from "./balance.ts";
import { makeRng, type Rng } from "./rng.ts";
import type { Army, Placement } from "./simulate.ts";

const ROW_ORDER = [1, 0, 2]; // fill the centre row first, it looks deliberate

/** Tiles a role wants, best first. Melee hold the front, ranged the back. */
function tilePreference(melee: boolean): { col: number; row: number }[] {
  const cols = melee ? [3, 2, 1, 0] : [0, 1, 2, 3];
  return cols.flatMap((col) => ROW_ORDER.map((row) => ({ col, row })));
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

/**
 * Buy and place an army within `budget` gold. The same seed always gives the
 * same army, so a replay only needs to store the seed.
 */
export function generateArmy(
  budget: number = BALANCE.budget,
  seed: number | string = 0,
): Army {
  const rng = makeRng(seed);
  const picked = buy(budget, rng);

  // Heaviest units to the front of their group, so a Lancer takes the very
  // front tile ahead of a Warrior.
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
