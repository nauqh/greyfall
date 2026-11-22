"use client";

import { AREAS, FOES, LANDS, MAPPED_AREAS, areaMap, type AreaId, type WorldFlag } from "@greyfall/engine";
import { useMemo, type KeyboardEvent, type RefObject } from "react";

import type { AtlasApi, DevState } from "../../game/AtlasScene";
import "./dev.css";

// A record, so a flag added to WorldFlag fails the typecheck until it is listed here.
const FLAGS = Object.keys({
  died: 1,
  bullWon: 1,
  wellDescended: 1,
  monkFreed: 1,
  moorGateOpen: 1,
  watchLiftOpen: 1,
  trollKey: 1,
  hornedKey: 1,
  greyfallReached: 1,
  warlordDead: 1,
  ladderDown: 1,
  oldLiftDown: 1,
  emberGateOpen: 1,
  sistersStair: 1,
  coffinStairOpen: 1,
  drawnPlankDown: 1,
  hoistOpen: 1,
  bambooDead: 1,
  shellDead: 1,
  tobinDown: 1,
  tobinDeeper: 1,
  ysoldeDeeper: 1,
  anselRoused: 1,
  anselAhead: 1,
  watchmanOut: 1,
  marenSails: 1,
  pennyFollows: 1,
  drankClear: 1,
} satisfies Record<WorldFlag, 1>) as WorldFlag[];
const KINDS = Object.keys(FOES);
const GROUPS = LANDS.map((land) => AREAS.filter((a) => a.land === land && MAPPED_AREAS.includes(a.id))).filter((g) => g.length > 0);
const TIER = { sky: "Sky", surface: "Surface", below: "Below" };

const flip = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Typing in a field stays in the field: the page's and the scene's keys listen on the window. */
const keep = (e: KeyboardEvent): void => {
  const t = e.target;
  if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type !== "checkbox")) e.stopPropagation();
};

function Checks<T extends string>({ title, all, on, set }: { title: string; all: readonly T[]; on: readonly T[]; set: (next: T[]) => void }) {
  const shown = [...new Set([...all, ...on])];
  return (
    <details>
      <summary>
        {title} <b>{on.length}</b>
      </summary>
      <div className="devGrid">
        {shown.map((v) => (
          <label key={v} className="devCheck">
            <input type="checkbox" checked={on.includes(v)} onChange={() => set(flip(on, v))} />
            {v}
          </label>
        ))}
      </div>
    </details>
  );
}

function List({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <details>
      <summary>
        {title} <b>{items.length}</b>
      </summary>
      <ul>
        {items.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </details>
  );
}

/** Dev mode's side panel: the save as the scene holds it, and a way to anywhere and anyone. It hides with the HUD. */
export function DevPanel({
  state: s,
  api,
  onArea,
  onMap,
  onCreate,
}: {
  state: DevState;
  api: RefObject<AtlasApi | null>;
  onArea: (to: AreaId) => void;
  onMap: () => void;
  onCreate: () => void;
}) {
  // Keys are kept by the kind of boss that drops them; these are the ones a gate or lock asks for.
  const keys = useMemo(() => {
    const asked = MAPPED_AREAS.flatMap((a) => {
      const m = areaMap(a);
      return [...m.exits.flatMap((e) => e.keys ?? []), ...(m.locks ?? []).map((l) => l.key)];
    });
    return [...new Set(asked.filter((k): k is string => !!k))];
  }, []);
  const setGold = (v: string): void => {
    const n = Math.floor(Number(v));
    if (v !== "" && Number.isFinite(n) && n >= 0 && n !== s.gold) api.current?.devSet({ gold: n });
  };
  return (
    <aside className="devPanel" aria-label="Dev" onKeyDown={keep} onKeyUp={keep}>
      <header className="devHead">
        <h2>Dev</h2>
        <kbd>H hides</kbd>
      </header>
      <select
        className="devArea"
        value={s.area}
        aria-label="Area"
        onChange={(e) => {
          e.currentTarget.blur();
          onArea(e.target.value as AreaId);
        }}
      >
        {GROUPS.map((g) => (
          <optgroup key={g[0]!.land} label={`${TIER[g[0]!.tier]} · ${g[0]!.land}`}>
            {g.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="devActions">
        <button type="button" className="devBtn" onClick={onMap}>
          Open map
        </button>
        <button type="button" className="devBtn" onClick={onCreate}>
          New hero
        </button>
        <button
          type="button"
          className="devBtn"
          onClick={() => {
            // AtlasScene's KINDLED; the scene draws its fires once, so a reload shows them cold.
            localStorage.removeItem("greyfall.kindled");
            location.reload();
          }}
        >
          Unlight fires
        </button>
      </div>
      <dl className="devStats">
        <dt>Hero</dt>
        <dd>{s.hero ? `${s.hero.col}, ${s.hero.row}` : "-"}</dd>
        <dt>District</dt>
        <dd>{s.district ?? "-"}</dd>
        <dt>Gold</dt>
        <dd>
          <input
            key={s.gold}
            type="number"
            min={0}
            defaultValue={s.gold}
            aria-label="Gold"
            onBlur={(e) => setGold(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setGold(e.currentTarget.value)}
          />
        </dd>
      </dl>
      <details open>
        <summary>
          Folk <b>{s.npcs.length}</b>
        </summary>
        {s.npcs.map((n) => (
          <div key={n.id} className="devRow">
            <span>
              {n.name}
              {n.shop && <i className="devTag">shop</i>}
            </span>
            <button type="button" className="devBtn" onClick={() => api.current?.devTalk(n.id)}>
              Talk
            </button>
          </div>
        ))}
      </details>
      <details open>
        <summary>
          Exits <b>{s.exits.length}</b>
        </summary>
        {s.exits.map((x) => (
          <button key={`${x.name}${x.col},${x.row}`} type="button" className="devRow devLink" onClick={() => api.current?.devLook(x.col, x.row)}>
            {x.name}
            {x.barred && <i className="devTag devBarred">barred</i>}
          </button>
        ))}
      </details>
      <Checks title="Flags" all={FLAGS} on={s.flags} set={(flags) => api.current?.devSet({ flags })} />
      <Checks title="Keys" all={keys} on={s.keys} set={(keys) => api.current?.devSet({ keys })} />
      <Checks title="Slain" all={KINDS} on={s.slain} set={(slain) => api.current?.devSet({ slain })} />
      <List title="Kindled" items={s.kindled} />
      <List title="Heard" items={s.heard} />
    </aside>
  );
}
