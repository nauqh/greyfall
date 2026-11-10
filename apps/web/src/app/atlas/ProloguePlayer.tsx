"use client";

import { useEffect, useRef, useState } from "react";

import { PROLOGUE } from "./prologue";
import "./prologue.css";

const HOLD_KEYS = [" ", "Enter", "Escape"];
/** Black before a paragraph, its fade on, time to read it, then its fade out. */
const GAP_MS = 1500;
const FADE_MS = 1800;
const TAIL_MS = 1200;
/** 360 ms a word is about 165 words a minute: the slow end of the 160-180 wpm reading band. */
const WORD_MS = 360;

/** The opening cutscene, after Dark Souls 1: narration on black, then the title, then the game. */
export function Prologue({ onDone }: { onDone: () => void }) {
  const { beats, title, subtitle } = PROLOGUE;
  const [b, setB] = useState(0);
  const [end, setEnd] = useState(false);
  const [hold, setHold] = useState(false);
  const downAt = useRef(0);
  const beat = beats[b];
  const ms = beat ? GAP_MS + FADE_MS + beat.split(/\s+/).length * WORD_MS + TAIL_MS : 0;

  const next = (): void => {
    if (end) return;
    if (beat) setB(b + 1);
    else setEnd(true);
  };

  useEffect(() => {
    if (!beat || end) return;
    const t = setTimeout(next, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, end]);

  useEffect(() => {
    // Captured on the window ahead of the game's own keys, so nothing behind the cutscene hears them.
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
  }, [b, end]);

  return (
    <div
      className={`prologue${end ? " prologueEnd" : ""}`}
      role="dialog"
      aria-label="Prologue"
      onClick={next}
      onAnimationEnd={(e) => e.target === e.currentTarget && end && onDone()}
    >
      {beat ? (
        <div
          key={b}
          className="prologueText"
          style={{ "--ms": `${ms}ms` } as React.CSSProperties}
          aria-live="polite"
        >
          <p style={{ animationDelay: `${GAP_MS}ms` }}>{beat}</p>
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
