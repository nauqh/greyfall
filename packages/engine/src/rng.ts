/**
 * Seeded random number generator. Deterministic and dependency-free, so the
 * browser, the CLI and (in Phase 2) the server all agree on a given seed.
 *
 * mulberry32: 32-bit state, fine for game rolls, not for anything secret.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform pick. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick. Throws if every weight is <= 0. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T;
}

/** FNV-1a, so a string seed like "rematch-3" is usable as-is. */
export function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return seed >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(seed: number | string): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      const chosen = items[int(items.length)];
      if (chosen === undefined) throw new Error("pick from an empty array");
      return chosen;
    },
    weighted<T>(items: readonly { item: T; weight: number }[]): T {
      const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
      if (total <= 0) throw new Error("weighted pick needs a positive weight");
      let roll = next() * total;
      for (const i of items) {
        roll -= Math.max(0, i.weight);
        if (roll < 0) return i.item;
      }
      return items[items.length - 1]!.item; // float slop on the last entry
    },
  };
}
