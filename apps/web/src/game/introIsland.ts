// A small island from rows of the war's map alphabet, drawn the way
// islandMap.ts draws the war's.

import { WAR_ISLAND, useIsland } from "@greyfall/engine";
import * as Phaser from "phaser";

import { CELL, buildMap } from "./islandMap";
import { DEPTH } from "./terrain";

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** Foam under the shore, ground everywhere on land, then plateau tops,
 *  cliffs and slopes over it: the pack's own layer order. `map` is the
 *  island's rows. */
export function buildIntroIsland(scene: Phaser.Scene, map: readonly string[]): void {
  const [COLS, ROWS] = [map[0]!.length, map.length];
  const at = (col: number, row: number): string => map[row]?.[col] ?? "~";
  const isLand = (col: number, row: number): boolean => at(col, row) !== "~";
  const isSlope = (col: number, row: number): boolean => "<>".includes(at(col, row));
  const tile = (c: number, r: number, tc: number, tr: number, z: number, sheet = "tileset"): void => {
    scene.add.image(c * CELL, r * CELL, sheet, `tile_${tc}_${tr}`).setOrigin(0).setDepth(z);
  };
  const plateau = (c: number, r: number): boolean => at(c, r) === "#";
  // A cliff face stands in every cell under a plateau or ramp that is not
  // plateau itself - behind a ramp too, so the ramp reads as cut into the
  // rock rather than laid on the lawn.
  const wall = (c: number, r: number): boolean => (plateau(c, r - 1) || isSlope(c, r - 1)) && !plateau(c, r);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let shore = false;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) shore ||= !isLand(c + dc, r + dr);
      }
      // Under every shore cell and every cliff standing in the sea, each
      // on its own frame, as the pack's tilemap guide asks.
      if ((isLand(c, r) && shore) || (!isLand(c, r) && wall(c, r))) {
        const foam = scene.add.sprite(c * CELL + CELL / 2, r * CELL + CELL / 2, "foam").setDepth(DEPTH.foam);
        foam.play("foam_anim");
        if (foam.anims.currentAnim) foam.anims.setProgress(Math.random());
      }
      if (isLand(c, r)) {
        const tc = edge(isLand(c - 1, r), isLand(c + 1, r));
        tile(c, r, tc, edge(isLand(c, r - 1), isLand(c, r + 1)), DEPTH.island, "tilesetLow");
      }
    }
  }
  // The guide's shadow: one per elevated tile, a whole tile below it, so
  // it pools at the cliff foot and rims the sides. A ramp's foot already
  // stands on the lowland, so only its head casts one.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (plateau(c, r) || isSlope(c, r)) {
        scene.add.image(c * CELL + CELL / 2, (r + 1) * CELL + CELL / 2, "shadow_src").setDepth(DEPTH.island + 0.25);
      }
    }
  }
  // Tops, then walls, then ramps over the walls. Beside a ramp a top runs
  // on without a side edge, as the guide's stair examples show; above one
  // it keeps its rim. Walls cap where the run ends; row 4 stands on grass,
  // row 5 in water. Walls take the lowland colour: the tufts at their foot
  // are the ground below.
  const top = DEPTH.island + 0.5;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (plateau(c, r)) {
        const side = (dc: number): boolean => plateau(c + dc, r) || isSlope(c + dc, r);
        tile(c, r, 5 + edge(side(-1), side(1)), edge(plateau(c, r - 1), plateau(c, r + 1)), top);
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (wall(c, r)) tile(c, r, 5 + edge(wall(c - 1, r), wall(c + 1, r)), isLand(c, r) ? 4 : 5, top, "tilesetLow");
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isSlope(c, r)) continue;
      const col = at(c, r) === "<" ? 0 : 3;
      tile(c, r, col, 4, top);
      tile(c, r + 1, col, 5, top);
    }
  }
}

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
