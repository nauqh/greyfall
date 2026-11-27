"use client";

import { AREAS, NO_LEVELS, levelCost, type AreaId, type Levels } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks, BandView, BoardView, Departure, DevState, MenuView, SackView, Say, Vitals } from "../../game/AtlasScene";
import { Clouds } from "../../game/Clouds";
import { packUrl } from "../../game/art";
import { GameCanvas } from "../../game/GameCanvas";
import { Board } from "./Board";
import { DevPanel, type DevScreen } from "./DevPanel";
import { LevelUp, STATS, heldCost, plus } from "./LevelUp";
import { RestPanel } from "./RestPanel";
import { KeyHints, SidePanel } from "./SidePanel";
import { CONTROLS } from "../settings/controls";
import { SoundPane } from "../settings/Settings";
import "../settings/settings.css";
import { Creation } from "./Creation";
import { Prologue } from "./ProloguePlayer";
import { Sack } from "./Sack";
import { Shop } from "./Shop";
import { StatIcon } from "./statIcons";
import { TravelMap, TravelPane, type Fire } from "./TravelMap";
import { ARRIVE, CLICK, ERROR, loop, play, SACK } from "../sound";

const PAUSE_TABS = ["Controls", "Sound", "Game"] as const;

/** The HUD shown or hidden with the H key, remembered on this browser. */
export function useHud(off = false): [boolean, () => void] {
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
    if (off) return;
    const key = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === "h" && !(e.target instanceof HTMLInputElement)) toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [off]);
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
export function AreaView({ area: first, devRoute = false }: { area: AreaId; devRoute?: boolean }) {
  const router = useRouter();
  const base = devRoute ? "/atlas/dev" : "/atlas";
  const [area, setArea] = useState(first);
  // The name up out of the dark: the area's as you arrive, a quarter's as you walk into it.
  // `gold`: the scene's own word (a bonfire lit, a boss fallen, a thing gained), not a place.
  const [reveal, setReveal] = useState<{ text: string; gold?: boolean } | null>(null);
  const [cinema, setCinema] = useState(false);
  useEffect(() => {
    if (reveal && !reveal.gold) play(ARRIVE, 0.7);
  }, [reveal]);
  const [travel, setTravel] = useState<(Departure & { phase: "cover" | "hold" | "uncover" }) | null>(null);
  const [warn, setWarn] = useState<Departure | null>(null);
  // New game asked for, waiting on its yes; `create` is the dev panel's new hero.
  const [wipe, setWipe] = useState<{ create: boolean } | null>(null);
  const [say, setSay] = useState<Say | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [flasks, setFlasks] = useState<number | null>(null);
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  const [boss, setBoss] = useState<{ name: string; hp: number; max: number } | null>(null);
  const [band, setBand] = useState<BandView | null>(null);
  const [menu, setMenu] = useState<MenuView | null>(null);
  const [board, setBoard] = useState<BoardView | null>(null);
  const [sack, setSack] = useState<SackView | null>(null);
  // Died: the words, then the dark, then waking at the bonfire in this area.
  const [died, setDied] = useState<AreaId | null>(null);
  // Sat at a bonfire after a rest: its name, the option picked, the level up or travel screen if one is open, the points
  // held on the level up till Accept, and when a level was last bought.
  const [fire, setFire] = useState<{
    name: string;
    pick: number;
    screen?: "level" | "travel";
    held?: Levels;
    bought?: { stat: keyof Levels; at: number };
  } | null>(null);
  // The map, set aside for the bonfire's travel list and opened only from the dev panel, over the area paused behind it.
  const [atlas, setAtlas] = useState(false);
  // The class, gift and name, once per game, first of all over a Landing paused behind it.
  const [picking, setPicking] = useState(false);
  // The opening cutscene, on the creation screen's black once the captain is made.
  const [prologue, setPrologue] = useState(false);
  // The camera's flight in after the prologue, the HUD away until it lands.
  const [intro, setIntro] = useState(false);
  // Esc in the field: the world paused under a menu, the way out to the title in it. Its value is the row picked.
  const [paused, setPaused] = useState<number | null>(null);
  // The pause menu's page; `paused` is the row picked on it.
  const [pauseTab, setPauseTab] = useState(0);
  const [sackOpen, setSackOpen] = useState(false);
  const [devState, setDevState] = useState<DevState | null>(null);
  const api = useRef<AtlasApi | null>(null);
  const now = useRef({ area: first, cameFrom: undefined as AreaId | undefined, quiet: false, travelling: false, prologue: false, screen: undefined as "level" | "travel" | undefined });
  // The theme, under the prologue only: it fades out with the cutscene's black, as the Landing comes up.
  const theme = useRef<(() => void) | null>(null);
  useEffect(() => {
    // Not till the creation screen is gone: then up out of silence, as the first words come.
    if (!prologue || picking || theme.current) return;
    theme.current = loop("/audio/music/theme.mp3", 0.6, 1800, 3900);
  }, [prologue, picking]);
  const fadeTheme = (): void => {
    theme.current?.();
    theme.current = null;
  };

  const depart = (d: Departure): void => {
    now.current.travelling = true;
    setTravel({ ...d, phase: "cover" });
    // The next map is built while the clouds draw in, once their motion is on the compositor.
    setTimeout(() => api.current?.warm(d.to), 100);
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
    setBoard(null);
    setNear(null);
    setTravel({ ...d, phase: "hold" });
    window.history.pushState(null, "", rest ? `${base}/${d.to}` : `${base}/${d.to}?from=${from}`);
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
  const sat = fire ? api.current?.levels() : undefined;
  const level = fire?.screen === "level" ? sat : undefined;
  const menuBack = (pick: number) => setFire((f) => f && { ...f, pick, screen: undefined, held: undefined });
  const held = fire?.held ?? NO_LEVELS;
  // A point held on an attribute, or taken back; one more only while the gold covers it.
  const shift = (stat: keyof Levels, by: 1 | -1): void => {
    if (!sat || held[stat] + by < 0) return;
    if (by > 0 && sat.gold < heldCost(sat.levels, held) + levelCost(plus(sat.levels, held))) return play(ERROR);
    setFire((f) => f && { ...f, held: { ...held, [stat]: held[stat] + by }, bought: undefined });
  };
  // Accept: the points held bought one by one, as the scene sells them.
  const accept = (): void => {
    let last: keyof Levels | undefined;
    for (const { stat } of STATS) for (let k = 0; k < held[stat]; k++) if (api.current?.levelUp(stat)) last = stat;
    if (!last) return play(ERROR);
    setFire((f) => f && { ...f, held: undefined, bought: { stat: last, at: Date.now() } });
  };
  const warpTo = (f: Fire): void => {
    setFire(null);
    depart({ to: f.area, name: f.name, kind: "rest", dir: "down", x: 0.5, y: 0.5 });
  };
  const bonfire = level
    ? [
        ...STATS.map(({ stat }) => ({ label: stat, go: accept })),
      ]
    : [
        {
          label: "Travel",
          note: "To any bonfire you have lit",
          go: () => setFire((f) => f && { ...f, pick: 0, screen: "travel" }),
        },
        { label: "Level up", note: sat ? `Next level ${sat.cost} gold` : "", go: () => setFire((f) => f && { ...f, pick: 0, screen: "level", bought: undefined }) },
        { label: "Leave", note: "Stand, and go on", go: leaveFire },
      ];
  // The name mounts two painted frames after the map is in view, so its clock never runs while the first frames are still drawing.
  const announce = (): void => {
    const name = AREAS.find((a) => a.id === now.current.area)?.name;
    if (!now.current.quiet && name) requestAnimationFrame(() => requestAnimationFrame(() => setReveal({ text: name })));
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
    onBoard: setBoard,
    onSack: setSack,
    onDev: setDevState,
    // The scene rests in place: no dark, only the camera drawing in on the fire.
    onRest: () => {
      if (now.current.travelling) return;
      const name = api.current?.sit(true);
      // The dev panel's level up and travel list open on their own screen.
      if (name) setFire({ name, pick: 0, screen: now.current.screen });
      now.current.screen = undefined;
    },
    onDeath: (to) => {
      if (now.current.travelling) return;
      setReveal(null);
      setDied(to);
    },
    onDistrict: (d) => !now.current.travelling && setReveal({ text: d }),
    onHerald: (text) => !now.current.travelling && setReveal({ text, gold: true }),
    onCinema: setCinema,
    opened: () => {
      if (now.current.travelling) setTravel((t) => (t ? { ...t, phase: "uncover" } : t));
      else if (!now.current.prologue) announce();
    },
  }).current;
  // The HUD hides with H; there is no button for it on an area map.
  const [hud] = useHud(paused !== null);
  // Dev mode, on the dev route only: the backquote key toggles its free camera over the whole map.
  const toggleFree = (): void => {
    const a = api.current;
    a?.freeCamera(!a.devState().free);
  };
  // Every save of a run, so the captain comes ashore at the Landing again, alone; settings and the duel name stay. The
  // dev panel's new hero asks for creation after, which the dev route otherwise skips.
  const newGame = (create: boolean): void => {
    try {
      for (const k of ["band", "bought", "class", "flags", "gold", "heard", "hero", "keys", "kindled", "levels", "lost", "loot", "met", "notices", "prologue", "rest", "sackOpened", "slain", "taken", "thrown"]) localStorage.removeItem(`greyfall.${k}`);
    } catch {}
    window.location.assign(`${base}/landing?rest${create ? "&create" : ""}`);
  };
  const devScreen = (screen: DevScreen): void => {
    if (screen === "rest" || screen === "level" || screen === "travel") {
      now.current.screen = screen === "rest" ? undefined : screen;
      api.current?.devRest();
    } else if (screen === "map") {
      api.current?.pause(true);
      setAtlas(true);
    } else if (screen === "settings") {
      api.current?.pause(true);
      setPaused(pauseTop(pauseTab));
    } else if (screen === "create") setWipe({ create: true });
    else {
      // The prologue plays on the game's own route only, for a run not yet begun there.
      try {
        localStorage.removeItem("greyfall.prologue");
      } catch {}
      window.location.assign("/atlas/landing");
    }
  };
  // The title gone, the black lifts close on the captain and the camera eases back; the name comes up as it settles.
  const revealLanding = (): void => {
    try {
      localStorage.setItem("greyfall.prologue", "1");
    } catch {}
    const landed = (): void => {
      now.current.prologue = false;
      setIntro(false);
      announce();
    };
    const a = api.current;
    if (!a) return landed();
    setIntro(true);
    a.pause(false);
    a.intro(2200, 3400, landed);
  };
  const closeAtlas = (): void => {
    api.current?.pause(false);
    setAtlas(false);
  };
  useEffect(() => {
    if (!fire || atlas || fire.screen === "travel") return;
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") {
        const d = k === "w" || k === "arrowup" ? -1 : 1;
        setFire((f) => f && { ...f, pick: (f.pick + d + bonfire.length) % bonfire.length });
      } else if (level && fire.pick < STATS.length && (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright")) {
        play(CLICK);
        shift(STATS[fire.pick]!.stat, k === "a" || k === "arrowleft" ? -1 : 1);
      } else if ((k === "e" || k === "enter") && !e.repeat) (play(CLICK), bonfire[fire.pick]!.go());
      else if (k === "escape" || (k === "q" && fire.screen)) fire.screen ? menuBack(fire.screen === "level" ? 1 : 0) : leaveFire();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, atlas]);
  const resume = (): void => {
    api.current?.pause(false);
    setPaused(null);
  };
  // On the Sound page the pick starts on the tabs (-1), so A/D turn pages until S steps down onto a level.
  const pauseTop = (i: number): number => (PAUSE_TABS[i] === "Sound" ? -1 : 0);
  const turnPause = (i: number): void => {
    setPauseTab(i);
    setPaused(pauseTop(i));
  };
  const pauseMenu = [
    { label: "Leave to the title", go: () => router.push("/") },
    { label: "New game", go: () => setWipe({ create: false }) },
  ];
  // A paper card's yes or no, by key, the mouse hidden: A/D picks, E chooses, Esc says no. Caught first, so the
  // captain does not walk or act behind it.
  useEffect(() => {
    if (!warn && !wipe) return;
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      const buttons = [...document.querySelectorAll<HTMLButtonElement>(".dropWarnActions button")];
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") buttons[(at + (k === "a" || k === "arrowleft" ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      else if (k === "e" && !e.repeat) buttons[at]?.click();
      else if (k === "escape") buttons.at(-1)?.click();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [warn, wipe]);
  const busy = !!(atlas || fire || say || menu || board || died || warn || wipe || travel || picking || prologue || intro);
  useEffect(() => {
    if (busy) return;
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (paused === null) {
        if (k !== "escape" || e.repeat || sackOpen) return;
        api.current?.pause(true);
        setPaused(pauseTop(pauseTab));
        return;
      }
      const sound = PAUSE_TABS[pauseTab] === "Sound";
      // Arrows on a focused slider move the slider.
      const arrow = !(e.target instanceof HTMLInputElement);
      if (k === "escape") resume();
      else if (k === "a" || k === "d" || (arrow && (k === "arrowleft" || k === "arrowright"))) {
        // A level picked takes A/D itself (SoundPane).
        if (sound && paused >= 0) return;
        play(CLICK);
        turnPause((pauseTab + (k === "a" || k === "arrowleft" ? -1 : 1) + PAUSE_TABS.length) % PAUSE_TABS.length);
      } else if (PAUSE_TABS[pauseTab] === "Controls") return;
      else if (k === "w" || k === "s" || (arrow && (k === "arrowup" || k === "arrowdown"))) {
        const d = k === "w" || k === "arrowup" ? -1 : 1;
        setPaused((p) => (p === null ? p : sound ? Math.min(2, Math.max(-1, p + d)) : (p + d + 2) % 2));
      } else if ((k === "e" || k === "enter") && !e.repeat && PAUSE_TABS[pauseTab] === "Game") (play(CLICK), pauseMenu[paused]!.go());
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, paused, pauseTab, sackOpen]);
  useEffect(() => {
    if (!devRoute) return;
    const key = (e: KeyboardEvent): void => {
      if (e.key === "`" && !(e.target instanceof HTMLInputElement)) toggleFree();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A bonfire screen's keys, at the foot of its panel: the one way to accept or go back, by key or click.
  const foot = fire && (
    <KeyHints
      className="panelKeys"
      keys={fire.screen === "level" ? "E accept   Q back" : fire.screen ? "E travel   Q back" : "W/S pick   E choose"}
      onKey={fire.screen && { ...(level && { E: accept }), Q: () => menuBack(fire.screen === "level" ? 1 : 0) }}
    />
  );
  return (
    <main className={devRoute ? "stage" : "stage noMouse"}>
      <GameCanvas
        start={(el) => {
          // Arrived by a link with ?from=: the map opens at the exit back there; travelled to with ?rest=, at the bonfire.
          const q = new URLSearchParams(window.location.search);
          hooks.from = (q.get("from") as AreaId | null) ?? undefined;
          if (q.has("rest")) hooks.arrive = "rest";
          hooks.dev = devRoute;
          try {
            now.current.prologue = !devRoute && first === "landing" && localStorage.getItem("greyfall.prologue") !== "1";
          } catch {}
          setPicking(now.current.prologue || q.has("create"));
          return import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks));
        }}
      >
        {/* A boss met: black bars in from the top and bottom, as in a film. */}
        <div className={`cinema${cinema ? " on" : ""}`} aria-hidden="true" />
        {reveal && (
          // After the Souls games: up out of the dark, held, gone.
          // The scene's banner on lighting a bonfire: held longer, in gold.
          <div key={reveal.text} className={`areaReveal${reveal.gold ? " lit" : ""}`} role="status" onAnimationEnd={(e) => e.target === e.currentTarget && setReveal(null)}>
            <span className="areaRevealName">{reveal.text}</span>
          </div>
        )}
        {travel && (travel.kind === "walk" || travel.name === "The Boat") && (
          // Walking out or taking the boat: the game's own cloud bank draws in, holds while the next map is built, and parts on it.
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
        {travel && travel.kind !== "walk" && travel.name !== "The Boat" && (
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
        {atlas && (
          <TravelMap
            from={now.current.area}
            dev={devRoute}
            onBack={closeAtlas}
            onTravel={(f) => {
              closeAtlas();
              setFire(null);
              depart({ to: f.area, name: f.name, kind: "rest", dir: "down", x: 0.5, y: 0.5 });
            }}
          />
        )}
        {fire && !atlas && (
          // Sat at a bonfire, after Dark Souls 3 and Elden Ring: the camera in on the fire, a panel at the side, the world left lit.
          <div className="sideDock fireDock">
            {level ? (
              <LevelUp
                view={level}
                held={held}
                pick={fire.pick}
                bought={fire.bought}
                onPick={(pick) => setFire({ ...fire, pick })}
                onChoose={(i) => bonfire[i]!.go()}
                onShift={shift}
                foot={foot}
              />
            ) : (
              sat &&
              (fire.screen === "travel" ? (
                <TravelPane from={area} dev={devRoute} onTravel={warpTo} onBack={() => menuBack(0)} className="bonfirePanel" foot={foot} />
              ) : (
                <RestPanel
                  name={fire.name}
                  area={AREAS.find((a) => a.id === area)?.name ?? ""}
                  view={sat}
                  flasks={flasks ?? 0}
                  options={bonfire.map((o) => ({ label: o.label, note: "note" in o ? o.note : undefined }))}
                  pick={fire.pick}
                  onPick={(pick) => setFire({ ...fire, pick })}
                  onChoose={(i) => bonfire[i]!.go()}
                  foot={foot}
                />
              ))
            )}
          </div>
        )}
        {devRoute && devState && hud && !atlas && (
          <DevPanel
            state={devState}
            api={api}
            onArea={(to) => !now.current.travelling && depart({ to, name: AREAS.find((a) => a.id === to)?.name ?? to, kind: "rest", dir: "down", x: 0.5, y: 0.5 })}
            onScreen={devScreen}
          />
        )}
        {menu && <Shop menu={menu} api={api} />}
        {board && <Board board={board} onHover={(i) => api.current?.hover(i)} onChoose={(i) => api.current?.choose(i)} />}
        {paused !== null && (
          <div className="sideDock pauseDock">
            <SidePanel
              className="pausePanel"
              name="Settings"
              options={[]}
              pick={paused}
              onPick={setPaused}
              onChoose={(i) => pauseMenu[i]!.go()}
              // One strip for every page: A/D turn the page, or the level once one is picked.
              foot={<KeyHints className="panelKeys" keys="A/D change   W/S move   E choose   Esc resume" />}
            >
              <div className="setModes" role="tablist" aria-label="Settings">
                {PAUSE_TABS.map((t, i) => (
                  <button key={t} type="button" role="tab" aria-selected={i === pauseTab} className={`setMode${i === pauseTab ? " on" : ""}`} onClick={() => turnPause(i)}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="pauseSheet">
                {PAUSE_TABS[pauseTab] === "Sound" && <SoundPane pick={paused} onPick={setPaused} />}
                {PAUSE_TABS[pauseTab] === "Controls" && (
                  <div className="pauseBinds">
                    {CONTROLS[0]!.groups.map((g) => (
                      <section key={g.title} className="setGroup">
                        <h2>{g.title}</h2>
                        <dl>
                          {g.binds.map((b) => (
                            <div key={b.action} className="setRow">
                              <dt>{b.action}</dt>
                              <dd>
                                {b.keys.map((k) => (
                                  <kbd key={k} className="setCap">
                                    {k}
                                  </kbd>
                                ))}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                )}
                {PAUSE_TABS[pauseTab] === "Game" && (
                  <div className="panelOptions pauseGame">
                    {pauseMenu.map((o, i) => (
                      <button key={o.label} type="button" role="menuitem" className={`panelOption${i === paused ? " picked" : ""}`} onMouseEnter={() => setPaused(i)} onClick={o.go}>
                        <span className="panelOptionText">
                          <span className="panelOptionName">{o.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </SidePanel>
          </div>
        )}
        {say?.note ? (
          // A note on the ground: its words on the same paper it lies on.
          <button key={say.text} type="button" className="noteRead" onClick={() => api.current?.next()} aria-live="polite">
            <span className="noteHead">{say.name}</span>
            <span className="noteText">{noteKeys(say.text)}</span>
          </button>
        ) : say ? (
          // A talk, after the Souls games: one page at a time across the foot of the screen, unnamed; the name is over their head.
          <button key={say.text} type="button" className="talk" onClick={() => api.current?.next()} aria-live="polite">
            <span className="talkText">{say.text}</span>
            <span className="talkNext" aria-hidden="true">E</span>
          </button>
        ) : (
          near &&
          !menu &&
          !board &&
          !fire &&
          !atlas &&
          !sackOpen &&
          paused === null && (
            <div className="talkPrompt" role="status">
              <kbd className="keyCap">E</kbd> {near}
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
                <button className="btn small light" type="button" onClick={() => setWarn(null)}>
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
        {wipe && (
          <div className="dropWarn" role="alertdialog" aria-modal="true" aria-labelledby="wipeText">
            <div className="paper dropWarnCard">
              <p id="wipeText">Begin anew? Gold, band, bonfires and slain bosses are lost.</p>
              <div className="dropWarnActions">
                <button className="btn small" type="button" onClick={() => newGame(wipe.create)}>
                  Begin anew
                </button>
                <button className="btn small light" type="button" autoFocus onClick={() => setWipe(null)}>
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Off under any menu, as Dark Souls clears the screen for one; H hides it the rest of the time. */}
        <div className={intro ? "worldHud worldHudIntro" : "worldHud"} hidden={!hud || sackOpen || !!fire || !!menu || !!board || paused !== null || atlas}>
          {vitals && (
            // After Dark Souls 1: a round badge holding the embers, and beside it health over stamina, the health bar as long as
            // the captain's health is deep; a paler trail lingers where a blow took it.
            <div className="vitals" aria-label={`Health ${vitals.hp} of ${vitals.max}, stamina ${vitals.stamina}, ${flasks ?? 0} embers`}>
              <span className="vitalBadge" title="Embers">
                <b>{String(flasks ?? 0).padStart(2, "0")}</b>
                <StatIcon stat="flasks" size={22} />
              </span>
              <span className="vitalBars">
                <span className="vitalBar hp" style={{ width: `${vitals.max * 3}px` }}>
                  <i style={{ width: `${(100 * vitals.hp) / vitals.max}%` }} />
                  <span style={{ width: `${(100 * vitals.hp) / vitals.max}%` }} />
                </span>
                <span className="vitalBar stamina" style={{ width: `${vitals.staminaMax * 2.4}px` }}>
                  <span style={{ width: `${(100 * vitals.stamina) / vitals.staminaMax}%` }} />
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
          {band && band.members.length > 0 && (
            <div className="bandPanel">
              <div className="bandOrder">
                Band: {band.order === "follow" ? "Follow (1)" : band.order === "attack" ? "Attack (2)" : "Hold (3)"}
              </div>
              {band.members.map((m, i) => (
                <div key={i} className={`bandMember${m.hp === 0 ? " down" : ""}`}>
                  <span>{m.kind === "lancer" ? "Lancer" : m.kind === "archer" ? "Archer" : "Monk"}</span>
                  <span className="bandBar">
                    <span style={{ width: `${(100 * m.hp) / m.max}%` }} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Outside the HUD, so Tab opens the sack with the HUD hidden too, from the first step, goods or none. */}
        {sack && !atlas && !fire && !menu && !board && !intro && !prologue && !picking && paused === null && (
          <Sack
            sack={sack}
            gold={gold ?? 0}
            onCover={(c) => {
              if (c > 0 && !sackOpen) play(SACK);
              setSackOpen(c > 0);
              api.current?.look(c);
            }}
          />
        )}
      </GameCanvas>
      {prologue && (
        <Prologue
          wait={picking}
          onReveal={() => {
            fadeTheme();
            revealLanding();
          }}
          onDone={() => setPrologue(false)}
        />
      )}
      {picking && (
        // Over the prologue: its black is under the creation screen as that fades, so the cutscene comes up out of it.
        <Creation
          gifts={() => api.current?.gifts() ?? []}
          onBegin={(cls, gift, name) => {
            api.current?.begin(cls, gift, name);
            // The prologue's cutscene is the Landing's own arrival; dev mode makes the hero wherever it stands.
            if (!devRoute) setPrologue(true);
          }}
          onDone={() => setPicking(false)}
        />
      )}
    </main>
  );
}

/** A tutorial note's keys ("E: Rest At Fire", "Hold right click: Guard") drawn as the field's key caps; only before its colon. */
function noteKeys(text: string): React.ReactNode {
  const i = text.indexOf(": ");
  if (i < 0) return text;
  const keys = text.slice(0, i).split(/\b(W|A|S|D|E|R|Space|Tab|Esc|[Ll]eft click|[Rr]ight click)\b/);
  return (
    <>
      {keys.map((p, j) => {
        if (!(j % 2)) return p;
        if (!p.endsWith("click")) return <kbd key={j} className={p.length > 1 ? "keyCap wide" : "keyCap"}>{p}</kbd>;
        const left = p[0]!.toLowerCase() === "l";
        return (
          <kbd key={j} className="keyCap" aria-label={p}>
            <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden>
              <rect x="1" y="1" width="14" height="20" rx="7" fill="#fdfaf0" stroke="#1c2634" strokeWidth="2" />
              <path d={left ? "M8 1A7 7 0 0 0 1 8H8Z" : "M8 1A7 7 0 0 1 15 8H8Z"} fill="#f2b33d" stroke="#1c2634" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </kbd>
        );
      })}
      {text.slice(i)}
    </>
  );
}
