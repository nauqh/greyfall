// The title backdrop while The Atlas is picked: an expedition making landfall
// on a wild, lopsided island in daylight. The boat rides at anchor by the fish
// hut, the camp's fire burns on the beach, pawns dig and build, and a party
// climbs the ridge to the lookout on the summit, past a cave still to explore.

import type { UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, WORK, addMine, cell, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey } from "./sprites";
import { DEPTH, FOOT, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~##~~~~~~~^^^^~~~~~~~~~",
  "~~~~~~~~##~~~~~^^^4455~~~~~~~~",
  "~~~~~~~~~~~~~#^^^44(555^~~~##~",
  "~~~~~~~~~~~##^^^^44444^^^^~~##",
  "~~~~~~~~~###^^^^^^4444}^^~~~~~",
  "~~~~~~~~####^^^^^^^^^^^^^~~~~~",
  "~~~~~~~~######^^^^^^^^^^#~~~~~",
  "~~~~~~~######[^^^^^^^^###~~.~~",
  "~~~~~~~.################~~...~",
  "~~~~~~~.#############.......~~",
  "~~~~~~~..############>.....~~~",
  "~~~~~~~~~...................~~",
  "~~~~~~~~~~.......~~~......~~~~",
  "~~~~~~~~~~~~......~~~~~~~##~~~",
  "~~~~~~~##~~~~~~~~~~~~~~~~##~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
/** Lowland to summit, each step up a brighter green, as on the war's island. */
const RAMP = [5, 3, 2, 1, 1];

/** Landscape: the west third is the menu board's. Portrait: the summit lifted clear of the menu along the bottom. */
const VIEW = { col0: -11, col1: 30.5, midRow: 8.6 } as const;
const VIEW_TALL = { col0: 3, col1: 27, midRow: 12.5 } as const;

/** The expedition's marks on the island, each its base's centre in cells. */
export const BUILT = [
  cell("a", "tower", 21.6, 4.7),
  cell("g", "cave", 9.8, 9.8),
  cell("g", "fishHut", 14.8, 15.6),
  cell("a", "house2", 25.4, 12.3),
  cell("g", "goblinHut", 28.3, 5.7, 0.7),
];

/** The party's climb, feet by cell: up the shore ramp, west across the plateau, each stair in turn along the ridge, to the lookout. */
const CLIMB: readonly [number, number][] = [
  [26.5, 13.5], [22, 13.5], [21.5, 12.5], [20.3, 12.4], [13.5, 12.4], [13.5, 10.5], [13.5, 9.5], [14.6, 9.4],
  [22.5, 8.4], [22.5, 6.5], [21.4, 6.4], [19.5, 6.4], [19.5, 5.4], [19.5, 4.5], [20.4, 4.3],
];
/** Leader first, each a step behind the one before; the leader starts this far up. */
const PARTY: readonly UnitClass[] = ["warrior", "lancer", "archer"];
const PARTY_FROM = 5;

/** The camp and the island at work, feet in cells. `pace` cells there and back, signed for the way it sets off. */
const CAST: readonly { cls: UnitClass; col: number; row: number; pace?: number; left?: boolean; work?: keyof typeof WORK; on?: number }[] = [
  // On the lookout's top, and one keeping the boat.
  { cls: "archer", col: 21.2, row: 2.4, on: 4.7, left: true },
  { cls: "warrior", col: 17.2, row: 15.5 },
  // Round the camp fire.
  { cls: "monk", col: 18.4, row: 13.8 },
  { cls: "pawn", col: 20.3, row: 14.4, left: true },
  // Digging the crown's seam, carrying out along the ridge, raising the hut.
  { cls: "pawn", col: 15.4, row: 6.3, left: true, work: "dig" },
  { cls: "pawn", col: 15, row: 8.4, pace: 3, work: "carry" },
  { cls: "pawn", col: 24.1, row: 12.7, work: "hammer" },
  // Scouting the cave mouth, walking the beach.
  { cls: "archer", col: 11.9, row: 10.6, left: true },
  { cls: "lancer", col: 11.4, row: 14.4, pace: 3 },
  { cls: "warrior", col: 22.6, row: 11.4, pace: 1.5 },
];

const CAMPFIRE = { col: 19.4, row: 13.9 } as const;
const MINE = { col: 14, row: 5 } as const;
const BOAT = { col: 20, row: 15.9, frame: 256 } as const;
const SHEEP: readonly [number, number][] = [[23.4, 14.3], [24.6, 13.7], [10.8, 13.7], [27.2, 10.6]];
const FIRE = { anchor: 0.8 } as const;

export class IntroAtlasScene extends Phaser.Scene {
  constructor() {
    super("intro-atlas");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadBuildings(this, BUILT);
    if (!this.textures.exists("atlasBoat")) this.load.spritesheet("atlasBoat", packUrl("Enemy Pack/Extra/Boat/Boat_Idle.png"), { frameWidth: BOAT.frame, frameHeight: BOAT.frame });
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
    if (!this.anims.exists("atlasBoat_loop")) this.anims.create({ key: "atlasBoat_loop", frames: this.anims.generateFrameNumbers("atlasBoat"), frameRate: 6, repeat: -1 });

    buildWater(this);
    buildTerraces(this, MAP, RAMP);
    this.scenery();
    for (const c of CAST) this.extra(c);
    PARTY.forEach((cls, i) => this.climber(cls, i));
    driftClouds(this, { w: MAP[0]!.length * CELL, h: MAP.length * CELL }, "intro-atlas");
  }

  private scenery(): void {
    for (const b of BUILT) addBuilding(this, b);
    addMine(this, MINE, "mineActive");
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r], i) => addDecor(this, kind, c * CELL, r * CELL, 1, `atlas-${kind}-${i}`));
    put("tree", [[8.6, 2.9], [9.6, 7.2], [10.5, 5.8], [11.6, 6.4], [16.5, 3.4], [17.6, 2.6], [23.5, 9.2], [24.4, 8.6], [27.5, 10.4], [8.4, 16.6], [25.6, 15.7], [12.6, 12.4]]);
    put("bush", [[12, 11.6], [18.5, 8.6], [21.6, 13.8], [24.8, 6.3], [16, 14.2]]);
    put("rock", [[11.6, 14.6], [27.2, 11.7], [18.5, 10.6]]);
    put("waterRock", [[5.4, 9.6], [6, 6], [7.4, 14.4], [8, 1.2], [25, 2], [23.5, 15.5], [29, 13.2], [12, 16.6]]).forEach((s) => s.setDepth(DEPTH.foam));

    const by = BOAT.row * CELL;
    const boat = this.add.sprite(BOAT.col * CELL, by, "atlasBoat").setOrigin(0.5, 0.7).setScale(0.7).setDepth(DEPTH.foam + 2).play("atlasBoat_loop");
    this.tweens.add({ targets: boat, y: by + 4, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const fx = CAMPFIRE.col * CELL;
    const fy = CAMPFIRE.row * CELL;
    this.add.sprite(fx, fy, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.45).setDepth(standing(fy)).play({ key: "fire_loop", startFrame: 3 });

    for (const [c, r] of SHEEP) {
      const sheep = this.add.sprite(c * CELL, r * CELL, "sheep").setOrigin(0.5, 0.66).setDepth(standing(r * CELL)).setFlipX(c > 20).play("sheep_anim");
      if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
    }
  }

  /** One of the expedition at its post: idling or at work, maybe walking a stretch there and back. */
  private extra({ cls, col, row, pace = 0, left, work, on }: (typeof CAST)[number]): void {
    const x = col * CELL;
    const y = row * CELL;
    // Up on a building the ground is its roof, which bakes in its own shade.
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62).setVisible(on === undefined);
    const sprite = this.add.sprite(x, y, unitKey("a", cls, "idle")).setDepth(DEPTH.unit + (on === undefined ? y : on * CELL - FOOT + 1));
    const rest = (): void => {
      if (work) sprite.play(WORK[work].key);
      else playPose(sprite, "a", cls, "idle");
    };
    rest();
    if (sprite.anims.currentAnim) sprite.anims.setProgress(Math.random());
    if (left !== undefined) sprite.setFlipX(left);
    if (pace === 0) return;
    let dir = Math.sign(pace);
    const step = Math.abs(pace) * CELL;
    const leg = (): void => {
      if (!work) playPose(sprite, "a", cls, "run");
      sprite.setFlipX(dir < 0);
      this.tweens.add({
        targets: [sprite, shadow],
        x: `+=${dir * step}`,
        duration: step * 26,
        onComplete: () => {
          rest();
          dir = -dir;
          this.time.delayedCall(1200 + Math.random() * 2600, leg);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2400, leg);
  }

  /** One of the party, `place` behind the leader: up the climb to the lookout, a rest there, then the climb again from the shore. */
  private climber(cls: UnitClass, place: number): void {
    const from = Math.max(0, PARTY_FROM - place);
    const end = CLIMB.length - 1 - place;
    const [c0, r0] = CLIMB[from]!;
    const shadow = addShadow(this, c0 * CELL, r0 * CELL, cls === "lancer" ? 0.8 : 0.62);
    const unit = this.add.sprite(c0 * CELL, r0 * CELL, unitKey("a", cls, "run"));
    const depth = (): void => void unit.setDepth(DEPTH.unit + unit.y);
    const walk = (i: number): void => {
      const to = CLIMB[i];
      if (!to || i > end) return rest();
      const dx = to[0] * CELL - unit.x;
      const dy = to[1] * CELL - unit.y;
      if (Math.abs(dx) > 1) unit.setFlipX(dx < 0);
      this.tweens.add({ targets: [unit, shadow], x: to[0] * CELL, y: to[1] * CELL, duration: Math.hypot(dx, dy) * 14, onUpdate: depth, onComplete: () => walk(i + 1) });
    };
    const rest = (): void => {
      playPose(unit, "a", cls, "idle");
      unit.setFlipX(false);
      this.time.delayedCall(7000, () =>
        this.tweens.add({
          targets: [unit, shadow],
          alpha: 0,
          duration: 900,
          onComplete: () => {
            // Back at the shore, the followers a few steps behind as before.
            this.time.delayedCall(place * 700, () => {
              const [c, r] = CLIMB[0]!;
              unit.setPosition(c * CELL, r * CELL);
              shadow.setPosition(c * CELL, r * CELL);
              playPose(unit, "a", cls, "run");
              depth();
              this.tweens.add({ targets: unit, alpha: 1, duration: 600 });
              this.tweens.add({ targets: shadow, alpha: 0.35, duration: 600 });
              walk(1);
            });
          },
        }),
      );
    };
    playPose(unit, "a", cls, "run");
    depth();
    walk(from + 1);
  }
}
