// The Atlas: the Shattered Reach in three tiers, drawn with the war map's
// autotiler and dressed area by area. Each tier renders to its own camera and
// shows alone: the sky over its cloud bank, the Surface on the sea, the
// Underneath as rock with its caverns lit. Lifts join the tiers where they
// stand, and a click on one rides it. On an area map the hero walks and fights, the camera held on it; dev mode
// frees the camera over the whole map.

import {
  AREAS,
  AREA_CODE,
  BAND_SIZE,
  COMPANIONS,
  companionPlan,
  foeTarget,
  hire,
  TIERS,
  areaMap,
  districtOf,
  FOES,
  TROLL,
  chargeLine,
  trollMove,
  type TrollMove,
  type Note,
  GOLD_STONE,
  HERO,
  ITEMS,
  kit,
  onOffer,
  type ItemName,
  type Kit,
  NPCS,
  PACE,
  mayEngage,
  STAMINA,
  block,
  canAct,
  recover,
  spend,
  canReach,
  clearShot,
  TALK_RANGE,
  canStep,
  comboStep,
  drink,
  swingWait,
  nextTalk,
  talkKey,
  whereabouts,
  findRoute,
  foeIntent,
  smoothPath,
  groundColours,
  struck,
  throughGuard,
  tileDistance,
  atlasMap,
  footprint,
  solidCells,
  useIsland,
  type AreaId,
  type AreaMap,
  type AtlasMap,
  type AtlasTier,
  type BandOrder,
  type Cell,
  type CompanionKind,
  type Dweller,
  type FoeStats,
  type GateKind,
  type Npc,
  type Placed,
  type TierId,
  type Whereabouts,
  type WorldFlag,
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
  /** In an area's map: rebuild the scene as another area's map, arriving at its exit back to `from`. */
  travel: (to: AreaId, from: AreaId, arrive: Crossing) => void;
  /** In an area's map: dev mode frees the camera to see the whole map; off, it holds on the hero. */
  dev: (on: boolean) => void;
  /** In a talk: the next page, or the end of it. */
  next: () => void;
  /** At a bonfire just rested at: sit by it, the camera drawn in, or stand again; sitting gives the bonfire's name. */
  sit: (on: boolean) => string | null;
  /** In a menu with someone who hires out: pick an option, as E on it would. */
  choose: (i: number) => void;
  /** In a menu: mark an option picked without choosing it, as the pointer over it does. */
  hover: (i: number) => void;
  /** In a menu: out of the goods to the menu, or out of the menu. */
  back: () => void;
  /** Stop the scene while another game (the bonfire map) runs on the page, or go on; that game swaps the shared walk grid. */
  pause: (on: boolean) => void;
  /** On the atlas: mark the bonfires, lit or not, ring `pick` and fly to it. */
  fires: (fires: FireMark[], pick: number) => void;
  /** On the atlas: outline a land on its own tier and fly to it; null clears the outline. */
  select: (id: AreaId | null) => void;
}

/** A bonfire as the atlas marks it: on its area's own map, named, whether the captain sits at it, and whether it is lit. */
export interface FireMark {
  area: AreaId;
  col: number;
  row: number;
  name: string;
  here?: boolean;
  lit: boolean;
}

/** How a crossing feels: walking out over a gate, falling down a drop, riding a lift, or going down a stair into the deep. */
export type Crossing = "walk" | "fall" | "ride" | "stair" | "rest";

/** One way out of an area's map, as the page needs it to play the crossing. */
export interface Departure {
  to: AreaId;
  name: string;
  kind: Crossing;
  /** The way the traveller goes: across the screen for a walk, up or down for a ride. */
  dir: "left" | "right" | "up" | "down";
  /** Where the exit stands on screen, 0 to 1, for a crossing that closes in on it. */
  x: number;
  y: number;
}

export interface AtlasHooks {
  /** An area's own map instead of the atlas: the camera kept inside it. */
  area?: AreaId;
  /** The area travelled in from: the map opens at its exit back there. */
  from?: AreaId;
  /** How the traveller arrived: set on a scene rebuilt by a crossing, which then opens without the clouds. A rest wakes at
   *  the bonfire last rested at. */
  arrive?: Crossing;
  /** The hero's health and flasks carried across a crossing; a rest or a reload starts whole. */
  carry?: { hp: number; flasks: number; band: number[] };
  /** Dev mode: the camera free over the whole area map, not held on the hero. */
  dev?: boolean;
  /** Asks the page to travel through an exit to another area. */
  onExit?: (exit: Departure) => void;
  /** Asks the page to show an area's card. */
  onArea: (id: AreaId) => void;
  /** Tells the page which tier is in view, after a lift or a tab. */
  onTier: (id: TierId) => void;
  /** A bonfire mark clicked on the atlas, by its index in the last `fires` call. */
  onFire?: (i: number) => void;
  ready: (api: AtlasApi) => void;
  /** Once the clouds have parted and the map is in view. */
  opened?: () => void;
  /** A page of a talk to show, or null when it ends. */
  onSay?: (say: Say | null) => void;
  /** The menu of someone who hires out, or null when it closes. */
  onMenu?: (menu: MenuView | null) => void;
  /** The goods bought and kept, and the captain's numbers with them: the sack. */
  onSack?: (sack: SackView) => void;
  /** What E would do where the captain stands, other than swing: talk, or rest at a bonfire. */
  onNear?: (action: string | null) => void;
  /** The flasks left. */
  onFlasks?: (n: number) => void;
  /** The captain's health and stamina, a few times a second while they change. */
  onVitals?: (v: Vitals) => void;
  /** The gold carried. */
  onGold?: (n: number) => void;
  /** The band: its order, and each companion's health, 0 for one fallen. */
  onBand?: (band: BandView) => void;
  /** A boss in the fight, by name, its health for the bar; null once there is none. */
  onBoss?: (boss: { name: string; hp: number; max: number } | null) => void;
  /** Rested at a bonfire, in place: the page sits the captain at it. */
  onRest?: (area: AreaId) => void;
  /** Died: the page darkens and wakes the captain at the bonfire last rested at, in `area`. */
  onDeath?: (area: AreaId) => void;
  /** The captain has walked into a named quarter of the area. */
  onDistrict?: (name: string) => void;
}

export interface Say {
  name: string;
  text: string;
  /** A note on the ground, read off its paper, not spoken. */
  note?: boolean;
  /** More pages follow. */
  more: boolean;
}

/** A picture in a menu: a pack image, or one cell of a sheet, multiplied by a tint. */
export interface ShopIcon {
  url: string;
  tint?: string;
  crop?: { x: number; y: number; w: number; h: number; sheetW: number; sheetH: number };
}

/** One of the captain's numbers in words: `after`, what a good would make it. */
export interface StatLine {
  label: string;
  now: string;
  after?: string;
}

/** One good in the captain's sack. */
export interface SackItem {
  label: ItemName;
  icon: ShopIcon;
  gives: string;
  /** One line of what it is, after a Souls item's description. */
  about?: string;
}

/** The sack: the goods kept, and every number of the captain's. */
export interface SackView {
  items: SackItem[];
  stats: StatLine[];
}

/** After the Souls games' merchants: a name over a short list, one option picked; a good says what it gives. */
export interface MenuView {
  name: string;
  options: { label: string; note?: string; icon?: ShopIcon; gives?: string; sold?: boolean; about?: string; afford?: boolean; change?: StatLine[] }[];
  pick: number;
  /** Gold carried, while the goods are open. */
  gold?: number;
  /** A merchant's goods, opened from Shop: drawn as cards rather than a list. */
  shop?: boolean;
}

export interface Vitals {
  hp: number;
  max: number;
  stamina: number;
}

export interface BandView {
  order: BandOrder;
  members: { kind: CompanionKind; hp: number; max: number }[];
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
  stump: { file: "Terrain/Resources/Wood/Trees/Stump 2.png", frame: 192, frameH: 256, anchor: 244 / 256, scale: 0.6 },
  boat: { file: "Enemy Pack/Extra/Boat/Boat_Idle.png", frame: 256, anchor: 0.7, scale: 0.7 },
};

/** A solid's base in world pixels, as the hero's feet meet it. */
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Each solid prop's base in source pixels, measured off the art: the ink's width at its foot and that ink's offset from
 *  the frame's middle. Unlisted art falls back to its footprint's tiles. */
const BASE: Record<string, { w: number; dx: number }> = {
  castle: { w: 242, dx: 0 },
  tower: { w: 87, dx: -1.5 },
  barracks: { w: 170, dx: 0 },
  archery: { w: 177, dx: -4.5 },
  house1: { w: 98, dx: 0 },
  house2: { w: 66, dx: -7 },
  house3: { w: 118, dx: 0 },
  monastery: { w: 146, dx: 0 },
  goblinHut: { w: 98, dx: -2 },
  gnomeHut: { w: 96, dx: 0 },
  gnomeTower: { w: 89, dx: -0.5 },
  cave: { w: 133, dx: 6.5 },
  fishHut: { w: 113, dx: 0.5 },
  skullSpike: { w: 28, dx: 3 },
  deadTree: { w: 85, dx: 23.5 },
  trollDead: { w: 140, dx: 2 },
  goldMine: { w: 163, dx: 0.5 },
  cannon: { w: 42, dx: 0 },
  cannonSide: { w: 44, dx: 4 },
  watchtower: { w: 42, dx: -2 },
  woodPile: { w: 47, dx: 0.5 },
  tools: { w: 28, dx: 2 },
  meat: { w: 46, dx: 0 },
  rock1: { w: 32, dx: -1 },
  rock2: { w: 50, dx: 0 },
  rock3: { w: 39, dx: 1.5 },
  rock4: { w: 59, dx: -0.5 },
  stump: { w: 43, dx: -1.5 },
};

/** The hero's feet: half their width, and how far they reach up and down from the point it stands on. */
const FEET = { w: 12, up: 8, down: 4 } as const;

