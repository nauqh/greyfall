/**
 * Plays a whole war on the island, AI against AI, round by round:
 *
 *   pnpm war
 *   pnpm war -- --seed 7 --round 3
 *
 * Flags: --seed <n|string>, --round <n> (print that round's battle in full).
 */

import { planAi } from "./ai.ts";
import { battle, type WarEvent } from "./battle.ts";
import { BALANCE, WAR } from "./balance.ts";
import { newMatch, supplyCap, supplyUsed, type MatchState } from "./war.ts";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function army(state: MatchState, side: "a" | "b"): string {
  const counts = new Map<string, number>();
  for (const u of state.units) if (u.side === side) counts.set(u.class, (counts.get(u.class) ?? 0) + 1);
  return [...counts].map(([cls, n]) => `${n} ${cls}`).join(", ") || "nobody";
}

function describe(e: WarEvent, name: (id: number) => string): string | null {
  const at = `[${(e.t / BALANCE.tickRate).toFixed(1)}s]`.padStart(8);
  switch (e.type) {
    case "move":
      return null;
    case "attack":
      return `${at} ${name(e.unit)} hits ${name(e.target)} for ${e.damage} (${e.hpAfter} hp left)`;
    case "hitBuilding":
      return `${at} ${name(e.unit)} hits ${e.plot} for ${e.damage} (${e.hpAfter} hp left)`;
    case "heal":
      return `${at} ${name(e.unit)} heals ${name(e.target)} for ${e.amount} (${e.hpAfter} hp)`;
    case "fallBack":
      return `${at} ${name(e.unit)} falls back at ${e.hp} hp`;
    case "death":
      return `${at} ${name(e.unit)} dies`;
    case "destroyed":
      return `${at} ${e.plot} is destroyed`;
  }
}

function main(): void {
  const seedArg = flag("seed") ?? "1";
  const seed = Number.isNaN(Number(seedArg)) ? seedArg : Number(seedArg);
  const detail = Number(flag("round") ?? 0);

  console.log(`GREYFALL - war on the island   seed ${seed}\n`);
  let state = newMatch(seed);
  while (state.winner === null) {
    const s = state;
    const out = battle(s, planAi(s, "a"), planAi(s, "b"));
    const r = out.report;
    console.log(
      `Round ${r.round}  gold A ${s.gold.a} B ${s.gold.b}  supply A ${supplyUsed(s, "a")}/${supplyCap(s, "a")} B ${supplyUsed(s, "b")}/${supplyCap(s, "b")}`,
    );
    console.log(`  A: ${army(out.start, "a")}`);
    console.log(`  B: ${army(out.start, "b")}`);
    if (r.round === detail) {
      const cls = new Map(out.start.units.map((u) => [u.id, `${u.side}${u.id} ${u.class}`]));
      for (const e of out.events) {
        const line = describe(e, (id) => cls.get(id) ?? `#${id}`);
        if (line) console.log(line);
      }
    }
    const lost = (side: "a" | "b") => r.losses[side].join(", ") || "none";
    console.log(
      `  battle ${r.seconds}s${r.settled ? "" : " (cut off at the cap)"}  lost A: ${lost("a")}  B: ${lost("b")}` +
        (r.destroyed.length ? `  destroyed: ${r.destroyed.join(", ")}` : "") +
        (r.built.length ? `  built: ${r.built.join(", ")}` : "") +
        (r.greying ? `  the Greying takes ${r.greying} from each hall` : ""),
    );
    console.log(
      `  halls A ${out.end.buildings["a-castle"]!.hp}/${WAR.buildingHp.castle}  B ${out.end.buildings["b-castle"]!.hp}/${WAR.buildingHp.castle}\n`,
    );
    state = out.end;
  }
  const label = { a: "A WINS", b: "B WINS", draw: "DRAW" };
  console.log(`${label[state.winner]} in round ${state.round}`);
}

main();
