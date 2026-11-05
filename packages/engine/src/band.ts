// The captain's band: up to three companions hired for gold, who follow, take the captain's target, or hold a spot.
// The scene moves them; what each does next, and who a monster goes for, come from here.

import { tileDistance, type Cell } from "./island.ts";

export type CompanionKind = "lancer" | "archer";
export type BandOrder = "follow" | "attack" | "hold";

export interface CompanionStats {
  hp: number;
  attack: number;
  /** Seconds between blows. */
  every: number;
  /** Tiles a second. */
  speed: number;
  /** Tiles it strikes from: a lance beside, a bow from afar. */
  range: number;
  /** Gold to hire. */
  cost: number;
}

/** GAME.md's band: the Lancer a tank who draws the monsters, the Archer shooting from five tiles back. */
export const COMPANIONS: Record<CompanionKind, CompanionStats> = {
  lancer: { hp: 120, attack: 9, every: 2.0, speed: 2.8, range: 1, cost: 75 },
  archer: { hp: 70, attack: 7, every: 2.2, speed: 2.8, range: 5, cost: 60 },
};

export const BAND_SIZE = 3;
/** On follow, a companion defends the captain against monsters this near them, and keeps this close. */
const GUARD = 4;
const CLOSE = 2;

/** A hire, if there is room in the band and gold enough. */
export function hire(gold: number, band: readonly CompanionKind[], kind: CompanionKind): { gold: number; band: CompanionKind[] } | null {
  const cost = COMPANIONS[kind].cost;
  if (band.length >= BAND_SIZE || gold < cost) return null;
  return { gold: gold - cost, band: [...band, kind] };
}

export type Plan = { do: "strike"; foe: number } | { do: "close"; foe: number } | { do: "go"; to: Cell } | { do: "stay" };

/**
 * What a companion does now, `foes` being the monsters still standing (an index in it names one). Follow: fight what
 * comes near the captain, else keep close. Attack: the captain's target if there is one, else as follow. Hold: only
 * what is in reach of the spot it holds, never leaving it.
 */
export function companionPlan(
  me: Cell,
  kind: CompanionKind,
  order: BandOrder,
  captain: Cell,
  target: number,
  foes: readonly Cell[],
  post: Cell,
): Plan {
  const range = COMPANIONS[kind].range;
  const nearest = (ok: (f: Cell) => boolean): number => {
    let best = -1;
    foes.forEach((f, i) => {
      if (ok(f) && (best < 0 || tileDistance(f, me) < tileDistance(foes[best]!, me))) best = i;
    });
    return best;
  };
  if (order === "hold") {
    const foe = nearest((f) => tileDistance(f, me) <= range);
    if (foe >= 0) return { do: "strike", foe };
    return tileDistance(me, post) === 0 ? { do: "stay" } : { do: "go", to: post };
  }
  const foe = order === "attack" && target >= 0 ? target : nearest((f) => tileDistance(f, captain) <= GUARD);
  if (foe >= 0) return tileDistance(foes[foe]!, me) <= range ? { do: "strike", foe } : { do: "close", foe };
  return tileDistance(me, captain) > CLOSE ? { do: "go", to: captain } : { do: "stay" };
}

/**
 * Who a monster goes for among those it can see (within `aggro`): a Lancer first, who draws it, else the nearest.
 * -1 when none.
 */
export function foeTarget(foe: Cell, aggro: number, bodies: readonly { at: Cell; draws: boolean }[]): number {
  let best = -1;
  bodies.forEach((b, i) => {
    if (tileDistance(b.at, foe) > aggro) return;
    const cur = bodies[best];
    if (!cur || (b.draws && !cur.draws) || (b.draws === cur.draws && tileDistance(b.at, foe) < tileDistance(cur.at, foe))) best = i;
  });
  return best;
}
