// The title backdrop while The Atlas is picked: an expedition making landfall
// on a wild, lopsided island in daylight. The boat rides at anchor by the fish
// hut, the camp's fire burns on the beach, pawns dig and build, and the
// landing party loafs about the lowland below a cave still to explore.

import { makeRng, type UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera } from "./boot";
import { buildTerraces } from "./introIsland";
import { CELL, WORK, addMine, cell, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey } from "./sprites";
import { DEPTH, FOOT, addBonfire, addBuilding, addDecor, addShadow, buildWater, driftClouds, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~444~~^^~~~~~~~~~~",
  "~~~~~~55544444^^^^~~~~~~~~~",
  "~~~~~^555)4444^^^^^^~~~~~~~",
  "~~~~~^44444^^^^^^^^^##~~~~~",
  "~~~~[^^4444}^^^^^^^####~~~~",
  "~~~.#^^^^^^^^^^########.~~~",
  "~~.<##^^^##^^^^]######..~~~",
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
export const BUILT = [
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

/** The landing party, each strolling about its own spot, feet in cells: two on the lowland, one up on the crown. */
const PARTY: readonly { cls: UnitClass; col: number; row: number }[] = [
  { cls: "warrior", col: 13, row: 6.9 },
  { cls: "lancer", col: 20, row: 13.4 },
  { cls: "archer", col: 9.2, row: 13.2 },
];
/** How far a stroller strays from its spot, in cells. */
const ROAM = 1.5;

/** The camp and the island at work, feet in cells. `pace` cells there and back, signed for the way it sets off. */
const CAST: readonly { cls: UnitClass; col: number; row: number; pace?: number; left?: boolean; work?: keyof typeof WORK; on?: number }[] = [
  // On the lookout's top, and a monk at the camp fire.
  { cls: "archer", col: 7.4, row: 2.03, on: 3.85 },
  { cls: "monk", col: 11.4, row: 12.5 },
  // Digging the ridge's seam, carrying along the ridge, raising the hut.
  { cls: "pawn", col: 17.4, row: 4.3, work: "dig" },
  { cls: "pawn", col: 18.2, row: 7.5, pace: -2, work: "carry" },
  { cls: "pawn", col: 21.4, row: 15.4, left: true, work: "hammer" },
];

const CAMPFIRE = { col: 12.5, row: 12.6 } as const;
const MINE = { col: 18, row: 3 } as const;
const BOAT = { col: 14, row: 15.3, frame: 256 } as const;
/** Kept clear of strewn scrub, [col, row, radius]: the camp and the mine. */
const CLEAR: readonly [number, number, number][] = [[12.5, 12.6, 2], [18, 3.4, 1.4], [14, 15.3, 1.5], [6, 13.5, 2.6]];

const ground = (c: number, r: number): string => MAP[r]?.[c] ?? "~";
const height = (c: number, r: number): number => {
  const ch = ground(c, r);
  return "5()".includes(ch) ? 5 : "4{}".includes(ch) ? 4 : "^[]".includes(ch) ? 3 : "#<>%".includes(ch) ? 2 : ch === "~" ? 0 : 1;
};
const slope = (c: number, r: number): boolean => "<>[]{}()".includes(ground(c, r));

/** The camp's sheep pen on the west lowland, in cells: its top-left tile, size, and the gate's column in its bottom row. */
const PEN = { col: 4, row: 12, w: 4, h: 3, gate: 6 } as const;
const inPen = (c: number, r: number): boolean => c >= PEN.col - 0.5 && c < PEN.col + PEN.w + 0.5 && r >= PEN.row - 0.5 && r < PEN.row + PEN.h + 0.5;
const SHEEP: readonly [number, number][] = [[5.3, 13.9], [6.6, 13.6], [22.5, 10.5], [21.8, 9.4]];

export class IntroAtlasScene extends Phaser.Scene {
  constructor() {
    super("intro-atlas");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadBuildings(this, BUILT);
    if (!this.textures.exists("fence")) this.load.spritesheet("fence", packUrl("Enemy Pack/Extra/Wooden Fence/Wooden Fence_64x64 tile.png"), { frameWidth: 64, frameHeight: 64 });
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
  }

  private scenery(): void {
    for (const b of BUILT) addBuilding(this, b);
    addMine(this, MINE, "mineActive");
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r], i) => addDecor(this, kind, c * CELL, r * CELL, 1, `atlas-${kind}-${i}`));
    put("tree", [[5.6, 4.6], [12.4, 3.3], [5.4, 5.8], [4.5, 7.2], [3.4, 9.5], [2.8, 10.4], [20.8, 4.8], [22.4, 6.2], [23, 8], [12.4, 10.8], [7, 10.2], [21.4, 15.8], [14.5, 2.6]]);
    put("bush", [[9.4, 10.6], [6.4, 10.6], [18.6, 12.5], [3.3, 12.6], [21.4, 10.6], [6.3, 6.6]]);
    put("rock", [[2.6, 12.4], [23, 11.6], [14.6, 9.7]]);
    this.dress(put);
    put("waterRock", [[1.2, 6.5], [3.4, 3.6], [24.8, 4.5], [25.6, 13.6], [12.2, 16.8], [8.6, 17.4], [1.4, 15], [24.6, 17], [16.4, 16.4]]).forEach((s) => s.setDepth(DEPTH.foam));

    const by = BOAT.row * CELL;
    const boat = this.add.sprite(BOAT.col * CELL, by, "atlasBoat").setOrigin(0.5, 0.7).setScale(0.7).setDepth(DEPTH.foam + 2).play("atlasBoat_loop");
    this.tweens.add({ targets: boat, y: by + 4, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    addBonfire(this, CAMPFIRE.col * CELL, CAMPFIRE.row * CELL);
    this.pen();

    for (const [c, r] of SHEEP) {
      const sheep = this.add.sprite(c * CELL, r * CELL, "sheep").setOrigin(0.5, 0.66).setDepth(standing(r * CELL)).setFlipX(c > 13).play("sheep_anim");
      if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
    }
  }

  /** The pen from the fence sheet's 4x3 parts: corners, rails and sides, the bottom rail stopping at a post either side of the gate. */
  private pen(): void {
    const { col, row, w, h, gate } = PEN;
    const piece = (c: number, r: number, frame: number, crop?: [number, number, number, number]): void => {
      const y = (r + 1) * CELL;
      const img = this.add.image(c * CELL + CELL / 2, y, "fence", frame).setOrigin(0.5, 1).setDepth(standing(y));
      if (crop) img.setCrop(...crop);
    };
    for (let c: number = col; c < col + w; c++) {
      const first = c === col;
      const last = c === col + w - 1;
      piece(c, row, first ? 0 : last ? 3 : 1 + (c % 2));
      // A corner beside the gate keeps its post but not the rail that would run on across the opening.
      if (c !== gate) piece(c, row + h - 1, first ? 8 : last ? 11 : c + 1 === gate ? 9 : c - 1 === gate ? 10 : 1 + (c % 2), first && c + 1 === gate ? [0, 0, 50, 64] : last && c - 1 === gate ? [16, 0, 48, 64] : undefined);
    }
    for (let r: number = row + 1; r < row + h - 1; r++) {
      piece(col, r, 4);
      piece(col + w - 1, r, 7);
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
    const open = (c: number, r: number): boolean => ground(c, r) === level && [level, "~"].includes(ground(c, r - 1)) && !inPen(c, r);
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
