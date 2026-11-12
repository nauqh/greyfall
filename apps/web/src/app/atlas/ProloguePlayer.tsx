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
/** Black between the Gilded City paragraph fading out and its last sentence fading in. */
const SPECIAL_PAUSE_MS = 1000;

/** The opening cutscene, after Dark Souls 1: narration on black, then the title, then the game. */
export function Prologue({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const { beats, title, subtitle } = PROLOGUE;
  const [b, setB] = useState(0);
  const [end, setEnd] = useState(false);
  const [hold, setHold] = useState(false);
  const [reveal, setReveal] = useState(false);
  const downAt = useRef(0);
  const beat = beats[b];
  const special = typeof beat === "object" && beat !== null;
  const first = typeof beat === "object" && beat !== null ? beat.first : "";
  const last = typeof beat === "object" && beat !== null ? beat.last : "";
  const gap = typeof beat === "object" && beat !== null ? beat.gap : GAP_MS;
  const text = typeof beat === "string" ? beat : "";
  const firstHold = first.split(/\s+/).length * WORD_MS;
  const lastHold = last.split(/\s+/).length * WORD_MS;
  const revealAt = gap + FADE_MS + firstHold;
  const lastDelay = TAIL_MS + SPECIAL_PAUSE_MS;
  const gone = special && reveal;
  const ms = special ? revealAt + lastDelay + FADE_MS + lastHold + TAIL_MS : text ? gap + FADE_MS + text.split(/\s+/).length * WORD_MS + TAIL_MS : 0;

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

  // The black starts to lift: the game behind it begins its opening shot.
  useEffect(() => {
    if (end) onReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  useEffect(() => {
    if (!special || end) return;
    setReveal(false);
    const t = setTimeout(() => setReveal(true), revealAt);
    return () => clearTimeout(t);
  }, [b, end, special, revealAt]);

  useEffect(() => {
    // Captured on the window ahead of the game's own keys, so nothing behind the cutscene hears them.
    // Once it ends, the keys are the creation screen's.
    if (end) return;
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
          <p className={gone ? "prologueGone" : undefined} style={{ animationDelay: gone ? "0ms" : `${gap}ms` }}>
            {special ? first : text}
          </p>
          {gone && (
            <p className="prologueLast" style={{ animationDelay: `${lastDelay}ms` }}>
              {last}
            </p>
          )}
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
