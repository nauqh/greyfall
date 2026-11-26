"use client";

// Travel from a bonfire: every bonfire in Aurum, lit or not, by tier and land (TravelPane), shown alone at the fire. The
// map of Aurum beside it (TravelMap) is set aside for now, opened from the dev panel only.

import { AREAS, MAPPED_AREAS, TIERS, TIER_INFO, areaMap, fireName, type AreaId, type TierId } from "@greyfall/engine";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";

import type { AtlasApi, AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";
import { useTick } from "../sound";
import { BANNERS } from "./banners";
import { KeyHints, useCursor } from "./SidePanel";

export type Fire = { area: AreaId; col: number; row: number; name: string; lit: boolean };

// Kept by the scene (AtlasScene's KINDLED and REST); a value import from it would pull Phaser into the server render.
const KINDLED = "greyfall.kindled";
const REST = "greyfall.rest";

const areaOf = (id: AreaId) => AREAS.find((a) => a.id === id)!;

// Each tier's silhouette on its tab, as Elden Ring draws each region; Delapouite's, from game-icons.net (CC BY 3.0).
const TIER_ICON: Record<TierId, string> = {
  sky: "M184 43.5v18h144l-.1-18zm24 95.9l-144 .1v18l144-.1zm96.1 0v18l143.9.1v-18.1zm168.4 98.1l-435.63.1L128 372.5l10.9-32l21.1 80l32-52.5l48 128l80-107.5l32 16z",
  surface: "M133.842 41.092v41.262h91.138V41.092h-17.318V55.05h-18V41.09h-20.164v13.96h-18V41.09h-17.656zm25.828 59.262v41.261h10.828v18H159.67V260.14h61.31v-30.51h18v30.508h100.97V185h-21.657v14.123H201.154V179.37h-12.232v-18h12.232v-61.015H159.67zm169.53 39.412L318.987 167h20.424zm-59.563 80.865h19.828v18h-19.828zm-111.594 57.508l-5.887 29.324c19.725-13.368 39.964-23.723 60.276-29.324zm122.928 0c25.32 6.411 50.978 19.055 76.066 35.3l-14.174-35.3zm-24.653 13.957c-3.82 5.105-10.723 14.754-17.113 26.025c-9.407 16.592-15.751 36.437-12.736 44.975c2.876 8.144 8.599 13.288 17.574 17.716c8.975 4.43 20.9 7.524 33.516 10.55c12.616 3.024 25.91 6.002 38.046 11.144s23.464 12.776 30.178 25.137c10.055 18.51 7.03 43.647 3.188 65.037c-.08.446-.167.878-.248 1.32H494v-32.738c-14.198-15.921-30.351-33.191-47.953-50.551c-57.898-57.103-130.39-112.264-189.729-118.615m-40.763 4.166c-50.359 15.487-106.827 66.43-151.858 118.12C46.516 434.107 31.08 453.593 18 470.997V494h227.406c6.68-4.756 12.807-9.822 17.518-14.9c7.244-7.81 10.646-15.074 10.185-21.036c-.535-6.926-3.903-10.494-11.75-14.556c-7.846-4.063-19.606-7.09-32.046-10.051c-12.441-2.96-25.562-5.894-37.028-11.207s-21.989-13.921-25.228-27.326c-3.35-13.863.587-28.2 7.101-41.846s15.908-26.903 25.531-38.713c5.355-6.571 10.79-12.676 15.866-18.103m1.195 25.734c-9.738 12.244-20.112 26.008-26.348 38.836c-5.547 11.62-7.701 22.2-5.85 29.863c1.63 6.74 6.426 11.11 15.302 15.223c8.875 4.112 21.114 7.052 33.626 10.03c12.513 2.977 25.296 5.952 36.155 11.573c10.858 5.622 20.357 15.42 21.42 29.157c1.024 13.248-5.882 24.903-14.934 34.662a98 98 0 0 1-2.574 2.66H330.4c.292-1.478.58-2.975.854-4.502c3.586-19.966 4.125-43.301-1.287-53.264c-4.167-7.671-11.37-12.912-21.383-17.154s-22.484-7.16-35.223-10.215s-25.756-6.222-37.283-11.91s-21.867-14.513-26.582-27.865c-5.428-15.372-.157-31.982 7.254-47.094",
  below: "M25 25v94.1c29.99.1 62.76-.7 90.3 21.3l2.6 2l24.7 122.3l31.7-151.4l11 7.2c23.2 15.1 41.4 9.7 58.8-.3l11.4-6.6l15.8 103.9l19.5-92.2l17.6-.2l17.8 74.9l12.7-112.32l13.6 19.92c8.3 12.1 14.5 21.1 20.6 26.7c5.4 5 10.6 7.7 18.9 8.7c13.4-8.4 27.8-20.7 44.4-30.1c14.6-8.4 31.7-14.23 50.6-11.9V25zm417.6 338.7c-12 10.6-25.5 26.2-39.7 41.6c-16.5 17.8-33.7 35.2-53.9 42.3l-3.2 1.1l-3.2-1.3c-32.5-13.1-72.9-11.6-115.6-6.5l-2.5.3l-2.3-1c-26.1-11.8-42.9-23-75.3-34.2c-7 12.3-16.4 23.4-27.2 30.8c-6.4 4.4-13.4 7.6-20.86 8.5c-7.47 1-15.51-.7-22.15-5.5c-10.43-7.5-20.87-18-31.23-25.6c-7.49-5.4-14.3-8.8-20.46-9.7V487h462v-37.2c-5.1-12.7-12.2-31.1-20.8-48.7c-7.2-14.9-15.8-28.8-23.6-37.4",
};

/** A land's banner beside its name: its cloth cut swallowtail, its charge on it. */
function LandBanner({ land }: { land: keyof typeof BANNERS }) {
  const b = BANNERS[land];
  return (
    <svg className="landBanner" viewBox="0 0 100 140" aria-hidden="true">
      <path d="M8 0h84v136l-42-20-42 20Z" fill={b.cloth} />
      <g transform="translate(20 22) scale(0.117)" fill={b.ink}>
        <path d={b.charge} />
      </g>
    </svg>
  );
}

/** Every bonfire in the Reach, in the atlas's order of areas (Lanternport and Tidewake first), lit if rested at in this
 *  browser (or all of them in dev mode); a blocked store lights none. */
export function checkpoints(dev: boolean): Fire[] {
  let lit = new Set<string>();
  try {
    lit = new Set(JSON.parse(localStorage.getItem(KINDLED) ?? "[]") as string[]);
  } catch {}
  // Lanternport, the town, heads the surface, and Tidewake, where the hero wakes, the Underneath.
  const head = (id: AreaId) => +(id === "harbour" || id === "landing");
  const lands = AREAS.filter((a) => MAPPED_AREAS.includes(a.id)).sort((a, b) => head(b.id) - head(a.id));
  return lands.flatMap((a) => {
    const m = areaMap(a.id);
    return m.fires.map((f) => ({ area: a.id, col: f.col, row: f.row, name: fireName(m, f), lit: dev || lit.has(`${a.id}:${f.col},${f.row}`) }));
  });
}

/** The bonfire last rested at, the one the map is opened from. */
export function restedAt(): { area: AreaId; col: number; row: number } | null {
  try {
    return JSON.parse(localStorage.getItem(REST) ?? "null") as { area: AreaId; col: number; row: number } | null;
  } catch {
    return null;
  }
}

/** Travelling to `f` rests there: the scene wakes the hero at it. */
export function restAt(f: Fire): void {
  try {
    localStorage.setItem(REST, JSON.stringify({ area: f.area, col: f.col, row: f.row }));
  } catch {}
}

/** The bonfires pane, after Elden Ring's sites of grace: the tiers as tabs over every bonfire on the tier, by land, opening on
 *  `from`'s tier with the bonfire sat at picked. A/D turn the tier, W/S step through its bonfires, E travels to a lit one,
 *  Q or Esc is `onBack`. `onSelect` and `onTurn` tell a map beside it what to fly to. `dev` lights every bonfire. */
export function TravelPane({
  from,
  dev = false,
  onTravel,
  onBack,
  onSelect,
  onTurn,
  panelRef,
  className = "",
}: {
  from: AreaId;
  dev?: boolean;
  onTravel: (f: Fire) => void;
  onBack: () => void;
  onSelect?: (area: AreaId) => void;
  onTurn?: (tier: TierId) => void;
  panelRef?: Ref<HTMLElement>;
  className?: string;
}) {
  const [fires] = useState(() => checkpoints(dev));
  const at = useMemo(restedAt, []);
  const isHere = (f: Fire): boolean => f.area === at?.area && f.col === at.col && f.row === at.row;
  // It opens on the bonfire sat at, if it is on the list; W/S step on from there.
  const [pick, setPick] = useState(() => fires.findIndex(isHere));
  useTick(pick);
  const cursor = useCursor(pick);
  const [tier, setTier] = useState<TierId>(areaOf(from).tier);
  const onTier = (t: TierId) => fires.filter((f) => areaOf(f.area).tier === t);
  const tierLands = [...new Set(onTier(tier).map((f) => f.area))];

  const travel = (f: Fire): void => {
    if (!f.lit) return;
    if (isHere(f)) return onBack();
    restAt(f);
    onTravel(f);
  };
  const pickFire = (i: number): void => {
    setPick(i);
    onSelect?.(fires[i]!.area);
  };
  // A new tier opens whole, nothing picked.
  const turnTier = (t: TierId): void => {
    setPick(-1);
    setTier(t);
    onTurn?.(t);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === "escape" || k === "q") return onBack();
      if (e.repeat) return;
      const steps = onTier(tier);
      if ((k === "w" || k === "arrowup" || k === "s" || k === "arrowdown") && steps.length > 0) {
        const i = steps.indexOf(fires[pick]!);
        const up = k === "w" || k === "arrowup";
        // From nothing picked, W starts at the foot of the list and S at its head.
        const next = i < 0 ? (up ? steps.length - 1 : 0) : (i + (up ? -1 : 1) + steps.length) % steps.length;
        pickFire(fires.indexOf(steps[next]!));
      } else if (k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") {
        turnTier(TIERS[(TIERS.indexOf(tier) + (k === "a" || k === "arrowleft" ? -1 : 1) + TIERS.length) % TIERS.length]!);
      } else if (k === "e" || k === "enter") {
        const f = fires[pick];
        if (f && areaOf(f.area).tier === tier) travel(f);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <section ref={panelRef} className={`sidePanel landPanel ${className}`} aria-label="Bonfires">
      <p className="landTier">{TIER_INFO[tier].name.replace(/^The /, "")}</p>
      <div className="setModes" role="tablist" aria-label="Tiers">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tier}
            aria-label={TIER_INFO[t].name}
            title={TIER_INFO[t].name}
            className={`setMode${t === tier ? " on" : ""}`}
            onClick={() => turnTier(t)}
          >
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <path d={TIER_ICON[t]} />
            </svg>
          </button>
        ))}
      </div>
      <div className="pauseSheet">
        {cursor.bar}
        {tierLands.length > 0 ? (
          tierLands.map((id) => (
            <section key={id} className="landGroup">
              <h2>
                <LandBanner land={areaOf(id).land} />
                {areaOf(id).name}
              </h2>
              <ul className="landFires">
                {fires.map((f, i) =>
                  f.area !== id ? null : (
                    <li key={`${f.col},${f.row}`}>
                      <button
                        type="button"
                        ref={cursor.mark(i)}
                        className={`landFire${i === pick ? " picked" : ""}`}
                        disabled={!f.lit}
                        onMouseEnter={() => f.lit && pickFire(i)}
                        onClick={() => travel(f)}
                      >
                        <span>{f.name}</span>
                        <span className="landFireState">{!f.lit ? "Unlit" : isHere(f) ? "Here" : ""}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        ) : (
          <p className="landWhere">No bonfire burns here.</p>
        )}
      </div>
    </section>
  );
}

/** The pane beside Aurum's map, opened from the dev panel only for now: the map flies to the land picked. `onBack` closes it. */
export function TravelMap({ from, dev = false, onTravel, onBack }: { from: AreaId; dev?: boolean; onTravel: (f: Fire) => void; onBack: () => void }) {
  const api = useRef<AtlasApi | null>(null);
  const panel = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const hooks = useRef<AtlasHooks>({
    opened: () => setShown(true),
    onArea: (id) => api.current?.select(id),
    // The pane keeps its own tier; a lift on the map no longer turns it.
    onTier: () => {},
    // Only beside the list; on a narrow screen it lies over the top instead.
    inset: () => {
      const right = panel.current?.getBoundingClientRect().right ?? 0;
      return right < window.innerWidth / 2 ? right / window.innerWidth : 0;
    },
    ready: (a) => {
      api.current = a;
      a.tier(areaOf(from).tier);
    },
  }).current;

  return (
    <div className={`travelMap${shown ? " shown" : ""}`}>
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <TravelPane
            from={from}
            dev={dev}
            onTravel={onTravel}
            onBack={onBack}
            onSelect={(id) => api.current?.select(id)}
            onTurn={(t) => api.current?.tier(t)}
            panelRef={panel}
          />
          <KeyHints className="pauseKeys mapKeys" keys="A/D tier   W/S bonfire   E travel   Esc back" />
        </div>
      </GameCanvas>
    </div>
  );
}
