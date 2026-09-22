"use client";

// The Phase 1 prototype, all in the browser: the battle scene opens in draft
// mode, the army is placed on the canvas, Start hands it to the engine, and
// the event log plays back. Phaser loads client-side only, inside an effect,
// per the PRD.

import { BALANCE, generateArmy, simulate } from "@greyfall/engine";
import type { BattleResult, Placement } from "@greyfall/engine";
import { useCallback, useEffect, useRef, useState } from "react";

import { packUrl } from "../game/art";

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
      return { ...b, result: simulate(b.player, b.enemy, seed), seed, id: b.id + 1 };
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
      <main className="intro">
        <h1 className="banner">GREYFALL</h1>
        <div className="introBody">
          <div className="menu">
            <p className="tagline">
              The Greying has taken the land. Spend {BALANCE.budget} gold, hold the line.
            </p>
            <button className="btn" type="button" onClick={() => setStarted(true)}>
              Begin
            </button>
          </div>
          <div
            className="pawnStage"
            style={{ backgroundImage: `url("${packUrl("grass_tile.png")}")` }}
          >
            <div
              className="pawnWork"
              style={{
                backgroundImage: `url("${packUrl("Units/Blue Units/Pawn/Pawn_Interact Pickaxe.png")}")`,
              }}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="stage">
      <BattleView battle={battle} onDraft={draft} onRematch={rematch} onNewArmy={newArmy} />
    </main>
  );
}

function BattleView({
  battle,
  onDraft,
  onRematch,
  onNewArmy,
}: {
  battle: Battle;
  onDraft: (army: Placement[], seed: number) => BattleResult;
  onRematch: () => void;
  onNewArmy: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onDraft, onRematch, onNewArmy });
  handlers.current = { onDraft, onRematch, onNewArmy };

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let game: { destroy: () => void } | null = null;

    // Imported in the effect so Phaser never runs on the server.
    void import("../game/BattleScene").then(({ startBattle, GAME_W, GAME_H }) => {
      if (cancelled) return;
      // The scene owns the proportions. Hardcoding them in CSS letterboxes
      // FIT into a wrongly shaped box every time the layout moves.
      el.style.aspectRatio = `${GAME_W} / ${GAME_H}`;
      // Cap width by what the viewport height allows, or a short viewport
      // clamps height only and FIT letterboxes the sides.
      el.style.maxWidth = `min(1180px, calc((100vh - 28px) * ${GAME_W} / ${GAME_H}))`;
      game = startBattle(el, {
        result: battle.result,
        seed: battle.seed,
        onDraft: (army, seed) => handlers.current.onDraft(army, seed as number),
        onRematch: () => handlers.current.onRematch(),
        onNewArmy: () => handlers.current.onNewArmy(),
      });
    });

    return () => {
      cancelled = true;
      game?.destroy();
    };
    // Remounts only when battle.id changes; the cleanup destroys the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.id]);

  return <div className="canvas" ref={holder} />;
}
