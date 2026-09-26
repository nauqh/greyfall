// The title screen: the Tidewardens' town on its own island (introIsland.ts),
// its cliffs and ramps, and the garrison at drill and at work. The page's
// menu is written on a parchment scroll over the sea.

import * as Phaser from "phaser";

import { type UnitClass } from "@greyfall/engine";

import { baseZoom, fitCamera, startGame } from "./boot";
import { buildIntroIsland, buildIntroScenery } from "./introIsland";
import { CELL, WORK, cell, loadMapArt, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey, type Side } from "./sprites";
import { DEPTH, addBuilding, addDecor, addShadow, buildWater, cloudCover, driftClouds, loadBuildings, loadTerrain, prepareTerrain } from "./terrain";

/** Cells in view across a landscape screen; the westmost part is the menu
 *  scroll's, so the plateau starts just past it. */
const VIEW = { col0: -14.2, col1: 24.7, midRow: 7.2 } as const;
/** Portrait: the town, lifted clear of the menu scroll along the bottom. */
const VIEW_TALL = { col0: 1.5, col1: 17.5, midRow: 8.6 } as const;

/** How far below a unit's centre its feet stand, in px. */
const FOOT = 34;

/** The Tidewardens' town, spread wider than the war's plots: the keep on
 *  the plateau, the monastery on the knoll below it, the rest on the lowland.
 *  Each is its base's centre, in cells. */
const TOWN = [
  cell("a", "tower", 3, 3),
  cell("a", "castle", 6.5, 4),
  cell("a", "barracks", 11, 4),
  cell("a", "monastery", 8, 9),
  cell("a", "archery", 6, 12),
  cell("a", "house1", 21.5, 9),
  cell("a", "house2", 15.5, 10),
  cell("a", "house3", 18.5, 6),
];

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
  /** Standing up on a building: the row of its base, to draw just over it. */
  on?: number;
}

const CAST: readonly Extra[] = [
  // On the castle's two turrets and the tower top.
  { side: "a", cls: "archer", col: 4.52, row: 1.45, on: 4 },
  { side: "a", cls: "archer", col: 7.61, row: 1.45, on: 4, left: true },
  { side: "a", cls: "archer", col: 2.6, row: 0.68, on: 3 },
  { side: "a", cls: "warrior", col: 10.3, row: 4.6 },
  { side: "a", cls: "warrior", col: 11.5, row: 4.7, left: true },
  { side: "a", cls: "warrior", col: 4.2, row: 4.6, pace: 2 },
  { side: "a", cls: "monk", col: 14, row: 2.9, left: true },
  { side: "a", cls: "lancer", col: 7.2, row: 13.8, left: true },
  // Out on the east lobe.
  { side: "a", cls: "pawn", col: 20.2, row: 8.2, work: "hammer" },
  // At the mine east of the plateau, and one on the road to it.
  { side: "a", cls: "pawn", col: 16.3, row: 3, left: true, work: "dig" },
  { side: "a", cls: "pawn", col: 14.7, row: 4.7, pace: 2 },
  // Under the cliffs.
  { side: "a", cls: "warrior", col: 8.8, row: 9.8, pace: 1.5 },
  { side: "a", cls: "monk", col: 10.5, row: 6.9 },
  { side: "a", cls: "lancer", col: 3.2, row: 6 },
  { side: "a", cls: "archer", col: 8, row: 10.9, left: true },
];

/** The title screen's own woods, groves on the lowland round the town. */
const TREES: readonly [number, number][] = [
  [2.5, 6.9], [2.4, 8.4],
  [19.3, 4.9], [20.3, 5.6], [21.4, 5.1], [22.6, 5.8], [23.1, 6.9],
  [10.6, 10.4], [11.5, 9.9], [3.2, 12.9],
];

const SHEEP: readonly [number, number][] = [[22.2, 8.2], [19.4, 8.6], [13.4, 6.8]];

export class IntroScene extends Phaser.Scene {
  constructor() {
    super("intro");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadMapArt(this);
    loadBuildings(this, TOWN);
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
    buildIntroIsland(this);
    buildIntroScenery(this);
    for (const s of TOWN) addBuilding(this, s);
    TREES.forEach(([c, r], i) => addDecor(this, "tree", c * CELL, r * CELL, 1, `intro-tree-${i}`));
    for (const [c, r] of SHEEP) {
      const sheep = this.add
        .sprite(c * CELL, r * CELL, "sheep")
        .setOrigin(0.5, 0.66)
        .setDepth(DEPTH.decorBehind + (r * CELL) / 1000)
        .setFlipX(c > 16)
        .play("sheep_anim");
      if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
    }
    // Props sit in a band under every unit; here the cast walks among them,
    // so move them into the units' band. Units sort by their centre, their
    // feet about FOOT below it, so props sort by base minus FOOT.
    for (const o of this.children.list as Phaser.GameObjects.Image[]) {
      if (o.depth >= DEPTH.decorBehind && o.depth < DEPTH.clouds) o.setDepth(DEPTH.unit + (o.depth - DEPTH.decorBehind) * 1000 - FOOT);
    }
    for (const extra of CAST) this.addExtra(extra);
    driftClouds(this, { w: 20 * CELL, h: 12 * CELL }, "intro");
    cloudCover(this, "open", () => {});
  }

  /** One unit loafing: a shadow, a sprite, and maybe a there-and-back walk. */
  private addExtra({ side, cls, col, row, pace = 0, left, work, on }: Extra): void {
    const x = (col + 0.5) * CELL;
    const y = (row + 0.5) * CELL;
    // Up on a building the ground is its roof, which bakes in its own shade.
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62).setVisible(on === undefined);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + (on === undefined ? y : on * CELL - FOOT + 1));
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
