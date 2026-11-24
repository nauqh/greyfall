import { useEffect, useRef } from "react";

// Every file is in public/audio, sorted by where it is heard and named for what it does; public/audio/CREDITS.md gives each one's source and license.
const sfx = (name: string): string => `/audio/${name}.ogg`;
const set = (name: string, n: number): string[] => Array.from({ length: n }, (_, i) => sfx(`${name}-${i + 1}`));
export const CLICK = "/audio/ui/click.flac";
export const COINS = set("items/coins", 2);
export const LEATHER = sfx("items/leather");
export const LATCH = sfx("items/latch");
export const ONWARD = sfx("world/onward");
export const ARRIVE = sfx("world/arrive");
export const PAGE = sfx("ui/page");
export const SACK = sfx("ui/sack");
export const SWING = set("combat/swing", 2);
export const HIT = sfx("combat/hit");
export const BLOCK = sfx("combat/block");
export const HURT = sfx("combat/hurt");
export const GUARD_BREAK = sfx("combat/guard-break");
export const FALL = sfx("combat/fall");
export const BONES = sfx("combat/bones");
export const CLASH = set("world/clash", 2);
export const STEP = sfx("world/step");
export const DASH = sfx("world/dash");
export const HERALD = sfx("ui/herald");
export const GLASS = set("items/glass", 3);
export const ERROR = sfx("ui/error");
export const CONFIRM = sfx("ui/confirm");
export const CRACKLE = sfx("world/crackle");
export const LIT = sfx("world/lit");
export const TROLL_GROWL = sfx("troll/growl");
export const TROLL_FALL = sfx("troll/fall");
export const TROLL_LAND = sfx("troll/land");
export const TROLL_ROAR = sfx("troll/roar");
export const TROLL_TELL: Partial<Record<string, string>> = { slam: sfx("troll/tell-slam"), sweep: sfx("troll/tell-sweep"), charge: sfx("troll/tell-charge"), toss: sfx("troll/tell-toss") };
export const TROLL_SLAM = sfx("troll/slam");
export const TROLL_CHARGE = sfx("troll/charge");
export const TROLL_ROCK = sfx("troll/rock");
export const TROLL_DAZED = sfx("troll/dazed");
export const TROLL_STEP = sfx("troll/step");
export const BOSS_MUSIC = sfx("music/boss");
export const LANDING_MUSIC = sfx("music/landing");

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

/** Plays `src` round and round; the returned stop fades it out over `fadeMs`. */
export function loop(src: string, volume = 1, fadeMs = 500): () => void {
  const a = new Audio(src);
  a.loop = true;
  a.volume = volume;
  // A browser holds sound back until the page is touched: failing that, the first key or click starts it.
  const start = (): void => void a.play().then(unhook, () => {});
  const unhook = (): void => {
    window.removeEventListener("keydown", start, true);
    window.removeEventListener("pointerdown", start, true);
  };
  window.addEventListener("keydown", start, true);
  window.addEventListener("pointerdown", start, true);
  start();
  return () => {
    unhook();
    const fade = setInterval(() => {
      a.volume = Math.max(0, a.volume - volume / 10);
      if (a.volume === 0) (clearInterval(fade), a.pause());
    }, fadeMs / 10);
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
