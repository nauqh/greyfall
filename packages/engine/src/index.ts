export {
  BALANCE,
  MAX_TICKS,
  TICKS_PER_ACTION,
  UNIT_CLASSES,
  damageAgainst,
  type UnitClass,
  type UnitStats,
} from "./balance.ts";

export { hashSeed, makeRng, type Rng } from "./rng.ts";

export {
  armyCost,
  battleCol,
  chebyshev,
  simulate,
  validateArmy,
  type Army,
  type BattleEvent,
  type BattleResult,
  type Placement,
  type Side,
  type UnitSnapshot,
} from "./simulate.ts";

export { generateArmy } from "./army.ts";
