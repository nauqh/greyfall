"use client";

import { AREAS, type AreaId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks, BandView, Departure, MenuView, Say } from "../../game/AtlasScene";
import { Clouds } from "../../game/Clouds";
import { packUrl } from "../../game/art";
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
  // The name up out of the dark: the area's as you arrive, a quarter's as you walk into it.
  const [reveal, setReveal] = useState<string | null>(null);
  const [travel, setTravel] = useState<(Departure & { phase: "cover" | "hold" | "uncover" }) | null>(null);
  const [warn, setWarn] = useState<Departure | null>(null);
  const [say, setSay] = useState<Say | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [flasks, setFlasks] = useState<number | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  const [band, setBand] = useState<BandView | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);
  // Died: the words, then the dark, then waking at the bonfire in this area.
  const [died, setDied] = useState<AreaId | null>(null);
  const api = useRef<AtlasApi | null>(null);
  const now = useRef({ area: first, cameFrom: undefined as AreaId | undefined, quiet: false, travelling: false });

  const depart = (d: Departure): void => {
    now.current.travelling = true;
    setTravel({ ...d, phase: "cover" });
  };
  // A rest, or waking after a death: the dark comes down, and the captain wakes at the bonfire.
  const wake = (to: AreaId): void => depart({ to, name: "", kind: "rest", dir: "down", x: 0.5, y: 0.5 });
  // Covered: the scene rebuilds as the next area behind the cover, and the address follows quietly.
  const covered = (d: Departure): void => {
    const from = now.current.area;
    const rest = d.kind === "rest";
    // Back into the area just left, or woken at a bonfire, the name is not announced again.
    now.current.quiet = rest || d.to === now.current.cameFrom;
    now.current.cameFrom = rest ? undefined : from;
    now.current.area = d.to;
    setArea(d.to);
    setReveal(null);
    setDied(null);
    setSay(null);
    setMenu(null);
    setNear(null);
    setTravel({ ...d, phase: "hold" });
    window.history.pushState(null, "", rest ? `/atlas/${d.to}` : `/atlas/${d.to}?from=${from}`);
    api.current?.travel(d.to, from, d.kind);
  };
  // The name mounts two painted frames after the map is in view, so its clock never runs while the first frames are still drawing.
  const announce = (): void => {
    if (!now.current.quiet) requestAnimationFrame(() => requestAnimationFrame(() => setReveal(AREAS.find((a) => a.id === now.current.area)?.name ?? null)));
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
    onSay: setSay,
    onNear: setNear,
    onFlasks: setFlasks,
    onGold: setGold,
    onBand: setBand,
    onMenu: setMenu,
    onRest: (to) => !now.current.travelling && wake(to),
    onDeath: (to) => {
      if (now.current.travelling) return;
      setReveal(null);
      setDied(to);
    },
    onDistrict: (d) => !now.current.travelling && setReveal(d),
    opened: () => {
      if (now.current.travelling) setTravel((t) => (t ? { ...t, phase: "uncover" } : t));
      else announce();
    },
  }).current;
  // The HUD hides with H; there is no button for it on an area map.
  const [hud] = useHud();
  // Dev mode: the camera free over the whole map, remembered on this browser; the backquote key toggles it.
  const [dev, setDev] = useState(false);
  const toggleDev = (): void =>
    setDev((on) => {
      try {
        localStorage.setItem("greyfall.dev", on ? "0" : "1");
      } catch {}
      api.current?.dev(!on);
      return !on;
    });
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === "`" && !(e.target instanceof HTMLInputElement)) toggleDev();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="stage">
      <GameCanvas
        start={(el) => {
          // Arrived by a link with ?from=: the map opens at the exit back there.
          hooks.from = (new URLSearchParams(window.location.search).get("from") as AreaId | null) ?? undefined;
          try {
            hooks.dev = localStorage.getItem("greyfall.dev") === "1";
          } catch {}
          setDev(!!hooks.dev);
          return import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks));
        }}
      >
        {reveal && (
          // After the Souls games: up out of the dark, held, gone.
          <div key={reveal} className="areaReveal" role="status" onAnimationEnd={(e) => e.target === e.currentTarget && setReveal(null)}>
            <span className="areaRevealName">{reveal}</span>
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
        {menu && (
          // A merchant's menu, after the Souls games: the name, the options, the one picked marked.
          <div className="shop" role="menu" aria-label={menu.name}>
            <span className="talkName">{menu.name}</span>
            {menu.options.map((o, i) => (
              <button
                key={o.label}
                type="button"
                role="menuitem"
                className={`shopOption${i === menu.pick ? " picked" : ""}`}
                onClick={(e) => {
                  api.current?.choose(i);
                  e.currentTarget.blur();
                }}
              >
                {o.label}
                {o.note && <span className="shopNote">{o.note}</span>}
              </button>
            ))}
            <span className="talkNext" aria-hidden="true">
              W/S, E
            </span>
          </div>
        )}
        {say ? (
          // A talk, after the Souls games: the name, then one page at a time across the foot of the screen.
          <button key={say.text} type="button" className="talk" onClick={() => api.current?.next()} aria-live="polite">
            <span className="talkName">{say.name}</span>
            <span className="talkText">{say.text}</span>
            <span className="talkNext" aria-hidden="true">E</span>
          </button>
        ) : (
          near &&
          !menu && (
            <div className="talkPrompt" role="status">
              <kbd>E</kbd> {near}
            </div>
          )
        )}
        {died && (
          // After the Souls games: the words up out of a darkening screen, then the dark closes and the captain wakes.
          <div
            className="youDied"
            role="alert"
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              // Held until the dark is down, so the map never shows between the words and the waking.
              wake(died);
            }}
          >
            <span className="youDiedText">You died</span>
          </div>
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
          {flasks !== null && (
            <div className="purse">
              <span title="Drink a flask (R)">
                <kbd>R</kbd>
                <img className="purseIcon" src={packUrl("ui/icon_heal.png")} alt="Flasks" />
                <b>{flasks}</b>
              </span>
              <span>
                Gold <b className="purseGold">{gold ?? 0}</b>
              </span>
            </div>
          )}
          {band && band.members.length > 0 && (
            <div className="bandPanel">
              <div className="bandOrder">
                Band: {band.order === "follow" ? "Follow (1)" : band.order === "attack" ? "Attack (2)" : "Hold (3)"}
              </div>
              {band.members.map((m, i) => (
                <div key={i} className={`bandMember${m.hp === 0 ? " down" : ""}`}>
                  <span>{m.kind === "lancer" ? "Lancer" : "Archer"}</span>
                  <span className="bandBar">
                    <span style={{ width: `${(100 * m.hp) / m.max}%` }} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <header className="atlasTop">
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={() => router.push(`/atlas?focus=${area}`)}>
                Back to the atlas
              </button>
              <button className="linkBtn" type="button" onClick={toggleDev} aria-pressed={dev} title="See the whole map (`)">
                {dev ? "Play" : "Dev: whole map"}
              </button>
            </div>
          </header>
        </div>
      </GameCanvas>
    </main>
  );
}
