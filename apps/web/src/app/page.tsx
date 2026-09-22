"use client";

// The Phase 1 prototype, all in the browser. Two Phaser screens at the same
// logical size: the title island, then the battle, which opens in draft mode,
// hands the army to the engine on Start and plays the event log back. Phaser
// loads client-side only, inside an effect, per the PRD.

import { BALANCE, generateArmy, simulate } from "@greyfall/engine";
import type { BattleResult, Placement } from "@greyfall/engine";
import { useCallback, useEffect, useRef, useState } from "react";

interface Battle {
  /** Null while the scene is drafting; set when Start is clicked. */
  result: BattleResult | null;
  /** Both armies as placed, so a rematch can resimulate with a new seed. */
  player: Placement[];
  enemy: Placement[];
  seed: number;
  /** Bumped per battle so the Phaser game is rebuilt fresh for each one. */
  id: number;
}

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export default function Page() {
  const [started, setStarted] = useState(false);
  const [battle, setBattle] = useState<Battle>({
    result: null,
    player: [],
    enemy: [],
    seed: newSeed(),
    id: 0,
  });

  // The scene calls this when Start is clicked and plays back what it returns.
  const draft = useCallback((army: Placement[], seed: number): BattleResult => {
    const enemy = generateArmy(BALANCE.budget, seed);
    const result = simulate(army, enemy, seed);
    setBattle((b) => ({ ...b, result, player: army, enemy }));
    return result;
  }, []);

  const rematch = useCallback(() => {
    setBattle((b) => {
      const seed = newSeed();
      return {
        ...b,
        result: simulate(b.player, b.enemy, seed),
        seed,
        id: b.id + 1,
      };
    });
  }, []);

  const newArmy = useCallback(() => {
    setBattle((b) => ({
      ...b,
      result: null,
      player: [],
      enemy: [],
      seed: newSeed(),
      id: b.id + 1,
    }));
  }, []);

  if (!started) {
    return (
      <main className="stage">
        <GameCanvas
          start={(el) =>
            import("../game/IntroScene").then(({ startIntro }) =>
              startIntro(el, {
                budget: BALANCE.budget,
                onBegin: () => setStarted(true),
              }),
            )
          }
        />
      </main>
    );
  }

  return (
    <main className="stage">
      <GameCanvas
        // A new battle is a new game, so React unmounts this and the effect's
        // cleanup destroys the old one.
        key={battle.id}
        start={(el) =>
          import("../game/BattleScene").then(({ startBattle }) =>
            startBattle(el, {
              result: battle.result,
              seed: battle.seed,
              onDraft: (army, seed) => draft(army, seed as number),
              onRematch: rematch,
              onNewArmy: newArmy,
            }),
          )
        }
      />
    </main>
  );
}

/** Holds one Phaser game at the scene's own ratio. */
function GameCanvas({ start }: { start: (el: HTMLElement) => Promise<{ destroy: () => void }> }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let game: { destroy: () => void } | null = null;

    // Imported in the effect so Phaser never runs on the server.
    void import("../game/boot")
      .then(({ GAME_W, GAME_H }) => {
        if (cancelled) return null;
        // The scene owns the proportions. Hardcoding them in CSS letterboxes
        // FIT into a wrongly shaped box every time the layout moves.
        el.style.aspectRatio = `${GAME_W} / ${GAME_H}`;
        // Cap width by what the viewport height allows, or a short viewport
        // clamps height only and FIT letterboxes the sides.
        el.style.maxWidth = `min(1180px, calc((100vh - 28px) * ${GAME_W} / ${GAME_H}))`;
        return start(el);
      })
      .then((g) => {
        if (!g) return;
        if (cancelled) g.destroy();
        else game = g;
      });

    return () => {
      cancelled = true;
      game?.destroy();
    };
    // Mounts once; the key on the caller's side is what forces a new game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="canvas" ref={holder} />;
}
