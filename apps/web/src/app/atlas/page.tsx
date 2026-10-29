"use client";

// The Atlas: the Shattered Reach in three tiers, to look round. The map is
// the canvas; the selected area's card floats over it on the kit's paper,
// and the whole HUD hides with H. Lifts change tier.

import { AREAS, MAPPED_AREAS, TIER_INFO, atlasMap, type AreaId } from "@greyfall/engine";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

/** The HUD shown or hidden: the H key or the corner button, remembered on this browser. */
function useHud(): [boolean, () => void] {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("greyfall.hud") === "hidden") setShown(false);
    } catch {}
  }, []);
  const toggle = (): void =>
    setShown((s) => {
      try {
        localStorage.setItem("greyfall.hud", s ? "hidden" : "shown");
      } catch {}
      return !s;
    });
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === "h" && !(e.target instanceof HTMLInputElement)) toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return [shown, toggle];
}

function HudToggle({ shown, toggle }: { shown: boolean; toggle: () => void }) {
  return (
    <button className="btn small hudToggle" type="button" onClick={toggle} aria-pressed={!shown} title="Show or hide the HUD (H)">
      {shown ? "Hide HUD" : "Show HUD"}
    </button>
  );
}

/** One area's own map, the camera kept inside it; its exits walk to the next. */
function AreaView({ area, onExit, onLeave }: { area: AreaId; onExit: (to: AreaId) => void; onLeave: () => void }) {
  const hooks = useRef<AtlasHooks>({ area, onExit, onArea: () => {}, onTier: () => {}, ready: () => {} }).current;
  const [hud, toggleHud] = useHud();
  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <HudToggle shown={hud} toggle={toggleHud} />
        <div className="worldHud" hidden={!hud}>
          <header className="atlasTop">
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={onLeave}>
                Back to the atlas
              </button>
            </div>
          </header>
        </div>
      </GameCanvas>
    </main>
  );
}

export default function AtlasPage() {
  const [hud, toggleHud] = useHud();
  const [walk, setWalk] = useState<AreaId | null>(null);
  const [area, setArea] = useState<AreaId>("harbour");
  // The area to fly to when the atlas comes back from an area's map.
  const back = useRef<AreaId | null>(null);
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    onTier: () => {},
    ready: (a) => {
      if (back.current) a.focus(back.current);
    },
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const home = map.tiers[shown.tier];
  const bosses = home.bosses.filter((b) => b.area === area);

  if (walk) {
    // An exit to an area not yet mapped returns to the atlas, on that area's card.
    const leave = (to: AreaId) => ((back.current = to), setArea(to), setWalk(null));
    const go = (to: AreaId) => (MAPPED_AREAS.includes(to) ? setWalk(to) : leave(to));
    return <AreaView key={walk} area={walk} onExit={go} onLeave={() => leave(walk)} />;
  }

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
            {MAPPED_AREAS.includes(area) && (
              <button className="btn small" type="button" onClick={() => setWalk(area)}>
                Enter
              </button>
            )}
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
