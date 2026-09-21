"use client";

// The Phase 1 battle prototype, all in the browser: pick an army within the
// budget, place it on your own 5x3 half, watch the engine's event log play
// back. Your army fights from the near half of the board, the AI's from the
// far half, the way an autobattler reads.
//
// The draft screen is DOM rather than canvas because clicking cells and
// dragging a roster around is what the DOM is good at, but it is dressed in
// the same Tiny Swords art as the battle: the panels and buttons are the
// pack's nine-slices, composed to contiguous images at runtime (see
// ui.ts/nineSliceDataUrl - the pack ships them with gaps, which CSS
// border-image cannot read), the cells are the pack's grass, and the units
// standing on them are frame 0 of the same idle sheets the battle animates.
//
// Phaser loads client-side only, inside an effect, per the PRD.

import {
  BALANCE,
  UNIT_CLASSES,
  armyCost,
  generateArmy,
  simulate,
  validateArmy,
} from "@greyfall/engine";
import type { BattleResult, Placement, UnitClass } from "@greyfall/engine";
import { useCallback, useEffect, useRef, useState } from "react";

import { AVATARS, packUrl } from "../game/art";
import { BODY, sheetUrl } from "../game/sprites";

const ROSTER = UNIT_CLASSES.filter((c) => c !== "pawn");

const LABELS: Record<UnitClass, string> = {
  pawn: "Pawn",
  warrior: "Warrior",
  lancer: "Lancer",
  archer: "Archer",
  monk: "Monk",
};

const BLURB: Record<UnitClass, string> = {
  pawn: "Digs. Dies.",
  warrior: "Cuts down archers.",
  lancer: "Holds. Breaks warriors.",
  archer: "Reaches three cells.",
  monk: "Mends the worst hurt.",
};

/** A portrait per class, from the pack's 25 avatars. */
const PORTRAIT: Record<UnitClass, number> = { warrior: 2, lancer: 7, archer: 12, monk: 20, pawn: 1 };

