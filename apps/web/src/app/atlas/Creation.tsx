"use client";

import { CLASSES, kit, type HeroClass, type ItemName } from "@greyfall/engine";
import { useEffect, useRef, useState } from "react";

import type { SackItem } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { CLICK, play, useTick } from "../sound";
import { CreationScene } from "./CreationScene";
import { ItemIcon } from "./ItemIcon";
import "./panel.css";
import "./prologue.css";
import "./rest.css";
import "./creation.css";

/** Each class: its idle sheet (`frames` square frames of `frame` px, the feet `feet` px down, `face` the top left of an 88 px square round its head and shoulders), and its telling. */
export const CLASS_ROWS: { cls: HeroClass; name: string; idle: string; frames: number; frame: number; feet: number; face: [number, number]; about: string }[] = [
  {
    cls: "warrior",
    name: "Warrior",
    idle: "Units/Blue Units/Warrior/Warrior_Idle.png",
    frames: 8,
    frame: 192,
    feet: 136,
    face: [58, 46],
    about: "A man of the levy, called up to hold the coast when the Grey came. The muster took ship south, and the sea kept all but one.",
  },
  {
    cls: "eggwarden",
    name: "Eggwarden",
    idle: "Enemy Pack/Lizard/Lizard_Idle.png",
    frames: 7,
    frame: 192,
    feet: 130,
    face: [62, 22],
    about: "A fenfolk of the Stillmere. It went down the sinkhole after the eggs the Stilled took, and followed the water to the bottom of the world.",
  },
  {
    cls: "champion",
    name: "Champion",
    idle: "Enemy Pack/Minotaur/Minotaur_Idle.png",
    frames: 16,
    frame: 320,
    feet: 213,
    face: [142, 78],
    about: "One of the horned, sworn to the Citadel. It rode out with the last gold ship the night the Grey came, and went down with her.",
  },
  {
    cls: "grovekeeper",
    name: "Grovekeeper",
    idle: "Enemy Pack/Panda/Panda_Idle.png",
    frames: 10,
    frame: 256,
    feet: 174,
    face: [82, 76],
    about: "A bamboo-folk of Old Bamboo. When the Grey took the grove it sailed for the old country to bring back help. The ship never got there.",
  },
  {
    cls: "barrowWarden",
    name: "Barrow-warden",
    idle: "Enemy Pack/Hex Shaman/Hex Shaman_Idle.png",
    frames: 8,
    frame: 192,
    feet: 136,
    face: [48, 50],
    about: "A barrow-warden of Kingsrest, sent after the gold the Citadel dug from the old kings' graves. It took ship behind the last gold ship, and the sea took both.",
  },
];

const STEPS = [
  { label: "Class", title: "Who came ashore?" },
  { label: "Gift", title: "What did the sea leave you?" },
  { label: "Name", title: "What were you called?" },
] as const;

const NAMELESS = "Nameless";

/** The classes a new run can take; the rest are shown to look at. */
const OPEN = new Set<HeroClass>(["warrior"]);

/** A keycap; the word keys (Esc, Enter) are drawn wide. */
function Key({ k }: { k: string }) {
  return <kbd className={k.length > 1 ? "wide" : undefined}>{k}</kbd>;
}

/** The numbers on the right, as a rest shows them; Walk's icon is the second frame of a dust burst. */
const STATS: { label: string; icon: string; frame?: number; of: (k: ReturnType<typeof kit>, cls: HeroClass) => number }[] = [
  { label: "Health", icon: "ui/icon_hp.png", of: (k) => k.hp },
  { label: "Stamina", icon: "UI Elements/UI Elements/Icons/Icon_08.png", of: (k) => k.stamina },
  { label: "Attack", icon: "ui/icon_damage.png", of: (k) => k.attack },
  { label: "Embers", icon: "ui/icon_heal.png", of: (k) => k.flasks },
  { label: "Reach", icon: "ui/icon_range.png", of: (_, cls) => CLASSES[cls].reach },
  { label: "Walk", icon: "Particle FX/Dust_02.png", frame: 1, of: (_, cls) => CLASSES[cls].speed },
];

