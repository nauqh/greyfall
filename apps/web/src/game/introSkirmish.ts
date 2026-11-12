// The title backdrop while Skirmish is picked: a sunken arena where blue and
// red trade blows, the benches on the terraces above it, and the three clans
// looking down from their towers on the high ground.

import type { Champion } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, cell, loadGroundColours, loadMapArt, makeMapAnims } from "./islandMap";
import { BODY, bodyScale, healKey, loadChampions, loadUnits, makeAnims, playPose, unitKey, type AnimName, type Side } from "./sprites";
import { DEPTH, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";
import { IMPACT_MS, flash, loadWarFx, makeWarFxAnims, projectile } from "./warFx";

// Cliffs only face south, so the stands rise to the north: the pit, the
// benches, the champions' terrace, the clans' towers. Stairs zigzag up.
const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~###^^^^4444444444^^^^###~~",
  "~~###^^^^4444444444^^^^###~~",
  "~~###^^^{4444444444}^^^###~~",
  "~~###^^^^^^^^^^^^^^^^^^###~~",
  "~~###^^^^^^^^^^^^^^^^^^###~~",
  "~~##[^^^^^^^^^^^^^^^^^^]##~~",
  "~~########################~~",
  "~~########################~~",
  "~~########################~~",
  "~~####................####~~",
  "~~####................####~~",
  "~~####................####~~",
  "~~####>..............<####~~",
  "~~........................~~",
  "~~~......................~~~",
  "~~~~....................~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
const COLS = MAP[0]!.length;
const ROWS = MAP.length;

/** Landscape: the menu board covers the west third. */
const VIEW = { col0: -13, col1: 28.2, midRow: 8.8 } as const;
/** Portrait: the logo on top and the menu along the bottom; the pit sits between. */
const VIEW_TALL = { col0: 3.5, col1: 24.5, midRow: 11.5 } as const;

const TOWERS = [cell("g", "tower", 10.6, 3.75), cell("g", "castle", 14, 3.85), cell("g", "tower", 17.4, 3.75)];
const BANNERS = [cell("a", "tower", 3.5, 4.9), cell("b", "tower", 24.5, 4.9), cell("a", "barracks", 4, 11.9), cell("b", "barracks", 24, 11.9)];
const SPIKES = [cell("g", "skullSpike", 6.6, 11.4), cell("g", "skullSpike", 21.4, 11.4), cell("g", "skullSpike", 6.4, 16.6), cell("g", "skullSpike", 21.6, 16.6)];

/** The three clans Skirmish is fought against, each in its own colour. */
const CLANS = ["Yellow", "Purple", "Black"] as const;
type Clan = (typeof CLANS)[number];
const clanKey = (clan: Clan, cls: "warrior" | "archer"): string => `clan_${clan}_${cls}`;
const CLAN_FILE = { warrior: "Warrior/Warrior_Idle.png", archer: "Archer/Archer_Idle.png" } as const;

/** A unit on the bench or in the stands: at a cell, facing the pit. */
type Bench = [side: Side, cls: Champion, col: number, row: number];

const BENCH: readonly Bench[] = [
  // The players' benches, either side of the pit's head.
  ["a", "warrior", 6.4, 8.4], ["a", "archer", 7.6, 8.9], ["a", "monk", 8.8, 8.3], ["a", "lancer", 2.9, 9.6], ["a", "pawn", 4.4, 7.9],
  ["b", "warrior", 21.6, 8.4], ["b", "archer", 20.4, 8.9], ["b", "monk", 19.2, 8.3], ["b", "lancer", 25.1, 9.6], ["b", "pawn", 23.6, 7.9],
  // The champions waiting their turn on the terrace above.
  ["b", "skull", 6.2, 5.6], ["b", "gnoll", 7.5, 6.1], ["b", "shaman", 9.6, 5.8], ["b", "thief", 12.4, 6],
  ["b", "torch", 15.6, 6], ["b", "skull", 18.4, 5.8], ["a", "troll", 20.6, 5.6],
];

const WATCHERS: readonly [Clan, "warrior" | "archer", number, number][] = [
  ["Yellow", "warrior", 9.4, 2.9], ["Purple", "warrior", 12.2, 3.1], ["Purple", "warrior", 15.8, 3.1], ["Black", "warrior", 18.6, 2.9],
];

const TREES: readonly [number, number][] = [[2.7, 1.9], [24.8, 2.1], [2.6, 13.5], [25.4, 13.4], [5.6, 1.6], [22.4, 1.7]];

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
    loadBuildings(this, [...TOWERS, ...BANNERS, ...SPIKES]);
    for (const clan of CLANS) {
      for (const cls of ["warrior", "archer"] as const) {
        this.load.spritesheet(clanKey(clan, cls), packUrl(`Units/${clan} Units/${CLAN_FILE[cls]}`), { frameWidth: 192, frameHeight: 192 });
      }
    }
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
    for (const key of [...CLANS.flatMap((c) => [clanKey(c, "warrior"), clanKey(c, "archer")]), "fire"]) {
      if (!this.anims.exists(`${key}_loop`)) this.anims.create({ key: `${key}_loop`, frames: this.anims.generateFrameNumbers(key), frameRate: 9, repeat: -1 });
    }

    buildWater(this);
    // The pit trampled to dust, each terrace up a greener, brighter step.
    buildTerraces(this, MAP, [4, 3, 2, 1]);
    for (const s of [...TOWERS, ...BANNERS, ...SPIKES]) addBuilding(this, s);
    TREES.forEach(([c, r], i) => addDecor(this, "tree", c * CELL, r * CELL, 0.9, `skirmish-tree-${i}`));
    for (const [c, r] of [[3.2, 15], [24.6, 15.2], [11, 16.4], [17.5, 16.5]] as const) addDecor(this, "rock", c * CELL, r * CELL, 1, `skirmish-rock-${c}`);
    for (const [c, r] of [[1.2, 4], [26.6, 7.5], [0.8, 12.2], [27.2, 14.6], [8, 17.6], [20.5, 17.4]] as const) {
      addDecor(this, "waterRock", c * CELL, r * CELL, 1, `skirmish-wrock-${c}`).setDepth(DEPTH.foam);
    }

    for (const [side, cls, c, r] of BENCH) this.unit(side, cls, c, r);
    this.clans();
    this.bonfire(5.6, 4.7);
    this.bonfire(22.4, 4.7);
    this.bonfire(13.9, 8.9);
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

  /** The three clans on the high ground: one on each tower top, the rest beside them. */
  private clans(): void {
    const stand = (clan: Clan, cls: "warrior" | "archer", x: number, y: number, depth: number): void => {
      const body = BODY[cls];
      const s = this.add
        .sprite(x, y, clanKey(clan, cls))
        .setOrigin(body.anchorX / body.frame, body.anchorY / body.frame)
        .setDepth(depth)
        .play(`${clanKey(clan, cls)}_loop`);
      if (s.anims.currentAnim) s.anims.setProgress(Math.random());
    };
    TOWERS.filter((t) => t.name === "tower").forEach((t, i) => stand(i === 0 ? "Yellow" : "Black", "archer", t.x + 6, t.y - 117, standing(t.y) + 1));
    // The castle's two turrets.
    const keep = TOWERS.find((t) => t.name === "castle")!;
    stand("Purple", "archer", keep.x - 125, keep.y - 166, standing(keep.y) + 1);
    stand("Purple", "archer", keep.x + 72, keep.y - 166, standing(keep.y) + 1);
    for (const [clan, cls, c, r] of WATCHERS) {
      addShadow(this, c * CELL, r * CELL, 0.62);
      stand(clan, cls, c * CELL, r * CELL, DEPTH.unit + r * CELL);
    }
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

  /** The fights on the pit floor, each its own loop of blows. */
  private pit(): void {
    this.brawl(["a", "warrior", 11.4, 12.2], ["b", "warrior", 12.6, 12.2]);
    this.brawl(["a", "lancer", 8.6, 14.4], ["b", "minotaur", 10.1, 14.4]);
    this.brawl(["a", "warrior", 13.6, 14.7], ["b", "torch", 14.7, 14.7]);
    this.brawl(["a", "lancer", 17.6, 12.2], ["b", "warrior", 18.9, 12.2]);
    this.brawl(["a", "warrior", 17.4, 15.4], ["b", "skull", 18.5, 15.4]);
    const archerA = this.unit("a", "archer", 7.6, 11.9);
    const archerB = this.unit("b", "archer", 20.5, 13.9);
    this.volley(archerA, "a", { x: 18.9 * CELL, y: 12.2 * CELL - 40 });
    this.volley(archerB, "b", { x: 13.6 * CELL, y: 14.7 * CELL - 40 });
    this.mend(this.unit("a", "monk", 10.2, 11.4), { x: 11.4 * CELL, y: 12.2 * CELL });
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
  private mend(s: Phaser.GameObjects.Sprite, to: { x: number; y: number }): void {
    const burst = this.add.sprite(to.x, to.y - 30, healKey("a")).setDepth(DEPTH.fx).setVisible(false);
    const heal = (): void => {
      playPose(s, "a", "monk", "attack");
      this.time.delayedCall(500, () => burst.setVisible(true).play(`${healKey("a")}_anim`));
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        playPose(s, "a", "monk", "idle");
        this.time.delayedCall(2500 + Math.random() * 2000, heal);
      });
    };
    this.time.delayedCall(2000, heal);
  }
}
