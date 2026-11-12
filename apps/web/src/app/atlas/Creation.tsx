"use client";

import { CLASSES, kit, type HeroClass, type ItemName } from "@greyfall/engine";
import { useEffect, useRef, useState } from "react";

import type { SackItem } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { CreationScene } from "./CreationScene";
import { ItemIcon } from "./ItemIcon";
import "./panel.css";
import "./prologue.css";
import "./rest.css";
import "./creation.css";

/** Each class: its idle sheet (`frames` square frames of `frame` px, the feet `feet` px down), its kit and its telling. */
export const CLASS_ROWS: { cls: HeroClass; name: string; kit: string; idle: string; frames: number; frame: number; feet: number; about: string }[] = [
  {
    cls: "warrior",
    name: "Warrior",
    kit: "Sword and shield",
    idle: "Units/Blue Units/Warrior/Warrior_Idle.png",
    frames: 8,
    frame: 192,
    feet: 136,
    about: "The levy's oldest trade: a blade, a board of oak, and the nerve to stand inside a monster's reach. Two quick cuts, then a finisher that knocks the foe back.",
  },
  {
    cls: "lancer",
    name: "Lancer",
    kit: "Lance and shield",
    idle: "Units/Blue Units/Lancer/Lancer_Idle.png",
    frames: 12,
    frame: 320,
    feet: 197,
    about: "Corwin's garrison held the bailey with these. It strikes from two tiles off, before most foes can answer, on heavier blows, a slower recovery and more health.",
  },
];

const STEPS = [
  { label: "Class", title: "Who came ashore?" },
  { label: "Gift", title: "What did the sea leave you?" },
  { label: "Name", title: "What were you called?" },
] as const;

const NAMELESS = "Nameless";

/** The numbers on the right, as a rest shows them; Walk's icon is the second frame of a dust burst. */
const STATS: { label: string; icon: string; frame?: number; of: (k: ReturnType<typeof kit>, cls: HeroClass) => number }[] = [
  { label: "Health", icon: "ui/icon_hp.png", of: (k) => k.hp },
  { label: "Stamina", icon: "UI Elements/UI Elements/Icons/Icon_08.png", of: (k) => k.stamina },
  { label: "Attack", icon: "ui/icon_damage.png", of: (k) => k.attack },
  { label: "Flasks", icon: "ui/icon_heal.png", of: (k) => k.flasks },
  { label: "Reach", icon: "ui/icon_range.png", of: (_, cls) => CLASSES[cls].reach },
  { label: "Walk", icon: "Particle FX/Dust_02.png", frame: 1, of: (_, cls) => CLASSES[cls].speed },
];

/** A class's face for its row: a 100 px square of its first idle frame round the body, drawn 48 px. */
function Thumb({ row }: { row: (typeof CLASS_ROWS)[number] }) {
  const k = 48 / 100;
  const style = {
    backgroundImage: `url("${packUrl(row.idle)}")`,
    backgroundSize: `${row.frames * row.frame * k}px ${row.frame * k}px`,
    backgroundPosition: `${-(row.frame / 2 - 50) * k}px ${-(row.feet - 95) * k}px`,
  };
  return <span className="crThumb" aria-hidden="true" style={style} />;
}

/**
 * After the prologue: the class, a gift and a name, kept for the run. Laid out after Dark Souls III's Create Character on
 * the title screen's paper and sea: the steps across the top, the choices, then the numbers beside the class on show,
 * either one showing whatever the pointer is on, and the keys along the foot.
 */
