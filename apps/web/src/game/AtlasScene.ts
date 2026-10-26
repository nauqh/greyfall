// The Atlas: the whole Shattered Reach on one map, drawn with the war map's
// autotiler and dressed area by area. Every building, creature and knight the
// engine's atlas places stands here, most of them alive: knights and beasts
// walk their beats, pawns chop, dig and carry, bats and bees hover, sharks
// cruise the channels. A light over each area sets its mood. Nothing here is
// a game yet; the page lets you look round it.

import { atlasMap, type AtlasMap, type AreaId, type Cell, type Dweller, type GateKind, type Placed, useIsland } from "@greyfall/engine";
import * as Phaser from "phaser";

import { BUILDINGS, packUrl } from "./art";
import { DPR, startGame } from "./boot";
import { CELL, buildMap, loadGroundColours, trailTiles } from "./islandMap";
import { STRAT_COLS, STRAT_ROWS, isForest, isLand, isSlope, isWalkable, level } from "./stratMap";
import { DEPTH, addDecor, cloudCover, driftClouds, loadTerrain, prepareTerrain, standing } from "./terrain";
import { HAND } from "./ui";

export interface AtlasHooks {
  /** Asks the page to show an area's card. */
  onArea: (id: AreaId) => void;
  /** Called with a function the page uses to fly the camera to an area, and to show the routes. */
  ready: (api: { focus: (id: AreaId) => void; routes: (on: boolean) => void }) => void;
}

/** A sheet: its file, frame width (and height, when not square), and the ground's height in the frame, 0 to 1. */
interface Sheet {
  file: string;
  frame: number;
  frameH?: number;
  anchor: number;
  scale?: number;
}

const COLOR_DIR = { blue: "Blue", red: "Red", yellow: "Yellow", purple: "Purple", black: "Black" } as const;
type Color = keyof typeof COLOR_DIR;
const BUILDING_FILE: Record<string, string> = {
  castle: "Castle.png",
  tower: "Tower.png",
  barracks: "Barracks.png",
  archery: "Archery.png",
  monastery: "Monastery.png",
  house1: "House1.png",
  house2: "House2.png",
  house3: "House3.png",
};

/** Everything that is not a faction's building, by the engine's names. */
const PROP: Record<string, Sheet> = {
  goblinHut: { file: "Enemy Pack/Extra/Goblin Hut/Goblin Hut.png", frame: 192, frameH: 256, anchor: 240 / 256, scale: 0.85 },
  gnomeHut: { file: "Enemy Pack/Extra/Gnome Buildings/Gnome Hut.png", frame: 128, frameH: 192, anchor: 147 / 192 },
  gnomeTower: { file: "Enemy Pack/Extra/Gnome Buildings/Gnome Tower.png", frame: 128, frameH: 256, anchor: 229 / 256 },
  cave: { file: "Enemy Pack/Extra/Cave/Cave_Idle.png", frame: 192, anchor: 172 / 192, scale: 1.3 },
  fishHut: { file: "Enemy Pack/Extra/Fish Hut/Fish Hut.png", frame: 192, anchor: 177 / 192 },
  pirateTowerWater: { file: "Enemy Pack/Extra/Pirate Tower/Pirate Tower_Water.png", frame: 128, frameH: 192, anchor: 187 / 192 },
  skullSpike: { file: "Enemy Pack/Extra/Skull decorations/Skull Spike_01.png", frame: 64, frameH: 128, anchor: 94 / 128 },
  bones: { file: "Enemy Pack/Extra/Skull decorations/Bones_02.png", frame: 64, anchor: 0.7 },
  deadTree: { file: "Enemy Pack/Extra/Dead Tree/Dead Tree.png", frame: 384, frameH: 320, anchor: 314 / 320, scale: 0.6 },
  trollDead: { file: "Enemy Pack/Extra/Troll Dead/Troll_Dead.png", frame: 384, anchor: 0.77 },
  goldMine: { file: "Resources/Gold Mine/GoldMine_Active.png", frame: 192, frameH: 128, anchor: 0.9, scale: 0.9 },
  goldStone: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 4.png", frame: 128, anchor: 0.75, scale: 0.6 },
  stump: { file: "Terrain/Resources/Wood/Trees/Stump 2.png", frame: 192, frameH: 256, anchor: 0.62, scale: 0.6 },
  boat: { file: "Enemy Pack/Extra/Boat/Boat_Idle.png", frame: 256, anchor: 0.7, scale: 0.7 },
};