/** A class's face for its row: its head and shoulders in its first idle frame, drawn at half. */
function Thumb({ row }: { row: (typeof CLASS_ROWS)[number] }) {
  const style = {
    backgroundImage: `url("${packUrl(row.idle)}")`,
    backgroundSize: `${(row.frames * row.frame) / 2}px ${row.frame / 2}px`,
    backgroundPosition: `${-row.face[0] / 2}px ${-row.face[1] / 2}px`,
  };
  return <span className="crThumb" aria-hidden="true" style={style} />;
}

/**
 * Before the prologue: the class, a gift and a name, kept for the run. Laid out as Elden Ring's Create Character on one
 * sheet of the pack's paper across the screen: the steps with what each holds, the step's choices under what the cursor is
 * on, the numbers, and the class on show in a window onto its shore at the right. Keyboard only, on the play keys, so it is practice.
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
  // Read at each render, so a scene still loading when this opened has its gifts by the time they are looked at. Shown in
  // the pack's own colours: the tints that tell goods apart in the game only muddy them here.
  const gifts = giftsNow().map((g) => ({ ...g, icon: { ...g.icon, tint: undefined } }));

  const showCls = (step === 0 && at !== null && CLASS_ROWS[at]?.cls) || cls || "warrior";
  const showGift = (step === 1 && at !== null && gifts[at]?.label) || gift;
  const row = CLASS_ROWS.find((c) => c.cls === showCls)!;
  const now = kit(new Set(showGift ? [showGift] : []), undefined, showCls);
  const giftShown = gifts.find((g) => g.label === showGift);
  const ready = step !== 1 || !!gift;

  // Each list opens with its chosen row (or its first) in focus, so the keys work at once.
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    const rows = list.current;
    (rows?.querySelector<HTMLButtonElement>(".crOption.chosen") ?? rows?.querySelector<HTMLButtonElement>(".crOption"))?.focus({ preventScroll: true });
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
      if (!OPEN.has(showCls)) return;
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
    if (k === "w" || k === "s") {
      const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".crList .crOption")];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(i + (k === "w" ? -1 : 1) + items.length) % items.length]?.focus();
    } else if (k === "Escape") go(step - 1);
    else if (k === "e" || k === "Enter") (play(CLICK), choose());
  };

  const told =
    step === 0
      ? row.about
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

        <ol className="crFields" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.label} className={i === step ? "on" : undefined} aria-current={i === step ? "step" : undefined}>
              <span>{s.label}</span>
              <b>{i === 0 ? (CLASS_ROWS.find((c) => c.cls === cls)?.name ?? "-") : i === 1 ? (gift ?? "-") : name.trim() || NAMELESS}</b>
            </li>
          ))}
        </ol>

        <section ref={list} className="crList" aria-label={STEPS[step]!.title}>
          <p key={`${step}:${showCls}:${showGift}`} className="crAbout">
            {told}
          </p>
          {step === 0 && (
            <div className="crOptions">
              {CLASS_ROWS.map((c, i) => (
                <button key={c.cls} type="button" className={`crOption${c.cls === cls ? " chosen" : ""}`} aria-pressed={c.cls === cls} aria-disabled={!OPEN.has(c.cls)} onFocus={() => setAt(i)}>
                  <Thumb row={c} />
                  <span className="panelOptionText">
                    <span className="panelOptionName">{c.name}</span>
                    {!OPEN.has(c.cls) && <span className="panelOptionNote">Locked</span>}
                  </span>
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
        </section>

        <aside className="crStats" aria-label="Your character">
          <span className="crTitle">{row.name}</span>
          <ul className="crRows">
            {STATS.map((s) => (
              <li key={s.label}>
                <i className="crIcon" style={{ backgroundImage: `url("${packUrl(s.icon)}")`, "--frame": s.frame ?? 0 } as React.CSSProperties} />
                <span>{s.label}</span>
                <b>{s.of(now, showCls)}</b>
              </li>
            ))}
          </ul>
          {giftShown && (
            <div className="crSlot">
              <ItemIcon icon={giftShown.icon} size={32} />
              <span className="panelOptionText">
                <span className="panelOptionName">{giftShown.label}</span>
                <span className="panelOptionNote">{giftShown.gives}</span>
              </span>
            </div>
          )}
        </aside>

        <CreationScene row={row} gift={giftShown} />
      </div>

      <div className="crFoot">
        <span className="crKeys">
          {step < 2 ? (
            <>
              <span className="crKey">
                <Key k="W" />
                <Key k="S" /> Move
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
  );
}
