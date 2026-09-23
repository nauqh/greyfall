// The title screen: a living island on the right, the menu column on the left.
//
// Same island, foam, decor and clouds as the battle, built from the same
// terrain helpers, so Begin is a scene swap and not a change of world. The
// cast is scenery - a warband loafing on its own shore with the Grey Host
// watching from the far end - and nothing here touches the engine.

import * as Phaser from "phaser";

import type { UnitClass } from "@greyfall/engine";

import { GAME_H, GAME_W, fitCamera, startGame } from "./boot";
import { loadUnits, makeAnims, playPose, unitKey, type Side } from "./sprites";
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
import { button, label, loadPanels, panel, ribbon } from "./ui";

/** Whole 64px tiles, right of the menu column. */
const ISLAND: Rect = { x0: 384, y0: 96, x1: 1152, y1: 608 };

/** Middle of the water column the menu floats on. */
const MENU_X = 192;

/**
 * The village, back to front. Buildings and props share one y-sorted depth
 * band, so the only rule here is that a base line further down the screen is
 * drawn later. Base widths are in art.ts; these x values are spaced off them.
 *
 * The tower is the Grey Host's, on the far shore: the intro says the Greying
 * has taken the land, and a red keep looking back across the island says it
 * before the tagline does.
 */
const VILLAGE: readonly Structure[] = [
  { side: "a", name: "house1", x: 470, y: 280 },
  { side: "a", name: "barracks", x: 880, y: 300 },
  { side: "a", name: "castle", x: 660, y: 330 },
  { side: "b", name: "tower", x: 1100, y: 330 },
  { side: "a", name: "house3", x: 560, y: 404 },
];

/**
 * The cast, in world coordinates, all of it in front of the village. `pace` is
 * how far a unit walks from where it stands before turning back, signed for
 * which way it sets off; 0 keeps it rooted, which is what stops the whole
 * shore from swaying in step.
 *
 * Nobody paces into anybody else: each walker's run is clear of every other
 * body in its row, because two units sharing ground just slide through each
 * other and there is no pathfinding here to stop them.
 */
interface Extra {
  side: Side;
  cls: UnitClass;
  x: number;
  y: number;
  pace: number;
}

const CAST: readonly Extra[] = [
  { side: "a", cls: "pawn", x: 500, y: 466, pace: 90 },
  { side: "a", cls: "monk", x: 800, y: 486, pace: 0 },
  { side: "a", cls: "warrior", x: 620, y: 532, pace: 100 },
  { side: "a", cls: "archer", x: 500, y: 566, pace: 0 },
  { side: "a", cls: "lancer", x: 880, y: 586, pace: -70 },
  { side: "b", cls: "warrior", x: 1050, y: 480, pace: 0 },
  { side: "b", cls: "archer", x: 1120, y: 540, pace: 0 },
  { side: "b", cls: "warrior", x: 1040, y: 578, pace: 80 },
];

export interface IntroLauncher {
  onBegin: () => void;
  onDuel: () => void;
  /** The gold the draft will have, so the title screen can name it. */
  budget: number;
}

export class IntroScene extends Phaser.Scene {
  private launcher!: IntroLauncher;

  constructor() {
    super("intro");
  }

  init(data: IntroLauncher): void {
    this.launcher = data;
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadBuildings(this, VILLAGE);
    loadPanels(this, ["paper", "blueButton", "redButton"]);
  }

  create(): void {
    fitCamera(this);
    prepareTerrain(this);
    makeAnims(this);

    buildWater(this, GAME_W, GAME_H);
    const island = buildIsland(this, ISLAND);
    buildFoam(this, island);
    // scatterDecor dresses the margins either side of a board it must keep
    // clear. There is no board here, so the village stands in for one and the
    // props gather in the gaps at either end of the island.
    const clearing: Rect = { x0: 520, y0: island.y0, x1: 860, y1: island.y1 };
    scatterDecor(this, island, clearing, { w: GAME_W, h: GAME_H }, "intro");
    for (const s of VILLAGE) addBuilding(this, s);
    driftClouds(this, { w: GAME_W, h: GAME_H }, "intro");

    for (const extra of CAST) this.addExtra(extra);
    this.buildMenu();
  }

  /** One loafing unit: a shadow, a sprite, and a there-and-back walk. */
  private addExtra({ side, cls, x, y, pace }: Extra): void {
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + y);
    playPose(sprite, side, cls, "idle");
    if (pace === 0) return;

    let dir = Math.sign(pace);
    const step = Math.abs(pace);
    const leg = (): void => {
      playPose(sprite, side, cls, "run");
      sprite.setFlipX(dir < 0);
      this.tweens.add({
        targets: [sprite, shadow],
        x: `+=${dir * step}`,
        duration: step * 26,
        onComplete: () => {
          playPose(sprite, side, cls, "idle");
          dir = -dir;
          // Long enough to read as a pause rather than a stutter, and jittered
          // so the shore never falls into one rhythm.
          this.time.delayedCall(1200 + Math.random() * 2600, leg);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2400, leg);
  }

  /** Title, blurb and the two ways in, stacked on the water column. */
  private buildMenu(): void {
    ribbon(this, MENU_X, 130, 300, 0.95).setDepth(DEPTH.hud);
    label(this, MENU_X, 128, "GREYFALL", { fontSize: "30px" }).setDepth(DEPTH.hud + 2);

    panel(this, "paper", MENU_X, 286, 280, 172).setDepth(DEPTH.hud);
    label(
      this,
      MENU_X,
      278,
      `The Greying has taken
the land.

Spend ${this.launcher.budget} gold and
hold the line.`,
      { fontSize: "17px", color: "#4a3a28", stroke: "", strokeThickness: 0, align: "center" },
    ).setDepth(DEPTH.hud + 2);

    button(this, MENU_X, 432, 218, 124, "Begin", "blue", () => this.launcher.onBegin()).setDepth(
      DEPTH.hud + 3,
    );
    button(this, MENU_X, 566, 218, 124, "Duel", "red", () => this.launcher.onDuel()).setDepth(
      DEPTH.hud + 3,
    );
  }
}

export function startIntro(
  parent: HTMLElement,
  launcher: IntroLauncher,
): { destroy: () => void } {
  return startGame(parent, "intro", IntroScene, launcher);
}
