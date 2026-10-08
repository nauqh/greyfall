"use client";

// Skirmish: an auto chess lobby against three AI clans. The run lives here
// and the scene reads and acts on it through hooks, restarting itself for
// each fight and each plan phase inside the one game rather than building
// another (a new WebGL context and a pass over the whole art pack).

import { act, fightRound, newRun, type Run } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import type { AutoHooks } from "../../game/autoPlan";
import { GameCanvas } from "../../game/GameCanvas";
import { StatTip, useStatTip } from "../../game/StatTip";

function newSeed(): string {
  return String(Math.floor(Math.random() * 2 ** 31));
}

export default function BattlePage() {
  const router = useRouter();
  const { tip, onTip } = useStatTip();
  // A ref, not state: the scene reads it inside its own handlers, and nothing
  // React draws depends on it.
  const run = useRef<Run | null>(null) as { current: Run };
  run.current ??= newRun(newSeed());

  const hooks: AutoHooks = {
    run: () => run.current,
    act: (a) => {
      const next = act(run.current, 0, a);
      run.current = next.run;
      return next.error;
    },
    fight: () => {
      const { run: next, report } = fightRound(run.current);
      run.current = next;
      const mine = report.fights.find((f) => f.a === 0);
      const foe = mine ? next.seats[mine.b]!.name + (mine.ghost ? " (echo)" : "") : "";
      return { result: mine?.result ?? null, foe, round: report };
    },
    again: () => {
      run.current = newRun(newSeed());
    },
  };

  return (
    <main className="stage">
      <GameCanvas
        start={(el) =>
          import("../../game/BattleScene").then(({ startBattle }) =>
            startBattle(el, {
              result: null,
              // The island's scenery is seeded by this; one seed per visit
              // keeps it the same island between the plan and the fight.
              seed: run.current.seed,
              auto: hooks,
              onMenu: () => router.push("/"),
              onTip,
            }),
          )
        }
      >
        <StatTip tip={tip} />
      </GameCanvas>
    </main>
  );
}