/** Creatures: idle and moving sheets, frame size, feet. Flyers hover. */
interface Beast {
  idle: string;
  move?: string;
  frame: number;
  anchor: number;
  scale?: number;
  fly?: boolean;
  swim?: boolean;
}
const EP = "Enemy Pack/";
const BEAST: Record<string, Beast> = {
  torch: { idle: `${EP}Torch Goblin/Torch Goblin_Idle.png`, move: `${EP}Torch Goblin/Torch Goblin_Run.png`, frame: 192, anchor: 132 / 192 },
  spear: { idle: `${EP}Spear Goblin/Spear Goblin_Idle.png`, move: `${EP}Spear Goblin/Spear Goblin_Run.png`, frame: 256, anchor: 174 / 256 },
  thief: { idle: `${EP}Thief/Thief_Idle.png`, move: `${EP}Thief/Thief_Run.png`, frame: 192, anchor: 131 / 192 },
  gnoll: { idle: `${EP}Gnoll/Gnoll_Idle.png`, move: `${EP}Gnoll/Gnoll_Walk.png`, frame: 192, anchor: 133 / 192 },
  troll: { idle: `${EP}Troll/Troll_Idle.png`, move: `${EP}Troll/Troll_Walk.png`, frame: 384, anchor: 296 / 384, scale: 0.8 },
  skull: { idle: `${EP}Skull/Skull_Idle.png`, move: `${EP}Skull/Skull_Run.png`, frame: 192, anchor: 128 / 192 },
  skullGuard: { idle: `${EP}Extra/Skull Guard/Skull_Guard.png`, frame: 192, anchor: 128 / 192 },
  shaman: { idle: `${EP}Hex Shaman/Hex Shaman_Idle.png`, move: `${EP}Hex Shaman/Hex Shaman_Run.png`, frame: 192, anchor: 136 / 192 },
  spider: { idle: `${EP}Spider/Spider_Idle.png`, move: `${EP}Spider/Spider_Run.png`, frame: 192, anchor: 0.68 },
  snake: { idle: `${EP}Snake/Snake_Idle.png`, move: `${EP}Snake/Snake_Run.png`, frame: 192, anchor: 0.68 },
  lizard: { idle: `${EP}Lizard/Lizard_Idle.png`, move: `${EP}Lizard/Lizard_Run.png`, frame: 192, anchor: 0.68 },
  bat: { idle: `${EP}Giant Bat/Giant Bat_Idle.png`, move: `${EP}Giant Bat/Giant Bat_Move.png`, frame: 192, anchor: 0.7, fly: true },
  bee: { idle: `${EP}Bumblebee/Bumblebee_Idle.png`, move: `${EP}Bumblebee/Bumblebee_Move.png`, frame: 192, anchor: 0.7, fly: true, scale: 0.7 },
  imp: { idle: `${EP}Imp/Imp_Idle.png`, move: `${EP}Imp/Imp_Move.png`, frame: 192, anchor: 0.7, fly: true },
  bear: { idle: `${EP}Bear/Bear_Idle.png`, move: `${EP}Bear/Bear_Run.png`, frame: 256, anchor: 0.68 },
  panda: { idle: `${EP}Panda/Panda_Idle.png`, move: `${EP}Panda/Panda_Run.png`, frame: 256, anchor: 0.68 },
  pandaGuard: { idle: `${EP}Extra/Panda Guard/Panda_Guard.png`, frame: 256, anchor: 0.68, scale: 1.2 },
  minotaurGuard: { idle: `${EP}Extra/Minotaur Guard/Minotaur_Guard.png`, frame: 320, anchor: 213 / 320, scale: 1.1 },
  gnome: { idle: `${EP}Gnome/Gnome_Idle.png`, move: `${EP}Gnome/Gnome_Run.png`, frame: 192, anchor: 0.68 },
  slingshot: { idle: `${EP}Slingshot Gnome/Slingshot Gnome_Idle.png`, move: `${EP}Slingshot Gnome/Slingshot Gnome_Run.png`, frame: 192, anchor: 0.68 },
  turtle: { idle: `${EP}Turtle/Turtle_Idle.png`, move: `${EP}Turtle/Turtle_Walk.png`, frame: 320, anchor: 0.66, scale: 0.8 },
  pig: { idle: `${EP}Extra/Pig/Pig_Idle.png`, move: `${EP}Extra/Pig/Pig_Run.png`, frame: 192, anchor: 0.68, scale: 0.8 },
  harpoonShark: { idle: `${EP}Harpoon Shark/Harpoon Shark_Idle.png`, move: `${EP}Harpoon Shark/Harpoon Shark_Run.png`, frame: 192, anchor: 0.62, swim: true },
  paddleShark: { idle: `${EP}Paddle Shark/Paddle Shark_Idle.png`, move: `${EP}Paddle Shark/Paddle Shark_Run.png`, frame: 192, anchor: 0.62, swim: true },
  bombFish: { idle: `${EP}Bomb Fish/Bomb Fish_Idle.png`, move: `${EP}Bomb Fish/Bomb Fish_Run.png`, frame: 192, anchor: 0.62, swim: true },
  seahorseBoat: { idle: `${EP}Extra/Seahorse Boat/Seahorse Boat_Paddle Shark.png`, frame: 192, anchor: 0.62, swim: true },
  rubberDuck: { idle: "Terrain/Decorations/Rubber Duck/Rubber duck.png", frame: 32, anchor: 0.6, swim: true, scale: 1.4 },
  sheep: { idle: "Resources/Sheep/HappySheep_Idle.png", move: "Resources/Sheep/HappySheep_Bouncing.png", frame: 128, anchor: 0.66 },
};

