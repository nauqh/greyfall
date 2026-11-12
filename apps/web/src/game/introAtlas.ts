// The title backdrop while The Atlas is picked: the Shattered Reach at dusk,
// five levels of broken island climbing to the last lit bonfire on its crown,
// the captain carrying a flame up the stairs while the blight prowls the shore.

import type { Champion } from "@greyfall/engine";
import * as Phaser from "phaser";

import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, loadGroundColours } from "./islandMap";
import { loadChampions, loadUnits, makeAnims, playPose, unitKey, type Side } from "./sprites";
import { DEPTH, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~###^^^44445555544^^^###~##~",
  "~~~###^^^44445555544^^^###~##~",
  "~~~###^^^444(5555444^^^###~~~~",
  "~~~###^^^^4444444444^^^###~~~~",
  "~~...####^^444444444}^^###~~~~",
  "~~...####^^^^^^^^^^^^^####~~~~",
  "~~...###[^^^^^^^^^^^^^###...~~",
  "~~...###################.....~",
  "~~....##################.....~",
  "~~....##################>....~",
  "~............................~",
  "~............~..............~~",
  "~~.........~~~...........~^^~~",
  "~~~~.......~~~..........~~^^~~",
  "~##~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
/** Lowland to crown, each step up a brighter green: the dusty shore, then up to the sunlit crown. */
const RAMP = [5, 4, 3, 2, 1];

/** Landscape: the west third is the menu board's. Portrait: the crown lifted clear of the menu along the bottom. */
const VIEW = { col0: -11, col1: 30.5, midRow: 8.6 } as const;
const VIEW_TALL = { col0: 3, col1: 27, midRow: 12.5 } as const;

const BONFIRE = { col: 15.4, row: 3.3 } as const;

/** The captain's climb, feet by cell: up the shore ramp, west along the terrace,
 *  each stair in turn, and on to the fire. Starts mid-climb, then from the shore. */
const CLIMB: readonly [number, number][] = [
  [26.5, 13.5], [24.5, 13.2], [24.5, 11.5], [23.3, 11.4], [8.5, 11.4], [8.5, 8.5], [9.6, 8.4], [20.5, 8.4],
  [20.5, 6.5], [19.4, 6.4], [12.5, 6.4], [12.5, 4.5], [13.6, 4.3], [14, 3.6],
];
const CLIMB_FROM = 4;

/** The blight on the shore, by feet in cells; `pace` cells there and back, signed for the way it sets off. */
const BLIGHT: readonly { side: Side; cls: Champion; col: number; row: number; pace: number }[] = [
  { side: "a", cls: "troll", col: 4, row: 13.6, pace: 2 },
  { side: "m", cls: "warrior", col: 8.5, row: 14.4, pace: -1.5 },
  { side: "a", cls: "torch", col: 15.5, row: 13.4, pace: 2.5 },
  { side: "m", cls: "archer", col: 19.5, row: 14.5, pace: -2 },
  { side: "m", cls: "lancer", col: 22.5, row: 13.3, pace: 1.5 },
  { side: "a", cls: "shaman", col: 26.8, row: 9.6, pace: -1 },
  { side: "m", cls: "warrior", col: 3.4, row: 10.4, pace: 0 },
];

const RUIN = [
  { side: "g", name: "deadTree", x: 2.6 * CELL, y: 7.2 * CELL, scale: 0.42 },
  { side: "g", name: "skullSpike", x: 6.4 * CELL, y: 14.1 * CELL },
  { side: "g", name: "skullSpike", x: 17.4 * CELL, y: 13.1 * CELL },
  { side: "g", name: "skullSpike", x: 25.6 * CELL, y: 11.2 * CELL },
] as const;

const FIRE = { anchor: 0.8 } as const;
/** Dusk over everything but the lights: a warm mauve multiplied in. */
const DUSK = 0xb48aa0;

export class IntroAtlasScene extends Phaser.Scene {
  constructor() {
    super("intro-atlas");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this, true);
    loadChampions(this);
    loadGroundColours(this);
    loadBuildings(this, RUIN);
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
    if (!this.anims.exists("fire_loop")) this.anims.create({ key: "fire_loop", frames: this.anims.generateFrameNumbers("fire"), frameRate: 9, repeat: -1 });
    this.glowTexture();

    buildWater(this);
    buildTerraces(this, MAP, RAMP);
    this.scenery();
    for (const b of BLIGHT) this.prowl(b);
    this.bonfire();
    this.climb();
    this.add.rectangle(0, 0, 8000, 8000, DUSK).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH.clouds - 3);
    driftClouds(this, { w: MAP[0]!.length * CELL, h: MAP.length * CELL }, "intro-atlas");
  }

  private scenery(): void {
    for (const r of RUIN) addBuilding(this, r);
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r], i) => addDecor(this, kind, c * CELL, r * CELL, 1, `atlas-${kind}-${i}`));
    put("tree", [[3.6, 3.1], [4.7, 4.3], [3.5, 5.6], [24.4, 3.4], [25.3, 4.9], [7.4, 3.2], [21.6, 3.6]]);
    put("bush", [[6.4, 7.6], [22.9, 6.6], [10.5, 5.1], [18.3, 9.6], [2.8, 12.4]]);
    put("rock", [[12.2, 13.6], [20.6, 15.2], [27.6, 11.6], [5.6, 6.6], [17.5, 5.2]]);
    put("waterRock", [[0.6, 9.4], [11.4, 16.4], [28.6, 6.2], [23.8, 16.7], [1.2, 2.4], [26.4, 0.9], [5.5, 16.9], [29.2, 15.6]]).forEach((s) =>
      s.setDepth(DEPTH.foam),
    );
  }

  /** The last fire, in its ring of stones, its light, and sparks going up into the dusk. */
  private bonfire(): void {
    const x = BONFIRE.col * CELL;
    const y = BONFIRE.row * CELL;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.8).setDepth(standing(y)).play({ key: "fire_loop", startFrame: 2 });
    const glow = this.light(x, y - 24, 2.6, 0.7);
    this.tweens.add({ targets: glow, scale: 3, alpha: 0.85, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 9; i++) {
      const spark = this.add.rectangle(x, y, 3, 3, 0xffc070).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.clouds - 1);
      this.tweens.add({
        targets: spark,
        props: { y: { from: y - 30, to: y - 150 - Math.random() * 80 }, x: { from: x - 14 + Math.random() * 28, to: x - 40 + Math.random() * 80 }, alpha: { from: 1, to: 0 } },
        duration: 1800 + Math.random() * 1400,
        delay: Math.random() * 2400,
        repeat: -1,
      });
    }
  }

  /** A warm light over the dusk, so what it falls on keeps its own colour. */
  private light(x: number, y: number, scale: number, alpha: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha).setDepth(DEPTH.clouds - 2);
  }

  /** The same soft light AtlasScene makes, made here when this game has none. */
  private glowTexture(): void {
    if (this.textures.exists("glow")) return;
    const t = this.textures.createCanvas("glow", 256, 256)!;
    const g = t.context.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255, 200, 110, 0.9)");
    g.addColorStop(0.35, "rgba(255, 170, 80, 0.4)");
    g.addColorStop(1, "rgba(255, 150, 60, 0)");
    t.context.fillStyle = g;
    t.context.fillRect(0, 0, 256, 256);
    t.refresh();
  }

  /** One of the blight, idling, and pacing its stretch of shore if it has one. */
  private prowl({ side, cls, col, row, pace }: (typeof BLIGHT)[number]): void {
    const x = col * CELL;
    const y = row * CELL;
    const shadow = addShadow(this, x, y, cls === "troll" ? 1.2 : 0.62);
    const sprite = this.add.sprite(x, y, unitKey(side, cls, "idle")).setDepth(DEPTH.unit + y);
    playPose(sprite, side, cls, "idle");
    if (cls === "troll") sprite.setScale(0.7);
    if (sprite.anims.currentAnim) sprite.anims.setProgress(Math.random());
    sprite.setFlipX(pace < 0);
    if (pace === 0) return;
    let dir = Math.sign(pace);
    const step = Math.abs(pace) * CELL;
    const leg = (): void => {
      playPose(sprite, side, cls, "run");
      sprite.setFlipX(dir < 0);
      this.tweens.add({
        targets: [sprite, shadow],
        x: `+=${dir * step}`,
        duration: step * (cls === "troll" ? 40 : 26),
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

  /** The captain, flame in hand, up every stair to the bonfire; a rest there, then the climb again from the shore. */
  private climb(): void {
    const [c0, r0] = CLIMB[CLIMB_FROM]!;
    const shadow = addShadow(this, c0 * CELL, r0 * CELL, 0.62);
    const captain = this.add.sprite(c0 * CELL, r0 * CELL, unitKey("a", "warrior", "idle"));
    const flame = this.add.sprite(0, 0, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.28).play("fire_loop");
    const glow = this.light(0, 0, 0.9, 0.55);
    const follow = (): void => {
      const hand = captain.flipX ? -18 : 18;
      captain.setDepth(DEPTH.unit + captain.y);
      flame.setPosition(captain.x + hand, captain.y - 36).setDepth(captain.depth + 1);
      glow.setPosition(flame.x, flame.y - 10);
    };
    const all = [captain, shadow, flame, glow];
    const walk = (i: number): void => {
      const to = CLIMB[i];
      if (!to) return rest();
      const dx = to[0] * CELL - captain.x;
      const dy = to[1] * CELL - captain.y;
      if (Math.abs(dx) > 1) captain.setFlipX(dx < 0);
      this.tweens.add({
        targets: [captain, shadow],
        x: to[0] * CELL,
        y: to[1] * CELL,
        duration: Math.hypot(dx, dy) * 13,
        onUpdate: follow,
        onComplete: () => walk(i + 1),
      });
    };
    const rest = (): void => {
      playPose(captain, "a", "warrior", "idle");
      captain.setFlipX(false);
      follow();
      this.time.delayedCall(6000, () =>
        this.tweens.add({
          targets: all,
          alpha: 0,
          duration: 900,
          onComplete: () => {
            const [c, r] = CLIMB[0]!;
            captain.setPosition(c * CELL, r * CELL);
            shadow.setPosition(c * CELL, r * CELL);
            playPose(captain, "a", "warrior", "run");
            follow();
            this.tweens.add({ targets: all, alpha: (t: Phaser.GameObjects.GameObject) => (t === shadow ? 0.35 : t === glow ? 0.55 : 1), duration: 900 });
            walk(1);
          },
        }),
      );
    };
    playPose(captain, "a", "warrior", "run");
    follow();
    walk(CLIMB_FROM + 1);
  }
}
