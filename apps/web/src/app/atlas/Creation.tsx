"use client";

import { CLASSES, type HeroClass, type ItemName } from "@greyfall/engine";
import { useEffect, useRef, useState } from "react";

import type { SackItem } from "../../game/AtlasScene";
import { CLICK, play, useTick } from "../sound";
import { CreationScene } from "./CreationScene";
import { ItemIcon } from "./ItemIcon";
import { STATS as ATTRIBUTE_ROWS } from "./LevelUp";
import { StatIcon } from "./statIcons";
import "./panel.css";
import "./prologue.css";
import "./rest.css";
import "./creation.css";

/** Each class and its telling, in the order A and D walk them round the island (`creationStage.ts`): the Lancer, the
 *  Warrior, the Monk, the Archer. */
export const CLASS_ROWS: { cls: HeroClass; name: string; about: string }[] = [
  {
    cls: "lancer",
    name: "Lancer",
    about: "A lancer of Highward's wards, who held each ward's gate as it fell. The last of the watch went down to the boats, and no boat came back to the quay.",
  },
  {
    cls: "warrior",
    name: "Warrior",
    about: "A man of the levy, called up to hold the coast when the Grey came. The muster took ship south, and the sea kept all but one.",
  },
  {
    cls: "monk",
    name: "Monk",
    about: "A sister who tended Old Ferrow's fire. It sailed with a lit candle for a hold whose fire had gone out, and the sea put out the candle.",
  },
  {
    cls: "archer",
    name: "Archer",
    about: "A bow of Highward's watch, posted on the Cloudstair. The posts went dark one by one above it. It came down to the sea, and the sea took it.",
  },
];

const STEPS = [
  { label: "Class", title: "Who came ashore?" },
  { label: "Gift", title: "What did the sea leave you?" },
  { label: "Name", title: "What were you called?" },
] as const;

const NAMELESS = "Nameless";


/** A keycap; the word keys (Esc, Enter) are drawn wide. */
function Key({ k }: { k: string }) {
  return <kbd className={k.length > 1 ? "keyCap wide" : "keyCap"}>{k}</kbd>;
}

/**
 * Before the prologue: the class, a gift and a name, kept for the run. Laid out as Dark Souls 1's Create Character on one
 * sheet of the pack's paper across the screen: the steps and the numbers ruled down the left, the step's choices on a slip
 * laid over the middle with what the cursor is on at its foot, and the class on show in a window onto its shore at the right. Keyboard only, on the play keys, so it is practice.
 */