/** A knight of any colour, by class: idle, run, feet. */
const KNIGHT: Record<string, { idle: string; move: string; frame: number; anchor: number }> = {
  warrior: { idle: "Warrior/Warrior_Idle.png", move: "Warrior/Warrior_Run.png", frame: 192, anchor: 136 / 192 },
  archer: { idle: "Archer/Archer_Idle.png", move: "Archer/Archer_Run.png", frame: 192, anchor: 135 / 192 },
  monk: { idle: "Monk/Idle.png", move: "Monk/Run.png", frame: 192, anchor: 133 / 192 },
  lancer: { idle: "Lancer/Lancer_Idle.png", move: "Lancer/Lancer_Run.png", frame: 320, anchor: 197 / 320 },
  pawn: { idle: "Pawn/Pawn_Idle.png", move: "Pawn/Pawn_Run.png", frame: 192, anchor: 134 / 192 },
};
/** A pawn at work: what it plays standing, and walking. */
const PAWN_ACT: Record<string, { idle: string; move?: string }> = {
  axe: { idle: "Pawn/Pawn_Interact Axe.png" },
  pickaxe: { idle: "Pawn/Pawn_Interact Pickaxe.png" },
  hammer: { idle: "Pawn/Pawn_Interact Hammer.png" },
  knife: { idle: "Pawn/Pawn_Interact Knife.png" },
  meat: { idle: "Pawn/Pawn_Idle Meat.png", move: "Pawn/Pawn_Run Meat.png" },
  wood: { idle: "Pawn/Pawn_Idle Wood.png", move: "Pawn/Pawn_Run Wood.png" },
  gold: { idle: "Pawn/Pawn_Idle Gold.png", move: "Pawn/Pawn_Run Gold.png" },
};

/** Trees by area: the big animated pines in Emberwood, dead wood on the moor and in the grey. */
const BIG_TREE: Sheet[] = [
  { file: "Terrain/Resources/Wood/Trees/Tree1.png", frame: 256, anchor: 0.87, scale: 0.85 },
  { file: "Terrain/Resources/Wood/Trees/Tree2.png", frame: 256, anchor: 0.87, scale: 0.85 },
];

const FIRE: Sheet = { file: "Effects/Fire/Fire.png", frame: 128, anchor: 0.8 };
const FENCE = "Enemy Pack/Extra/Wooden Fence/Wooden Fence_64x64 tile.png";

const GATE_TONE: Record<GateKind, string> = { open: "#fdfaf0", gate: "#f4cf6b", shortcut: "#8fd3ff", locked: "#ff9a8a", high: "#c8f08a" };
const GATE_WORD: Record<GateKind, string> = { open: "", gate: "barred", shortcut: "shortcut", locked: "locked", high: "high road" };
const FONT = '"Nunito", "Segoe UI", sans-serif';

/** The area a sea tile takes its light from: the nearest within this many tiles. */
const MOOD_REACH = 6;

export class AtlasScene extends Phaser.Scene {
  private hooks!: AtlasHooks;
  private map!: AtlasMap;
  private names: { text: Phaser.GameObjects.Text; px: number }[] = [];
  private live: { s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; b: Phaser.Geom.Rectangle }[] = [];
  private culledAt = "";
  private routes!: Phaser.GameObjects.Graphics;
  private glows: Phaser.GameObjects.Image[] = [];
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;

  constructor() {
    super("atlas");
  }

  init(data: AtlasHooks): void {
    this.hooks = data;
  }

