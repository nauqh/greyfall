// The title screen: a quiet corner of the war map, drawn by the same code as
// the map scene. The Tidewardens' plateau, its castle, cliffs and ramp, and a
// few of their own. The page's menu floats on a cloud bank over the sea.

import * as Phaser from "phaser";

import { PLOTS, type UnitClass } from "@greyfall/engine";

import { baseZoom, fitCamera, startGame } from "./boot";
import { CELL, WORK, artOf, buildMap, buildScenery, cell, loadMapArt, makeMapAnims, plotBase } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey, type Side } from "./sprites";
import { DEPTH, addBuilding, addShadow, buildWater, cloudCover, driftClouds, loadBuildings, loadTerrain, prepareTerrain } from "./terrain";

/** Cells in view across a landscape screen; the westmost third is the cloud
 *  bank's, so the plateau starts just past the menu. */
const VIEW = { col0: -9, col1: 20, midRow: 5.2 } as const;
/** Portrait: the plateau and its ramp, lifted clear of the southern bank. */
const VIEW_TALL = { col0: 1.5, col1: 17.5, midRow: 7.2 } as const;

/** Only the castle stands; the empty plateau is the war still to come. */
const HOME = PLOTS.filter((p) => p.side === "a" && p.kind === "castle");

/** The cast, in cells. `pace` is how many cells a unit walks from its spot
 *  and back, signed for which way it sets off; 0 keeps it rooted. */
interface Extra {
  side: Side;
  cls: UnitClass;
  col: number;
  row: number;
  pace?: number;
  /** The art faces right; set to mirror. */
  left?: boolean;
  /** A Pawn's work loop instead of idle. */
  work?: keyof typeof WORK;
}

const CAST: readonly Extra[] = [
  { side: "a", cls: "warrior", col: 5, row: 4, pace: 3 },
  { side: "a", cls: "archer", col: 9, row: 2.6 },
  // At the mine east of the plateau.
  { side: "a", cls: "pawn", col: 16, row: 3, left: true, work: "dig" },
];

export class IntroScene extends Phaser.Scene {
  constructor() {
    super("intro");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadMapArt(this);
    loadBuildings(this, HOME.map((p) => cell(p.side, artOf(p), 0, 0)));
  }

  create(): void {
    const view = (): typeof VIEW | typeof VIEW_TALL => (this.scale.width / this.scale.height > 1.2 ? VIEW : VIEW_TALL);
    fitCamera(
      this,
      () => ((view().col0 + view().col1) / 2) * CELL,
      () => view().midRow * CELL,
      // Fit the columns across, whatever that shows top to bottom.
      () => this.scale.width / ((view().col1 - view().col0) * CELL) / baseZoom(this),
    );
    prepareTerrain(this);
    makeAnims(this);
    makeMapAnims(this);

    buildWater(this);
    buildMap(this);
    buildScenery(this);
    for (const p of HOME) {
      const { x, y } = plotBase(p);
      addBuilding(this, cell(p.side, artOf(p), x / CELL, y / CELL));
    }
    for (const extra of CAST) this.addExtra(extra);
    driftClouds(this, { w: 20 * CELL, h: 12 * CELL }, "intro");
    cloudCover(this, "open", () => {});
  }

  /** One unit loafing: a shadow, a sprite, and maybe a there-and-back walk. */
  private addExtra({ side, cls, col, row, pace = 0, left, work }: Extra): void {
    const x = (col + 0.5) * CELL;
    const y = (row + 0.5) * CELL;
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + y);
    playPose(sprite, side, cls, "idle");
    if (work) sprite.play(WORK[work].key);
    if (sprite.anims.currentAnim) sprite.anims.setProgress(Math.random());
    if (left !== undefined) sprite.setFlipX(left);
    if (pace === 0) return;

    let dir = Math.sign(pace);
    const step = Math.abs(pace) * CELL;
    const leg = (): void => {
      playPose(sprite, side, cls, "run");
      sprite.setFlipX(dir < 0);
      this.tweens.add({
        targets: [sprite, shadow],
        x: `+=${dir * step}`,
        duration: step * 26,
        onUpdate: () => sprite.setDepth(DEPTH.unit + sprite.y),
        onComplete: () => {
          playPose(sprite, side, cls, "idle");
          sprite.setFlipX(dir < 0);
          dir = -dir;
          // Long enough to read as a pause, jittered so no two fall in step.
          this.time.delayedCall(1200 + Math.random() * 2600, leg);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2400, leg);
  }
}

export function startIntro(parent: HTMLElement): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "intro", IntroScene);
}
