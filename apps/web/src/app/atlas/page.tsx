"use client";

// The Atlas: the Shattered Reach in three tiers, to look round. The map is
// the canvas; the selected area's card floats over it on the kit's paper,
// and the whole HUD hides with H. Lifts change tier.

import { AREAS, TIER_INFO, atlasMap, type AreaId } from "@greyfall/engine";
import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";

import type { AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";
import { HudToggle, useHud } from "./views";

export default function AtlasPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  // ?focus= is the area to open on, as when coming back from an area's map.
  const { focus: asked } = use(searchParams);
  const focus = AREAS.find((a) => a.id === asked)?.id;
  const [hud, toggleHud] = useHud();
  const [area, setArea] = useState<AreaId>(focus ?? "harbour");
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    onTier: () => {},
    ready: (a) => {
      if (focus) a.focus(focus);
    },
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const home = map.tiers[shown.tier];
  const bosses = home.bosses.filter((b) => b.area === area);

  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <HudToggle shown={hud} toggle={toggleHud} />
        <div className="worldHud" hidden={!hud}>
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
          </header>

          <section className="paper atlasCard">
            <h2>{shown.name}</h2>
            <p className="atlasWhere">{TIER_INFO[shown.tier].name}</p>
            <p className="lore">{shown.blurb}</p>
            <Link className="btn small" href={`/atlas/${area}`}>
              Enter
            </Link>
            {bosses.length > 0 && (
              <p>
                <b>Keeper:</b> {bosses.map((b) => b.name).join(", ")}
              </p>
            )}
          </section>
        </div>
      </GameCanvas>
    </main>
  );
}