  preload(): void {
    this.map = atlasMap();
    loadTerrain(this);
    loadGroundColours(this);
    this.load.image("tilesetRoad", packUrl("Terrain/Tileset/Tilemap_color4.png"));
    const sheet = (key: string, s: Sheet): void => {
      if (this.textures.exists(key)) return;
      this.load.spritesheet(key, packUrl(s.file), { frameWidth: s.frame, frameHeight: s.frameH ?? s.frame });
    };
    for (const p of this.map.props) {
      if (p.color) this.load.image(this.buildingKey(p), packUrl(`Buildings/${COLOR_DIR[p.color]} Buildings/${BUILDING_FILE[p.art]}`));
      else sheet(`prop_${p.art}`, PROP[p.art]!);
    }
    for (const k of ["deadTree", "stump", "bones", "skullSpike"]) sheet(`prop_${k}`, PROP[k]!);
    BIG_TREE.forEach((t, i) => sheet(`bigTree${i}`, t));
    sheet("fire", FIRE);
    this.load.spritesheet("fence", packUrl(FENCE), { frameWidth: 64, frameHeight: 64 });
    for (const d of this.map.dwellers) {
      const { idle, move, frame } = this.look(d);
      sheet(idle.key, { file: idle.file, frame, anchor: 0 });
      if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
    }
  }

  /** The sheets a dweller plays, keyed so a colour and a job load once. */
  private look(d: Dweller): { idle: { key: string; file: string }; move?: { key: string; file: string }; frame: number; anchor: number; scale: number; fly: boolean; swim: boolean } {
    if (d.color) {
      const k = KNIGHT[d.kind]!;
      const dir = `Units/${COLOR_DIR[d.color]} Units/`;
      const act = d.kind === "pawn" && d.act ? PAWN_ACT[d.act] : undefined;
      const idle = act?.idle ?? k.idle;
      const move = act?.move ?? k.move;
      return {
        idle: { key: `${d.color}_${idle}`, file: dir + idle },
        move: { key: `${d.color}_${move}`, file: dir + move },
        frame: k.frame,
        anchor: k.anchor,
        scale: 1,
        fly: false,
        swim: false,
      };
    }
    const b = BEAST[d.kind]!;
    return {
      idle: { key: `beast_${d.kind}_idle`, file: b.idle },
      move: b.move ? { key: `beast_${d.kind}_move`, file: b.move } : undefined,
      frame: b.frame,
      anchor: b.anchor,
      scale: b.scale ?? 1,
      fly: b.fly ?? false,
      swim: b.swim ?? false,
    };
  }

  private buildingKey(p: Placed): string {
    return `bld_${p.color}_${p.art}`;
  }

