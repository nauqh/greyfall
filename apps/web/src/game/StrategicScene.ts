// The Warcraft-style strategic map: an 8x20 grid of island tiles you move a
// flag cursor around, over open water, on the same sea the battle plays on.
// The board runs 8 rows tall and 20 columns long, and the camera scrolls
// left to right along it, exactly as Warcraft's map did. A curved lake cuts
// the island's middle, leaving two land lanes around it.
//
// Phase 1 of the strategic layer: look and move only. Nothing here touches
// the engine or the draft.

import * as Phaser from "phaser";

import { DPR, GAME_H, GAME_W, WATER_SPAN, fitCamera, startGame } from "./boot";
import { loadUnits, makeAnims, playPose, unitKey } from "./sprites";
import {
  DEPTH,
  addBuilding,
  addShadow,
  buildFoam,
  buildIsland,
  buildWater,
  driftClouds,
  loadBuildings,
  loadTerrain,
  prepareTerrain,
  scatterDecor,
  type Rect,
  type Structure,
} from "./terrain";
import { button, label, loadPanels, ribbon } from "./ui";

/** Strategic cells, square 84px to match the battle's TILE, so the pack's
 *  native-size art (units, halls) keeps the same ratio on both maps. 8 rows
 *  tall, 24 columns long: the map runs 2016px against the 1200px world, so
 *  it is the width that needs the pan. */
export const STRAT_COLS = 24;
export const STRAT_ROWS = 8;
const CELL = 84;
/** The grid as a rect, vertically centred in the pannable world, not in
 *  the 720px page: the 160px of water either end matches the sides, and
 *  scrolling down buys the same space above the map as below it. */
const PAD = 160;
const WORLD_W = PAD + STRAT_COLS * CELL + PAD;
const WORLD_H = GAME_H + 3 * PAD;
const STRAT: Rect = {
  x0: PAD,
  y0: (WORLD_H - STRAT_ROWS * CELL) / 2,
  x1: PAD + STRAT_COLS * CELL,
  y1: (WORLD_H - STRAT_ROWS * CELL) / 2 + STRAT_ROWS * CELL,
};

/** No lakes for now: the island is one landmass, the whole grid is land.
 *  The flag's no-swim check reads this set, so an empty set is plain land. */
const LAKE = new Set<string>();

/** How close to the screen edge the pointer pans, and how fast, in world
 *  px/s. Screen-edge scrolling, exactly as Warcraft did it. */
const EDGE = 28;
const PAN_PX_S = 840;

/** The two main halls, at the pack's native size: the knights' monastery on
 *  the bottom left, the monsters' dead tree on the top right, its crown
 *  overhanging the coast into the sea. */
const HALLS: Structure[] = [
  { side: "a", name: "monastery", x: STRAT.x0 + 0.8 * CELL, y: STRAT.y0 + 8 * CELL },
  { side: "g", name: "deadTree", x: STRAT.x0 + 23.5 * CELL, y: STRAT.y0 + 1 * CELL },
];

export class StrategicScene extends Phaser.Scene {
  /** Grid position of the flag; null until the first click. */
  private flag: { col: number; row: number } | null = null;
  private flagMark: Phaser.GameObjects.Container | null = null;
  /** Handed in by the page; absent when the map opens on its own. */
  private onMenu: () => void = () => {};
  /** Touch-drag state: where the gesture started, camera included. */
  private dragStart: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;

  init(data: { onMenu?: () => void }): void {
    this.onMenu = data.onMenu ?? (() => {});
  }

  constructor() {
    super("strategic");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadBuildings(this, HALLS);
    loadPanels(this, ["paper", "blueButton", "redButton"]);
  }

