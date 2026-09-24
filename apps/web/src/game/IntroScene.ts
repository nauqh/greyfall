// The title screen, PvZ-style: the menu is a signboard standing on the
// island, part of the world rather than a panel over it. The village, the
// warband and the Grey Host share the island with it.
//
// Same island, foam and decor as the battle, built from the same terrain
// helpers, so Begin is a scene swap and not a change of world.
// Nothing here touches the engine.

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
  loadBuildings,
  addDecor,
  driftClouds,
  loadTerrain,
  prepareTerrain,
  type Rect,
  type Structure,
} from "./terrain";
import { button, label, loadPanels, panel } from "./ui";

/** Whole 64px tiles; the first five columns are the signboard's yard. */
const ISLAND: Rect = { x0: 64, y0: 128, x1: 1152, y1: 640 };

/** The signboard's centre; the village starts right of it. */
const BOARD = { x: 240, y: 392, w: 352, h: 448 } as const;

const MENU = [
  { text: "Solo", href: "/battle" },
  { text: "Duel", href: "/duel" },
  // In development: dimmed so it reads as not ready.
  { text: "Map", href: "/map", dev: true },
] as const;

/**
 * The village, back to front. Buildings and props share one y-sorted depth
 * band, so the only rule here is that a base line further down the screen is
 * drawn later. Base widths are in art.ts; these x values are spaced off them.
 *
 * The Tidewarden camp: castle tight into the top-left corner, archery range
 * at the island's left edge below it, two houses in a row to the castle's
 * right backed by trees. The Grey Host's tower and hut hug the bottom-right.
 */
const VILLAGE: readonly Structure[] = [
  { side: "a", name: "castle", x: 546, y: 266 },
  { side: "a", name: "archery", x: 480, y: 450 },
  // Two houses in a row, right of the castle at its height.
  { side: "a", name: "house2", x: 750, y: 266 },
  // The dead tree replaces the goblin hut: a hollowed stump the Host nests
  // in. 192px wide at the base, so it sits just left of its old spot. 0.85
  // scale - the full-size art crowded the tower.
  { side: "b", name: "deadTree", x: 1040, y: 640},
  { side: "b", name: "pirateTower", x: 1090, y: 400},
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
  /** The art faces left natively; set "right" to mirror. */
  face?: "left" | "right";
}

const CAST: readonly Extra[] = [
  { side: "a", cls: "warrior", x: 640, y: 330, pace: 70 },
  // Archer on the hall roof and another in the left tower's top, facing
  // right over the castle toward the far shore.
  { side: "a", cls: "archer", x: 585, y: 150, pace: 0 },
  { side: "a", cls: "archer", x: 450, y: 125, pace: 0, face: "right" },
  { side: "b", cls: "warrior", x: 910, y: 600, pace: -60 },
  { side: "b", cls: "archer", x: 1090, y: 330, pace: 0 },
  { side: "b", cls: "monk", x: 890, y: 520, pace: 0 },
];

export interface IntroLauncher {
  go: (href: string) => void;
}

export class IntroScene extends Phaser.Scene {
  private go: (href: string) => void = () => {};

  constructor() {
    super("intro");
  }

  init(data: IntroLauncher): void {
    this.go = data.go;
  }

  preload(): void {
    loadTerrain(this);
    loadPanels(this, ["woodTable", "bigRibbon", "blueButton"]);
    loadUnits(this);
    loadBuildings(this, VILLAGE);
  }

  create(): void {
    fitCamera(this);
    prepareTerrain(this);
    makeAnims(this);

    buildWater(this);
    const island = buildIsland(this, ISLAND);
    buildFoam(this, island);
    // No scatterDecor: its random margin props kept dropping trees where the
    // village layout did not want them. Every prop is hand-placed below.
    for (const s of VILLAGE) addBuilding(this, s);
    for (const extra of CAST) this.addExtra(extra);
    this.decorate();
    this.signboard();
    driftClouds(this, { w: GAME_W, h: GAME_H }, "intro");
  }

  /** The menu as a wooden board planted in the grass, title ribbon across its top. */
  private signboard(): void {
    const { x, y, w, h } = BOARD;
    // The sheets pad their ink ~45px inside each 128px corner, hence the slack.
    const top = y - h / 2 + 45;
    const board = this.add.container(0, 0).setDepth(DEPTH.unit + y + h / 2);
    board.add(panel(this, "woodTable", x, y, w, h));
    board.add(panel(this, "bigRibbon", x, top + 4, w + 40, 128));
    board.add(label(this, x, top, "GREYFALL", { fontSize: "34px", strokeThickness: 4 }));

    MENU.forEach((item, i) => {
      const b = button(this, x, y - 70 + i * 100, 220, 96, item.text.toUpperCase(), "blue", () =>
        this.leave(item.href),
      );
      if ("dev" in item) b.setAlpha(0.55);
      board.add(b);
    });
  }

  /** A short fade, so picking a door reads as walking through it. */
  private leave(href: string): void {
    this.input.enabled = false;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.go(href));
  }

  /**
   * Hand-placed props so the island reads lived-in: trees and bushes framing
   * the castle corner, rocks along the southern grass, greenery around both
   * camps. Every spot is clear of the cast's feet - nobody stands in a bush.
   */
  private decorate(): void {
    addDecor(this, "rock", 508, 500, 1, "c");
    addDecor(this, "bush", 452, 570, 1, "d");
    // Trees backing the house row, rising over their roofs. Seeds 3..6 pick
    // Tree3's greener frames past its yellow autumn ones.
    addDecor(this, "tree", 850, 250, 0.8, 4);
    addDecor(this, "tree", 900, 208, 0.9, 5);
    addDecor(this, "tree", 970, 264, 0.8, 6);
  }

  /** One loafing unit: a shadow, a sprite, and a there-and-back walk. */
  private addExtra({ side, cls, x, y, pace, face }: Extra): void {
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + y);
    playPose(sprite, side, cls, "idle");
    // playPose sets the idle flip from board mirroring; an explicit face wins.
    if (face) sprite.setFlipX(face === "right");
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
}

export function startIntro(
  parent: HTMLElement,
  launcher: IntroLauncher,
): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "intro", IntroScene, launcher);
}