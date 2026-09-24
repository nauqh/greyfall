"use client";

// The solo battle: draft an army against the engine's generated one and
// watch the playback. Its own route, so the battle's state dies with the
// route; a rematch or a new army restarts the scene inside the one game
// rather than building another (a new WebGL context and a pass over the
// whole art pack for what is only a cleared board).

import { BALANCE, generateArmy, simulate } from "@greyfall/engine";
import type { BattleResult, Placement } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { GameCanvas } from "../../game/GameCanvas";
import { StatTip, useStatTip } from "../../game/StatTip";

interface Battle {
  /** Null while the scene is drafting; set when Start is clicked. */
  result: BattleResult | null;
  /** Both armies as placed, so a rematch can resimulate with a new seed. */
  player: Placement[];
  enemy: Placement[];
  seed: number;
}

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export default function BattlePage() {
  const router = useRouter();
  const [battle, setBattle] = useState<Battle>({
    result: null,
    player: [],
    enemy: [],
    seed: newSeed(),
  });
  const { tip, onTip } = useStatTip();

  // Rematch runs inside a click handler and has to resimulate there and then,
  // so the armies are kept in a ref too: reading them back out of state would
  // give whatever the last render happened to see.
  const armies = useRef<{ player: Placement[]; enemy: Placement[] }>({ player: [], enemy: [] });

  // The scene calls this when Start is clicked and plays back what it returns.
  const draft = useCallback((army: Placement[], seed: number): BattleResult => {
    const enemy = generateArmy(BALANCE.budget, seed);
    const result = simulate(army, enemy, seed);
    armies.current = { player: army, enemy };
    setBattle({ result, player: army, enemy, seed });
    return result;
  }, []);

  // Both of these hand the next round straight back to the scene, which
  // restarts itself on it.
  const rematch = useCallback(() => {
    const seed = newSeed();
    const { player, enemy } = armies.current;
    const result = simulate(player, enemy, seed);
    setBattle({ result, player, enemy, seed });
    return { result, seed };
  }, []);

  const newArmy = useCallback(() => {
    const seed = newSeed();
    armies.current = { player: [], enemy: [] };
    setBattle({ result: null, player: [], enemy: [], seed });
    return { seed };
  }, []);

  return (
    <main className="stage">
      <GameCanvas
        start={(el) =>
          import("../../game/BattleScene").then(({ startBattle }) =>
            startBattle(el, {
              result: battle.result,
              seed: battle.seed,
              onDraft: (army, seed) => draft(army, seed as number),
              onRematch: rematch,
              onNewArmy: newArmy,
              onMenu: () => {
                // A stale result would make the next Begin replay the old
                // battle; clear it so the next visit opens in draft mode.
                armies.current = { player: [], enemy: [] };
                setBattle({ result: null, player: [], enemy: [], seed: newSeed() });
                router.push("/");
              },
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