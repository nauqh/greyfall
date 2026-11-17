// The title backdrop while Versus is picked: a horseshoe arena on a ragged
// island. Blue's army holds the west flank, red's the east, and the monsters
// hold the high crag between them under a dead tree; down in the pit, among
// the bones and a fallen troll, each army fights the monsters on its side.

import type { Champion } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, cell, loadGroundColours, loadMapArt, makeMapAnims } from "./islandMap";
import { bodyScale, healKey, loadChampions, loadUnits, makeAnims, playPose, unitKey, type AnimName, type Side } from "./sprites";
import { DEPTH, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";
import { IMPACT_MS, flash, loadWarFx, makeWarFxAnims, projectile } from "./warFx";

// Cliffs only face south, so the stands flank the pit rather than rising
// behind it. Each army camps on its own crag, a ramp down into the pit. The
// monsters' crag at the far end climbs in two tiers: their cave and huts on
// top, a ramp off either end to the ledge wrapped round it, and the pit
// reaching up through a notch in the ledge, where a ramp from each half runs
// down into it. A ramp slopes sideways off the end of its row, so the ground
// one level down lies beside it as well as below.
const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~^^^^^^^^~~~~~~~~~~",
  "~~~~~~~~#^^^^^^^^^^^#~~~~~~~",
  "~~~~~~~##[^^^^^^^^^]#~~~~~~~",
  "~~~~~~#####^^^^^^#####~~~~~~",
  "~~###~#######..#######~###~~",
  "~~####~#####>..<#####~####~~",
  "~~#^^##~###.......##~##^^#~~",
  "~##^^^##............##^^^##~",
  "~#^^^^##............##^^^#~~",
  "~##^^####..........####^^##~",
  "~~#^^]###..........###[^^#~~",
  "~~#######..........######~~~",
  "~~~######..........#######~~",
  "~~######............#####~~~",
  "~~~#####>..........<####~~~~",
  "~~~~......................~~",
  "~~~~~....................~~~",
  "~~~~~~~.......~~.......~~~~~",
  "~~~~~~~~~....~~~~~~...~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
const COLS = MAP[0]!.length;
const ROWS = MAP.length;

/** Landscape: the menu board covers the west third. */
const VIEW = { col0: -13, col1: 28.2, midRow: 10.4 } as const;
/** Portrait: the logo on top and the menu along the bottom; the pit sits between. */
const VIEW_TALL = { col0: 3.5, col1: 24.5, midRow: 10.6 } as const;

/** The monsters' stronghold: the cave they pour out of, a hut either side. */
const CRAG = [cell("g", "cave", 14, 2.6), cell("g", "goblinHut", 11, 3.4, 0.75), cell("g", "goblinHut", 17, 3.4, 0.75)];
const BANNERS = [
  cell("a", "tower", 3.8, 9.9),
  cell("b", "tower", 23.6, 9.9),
  cell("g", "waterTower", 0.9, 12.6),
  cell("g", "waterTower", 27, 13.4),
];
/** Skulls marking the pit's open south mouth. */
const SPIKES = [cell("g", "skullSpike", 8.6, 16.5), cell("g", "skullSpike", 19.6, 16.5), cell("g", "skullSpike", 9.6, 19.4), cell("g", "skullSpike", 20.4, 19.4)];
export const BUILT = [...CRAG, ...BANNERS, ...SPIKES];

/** The arena floor: a troll the pit has already beaten at its heart, and bones the length of it. */
const CARCASS = [14, 11.9] as const;
const BONES: readonly [number, number][] = [
  [12.6, 8.6], [15.4, 8.8], [10.2, 9.4], [17.8, 9.2], [12.4, 11.8], [15.8, 11.6],
  [11.4, 15], [16.2, 15.2], [13.8, 15.6], [6.4, 17.2], [21.6, 17.2], [14, 17.6],
];
const PIT_ROCKS: readonly [number, number][] = [[9.5, 8.4], [18.5, 8.6], [11.2, 18.4], [19.6, 18.2]];

/** A unit at a cell. Side sets the facing: "a" looks east, "b" west; a monster looks the same on either. */
type Bench = [side: Side, cls: Champion, col: number, row: number];

const BENCH: readonly Bench[] = [
  // Each army's reserve round its own campfire on its crag, in front of its tower, with a lookout up top.
  ["a", "warrior", 6.6, 12.4], ["a", "lancer", 4.2, 13.6], ["a", "archer", 3.4, 14.6], ["a", "pawn", 6.8, 14.6], ["a", "archer", 5.4, 8.6],
  ["b", "warrior", 21.4, 12.4], ["b", "lancer", 23.8, 13.6], ["b", "archer", 24.6, 14.6], ["b", "pawn", 21.2, 14.6], ["b", "archer", 21.6, 8.6],
  // The monsters still to come: one at the cave mouth, four along the ledge, one on each ramp into the pit.
  ["b", "imp", 14, 3.5],
  ["b", "troll", 9.6, 5.6], ["b", "shaman", 10.8, 6.4], ["a", "minotaur", 17.2, 5.6], ["a", "bear", 19.6, 5.8],
  ["a", "spear", 12.5, 6.6], ["b", "lizard", 15.5, 6.6],
];

const TREES: readonly [number, number][] = [[3.4, 5.4], [24.4, 5.4], [1.6, 9.4], [25.8, 10.4], [5.4, 17.2], [22.6, 17.2], [12, 19.5], [16.6, 18.5]];

export class IntroSkirmishScene extends Phaser.Scene {
  constructor() {
    super("intro-skirmish");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadChampions(this);
    loadMapArt(this);
    loadGroundColours(this);
    loadWarFx(this);
    loadBuildings(this, BUILT);
    // The title's scene has already loaded it; started alone on the mode
    // pick, this scene is the only one that can.
    for (const i of [1, 2, 3]) this.load.image(`bones${i}`, packUrl(`Enemy Pack/Extra/Skull decorations/Bones_0${i}.png`));
    this.load.spritesheet("trollDead", packUrl("Enemy Pack/Extra/Troll Dead/Troll_Dead.png"), { frameWidth: 384, frameHeight: 384 });
    if (!this.textures.exists("fire")) this.load.spritesheet("fire", packUrl("Effects/Fire/Fire.png"), { frameWidth: 128, frameHeight: 128 });
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
    makeWarFxAnims(this);
    if (!this.anims.exists("fire_loop")) this.anims.create({ key: "fire_loop", frames: this.anims.generateFrameNumbers("fire"), frameRate: 9, repeat: -1 });

    buildWater(this);
    // The pit trampled to dust, each terrace up a greener, brighter step.
    buildTerraces(this, MAP, [4, 3, 2, 1]);
    for (const s of BUILT) addBuilding(this, s);
    TREES.forEach(([c, r], i) => addDecor(this, "tree", c * CELL, r * CELL, 0.9, `skirmish-tree-${i}`));
    for (const [c, r] of [[7.6, 18.2], [22.4, 18.2], [11, 19.6], [13.4, 18.5]] as const) addDecor(this, "rock", c * CELL, r * CELL, 1, `skirmish-rock-${c}`);
    for (const [c, r] of [[1.2, 7], [27.2, 9], [0.6, 15.6], [27.2, 17.6], [8, 20.6], [20.5, 20.4], [14.8, 19.7], [7.4, 5.8], [20.6, 6.4], [7.2, 2.4], [20.8, 1.6]] as const) {
      addDecor(this, "waterRock", c * CELL, r * CELL, 1, `skirmish-wrock-${c}`).setDepth(DEPTH.foam);
    }

    this.floor();
    for (const [side, cls, c, r] of BENCH) this.unit(side, cls, c, r);
    this.bonfire(5.6, 13.2);
    this.bonfire(22.4, 13.2);
    this.pit();

    driftClouds(this, { w: COLS * CELL, h: ROWS * CELL }, "intro-skirmish");
  }

  /** A unit standing at a cell: a shadow, a sprite, its idle. */
  private unit(side: Side, cls: Champion, col: number, row: number): Phaser.GameObjects.Sprite {
    const x = col * CELL;
    const y = row * CELL;
    addShadow(this, x, y, cls === "lancer" || cls === "troll" || cls === "minotaur" ? 0.8 : 0.62);
    const s = this.add.sprite(x, y, unitKey(side, cls, "idle")).setScale(bodyScale(cls)).setDepth(DEPTH.unit + y);
    playPose(s, side, cls, "idle");
    if (s.anims.currentAnim) s.anims.setProgress(Math.random());
    return s;
  }

  /** The pit's litter: the carcass stands like a body, the bones lie under every foot. */
  private floor(): void {
    const [tc, tr] = CARCASS;
    // The death sheet's last frame: the troll on its back in its own shadow.
    this.add.image(tc * CELL, tr * CELL, "trollDead", 9).setOrigin(193 / 384, 296 / 384).setScale(0.7).setDepth(standing(tr * CELL));
    BONES.forEach(([c, r], i) => {
      this.add
        .image(c * CELL, r * CELL, `bones${(i % 3) + 1}`)
        .setFlipX(i % 2 === 1)
        .setDepth(DEPTH.ground);
    });
    PIT_ROCKS.forEach(([c, r]) => addDecor(this, "rock", c * CELL, r * CELL, 0.9, `skirmish-pit-rock-${c}`));
  }

  /** Flames, a breathing warm light, a ring of stones: the Atlas's bonfire. */
  private bonfire(col: number, row: number): void {
    const x = col * CELL;
    const y = row * CELL;
    if (!this.textures.exists("glow")) {
      const t = this.textures.createCanvas("glow", 256, 256)!;
      const g = t.context.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255, 200, 110, 0.9)");
      g.addColorStop(0.35, "rgba(255, 170, 80, 0.4)");
      g.addColorStop(1, "rgba(255, 150, 60, 0)");
      t.context.fillStyle = g;
      t.context.fillRect(0, 0, 256, 256);
      t.refresh();
    }
    const glow = this.add.image(x, y - 24, "glow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(1.2).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.7, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, 0.8).setScale(0.7).setDepth(standing(y)).play("fire_loop");
    if (fire.anims.currentAnim) fire.anims.setProgress(Math.random());
  }

  /** Three sides in the arena: each pair of them is at it somewhere round the fallen troll. */
  private pit(): void {
    // Monsters down from the north meet blue on the west and red on the east; blue and red meet in the south.
    this.brawl(["a", "warrior", 11, 10.4], ["b", "skull", 12.2, 10.4]);
    this.brawl(["a", "gnoll", 15.8, 10.4], ["b", "warrior", 17, 10.4]);
    this.brawl(["a", "lancer", 10.2, 12.6], ["b", "torch", 11.7, 12.6]);
    this.brawl(["a", "torch", 16.3, 12.6], ["b", "lancer", 17.8, 12.6]);
    this.brawl(["a", "warrior", 13.3, 13.8], ["b", "warrior", 14.5, 13.8]);
    this.volley(this.unit("a", "archer", 9.6, 14.6), "a", { x: 12.2 * CELL, y: 10.4 * CELL - 40 });
    this.volley(this.unit("b", "archer", 18.4, 14.6), "b", { x: 15.8 * CELL, y: 10.4 * CELL - 40 });
    this.mend(this.unit("a", "monk", 9.6, 11), "a", { x: 11 * CELL, y: 10.4 * CELL });
    this.mend(this.unit("b", "monk", 18.4, 11), "b", { x: 17 * CELL, y: 10.4 * CELL });
  }

  /** Two units trading blows, each answering the other after a beat. */
  private brawl(a: Bench, b: Bench): void {
    const sa = this.unit(...a);
    const sb = this.unit(...b);
    let second = false;
    const swing = (att: Phaser.GameObjects.Sprite, [side, cls]: Bench, def: Phaser.GameObjects.Sprite, back: () => void): void => {
      const anim: AnimName = cls === "warrior" && (second = !second) ? "attack2" : "attack";
      playPose(att, side, cls, anim);
      this.time.delayedCall(IMPACT_MS, () => {
        flash(this, def, 1);
        const dust = this.add.sprite(def.x, def.y, "dust").setDepth(def.depth + 1).play("dust_anim");
        dust.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => dust.destroy());
        this.tweens.add({ targets: def, x: def.x + (side === "a" ? 5 : -5), duration: 70, yoyo: true });
      });
      att.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        playPose(att, side, cls, "idle");
        this.time.delayedCall(250 + Math.random() * 700, back);
      });
    };
    const round = (): void => swing(sa, a, sb, () => swing(sb, b, sa, round));
    this.time.delayedCall(Math.random() * 1500, round);
  }

  /** An archer loosing at a target on the far side, again and again. */
  private volley(s: Phaser.GameObjects.Sprite, side: Side, to: { x: number; y: number }): void {
    const shoot = (): void => {
      playPose(s, side, "archer", "attack");
      // Side "a" turns the arrow along its flight, whichever way that is.
      this.time.delayedCall(420, () => projectile(this, "a", { x: s.x, y: s.y - 40 }, to, 0.5));
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        playPose(s, side, "archer", "idle");
        this.time.delayedCall(1200 + Math.random() * 1600, shoot);
      });
    };
    this.time.delayedCall(800 + Math.random() * 1200, shoot);
  }

  /** A monk's heal on the fighter in front, its burst on them. */
  private mend(s: Phaser.GameObjects.Sprite, side: Side, to: { x: number; y: number }): void {
    const burst = this.add.sprite(to.x, to.y - 30, healKey(side)).setDepth(DEPTH.fx).setVisible(false);
    const heal = (): void => {
      playPose(s, side, "monk", "attack");
      this.time.delayedCall(500, () => burst.setVisible(true).play(`${healKey(side)}_anim`));
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        playPose(s, side, "monk", "idle");
        this.time.delayedCall(2500 + Math.random() * 2000, heal);
      });
    };
    this.time.delayedCall(2000, heal);
  }
}