  create(): void {
    useIsland(this.map.island);
    const W = STRAT_COLS * CELL;
    const H = STRAT_ROWS * CELL;
    prepareTerrain(this);
    this.makeAnims();

    const roads = trailTiles(this.map.roads);
    buildMap(this, roads, (c, r, lv) => {
      const a = this.map.areas[Number(this.map.areaAt[r]?.[c] ?? "0") || 0]!;
      const i = this.map.areaAt[r]?.[c];
      const p = i && i !== "-" ? this.map.areas[Number(i)]!.palette : a.palette;
      return `tilesetC${p[Math.min(2, lv - 1)]}`;
    });
    this.dress(roads);
    for (const p of this.map.props) this.addProp(p);
    for (const f of this.map.fences) this.fence(f.col, f.row, f.w, f.h);
    for (const g of this.map.gates) this.gatehouse(g.kind, g.cells);
    for (const f of this.map.fires) this.bonfire(f);
    for (const d of this.map.dwellers) this.addDweller(d);
    this.mood();
    driftClouds(this, { w: W, h: H }, "atlas");
    this.ambience();
    this.labels();
    this.routes = this.add.graphics().setDepth(DEPTH.fx + 2).setVisible(false);
    this.drawRoutes();

    const cam = this.cameras.main;
    cam.setBounds(-4 * CELL, -4 * CELL, W + 8 * CELL, H + 8 * CELL);
    cam.setZoom(this.zoomFor(22));
    const hub = this.map.areas.find((a) => a.id === "harbour")!.label;
    cam.centerOn(hub.col * CELL, (hub.row - 4) * CELL);
    this.input.setDefaultCursor(HAND);
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      cam.zoomTo(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.85 : 1.18), this.zoomFor(STRAT_ROWS + 6), this.zoomFor(9)), 160, "Sine.easeOut", true);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => (this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false }));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 8) d.moved = true;
      if (d.moved) cam.setScroll(d.sx - (p.x - d.x) / cam.zoom, d.sy - (p.y - d.y) / cam.zoom);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const at = cam.getWorldPoint(p.x, p.y);
      const i = this.map.areaAt[Math.floor(at.y / CELL)]?.[Math.floor(at.x / CELL)];
      if (i && i !== "-") this.hooks.onArea(this.map.areas[Number(i)]!.id);
    });
    this.hooks.ready({
      focus: (id) => {
        const a = this.map.areas.find((x) => x.id === id)!;
        cam.pan(a.label.col * CELL, (a.label.row - 5) * CELL, 900, "Sine.easeInOut");
        cam.zoomTo(this.zoomFor(24), 900, "Sine.easeInOut");
      },
      routes: (on) => this.routes.setVisible(on),
    });
    cloudCover(this, "open", () => {});
  }

  private zoomFor(rows: number): number {
    return this.cameras.main.height / (rows * CELL);
  }

  /** Loops for every sheet with more than one frame: props, beasts, knights. */
  private makeAnims(): void {
    for (const key of this.textures.getTextureKeys()) {
      const frames = this.textures.get(key).frameTotal - 1;
      if (frames < 2 || this.anims.exists(`${key}_loop`) || key.startsWith("tileset")) continue;
      this.anims.create({ key: `${key}_loop`, frames: this.anims.generateFrameNumbers(key), frameRate: 9, repeat: -1 });
    }
  }

  private loop(s: Phaser.GameObjects.Sprite, key: string): void {
    if (this.anims.exists(`${key}_loop`)) {
      s.play(`${key}_loop`, true);
      if (s.anims.currentAnim) s.anims.setProgress(Math.random());
    } else s.setTexture(key, 0);
  }

  private track<T extends Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>(s: T, wide = 0): T {
    const b = s.getBounds();
    // Movers wander off their bounds; give them room.
    if (wide) b.setTo(b.x - wide, b.y - wide, b.width + 2 * wide, b.height + 2 * wide);
    this.live.push({ s, b });
    return s;
  }

  /** Trees, undergrowth, rocks, bones and stumps, by each area's own taste. */
  private dress(roads: ReadonlySet<number>): void {
    let seed = 0;
    const r01 = (): number => {
      // A fixed sequence, so the atlas is dressed the same every visit.
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const areaId = (c: number, r: number): AreaId | null => {
      const i = this.map.areaAt[r]?.[c];
      return i && i !== "-" ? this.map.areas[Number(i)]!.id : null;
    };
    const spot = (c: number, r: number, k: string, sheet: Sheet, frame?: number): void => {
      const x = (c + 0.25 + r01() * 0.5) * CELL;
      const y = (r + 0.7 + r01() * 0.3) * CELL;
      const s = this.add.sprite(x, y, k, frame).setOrigin(0.5, sheet.anchor).setScale((sheet.scale ?? 1) * (0.85 + r01() * 0.3)).setDepth(standing(y));
      if (r01() < 0.5) s.setFlipX(true);
      if (frame === undefined) this.loop(s, k);
      this.track(s);
    };
    const decor = (kind: "tree" | "bush" | "rock" | "waterRock", x: number, y: number, scale = 1): void => {
      this.track(addDecor(this, kind, x, y, scale, `${Math.round(x)},${Math.round(y)}`));
    };
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        const id = areaId(c, r);
        if (!isLand(c, r)) {
          // Rocks in the shallows, thicker off Saltreach.
          let coast = false;
          for (let d = -2; d <= 2; d++) coast ||= isLand(c + d, r) || isLand(c, r + d);
          if (coast && r01() < (c < 30 ? 0.1 : 0.05)) decor("waterRock", (c + r01()) * CELL, (r + r01()) * CELL);
          continue;
        }
        if (isForest(c, r)) {
          if (id === "emberwood") {
            const pick = r01() < 0.55 ? 0 : 1;
            spot(c, r, `bigTree${pick}`, BIG_TREE[pick]!);
            if (r01() < 0.3) decor("tree", (c + r01()) * CELL, (r + 0.5) * CELL);
          } else if (id === "barrowmoor" || id === "greyfall") {
            if (r01() < 0.45) spot(c, r, "prop_deadTree", { ...PROP.deadTree!, scale: 0.42 }, 0);
            else decor("bush", (c + 0.5) * CELL, (r + 0.8) * CELL, 0.8);
          } else if (id === "fen") {
            decor("bush", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.8) * CELL, 0.9);
            if (r01() < 0.5) decor("bush", (c + r01()) * CELL, (r + 0.5) * CELL, 0.7);
            if (r01() < 0.35) decor("tree", (c + 0.5) * CELL, (r + 0.9) * CELL);
          } else {
            decor("tree", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.75 + r01() * 0.3) * CELL);
            if (r01() < 0.25) decor("tree", (c + r01()) * CELL, (r + 0.45) * CELL);
          }
          continue;
        }
        if (!isWalkable(c, r) || isSlope(c, r) || isSlope(c, r - 1) || roads.has(r * STRAT_COLS + c)) {
          // A cliff's foot: shrubs and stones soften the wall.
          if (!isWalkable(c, r) && level(c, r - 1) > level(c, r) && r01() < 0.45) decor(r01() < 0.6 ? "bush" : "rock", (c + 0.25 + r01() * 0.5) * CELL, (r + 0.92) * CELL);
          continue;
        }
        let edgy = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) edgy ||= !isWalkable(c + dc, r + dr);
        const roll = r01();
        const chance = (edgy ? 0.2 : 0.05) * (id === "fen" ? 2 : id === "greyfall" ? 0.6 : 1);
        if (roll < chance) {
          const x = (c + 0.2 + r01() * 0.6) * CELL;
          const y = (r + 0.5 + r01() * 0.35) * CELL;
          if (id === "barrowmoor" && r01() < 0.5) spot(c, r, "prop_bones", PROP.bones!, 0);
          else if (id === "emberwood" && r01() < 0.35) spot(c, r, "prop_stump", PROP.stump!, 0);
          else decor(roll < chance * 0.6 ? "bush" : "rock", x, y, roll < chance * 0.6 ? 0.75 : 1);
        }
      }
    }
  }

  private addProp(p: Placed): void {
    const x = (p.col + 0.5) * CELL;
    const y = (p.row + 0.95) * CELL;
    if (p.color) {
      const spec = BUILDINGS[p.art as keyof typeof BUILDINGS];
      this.add.image(x, y, this.buildingKey(p)).setOrigin(0.5, spec.anchorY / spec.h).setScale(p.scale ?? 1).setFlipX(p.flip ?? false).setDepth(standing(y));
      return;
    }
    const spec = PROP[p.art]!;
    const key = `prop_${p.art}`;
    const s = this.add
      .sprite(x, y, key, p.frame ?? 0)
      .setOrigin(0.5, spec.anchor)
      .setScale((p.scale ?? 1) * (spec.scale ?? 1))
      .setFlipX(p.flip ?? false)
      .setDepth(p.art === "boat" || p.art === "pirateTowerWater" ? DEPTH.foam + 2 : standing(y));
    // A dead troll lies as his last frame; a hut keeps its variant; the rest move.
    if (p.art === "trollDead") s.setFrame(this.textures.get(key).frameTotal - 2);
    else if (p.frame === undefined && ["cave", "fishHut", "pirateTowerWater", "boat", "goldMine"].includes(p.art)) this.loop(s, key);
    this.track(s);
  }

  /** A fence pen: corners, rails and posts from the kit's 4x3 tile sheet. */
  private fence(col: number, row: number, w: number, h: number): void {
    const piece = (c: number, r: number, frame: number): void => {
      const y = (r + 1) * CELL;
      this.add.image(c * CELL + CELL / 2, y, "fence", frame).setOrigin(0.5, 1).setDepth(standing(y));
    };
    for (let c = col; c < col + w; c++) {
      const first = c === col;
      const last = c === col + w - 1;
      piece(c, row, first ? 0 : last ? 3 : 1 + (c % 2));
      if (h > 1) piece(c, row + h - 1, first ? 8 : last ? 11 : 9 + (c % 2));
    }
    for (let r = row + 1; r < row + h - 1; r++) {
      piece(col, r, 4);
      piece(col + w - 1, r, 7);
    }
  }

  /** A barred gate: a fence across the way, at the gate's middle. */
  private gatehouse(kind: GateKind, cells: readonly Cell[]): void {
    if (kind === "open" || kind === "high" || cells.length === 0) return;
    const cols = cells.map((c) => c.col);
    const rows = cells.map((c) => c.row);
    const wide = Math.max(...cols) - Math.min(...cols) > Math.max(...rows) - Math.min(...rows);
    const mid = cells[Math.floor(cells.length / 2)]!;
    if (wide) {
      // The way runs east-west: a fence post line north to south.
      const across = cells.filter((c) => c.col === mid.col).map((c) => c.row).sort((a, b) => a - b);
      for (const r of across) this.add.image((mid.col + 0.5) * CELL, (r + 1) * CELL, "fence", r === across[0] ? 0 : r === across.at(-1) ? 8 : 4).setOrigin(0.5, 1).setDepth(standing((r + 1) * CELL));
    } else {
      const across = cells.filter((c) => c.row === mid.row).map((c) => c.col).sort((a, b) => a - b);
      across.forEach((c, i) => this.add.image((c + 0.5) * CELL, (mid.row + 1) * CELL, "fence", i === 0 ? 0 : i === across.length - 1 ? 3 : 1 + (i % 2)).setOrigin(0.5, 1).setDepth(standing((mid.row + 1) * CELL)));
    }
  }

  /** A bonfire: flames, a warm light that breathes, and stones round it. */
  private bonfire(f: Cell): void {
    const x = (f.col + 0.5) * CELL;
    const y = (f.row + 0.8) * CELL;
    if (!this.textures.exists("glow")) {
      // A soft round light, bright in the middle and gone at the rim.
      const t = this.textures.createCanvas("glow", 256, 256)!;
      const g = t.context.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255, 200, 110, 0.9)");
      g.addColorStop(0.35, "rgba(255, 170, 80, 0.4)");
      g.addColorStop(1, "rgba(255, 150, 60, 0)");
      t.context.fillStyle = g;
      t.context.fillRect(0, 0, 256, 256);
      t.refresh();
    }
    const glow = this.add.image(x, y - 24, "glow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.75, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.glows.push(glow);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.7).setDepth(standing(y));
    this.loop(fire, "fire");
    this.track(fire);
  }

  /** Creatures and knights, idle at their spot or walking their beat. */
  private addDweller(d: Dweller): void {
    const look = this.look(d);
    const x = (d.col + 0.5) * CELL;
    const y = (d.row + 0.75) * CELL;
    const s = this.add.sprite(x, y, look.idle.key).setOrigin(0.5, look.anchor).setScale(look.scale).setDepth(look.swim ? DEPTH.foam + 2 : standing(y));
    s.setFlipX(d.flip ?? Math.random() < 0.3);
    this.loop(s, look.idle.key);
    if (look.fly) {
      // Hover: bob, and drift about the spot.
      this.tweens.add({ targets: s, y: y - 70, duration: 1100 + Math.random() * 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: s, x: x + (Math.random() < 0.5 ? -1 : 1) * 90, duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut", onYoyo: () => s.toggleFlipX(), onRepeat: () => s.toggleFlipX() });
      if (look.move) this.loop(s, look.move.key);
      this.track(s, 160);
      return;
    }
    this.track(s, d.to ? Math.max(Math.abs((d.to.col - d.col) * CELL), Math.abs((d.to.row - d.row) * CELL)) + 64 : 0);
    if (!d.to) return;
    const ends = [{ x, y }, { x: (d.to.col + 0.5) * CELL, y: (d.to.row + 0.75) * CELL }];
    const speed = look.swim ? 45 : 80;
    const walk = (i: number): void => {
      const from = ends[1 - i]!;
      const to = ends[i]!;
      s.setFlipX(to.x < from.x);
      if (look.move) this.loop(s, look.move.key);
      this.tweens.add({
        targets: s,
        x: to.x,
        y: to.y,
        duration: (Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) / speed) * 1000,
        onUpdate: () => !look.swim && s.setDepth(standing(s.y)),
        onComplete: () => {
          this.loop(s, look.idle.key);
          this.time.delayedCall(1500 + Math.random() * 3000, () => walk(1 - i));
        },
      });
    };
    this.time.delayedCall(Math.random() * 3000, () => walk(1));
  }

  /** The light over each area, soft across the water between: one texel a tile, multiplied in. */
  private mood(): void {
    const pad = 6;
    const w = STRAT_COLS + 2 * pad;
    const h = STRAT_ROWS + 2 * pad;
    const tex = this.textures.createCanvas("atlasMood", w, h)!;
    const img = tex.context.createImageData(w, h);
    // Over the water the light fades to plain day with distance from the shore.
    const tone = (c: number, r: number): number => {
      for (let d = 0; d <= MOOD_REACH; d++) {
        for (let dr = -d; dr <= d; dr++) {
          for (let dc = -d; dc <= d; dc++) {
            const i = this.map.areaAt[r + dr]?.[c + dc];
            if (!i || i === "-") continue;
            const m = this.map.areas[Number(i)]!.mood;
            const k = d / (MOOD_REACH + 1);
            const mix = (shift: number) => Math.round(((m >> shift) & 255) + (255 - ((m >> shift) & 255)) * k);
            return (mix(16) << 16) | (mix(8) << 8) | mix(0);
          }
        }
      }
      return 0xffffff;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = tone(x - pad, y - pad);
        const k = (y * w + x) * 4;
        img.data[k] = (m >> 16) & 255;
        img.data[k + 1] = (m >> 8) & 255;
        img.data[k + 2] = m & 255;
        img.data[k + 3] = 255;
      }
    }
    tex.context.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(-pad * CELL, -pad * CELL, "atlasMood").setOrigin(0).setScale(CELL).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH.clouds - 3);
  }

  /** Weather by area: grey murk rolling over the Greyfall, mist on the fen and the moor. */
  private ambience(): void {
    const drift = (area: AreaId, n: number, tint: number, alpha: number): void => {
      const cells = [...this.map.areaAt.entries()].flatMap(([r, line]) => [...line].flatMap((ch, c) => (ch !== "-" && this.map.areas[Number(ch)]!.id === area ? [{ c, r }] : [])));
      for (let i = 0; i < n; i++) {
        const at = cells[Math.floor((i / n) * cells.length + (i * 37) % 11)] ?? cells[0]!;
        const cloud = this.add
          .image(at.c * CELL, at.r * CELL, `cloud${1 + (i % 8)}`)
          .setTint(tint)
          .setAlpha(alpha)
          .setScale(1.2 + (i % 3) * 0.4)
          .setDepth(DEPTH.clouds + 1);
        this.tweens.add({ targets: cloud, x: cloud.x + 260, alpha: alpha * 0.4, duration: 9000 + (i % 5) * 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.track(cloud, 300);
      }
    };
    drift("greyfall", 22, 0x9a9ea8, 0.38);
    drift("barrowmoor", 10, 0xb8bce0, 0.3);
    drift("fen", 9, 0xd8f0d8, 0.3);
  }

  /** Area names large, gates and bosses small; all grow back to readable when zoomed out. */
  private labels(): void {
    const text = (x: number, y: number, s: string, size: number, color: string, min: number, alpha = 1): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: Math.round(size / 5) })
        .setOrigin(0.5)
        .setAlpha(alpha)
        .setDepth(DEPTH.fx + 3);
      this.names.push({ text: t, px: min });
      return t;
    };
    for (const a of this.map.areas) text(a.label.col * CELL, a.label.row * CELL, a.name.toUpperCase(), 64, "#fdfaf0", 22).setLetterSpacing(10);
    for (const g of this.map.gates) {
      const word = GATE_WORD[g.kind];
      text((g.at.col + 0.5) * CELL, (g.at.row - 1.2) * CELL, word ? `${g.name} (${word})` : g.name, 26, GATE_TONE[g.kind], 12);
    }
    for (const b of this.map.bosses) text((b.col + 0.5) * CELL, (b.row - 2.4) * CELL, b.name, 28, "#ff8f7a", 13);
  }

  /** The Souls map underneath: each area joined to its neighbours through its gates. */
  private drawRoutes(): void {
    const g = this.routes;
    const centre = (id: AreaId) => this.map.areas.find((a) => a.id === id)!.label;
    for (const gate of this.map.gates) {
      const tone = Phaser.Display.Color.HexStringToColor(GATE_TONE[gate.kind]).color;
      for (const end of [gate.from, gate.to]) {
        const a = centre(end);
        const [x0, y0, x1, y1] = [a.col * CELL, a.row * CELL, (gate.at.col + 0.5) * CELL, (gate.at.row + 0.5) * CELL];
        const n = Math.floor(Phaser.Math.Distance.Between(x0, y0, x1, y1) / 48);
        for (let i = 1; i < n; i++) g.fillStyle(tone, 0.95).fillCircle(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 10);
      }
      g.lineStyle(6, 0x1c2634).fillStyle(tone).fillCircle((gate.at.col + 0.5) * CELL, (gate.at.row + 0.5) * CELL, 22).strokeCircle((gate.at.col + 0.5) * CELL, (gate.at.row + 0.5) * CELL, 22);
    }
  }

  update(): void {
    const cam = this.cameras.main;
    for (const { text, px } of this.names) text.setScale(Math.max(1, (px * DPR) / (Number.parseInt(String(text.style.fontSize)) * cam.zoom)));
    // Off screen, sprites skip drawing and animating.
    const w = cam.width / cam.zoom;
    const h = cam.height / cam.zoom;
    const x = cam.scrollX + (cam.width - w) / 2;
    const y = cam.scrollY + (cam.height - h) / 2;
    const at = `${Math.round(x)}|${Math.round(y)}|${Math.round(w)}`;
    if (at === this.culledAt) return;
    this.culledAt = at;
    for (const { s, b } of this.live) {
      const on = b.right > x && b.x < x + w && b.bottom > y && b.y < y + h;
      s.cameraFilter = on ? 0 : cam.id;
      s.active = on;
    }
  }
}

export function startAtlas(parent: HTMLElement, hooks: AtlasHooks): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "atlas", AtlasScene, hooks);
}
