"use client";

import { AREAS, type AreaId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

/** The HUD shown or hidden: the H key or the corner button, remembered on this browser. */
export function useHud(): [boolean, () => void] {
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

export function HudToggle({ shown, toggle }: { shown: boolean; toggle: () => void }) {
  return (
    <button className="btn small hudToggle" type="button" onClick={toggle} aria-pressed={!shown} title="Show or hide the HUD (H)">
      {shown ? "Hide HUD" : "Show HUD"}
    </button>
  );
}

/** One area's own map, the camera kept inside it; its exits walk to the next. */
export function AreaView({ area }: { area: AreaId }) {
  const router = useRouter();
  const leave = (to: AreaId): void => router.push(`/atlas?focus=${to}`);
  const onExit = (to: AreaId): void => router.push(`/atlas/${to}`);
  const [reveal, setReveal] = useState(false);
  // The name mounts two painted frames after the clouds part, so its clock never runs while the first frames are still drawing.
  const hooks = useRef<AtlasHooks>({ area, onExit, onArea: () => {}, onTier: () => {}, ready: () => {}, opened: () => requestAnimationFrame(() => requestAnimationFrame(() => setReveal(true))) }).current;
  const [hud, toggleHud] = useHud();
  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <HudToggle shown={hud} toggle={toggleHud} />
        {reveal && (
          // The area's name as you arrive, after the Souls games: up out of the dark, held, gone.
          <div className="areaReveal" role="status" onAnimationEnd={(e) => e.target === e.currentTarget && setReveal(false)}>
            <span className="areaRevealName">{AREAS.find((a) => a.id === area)?.name}</span>
          </div>
        )}
        <div className="worldHud" hidden={!hud}>
          <header className="atlasTop">
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={() => leave(area)}>
                Back to the atlas
              </button>
            </div>
          </header>
        </div>
      </GameCanvas>
    </main>
  );
}
