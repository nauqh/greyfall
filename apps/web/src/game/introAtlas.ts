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
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~55544444^^^^~~~~~~~~~",
  "~~~~~^555)4444^^^^^^~~~~~~~",
  "~~~~~^44444^^^^^^^^^##~~~~~",
  "~~~~#^^4444}^^^^^^^####~~~~",
  "~~~.#^^^^^^^^^^########.~~~",
  "~~..##^^^##^^^^]######..~~~",
  "~~...######..########....~~",
  "~~....#####..######......~~",
  "~~...<####....#####>.....~~",
  "~~.......................~~",
  "~~.......................~~",
  "~~~.....................~~~",
  "~~~.........~~~~........~~~",
  "~~~~.......~~~~~~~.....~~~~",
  "~~~~~~...~~~~~~~~~~...~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
/** Lowland to summit, each step up a brighter green, as on the war's island. */
const RAMP = [5, 3, 2, 1, 1];

/** Landscape: the island from just past the menu board to the east edge. Portrait: the summit lifted clear of the menu along the bottom. */
const VIEW = { col0: -8.2, col1: 25.6, midRow: 9.4 } as const;
const VIEW_TALL = { col0: 1.5, col1: 25.5, midRow: 13.4 } as const;

/** The expedition's marks on the island, each its base's centre in cells. */
export const BUILT = [
  cell("a", "tower", 7.4, 3.85),
  cell("g", "cave", 10, 8.85, 0.85),
  cell("g", "fishHut", 9.8, 15.2),
  cell("a", "house2", 19.6, 15.6),
  cell("g", "goblinHut", 20.5, 7.7, 0.7),
];

/** The party's climb, feet by cell: each stair cut into the middle of its cliff, switching back west and up to the summit on the west cliff. */
const CLIMB: readonly [number, number][] = [
  [22.5, 13.5], [19.5, 12.2], [19.5, 11.5], [19.5, 10.4], [18.5, 10.4], [15.5, 10.4], [15.5, 9.4], [15.5, 8.4], [15.5, 7.4], [14.5, 7.4],
  [11.5, 7.4], [11.5, 6.4], [11.5, 5.4], [10.5, 5.4], [9.5, 5.4], [9.5, 4.4], [9.5, 3.4], [8.6, 3.4],
];
/** Leader first, each a step behind the one before; the leader starts this far up. */
const PARTY: readonly UnitClass[] = ["warrior", "lancer", "archer"];
const PARTY_FROM = 5;

/** The camp and the island at work, feet in cells. `pace` cells there and back, signed for the way it sets off. */
const CAST: readonly { cls: UnitClass; col: number; row: number; pace?: number; left?: boolean; work?: keyof typeof WORK; on?: number }[] = [
  // On the lookout's top, and one keeping the boat.
  { cls: "archer", col: 7.4, row: 1.8, on: 3.85 },
  { cls: "warrior", col: 15.6, row: 13.8, left: true },
  // Round the camp fire.
  { cls: "monk", col: 11.4, row: 12.5 },
  { cls: "pawn", col: 13.7, row: 13, left: true },
  // Digging the ridge's seam, carrying along the ridge, raising the hut.
  { cls: "pawn", col: 17.4, row: 4.3, work: "dig" },
  { cls: "pawn", col: 18.2, row: 7.5, pace: -2, work: "carry" },
  { cls: "pawn", col: 21.4, row: 15.4, left: true, work: "hammer" },
  // Scouting the cave mouth, walking the beach, keeping the plateau.
  { cls: "archer", col: 8.6, row: 9.6 },
  { cls: "lancer", col: 5, row: 13.2, pace: 3 },
  { cls: "warrior", col: 18.5, row: 8.5, pace: -2 },
];

const CAMPFIRE = { col: 12.5, row: 12.6 } as const;
const MINE = { col: 18, row: 3 } as const;
const BOAT = { col: 14, row: 15.3, frame: 256 } as const;
const SHEEP: readonly [number, number][] = [[4.6, 11.6], [5.6, 12.2], [22.5, 10.5], [21.8, 9.4]];
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
    put("tree", [[5.6, 4.6], [12.4, 3.6], [5.4, 5.8], [4.5, 7.2], [3.6, 8.6], [2.8, 10.4], [20.8, 4.8], [22.4, 6.2], [23, 8], [12.4, 10.8], [7, 10.2], [4.4, 15.4], [21.4, 15.8], [14.5, 2.6]]);
    put("bush", [[9.4, 10.6], [6.4, 10.6], [18.6, 12.5], [3.3, 12.6], [21.4, 10.6], [6.3, 6.6]]);
    put("rock", [[6.5, 13.8], [23, 11.6], [14.6, 9.7]]);
    put("waterRock", [[1.2, 6.5], [3.4, 3.6], [24.8, 4.5], [25.6, 13.6], [12.2, 16.8], [8.6, 17.4], [1.4, 15], [24.6, 17], [16.4, 16.4]]).forEach((s) => s.setDepth(DEPTH.foam));

    const by = BOAT.row * CELL;
    const boat = this.add.sprite(BOAT.col * CELL, by, "atlasBoat").setOrigin(0.5, 0.7).setScale(0.7).setDepth(DEPTH.foam + 2).play("atlasBoat_loop");
    this.tweens.add({ targets: boat, y: by + 4, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const fx = CAMPFIRE.col * CELL;
    const fy = CAMPFIRE.row * CELL;
    this.add.sprite(fx, fy, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.45).setDepth(standing(fy)).play({ key: "fire_loop", startFrame: 3 });

    for (const [c, r] of SHEEP) {
      const sheep = this.add.sprite(c * CELL, r * CELL, "sheep").setOrigin(0.5, 0.66).setDepth(standing(r * CELL)).setFlipX(c > 13).play("sheep_anim");
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
