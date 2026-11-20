import { useEffect, useRef, useState } from "react";

import type { SackView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { ItemIcon } from "./ItemIcon";
import { STAT_ICON } from "./RestPanel";
import "./sack.css";

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);

/** The numbers drawn big with an icon, as at a rest; the rest told small below them. */
const MAIN: Partial<Record<SackView["stats"][number]["key"], string>> = { hp: STAT_ICON.hp, attack: STAT_ICON.attack, stamina: STAT_ICON.stamina, flasks: "ui/icon_heal.png" };
const ROW = 4;

/**
 * The captain's sack, after a Souls inventory: a panel over the right of the screen, the camera in close on the captain
 * in the rest, without stopping the world, since it is opened in the field. Tab opens and closes it.
 */
export function Sack({ sack, gold, onCover }: { sack: SackView; gold: number; onCover: (cover: number) => void }) {
  const [open, setOpen] = useState(false);
  // Open is what was asked; the sack stays mounted while it slides out, and `shown` is where it slides to.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const wasShown = useRef(false);
  const [pick, setPick] = useState(0);
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
  const panelRef = useRef<HTMLDivElement>(null);
  const cover = useRef(onCover);
  cover.current = onCover;
  useEffect(() => {
    const el = panelRef.current;
    cover.current(shown && el ? 1 - el.offsetLeft / innerWidth : 0);
  }, [shown]);
  useEffect(() => () => cover.current(0), []);
  const goodsRef = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = goodsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCut(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, sack.items.length]);
  const good = sack.items[Math.min(pick, sack.items.length - 1)];
  useEffect(() => {
    goodsRef.current?.children[sack.items.indexOf(good!)]?.scrollIntoView({ block: "nearest" });
  }, [good, sack.items]);
  const main = sack.stats.filter((s) => MAIN[s.key]);
  const more = sack.stats.filter((s) => !MAIN[s.key]);
  const name = sack.name ?? "The Wanderer";
  const slots = Math.max(ROW * 4, Math.ceil(sack.items.length / ROW) * ROW);
  return (
    <>
      {/* Keeps focus off the buttons, so Space rolls rather than pressing them. */}
      <button type="button" className="sackButton" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        Sack <kbd>Tab</kbd>
      </button>
      {mounted && (
        <div
          ref={panelRef}
          className={`sack${shown ? " shown" : ""}`}
          role="dialog"
          aria-label={name}
          onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "transform" && !shown && setMounted(false)}
        >
          <header className="sackTop">
            <span className="sackGold">
              <img src={packUrl("ui/icon_gold.png")} alt="" width={24} height={24} />
              Gold <b>{gold}</b>
            </span>
            <span className="sackWho">
              {name} <b>Level {sack.level}</b>
            </span>
            <button
              type="button"
              className="btn small light sackClose"
              aria-label="Close"
              title="Close (Tab or Esc)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="sackBody">
            <section className="sackLeft">
              <h3 className="sackLabel">
                Goods <span>{sack.items.length} kept</span>
              </h3>
              <div ref={goodsRef} className={`sackGoods${cut ? " cut" : ""}`}>
                {Array.from({ length: slots }, (_, i) => {
                  const s = sack.items[i];
                  return s ? (
                    <button
                      type="button"
                      key={s.label}
                      className="sackSlot"
                      aria-label={s.label}
                      aria-pressed={s === good}
                      onMouseEnter={() => setPick(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setPick(i)}
                    >
                      <ItemIcon icon={s.icon} size={48} />
                    </button>
                  ) : (
                    <span key={i} className="sackSlot empty" />
                  );
                })}
              </div>
              <h3 className="sackLabel">Status</h3>
              <ul className="sackMain">
                {main.map((s) => (
                  <li key={s.key}>
                    <img src={packUrl(MAIN[s.key]!)} alt="" width={28} height={28} />
                    <b>{s.now}</b>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
              <dl className="sackMore">
                {more.map((s) => (
                  <div key={s.key}>
                    <dt>{s.label}</dt>
                    <dd>{s.now}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="sackRight">
              <h3 className="sackLabel">Picked</h3>
              {good ? (
                <div className="sackDetail" aria-live="polite">
                  <span className="sackSlot big">
                    <ItemIcon icon={good.icon} size={96} />
                  </span>
                  <b className="sackName">{good.label}</b>
                  <span className="sackGives">{good.gives}</span>
                  {good.about && <p className="sackAbout">{good.about}</p>}
                </div>
              ) : (
                <p className="sackAbout">Empty. Merchants sell goods you keep for good, and the folk give some.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
