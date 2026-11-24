import { useEffect, useRef } from "react";

// Every file is in public/audio, named for what it does; public/audio/CREDITS.md gives each one's source and license.
const sfx = (name: string): string => `/audio/${name}.ogg`;
const set = (name: string, n: number): string[] => Array.from({ length: n }, (_, i) => sfx(`${name}-${i + 1}`));
export const CLICK = "/audio/click.flac";
export const COINS = set("coins", 2);
export const LEATHER = sfx("leather");
export const LATCH = sfx("latch");
export const ONWARD = sfx("onward");
export const ARRIVE = sfx("arrive");
export const PAGE = sfx("page");
export const SACK = sfx("sack");
export const SWING = set("swing", 2);
export const HIT = sfx("hit");
export const BLOCK = sfx("block");
export const HURT = sfx("hurt");
export const GUARD_BREAK = sfx("guard-break");
export const FALL = sfx("fall");
export const BONES = sfx("bones");
export const CLASH = set("clash", 2);
export const STEP = sfx("step");
export const DASH = sfx("dash");
export const BONG = sfx("bong");
export const GLASS = set("glass", 3);
export const ERROR = sfx("error");
export const CONFIRM = sfx("confirm");
export const CRACKLE = sfx("crackle");
export const LIT = sfx("lit");

const sounds = new Map<string, HTMLAudioElement>();
let pressed = -Infinity;

/** Plays `src`, or one of a set at random so repeats do not drone. */
export function play(src: string | readonly string[], volume = 1): void {
  const one = typeof src === "string" ? src : src[Math.floor(Math.random() * src.length)]!;
  let a = sounds.get(one);
  if (!a) sounds.set(one, (a = new Audio(one)));
  a.volume = volume;
  a.currentTime = 0;
  void a.play().catch(() => {});
}

/** Plays `src` round and round; the returned stop fades it out over half a second. */
export function loop(src: string, volume = 1): () => void {
  const a = new Audio(src);
  a.loop = true;
  a.volume = volume;
  void a.play().catch(() => {});
  return () => {
    const fade = setInterval(() => {
      a.volume = Math.max(0, a.volume - volume / 10);
      if (a.volume === 0) (clearInterval(fade), a.pause());
    }, 50);
  };
}

/** Marks a press, so a menu row it moves to does not tick over the click. */
export function press(): void {
  pressed = performance.now();
}

/** Ticks when a menu's highlighted row moves by hover or keys: not on opening, closing or a click. */
export function useTick(pick: number | null): void {
  const last = useRef(pick);
  useEffect(() => {
    const was = last.current;
    last.current = pick;
    if (was !== null && pick !== null && was !== pick && performance.now() - pressed > 250) play(CLICK);
  }, [pick]);
}
