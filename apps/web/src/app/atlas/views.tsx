"use client";

import { AREAS, type AreaId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks, BandView, Departure, MenuView, SackView, Say, Vitals } from "../../game/AtlasScene";
import { Clouds } from "../../game/Clouds";
import { packUrl } from "../../game/art";
import { GameCanvas } from "../../game/GameCanvas";
import { Prologue } from "./ProloguePlayer";
import { Sack } from "./Sack";
import { Shop } from "./Shop";
import { TravelMap } from "./TravelMap";

/** The HUD shown or hidden with the H key, remembered on this browser. */
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
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  const [boss, setBoss] = useState<{ name: string; hp: number; max: number } | null>(null);
  const [band, setBand] = useState<BandView | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);
  const [sack, setSack] = useState<SackView | null>(null);
  // Died: the words, then the dark, then waking at the bonfire in this area.
  const [died, setDied] = useState<AreaId | null>(null);
  // Sat at a bonfire after a rest: its name, and the option picked.
  const [fire, setFire] = useState<{ name: string; pick: number } | null>(null);
  // The map, open over the area while the scene waits paused behind it: from a bonfire to travel, or on M only to look.
  const [atlas, setAtlas] = useState<"travel" | "look" | null>(null);
  // Opening the map on M: the cloud bank draws in first, then the map is under it.
  const [mapCover, setMapCover] = useState(false);
  // The opening cutscene, once per game, over a Landing paused behind it.
  const [prologue, setPrologue] = useState(false);
  const api = useRef<AtlasApi | null>(null);
  const now = useRef({ area: first, cameFrom: undefined as AreaId | undefined, quiet: false, travelling: false, prologue: false });

  const depart = (d: Departure): void => {
    now.current.travelling = true;
    setTravel({ ...d, phase: "cover" });
  };
  // Waking after a death: the dark comes down, and the captain wakes at the bonfire.
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
  // Through the crossing: the name of where they are.
  const landed = (): void => {
    setTravel(null);
    now.current.travelling = false;
    announce();
  };
  const leaveFire = (): void => {
    api.current?.sit(false);
    setFire(null);
  };
  const bonfire = [
    {
      label: "Travel",
      go: () => {
        api.current?.pause(true);
        setAtlas("travel");
      },
    },
    { label: "Leave", go: leaveFire },
  ];
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
    ready: (a) => {
      api.current = a;
      if (now.current.prologue) a.pause(true);
    },
    onSay: setSay,
    onNear: setNear,
    onFlasks: setFlasks,
    onVitals: setVitals,
    onGold: setGold,
    onBoss: setBoss,
    onBand: setBand,
    onMenu: setMenu,
    onSack: setSack,
    // The scene rests in place: no dark, only the camera drawing in on the fire.
    onRest: () => {
      if (now.current.travelling) return;
      const name = api.current?.sit(true);
      if (name) setFire({ name, pick: 0 });
    },
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
  // Every save of a run, so the captain comes ashore at the Landing again, alone; settings and the duel name stay.
  const newGame = (): void => {
    if (!window.confirm("Start a new game? Your gold, band, bonfires and slain bosses are lost.")) return;
    try {
      for (const k of ["band", "bought", "flags", "gold", "heard", "keys", "kindled", "lost", "prologue", "rest", "slain", "taken"]) localStorage.removeItem(`greyfall.${k}`);
    } catch {}
    window.location.assign("/atlas/landing?rest");
  };
  const endPrologue = (): void => {
    try {
      localStorage.setItem("greyfall.prologue", "1");
    } catch {}
    now.current.prologue = false;
    setPrologue(false);
    api.current?.pause(false);
  };
  const closeAtlas = (): void => {
    api.current?.pause(false);
    setAtlas(null);
  };
  useEffect(() => {
    if (atlas || mapCover || fire || say || menu || died || warn) return;
    const key = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== "m" || e.repeat || now.current.travelling) return;
      api.current?.pause(true);
      setMapCover(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [atlas, mapCover, fire, say, menu, died, warn]);
  useEffect(() => {
    if (!fire || atlas) return;
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") {
        const d = k === "w" || k === "arrowup" ? -1 : 1;
        setFire((f) => f && { ...f, pick: (f.pick + d + bonfire.length) % bonfire.length });
      } else if ((k === "e" || k === "enter") && !e.repeat) bonfire[fire.pick]!.go();
      else if (k === "escape") leaveFire();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, atlas]);
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
          // Arrived by a link with ?from=: the map opens at the exit back there; travelled to with ?rest=, at the bonfire.
          const q = new URLSearchParams(window.location.search);
          hooks.from = (q.get("from") as AreaId | null) ?? undefined;
          if (q.has("rest")) hooks.arrive = "rest";
          try {
            hooks.dev = localStorage.getItem("greyfall.dev") === "1";
            now.current.prologue = first === "landing" && localStorage.getItem("greyfall.prologue") !== "1";
          } catch {}
          setPrologue(now.current.prologue);
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
                else if (travel.phase === "uncover") landed();
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
              else if (travel.phase === "uncover") landed();
            }}
          />
        )}
        {mapCover && (
          // The map opens on M under the bank: the clouds draw in over the area, then the map is there.
          <Clouds
            mode="close"
            onDone={() => {
              setMapCover(false);
              setAtlas("look");
            }}
          />
        )}
        {atlas && (
          <TravelMap
            from={now.current.area}
            travel={atlas === "travel"}
            onBack={closeAtlas}
            onTravel={(f) => {
              closeAtlas();
              setFire(null);
              depart({ to: f.area, name: f.name, kind: "rest", dir: "down", x: 0.5, y: 0.5 });
            }}
          />
        )}
        {fire && !atlas && (
          // Sat at a bonfire, after Dark Souls 3: the dark drawn in round the fire, its name, travel or stand.
          <div className="bonfire" role="menu" aria-label={fire.name}>
            <span className="bonfireName">{fire.name}</span>
            {bonfire.map((o, i) => (
              <button key={o.label} type="button" role="menuitem" className={`shopOption${i === fire.pick ? " picked" : ""}`} onClick={o.go}>
                {o.label}
              </button>
            ))}
            <span className="talkNext" aria-hidden="true">
              W/S, E
            </span>
          </div>
        )}
        {menu && <Shop menu={menu} api={api} />}
        {say?.note ? (
          // A note on the ground: its words on the same paper it lies on.
          <button key={say.text} type="button" className="noteRead" onClick={() => api.current?.next()} aria-live="polite">
            <span className="noteHead">{say.name}</span>
            <span className="noteText">{say.text}</span>
          </button>
        ) : say ? (
          // A talk, after the Souls games: the name, then one page at a time across the foot of the screen.
          <button key={say.text} type="button" className="talk" onClick={() => api.current?.next()} aria-live="polite">
            <span className="talkName">{say.name}</span>
            <span className="talkText">{say.text}</span>
            <span className="talkNext" aria-hidden="true">E</span>
          </button>
        ) : (
          near &&
          !menu &&
          !fire && (
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
          {vitals && (
            // After Dark Souls 1: a round badge holding the flasks, and beside it health over stamina, the health bar as long as
            // the captain's health is deep; a paler trail lingers where a blow took it.
            <div className="vitals" aria-label={`Health ${vitals.hp} of ${vitals.max}, stamina ${vitals.stamina}, ${flasks ?? 0} flasks`}>
              <span className="vitalBadge" title="Flasks">
                <b>{String(flasks ?? 0).padStart(2, "0")}</b>
                <img src={packUrl("ui/icon_heal.png")} alt="" />
              </span>
              <span className="vitalBars">
                <span className="vitalBar hp" style={{ width: `${vitals.max * 3}px` }}>
                  <i style={{ width: `${(100 * vitals.hp) / vitals.max}%` }} />
                  <span style={{ width: `${(100 * vitals.hp) / vitals.max}%` }} />
                </span>
                <span className="vitalBar stamina">
                  <span style={{ width: `${vitals.stamina}%` }} />
                </span>
              </span>
            </div>
          )}
          {boss && (
            // A major boss, after Dark Souls: its name over a long bar, low and centred.
            <div className="bossBar" role="status" aria-label={`${boss.name}, health ${boss.hp} of ${boss.max}`}>
              <span className="bossName">{boss.name}</span>
              <span className="vitalBar hp">
                <i style={{ width: `${(100 * boss.hp) / boss.max}%` }} />
                <span style={{ width: `${(100 * boss.hp) / boss.max}%` }} />
              </span>
            </div>
          )}
          {gold !== null && (
            // The souls counter's place: gold carried, bottom right.
            <div className="purse" title="Gold">
              <img src={packUrl("ui/icon_gold.png")} alt="Gold" />
              <b>{gold}</b>
            </div>
          )}
          {sack && <Sack sack={sack} />}
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
              <button className="linkBtn" type="button" onClick={() => router.push("/")}>
                Leave to the title
              </button>
              <button className="linkBtn" type="button" onClick={newGame}>
                New game
              </button>
              <button className="linkBtn" type="button" onClick={toggleDev} aria-pressed={dev} title="See the whole map (`)">
                {dev ? "Play" : "Dev: whole map"}
              </button>
            </div>
          </header>
        </div>
      </GameCanvas>
      {prologue && <Prologue onDone={endPrologue} />}
    </main>
  );
}
