"use client";

// The Atlas: the Shattered Reach in three tiers, to look round. The map is
// the canvas; the tier tabs, the area index, the selected area's card and the
// key float over it on the kit's paper.

import { AREAS, MAPPED_AREAS, TIERS, TIER_INFO, atlasMap, type AreaId, type GateKind, type LiftKind, type TierId } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import type { AtlasApi, AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

const GATE_KINDS: { kind: GateKind; label: string; tone: string }[] = [
  { kind: "open", label: "Open way", tone: "#fdfaf0" },
  { kind: "gate", label: "Barred gate", tone: "#f4cf6b" },
  { kind: "shortcut", label: "Shortcut, opens from the far side", tone: "#8fd3ff" },
  { kind: "locked", label: "Locked, needs keys", tone: "#ff9a8a" },
  { kind: "high", label: "High road", tone: "#c8f08a" },
];
const LIFT_KINDS: { kind: LiftKind; label: string; tone: string }[] = [
  { kind: "lift", label: "Lift, up and down", tone: "#ffe9a8" },
  { kind: "drop", label: "Drop, down only", tone: "#d6b8ff" },
  { kind: "shortcut", label: "Lift shortcut, opens from above", tone: "#8fd3ff" },
];
const TIER_TAB: Record<TierId, string> = { sky: "Sky", surface: "Surface", below: "Below" };

/** One area's own map, the camera kept inside it; its exits walk to the next. */
function AreaView({ area, onExit, onLeave }: { area: AreaId; onExit: (to: AreaId) => void; onLeave: () => void }) {
  const hooks = useRef<AtlasHooks>({ area, onExit, onArea: () => {}, onTier: () => {}, ready: () => {} }).current;
  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">{AREAS.find((a) => a.id === area)!.name}</h1>
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
  const router = useRouter();
  const [walk, setWalk] = useState<AreaId | null>(null);
  const [area, setArea] = useState<AreaId>("harbour");
  const [tier, setTier] = useState<TierId>("surface");
  const [routes, setRoutes] = useState(false);
  const api = useRef<AtlasApi | null>(null);
  // The area to fly to when the atlas comes back from an area's map.
  const back = useRef<AreaId | null>(null);
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    onTier: (id) => setTier(id),
    ready: (a) => {
      api.current = a;
      if (back.current) a.focus(back.current);
    },
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const home = map.tiers[shown.tier];
  const gates = home.gates.filter((g) => g.from === area || g.to === area);
  const lifts = map.lifts.filter((l) => l.up.area === area || l.down.area === area);
  const bosses = home.bosses.filter((b) => b.area === area);
  const name = (id: AreaId) => AREAS.find((a) => a.id === id)!.name;

  if (walk) {
    // An exit to an area not yet mapped returns to the atlas, on that area's card.
    const leave = (to: AreaId) => ((back.current = to), setArea(to), setWalk(null));
    const go = (to: AreaId) => (MAPPED_AREAS.includes(to) ? setWalk(to) : leave(to));
    return <AreaView key={walk} area={walk} onExit={go} onLeave={() => leave(walk)} />;
  }

  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
            <div className="atlasTiers" role="tablist" aria-label="Tiers">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={t === tier}
                  className={`btn small${t === tier ? "" : " red"}`}
                  onClick={() => api.current?.tier(t)}
                  title={TIER_INFO[t].blurb}
                >
                  {TIER_TAB[t]}
                </button>
              ))}
            </div>
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={() => router.push("/")}>
                Back to the title
              </button>
            </div>
          </header>

          <div className="atlasLeft">

          <ul className="paper atlasLegend" aria-label="Key">
            <li>
              <label className="atlasToggle">
                <input
                  type="checkbox"
                  checked={routes}
                  onChange={(e) => {
                    setRoutes(e.target.checked);
                    api.current?.routes(e.target.checked);
                  }}
                />
                Show the routes
              </label>
            </li>
            {GATE_KINDS.map((k) => (
              <li key={k.kind}>
                <span className="dot" style={{ background: k.tone }} />
                {k.label}
              </li>
            ))}
            {LIFT_KINDS.map((k) => (
              <li key={`lift-${k.kind}`}>
                <span className="dot square" style={{ background: k.tone }} />
                {k.label}
              </li>
            ))}
          </ul>
          </div>

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
            <ul className="atlasGates">
              {gates.map((g) => (
                <li key={g.id}>
                  <span className="dot" style={{ background: GATE_KINDS.find((k) => k.kind === g.kind)!.tone }} />
                  <span>
                    <b>{g.name}</b> to {name(g.from === area ? g.to : g.from)}. {g.note}
                  </span>
                </li>
              ))}
              {lifts.map((l) => {
                const upper = l.up.area === area;
                const other = upper ? l.down : l.up;
                return (
                  <li key={l.id}>
                    <span className="dot square" style={{ background: LIFT_KINDS.find((k) => k.kind === l.kind)!.tone }} />
                    <span>
                      <b>{l.name}</b> {upper ? "down" : "up"} to {name(other.area)}. {l.note}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </GameCanvas>
    </main>
  );
}
