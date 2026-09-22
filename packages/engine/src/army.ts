/**
 * The AI opponent: believable, not optimal. A weighted opener gives a real
 * comp when the budget allows; leftover gold rolls singles by aiPickWeights.
 * A role template keeps tanks in front of archers.
 */

import { BALANCE, type UnitClass } from "./balance.ts";
import { makeRng, type Rng } from "./rng.ts";
import type { Army, Placement } from "./simulate.ts";

/** Cells a role wants, best first: melee front and centre lane, ranged held back. */
function tilePreference(melee: boolean): { col: number; row: number }[] {
  const cols = melee ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  const rows = [1, 0, 2];
  return cols.flatMap((col) => rows.map((row) => ({ col, row })));
}

function templateUnits(rng: Rng): UnitClass[] {
  const templates = BALANCE.aiTemplates.filter(
    (t) => t.units.reduce((sum, c) => sum + BALANCE.units[c].cost, 0) <= BALANCE.budget,
  );
  if (templates.length === 0) return [];
  const chosen = rng.weighted(templates.map((t) => ({ item: t, weight: t.weight })));
  // A shuffle keeps every seed's army distinct; the placement sort below
  // re-forms the battle line, so order here costs nothing.
  return [...chosen.units].sort(() => rng.next() - 0.5);
}

/**
 * Weighted single picks for the gold an opener leaves. Free money: deleting
 * this strand costs the AI ~2.5 gold a game (templates only spend 17.4 of 20).
 */
function buySingles(budget: number, rng: Rng, capacity: number): UnitClass[] {
  const weights = Object.entries(BALANCE.aiPickWeights) as [UnitClass, number][];
  const picked: UnitClass[] = [];
  let gold = budget;

  while (picked.length < capacity) {
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
  const opener = budget >= BALANCE.budget ? templateUnits(rng) : [];
  const spent = opener.reduce((sum, c) => sum + BALANCE.units[c].cost, 0);
  const capacity = BALANCE.board.maxUnits - opener.length;
  const picked = opener.concat(buySingles(budget - spent, rng, capacity));

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
