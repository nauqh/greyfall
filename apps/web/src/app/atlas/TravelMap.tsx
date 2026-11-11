"use client";

// The map, opened from a bonfire over the area it was opened in: the Shattered Reach in three tiers and its lit
// bonfires. A click travels to one; W/S steps through them, A/D through the tiers, E travels, Esc goes back to the fire.

import { AREAS, TIERS, TIER_INFO, areaMap, districtOf, type AreaId, type TierId } from "@greyfall/engine";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

export type Fire = { area: AreaId; col: number; row: number; name: string };

// Kept by the scene (AtlasScene's KINDLED and REST); a value import from it would pull Phaser into the server render.
const KINDLED = "greyfall.kindled";
const REST = "greyfall.rest";

/** The bonfires rested at, read from this browser, in the atlas's order of areas; a blocked store lists none. */
function kindled(): Fire[] {
  try {
    return (JSON.parse(localStorage.getItem(KINDLED) ?? "[]") as string[])
      .flatMap((k) => {
        const [area, at] = k.split(":") as [AreaId, string];
        const [col, row] = at.split(",").map(Number) as [number, number];
        const m = areaMap(area);
        if (!m.fires.some((f) => f.col === col && f.row === row)) return [];
        return [{ area, col, row, name: districtOf(m, col, row)?.name || AREAS.find((a) => a.id === area)!.name }];
      })
      .sort((a, b) => AREAS.findIndex((x) => x.id === a.area) - AREAS.findIndex((x) => x.id === b.area));
  } catch {
    return [];
  }
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
  const [fires] = useState(kindled);
  const at = useMemo(restedAt, []);
  const isHere = (f: Fire): boolean => canTravel && f.area === at?.area && f.col === at.col && f.row === at.row;
  const [pick, setPick] = useState(() => {
    const sat = fires.findIndex(isHere);
    return sat >= 0 ? sat : Math.max(0, fires.findIndex((f) => f.area === from));
  });
  const [tier, setTier] = useState<TierId>(AREAS.find((a) => a.id === (fires[pick]?.area ?? from))!.tier);
  const api = useRef<AtlasApi | null>(null);
  const marks = fires.map((f) => ({ ...f, here: isHere(f) }));
  const travel = (f: Fire): void => {
    if (!canTravel) return;
    if (isHere(f)) return onBack();
    try {
      localStorage.setItem(REST, JSON.stringify({ area: f.area, col: f.col, row: f.row }));
    } catch {}
    onTravel(f);
  };
  const hooks = useRef<AtlasHooks>({
    onArea: () => {},
    onTier: setTier,
    // A click on a bonfire is the map's one action: from a fire it travels, looking it only rings and names it.
    onFire: (i) => (canTravel && fires[i] ? travel(fires[i]) : setPick(i)),
    ready: (a) => {
      api.current = a;
      if (fires.length > 0) a.fires(marks, pick);
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
      if ((k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") && fires.length > 0) {
        setPick((pick + (k === "w" || k === "arrowup" ? -1 : 1) + fires.length) % fires.length);
      } else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") {
        api.current?.tier(TIERS[(TIERS.indexOf(tier) + (k === "a" || k === "arrowleft" ? -1 : 1) + TIERS.length) % TIERS.length]!);
      } else if ((k === "e" || k === "enter") && fires[pick]) travel(fires[pick]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

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
                  {fires.some((f) => AREAS.find((a) => a.id === f.area)!.tier === t) && " •"}
                </button>
              ))}
            </nav>
          </header>

          <button className="btn small mapClose" type="button" onClick={onBack}>
            {canTravel ? "Back to the bonfire" : "Close the map"}
          </button>
        </div>
      </GameCanvas>
    </div>
  );
}
