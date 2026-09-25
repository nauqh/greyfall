// The strategic map's grid now lives in the engine, so the server can run a
// battle phase on it; this keeps the map scene's imports where they were.

export {
  MAP,
  STRAT_COLS,
  STRAT_ROWS,
  at,
  canStep,
  castsCliff,
  findPath,
  isHigh,
  isLand,
  isSlope,
  isWalkable,
  level,
  type Cell,
} from "@greyfall/engine";
