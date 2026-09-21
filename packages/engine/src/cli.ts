/**
 * Prints a battle between two armies. Node 24 runs this file directly:
 *
 *   pnpm battle
 *   pnpm battle -- --seed 7 --moves
 *
 * Flags: --seed <n|string>, --budget <n>, --moves (include movement).
 */

import { BALANCE, type UnitClass } from "./balance.ts";
import { generateArmy } from "./army.ts";
import { armyCost, simulate, type Army, type BattleResult, type Side } from "./simulate.ts";

const GLYPH: Record<UnitClass, string> = {
  pawn: "Paw",
  warrior: "War",
  lancer: "Lan",
  archer: "Arc",
  monk: "Mnk",
};

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function roster(army: Army): string {
  const counts = new Map<UnitClass, number>();
  for (const p of army) counts.set(p.class, (counts.get(p.class) ?? 0) + 1);
  return [...counts].map(([cls, n]) => `${n}x ${cls}`).join(", ");
}

/** The shared 8x3 grid as both sides start on it. */
function board(result: BattleResult): string {
  const cells = new Map<string, string>();
  for (const u of result.units) cells.set(`${u.col},${u.row}`, `${u.side}-${GLYPH[u.class]}`);

  const header =
    "     " +
    Array.from({ length: BALANCE.board.battleCols }, (_, c) => `c${c}`.padEnd(6)).join("");
  const rows = Array.from({ length: BALANCE.board.rows }, (_, row) => {
    const line = Array.from({ length: BALANCE.board.battleCols }, (_, col) =>
      (cells.get(`${col},${row}`) ?? ".").padEnd(6),
    ).join("");
    return `r${row}   ${line}`;
  });
  return [header, ...rows].join("\n");
}

function main(): void {
  const seedArg = flag("seed") ?? "1";
  const seed = Number.isNaN(Number(seedArg)) ? seedArg : Number(seedArg);
  const budget = Number(flag("budget") ?? BALANCE.budget);
  const showMoves = process.argv.includes("--moves");

  const armyA = generateArmy(budget, `${seed}-a`);
  const armyB = generateArmy(budget, `${seed}-b`);
  const result = simulate(armyA, armyB, seed);

  const name = new Map(result.units.map((u) => [u.id, `${u.id} ${u.class}`]));
  const at = (t: number) => `[${(t / BALANCE.tickRate).toFixed(1)}s]`.padStart(8);

  console.log(`GREYFALL - battle prototype   seed ${seed}   budget ${budget} gold\n`);
  console.log(`A  ${roster(armyA)}  (${armyCost(armyA)} gold)`);
  console.log(`B  ${roster(armyB)}  (${armyCost(armyB)} gold)\n`);
  console.log(board(result));
  console.log();

  for (const e of result.events) {
    switch (e.type) {
      case "move":
        if (showMoves) console.log(`${at(e.t)} ${name.get(e.unit)} steps to c${e.col} r${e.row}`);
        break;
      case "attack":
        break; // the paired hit carries the numbers
      case "hit":
        console.log(
          `${at(e.t)} ${name.get(e.unit)} hits ${name.get(e.target)} for ${e.damage} (${e.hpAfter} hp left)`,
        );
        break;
      case "heal":
        console.log(
          `${at(e.t)} ${name.get(e.unit)} heals ${name.get(e.target)} for ${e.amount} (${e.hpAfter} hp)`,
        );
        break;
      case "death":
        console.log(`${at(e.t)} ${name.get(e.unit)} dies`);
        break;
    }
  }

  const label: Record<Side | "draw", string> = {
    a: "A WINS",
    b: "B WINS",
    draw: "DRAW",
  };
  console.log(
    `\n${label[result.winner]} by ${result.reason} after ${(result.ticks / BALANCE.tickRate).toFixed(1)}s`,
  );
  console.log(
    `HP left   A ${result.hpRemaining.a} (${result.survivors.a} alive)   ` +
      `B ${result.hpRemaining.b} (${result.survivors.b} alive)`,
  );
  console.log(`${result.events.length} events`);
}

main();
