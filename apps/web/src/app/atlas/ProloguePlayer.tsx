"use client";

import { useEffect, useRef, useState } from "react";

import { PROLOGUE } from "./prologue";
import "./prologue.css";

const HOLD_KEYS = [" ", "Enter", "Escape"];
/** Bare paper before a screen, a paragraph's fade on, time to read the last one, then the screen's fade out. */
const GAP_MS = 1500;
const FADE_MS = 1800;
const TAIL_MS = 1200;
/** 360 ms a word is about 165 words a minute: the slow end of the 160-180 wpm reading band. */
const WORD_MS = 360;
/** After a paragraph has had its reading time, before the next one starts to come up. */
const PARA_MS = 900;

const readMs = (p: string): number => p.split(/\s+/).length * WORD_MS;

/** The opening cutscene, after Dark Souls 1: narration on paper, then the title, then the game. */
/** `wait`: held on bare paper, deaf to keys, while the creation screen still fades out over it. */
export function Prologue({ wait = false, onReveal, onDone }: { wait?: boolean; onReveal: () => void; onDone: () => void }) {
  const { screens, title, subtitle } = PROLOGUE;
  const [b, setB] = useState(0);
  const [end, setEnd] = useState(false);
  const [hold, setHold] = useState(false);
  /** How many of the screen's paragraphs are up; the screen fades out once all are, and have been read. */
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const downAt = useRef(0);
  const screen = screens[b];

  const nextScreen = (): void => {
    setB(b + 1);
    setShown(0);
    setLeaving(false);
  };

  // A click or a key brings up the next paragraph, or after the last, the next screen.
  const next = (): void => {
    if (end) return;
    if (!screen) setEnd(true);
    else if (shown < screen.length) setShown(shown + 1);
    else nextScreen();
  };

  // Each paragraph comes up once the one before it has been read, counted from when that one came up.
  useEffect(() => {
    if (!screen || end || wait) return;
    const t = leaving
      ? setTimeout(nextScreen, TAIL_MS)
      : shown < screen.length
        ? setTimeout(() => setShown(shown + 1), shown ? readMs(screen[shown - 1]!) + PARA_MS : GAP_MS)
        : setTimeout(() => setLeaving(true), FADE_MS + readMs(screen[shown - 1]!));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, shown, leaving, end, wait]);

  // The paper starts to lift: the game behind it begins its opening shot.
  useEffect(() => {
    if (end) onReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  useEffect(() => {
    // Captured on the window ahead of the game's own keys, so nothing behind the cutscene hears them.
    if (end || wait) return;
    const down = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (HOLD_KEYS.includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) {
          downAt.current = performance.now();
          setHold(true);
        }
      } else if (!e.repeat) next();
    };
    const up = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (!HOLD_KEYS.includes(e.key)) return;
      setHold(false);
      if (e.key !== "Escape" && performance.now() - downAt.current < 300) next();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, shown, end, wait]);

  return (
    <div
      className={`prologue${end ? " prologueEnd" : ""}`}
      role="dialog"
      aria-label="Prologue"
      onClick={next}
      onAnimationEnd={(e) => e.target === e.currentTarget && end && onDone()}
    >
      {screen ? (
        <div key={b} className={`prologueText${leaving ? " prologueLeaving" : ""}`} aria-live="polite">
          {/* All laid out from the start, so the screen does not shift as each comes up. */}
          {screen.map((p, i) => (
            <p key={i} className={i < shown ? undefined : "prologueHidden"}>
              {p}
            </p>
          ))}
        </div>
      ) : (
        <div className="prologueTitle" onAnimationEnd={(e) => e.target === e.currentTarget && setEnd(true)}>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {hold && !end && (
        <div className="prologueSkip" aria-hidden="true">
          Hold to skip
          <i onAnimationEnd={() => setEnd(true)} />
        </div>
      )}
    </div>
  );
}
