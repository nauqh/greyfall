"use client";

// The Atlas: the Shattered Reach in three tiers, to look round. The map is
// the canvas; the tier tabs, the area index, the selected area's card and the
// key float over it on the kit's paper.

import { AREAS, TIERS, TIER_INFO, atlasMap, type AreaId, type GateKind, type LiftKind, type TierId } from "@greyfall/engine";
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

export default function AtlasPage() {
  const router = useRouter();
  const [area, setArea] = useState<AreaId>("harbour");
  const [tier, setTier] = useState<TierId>("surface");
  const [routes, setRoutes] = useState(false);
  const api = useRef<AtlasApi | null>(null);
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    onTier: (id) => setTier(id),
    ready: (a) => (api.current = a),
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const home = map.tiers[shown.tier];
  const gates = home.gates.filter((g) => g.from === area || g.to === area);
  const lifts = map.lifts.filter((l) => l.up.area === area || l.down.area === area);
  const bosses = home.bosses.filter((b) => b.area === area);
  const name = (id: AreaId) => AREAS.find((a) => a.id === id)!.name;

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
          <nav className="paper atlasIndex" aria-label="Areas">
            {TIERS.map((t) => (
              <div key={t} className="atlasGroup">
                <span className="atlasTier">{TIER_INFO[t].name}</span>
                {AREAS.filter((a) => a.tier === t).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`atlasArea${a.id === area ? " on" : ""}`}
                    onClick={() => {
                      setArea(a.id);
                      api.current?.focus(a.id);
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            ))}
          </nav>

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
