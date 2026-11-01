"use client";

import { AREAS, type AreaId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks, Departure } from "../../game/AtlasScene";
import { Clouds } from "../../game/Clouds";
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

/** A one-way drop is warned of once, on this browser; the warning is a convenience, so a blocked store just warns again. */
function warned(name: string): boolean {
  try {
    return localStorage.getItem(`greyfall.dropped.${name}`) === "1";
  } catch {
    return false;
  }
}

function markWarned(name: string): void {
  try {
    localStorage.setItem(`greyfall.dropped.${name}`, "1");
  } catch {}
}

/** One area's own map, the camera kept inside it; its exits cross to the next without leaving the page. */
export function AreaView({ area: first }: { area: AreaId }) {
  const router = useRouter();
  const [area, setArea] = useState(first);
  const [reveal, setReveal] = useState(false);
  const [travel, setTravel] = useState<(Departure & { phase: "cover" | "hold" | "uncover" }) | null>(null);
  const [warn, setWarn] = useState<Departure | null>(null);
  const api = useRef<AtlasApi | null>(null);
  const now = useRef({ area: first, cameFrom: undefined as AreaId | undefined, quiet: false, travelling: false });

  const depart = (d: Departure): void => {
    now.current.travelling = true;
    setTravel({ ...d, phase: "cover" });
  };
  // Covered: the scene rebuilds as the next area behind the cover, and the address follows quietly.
  const covered = (d: Departure): void => {
    const from = now.current.area;
    // Back into the area just left, the name is not announced again.
    now.current.quiet = d.to === now.current.cameFrom;
    now.current.cameFrom = from;
    now.current.area = d.to;
    setArea(d.to);
    setReveal(false);
    setTravel({ ...d, phase: "hold" });
    window.history.pushState(null, "", `/atlas/${d.to}?from=${from}`);
    api.current?.travel(d.to, from, d.kind);
  };
  // The name mounts two painted frames after the map is in view, so its clock never runs while the first frames are still drawing.
  const announce = (): void => {
    if (!now.current.quiet) requestAnimationFrame(() => requestAnimationFrame(() => setReveal(true)));
  };
  const hooks = useRef<AtlasHooks>({
    area: first,
    onExit: (d) => {
      if (now.current.travelling) return;
      if (d.kind === "fall" && !warned(d.name)) setWarn(d);
      else depart(d);
    },
    onArea: () => {},
    onTier: () => {},
    ready: (a) => (api.current = a),
    opened: () => {
      if (now.current.travelling) setTravel((t) => (t ? { ...t, phase: "uncover" } : t));
      else announce();
    },
  }).current;
  const [hud, toggleHud] = useHud();
  const name = AREAS.find((a) => a.id === area)?.name;
  return (
    <main className="stage">
      <GameCanvas
        start={(el) => {
          // Arrived by a link with ?from=: the map opens at the exit back there.
          hooks.from = (new URLSearchParams(window.location.search).get("from") as AreaId | null) ?? undefined;
          return import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks));
        }}
      >
        <HudToggle shown={hud} toggle={toggleHud} />
        {reveal && (
          // The area's name as you arrive, after the Souls games: up out of the dark, held, gone.
          <div key={area} className="areaReveal" role="status" onAnimationEnd={(e) => e.target === e.currentTarget && setReveal(false)}>
            <span className="areaRevealName">{name}</span>
          </div>
        )}
        {travel?.kind === "walk" && (
          // Walking out: the game's own cloud bank draws in, holds while the next map is built, and parts on it.
          <div className="travel travelClouds">
            <Clouds
              key={travel.phase}
              mode={travel.phase === "cover" ? "close" : travel.phase === "hold" ? "cover" : "open"}
              onDone={() => {
                if (travel.phase === "cover") covered(travel);
                else if (travel.phase === "uncover") {
                  setTravel(null);
                  now.current.travelling = false;
                  announce();
                }
              }}
            />
          </div>
        )}
        {travel && travel.kind !== "walk" && (
          // The crossing's own cover: a fall, a ride or a stair, held while the next map is built.
          <div
            className={`travel travel-${travel.kind} travel-${travel.dir} travel-${travel.phase}`}
            style={{ "--x": `${travel.x * 100}%`, "--y": `${travel.y * 100}%` } as React.CSSProperties}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              if (travel.phase === "cover") covered(travel);
              else if (travel.phase === "uncover") {
                setTravel(null);
                now.current.travelling = false;
                announce();
              }
            }}
          />
        )}
        {warn && (
          <div className="dropWarn" role="alertdialog" aria-modal="true" aria-labelledby="dropWarnText">
            <div className="paper dropWarnCard">
              <p id="dropWarnText">
                <b>{warn.name}</b>: a drop. There&apos;s no climbing back.
              </p>
              <div className="dropWarnActions">
                <button
                  className="btn small"
                  type="button"
                  autoFocus
                  onClick={() => {
                    markWarned(warn.name);
                    setWarn(null);
                    depart(warn);
                  }}
                >
                  Drop
                </button>
                <button className="btn small" type="button" onClick={() => setWarn(null)}>
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="worldHud" hidden={!hud}>
          <header className="atlasTop">
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={() => router.push(`/atlas?focus=${area}`)}>
                Back to the atlas
              </button>
            </div>
          </header>
        </div>
      </GameCanvas>
    </main>
  );
}
