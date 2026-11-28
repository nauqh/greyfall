import { GIFTS } from "@greyfall/engine";
import { useEffect, useRef, useState } from "react";

import type { SackView } from "../../game/AtlasScene";
import { useTick } from "../sound";
import { ItemIcon } from "./ItemIcon";
import { KeyHints } from "./SidePanel";
import { StatIcon, type Stat } from "./statIcons";
import "./sack.css";

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable);

/** Each number's icon, as the level-up screen draws them; block costs stamina, so it takes stamina's. */
const ICON: Record<SackView["stats"][number]["key"], Stat> = {
  hp: "hp",
  attack: "attack",
  flasks: "flasks",
  flask: "flasks",
  block: "stamina",
  greed: "gold",
  stamina: "stamina",
  swing: "agility",
  roll: "walk",
  find: "luck",
};
/** The order Dark Souls lists them: what the captain is, then what the captain does. */
const ORDER: SackView["stats"][number]["key"][] = ["hp", "stamina", "attack", "flasks", "flask", "block", "roll", "swing", "greed", "find"];
/** With the sack open, the movement keys walk its goods instead of the captain. */
const STEP: Record<string, number> = { w: -1, arrowup: -1, s: 1, arrowdown: 1 };
/** Set once the sack has been opened; until then, from the first good past the gift (Hollis's gaff), the field keeps telling the player Tab opens it. */
const OPENED = "greyfall.sackOpened";

/**
 * The captain's sack, after a Souls inventory: a panel over the left of the screen, the camera in close on the captain
 * in the rest, without stopping the world, since it is opened in the field, though the captain stands while it is. Tab
 * opens and closes it; WASD or the arrows pick a good.
 */
export function Sack({ sack, gold, onCover }: { sack: SackView; gold: number; onCover: (cover: number) => void }) {
  const [open, setOpen] = useState(false);
  // Open is what was asked; the sack stays mounted while it slides out, and `shown` is where it slides to.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const wasShown = useRef(false);
  const [pick, setPick] = useState(0);
  useTick(open ? pick : null);
  const [opened, setOpened] = useState(() => {
    try {
      return localStorage.getItem(OPENED) === "1";
    } catch {
      return false;
    }
  });
  // Opened before there is anything past the gift to see does not count: the nudge still comes with the gaff.
  const worth = sack.items.some((i) => !(GIFTS as readonly string[]).includes(i.label));
  useEffect(() => {
    if (!open || !worth) return;
    setOpened(true);
    try {
      localStorage.setItem(OPENED, "1");
    } catch {}
  }, [open, worth]);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames, so the sack is laid out off the edge before it slides in.
      let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setShown((wasShown.current = true)))));
      return () => cancelAnimationFrame(id);
    }
    // Nothing to slide back if it never slid in, or if motion is reduced.
    if (!wasShown.current || matchMedia("(prefers-reduced-motion: reduce)").matches) setMounted(false);
    setShown((wasShown.current = false));
  }, [open]);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (typing(e.target) || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const n = sack.items.length;
    if (!open || !n) return;
    const key = (e: KeyboardEvent): void => {
      const d = STEP[e.key.toLowerCase()];
      if (d === undefined || typing(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      setPick((p) => {
        const at = Math.min(p, n - 1);
        return at + d >= 0 && at + d < n ? at + d : at;
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, sack.items.length]);
  const panelRef = useRef<HTMLDivElement>(null);
  const cover = useRef(onCover);
  cover.current = onCover;
  useEffect(() => {
    const el = panelRef.current;
    cover.current(shown && el ? (el.offsetLeft + el.offsetWidth) / innerWidth : 0);
  }, [shown]);
  useEffect(() => () => cover.current(0), []);
  const goodsRef = useRef<HTMLDivElement>(null);
  // The bar's thumb, as fractions of the list: where it starts and how much of it shows; none while all of it shows.
  const [bar, setBar] = useState<{ top: number; size: number } | null>(null);
  const measure = (): void => {
    const el = goodsRef.current;
    if (!el) return;
    setBar(el.scrollHeight > el.clientHeight + 1 ? { top: el.scrollTop / el.scrollHeight, size: el.clientHeight / el.scrollHeight } : null);
  };
  useEffect(measure, [mounted, sack.items.length]);
  const good = sack.items[Math.min(pick, sack.items.length - 1)];
  useEffect(() => {
    goodsRef.current?.children[sack.items.indexOf(good!)]?.scrollIntoView({ block: "nearest" });
  }, [good, sack.items]);
  const stats = ORDER.flatMap((k) => sack.stats.filter((s) => s.key === k));
  const name = sack.name ?? "The Wanderer";
  return (
    <>
      {/* Keeps focus off the buttons, so Space rolls rather than pressing them. */}
      <button
        type="button"
        className="sackButton"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        Sack <kbd className="keyCap wide">Tab</kbd>
      </button>
      {!opened && worth && (
        <p className="sackNudge" role="status">
          <kbd className="keyCap wide">Tab</kbd> to open your sack.
        </p>
      )}
      {mounted && (
        <div
          ref={panelRef}
          className={`sack${shown ? " shown" : ""}`}
          role="dialog"
          aria-label={name}
          onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "transform" && !shown && setMounted(false)}
        >
          <header className="sackTop">
            <h2 className="sackTitle">Sack</h2>
            <span className="sackGold">
              <StatIcon stat="gold" />
              <b>{gold}</b>
            </span>
          </header>
          <div className="sackBody">
            <section className="sackSheet" aria-label="Goods">
              {sack.items.length ? (
                <div className="sackList">
                  <div ref={goodsRef} className="sackGoods" onScroll={measure}>
                    {sack.items.map((s, i) => (
                      <button
                        type="button"
                        key={s.label}
                        className="sackRow"
                        aria-pressed={s === good}
                        onMouseEnter={() => setPick(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setPick(i)}
                      >
                        <span className="sackIcon">
                          <ItemIcon icon={s.icon} size={56} />
                          {s.count !== undefined && <b className="sackCount">{s.count}</b>}
                        </span>
                        <b>{s.label}</b>
                        <small>{s.gives}</small>
                      </button>
                    ))}
                  </div>
                  {bar && (
                    <div className="sackBar" aria-hidden="true">
                      <span style={{ top: `${bar.top * 100}%`, height: `${bar.size * 100}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="sackEmpty">Empty. Merchants sell goods you keep for good, and the folk give some.</p>
              )}
            </section>
            <div className="sackSide">
              <section className="sackSheet" aria-label="Status">
                <div className="sackWho">
                  <span>{name}</span>
                  <b>Level {sack.level}</b>
                </div>
                <dl className="sackStats">
                  {stats.map((s) => (
                    <div key={s.key}>
                      <dt>
                        <StatIcon stat={ICON[s.key]} size={20} mono />
                        {s.label}
                      </dt>
                      <dd>{s.now}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {good && (
                <section className="sackSheet sackNote" aria-live="polite">
                  <b>{good.label}</b>
                  {good.about && <p>{good.about}</p>}
                </section>
              )}
            </div>
          </div>
          <KeyHints className="sackKeys" keys="W/S pick   Tab close" />
        </div>
      )}
    </>
  );
}
