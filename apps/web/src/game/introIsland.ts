// The title screen's own island: the blue corner of the war map as it stood
// when the title scene was laid out, cut down to the town's island and frozen
// here so the war's map can change without moving the town, its cast or cliffs.
// Drawn the way islandMap.ts draws the war's.

import * as Phaser from "phaser";

import { CELL } from "./islandMap";
import { DEPTH, addDecor } from "./terrain";

const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~#########~~~~~~~~~~~~~~",
  "~~#############~~~~~~~~~~~",
  "~~#############....~~~~~~~",
  "~~#############.....~.~~~~",
  "~~..#########>.........~~~",
  "~~..............~.......~~",
  "~~~...######.....~~.....~~",
  "~~~...####>.....~~~....~~~",
  "~~~.............~~~~..~~~~",
  "~~..........~~~~~~~~~~~~~~",
  "~~..#####..~~~~~~~~~~~~~~~",
  "~~..###>..~~~~~~~~~~~~~~~~",
  "~~.......~~~~~~~~~~~~~~~~~",
  "~~~~.....~~~~~~~~~~~~~~~~~",
  "~~~~~~~..~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
const COLS = MAP[0]!.length;
const ROWS = MAP.length;
const MINES = [{ col: 15, row: 3 }];

function at(col: number, row: number): string {
  return MAP[row]?.[col] ?? "~";
}
function isLand(col: number, row: number): boolean {
  return at(col, row) !== "~";
}
function isSlope(col: number, row: number): boolean {
  return "<>".includes(at(col, row));
}

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** Foam under the shore, ground everywhere on land, then plateau tops,
 *  cliffs and slopes over it: the pack's own layer order. */
export function buildIntroIsland(scene: Phaser.Scene): void {
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

/** Lumber lines along the coasts, gold at the mine, sheep
 *  on the lowland and rocks in the shallows. */
export function buildIntroScenery(scene: Phaser.Scene): void {
  const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
    spots.map(([c, r], i) => addDecor(scene, kind, c * CELL, r * CELL, 1, `strat-${kind}-${i}`));
  put("tree", [
    [2.6, 2.4], [3.4, 1.7], [11.9, 1.9], [13.8, 2.6], [14.9, 2.3],
    [2.6, 9.8], [2.5, 11.2], [2.6, 13.4], [4.4, 14.2],
  ]);
  put("bush", [[12.5, 6.5], [18.4, 3.7], [9.6, 12.8]]);
  put("rock", [[15.5, 6.6], [11.6, 10.8]]);
  put("waterRock", [
    [1.2, 6.4], [17.5, 1.6], [13.8, 10.9], [18.3, 11.6], [10.8, 15.4], [6.2, 17.2],
    [7.5, -0.6], [20.4, -1.1], [25.3, 3.6], [24.6, 10.2],
  ]).forEach((s) => s.setDepth(DEPTH.foam));

  for (const m of MINES) {
    const x = (m.col + 0.5) * CELL;
    const y = (m.row + 0.8) * CELL;
    scene.add.image(x, y, "goldMine").setOrigin(0.5, 0.78).setDepth(DEPTH.decorBehind + y / 1000);
  }
  for (const [c, r] of [[3.3, 7.3], [12.4, 9.4]] as const) {
    const sheep = scene.add
      .sprite(c * CELL, r * CELL, "sheep")
      .setOrigin(0.5, 0.66)
      .setDepth(DEPTH.decorBehind + (r * CELL) / 1000)
      .setFlipX(c > 16)
      .play("sheep_anim");
    if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
  }
}
