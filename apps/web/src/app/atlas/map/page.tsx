"use client";

// The map, opened from a bonfire, after Dark Souls 3 and Elden Ring: the Shattered Reach in three tiers, the selected
// area's card over it listing the bonfires lit there, each a place to travel to. Lifts change tier.

import { AREAS, TIER_INFO, areaMap, atlasMap, districtOf, type AreaId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";

import type { AtlasHooks } from "../../../game/AtlasScene";
import { GameCanvas } from "../../../game/GameCanvas";

type Fire = { area: AreaId; col: number; row: number; name: string };

// Kept by the scene (AtlasScene's KINDLED and REST); a value import from it would pull Phaser into the server render.
const KINDLED = "greyfall.kindled";
const REST = "greyfall.rest";

/** The bonfires rested at, read from this browser; a blocked store lists none. */
function kindled(): Fire[] {
  try {
    return (JSON.parse(localStorage.getItem(KINDLED) ?? "[]") as string[]).flatMap((k) => {
      const [area, at] = k.split(":") as [AreaId, string];
      const [col, row] = at.split(",").map(Number) as [number, number];
      const m = areaMap(area);
      if (!m.fires.some((f) => f.col === col && f.row === row)) return [];
      return [{ area, col, row, name: districtOf(m, col, row)?.name || AREAS.find((a) => a.id === area)!.name }];
    });
  } catch {
    return [];
  }
}

export default function MapPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const router = useRouter();
  // ?from= is the area of the bonfire the map was opened at, where it opens and where Back returns.
  const { from: asked } = use(searchParams);
  const from = AREAS.find((a) => a.id === asked)?.id ?? "landing";
  const [area, setArea] = useState<AreaId>(from);
  const [fires, setFires] = useState<Fire[]>([]);
  useEffect(() => setFires(kindled()), []);
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    onTier: () => {},
    ready: (a) => a.focus(from),
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const bosses = map.tiers[shown.tier].bosses.filter((b) => b.area === area);
  const here = fires.filter((f) => f.area === area);
  const travel = (f: Fire): void => {
    try {
      localStorage.setItem(REST, JSON.stringify({ area: f.area, col: f.col, row: f.row }));
    } catch {}
    router.push(`/atlas/${f.area}?rest=1`);
  };

  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
          </header>

          <section className="paper atlasCard">
            <h2>{shown.name}</h2>
            <p className="atlasWhere">{TIER_INFO[shown.tier].name}</p>
            <p className="lore">{shown.blurb}</p>
            {here.length > 0 ? (
              <div className="atlasFires">
                {here.map((f) => (
                  <button key={`${f.col},${f.row}`} className="btn small" type="button" onClick={() => travel(f)}>
                    {f.name}
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
            <button className="btn small" type="button" onClick={() => router.push(`/atlas/${from}?rest=1`)}>
              Back to the bonfire
            </button>
          </section>
        </div>
      </GameCanvas>
    </main>
  );
}
