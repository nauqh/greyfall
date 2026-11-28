// A small island from rows of the war's map alphabet, drawn the way
// islandMap.ts draws the war's.

import { WAR_ISLAND, useIsland } from "@greyfall/engine";
import * as Phaser from "phaser";

import { buildMap } from "./islandMap";

/** A mode's own title island, drawn by the war's builder from rows in the
 *  engine's map alphabet (". # ^ 4 5" for levels 1-5, "> [ { (" for ramps),
 *  each level its ground colour from `ramp` (tilesetC1..C5 by level, lowest
 *  first; keep each step up as bright or brighter, C1 the sunlit). Needs
 *  loadGroundColours. The engine map is the war's again after. */
export function buildTerraces(scene: Phaser.Scene, rows: readonly string[], ramp: readonly number[] = [5, 3, 2, 1]): void {
  useIsland({ ...WAR_ISLAND, rows });
  buildMap(scene, new Set(), (_c, _r, lv) => `tilesetC${ramp[Math.min(ramp.length, lv) - 1]}`);
  useIsland(WAR_ISLAND);
}
