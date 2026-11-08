"use client";

// The map, opened from a bonfire over the area it was opened in, after Dark Souls 3 and Elden Ring: the Shattered
// Reach in three tiers, the selected area's card over it listing the bonfires lit there. W/S steps through every lit
// bonfire, A/D through the tiers, E travels, Esc goes back to the fire.

import { AREAS, TIERS, TIER_INFO, areaMap, atlasMap, districtOf, type AreaId, type TierId } from "@greyfall/engine";
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

/** Opened at a bonfire in `from`; `onTravel` once a fire is chosen (the rest point already moved to it), `onBack` to sit on. */
export function TravelMap({ from, onTravel, onBack }: { from: AreaId; onTravel: (f: Fire) => void; onBack: () => void }) {
  const [fires] = useState(kindled);
  const at = useMemo(restedAt, []);
  const [pick, setPick] = useState(() => Math.max(0, fires.findIndex((f) => f.area === at?.area && f.col === at.col && f.row === at.row)));
  const [area, setArea] = useState<AreaId>(fires[pick]?.area ?? from);
  const [tier, setTier] = useState<TierId>(AREAS.find((a) => a.id === area)!.tier);
  const map = useMemo(() => atlasMap(), []);
  const api = useRef<AtlasApi | null>(null);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => {
      setArea(id);
      const first = fires.findIndex((f) => f.area === id);
      if (first >= 0) setPick(first);
    },
    onTier: setTier,
    ready: (a) => {
      api.current = a;
      a.focus(area);
    },
  }).current;

  const travel = (f: Fire): void => {
    if (f.area === at?.area && f.col === at.col && f.row === at.row) return onBack();
    try {
      localStorage.setItem(REST, JSON.stringify({ area: f.area, col: f.col, row: f.row }));
    } catch {}
    onTravel(f);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "escape") return onBack();
      if (e.repeat) return;
      if ((k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") && fires.length > 0) {
        const next = (pick + (k === "w" || k === "arrowup" ? -1 : 1) + fires.length) % fires.length;
        setPick(next);
        setArea(fires[next]!.area);
        api.current?.focus(fires[next]!.area);
      } else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") {
        api.current?.tier(TIERS[(TIERS.indexOf(tier) + (k === "a" || k === "arrowleft" ? -1 : 1) + TIERS.length) % TIERS.length]!);
      } else if ((k === "e" || k === "enter") && fires[pick]) travel(fires[pick]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const shown = AREAS.find((a) => a.id === area)!;
  const bosses = map.tiers[shown.tier].bosses.filter((b) => b.area === area);
  const here = fires.filter((f) => f.area === area);

  return (
    <div className="travelMap">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
            <span className="talkNext">{TIER_INFO[tier].name}</span>
          </header>

          <section className="paper atlasCard">
            <h2>{shown.name}</h2>
            <p className="atlasWhere">{TIER_INFO[shown.tier].name}</p>
            <p className="lore">{shown.blurb}</p>
            {here.length > 0 ? (
              <div className="atlasFires">
                {here.map((f) => (
                  <button key={`${f.col},${f.row}`} className={`btn small${f === fires[pick] ? " red" : ""}`} type="button" onClick={() => travel(f)}>
                    {f.name}
                    {f.area === at?.area && f.col === at.col && f.row === at.row && " (here)"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="atlasWhere">No bonfire lit here yet.</p>
            )}
            {bosses.length > 0 && (
              <p>
                <b>Keeper:</b> {bosses.map((b) => b.name).join(", ")}
              </p>
            )}
            <button className="btn small" type="button" onClick={onBack}>
              Back to the bonfire
            </button>
            <span className="talkNext" aria-hidden="true">
              W/S bonfire, A/D tier, E travel, Esc back
            </span>
          </section>
        </div>
      </GameCanvas>
    </div>
  );
}