interface Battle {
  result: BattleResult;
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

/**
 * Compose the pack's gapped nine-slice sheets into data URLs and hand them to
 * CSS as custom properties. Done once, on mount.
 */
function usePackSkin(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { nineSliceDataUrl } = await import("../game/ui");
      const names = ["paper", "specialPaper", "woodTable", "banner", "blueButton", "redButton"] as const;
      const skins = await Promise.all(names.map((n) => nineSliceDataUrl(n)));
      if (cancelled) return;
      const root = document.documentElement;
      for (const [i, name] of names.entries()) {
        root.style.setProperty(`--${name}`, `url("${skins[i]!.url}")`);
        root.style.setProperty(`--${name}-slice`, skins[i]!.slice);
      }
      // CSS cannot read an env var, and url() will not concatenate with a
      // custom property, so the three pack images the stylesheet needs are
      // handed over whole. That keeps packUrl the only place a base lives.
      for (const [name, file] of [
        ["pack-water", "Terrain/Tileset/Water Background color.png"],
        ["pack-coin", "Terrain/Resources/Gold/Gold Resource/Gold_Resource.png"],
        ["pack-grass", "grass_tile.png"],
      ] as const) {
        root.style.setProperty(`--${name}`, `url("${packUrl(file)}")`);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export default function Page() {
  const [army, setArmy] = useState<Placement[]>([]);
  const [picked, setPicked] = useState<UnitClass>("warrior");
  const [battle, setBattle] = useState<Battle | null>(null);
  const skinned = usePackSkin();

  const gold = BALANCE.budget - armyCost(army);
  const errors = validateArmy(army);

  const place = useCallback(
    (col: number, row: number) => {
      setArmy((prev) => {
        const existing = prev.find((p) => p.col === col && p.row === row);
        if (existing) return prev.filter((p) => p !== existing);
        const next = [...prev, { class: picked, col, row }];
        return armyCost(next) > BALANCE.budget ? prev : next;
      });
    },
    [picked],
  );

  function fight(): void {
    const seed = newSeed();
    const enemy = generateArmy(BALANCE.budget, seed);
    setBattle({ result: simulate(army, enemy, seed), player: army, enemy, seed, id: 1 });
  }

  const rematch = useCallback(() => {
    setBattle((b) => {
      if (!b) return b;
      const seed = newSeed();
      return { ...b, result: simulate(b.player, b.enemy, seed), seed, id: b.id + 1 };
    });
  }, []);

  const newArmy = useCallback(() => setBattle(null), []);

  if (battle) {
    return (
      <main className="stage">
        <BattleView battle={battle} onRematch={rematch} onNewArmy={newArmy} />
      </main>
    );
  }

  return (
    <main className={`draft${skinned ? " skinned" : ""}`}>
      <h1 className="banner">GREYFALL</h1>
      <p className="tagline">
        The Greying has taken the land. Spend {BALANCE.budget} gold, hold the line.
      </p>

      <div className="roster">
        {ROSTER.map((cls) => {
          const stats = BALANCE.units[cls];
          const affordable = stats.cost <= gold;
          return (
            <button
              key={cls}
              type="button"
              className={`card${picked === cls ? " selected" : ""}${affordable ? "" : " broke"}`}
              onClick={() => setPicked(cls)}
            >
              <span
                className="portrait"
                style={{
                  backgroundImage: `url("${packUrl(`${AVATARS.file}${String(PORTRAIT[cls]).padStart(2, "0")}.png`)}")`,
                }}
              />
              <span className="name">{LABELS[cls]}</span>
              <span className="blurb">{BLURB[cls]}</span>
              <span className="stats">
                {stats.hp} hp · {stats.damage} dmg
              </span>
              <span className="stats">range {stats.range}</span>
              <span className="cost">
                <i className="coin" />
                {stats.cost}
              </span>
            </button>
          );
        })}
      </div>

      <div className="purse">
        <i className="coin" />
        <strong>{gold}</strong> gold left · {army.length}/{BALANCE.board.maxUnits} units
        <span className="hint">
          click a cell to place {LABELS[picked]}, click it again to take it back
        </span>
      </div>

      {/* The player's own 5x3 half, front row at the top where it will face
          the enemy: own row r sits on battle row 5 - r. */}
      <div className="board">
        {Array.from({ length: BALANCE.board.rows }, (_, d) => {
          const row = BALANCE.board.rows - 1 - d; // front row first
          return (
            <div key={row} className="boardRow">
              {Array.from({ length: BALANCE.board.cols }, (_, col) => {
                const unit = army.find((p) => p.col === col && p.row === row);
                return (
                  <div
                    key={`${col},${row}`}
                    className="cell"
                    onClick={() => place(col, row)}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      unit ? `${LABELS[unit.class]} at ${col},${row}` : `empty cell ${col},${row}`
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") place(col, row);
                    }}
                  >
                    <span className="tile" />
                    {unit && (
                      <span className="pawnwrap">
                        <span
                          className="pawnart"
                          style={{
                            width: BODY[unit.class].frame,
                            height: BODY[unit.class].frame,
                            left: BODY[unit.class].anchorX * -0.5,
                            top: BODY[unit.class].anchorY * -0.5,
                            backgroundImage: `url("${sheetUrl("a", unit.class)}")`,
                          }}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {errors.length > 0 && <p className="error">{errors[0]}</p>}
      <div className="actions">
        <button className="btn blue" disabled={errors.length > 0} onClick={fight}>
          To battle
        </button>
        <button className="btn red" disabled={army.length === 0} onClick={() => setArmy([])}>
          Clear
        </button>
      </div>
    </main>
  );
}

function BattleView({
  battle,
  onRematch,
  onNewArmy,
}: {
  battle: Battle;
  onRematch: () => void;
  onNewArmy: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onRematch, onNewArmy });
  handlers.current = { onRematch, onNewArmy };

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let game: { destroy: () => void } | null = null;

    // Phaser must never run on the server, so it is imported inside the
    // effect: the PRD's "loaded with ssr: false" without a second bundle.
    void import("../game/BattleScene").then(({ startBattle, GAME_W, GAME_H }) => {
      if (cancelled) return;
      // The scene owns the board's proportions, so the holder takes its shape
      // from there. Hardcoding it in CSS means Phaser's FIT letterboxes into a
      // wrongly shaped box every time the layout changes.
      el.style.aspectRatio = `${GAME_W} / ${GAME_H}`;
      // Cap the width by what the viewport height allows at that ratio, or a
      // short viewport clamps the height only and FIT letterboxes the sides.
      el.style.maxWidth = `min(1180px, calc((100vh - 28px) * ${GAME_W} / ${GAME_H}))`;
      game = startBattle(el, {
        result: battle.result,
        seed: battle.seed,
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