export function Creation({ gifts: giftsNow, onBegin, onDone }: { gifts: () => SackItem[]; onBegin: (cls: HeroClass, gift: ItemName, name: string) => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [cls, setCls] = useState<HeroClass | null>(null);
  const [gift, setGift] = useState<ItemName | null>(null);
  const [name, setName] = useState("");
  const [begun, setBegun] = useState(false);
  // The focused row of this step's list, shown on the rock and in the numbers; the chosen one until a row has focus.
  const [at, setAt] = useState<number | null>(null);
  useTick(at);
  // Read at each render, so a scene still loading when this opened has its gifts by the time they are looked at.
  const gifts = giftsNow();

  // None until a row is looked at: the window holds the whole hamlet.
  const showCls = (step === 0 && at !== null && CLASS_ROWS[at]?.cls) || cls;
  const showGift = (step === 1 && at !== null && gifts[at]?.label) || gift;
  const giftShown = gifts.find((g) => g.label === showGift);
  const ready = step !== 1 || !!gift;

  // Each list opens with its chosen row (or its first) in focus, so the keys work at once; the classes with none
  // chosen open on the list itself, so the whole hamlet shows until W or S.
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const rows = list.current;
    (rows?.querySelector<HTMLButtonElement>(".crOption.chosen") ?? (step === 0 ? rows : rows?.querySelector<HTMLButtonElement>(".crOption")))?.focus({ preventScroll: true });
  }, [step]);

  const go = (to: number): void => {
    if (begun || to < 0) return;
    setAt(null);
    setStep(to);
  };
  const next = (): void => {
    if (!ready || begun) return;
    if (step < 2) return go(step + 1);
    setBegun(true);
    onBegin(cls!, gift!, name.trim() || NAMELESS);
  };

  const choose = (): void => {
    if (step === 0) {
      if (!showCls) return;
      setCls(showCls);
      go(1);
    } else if (showGift) {
      setGift(showGift);
      go(2);
    }
  };

  // The play keys: W S walk the list, E chooses and goes on, Esc backs. The game behind hears none of it (its
  // Space capture would eat a space typed in the name). In the name field the letters are the field's own.
  const keys = (e: React.KeyboardEvent): void => {
    e.stopPropagation();
    if (begun) return e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.target instanceof HTMLInputElement) {
      if (k === "Escape" || (k === "Enter" && !e.nativeEvent.isComposing)) {
        e.preventDefault();
        if (!e.repeat) (k === "Enter" ? next : () => go(step - 1))();
      }
      return;
    }
    if (k === "Tab") return;
    e.preventDefault();
    if (e.repeat) return;
    // A D walk the classes along the waterfront as W S walk a list.
    if (k === "w" || k === "s" || k === "a" || k === "d") {
      const back = k === "w" || k === "a";
      const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".crList .crOption")];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[i < 0 ? (back ? items.length - 1 : 0) : (i + (back ? -1 : 1) + items.length) % items.length]?.focus();
    } else if (k === "Escape") go(step - 1);
    else if (k === "e" || k === "Enter") (play(CLICK), choose());
  };

  const told =
    step === 0
      ? (CLASS_ROWS.find((c) => c.cls === showCls)?.about ?? "The tide brought one ashore at Lanternport. Say who it was.")
      : step === 1
        ? (giftShown?.about ?? "One thing came ashore with you. The sea kept the rest.")
        : "No one in Aurum will know it. Say it anyway.";

  return (
    <div
      className={`prologue creation${begun ? " prologueEnd" : ""}`}
      role="dialog"
      aria-label={STEPS[step]!.title}
      onKeyDown={keys}
      // A click would blur the focused row and leave the keys to the game behind.
      onMouseDown={(e) => e.preventDefault()}
      onAnimationEnd={(e) => e.target === e.currentTarget && begun && onDone()}
    >
      <div className="crSheet">
        <h1 key={step} className="crHead">
          {STEPS[step]!.label}
        </h1>

        <aside className="crLedger" aria-label="Your character">
          <ol className="crFields" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.label} className={i === step ? "on" : undefined} aria-current={i === step ? "step" : undefined}>
                <span>{s.label}</span>
                <b>{i === 0 ? (CLASS_ROWS.find((c) => c.cls === cls)?.name ?? "-") : i === 1 ? (gift ?? "-") : name.trim() || NAMELESS}</b>
              </li>
            ))}
          </ol>
          <ul className="crRows" aria-label="Attributes">
            {ATTRIBUTE_ROWS.map((s) => (
              <li key={s.stat}>
                <span className="statFrame">
                  <StatIcon stat={s.icon} size={22} mono />
                </span>
                <span>{s.name}</span>
                <b>{showCls ? CLASSES[showCls].start[s.stat] : "-"}</b>
              </li>
            ))}
          </ul>
        </aside>

        <CreationScene cls={showCls} gift={giftShown}>
          {/* The classes are picked in the scene itself: their rows only carry the focus, and the caption names the one looked at. */}
          <section ref={list} className={`crList crPane${step === 0 ? " crPick" : ""}`} tabIndex={-1} aria-label={STEPS[step]!.title}>
            {step === 0 && (
              <div className="crOptions">
                {CLASS_ROWS.map((c, i) => (
                  <button key={c.cls} type="button" className={`crOption${c.cls === cls ? " chosen" : ""}`} aria-pressed={c.cls === cls} onFocus={() => setAt(i)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="crOptions">
                {gifts.map((g, i) => (
                  <button key={g.label} type="button" className={`crOption${g.label === gift ? " chosen" : ""}`} aria-pressed={g.label === gift} onFocus={() => setAt(i)}>
                    <ItemIcon icon={g.icon} size={32} />
                    <span className="panelOptionText">
                      <span className="panelOptionName">{g.label}</span>
                      <span className="panelOptionNote">{g.gives}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <form className="crName" onSubmit={(e) => e.preventDefault()}>
                <input autoFocus aria-label="Name" value={name} maxLength={16} placeholder={NAMELESS} spellCheck={false} autoComplete="off" onChange={(e) => setName(e.target.value)} />
                <span className="panelOptionNote">Up to 16 letters. Left blank, you are {NAMELESS}.</span>
              </form>
            )}
            <p key={`${step}:${showCls}:${showGift}`} className="crAbout">
              {step === 0 && showCls && <b className="crPickName">{CLASS_ROWS.find((c) => c.cls === showCls)!.name}</b>}
              {told}
            </p>
          </section>
        </CreationScene>

        <div className="crFoot">
          <span className="crKeys">
            {step < 2 ? (
              <>
                <span className="crKey">
                  {step === 0 ? <Key k="A" /> : <Key k="W" />}
                  {step === 0 ? <Key k="D" /> : <Key k="S" />} Move
                </span>
                <span className="crKey">
                  <Key k="E" /> Choose
                </span>
              </>
            ) : (
              <>
                <span className="crKey">Type a name</span>
                <span className="crKey">
                  <Key k="Enter" /> Come ashore
                </span>
              </>
            )}
            {step > 0 && (
              <span className="crKey">
                <Key k="Esc" /> Back
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
