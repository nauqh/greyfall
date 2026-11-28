// The title screen's backdrop: an expedition making landfall
// on a wild, lopsided island in daylight. The boat rides at anchor by the fish
// hut, the camp's fire burns on the beach, pawns dig and build, and the
// landing party loafs about the lowland below a cave still to explore.

import { makeRng, type UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera, startGame } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, WORK, addMine, cell, loadGroundColours, loadMapArt, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey } from "./sprites";
import { DEPTH, FOOT, addBonfire, addBuilding, addDecor, addShadow, buildWater, cloudCover, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~444~~^^~~~~~~~~~~",
  "~~~~~~55544444^^^^~~~~~~~~~",
  "~~~~^^555)4444^^^^^^~~~~~~~",
  "~~~~^^44444^^^^^^^^^##~~~~~",
  "~~~~^^^4444}^^^^^^^####~~~~",
  "~~~.^^^^^^^^^^^########.~~~",
  "~~..^^^^^##^^^^]######..~~~",
  "~~....#####..########....~~",
  "~~~...#####..######.......~",
  "~~...<####.....####>.....~~",
  "~~~.....................~~~",
  "~~.......................~~",
  "~~~......................~~",
  "~~~~........~~~~........~~~",
  "~~~~.......~~~~~~~.....~~~~",
  "~~~~~~...~~~~~~~~~~...~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
/** Lowland to summit, each step up a brighter green, as on the war's island. */
const RAMP = [5, 3, 2, 1, 1];

/** Landscape: the island from just past the menu board to the east edge. Portrait: the summit lifted clear of the menu along the bottom. */
const VIEW = { col0: -12, col1: 27.1, midRow: 9.4 } as const;
const VIEW_TALL = { col0: 1.5, col1: 25.5, midRow: 13.4 } as const;

/** The expedition's marks on the island, each its base's centre in cells. */
const BUILT = [
  cell("a", "tower", 7.4, 3.85),
  cell("g", "cave", 10, 8.85, 0.85),
  cell("g", "fishHut", 9.8, 15.2),
  cell("a", "house2", 19.6, 15.6),
  // The landfall's own: a chapel on the ridge's first terrace, the garrison's butts a step above it and its barracks up
  // by the summit, clear of the climb, and a house at the climb's foot.
  cell("a", "monastery", 20.5, 6.8),
  cell("a", "barracks", 11.5, 2.8),
  cell("a", "archery", 15.5, 4.8),
  cell("a", "house1", 23, 12.8),
];

/** The landing party, each strolling about its own spot, feet in cells: one on the lowland, one before the barracks, one at the archery butts. */
const PARTY: readonly { cls: UnitClass; col: number; row: number }[] = [
  { cls: "warrior", col: 11.5, row: 3.7 },
  { cls: "lancer", col: 22.9, row: 13.7 },
  { cls: "archer", col: 15.6, row: 5.7 },
];
/** How far a stroller strays from its spot, in cells. */
const ROAM = 1.5;

/** The camp and the island at work, feet in cells. `pace` cells there and back, signed for the way it sets off. */
const CAST: readonly { cls: UnitClass; col: number; row: number; pace?: number; left?: boolean; work?: keyof typeof WORK; on?: number }[] = [
  // On the lookout's top, and a monk before the chapel.
  { cls: "archer", col: 7.4, row: 2.03, on: 3.85 },
  { cls: "monk", col: 19.9, row: 8.3 },
  // Digging the west mine, idling at the cave's mouth, raising the hut.
  { cls: "pawn", col: 4, row: 9.4, work: "dig" },
  { cls: "pawn", col: 9.6, row: 9.8 },
  { cls: "pawn", col: 20.8, row: 15.15, left: true, work: "hammer" },
];

const CAMPFIRE = { col: 12.5, row: 12.6 } as const;
const MINE = { col: 4.5, row: 8.35 } as const;
const BOAT = { col: 14, row: 15.3, frame: 256 } as const;
/** Kept clear of strewn scrub, [col, row, radius]: the camp, the mine and the climb to the cave. */
const CLEAR: readonly [number, number, number][] = [[12.5, 12.6, 2], [4.5, 8.75, 1.4], [7.5, 9.8, 1.6], [14, 15.3, 1.5], [6, 13.5, 2.6]];

const ground = (c: number, r: number): string => MAP[r]?.[c] ?? "~";
const height = (c: number, r: number): number => {
  const ch = ground(c, r);
  return "5()".includes(ch) ? 5 : "4{}".includes(ch) ? 4 : "^[]".includes(ch) ? 3 : "#<>%".includes(ch) ? 2 : ch === "~" ? 0 : 1;
};
const slope = (c: number, r: number): boolean => "<>[]{}()".includes(ground(c, r));

const SHEEP: readonly [number, number][] = [[5.3, 13.9], [6.6, 13.6], [22.5, 10.5], [21.8, 9.4]];

export class IntroAtlasScene extends Phaser.Scene {
  constructor() {
    super("intro-atlas");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadMapArt(this);
    loadGroundColours(this);
    this.load.spritesheet("fire", packUrl("Effects/Fire/Fire.png"), { frameWidth: 128, frameHeight: 128 });
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
    for (const p of PARTY) this.stroller(p);
    driftClouds(this, { w: MAP[0]!.length * CELL, h: MAP.length * CELL }, "intro-atlas");
    cloudCover(this, "open", () => {});
  }

  private scenery(): void {
    for (const b of BUILT) addBuilding(this, b);
    addMine(this, MINE, "mineActive");
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r], i) => addDecor(this, kind, c * CELL, r * CELL, 1, `atlas-${kind}-${i}`));
    put("tree", [[5.6, 4.6], [6.6, 6.4], [18.6, 3.5], [3.4, 7.4], [5.3, 7.2], [20.8, 4.8], [22.4, 6.2], [12.4, 10.8], [21.4, 15.8], [14.5, 2.6]]);
    put("bush", [[9.4, 10.6], [18.6, 12.5], [3.3, 12.6], [21.4, 10.6], [6.3, 6.6]]);
    put("rock", [[2.6, 12.4], [23, 11.6], [14.6, 9.7]]);
    this.dress(put);
    put("waterRock", [[1.2, 6.5], [3.4, 3.6], [24.8, 4.5], [25.6, 13.6], [12.2, 16.8], [8.6, 17.4], [1.4, 15], [24.6, 17], [16.4, 16.4]]).forEach((s) => s.setDepth(DEPTH.foam));

    const by = BOAT.row * CELL;
    const boat = this.add.sprite(BOAT.col * CELL, by, "atlasBoat").setOrigin(0.5, 0.7).setScale(0.7).setDepth(DEPTH.foam + 2).play("atlasBoat_loop");
    this.tweens.add({ targets: boat, y: by + 4, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    addBonfire(this, CAMPFIRE.col * CELL, CAMPFIRE.row * CELL);

    for (const [c, r] of SHEEP) {
      const sheep = this.add.sprite(c * CELL, r * CELL, "sheep").setOrigin(0.5, 0.66).setDepth(standing(r * CELL)).setFlipX(c > 13).play("sheep_anim");
      if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
    }
  }

  /** Trees, scrub and fallen stone along every cliff foot, and a scatter of both over open ground, thicker by a cliff or
   *  the shore; ramps, buildings and the camp kept clear. Seeded, so the island is the same every time. */
  private dress(put: (kind: "tree" | "bush" | "rock", spots: [number, number][]) => unknown): void {
    const rng = makeRng("intro-atlas-dress");
    const near = (c: number, r: number): boolean =>
      BUILT.some((b) => Math.hypot(c + 0.5 - b.x / CELL, r + 0.5 - b.y / CELL) < 1.6) || CLEAR.some(([x, y, d]) => Math.hypot(c + 0.5 - x, r + 0.5 - y) < d);
    const trees: [number, number][] = [];
    const bushes: [number, number][] = [];
    const rocks: [number, number][] = [];
    for (let r = 0; r < MAP.length; r++) {
      for (let c = 0; c < MAP[0]!.length; c++) {
        const lv = height(c, r);
        if (lv === 0 || slope(c, r) || [-1, 0, 1].some((d) => slope(c + d, r - 1) || slope(c + d, r)) || near(c, r)) continue;
        const roll = rng.next();
        // A cliff face is rock, not ground: what grows at its foot stands a cell lower, in front of it.
        if (height(c, r - 1) > lv) continue;
        if (height(c, r - 2) > lv && height(c, r - 1) === lv && ![-1, 0, 1].some((d) => slope(c + d, r - 2))) {
          const foot: [number, number] = [c + 0.25 + rng.next() * 0.5, r + 0.3 + rng.next() * 0.2];
          if (roll < 0.22) trees.push(foot);
          else if (roll < 0.55) bushes.push(foot);
          else if (roll < 0.68) rocks.push(foot);
          continue;
        }
        let edge = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) edge ||= height(c + dc, r + dr) !== lv;
        const chance = edge ? 0.16 : 0.05;
        if (roll < chance) (roll < chance * 0.65 ? bushes : rocks).push([c + 0.2 + rng.next() * 0.6, r + 0.5 + rng.next() * 0.35]);
      }
    }
    put("tree", trees);
    put("bush", bushes);
    put("rock", rocks);
  }

  /** One of the expedition at its post: idling or at work, maybe walking a stretch there and back. */
  private extra({ cls, col, row, pace = 0, left, work, on }: (typeof CAST)[number]): void {
    const x = col * CELL;
    const y = row * CELL;
    // Up on a building the ground is its roof, which bakes in its own shade.
    const shadow = addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62).setVisible(on === undefined);
    const sprite = this.add.sprite(x, y, unitKey("a", cls, "idle")).setDepth(DEPTH.unit + (on === undefined ? y : on * CELL - FOOT + 1));
    // A carrier hauls one way laden and comes back empty: gold in hand at home, none at the far end.
    let laden = true;
    const rest = (): void => {
      if (work === "carry") {
        if (laden) sprite.play(WORK.hold.key);
        else playPose(sprite, "a", cls, "idle");
      } else if (work) sprite.play(WORK[work].key);
      else playPose(sprite, "a", cls, "idle");
    };
    rest();
    if (sprite.anims.currentAnim) sprite.anims.setProgress(Math.random());
    if (left !== undefined) sprite.setFlipX(left);
    if (pace === 0) return;
    let dir = Math.sign(pace);
    const step = Math.abs(pace) * CELL;
    const leg = (): void => {
      if (work === "carry" && laden) sprite.play(WORK.carry.key);
      else if (!work || work === "carry") playPose(sprite, "a", cls, "run");
      sprite.setFlipX(dir < 0);
      this.tweens.add({
        targets: [sprite, shadow],
        x: `+=${dir * step}`,
        duration: step * 26,
        onComplete: () => {
          laden = !laden;
          rest();
          dir = -dir;
          this.time.delayedCall(1200 + Math.random() * 2600, leg);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2400, leg);
  }

  /** One of the party: idle a while, then off to a random point near its spot, never off its own level. */
  private stroller({ cls, col, row }: (typeof PARTY)[number]): void {
    const ground = (c: number, r: number): string | undefined => MAP[Math.floor(r)]?.[Math.floor(c)];
    const level = ground(col, row);
    // A cell under higher ground is that ground's cliff face, drawn a whole cell tall.
    const open = (c: number, r: number): boolean => ground(c, r) === level && [level, "~"].includes(ground(c, r - 1));
    const shadow = addShadow(this, col * CELL, row * CELL, cls === "lancer" ? 0.8 : 0.62);
    const unit = this.add.sprite(col * CELL, row * CELL, unitKey("a", cls, "idle")).setDepth(DEPTH.unit + row * CELL);
    playPose(unit, "a", cls, "idle");
    if (unit.anims.currentAnim) unit.anims.setProgress(Math.random());
    const stroll = (): void => {
      const a = Math.random() * Math.PI * 2;
      const d = (0.4 + Math.random() * 0.6) * ROAM;
      const c = col + Math.cos(a) * d;
      const r = row + Math.sin(a) * d * 0.6;
      const c0 = unit.x / CELL;
      const r0 = unit.y / CELL;
      const n = Math.ceil(Math.hypot(c - c0, r - r0) / 0.2);
      for (let i = 1; i <= n; i++) if (!open(c0 + ((c - c0) * i) / n, r0 + ((r - r0) * i) / n)) return stroll();
      const dx = c * CELL - unit.x;
      playPose(unit, "a", cls, "run");
      if (Math.abs(dx) > 1) unit.setFlipX(dx < 0);
      this.tweens.add({
        targets: [unit, shadow],
        x: c * CELL,
        y: r * CELL,
        duration: Math.hypot(dx, r * CELL - unit.y) * 22,
        onUpdate: () => unit.setDepth(DEPTH.unit + unit.y),
        onComplete: () => {
          playPose(unit, "a", cls, "idle");
          this.time.delayedCall(1500 + Math.random() * 3000, stroll);
        },
      });
    };
    this.time.delayedCall(Math.random() * 2500, stroll);
  }
}

export function startIntro(parent: HTMLElement): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "intro-atlas", IntroAtlasScene);
}