/** Creatures: idle and moving sheets, frame size, feet. Flyers hover. */
interface Beast {
  idle: string;
  move?: string;
  /** Its blow, played once a strike. */
  attack?: string;
  /** The attack frame where the blow connects, drawn out to land as the wind-up ends. */
  hit?: number;
  frame: number;
  anchor: number;
  scale?: number;
  fly?: boolean;
  swim?: boolean;
  /** A colour laid over its sheets, kept through every hit flash: one pack sheet dressed as another monster. */
  tint?: number;
}
const EP = "Enemy Pack/";
const BEAST: Record<string, Beast> = {
  torch: { idle: `${EP}Torch Goblin/Torch Goblin_Idle.png`, move: `${EP}Torch Goblin/Torch Goblin_Run.png`, attack: `${EP}Torch Goblin/Torch Goblin_Attack.png`, hit: 2, frame: 192, anchor: 132 / 192 },
  spear: { idle: `${EP}Spear Goblin/Spear Goblin_Idle.png`, move: `${EP}Spear Goblin/Spear Goblin_Run.png`, attack: `${EP}Spear Goblin/Spear Goblin_Attack Fast.png`, hit: 5, frame: 256, anchor: 174 / 256 },
  thief: { idle: `${EP}Thief/Thief_Idle.png`, move: `${EP}Thief/Thief_Run.png`, attack: `${EP}Thief/Thief_Attack.png`, frame: 192, anchor: 131 / 192 },
  gnoll: { idle: `${EP}Gnoll/Gnoll_Idle.png`, move: `${EP}Gnoll/Gnoll_Walk.png`, attack: `${EP}Gnoll/Gnoll_Throw.png`, frame: 192, anchor: 133 / 192 },
  minotaur: { idle: `${EP}Minotaur/Minotaur_Idle.png`, move: `${EP}Minotaur/Minotaur_Walk.png`, attack: `${EP}Minotaur/Minotaur_Attack.png`, frame: 320, anchor: 213 / 320 },
  // The Ramparts' bull: the Landing's minotaur shod in iron, bigger, steel-grey.
  rampartBull: { idle: `${EP}Minotaur/Minotaur_Idle.png`, move: `${EP}Minotaur/Minotaur_Walk.png`, attack: `${EP}Minotaur/Minotaur_Attack.png`, frame: 320, anchor: 213 / 320, scale: 1.2, tint: 0x9fb0c8 },
  troll: { idle: `${EP}Troll/Troll_Idle.png`, move: `${EP}Troll/Troll_Walk.png`, attack: `${EP}Troll/Troll_Attack.png`, frame: 384, anchor: 296 / 384, scale: 0.8 },
  // The Chapel Ward's bell boss: the troll's sheets in stone, a warden squatting on the bell. No troll's moves: plain blows.
  stoneWarden: { idle: `${EP}Troll/Troll_Idle.png`, move: `${EP}Troll/Troll_Walk.png`, attack: `${EP}Troll/Troll_Attack.png`, frame: 384, anchor: 296 / 384, scale: 0.85, tint: 0xa8acb4 },
  skull: { idle: `${EP}Skull/Skull_Idle.png`, move: `${EP}Skull/Skull_Run.png`, attack: `${EP}Skull/Skull_Attack.png`, frame: 192, anchor: 128 / 192 },
  skullGuard: { idle: `${EP}Extra/Skull Guard/Skull_Guard.png`, frame: 192, anchor: 128 / 192 },
  shaman: { idle: `${EP}Hex Shaman/Hex Shaman_Idle.png`, move: `${EP}Hex Shaman/Hex Shaman_Run.png`, attack: `${EP}Hex Shaman/Hex Shaman_Attack.png`, frame: 192, anchor: 136 / 192 },
  spider: { idle: `${EP}Spider/Spider_Idle.png`, move: `${EP}Spider/Spider_Run.png`, attack: `${EP}Spider/Spider_Attack.png`, frame: 192, anchor: 0.68 },
  snake: { idle: `${EP}Snake/Snake_Idle.png`, move: `${EP}Snake/Snake_Run.png`, attack: `${EP}Snake/Snake_Attack.png`, frame: 192, anchor: 0.68 },
  lizard: { idle: `${EP}Lizard/Lizard_Idle.png`, move: `${EP}Lizard/Lizard_Run.png`, attack: `${EP}Lizard/Lizard_Attack.png`, frame: 192, anchor: 0.68 },
  bat: { idle: `${EP}Giant Bat/Giant Bat_Idle.png`, move: `${EP}Giant Bat/Giant Bat_Move.png`, attack: `${EP}Giant Bat/Giant Bat_Attack.png`, frame: 192, anchor: 0.7, fly: true },
  bee: { idle: `${EP}Bumblebee/Bumblebee_Idle.png`, move: `${EP}Bumblebee/Bumblebee_Move.png`, attack: `${EP}Bumblebee/Bumblebee_Attack.png`, frame: 192, anchor: 0.7, fly: true, scale: 0.7 },
  imp: { idle: `${EP}Imp/Imp_Idle.png`, move: `${EP}Imp/Imp_Move.png`, attack: `${EP}Imp/Imp_Attack_Loop.png`, frame: 192, anchor: 0.7, fly: true },
  bear: { idle: `${EP}Bear/Bear_Idle.png`, move: `${EP}Bear/Bear_Run.png`, frame: 256, anchor: 0.68 },
  panda: { idle: `${EP}Panda/Panda_Idle.png`, move: `${EP}Panda/Panda_Run.png`, frame: 256, anchor: 0.68 },
  pandaGuard: { idle: `${EP}Extra/Panda Guard/Panda_Guard.png`, frame: 256, anchor: 0.68, scale: 1.2 },
  minotaurGuard: { idle: `${EP}Extra/Minotaur Guard/Minotaur_Guard.png`, frame: 320, anchor: 213 / 320, scale: 1.1 },
  turtleGuard: { idle: `${EP}Extra/Turtle Guard/Turtle_Guard_In.png`, frame: 320, anchor: 0.66 },
  gnome: { idle: `${EP}Gnome/Gnome_Idle.png`, move: `${EP}Gnome/Gnome_Run.png`, frame: 192, anchor: 0.68 },
  slingshot: { idle: `${EP}Slingshot Gnome/Slingshot Gnome_Idle.png`, move: `${EP}Slingshot Gnome/Slingshot Gnome_Run.png`, attack: `${EP}Slingshot Gnome/Slingshot Gnome_Shoot.png`, frame: 192, anchor: 0.68 },
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

/** Trees by area: the big animated pines in the Emberwood, dead wood on the moor and in the grey. */
const BIG_TREE: Sheet[] = [
  { file: "Terrain/Resources/Wood/Trees/Tree1.png", frame: 192, frameH: 256, anchor: 0.87, scale: 0.85 },
  { file: "Terrain/Resources/Wood/Trees/Tree2.png", frame: 192, frameH: 256, anchor: 0.87, scale: 0.85 },
];

/** What a thrower or a shooter lets fly: a spinning bone, an acorn, a hex bolt; a companion archer's arrow. */
const MISSILE: Record<string, { key: string; file: string; frame?: number }> = {
  gnoll: { key: "missile_gnoll", file: `${EP}Gnoll/Gnoll_Bone.png`, frame: 64 },
  slingshot: { key: "missile_slingshot", file: `${EP}Slingshot Gnome/Acorn_Projectile.png`, frame: 64 },
  shaman: { key: "missile_shaman", file: `${EP}Hex Shaman/Hex Shaman_Projectile.png`, frame: 128 },
  archer: { key: "arrow", file: "Units/Blue Units/Archer/Arrow.png" },
};
/** What a thrown or shot missile cannot pass: anything built, a hut, a cave mouth, a dead tree. Woods are cover too. */
const COVER_ART: ReadonlySet<string> = new Set(["castle", "monastery", "barracks", "archery", "tower", "watchtower", "house1", "house2", "house3", "goblinHut", "gnomeHut", "gnomeTower", "cave", "fishHut", "goldMine", "trollDead", "deadTree"]);
/** Space, after Dark Souls on a keyboard: a tap rolls (or backsteps, standing still), held while moving it sprints. */
const TAP = 250;
const ROLL = { tiles: 2.2, ms: 320, back: { tiles: 1.1, ms: 220 }, recover: 120 } as const;
/** How far above its feet a flyer hangs, as a share of its frame. */
const HOVER = 0.28;

const FIRE: Sheet = { file: "Effects/Fire/Fire.png", frame: 128, anchor: 0.8 };
const FENCE = "Enemy Pack/Extra/Wooden Fence/Wooden Fence_64x64 tile.png";

const FONT = '"Nunito", "Segoe UI", sans-serif';

/** The area a sea tile takes its light from: the nearest within this many tiles. */
const MOOD_REACH = 6;
/** How far from a way out its far side's light reaches in, in tiles. */
const LEAN_REACH = 12;

/** Ground under the rock of the Underneath: dark, and darker than the caverns. */
const ROCK_MOOD = 0x1e1e2a;

/** An area map's view in play: this many rows tall, held on the hero. */
const AREA_ROWS = 15;
/** The captain, drawn from the knights' sheets. */
const HERO_LOOK: Dweller = { kind: "warrior", col: 0, row: 0, color: "blue" };
const HERO_ATTACK = { key: "blue_Warrior/Warrior_Attack1.png", file: "Units/Blue Units/Warrior/Warrior_Attack1.png" };
const HERO_ATTACK2 = { key: "blue_Warrior/Warrior_Attack2.png", file: "Units/Blue Units/Warrior/Warrior_Attack2.png" };
/** A flask drunk: the Monk's healing swirl round the feet, and the green drop over the head (the pack has no flask). */
const HEAL_FX = { key: "healFx", file: "Units/Blue Units/Monk/Heal_Effect.png" };
const FLASK_ICON = { key: "flaskIcon", file: "ui/icon_heal.png" };
const HERO_GUARD = { key: "blue_Warrior/Warrior_Guard.png", file: "Units/Blue Units/Warrior/Warrior_Guard.png" };

/** One body in a fight on an area map: the hero or a monster. */
interface Body {
  s: Phaser.GameObjects.Sprite;
  at: Cell;
  hp: number;
  max: number;
  /** When it may strike again, and until when a swing holds it still, in scene ms. */
  next: number;
  busy: number;
  /** Tiles a second. */
  speed: number;
  /** The points it is walking through, in world px: straight legs at a steady speed, not a hop a cell. */
  way: { x: number; y: number }[];
  /** When its route was last worked out, so a chase re-plans a few times a second rather than every frame. */
  planned: number;
  idle: string;
  move?: string;
  attack?: string;
  /** How far its health bar floats above its feet, in px. */
  lift: number;
  bar: Phaser.GameObjects.Graphics;
  dead: boolean;
}
interface Foe extends Body {
  kind: string;
  home: Cell;
  stats: FoeStats;
  /** A blow drawn back: when it lands, and on whom; a boss's, which blow and the cells it falls on. */
  windup: { at: number; mark: Body; move?: TrollMove; aim?: Cell[] } | null;
  /** A boss's last blow, so it does not repeat one at range. */
  last?: TrollMove;
}
/** Embers on the ground after the troll's toss: they burn whoever stands in them until they die down. */
interface Ember {
  at: Cell;
  until: number;
  tick: number;
  from: Foe;
  s: Phaser.GameObjects.Sprite;
}
/** A companion in the band, and the spot it keeps on hold. */
interface Companion extends Body {
  kind: CompanionKind;
  post: Cell;
}
/** The companions' strike sheets: the Lancer's thrust (it is drawn facing right), the Archer's draw and loose. */
const COMPANION_ATTACK: Record<CompanionKind, { key: string; file: string }> = {
  lancer: { key: "blue_Lancer/Lancer_Right_Attack.png", file: "Units/Blue Units/Lancer/Lancer_Right_Attack.png" },
  archer: { key: "blue_Archer/Archer_Shoot.png", file: "Units/Blue Units/Archer/Archer_Shoot.png" },
};
/** Who hires out which companion, by the dweller's id. */
const RECRUITER: Record<string, CompanionKind> = { corwin: "lancer", wren: "archer" };
/** What they say turning a hire down: short of gold, or the band already full. */
const REFUSE: Record<string, { poor: string; full: string }> = {
  corwin: { poor: "Lances cost gold. Seventy-five.", full: "Three at your back already. I've none to spare." },
  wren: { poor: "Bows aren't free. Sixty gold, then we'll talk.", full: "You've a crowd already. Mine stay here." },
};
/** The goods bought, by name. */
const BOUGHT = "greyfall.bought";
const SWORDS = packUrl("UI Elements/UI Elements/Swords/Swords.png");
/** Each good's picture in a merchant's menu. Swords.png is one sword a 128-tall row in five colours, the hilt its
 *  first 128 across; blue is the captain's own. A gold stone sits small in the middle of its 128. */
const ITEM_ICON: Record<ItemName, ShopIcon> = {
  "Smoked Haunch": { url: packUrl("UI Elements/UI Elements/Icons/Icon_04.png") },
  "Ember Shard": { url: packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png"), tint: "#ff7a3c", crop: { x: 44, y: 44, w: 40, h: 40, sheetW: 128, sheetH: 128 } },
  "Brenna's Edge": { url: SWORDS, crop: { x: 0, y: 128, w: 128, h: 128, sheetW: 448, sheetH: 640 } },
  "Keener Edge": { url: SWORDS, crop: { x: 0, y: 256, w: 128, h: 128, sheetW: 448, sheetH: 640 } },
  "Grey-Iron Edge": { url: SWORDS, crop: { x: 0, y: 384, w: 128, h: 128, sheetW: 448, sheetH: 640 } },
  "Pine Resin": { url: packUrl("UI Elements/UI Elements/Icons/Icon_02.png"), tint: "#e0a040" },
  "Banded Shield": { url: packUrl("UI Elements/UI Elements/Icons/Icon_06.png") },
  "Kindled Shard": { url: packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 2.png"), tint: "#ff4a2a", crop: { x: 45, y: 41, w: 40, h: 40, sheetW: 128, sheetH: 128 } },
  "Prospector's Purse": { url: packUrl("UI Elements/UI Elements/Icons/Icon_03.png") },
};
/** What a good does to the captain's numbers, in words. */
function gives(item: ItemName): string {
  const words: Record<keyof Kit, (n: number) => string> = {
    hp: (n) => `+${n} max health`,
    attack: (n) => `+${n} attack`,
    flasks: (n) => `+${n} flask`,
    flask: (n) => `+${n} healing per flask`,
    block: (n) => `Blocking costs ${Math.round((-n / STAMINA.block) * 100)}% less stamina`,
    greed: (n) => `+${Math.round(n * 100)}% gold from kills`,
  };
  return (Object.entries(ITEMS[item].adds) as [keyof Kit, number][]).map(([stat, n]) => words[stat](n)).join(", ");
}
/** Each of the captain's numbers, named and in words, as the sack and a good's card show it. */
const STATS: Record<keyof Kit, { label: string; words: (n: number) => string }> = {
  hp: { label: "Health", words: String },
  attack: { label: "Attack", words: String },
  flasks: { label: "Flasks", words: String },
  flask: { label: "Flask heal", words: String },
  block: { label: "Block cost", words: (n) => `${Math.round((n / STAMINA.block) * 100)}%` },
  greed: { label: "Gold from kills", words: (n) => `${Math.round(n * 100)}%` },
};
const BAND = "greyfall.band";
const ORDER_WORD: Record<BandOrder, string> = { follow: "Follow me", attack: "Attack my target", hold: "Hold here" };
/** One of the folk who talk, standing at their spot. */
interface Folk {
  npc: Npc;
  at: Cell;
  s: Phaser.GameObjects.Sprite;
  near: boolean;
  bubble: Phaser.GameObjects.Text | null;
}

/** What the captain has heard and done, kept on this browser; a blocked store only means folk repeat themselves. */
function remembered<T extends string>(key: string): Set<T> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as T[]);
  } catch {
    return new Set();
  }
}
function remember(key: string, set: ReadonlySet<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}
const HEARD = "greyfall.heard";
/** The bonfire last rested at; until one is, the Harbour square's. */
const REST = "greyfall.rest";
/** Every bonfire rested at, `area:col,row`, the places the map can travel to. */
const KINDLED = "greyfall.kindled";
function restPoint(): { area: AreaId; col: number; row: number } {
  try {
    const r = JSON.parse(localStorage.getItem(REST) ?? "null") as { area: AreaId; col: number; row: number } | null;
    if (r && areaMap(r.area).fires.some((f) => f.col === r.col && f.row === r.row)) return r;
  } catch {}
  return { area: "landing", ...areaMap("landing").fires[0]! };
}
/** Gold carried, the gold stones already taken, and the gold left where the captain last died: kept on this browser. */
const GOLD = "greyfall.gold";
/** Bosses slain, which never come back, and the keys they drop, by the boss's kind. */
const SLAIN = "greyfall.slain";
const KEYS = "greyfall.keys";
const BOSS_KEY: Partial<Record<string, string>> = { troll: "Troll Key" };
const BOSSES = new Set(["troll", "minotaur", "rampartBull", "stoneWarden"]);
/** The exit last gone through, so a crossing lands at the way of the same name when two ways join the same areas. */
const VIA = "greyfall.via";
/** A boss whose fall is worth a flask more, for good: the Landing's bull, the reward for going back to him. */
const BOSS_FLASK: ReadonlySet<string> = new Set(["minotaur"]);
/** A hit flash over: back to the sprite's own colour, its base tint if it has one. */
function untint(s: Phaser.GameObjects.Sprite): void {
  const tint = s.getData("tint") as number | undefined;
  if (tint) s.setTint(tint);
  else s.clearTint();
}
/** Flasks carried at full: the base and the shards bought, and one for each boss that gives one. */
function maxFlasks(): number {
  return kit(remembered(BOUGHT)).flasks + bossFlasks();
}
function bossFlasks(): number {
  return [...remembered(SLAIN)].filter((k) => BOSS_FLASK.has(k)).length;
}
/** One of the captain's numbers in words, with `gear`: the flasks with those the bosses gave. */
function statWords(k: keyof Kit, gear: Kit): string {
  return STATS[k].words(k === "flasks" ? gear.flasks + bossFlasks() : gear[k]);
}
/** A way out shut until its guarding boss falls, or the captain has already rested on the far side; or a shortcut not
 *  yet opened from the far side. */
