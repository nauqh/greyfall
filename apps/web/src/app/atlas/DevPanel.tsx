"use client";

import { AREAS, ATTRIBUTES, FOES, LANDS, MAPPED_AREAS, areaMap, type AreaId, type Levels, type WorldFlag } from "@greyfall/engine";
import { useMemo, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import type { AtlasApi, DevState } from "../../game/AtlasScene";
import { CLASS_ROWS } from "./Creation";
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
  pennyFollows: 1,
  wageOwed: 1,
  ledgerSaved: 1,
} satisfies Record<WorldFlag, 1>) as WorldFlag[];
const KINDS = Object.keys(FOES);
const TIERS = (["sky", "surface", "below"] as const).map((tier) => ({
  tier,
  lands: LANDS.map((land) => ({ land, areas: AREAS.filter((a) => a.land === land && a.tier === tier && MAPPED_AREAS.includes(a.id)) })).filter((l) => l.areas.length > 0),
})).filter((t) => t.lands.length > 0);
const TIER = { sky: "Sky", surface: "Surface", below: "Below" };
const TABS = ["Go", "World", "Hero", "Screens"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY = "greyfall.devTab";
export type DevScreen = "rest" | "level" | "travel" | "map" | "settings" | "create" | "prologue";

const flip = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Typing in a field stays in the field: the page's and the scene's keys listen on the window. */
const keep = (e: KeyboardEvent): void => {
  const t = e.target;
  if ((t instanceof HTMLInputElement && t.type !== "checkbox") || t instanceof HTMLSelectElement) e.stopPropagation();
};

/** A whole number field that writes on Enter or on leaving it. */
function Num({ value, min = 0, label, set }: { value: number; min?: number; label: string; set: (n: number) => void }) {
  const put = (v: string): void => {
    const n = Math.floor(Number(v));
    if (v !== "" && Number.isFinite(n) && n >= min && n !== value) set(n);
  };
  return (
    <input
      key={value}
      type="number"
      min={min}
      defaultValue={value}
      aria-label={label}
      onBlur={(e) => put(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && put(e.currentTarget.value)}
    />
  );
}

function Checks<T extends string>({ title, all, on, set }: { title: string; all: readonly T[]; on: readonly T[]; set: (next: T[]) => void }) {
  if (all.length === 0) return null;
  return (
    <section className="devSection">
      <h3>
        {title} <b>{on.filter((v) => all.includes(v)).length}</b>
      </h3>
      <div className="devGrid">
        {all.map((v) => (
          <label key={v} className="devCheck">
            <input type="checkbox" checked={on.includes(v)} onChange={() => set(flip(on, v))} />
            {v}
          </label>
        ))}
      </div>
    </section>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="devSection">
      <h3>
        {title} {count !== undefined && <b>{count}</b>}
      </h3>
      {children}
    </section>
  );
}

/** Dev mode's panel, in four tabs: where to go, the world's save, the hero, and the screens to open. It hides with the HUD. */
export function DevPanel({
  state: s,
  api,
  onArea,
  onScreen,
}: {
  state: DevState;
  api: RefObject<AtlasApi | null>;
  onArea: (to: AreaId) => void;
  onScreen: (screen: DevScreen) => void;
}) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem(TAB_KEY) as Tab | null;
      return t && TABS.includes(t) ? t : "Go";
    } catch {
      return "Go";
    }
  });
  const pickTab = (t: Tab): void => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };
  const set = api.current?.devSet ?? (() => {});
  return (
    <aside className="devPanel" aria-label="Dev" onKeyDown={keep} onKeyUp={keep}>
      <header className="devHead">
        <h2>Dev</h2>
        <span>{AREAS.find((a) => a.id === s.area)?.name ?? s.area}</span>
      </header>
      <nav className="devTabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === tab} onClick={() => pickTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <div className="devBody">
        {tab === "Go" && <Go s={s} api={api} onArea={onArea} />}
        {tab === "World" && <World s={s} set={set} />}
        {tab === "Hero" && <Hero s={s} set={set} />}
        {tab === "Screens" && <Screens s={s} api={api} onScreen={onScreen} />}
      </div>
      <footer className="devFoot">
        <kbd>`</kbd> free camera <kbd>H</kbd> hide
      </footer>
    </aside>
  );
}

function Go({ s, api, onArea }: { s: DevState; api: RefObject<AtlasApi | null>; onArea: (to: AreaId) => void }) {
  // The place last flown to: a second click on it sets the hero down there.
  const [aim, setAim] = useState<string | null>(null);
  const go = (key: string, col: number, row: number): void => {
    if (aim === key) {
      api.current?.devPut(col, row);
      setAim(null);
    } else {
      api.current?.devLook(col, row);
      setAim(key);
    }
  };
  const place = (k: string, name: string, col: number, row: number, tag?: ReactNode, children?: ReactNode) => (
    <div key={k} className="devRow" aria-current={aim === k || undefined}>
      <button type="button" className="devLink" onClick={() => go(k, col, row)} title={aim === k ? "Click again to go there" : "Look there"}>
        {name}
        {tag}
        {aim === k && <i className="devTag">go</i>}
      </button>
      {children}
    </div>
  );
  const spots = (kind: DevState["spots"][number]["kind"]) => s.spots.filter((p) => p.kind === kind);
  return (
    <>
      <p className="devHint">Click to look, again to go.</p>
      <Section title="Folk" count={s.npcs.length}>
        {s.npcs.map((n) =>
          place(
            `npc:${n.id}`,
            n.name,
            n.col,
            n.row,
            n.shop && <i className="devTag">shop</i>,
            <button type="button" className="devBtn" onClick={() => api.current?.devTalk(n.id)}>
              Talk
            </button>,
          ),
        )}
      </Section>
      <Section title="Bonfires" count={spots("fire").length}>
        {spots("fire").map((p) => place(`fire:${p.col},${p.row}`, p.name, p.col, p.row))}
      </Section>
      <Section title="Exits" count={s.exits.length}>
        {s.exits.map((x) => place(`exit:${x.name}${x.col},${x.row}`, x.name, x.col, x.row, x.barred && <i className="devTag devBarred">barred</i>))}
      </Section>
      {spots("boss").length > 0 && (
        <Section title="Bosses" count={spots("boss").length}>
          {spots("boss").map((p) => place(`boss:${p.col},${p.row}`, p.name, p.col, p.row))}
        </Section>
      )}
      {spots("note").length > 0 && (
        <Section title="Notes" count={spots("note").length}>
          {spots("note").map((p) => place(`note:${p.col},${p.row}`, p.name, p.col, p.row))}
        </Section>
      )}
      <Section title="Areas">
        {TIERS.map(({ tier, lands }) => (
          <div key={tier} className="devTier">
            <h4>{TIER[tier]}</h4>
            {lands.map(({ land, areas }) => (
              <div key={land} className="devLand">
                <span>{land}</span>
                <div>
                  {areas.map((a) => (
                    <button key={a.id} type="button" className="devChip" aria-current={a.id === s.area || undefined} onClick={() => onArea(a.id)}>
                      {a.name.replace(/^The /, "")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </Section>
    </>
  );
}

function World({ s, set }: { s: DevState; set: AtlasApi["devSet"] }) {
  const [find, setFind] = useState("");
  // Keys are kept by the kind of boss that drops them; these are the ones a gate or lock asks for.
  const keys = useMemo(() => {
    const asked = MAPPED_AREAS.flatMap((a) => {
      const m = areaMap(a);
      return [...m.exits.flatMap((e) => e.keys ?? []), ...(m.locks ?? []).map((l) => l.key)];
    });
    return [...new Set(asked.filter((k): k is string => !!k))];
  }, []);
  const q = find.trim().toLowerCase();
  const match = (v: string): boolean => v.toLowerCase().includes(q);
  return (
    <>
      <input className="devFind" type="search" placeholder="Find a flag, key or boss" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find" />
      <Checks title="Flags" all={FLAGS.filter(match)} on={s.flags} set={(flags) => set({ flags })} />
      <Checks title="Keys" all={keys.filter(match)} on={s.keys} set={(keys) => set({ keys })} />
      <Checks title="Slain" all={KINDS.filter(match)} on={s.slain} set={(slain) => set({ slain })} />
      <button
        type="button"
        className="devBtn devWide"
        onClick={() => {
          // AtlasScene's KINDLED; the scene draws its fires once, so a reload shows them cold.
          localStorage.removeItem("greyfall.kindled");
          location.reload();
        }}
      >
        Unlight every fire
      </button>
    </>
  );
}

function Hero({ s, set }: { s: DevState; set: AtlasApi["devSet"] }) {
  const lv = (a: keyof Levels, n: number): void => set({ levels: { ...s.levels, [a]: n } });
  return (
    <>
      <dl className="devStats">
        <dt>Cell</dt>
        <dd>{s.hero ? `${s.hero.col}, ${s.hero.row}` : "-"}</dd>
        <dt>Quarter</dt>
        <dd>{s.district ?? "-"}</dd>
      </dl>
      <div className="devActions">
        <label className="devCheck devToggle">
          <input type="checkbox" checked={s.god} onChange={() => set({ god: !s.god })} />
          No damage
        </label>
        <button type="button" className="devBtn" onClick={() => set({ heal: true })}>
          Full heal
        </button>
      </div>
      <dl className="devStats">
        <dt>Gold</dt>
        <dd>
          <Num value={s.gold} label="Gold" set={(gold) => set({ gold })} />
        </dd>
        <dt>Embers</dt>
        <dd>
          <Num value={s.flasks} label="Embers" set={(flasks) => set({ flasks })} />
        </dd>
        <dt>Class</dt>
        <dd>
          <select
            value={s.cls}
            aria-label="Class"
            onChange={(e) => {
              // The hero's look is drawn once, so a new class shows on a reload.
              localStorage.setItem("greyfall.class", JSON.stringify(e.target.value));
              location.reload();
            }}
          >
            {CLASS_ROWS.map((c) => (
              <option key={c.cls} value={c.cls}>
                {c.name}
              </option>
            ))}
          </select>
        </dd>
      </dl>
      <Section title="Levels" count={ATTRIBUTES.reduce((n, a) => n + s.levels[a], 0)}>
        <dl className="devStats devLevels">
          {ATTRIBUTES.map((a) => (
            <div key={a}>
              <dt>{a}</dt>
              <dd>
                <Num value={s.levels[a]} label={a} set={(n) => lv(a, n)} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

function Screens({ s, api, onScreen }: { s: DevState; api: RefObject<AtlasApi | null>; onScreen: (screen: DevScreen) => void }) {
  const shops = s.npcs.filter((n) => n.shop);
  const button = (label: string, go: () => void, note?: string) => (
    <button key={label} type="button" className="devScreen" onClick={go}>
      {label}
      {note && <small>{note}</small>}
    </button>
  );
  return (
    <>
      <Section title="Bonfire">
        <div className="devScreens">
          {button("Rest", () => onScreen("rest"), "at the nearest fire")}
          {button("Level up", () => onScreen("level"))}
          {button("Travel list", () => onScreen("travel"))}
          {button("Travel map", () => onScreen("map"))}
        </div>
      </Section>
      <Section title="Shops" count={shops.length}>
        {shops.length === 0 ? (
          <p className="devHint">No merchant in this area.</p>
        ) : (
          <div className="devScreens">{shops.map((n) => button(n.name, () => api.current?.devTalk(n.id)))}</div>
        )}
      </Section>
      <Section title="Lane House">
        <div className="devScreens">{button("Notice board", () => api.current?.devBoard(), "from anywhere")}</div>
      </Section>
      <Section title="Game">
        <div className="devScreens">
          {button("Settings", () => onScreen("settings"))}
          {button("Death", () => api.current?.devKill(), "gold dropped here")}
          {button("Creation", () => onScreen("create"), "new game")}
          {button("Prologue", () => onScreen("prologue"), "on the game's route")}
        </div>
      </Section>
      <p className="devHint">The sack opens on Tab.</p>
    </>
  );
}
