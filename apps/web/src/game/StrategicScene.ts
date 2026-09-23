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
  addShadow,
  buildFoam,
  buildIsland,
  buildWater,
  driftClouds,
  loadTerrain,
  prepareTerrain,
  scatterDecor,
  type Rect,
} from "./terrain";
import { button, label, loadPanels, ribbon } from "./ui";

/** Strategic cells, square 64px like the terrain art. 8 rows tall, 20
 *  columns long: the map runs 1280px against the 1200px world, so it is the
 *  width that needs the pan. */
export const STRAT_COLS = 20;
export const STRAT_ROWS = 8;
const CELL = 64;
/** The grid as a rect, vertically centred. The 160px of water either end
 *  matches, so the coast never touches the edge of the scroll. */
const PAD = 160;
const STRAT: Rect = {
  x0: PAD,
  y0: (GAME_H - STRAT_ROWS * CELL) / 2,
  x1: PAD + STRAT_COLS * CELL,
  y1: (GAME_H - STRAT_ROWS * CELL) / 2 + STRAT_ROWS * CELL,
};
/** The whole pannable world: the map plus its water padding. */
const WORLD_W = STRAT.x1 + PAD;

/**
 * The lake: every cell of water in it, keyed "col,row".
 *
 * A band across the island's middle whose two shores are separate, phase-
 * shifted sine curves, so the shape wobbles organically instead of reading
 * as a drawn oval. Rows are clamped to 2..5, which is what leaves the two
 * land lanes - rows 0..1 above, 6..7 below - to cross left to right.
 */
const LAKE = new Set<string>();
for (let col = 5; col <= 14; col++) {
  const t = (col - 5) / 9;
  const top = Math.max(2, 2 + Math.round(0.9 * Math.sin(t * Math.PI * 1.7) + 0.4 * Math.sin(col * 1.9)));
  const bot = Math.min(5, 5 - Math.round(0.9 * Math.sin(t * Math.PI * 1.3 + 1.6) + 0.4 * Math.sin(col * 1.4 + 2)));
  for (let row = top; row <= bot; row++) LAKE.add(`${col},${row}`);
}

/** How close to the screen edge the pointer pans, and how fast, in world
 *  px/s. Screen-edge scrolling, exactly as Warcraft did it. */
const EDGE = 28;
const PAN_PX_S = 420;

export class StrategicScene extends Phaser.Scene {
  /** Grid position of the flag; null until the first click. */
  private flag: { col: number; row: number } | null = null;
  private flagMark: Phaser.GameObjects.Container | null = null;
  /** Handed in by the page; absent when the map opens on its own. */
  private onMenu: () => void = () => {};

  init(data: { onMenu?: () => void }): void {
    this.onMenu = data.onMenu ?? (() => {});
  }

  constructor() {
    super("strategic");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadPanels(this, ["paper", "blueButton", "redButton"]);
  }

  create(): void {
    fitCamera(this);
    prepareTerrain(this);
    makeAnims(this);

    buildWater(this);
    const island = buildIsland(this, STRAT);
    buildFoam(this, island);
    scatterDecor(this, island, STRAT, { w: WORLD_W, h: GAME_H }, "strategic");
    driftClouds(this, { w: WORLD_W, h: GAME_H }, "strategic");
    this.buildLake();
    this.buildHud();

    this.input.on("pointerdown", () => {
      const p = this.input.activePointer;
      const col = Math.floor((p.worldX - STRAT.x0) / CELL);
      const row = Math.floor((p.worldY - STRAT.y0) / CELL);
      if (col < 0 || col >= STRAT_COLS || row < 0 || row >= STRAT_ROWS) return;
      // Water is water: the flag never stands in the lake.
      if (LAKE.has(`${col},${row}`)) return;
      this.moveFlag(col, row);
    });
  }

  /** Screen-edge pan, Warcraft-style. Only horizontal: the 8-row map stands
   *  centred in the 720px world, so scrollY stays clamped at 0 and only the
   *  length of the coast scrolls. */
  update(_time: number, delta: number): void {
    const p = this.input.activePointer;
    // Pointer coordinates are canvas pixels; the world renders at zoom DPR,
    // so the edge test converts back to world units first.
    const vx = p.x / DPR;
    const dx = vx < EDGE ? -1 : vx > GAME_W - EDGE ? 1 : 0;
    const cam = this.cameras.main;
    if (dx !== 0) cam.scrollX += (dx * PAN_PX_S * delta) / 1000;
    // The DPR zoom shifts what scrollX means: the view's left edge sits
    // `shift` world px right of scrollX, so the clamp runs against that, not
    // against 0. Gets the full range whatever the window's width.
    const viewW = cam.width / DPR;
    const shift = cam.width / 2 - viewW / 2;
    cam.scrollX = Math.max(-shift, Math.min(WORLD_W - viewW - shift, cam.scrollX));
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
      // out of rhythm, so every blob starts at its own frame.
      if (foam.anims.currentAnim) foam.anims.setProgress(Math.random());
      // Bury each blob's body under grass again - centre and all eight
      // neighbours, the blob overhangs every one - leaving only the fringe
      // over the water.
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (LAKE.has(`${col + dc},${row + dr}`)) continue;
          const p = this.cellXY(col + dc, row + dr);
          this.add.image(p.x, p.y, "tileset", "t11").setDepth(grassZ);
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