function barred(e: Exit): boolean {
  if (e.shut && !remembered(FLAGS).has(e.shut)) return true;
  if (e.key && !remembered(KEYS).has(e.key)) return true;
  return !!e.guard && !remembered(SLAIN).has(e.guard) && ![...remembered(KINDLED)].some((k) => k.startsWith(`${e.to}:`));
}
const TAKEN = "greyfall.taken";
const LOST = "greyfall.lost";
type Lost = { area: AreaId; col: number; row: number; gold: number };
function stored<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? empty;
  } catch {
    return empty;
  }
}
function store(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
/** Gold on the ground: a monster's drop, a gold stone, or the gold left at the last death. */
interface Pile {
  at: Cell;
  gold: number;
  s: Phaser.GameObjects.Image;
  stone?: string;
  lost?: boolean;
  /** A stone's glow in the dark of the Underneath. */
  shine?: Phaser.GameObjects.Image;
}
/** No rest with a monster this near the fire. */
const REST_CLEAR = 8;
const FLAGS = "greyfall.flags";
const npcLook = (n: Npc): Dweller => ({ kind: n.kind, col: n.at.col, row: n.at.row, color: n.color ?? "blue", act: n.act });
/**
 * Each underground map lit its own way: the rock's own dark, how much the open floor shows unlit, the colour its
 * lights cast. The Undercroft is torchlit masonry, the Deeps the darkest and lit ghost-green, the Hollow the
 * brightest, a vast cave in pale blue where the gold glows far.
 */
const UNDER: Partial<Record<AreaId, { rock: number; ambient: number; glow: number; gold: number }>> = {
  undercroft: { rock: 0x221a16, ambient: 0.16, glow: 0xffc890, gold: 4 },
  deeps: { rock: 0x0e1214, ambient: 0.1, glow: 0x9cdcb4, gold: 4 },
  hollow: { rock: 0x16202e, ambient: 0.42, glow: 0xb4e0ff, gold: 8 },
  // The tutorial's sea cave and the Ring at its end: dark, in plain cool light, no warm cast; the torches show the way.
  landing: { rock: 0x1e2226, ambient: 0.32, glow: 0xe6ecf0, gold: 4 },
  ring: { rock: 0x1e2226, ambient: 0.3, glow: 0xe6ecf0, gold: 4 },
};

type Exit = AreaMap["exits"][number];

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
  // `rows`: shown only while no more than that many rows are in view.
  private names: { text: Phaser.GameObjects.Text; px: number; tier: TierId; rows?: number }[] = [];
  /** The atlas's bonfire marks, and where each stands for a click. */
  private marks: Phaser.GameObjects.GameObject[] = [];
  private markAt: { tier: TierId; cell: Cell }[] = [];
  /** The selected land's outline on the atlas. */
  private outline: Phaser.GameObjects.Graphics | null = null;
  private live: Tracked[] = [];
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  /** In an area's own map: that map. */
  private local: AreaMap | null = null;
  private built = new Set<TierId>();
  /** In an area's map: the hero, where it rises again, what it is walking to or fighting, the monsters. */
  private hero: Body | null = null;
  /** The right button held in play: the shield up, as F. */
  private shieldUp = false;
  /** Where the last attack was aimed, for a press kept until the hero is ready. */
  private aim: { x: number; y: number } | null = null;
  private keys: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "shift", Phaser.Input.Keyboard.Key> | null = null;
  private stamina: number = STAMINA.max;
  /** When stamina was last spent: it comes back only after a pause. */
  private spentAt = -1e9;
  /** When Space went down, -1 when it is up: a tap rolls, a hold sprints. */
  private spaceAt = -1;
  /** A roll under way: until when it moves and nothing can hurt, which way, how fast, and when it last left an echo. */
  private roll = { until: 0, dx: 0, dy: 0, speed: 0, trail: 0, back: false };
  /** A guard broken by a blow it could not pay for holds nothing up until then. */
  private guardBroken = 0;
  private vitalsAt = 0;
  private vitalsKey = "";
  private bossKey = "";
  /** A boss room's fog: the cells no one crosses, and the clouds drawn on them. */
  private sealed = new Set<string>();
  /** Ways shut until their key is carried, apart from the fog so a boss's fall never opens them. */
  private locked = new Set<string>();
  /** What no one walks through: buildings, heaps, fence posts, and the rocks and stumps standing in open ground. */
  private solid = new Set<string>();
  /** The solid tiles that are a prop's or a rock's: the hero's feet meet the art's base there, not the whole tile. */
  private boxed = new Set<string>();
  private bases: Box[] = [];
  private fog: Phaser.GameObjects.Sprite[] = [];
  /** Mist over the boss room, hiding it until the captain is inside. */
  private mist: Phaser.GameObjects.Image[] = [];
  /** F held: the hero stands behind its shield. */
  private guarding = false;
  /** When E was pressed before the last swing was through: it swings the moment it can, not never. */
  private queued = false;
  /** The hero's place in its three-swing combo. */
  private combo = 0;
  private spawn: Cell = { col: 0, row: 0 };
  private foes: Foe[] = [];
  private embers: Ember[] = [];
  /** Notes on the ground here, and the one being read. */
  private notes: Note[] = [];
  private reading: Note | null = null;
  private folk: Folk[] = [];
  private talk: { folk: Folk; lines: readonly string[]; key: string; sets?: WorldFlag; page: number } | null = null;
  /** The flags as the area was entered: who stands where, and what they say, holds until the captain leaves and comes back. */
  private seen = new Set<WorldFlag>();
  private nearName: string | null = null;
  /** Open with someone who hires out: Talk, Hire, Leave. */
  /** `shopping`: a merchant's goods are open, picked from the menu's Shop. */
  private menu: { folk: Folk; pick: number; shopping?: boolean } | null = null;
  private flasks: number = HERO.flasks;
  /** The captain's numbers with the goods bought. */
  private gear: Kit = kit(new Set());
  private gold = 0;
  private band: Companion[] = [];
  private bandOrder: BandOrder = "follow";
  /** The monster the captain last struck: on "attack my target", the band goes for it. */
  private lastHit: Foe | null = null;
  private piles: Pile[] = [];
  /** The tiles under what a missile cannot pass, as "col,row". */
  private cover = new Set<string>();
  private readonly blocks = (c: Cell): boolean => this.cover.has(`${c.col},${c.row}`) || isForest(c.col, c.row);
  /** Resting or dead: the page is darkening and nothing more is done here. */
  private gone = false;
  /** The quarter the captain was last announced in, and one just stepped into, with when. */
  private district = { name: "", next: "", since: 0, shown: new Set<string>() };
  private heard = new Set<string>();
  private flags = new Set<WorldFlag>();
  private dev = false;

  constructor() {
    super("atlas");
  }

  init(data: AtlasHooks): void {
    this.hooks = data;
    // A crossing restarts this same scene as the next area: start clean.
    this.building = "surface";
    this.view = "surface";
    this.names = [];
    this.live = [];
    this.drag = null;
    this.local = null;
    this.built = new Set();
    this.hero = null;
    this.sealed = new Set();
    this.locked = new Set();
    this.solid = new Set();
    this.boxed = new Set();
    this.bases = [];
    this.fog = [];
    this.mist = [];
    // The page keeps the last area's bar through a crossing; clear it, or a key of "" never sends the null.
    this.bossKey = "";
    this.hooks.onBoss?.(null);
    this.shieldUp = false;
    this.aim = null;
    this.keys = null;
    this.foes = [];
    this.embers = [];
    this.notes = [];
    this.reading = null;
    this.guarding = false;
    this.queued = false;
    this.stamina = STAMINA.max;
    this.spentAt = -1e9;
    this.spaceAt = -1;
    this.roll = { until: 0, dx: 0, dy: 0, speed: 0, trail: 0, back: false };
    this.guardBroken = 0;
    this.vitalsKey = "";
    this.combo = 0;
    this.folk = [];
    this.talk = null;
    this.nearName = null;
    this.menu = null;
    this.heard = remembered(HEARD);
    this.flags = remembered(FLAGS);
    this.gear = kit(remembered(BOUGHT));
    // What a crossing proves: down the well, the Watch Lift ridden down, the Moor Gate come through from the moor, the Greyfall reached.
    if (data.area === "undercroft") this.flag("wellDescended");
    if (data.area === "keep" && data.from === "steps") this.flag("watchLiftOpen");
    if (data.area === "harbour" && data.from === "barrowmoor") this.flag("moorGateOpen");
    if (data.area === "greyfall") this.flag("greyfallReached");
    this.seen = new Set(this.flags);
    this.flasks = data.carry?.flasks ?? maxFlasks();
    this.gold = stored(GOLD, 0);
    this.band = [];
    this.bandOrder = "follow";
    this.lastHit = null;
    this.piles = [];
    this.cover = new Set();
    this.gone = false;
    this.district = { name: "", next: "", since: 0, shown: new Set<string>() };
    this.dev = !!data.dev;
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
    if (!this.textures.exists("note")) this.load.image("note", packUrl("ui/paper.png"));
    if (!this.textures.exists("gold")) this.load.image("gold", packUrl("Terrain/Resources/Gold/Gold Resource/Gold_Resource.png"));
    const sheet = (key: string, s: Sheet): void => {
      if (this.textures.exists(key)) return;
      this.load.spritesheet(key, packUrl(s.file), { frameWidth: s.frame, frameHeight: s.frameH ?? s.frame });
    };
    for (const tier of new Set(Object.values(this.map.tiers))) {
      for (const p of tier.props) {
        if (p.color) this.load.image(this.buildingKey(p), packUrl(`Buildings/${COLOR_DIR[p.color]} Buildings/${BUILDING_FILE[p.art]}`));
        else if (p.art !== "sconce") sheet(`prop_${p.art}`, PROP[p.art]!);
      }
      for (const d of tier.dwellers) {
        const { idle, move, frame } = this.look(d);
        sheet(idle.key, { file: idle.file, frame, anchor: 0 });
        if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
      }
    }
    if (this.local) {
      const { idle, move, frame } = this.look(HERO_LOOK);
      sheet(idle.key, { file: idle.file, frame, anchor: 0 });
      if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
      sheet(HERO_ATTACK.key, { file: HERO_ATTACK.file, frame, anchor: 0 });
      sheet(HERO_GUARD.key, { file: HERO_GUARD.file, frame, anchor: 0 });
      sheet(HERO_ATTACK2.key, { file: HERO_ATTACK2.file, frame, anchor: 0 });
      sheet(HEAL_FX.key, { file: HEAL_FX.file, frame: 192, anchor: 0 });
      if (!this.textures.exists(FLASK_ICON.key)) this.load.image(FLASK_ICON.key, packUrl(FLASK_ICON.file));
      for (const kind of ["lancer", "archer"] as const) {
        const l = this.look({ kind, col: 0, row: 0, color: "blue" });
        sheet(l.idle.key, { file: l.idle.file, frame: l.frame, anchor: 0 });
        if (l.move) sheet(l.move.key, { file: l.move.file, frame: l.frame, anchor: 0 });
        sheet(COMPANION_ATTACK[kind].key, { file: COMPANION_ATTACK[kind].file, frame: l.frame, anchor: 0 });
      }
      for (const m of Object.values(MISSILE)) {
        if (this.textures.exists(m.key)) continue;
        if (m.frame) this.load.spritesheet(m.key, packUrl(m.file), { frameWidth: m.frame, frameHeight: m.frame });
        else this.load.image(m.key, packUrl(m.file));
      }
      for (const [n] of this.folkHere()) {
        const l = this.look(npcLook(n));
        sheet(l.idle.key, { file: l.idle.file, frame: l.frame, anchor: 0 });
      }
      for (const d of this.local.dwellers) {
        const b = BEAST[d.kind];
        if (FOES[d.kind] && b?.attack) sheet(`beast_${d.kind}_attack`, { file: b.attack, frame: b.frame, anchor: 0 });
        if (d.kind === "troll") for (const k of ["Windup", "Recovery"]) sheet(`beast_troll_${k.toLowerCase()}`, { file: `${EP}Troll/Troll_${k}.png`, frame: 384, anchor: 0 });
      }
    }
    for (const k of ["deadTree", "stump", "bones", "skullSpike", "goldStone"]) sheet(`prop_${k}`, PROP[k]!);
    BIG_TREE.forEach((t, i) => sheet(`bigTree${i}`, t));
    sheet("fire", FIRE);
    this.load.spritesheet("fence", packUrl(FENCE), { frameWidth: 64, frameHeight: 64 });
    // The pack's dust puffs: the fog gates are banked from their first frame, and wisps off them play the rest.
    this.load.spritesheet("fogPuff", packUrl("Particle FX/Dust_02.png"), { frameWidth: 64, frameHeight: 64 });
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
    const resize = (size: Phaser.Structs.Size): void => {
      for (const c of Object.values(this.cams)) c.setSize(size.width, size.height);
      if (this.playing) this.active.setZoom(this.zoomFor(AREA_ROWS));
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, resize));

    if (this.local) {
      // The camera stays inside the area, and opens on where a traveller arrives.
      const local = this.local;
      const cam = this.cams[local.id];
      // Bounds after show(): it builds the map, and only then is the grid this area's size.
      this.show(local.id);
      for (const c of Object.values(this.cams)) c.setBounds(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
      // A traveller arrives at the exit back the way they came, not the area's front door, on the nearest open tile.
      // Woken from a rest or a death, beside the bonfire rested at, not on the fire itself.
      const rest = this.hooks.arrive === "rest" ? restPoint() : null;
      const fire = rest?.area === local.area ? { col: rest.col, row: rest.row } : null;
      const via = stored<string>(VIA, "");
      const at = fire ?? (local.exits.find((e) => e.to === this.hooks.from && e.name === via) ?? local.exits.find((e) => e.to === this.hooks.from))?.at ?? local.entry;
      const open = (c: Cell): boolean => isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && !(fire && c.col === fire.col && c.row === fire.row);
      const near = open(at) ? at : (findRoute(at, open)?.at(-1) ?? local.entry);
      this.spawn = near;
      for (const p of local.props) if (COVER_ART.has(p.art)) for (const c of footprint(p)) this.cover.add(`${c.col},${c.row}`);
      for (const k of solidCells(local)) this.solid.add(k);
      for (const p of local.props) this.baseOf(p);
      this.notes = local.notes ?? [];
      for (const n of this.notes) this.addNote(n);
      this.spawnHero(near);
      if (this.hooks.carry) this.hero!.hp = Math.max(1, Math.min(this.hero!.max, this.hooks.carry.hp));
      this.hooks.onFlasks?.(this.flasks);
      this.hooks.onGold?.(this.gold);
      this.emitSack();
      stored<CompanionKind[]>(BAND, []).forEach((kind, i) => this.addCompanion(kind, this.hooks.carry?.band[i]));
      this.emitBand();
      this.fogGate();
      this.lockGates();
      const k = this.input.keyboard;
      k?.on("keydown-ONE", () => this.command("follow"));
      k?.on("keydown-TWO", () => this.command("attack"));
      k?.on("keydown-THREE", () => this.command("hold"));
      for (const [key, d] of [["W", -1], ["UP", -1], ["A", -1], ["LEFT", -1], ["S", 1], ["DOWN", 1], ["D", 1], ["RIGHT", 1]] as const) k?.on(`keydown-${key}`, () => this.movePick(d));
      k?.on("keydown-ESC", () => this.back());
      k?.on("keydown-SPACE", (e: KeyboardEvent) => !e.repeat && (this.spaceAt = this.time.now));
      k?.on("keyup-SPACE", () => {
        if (this.spaceAt >= 0 && this.time.now - this.spaceAt < TAP) this.dodge(this.time.now);
        this.spaceAt = -1;
      });
      // The gold left at the last death waits where it fell, glowing, until it is picked up or the captain dies again.
      const lost = stored<Lost | null>(LOST, null);
      if (lost?.area === local.area) this.dropGold({ col: lost.col, row: lost.row }, lost.gold, { lost: true });
      this.input.keyboard?.on("keydown-R", (e: KeyboardEvent) => !e.repeat && this.quaff());
      for (const [n, w] of this.folkHere()) this.addFolk(n, w);
      // Arriving, the area's own name is shown; only the quarters walked into after are.
      this.district.name = districtOf(local, near.col, near.row)?.name ?? "";
      this.district.shown.add(this.district.name);
      this.input.keyboard?.on("keydown-E", (e: KeyboardEvent) => this.interact(e.repeat));
      this.setDev(this.dev);
      if (this.hooks.arrive === "fall") {
        // Dropped in: the hero comes down onto the spot and lands with a jolt.
        const s = this.hero!.s;
        const y = s.y;
        s.setY(y - 3 * CELL);
        this.tweens.add({ targets: s, y, duration: 650, ease: "Bounce.easeOut", onComplete: () => cam.shake(140, 0.004) });
      }
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
        this.flyTo(this.centre(id), 24);
      },
      travel: (to, from, arrive) => {
        const carry = arrive === "rest" || !this.hero ? undefined : { hp: this.hero.hp, flasks: this.flasks, band: this.band.map((c) => (c.dead ? 0 : c.hp)) };
        this.scene.restart({ ...this.hooks, area: to, from, arrive, dev: this.dev, carry });
      },
      dev: (on) => this.setDev(on),
      next: () => (this.reading ? this.read(null) : this.nextPage()),
      sit: (on) => this.sit(on),
      pause: (on) => {
        // The whole loop, not the scene: a paused scene still draws every frame under the other game.
        if (on) return this.game.loop.sleep();
        useIsland(this.map.tiers[this.view].island);
        this.game.loop.wake();
      },
      fires: (fires, pick) => this.markFires(fires, pick),
      select: (id) => this.select(id),
      choose: (i) => {
        if (!this.menu) return;
        this.menu.pick = i;
        this.choose();
      },
      hover: (i) => {
        if (!this.menu || this.menu.pick === i) return;
        this.menu.pick = i;
        this.showMenu();
      },
      back: () => this.back(),
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
    });
    // A crossing's own cover is the page's; only a first arrival opens on the clouds.
    if (this.hooks.arrive) this.time.delayedCall(0, () => this.hooks.opened?.());
    else cloudCover(this, "open", () => this.hooks.opened?.());
  }

  /** Leaves through an exit: works out how the crossing feels and where it stands on screen, and asks the page. */
  private depart(e: Exit): void {
    const cam = this.active;
    const v = cam.worldView;
    const [wx, wy] = [(e.at.col + 0.5) * CELL, (e.at.row + 0.5) * CELL];
    const x = Phaser.Math.Clamp((wx - v.x) / v.width, 0, 1);
    const y = Phaser.Math.Clamp((wy - v.y) / v.height, 0, 1);
    store(VIA, e.name);
    if (e.opens) this.flag(e.opens as WorldFlag);
    this.hooks.onExit?.({ to: e.to, name: e.name, ...this.crossing(e), x, y });
  }

  /** How a crossing feels: a fall or a ride between tiers, else a walk (a stair underground) out across its edge. */
  private crossing(e: Exit): { kind: Crossing; dir: Departure["dir"] } {
    const here = AREAS.find((a) => a.id === this.local!.area)!.tier;
    const there = AREAS.find((a) => a.id === e.to)!.tier;
    if (here !== there) return { kind: e.kind === "drop" ? "fall" : "ride", dir: TIERS.indexOf(there) < TIERS.indexOf(here) ? "up" : "down" };
    const [dx, dy] = [e.at.col / STRAT_COLS - 0.5, e.at.row / STRAT_ROWS - 0.5];
    return { kind: here === "below" ? "stair" : "walk", dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down" };
  }

  /** What E at a way out is called. */
  private exitWord(e: Exit): string {
    const { kind, dir } = this.crossing(e);
    if (kind === "fall") return "Drop";
    if (kind === "ride") return e.name === "The Boat" ? `Take the boat to ${AREAS.find((a) => a.id === e.to)?.name ?? "the far shore"}` : `Ride the lift ${dir}`;
    if (barred(e)) return e.key && !remembered(KEYS).has(e.key) ? `Locked: the ${BOSS_KEY[e.key] ?? "key"} opens it` : "Barred";
    const there = AREAS.find((a) => a.id === e.to)?.name;
    return there ? `Traverse the clouds to ${there}` : "Traverse the clouds";
  }

  /** E at a way out: a slow walk off the edge into the crossing's clouds; a lift or a drop goes at once (a drop still warns). */
  private traverse(e: Exit): void {
    if (barred(e)) return;
    const { kind, dir } = this.crossing(e);
    if (kind !== "walk" && kind !== "stair") return this.depart(e);
    const hero = this.hero!;
    this.gone = true;
    hero.way = [];
    // On out past the gate the way it leads, wherever the captain stood: never back onto its tile from beyond it.
    const [dc, dr] = ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const)[dir];
    const [x, y] = [(e.at.col + 0.5 + 2 * dc) * CELL, (e.at.row + 0.75 + 2 * dr) * CELL];
    if (Math.abs(x - hero.s.x) > 2) hero.s.setFlipX(x < hero.s.x);
    this.play(hero.s, hero.move ?? hero.idle);
    this.tweens.add({ targets: hero.s, x, y, alpha: 0.1, duration: 1100, ease: "Sine.easeIn", onComplete: () => this.depart(e) });
  }

  /** A boss room's fog across its way in, after the Souls games, while its boss lives. */
  private fogGate(): void {
    const arena = this.local?.arena;
    // An arena with no gate is walked straight into: no fog, no mist.
    if (!arena || arena.gate.length === 0 || remembered(SLAIN).has(arena.boss)) return;
    for (const c of arena.gate) this.sealed.add(`${c.col},${c.row}`);
    // One gate for each run of fog cells: the Ramparts' wall is fogged at both its ends.
    const left = [...arena.gate];
    while (left.length > 0) {
      const run = [left.shift()!];
      for (let i = 0; i < run.length; i++) {
        for (let j = left.length - 1; j >= 0; j--) if (Math.abs(left[j]!.col - run[i]!.col) + Math.abs(left[j]!.row - run[i]!.row) === 1) run.push(...left.splice(j, 1));
      }
      this.fog.push(...this.fogVeil(run));
    }
    // The room itself, every tile of its quarter, under mist: what waits in it is seen only from inside.
    const room = this.roomOf(arena);
    const tiers = this.local!.island.rows;
    for (let r = 0; r < tiers.length; r += 2) {
      for (let c = 0; c < tiers[r]!.length; c += 2) {
        if (districtOf(this.local!, c, r)?.name !== room) continue;
        const [x, y] = [(c + 1) * CELL, (r + 1) * CELL];
        this.mist.push(this.add.image(x, y, `cloud${1 + ((c * 7 + r * 3) % 8)}`).setScale(1.4).setTint(0xe8e6e0).setDepth(DEPTH.clouds - 1));
      }
    }
  }

  /** The quarter a boss room's boss stands in. */
  private roomOf(arena: NonNullable<AreaMap["arena"]>): string | undefined {
    const home = this.local!.dwellers.find((d) => d.kind === arena.boss);
    return home && districtOf(this.local!, home.col, home.row)?.name;
  }

  /** Once the captain stands in the boss room, by the fog or by the road from the far side, its mist parts. */
  private partMist(): void {
    const arena = this.local?.arena;
    if (!arena || this.mist.length === 0 || this.gone) return;
    const hero = this.hero!;
    if (districtOf(this.local!, hero.at.col, hero.at.row)?.name !== this.roomOf(arena)) return;
    for (const m of this.mist) this.tweens.add({ targets: m, alpha: 0, scale: 1.4, duration: 1400, ease: "Sine.easeOut", onComplete: () => m.destroy() });
    this.mist = [];
  }

  private shut(c: Cell): boolean {
    const k = `${c.col},${c.row}`;
    return this.sealed.has(k) || this.locked.has(k) || this.solid.has(k);
  }

  /** A gate across each locked way, until its key is carried or the captain has come through from the far side. */
  private lockGates(): void {
    const keys = remembered(KEYS);
    for (const l of this.local?.locks ?? []) {
      if (keys.has(l.key) || (l.flag && this.flags.has(l.flag as WorldFlag))) continue;
      for (const c of l.cells) {
        this.locked.add(`${c.col},${c.row}`);
        this.gatehouse("locked", [c]);
      }
    }
  }

  /** The locked way beside the captain, if any. */
  private lockNear(): NonNullable<AreaMap["locks"]>[number] | undefined {
    const at = this.hero!.at;
    return this.local?.locks?.find((l) => l.cells.some((c) => this.locked.has(`${c.col},${c.row}`) && tileDistance(c, at) <= 1));
  }

  /** Beside the fog, on the outside of it. */
  private atFog(): boolean {
    const arena = this.local?.arena;
    const hero = this.hero!;
    if (!arena || this.sealed.size === 0) return false;
    const gate = arena.gate[0]!;
    return arena.gate.some((c) => tileDistance(c, hero.at) <= 1) && tileDistance(hero.at, arena.inside) > tileDistance(gate, arena.inside);
  }

  /** E at the fog: through it, slowly, into the boss room; it stays shut behind. */
  private enterFog(): void {
    const hero = this.hero!;
    // Walked through, not carried: from where the captain stands, straight through the nearest fog tile and two steps
    // on into the room, at a walking pace; never set down before the boss.
    const gate = this.local!.arena!.gate.reduce((a, c) => (tileDistance(c, hero.at) < tileDistance(a, hero.at) ? c : a));
    const [dc, dr] = [Math.sign(gate.col - hero.at.col), Math.sign(gate.row - hero.at.row)];
    const to = [2, 1].map((k) => ({ col: gate.col + dc * k, row: gate.row + dr * k })).find((c) => isWalkable(c.col, c.row) && !this.shut(c)) ?? this.local!.arena!.inside;
    this.gone = true;
    hero.way = [];
    this.play(hero.s, hero.move ?? hero.idle);
    if (dc) hero.s.setFlipX(dc < 0);
    const [x, y] = [(to.col + 0.5) * CELL, (to.row + 0.75) * CELL];
    this.tweens.add({
      targets: hero.s,
      x,
      y,
      alpha: { from: 1, to: 0.6 },
      yoyo: false,
      duration: 260 * Math.max(Math.abs(to.col - hero.at.col), Math.abs(to.row - hero.at.row)),
      ease: "Linear",
      onComplete: () => {
        hero.s.setAlpha(1).setDepth(standing(y));
        hero.at = { ...to };
        this.gone = false;
      },
    });
  }

  /** The boss down: its fog thins away and the way back opens. */
  private liftFog(): void {
    this.sealed.clear();
    for (const f of this.fog) {
      this.tweens.killTweensOf(f);
      this.tweens.add({ targets: f, alpha: 0, duration: 1600, onComplete: () => f.destroy() });
    }
    this.fog = [];
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
    this.hooks.onTier(id);
  }

  private flyTo(c: Cell, rows: number): void {
    const cam = this.active;
    cam.pan(c.col * CELL, c.row * CELL, 900, "Sine.easeInOut", true);
    cam.zoomTo(this.zoomFor(rows), 900, "Sine.easeInOut", true);
  }

  private controls(): void {
    this.input.setDefaultCursor(HAND);
    this.input.mouse?.disableContextMenu();
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.playing) return;
      const cam = this.active;
      const widest = this.local ? Math.max(this.zoomFor(STRAT_ROWS), cam.width / (STRAT_COLS * CELL)) : this.zoomFor(STRAT_ROWS + 6);
      cam.zoomTo(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.85 : 1.18), widest, this.zoomFor(9)), 160, "Sine.easeOut", true);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const cam = this.active;
      if (this.playing) {
        // Dark Souls on a mouse: the left button strikes toward the cursor, the right held raises the shield.
        if (p.rightButtonDown()) this.shieldUp = true;
        else if (p.leftButtonDown()) this.attack(this.time.now, cam.getWorldPoint(p.x, p.y));
        return;
      }
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    const lower = (p: Phaser.Input.Pointer): void => void (p.rightButtonReleased() && (this.shieldUp = false));
    this.input.on("pointerupoutside", lower);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 8) d.moved = true;
      const cam = this.active;
      if (d.moved) cam.setScroll(d.sx - (p.x - d.x) / cam.zoom, d.sy - (p.y - d.y) / cam.zoom);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      lower(p);
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const w = this.active.getWorldPoint(p.x, p.y);
      const cell = { col: Math.floor(w.x / CELL), row: Math.floor(w.y / CELL) };
      // A bonfire mark, an exit travels, else the area under the pointer.
      const fire = this.markAt.findIndex((m) => m.tier === this.view && Math.abs(m.cell.col - cell.col) <= 2 && Math.abs(m.cell.row - cell.row) <= 2);
      if (fire >= 0) return this.hooks.onFire?.(fire);
      for (const e of this.local?.exits ?? []) {
        if (Math.abs(e.at.col - cell.col) <= 2 && Math.abs(e.at.row - cell.row) <= 2) return this.depart(e);
      }
      const ch = this.map.tiers[this.view].areaAt[cell.row]?.[cell.col];
      if (ch && ch !== "-") this.hooks.onArea(AREAS[AREA_CODE.indexOf(ch)]!.id);
    });
  }

  /** Where a cell of an area's own map falls on the atlas: the same share of the way across the area's ground there. */
  private onAtlas(area: AreaId, c: Cell): { tier: TierId; cell: Cell } {
    const a = AREAS.find((x) => x.id === area)!;
    const ch = AREA_CODE[AREAS.indexOf(a)];
    const box = { c0: Infinity, c1: -Infinity, r0: Infinity, r1: -Infinity };
    this.map.tiers[a.tier].areaAt.forEach((line, r) => {
      for (let col = 0; col < line.length; col++) {
        if (line[col] !== ch) continue;
        Object.assign(box, { c0: Math.min(box.c0, col), c1: Math.max(box.c1, col), r0: Math.min(box.r0, r), r1: Math.max(box.r1, r) });
      }
    });
    const rows = areaMap(area).island.rows;
    // ponytail: a share of the bounding box, not the area's real layout; a fire can land off its true spot, even on water.
    return {
      tier: a.tier,
      cell: { col: Math.round(box.c0 + ((c.col + 0.5) / rows[0]!.length) * (box.c1 - box.c0 + 1)), row: Math.round(box.r0 + ((c.row + 0.5) / rows.length) * (box.r1 - box.r0 + 1)) },
    };
  }

  /** The lit bonfires on the atlas, after Elden Ring's graces: a glow each, the picked one ringed and named, the one sat at said so. */
  private markFires(fires: FireMark[], pick: number): void {
    const gone = new Set(this.marks);
    this.names = this.names.filter((n) => !gone.has(n.text));
    for (const o of this.marks) o.destroy();
    this.marks = [];
    this.markAt = fires.map((f) => this.onAtlas(f.area, f));
    fires.forEach((f, i) => {
      const { tier, cell } = this.markAt[i]!;
      const [x, y] = [(cell.col + 0.5) * CELL, (cell.row + 0.5) * CELL];
      const picked = i === pick;
      const lit = f.lit;
      // Unlit: a small grey ember, no glow, named only when picked.
      const made: Phaser.GameObjects.GameObject[] = lit
        ? [
            this.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd65a).setScale(picked ? 1.4 : 0.9).setDepth(DEPTH.fx + 1),
            this.add.circle(x, y, picked ? 26 : 18, 0xffb347).setStrokeStyle(6, picked ? 0xfdfaf0 : 0x1c2634).setDepth(DEPTH.fx + 2),
          ]
        : [this.add.circle(x, y, picked ? 16 : 11, 0x6b6e76, picked ? 0.95 : 0.7).setStrokeStyle(4, picked ? 0xfdfaf0 : 0x1c2634).setDepth(DEPTH.fx + 1)];
      if (picked || f.here) {
        const t = this.add
          .text(x, y - 1.3 * CELL, f.here ? `${f.name} (you are here)` : lit ? f.name : `${f.name} (unlit)`, { fontFamily: FONT, fontSize: "28px", fontStyle: "bold", color: lit ? "#f2d48a" : "#b8bcc6", stroke: "#1c2634", strokeThickness: 6 })
          .setOrigin(0.5)
          .setDepth(DEPTH.fx + 3);
        this.names.push({ text: t, px: 14, tier });
        made.push(t);
      }
      if (picked) this.tweens.add({ targets: made[lit ? 1 : 0], scale: 1.25, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      for (const other of TIERS) if (other !== tier) this.cams[other].ignore(made);
      this.marks.push(...made);
    });
    const at = this.markAt[pick];
    if (!at) return;
    if (at.tier !== this.view) this.show(at.tier);
    this.flyTo(at.cell, 24);
  }

  /** Outlines a land on its own tier, every edge of its cells against another's, and flies to it. */
  private select(id: AreaId | null): void {
    this.outline?.destroy();
    this.outline = null;
    if (!id) return;
    const a = AREAS.find((x) => x.id === id)!;
    const ch = AREA_CODE[AREAS.indexOf(a)];
    const rows = this.map.tiers[a.tier].areaAt;
    const g = this.add.graphics().lineStyle(8, 0xfdfaf0, 0.85).setDepth(DEPTH.fx);
    const at = (c: number, r: number): boolean => rows[r]?.[c] === ch;
    rows.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] !== ch) continue;
        const [x, y] = [c * CELL, r * CELL];
        if (!at(c, r - 1)) g.lineBetween(x, y, x + CELL, y);
        if (!at(c, r + 1)) g.lineBetween(x, y + CELL, x + CELL, y + CELL);
        if (!at(c - 1, r)) g.lineBetween(x, y, x, y + CELL);
        if (!at(c + 1, r)) g.lineBetween(x + CELL, y, x + CELL, y + CELL);
      }
    });
    for (const other of TIERS) if (other !== a.tier) this.cams[other].ignore(g);
    this.outline = g;
    this.show(a.tier);
    this.flyTo(this.centre(id), 24);
  }

  /** A solid prop's base for the hero's feet: its art's measured ink at the foot, its footprint's rows deep less half a tile. */
  private baseOf(p: Placed): void {
    const tiles = [...solidCells({ props: [p], fences: [] })];
    if (tiles.length === 0) return;
    for (const k of tiles) this.boxed.add(k);
    const cells = tiles.map((k) => k.split(",").map(Number) as [number, number]);
    const b = BASE[p.art];
    const scale = (p.scale ?? 1) * (p.color ? 1 : (PROP[p.art]?.scale ?? 1));
    const cx = (p.col + 0.5) * CELL + (b?.dx ?? 0) * (p.flip ? -1 : 1) * scale;
    const half = b ? (b.w * scale) / 2 : ((Math.max(...cells.map(([c]) => c)) - Math.min(...cells.map(([c]) => c)) + 1) * CELL) / 2;
    const y1 = (p.row + 0.95) * CELL;
    this.bases.push({ x0: cx - half, x1: cx + half, y0: y1 - (new Set(cells.map(([, r]) => r)).size - 0.5) * CELL, y1 });
  }

  /** In play: an area map with the hero on it and dev mode off. */
  private get playing(): boolean {
    return !!this.hero && !this.dev;
  }

  /** Dev mode frees the camera over the whole map; off, it holds on the hero at the play zoom. */
  private setDev(on: boolean): void {
    this.dev = on;
    this.shieldUp = false;
    this.hooks.dev = on;
    const cam = this.active;
    if (!this.hero) return;
    // At once, not eased: a zoom still running when play resumes would carry on over the play zoom.
    cam.zoomEffect.reset();
    cam.panEffect.reset();
    if (on) {
      cam.stopFollow();
      // Unbounded, so a map smaller than the screen sits in its middle rather than against an edge.
      cam.removeBounds();
      // The whole map in view, its longer side to the screen's edge.
      cam.setZoom(Math.min(this.zoomFor(STRAT_ROWS), cam.width / (STRAT_COLS * CELL)));
      cam.centerOn((STRAT_COLS * CELL) / 2, (STRAT_ROWS * CELL) / 2);
    } else {
      cam.setBounds(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
      cam.setZoom(this.zoomFor(AREA_ROWS));
      cam.startFollow(this.hero.s, true, 0.15, 0.15);
    }
  }

  private body(s: Phaser.GameObjects.Sprite, at: Cell, hp: number, speed: number, look: { idle: string; move?: string; attack?: string }): Body {
    return { s, at, hp, max: hp, next: 0, busy: 0, speed, way: [], planned: -1e9, ...look, lift: s.displayHeight * s.originY * 0.78, bar: this.add.graphics().setDepth(DEPTH.fx), dead: false };
  }

  private spawnHero(at: Cell): void {
    const look = this.look(HERO_LOOK);
    const y = (at.row + 0.75) * CELL;
    const s = this.add.sprite((at.col + 0.5) * CELL, y, look.idle.key).setOrigin(0.5, look.anchor).setDepth(standing(y));
    this.play(s, look.idle.key);
    this.hero = { ...this.body(s, at, this.gear.hp, HERO.speed, { idle: look.idle.key, move: look.move?.key, attack: HERO_ATTACK.key }) };
    const k = this.input.keyboard;
    if (k) this.keys = k.addKeys({ up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D", shift: "SHIFT" }, false) as typeof this.keys;
    // Captured, so Space never scrolls the page or presses a focused button.
    k?.addCapture("SPACE");
  }

  /** A monster at its post: it waits there until it notices the hero. */
  private addFoe(d: Dweller): void {
    const look = this.look(d);
    const stats = FOES[d.kind]!;
    const y = (d.row + 0.75) * CELL;
    const s = this.add
      .sprite((d.col + 0.5) * CELL, y, look.idle.key)
      .setOrigin(0.5, look.anchor + (stats.flies ? HOVER : 0))
      .setScale(look.scale)
      .setDepth(standing(y))
      .setFlipX(Math.random() < 0.5);
    const tint = BEAST[d.kind]?.tint;
    if (tint) s.setTint(tint).setData("tint", tint);
    this.play(s, look.idle.key);
    const at = { col: d.col, row: d.row };
    const attack = BEAST[d.kind]?.attack ? `beast_${d.kind}_attack` : undefined;
    this.foes.push({ ...this.body(s, at, stats.hp, stats.speed, { idle: look.idle.key, move: look.move?.key, attack }), kind: d.kind, home: at, stats, windup: null });
  }

  /** Plays a sheet's loop, unless it is already playing: a body stepping cell to cell keeps its stride. */
  private play(s: Phaser.GameObjects.Sprite, key: string): void {
    if (s.anims.currentAnim?.key === `${key}_loop` && s.anims.isPlaying) return;
    if (this.anims.exists(`${key}_loop`)) s.play(`${key}_loop`);
    else s.setTexture(key, 0);
  }

  /** Sets a body walking a grid route, pulled into straight legs. */
  private walk(b: Body, route: readonly Cell[]): void {
    b.way = smoothPath(b.at, route).map((c) => ({ x: (c.col + 0.5) * CELL, y: (c.row + 0.75) * CELL }));
  }

  /** Walks a body along its way for one frame at its speed; true while it moves. */
  private advance(b: Body, dt: number): boolean {
    let left = (b.speed * CELL * dt) / 1000;
    while (left > 0 && b.way.length > 0) {
      const to = b.way[0]!;
      const [dx, dy] = [to.x - b.s.x, to.y - b.s.y];
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 2) b.s.setFlipX(dx < 0);
      if (d <= left) {
        b.s.setPosition(to.x, to.y);
        b.way.shift();
        left -= d;
      } else {
        b.s.setPosition(b.s.x + (dx / d) * left, b.s.y + (dy / d) * left);
        left = 0;
      }
    }
    b.at = { col: Math.floor(b.s.x / CELL), row: Math.round(b.s.y / CELL - 0.75) };
    b.s.setDepth(standing(b.s.y));
    const moving = b.way.length > 0;
    this.play(b.s, moving && b.move ? b.move : b.idle);
    return moving;
  }

  /** A swing, at a body or at the air. */
  private swing(from: Body, to: Body | null, every: number, time: number, anim = from.attack): void {
    from.next = time + every * 1000;
    from.busy = time + 350;
    from.way = [];
    if (to && to.at.col !== from.at.col) from.s.setFlipX(to.at.col < from.at.col);
    if (anim && this.anims.exists(`${anim}_once`)) {
      from.s.play(`${anim}_once`);
      from.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !from.dead && this.play(from.s, from.idle));
    } else if (to) this.tweens.add({ targets: from.s, x: from.s.x + (to.s.x - from.s.x) * 0.25, duration: 90, yoyo: true });
  }

  /** Whether `b` faces `other`: a shield turns only to the side it looks. */
  private facing(b: Body, other: Body): boolean {
    return b.s.flipX ? other.s.x <= b.s.x + 0.25 * CELL : other.s.x >= b.s.x - 0.25 * CELL;
  }

  /** A blow: the striker's swing, the target's flash and the number off it; a guarding hero takes little from the front. */
  private strike(from: Body, to: Body, attack: number, every: number, time: number, anim = from.attack): void {
    this.swing(from, to, every, time, anim);
    this.hurt(from, to, attack);
  }

  /** A blow landing: the target's flash and the number off it; a guarding hero takes little from the front. */
  private hurt(from: Body, to: Body, attack: number, open = false): void {
    const now = this.time.now;
    // Mid-roll nothing lands, as in Dark Souls.
    if (to === this.hero && now < this.roll.until) return;
    let blocked = !open && to === this.hero && this.guarding && this.facing(to, from);
    if (blocked) {
      const b = block(this.stamina, attack, this.gear.block);
      this.stamina = b.stamina;
      this.spentAt = now;
      if (b.broken) {
        // Too little stamina to take it on the shield: the guard breaks, the blow lands whole, the captain staggers.
        blocked = false;
        this.guardBroken = now + 900;
        to.busy = Math.max(to.busy, now + 900);
        this.float(to.s.x, to.s.y - to.lift - 40, "Guard broken", "#fdfaf0");
      }
    }
    const dealt = blocked ? throughGuard(attack) : attack;
    to.hp = struck(to.hp, dealt);
    to.s.setTintFill(blocked ? 0x9cc4e8 : 0xffffff);
    this.time.delayedCall(90, () => untint(to.s));
    const color = blocked ? "#9cc4e8" : to === this.hero ? "#ff8a7a" : "#fdfaf0";
    const n = this.add.text(to.s.x, to.s.y - to.lift - 10, `${dealt}`, { fontFamily: FONT, fontSize: "28px", fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: n, y: n.y - 40, alpha: 0, duration: 700, ease: "Sine.easeOut", onComplete: () => n.destroy() });
    if (to.hp === 0) this.fall(to, from);
    else if (this.band.includes(to as Companion)) this.emitBand();
    else if (this.foes.includes(to as Foe)) this.flinch(to as Foe, now, 400);
  }

  /** An archer's shot: the draw, then the arrow across, landing if the mark still stands. */
  private shoot(from: Body, to: Body, attack: number, every: number, time: number, missile: (typeof MISSILE)[string]): void {
    this.swing(from, to, every, time);
    this.loose(from, to, attack, missile);
  }

  /** A missile let fly at `to`: it lands if they still stand and the line is still clear. */
  private loose(from: Body, to: Body, attack: number, missile: (typeof MISSILE)[string]): void {
    const launch = { ...from.at };
    const [x, y] = [from.s.x, from.s.y - 40];
    const [tx, ty] = [to.s.x, to.s.y - to.lift * 0.5];
    // A monster's throw flies at where its mark stood, slow enough to see coming: step or roll off that spot and it misses.
    // The band's arrows stay quick and sure.
    const hostile = this.foes.includes(from as Foe);
    // An arrow flies point first; a bone, an acorn or a bolt tumbles.
    const m = this.add.sprite(x, y, missile.key).setDepth(DEPTH.fx);
    if (missile.frame) this.loop(m, missile.key);
    else m.setRotation(Math.atan2(ty - y, tx - x));
    this.tweens.add({
      targets: m,
      x: tx,
      y: ty,
      duration: Math.max(120, Math.hypot(tx - x, ty - y) / (hostile ? 0.55 : 0.9)),
      onComplete: () => {
        m.destroy();
        if (to.dead) return;
        // Dodged: no longer where it was aimed.
        if (hostile && Math.hypot(to.s.x - tx, to.s.y - to.lift * 0.5 - ty) > 0.65 * CELL) return;
        // Stepped behind cover while it flew: it strikes the wall, not them.
        if (clearShot(launch, to.at, this.blocks)) this.hurt(from, to, attack);
      },
    });
  }

  /** A body at nothing: a monster is gone; the hero rises again where it arrived, whole. */
  private fall(b: Body, by?: Body): void {
    b.dead = true;
    b.bar.clear();
    this.tweens.killTweensOf(b.s);
    if (this.band.includes(b as Companion)) {
      // A fallen companion lies where it fell until the captain rests.
      b.way = [];
      b.s.stop();
      b.s.setTexture(b.idle, 0).setAngle(b.s.flipX ? -90 : 90).setAlpha(0.6).setTint(0x8a8f99);
      this.emitBand();
      return;
    }
    if (this.lastHit === b) this.lastHit = null;
    if (b !== this.hero) {
      this.tweens.add({ targets: b.s, alpha: 0, duration: 500, onComplete: () => b.s.destroy() });
      const gold = (b as Foe).stats?.gold;
      if (gold) this.dropGold(b.at, Math.round(gold * this.gear.greed));
      if (this.isBoss(b as Foe)) this.felled((b as Foe).kind, BOSS_KEY[(b as Foe).kind]);
      return;
    }
    const hero = this.hero!;
    this.flag("died");
    this.gone = true;
    // All the gold carried stays where the captain fell; whatever was left at the last death is gone.
    store(LOST, this.gold > 0 ? { area: this.local!.area, col: hero.at.col, row: hero.at.row, gold: this.gold } : null);
    this.setGold(0);
    hero.way = [];
    this.tweens.add({ targets: b.s, alpha: 0.25, duration: 600 });
    // Felled by the boss guarding a way out, as at the Landing's end: the captain wakes past it, at the far side's first fire.
    const past = this.local!.exits.find((e) => e.guard && e.guard === (by as Foe | undefined)?.kind);
    if (past) {
      // Lost, not over, after Elden Ring's Grafted Scion: the bull keeps the Ring and waits to be come back for.
      this.flag("bullWon");
      const fire = areaMap(past.to).fires[0]!;
      store(REST, { area: past.to, ...fire });
      remember(KINDLED, remembered(KINDLED).add(`${past.to}:${fire.col},${fire.row}`));
    }
    // The page says so, darkens, and wakes the captain at the bonfire last rested at, the monsters back at their posts.
    this.time.delayedCall(900, () => this.hooks.onDeath?.(restPoint().area));
  }

  /** What E does here besides swing: talk to someone right beside, else rest at a bonfire beside, else talk to someone near. */
  private eTarget(): { folk: Folk } | { fire: Cell } | { note: Note } | { exit: Exit } | { fog: true } | { lock: string } | undefined {
    const at = this.hero!.at;
    const folk = this.folk.filter((f) => f.near).sort((a, b) => tileDistance(a.at, at) - tileDistance(b.at, at))[0];
    if (folk && tileDistance(folk.at, at) <= 1) return { folk };
    const fire = this.fireNear();
    if (fire) return { fire };
    const note = this.notes.find((n) => tileDistance(n.at, at) <= 1);
    if (note) return { note };
    const exit = this.local?.exits.find((e) => tileDistance(e.at, at) <= 1);
    if (exit) return { exit };
    if (this.atFog()) return { fog: true };
    const lock = this.lockNear();
    if (lock) return { lock: `${lock.name}: locked. The ${BOSS_KEY[lock.key] ?? "key"} opens it` };
    return folk && { folk };
  }

  /** Gold on the ground at a cell: a nugget that pops out, or the glowing heap left at a death. */
  private dropGold(at: Cell, gold: number, more: { lost?: boolean } = {}): void {
    const x = (at.col + 0.5) * CELL;
    const y = (at.row + 0.75) * CELL;
    const s = this.add.image(x, y, "gold").setOrigin(0.5, 0.62).setScale(more.lost ? 0.8 : 0.5).setDepth(standing(y) - 1);
    if (more.lost) {
      const glow = this.add.image(x, y - 10, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd65a).setAlpha(0.6).setDepth(DEPTH.clouds - 2);
      this.tweens.add({ targets: [s, glow], scale: "*=1.12", duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      s.once(Phaser.GameObjects.Events.DESTROY, () => glow.destroy());
    } else this.tweens.add({ targets: s, y: { from: y - 30, to: y }, duration: 420, ease: "Bounce.easeOut" });
    this.piles.push({ at: { ...at }, gold, s, ...more });
  }

  private setGold(n: number): void {
    this.gold = n;
    store(GOLD, n);
    this.hooks.onGold?.(n);
  }

  /** Once a frame: gold within a tile of the captain is picked up. */
  private gather(): void {
    const hero = this.hero!;
    if (hero.dead || this.gone) return;
    for (const p of this.piles.filter((p) => tileDistance(p.at, hero.at) <= 1)) {
      this.piles.splice(this.piles.indexOf(p), 1);
      this.setGold(this.gold + p.gold);
      if (p.stone) store(TAKEN, [...stored<string[]>(TAKEN, []), p.stone]);
      if (p.lost) store(LOST, null);
      p.shine?.destroy();
      this.tweens.add({ targets: p.s, y: p.s.y - 24, alpha: 0, duration: 300, ease: "Sine.easeOut", onComplete: () => p.s.destroy() });
      this.float(p.s.x, p.s.y - 50, `+${p.gold} gold`, "#ffd65a");
    }
  }

  /** The bonfire the captain stands beside, if any, and only with no monster near it: by a camp still held, E fights. */
  private fireNear(): Cell | undefined {
    const at = this.hero!.at;
    const fire = this.local?.fires.find((f) => tileDistance(f, at) <= 1);
    return fire && !this.foes.some((f) => !f.dead && tileDistance(f.at, fire) <= REST_CLEAR) ? fire : undefined;
  }

  /** E at a bonfire: rest, in place. Resting saves the spot, makes the captain and the band whole, and the monsters come back. */
  private rest(fire: Cell): void {
    const hero = this.hero!;
    try {
      localStorage.setItem(REST, JSON.stringify({ area: this.local!.area, col: fire.col, row: fire.row }));
    } catch {}
    remember(KINDLED, remembered(KINDLED).add(`${this.local!.area}:${fire.col},${fire.row}`));
    this.gone = true;
    hero.way = [];
    hero.hp = hero.max;
    this.flasks = maxFlasks();
    this.hooks.onFlasks?.(this.flasks);
    for (const b of [...this.foes, ...this.band]) {
      // Marked dead first, so a blow still in flight finds no one.
      b.dead = true;
      this.tweens.killTweensOf(b.s);
      b.s.destroy();
      b.bar.destroy();
    }
    this.foes = [];
    this.band = [];
    this.lastHit = null;
    for (const d of this.local!.dwellers) if (FOES[d.kind] && !remembered(SLAIN).has(d.kind)) this.addFoe(d);
    stored<CompanionKind[]>(BAND, []).forEach((kind) => this.addCompanion(kind));
    this.emitBand();
    this.hooks.onRest?.(this.local!.area);
  }

  /** Sat by the bonfire last rested at, after the Souls games: still, turned to the fire, the camera drawn in close. */
  private sit(on: boolean): string | null {
    const hero = this.hero;
    if (!hero || !this.local) return null;
    this.gone = on;
    hero.way = [];
    const fire = restPoint();
    if (on) hero.s.setFlipX((fire.col + 0.5) * CELL < hero.s.x);
    this.play(hero.s, hero.idle);
    this.active.zoomTo(this.zoomFor(AREA_ROWS) * (on ? 1.7 : 1), 900, "Sine.easeInOut", true);
    return districtOf(this.local, fire.col, fire.row)?.name || (AREAS.find((a) => a.id === this.local!.area)?.name ?? null);
  }

  /** R: a flask, if there is one and anything to heal; the hero stands still a moment to drink it. */
  private quaff(): void {
    const hero = this.hero!;
    const time = this.time.now;
    if (!this.playing || hero.dead || this.gone || this.guarding || time < hero.busy) return;
    const was = hero.hp;
    const d = drink(hero.hp, hero.max, this.flasks, this.gear.flask);
    if (d.flasks === this.flasks) return this.float(hero.s.x, hero.s.y - hero.lift - 30, this.flasks ? "Unhurt" : "No flasks", "#fdfaf0");
    Object.assign(hero, { hp: d.hp, way: [], busy: time + 600 });
    this.flasks = d.flasks;
    this.hooks.onFlasks?.(this.flasks);
    this.play(hero.s, hero.idle);
    const [x, y] = [hero.s.x, hero.s.y];
    const drop = this.add.image(x, y - hero.lift - 6, FLASK_ICON.key).setScale(0.6).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: drop, y: drop.y - 34, alpha: { from: 1, to: 0 }, duration: 650, ease: "Sine.easeOut", onComplete: () => drop.destroy() });
    // The swirl rises from the ground round the feet, in front of the hero.
    const fx = this.add.sprite(x, y + 14, HEAL_FX.key).setOrigin(0.5, 0.72).setDepth(standing(y) + 1);
    fx.play(`${HEAL_FX.key}_once`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    hero.s.setTint(0x9cf0a0);
    this.time.delayedCall(300, () => hero.s.clearTint());
    this.time.delayedCall(250, () => this.float(x, y - hero.lift - 10, `+${d.hp - was}`, "#8fe08a"));
  }

  /** A companion beside the captain, at `hp` (carried across a crossing; 0 lies fallen), else whole. */
  private addCompanion(kind: CompanionKind, hp?: number): void {
    const hero = this.hero!;
    const free = (c: Cell): boolean =>
      isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && !(c.col === hero.at.col && c.row === hero.at.row) && !this.band.some((o) => o.at.col === c.col && o.at.row === c.row);
    const at = findRoute(hero.at, free)?.at(-1) ?? hero.at;
    const look = this.look({ kind, col: at.col, row: at.row, color: "blue" });
    const y = (at.row + 0.75) * CELL;
    const s = this.add.sprite((at.col + 0.5) * CELL, y, look.idle.key).setOrigin(0.5, look.anchor).setDepth(standing(y));
    this.play(s, look.idle.key);
    const stats = COMPANIONS[kind];
    const c: Companion = { ...this.body(s, at, stats.hp, stats.speed, { idle: look.idle.key, move: look.move?.key, attack: COMPANION_ATTACK[kind].key }), kind, post: { ...at } };
    this.band.push(c);
    if (hp !== undefined) c.hp = Math.min(c.max, hp);
    if (hp === 0) this.fall(c);
  }

  /** The band, once a frame: each companion fights, follows or holds, as the order and its plan say. */
  private lead(time: number, dt: number): void {
    const hero = this.hero!;
    const live = this.foes.filter((f) => !f.dead);
    const aim = this.lastHit && !this.lastHit.dead ? this.lastHit : null;
    const target = this.bandOrder === "attack" && aim ? live.indexOf(aim) : -1;
    for (const c of this.band) {
      if (c.dead || time < c.busy) continue;
      if (hero.dead || this.gone) {
        c.way = [];
        this.advance(c, dt);
        continue;
      }
      const stats = COMPANIONS[c.kind];
      // A lancer cannot reach what flies: it fights only what walks, and leaves the rest to the bows.
      const mine = live.filter((f) => canReach(stats.range, f.stats));
      let plan = companionPlan(c.at, c.kind, this.bandOrder, hero.at, target >= 0 ? mine.indexOf(live[target]!) : -1, mine.map((f) => f.at), c.post);
      // An archer with no clear line moves for one.
      if (plan.do === "strike" && c.kind === "archer" && !clearShot(c.at, mine[plan.foe]!.at, this.blocks)) plan = { do: "close", foe: plan.foe };
      if (plan.do === "strike") {
        const foe = mine[plan.foe]!;
        c.way = [];
        if (time >= c.next) {
          if (c.kind === "archer") this.shoot(c, foe, stats.attack, stats.every, time, MISSILE.archer!);
          else this.strike(c, foe, stats.attack, stats.every, time);
        } else {
          this.play(c.s, c.idle);
          if (Math.abs(foe.s.x - c.s.x) > 4) c.s.setFlipX(foe.s.x < c.s.x);
        }
        continue;
      }
      if (plan.do === "stay") c.way = [];
      else if (time - c.planned > 400) {
        c.planned = time;
        // Not onto the captain or another companion: a band stands round its captain, not on them.
        const taken = (cell: Cell): boolean =>
          (cell.col === hero.at.col && cell.row === hero.at.row) || this.band.some((o) => o !== c && !o.dead && o.at.col === cell.col && o.at.row === cell.row);
        const goal =
          plan.do === "close"
            ? (cell: Cell) => tileDistance(cell, mine[plan.foe]!.at) <= stats.range && (c.kind !== "archer" || clearShot(cell, mine[plan.foe]!.at, this.blocks))
            : this.bandOrder === "hold"
              ? (cell: Cell) => cell.col === plan.to.col && cell.row === plan.to.row
              : (cell: Cell) => tileDistance(cell, plan.to) <= 1;
        const way = findRoute(c.at, goal, taken);
        if (way) this.walk(c, way);
      }
      this.advance(c, dt);
    }
  }

  /** 1, 2, 3: the band's order; on hold, each keeps the spot it stands on. */
  private command(order: BandOrder): void {
    const hero = this.hero!;
    if (!this.playing || hero.dead || this.gone || this.band.length === 0) return;
    this.bandOrder = order;
    for (const c of this.band) c.post = { ...c.at };
    this.float(hero.s.x, hero.s.y - hero.lift - 30, ORDER_WORD[order], "#9cc4e8");
    this.emitBand();
  }

  private emitBand(): void {
    this.hooks.onBand?.({ order: this.bandOrder, members: this.band.map((c) => ({ kind: c.kind, hp: c.dead ? 0 : c.hp, max: c.max })) });
  }

  /** The goods a merchant shows now. */
  private stock(f: Folk): ItemName[] {
    return f.npc.shop ? onOffer(f.npc.shop.stock, remembered(BOUGHT), remembered(SLAIN)).map((s) => s.item) : [];
  }

  /** At a merchant's menu: a good, for gold, once, and kept; what it gives is the captain's at once. */
  private buyHere(item: ItemName): void {
    const f = this.menu!.folk;
    const shop = f.npc.shop!;
    const bought = remembered(BOUGHT);
    if (bought.has(item)) return this.callOut(f, shop.sold);
    if (this.gold < ITEMS[item].cost) return this.callOut(f, shop.poor);
    this.setGold(this.gold - ITEMS[item].cost);
    remember(BOUGHT, bought.add(item));
    const was = this.gear;
    this.gear = kit(bought);
    const hero = this.hero!;
    // A shard's flask comes filled, a haunch's health with it.
    this.flasks += this.gear.flasks - was.flasks;
    this.hooks.onFlasks?.(this.flasks);
    hero.max = this.gear.hp;
    hero.hp += this.gear.hp - was.hp;
    this.float(hero.s.x, hero.s.y - hero.lift - 30, item, "#f4cf6b");
    this.emitSack();
    this.menu!.pick = this.stock(f).indexOf(item);
    this.showMenu();
  }

  private emitSack(): void {
    const bought = remembered(BOUGHT);
    const items = (Object.keys(ITEMS) as ItemName[]).filter((item) => bought.has(item));
    const stats = (Object.keys(STATS) as (keyof Kit)[]).map((k) => ({ label: STATS[k].label, now: statWords(k, this.gear) }));
    this.hooks.onSack?.({ items: items.map((item) => ({ label: item, icon: ITEM_ICON[item], gives: gives(item), about: ITEMS[item].about })), stats });
  }

  /** In a talk with someone who hires out: a companion joins, for gold, if there is room. */
  private hireHere(): void {
    const kind = this.menu && RECRUITER[this.menu.folk.npc.id];
    if (!kind) return;
    const hero = this.hero!;
    const h = hire(this.gold, this.band.map((c) => c.kind), kind);
    if (!h) {
      const f = this.menu!.folk;
      return this.callOut(f, this.band.length >= BAND_SIZE ? REFUSE[f.npc.id]!.full : REFUSE[f.npc.id]!.poor);
    }
    this.setGold(h.gold);
    store(BAND, h.band);
    this.addCompanion(kind);
    this.emitBand();
    this.float(hero.s.x, hero.s.y - hero.lift - 30, `A ${kind === "lancer" ? "Lancer" : "Archer"} joins`, "#9cc4e8");
    this.showMenu();
  }

  private menuOptions(f: Folk): MenuView["options"] {
    if (this.menu?.shopping) {
      const bought = remembered(BOUGHT);
      const goods = this.stock(f).map((item) => {
        const sold = bought.has(item);
        const after = kit(new Set([...bought, item]));
        const change = (Object.keys(ITEMS[item].adds) as (keyof Kit)[]).map((k) => ({ label: STATS[k].label, now: statWords(k, this.gear), after: statWords(k, after) }));
        return { label: item, note: `${ITEMS[item].cost}`, icon: ITEM_ICON[item], gives: gives(item), sold, about: ITEMS[item].about, afford: !sold && this.gold >= ITEMS[item].cost, change };
      });
      return [...goods, { label: "Back" }];
    }
    if (f.npc.shop) return [{ label: "Talk" }, { label: "Shop" }, { label: "Leave" }];
    const kind = RECRUITER[f.npc.id]!;
    const cost = COMPANIONS[kind].cost;
    return [{ label: "Talk" }, { label: `Hire ${kind === "lancer" ? "a Lancer" : "an Archer"}`, note: `${cost} gold` }, { label: "Leave" }];
  }

  private showMenu(): void {
    const m = this.menu;
    this.hooks.onMenu?.(m ? { name: m.folk.npc.name, options: this.menuOptions(m.folk), pick: m.pick, shop: m.shopping, gold: m.shopping ? this.gold : undefined } : null);
  }

  private openMenu(f: Folk): void {
    const hero = this.hero!;
    hero.way = [];
    f.bubble?.destroy();
    f.bubble = null;
    f.s.setFlipX(hero.s.x < f.s.x);
    hero.s.setFlipX(f.s.x < hero.s.x);
    this.menu = { folk: f, pick: 0 };
    this.showMenu();
  }

  private closeMenu(part: boolean): void {
    const m = this.menu;
    if (!m) return;
    this.menu = null;
    this.showMenu();
    if (part) this.callOut(m.folk, m.folk.npc.part);
  }

  /** Esc in a menu: out of the goods to the menu, or out of the menu. */
  private back(): void {
    const m = this.menu;
    if (!m) return;
    if (!m.shopping) return this.closeMenu(true);
    this.menu = { folk: m.folk, pick: 1 };
    this.showMenu();
  }

  private movePick(d: number): void {
    const m = this.menu;
    if (!m) return;
    const n = this.menuOptions(m.folk).length;
    m.pick = (m.pick + d + n) % n;
    this.showMenu();
  }

  /** E in a menu: talk (and back to the menu after), hire, or leave. */
  private choose(): void {
    const m = this.menu!;
    const last = m.pick === this.menuOptions(m.folk).length - 1;
    if (m.shopping) {
      if (!last) return this.buyHere(this.stock(m.folk)[m.pick]!);
      this.menu = { folk: m.folk, pick: 1 };
      return this.showMenu();
    }
    if (m.pick === 0) {
      const f = m.folk;
      this.menu = null;
      this.showMenu();
      this.talkTo(f);
    } else if (last) this.closeMenu(true);
    else if (m.folk.npc.shop) {
      this.menu = { folk: m.folk, pick: 0, shopping: true };
      this.showMenu();
    } else this.hireHere();
  }

  /** A word or a number over a body: up and gone. */
  private float(x: number, y: number, text: string, color: string): void {
    const n = this.add.text(x, y, text, { fontFamily: FONT, fontSize: "26px", fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: n, y: y - 40, alpha: 0, duration: 900, ease: "Sine.easeOut", onComplete: () => n.destroy() });
  }

  /**
   * Keys in play: WASD or the arrows walk the hero freely, at its own speed, the way they point. Each axis is tried on
   * its own, so it slides along what blocks; a cliff is crossed only at a ramp, by the same step rule as any walk.
   */
  private steer(dt: number): boolean {
    const hero = this.hero!;
    if (!this.keys || hero.dead || this.menu) return false;
    const [dx, dy] = this.keyDir();
    if (!dx && !dy) return false;
    hero.way = [];
    this.slide(dx, dy, (hero.speed * CELL * dt) / 1000, true);
    this.play(hero.s, hero.move ?? hero.idle);
    return true;
  }

  /** The way the movement keys point, each axis -1, 0 or 1. */
  private keyDir(): [number, number] {
    const k = this.keys;
    if (!k || this.menu) return [0, 0];
    return [(k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0), (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0)];
  }

  /** Moves the hero `px` the way (dx, dy) points, each axis on its own so it slides along what blocks. */
  private slide(dx: number, dy: number, px: number, face: boolean): void {
    const hero = this.hero!;
    const step = px / Math.hypot(dx, dy);
    const cellAt = (x: number, y: number): Cell => ({ col: Math.floor(x / CELL), row: Math.round(y / CELL - 0.75) });
    // Felt for a little ahead of the feet, so the hero stops short of a wall instead of half inside it.
    const ahead = 0.3 * CELL;
    const open = (x: number, y: number): boolean => {
      const to = cellAt(x, y);
      const k = `${to.col},${to.row}`;
      return (to.col === hero.at.col && to.row === hero.at.row) || (canStep(hero.at, to) && (this.boxed.has(k) ? !this.sealed.has(k) && !this.locked.has(k) : !this.shut(to)));
    };
    // A prop or a rock stops the feet at its art's base, not at its tile's edge; feet already in one can always step out.
    const hit = (b: Box, x: number, y: number): boolean => x + FEET.w > b.x0 && x - FEET.w < b.x1 && y + FEET.down > b.y0 && y - FEET.up < b.y1;
    let { x, y } = hero.s;
    const clear = (nx: number, ny: number): boolean => !this.bases.some((b) => hit(b, nx, ny) && !hit(b, x, y));
    if (dx && open(x + Math.sign(dx) * ahead + dx * step, y) && clear(x + dx * step, y)) x += dx * step;
    if (dy && open(x, y + Math.sign(dy) * ahead + dy * step) && clear(x, y + dy * step)) y += dy * step;
    hero.s.setPosition(x, y).setDepth(standing(y));
    hero.at = cellAt(x, y);
    if (face && Math.abs(dx) > 0.01) hero.s.setFlipX(dx < 0);
  }

  /** A tap of Space: a roll the way the hero walks, or a backstep standing still; nothing lands on it while it lasts. */
  private dodge(time: number): void {
    const hero = this.hero!;
    if (!this.playing || hero.dead || this.gone || this.menu || this.talk || time < hero.busy || time < this.roll.until || !canAct(this.stamina)) return;
    let [dx, dy] = this.keyDir();
    const next = hero.way[0];
    if (!dx && !dy && next) [dx, dy] = [next.x - hero.s.x, next.y - hero.s.y];
    const back = !dx && !dy;
    if (back) dx = hero.s.flipX ? 1 : -1;
    const len = Math.hypot(dx, dy);
    const { tiles, ms } = back ? ROLL.back : ROLL;
    this.stamina = spend(this.stamina, STAMINA.roll);
    this.spentAt = time;
    this.queued = false;
    this.roll = { until: time + ms, dx: dx / len, dy: dy / len, speed: (tiles * CELL) / (ms / 1000), trail: 0, back };
    Object.assign(hero, { way: [], busy: time + ms + ROLL.recover });
    if (!back) hero.s.setFlipX(dx < 0);
    this.play(hero.s, hero.move ?? hero.idle);
  }

  /** A fading echo of the hero, left behind as it rolls: the pack has no roll, so the speed is shown this way. */
  private echo(): void {
    const s = this.hero!.s;
    const g = this.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(s.depth - 1).setTintFill(0xdfe8ff).setAlpha(0.45);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /** The fight, once a frame: the hero walks or strikes, each monster near enough strikes, chases or goes home. */
  private fight(time: number, dt: number): void {
    const hero = this.hero!;
    const rolling = time < this.roll.until;
    if (!hero.dead) hero.s.setAngle(0);
    this.guarding = !rolling && !hero.dead && !this.gone && this.playing && (!!this.keys?.shift.isDown || this.shieldUp) && time >= this.guardBroken;
    if (rolling) {
      this.slide(this.roll.dx, this.roll.dy, (this.roll.speed * dt) / 1000, !this.roll.back);
      if (time - this.roll.trail > 45) {
        this.roll.trail = time;
        this.echo();
      }
    } else if (this.guarding) {
      // Behind the shield it walks at its pace, no sprint, once any swing is through, the shield kept to the nearest monster.
      hero.way = [];
      this.queued = false;
      if (time >= hero.busy) {
        const [kx, ky] = this.keyDir();
        const foe = this.foes.filter((f) => !f.dead && tileDistance(f.at, hero.at) <= 3).sort((a, b) => tileDistance(a.at, hero.at) - tileDistance(b.at, hero.at))[0];
        if (kx || ky) {
          this.slide(kx, ky, (HERO.speed * CELL * dt) / 1000, !foe);
          // The pack has no guarding walk: the guard pose rocks foot to foot about the feet, a step each swing.
          hero.s.setAngle(Math.sin((time / 1000) * Math.PI * 5) * 6);
        }
        if (foe && Math.abs(foe.s.x - hero.s.x) > 4) hero.s.setFlipX(foe.s.x < hero.s.x);
        this.play(hero.s, HERO_GUARD.key);
      }
    } else if (!hero.dead && !this.gone) {
      // Space held past a tap, while moving: a sprint, for as long as the stamina lasts.
      const [kx, ky] = this.keyDir();
      const sprinting = this.spaceAt >= 0 && time - this.spaceAt >= TAP && (kx || ky || hero.way.length > 0) && canAct(this.stamina) && time >= hero.busy;
      hero.speed = HERO.speed * (sprinting ? HERO.sprint : 1);
      if (sprinting) {
        this.stamina = spend(this.stamina, (STAMINA.sprint * dt) / 1000);
        this.spentAt = time;
      }
      // A press made during a swing is kept, and swings the moment the hero is ready.
      if (this.queued && time >= hero.busy && time >= hero.next) this.attack(time);
      const steering = time >= hero.busy && this.steer(dt);
      if (steering) {
        // Walked by the keys this frame.
      } else if (time < hero.busy) {
        // Mid-swing: it holds still.
      } else this.advance(hero, dt);
    }
    this.stamina = recover(this.stamina, dt / 1000, (time - this.spentAt) / 1000, this.guarding);
    this.lead(time, dt);
    this.burn(time);
    this.foes.forEach((f, i) => {
      if (f.dead) return;
      if (f.windup && time >= f.windup.at) this.land(f, time);
      if (time < f.busy) return;
      // Far from the hero and at home, a monster rests.
      if (tileDistance(f.at, hero.at) > 14 && f.at.col === f.home.col && f.at.row === f.home.row && f.way.length === 0) return;
      // Its mark: the captain or a companion it can see, a Lancer first.
      const marks: Body[] = [...(hero.dead || this.gone ? [] : [hero]), ...this.band.filter((c) => !c.dead)];
      const m = foeTarget(f.at, f.stats.aggro, marks.map((b) => ({ at: b.at, draws: (b as Companion).kind === "lancer" })));
      const mark = marks[m] ?? hero;
      const intent = foeIntent(f.at, f.home, m >= 0 ? mark.at : null, f.stats);
      if (f.kind === "troll" && m >= 0 && intent !== "return" && time >= f.next) {
        const move = trollMove(tileDistance(f.at, mark.at), f.last ?? null);
        if (move) return this.trollWindUp(f, mark, move, time);
      }
      const missile = MISSILE[f.kind];
      const sighted = missile ? clearShot(f.at, mark.at, this.blocks) : Math.hypot(mark.s.x - f.s.x, mark.s.y - f.s.y) < 1.5 * CELL;
      // Blades take turns at a mark: the first two beside it (in the order they stand on the map) fight, the rest wait.
      const melee = !missile && !f.stats.flies;
      const engaged = melee ? this.foes.filter((o, j) => j < i && !o.dead && !MISSILE[o.kind] && !o.stats.flies && tileDistance(o.at, mark.at) <= 1).length : 0;
      const turn = !melee || mayEngage(engaged);
      if (intent === "attack" && sighted && turn) {
        f.way = [];
        if (Math.abs(mark.s.x - f.s.x) > 4) f.s.setFlipX(mark.s.x < f.s.x);
        if (time >= f.next) this.windUp(f, mark, time);
        else this.play(f.s, f.idle);
        return;
      }
      if (f.stats.flies) {
        // On the wing it goes straight over anything: at its mark, or home.
        if (intent !== "idle" && time - f.planned > 300) {
          f.planned = time;
          const to = intent === "return" ? f.home : mark.at;
          f.way = [{ x: (to.col + 0.5) * CELL, y: (to.row + 0.75) * CELL }];
        }
      } else if (intent === "attack" && turn && !missile && f.way.length === 0) {
        // Beside the hero by tile but stopped short of its tile's middle, mid-stride: it steps in rather than stand out of reach.
        f.way = [{ x: (f.at.col + 0.5) * CELL, y: (f.at.row + 0.75) * CELL }];
      } else if (intent !== "idle" && time - f.planned > 400) {
        f.planned = time;
        const taken = (c: Cell) => this.shut(c) || this.foes.some((o) => o !== f && !o.dead && o.at.col === c.col && o.at.row === c.row);
        // A thrower comes round for a clear line; a fighter comes beside.
        const goal =
          intent === "return"
            ? (c: Cell) => c.col === f.home.col && c.row === f.home.row
            : missile
              ? (c: Cell) => tileDistance(c, mark.at) <= (f.stats.range ?? 1) && clearShot(c, mark.at, this.blocks)
              : turn
                ? (c: Cell) => tileDistance(c, mark.at) <= 1
                : (c: Cell) => tileDistance(c, mark.at) === 2;
        const way = findRoute(f.at, goal, taken);
        if (way) this.walk(f, way);
      }
      this.advance(f, dt);
    });
  }

  /** A monster draws back: a white flash, its attack played out over the wind-up, the blow to land when it ends. */
  private windUp(f: Foe, mark: Body, time: number): void {
    const ms = f.stats.windup * 1000;
    f.windup = { at: time + ms, mark };
    f.next = time + f.stats.every * 1000;
    f.busy = time + ms;
    f.s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => untint(f.s));
    if (f.attack && this.anims.exists(`${f.attack}_once`)) {
      const hit = BEAST[f.kind]?.hit;
      f.s.play(hit ? { key: `${f.attack}_once`, frameRate: (hit * 1000) / ms } : `${f.attack}_once`);
      f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && this.play(f.s, f.idle));
    }
  }

  /** The wind-up's end: a missile flies, or a blade lands if the mark is still in reach; a roll or a step away is a miss. */
  private land(f: Foe, time: number): void {
    const { mark, move, aim } = f.windup!;
    f.windup = null;
    if (move) return this.trollLands(f, move, aim!, time);
    if (BEAST[f.kind]?.hit) f.s.anims.msPerFrame = 100;
    f.busy = time + PACE.recover * 1000;
    if (mark.dead) return;
    const missile = MISSILE[f.kind];
    if (missile) return this.loose(f, mark, f.stats.attack, missile);
    if (tileDistance(f.at, mark.at) <= 1 && Math.hypot(mark.s.x - f.s.x, mark.s.y - f.s.y) < 1.6 * CELL) this.hurt(f, mark, f.stats.attack);
  }

  /** The troll draws back for a blow, its cells glowing red on the ground until it falls. */
  private trollWindUp(f: Foe, mark: Body, move: TrollMove, time: number): void {
    const ms = TROLL[move].windup * 1000;
    const aim = move === "slam" ? this.around(mark.at, TROLL.slam.radius) : move === "charge" ? chargeLine(f.at, mark.at) : this.scatter(mark.at, TROLL.toss.patches);
    Object.assign(f, { last: move, way: [], windup: { at: time + ms, mark, move, aim }, next: time + f.stats.every * 1000, busy: time + ms });
    if (Math.abs(mark.s.x - f.s.x) > 4) f.s.setFlipX(mark.s.x < f.s.x);
    f.s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => untint(f.s));
    f.s.play("beast_troll_windup_once");
    const g = this.add.graphics().setDepth(DEPTH.unit - 1);
    for (const c of aim) g.fillStyle(move === "toss" ? 0xff9a3a : 0xe03a2a, 0.45).fillRect(c.col * CELL + 2, c.row * CELL + 2, CELL - 4, CELL - 4);
    this.tweens.add({ targets: g, alpha: { from: 0.4, to: 1 }, duration: ms, onComplete: () => g.destroy() });
  }

  /** The troll's blow falls: the club on its circle, the charge down its line, or embers that burn on. */
  private trollLands(f: Foe, move: TrollMove, aim: Cell[], time: number): void {
    f.busy = time + TROLL.recover * 1000;
    f.s.play("beast_troll_attack_once");
    f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && f.s.play("beast_troll_recovery_once").once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && this.play(f.s, f.idle)));
    const on = new Set(aim.map((c) => `${c.col},${c.row}`));
    const struck = (dmg: number) => {
      for (const b of [this.hero!, ...this.band]) if (!b.dead && on.has(`${b.at.col},${b.at.row}`)) this.hurt(f, b, dmg);
    };
    if (move === "slam") {
      this.cameras.main.shake(160, 0.006);
      return struck(TROLL.slam.damage);
    }
    if (move === "charge") {
      const end = aim.at(-1);
      if (!end) return;
      struck(TROLL.charge.damage);
      const ms = (aim.length / TROLL.charge.speed) * 1000;
      f.busy += ms;
      f.at = end;
      this.tweens.add({ targets: f.s, x: (end.col + 0.5) * CELL, y: (end.row + 0.75) * CELL, duration: ms, onUpdate: () => f.s.setDepth(standing(f.s.y)) });
      return;
    }
    for (const at of aim) {
      const y = (at.row + 0.75) * CELL;
      const s = this.add.sprite((at.col + 0.5) * CELL, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.55).setDepth(standing(y));
      this.loop(s, "fire");
      this.embers.push({ at, until: time + TROLL.toss.burn * 1000, tick: time, from: f, s });
    }
  }

  /** Embers die down in time, and burn whoever stands in them every tick; a shield is no help against the ground. */
  private burn(time: number): void {
    this.embers = this.embers.filter((e) => {
      if (time >= e.until) return void e.s.destroy();
      if (time >= e.tick) {
        e.tick = time + TROLL.toss.tick * 1000;
        for (const b of [this.hero!, ...this.band]) if (!b.dead && b.at.col === e.at.col && b.at.row === e.at.row) this.hurt(e.from, b, TROLL.toss.damage, true);
      }
      return true;
    });
  }

  /** The open cells within `r` of a cell, itself among them. */
  private around(at: Cell, r: number): Cell[] {
    const cells: Cell[] = [];
    for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (isWalkable(at.col + dc, at.row + dr)) cells.push({ col: at.col + dc, row: at.row + dr });
    return cells;
  }

  /** `n` open cells where embers land: the mark's own, the rest scattered near it. */
  private scatter(at: Cell, n: number): Cell[] {
    const near = this.around(at, 2).filter((c) => c.col !== at.col || c.row !== at.row);
    const picked = [at];
    while (picked.length < n && near.length) picked.push(near.splice(Math.floor(Math.random() * near.length), 1)[0]!);
    return picked;
  }

  // A boss kind counts only where the area places that boss: the Greyfall's own troll is rank and file.
  private isBoss(f: Foe): boolean {
    return BOSSES.has(f.kind) && !!this.local?.bosses.some((b) => tileDistance(b, f.home) <= 2);
  }

  /** A boss down: it stays down for good, and its key, if it has one, is the captain's. */
  private felled(kind: string, key?: string): void {
    remember(SLAIN, remembered(SLAIN).add(kind));
    if (this.local?.arena?.boss === kind) this.liftFog();
    if (key) remember(KEYS, remembered(KEYS).add(kind));
    const flask = BOSS_FLASK.has(kind);
    if (flask) {
      this.flasks += 1;
      this.hooks.onFlasks?.(this.flasks);
    }
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.width / 2, cam.height * 0.4, key ? `${key}\nobtained` : flask ? "Victory achieved\nA flask more" : "Victory\nachieved", { fontFamily: FONT, fontSize: "40px", fontStyle: "bold", color: "#f4cf6b", stroke: "#1c2634", strokeThickness: 8, align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.clouds + 10);
    this.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: 600, hold: 2400, yoyo: true, onComplete: () => t.destroy() });
  }

  /** A hit breaks a monster's wind-up, unless it is one that does not flinch. */
  private flinch(f: Foe, time: number, ms: number): void {
    if (!f.windup || f.stats.poise) return;
    f.windup = null;
    f.busy = Math.max(f.busy, time + ms);
    this.play(f.s, f.idle);
  }

  /** A health bar over a companion or a monster once it is hurt; the captain's own health is in the HUD. */
  private drawBar(b: Body): void {
    b.bar.clear();
    if (b.dead || b === this.hero || b.hp === b.max) return;
    const ally = this.band.includes(b as Companion);
    const [w, h] = [56, 7];
    const [x, y] = [b.s.x - w / 2, b.s.y - b.lift - 4];
    b.bar.fillStyle(0x1c2634, 0.85).fillRect(x - 2, y - 2, w + 4, h + 4);
    b.bar.fillStyle(ally ? 0x6fb0e0 : 0xe05a4a).fillRect(x, y, (w * b.hp) / b.max, h);
  }

  /** Loops for every sheet with more than one frame: props, beasts, knights. */
  private makeAnims(): void {
    for (const key of this.textures.getTextureKeys()) {
      const once = /_(attack|windup|recovery)$/.test(key) || [HERO_ATTACK.key, HERO_ATTACK2.key, COMPANION_ATTACK.lancer.key, COMPANION_ATTACK.archer.key, HEAL_FX.key].includes(key);
      if (once && !this.anims.exists(`${key}_once`)) {
        // The hero's swings fill the wait to the next one (4 frames, 0.4 s) rather than snap through and stand idle.
        // The hero's swings fill the wait to the next; a monster's attack plays out over its wind-up.
        const rate = key === HERO_ATTACK.key || key === HERO_ATTACK2.key || (key.startsWith("beast_") && /_(attack|windup|recovery)$/.test(key)) ? 10 : key === HEAL_FX.key ? 12 : 16;
        this.anims.create({ key: `${key}_once`, frames: this.anims.generateFrameNumbers(key), frameRate: rate, repeat: 0 });
      }
      const frames = this.textures.get(key).frameTotal - 1;
      if (frames < 2 || this.anims.exists(`${key}_loop`) || key.startsWith("tileset")) continue;
      this.anims.create({ key: `${key}_loop`, frames: this.anims.generateFrameNumbers(key), frameRate: 9, repeat: -1 });
    }
  }

  /** A soft round light, and a shaft of it for lifts going up. */
  private glowTextures(): void {
    // Made once per game: a scene restarted by a crossing finds them already there.
    if (this.textures.exists("glow")) return;
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
    // An area map draws no roads, its ways open ground in the district's own colour (across the wilds a road
    // tile's other colour read as a stripe painted on), unless it is a town whose streets should read as streets.
    const roads = this.local && !this.local.streets ? new Set<number>() : trailTiles(tier.roads);
    const local = this.local;
    // An area map's ground reads a shade lighter each height up; the engine works each tile's colour out.
    const shade = local ? groundColours(local) : null;
    buildMap(this, roads, (c, r, lv) => {
      // A stair stands on the lower ground at its foot: the art is see-through round the ramp, so that ground shows there.
      if (shade) return `tilesetC${(isSlope(c, r) && lv < level(c, r) ? shade[r + 1]?.[c] : shade[r]?.[c]) ?? 4}`;
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
    for (const f of [...tier.fires, ...tier.campfires]) this.bonfire(f);
    for (const d of tier.dwellers) this.addDweller(d);
    for (const e of this.local?.exits ?? []) this.exitMark(e);
    this.mood(tier);
    this.ambience(tier);
    this.labels(tier);
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
    const spot = (c: number, r: number, k: string, sheet: Sheet, frame?: number): Phaser.GameObjects.Sprite => {
      const x = (c + 0.25 + r01() * 0.5) * CELL;
      const y = (r + 0.7 + r01() * 0.3) * CELL;
      const s = this.add.sprite(x, y, k, frame).setOrigin(0.5, sheet.anchor).setScale((sheet.scale ?? 1) * (0.85 + r01() * 0.3)).setDepth(standing(y));
      if (r01() < 0.5) s.setFlipX(true);
      if (frame === undefined) this.loop(s, k);
      this.track(s);
      return s;
    };
    const decor = (kind: "tree" | "bush" | "rock" | "waterRock", x: number, y: number, scale = 1): Phaser.GameObjects.Sprite => {
      const s = addDecor(this, kind, x, y, scale, `${tier.id}${Math.round(x)},${Math.round(y)}`);
      this.track(s);
      return s;
    };
    // Nothing grows in a building's base or the ground round it.
    const built = new Set(tier.props.flatMap((p) => footprint(p, true).map((c) => c.row * STRAT_COLS + c.col)));
    // Nor on a fence's line or the tile outside it, so no bush or rock tangles with the posts.
    for (const f of tier.fences) for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) if (r <= f.row || r >= f.row + f.h - 1 || c <= f.col || c >= f.col + f.w - 1) built.add(r * STRAT_COLS + c);
    // Nor on a note or the two rows south of it, whose art would stand over the paper; woods keep their trees.
    for (const n of this.local?.notes ?? []) for (let r = n.at.row; r <= n.at.row + 2; r++) for (let c = n.at.col - 1; c <= n.at.col + 1; c++) if (!isForest(c, r)) built.add(r * STRAT_COLS + c);
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        // A thin line of woods is a hedgerow; a mass of them is a wood, whose trees take their kind from a spot a few
        // tiles off, so two districts' woods mingle rather than meet in a line.
        let woods = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc || dr) && isForest(c + dc, r + dr)) woods++;
        const hedge = !!this.local && tier.base !== "rock" && woods <= 3;
        const k = (n: number): number => Math.round(((((Math.sin(c * 12.9898 + r * 78.233 + n) * 43758.5453) % 1) + 1) % 1) * 8 - 4);
        const id = (this.local && isForest(c, r) && !hedge && areaId(c + k(1), r + k(2))) || areaId(c, r);
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
          if (hedge) {
            // Bushes along the line, a tree every few tiles: full trees on every tile piled into a wall.
            decor("bush", (c + 0.5) * CELL, (r + 0.85) * CELL, 1.1);
            if (r01() < 0.3) decor("tree", (c + 0.4 + r01() * 0.2) * CELL, (r + 0.8) * CELL);
          } else if (id === "emberwood") {
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
        if (this.local && districtOf(this.local, c, r)?.crops) {
          // A planted field: a small bush on every tile of every row, so it reads as crop rows.
          decor("bush", (c + 0.5) * CELL, (r + 0.8) * CELL, 0.5);
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
          // A rock or stump with open ground all round stands in the way; one at an edge stays scenery, or it could seal a pass.
          const block = (s: Phaser.GameObjects.Sprite, art: string): void => {
            if (edgy || !this.local) return;
            this.solid.add(`${c},${r}`);
            this.boxed.add(`${c},${r}`);
            const b = BASE[art]!;
            const cx = s.x + b.dx * (s.flipX ? -1 : 1) * s.scaleX;
            this.bases.push({ x0: cx - (b.w * s.scaleX) / 2, x1: cx + (b.w * s.scaleX) / 2, y0: s.y - 12, y1: s.y });
          };
          if ((id === "barrowmoor" || tier.base === "rock") && r01() < 0.5) spot(c, r, "prop_bones", PROP.bones!, 0);
          else if (id === "emberwood" && r01() < 0.35) block(spot(c, r, "prop_stump", PROP.stump!, 0), "stump");
          else if (roll < chance * 0.6 && tier.base !== "rock") decor("bush", x, y, 0.75);
          else {
            const rock = decor("rock", x, y, 1);
            block(rock, rock.texture.key);
          }
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
    if (p.art === "sconce") {
      // A torch in its bracket on a crypt wall: a small flame and its pool of light.
      const flame = this.add.sprite(x, y - 30, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.32).setDepth(standing(y));
      this.loop(flame, "fire");
      this.track(flame);
      const glow = this.add.image(x, y - 40, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb870).setAlpha(0.45).setScale(0.8).setDepth(DEPTH.clouds - 2);
      this.tweens.add({ targets: glow, alpha: 0.6, duration: 700 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return;
    }
    // On an area map a gold stone is gold to pick up, once: taken, it is gone for good.
    const stone = p.art === "goldStone" && this.local ? `${this.local.area}:${p.col},${p.row}` : undefined;
    if (stone && stored<string[]>(TAKEN, []).includes(stone)) return;
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
    const shine = p.art === "goldStone" && base === "rock" ? this.add.image(x, y - 20, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe27a).setAlpha(0.5).setScale(0.9).setDepth(DEPTH.clouds - 2) : null;
    this.track(s);
    if (stone) this.piles.push({ at: { col: p.col, row: p.row }, gold: GOLD_STONE, s, stone, ...(shine && { shine }) });
  }

  /** A fence pen: corners, rails and posts from the kit's 4x3 tile sheet. */
  private fence(col: number, row: number, w: number, h: number): void {
    /** One tile of the sheet; `crop` keeps only part of the frame, so an end piece shows no rail running off into nothing. */
    const piece = (c: number, r: number, frame: number, crop?: [number, number, number, number]): void => {
      const y = (r + 1) * CELL;
      const img = this.add.image(c * CELL + CELL / 2, y, "fence", frame).setOrigin(0.5, 1).setDepth(standing(y));
      if (crop) img.setCrop(...crop);
    };
    // The sheet is a pen's parts: corners, rails, sides. A straight run takes its ends from the corners, cut down to the
    // post and the rail that carries on along the run; a lone post is an end piece cut down to the post alone.
    if (w === 1 && h === 1) return piece(col, row, 10, [0, 0, 44, 64]);
    if (w === 1) {
      for (let r = row; r < row + h; r++) piece(col, r, r === row ? 0 : r === row + h - 1 ? 8 : 4, r === row || r === row + h - 1 ? [0, 0, 44, 64] : undefined);
      return;
    }
    if (h === 1) {
      for (let c = col; c < col + w; c++) piece(c, row, c === col ? 0 : c === col + w - 1 ? 3 : 1 + (c % 2), c === col || c === col + w - 1 ? [0, 0, 64, 54] : undefined);
      return;
    }
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
      // The way runs east-west: a fence line north to south across it.
      const across = cells.filter((c) => c.col === mid.col).map((c) => c.row);
      this.fence(mid.col, Math.min(...across), 1, Math.max(...across) - Math.min(...across) + 1);
    } else {
      const across = cells.filter((c) => c.row === mid.row).map((c) => c.col);
      this.fence(Math.min(...across), mid.row, Math.max(...across) - Math.min(...across) + 1, 1);
    }
  }

  /** A bonfire: flames, a warm light that breathes, and stones round it. */
  private bonfire(f: Cell): void {
    const x = (f.col + 0.5) * CELL;
    const y = (f.row + 0.8) * CELL;
    // In the Deeps the fires burn ghost-green: corpse-candles, not hearths.
    const ghost = this.local?.area === "deeps";
    const glow = this.add.image(x, y - 24, "glow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3).setDepth(DEPTH.clouds - 2);
    if (ghost) glow.setTint(0x7cf0b0);
    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.75, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.7).setDepth(standing(y));
    if (ghost) fire.setTint(0x8cffc0);
    this.loop(fire, "fire");
    this.track(fire);
  }

  /**
   * An area map's exit: a lift's shaft of light or a well's dark mouth when it
   * goes up or down a tier, else a sign at the map's edge naming where the road goes.
   */
  private exitMark(e: Exit): void {
    const x = (e.at.col + 0.5) * CELL;
    const y = (e.at.row + 0.8) * CELL;
    const here = this.local!.id;
    const there = AREAS.find((a) => a.id === e.to)!;
    const up = TIERS.indexOf(there.tier) < TIERS.indexOf(here);
    const down = TIERS.indexOf(there.tier) > TIERS.indexOf(here);
    // Each crossing is drawn as the thing it is: a town's well, a fen's sinkhole, a railed lift; a lift beside its own
    // building (the cave, the gnomes' tower, the keep) needs nothing more.
    const ground = DEPTH.ground + 1;
    if (e.kind === "drop" && this.local!.area === "harbour") {
      // The Old Well: a ring of stones round dark water, a post either side and the beam the rope hangs from.
      this.add.ellipse(x, y, 92, 44, 0x6f747e).setStrokeStyle(4, 0x3a3f4a).setDepth(ground);
      this.add.ellipse(x, y + 2, 64, 26, 0x16303c).setStrokeStyle(3, 0x2a2f38).setDepth(ground + 1);
      for (const side of [-1, 1]) this.add.rectangle(x + side * 40, y - 30, 8, 64, 0x7a5432).setStrokeStyle(2, 0x3b2716).setDepth(standing(y));
      this.add.rectangle(x, y - 62, 96, 9, 0x7a5432).setStrokeStyle(2, 0x3b2716).setDepth(standing(y) + 1);
      this.add.rectangle(x, y - 40, 3, 42, 0xc8b48a).setDepth(standing(y) + 1);
    } else if (e.kind === "drop") {
      // A sinkhole: the fen's black water drawing down into the ground, ringed in reed, a slow ripple on it.
      this.add.ellipse(x, y, 136, 62, 0x0e2226).setStrokeStyle(5, 0x2e4c3c).setDepth(ground);
      const ripple = this.add.ellipse(x, y, 70, 30).setStrokeStyle(2, 0x5a8a8a, 0.7).setDepth(ground + 1);
      this.tweens.add({ targets: ripple, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 2600, repeat: -1, ease: "Sine.easeIn" });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        this.track(addDecor(this, "bush", x + Math.cos(a) * 78, y + Math.sin(a) * 38, 0.8, `sink${i}`));
      }
    } else if (e.name === "The Boat") {
      // A boat crossing: the map moors the boat itself in the water beside it, so nothing more is drawn.
    } else if (up || down || e.name.includes("Lift")) {
      const beside = (up || down) && this.map.tiers[here].props.some((p) => ["cave", "gnomeTower", "watchtower", "tower", "castle", "monastery"].includes(p.art) && footprint(p).some((c) => Math.abs(c.col - e.at.col) <= 3 && Math.abs(c.row - e.at.row) <= 3));
      if (!beside) {
        // A lift: a plank floor railed on its left and right, open front and back, in the pack's own wood (its fence's and
        // its boats' browns, the navy outline every sprite has).
        this.add.rectangle(x, y - 0.3 * CELL, 2.4 * CELL, 1.6 * CELL, 0xbd8a59).setStrokeStyle(4, 0x161c2e).setDepth(ground);
        this.add.rectangle(x, y - 1.05 * CELL, 2.4 * CELL - 8, 6, 0xe5be76).setDepth(ground + 1);
        for (let i = -1; i <= 1; i++) this.add.rectangle(x + i * 0.8 * CELL, y - 0.3 * CELL, 3, 1.5 * CELL, 0x8d6857).setDepth(ground + 1);
        for (const side of [-1, 1]) this.fence(e.at.col + side, e.at.row - 1, 1, 2);
      }
    } else if (e.name.includes("Ladder")) {
      // A ladder, from the pack's fence: one upright run of it against the wall, rails and rungs.
      this.fence(e.at.col, e.at.row - 2, 1, 3);
    } else if (e.key && !remembered(KEYS).has(e.key)) {
      // Locked: the pack's fence across the way until its key is carried, then fog like any other.
      this.gatehouse("locked", this.doorway(e));
    } else if (!e.plain) {
      this.fogDoor(e);
    }
  }

  /** A way out to the next area on foot: a fog gate across the way. */
  private fogDoor(e: Exit): void {
    this.fogVeil(this.doorway(e));
  }

  /** The cells a gate spans: the walkable run on the exit's own level across the narrower way through it, so it fills the
   *  opening edge to edge and never hangs over water or cliff; open ground on both axes keeps three tiles, as before. */
  private doorway(e: Exit): Cell[] {
    const MAX = 4;
    const lv = level(e.at.col, e.at.row);
    const open = (c: Cell): boolean => isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && level(c.col, c.row) === lv;
    const run = (dc: number, dr: number): Cell[] => {
      const cells = [e.at];
      for (const s of [-1, 1]) {
        for (let i = 1; i <= MAX; i++) {
          const c = { col: e.at.col + dc * s * i, row: e.at.row + dr * s * i };
          if (!open(c)) break;
          cells.push(c);
        }
      }
      return cells.sort((a, b) => a.col - b.col || a.row - b.row);
    };
    const [rowRun, colRun] = [run(1, 0), run(0, 1)];
    const wide = 2 * MAX + 1;
    if (rowRun.length < colRun.length && rowRun.length < wide) return rowRun;
    if (colRun.length < rowRun.length && colRun.length < wide) return colRun;
    const { dir } = this.crossing(e);
    const across = dir === "left" || dir === "right";
    if ((across ? colRun : rowRun).length < wide) return across ? colRun : rowRun;
    return [-1, 0, 1].map((i) => (across ? { col: e.at.col, row: e.at.row + i } : { col: e.at.col + i, row: e.at.row }));
  }

  /** After the Souls games' fog gates, from the pack's own dust: a bank of its white puffs packed close across the way,
   *  breathing, and now and then a wisp lifting off it and coming apart through the sheet's own frames. */
  private fogVeil(cells: readonly Cell[]): Phaser.GameObjects.Sprite[] {
    const made: Phaser.GameObjects.Sprite[] = [];
    for (const c of cells) {
      for (let j = 0; j < 4; j++) {
        const x = (c.col + 0.22 + (j % 2) * 0.56) * CELL + (Math.random() - 0.5) * 10;
        const y = (c.row + 0.3 + Math.floor(j / 2) * 0.45) * CELL;
        const puff = this.add.sprite(x, y, "fogPuff", 0).setScale(1.25 + Math.random() * 0.3).setTint(0xf2f0ea).setAlpha(0.94).setDepth(standing(y + 0.5 * CELL));
        this.tweens.add({ targets: puff, scale: puff.scale * 1.08, x: x + (Math.random() - 0.5) * 10, duration: 1400 + Math.random() * 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        made.push(puff);
      }
    }
    if (!this.anims.exists("fogPuff_fade")) this.anims.create({ key: "fogPuff_fade", frames: this.anims.generateFrameNumbers("fogPuff"), frameRate: 9, repeat: 0 });
    const wisps = this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        if (!made[0]?.active) return void wisps.remove();
        const c = cells[Math.floor(Math.random() * cells.length)]!;
        const [x, y] = [(c.col + 0.2 + Math.random() * 0.6) * CELL, (c.row + 0.3) * CELL];
        const wisp = this.add.sprite(x, y, "fogPuff", 0).setTint(0xf2f0ea).setAlpha(0.85).setDepth(standing(y + 0.6 * CELL));
        wisp.play("fogPuff_fade");
        this.tweens.add({ targets: wisp, y: y - 34, x: x + (Math.random() - 0.5) * 24, duration: 1100, onComplete: () => wisp.destroy() });
      },
    });
    return made;
  }

  /** Creatures and knights, idle at their spot or walking their beat. */
  private addDweller(d: Dweller): void {
    if (this.local && FOES[d.kind]) {
      if (!remembered(SLAIN).has(d.kind)) this.addFoe(d);
      return;
    }
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
    // Every map on one tier shares the key: a crossing to another lays its own light.
    if (this.textures.exists(`atlasMood-${tier.id}`)) this.textures.remove(`atlasMood-${tier.id}`);
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
    const under = this.local && tier.base === "rock" ? (UNDER[this.local.area] ?? { rock: ROCK_MOOD, ambient: 0.22, glow: AREAS.find((a) => a.id === this.local!.area)!.mood, gold: 4 }) : null;
    const lights = this.local && under
      ? [
          ...[...tier.fires, ...tier.campfires].map((f) => ({ c: f.col, r: f.row, reach: 9 })),
          ...this.local.exits.map((e) => ({ c: e.at.col, r: e.at.row, reach: 7 })),
          ...tier.props.filter((p) => p.art === "goldStone").map((p) => ({ c: p.col, r: p.row, reach: under.gold })),
          ...tier.props.filter((p) => p.art === "sconce").map((p) => ({ c: p.col, r: p.row, reach: 5 })),
        ]
      : null;
    const lit = (c: number, r: number): number => Math.max(0, ...lights!.map((l) => 1 - Math.hypot(c - l.c, r - l.r) / l.reach));
    // Near a way out to a land on the same tier the light leans toward that land's, half way at the crossing, so
    // the two maps meet in one light.
    const tierOf = (id: AreaId) => AREAS.find((a) => a.id === id)?.tier;
    const toward = this.local && !under ? this.local.exits.filter((e) => tierOf(e.to) === tierOf(this.local!.area)).map((e) => ({ c: e.at.col, r: e.at.row, mood: AREAS.find((a) => a.id === e.to)!.mood })) : [];
    const lean = (c: number, r: number, m: number): number => {
      let k = 0;
      let to = m;
      for (const e of toward) {
        const f = 0.5 * (1 - Math.hypot(c - e.c, r - e.r) / LEAN_REACH);
        if (f > k) [k, to] = [f, e.mood];
      }
      const mix = (shift: number) => Math.round(((m >> shift) & 255) + (((to >> shift) & 255) - ((m >> shift) & 255)) * k);
      return k > 0 ? (mix(16) << 16) | (mix(8) << 8) | mix(0) : m;
    };
    const tone = (c: number, r: number): number => {
      if (tier.base === "rock" && (rows[r]?.[c] ?? "%") === "%") return under?.rock ?? ROCK_MOOD;
      if (lights && under) {
        // Open water has no area of its own: it shows a little more than the floor, so a lake reads as water in the dark.
        const water = AREAS[AREA_CODE.indexOf(tier.areaAt[r]![c]!)] === undefined;
        const k = Math.min(1, under.ambient + (water ? 0.08 : 0) + lit(c, r) * 1.1);
        const mix = (shift: number) => Math.round(((under.rock >> shift) & 255) + (((under.glow >> shift) & 255) - ((under.rock >> shift) & 255)) * k);
        return (mix(16) << 16) | (mix(8) << 8) | mix(0);
      }
      const k = (r + pad) * w + c + pad;
      const m = near[k]!;
      if (m === -1) return tier.base === "rock" ? ROCK_MOOD : 0xffffff;
      const f = tier.base === "rock" ? 0 : dist[k]! / (MOOD_REACH + 1);
      const mix = (shift: number) => Math.round(((m >> shift) & 255) + (255 - ((m >> shift) & 255)) * f);
      return lean(c, r, (mix(16) << 16) | (mix(8) << 8) | mix(0));
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
      // Grave-mist in the Deeps, green and low; a pale haze over the Hollow's lake.
      drift("deeps", 12, 0x6ab08a, 0.32);
      drift("hollow", 20, 0xa8d0ec, 0.28);
    } else {
      drift("gilded", 6, 0xffffff, 0.35);
    }
  }

  /** The middle of an area's ground on the atlas, by the average of its cells. */
  private centre(id: AreaId): Cell {
    const a = AREAS.find((x) => x.id === id)!;
    const ch = AREA_CODE[AREAS.indexOf(a)];
    const tiles = this.map.tiers[a.tier].areaAt.flatMap((line, r) => [...line].flatMap((x, c) => (x === ch ? [{ col: c, row: r }] : [])));
    const mid = (k: "col" | "row"): number => tiles.reduce((n, t) => n + t[k], 0) / Math.max(1, tiles.length);
    return { col: mid("col"), row: mid("row") };
  }

  /** The area names, large and centred on their land; they grow back to readable when zoomed out. */
  private labels(tier: AtlasTier): void {
    const text = (x: number, y: number, s: string, size: number, color: string, min: number, rows?: number): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: Math.round(size / 5) })
        .setOrigin(0.5)
        .setDepth(DEPTH.fx + 3);
      this.names.push({ text: t, px: min, tier: this.building, rows });
      return t;
    };
    if (this.local) return;
    // The castle wards get short, smaller names, only when close enough to read them apart; the Keep goes unnamed.
    const castle: Partial<Record<AreaId, string>> = { burg: "THE BURG", ramparts: "RAMPARTS", chapel: "CHAPEL" };
    for (const a of AREAS) {
      if (a.tier !== tier.id || a.id === "keep") continue;
      const mid = this.centre(a.id);
      const ward = castle[a.id];
      if (ward) text(mid.col * CELL, mid.row * CELL, ward, 36, "#e6dcc4", 12, 40).setLetterSpacing(6);
      else text(mid.col * CELL, mid.row * CELL, a.name.toUpperCase(), 64, "#fdfaf0", 22).setLetterSpacing(10);
    }
  }

  private flag(f: WorldFlag): void {
    this.flags.add(f);
    remember(FLAGS, this.flags);
  }

  /** The folk in this area as it was entered, with where each stands. */
  private folkHere(): [Npc, Whereabouts][] {
    return NPCS.flatMap((n): [Npc, Whereabouts][] => {
      const w = whereabouts(n, this.seen);
      return w && w.area === this.local!.area ? [[n, w]] : [];
    });
  }

  private addFolk(n: Npc, w: Whereabouts): void {
    const look = this.look(npcLook(n));
    const y = (w.at.row + 0.75) * CELL;
    const s = this.add.sprite((w.at.col + 0.5) * CELL, y, look.idle.key).setOrigin(0.5, look.anchor).setDepth(standing(y)).setFlipX(w.flip);
    if (w.dead) {
      // A body where they fell: laid down, greyed, still, and silent.
      s.setTexture(look.idle.key, 0).setAngle(w.flip ? -90 : 90).setTint(0x8a8f99).setDepth(standing(y) - 2);
      return;
    }
    this.loop(s, look.idle.key);
    // Named over their heads, so they stand out from the villagers at work round them.
    this.add
      .text(s.x, y - 1.05 * CELL, n.short ?? n.name, { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#f2d48a", stroke: "#1c2634", strokeThickness: 5 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx);
    this.folk.push({ npc: n, at: w.at, s, near: false, bubble: null });
  }

  /** A line called out over a dweller's head: up, held, gone. */
  private callOut(f: Folk, text: string): void {
    f.bubble?.destroy();
    const b = this.add
      .text(f.s.x, f.s.y - 1.45 * CELL, text, { fontFamily: FONT, fontSize: "24px", fontStyle: "italic bold", color: "#fdfaf0", stroke: "#1c2634", strokeThickness: 6, align: "center", wordWrap: { width: 5 * CELL } })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx + 2)
      .setAlpha(0);
    f.bubble = b;
    this.tweens.chain({
      targets: b,
      tweens: [
        { alpha: 1, y: b.y - 8, duration: 260, ease: "Cubic.easeOut" },
        { alpha: 0, duration: 400, delay: 2400, ease: "Sine.easeIn" },
      ],
      onComplete: () => {
        b.destroy();
        if (f.bubble === b) f.bubble = null;
      },
    });
  }

  /** E: on in a talk, else talk to whoever stands near, else swing; held, it keeps swinging but never skips a page. */
  private interact(repeat: boolean): void {
    if (!this.playing || this.hero!.dead || this.gone) return;
    if (this.menu) return void (!repeat && this.choose());
    if (this.reading) return void (!repeat && this.read(null));
    const t = this.talk ? undefined : this.eTarget();
    if (this.talk || t) {
      if (repeat) return;
      if (this.talk) return this.nextPage();
      if ("fire" in t!) return this.rest(t.fire);
      if ("note" in t!) return this.read(t.note);
      if ("exit" in t!) return this.traverse(t.exit);
      if ("fog" in t!) return this.enterFog();
      if ("lock" in t!) return;
      return RECRUITER[t!.folk.npc.id] || t!.folk.npc.shop ? this.openMenu(t!.folk) : this.talkTo(t!.folk);
    }
  }

  /** A swing, turned toward the cursor: at the monster in reach nearest where it points, else the air. */
  private attack(time: number, aim?: { x: number; y: number }): void {
    const hero = this.hero!;
    if (hero.dead || this.gone || this.menu || this.talk || this.guarding || !canAct(this.stamina)) return;
    if (aim) this.aim = { x: aim.x, y: aim.y };
    if (time < hero.busy || time < hero.next) return void (this.queued = true);
    this.queued = false;
    const at = this.aim ?? { x: hero.s.x + (hero.s.flipX ? -1 : 1), y: hero.s.y };
    if (Math.abs(at.x - hero.s.x) > 4) hero.s.setFlipX(at.x < hero.s.x);
    const reach = this.foes.filter((f) => !f.dead && canReach(1, f.stats) && tileDistance(f.at, hero.at) <= 1 && Math.hypot(f.s.x - hero.s.x, f.s.y - hero.s.y) < 1.5 * CELL);
    const foe = reach.sort((a, b) => Math.hypot(a.s.x - at.x, a.s.y - at.y) - Math.hypot(b.s.x - at.x, b.s.y - at.y))[0];
    this.heroSwing(foe ?? null, time);
  }

  /** The hero's next swing of its combo: the first and third cut one way, the second back the other; the third knocks back. */
  private heroSwing(foe: Foe | null, time: number): void {
    const hero = this.hero!;
    const step = (this.combo = comboStep(this.combo, (time - hero.next) / 1000));
    this.stamina = spend(this.stamina, STAMINA.swing);
    this.spentAt = time;
    const anim = step === 2 ? HERO_ATTACK2.key : HERO_ATTACK.key;
    this.swing(hero, foe, swingWait(step), time, anim);
    // Committed until the swing is through: no roll out of it.
    hero.busy = time + (HERO.hit + 0.25) * 1000;
    if (!foe) return;
    this.lastHit = foe;
    // The blow lands partway through the swing, if the mark is still in reach.
    this.time.delayedCall(HERO.hit * 1000, () => {
      if (foe.dead || hero.dead || tileDistance(foe.at, hero.at) > 1 || Math.hypot(foe.s.x - hero.s.x, foe.s.y - hero.s.y) > 1.6 * CELL) return;
      this.hurt(hero, foe, this.gear.attack);
      if (step === 3 && !foe.dead && !BOSSES.has(foe.kind)) this.knockBack(foe, this.time.now);
    });
  }

  /** Thrown a tile straight back from the hero, if the ground allows, and staggered a moment either way. */
  private knockBack(f: Foe, time: number): void {
    const hero = this.hero!;
    const to = { col: f.at.col + Math.sign(f.at.col - hero.at.col), row: f.at.row + Math.sign(f.at.row - hero.at.row) };
    this.flinch(f, time, 500);
    f.busy = Math.max(f.busy, time + 500);
    f.way = [];
    if (to.col === f.at.col && to.row === f.at.row) return;
    if (!canStep(f.at, to) || this.shut(to) || this.foes.some((o) => o !== f && !o.dead && o.at.col === to.col && o.at.row === to.row)) return;
    f.at = to;
    const y = (to.row + 0.75) * CELL;
    this.tweens.add({ targets: f.s, x: (to.col + 0.5) * CELL, y, duration: 180, ease: "Cubic.easeOut", onComplete: () => f.s.setDepth(standing(y)) });
  }

  private talkTo(f: Folk): void {
    const hero = this.hero!;
    if (tileDistance(f.at, hero.at) > TALK_RANGE) return;
    hero.way = [];
    f.bubble?.destroy();
    f.bubble = null;
    f.s.setFlipX(hero.s.x < f.s.x);
    hero.s.setFlipX(f.s.x < hero.s.x);
    const t = nextTalk(f.npc, this.heard, this.seen);
    this.talk = { folk: f, lines: t.lines, key: talkKey(f.npc, t), sets: t.sets, page: 0 };
    this.say();
  }

  /** A note opened, shown as a talk is, or closed. */
  private read(n: Note | null): void {
    this.reading = n;
    this.hooks.onSay?.(n && { name: "A note in the sand", text: n.text, more: false, note: true });
  }

  /** A note lying on the ground, glowing softly so it is seen from a way off. */
  private addNote(n: Note): void {
    const [x, y] = [(n.at.col + 0.5) * CELL, (n.at.row + 0.6) * CELL];
    this.add.image(x, y, "note").setScale(0.32).setAngle(Math.random() * 24 - 12).setDepth(DEPTH.unit - 1);
    const glow = this.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb347).setScale(0.45).setDepth(DEPTH.unit - 1);
    this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.6 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private say(): void {
    const t = this.talk;
    this.hooks.onSay?.(t ? { name: t.folk.npc.name, text: t.lines[t.page]!, more: t.page < t.lines.length - 1 } : null);
  }

  /** On to the next page; past the last, the talk is heard and done. */
  private nextPage(): void {
    const t = this.talk;
    if (!t) return;
    if (++t.page >= t.lines.length) {
      this.heard.add(t.key);
      remember(HEARD, this.heard);
      // A talk heard to its end can move someone on: they are elsewhere the next time this area is entered.
      if (t.sets) this.flag(t.sets);
      this.talk = null;
      this.say();
      // Talked out, a merchant's menu comes back, as in the Souls games.
      if (RECRUITER[t.folk.npc.id] || t.folk.npc.shop) this.openMenu(t.folk);
      return;
    }
    this.say();
  }

  /** Once a frame: folk greet a captain who comes near and turn to them; one walked away from mid-talk calls after. */
  private mind(): void {
    const hero = this.hero!;
    for (const f of this.folk) {
      const d = tileDistance(f.at, hero.at);
      if (d <= TALK_RANGE && !hero.dead) {
        if (!f.near && this.talk?.folk !== f) this.callOut(f, f.npc.greet);
        f.near = true;
        f.s.setFlipX(hero.s.x < f.s.x);
      } else if (d > TALK_RANGE + 1) f.near = false;
      if (this.talk?.folk === f && d > TALK_RANGE) {
        this.talk = null;
        this.say();
        this.callOut(f, f.npc.part);
      }
      if (this.menu?.folk === f && d > TALK_RANGE) this.closeMenu(true);
    }
    if (this.reading && tileDistance(this.reading.at, hero.at) > 1) this.read(null);
    const t = this.talk || this.menu || this.reading || hero.dead || this.gone ? undefined : this.eTarget();
    const action = !t ? null : "folk" in t ? "Talk" : "fire" in t ? "Rest" : "note" in t ? "Read" : "fog" in t ? "Traverse the fog" : "lock" in t ? t.lock : this.exitWord(t.exit);
    if (action !== this.nearName) this.hooks.onNear?.((this.nearName = action));
  }

  /** A quarter's name the first time the captain walks into it on this visit, once they have kept to it a moment: walking
   *  a border, or back and forth, never says it again. */
  private whereabouts(time: number): void {
    const hero = this.hero!;
    // An unnamed patch, a field or a pasture, belongs to the quarter round it.
    const here = districtOf(this.local!, hero.at.col, hero.at.row)?.name || this.district.name;
    const d = this.district;
    if (here !== d.next) Object.assign(d, { next: here, since: time });
    else if (here !== d.name && time - d.since > 1200 && this.playing && !hero.dead) {
      d.name = here;
      if (!d.shown.has(here)) this.hooks.onDistrict?.(here);
      d.shown.add(here);
    }
  }

  update(time: number, delta: number): void {
    const act = this.active;
    if (this.hero) {
      // A long stall (a tab in the background) is not a long stride.
      this.fight(time, Math.min(delta, 100));
      this.mind();
      this.gather();
      this.whereabouts(time);
      this.partMist();
      for (const b of [this.hero, ...this.foes, ...this.band]) this.drawBar(b);
      // The HUD's bars, a few times a second and only when they change.
      if (time - this.vitalsAt > 80) {
        this.vitalsAt = time;
        const v = { hp: this.hero.hp, max: this.hero.max, stamina: Math.round(this.stamina) };
        const key = `${v.hp},${v.max},${v.stamina}`;
        if (key !== this.vitalsKey) {
          this.vitalsKey = key;
          this.hooks.onVitals?.(v);
        }
        // A boss shows its bar as its fight opens: a room's boss once the captain stands in its room, mist parted, and has it
        // in view; any other within its leash.
        const hero = this.hero;
        const arena = this.local?.arena;
        const inRoom = !!arena && this.mist.length === 0 && districtOf(this.local!, hero.at.col, hero.at.row)?.name === this.roomOf(arena);
        const seen = (f: Foe): boolean => this.active.worldView.contains(f.s.x, f.s.y);
        // No fight in dev mode, and its whole-map camera has every boss in view.
        const boss = hero.dead || this.dev
          ? undefined
          : this.foes.find((f) => this.isBoss(f) && !f.dead && (f.kind === arena?.boss ? inRoom && seen(f) : tileDistance(f.at, hero.at) <= f.stats.leash));
        const name = boss && this.local?.bosses.slice().sort((a, b) => tileDistance(a, boss.home) - tileDistance(b, boss.home))[0]?.name;
        const bossKey = boss ? `${name},${boss.hp}` : "";
        if (bossKey !== this.bossKey) {
          this.bossKey = bossKey;
          this.hooks.onBoss?.(boss ? { name: name ?? boss.kind, hp: boss.hp, max: boss.max } : null);
        }
      }
    }
    for (const { text, px, tier, rows } of this.names) {
      text.setVisible(tier === this.view && (rows === undefined || act.zoom >= this.zoomFor(rows)));
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