export function Creation({ gifts: giftsNow, onBegin, onDone }: { gifts: () => SackItem[]; onBegin: (cls: HeroClass, gift: ItemName, name: string) => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [cls, setCls] = useState<HeroClass>("warrior");
  const [gift, setGift] = useState<ItemName | null>(null);
  const [name, setName] = useState("");
  const [begun, setBegun] = useState(false);
  // What the pointer is on, shown on the rock and in the numbers; the chosen one when it is on nothing.
  const [hoverCls, setHoverCls] = useState<HeroClass | null>(null);
  const [hoverGift, setHoverGift] = useState<ItemName | null>(null);
  // Read at each render, so a scene still loading when this opened has its gifts by the time they are looked at.
  const gifts = giftsNow();

  const showCls = hoverCls ?? cls;
  const showGift = hoverGift ?? gift;
  const row = CLASS_ROWS.find((c) => c.cls === showCls)!;
  const now = kit(new Set(showGift ? [showGift] : []), undefined, showCls);
  const was = kit(new Set(gift ? [gift] : []), undefined, cls);
  const giftShown = gifts.find((g) => g.label === showGift);
  const ready = step !== 1 || !!gift;

  // Each list opens with its chosen row (or its first) in focus, so the arrows and Enter work without a click first.
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const rows = list.current;
    (rows?.querySelector<HTMLButtonElement>(".panelOption.chosen") ?? rows?.querySelector<HTMLButtonElement>(".panelOption"))?.focus({ preventScroll: true });
  }, [step]);

  const go = (to: number): void => {
    if (begun || to < 0) return;
    setHoverCls(null);
    setHoverGift(null);
    setStep(to);
    setReached((r) => Math.max(r, to));
  };
  const next = (): void => {
    if (!ready || begun) return;
    if (step < 2) return go(step + 1);
    setBegun(true);
    onBegin(cls, gift!, name.trim() || NAMELESS);
  };

  // The game behind hears none of it (its Space capture would eat a space typed in the name); up and down walk the list.
  const keys = (e: React.KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === "Escape") return go(step - 1);
    if (!["ArrowUp", "ArrowDown"].includes(e.key) || e.target instanceof HTMLInputElement) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".crList .panelOption")];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length]?.focus();
    e.preventDefault();
  };

  const told =
    step === 0
      ? row.about
      : step === 1
        ? (giftShown?.about ?? "One thing came ashore with you. The rest the sea kept.")
        : "No one in the Reach will know it. Say it anyway.";

  return (
    <div
      className={`prologue creation${begun ? " prologueEnd" : ""}`}
      role="dialog"
      aria-label={STEPS[step]!.title}
      onKeyDown={keys}
      onAnimationEnd={(e) => e.target === e.currentTarget && begun && onDone()}
    >
      <div className="crScreen">
        <h1 className="crHead">
          <Thumb row={row} />
          Create Character
        </h1>

        <div className="crStage">
          <ol className="crSteps" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.label} className={i === step ? "now" : i <= reached ? "done" : undefined}>
                <button type="button" disabled={i > reached || begun} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>

          <section ref={list} className="crList" aria-label={STEPS[step]!.label}>
            <span className="crTitle">{STEPS[step]!.title}</span>
            <p key={`${step}:${showCls}:${showGift}`} className="crAbout">
              {told}
            </p>
            {step === 0 && (
              <div className="panelOptions" onMouseLeave={() => setHoverCls(null)}>
                {CLASS_ROWS.map((c) => (
                  <button
                    key={c.cls}
                    type="button"
                    className={`panelOption${c.cls === cls ? " chosen" : ""}`}
                    aria-pressed={c.cls === cls}
                    onMouseEnter={() => setHoverCls(c.cls)}
                    onFocus={() => setHoverCls(c.cls)}
                    onClick={(e) => {
                      setCls(c.cls);
                      if (e.detail === 0) go(1);
                    }}
                  >
                    <Thumb row={c} />
                    <span className="panelOptionText">
                      <span className="panelOptionName">{c.name}</span>
                      <span className="panelOptionNote">{c.kit}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="panelOptions" onMouseLeave={() => setHoverGift(null)}>
                {gifts.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    className={`panelOption${g.label === gift ? " chosen" : ""}`}
                    aria-pressed={g.label === gift}
                    onMouseEnter={() => setHoverGift(g.label)}
                    onFocus={() => setHoverGift(g.label)}
                    onClick={(e) => {
                      setGift(g.label);
                      if (e.detail === 0) go(2);
                    }}
                  >
                    <ItemIcon icon={g.icon} size={36} />
                    <span className="panelOptionText">
                      <span className="panelOptionName">{g.label}</span>
                      <span className="panelOptionNote">{g.gives}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <form
                className="crName"
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
              >
                <input autoFocus aria-label="Name" value={name} maxLength={16} placeholder={NAMELESS} spellCheck={false} autoComplete="off" onChange={(e) => setName(e.target.value)} />
                <span className="panelOptionNote">Up to 16 letters. Left blank, you are {NAMELESS}.</span>
              </form>
            )}
          </section>

          <div className="crSheet">
            <aside className="crStats" aria-label="Your character">
              <span className="crTitle">
                {name.trim() || NAMELESS}
                <small>{row.name}</small>
              </span>
              <ul className="crRows">
                {STATS.map((s) => {
                  const v = s.of(now, showCls);
                  const d = v - s.of(was, cls);
                  return (
                    <li key={s.label}>
                      <i className="crIcon" style={{ backgroundImage: `url("${packUrl(s.icon)}")`, "--frame": s.frame ?? 0 } as React.CSSProperties} />
                      <span>{s.label}</span>
                      <b className={d > 0 ? "up" : d < 0 ? "down" : undefined}>{v}</b>
                    </li>
                  );
                })}
              </ul>
              <div className="crSlot">
                <span className="crSlotIcon">{giftShown && <ItemIcon icon={giftShown.icon} size={34} />}</span>
                <span className="panelOptionText">
                  <span className="panelOptionName">{giftShown ? giftShown.label : "No gift yet"}</span>
                  <span className="panelOptionNote">{giftShown ? giftShown.gives : "Chosen in the next step"}</span>
                </span>
              </div>
            </aside>

            <CreationScene row={row} gift={giftShown} />
          </div>
        </div>

        <div className="crFoot">
          <span className="crKeys">
            <kbd>Enter</kbd> OK <kbd>Esc</kbd> Back
          </span>
          <button type="button" className="crBack" onClick={() => go(step - 1)} disabled={step === 0 || begun}>
            Back
          </button>
          <button type="button" className="crNext" onClick={next} disabled={!ready || begun}>
            {step === 0 ? "Next: Gift" : step === 1 ? "Next: Name" : "Come ashore"}
          </button>
        </div>
      </div>
    </div>
  );
}
