// The Atlas: the Shattered Reach in three tiers, drawn with the war map's
// autotiler and dressed area by area. Each tier renders to its own camera and
// shows alone: the sky over its cloud bank, the Surface on the sea, the
// Underneath as rock with its caverns lit. Lifts join the tiers where they
// stand, and a click on one rides it. Nothing here is a game yet.

import {
  AREAS,
  AREA_CODE,
  TIERS,
  areaMap,
  districtOf,
  atlasMap,
  footprint,
  useIsland,
  type AreaId,
  type AreaMap,
  type AtlasLift,
  type AtlasMap,
  type AtlasTier,
  type Cell,
  type Dweller,
  type GateKind,
  type LiftKind,
  type Placed,
  type TierId,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { BUILDINGS, packUrl } from "./art";
import { DPR, startGame } from "./boot";
import { CELL, buildMap, loadGroundColours, trailTiles } from "./islandMap";
import { STRAT_COLS, STRAT_ROWS, at, findPath, isForest, isLand, isSlope, isWalkable, level } from "./stratMap";
import { DEPTH, addDecor, cloudCover, loadTerrain, prepareTerrain, standing } from "./terrain";
import { HAND } from "./ui";

export interface AtlasApi {
  /** Fly to an area, on its own tier. */
  focus: (id: AreaId) => void;
  /** Show a tier from its own height. */
  tier: (id: TierId) => void;
  /** Draw the Souls map over the tier in view. */
  routes: (on: boolean) => void;
}

export interface AtlasHooks {
  /** An area's own map instead of the atlas: the camera kept inside it. */
  area?: AreaId;
  /** Asks the page to travel through an exit to another area. */
  onExit?: (to: AreaId) => void;
  /** Asks the page to show an area's card. */
  onArea: (id: AreaId) => void;
  /** Tells the page which tier is in view, after a lift or a tab. */
  onTier: (id: TierId) => void;
  ready: (api: AtlasApi) => void;
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
  cannon: { file: "Enemy Pack/Extra/Cannon/Cannon_Down.png", frame: 128, anchor: 93 / 128, scale: 1.5 },
  cannonSide: { file: "Enemy Pack/Extra/Cannon/Cannon_Right.png", frame: 128, anchor: 85 / 128, scale: 1.5 },
  watchtower: { file: "Enemy Pack/Extra/Pirate Tower/Pirate Tower_Ground.png", frame: 128, frameH: 192, anchor: 179 / 192, scale: 0.9 },
  woodPile: { file: "Terrain/Resources/Wood/Wood Resource/Wood Resource.png", frame: 64, anchor: 46 / 64, scale: 1.2 },
  tools: { file: "Terrain/Resources/Tools/Tool_01.png", frame: 64, anchor: 45 / 64 },
  meat: { file: "Terrain/Resources/Meat/Meat Resource/Meat Resource.png", frame: 64, anchor: 52 / 64 },
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
  turtleGuard: { idle: `${EP}Extra/Turtle Guard/Turtle_Guard_In.png`, frame: 320, anchor: 0.66 },
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
  { file: "Terrain/Resources/Wood/Trees/Tree1.png", frame: 192, frameH: 256, anchor: 0.87, scale: 0.85 },
  { file: "Terrain/Resources/Wood/Trees/Tree2.png", frame: 192, frameH: 256, anchor: 0.87, scale: 0.85 },
];

const FIRE: Sheet = { file: "Effects/Fire/Fire.png", frame: 128, anchor: 0.8 };
const FENCE = "Enemy Pack/Extra/Wooden Fence/Wooden Fence_64x64 tile.png";

const GATE_TONE: Record<GateKind, string> = { open: "#fdfaf0", gate: "#f4cf6b", shortcut: "#8fd3ff", locked: "#ff9a8a", high: "#c8f08a" };
const GATE_WORD: Record<GateKind, string> = { open: "", gate: "barred", shortcut: "shortcut", locked: "locked", high: "high road" };
const FONT = '"Nunito", "Segoe UI", sans-serif';

/** The area a sea tile takes its light from: the nearest within this many tiles. */
const MOOD_REACH = 6;

const LIFT_TONE: Record<LiftKind, string> = { lift: "#ffe9a8", drop: "#d6b8ff", shortcut: "#8fd3ff" };

/** Ground under the rock of the Underneath: dark, and darker than the caverns. */
const ROCK_MOOD = 0x1e1e2a;

interface Tracked {
  s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  b: Phaser.Geom.Rectangle;
  tier: TierId;
}

export class AtlasScene extends Phaser.Scene {
  private hooks!: AtlasHooks;
  private map!: AtlasMap;
  /** The tier being built, while it is. */
  private building: TierId = "surface";
  private view: TierId = "surface";
  private cams!: Record<TierId, Phaser.Cameras.Scene2D.Camera>;
  private names: { text: Phaser.GameObjects.Text; px: number; tier: TierId }[] = [];
  private live: Tracked[] = [];
  private routes: Partial<Record<TierId, Phaser.GameObjects.Graphics>> = {};
  private showRoutes = false;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  /** In an area's own map: that map. */
  private local: AreaMap | null = null;
  private built = new Set<TierId>();
  /** Each exit's sign: clicking it travels, as the exit's own tile does. */
  private signs: { to: AreaId; text: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super("atlas");
  }

  init(data: AtlasHooks): void {
    this.hooks = data;
  }

  preload(): void {
    if (this.hooks.area) {
      // One area's map stands in for every tier; only its own is built.
      this.local = areaMap(this.hooks.area);
      this.map = { tiers: { sky: this.local, surface: this.local, below: this.local }, areas: [...AREAS], lifts: [] };
    } else this.map = atlasMap();
    loadTerrain(this);
    loadGroundColours(this);
    this.load.image("tilesetRoad", packUrl("Terrain/Tileset/Tilemap_color4.png"));
    const sheet = (key: string, s: Sheet): void => {
      if (this.textures.exists(key)) return;
      this.load.spritesheet(key, packUrl(s.file), { frameWidth: s.frame, frameHeight: s.frameH ?? s.frame });
    };
    for (const tier of new Set(Object.values(this.map.tiers))) {
      for (const p of tier.props) {
        if (p.color) this.load.image(this.buildingKey(p), packUrl(`Buildings/${COLOR_DIR[p.color]} Buildings/${BUILDING_FILE[p.art]}`));
        else sheet(`prop_${p.art}`, PROP[p.art]!);
      }
      for (const d of tier.dwellers) {
        const { idle, move, frame } = this.look(d);
        sheet(idle.key, { file: idle.file, frame, anchor: 0 });
        if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
      }
    }
    for (const k of ["deadTree", "stump", "bones", "skullSpike", "goldStone"]) sheet(`prop_${k}`, PROP[k]!);
    BIG_TREE.forEach((t, i) => sheet(`bigTree${i}`, t));
    sheet("fire", FIRE);
    this.load.spritesheet("fence", packUrl(FENCE), { frameWidth: 64, frameHeight: 64 });
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
        scale: d.scale ?? 1,
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
      scale: (b.scale ?? 1) * (d.scale ?? 1),
      fly: b.fly ?? false,
      swim: b.swim ?? false,
    };
  }

  private buildingKey(p: Placed): string {
    return `bld_${p.color}_${p.art}`;
  }

  create(): void {
    prepareTerrain(this);
    this.makeAnims();
    this.glowTextures();

    // Each tier is built on its own island and kept to its own camera, the first time it is shown.
    const main = this.cameras.main;
    this.cams = {
      surface: main,
      below: this.cameras.add(0, 0, main.width, main.height).setBackgroundColor(0x101018),
      sky: this.cameras.add(0, 0, main.width, main.height),
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
      for (const c of Object.values(this.cams)) c.setSize(size.width, size.height);
    });

    if (this.local) {
      // The camera stays inside the area, and opens on where a traveller arrives.
      const local = this.local;
      const cam = this.cams[local.id];
      // Bounds after show(): it builds the map, and only then is the grid this area's size.
      this.show(local.id);
      for (const c of Object.values(this.cams)) c.setBounds(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
      cam.setZoom(this.zoomFor(22));
      cam.centerOn((local.entry.col + 0.5) * CELL, (local.entry.row + 0.5) * CELL);
    } else {
      const hub = AREAS.find((a) => a.id === "harbour")!.label;
      main.setZoom(this.zoomFor(22));
      main.centerOn(hub.col * CELL, (hub.row - 4) * CELL);
      this.show("surface");
    }
    this.controls();
    this.hooks.ready({
      focus: (id) => {
        const a = AREAS.find((x) => x.id === id)!;
        this.show(a.tier);
        // The middle of the area's own ground: a label can sit on its shore.
        const ch = AREA_CODE[AREAS.indexOf(a)];
        const tiles = this.map.tiers[a.tier].areaAt.flatMap((line, r) => [...line].flatMap((x, c) => (x === ch ? [{ c, r }] : [])));
        const mid = (k: "c" | "r") => tiles.reduce((n, t) => n + t[k], 0) / Math.max(1, tiles.length);
        this.flyTo({ col: mid("c"), row: mid("r") }, 24);
      },
      tier: (id) => {
        this.show(id);
        // Onto the tier's ground, when the view would otherwise be open sky or solid rock.
        const cam = this.active;
        const ch = this.map.tiers[id].areaAt[Math.floor((cam.scrollY + cam.height / 2) / CELL)]?.[Math.floor((cam.scrollX + cam.width / 2) / CELL)];
        if (!ch || ch === "-") {
          const first = AREAS.find((a) => a.tier === id)!;
          this.flyTo({ col: first.label.col, row: first.label.row - 5 }, 24);
        }
      },
      routes: (on) => {
        this.showRoutes = on;
        for (const [id, g] of Object.entries(this.routes)) g.setVisible(on && id === this.view);
      },
    });
    cloudCover(this, "open", () => {});
  }

  private zoomFor(rows: number): number {
    return this.cameras.main.height / (rows * CELL);
  }

  /** The camera of the tier in view drives; the others follow, nearer or further. */
  private get active(): Phaser.Cameras.Scene2D.Camera {
    return this.cams[this.view];
  }

  /**
   * One tier in view, alone, its camera taking over where the last one looked.
   */
  /** Builds a tier on first sight: baking all three up front was most of the load. */
  private ensure(id: TierId): void {
    if (this.built.has(id)) return;
    this.built.add(id);
    const made = this.buildTier(this.map.tiers[id]);
    for (const other of TIERS) if (other !== id) this.cams[other].ignore(made);
  }

  private show(id: TierId): void {
    this.ensure(id);
    const from = this.active;
    const centre = { x: from.scrollX + from.width / 2, y: from.scrollY + from.height / 2 };
    const zoom = from.zoom;
    this.view = id;
    for (const t of ["sky", "surface", "below"] as const) this.cams[t].setVisible(t === id);
    const to = this.active;
    to.setZoom(zoom);
    to.centerOn(centre.x, centre.y);
    for (const [t, g] of Object.entries(this.routes)) g.setVisible(this.showRoutes && t === id);
    this.hooks.onTier(id);
  }

  private flyTo(c: Cell, rows: number): void {
    const cam = this.active;
    cam.pan(c.col * CELL, c.row * CELL, 900, "Sine.easeInOut", true);
    cam.zoomTo(this.zoomFor(rows), 900, "Sine.easeInOut", true);
  }

  /** Ride a lift: the view changes tier, and lands on the lift's other end. */
  private ride(l: AtlasLift, from: TierId): void {
    const end = l.up.tier === from ? l.down : l.up;
    const cam = this.active;
    this.show(end.tier);
    const to = this.active;
    to.setZoom(cam.zoom * (end.tier === l.up.tier ? 0.8 : 1.25));
    to.centerOn(end.at.col * CELL, end.at.row * CELL);
    to.zoomTo(cam.zoom, 700, "Sine.easeOut", true);
  }

  private controls(): void {
    this.input.setDefaultCursor(HAND);
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.active;
      const widest = this.local ? Math.max(this.zoomFor(STRAT_ROWS), cam.width / (STRAT_COLS * CELL)) : this.zoomFor(STRAT_ROWS + 6);
      cam.zoomTo(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.85 : 1.18), widest, this.zoomFor(9)), 160, "Sine.easeOut", true);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const cam = this.active;
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 8) d.moved = true;
      const cam = this.active;
      if (d.moved) cam.setScroll(d.sx - (p.x - d.x) / cam.zoom, d.sy - (p.y - d.y) / cam.zoom);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const w = this.active.getWorldPoint(p.x, p.y);
      const cell = { col: Math.floor(w.x / CELL), row: Math.floor(w.y / CELL) };
      // An exit travels, a lift's end rides it, else the area under the pointer.
      for (const e of this.local?.exits ?? []) {
        if (Math.abs(e.at.col - cell.col) <= 2 && Math.abs(e.at.row - cell.row) <= 2) return this.hooks.onExit?.(e.to);
      }
      for (const s of this.signs) if (s.text.getBounds().contains(w.x, w.y)) return this.hooks.onExit?.(s.to);
      for (const l of this.map.lifts) {
        for (const end of [l.up, l.down]) {
          if (end.tier === this.view && Math.abs(end.at.col - cell.col) <= 2 && Math.abs(end.at.row - cell.row) <= 2) return this.ride(l, this.view);
        }
      }
      const ch = this.map.tiers[this.view].areaAt[cell.row]?.[cell.col];
      if (ch && ch !== "-") this.hooks.onArea(AREAS[AREA_CODE.indexOf(ch)]!.id);
    });
  }

  /** Loops for every sheet with more than one frame: props, beasts, knights. */
  private makeAnims(): void {
    for (const key of this.textures.getTextureKeys()) {
      const frames = this.textures.get(key).frameTotal - 1;
      if (frames < 2 || this.anims.exists(`${key}_loop`) || key.startsWith("tileset")) continue;
      this.anims.create({ key: `${key}_loop`, frames: this.anims.generateFrameNumbers(key), frameRate: 9, repeat: -1 });
    }
  }

  /** A soft round light, and a shaft of it for lifts going up. */
  private glowTextures(): void {
    const t = this.textures.createCanvas("glow", 256, 256)!;
    const g = t.context.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255, 200, 110, 0.9)");
    g.addColorStop(0.35, "rgba(255, 170, 80, 0.4)");
    g.addColorStop(1, "rgba(255, 150, 60, 0)");
    t.context.fillStyle = g;
    t.context.fillRect(0, 0, 256, 256);
    t.refresh();
    const b = this.textures.createCanvas("beam", 64, 256)!;
    const v = b.context.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, "rgba(255, 245, 200, 0)");
    v.addColorStop(0.6, "rgba(255, 240, 190, 0.55)");
    v.addColorStop(1, "rgba(255, 235, 180, 0.9)");
    const h = b.context.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, "rgba(0, 0, 0, 1)");
    h.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    h.addColorStop(1, "rgba(0, 0, 0, 1)");
    b.context.fillStyle = v;
    b.context.fillRect(0, 0, 64, 256);
    b.context.globalCompositeOperation = "destination-out";
    b.context.fillStyle = h;
    b.context.fillRect(0, 0, 64, 256);
    b.refresh();
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
    this.live.push({ s, b, tier: this.building });
    return s;
  }

  /** Everything one tier draws, on its own island; returns what it made. */
  private buildTier(tier: AtlasTier): Phaser.GameObjects.GameObject[] {
    this.building = tier.id;
    useIsland(tier.island);
    const before = new Set(this.children.list);
    // An area map draws no roads: its ways are open ground in the district's own colour, a road tile's
    // other colour read as a stripe painted on. The engine's roads still keep that ground clear.
    const roads = this.local ? new Set<number>() : trailTiles(tier.roads);
    const local = this.local;
    buildMap(this, roads, (c, r, lv) => {
      if (local) {
        const d = districtOf(local, c, r);
        if (!d) return "tilesetC4";
        // A bridge deck takes its height's colour, the same as the land at either end of it.
        return `tilesetC${d.palette[Math.min(d.palette.length - 1, lv - 1)]}`;
      }
      const ch = tier.areaAt[r]?.[c];
      // The rock of the Underneath, and anything outside an area, in the dustiest green.
      const p = ch && ch !== "-" ? AREAS[AREA_CODE.indexOf(ch)]!.palette : [4, 4, 4];
      return `tilesetC${p[Math.min(2, lv - 1)]}`;
    });
    if (tier.base === "sky") this.skyBeneath();
    // Under the rock, black water: the Underneath's lakes.
    if (tier.base === "rock") this.add.rectangle(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL, 0x1f4656).setOrigin(0).setDepth(DEPTH.water);
    this.dress(tier, roads);
    for (const p of tier.props) this.addProp(p, tier.base);
    for (const f of tier.fences) this.fence(f.col, f.row, f.w, f.h);
    for (const g of tier.gates) this.gatehouse(g.kind, g.cells);
    for (const f of tier.fires) this.bonfire(f);
    for (const d of tier.dwellers) this.addDweller(d);
    for (const l of this.map.lifts) for (const end of [l.up, l.down]) if (end.tier === tier.id) this.liftMark(l, end === l.up);
    for (const e of this.local?.exits ?? []) this.exitMark(e);
    this.mood(tier);
    this.ambience(tier);
    this.labels(tier);
    this.routes[tier.id] = this.drawRoutes(tier);
    const made = this.children.list.filter((o) => !before.has(o));
    if (tier.base === "sky") {
      // Foam round a sky isle is cloud clinging to its rim.
      for (const o of made) if (o instanceof Phaser.GameObjects.Sprite && o.texture.key === "foam") o.setTint(0xf4f8ff).setAlpha(0.85);
    }
    return made;
  }

  /** In the sky: open blue, and a bank of cloud under the isles. */
  private skyBeneath(): void {
    const W = STRAT_COLS * CELL;
    const H = STRAT_ROWS * CELL;
    this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0xbfe0f0).setDepth(DEPTH.water);
    for (let i = 0; i < 40; i++) {
      const x = ((i * 977) % 100) / 100 * W;
      const y = ((i * 613) % 100) / 100 * H;
      const cloud = this.add.image(x, y, `cloud${1 + (i % 8)}`).setAlpha(0.55).setScale(2 + (i % 3)).setDepth(DEPTH.water + 1);
      this.tweens.add({ targets: cloud, x: x + 400, duration: 40000 + (i % 7) * 6000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** Trees, undergrowth, rocks, bones and stumps, by each area's own taste. */
  private dress(tier: AtlasTier, roads: ReadonlySet<number>): void {
    let seed = tier.id.length * 7919;
    const r01 = (): number => {
      // A fixed sequence, so the atlas is dressed the same every visit.
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const areaId = (c: number, r: number): AreaId | null => {
      if (this.local) return districtOf(this.local, c, r)?.dress ?? null;
      const ch = tier.areaAt[r]?.[c];
      return ch && ch !== "-" ? AREAS[AREA_CODE.indexOf(ch)]!.id : null;
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
      this.track(addDecor(this, kind, x, y, scale, `${tier.id}${Math.round(x)},${Math.round(y)}`));
    };
    // Nothing grows in a building's base or the ground round it.
    const built = new Set(tier.props.flatMap((p) => footprint(p, true).map((c) => c.row * STRAT_COLS + c.col)));
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        const id = areaId(c, r);
        if (built.has(r * STRAT_COLS + c) && isLand(c, r)) continue;
        // The rock of the Underneath is bare: its dark is the point.
        if (at(c, r) === "%") continue;
        if (!isLand(c, r)) {
          if (tier.base === "sky") continue;
          let coast = false;
          for (let d = -2; d <= 2; d++) coast ||= isLand(c + d, r) || isLand(c, r + d);
          if (coast && r01() < (c < 30 && tier.base === "sea" ? 0.1 : 0.05)) decor("waterRock", (c + r01()) * CELL, (r + r01()) * CELL);
          continue;
        }
        if (isForest(c, r)) {
          if (id === "emberwood") {
            const pick = r01() < 0.55 ? 0 : 1;
            // Still, not swaying: the first frame of the sheet.
            spot(c, r, `bigTree${pick}`, BIG_TREE[pick]!, 0);
            if (r01() < 0.3) decor("tree", (c + r01()) * CELL, (r + 0.5) * CELL);
          } else if (tier.base === "rock" && this.local) {
            // An underground map's walls are rock: rubble and old bones at their foot, no trees.
            if (r01() < 0.6) decor("rock", (c + 0.2 + r01() * 0.6) * CELL, (r + 0.6 + r01() * 0.3) * CELL, 1.1);
            if (r01() < 0.2) decor("rock", (c + r01()) * CELL, (r + 0.4) * CELL, 0.8);
            if (r01() < 0.12) spot(c, r, "prop_bones", PROP.bones!, 0);
          } else if (id === "barrowmoor" || id === "greyfall" || tier.base === "rock") {
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
        // Trees on the high ground, back from its rim: the engine leaves it open, so they are only dressing.
        const byLift = this.map.lifts.some((l) => [l.up, l.down].some((e) => e.tier === tier.id && Math.abs(e.at.col - c) <= 1 && Math.abs(e.at.row - r) <= 2));
        if (level(c, r) >= 2 && isWalkable(c, r) && !isSlope(c, r) && tier.base !== "rock" && !byLift) {
          let rim = false;
          for (let dr = -1; dr <= 2; dr++) for (let dc = -1; dc <= 1; dc++) rim ||= level(c + dc, r + dr) !== level(c, r) || isSlope(c + dc, r + dr);
          const own = (this.local && districtOf(this.local, c, r)?.trees);
          const odds = own ?? (id === "emberwood" ? 0.3 : id === "crags" && this.local ? 0.16 : id === "crags" || id === "saltreach" ? 0.08 : 0.03);
          if (!rim && r01() < odds) {
            if (id === "emberwood") {
              const pick = r01() < 0.55 ? 0 : 1;
              spot(c, r, `bigTree${pick}`, BIG_TREE[pick]!, 0);
            } else if (id === "barrowmoor" || id === "greyfall") spot(c, r, "prop_deadTree", { ...PROP.deadTree!, scale: 0.42 }, 0);
            // The gnomes' rock is bare: boulders and scree on its ledges, no trees.
            // On the mountain, scrub on its lower slopes and boulders above.
            else if (id === "crags" && this.local) decor(level(c, r) <= 2 ? "tree" : "rock", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.75) * CELL, level(c, r) <= 2 ? 1 : 1.3);
            else decor("tree", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.75) * CELL);
            continue;
          }
        }
        if (!isWalkable(c, r) || isSlope(c, r) || isSlope(c, r - 1) || roads.has(r * STRAT_COLS + c)) {
          // A cliff's foot: shrubs and stones soften the wall.
          if (!isWalkable(c, r) && level(c, r - 1) > level(c, r) && r01() < 0.45) decor(r01() < 0.6 && tier.base !== "rock" ? "bush" : "rock", (c + 0.25 + r01() * 0.5) * CELL, (r + 0.92) * CELL);
          continue;
        }
        let edgy = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) edgy ||= !isWalkable(c + dc, r + dr);
        const roll = r01();
        const thick = (this.local && districtOf(this.local, c, r)?.decor) ?? 1;
        const chance = (edgy ? 0.2 : 0.05) * (id === "fen" ? 2 : id === "greyfall" ? 0.6 : 1) * thick;
        if (roll < chance) {
          const x = (c + 0.2 + r01() * 0.6) * CELL;
          const y = (r + 0.5 + r01() * 0.35) * CELL;
          if ((id === "barrowmoor" || tier.base === "rock") && r01() < 0.5) spot(c, r, "prop_bones", PROP.bones!, 0);
          else if (id === "emberwood" && r01() < 0.35) spot(c, r, "prop_stump", PROP.stump!, 0);
          else decor(roll < chance * 0.6 && tier.base !== "rock" ? "bush" : "rock", x, y, roll < chance * 0.6 ? 0.75 : 1);
        }
      }
    }
  }

  private addProp(p: Placed, base: AtlasTier["base"]): void {
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
    // Gold in the rock of the Underneath glows.
    if (p.art === "goldStone" && base === "rock") this.add.image(x, y - 20, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe27a).setAlpha(0.5).setScale(0.9).setDepth(DEPTH.clouds - 2);
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
    const glow = this.add.image(x, y - 24, "glow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.75, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.7).setDepth(standing(y));
    this.loop(fire, "fire");
    this.track(fire);
  }

  /**
   * A lift's end: going up, a shaft of light; going down, a dark mouth in
   * the ground. Its name says where it goes and which way it runs.
   */
  private liftMark(l: AtlasLift, upper: boolean): void {
    const end = upper ? l.up : l.down;
    const x = (end.at.col + 0.5) * CELL;
    const y = (end.at.row + 0.8) * CELL;
    if (upper) {
      this.add.ellipse(x, y, 110, 52, 0x05050a, 0.85).setStrokeStyle(5, 0x3a3f4a).setDepth(DEPTH.ground + 1);
      this.add.ellipse(x, y + 4, 70, 30, 0x000000, 0.9).setDepth(DEPTH.ground + 2);
    } else {
      const beam = this.add.image(x, y, "beam").setOrigin(0.5, 1).setScale(1.6, 2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.clouds - 2);
      this.tweens.add({ targets: beam, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.add.ellipse(x, y, 90, 40, 0xfff2c0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ground + 1);
    }
    const other = upper ? l.down : l.up;
    const where = AREAS.find((a) => a.id === other.area)!.name;
    const way = upper ? "down" : l.kind === "drop" ? "from above" : l.kind === "shortcut" ? "up, once opened" : "up";
    const t = this.add
      .text(x, y - 2.4 * CELL, `${l.name} (${way})\n${where}`, { fontFamily: FONT, fontSize: "24px", fontStyle: "bold", color: LIFT_TONE[l.kind], stroke: "#1c2634", strokeThickness: 5, align: "center" })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 3);
    this.names.push({ text: t, px: 12, tier: this.building });
  }

  /**
   * An area map's exit: a lift's shaft of light or a well's dark mouth when it
   * goes up or down a tier, else a sign at the map's edge naming where the road goes.
   */
  private exitMark(e: AreaMap["exits"][number]): void {
    const x = (e.at.col + 0.5) * CELL;
    const y = (e.at.row + 0.8) * CELL;
    const here = this.local!.id;
    const there = AREAS.find((a) => a.id === e.to)!;
    const up = TIERS.indexOf(there.tier) < TIERS.indexOf(here);
    const down = TIERS.indexOf(there.tier) > TIERS.indexOf(here);
    if (down) {
      this.add.ellipse(x, y, 110, 52, 0x05050a, 0.85).setStrokeStyle(5, 0x3a3f4a).setDepth(DEPTH.ground + 1);
      this.add.ellipse(x, y + 4, 70, 30, 0x000000, 0.9).setDepth(DEPTH.ground + 2);
    } else if (up) {
      const beam = this.add.image(x, y, "beam").setOrigin(0.5, 1).setScale(1.6, 2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.clouds - 2);
      this.tweens.add({ targets: beam, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const tone = e.kind in GATE_TONE ? GATE_TONE[e.kind as GateKind] : LIFT_TONE[e.kind as LiftKind];
    const word = up ? "up to " : down ? "down to " : "to ";
    const t = this.add
      // Kept a few tiles inside the map so an edge exit's sign is never cut off.
      .text(Phaser.Math.Clamp(x, 4 * CELL, (STRAT_COLS - 4) * CELL), Math.max(y - (up || down ? 2.4 : 1.2) * CELL, 3 * CELL), `${e.name}\n${word}${there.name}`, { fontFamily: FONT, fontSize: "26px", fontStyle: "bold", color: tone, stroke: "#1c2634", strokeThickness: 6, align: "center" })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 3);
    this.names.push({ text: t, px: 13, tier: this.building });
    this.signs.push({ to: e.to, text: t });
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
    // A walker keeps to the ground it can walk: round the cliffs, and up and down only by the stairs.
    const found = d.to && !look.swim ? findPath({ col: d.col, row: d.row }, d.to) : null;
    // A beat that only goes the long way round, down one stair and up another, is not walked: it stays at its post.
    const route = found && d.to && found.length <= 2 * (Math.abs(d.to.col - d.col) + Math.abs(d.to.row - d.row)) + 8 ? found : null;
    const cells = route ? [{ col: d.col, row: d.row }, ...route] : d.to && look.swim ? [{ col: d.col, row: d.row }, d.to] : [];
    const points = cells.map((c) => ({ x: (c.col + 0.5) * CELL, y: (c.row + 0.75) * CELL }));
    const reach = points.reduce((m, p) => Math.max(m, Math.abs(p.x - x), Math.abs(p.y - y)), 0);
    this.track(s, points.length > 1 ? reach + 64 : 0);
    if (points.length < 2) return;
    const speed = look.swim ? 45 : 80;
    const walk = (way: { x: number; y: number }[]): void => {
      if (look.move) this.loop(s, look.move.key);
      this.tweens.chain({
        targets: s,
        tweens: way.slice(1).map((to, i) => ({
          x: to.x,
          y: to.y,
          duration: (Phaser.Math.Distance.Between(way[i]!.x, way[i]!.y, to.x, to.y) / speed) * 1000,
          onStart: () => to.x !== way[i]!.x && s.setFlipX(to.x < way[i]!.x),
          onUpdate: () => !look.swim && s.setDepth(standing(s.y)),
        })),
        onComplete: () => {
          this.loop(s, look.idle.key);
          this.time.delayedCall(1500 + Math.random() * 3000, () => walk([...way].reverse()));
        },
      });
    };
    this.time.delayedCall(Math.random() * 3000, () => walk(points));
  }

  /** The light over each area, soft across the water between: one texel a tile, multiplied in. Rock is near black. */
  private mood(tier: AtlasTier): void {
    const pad = 6;
    const w = STRAT_COLS + 2 * pad;
    const h = STRAT_ROWS + 2 * pad;
    const tex = this.textures.createCanvas(`atlasMood-${tier.id}`, w, h)!;
    const img = tex.context.createImageData(w, h);
    const rows = tier.island.rows;
    // Over the water the light fades to plain day with distance from the shore:
    // one pass outward from the land, eight ways, carries each area's light up to MOOD_REACH tiles.
    const near = new Int32Array(w * h).fill(-1);
    const dist = new Uint8Array(w * h);
    const queue: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = tier.areaAt[y - pad]?.[x - pad];
        if (!ch || ch === "-") continue;
        near[y * w + x] = AREAS[AREA_CODE.indexOf(ch)]!.mood;
        queue.push(y * w + x);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i]!;
      if (dist[k]! >= MOOD_REACH) continue;
      const [x, y] = [k % w, Math.floor(k / w)];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          const n = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || near[n] !== -1) continue;
          near[n] = near[k]!;
          dist[n] = dist[k]! + 1;
          queue.push(n);
        }
      }
    }
    // Underground in an area's own map, the dark is the point: ground is near black but in pools of light
    // round its fires, its ways out, and the gold glowing in the rock.
    const lights = this.local && tier.base === "rock"
      ? [
          ...tier.fires.map((f) => ({ c: f.col, r: f.row, reach: 9 })),
          ...this.local.exits.map((e) => ({ c: e.at.col, r: e.at.row, reach: 7 })),
          ...tier.props.filter((p) => p.art === "goldStone").map((p) => ({ c: p.col, r: p.row, reach: 4 })),
        ]
      : null;
    const lit = (c: number, r: number): number => Math.max(0, ...lights!.map((l) => 1 - Math.hypot(c - l.c, r - l.r) / l.reach));
    const tone = (c: number, r: number): number => {
      if (tier.base === "rock" && (rows[r]?.[c] ?? "%") === "%") return ROCK_MOOD;
      if (lights) {
        // Open water has no area of its own: it takes the map's, a little dimmer, so a lake reads as water in the dark.
        const own = AREAS[AREA_CODE.indexOf(tier.areaAt[r]![c]!)]?.mood;
        const m = own ?? AREAS.find((a) => a.id === this.local!.area)!.mood;
        const k = Math.min(1, (own ? 0.22 : 0.3) + lit(c, r) * 1.1);
        const mix = (shift: number) => Math.round(((ROCK_MOOD >> shift) & 255) + (((m >> shift) & 255) - ((ROCK_MOOD >> shift) & 255)) * k);
        return (mix(16) << 16) | (mix(8) << 8) | mix(0);
      }
      const k = (r + pad) * w + c + pad;
      const m = near[k]!;
      if (m === -1) return tier.base === "rock" ? ROCK_MOOD : 0xffffff;
      const f = tier.base === "rock" ? 0 : dist[k]! / (MOOD_REACH + 1);
      const mix = (shift: number) => Math.round(((m >> shift) & 255) + (255 - ((m >> shift) & 255)) * f);
      return (mix(16) << 16) | (mix(8) << 8) | mix(0);
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
    this.add.image(-pad * CELL, -pad * CELL, `atlasMood-${tier.id}`).setOrigin(0).setScale(CELL).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH.clouds - 3);
  }

  /** Weather by area: grey murk over the Greyfall, mist on the fen, the moor and in the deeps. */
  private ambience(tier: AtlasTier): void {
    const drift = (area: AreaId, n: number, tint: number, alpha: number): void => {
      const ch = AREA_CODE[AREAS.findIndex((a) => a.id === area)];
      const cells = [...tier.areaAt.entries()].flatMap(([r, line]) => [...line].flatMap((x, c) => (x === ch ? [{ c, r }] : [])));
      if (cells.length === 0) return;
      for (let i = 0; i < n; i++) {
        const at = cells[Math.floor((i / n) * cells.length + ((i * 37) % 11))] ?? cells[0]!;
        const cloud = this.add.image(at.c * CELL, at.r * CELL, `cloud${1 + (i % 8)}`).setTint(tint).setAlpha(alpha).setScale(1.2 + (i % 3) * 0.4).setDepth(DEPTH.clouds + 1);
        this.tweens.add({ targets: cloud, x: cloud.x + 260, alpha: alpha * 0.4, duration: 9000 + (i % 5) * 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.track(cloud, 300);
      }
    };
    if (tier.id === "surface") {
      drift("greyfall", 22, 0x9a9ea8, 0.38);
      drift("barrowmoor", 10, 0xb8bce0, 0.3);
      drift("fen", 9, 0xd8f0d8, 0.3);
    } else if (tier.id === "below") {
      drift("deeps", 8, 0x6a6080, 0.3);
      drift("hollow", 12, 0x9ab8d0, 0.3);
    } else {
      drift("gilded", 6, 0xffffff, 0.35);
    }
  }

  /** Area names large, gates and bosses small; all grow back to readable when zoomed out. */
  private labels(tier: AtlasTier): void {
    const text = (x: number, y: number, s: string, size: number, color: string, min: number): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: Math.round(size / 5) })
        .setOrigin(0.5)
        .setDepth(DEPTH.fx + 3);
      this.names.push({ text: t, px: min, tier: this.building });
      return t;
    };
    for (const d of this.local?.districts ?? []) text((d.at.col + 0.5) * CELL, d.at.row * CELL, d.name.toUpperCase(), 44, "#fdfaf0", 16).setLetterSpacing(6);
    if (!this.local) for (const a of AREAS) if (a.tier === tier.id) text(a.label.col * CELL, a.label.row * CELL, a.name.toUpperCase(), 64, "#fdfaf0", 22).setLetterSpacing(10);
    for (const g of tier.gates) {
      const word = GATE_WORD[g.kind];
      text((g.at.col + 0.5) * CELL, (g.at.row - 1.2) * CELL, word ? `${g.name} (${word})` : g.name, 26, GATE_TONE[g.kind], 12);
    }
    for (const b of tier.bosses) text((b.col + 0.5) * CELL, (b.row - 2.6) * CELL, b.name, 28, "#ff8f7a", 13);
  }

  /** The Souls map underneath: each area joined to its neighbours through its gates and lifts. */
  private drawRoutes(tier: AtlasTier): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(DEPTH.fx + 2).setVisible(false);
    const centre = (id: AreaId) => AREAS.find((a) => a.id === id)!.label;
    const dots = (x0: number, y0: number, x1: number, y1: number, tone: number): void => {
      const n = Math.floor(Phaser.Math.Distance.Between(x0, y0, x1, y1) / 48);
      for (let i = 1; i < n; i++) g.fillStyle(tone, 0.95).fillCircle(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 10);
    };
    for (const gate of tier.gates) {
      const tone = Phaser.Display.Color.HexStringToColor(GATE_TONE[gate.kind]).color;
      const [gx, gy] = [(gate.at.col + 0.5) * CELL, (gate.at.row + 0.5) * CELL];
      for (const end of [gate.from, gate.to]) dots(centre(end).col * CELL, centre(end).row * CELL, gx, gy, tone);
      g.lineStyle(6, 0x1c2634).fillStyle(tone).fillCircle(gx, gy, 22).strokeCircle(gx, gy, 22);
    }
    for (const l of this.map.lifts) {
      const end = l.up.tier === tier.id ? l.up : l.down.tier === tier.id ? l.down : null;
      if (!end) continue;
      const tone = Phaser.Display.Color.HexStringToColor(LIFT_TONE[l.kind]).color;
      const [x, y] = [(end.at.col + 0.5) * CELL, (end.at.row + 0.5) * CELL];
      dots(centre(end.area).col * CELL, centre(end.area).row * CELL, x, y, tone);
      g.lineStyle(6, 0x1c2634).fillStyle(tone).fillRect(x - 20, y - 20, 40, 40).strokeRect(x - 20, y - 20, 40, 40);
    }
    return g;
  }

  update(): void {
    const act = this.active;
    for (const { text, px, tier } of this.names) {
      text.setVisible(tier === this.view);
      text.setScale(Math.max(1, (px * DPR) / (Number.parseInt(String(text.style.fontSize)) * act.zoom)));
    }
    // Off screen, and on the tiers not in view, sprites skip drawing and animating.
    const w = act.width / act.zoom;
    const h = act.height / act.zoom;
    const x = act.scrollX + (act.width - w) / 2;
    const y = act.scrollY + (act.height - h) / 2;
    for (const { s, b, tier } of this.live) {
      const on = tier === this.view && b.right > x && b.x < x + w && b.bottom > y && b.y < y + h;
      s.setVisible(on);
      s.active = on;
    }
  }
}

export function startAtlas(parent: HTMLElement, hooks: AtlasHooks): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "atlas", AtlasScene, hooks);
}
