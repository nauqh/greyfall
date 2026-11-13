// The title backdrop while Duel is picked: two rival shores across a strait,
// blue's tall stepped crag under its tower, red's low jagged reef of pirate
// towers, and one land bridge between them where two warriors cross blades.

import { type UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, cell, loadGroundColours, loadMapArt, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey, type Side } from "./sprites";
import { DEPTH, FOOT, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

/** Blue's crag to the west, red's reef to the east: no mirror, each its own coast. */
const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~####~~~~~~~~~~~~~~~~~~~~~~",
  "~~~##^^^###~~~~~~~~~~~##~~~~~~",
  "~~##^^444^##~~~~~~~~~###^^^##~",
  "~~#^^^4444^##~~~~~~~####^^^^##",
  "~~#^^^4444}#~~~~~~~###^^^^^^^#",
  "~~##^^^^^^^#~~~~~~~##^^^^^^^##",
  "~~~#^^^^^###~~~~~~~#[^^^^^^^^#",
  "~~~##^^^^]#~~~~~~~~##########~",
  "~~..#######.~~~~~~~~~#########",
  "~~...######>.~~~~~~.<########.",
  "~~~...........~~~.............",
  "~~~~.......................~~~",
  "~~~~~.......~~~~~~~.........~~",
  "~~~~~~...~~~~~~~~~~~~....~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
const COLS = MAP[0]!.length;

/** Landscape keeps the west third clear for the menu board; portrait centres the bridge. */
const VIEW = { col0: -13, col1: 30.5, midRow: 7.4 } as const;
const VIEW_TALL = { col0: 4.5, col1: 25.5, midRow: 9 } as const;

/** Blue builds in stone on its crag; red keeps pirate towers on the reef and out at sea. */
export const TOWERS = [
  cell("a", "tower", 7.6, 5.9),
  cell("a", "barracks", 7.5, 10.6),
  cell("g", "pirateTower", 24.6, 7.7),
  cell("b", "barracks", 24.5, 10.6),
  cell("g", "waterTower", 28.6, 13.4),
];

/** Each side's cast in cells, as IntroScene's. */
interface Extra {
  cls: UnitClass;
  col: number;
  row: number;
  pace?: number;
  left?: boolean;
  /** Standing up on a building: the row of its base. */
  on?: number;
}

const CAST: Record<"a" | "b", readonly Extra[]> = {
  a: [
    { cls: "archer", col: 7.2, row: 3.58, on: 5.9 },
    { cls: "lancer", col: 3.7, row: 4.9 },
    { cls: "monk", col: 4.6, row: 3.1 },
    { cls: "warrior", col: 4.5, row: 6.2, pace: 3 },
    { cls: "archer", col: 9.4, row: 6.6 },
    { cls: "pawn", col: 3.2, row: 11.3, pace: 4 },
    { cls: "warrior", col: 11.6, row: 11.6 },
    { cls: "monk", col: 9.8, row: 12.4 },
  ],
  b: [
    { cls: "archer", col: 21.4, row: 6, left: true },
    { cls: "lancer", col: 26.6, row: 4.6, left: true },
    { cls: "monk", col: 24.6, row: 3.4, left: true },
    { cls: "warrior", col: 22.2, row: 8.4, pace: 3 },
    { cls: "archer", col: 27.6, row: 9.3, left: true },
    { cls: "pawn", col: 20.6, row: 11.3, pace: 4 },
    { cls: "warrior", col: 17.4, row: 11.6, left: true },
    { cls: "monk", col: 19.2, row: 12.4, left: true },
  ],
};

/** Props by their spot in cells. */
const TREES: readonly [number, number][] = [[4.6, 1.6], [9.6, 2.6], [3.2, 9.9], [5.4, 13.4], [2.6, 10.6], [22.6, 2.6], [28.6, 4.6], [19.4, 13.6], [29.4, 10.6], [23, 14.4]];
const BUSHES: readonly [number, number][] = [[2.6, 6.2], [10.4, 8.6], [6.4, 13.8], [19.6, 6.4], [26.4, 8.6], [24.4, 13.8]];
const SEA_ROCKS: readonly [number, number][] = [
  [14.4, 4.6], [13.1, 8.9], [0.9, 12.4], [3.2, 15.1], [9.4, 15.4], [14.2, 14.6],
  [16.4, 3.6], [29.4, 1.6], [17.2, 16], [25.4, 15.6], [16.8, 9.2],
];
const FIRES: readonly [number, number][] = [[8.2, 12.75], [22, 12.75]];

export class IntroDuelScene extends Phaser.Scene {
  constructor() {
    super("intro-duel");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadMapArt(this);
    loadGroundColours(this);
    loadBuildings(this, TOWERS);
  }

  create(): void {
    const view = (): typeof VIEW | typeof VIEW_TALL => (this.scale.width / this.scale.height > 1.2 ? VIEW : VIEW_TALL);
    fitCamera(
      this,
      () => ((view().col0 + view().col1) / 2) * CELL,
      () => view().midRow * CELL,
      () => this.scale.width / ((view().col1 - view().col0) * CELL) / baseZoom(this),
    );
    prepareTerrain(this);
    makeAnims(this);
    makeMapAnims(this);
    if (!this.anims.exists("fire_loop")) this.anims.create({ key: "fire_loop", frames: this.anims.generateFrameNumbers("fire"), frameRate: 9, repeat: -1 });
    this.glowTexture();

    buildWater(this);
    buildTerraces(this, MAP);
    for (const t of TOWERS) addBuilding(this, t);
    TREES.forEach(([c, r], i) => addDecor(this, "tree", c * CELL, r * CELL, 1, `duel-tree-${i}`));
    BUSHES.forEach(([c, r], i) => addDecor(this, "bush", c * CELL, r * CELL, 1, `duel-bush-${i}`));
    SEA_ROCKS.forEach(([c, r], i) => addDecor(this, "waterRock", c * CELL, r * CELL, 1, `duel-rock-${i}`).setDepth(DEPTH.foam));
    FIRES.forEach(([c, r]) => this.bonfire(c * CELL, r * CELL));
    for (const side of ["a", "b"] as const) for (const e of CAST[side]) this.addExtra(side, e);
    this.duel();
    driftClouds(this, { w: COLS * CELL, h: MAP.length * CELL }, "intro-duel");
  }

  /** The two on the bridge: one swings, the other guards, then they trade. */
  private duel(): void {
    const y = 12.45 * CELL;
    const sides = ["a", "b"] as const;
    const pair = sides.map((side, i) => {
      const x = (COLS / 2 + (i ? 0.72 : -0.72)) * CELL;
      addShadow(this, x, y, 0.62);
      const s = this.add.sprite(x, y, unitKey(side, "warrior", "idle")).setDepth(DEPTH.unit + y);
      playPose(s, side, "warrior", "idle");
      return s;
    });
    const spark = this.add
      .image((COLS / 2) * CELL, y - 46, "duelGlow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff2c0)
      .setScale(0.25)
      .setAlpha(0)
      .setDepth(DEPTH.fx);
    let turn = 0;
    const bout = (): void => {
      const i = turn++ % 2;
      const [atk, def] = [pair[i]!, pair[1 - i]!];
      playPose(atk, sides[i]!, "warrior", Math.random() < 0.5 ? "attack" : "attack2");
      atk.setFlipX(i === 1);
      playPose(def, sides[1 - i]!, "warrior", "guard");
      def.setFlipX(i === 0);
      // The swing's third frame is where the blades meet.
      this.time.delayedCall(240, () => {
        spark.setAlpha(1).setScale(0.18);
        this.tweens.add({ targets: spark, alpha: 0, scale: 0.4, duration: 260, ease: "Quad.easeOut" });
      });
      atk.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        pair.forEach((s, j) => playPose(s, sides[j]!, "warrior", "idle"));
        this.time.delayedCall(300 + Math.random() * 1100, bout);
      });
    };
    this.time.delayedCall(600, bout);
  }

  /** A campfire in a ring of stones with its glow, after the atlas's bonfires. */
  private bonfire(x: number, y: number): void {
    const glow = this.add.image(x, y - 24, "duelGlow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(1.3).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.7, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, 0.8).setScale(0.7).setDepth(standing(y)).play("fire_loop");
    if (fire.anims.currentAnim) fire.anims.setProgress(Math.random());
  }

  private glowTexture(): void {
    if (this.textures.exists("duelGlow")) return;
    const t = this.textures.createCanvas("duelGlow", 256, 256)!;
    const g = t.context.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255, 200, 110, 0.9)");
    g.addColorStop(0.35, "rgba(255, 170, 80, 0.4)");
    g.addColorStop(1, "rgba(255, 150, 60, 0)");
    t.context.fillStyle = g;
    t.context.fillRect(0, 0, 256, 256);
    t.refresh();
  }

  /** IntroScene's addExtra: idle, or a there-and-back walk. */
  private addExtra(side: Side, { cls, col, row, pace = 0, left, on }: Extra): void {
    const x = (col + 0.5) * CELL;
    const y = (row + 0.5) * CELL;
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62).setVisible(on === undefined);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + (on === undefined ? y : on * CELL - FOOT + 1));
    playPose(sprite, side, cls, "idle");
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
          this.time.delayedCall(1200 + Math.random() * 2600, leg);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2400, leg);
  }
}
