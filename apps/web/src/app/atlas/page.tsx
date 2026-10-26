"use client";

// The Atlas: the Shattered Reach on one map, to look round. The map is the
// canvas; the area index, the selected area's card and the gate legend float
// over it on the kit's paper.

import { AREAS, atlasMap, type AreaId, type GateKind } from "@greyfall/engine";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import type { AtlasHooks } from "../../game/AtlasScene";
import { GameCanvas } from "../../game/GameCanvas";

const GATE_KINDS: { kind: GateKind; label: string; tone: string }[] = [
  { kind: "open", label: "Open way", tone: "#fdfaf0" },
  { kind: "gate", label: "Barred gate", tone: "#f4cf6b" },
  { kind: "shortcut", label: "Shortcut, opens from the far side", tone: "#8fd3ff" },
  { kind: "locked", label: "Locked, needs keys", tone: "#ff9a8a" },
  { kind: "high", label: "High road", tone: "#c8f08a" },
];

export default function AtlasPage() {
  const router = useRouter();
  const [area, setArea] = useState<AreaId>("harbour");
  const [routes, setRoutes] = useState(false);
  const api = useRef<Parameters<AtlasHooks["ready"]>[0] | null>(null);
  const map = useMemo(() => atlasMap(), []);
  const hooks = useRef<AtlasHooks>({
    onArea: (id) => setArea(id),
    ready: (a) => (api.current = a),
  }).current;

  const shown = AREAS.find((a) => a.id === area)!;
  const gates = map.gates.filter((g) => g.from === area || g.to === area);
  const bosses = map.bosses.filter((b) => b.area === area);
  const name = (id: AreaId) => AREAS.find((a) => a.id === id)!.name;

  return (
    <main className="stage">
      <GameCanvas start={(el) => import("../../game/AtlasScene").then(({ startAtlas }) => startAtlas(el, hooks))}>
        <div className="worldHud">
          <header className="atlasTop">
            <h1 className="banner">The Shattered Reach</h1>
            <div className="worldLinks">
              <button className="linkBtn" type="button" onClick={() => router.push("/")}>
                Back to the title
              </button>
            </div>
          </header>

          <nav className="paper atlasIndex" aria-label="Areas">
            {AREAS.map((a) => (
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
          </nav>

          <section className="paper atlasCard">
            <h2>{shown.name}</h2>
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
            </ul>
          </section>

          <ul className="paper atlasLegend" aria-label="Gates">
            {GATE_KINDS.map((k) => (
              <li key={k.kind}>
                <span className="dot" style={{ background: k.tone }} />
                {k.label}
              </li>
            ))}
          </ul>
        </div>
      </GameCanvas>
    </main>
  );
}
