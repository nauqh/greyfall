"use client";

import { AREAS, FOES, MAPPED_AREAS, areaMap, type AreaId, type WorldFlag } from "@greyfall/engine";
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
      {shown.map((v) => (
        <label key={v} className="devCheck">
          <input type="checkbox" checked={on.includes(v)} onChange={() => set(flip(on, v))} />
          {v}
        </label>
      ))}
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

/** Dev mode's side panel: the save as the scene holds it, and a way to anywhere and anyone. */
export function DevPanel({ state: s, api, onArea, onMap }: { state: DevState; api: RefObject<AtlasApi | null>; onArea: (to: AreaId) => void; onMap: () => void }) {
  // Keys are kept by the kind of boss that drops them; these are the ones a gate or lock asks for.
  const keys = useMemo(() => {
    const asked = MAPPED_AREAS.flatMap((a) => {
      const m = areaMap(a);
      return [...m.exits.map((e) => e.key), ...(m.locks ?? []).map((l) => l.key)];
    });
    return [...new Set(asked.filter((k): k is string => !!k))];
  }, []);
  const setGold = (v: string): void => {
    const n = Math.floor(Number(v));
    if (v !== "" && Number.isFinite(n) && n >= 0 && n !== s.gold) api.current?.devSet({ gold: n });
  };
  return (
    <aside className="devPanel" aria-label="Dev" onKeyDown={keep} onKeyUp={keep}>
      <div className="devRow">
        <select
          value={s.area}
          aria-label="Area"
          onChange={(e) => {
            e.currentTarget.blur();
            onArea(e.target.value as AreaId);
          }}
        >
          {MAPPED_AREAS.map((id) => (
            <option key={id} value={id}>
              {AREAS.find((a) => a.id === id)?.name ?? id}
            </option>
          ))}
        </select>
        <button type="button" className="devBtn" onClick={onMap}>
          Open map
        </button>
      </div>
      <dl>
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
              {n.shop && " (shop)"}
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
            {x.barred && " (barred)"}
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
