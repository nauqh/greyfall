"use client";

// The map, opened from a bonfire over the area it was opened in: the Shattered Reach in three tiers and every bonfire
// on it, lit or not. A click on a land opens its panel; a lit bonfire travels. W/S steps through the land's bonfires,
// A/D through the tiers, E travels, Esc goes back to the fire.

import { AREAS, MAPPED_AREAS, TIERS, TIER_INFO, areaMap, districtOf, type AreaId, type TierId } from "@greyfall/engine";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

export type Fire = { area: AreaId; col: number; row: number; name: string; lit: boolean };

// Kept by the scene (AtlasScene's KINDLED and REST); a value import from it would pull Phaser into the server render.
const KINDLED = "greyfall.kindled";
const REST = "greyfall.rest";

const areaOf = (id: AreaId) => AREAS.find((a) => a.id === id)!;

/** Every bonfire in the Reach, in the atlas's order of areas, lit if rested at in this browser; a blocked store lights none. */
function checkpoints(): Fire[] {
  let lit = new Set<string>();
  try {
    lit = new Set(JSON.parse(localStorage.getItem(KINDLED) ?? "[]") as string[]);
  } catch {}
  return AREAS.filter((a) => MAPPED_AREAS.includes(a.id)).flatMap((a) => {
    const m = areaMap(a.id);
    return m.fires.map((f) => ({ area: a.id, col: f.col, row: f.row, name: districtOf(m, f.col, f.row)?.name || a.name, lit: lit.has(`${a.id}:${f.col},${f.row}`) }));
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

/** Opened at a bonfire in `from`, or anywhere with M to look (`travel` false): a click on a lit bonfire travels to it
 *  (or, looking, rings and names it); `onBack` closes the map. */
export function TravelMap({ from, travel: canTravel, onTravel, onBack }: { from: AreaId; travel: boolean; onTravel: (f: Fire) => void; onBack: () => void }) {
  const [fires] = useState(checkpoints);
  const at = useMemo(restedAt, []);
  const isHere = (f: Fire): boolean => canTravel && f.area === at?.area && f.col === at.col && f.row === at.row;
  const [pick, setPick] = useState(() => {
    const sat = fires.findIndex(isHere);
    return sat >= 0 ? sat : Math.max(0, fires.findIndex((f) => f.area === from && f.lit));
  });
  const [selected, setSelected] = useState<AreaId | null>(fires[pick]?.area ?? from);
  const [tier, setTier] = useState<TierId>(areaOf(selected ?? from).tier);
  const api = useRef<AtlasApi | null>(null);
  const marks = fires.map((f) => ({ ...f, here: isHere(f) }));
  const litAreas = useMemo(() => new Set(fires.filter((f) => f.lit).map((f) => f.area)), [fires]);
  const land = selected ? areaOf(selected) : null;
  const landFires = fires.filter((f) => f.area === selected);
  // W/S walk the open land's bonfires, or every lit one with no land open.
  const steps = landFires.length > 0 ? landFires : fires.filter((f) => f.lit);

  const choose = (id: AreaId): void => {
    setSelected(id);
    api.current?.select(id);
  };
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
    if (fires[i]!.area !== selected) choose(fires[i]!.area);
  };
  // The scene's hooks are made once; they reach the current render's handlers through this.
  const live = useRef({ choose, travel, pickFire });
  live.current = { choose, travel, pickFire };
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => live.current.choose(id),
    onTier: setTier,
    // From a fire a lit bonfire travels; an unlit one, or any while looking, is only rung and named.
    onFire: (i) => (canTravel && fires[i]?.lit ? live.current.travel(fires[i]) : live.current.pickFire(i)),
    ready: (a) => {
      api.current = a;
      if (fires.length > 0) a.fires(marks, pick);
      if (selected) a.select(selected);
      else a.focus(from);
    },
  }).current;
  useEffect(() => {
    if (fires.length > 0) api.current?.fires(marks, pick);
    // The marks only move with the pick; `marks` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "escape" || (k === "m" && !canTravel)) return onBack();
      if (e.repeat) return;
      if ((k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") && steps.length > 0) {
        const i = steps.indexOf(fires[pick]!);
        const next = i < 0 ? 0 : (i + (k === "w" || k === "arrowup" ? -1 : 1) + steps.length) % steps.length;
        pickFire(fires.indexOf(steps[next]!));
      } else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") {
        api.current?.tier(TIERS[(TIERS.indexOf(tier) + (k === "a" || k === "arrowleft" ? -1 : 1) + TIERS.length) % TIERS.length]!);
      } else if ((k === "e" || k === "enter") && fires[pick]) travel(fires[pick]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const keepers = land && MAPPED_AREAS.includes(land.id) ? areaMap(land.id).bosses.map((b) => b.name) : [];

  return (
    <div className="travelMap">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
            {/* The tiers, after Elden Ring's underground toggle; a dot where a bonfire is lit. */}
            <nav className="worldLinks">
              {TIERS.map((t) => (
                <button key={t} className="linkBtn tierTab" type="button" aria-pressed={t === tier} onClick={() => api.current?.tier(t)}>
                  {TIER_INFO[t].name}
                  {AREAS.some((a) => a.tier === t && litAreas.has(a.id)) && " •"}
                </button>
              ))}
            </nav>
          </header>

          {land && (
            <section className="paper landPanel" aria-label={land.name}>
              <h2>{land.name}</h2>
              <p className="landWhere">{TIER_INFO[land.tier].name}</p>
              <p className="landLore">{land.blurb}</p>
              {keepers.length > 0 && (
                <p>
                  <b>Keeper:</b> {keepers.join(", ")}
                </p>
              )}
              {landFires.length > 0 ? (
                <ul className="landFires">
                  {landFires.map((f) => (
                    <li key={`${f.col},${f.row}`}>
                      <button
                        type="button"
                        className={`landFire${f === fires[pick] ? " picked" : ""}`}
                        disabled={!f.lit}
                        onClick={() => (canTravel ? travel(f) : pickFire(fires.indexOf(f)))}
                      >
                        <span>{f.name}</span>
                        <span className="landFireState">{!f.lit ? "Unlit" : isHere(f) ? "Here" : canTravel ? "Travel" : "Lit"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="landWhere">No bonfire burns here.</p>
              )}
            </section>
          )}

          <button className="btn small mapClose" type="button" onClick={onBack}>
            {canTravel ? "Back to the bonfire" : "Close the map"}
          </button>
        </div>
      </GameCanvas>
    </div>
  );
}
