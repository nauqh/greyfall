"use client";

// The map, opened from a bonfire over the area it was opened in: Aurum in three tiers and every bonfire
// on it, lit or not, listed by land. It opens on the whole tier; A/D turn the tier, W/S step through its bonfires and
// fly to each one's land, E travels to a lit one, Esc goes back to the fire.

import { AREAS, MAPPED_AREAS, TIERS, TIER_INFO, areaMap, districtOf, type AreaId, type TierId } from "@greyfall/engine";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";
import { useTick } from "../sound";
import { KeyHints } from "./SidePanel";

export type Fire = { area: AreaId; col: number; row: number; name: string; lit: boolean };

// Kept by the scene (AtlasScene's KINDLED and REST); a value import from it would pull Phaser into the server render.
const KINDLED = "greyfall.kindled";
const REST = "greyfall.rest";

const areaOf = (id: AreaId) => AREAS.find((a) => a.id === id)!;

/** Every bonfire in the Reach, in the atlas's order of areas, lit if rested at in this browser (or all of them in dev
 *  mode); a blocked store lights none. */
function checkpoints(dev: boolean): Fire[] {
  let lit = new Set<string>();
  try {
    lit = new Set(JSON.parse(localStorage.getItem(KINDLED) ?? "[]") as string[]);
  } catch {}
  return AREAS.filter((a) => MAPPED_AREAS.includes(a.id)).flatMap((a) => {
    const m = areaMap(a.id);
    return m.fires.map((f) => ({ area: a.id, col: f.col, row: f.row, name: districtOf(m, f.col, f.row)?.name || a.name, lit: dev || lit.has(`${a.id}:${f.col},${f.row}`) }));
  });
}

/** The bonfire last rested at, the one the map is opened from. */
function restedAt(): { area: AreaId; col: number; row: number } | null {
  try {
    return JSON.parse(localStorage.getItem(REST) ?? "null") as { area: AreaId; col: number; row: number } | null;
  } catch {
    return null;
  }
}

/** Opened at a bonfire in `from`, or anywhere with M to look (`travel` false): E on a lit bonfire travels to it;
 *  `onBack` closes the map. `dev` lights every bonfire and travels even when looking. */
export function TravelMap({ from, travel: atFire, dev = false, onTravel, onBack }: { from: AreaId; travel: boolean; dev?: boolean; onTravel: (f: Fire) => void; onBack: () => void }) {
  const canTravel = atFire || dev;
  const [fires] = useState(() => checkpoints(dev));
  const at = useMemo(restedAt, []);
  const isHere = (f: Fire): boolean => atFire && f.area === at?.area && f.col === at.col && f.row === at.row;
  // Nothing picked till W/S: the map opens on the whole tier.
  const [pick, setPick] = useState(-1);
  useTick(pick);
  const [tier, setTier] = useState<TierId>(areaOf(from).tier);
  const api = useRef<AtlasApi | null>(null);
  const panel = useRef<HTMLElement>(null);
  const onTier = (t: TierId) => fires.filter((f) => areaOf(f.area).tier === t);
  const tierLands = [...new Set(onTier(tier).map((f) => f.area))];

  const travel = (f: Fire): void => {
    if (!canTravel || !f.lit) return;
    if (isHere(f)) return onBack();
    try {
      localStorage.setItem(REST, JSON.stringify({ area: f.area, col: f.col, row: f.row }));
    } catch {}
    onTravel(f);
  };
  const pickFire = (i: number): void => {
    setPick(i);
    api.current?.select(fires[i]!.area);
  };
  // A new tier opens whole, nothing picked.
  const turnTier = (t: TierId): void => {
    setPick(-1);
    api.current?.tier(t);
  };
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => api.current?.select(id),
    onTier: setTier,
    // Only beside the list; on a narrow screen it lies over the top instead.
    inset: () => {
      const right = panel.current?.getBoundingClientRect().right ?? 0;
      return right < window.innerWidth / 2 ? right / window.innerWidth : 0;
    },
    ready: (a) => {
      api.current = a;
      a.tier(areaOf(from).tier);
    },
  }).current;

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "escape" || (k === "m" && !atFire)) return onBack();
      if (e.repeat) return;
      const steps = onTier(tier);
      if ((k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") && steps.length > 0) {
        const i = steps.indexOf(fires[pick]!);
        const next = i < 0 ? 0 : (i + (k === "w" || k === "arrowup" ? -1 : 1) + steps.length) % steps.length;
        pickFire(fires.indexOf(steps[next]!));
      } else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") {
        turnTier(TIERS[(TIERS.indexOf(tier) + (k === "a" || k === "arrowleft" ? -1 : 1) + TIERS.length) % TIERS.length]!);
      } else if (k === "e" || k === "enter") {
        const f = fires[pick];
        if (f && areaOf(f.area).tier === tier) travel(f);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <div className="travelMap">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          {/* After Elden Ring's sites of grace: the tiers as tabs over every bonfire on the tier, by land. */}
          <section ref={panel} className="sidePanel landPanel" aria-label="Bonfires">
            <div className="panelHead">
              <span className="panelName">Bonfires</span>
            </div>
            <div className="setModes" role="tablist" aria-label="Tiers">
              {TIERS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={t === tier} className={`setMode${t === tier ? " on" : ""}`} onClick={() => turnTier(t)}>
                  {TIER_INFO[t].name.replace(/^The /, "")}
                </button>
              ))}
            </div>
            <div className="pauseSheet">
              {tierLands.length > 0 ? (
                tierLands.map((id) => (
                  <section key={id} className="landGroup">
                    <h2>{areaOf(id).name}</h2>
                    <ul className="landFires">
                      {fires.map((f, i) =>
                        f.area !== id ? null : (
                          <li key={`${f.col},${f.row}`}>
                            <button
                              type="button"
                              ref={i === pick ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                              className={`landFire${i === pick ? " picked" : ""}`}
                              disabled={!f.lit}
                              onClick={() => (canTravel ? travel(f) : pickFire(i))}
                            >
                              <span>{f.name}</span>
                              <span className="landFireState">{!f.lit ? "Unlit" : isHere(f) ? "Here" : ""}</span>
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                ))
              ) : (
                <p className="landWhere">No bonfire burns here.</p>
              )}
            </div>
          </section>

          <KeyHints
            className="pauseKeys mapKeys"
            keys={`A/D tier   W/S bonfire${canTravel ? "   E travel" : ""}   ${atFire ? "Esc back" : "M/Esc close"}`}
          />
        </div>
      </GameCanvas>
    </div>
  );
}
