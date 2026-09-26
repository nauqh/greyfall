// The war map's island, drawn from the engine's height map. Shared by the map
// scene and the title screen, which frames a corner of the same island.

import { MINES, type BuildingKind, type Plot } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl, type BuildingName } from "./art";
import { STRAT_COLS, STRAT_ROWS, at, isLand, isSlope } from "./stratMap";
import { unitKey } from "./sprites";
import { DEPTH, addDecor, type Structure } from "./terrain";

/** The tileset's native tile: nothing is stretched. */
export const CELL = 64;

/** Work loops for a Pawn standing at its job: the pickaxe at a mine, the
 *  hammer at a plot. The Gnome has neither, so its swing does both. */
export const WORK = {
  dig: { key: "pawnDig", file: "Units/Blue Units/Pawn/Pawn_Interact Pickaxe.png" },
  hammer: { key: "pawnHammer", file: "Units/Blue Units/Pawn/Pawn_Interact Hammer.png" },
} as const;

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** Placed in cells, so a building's base lands on the row it names. */
export function cell(side: Structure["side"], name: Structure["name"], col: number, row: number, scale?: number): Structure {
  return { side, name, x: col * CELL, y: row * CELL, scale };
}

const ART: Record<BuildingKind, BuildingName> = {
  castle: "castle",
  barracks: "barracks",
  archery: "archery",
  tower: "tower",
  monastery: "monastery",
  house: "house1",
};

/** The pack's three house fronts, one per house plot. */
export function artOf(p: Plot): BuildingName {
  if (p.kind !== "house") return ART[p.kind];
  return `house${p.id.slice(-1)}` as BuildingName;
}

/** Where a plot's art stands: centred on its footprint, base on its last row. */
export function plotBase(p: Plot): { x: number; y: number } {
  return { x: (p.col + p.w / 2) * CELL, y: (p.row + p.h) * CELL };
}

/** The map's art beyond terrain and units: lowland grass, the Pawns' work
 *  loops, gold and sheep. */
export function loadMapArt(scene: Phaser.Scene): void {
  // Lowland grass in the sheet's deeper green, as the pack's demo map does:
  // the plateaus keep the sunlit colour1, so height reads as colour too.
  scene.load.image("tilesetLow", packUrl("Terrain/Tileset/Tilemap_color3.png"));
  for (const w of Object.values(WORK)) scene.load.spritesheet(w.key, packUrl(w.file), { frameWidth: 192, frameHeight: 192 });
  scene.load.image("goldMine", packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png"));
  scene.load.spritesheet("sheep", packUrl("Terrain/Resources/Meat/Sheep/Sheep_Idle.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
}

export function makeMapAnims(scene: Phaser.Scene): void {
  for (const w of Object.values(WORK)) {
    if (!scene.anims.exists(w.key)) scene.anims.create({ key: w.key, frames: scene.anims.generateFrameNumbers(w.key), frameRate: 10, repeat: -1 });
  }
  if (!scene.anims.exists("gnomeWork")) {
    scene.anims.create({ key: "gnomeWork", frames: scene.anims.generateFrameNumbers(unitKey("b", "pawn", "attack")), frameRate: 10, repeat: -1 });
  }
  if (!scene.anims.exists("sheep_anim")) {
    scene.anims.create({ key: "sheep_anim", frames: scene.anims.generateFrameNumbers("sheep"), frameRate: 8, repeat: -1 });
  }
}

/** Foam under the shore, ground everywhere on land, then plateau tops,
 *  cliffs and slopes over it: the pack's own layer order. */
export function buildMap(scene: Phaser.Scene): void {
  const tile = (c: number, r: number, tc: number, tr: number, z: number, sheet = "tileset"): void => {
    scene.add.image(c * CELL, r * CELL, sheet, `tile_${tc}_${tr}`).setOrigin(0).setDepth(z);
  };
  const plateau = (c: number, r: number): boolean => at(c, r) === "#";
  // A cliff face stands in every cell under a plateau or ramp that is not
  // plateau itself - behind a ramp too, so the ramp reads as cut into the
  // rock rather than laid on the lawn.
  const wall = (c: number, r: number): boolean => (plateau(c, r - 1) || isSlope(c, r - 1)) && !plateau(c, r);

  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
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
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
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
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      if (plateau(c, r)) {
        const side = (dc: number): boolean => plateau(c + dc, r) || isSlope(c + dc, r);
        tile(c, r, 5 + edge(side(-1), side(1)), edge(plateau(c, r - 1), plateau(c, r + 1)), top);
      }
    }
  }
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      if (wall(c, r)) tile(c, r, 5 + edge(wall(c - 1, r), wall(c + 1, r)), isLand(c, r) ? 4 : 5, top, "tilesetLow");
    }
  }
  for (let r = 0; r < STRAT_ROWS; r++) {
    for (let c = 0; c < STRAT_COLS; c++) {
      if (!isSlope(c, r)) continue;
      const col = at(c, r) === "<" ? 0 : 3;
      tile(c, r, col, 4, top);
      tile(c, r + 1, col, 5, top);
    }
  }
}

/** Lumber lines along the coasts, gold where the engine's mines are, sheep
 *  on the lowland and rocks in the shallows. */
export function buildScenery(scene: Phaser.Scene): void {
  const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
    spots.map(([c, r], i) => addDecor(scene, kind, c * CELL, r * CELL, 1, `strat-${kind}-${i}`));
  put("tree", [
    [2.6, 2.4], [3.4, 1.7], [11.9, 1.9], [13.8, 2.6], [14.9, 2.3],
    [23.5, 1.9], [24.6, 1.6], [25.8, 1.9], [27.0, 1.7], [28.5, 2.4], [29.8, 2.9], [30.4, 4.3],
    [2.6, 9.8], [2.5, 11.2], [2.6, 13.4], [4.4, 14.2],
    [15.8, 15.8], [17.0, 16.6], [13.6, 17.8], [29.4, 13.6],
  ]);
  put("bush", [[12.5, 6.5], [18.4, 3.7], [9.6, 12.8], [22.7, 9.5], [21.3, 17.6], [3.4, 18.6]]);
  put("rock", [[15.5, 6.6], [26.6, 6.5], [11.6, 10.8], [8.4, 16.6]]);
  put("waterRock", [
    [1.2, 6.4], [17.5, 1.6], [13.8, 10.9], [18.3, 11.6], [10.8, 15.4], [24.5, 18.2], [31.0, 11.5], [6.2, 18.5],
    [7.5, -0.6], [20.4, -1.1], [29.2, -0.4],
  ]).forEach((s) => s.setDepth(DEPTH.foam));

  for (const m of MINES) {
    const x = (m.col + 0.5) * CELL;
    const y = (m.row + 0.8) * CELL;
    scene.add.image(x, y, "goldMine").setOrigin(0.5, 0.78).setDepth(DEPTH.decorBehind + y / 1000);
  }
  for (const [c, r] of [[3.3, 7.3], [12.4, 9.4], [25.4, 10.6], [27.6, 11.4]] as const) {
    const sheep = scene.add
      .sprite(c * CELL, r * CELL, "sheep")
      .setOrigin(0.5, 0.66)
      .setDepth(DEPTH.decorBehind + (r * CELL) / 1000)
      .setFlipX(c > 16)
      .play("sheep_anim");
    if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
  }
}