  create(): void {
    fitCamera(this, WORLD_W / 2, WORLD_H / 2);
    prepareTerrain(this);
    makeAnims(this);

    buildWater(this);
    const island = buildIsland(this, STRAT);
    buildFoam(this, island);
    scatterDecor(this, island, STRAT, { w: WORLD_W, h: WORLD_H }, "strategic");
    driftClouds(this, { w: WORLD_W, h: WORLD_H }, "strategic");
    this.buildLake();
    for (const hall of HALLS) addBuilding(this, hall);
    this.buildHud();

    // Touch drag pans; a tap (down-up with little movement) places the flag.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, camX: this.cameras.main.scrollX, camY: this.cameras.main.scrollY, moved: false };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      // Canvas px to world px: the world renders at zoom DPR.
      const dx = (p.x - this.dragStart.x) / DPR;
      const dy = (p.y - this.dragStart.y) / DPR;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.dragStart.moved = true;
      this.setScroll(this.dragStart.camX - dx, this.dragStart.camY - dy);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const start = this.dragStart;
      this.dragStart = null;
      if (!start || start.moved) return;
      const col = Math.floor((p.worldX - STRAT.x0) / CELL);
      const row = Math.floor((p.worldY - STRAT.y0) / CELL);
      if (col < 0 || col >= STRAT_COLS || row < 0 || row >= STRAT_ROWS) return;
      // Water is water: the flag never stands in the lake.
      if (LAKE.has(`${col},${row}`)) return;
      this.moveFlag(col, row);
    });
  }

  /** Scroll with the world clamps shared by edge-pan and drag. */
  private setScroll(x: number, y: number): void {
    const cam = this.cameras.main;
    const viewW = cam.width / DPR;
    const viewH = cam.height / DPR;
    const shiftX = cam.width / 2 - viewW / 2;
    const shiftY = cam.height / 2 - viewH / 2;
    cam.scrollX = Math.max(-shiftX, Math.min(WORLD_W - viewW - shiftX, x));
    cam.scrollY = Math.max(-shiftY, Math.min(WORLD_H - viewH - shiftY, y));
  }

  /** Screen-edge pan, Warcraft-style, both axes now that the world runs
   *  1200px tall against the 720px page. */
  update(_time: number, delta: number): void {
    const p = this.input.activePointer;
    // Pointer coordinates are canvas pixels; the world renders at zoom DPR,
    // so the edge test converts back to world units first.
    const vx = p.x / DPR;
    const vy = p.y / DPR;
    const dx = vx < EDGE ? -1 : vx > GAME_W - EDGE ? 1 : 0;
    const dy = vy < EDGE ? -1 : vy > GAME_H - EDGE ? 1 : 0;
    const cam = this.cameras.main;
    if (dx !== 0 || dy !== 0) {
      this.setScroll(
        cam.scrollX + (dx * PAN_PX_S * delta) / 1000,
        cam.scrollY + (dy * PAN_PX_S * delta) / 1000,
      );
    }
  }

  private moveFlag(col: number, row: number): void {
    this.flag = { col, row };
    const { x, y } = this.cellXY(col, row);
    if (!this.flagMark) {
      const shadow = addShadow(this, x, y, 0.5);
      // Above the lake's buried grass, which restamps at ground level.
      shadow.setDepth(DEPTH.ground + 2);
      const sprite = this.add.sprite(x, y, unitKey("a", "pawn", "idle"));
      playPose(sprite, "a", "pawn", "idle");
      this.flagMark = this.add.container(x, y, [shadow, sprite]);
      sprite.setDepth(1);
      shadow.setDepth(0);
      this.flagMark.setDepth(DEPTH.unit + y);
    }
    this.flagMark.setPosition(x, y);
    this.flagMark.setDepth(DEPTH.unit + y);
  }

  private cellXY(col: number, row: number): { x: number; y: number } {
    return {
      x: STRAT.x0 + col * CELL + CELL / 2,
      y: STRAT.y0 + row * CELL + CELL / 2,
    };
  }

  /** The lake stamped over the grass. The foam is the island's own trick
   *  folded inside out: each blob is centred on the land cell beside the
   *  water and buried back under grass, so only its fringe pokes into the
   *  lake - the same lip the island's edge leaves in the sea, not white
   *  squares floating on the water. */
  private buildLake(): void {
    const waterZ = DEPTH.island + 1;
    const foamZ = waterZ + 0.5;
    const grassZ = waterZ + 1;
    for (const key of LAKE) {
      const [col, row] = key.split(",").map(Number) as [number, number];
      const { x, y } = this.cellXY(col, row);
      this.add.image(x, y, "water").setDisplaySize(CELL, CELL).setDepth(waterZ);
    }
    const foamCells = new Set<string>();
    for (const key of LAKE) {
      const [col, row] = key.split(",").map(Number) as [number, number];
      for (const [nc, nr] of [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ] as const) {
        if (nc < 0 || nc >= STRAT_COLS || nr < 0 || nr >= STRAT_ROWS) continue;
        if (!LAKE.has(`${nc},${nr}`)) foamCells.add(`${nc},${nr}`);
      }
    }
    for (const key of foamCells) {
      const [col, row] = key.split(",").map(Number) as [number, number];
      const { x, y } = this.cellXY(col, row);
      const foam = this.add.sprite(x, y, "foam").setDepth(foamZ).play("foam_anim");
      // The island's edge laps in step on purpose; a lake reads more natural
      // out of rhythm, so every blob starts at its own frame and drifts at
      // its own pace - the shared anim runs 8fps, this lands the blobs
      // around 4-5fps without touching the island's shore.
      if (foam.anims.currentAnim) {
        foam.anims.setProgress(Math.random());
        foam.anims.timeScale = 0.55 + Math.random() * 0.15;
      }
      // Bury each blob's body under grass again - centre and all eight
      // neighbours, the blob overhangs every one - leaving only the fringe
      // over the water. Stretched to the cell: the tile is 64px native and
      // cells run 84px, so at native size it would leave seams the foam
      // shows through.
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (LAKE.has(`${col + dc},${row + dr}`)) continue;
          const p = this.cellXY(col + dc, row + dr);
          this.add.image(p.x, p.y, "tileset", "t11").setDisplaySize(CELL, CELL).setDepth(grassZ);
        }
      }
    }
  }

  /** Title ribbon while there is nothing else on the map. */
  private buildHud(): void {
    // The camera pans, so the plates ride the screen, not the world.
    ribbon(this, GAME_W / 2, 52, 380).setDepth(DEPTH.hud).setScrollFactor(0);
    label(this, GAME_W / 2, 48, "THE GREYFALL COAST", { fontSize: "20px" })
      .setDepth(DEPTH.hud + 2)
      .setScrollFactor(0);
    button(this, 90, GAME_H - 84, 140, 88, "Back", "red", () => this.onMenu())
      .setScale(0.8)
      .setDepth(DEPTH.hud + 2)
      .setScrollFactor(0);
  }
}

/** What the page hands the map. Nothing for now but the way back. */
export interface StrategicLauncher {
  onMenu: () => void;
}

export function startStrategic(
  parent: HTMLElement,
  launcher: StrategicLauncher,
): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "strategic", StrategicScene, launcher);
}
