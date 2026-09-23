"use client";

// The Phase 1 prototype, all in the browser. Two Phaser screens at the same
// logical size: the title island, then the battle, which opens in draft mode,
// hands the army to the engine on Start and plays the event log back. Phaser
// loads client-side only, inside an effect, per the PRD.

import { BALANCE, generateArmy, simulate } from "@greyfall/engine";
import type { BattleResult, Placement } from "@greyfall/engine";
import { useCallback, useRef, useState } from "react";

import { GameCanvas } from "../game/GameCanvas";
import { Lobby } from "../pvp/Lobby";
import { TrpcProvider } from "../pvp/Provider";
import { Room } from "../pvp/Room";
import type { RoomView } from "../server/room/view";

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

/** Which of the four screens the page is on. */
type Mode = "intro" | "strategic" | "solo" | "duel";

export default function Page() {
  const [mode, setMode] = useState<Mode>("intro");
  /** Set once a seat is held; the lobby shows until then. */
  const [room, setRoom] = useState<RoomView | null>(null);
  const [battle, setBattle] = useState<Battle>({
    result: null,
    player: [],
    enemy: [],
    seed: newSeed(),
  });

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
  // restarts itself on it. Rebuilding the Phaser game instead cost a new WebGL
  // context and a pass over the whole pack for what is only a cleared board.
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

  if (mode === "duel") {
    return (
      <main className="stage">
        <TrpcProvider>
          {room ? (
            <Room
              initial={room}
              onLeave={() => {
                setRoom(null);
                setMode("intro");
              }}
            />
          ) : (
            <Lobby onEnter={setRoom} onBack={() => setMode("intro")} />
          )}
        </TrpcProvider>
      </main>
    );
  }

  if (mode === "strategic") {
    return (
      <main className="stage">
        <GameCanvas
          key="strategic"
          start={(el) =>
            import("../game/StrategicScene").then(({ startStrategic }) =>
              startStrategic(el, {
                onMenu: () => setMode("intro"),
              }),
            )
          }
        />
      </main>
    );
  }

  if (mode === "intro") {
    return (
      <main className="stage">
        <GameCanvas
          // Distinct from the battle's, or React reconciles the two as one
          // component and the effect that builds the game never runs again.
          key="intro"
          start={(el) => import("../game/IntroScene").then(({ startIntro }) => startIntro(el))}
        >
          {/* The Warcraft menu: logo and stacked buttons over the scene, no
              panel art. Percent position and cqw sizes track the canvas. */}
          <div className="menu">
            <h1 className="menuTitle">GREYFALL</h1>
            {/* WC3 menu convention: one button style for every destination,
                hierarchy from order and the gold-ringed default, not hue. */}
            <button className="menuBtn primary" onClick={() => setMode("solo")}>
              Solo
            </button>
            <button className="menuBtn" onClick={() => setMode("duel")}>
              Duel
            </button>
            {/* In development: dimmed so it reads as not ready. */}
            <button className="menuBtn dev" onClick={() => setMode("strategic")}>
              Map
            </button>
          </div>
          <div className="credit">Developed by Nauqh</div>
        </GameCanvas>
      </main>
    );
  }

  return (
    <main className="stage">
      <GameCanvas
        // Constant across rounds: a rematch or a new army restarts the scene
        // inside the game that is already up, rather than building another.
        key="battle"
        start={(el) =>
          import("../game/BattleScene").then(({ startBattle }) =>
            startBattle(el, {
              result: battle.result,
              seed: battle.seed,
              onDraft: (army, seed) => draft(army, seed as number),
              onRematch: rematch,
              onNewArmy: newArmy,
              onMenu: () => {
                // A stale result would make the next Begin replay the old
                // battle; clear it so the scene opens in draft mode.
                armies.current = { player: [], enemy: [] };
                setBattle({ result: null, player: [], enemy: [], seed: newSeed() });
                setMode("intro");
              },
            }),
          )
        }
      />
    </main>
  );
}
