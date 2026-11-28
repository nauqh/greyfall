// The Atlas: Aurum in three tiers, drawn with the war map's
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
  LANE_HOUSE,
  NOTICES,
  stepNotice,
  companionPlan,
  foeTarget,
  hire,
  mendTarget,
  TIERS,
  MAPPED_AREAS,
  areaMap,
  districtOf,
  fireName,
  FOES,
  REST_CLEAR,
  BOSS_KITS,
  bossAim,
  type Note,
  GOLD_STONE,
  HERO,
  CLASSES,
  type HeroClass,
  ITEMS,
  GIFTS,
  LENT,
  kit,
  levelCost,
  heroLevel,
  savedLevels,
  type Levels,
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
  shown,
  solidCells,
  inGate,
  useIsland,
  type AreaId,
  type AreaMap,
  type AtlasMap,
  type AtlasTier,
  type BandOrder,
  type Cell,
  type CompanionKind,
  type CompanionStats,
  type Dweller,
  LOOT,
  lootDrop,
  type LootName,
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
import { ITEM_ICON } from "./itemIcons";
import { STRAT_COLS, STRAT_ROWS, at, climbsStair, findPath, isForest, isLand, isSlope, isWalkable, level, stairLean } from "./stratMap";
import { DEPTH, addDecor, cloudCover, loadTerrain, prepareTerrain, standing } from "./terrain";
import { HAND } from "./ui";
import { BLOCK, BONES, BOSS_MUSIC, CLASH, CLICK, COINS, CONFIRM, CRACKLE, DASH, ERROR, FALL, GLASS, GUARD_BREAK, HERALD, HIT, HURT, LATCH, LEATHER, LIT, loop, ONWARD, PAGE, play, STEP, SWING, TROLL_CHARGE, TROLL_DAZED, TROLL_FALL, TROLL_GROWL, TROLL_LAND, TROLL_ROAR, TROLL_ROCK, TROLL_SLAM, TROLL_STEP, TROLL_TELL } from "../app/sound";

export interface AtlasApi {
  /** Fly to an area, on its own tier. */
  focus: (id: AreaId) => void;
  /** Show a tier from its own height. */
  tier: (id: TierId) => void;
  /** In an area's map: rebuild the scene as another area's map, arriving at its exit back to `from`. */
  travel: (to: AreaId, from: AreaId, arrive: Crossing) => void;
  /** Builds an area's map ahead of a crossing, so the rebuild behind the clouds finds it made. */
  warm: (to: AreaId) => void;
  /** In an area's map, in dev mode: the free camera over the whole map; off, it holds on the hero. */
  freeCamera: (on: boolean) => void;
  /** In a talk: the next page, or the end of it. */
  next: () => void;
  /** At a bonfire just rested at: sit by it, the camera drawn in, or stand again; sitting gives the bonfire's name. */
  sit: (on: boolean) => string | null;
  /** The sack open over `cover` of the screen's width from the right: the camera in close on the captain in what is left. 0 when shut. */
  look: (cover: number) => void;
  /** Sat at a bonfire: the levels bought, the gold the next one costs, the gold carried and the numbers they raise. */
  levels: () => LevelView;
  /** Sat at a bonfire: buy a level in `stat`, if the gold is there. */
  levelUp: (stat: keyof Levels) => boolean;
  /** After the prologue: the gifts on offer, as the sack shows a good. */
  gifts: () => SackItem[];
  /** After the prologue: the class, the gift and the name picked, kept for the run; the hero dressed and numbered for them. */
  begin: (cls: HeroClass, gift: ItemName, name: string) => void;
  /** After the prologue: open on the whole area, hold, then fly in to the hero; play starts when it lands. */
  intro: (hold: number, fly: number, done: () => void) => void;
  /** In a menu with someone who hires out: pick an option, as E on it would. */
  choose: (i: number) => void;
  /** In a menu: mark an option picked without choosing it, as the pointer over it does. */
  hover: (i: number) => void;
  /** In a menu: out of the goods to the menu, or out of the menu. */
  back: () => void;
  /** Stop the scene while another game (the bonfire map) runs on the page, or go on; that game swaps the shared walk grid. */
  pause: (on: boolean) => void;
  /** On the atlas: fly to a land on its own tier. */
  select: (id: AreaId | null) => void;
  devState: () => DevState;
  /** Dev: their talk, or their menu if they have one, wherever the hero stands; the free camera flies to them. */
  devTalk: (npcId: string) => void;
  /** Dev: the free camera, on, flown in on a cell at the play zoom, over `ms` (900 by default). */
  devLook: (col: number, row: number, ms?: number) => void;
  /** Dev: writes the save and the live scene. */
  devSet: (patch: DevPatch) => void;
  /** Dev: the hero set down on the open cell nearest one, in play. */
  devPut: (col: number, row: number) => void;
  /** Dev: the hero rested at this area's bonfire nearest them, as E there would. */
  devRest: () => void;
  /** Dev: the hero killed where they stand. */
  devKill: () => void;
  /** Dev: the Lane House notices, wherever the hero stands. */
  devBoard: () => void;
}

export interface DevPatch {
  gold?: number;
  flags?: WorldFlag[];
  keys?: string[];
  slain?: string[];
  god?: boolean;
  heal?: true;
  flasks?: number;
  levels?: Levels;
}

export interface DevNpc {
  id: string;
  name: string;
  col: number;
  row: number;
  shop: boolean;
  here: boolean;
}
export interface DevExit {
  name: string;
  to: AreaId;
  col: number;
  row: number;
  barred: boolean;
}
export interface DevState {
  area: AreaId;
  hero: { col: number; row: number } | null;
  district: string | null;
  gold: number;
  flags: WorldFlag[];
  keys: string[];
  slain: string[];
  /** "area:col,row" */
  kindled: string[];
  heard: string[];
  /** The folk standing on this area's map. */
  npcs: DevNpc[];
  exits: DevExit[];
  /** This area's bonfires, bosses and notes. */
  spots: { kind: "fire" | "boss" | "note"; name: string; col: number; row: number }[];
  free: boolean;
  god: boolean;
  flasks: number;
  levels: Levels;
  cls: HeroClass;
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
  /** The hero's health and embers carried across a crossing; a rest or a reload starts whole. */
  carry?: { hp: number; flasks: number; band: number[] };
  /** Dev mode: the tools, on the dev route only. */
  dev?: boolean;
  /** Asks the page to travel through an exit to another area. */
  onExit?: (exit: Departure) => void;
  /** Asks the page to show an area's card, or with null (a click on no land) to close it. */
  onArea: (id: AreaId | null) => void;
  /** Tells the page which tier is in view, after a lift or a tab. */
  onTier: (id: TierId) => void;
  /** The share of the screen's width a panel covers at the left: the camera centres what it flies to in the rest. */
  inset?: () => number;
  ready: (api: AtlasApi) => void;
  /** Once the clouds have parted and the map is in view. */
  opened?: () => void;
  /** A page of a talk to show, or null when it ends. */
  onSay?: (say: Say | null) => void;
  /** The menu of someone who hires out, or null when it closes. */
  onMenu?: (menu: MenuView | null) => void;
  /** The Lane House notices, or null when they close. */
  onBoard?: (board: BoardView | null) => void;
  /** The goods bought and kept, and the captain's numbers with them: the sack. */
  onSack?: (sack: SackView) => void;
  /** What E would do where the captain stands, other than swing: talk, or rest at a bonfire. */
  onNear?: (action: string | null) => void;
  /** The embers left. */
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
  /** A word across the screen in gold, on the area name's banner: a bonfire lit, a boss fallen, a thing gained. */
  onHerald?: (text: string) => void;
  /** A boss's first meeting playing out: the screen's black bars in, or out. */
  onCinema?: (on: boolean) => void;
  /** Dev mode toggled, or the dev state changed. */
  onDev?: (s: DevState) => void;
}

export interface Say {
  name: string;
  text: string;
  /** A note on the ground, read off its paper, not spoken. */
  note?: boolean;
  /** More pages follow. */
  more: boolean;
}

/** A good's picture in a menu: the top left of its 32 px cell in the icon sheet. */
export interface ShopIcon {
  x: number;
  y: number;
}

/** One of the captain's numbers in words: `after`, what a good would make it. */
export interface StatLine {
  label: string;
  now: string;
  after?: string;
}

/** One good in the captain's sack. */
export interface SackItem<L extends string = ItemName> {
  label: L;
  icon: ShopIcon;
  gives: string;
  /** How many are carried, drawn on the icon; a good kept for good has none. */
  count?: number;
  /** One line of what it is, after a Souls item's description. */
  about?: string;
}

/** The sack: the goods kept, and every number of the captain's. */
export interface SackView {
  /** What the captain was called at the start; an old save's has none. */
  name: string | null;
  items: SackItem<ItemName | LootName>[];
  stats: (StatLine & { key: keyof Kit })[];
  level: number;
}

/** After the Souls games' merchants: a name over a short list, one option picked; a good says what it gives. */
/** The Lane House notices: each note, and whether its foes have fallen and its gold been taken. */
export interface BoardView {
  name: string;
  notes: { title: string; from: string; text: string; reward: number; state: "up" | "fallen" | "paid" }[];
  pick: number;
  gold: number;
}

export interface MenuView {
  name: string;
  role: string;
  /** What they called out as the captain came near. */
  greet: string;
  options: { label: string; note?: string; icon?: ShopIcon; gives?: string; sold?: boolean; about?: string; afford?: boolean; change?: StatLine[]; held?: string }[];
  pick: number;
  /** Gold carried. */
  gold: number;
  /** A merchant's goods, opened from Shop: drawn as cards rather than a list. */
  shop?: boolean;
  /** The captain's trade goods this merchant buys, opened from Sell: the goods' cards, priced as an offer. */
  sell?: boolean;
}

export interface Vitals {
  hp: number;
  max: number;
  stamina: number;
  staminaMax: number;
}

export interface LevelView {
  levels: Levels;
  cost: number;
  gold: number;
  /** The captain's numbers, the embers with those the bosses gave. */
  kit: Kit;
  /** The numbers the captain would have at `levels`. */
  with: (levels: Levels) => Kit;
  /** The class's attributes at a new game, under the levels bought. */
  start: Levels;
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
  hornTotem: { file: "Enemy Pack/Extra/Skull decorations/Skull Spike_02.png", frame: 64, frameH: 128, anchor: 94 / 128 },
  bones: { file: "Enemy Pack/Extra/Skull decorations/Bones_02.png", frame: 64, anchor: 0.7 },
  deadTree: { file: "Enemy Pack/Extra/Dead Tree/Dead Tree.png", frame: 384, frameH: 320, anchor: 314 / 320, scale: 0.6 },
  trollDead: { file: "Enemy Pack/Extra/Troll Dead/Troll_Dead.png", frame: 384, anchor: 0.77 },
  goldMine: { file: "Resources/Gold Mine/GoldMine_Active.png", frame: 192, frameH: 128, anchor: 0.9, scale: 0.9 },
  goldStone: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 4_Highlight.png", frame: 128, anchor: 0.75, scale: 0.6 },
  // A heap's pieces, smallest first: scenery, not gold to pick up.
  ore1: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 1_Highlight.png", frame: 128, anchor: 0.75 },
  ore2: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 2_Highlight.png", frame: 128, anchor: 0.75 },
  ore3: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 3_Highlight.png", frame: 128, anchor: 0.75 },
  ore4: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 4_Highlight.png", frame: 128, anchor: 0.75 },
  ore5: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 5_Highlight.png", frame: 128, anchor: 0.75 },
  ore6: { file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 6_Highlight.png", frame: 128, anchor: 0.75 },
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
  hornTotem: { w: 28, dx: 3 },
  deadTree: { w: 85, dx: 23.5 },
  trollDead: { w: 140, dx: 2 },
  goldMine: { w: 163, dx: 0.5 },
  cannon: { w: 42, dx: 0 },
  cannonSide: { w: 44, dx: 4 },
  watchtower: { w: 42, dx: -2 },
  woodPile: { w: 47, dx: 0.5 },
  logPile: { w: 80, dx: 0 },
  logStack: { w: 200, dx: 0 },
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
  /** A boss's sheets for drawing back before a move and coming out of it, if the pack has them. */
  windup?: string;
  recovery?: string;
}
const EP = "Enemy Pack/";
const BEAST: Record<string, Beast> = {
  torch: { idle: `${EP}Torch Goblin/Torch Goblin_Idle.png`, move: `${EP}Torch Goblin/Torch Goblin_Run.png`, attack: `${EP}Torch Goblin/Torch Goblin_Attack.png`, hit: 2, frame: 192, anchor: 132 / 192 },
  spear: { idle: `${EP}Spear Goblin/Spear Goblin_Idle.png`, move: `${EP}Spear Goblin/Spear Goblin_Run.png`, attack: `${EP}Spear Goblin/Spear Goblin_Attack Fast.png`, hit: 5, frame: 256, anchor: 174 / 256 },
  thief: { idle: `${EP}Thief/Thief_Idle.png`, move: `${EP}Thief/Thief_Run.png`, attack: `${EP}Thief/Thief_Attack.png`, frame: 192, anchor: 131 / 192 },
  gnoll: { idle: `${EP}Gnoll/Gnoll_Idle.png`, move: `${EP}Gnoll/Gnoll_Walk.png`, attack: `${EP}Gnoll/Gnoll_Throw.png`, frame: 192, anchor: 133 / 192 },
  // The Ember Hollow's bull, scorched by the wood it lies in.
  minotaur: { idle: `${EP}Minotaur/Minotaur_Idle.png`, move: `${EP}Minotaur/Minotaur_Walk.png`, attack: `${EP}Minotaur/Minotaur_Attack.png`, frame: 320, anchor: 213 / 320, scale: 1.2, tint: 0xe8a080 },
  // The Bull's Wall's boss: a goblin chief on a war boar, big, its hide iron-dark.
  rampartBull: { idle: `${EP}Extra/Pig Rider Spear Goblin/Pig Rider_Idle.png`, move: `${EP}Extra/Pig Rider Spear Goblin/Pig Rider_Run.png`, attack: `${EP}Extra/Pig Rider Spear Goblin/Pig Rider_Attack.png`, frame: 256, anchor: 0.7, scale: 1.5, tint: 0xc8b0a0 },
  troll: { idle: `${EP}Troll/Troll_Idle.png`, move: `${EP}Troll/Troll_Walk.png`, attack: `${EP}Troll/Troll_Attack.png`, windup: `${EP}Troll/Troll_Windup.png`, recovery: `${EP}Troll/Troll_Recovery.png`, frame: 384, anchor: 296 / 384, scale: 0.8 },
  // The Belfry's boss: the giant bat's sheets in stone, a gargoyle off the bell loft's eaves.
  stoneWarden: { idle: `${EP}Giant Bat/Giant Bat_Idle.png`, move: `${EP}Giant Bat/Giant Bat_Move.png`, attack: `${EP}Giant Bat/Giant Bat_Attack.png`, frame: 192, anchor: 0.7, scale: 2, tint: 0xa8acb4 },
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
  // The late bosses on the sheets they share with the rank and file, set apart by size and colour.
  // The King's Barrow's boss: the hex shaman's sheets, a dead king grown huge, bone-pale.
  barrowKing: { idle: `${EP}Hex Shaman/Hex Shaman_Idle.png`, move: `${EP}Hex Shaman/Hex Shaman_Run.png`, attack: `${EP}Hex Shaman/Hex Shaman_Attack.png`, frame: 192, anchor: 136 / 192, scale: 2.2, tint: 0xd8d0b8 },
  // The grave totems warding the king: the skull guard's statue, ghost-green.
  graveTotem: { idle: `${EP}Extra/Skull Guard/Skull_Guard.png`, frame: 192, anchor: 128 / 192, scale: 1.1, tint: 0x8cf0b4 },
  weaver: { idle: `${EP}Spider/Spider_Idle.png`, move: `${EP}Spider/Spider_Run.png`, attack: `${EP}Spider/Spider_Attack.png`, frame: 192, anchor: 0.68, tint: 0xe4dccb },
  // The Shell Below draws into its shell before each move, and comes out of it after.
  shellBelow: { idle: `${EP}Turtle/Turtle_Idle.png`, move: `${EP}Turtle/Turtle_Walk.png`, attack: `${EP}Turtle/Turtle_Attack.png`, windup: `${EP}Extra/Turtle Guard/Turtle_Guard_In.png`, recovery: `${EP}Extra/Turtle Guard/Turtle_Guard_Out.png`, frame: 320, anchor: 0.66, scale: 1.8, tint: 0x9cc0b0 },
  // Old Bamboo, the pandas' grandsire, and the cubs he calls.
  oldBamboo: { idle: `${EP}Panda/Panda_Idle.png`, move: `${EP}Panda/Panda_Run.png`, attack: `${EP}Panda/Panda_Attack.png`, frame: 256, anchor: 0.68, scale: 1.9, tint: 0xe8e0d0 },
  pandaCub: { idle: `${EP}Panda/Panda_Idle.png`, move: `${EP}Panda/Panda_Run.png`, attack: `${EP}Panda/Panda_Attack.png`, frame: 256, anchor: 0.68, scale: 0.6 },
  // The Warden's mate, smaller, the same stone.
  gargoyle: { idle: `${EP}Giant Bat/Giant Bat_Idle.png`, move: `${EP}Giant Bat/Giant Bat_Move.png`, attack: `${EP}Giant Bat/Giant Bat_Attack.png`, frame: 192, anchor: 0.7, scale: 1.3, tint: 0x989ca4 },
  // The Rampart Boar's chief, thrown: a spear goblin, big, in the boar's iron-dark.
  boarChief: { idle: `${EP}Spear Goblin/Spear Goblin_Idle.png`, move: `${EP}Spear Goblin/Spear Goblin_Run.png`, attack: `${EP}Spear Goblin/Spear Goblin_Attack Fast.png`, hit: 5, frame: 256, anchor: 174 / 256, scale: 1.3, tint: 0xc8b0a0 },
  // The Sun Sentinel: the yellow guard's lancer grown huge, standing behind its shield.
  sunSentinel: { idle: "Units/Yellow Units/Lancer/Lancer_Right_Defence.png", move: "Units/Yellow Units/Lancer/Lancer_Run.png", attack: "Units/Yellow Units/Lancer/Lancer_Right_Attack.png", frame: 320, anchor: 0.62, scale: 1.7, tint: 0xfff0b0 },
  // The Warlord keeps his colour, warm gold, where his taken have gone grey.
  warlord: { idle: "Units/Black Units/Warrior/Warrior_Idle.png", move: "Units/Black Units/Warrior/Warrior_Run.png", attack: "Units/Black Units/Warrior/Warrior_Attack1.png", frame: 192, anchor: 136 / 192, scale: 1.5, tint: 0xf0d890 },
  taken: { idle: "Units/Black Units/Warrior/Warrior_Idle.png", move: "Units/Black Units/Warrior/Warrior_Run.png", attack: "Units/Black Units/Warrior/Warrior_Attack1.png", frame: 192, anchor: 136 / 192, tint: 0x9c9fa8 },
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
/** A knight at drill (`act: "drill"`) idles at its post and, at each muster, walks to its spot to practise this blow. */
const DRILL: Partial<Record<string, string>> = { warrior: "Warrior/Warrior_Attack1.png", lancer: "Lancer/Lancer_Right_Attack.png", archer: "Archer/Archer_Shoot.png" };
/** How often the drill is called, and how long it runs, in ms. */
const DRILL_EVERY = 30000;
const DRILL_FOR = 10000;
/** A block of logs `wide` across and `high` rows up, all lying one way, each row laid square on the one below: px off its
 *  foot, in the order they go on, so it fills a row at a time from the ground up. */
const logBlock = (wide: number, high: number, across: number, up: number): readonly [number, number][] =>
  Array.from({ length: wide * high }, (_, n) => [((n % wide) - (wide - 1) / 2) * across, -Math.floor(n / wide) * up]);
/** The cabins' piles, three by two, and the woodyard's stack, five by three. */
const LOGS: Record<string, readonly [number, number][]> = { logPile: logBlock(3, 2, 29, 17), logStack: logBlock(5, 3, 34, 20) };
/** How large each pile's logs are drawn. */
const LOG_SCALE: Record<string, number> = { logPile: 0.85, logStack: 1 };

/** A pile of logs as it stands: its tile, its logs, and how many of them are stacked. */
interface LogPile {
  at: Cell;
  logs: Phaser.GameObjects.Image[];
  n: number;
  stack: boolean;
}

/** A unit sheet: its texture key and its file under the pack. */
type Art = { key: string; file: string };

/** A pawn at work: what it plays standing, and walking; a woodcutter also chops at the far end and hauls back. */
const PAWN_ACT: Record<string, { idle: string; move?: string; work?: string; haul?: string; inside?: boolean }> = {
  axe: { idle: "Pawn/Pawn_Idle Axe.png", move: "Pawn/Pawn_Run Axe.png" },
  carry: { idle: "Pawn/Pawn_Idle.png", move: "Pawn/Pawn_Run.png", work: "Pawn/Pawn_Idle Wood.png", haul: "Pawn/Pawn_Run Wood.png" },
  fell: { idle: "Pawn/Pawn_Idle.png", move: "Pawn/Pawn_Run Axe.png", work: "Pawn/Pawn_Interact Axe.png", haul: "Pawn/Pawn_Run Wood.png" },
  pickaxe: { idle: "Pawn/Pawn_Interact Pickaxe.png" },
  // A digger into its mine and out with the gold; a carrier out to the stockpile, loading, and back with it.
  dig: { idle: "Pawn/Pawn_Idle Pickaxe.png", move: "Pawn/Pawn_Run Pickaxe.png", work: "Pawn/Pawn_Interact Pickaxe.png", haul: "Pawn/Pawn_Run Gold.png", inside: true },
  fetch: { idle: "Pawn/Pawn_Idle.png", move: "Pawn/Pawn_Run.png", work: "Pawn/Pawn_Idle Gold.png", haul: "Pawn/Pawn_Run Gold.png" },
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
/** How far past its grid the Underneath's rock runs, in tiles, lake and mood alike, so no zoom out sees its edge. */
const ROCK_PAD = 128;

/** An area map's view in play: this many rows tall, held on the hero. */
const AREA_ROWS = 15;
/** The captain, drawn from the knights' sheets, by class. */
const HERO_ART: Record<HeroClass, { look: Dweller; attack: { key: string; file: string }; attack2: { key: string; file: string }; guard?: { key: string; file: string }; tint?: number }> = {
  warrior: {
    look: { kind: "warrior", col: 0, row: 0, color: "blue" },
    attack: { key: "blue_Warrior/Warrior_Attack1.png", file: "Units/Blue Units/Warrior/Warrior_Attack1.png" },
    attack2: { key: "blue_Warrior/Warrior_Attack2.png", file: "Units/Blue Units/Warrior/Warrior_Attack2.png" },
    guard: { key: "blue_Warrior/Warrior_Guard.png", file: "Units/Blue Units/Warrior/Warrior_Guard.png" },
  },
  // The other folk from the monsters' sheets, washed blue so the captain is never taken for one of the foes beside it.
  eggwarden: {
    look: { kind: "lizard", col: 0, row: 0 },
    attack: { key: "beast_lizard_attack", file: BEAST.lizard!.attack! },
    attack2: { key: "beast_lizard_attack", file: BEAST.lizard!.attack! },
    tint: 0xb4c8ff,
  },
  champion: {
    look: { kind: "minotaur", col: 0, row: 0 },
    attack: { key: "beast_minotaur_attack", file: BEAST.minotaur!.attack! },
    attack2: { key: "beast_minotaur_attack", file: BEAST.minotaur!.attack! },
    tint: 0xb4c8ff,
  },
  grovekeeper: {
    look: { kind: "panda", col: 0, row: 0 },
    attack: { key: "beast_pandaCub_attack", file: BEAST.pandaCub!.attack! },
    attack2: { key: "beast_pandaCub_attack", file: BEAST.pandaCub!.attack! },
    guard: { key: "beast_pandaGuard_idle", file: BEAST.pandaGuard!.idle },
    tint: 0xb4c8ff,
  },
  barrowWarden: {
    look: { kind: "shaman", col: 0, row: 0 },
    attack: { key: "beast_shaman_attack", file: BEAST.shaman!.attack! },
    attack2: { key: "beast_shaman_attack", file: BEAST.shaman!.attack! },
    tint: 0xb4c8ff,
  },
};
/** How long a hex holds its mark, in ms: the Skirmish Hex Shaman's 1.5 s. */
const HEX_HOLD = 1500;
/** The Monk's healing swirl, green for a monk's mending and tinted amber for an ember burned. */
const HEAL_FX = { key: "healFx", file: "Units/Blue Units/Monk/Heal_Effect.png" };
/** An ember rising off the hero: the Ember Shard's stone, cropped and tinted the same. */
const EMBER_ICON = { key: "emberIcon", file: "Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png" };

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
  windup: { at: number; mark: Body; move?: string; aim?: Cell[]; dazed?: boolean } | null;
  /** A boss's last blow, so it does not repeat one at range. */
  last?: string;
  /** Until when a boss stands open after a blow: a stone one is hurt in full only then. */
  open?: number;
  /** The boss that raised it, which raises no more while its cap of them stands. */
  raisedBy?: Foe;
  /** A boss past its rage line has turned to its second phase; until `turning`, it takes no harm. */
  turned?: boolean;
  turning?: number;
  /** Asleep at its post, until struck. */
  asleep?: Phaser.Time.TimerEvent;
  /** Sitting to eat: until when, and health a second. */
  feeding?: { until: number; rate: number };
}
/** Ground left burning by a boss's blow (the troll's embers, the king's grave fire): it hurts whoever stands in it
 *  every `every` ms until it dies down. */
interface Ember {
  at: Cell;
  until: number;
  tick: number;
  every: number;
  damage: number;
  /** A web: whoever stands in it walks at this share of their pace. */
  snare?: number;
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
  monk: { key: "blue_Monk/Heal.png", file: "Units/Blue Units/Monk/Heal.png" },
};
const COMPANION_NAME: Record<CompanionKind, string> = { lancer: "Lancer", archer: "Archer", monk: "Monk" };
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
function sackItem(item: ItemName): SackItem {
  return { label: item, icon: ITEM_ICON[item], gives: gives(item), about: ITEMS[item].about };
}
/** What a good does to the captain's numbers, in words. */
function gives(item: ItemName): string {
  const words: Record<keyof Kit, (n: number) => string> = {
    hp: (n) => `+${n} max health`,
    attack: (n) => `+${n} attack`,
    flasks: (n) => `+${n} ember`,
    flask: (n) => `+${n} healing per ember`,
    block: (n) => `Blocking costs ${Math.round((-n / STAMINA.block) * 100)}% less stamina`,
    greed: (n) => `+${Math.round(n * 100)}% gold from kills`,
    stamina: (n) => `+${n} stamina`,
    swing: (n) => `Swings ${Math.round(-n * 100)}% quicker`,
    roll: (n) => `Rolling costs ${-n} less stamina`,
    find: (n) => `+${Math.round(n * 100)}% trade goods from kills`,
  };
  return (Object.entries(ITEMS[item].adds) as [keyof Kit, number][]).map(([stat, n]) => words[stat](n)).join(", ");
}
/** Each of the captain's numbers, named and in words, as the sack and a good's card show it. */
const STATS: Record<keyof Kit, { label: string; words: (n: number) => string }> = {
  hp: { label: "Health", words: String },
  attack: { label: "Attack", words: String },
  flasks: { label: "Embers", words: String },
  flask: { label: "Ember heal", words: String },
  block: { label: "Block cost", words: (n) => `${Math.round((n / STAMINA.block) * 100)}%` },
  greed: { label: "Gold from kills", words: (n) => `${Math.round(n * 100)}%` },
  stamina: { label: "Stamina", words: String },
  swing: { label: "Swing wait", words: (n) => `${Math.round(n * 100)}%` },
  roll: { label: "Roll cost", words: String },
  find: { label: "Trade goods", words: (n) => `${Math.round(n * 100)}%` },
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
  tag: Phaser.GameObjects.Text;
  /** Walking the captain somewhere: not to be talked to, nor turned to face them. */
  leading?: boolean;
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
/** The bonfire last rested at; none yet, and the captain wakes at the Landing's entry, by the boat. */
function restPoint(): { area: AreaId; col: number; row: number } | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST) ?? "null") as { area: AreaId; col: number; row: number } | null;
    if (r && areaMap(r.area).fires.some((f) => f.col === r.col && f.row === r.row)) return r;
  } catch {}
  return null;
}
/** Gold carried, the gold stones already taken, and the gold left where the captain last died: kept on this browser. */
const GOLD = "greyfall.gold";
/** Each notice's foes felled so far, or "paid" once its gold is taken. */
const NOTICED = "greyfall.notices";
const noticed = (): Record<string, number | "paid"> => stored(NOTICED, {});
const noticeState = (count: number, v: number | "paid" | undefined): "up" | "fallen" | "paid" => (v === "paid" ? "paid" : (v ?? 0) >= count ? "fallen" : "up");
/** Bosses slain, which never come back, and the keys they drop, by the boss's kind. */
const SLAIN = "greyfall.slain";
const KEYS = "greyfall.keys";
/** Bosses met, whose first-meeting scene has played; it plays once, as in the Souls games. */
const MET = "greyfall.met";
const BOSS_KEY: Partial<Record<string, string>> = { minotaur: "Ember Key", barrowKing: "Horned Key", weaver: "Silk Key", sunSentinel: "Sun Key" };
/** What a boss's fall proves, raised from SLAIN on each entry so old saves have it too. */
const BOSS_FLAG: Partial<Record<string, WorldFlag>> = { minotaur: "trollKey", barrowKing: "hornedKey", warlord: "warlordDead", shellBelow: "shellDead", oldBamboo: "bambooDead" };
const BOSSES = new Set(["troll", "minotaur", "rampartBull", "stoneWarden", "barrowKing", "weaver", "shellBelow", "warlord", "oldBamboo", "sunSentinel"]);
/** The exit last gone through, so a crossing lands at the way of the same name when two ways join the same areas. */
const VIA = "greyfall.via";
/** A boss's turn to its second phase: the colour the room flashes, and the words across the screen. */
const TURN: Partial<Record<string, { colour: number; herald: string }>> = {
  minotaur: { colour: 0xff6a2a, herald: "The Ash Takes Fire" },
  rampartBull: { colour: 0xc8b0a0, herald: "The Chief Is Thrown" },
  stoneWarden: { colour: 0xa8acb4, herald: "Its Mate Wakes" },
  barrowKing: { colour: 0x8cf0b4, herald: "The Dirge Begins" },
  weaver: { colour: 0xf0ece0, herald: "The Web Closes" },
  shellBelow: { colour: 0x6ab0c8, herald: "The Isle Shakes" },
  warlord: { colour: 0x9c9fa8, herald: "The Crown Drinks Deep" },
  oldBamboo: { colour: 0x8cd080, herald: "The Cubs Come Back" },
  sunSentinel: { colour: 0xffe080, herald: "The Shield Is Cast Down" },
};
/** Stone the Belfry's bell dazes when struck. */
const STONE: ReadonlySet<string> = new Set(["stoneWarden", "gargoyle"]);
/** A boss whose fall is worth an ember more, for good: the Landing's troll, the reward for going back to him. */
const BOSS_FLASK: ReadonlySet<string> = new Set(["troll"]);
/** A hit flash over: back to the sprite's own colour, its base tint if it has one. */
function untint(s: Phaser.GameObjects.Sprite): void {
  const tint = s.getData("tint") as number | undefined;
  if (tint) s.setTint(tint);
  else s.clearTint();
}
/** The class picked at the start; a save from before the pick is a Warrior. */
const CLASS = "greyfall.class";
/** What the captain was called at the start. Not `greyfall.name`, the duel's name, which a new game keeps. */
const NAME = "greyfall.hero";
function heroClass(): HeroClass {
  // A class since taken out of the pick comes back as a Warrior.
  const cls = stored<HeroClass>(CLASS, "warrior");
  return cls in CLASSES ? cls : "warrior";
}
/** The captain's numbers from the class, the goods owned and the levels bought. */
function gearNow(): Kit {
  return kit(remembered(BOUGHT), levels(), heroClass());
}
function levels(): Levels {
  return savedLevels(stored<Record<string, unknown>>(LEVELS, {}));
}
/** Embers carried at full: the base and the shards bought, and one for each boss that gives one. */
function maxFlasks(): number {
  return gearNow().flasks + bossFlasks();
}
function bossFlasks(): number {
  return [...remembered(SLAIN)].filter((k) => BOSS_FLASK.has(k)).length;
}
/** One of the captain's numbers in words, with `gear`: the embers with those the bosses gave. */
function statWords(k: keyof Kit, gear: Kit): string {
  return STATS[k].words(k === "flasks" ? gear.flasks + bossFlasks() : gear[k]);
}
/** A way out shut until its guarding boss falls, or the captain has already rested on the far side; or a shortcut not
 *  yet opened from the far side. */
/** The keys a locked way still wants, by the names they carry. */
function missingKeys(e: Exit): string[] {
  const keys = remembered(KEYS);
  return (e.keys ?? []).filter((k) => !keys.has(k)).map((k) => BOSS_KEY[k] ?? "key");
}
function barred(e: Exit): boolean {
  if (e.shut && !remembered(FLAGS).has(e.shut)) return true;
  if (missingKeys(e).length) return true;
  return !!e.guard && !remembered(SLAIN).has(e.guard) && ![...remembered(KINDLED)].some((k) => k.startsWith(`${e.to}:`));
}
const TAKEN = "greyfall.taken";
const LOST = "greyfall.lost";
const LEVELS = "greyfall.levels";
/** Trade goods carried, by count. */
const HELD = "greyfall.loot";
const held = (): Partial<Record<LootName, number>> => stored(HELD, {});
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
/** Goods thrown down by the folk and not picked up yet, kept on this browser so they wait there. */
const THROWN = "greyfall.thrown";
type Thrown = { item: ItemName; area: AreaId; col: number; row: number };
/** Goods that changed their name, old to new, so a save from before keeps them. */
const RENAMED: Record<string, ItemName> = { "Brine Flask": "Tinder Tin", "Salt-Glass Flask": "Salt-Glass Lantern" };
function renameGoods(): void {
  const bought = remembered(BOUGHT);
  if ([...bought].some((i) => i in RENAMED)) remember(BOUGHT, new Set([...bought].map((i) => RENAMED[i] ?? i)));
  const thrown = stored<Thrown[]>(THROWN, []);
  if (thrown.some((t) => t.item in RENAMED)) store(THROWN, thrown.map((t) => ({ ...t, item: RENAMED[t.item] ?? t.item })));
}
/** Gold on the ground: a monster's drop, a gold stone, or the gold left at the last death; or a good thrown down. */
interface Pile {
  at: Cell;
  gold: number;
  item?: ItemName;
  /** A trade good, taken only with E. */
  loot?: LootName;
  /** The kind of the boss whose key this is. */
  key?: string;
  s: Phaser.GameObjects.Image;
  stone?: string;
  lost?: boolean;
  /** A stone's glow in the dark of the Underneath. */
  shine?: Phaser.GameObjects.Image;
}
const FLAGS = "greyfall.flags";
const npcLook = (n: Npc): Dweller => ({ kind: n.kind, col: n.at.col, row: n.at.row, color: n.kind === "gnome" || n.kind === "torch" ? undefined : (n.color ?? "blue"), act: n.act });
/**
 * Each underground map lit its own way: the rock's own dark, how much the open floor shows unlit, the colour its
 * lights cast. The Undercroft is torchlit masonry, the Deeps the darkest and lit ghost-green, the Hollow the
 * brightest, a vast cave in pale blue where the gold glows far.
 */
const UNDER: Partial<Record<AreaId, { rock: number; ambient: number; glow: number; gold: number }>> = {
  undercroft: { rock: 0x221a16, ambient: 0.16, glow: 0xffc890, gold: 4 },
  deeps: { rock: 0x0e1214, ambient: 0.1, glow: 0x9cdcb4, gold: 4 },
  hollow: { rock: 0x16202e, ambient: 0.42, glow: 0xb4e0ff, gold: 8 },
  // The tutorial's sea cave: dark, in plain cool light, no warm cast; the torches show the way.
  landing: { rock: 0x1e2226, ambient: 0.32, glow: 0xe6ecf0, gold: 4 },
  // The Ring at its end is a fight, so its floor is lit through: a dark centre hid the troll's warnings.
  ring: { rock: 0x1e2226, ambient: 0.75, glow: 0xe6ecf0, gold: 4 },
};

/** A land above ground kept at dusk, in the same light the underground keeps: dim, but for its fires. */
const DUSK: Partial<Record<AreaId, { rock: number; ambient: number; glow: number; gold: number; reach: number }>> = {
  // Under the canopy the light goes blue and low; the goblins' fires show the way in small pools of near-white, so the
  // wood keeps its greens rather than going all to amber.
  emberwood: { rock: 0x2c3654, ambient: 0.64, glow: 0xfff0dc, gold: 3, reach: 0.65 },
};

type Exit = AreaMap["exits"][number];
type Lock = NonNullable<AreaMap["locks"]>[number];

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
  private live: Tracked[] = [];
  /** The unlit bonfires of this area, by `area:col,row`, each with what lights it. */
  private unlit = new Map<string, () => void>();
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  /** In an area's own map: that map. */
  private local: AreaMap | null = null;
  private built = new Set<TierId>();
  /** In an area's map: the hero, where it rises again, what it is walking to or fighting, the monsters. */
  private hero: Body | null = null;
  /** The right button held in play: the shield up, as F. */
  private shieldUp = false;
  private keys: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key> | null = null;
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
  /** The posts barring each locked way, taken down when a shortcut is unbarred. */
  private lockPosts: { lock: Lock; s: Phaser.GameObjects.Image }[] = [];
  /** The light each torch goblin carries at dusk, kept on it. */
  private torchGlows: { s: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Image }[] = [];
  /** What no one walks through: buildings, heaps, fence posts, and the rocks and stumps standing in open ground. */
  private solid = new Set<string>();
  /** The solid tiles that are a prop's or a rock's: the hero's feet meet the art's base there, not the whole tile. */
  private boxed = new Set<string>();
  private bases: Box[] = [];
  /** The townsfolk and creatures afoot, who block the hero where they stand. */
  private walkers: Phaser.GameObjects.Sprite[] = [];
  private logPiles: LogPile[] = [];
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
  /** The Ring's troll, overhead until the hero reaches the middle. */
  private aloft: Dweller | null = null;
  /** The ring a warmth-drinking crown draws round its boss, and when the next wisp leaves the hero for it. */
  private aura?: Phaser.GameObjects.Ellipse;
  private wisped = 0;
  /** When the Belfry's bell may ring again. */
  private tolled = 0;
  private embers: Ember[] = [];
  /** Notes on the ground here, and the one being read. */
  private notes: Note[] = [];
  private reading: Note | null = null;
  private folk: Folk[] = [];
  /** Ground walked since the last footstep sounded. */
  private stepped = 0;
  /** Till when the drill ground's clash of blades is already sounding. */
  private drillUntil = 0;
  /** Stops the bonfire's crackle, while the captain sits by one. */
  private crackle: (() => void) | null = null;
  /** Ground the Ring's troll has walked since his last footfall sounded. */
  private trollStepped = 0;
  /** Stops the boss music, while a boss's bar is up. */
  private bossTune: (() => void) | null = null;
  /** A boss's first meeting playing out: the camera is the scene's, and no boss bar shows. */
  private cinema = false;
  /** MET, read once an area is entered. */
  private met = new Set<string>();
  private talk: { folk: Folk; lines: readonly string[]; key: string; sets?: WorldFlag; gives?: ItemName; throws?: ItemName; lights?: boolean; page: number } | null = null;
  /** The flags as the area was entered: who stands where, and what they say, holds until the captain leaves and comes back. */
  private seen = new Set<WorldFlag>();
  private nearName: string | null = null;
  /** Open with someone who hires out: Talk, Hire, Leave. */
  /** `shopping`: a merchant's goods are open, picked from the menu's Shop. */
  private menu: { folk: Folk; pick: number; shopping?: boolean; selling?: boolean } | null = null;
  private board: { pick: number } | null = null;
  /** The camera in close: at a bonfire, or on a merchant through their menu and the talks it opens. */
  private close: "fire" | "folk" | null = null;
  /** The share of the screen the open sack covers, 0 when shut. */
  private sackCover = 0;
  private seaTook: ItemName[] = [];
  private flasks: number = HERO.flasks;
  private cls: HeroClass = "warrior";
  /** The captain's numbers with the goods bought. */
  private gear: Kit = kit(new Set());
  private gold = 0;
  private band: Companion[] = [];
  private bandOrder: BandOrder = "follow";
  /** The monster the captain last struck: on "attack my target", the band goes for it. */
  private lastHit: Foe | null = null;
  private piles: Pile[] = [];
  /** When the banner on screen goes, so the next waits its turn. */
  private heraldUntil = 0;
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
  private free = false;
  private devGod = false;
  private devKey = "";
  private devText: Phaser.GameObjects.Text[] = [];
  /** Where the free camera (dev mode, the world map) is kept, in px: the island with a margin, or the whole atlas. */
  private freeBox: Phaser.Geom.Rectangle | null = null;

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
    this.unlit.clear();
    this.drag = null;
    this.local = null;
    this.built = new Set();
    this.hero = null;
    this.sealed = new Set();
    this.locked = new Set();
    this.lockPosts = [];
    this.torchGlows = [];
    this.solid = new Set();
    this.boxed = new Set();
    this.bases = [];
    this.walkers = [];
    this.logPiles = [];
    this.fog = [];
    this.mist = [];
    // The page keeps the last area's bar through a crossing; clear it, or a key of "" never sends the null.
    this.bossKey = "";
    this.hooks.onBoss?.(null);
    this.shieldUp = false;
    this.keys = null;
    this.foes = [];
    this.aloft = null;
    this.embers = [];
    this.notes = [];
    this.reading = null;
    this.guarding = false;
    this.queued = false;
    this.spentAt = -1e9;
    this.spaceAt = -1;
    this.roll = { until: 0, dx: 0, dy: 0, speed: 0, trail: 0, back: false };
    this.guardBroken = 0;
    this.vitalsKey = "";
    this.combo = 0;
    this.folk = [];
    this.talk = null;
    this.crackle?.();
    this.crackle = null;
    this.bossTune?.();
    this.bossTune = null;
    this.cinema = false;
    this.hooks.onCinema?.(false);
    this.nearName = null;
    this.menu = null;
    this.board = null;
    this.close = null;
    this.sackCover = 0;
    this.heard = remembered(HEARD);
    this.met = remembered(MET);
    this.flags = remembered(FLAGS);
    this.cls = heroClass();
    renameGoods();
    // Ashore anywhere past the Ring, whatever was lent on the Landing is gone: by the boat, or washed up off the troll.
    const bought = remembered<ItemName>(BOUGHT);
    this.seaTook = data.area && data.area !== "landing" && data.area !== "ring" ? LENT.filter((i) => bought.has(i)) : [];
    if (this.seaTook.length) remember(BOUGHT, new Set([...bought].filter((i) => !LENT.includes(i))));
    if (data.area && data.area !== "landing" && data.area !== "ring") store(THROWN, stored<Thrown[]>(THROWN, []).filter((t) => !LENT.includes(t.item)));
    this.gear = gearNow();
    this.stamina = this.gear.stamina;
    // What a crossing proves: down the well, the Watch Lift ridden down, the Moor Gate come through from the moor, the Greyfall reached.
    if (data.area === "undercroft") this.flag("wellDescended");
    if (data.area === "keep" && data.from === "steps") this.flag("watchLiftOpen");
    if (data.area === "harbour" && data.from === "barrowmoor") this.flag("moorGateOpen");
    if (data.area === "greyfall") this.flag("greyfallReached");
    for (const k of remembered<string>(SLAIN)) if (BOSS_FLAG[k]) this.flag(BOSS_FLAG[k]);
    this.seen = new Set(this.flags);
    this.flasks = data.carry?.flasks ?? maxFlasks();
    this.gold = stored(GOLD, 0);
    this.band = [];
    this.bandOrder = "follow";
    this.lastHit = null;
    this.piles = [];
    this.heraldUntil = 0;
    this.cover = new Set();
    this.gone = false;
    this.district = { name: "", next: "", since: 0, shown: new Set<string>() };
    this.dev = !!data.dev;
    this.free = false;
    this.devKey = "";
    this.devText = [];
    this.freeBox = null;
  }

  preload(): void {
    if (this.hooks.area) {
      // One area's map stands in for every tier; only its own is built.
      this.local = this.gated(areaMap(this.hooks.area));
      this.map = { tiers: { sky: this.local, surface: this.local, below: this.local }, areas: [...AREAS], lifts: [] };
    } else {
      const { tiers, ...m } = atlasMap();
      this.map = { ...m, tiers: { sky: this.gated(tiers.sky), surface: this.gated(tiers.surface), below: this.gated(tiers.below) } };
    }
    loadTerrain(this);
    loadGroundColours(this);
    this.load.image("tilesetRoad", packUrl("Terrain/Tileset/Tilemap_color4.png"));
    if (!this.textures.exists("note")) this.load.image("note", packUrl("ui/paper.png"));
    if (!this.textures.exists("gold")) this.load.image("gold", packUrl("Terrain/Resources/Gold/Gold Resource/Gold_Resource.png"));
    if (!this.textures.exists("icons")) this.load.spritesheet("icons", "/icons/shikashi.png", { frameWidth: 32, frameHeight: 32 });
    if (!this.textures.exists("swords")) this.load.spritesheet("swords", SWORDS, { frameWidth: 448, frameHeight: 128 });
    const sheet = (key: string, s: Sheet): void => {
      if (this.textures.exists(key)) return;
      this.load.spritesheet(key, packUrl(s.file), { frameWidth: s.frame, frameHeight: s.frameH ?? s.frame });
    };
    for (const tier of new Set(Object.values(this.map.tiers))) {
      for (const p of tier.props) {
        if (p.color) this.load.image(this.buildingKey(p), packUrl(`Buildings/${COLOR_DIR[p.color]} Buildings/${BUILDING_FILE[p.art]}`));
        else if (PROP[p.art]) sheet(`prop_${p.art}`, PROP[p.art]!);
      }
      for (const d of tier.dwellers) {
        const { idle, move, work, haul, frame } = this.look(d);
        for (const a of [idle, move, work, haul]) if (a) sheet(a.key, { file: a.file, frame, anchor: 0 });
      }
    }
    if (this.local) {
      // Every class's sheets: the pick comes after the scene is built, behind the prologue.
      for (const art of Object.values(HERO_ART)) {
        const { idle, move, frame } = this.look(art.look);
        sheet(idle.key, { file: idle.file, frame, anchor: 0 });
        if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
        for (const a of [art.attack, art.attack2, art.guard]) if (a) sheet(a.key, { file: a.file, frame, anchor: 0 });
      }
      sheet(HEAL_FX.key, { file: HEAL_FX.file, frame: 192, anchor: 0 });
      if (!this.textures.exists(EMBER_ICON.key)) this.load.image(EMBER_ICON.key, packUrl(EMBER_ICON.file));
      for (const kind of ["lancer", "archer", "monk"] as const) {
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
        for (const k of ["windup", "recovery"] as const) if (b?.[k]) sheet(`beast_${d.kind}_${k}`, { file: b[k]!, frame: b.frame, anchor: 0 });
        const turned = BOSS_KITS[d.kind]?.rage?.look;
        if (turned) {
          const { idle, move, frame } = this.look({ kind: turned, col: 0, row: 0 });
          sheet(idle.key, { file: idle.file, frame, anchor: 0 });
          if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
        }
        for (const m of Object.values(BOSS_KITS[d.kind]?.moves ?? {})) {
          if (!m.summon) continue;
          const { idle, move, frame } = this.look({ kind: m.summon.kind, col: 0, row: 0 });
          sheet(idle.key, { file: idle.file, frame, anchor: 0 });
          if (move) sheet(move.key, { file: move.file, frame, anchor: 0 });
          const b = BEAST[m.summon.kind];
          if (b?.attack) sheet(`beast_${m.summon.kind}_attack`, { file: b.attack, frame: b.frame, anchor: 0 });
        }
      }
      sheet("blast", { file: "Particle FX/Explosion_01.png", frame: 192, anchor: 0 });
    }
    for (const k of ["deadTree", "stump", "bones", "skullSpike", "goldStone", "woodPile"]) sheet(`prop_${k}`, PROP[k]!);
    for (const n of [3, 4]) sheet(`stump${n}`, { file: `Terrain/Resources/Wood/Trees/Stump ${n}.png`, frame: 192, frameH: 256, anchor: 0 });
    BIG_TREE.forEach((t, i) => sheet(`bigTree${i}`, t));
    sheet("fire", FIRE);
    sheet("kindle", { file: "Particle FX/Fire_03.png", frame: 64, anchor: 0.9 });
    if (!this.textures.exists("log")) this.load.image("log", packUrl("Terrain/Resources/Wood/Wood Resource/Wood Resource.png"));
    this.load.spritesheet("fence", packUrl(FENCE), { frameWidth: 64, frameHeight: 64 });
    // The pack's dust puffs: the fog gates are banked from their first frame, and wisps off them play the rest.
    this.load.spritesheet("fogPuff", packUrl("Particle FX/Dust_02.png"), { frameWidth: 64, frameHeight: 64 });
  }

  /** The sheets a dweller plays, keyed so a colour and a job load once. */
  private look(d: Dweller): { idle: Art; move?: Art; work?: Art; haul?: Art; frame: number; anchor: number; scale: number; fly: boolean; swim: boolean } {
    if (d.color) {
      const k = KNIGHT[d.kind]!;
      const dir = `Units/${COLOR_DIR[d.color]} Units/`;
      const act = d.kind === "pawn" && d.act ? PAWN_ACT[d.act] : undefined;
      const drill = d.act === "drill" ? DRILL[d.kind] : undefined;
      const art = (file: string): Art => ({ key: `${d.color}_${file}`, file: dir + file });
      return {
        idle: art(act?.idle ?? k.idle),
        move: art(act?.move ?? k.move),
        ...((act?.work ?? drill) && { work: art((act?.work ?? drill)!) }),
        ...(act?.haul && { haul: art(act.haul) }),
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
      // Woken from a rest or a death, beside the bonfire rested at, not on the fire itself; washed up off the troll, at the pier.
      const rest = this.hooks.arrive === "rest" && this.hooks.from !== "ring" ? restPoint() : null;
      const fire = rest?.area === local.area ? { col: rest.col, row: rest.row } : null;
      const via = stored<string>(VIA, "");
      const back = local.exits.find((e) => e.to === this.hooks.from && e.name === via) ?? local.exits.find((e) => e.to === this.hooks.from);
      const at = fire ?? back?.arrive ?? back?.at ?? local.entry;
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
      for (const item of this.seaTook) this.time.delayedCall(1200, () => this.float(this.hero!.s.x, this.hero!.s.y - this.hero!.lift - 30, `The sea took ${item}`, "#9fc8d8", 2600));
      this.hooks.onFlasks?.(this.flasks);
      this.hooks.onGold?.(this.gold);
      this.emitSack();
      stored<CompanionKind[]>(BAND, []).forEach((kind, i) => this.addCompanion(kind, this.hooks.carry?.band[i]));
      this.emitBand();
      this.fogGate();
      this.lockGates();
      if (this.hooks.dev && new URLSearchParams(window.location.search).has("walls")) this.showWalls();
      const k = this.input.keyboard;
      k?.on("keydown-ONE", () => this.command("follow"));
      k?.on("keydown-TWO", () => this.command("attack"));
      k?.on("keydown-THREE", () => this.command("hold"));
      for (const [key, d, across] of [["W", -1, false], ["UP", -1, false], ["A", -1, true], ["LEFT", -1, true], ["S", 1, false], ["DOWN", 1, false], ["D", 1, true], ["RIGHT", 1, true]] as const) k?.on(`keydown-${key}`, () => this.movePick(d, across));
      k?.on("keydown-ESC", () => this.back());
      k?.on("keydown-SPACE", (e: KeyboardEvent) => !e.repeat && (this.spaceAt = this.time.now));
      k?.on("keyup-SPACE", () => {
        if (this.spaceAt >= 0 && this.time.now - this.spaceAt < TAP) this.dodge(this.time.now);
        this.spaceAt = -1;
      });
      // The gold left at the last death waits where it fell, glowing, until it is picked up or the captain dies again.
      const lost = stored<Lost | null>(LOST, null);
      if (lost?.area === local.area) this.dropGold({ col: lost.col, row: lost.row }, lost.gold, { lost: true });
      for (const t of stored<Thrown[]>(THROWN, [])) if (t.area === local.area) this.dropItem({ col: t.col, row: t.row }, t.item);
      const boss = local.arena?.boss;
      if (boss && BOSS_KEY[boss] && remembered(SLAIN).has(boss) && !remembered(KEYS).has(boss) && local.bosses[0]) this.dropKey(local.bosses[0], boss);
      this.input.keyboard?.on("keydown-R", (e: KeyboardEvent) => !e.repeat && this.quaff());
      for (const [n, w] of this.folkHere()) this.addFolk(n, w);
      // Arriving, the area's own name is shown; only the quarters walked into after are.
      this.district.name = districtOf(local, near.col, near.row)?.name ?? "";
      this.district.shown.add(this.district.name);
      this.input.keyboard?.on("keydown-E", (e: KeyboardEvent) => this.interact(e.repeat));
      this.setFree(false, this.hero!.at, true);
      if (this.hooks.arrive === "fall") {
        // Dropped in: the hero comes down onto the spot and lands with a jolt.
        const s = this.hero!.s;
        const y = s.y;
        s.setY(y - 3 * CELL);
        this.tweens.add({ targets: s, y, duration: 650, ease: "Bounce.easeOut", onComplete: () => cam.shake(140, 0.004) });
      }
    } else {
      this.show("surface");
      this.fitTier();
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
        this.scene.restart({ ...this.hooks, area: to, from, arrive, carry });
      },
      warm: (to) => void areaMap(to),
      freeCamera: (on) => this.setFree(on),
      next: () => (this.reading ? this.read(null) : this.nextPage()),
      sit: (on) => this.sit(on),
      look: (cover) => this.frameSack(cover),
      levels: () => ({ levels: levels(), cost: levelCost(levels()), gold: this.gold, kit: { ...this.gear, flasks: maxFlasks() }, with: (lv) => ({ ...kit(remembered(BOUGHT), lv, heroClass()), flasks: maxFlasks() }), start: CLASSES[heroClass()].start }),
      levelUp: (stat) => this.levelUp(stat),
      gifts: () => GIFTS.map(sackItem),
      begin: (cls, gift, name) => this.begin(cls, gift, name),
      intro: (hold, fly, done) => this.intro(hold, fly, done),
      pause: (on) => {
        // The whole loop, not the scene: a paused scene still draws every frame under the other game.
        // Phaser still hands keys to a sleeping loop's scene, so E would rest or talk under a menu.
        this.game.input.keyboard!.enabled = !on;
        if (on) return this.game.loop.sleep();
        this.input.keyboard?.resetKeys();
        useIsland(this.map.tiers[this.view].island);
        this.game.loop.wake();
      },
      select: (id) => this.select(id),
      choose: (i) => {
        if (this.board) return this.chooseNotice(i);
        if (!this.menu) return;
        this.menu.pick = i;
        this.choose();
      },
      hover: (i) => {
        if (this.board) return void ((this.board.pick = i), this.showBoard());
        if (!this.menu || this.menu.pick === i) return;
        this.menu.pick = i;
        this.showMenu();
      },
      back: () => this.back(),
      devState: () => this.devState(),
      devTalk: (id) => this.devTalk(id),
      devLook: (col, row, ms) => {
        if (!this.free) this.setFree(true);
        this.flyTo({ col: col + 0.5, row: row + 0.5 }, AREA_ROWS, ms);
      },
      devSet: (patch) => this.devSet(patch),
      devPut: (col, row) => this.setFree(false, { col, row }),
      devRest: () => {
        const fires = this.local?.fires ?? [];
        const hero = this.hero;
        if (!hero || !fires.length || this.gone) return;
        const fire = fires.reduce((a, f) => (tileDistance(f, hero.at) < tileDistance(a, hero.at) ? f : a));
        this.setFree(false, fire);
        this.kindle(fire);
        this.rest(fire);
      },
      devBoard: () => this.hero && !this.hero.dead && !this.gone && !this.menu && !this.talk && this.openBoard(),
      devKill: () => {
        if (!this.hero || this.hero.dead || this.gone) return;
        this.hero.hp = 0;
        this.fall(this.hero);
      },
      tier: (id) => this.show(id),
    });
    // A crossing's own cover is the page's, and the bonfire map fades in on its own; only a first arrival opens on the clouds.
    if (this.hooks.arrive || !this.hooks.area) this.time.delayedCall(0, () => this.hooks.opened?.());
    else cloudCover(this, "open", () => this.hooks.opened?.(), this.active);
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
    if (barred(e)) {
      const missing = missingKeys(e);
      return missing.length ? `Locked: the ${missing.join(" and the ")} ${missing.length > 1 ? "open" : "opens"} it` : "Barred";
    }
    const there = AREAS.find((a) => a.id === e.to)?.name;
    return there ? `Walk on to ${there}` : "Walk on";
  }

  /** E at a way out: a slow walk off the edge; a lift or a drop goes at once (a drop still warns). */
  private traverse(e: Exit): void {
    if (barred(e)) return;
    const { kind, dir } = this.crossing(e);
    if (kind !== "walk" && kind !== "stair") return this.depart(e);
    const hero = this.hero!;
    this.gone = true;
    hero.way = [];
    // On out past the gate the way it leads, wherever the captain stood: never back onto its tile from beyond it. A door
    // or an arch in the map's middle is gone into, up from its step.
    const [dc, dr] = this.inward(e) ? [0, -0.6] : ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const)[dir];
    const [x, y] = [(e.at.col + 0.5 + 2 * dc) * CELL, (e.at.row + 0.75 + 2 * dr) * CELL];
    if (Math.abs(x - hero.s.x) > 2) hero.s.setFlipX(x < hero.s.x);
    play(ONWARD);
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
      if ((l.key && keys.has(l.key)) || (l.flag && this.flags.has(l.flag as WorldFlag))) continue;
      for (const c of l.cells) {
        this.locked.add(`${c.col},${c.row}`);
        // A lever's way is heaped shut: two boulders a tile, big enough to stand over the captain, set at odd angles.
        if (l.lever) {
          for (const [dx, dy, k] of [[0.3, 0.55, 2.4], [0.75, 0.95, 2.1]] as const) {
            const s = addDecor(this, "rock", (c.col + dx) * CELL, (c.row + dy) * CELL, k, `pile${c.col},${c.row},${dx}`);
            this.lockPosts.push({ lock: l, s: s.setAngle(((c.col * 7 + c.row * 13 + dx * 10) % 21) - 10) });
          }
        } else this.lockPosts.push(...this.fence(c.col, c.row, 1, 1).map((s) => ({ lock: l, s })));
      }
    }
  }

  /** Dev, with ?walls: every tile nobody can walk on, tinted, to check that what looks like a wall is one. */
  private showWalls(): void {
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (isLand(c, r) && (!isWalkable(c, r) || this.shut({ col: c, row: r }))) this.add.rectangle((c + 0.5) * CELL, (r + 0.5) * CELL, CELL, CELL, 0xff2040, 0.3).setDepth(DEPTH.fx);
      }
    }
  }

  /** E at a shortcut's gate from its far side: the bar comes down for good, and the way opens. */
  private unbar(l: Lock): void {
    play(LATCH);
    if (l.flag) this.flag(l.flag as WorldFlag);
    for (const c of l.cells) this.locked.delete(`${c.col},${c.row}`);
    for (const p of this.lockPosts.filter((p) => p.lock === l)) this.tweens.add({ targets: p.s, alpha: 0, y: p.s.y + 8, duration: 500, ease: "Sine.easeIn", onComplete: () => p.s.destroy() });
    this.lockPosts = this.lockPosts.filter((p) => p.lock !== l);
  }

  /** E at a lock's lever, away from it: the way opens for good, and the camera leaves the captain to watch it go, as
   *  a boss is met; nothing strikes or is hurt meanwhile. */
  private pullLever(l: Lock): void {
    const hero = this.hero!;
    const [pan, hold] = [1200, 3000];
    const end = this.time.now + 2 * pan + hold;
    if (l.flag) this.flag(l.flag as WorldFlag);
    // It tolls as the Belfry's bell does: a clang and rings of gold out over the hill.
    play(CLASH, 1);
    const [bx, by] = [(l.lever!.at.col + 0.5) * CELL, (l.lever!.at.row + 0.5) * CELL];
    for (const delay of [0, 300, 600]) {
      this.time.delayedCall(delay, () => {
        const wave = this.add.ellipse(bx, by, 2 * CELL, CELL).setStrokeStyle(6, 0xd8b060, 0.9).setDepth(DEPTH.fx);
        this.tweens.add({ targets: wave, scale: 12, alpha: 0, duration: 1100, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
      });
    }
    this.cinema = true;
    this.gone = true;
    this.shieldUp = false;
    hero.way = [];
    this.play(hero.s, hero.idle);
    for (const o of this.foes) Object.assign(o, { windup: null, way: [], busy: Math.max(o.busy, end) });
    this.hooks.onCinema?.(true);
    const cam = this.active;
    const mid = l.cells[Math.floor(l.cells.length / 2)]!;
    cam.stopFollow();
    cam.pan((mid.col + 0.5) * CELL, (mid.row + 0.5) * CELL, pan, "Sine.easeInOut", true);
    this.time.delayedCall(pan, () => {
      // Shoved from the far bank, the boulders lurch, tip off the bridge's sides one after another and go under the Run.
      for (const c of l.cells) this.locked.delete(`${c.col},${c.row}`);
      const mid = (Math.min(...l.cells.map((c) => c.col)) + Math.max(...l.cells.map((c) => c.col)) + 1) / 2;
      this.lockPosts.filter((p) => p.lock === l).forEach((p, i) => {
        const side = p.s.x / CELL < mid ? -1 : 1;
        const delay = 800 + i * 160;
        this.tweens.add({ targets: p.s, x: p.s.x - side * 6, duration: 90, yoyo: true, repeat: 2, delay: 300 + i * 40 });
        this.tweens.add({
          targets: p.s,
          x: p.s.x + side * (1.6 + (i % 3) * 0.3) * CELL,
          y: p.s.y + 0.4 * CELL,
          angle: p.s.angle + side * 100,
          delay,
          duration: 520,
          ease: "Quad.easeIn",
          onStart: () => i % 2 === 0 && play(TROLL_ROCK, 0.5),
          onComplete: () => {
            cam.shake(160, 0.004);
            const ring = this.add.ellipse(p.s.x, p.s.y, CELL * 0.9, CELL * 0.4).setStrokeStyle(4, 0xd8f4ff, 0.9).setDepth(DEPTH.foam + 1);
            this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 700, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
            this.tweens.add({ targets: p.s, y: p.s.y + 0.3 * CELL, scaleY: 0.2, alpha: 0, duration: 380, ease: "Sine.easeIn", onComplete: () => p.s.destroy() });
          },
        });
      });
      this.lockPosts = this.lockPosts.filter((p) => p.lock !== l);
      this.time.delayedCall(2300, () => play(TROLL_ROAR, 0.3));
    });
    this.time.delayedCall(pan + hold, () => {
      this.hooks.onCinema?.(false);
      cam.pan(hero.s.x, hero.s.y, pan, "Sine.easeInOut", true);
    });
    this.time.delayedCall(2 * pan + hold, () => {
      this.cinema = false;
      if (!this.hero || this.free) return;
      cam.startFollow(this.hero.s, true, 0.15, 0.15);
      this.gone = false;
    });
  }

  /** The locked way beside the captain, if any. */
  private lockNear(): Lock | undefined {
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
    const was = this.view;
    this.view = id;
    for (const t of ["sky", "surface", "below"] as const) this.cams[t].setVisible(t === id);
    const to = this.active;
    to.setZoom(zoom);
    to.centerOn(centre.x, centre.y);
    if (!this.local) {
      // Each tier's lands lie in their own part of the grid: the camera keeps to them, and a new tier opens on all of them.
      this.freeBox = this.landBox(this.map.tiers[id]);
      if (id !== was) this.fitTier();
    }
    this.hooks.onTier(id);
  }

  private flyTo(c: Cell, rows: number, ms = 900): void {
    const cam = this.active;
    const zoom = this.zoomFor(rows);
    const shift = ((this.hooks.inset?.() ?? 0) * cam.width) / 2 / zoom;
    cam.pan(c.col * CELL - shift, c.row * CELL, ms, "Sine.easeInOut", true);
    cam.zoomTo(zoom, ms, "Sine.easeInOut", true);
  }

  private controls(): void {
    this.input.setDefaultCursor(HAND);
    this.input.mouse?.disableContextMenu();
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.playing) return;
      const cam = this.active;
      const widest = this.freeBox ? this.freeFit() : Math.max(this.zoomFor(STRAT_ROWS), cam.width / (STRAT_COLS * CELL));
      cam.zoomTo(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.85 : 1.18), widest, this.zoomFor(9)), 160, "Sine.easeOut", true);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.game.loop.running) return;
      const cam = this.active;
      if (this.playing) {
        // Dark Souls on a mouse: the left button strikes the way the hero faces, the right held raises the shield.
        if (p.rightButtonDown()) this.shieldUp = true;
        else if (p.leftButtonDown()) this.attack(this.time.now);
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
      // An exit travels, else the area under the pointer.
      const folk = this.free && this.hero ? this.folk.filter((f) => tileDistance(f.at, cell) <= 1).sort((a, b) => tileDistance(a.at, cell) - tileDistance(b.at, cell))[0] : undefined;
      if (folk) return this.devTalk(folk.npc.id);
      const note = this.free && this.hero ? this.notes.find((n) => tileDistance(n.at, cell) <= 1) : undefined;
      if (note) return this.devRead(note);
      if (this.free && this.hero) {
        // Set down beside an exit rather than through it, so its own crossing is the one walked.
        const exit = this.local?.exits.find((e) => tileDistance(e.at, cell) <= 2);
        return this.setFree(false, exit?.at ?? cell);
      }
      const ch = this.map.tiers[this.view].areaAt[cell.row]?.[cell.col];
      this.hooks.onArea(ch && ch !== "-" ? AREAS[AREA_CODE.indexOf(ch)]!.id : null);
    });
  }

  /** Flies to a land on its own tier. */
  private select(id: AreaId | null): void {
    if (!id) return;
    this.show(AREAS.find((x) => x.id === id)!.tier);
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
    // A house's or a mine's walls stand a full row deep, not half: the feet stop at them, not under the eaves behind.
    const deep = new Set(cells.map(([, r]) => r)).size - (p.art.startsWith("house") || p.art === "goldMine" ? 0 : 0.5);
    this.bases.push({ x0: cx - half, x1: cx + half, y0: y1 - deep * CELL, y1 });
  }

  /** In play: an area map with the hero on it and the free camera off. */
  private get playing(): boolean {
    return !!this.hero && !this.free;
  }

  /** The open cell nearest `c` the hero can stand on, or null with none within a dozen cells. */
  private standNear(c: Cell): Cell | null {
    let best: Cell | null = null;
    for (let dr = -12; dr <= 12; dr++)
      for (let dc = -12; dc <= 12; dc++) {
        const n = { col: c.col + dc, row: c.row + dr };
        const fire = this.local?.fires.some((f) => f.col === n.col && f.row === n.row);
        if (!fire && isWalkable(n.col, n.row) && !isSlope(n.col, n.row) && !this.shut(n) && (!best || tileDistance(n, c) < tileDistance(best, c))) best = n;
      }
    return best;
  }

  /** The free camera over the whole map, the hero stood still; off, the hero set down at `at` or the view's middle. */
  private setFree(on: boolean, at?: Cell, snap = false): void {
    on &&= this.dev;
    this.free = on;
    this.shieldUp = false;
    this.devLabels();
    this.devKey = "";
    this.emitDev();
    const cam = this.active;
    if (!this.hero) return;
    this.hero.s.setVisible(!on);
    if (on) {
      this.hooks.onNear?.((this.nearName = null));
      for (const f of this.folk) {
        f.near = false;
        f.bubble?.destroy();
        f.bubble = null;
      }
    }
    // A fly-in still running would carry on over the new view.
    cam.zoomEffect.reset();
    cam.panEffect.reset();
    if (on) {
      cam.stopFollow();
      // Unbounded, so a map smaller than the screen sits in its middle rather than against an edge.
      cam.removeBounds();
      this.freeBox ??= this.landBox(this.local!);
      // Out from the hero to the whole island; clampFree draws the view over it as it widens.
      cam.zoomTo(this.freeFit(), 300, "Sine.easeOut", true);
    } else {
      const mid = cam.midPoint;
      const to = this.standNear(at ?? { col: Math.floor(mid.x / CELL), row: Math.floor(mid.y / CELL) });
      const hero = this.hero;
      if (to) {
        const y = (to.row + 0.75) * CELL;
        hero.s.setPosition((to.col + 0.5) * CELL, y).setDepth(standing(y));
        hero.at = to;
        hero.way = [];
      }
      // On the hero first, so only the zoom eases; bounds after it lands, as at the whole-map zoom they clamp the view
      // to the area's middle and the follow slides back.
      const bound = (): void => void cam.setBounds(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
      if (snap) {
        cam.setZoom(this.zoomFor(AREA_ROWS));
        bound();
      }
      cam.startFollow(hero.s, true, 0.15, 0.15);
      if (!snap) cam.zoomTo(this.zoomFor(AREA_ROWS), 300, "Sine.easeInOut", true, (_c, p) => p === 1 && this.playing && bound());
    }
  }

  private body(s: Phaser.GameObjects.Sprite, at: Cell, hp: number, speed: number, look: { idle: string; move?: string; attack?: string }): Body {
    return { s, at, hp, max: hp, next: 0, busy: 0, speed, way: [], planned: -1e9, ...look, lift: s.displayHeight * s.originY * 0.78, bar: this.add.graphics().setDepth(DEPTH.fx), dead: false };
  }

  private spawnHero(at: Cell): void {
    const art = HERO_ART[this.cls];
    const look = this.look(art.look);
    const y = (at.row + 0.75) * CELL;
    const s = this.add.sprite((at.col + 0.5) * CELL, y, look.idle.key).setOrigin(0.5, look.anchor).setDepth(standing(y)).setData("tint", art.tint);
    untint(s);
    this.play(s, look.idle.key);
    this.hero = { ...this.body(s, at, this.gear.hp, CLASSES[this.cls].speed, { idle: look.idle.key, move: look.move?.key, attack: art.attack.key }) };
    const k = this.input.keyboard;
    if (k) this.keys = k.addKeys({ up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D" }, false) as typeof this.keys;
    // Captured, so Space never scrolls the page or presses a focused button.
    k?.addCapture("SPACE");
  }

  /** A monster at its post: it waits there until it notices the hero. */
  private addFoe(d: Dweller, landed = false): void {
    const kit = d.kind === this.local?.arena?.boss ? BOSS_KITS[d.kind] : undefined;
    if (!landed && kit?.drops) {
      this.aloft = d;
      return;
    }
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
    // At dusk a goblin's torch is seen before the goblin: its light goes with it.
    if (d.kind === "torch" && this.local && DUSK[this.local.area]) {
      const glow = this.add.image(s.x, s.y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd2a0).setAlpha(0.35).setScale(1.1).setDepth(this.lightDepth());
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 500 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.torchGlows.push({ s, glow });
    }
    if (kit?.sleeps) {
      const f = this.foes.at(-1)!;
      s.anims.timeScale = 0.4;
      // Asleep: slow breath, and its snores rising off it.
      f.asleep = this.time.addEvent({ delay: 1600, loop: true, callback: () => this.float(s.x + 30, s.y - f.lift - 60, "z", "#cfe0ea") });
    }
  }

  /** A boss that drops (the Ring's troll, the Belfry's warden) comes down where the hero stands, the ground red under
   *  it: off it in time, or take its landing's blow. */
  private drop(): void {
    const d = this.aloft!;
    this.aloft = null;
    // Dust sifts down first, and he is heard above, so the fall comes as no blind blow.
    const rumble = 800;
    if (d.kind === "troll") play(TROLL_GROWL, 0.7);
    if (!this.anims.exists("fogPuff_fade")) this.anims.create({ key: "fogPuff_fade", frames: this.anims.generateFrameNumbers("fogPuff"), frameRate: 9, repeat: 0 });
    const from = this.hero!.at;
    for (let i = 0; i < 8; i++) {
      const x = (from.col + 0.5 + Phaser.Math.FloatBetween(-6, 6)) * CELL;
      const y = (from.row + Phaser.Math.FloatBetween(-5, 5)) * CELL;
      const dust = this.add.sprite(x, y - 2 * CELL, "fogPuff", 0).setScale(0.4).setTint(0xb8ab94).setAlpha(0).setDepth(DEPTH.fx);
      this.tweens.add({ targets: dust, y, alpha: { from: 0.7, to: 0 }, duration: 700, delay: Phaser.Math.Between(0, rumble - 300), onStart: () => dust.play("fogPuff_fade"), onComplete: () => dust.destroy() });
    }
    this.time.delayedCall(rumble, () => this.hero && !this.hero.dead && this.fallOn(d));
  }

  /** The fall itself, onto where the hero stands now. */
  private fallOn(d: Dweller): void {
    const at = { ...this.hero!.at };
    const aim = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => ({ col: at.col + dc, row: at.row + dr }))).filter((c) => isWalkable(c.col, c.row));
    const ms = 1000;
    const g = this.add.graphics().setDepth(DEPTH.unit - 1);
    for (const c of aim) g.fillStyle(0xe03a2a, 0.45).fillRect(c.col * CELL + 2, c.row * CELL + 2, CELL - 4, CELL - 4);
    this.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: ms, onComplete: () => g.destroy() });
    // Its shadow grows as it comes down.
    const y = (at.row + 0.75) * CELL;
    const shadow = this.add.ellipse((at.col + 0.5) * CELL, y, 2.4 * CELL, 1.1 * CELL, 0x000000, 0.45).setScale(0.2).setDepth(DEPTH.unit - 1);
    this.tweens.add({ targets: shadow, scale: 1, duration: ms, ease: "Quad.easeIn", onComplete: () => shadow.destroy() });
    if (d.kind === "troll") play(TROLL_FALL, 0.8);
    const look = this.look(d);
    const s = this.add.sprite((at.col + 0.5) * CELL, y - 12 * CELL, look.idle.key).setOrigin(0.5, look.anchor).setScale(look.scale).setDepth(DEPTH.fx);
    const tint = BEAST[d.kind]?.tint;
    if (tint) s.setTint(tint);
    this.tweens.add({
      targets: s,
      y,
      duration: ms,
      ease: "Quad.easeIn",
      onComplete: () => {
        s.destroy();
        this.addFoe({ ...d, col: at.col, row: at.row }, true);
        const f = this.foes.at(-1)!;
        f.home = { col: d.col, row: d.row };
        f.busy = this.time.now + 1100;
        this.active.shake(360, 0.016);
        play(TROLL_LAND);
        if (d.kind === "troll") this.time.delayedCall(350, () => play(TROLL_ROAR));
        for (const c of aim) this.blast(c, 0xc8b898);
        this.quake(at);
        const on = new Set(aim.map((c) => `${c.col},${c.row}`));
        for (const b of [this.hero!, ...this.band]) if (!b.dead && on.has(`${b.at.col},${b.at.row}`)) this.hurt(f, b, BOSS_KITS[d.kind]!.drops!, true);
      },
    });
  }

  /** A heavy landing felt round the room: a shockwave, a wall of dust rolling out, rubble shaken off the roof. */
  private quake(at: Cell): void {
    const x = (at.col + 0.5) * CELL;
    const y = (at.row + 0.75) * CELL;
    const wave = this.add.ellipse(x, y, 2 * CELL, CELL).setStrokeStyle(6, 0xe8dcc0, 0.8).setDepth(DEPTH.unit - 1);
    this.tweens.add({ targets: wave, scale: 7, alpha: 0, duration: 700, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
    if (!this.anims.exists("fogPuff_fade")) this.anims.create({ key: "fogPuff_fade", frames: this.anims.generateFrameNumbers("fogPuff"), frameRate: 9, repeat: 0 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const puff = this.add.sprite(x + Math.cos(a) * CELL, y + Math.sin(a) * 0.5 * CELL, "fogPuff", 0).setScale(0.8).setTint(0xb8ab94).setAlpha(0.8).setDepth(DEPTH.fx - 1);
      puff.play("fogPuff_fade");
      this.tweens.add({ targets: puff, x: x + Math.cos(a) * 6 * CELL, y: y + Math.sin(a) * 3 * CELL, scale: 1.6, alpha: 0, duration: 900, ease: "Quad.easeOut", onComplete: () => puff.destroy() });
    }
    for (let i = 0; i < 10; i++) {
      const c = { col: at.col + Phaser.Math.Between(-9, 9), row: at.row + Phaser.Math.Between(-7, 7) };
      if (!isWalkable(c.col, c.row) || tileDistance(c, at) < 3) continue;
      const ty = (c.row + 0.6) * CELL;
      const rock = this.add.rectangle((c.col + 0.5) * CELL, ty - 8 * CELL, 10, 10, 0x6e665c).setAngle(Phaser.Math.Between(0, 90)).setDepth(DEPTH.fx);
      const ms = Phaser.Math.Between(400, 900);
      this.tweens.add({ targets: rock, y: ty, angle: rock.angle + 180, duration: ms, delay: Phaser.Math.Between(0, 500), ease: "Quad.easeIn", onComplete: () => (rock.destroy(), this.blast(c, 0x8a8070)) });
    }
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
    const full = (b.speed * CELL * dt) / 1000;
    let left = full;
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
    if ((b as Foe).kind === "troll" && (this.trollStepped += full - left) >= 0.9 * CELL) (this.trollStepped = 0, play(TROLL_STEP, 0.7));
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
    if (to === this.hero && (now < this.roll.until || this.devGod)) return;
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
        play(GUARD_BREAK, 0.6);
        this.float(to.s.x, to.s.y - to.lift - 40, "Guard broken", "#fdfaf0");
      }
    }
    const foe = this.foes.includes(to as Foe) ? (to as Foe) : undefined;
    const kit = foe && BOSS_KITS[foe.kind];
    if (foe?.stats.flees) return this.flee(foe, from);
    if (foe && now < (foe.turning ?? 0)) return;
    if (kit?.wards && this.foes.some((o) => o.kind === kit.wards && !o.dead)) {
      this.float(to.s.x, to.s.y - to.lift - 40, "Warded", "#8cf0b4");
      return;
    }
    if (kit?.shield && !(kit.rage?.bare && foe!.turned) && this.facing(to, from)) {
      play(BLOCK, 0.6);
      this.float(to.s.x, to.s.y - to.lift - 40, "Parried", "#ffe080");
      return;
    }
    if (foe?.feeding) {
      foe.feeding = undefined;
      foe.busy = foe.open = now + 600;
      this.float(to.s.x, to.s.y - to.lift - 70, "Startled", "#fdfaf0");
    }
    const asleep = !!foe?.asleep;
    if (asleep) this.wake(foe!);
    const stone = kit?.stone !== undefined && !asleep && now >= (foe!.open ?? 0) ? kit.stone : 1;
    if (stone === 0) {
      this.float(to.s.x, to.s.y - to.lift - 40, "Shelled", "#9cc0b0");
      return;
    }
    const whole = blocked ? throughGuard(attack) : attack;
    const dealt = stone < 1 ? Math.max(1, Math.round(whole * stone)) : whole;
    to.hp = struck(to.hp, dealt);
    if (blocked || to === this.hero || from === this.hero) play(blocked ? BLOCK : to === this.hero ? HURT : HIT, 0.6);
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
  private loose(from: Body, to: Body, attack: number, missile: (typeof MISSILE)[string], landed?: () => void): void {
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
        if (!clearShot(launch, to.at, this.blocks)) return;
        this.hurt(from, to, attack);
        landed?.();
      },
    });
  }

  /** Blades at drill, heard from up to 14 tiles off and louder the nearer the captain stands. */
  private clash(at: Phaser.GameObjects.Sprite): void {
    const hero = this.hero;
    const near = hero && at.active ? 1 - Math.hypot(at.x - hero.s.x, at.y - hero.s.y) / (14 * CELL) : 0;
    if (near > 0) play(CLASH, 0.5 * near);
  }

  /** A body at nothing: a monster is gone; the hero rises again where it arrived, whole. */
  private fall(b: Body, by?: Body): void {
    b.dead = true;
    play(this.foes.includes(b as Foe) ? BONES : FALL, 0.6);
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
      if (this.isBoss(b as Foe)) this.perish(b as Foe);
      else this.tweens.add({ targets: b.s, alpha: 0, duration: 500, onComplete: () => b.s.destroy() });
      this.tally((b as Foe).kind);
      const gold = (b as Foe).stats?.gold;
      if (gold) this.dropGold(b.at, Math.round(gold * this.gear.greed));
      const loot = lootDrop((b as Foe).kind, Math.random(), this.gear.find);
      if (loot) this.dropLoot(b.at, loot);
      if (this.isBoss(b as Foe)) this.felled(b as Foe);
      if (this.isBoss(b as Foe) && BOSS_KEY[(b as Foe).kind]) this.dropKey(b.at, (b as Foe).kind);
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
    const kind = (by as Foe | undefined)?.kind;
    const past = kind === "troll" && this.local!.area === "ring" && this.local!.exits.find((e) => e.guard === kind);
    if (past) {
      // Lost, not over, after Elden Ring's Grafted Scion: the troll keeps the Ring and waits to be come back for.
      this.flag("bullWon");
      // Woken there, but washed up at the boat's pier, the fire still cold for Maren to light.
      store(REST, { area: past.to, ...areaMap(past.to).fires[0]! });
    }
    // The page says so, darkens, and wakes the captain at the bonfire last rested at, the monsters back at their posts.
    this.time.delayedCall(900, () => this.hooks.onDeath?.(restPoint()?.area ?? "landing"));
  }

  /** What E does here besides swing: talk to someone right beside, else rest at a bonfire beside, else talk to someone near. */
  private eTarget(): { folk: Folk } | { fire: Cell } | { note: Note } | { board: true } | { exit: Exit } | { fog: true } | { lock: string } | { unbar: Lock } | { horn: Lock } | { loot: Pile } | undefined {
    const at = this.hero!.at;
    const folk = this.folk.filter((f) => f.near).sort((a, b) => tileDistance(a.at, at) - tileDistance(b.at, at))[0];
    if (folk && tileDistance(folk.at, at) <= 1) return { folk };
    const fire = this.fireNear();
    if (fire) return { fire };
    const note = this.notes.find((n) => tileDistance(n.at, at) <= 1);
    if (note) return { note };
    if (this.local?.area === LANE_HOUSE.area && tileDistance(LANE_HOUSE.at, at) <= 1) return { board: true };
    const loot = this.piles.find((p) => (p.loot || p.item) && tileDistance(p.at, at) <= 1);
    if (loot) return { loot };
    const exit = this.local?.exits.find((e) => tileDistance(e.at, at) <= 1);
    if (exit) return { exit };
    if (this.atFog()) return { fog: true };
    const horn = this.local?.locks?.find((l) => l.lever && tileDistance(l.lever.at, at) <= 1 && l.cells.some((c) => this.locked.has(`${c.col},${c.row}`)));
    if (horn) return { horn };
    const lock = this.lockNear();
    if (lock?.lever) return { lock: `${lock.name}: shut` };
    // A shortcut opens only from its far side: nearer `from` than the gate is.
    if (lock?.from) return tileDistance(at, lock.from) < tileDistance(lock.cells[0]!, lock.from) ? { unbar: lock } : { lock: `${lock.name}: barred from the other side` };
    if (lock) return { lock: `${lock.name}: locked. The ${(lock.key && BOSS_KEY[lock.key]) ?? "key"} opens it` };
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

  /** A trade good where a monster fell, waiting for E. */
  private dropLoot(at: Cell, loot: LootName): void {
    const [x, y] = [(at.col + 0.6) * CELL, (at.row + 0.6) * CELL];
    const s = this.add.image(x, y, "icons", (ITEM_ICON[loot].y / 32) * 16 + ITEM_ICON[loot].x / 32).setScale(1.3).setDepth(standing(y) - 1);
    this.tweens.add({ targets: s, y: { from: y - 30, to: y }, duration: 420, ease: "Bounce.easeOut" });
    this.piles.push({ at: { ...at }, gold: 0, loot, s });
  }

  /** E by a trade good or a good thrown down: into the sack. */
  private pickUp(p: Pile): void {
    this.piles.splice(this.piles.indexOf(p), 1);
    if (p.item) {
      store(THROWN, stored<Thrown[]>(THROWN, []).filter((t) => t.item !== p.item));
      p.s.destroy();
      play(LEATHER);
      return this.gain(p.item);
    }
    const loot = p.loot!;
    const h = held();
    store(HELD, { ...h, [loot]: (h[loot] ?? 0) + 1 });
    play(LEATHER);
    this.tweens.add({ targets: p.s, y: p.s.y - 24, alpha: 0, duration: 300, ease: "Sine.easeOut", onComplete: () => p.s.destroy() });
    this.float(p.s.x, p.s.y - 50, loot, "#f4cf6b");
    this.emitSack();
  }

  /** A boss's key on the ground where it fell, glowing until it is picked up. */
  private dropKey(at: Cell, kind: string): void {
    const [x, y] = [(at.col + 0.5) * CELL, (at.row + 0.75) * CELL];
    const s = this.add.image(x, y, "gold").setOrigin(0.5, 0.62).setScale(0.6).setTint(0xfff0b0).setDepth(standing(y) - 1);
    const shine = this.add.image(x, y - 10, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setAlpha(0.7).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: [s, shine], scale: "*=1.15", duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: s, y: { from: y - 40, to: y }, duration: 500, ease: "Bounce.easeOut" });
    this.piles.push({ at: { ...at }, gold: 0, key: kind, s, shine });
  }

  /** A good on the ground, drawn as a blade: Hollis's gaff is the only one thrown so far. */
  private dropItem(at: Cell, item: ItemName): Phaser.GameObjects.Image {
    const [x, y] = [(at.col + 0.5) * CELL, (at.row + 0.75) * CELL];
    // Only the hilt piece of the sheet's three-piece sword, as the gaff's own icon crops it.
    const s = this.add.image(x, y, "swords", 0).setCrop(0, 0, 128, 128).setOrigin(64 / 448, 0.62).setScale(0.45).setDepth(standing(y) - 1);
    this.piles.push({ at: { ...at }, gold: 0, item, s });
    return s;
  }

  /** One of the folk throws a good to land on bare ground two tiles from the captain, away from them and off any fire. */
  private throwDown(f: Folk, item: ItemName): void {
    const hero = this.hero!;
    const open = (c: Cell): boolean =>
      isWalkable(c.col, c.row) && !isSlope(c.col, c.row) && !this.solid.has(`${c.col},${c.row}`) && !this.local!.fires.some((fire) => tileDistance(fire, c) <= 1);
    const ring: Cell[] = [];
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (Math.max(Math.abs(dc), Math.abs(dr)) === 2) ring.push({ col: hero.at.col + dc, row: hero.at.row + dr });
    const at = ring.filter(open).sort((a, b) => tileDistance(b, f.at) - tileDistance(a, f.at))[0] ?? hero.at;
    store(THROWN, [...stored<Thrown[]>(THROWN, []), { item, area: this.local!.area, col: at.col, row: at.row }]);
    const s = this.dropItem(at, item);
    const [x0, y0, x1, y1] = [f.s.x, f.s.y - CELL, s.x, s.y];
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 650,
      ease: "Sine.easeOut",
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        s.setPosition(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * 90).setAngle(k * 720);
      },
    });
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
    // A key is walked onto; the rest is swept up from a tile off.
    for (const p of this.piles.filter((p) => !p.loot && !p.item && tileDistance(p.at, hero.at) <= (p.key ? 0 : 1))) {
      this.piles.splice(this.piles.indexOf(p), 1);
      if (p.key) {
        remember(KEYS, remembered(KEYS).add(p.key));
        p.shine?.destroy();
        p.s.destroy();
        play(LATCH);
        this.herald(`${BOSS_KEY[p.key]} gained`);
        continue;
      }
      this.setGold(this.gold + p.gold);
      play(COINS);
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
    for (const d of this.local!.dwellers) if (FOES[d.kind] && !this.slain(d)) this.addFoe(d);
    stored<CompanionKind[]>(BAND, []).forEach((kind) => this.addCompanion(kind));
    this.emitBand();
    this.hooks.onRest?.(this.local!.area);
  }

  /** A level bought by the fire, after the Souls games' level up: gold for health, attack or stamina. */
  private levelUp(stat: keyof Levels): boolean {
    const now = levels();
    const cost = levelCost(now);
    if (this.gold < cost) return (play(ERROR), false);
    play(CONFIRM);
    this.setGold(this.gold - cost);
    store(LEVELS, { ...now, [stat]: now[stat] + 1 });
    this.regear();
    return true;
  }

  /** Sat by the bonfire last rested at, after the Souls games: still, turned to the fire, the camera drawn in close. */
  private sit(on: boolean): string | null {
    const hero = this.hero;
    if (!hero || !this.local) return null;
    this.gone = on;
    hero.way = [];
    this.crackle?.();
    this.crackle = on ? loop(CRACKLE, 0.7) : null;
    const fire = restPoint() ?? hero.at;
    if (on) hero.s.setFlipX((fire.col + 0.5) * CELL < hero.s.x);
    this.play(hero.s, hero.idle);
    // The pair framed, the captain's middle and the flames', not the feet.
    this.closeUp(on ? { x: (hero.s.x + (fire.col + 0.5) * CELL) / 2, y: (hero.s.y - hero.lift / 2 + (fire.row + 0.5) * CELL) / 2 } : null);
    return fireName(this.local, fire) || null;
  }

  /**
   * The camera in close, for a rest or a merchant: a whole-number zoom so the pixel art lands crisp, `at` in the middle of
   * what the side panel on the left leaves clear. The folk step out of the shot, all but `keep`.
   */
  private closeUp(at: { x: number; y: number } | null, keep?: Folk): void {
    const cam = this.active;
    const hero = this.hero!;
    const base = this.zoomFor(AREA_ROWS);
    const zoom = at ? Math.ceil(base * 2.2) : base;
    cam.zoomTo(zoom, 900, "Sine.easeInOut", true);
    // The rest panel takes the left 40%: the shot sits at 70% across.
    const shift = at && cam.width > 640 ? (cam.width * 0.2) / zoom : 0;
    this.easeOffset(at ? hero.s.x - at.x + shift : 0, at ? hero.s.y - at.y : 0, 900);
    for (const f of this.folk) {
      const out = !!at && f !== keep;
      if (out) f.bubble?.destroy();
      if (out) f.bubble = null;
      this.tweens.add({ targets: [f.s, f.tag], alpha: out ? 0 : 1, duration: 500 });
    }
    this.close = at ? (keep ? "folk" : "fire") : null;
    this.sackCover = 0;
  }

  /** The camera in close on the captain, centred in the screen the sack leaves clear; one that covers it all just shuts. */
  private frameSack(cover: number): void {
    // Only on a change: the sack reports 0 as it mounts and unmounts, which must not cut into the intro's shot.
    if (!this.hero || this.close || this.free || this.gone || cover === this.sackCover) return;
    this.sackCover = cover;
    const cam = this.active;
    const base = this.zoomFor(AREA_ROWS);
    const zoom = cover > 0 && cover < 0.9 ? Math.ceil(base * 2.2) : base;
    cam.zoomTo(zoom, 600, "Sine.easeInOut", true);
    this.easeOffset(zoom === base ? 0 : (cam.width * cover) / 2 / zoom, 0, 600);
  }

  /** The follow camera's offset eased with its zoom, so the shot moves as one rather than sliding at the follow's pace. */
  private easeOffset(x: number, y: number, duration: number): void {
    const o = this.active.followOffset;
    this.tweens.killTweensOf(o);
    this.tweens.add({ targets: o, x, y, duration, ease: "Sine.easeInOut" });
  }

  /** The opening shot: in close on the captain waking, then easing back to the play view; the map is never shown whole. */
  private intro(hold: number, fly: number, done: () => void): void {
    const hero = this.hero;
    if (!hero || !this.local || this.free) return done();
    const cam = this.active;
    this.gone = true;
    hero.way = [];
    this.play(hero.s, hero.idle);
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(this.zoomFor(5));
    cam.centerOn(hero.s.x, hero.s.y - CELL / 2);
    // Onto where the bounded follow camera will sit, so nothing jumps when play takes it over.
    const zoom = this.zoomFor(AREA_ROWS);
    const [w, h] = [cam.width / zoom / 2, cam.height / zoom / 2];
    const x = Phaser.Math.Clamp(hero.s.x, w, STRAT_COLS * CELL - w);
    const y = Phaser.Math.Clamp(hero.s.y, h, STRAT_ROWS * CELL - h);
    this.time.delayedCall(hold, () => {
      cam.pan(x, y, fly, "Sine.easeInOut", true);
      cam.zoomTo(zoom, fly, "Sine.easeInOut", true);
    });
    this.time.delayedCall(hold + fly, () => {
      cam.setBounds(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
      cam.startFollow(this.hero!.s, true, 0.15, 0.15);
      this.gone = false;
      done();
    });
  }

  /** R: an ember, if there is one and anything to heal; the hero stands still a moment to burn it. */
  private quaff(): void {
    const hero = this.hero!;
    const time = this.time.now;
    if (!this.playing || hero.dead || this.gone || this.guarding || time < hero.busy) return;
    const was = hero.hp;
    const d = drink(hero.hp, hero.max, this.flasks, this.gear.flask);
    if (d.flasks === this.flasks) return (play(ERROR), this.float(hero.s.x, hero.s.y - hero.lift - 30, this.flasks ? "Unhurt" : "No embers", "#fdfaf0"));
    play(GLASS);
    Object.assign(hero, { hp: d.hp, way: [], busy: time + 600 });
    this.flasks = d.flasks;
    this.hooks.onFlasks?.(this.flasks);
    this.play(hero.s, hero.idle);
    const [x, y] = [hero.s.x, hero.s.y];
    const drop = this.add.image(x, y - hero.lift - 6, EMBER_ICON.key).setCrop(44, 44, 40, 40).setTint(0xff7a3c).setScale(0.9).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: drop, y: drop.y - 34, alpha: { from: 1, to: 0 }, duration: 650, ease: "Sine.easeOut", onComplete: () => drop.destroy() });
    // The swirl rises from the ground round the feet, in front of the hero.
    const fx = this.add.sprite(x, y + 14, HEAL_FX.key).setOrigin(0.5, 0.72).setDepth(standing(y) + 1).setTint(0xffa050);
    fx.play(`${HEAL_FX.key}_once`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    hero.s.setTint(0xffc078);
    this.time.delayedCall(300, () => hero.s.clearTint());
    this.time.delayedCall(250, () => this.float(x, y - hero.lift - 10, `+${d.hp - was}`, "#ffc078"));
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
      if (c.kind === "monk" && time >= c.next && this.mend(c, stats, time)) continue;
      // A lancer cannot reach what flies: it fights only what walks, and leaves the rest to the bows. The Monk fights nothing.
      const mine = c.kind === "monk" ? [] : live.filter((f) => canReach(stats.range, f.stats));
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
          (cell.col === hero.at.col && cell.row === hero.at.row) || this.shut(cell) || this.band.some((o) => o !== c && !o.dead && o.at.col === cell.col && o.at.row === cell.row);
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

  /** The Monk's prayer over whoever is lowest and in reach: their health back, under the heal's swirl. */
  private mend(c: Companion, stats: CompanionStats, time: number): boolean {
    const bodies = [this.hero!, ...this.band].filter((b) => !b.dead);
    const i = mendTarget(c.at, stats.range, bodies);
    if (i < 0) return false;
    const to = bodies[i]!;
    this.swing(c, to, stats.every, time);
    c.busy = time + 900;
    const was = to.hp;
    to.hp = Math.min(to.max, to.hp + stats.attack);
    const fx = this.add.sprite(to.s.x, to.s.y + 14, HEAL_FX.key).setOrigin(0.5, 0.72).setDepth(standing(to.s.y) + 1);
    fx.play(`${HEAL_FX.key}_once`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    this.float(to.s.x, to.s.y - to.lift - 10, `+${to.hp - was}`, "#8fe08a");
    if (to !== this.hero) this.emitBand();
    return true;
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
    return f.npc.shop ? onOffer(f.npc.shop.stock, remembered(BOUGHT), remembered(SLAIN), this.seen).map((s) => s.item) : [];
  }

  /** At a merchant's menu: a good, for gold, once, and kept; what it gives is the captain's at once. */
  private buyHere(item: ItemName): void {
    const f = this.menu!.folk;
    const shop = f.npc.shop!;
    const bought = remembered(BOUGHT);
    if (bought.has(item)) return (play(ERROR), this.callOut(f, shop.sold));
    if (this.gold < ITEMS[item].cost) return (play(ERROR), this.callOut(f, shop.poor));
    this.setGold(this.gold - ITEMS[item].cost);
    play(COINS);
    this.gain(item);
    this.menu!.pick = this.stock(f).indexOf(item);
    this.showMenu();
  }

  /** A good bought or given: kept, and the captain's at once. */
  private gain(item: ItemName): void {
    const bought = remembered(BOUGHT);
    if (bought.has(item)) return;
    remember(BOUGHT, bought.add(item));
    this.regear();
    const hero = this.hero!;
    this.float(hero.s.x, hero.s.y - hero.lift - 30, `${item} gained`, "#f4cf6b");
  }

  /** The captain as `cls`, with `gift` in the sack and called `name`, kept for the run: its sheets, feet and numbers. */
  private begin(cls: HeroClass, gift: ItemName, name: string): void {
    store(CLASS, cls);
    store(NAME, name);
    remember(BOUGHT, remembered<ItemName>(BOUGHT).add(gift));
    this.cls = cls;
    const hero = this.hero;
    if (!hero) return;
    const look = this.look(HERO_ART[cls].look);
    Object.assign(hero, { idle: look.idle.key, move: look.move?.key, attack: HERO_ART[cls].attack.key, speed: CLASSES[cls].speed });
    hero.s.anims.stop();
    hero.s.setData("tint", HERO_ART[cls].tint);
    untint(hero.s);
    hero.s.setOrigin(0.5, look.anchor);
    this.play(hero.s, hero.idle);
    hero.lift = hero.s.displayHeight * hero.s.originY * 0.78;
    this.regear();
  }

  /** The numbers again after a good or a level: a shard's ember comes lit, a haunch's health with it. */
  private regear(): void {
    const was = this.gear;
    this.gear = gearNow();
    const hero = this.hero!;
    this.flasks += this.gear.flasks - was.flasks;
    this.hooks.onFlasks?.(this.flasks);
    hero.max = this.gear.hp;
    hero.hp += this.gear.hp - was.hp;
    this.stamina += this.gear.stamina - was.stamina;
    this.emitSack();
  }

  private emitSack(): void {
    const bought = remembered(BOUGHT);
    const items = (Object.keys(ITEMS) as ItemName[]).filter((item) => bought.has(item));
    const stats = (Object.keys(STATS) as (keyof Kit)[]).map((k) => ({ key: k, label: STATS[k].label, now: statWords(k, this.gear) }));
    const lv = levels();
    const level = heroLevel(lv);
    const goods = (Object.entries(held()) as [LootName, number][]).filter(([, n]) => n > 0).map(([loot, n]) => ({ label: loot, icon: ITEM_ICON[loot], count: n, gives: `${LOOT[loot].worth} gold each to ${NPCS.find((m) => m.id === LOOT[loot].buyer)?.name}`, about: LOOT[loot].about }));
    this.hooks.onSack?.({ name: stored<string | null>(NAME, null), items: [...items.map(sackItem), ...goods], stats, level });
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
    this.float(hero.s.x, hero.s.y - hero.lift - 30, `${COMPANION_NAME[kind]} joined`, "#9cc4e8");
    this.showMenu();
  }

  /** The trade goods carried that `f` buys. */
  private wares(f: Folk): LootName[] {
    return (Object.entries(held()) as [LootName, number][]).filter(([loot, n]) => n > 0 && LOOT[loot].buyer === f.npc.id).map(([loot]) => loot);
  }

  /** At a merchant's Sell: one of a good, for its worth. */
  private sellHere(loot: LootName): void {
    const h = held();
    store(HELD, { ...h, [loot]: (h[loot] ?? 1) - 1 });
    this.setGold(this.gold + LOOT[loot].worth);
    play(COINS);
    this.emitSack();
    const m = this.menu!;
    if (!this.wares(m.folk).length) this.menu = { folk: m.folk, pick: 2 };
    else m.pick = Math.min(m.pick, this.wares(m.folk).length - 1);
    this.showMenu();
  }

  private menuOptions(f: Folk): MenuView["options"] {
    if (this.menu?.selling) {
      const h = held();
      const goods = this.wares(f).map((loot) => ({ label: loot, note: `${LOOT[loot].worth}`, icon: ITEM_ICON[loot], about: LOOT[loot].about, held: `${h[loot]}` }));
      return [...goods, { label: "Back" }];
    }
    if (this.menu?.shopping) {
      const bought = remembered(BOUGHT);
      const goods = this.stock(f).map((item) => {
        const sold = bought.has(item);
        const after = kit(new Set([...bought, item]), levels(), heroClass());
        const change = (Object.keys(ITEMS[item].adds) as (keyof Kit)[]).map((k) => ({ label: STATS[k].label, now: statWords(k, this.gear), after: statWords(k, after) }));
        return { label: item, note: `${ITEMS[item].cost}`, icon: ITEM_ICON[item], gives: gives(item), sold, about: ITEMS[item].about, afford: !sold && this.gold >= ITEMS[item].cost, change };
      });
      return [...goods, { label: "Back" }];
    }
    const talk = { label: "Talk", note: "Hear them out" };
    const leave = { label: "Leave", note: "Go on your way" };
    if (f.npc.shop) return [talk, { label: "Shop", note: "See the goods" }, ...(this.wares(f).length ? [{ label: "Sell", note: "Trade goods for gold" }] : []), leave];
    const kind = RECRUITER[f.npc.id]!;
    const cost = COMPANIONS[kind].cost;
    const room = this.band.length < BAND_SIZE;
    return [talk, { label: `Hire ${kind === "lancer" ? "a Lancer" : "an Archer"}`, note: room ? `${cost} gold, ${this.band.length} of ${BAND_SIZE} in the band` : "The band is full" }, leave];
  }

  private showMenu(): void {
    const m = this.menu;
    this.hooks.onMenu?.(
      m
        ? {
            name: m.folk.npc.name,
            role: m.folk.npc.shop ? "Merchant" : "Hires out",
            greet: m.folk.npc.greet,
            options: this.menuOptions(m.folk),
            pick: m.pick,
            shop: m.shopping || m.selling,
            sell: m.selling,
            gold: this.gold,
          }
        : null,
    );
  }

  private showBoard(): void {
    const b = this.board;
    const done = noticed();
    this.hooks.onBoard?.(
      b && {
        name: "Lane House",
        notes: NOTICES.map((n) => ({ title: n.title, from: n.from, text: n.text, reward: n.reward, state: noticeState(n.count, done[n.id]) })),
        pick: b.pick,
        gold: this.gold,
      },
    );
  }

  private openBoard(): void {
    this.hero!.way = [];
    this.board = { pick: 0 };
    // The door framed beside the hero; opened from afar in dev mode, the hero alone.
    const at = this.local?.area === LANE_HOUSE.area && tileDistance(LANE_HOUSE.at, this.hero!.at) <= 1;
    this.closeUp(at ? { x: (LANE_HOUSE.at.col + 0.5) * CELL, y: (LANE_HOUSE.at.row + 0.5) * CELL } : { x: this.hero!.s.x, y: this.hero!.s.y });
    play(PAGE);
    this.showBoard();
  }

  private closeBoard(): void {
    this.board = null;
    this.closeUp(null);
    this.showBoard();
  }

  /** E on a note whose foes have fallen: its gold, and the note marked paid. */
  private chooseNotice(i: number): void {
    const n = NOTICES[i];
    if (!n) return;
    this.board!.pick = i;
    const done = noticed();
    if (noticeState(n.count, done[n.id]) !== "fallen") return this.showBoard();
    store(NOTICED, { ...done, [n.id]: "paid" });
    this.setGold(this.gold + n.reward);
    play(LEATHER);
    this.showBoard();
  }

  /** A foe felled: counted against every unpaid notice for its kind in this area. */
  private tally(kind: string): void {
    const area = this.local?.area;
    const done = noticed();
    let changed = false;
    for (const n of NOTICES) {
      const was = done[n.id] ?? 0;
      if (n.area !== area || n.kind !== kind || was === "paid" || was >= n.count) continue;
      done[n.id] = was + 1;
      changed = true;
    }
    if (changed) store(NOTICED, done);
  }

  private openMenu(f: Folk): void {
    const hero = this.hero!;
    hero.way = [];
    f.bubble?.destroy();
    f.bubble = null;
    f.s.setFlipX(hero.s.x < f.s.x);
    hero.s.setFlipX(f.s.x < hero.s.x);
    this.menu = { folk: f, pick: 0 };
    this.closeUp({ x: (hero.s.x + f.s.x) / 2, y: (hero.s.y + f.s.y) / 2 }, f);
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
    if (this.board) return this.closeBoard();
    const m = this.menu;
    if (!m) return;
    if (!m.shopping && !m.selling) return this.closeMenu(true);
    this.menu = { folk: m.folk, pick: m.selling ? 2 : 1 };
    this.showMenu();
  }

  private movePick(d: number, across = false): void {
    if (this.board) {
      this.board.pick = stepNotice(this.board.pick, NOTICES.length, across ? d : 0, across ? 0 : d);
      return this.showBoard();
    }
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
    if (m.selling) {
      if (!last) return this.sellHere(this.wares(m.folk)[m.pick]!);
      this.menu = { folk: m.folk, pick: 2 };
      return this.showMenu();
    }
    if (m.pick === 0) {
      const f = m.folk;
      this.menu = null;
      this.showMenu();
      this.talkTo(f);
    } else if (last) this.closeMenu(true);
    else if (m.folk.npc.shop) {
      this.menu = { folk: m.folk, pick: 0, ...(this.menuOptions(m.folk)[m.pick]!.label === "Sell" ? { selling: true } : { shopping: true }) };
      this.showMenu();
    } else this.hireHere();
  }

  /** A word or a number over a body: up and gone. */
  private float(x: number, y: number, text: string, color: string, ms = 900): void {
    const n = this.add.text(x, y, text, { fontFamily: FONT, fontSize: "26px", fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: n, y: y - 40, alpha: 0, duration: ms, ease: "Sine.easeOut", onComplete: () => n.destroy() });
  }

  /**
   * Keys in play: WASD or the arrows walk the hero freely, at its own speed, the way they point. Each axis is tried on
   * its own, so it slides along what blocks; a cliff is crossed only at a ramp, by the same step rule as any walk.
   */
  private steer(dt: number): boolean {
    const hero = this.hero!;
    if (!this.keys || hero.dead || this.menu || this.board) return false;
    const [dx, dy] = this.keyDir();
    if (!dx && !dy) return false;
    hero.way = [];
    this.slide(dx, dy, (hero.speed * CELL * dt) / 1000, true);
    this.play(hero.s, hero.move ?? hero.idle);
    return true;
  }

  /** The way the movement keys point, each axis -1, 0 or 1; none while the sack is open, where they walk its goods. */
  private keyDir(): [number, number] {
    const k = this.keys;
    if (!k || this.menu || this.board || this.sackCover) return [0, 0];
    return [(k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0), (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0)];
  }

  /** Moves the hero `px` the way (dx, dy) points, each axis on its own so it slides along what blocks. */
  private slide(dx: number, dy: number, px: number, face: boolean): void {
    const hero = this.hero!;
    const step = px / Math.hypot(dx, dy);
    const cellAt = (x: number, y: number): Cell => ({ col: Math.floor(x / CELL), row: Math.round(y / CELL - 0.75) });
    // Felt for a little ahead of the feet, so the hero stops short of a wall instead of half inside it.
    const ahead = 0.3 * CELL;
    const open = (x: number, y: number, mx = 0, my = 0): boolean => {
      const to = cellAt(x, y);
      const k = `${to.col},${to.row}`;
      return (to.col === hero.at.col && to.row === hero.at.row) || ((canStep(hero.at, to) || climbsStair(hero.at, to, mx, my)) && (this.boxed.has(k) ? !this.sealed.has(k) && !this.locked.has(k) : !this.shut(to)));
    };
    // A prop or a rock stops the feet at its art's base, not at its tile's edge; feet already in one can always step out.
    const hit = (b: Box, x: number, y: number): boolean => x + FEET.w > b.x0 && x - FEET.w < b.x1 && y + FEET.down > b.y0 && y - FEET.up < b.y1;
    let { x, y } = hero.s;
    // Everyone afoot stands as solid as a prop, but the hero's own band, who would hem them in.
    const feet = (s: Phaser.GameObjects.Sprite): Box => ({ x0: s.x - 0.3 * CELL, x1: s.x + 0.3 * CELL, y0: s.y - 12, y1: s.y });
    const others = [...this.walkers, ...this.folk.map((f) => f.s), ...this.foes.filter((f) => !f.dead).map((f) => f.s)].filter((s) => s.active).map(feet);
    const clear = (nx: number, ny: number): boolean => ![...this.bases, ...others].some((b) => hit(b, nx, ny) && !hit(b, x, y));
    const canX = !!dx && open(x + Math.sign(dx) * ahead + dx * step, y) && clear(x + dx * step, y);
    const canY = !!dy && open(x, y + Math.sign(dy) * ahead + dy * step) && clear(x, y + dy * step);
    // A stair is taken along its slope, both axes at once: a push that snags on it is turned up or down the slope.
    const lean = (dx && !canX) || (dy && !canY) ? stairLean(hero.at, dx, dy) : null;
    if (lean) {
      const [vx, vy] = lean;
      const s = px / Math.SQRT2;
      const go = (nx: number, ny: number): boolean => open(nx, ny, vx, vy) && clear(nx, ny);
      if (go(x + vx * s, y + vy * s)) {
        x += vx * s;
        y += vy * s;
      } else {
        if (go(x + vx * s, y)) x += vx * s;
        if (go(x, y + vy * s)) y += vy * s;
      }
    } else {
      if (canX) x += dx * step;
      if (dy && open(x, y + Math.sign(dy) * ahead + dy * step) && clear(x, y + dy * step)) y += dy * step;
    }
    hero.s.setPosition(x, y).setDepth(standing(y));
    hero.at = cellAt(x, y);
    const fx = lean ? lean[0] : dx;
    if (face && Math.abs(fx) > 0.01) hero.s.setFlipX(fx < 0);
  }

  /** A tap of Space: a roll the way the hero walks, or a backstep standing still; nothing lands on it while it lasts. */
  private dodge(time: number): void {
    const hero = this.hero!;
    if (!this.playing || hero.dead || this.gone || this.menu || this.board || this.talk || time < hero.busy || time < this.roll.until || !canAct(this.stamina)) return;
    let [dx, dy] = this.keyDir();
    const next = hero.way[0];
    if (!dx && !dy && next) [dx, dy] = [next.x - hero.s.x, next.y - hero.s.y];
    const back = !dx && !dy;
    if (back) dx = hero.s.flipX ? 1 : -1;
    const len = Math.hypot(dx, dy);
    const { tiles, ms } = back ? ROLL.back : ROLL;
    this.stamina = spend(this.stamina, this.gear.roll);
    play(DASH, 0.5);
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
    this.guarding = !rolling && !hero.dead && !this.gone && this.playing && this.shieldUp && CLASSES[this.cls].shield && time >= this.guardBroken;
    if (rolling) {
      this.slide(this.roll.dx, this.roll.dy, (this.roll.speed * dt) / 1000, !this.roll.back);
      if (time - this.roll.trail > 45) {
        this.roll.trail = time;
        this.echo();
      }
    } else if (this.guarding) {
      // Behind the shield it stands its ground, once any swing is through, the shield kept to the nearest monster.
      hero.way = [];
      this.queued = false;
      if (time >= hero.busy) {
        const foe = this.foes.filter((f) => !f.dead && tileDistance(f.at, hero.at) <= 3).sort((a, b) => tileDistance(a.at, hero.at) - tileDistance(b.at, hero.at))[0];
        if (foe && Math.abs(foe.s.x - hero.s.x) > 4) hero.s.setFlipX(foe.s.x < hero.s.x);
        this.play(hero.s, HERO_ART[this.cls].guard!.key);
      }
    } else if (!hero.dead && !this.gone) {
      // Space held past a tap, while moving: a sprint, for as long as the stamina lasts.
      const [kx, ky] = this.keyDir();
      const sprinting = this.spaceAt >= 0 && time - this.spaceAt >= TAP && (kx || ky || hero.way.length > 0) && canAct(this.stamina) && time >= hero.busy;
      const web = this.embers.find((e) => e.snare && e.at.col === hero.at.col && e.at.row === hero.at.row);
      hero.speed = CLASSES[this.cls].speed * (sprinting ? HERO.sprint : 1) * (web?.snare ?? 1);
      if (sprinting) {
        this.stamina = spend(this.stamina, (STAMINA.sprint * dt) / 1000);
        this.spentAt = time;
      }
      // A press made during a swing is kept, and swings the moment the hero is ready.
      if (this.queued && time >= hero.busy && time >= hero.next) this.attack(time);
      const [x0, y0] = [hero.s.x, hero.s.y];
      const steering = time >= hero.busy && this.steer(dt);
      if (steering) {
        // Walked by the keys this frame.
      } else if (time < hero.busy) {
        // Mid-swing: it holds still.
      } else this.advance(hero, dt);
      this.stepped += Math.hypot(hero.s.x - x0, hero.s.y - y0);
      if (this.stepped >= 1.1 * CELL) (this.stepped = 0, play(STEP, 0.6));
    }
    this.stamina = recover(this.stamina, dt / 1000, (time - this.spentAt) / 1000, this.guarding, this.gear.stamina);
    this.lead(time, dt);
    this.burn(time);
    this.drain(time, dt);
    if (this.aloft && !hero.dead && tileDistance(hero.at, this.aloft) <= 2) this.drop();
    this.foes.forEach((f, i) => {
      if (f.dead) return;
      if (f.windup && time >= f.windup.at) this.land(f, time);
      if (f.feeding) {
        if (time >= f.feeding.until) f.feeding = undefined;
        else this.feed(f, f.feeding.rate * (dt / 1000), time);
      }
      if (f.asleep) return;
      // A boss not yet met waits for its scene: no wind-up drawn before the camera has shown it.
      if (f.kind !== "troll" && !this.met.has(f.kind) && this.isBoss(f)) return;
      const kit = BOSS_KITS[f.kind];
      if (kit?.rage && !f.turned && !f.windup && this.isBoss(f) && this.raging(f)) return this.turn(f, time);
      if (time < f.busy) return;
      // Far from the hero and at home, a monster rests.
      if (tileDistance(f.at, hero.at) > 14 && f.at.col === f.home.col && f.at.row === f.home.row && f.way.length === 0) return;
      // Its mark: the captain or a companion it can see, a Lancer first.
      const marks: Body[] = [...(hero.dead || this.gone ? [] : [hero]), ...this.band.filter((c) => !c.dead)];
      const m = foeTarget(f.at, f.stats.aggro, marks.map((b) => ({ at: b.at, draws: (b as Companion).kind === "lancer" })));
      const mark = marks[m] ?? hero;
      const intent = foeIntent(f.at, f.home, m >= 0 ? mark.at : null, f.stats);
      // A foe that notices nothing (a grave totem) only stands.
      if (f.stats.aggro === 0) return;
      if (kit && m >= 0 && intent !== "return" && time >= f.next) {
        const sees = {
          snared: this.embers.some((e) => e.snare && e.at.col === mark.at.col && e.at.row === mark.at.row),
          adds: this.foes.filter((o) => o.raisedBy === f && !o.dead).length,
          fallen: kit.wards ? this.foes.filter((o) => o.kind === kit.wards && o.dead).length : 0,
        };
        let move = kit.pick(tileDistance(f.at, mark.at), f.last ?? null, this.raging(f), sees);
        const raise = move && kit.moves[move]!.summon;
        if (raise && this.foes.filter((o) => o.raisedBy === f && !o.dead).length >= raise.cap) move = Object.keys(kit.moves).find((k) => !kit.moves[k]!.summon && k !== f.last) ?? null;
        if (move) return this.bossWindUp(f, mark, move, time);
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
    const { mark, move, aim, dazed } = f.windup!;
    f.windup = null;
    if (move) return this.bossLands(f, move, aim!, !!dazed, time);
    if (BEAST[f.kind]?.hit) f.s.anims.msPerFrame = 100;
    f.busy = time + PACE.recover * 1000;
    if (mark.dead) return;
    const missile = MISSILE[f.kind];
    if (missile) return this.loose(f, mark, f.stats.attack, missile);
    if (tileDistance(f.at, mark.at) <= 1 && Math.hypot(mark.s.x - f.s.x, mark.s.y - f.s.y) < 1.6 * CELL) this.hurt(f, mark, f.stats.attack);
  }

  /** A boss past its rage line turns. Its words go up and it stands spent a moment, breathing hard, then flares in its
   *  colour: the camera closes on it, rings go out, the room shakes, and it opens its second phase. It takes no harm
   *  from the first breath to the last ring. */
  private turn(f: Foe, time: number): void {
    const kit = BOSS_KITS[f.kind]!;
    const fx = TURN[f.kind] ?? { colour: 0xffffff, herald: "" };
    const [rest, flare] = [1600, 1600];
    Object.assign(f, { turned: true, turning: time + rest + flare, busy: time + rest + flare, way: [], feeding: undefined });
    this.play(f.s, f.idle);
    if (fx.herald) this.herald(fx.herald);
    // Spent: slowed, bowed, its colour smouldering up off it.
    const [sx, sy] = [f.s.scaleX, f.s.scaleY];
    f.s.anims.timeScale = 0.4;
    this.tweens.add({ targets: f.s, scaleY: sy * 0.94, duration: 400, yoyo: true, repeat: Math.floor(rest / 800) - 1, ease: "Sine.easeInOut" });
    const smoulder = this.time.addEvent({
      delay: 120,
      repeat: Math.floor(rest / 120) - 1,
      callback: () => {
        if (f.dead) return;
        const p = this.add.circle(f.s.x + Phaser.Math.Between(-40, 40), f.s.y - Phaser.Math.Between(0, f.lift), 3, fx.colour).setDepth(DEPTH.fx).setAlpha(0.8);
        this.tweens.add({ targets: p, y: p.y - 60, alpha: 0, duration: 900, ease: "Sine.easeOut", onComplete: () => p.destroy() });
      },
    });
    this.time.delayedCall(rest, () => {
      smoulder.remove();
      if (f.dead) return;
      f.s.anims.timeScale = 1;
      f.s.setScale(sx, sy);
      const cam = this.active;
      const zoom = cam.zoom;
      const [r, g, b] = [(fx.colour >> 16) & 255, (fx.colour >> 8) & 255, fx.colour & 255];
      if (!this.free) cam.zoomTo(zoom * 1.18, 350, "Sine.easeOut", true);
      cam.flash(300, r, g, b);
      f.s.setTintFill(fx.colour);
      this.tweens.add({ targets: f.s, scaleX: sx * 1.12, scaleY: sy * 1.12, duration: 220, yoyo: true, repeat: 2, onComplete: () => !f.dead && (f.s.setScale(sx, sy), untint(f.s)) });
      const [x, y] = [f.s.x, f.s.y];
      for (const delay of [0, 450, 900]) {
        this.time.delayedCall(delay, () => {
          const wave = this.add.ellipse(x, y, 2 * CELL, CELL).setStrokeStyle(8, fx.colour, 0.9).setDepth(DEPTH.fx);
          this.tweens.add({ targets: wave, scale: 9, alpha: 0, duration: 900, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
          cam.shake(260, 0.01);
        });
      }
      // Sparks of its colour drawn in to it, as if the room gives it what it has left.
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const p = this.add.circle(x + Math.cos(a) * 6 * CELL, y + Math.sin(a) * 3.5 * CELL, 5, fx.colour).setDepth(DEPTH.fx).setAlpha(0);
        this.tweens.add({ targets: p, x, y: y - f.lift * 0.5, alpha: { from: 0.9, to: 0.2 }, duration: 900, delay: i * 25, ease: "Quad.easeIn", onComplete: () => p.destroy() });
      }
      this.time.delayedCall(flare - 500, () => {
        if (f.dead) return;
        if (!this.free) cam.zoomTo(zoom, 500, "Sine.easeInOut", true);
        cam.flash(180, r, g, b);
        this.quake(f.at);
        const look = kit.rage?.look && this.look({ kind: kit.rage.look, col: 0, row: 0 });
        if (look) {
          // Drawn as it is now: the boar with its rider gone.
          Object.assign(f, { idle: look.idle.key, move: look.move?.key, attack: undefined });
          f.s.setOrigin(0.5, look.anchor).setScale(look.scale * 2).setData("tint", 0x8a7a70).setTint(0x8a7a70);
          this.play(f.s, f.idle);
        }
      });
      this.time.delayedCall(flare, () => {
        const hero = this.hero;
        if (f.dead || !hero || hero.dead || !kit.rage?.opener) return;
        this.bossWindUp(f, hero, kit.rage.opener, this.time.now);
      });
    });
  }

  /** A boss met for the first time, after the Souls games: the bars come in and the camera leaves the captain for it,
   *  draws in while it rises to the fight in its colour, then comes back and the fight
   *  opens. A sleeping one is only looked on. Nothing strikes or is hurt meanwhile. */
  private meet(f: Foe): void {
    remember(MET, this.met.add(f.kind));
    const hero = this.hero!;
    const [pan, hold] = [1200, 2600];
    const end = this.time.now + 2 * pan + hold;
    this.cinema = true;
    this.gone = true;
    this.shieldUp = false;
    hero.way = [];
    this.play(hero.s, hero.idle);
    for (const o of this.foes) Object.assign(o, { windup: null, way: [], busy: Math.max(o.busy, end) });
    f.turning = Math.max(f.turning ?? 0, end);
    this.hooks.onCinema?.(true);
    const cam = this.active;
    const zoom = cam.zoom;
    cam.stopFollow();
    cam.pan(f.s.x, f.s.y - f.lift * 0.4, pan, "Sine.easeInOut", true);
    cam.zoomTo(zoom * 1.3, pan + hold, "Sine.easeInOut", true);
    const colour = TURN[f.kind]?.colour ?? 0xc8b898;
    this.time.delayedCall(pan, () => {
      if (f.dead || f.asleep) return;
      // It turns on the captain and shows itself: a blow at the air, the ground shaking, a ring of its colour.
      if (f.s.x !== hero.s.x) f.s.setFlipX(hero.s.x < f.s.x);
      if (f.attack && this.anims.exists(`${f.attack}_once`)) {
        f.s.play(`${f.attack}_once`);
        f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && this.play(f.s, f.idle));
      }
      play(TROLL_LAND, 0.5);
      cam.shake(600, 0.008);
      this.quake(f.at);
      const [r, g, b] = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255];
      cam.flash(250, r, g, b);
      for (const delay of [0, 350]) {
        this.time.delayedCall(delay, () => {
          const wave = this.add.ellipse(f.s.x, f.s.y, 2 * CELL, CELL).setStrokeStyle(8, colour, 0.9).setDepth(DEPTH.fx);
          this.tweens.add({ targets: wave, scale: 8, alpha: 0, duration: 1000, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
        });
      }
      // Its colour rising off it through the hold.
      this.time.addEvent({
        delay: 90,
        repeat: Math.floor(hold / 90) - 1,
        callback: () => {
          if (f.dead) return;
          const p = this.add.circle(f.s.x + Phaser.Math.Between(-50, 50), f.s.y - Phaser.Math.Between(0, f.lift), Phaser.Math.Between(2, 4), colour).setDepth(DEPTH.fx).setAlpha(0.8);
          this.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(50, 100), alpha: 0, duration: 1100, ease: "Sine.easeOut", onComplete: () => p.destroy() });
        },
      });
    });
    this.time.delayedCall(pan + hold, () => {
      this.hooks.onCinema?.(false);
      cam.pan(hero.s.x, hero.s.y, pan, "Sine.easeInOut", true);
      cam.zoomTo(zoom, pan, "Sine.easeInOut", true);
    });
    this.time.delayedCall(2 * pan + hold, () => {
      this.cinema = false;
      if (!this.hero || this.free) return;
      cam.startFollow(this.hero.s, true, 0.15, 0.15);
      this.gone = false;
    });
  }

  /** A boss's end, slow: it stops where it stands, its colour drains to grey, it sinks, and it goes up in ash of its
   *  own colour until nothing is left. */
  private perish(f: Foe): void {
    const ms = 3200;
    const colour = TURN[f.kind]?.colour ?? 0xc8b898;
    f.s.anims.timeScale = 0.25;
    this.time.delayedCall(600, () => f.s.anims.stop());
    this.active.shake(500, 0.006);
    const grey = { t: 0 };
    const from = Phaser.Display.Color.IntegerToColor((f.s.getData("tint") as number | undefined) ?? 0xffffff);
    const to = Phaser.Display.Color.IntegerToColor(0x5a5a5e);
    this.tweens.add({
      targets: grey,
      t: 100,
      duration: ms * 0.6,
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, grey.t);
        f.s.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
    this.tweens.add({ targets: f.s, y: f.s.y + 12, alpha: 0, duration: ms, delay: ms * 0.3, ease: "Sine.easeIn", onComplete: () => f.s.destroy() });
    const ash = this.time.addEvent({
      delay: 70,
      repeat: Math.floor(ms / 70) - 1,
      callback: () => {
        if (!f.s.active) return ash.remove();
        const p = this.add.circle(f.s.x + Phaser.Math.Between(-50, 50), f.s.y - Phaser.Math.Between(0, f.lift), Phaser.Math.Between(2, 4), Math.random() < 0.5 ? colour : 0x8a8a8e).setDepth(DEPTH.fx).setAlpha(0.9);
        this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-20, 20), y: p.y - Phaser.Math.Between(60, 120), alpha: 0, duration: 1400, ease: "Sine.easeOut", onComplete: () => p.destroy() });
      },
    });
  }

  /** Struck awake: it starts up with a shake of the ground and its name across the screen. */
  private wake(f: Foe): void {
    f.asleep?.remove();
    f.asleep = undefined;
    f.s.anims.timeScale = 1;
    f.next = 0;
    f.busy = this.time.now + 700;
    this.active.shake(400, 0.014);
    this.quake(f.at);
    const name = this.local?.bosses.find((b) => tileDistance(b, f.home) <= 2)?.name;
    if (name) this.herald(`${name} Wakes`);
  }

  /** Struck, it runs from whoever struck it and is gone, leaving nothing. */
  private flee(f: Foe, from: Body): void {
    Object.assign(f, { dead: true, windup: null, way: [] });
    f.bar.clear();
    if (this.lastHit === f) this.lastHit = null;
    this.tweens.killTweensOf(f.s);
    this.float(f.s.x, f.s.y - f.lift - 40, "Fled", "#fdfaf0");
    const away = Math.sign(f.s.x - from.s.x) || 1;
    f.s.setFlipX(away < 0);
    if (f.move) this.play(f.s, f.move);
    this.tweens.add({ targets: f.s, x: f.s.x + away * 10 * CELL, alpha: 0, duration: 1400, onComplete: () => f.s.destroy() });
  }

  /** Eating: health back, a green mark rising off it now and then. */
  private feed(f: Foe, hp: number, time: number): void {
    f.hp = Math.min(f.max, f.hp + hp);
    if (time - ((f.s.getData("fed") as number | undefined) ?? 0) < 500) return;
    f.s.setData("fed", time);
    this.float(f.s.x + Phaser.Math.Between(-30, 30), f.s.y - f.lift - 40, "+", "#8cd080", 700);
  }

  /** A crown that drinks warmth: a hero inside its ring loses stamina and gets none back there, wisps of it drawn off. */
  private drain(time: number, dt: number): void {
    const f = this.foes.find((o) => !o.dead && BOSS_KITS[o.kind]?.drains && this.isBoss(o));
    if (!f) return void this.aura?.setVisible(false);
    const d = BOSS_KITS[f.kind]!.drains!;
    const radius = f.turned ? (d.raging ?? d.radius) : d.radius;
    if (!this.aura?.active) this.aura = this.add.ellipse(0, 0, 1, 1).setDepth(DEPTH.unit - 1);
    const pulse = 0.35 + 0.15 * Math.sin(time / 250);
    this.aura
      .setVisible(true)
      .setPosition(f.s.x, f.s.y)
      .setSize((2 * radius + 1) * CELL, (2 * radius + 1) * CELL * 0.55)
      .setStrokeStyle(4, 0x9c9fa8, pulse)
      .setFillStyle(0x9c9fa8, pulse * 0.25);
    this.aura.setDisplayOrigin(this.aura.width / 2, this.aura.height / 2);
    const hero = this.hero!;
    if (hero.dead || this.gone || tileDistance(hero.at, f.at) > radius) return;
    this.stamina = spend(this.stamina, (d.rate * dt) / 1000);
    this.spentAt = time;
    if (time < this.wisped) return;
    this.wisped = time + 180;
    const w = this.add.circle(hero.s.x + Phaser.Math.Between(-12, 12), hero.s.y - 30, 4, 0xe8a060).setDepth(DEPTH.fx);
    this.tweens.add({ targets: w, x: f.s.x, y: f.s.y - f.lift * 0.6, alpha: { from: 0.9, to: 0.3 }, duration: 500, ease: "Quad.easeIn", onComplete: () => w.destroy() });
  }

  /** One of the king's raised dead goes to a broken ward and stands it up again; if they are all cut down, nothing. */
  private rouse(f: Foe, kind: string, at: Cell | undefined): void {
    const dead = this.foes.find((o) => o.raisedBy === f && !o.dead);
    const old = at && this.foes.find((o) => o.kind === kind && o.dead && o.home.col === at.col && o.home.row === at.row);
    if (!dead || !old || !at) return;
    const [tx, ty] = [(at.col + 0.5) * CELL, (at.row + 0.5) * CELL];
    const g = this.add.graphics().setDepth(DEPTH.fx).lineStyle(5, 0x8cf0b4, 0.9).lineBetween(dead.s.x, dead.s.y - 30, tx, ty);
    this.tweens.add({ targets: g, alpha: 0, duration: 700, onComplete: () => g.destroy() });
    Object.assign(dead, { dead: true, windup: null, way: [] });
    dead.bar.clear();
    this.tweens.add({ targets: dead.s, alpha: 0, scale: 0.2, x: tx, y: ty, duration: 500, onComplete: () => dead.s.destroy() });
    // The old ward's place is taken by the new: the one left broken counts no more.
    this.time.delayedCall(0, () => this.foes.splice(this.foes.indexOf(old), 1));
    this.addFoe({ kind, col: at.col, row: at.row });
    const ward = this.foes.at(-1)!;
    const y = ward.s.y;
    ward.s.setAlpha(0).setY(y + 30);
    this.tweens.add({ targets: ward.s, alpha: 1, y, duration: 700, ease: "Back.easeOut" });
    this.blast(at, 0x8cf0b4);
    this.active.shake(200, 0.008);
    this.float(tx, ty - 80, "Warded", "#8cf0b4");
  }

  /** The Belfry's bell, struck: its toll dazes all the stone in the loft, the roof shaken; it rings again after a while. */
  private toll(time: number): void {
    const bell = this.local?.arena?.bell;
    if (!bell || tileDistance(this.hero!.at, bell) > 3 || time < this.tolled) return;
    this.tolled = time + 12000;
    play(CLASH, 1);
    const [x, y] = [(bell.col + 0.5) * CELL, (bell.row + 0.5) * CELL];
    for (const delay of [0, 300, 600]) {
      this.time.delayedCall(delay, () => {
        const wave = this.add.ellipse(x, y, 2 * CELL, CELL).setStrokeStyle(6, 0xd8b060, 0.9).setDepth(DEPTH.fx);
        this.tweens.add({ targets: wave, scale: 12, alpha: 0, duration: 1100, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
      });
    }
    this.active.shake(600, 0.012);
    this.quake(bell);
    for (const f of this.foes) {
      if (f.dead || !STONE.has(f.kind)) continue;
      f.windup = null;
      f.busy = f.open = time + 3000;
      this.play(f.s, f.idle);
      this.float(f.s.x, f.s.y - f.lift - 40, "Dazed", "#fdfaf0");
    }
  }

  /** Whether a boss is down past its kit's rage line, and winds up the quicker for it. */
  private raging(f: Foe): boolean {
    const rage = BOSS_KITS[f.kind]?.rage;
    return !!rage && f.hp <= f.max * rage.at;
  }

  /** A boss draws back for one of its moves, the cells it will fall on glowing on the ground until it lands. */
  private bossWindUp(f: Foe, mark: Body, name: string, time: number): void {
    const kit = BOSS_KITS[f.kind]!;
    const move = kit.moves[name]!;
    const ms = move.windup * 1000 * (this.raging(f) ? kit.rage!.haste : 1);
    const fallen = move.revive && this.foes.find((o) => o.kind === move.revive && o.dead);
    const aim = fallen ? [fallen.home] : bossAim(move, f.at, mark.at, (c) => isWalkable(c.col, c.row) && !this.shut(c));
    // A charge that stops short of its full run has hit a wall.
    const reach = Math.min(move.tiles ?? 0, tileDistance(f.at, mark.at) + (move.past ?? Infinity));
    const dazed = !!move.stun && bossAim({ ...move, width: 1 }, f.at, mark.at, (c) => isWalkable(c.col, c.row) && !this.shut(c)).length < reach;
    Object.assign(f, { last: name, way: [], windup: { at: time + ms, mark, move: name, aim, dazed }, next: time + f.stats.every * 1000, busy: time + ms });
    const tell = f.kind === "troll" && TROLL_TELL[name];
    if (tell) play(tell, 0.8);
    if (Math.abs(mark.s.x - f.s.x) > 4) f.s.setFlipX(mark.s.x < f.s.x);
    f.s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => untint(f.s));
    if (this.anims.exists(`beast_${f.kind}_windup_once`)) f.s.play(`beast_${f.kind}_windup_once`);
    else if (f.attack && this.anims.exists(`${f.attack}_once`)) {
      // No wind-up sheet: its attack, drawn out over the wind-up.
      f.s.play({ key: `${f.attack}_once`, frameRate: (this.textures.get(f.attack).frameTotal * 1000) / ms });
      f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && this.play(f.s, f.idle));
    }
    const colour = move.summon ? 0x9a6ae0 : move.snare ? 0xf0ece0 : move.burn ? 0xff9a3a : 0xe03a2a;
    const g = this.add.graphics().setDepth(DEPTH.unit - 1);
    for (const c of aim) g.fillStyle(colour, 0.45).fillRect(c.col * CELL + 2, c.row * CELL + 2, CELL - 4, CELL - 4);
    this.tweens.add({ targets: g, alpha: { from: 0.4, to: 1 }, duration: ms, onComplete: () => g.destroy() });
  }

  /** A boss's move lands on its cells: a blow, a charge carrying it down its line, ground left burning, or the dead raised. */
  private bossLands(f: Foe, name: string, aim: Cell[], dazed: boolean, time: number): void {
    const kit = BOSS_KITS[f.kind]!;
    const move = kit.moves[name]!;
    f.busy = time + (move.recover ?? kit.recover) * 1000;
    f.open = kit.dazedOnly ? 0 : f.busy;
    if (this.anims.exists(`beast_${f.kind}_recovery_once`)) {
      f.s.play(`${f.attack}_once`);
      f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && f.s.play(`beast_${f.kind}_recovery_once`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => !f.dead && this.play(f.s, f.idle)));
    } else this.play(f.s, f.idle);
    if (move.summon) {
      for (const at of aim) {
        this.addFoe({ kind: move.summon.kind, col: at.col, row: at.row });
        const raised = this.foes.at(-1)!;
        raised.raisedBy = f;
        if (kit.rage?.look && f.turned) {
          // Thrown: it comes off the boar's back in an arc and lands rolling.
          const [x, y] = [raised.s.x, raised.s.y];
          raised.s.setPosition(f.s.x, f.s.y - 40);
          raised.busy = time + 1200;
          this.tweens.add({ targets: raised.s, x, duration: 600, ease: "Sine.easeOut" });
          this.tweens.add({ targets: raised.s, y: { from: f.s.y - 40, to: y - 2 * CELL }, duration: 300, ease: "Quad.easeOut", yoyo: false, onComplete: () => this.tweens.add({ targets: raised.s, y, angle: 360, duration: 300, ease: "Quad.easeIn", onComplete: () => (raised.s.setAngle(0), this.blast(at, 0xc8b898), this.active.shake(120, 0.006)) }) });
          continue;
        }
        raised.s.setAlpha(0);
        this.tweens.add({ targets: raised.s, alpha: 1, duration: 500 });
        this.blast(at, move.colour ?? 0x9a6ae0);
      }
      return;
    }
    if (move.revive) return this.rouse(f, move.revive, aim[0]);
    if (move.feeds) {
      f.feeding = { until: f.busy, rate: move.feeds };
      f.open = f.busy;
      this.float(f.s.x, f.s.y - f.lift - 70, "Eating", "#8cd080");
      return;
    }
    const on = new Set(aim.map((c) => `${c.col},${c.row}`));
    const struck = (dmg: number) => {
      for (const b of [this.hero!, ...this.band]) if (!b.dead && on.has(`${b.at.col},${b.at.row}`)) this.hurt(f, b, dmg);
    };
    if (move.shape === "line") {
      const end = aim.at(-1);
      if (!end) return;
      if (f.kind === "troll") play(TROLL_CHARGE, 0.8);
      const ms = (aim.length / (move.speed ?? 12)) * 1000;
      f.busy += ms;
      // Cut short by a wall: dazed where it stopped.
      if (move.stun && dazed) {
        f.busy += move.stun * 1000;
        this.time.delayedCall(ms, () => {
          if (f.dead) return;
          this.active.shake(200, 0.008);
          this.float(f.s.x, f.s.y - f.lift - 40, "Dazed", "#fdfaf0");
          if (f.kind === "troll") (play(TROLL_ROCK), this.time.delayedCall(250, () => !f.dead && play(TROLL_DAZED, 0.7)));
        });
      }
      f.open = kit.dazedOnly && !dazed ? 0 : f.busy;
      if (move.wake) this.scorch(f, aim, ms, move.wake);
      f.at = end;
      // It hits whoever it runs into, once each, as it passes: not whoever stood on its line when it set off.
      const touch = ((move.width ?? 1) / 2 + 0.3) * CELL;
      const hit = new Set<Body>();
      this.tweens.add({
        targets: f.s,
        x: (end.col + 0.5) * CELL,
        y: (end.row + 0.75) * CELL,
        duration: ms,
        onUpdate: () => {
          f.s.setDepth(standing(f.s.y));
          for (const b of [this.hero!, ...this.band])
            if (!f.dead && !b.dead && !hit.has(b) && Math.hypot(b.s.x - f.s.x, b.s.y - f.s.y) < touch) (hit.add(b), this.hurt(f, b, move.damage));
        },
      });
      return;
    }
    if (move.burn) {
      for (const at of aim) {
        const y = (at.row + 0.75) * CELL;
        const s = this.add.sprite((at.col + 0.5) * CELL, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(move.snare ? 0.4 : 0.55).setDepth(DEPTH.unit - 1);
        if (move.colour) s.setTint(move.colour);
        // A web is a thread strung on the ground, not a flame: drawn pale and still.
        if (move.snare) s.setAlpha(0.7);
        else this.loop(s, "fire");
        this.embers.push({ at, until: time + move.burn * 1000, tick: time, every: (move.tick ?? 0.5) * 1000, damage: move.damage, snare: move.snare, from: f, s });
      }
      return;
    }
    if (f.kind === "troll" && (name === "slam" || name === "sweep")) play(TROLL_SLAM, name === "slam" ? 1 : 0.7);
    this.active.shake(160, 0.006);
    if (move.shape === "scatter" || move.shape === "mark" || move.shape === "ring") for (const at of move.shape === "ring" ? aim.filter((_, i) => i % 3 === 0) : aim) this.blast(at, move.colour ?? 0xffffff);
    struck(move.damage);
  }

  /** A charge's wake: each cell of its line set alight as the boss passes over it. */
  private scorch(f: Foe, aim: Cell[], ms: number, wake: { burn: number; damage: number }): void {
    aim.forEach((at, i) =>
      this.time.delayedCall(((i + 1) / aim.length) * ms, () => {
        if (f.dead) return;
        const now = this.time.now;
        const s = this.add.sprite((at.col + 0.5) * CELL, (at.row + 0.75) * CELL, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.5).setDepth(DEPTH.unit - 1);
        this.loop(s, "fire");
        this.embers.push({ at, until: now + wake.burn * 1000, tick: now + 400, every: 600, damage: wake.damage, from: f, s });
      }),
    );
  }

  /** A burst on a cell: the pack's explosion, played once. */
  private blast(at: Cell, tint: number): void {
    if (!this.textures.exists("blast")) return;
    if (!this.anims.exists("blast_once")) this.anims.create({ key: "blast_once", frames: this.anims.generateFrameNumbers("blast"), frameRate: 16, repeat: 0 });
    const y = (at.row + 0.5) * CELL;
    const s = this.add.sprite((at.col + 0.5) * CELL, y, "blast").setScale(0.5).setDepth(DEPTH.fx).setTint(tint);
    s.play("blast_once").once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  /** Burning ground dies down in time, and burns whoever stands in it every tick; a shield is no help against the ground. */
  private burn(time: number): void {
    this.embers = this.embers.filter((e) => {
      if (time >= e.until) return void e.s.destroy();
      if (time >= e.tick) {
        e.tick = time + e.every;
        if (e.damage) for (const b of [this.hero!, ...this.band]) if (!b.dead && b.at.col === e.at.col && b.at.row === e.at.row) this.hurt(e.from, b, e.damage, true);
      }
      return true;
    });
  }

  // A boss kind counts only where the area places that boss: the Greyfall's own troll is rank and file.
  private isBoss(f: Foe): boolean {
    return BOSSES.has(f.kind) && !!this.local?.bosses.some((b) => tileDistance(b, f.home) <= 2);
  }

  /** A boss that has fallen; one of its kind elsewhere, like the Greyfall's troll, still stands. */
  private slain(d: Dweller): boolean {
    return remembered(SLAIN).has(d.kind) && !!this.local?.bosses.some((b) => tileDistance(b, d) <= 2);
  }

  /** A boss down: it stays down for good, and its key, if it has one, is the captain's. */
  private felled(boss: Foe): void {
    const kind = boss.kind;
    remember(SLAIN, remembered(SLAIN).add(kind));
    if (this.local?.arena?.boss === kind) this.liftFog();
    const flask = BOSS_FLASK.has(kind);
    if (flask) {
      this.flasks += 1;
      this.hooks.onFlasks?.(this.flasks);
    }
    // A beat for the body to go down before the word comes up.
    this.herald("Enemy fell", 1500);
    if (flask) this.herald("Ember gained");
  }

  /** A word on the banner, `after` ms on at the soonest, and after any still showing: the banner holds 4.2 s. */
  private herald(text: string, after = 0): void {
    const wait = Math.max(after, this.heraldUntil - this.time.now);
    this.heraldUntil = this.time.now + wait + 4400;
    this.time.delayedCall(wait, () => (play(HERALD), this.hooks.onHerald?.(text)));
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
      const once = /_(attack|windup|recovery)$/.test(key) || [HERO_ART.warrior.attack.key, HERO_ART.warrior.attack2.key, COMPANION_ATTACK.lancer.key, COMPANION_ATTACK.archer.key, COMPANION_ATTACK.monk.key, HEAL_FX.key].includes(key);
      if (once && !this.anims.exists(`${key}_once`)) {
        // The hero's swings fill the wait to the next one (4 frames, 0.4 s) rather than snap through and stand idle.
        // The hero's swings fill the wait to the next; a monster's attack plays out over its wind-up.
        const rate = key === HERO_ART.warrior.attack.key || key === HERO_ART.warrior.attack2.key || (key.startsWith("beast_") && /_(attack|windup|recovery)$/.test(key)) ? 10 : key === HEAL_FX.key ? 12 : 16;
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
    const roads = !this.local ? trailTiles(tier.roads) : this.local.streets ? trailTiles(tier.roads, true, solidCells(tier)) : new Set<number>();
    const local = this.local;
    // An area map's ground reads a shade lighter each height up; the engine works each tile's colour out.
    const shade = local ? groundColours(local) : null;
    // High ground's layers under its own top show only where that top's edge is cut round: there they are the ground
    // beside it at that height, so a corner shows the floor's colour, not the plateau's own.
    const beside = (c: number, r: number, lv: number): number | null | undefined => {
      for (const [dc, dr] of [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
        if (level(c + dc, r + dr) === lv && !isSlope(c + dc, r + dr) && shade?.[r + dr]?.[c + dc] != null) return shade[r + dr]![c + dc];
      }
      return shade?.[r]?.[c];
    };
    buildMap(this, roads, (c, r, lv) => {
      // A stair stands on the lower ground at its foot: the art is see-through round the ramp, so that ground shows there.
      if (shade) return `tilesetC${(isSlope(c, r) && lv < level(c, r) ? shade[r + 1]?.[c] : lv < level(c, r) ? beside(c, r, lv) : shade[r]?.[c]) ?? 4}`;
      const ch = tier.areaAt[r]?.[c];
      // The rock of the Underneath, and anything outside an area, in the dustiest green.
      const p = ch && ch !== "-" ? AREAS[AREA_CODE.indexOf(ch)]!.palette : [4, 4, 4];
      return `tilesetC${p[Math.min(2, lv - 1)]}`;
    });
    if (tier.base === "sky") this.skyBeneath();
    // Under the rock, black water: the Underneath's lakes. Rock draws no tile of its own, so this under the mood is
    // the rock too, and it runs ROCK_PAD past the grid with the mood.
    if (tier.base === "rock") {
      const [W, H, P] = [STRAT_COLS * CELL, STRAT_ROWS * CELL, ROCK_PAD * CELL];
      // In an area's own map the rock past the grid is its ground in the dark, as the rock tiles inside it are.
      const edge = shade ? this.textures.getPixel(80, 80, `tilesetC${shade[0]?.[0] ?? 4}`, "__BASE")?.color : undefined;
      this.add.rectangle(W / 2, H / 2, W + 2 * P, H + 2 * P, edge ?? 0x1f4656).setDepth(DEPTH.water);
      if (edge !== undefined) this.add.rectangle(W / 2, H / 2, W, H, 0x1f4656).setDepth(DEPTH.water);
    }
    this.dress(tier, roads);
    for (const p of tier.props) this.addProp(p, tier.base);
    for (const f of tier.fences) this.fence(f.col, f.row, f.w, f.h, f.gate, f.gateW);
    for (const g of tier.gates) this.gatehouse(g.kind, g.cells);
    for (const f of tier.campfires) this.bonfire(f);
    for (const f of tier.fires) this.bonfire(f, !!this.local && !remembered(KINDLED).has(this.fireKey(f)));
    // A walker goes round a building as round a fence: never through its walls, though into a cave. A house's or a mine's
    // art spans half of each tile beside its own and the row behind, wider than its footprint: a walker keeps off it all.
    const posts = solidCells({ props: tier.props.filter((p) => COVER_ART.has(p.art) && p.art !== "cave"), fences: tier.fences });
    for (const p of tier.props) {
      if (!p.art.startsWith("house") && p.art !== "goldMine") continue;
      const [col, row] = [Math.round(p.col), Math.round(p.row)];
      for (let r = row - 1; r <= row; r++) for (let c = col - 1; c <= col + 1; c++) posts.add(`${c},${r}`);
    }
    for (const d of tier.dwellers) this.addDweller(d, posts);
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
    const spot = (c: number, r: number, k: string, sheet: Sheet, frame?: number, square = false, low = false): Phaser.GameObjects.Sprite => {
      const x = (c + (square ? 0.5 : 0.25 + r01() * 0.5)) * CELL;
      const y = (r + (square ? 0.9 : 0.7 + r01() * 0.3)) * CELL;
      const s = this.add.sprite(x, y, k, frame).setOrigin(0.5, sheet.anchor).setScale((sheet.scale ?? 1) * (low ? 0.6 : square ? 0.85 : 0.85 + r01() * 0.3)).setDepth(standing(y));
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
    // No rock in the water under a moored boat.
    const boats = tier.props.filter((p) => p.art === "boat");
    // Nor on a fence's line or the tile outside it, so no bush or rock tangles with the posts.
    for (const f of tier.fences) for (let r = f.row - 1; r <= f.row + f.h; r++) for (let c = f.col - 1; c <= f.col + f.w; c++) if (r <= f.row || r >= f.row + f.h - 1 || c <= f.col || c >= f.col + f.w - 1) built.add(r * STRAT_COLS + c);
    // Nor on a fire or the ring round it, where a rock would block the way to it.
    for (const f of [...tier.fires, ...tier.campfires]) for (let r = f.row - 1; r <= f.row + 1; r++) for (let c = f.col - 1; c <= f.col + 1; c++) built.add(r * STRAT_COLS + c);
    // Nor on a note or the two rows south of it, whose art would stand over the paper; woods keep their trees.
    for (const n of this.local?.notes ?? []) for (let r = n.at.row; r <= n.at.row + 2; r++) for (let c = n.at.col - 1; c <= n.at.col + 1; c++) if (!isForest(c, r)) built.add(r * STRAT_COLS + c);
    // Nor round a stair or a way out, where even scenery reads as a block.
    const ways = (this.local?.exits ?? []).map((e) => e.at);
    for (let r = 0; r < STRAT_ROWS; r++) for (let c = 0; c < STRAT_COLS; c++) if (isSlope(c, r)) ways.push({ col: c, row: r });
    for (const w of ways) for (let r = w.row - 1; r <= w.row + 1; r++) for (let c = w.col - 1; c <= w.col + 1; c++) if (!isForest(c, r)) built.add(r * STRAT_COLS + c);
    // What a rock may not crowd: every solid prop and post, and each rock already set in the way.
    const shut = solidCells(tier);
    // Nor on a woodcutter's way to its tree, or the row below it, whose trees would stand over the walker.
    for (const d of tier.dwellers) {
      if (d.act !== "fell" || !d.to) continue;
      for (const w of findPath({ col: d.col, row: d.row }, d.to) ?? []) for (const r of [w.row, w.row + 1]) built.add(r * STRAT_COLS + w.col);
    }
    // A worked wood, as the pack draws one: pine and birch in clumps where this field runs high, stumps round them.
    const groves = (c: number, r: number): boolean => !!this.local && !!districtOf(this.local, c, r)?.groves;
    const clump = (c: number, r: number): number => (Math.sin(c * 0.8 + Math.sin(r * 0.5) * 2) + Math.sin(r * 0.85 + Math.sin(c * 0.45) * 2) + 2) / 4;
    // The Emberwood's trees are its walls: a wood's tile beside open ground stands its tree square in the tile, so no crown
    // reads as wall over a lane, and a tree means a wall wherever it stands.
    const walled = this.local?.area === "emberwood";
    const edge = (c: number, r: number): boolean => walled && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => isWalkable(c + dc!, r + dr!));
    // A tree's crown rises some three tiles over its own: with open ground that near to its north it would stand over the
    // way, so it grows low there.
    const low = (c: number, r: number): boolean => walled && (isWalkable(c, r - 1) || isWalkable(c, r - 2) || isWalkable(c - 1, r - 1) || isWalkable(c + 1, r - 1));
    const woodTree = (c: number, r: number): void => {
      if (r01() < 0.55) {
        const pick = r01() < 0.5 ? 0 : 1;
        spot(c, r, `bigTree${pick}`, BIG_TREE[pick]!);
      } else decor("tree", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.75 + r01() * 0.2) * CELL);
    };
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        // A thin line of woods is a hedgerow; a mass of them is a wood, whose trees take their kind from a spot a few
        // tiles off, so two districts' woods mingle rather than meet in a line.
        let woods = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc || dr) && isForest(c + dc, r + dr)) woods++;
        const hedge = !!this.local && tier.base !== "rock" && woods <= 3 && !walled;
        const k = (n: number): number => Math.round(((((Math.sin(c * 12.9898 + r * 78.233 + n) * 43758.5453) % 1) + 1) % 1) * 8 - 4);
        const id = (this.local && isForest(c, r) && !hedge && areaId(c + k(1), r + k(2))) || areaId(c, r);
        // A wood's tile always shows its tree: a bare one would be a wall nobody can see.
        if (built.has(r * STRAT_COLS + c) && isLand(c, r) && !isForest(c, r)) continue;
        // The rock of the Underneath is bare: its dark is the point.
        if (at(c, r) === "%") continue;
        if (!isLand(c, r)) {
          if (tier.base === "sky") continue;
          let coast = false;
          for (let d = -2; d <= 2; d++) coast ||= isLand(c + d, r) || isLand(c, r + d);
          if (coast && r01() < (c < 30 && tier.base === "sea" ? 0.1 : 0.05) && !boats.some((p) => tileDistance(p, { col: c, row: r }) <= 2)) decor("waterRock", (c + r01()) * CELL, (r + r01()) * CELL);
          continue;
        }
        if (isForest(c, r)) {
          if (hedge) {
            // Bushes along the line, a tree every few tiles: full trees on every tile piled into a wall.
            decor("bush", (c + 0.5) * CELL, (r + 0.85) * CELL, 1.1);
            if (r01() < 0.3) decor("tree", (c + 0.4 + r01() * 0.2) * CELL, (r + 0.8) * CELL);
          } else if (groves(c, r)) {
            woodTree(c, r);
            if (r01() < 0.35) decor("tree", (c + r01()) * CELL, (r + 0.45) * CELL);
          } else if (id === "emberwood") {
            const pick = r01() < 0.55 ? 0 : 1;
            // Still, not swaying: the first frame of the sheet.
            spot(c, r, `bigTree${pick}`, BIG_TREE[pick]!, 0, edge(c, r) || low(c, r), low(c, r));
            if (!edge(c, r) && !low(c, r) && r01() < 0.3) decor("tree", (c + 0.2 + r01() * 0.6) * CELL, (r + 0.5) * CELL);
          } else if (tier.base === "rock" && this.local) {
            // An underground map's walls stay bare: a rock set on a wall tile draws on its face. The floor's scatter
            // puts the rubble at their foot.
          } else if (id === "barrowmoor" || id === "greyfall" || tier.base === "rock") {
            // A burnt stretch of the Emberwood is walled by its dead trees, every tile; elsewhere a bush stands in for some.
            if (walled || r01() < 0.45) spot(c, r, "prop_deadTree", { ...PROP.deadTree!, scale: walled && !low(c, r) ? 0.55 : 0.42 }, 0, edge(c, r));
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
        // Trees on the high ground, two tiles back from its rim: the engine leaves it open, so they are only dressing, and
        // a strip too narrow for that is a way across, kept clear.
        const byLift = this.map.lifts.some((l) => [l.up, l.down].some((e) => e.tier === tier.id && Math.abs(e.at.col - c) <= 1 && Math.abs(e.at.row - r) <= 2));
        if (level(c, r) >= 2 && isWalkable(c, r) && !isSlope(c, r) && tier.base !== "rock" && !byLift) {
          // A worked wood's groves come to a tile off the rim, or its ledges would stand bare.
          const back = groves(c, r) ? 1 : 2;
          let rim = false;
          for (let dr = -back; dr <= back; dr++) for (let dc = -back; dc <= back; dc++) rim ||= level(c + dc, r + dr) !== level(c, r) || isSlope(c + dc, r + dr);
          const own = (this.local && districtOf(this.local, c, r)?.trees);
          const odds = own ?? (id === "emberwood" ? 0.3 : id === "crags" && this.local ? 0.16 : id === "crags" || id === "saltreach" ? 0.08 : 0.03);
          const grove = !rim && groves(c, r);
          if (grove) {
            const g = clump(c, r);
            if (r01() < (g > 0.6 ? 0.75 : 0.03)) {
              woodTree(c, r);
              continue;
            }
            if (g > 0.45 && r01() < 0.12) {
              spot(c, r, "prop_stump", PROP.stump!, 0);
              continue;
            }
          } else if (!rim && r01() < odds) {
            // No tree on the Emberwood's walkable high ground, where a tree means a wall: undergrowth instead.
            if (walled) decor("bush", (c + 0.3 + r01() * 0.4) * CELL, (r + 0.8) * CELL, 0.9);
            else if (id === "emberwood") {
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
          // Not underground, where the stone would sit on the cave wall's face.
          if (tier.base !== "rock" && !isWalkable(c, r) && level(c, r - 1) > level(c, r) && r01() < 0.45) decor(r01() < 0.6 ? "bush" : "rock", (c + 0.25 + r01() * 0.5) * CELL, (r + 0.92) * CELL);
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
        // Underground, a rock under a wall stands up over its face: none there.
        if (roll < chance && !(tier.base === "rock" && !isWalkable(c, r - 1))) {
          const x = (c + 0.2 + r01() * 0.6) * CELL;
          const y = (r + 0.5 + r01() * 0.35) * CELL;
          // A rock or stump with two tiles of open level ground all round stands in the way; one nearer a cliff, a stair,
          // a building or another rock stays scenery, or it could narrow a pass to one tile or seal it.
          const block = (s: Phaser.GameObjects.Sprite, art: string): void => {
            if (edgy || !this.local || walled) return;
            for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
              const [x, y] = [c + dc, r + dr];
              if (!isWalkable(x, y) || isSlope(x, y) || level(x, y) !== level(c, r) || shut.has(`${x},${y}`)) return;
            }
            shut.add(`${c},${r}`);
            this.solid.add(`${c},${r}`);
            this.boxed.add(`${c},${r}`);
            const b = BASE[art]!;
            const cx = s.x + b.dx * (s.flipX ? -1 : 1) * s.scaleX;
            this.bases.push({ x0: cx - (b.w * s.scaleX) / 2, x1: cx + (b.w * s.scaleX) / 2, y0: s.y - 12, y1: s.y });
          };
          // Bones only where the dead lie: the moor, and a room dressed as it; elsewhere underground, bare floor.
          if ((id === "barrowmoor" || tier.base === "rock") && r01() < 0.5) {
            if (id === "barrowmoor" || (this.local && districtOf(this.local, c, r)?.dress === "barrowmoor")) spot(c, r, "prop_bones", PROP.bones!, 0);
          }
          // A stump is too small to read as in the way: scenery, never a block.
          else if (id === "emberwood" && r01() < 0.35) spot(c, r, "prop_stump", PROP.stump!, 0);
          else if (roll < chance * 0.6 && tier.base !== "rock") decor("bush", x, y, 0.75);
          else {
            const rock = decor("rock", x, y, 1);
            block(rock, rock.texture.key);
          }
        }
      }
    }
  }

  /** Stacks a pile to `n` logs, as many as it holds at most. */
  private heap(pile: LogPile, n: number): void {
    pile.n = Math.min(n, pile.logs.length);
    pile.logs.forEach((l, i) => l.setVisible(i < pile.n));
  }

  private addProp(p: Placed, base: AtlasTier["base"]): void {
    if (p.art === "tree" || p.art === "bush" || p.art === "rock" || p.art === "waterRock") {
      // Scenery set by hand, at its feet as the title scene places it.
      const s = addDecor(this, p.art, p.col * CELL, p.row * CELL, p.scale ?? 1, `prop${p.col},${p.row}`);
      if (p.art === "waterRock") s.setDepth(DEPTH.foam);
      this.track(s);
      return;
    }
    const x = (p.col + 0.5) * CELL;
    const y = (p.row + 0.95) * CELL;
    if (p.color) {
      const spec = BUILDINGS[p.art as keyof typeof BUILDINGS];
      this.add.image(x, y, this.buildingKey(p)).setOrigin(0.5, spec.anchorY / spec.h).setScale(p.scale ?? 1).setFlipX(p.flip ?? false).setDepth(standing(y));
      return;
    }
    if (LOGS[p.art]) {
      // The pack's one log stacked, each row up drawn over the row below; a pile starts half full, a store's stack more.
      const logs = LOGS[p.art]!.map(([dx, dy], i) => this.add.image(x + dx, y + dy, "prop_woodPile").setOrigin(0.5, PROP.woodPile!.anchor).setScale(LOG_SCALE[p.art]!).setDepth(standing(y) + i * 0.1));
      const pile: LogPile = { at: { col: Math.round(p.col), row: Math.round(p.row) }, logs, n: 0, stack: p.art === "logStack" };
      this.logPiles.push(pile);
      this.heap(pile, pile.stack ? 8 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 3));
      return;
    }
    if (p.art === "sconce") {
      // A torch in its bracket on a crypt wall: a small flame and its pool of light, on the wall behind whoever passes.
      const flame = this.add.sprite(x, y - 30, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.32).setDepth(DEPTH.unit - 1);
      this.loop(flame, "fire");
      this.track(flame);
      const glow = this.add.image(x, y - 40, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb870).setAlpha(0.45).setScale(0.8).setDepth(this.lightDepth());
      this.tweens.add({ targets: glow, alpha: 0.6, duration: 700 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return;
    }
    if (p.art === "steam") {
      // Warm water breathing: a puff of steam off it now and then, rising and gone.
      const [x0, y0] = [p.col * CELL, (p.row + 0.4) * CELL];
      this.time.addEvent({
        delay: 650,
        loop: true,
        callback: () => {
          const puff = this.add.image(x0 + Phaser.Math.Between(-40, 40), y0, `cloud${Phaser.Math.Between(1, 8)}`).setScale(0.12).setAlpha(0.6).setDepth(DEPTH.clouds - 2);
          this.tweens.add({ targets: puff, y: y0 - 90, scale: 0.3, alpha: 0, duration: 2600, ease: "Sine.easeOut", onComplete: () => puff.destroy() });
        },
      });
      return;
    }
    if (p.art === "flame") {
      // A fire on bare ground, no stones round it and no rest by it: only its light.
      const flame = this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.32).setDepth(standing(y));
      this.loop(flame, "fire");
      this.track(flame);
      const glow = this.add.image(x, y - 12, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb870).setAlpha(0.45).setScale(0.8).setDepth(this.lightDepth());
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
    // Gold glints now and then, as the pack's highlight sheets play it, each stone at its own moment.
    else if (p.art === "goldStone" || p.art.startsWith("ore")) {
      if (!this.anims.exists(`${key}_glint`)) this.anims.create({ key: `${key}_glint`, frames: this.anims.generateFrameNumbers(key), frameRate: 10, repeat: -1, repeatDelay: 3000 });
      s.playAfterDelay(`${key}_glint`, Math.random() * 3600);
    }
    // Gold in the rock of the Underneath glows.
    const shine = p.art === "goldStone" && base === "rock" ? this.add.image(x, y - 20, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe27a).setAlpha(0.5).setScale(0.9).setDepth(DEPTH.clouds - 2) : null;
    this.track(s);
    if (stone) this.piles.push({ at: { col: p.col, row: p.row }, gold: GOLD_STONE, s, stone, ...(shine && { shine }) });
  }

  /** A fence pen: corners, rails and posts from the kit's 4x3 tile sheet. */
  private fence(col: number, row: number, w: number, h: number, gate?: number, gateW?: number): Phaser.GameObjects.Image[] {
    const made: Phaser.GameObjects.Image[] = [];
    /** One tile of the sheet; `crop` keeps only part of the frame, so an end piece shows no rail running off into nothing. */
    const piece = (c: number, r: number, frame: number, crop?: [number, number, number, number]): void => {
      const y = (r + 1) * CELL;
      const img = this.add.image(c * CELL + CELL / 2, y, "fence", frame).setOrigin(0.5, 1).setDepth(standing(y));
      if (crop) img.setCrop(...crop);
      made.push(img);
    };
    // The sheet is a pen's parts: corners, rails, sides. A straight run takes its ends from the corners, cut down to the
    // post and the rail that carries on along the run; a lone post is an end piece cut down to the post alone.
    if (w === 1 && h === 1) {
      piece(col, row, 10, [0, 0, 44, 64]);
      return made;
    }
    if (w === 1) {
      for (let r = row; r < row + h; r++) piece(col, r, r === row ? 0 : r === row + h - 1 ? 8 : 4, r === row || r === row + h - 1 ? [0, 0, 44, 64] : undefined);
      return made;
    }
    if (h === 1) {
      for (let c = col; c < col + w; c++) piece(c, row, c === col ? 0 : c === col + w - 1 ? 3 : 1 + (c % 2), c === col || c === col + w - 1 ? [0, 0, 64, 54] : undefined);
      return made;
    }
    for (let c = col; c < col + w; c++) {
      const first = c === col;
      const last = c === col + w - 1;
      piece(c, row, first ? 0 : last ? 3 : 1 + (c % 2));
      // The sheet's bottom row is a gate, each middle piece stopping at its post: a closed run takes the top's rails.
      const shut = (k: number) => !inGate({ col, gate, gateW }, k);
      // A corner beside the gate keeps its post but not the rail that would run on across the opening.
      if (shut(c)) piece(c, row + h - 1, first ? 8 : last ? 11 : !shut(c + 1) ? 9 : !shut(c - 1) ? 10 : 1 + (c % 2), first && !shut(c + 1) ? [0, 0, 50, 64] : last && !shut(c - 1) ? [16, 0, 48, 64] : undefined);
    }
    for (let r = row + 1; r < row + h - 1; r++) {
      piece(col, r, 4);
      piece(col + w - 1, r, 7);
    }
    return made;
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

  /** Where a fire's or a torch's light is drawn: over everyone, except at dusk, where the dusk already lights the ground
   *  round each fire and a glow on top only bleaches whoever stands in it, so there it lies on the ground under them. */
  private lightDepth(): number {
    return this.local && DUSK[this.local.area] ? DEPTH.unit - 1 : DEPTH.clouds - 2;
  }

  /** A bonfire: flames, a warm light that breathes, and stones round it. Unlit, cold logs in the ring until E lights it. */
  private bonfire(f: Cell, unlit = false): void {
    const x = (f.col + 0.5) * CELL;
    const y = (f.row + 0.8) * CELL;
    // In the Deeps the fires burn ghost-green: corpse-candles, not hearths.
    const ghost = this.local?.area === "deeps";
    const glow = this.add.image(x, y - 24, "glow").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3).setDepth(this.lightDepth());
    if (ghost) glow.setTint(0x7cf0b0);
    const breathe = (): void => void this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.75, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 16, 10, 0x8b8f99).setStrokeStyle(2, 0x3a3f4a).setDepth(standing(y) - 1);
    }
    const fire = this.add.sprite(x, y, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.7).setDepth(standing(y));
    if (ghost) fire.setTint(0x8cffc0);
    this.loop(fire, "fire");
    // Tracked at full size, so the culling bounds hold once it is lit.
    this.track(fire);
    if (!unlit) return breathe();
    // Hidden by alpha, not visibility: the culling sets visibility every frame.
    fire.setAlpha(0).setScale(0.1);
    glow.setAlpha(0);
    const logs = [-0.45, 0.45].map((a) => this.add.image(x, y - 2, "log").setRotation(a).setScale(0.55).setTint(0x6a5444).setDepth(standing(y) - 1));
    this.unlit.set(this.fireKey(f), () => {
      if (!this.anims.exists("kindle_once")) this.anims.create({ key: "kindle_once", frames: this.anims.generateFrameNumbers("kindle"), frameRate: 9, repeat: 0 });
      const burst = this.add.sprite(x, y + 4, "kindle").setOrigin(0.5, 0.9).setScale(2.2).setDepth(standing(y) + 1);
      if (ghost) burst.setTint(0x8cffc0);
      burst.play("kindle_once").once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
      this.tweens.add({ targets: logs, alpha: 0, duration: 900, delay: 400, onComplete: () => logs.forEach((l) => l.destroy()) });
      this.tweens.add({ targets: fire, alpha: 1, scale: 0.7, duration: 1300, delay: 300, ease: "Back.easeOut" });
      this.tweens.add({ targets: glow, alpha: 0.55, scale: { from: 0.4, to: 1.3 }, duration: 1300, delay: 300, ease: "Sine.easeOut", onComplete: breathe });
      // Told as a new area is, in the big banner over the screen.
      this.time.delayedCall(500, () => (play(LIT), this.hooks.onHerald?.("Bonfire Lit")));
    });
  }

  /** A bonfire's key in KINDLED: `area:col,row`. */
  private fireKey(f: Cell): string {
    return `${this.local?.area}:${f.col},${f.row}`;
  }

  /** E at an unlit bonfire: it catches, and the map can travel to it. Resting there is the next E. */
  private kindle(fire: Cell): void {
    const key = this.fireKey(fire);
    remember(KINDLED, remembered(KINDLED).add(key));
    this.unlit.get(key)?.();
    this.unlit.delete(key);
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
    // Each crossing is drawn as the thing it is: a fen's sinkhole, a railed lift; a crossing beside its own building
    // (the Harbour's hill cave, the gnomes' tower, the keep) needs nothing more.
    const ground = DEPTH.ground + 1;
    if (e.kind === "drop" && this.local!.area === "harbour") {
      // The Lookout Hill's cave is the way down: the map places it.
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
    } else if (e.name === "The Sisters' Stair") {
      this.archway(e);
    } else if (up || down || e.name.includes("Lift")) {
      const beside = (up || down) && this.map.tiers[here].props.some((p) => ["cave", "gnomeTower", "watchtower", "tower", "castle", "monastery"].includes(p.art) && footprint(p).some((c) => Math.abs(c.col - e.at.col) <= 3 && Math.abs(c.row - e.at.row) <= 3));
      if (!beside) {
        // A lift: a plank floor railed on its left and right, open front and back, in the pack's own wood (its fence's and
        // its boats' browns, the navy outline every sprite has). The Harbour's end of the Old Lift is a small one, in its
        // corner under the landing, hung from a hoist frame: its wheel, ropes and counterweight are what read as a lift.
        const k = e.name === "The Old Lift" && this.local!.area === "harbour" ? 0.6 : 1;
        const [w, h, cy] = [2.4 * k * CELL, 1.6 * k * CELL, y - 0.3 * k * CELL - (k < 1 ? 0.3 * CELL : 0)];
        this.add.rectangle(x, cy, w, h, 0xbd8a59).setStrokeStyle(4, 0x161c2e).setDepth(ground);
        this.add.rectangle(x, cy - h / 2 + 3, w - 8, 6, 0xe5be76).setDepth(ground + 1);
        for (let i = -1; i <= 1; i++) this.add.rectangle(x + i * 0.8 * k * CELL, cy, 3, h - 0.1 * CELL, 0x8d6857).setDepth(ground + 1);
        if (k < 1) this.liftHoist(x, cy - h / 2, w, cy + h / 2);
        else for (const side of [-1, 1]) this.fence(e.at.col + side, e.at.row - 1, 1, 2);
      }
    } else if (e.name.includes("Ladder")) {
      // A ladder, from the pack's fence: one upright run of it against the wall, rails and rungs.
      this.fence(e.at.col, e.at.row - 2, 1, 3);
    } else if (missingKeys(e).length) {
      // Locked: the pack's fence across the way until its key is carried, then open like any other.
      this.gatehouse("locked", this.doorway(e));
    } else if (this.inward(e) === "arch") {
      this.archway(e);
    } else if (!this.inward(e)) {
      // A road off the map's edge: a lit post either side of its last tile, or just outside a way too narrow for them.
      const way = this.doorway(e);
      const [a, b] = [way[0]!, way[way.length - 1]!];
      const [dc, dr] = [Math.sign(b.col - a.col), Math.sign(b.row - a.row)];
      const ends = way.length >= 3 ? [a, b] : [{ col: a.col - dc, row: a.row - dr }, { col: b.col + dc, row: b.row + dr }];
      for (const c of ends) this.torchPost(c);
    }
  }

  /** How a way out in the map's middle is gone through: a building's door, or an arch cut in the rock; none at an edge. */
  private inward(e: Exit): "door" | "arch" | undefined {
    const { rows } = this.local!.island;
    const edge = e.at.col <= 2 || e.at.row <= 2 || e.at.col >= rows[0]!.length - 3 || e.at.row >= rows.length - 3;
    if (edge) return undefined;
    const door = this.local!.props.some((p) => ["castle", "tower", "monastery"].includes(p.art) && footprint(p).some((c) => c.col === e.at.col && c.row === e.at.row - 1));
    return door ? "door" : "arch";
  }

  /** A gatepost from the pack's fence with a torch burning on it. */
  private torchPost(c: Cell): void {
    this.fence(c.col, c.row, 1, 1);
    const [x, y] = [(c.col + 0.5) * CELL, (c.row + 1) * CELL];
    const flame = this.add.sprite(x, y - 58, "fire").setOrigin(0.5, FIRE.anchor).setScale(0.3).setDepth(standing(y) + 1);
    this.loop(flame, "fire");
    this.track(flame);
    const glow = this.add.image(x, y - 66, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb870).setAlpha(0.4).setScale(0.7).setDepth(DEPTH.clouds - 2);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 700 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** A lift's hoist over its platform: two uprights at the back corners, a beam across with the rope wheel at its middle,
   *  ropes down to the platform's front corners, and a counterweight hung off the beam's east end. */
  private liftHoist(x: number, back: number, w: number, front: number): void {
    const [ink, wood, dark, rope] = [0x161c2e, 0xbd8a59, 0x8d6857, 0xd9c28a];
    const top = back - 1.1 * w;
    const [post, r, over] = [0.09 * w, 0.13 * w, 0.22 * w];
    const g = this.add.graphics().setDepth(standing(back));
    const plank = (px: number, py: number, pw: number, ph: number, fill: number): void => {
      g.fillStyle(fill, 1).fillRect(px, py, pw, ph);
      g.lineStyle(3, ink, 1).strokeRect(px, py, pw, ph);
    };
    for (const s of [-1, 1]) plank(x + (s * w) / 2 - post / 2, top, post, back - top + 4, dark);
    // Ropes before the beam, so they run out from behind the wheel.
    g.lineStyle(2, rope, 1);
    for (const s of [-1, 1]) g.lineBetween(x + s * r * 0.8, top + r, x + s * (w / 2 - 8), front - 6);
    const cw = x + w / 2 + over - post / 2;
    g.lineBetween(cw, top, cw, top + 0.55 * w);
    plank(x - w / 2 - post, top - post / 2, w + over + 1.5 * post, post, wood);
    plank(cw - 0.09 * w, top + 0.55 * w, 0.18 * w, 0.2 * w, 0x5a6170);
    g.fillStyle(dark, 1).fillCircle(x, top + r, r);
    g.lineStyle(3, ink, 1).strokeCircle(x, top + r, r);
    g.lineStyle(2, ink, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.lineBetween(x - Math.cos(a) * r, top + r - Math.sin(a) * r, x + Math.cos(a) * r, top + r + Math.sin(a) * r);
    }
    g.fillStyle(0xe5be76, 1).fillCircle(x, top + r, 0.03 * w + 2);
  }

  /** A stair or postern cut in the rock: a low arch, a draught threading out of it one wisp at a time; dark and grey while
   *  the way is barred (the Sisters' Stair, until Ysolde has told of it), candle-lit and gold once open. */
  private archway(e: Exit): void {
    const x = (e.at.col + 0.5) * CELL;
    // An arch just past a table's back edge stands over the lip, hiding the edge's line behind it.
    const y = (e.at.row + (level(e.at.col, e.at.row + 1) > level(e.at.col, e.at.row) ? 1.3 : 0.95)) * CELL;
    const lit = !barred(e);
    const [w, h] = [0.62 * CELL, 1.15 * CELL];
    const arch = this.add.graphics().setDepth(standing(y) - 1);
    const radius = { tl: w / 2, tr: w / 2, bl: 0, br: 0 };
    arch.fillStyle(0x0e1218, 1).fillRoundedRect(x - w / 2, y - h, w, h, radius);
    arch.lineStyle(5, 0x161c2e, 1).strokeRoundedRect(x - w / 2, y - h, w, h, radius);
    if (lit) {
      const glow = this.add.image(x, y - h * 0.45, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb870).setAlpha(0.5).setScale(0.6).setDepth(standing(y));
      this.tweens.add({ targets: glow, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    if (!this.anims.exists("fogPuff_fade")) this.anims.create({ key: "fogPuff_fade", frames: this.anims.generateFrameNumbers("fogPuff"), frameRate: 9, repeat: 0 });
    const incense = this.time.addEvent({
      delay: lit ? 700 : 1300,
      loop: true,
      callback: () => {
        if (!arch.active) return void incense.remove();
        const [sx, sy] = [x + (Math.random() - 0.5) * w * 0.5, y - h * 0.35];
        const wisp = this.add.sprite(sx, sy, "fogPuff", 0).setScale(0.45).setTint(lit ? 0xf3d9a6 : 0xb8b4ae).setAlpha(lit ? 0.7 : 0.45).setDepth(standing(y) + 1);
        wisp.play("fogPuff_fade");
        this.tweens.add({ targets: wisp, y: sy - 46, x: sx + (Math.random() - 0.5) * 20, scale: 0.7, duration: 1600, onComplete: () => wisp.destroy() });
      },
    });
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
  private addDweller(d: Dweller, posts: ReadonlySet<string>): void {
    if (this.local && FOES[d.kind]) {
      if (!this.slain(d)) this.addFoe(d);
      return;
    }
    const look = this.look(d);
    const x = (d.col + 0.5) * CELL;
    const y = (d.row + 0.75) * CELL;
    const s = this.add.sprite(x, y - (d.perch ?? 0) * CELL, look.idle.key).setOrigin(0.5, look.anchor).setScale(look.scale).setDepth(look.swim ? DEPTH.foam + 2 : standing(y));
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
    if (!look.swim && !d.perch) this.walkers.push(s);
    // A walker keeps to the ground it can walk: round the cliffs, up and down only by the stairs, in and out of a pen by its gate.
    // A beat may end against a wall, as it was laid.
    const found = d.to && !look.swim ? findPath({ col: d.col, row: d.row }, d.to, (c) => posts.has(`${c.col},${c.row}`) && !(c.col === d.to!.col && c.row === d.to!.row)) : null;
    // A beat that only goes the long way round, down one stair and up another, is not walked: it stays at its post.
    const route = found && d.to && found.length <= 2 * (Math.abs(d.to.col - d.col) + Math.abs(d.to.row - d.row)) + 8 ? found : null;
    const cells = route ? [{ col: d.col, row: d.row }, ...route] : d.to && look.swim ? [{ col: d.col, row: d.row }, d.to] : [];
    const points = cells.map((c) => ({ x: (c.col + 0.5) * CELL, y: (c.row + 0.75) * CELL }));
    const reach = points.reduce((m, p) => Math.max(m, Math.abs(p.x - x), Math.abs(p.y - y)), 0);
    // The woodyard's carrier goes anywhere in the area.
    const carrier = d.act === "carry";
    this.track(s, carrier ? 200 * CELL : points.length > 1 ? reach + 64 : 0);
    if (points.length < 2 && !carrier) return;
    const speed = look.swim ? 45 : 80;
    const go = (way: { x: number; y: number }[], move: string | undefined, done: () => void): void => {
      if (move) this.loop(s, move);
      this.tweens.chain({
        targets: s,
        tweens: way.slice(1).map((to, i) => ({
          x: to.x,
          y: to.y,
          duration: (Phaser.Math.Distance.Between(way[i]!.x, way[i]!.y, to.x, to.y) / speed) * 1000,
          onStart: () => to.x !== way[i]!.x && s.setFlipX(to.x < way[i]!.x),
          onUpdate: () => !look.swim && s.setDepth(standing(s.y)),
        })),
        onComplete: done,
      });
    };
    const { work, haul } = look;
    const toPoint = (c: Cell): { x: number; y: number } => ({ x: (c.col + 0.5) * CELL, y: (c.row + 0.75) * CELL });
    if (d.act === "drill" && work) {
      // Mustered all at once on the same clock: out to the drill spot, the blow practised at half pace, back to idle.
      const muster = (): void =>
        void this.time.delayedCall(DRILL_EVERY - (this.time.now % DRILL_EVERY) + Math.random() * 600, () =>
          go(points, look.move?.key, () => {
            s.setFlipX(d.flip ?? false);
            this.loop(s, work.key);
            s.anims.timeScale = 0.5;
            if (this.time.now > this.drillUntil) {
              this.drillUntil = this.time.now + DRILL_FOR;
              this.time.addEvent({ delay: 3200, startAt: 3200, repeat: 2, callback: () => this.clash(s) });
            }
            this.time.delayedCall(DRILL_FOR, () => {
              s.anims.timeScale = 1;
              go([...points].reverse(), look.move?.key, () => (this.loop(s, look.idle.key), muster()));
            });
          }),
        );
      muster();
      return;
    }
    if (carrier && work && haul) {
      // The woodyard's carrier: waits at the yard's office till a pile somewhere is full, walks to it, loads all but a
      // couple of logs, carries them to the pen's gate onto the stack, and goes back to the office to report.
      const home = { col: d.col, row: d.row };
      const yard = this.logPiles.filter((p) => p.stack && tileDistance(p.at, home) <= 7);
      let here: Cell = home;
      const route = (to: Cell): { x: number; y: number }[] | null => {
        const path = findPath(here, to, (c) => posts.has(`${c.col},${c.row}`) && !(c.col === to.col && c.row === to.row));
        return path && [toPoint(here), ...path.map(toPoint)];
      };
      const walkTo = (to: Cell, move: string | undefined, done: () => void): boolean => {
        const way = route(to);
        if (!way) return false;
        go(way, move, () => {
          here = to;
          done();
        });
        return true;
      };
      const wait = (): void => void this.time.delayedCall(2000, check);
      const check = (): void => {
        const full = this.logPiles.find((p) => !p.stack && p.n >= p.logs.length);
        const at = full && { col: full.at.col, row: full.at.row + 1 };
        const ok = full && at && walkTo(at, look.move?.key, () => {
          this.loop(s, work.key);
          this.time.delayedCall(1200, () => {
            const load = full.n - 2;
            this.heap(full, 2);
            if (!walkTo(yard[0] ? { col: yard[0].at.col, row: yard[0].at.row + 1 } : home, haul.key, () => {
              const lowest = [...yard].sort((a, b) => a.n - b.n)[0];
              if (lowest) this.heap(lowest, lowest.n + load);
              this.loop(s, work.key);
              this.time.delayedCall(800, () => walkTo(home, look.move?.key, () => (this.loop(s, look.idle.key), wait())) || wait());
            })) wait();
          });
        });
        if (!ok) wait();
      };
      wait();
      return;
    }
    if (work && haul && d.to) {
      const inside = d.act ? PAWN_ACT[d.act]?.inside : false;
      // A woodcutter: out to its tree, chop while it shakes, the logs carried home, a rest, and out again.
      const [tx, ty] = [(d.to.col + (d.flip ? -0.375 : 1.375)) * CELL, (d.to.row + 0.6) * CELL];
      const tree = this.children.list.find((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && Math.abs(o.x - tx) < 1 && Math.abs(o.y - ty) < 1);
      const grown = tree && { key: tree.texture.key, origin: tree.originY };
      // Felled, a tree is left its own stump (Stump 3 is Tree3's), its foot 64px lower in a frame 64px taller.
      const fallen = (): void => void (tree && grown && tree.stop().setTexture(`stump${grown.key.slice(-1)}`).setOrigin(0.5, (grown.origin * 192 + 64) / 256));
      const trip = (): void => {
        if (tree && grown && tree.texture.key !== grown.key) {
          // A new tree grows only where no one is looking; till then the woodcutter rests.
          if (this.active.worldView.contains(tree.x, tree.y)) return void this.time.delayedCall(3000, trip);
          tree.setTexture(grown.key).setOrigin(0.5, grown.origin).play(`${grown.key}_anim`);
        }
        go(points, look.move?.key, () => {
          s.setFlipX(d.flip ?? false);
          this.loop(s, work.key);
          s.anims.setProgress(0);
          // The axe lands on the third of six frames at 9 a second: the tree shakes on each blow.
          const shake = tree && this.tweens.add({ targets: tree, angle: 2, delay: 222, duration: 110, yoyo: true, repeat: -1, repeatDelay: 445 });
          // A digger works out of sight, in through its mine's door.
          if (inside) this.tweens.add({ targets: s, alpha: 0, duration: 300 });
          this.time.delayedCall(5000 + Math.random() * 3000, () => {
            shake?.remove();
            tree?.setAngle(0);
            fallen();
            if (inside) this.tweens.add({ targets: s, alpha: 1, duration: 300 });
            // Home to a spot a little off the last, so those at one door never stand on a grid.
            const back = [...points].reverse();
            const home = back.at(-1)!;
            back[back.length - 1] = { x: home.x + (Math.random() - 0.5) * 0.6 * CELL, y: home.y + (Math.random() - 0.5) * 0.4 * CELL };
            go(back, haul.key, () => {
              // The logs onto the nearest pile by the door.
              const pile = this.logPiles.filter((p) => !p.stack && tileDistance(p.at, d) <= 4).sort((a, b) => tileDistance(a.at, d) - tileDistance(b.at, d))[0];
              if (pile) this.heap(pile, pile.n + 1);
              s.setFlipX(Math.random() < 0.5);
              this.loop(s, look.idle.key);
              this.time.delayedCall(2000 + Math.random() * 2000, trip);
            });
          });
        });
      };
      this.time.delayedCall(Math.random() * 3000, trip);
      return;
    }
    const walk = (way: { x: number; y: number }[]): void =>
      go(way, look.move?.key, () => {
        this.loop(s, look.idle.key);
        this.time.delayedCall(1500 + Math.random() * 3000, () => walk([...way].reverse()));
      });
    this.time.delayedCall(Math.random() * 3000, () => walk(points));
  }

  /** The light over each area, soft across the water between: one texel a tile, multiplied in. Rock is near black. */
  private mood(tier: AtlasTier): void {
    const pad = tier.base === "rock" ? ROCK_PAD : 6;
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
    const under = this.local && tier.base === "rock" ? (UNDER[this.local.area] ?? { rock: ROCK_MOOD, ambient: 0.22, glow: AREAS.find((a) => a.id === this.local!.area)!.mood, gold: 4 }) : this.local ? (DUSK[this.local.area] ?? null) : null;
    // A dusk land's lights reach less far than a cavern's: many fires, each its own pool.
    const reach = (this.local && DUSK[this.local.area]?.reach) ?? 1;
    const lights = this.local && under
      ? [
          ...[...tier.fires, ...tier.campfires].map((f) => ({ c: f.col, r: f.row, reach: 9 })),
          ...this.local.exits.map((e) => ({ c: e.at.col, r: e.at.row, reach: 7 })),
          ...tier.props.filter((p) => p.art === "goldStone").map((p) => ({ c: p.col, r: p.row, reach: under.gold })),
          ...tier.props.filter((p) => p.art === "sconce").map((p) => ({ c: p.col, r: p.row, reach: 5 })),
          ...tier.props.filter((p) => p.art === "flame").map((p) => ({ c: p.col, r: p.row, reach: 7 })),
        ]
      : null;
    const lit = (c: number, r: number): number => Math.max(0, ...lights!.map((l) => 1 - Math.hypot(c - l.c, r - l.r) / (l.reach * reach)));
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
        const water = AREAS[AREA_CODE.indexOf(tier.areaAt[r]?.[c] ?? "-")] === undefined;
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
    // Above ground the light colours the land, not who stands on it, so the hero keeps its colours in every area;
    // underground and at dusk it lies over everything, as the dark it is.
    const over = under ? DEPTH.clouds - 3 : DEPTH.unit - 2;
    this.add.image(-pad * CELL, -pad * CELL, `atlasMood-${tier.id}`).setOrigin(0).setScale(CELL).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(over);
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
      // Steam off the warm ground under the Emberwood's canopy.
      drift("emberwood", 14, 0xfff2e2, 0.16);
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
    // The castle wards get short, smaller names, only when close enough to read them apart; the Keep and the boss lands go unnamed.
    const castle: Partial<Record<AreaId, string>> = { burg: "THE BURG", ramparts: "RAMPARTS", chapel: "CHAPEL" };
    for (const a of AREAS) {
      if (a.tier !== tier.id || a.id === "keep" || (MAPPED_AREAS.includes(a.id) && areaMap(a.id).arena)) continue;
      const mid = this.centre(a.id);
      const ward = castle[a.id];
      if (ward) text(mid.col * CELL, mid.row * CELL, ward, 36, "#e6dcc4", 12, 40).setLetterSpacing(6);
      else text(mid.col * CELL, mid.row * CELL, a.name.toUpperCase(), 64, "#fdfaf0", 22).setLetterSpacing(10);
    }
  }

  /** The map as the flags held on entry dress it: the cached map is left whole. */
  private gated<T extends AtlasTier>(t: T): T {
    return { ...t, props: t.props.filter((p) => shown(p, this.seen)), dwellers: t.dwellers.filter((d) => shown(d, this.seen)) };
  }

  private flag(f: WorldFlag): void {
    this.flags.add(f);
    remember(FLAGS, this.flags);
    // Freed, the sister walks with the captain for good, past the band's three if need be.
    const band = stored<CompanionKind[]>(BAND, []);
    if (f === "monkFreed" && !band.includes("monk") && this.hero) {
      store(BAND, [...band, "monk"]);
      this.addCompanion("monk");
      this.emitBand();
      this.float(this.hero.s.x, this.hero.s.y - this.hero.lift - 30, "Monk joined", "#9cc4e8");
    }
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
    const tag = this.add
      .text(s.x, y - 1.05 * CELL, n.short ?? n.name, { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#f2d48a", stroke: "#1c2634", strokeThickness: 5 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx);
    this.folk.push({ npc: n, at: w.at, s, near: false, bubble: null, tag });
  }

  /** One of the folk walks the captain to this area's cold bonfire, keeping beside them, has them light it and walks back. */
  private guide(f: Folk): void {
    const fire = this.local!.fires.find((c) => this.unlit.has(this.fireKey(c)));
    const taken = (c: Cell): boolean => this.shut(c) || this.folk.some((o) => o !== f && o.at.col === c.col && o.at.row === c.row);
    const there = fire && findRoute(f.at, (c) => tileDistance(c, fire) === 1, taken);
    if (!fire || !there) return;
    const look = this.look(npcLook(f.npc));
    const home = f.at;
    f.leading = true;
    const pose = (key: string): void => void (f.s.anims.currentAnim?.key !== `${key}_loop` && this.loop(f.s, key));
    const walk = (way: Cell[], done: () => void, wait: boolean): void => {
      const to = way[0];
      if (!to) {
        pose(look.idle.key);
        return done();
      }
      // Walking with the captain: a step ahead at most, waiting whenever they fall behind.
      if (wait && tileDistance(f.at, this.hero!.at) > 2) {
        pose(look.idle.key);
        this.time.delayedCall(300, () => walk(way, done, wait));
        return;
      }
      way.shift();
      if (look.move) pose(look.move.key);
      if (to.col !== f.at.col) f.s.setFlipX(to.col < f.at.col);
      f.at = to;
      const x = (to.col + 0.5) * CELL;
      const y = (to.row + 0.75) * CELL;
      this.tweens.add({
        targets: f.s,
        x,
        y,
        // The townsfolk's own pace, 80 px a second.
        duration: (Phaser.Math.Distance.Between(f.s.x, f.s.y, x, y) / 80) * 1000,
        onUpdate: () => {
          f.s.setDepth(standing(f.s.y));
          f.tag.setPosition(f.s.x, f.s.y - 1.05 * CELL);
          f.bubble?.setPosition(f.s.x, f.s.y - 1.45 * CELL);
        },
        onComplete: () => walk(way, done, wait),
      });
    };
    this.callOut(f, "This way.");
    walk(there, () => {
      f.s.setFlipX(fire.col < f.at.col);
      // The captain lights it, not the guide: told to, and told again while it stays cold.
      let told = -Infinity;
      const ask = this.time.addEvent({
        delay: 300,
        loop: true,
        callback: () => {
          if (this.unlit.has(this.fireKey(fire))) {
            if (this.time.now - told > 7000 && tileDistance(this.hero!.at, fire) <= 3) {
              this.callOut(f, "Put your hand to it. It'll catch.");
              told = this.time.now;
            }
            return;
          }
          ask.remove();
          this.callOut(f, "There. Now it's yours.");
          this.time.delayedCall(2500, () => walk(findRoute(f.at, (c) => c.col === home.col && c.row === home.row, taken) ?? [], () => (f.leading = false), false));
        },
      });
    }, true);
  }

  /** A line called out over a dweller's head: up, held, gone. */
  private callOut(f: Folk, text: string): void {
    if (!text) return;
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
    if (!this.hero || this.hero.dead || this.gone) return;
    if (this.menu) return void (!repeat && (play(CLICK), this.choose()));
    if (this.board) return void (!repeat && (play(CLICK), this.chooseNotice(this.board.pick)));
    if (this.reading) return void (!repeat && this.read(null));
    if (this.talk) return void (!repeat && this.nextPage());
    // The free camera carries on a talk or menu opened by a click, but starts nothing on E.
    if (!this.playing) return;
    const t = this.eTarget();
    if (!t || repeat) return;
    if ("fire" in t) return this.unlit.has(this.fireKey(t.fire)) ? this.kindle(t.fire) : this.rest(t.fire);
    if ("note" in t) return this.read(t.note);
    if ("board" in t) return this.openBoard();
    if ("exit" in t) return this.traverse(t.exit);
    if ("fog" in t) return this.enterFog();
    if ("lock" in t) return;
    if ("unbar" in t) return this.unbar(t.unbar);
    if ("horn" in t) return this.pullLever(t.horn);
    if ("loot" in t) return this.pickUp(t.loot);
    return RECRUITER[t.folk.npc.id] || t.folk.npc.shop ? this.openMenu(t.folk) : this.talkTo(t.folk);
  }

  /** A swing the way the hero faces: at the monster in reach nearest ahead, else the air. */
  private attack(time: number): void {
    const hero = this.hero!;
    if (hero.dead || this.gone || this.menu || this.board || this.talk || this.guarding || !canAct(this.stamina)) return;
    if (time < hero.busy || time < hero.next) return void (this.queued = true);
    this.queued = false;
    const at = { x: hero.s.x + (hero.s.flipX ? -1 : 1), y: hero.s.y };
    const { reach: r } = CLASSES[this.cls];
    const reach = this.foes.filter((f) => !f.dead && canReach(r, f.stats) && tileDistance(f.at, hero.at) <= r && Math.hypot(f.s.x - hero.s.x, f.s.y - hero.s.y) < (r + 0.5) * CELL && (r === 1 || clearShot(hero.at, f.at, this.blocks)));
    const foe = reach.sort((a, b) => Math.hypot(a.s.x - at.x, a.s.y - at.y) - Math.hypot(b.s.x - at.x, b.s.y - at.y))[0];
    this.heroSwing(foe ?? null, time);
  }

  /** The hero's next swing of its combo: the first and third cut one way, the second back the other; the third knocks back. */
  private heroSwing(foe: Foe | null, time: number): void {
    const hero = this.hero!;
    const step = (this.combo = comboStep(this.combo, (time - hero.next) / 1000));
    this.stamina = spend(this.stamina, STAMINA.swing);
    this.spentAt = time;
    const anim = step === 2 ? HERO_ART[this.cls].attack2.key : HERO_ART[this.cls].attack.key;
    this.swing(hero, foe, swingWait(step, this.cls, this.gear.swing), time, anim);
    play(SWING, 0.5);
    // Committed until the swing is through: no roll out of it.
    hero.busy = time + (HERO.hit + 0.25) * 1000;
    if (!foe) return this.toll(time);
    this.lastHit = foe;
    // The blow lands partway through the swing, if the mark is still in reach.
    this.time.delayedCall(HERO.hit * 1000, () => {
      const { reach } = CLASSES[this.cls];
      const near = (f: Foe) => !f.dead && tileDistance(f.at, hero.at) <= reach && Math.hypot(f.s.x - hero.s.x, f.s.y - hero.s.y) <= (reach + 0.6) * CELL;
      if (hero.dead || !near(foe)) return;
      if (CLASSES[this.cls].hex) return this.loose(hero, foe, this.gear.attack, MISSILE.shaman!, step === 3 ? () => this.hex(foe) : undefined);
      for (const f of CLASSES[this.cls].sweep ? this.foes.filter(near) : [foe]) {
        this.hurt(hero, f, this.gear.attack);
        if ((step === 3 || CLASSES[this.cls].knockAll) && !f.dead && !BOSSES.has(f.kind)) this.knockBack(f, this.time.now);
      }
    });
  }

  /** The third bolt bursts on its mark and holds it: a wind-up broken, and no move for a moment. A boss shrugs off the hold. */
  private hex(f: Foe): void {
    this.blast(f.at, 0xb48cff);
    if (f.dead || BOSSES.has(f.kind)) return;
    if (f.windup) this.play(f.s, f.idle);
    f.windup = null;
    f.busy = Math.max(f.busy, this.time.now + HEX_HOLD);
    f.way = [];
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
    if (!this.dev && tileDistance(f.at, hero.at) > TALK_RANGE) return;
    hero.way = [];
    f.bubble?.destroy();
    f.bubble = null;
    f.s.setFlipX(hero.s.x < f.s.x);
    hero.s.setFlipX(f.s.x < hero.s.x);
    const t = nextTalk(f.npc, this.heard, this.seen);
    this.talk = { folk: f, lines: t.lines, key: talkKey(f.npc, t), sets: t.sets, gives: t.gives, throws: t.throws, lights: t.lights, page: 0 };
    this.say();
  }

  /** A note opened, shown as a talk is, or closed. */
  private read(n: Note | null): void {
    this.reading = n;
    if (n) play(PAGE);
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
      const first = !this.heard.has(t.key);
      this.heard.add(t.key);
      remember(HEARD, this.heard);
      // A talk heard to its end can move someone on: they are elsewhere the next time this area is entered.
      if (t.sets) this.flag(t.sets);
      if (first && t.gives) this.gain(t.gives);
      const thrown = first && t.throws;
      if (thrown) this.throwDown(t.folk, thrown);
      this.talk = null;
      this.say();
      if (first && t.lights) return this.guide(t.folk);
      // Talked out, a merchant's menu comes back, as in the Souls games; not over a good just thrown, to be gone for.
      if (!thrown && (RECRUITER[t.folk.npc.id] || t.folk.npc.shop)) this.openMenu(t.folk);
      return;
    }
    this.say();
  }

  /** Once a frame: folk greet a captain who comes near and turn to them; one walked away from mid-talk calls after. */
  private mind(): void {
    const hero = this.hero!;
    for (const f of this.folk) {
      if (f.leading) continue;
      const d = tileDistance(f.at, hero.at);
      if (d <= TALK_RANGE && !hero.dead) {
        if (!f.near && this.talk?.folk !== f) this.callOut(f, f.npc.greet);
        f.near = true;
        f.s.setFlipX(hero.s.x < f.s.x);
      } else if (d > TALK_RANGE + 1) f.near = false;
      // Dev mode talks from anywhere, so a talk there is not walked away from.
      if (this.talk?.folk === f && d > TALK_RANGE && !this.dev) {
        this.talk = null;
        this.say();
        this.callOut(f, f.npc.part);
      }
      if (this.menu?.folk === f && d > TALK_RANGE && !this.dev) this.closeMenu(true);
    }
    if (this.reading && !this.dev && tileDistance(this.reading.at, hero.at) > 1) this.read(null);
    if (this.board && !this.dev && tileDistance(LANE_HOUSE.at, hero.at) > 1) this.closeBoard();
    const t = this.talk || this.menu || this.board || this.reading || hero.dead || this.gone ? undefined : this.eTarget();
    const action = !t ? null : "folk" in t ? "Talk" : "fire" in t ? (this.unlit.has(this.fireKey(t.fire)) ? "Light the bonfire" : "Rest") : "note" in t ? "Read" : "board" in t ? "Enter the Lane House" : "fog" in t ? "Traverse the fog" : "lock" in t ? t.lock : "unbar" in t ? `Unbar the ${t.unbar.name}` : "horn" in t ? t.horn.lever!.verb : "loot" in t ? "Pick up" : this.exitWord(t.exit);
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

  /** A tier's ground, every tile some area's, with a 3 tile margin, in px; rock and open sky are not ground. */
  private landBox(tier: AtlasTier): Phaser.Geom.Rectangle {
    let [c0, c1, r0, r1] = [Infinity, -Infinity, Infinity, -Infinity];
    tier.areaAt.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) if (line[c] !== "-") [c0, c1, r0, r1] = [Math.min(c0, c), Math.max(c1, c), Math.min(r0, r), Math.max(r1, r)];
    });
    const m = 3;
    if (c0 > c1) return new Phaser.Geom.Rectangle(0, 0, STRAT_COLS * CELL, STRAT_ROWS * CELL);
    return new Phaser.Geom.Rectangle((c0 - m) * CELL, (r0 - m) * CELL, (c1 - c0 + 1 + 2 * m) * CELL, (r1 - r0 + 1 + 2 * m) * CELL);
  }

  private freeFit(): number {
    const cam = this.active;
    return Math.min(cam.height / this.freeBox!.height, (cam.width * (1 - (this.hooks.inset?.() ?? 0))) / this.freeBox!.width);
  }

  /** The whole tier in view, in the part of the screen the map's panel leaves clear. */
  private fitTier(): void {
    const cam = this.active;
    const zoom = this.freeFit();
    cam.setZoom(zoom);
    cam.centerOn(this.freeBox!.centerX - ((this.hooks.inset?.() ?? 0) * cam.width) / 2 / zoom, this.freeBox!.centerY);
  }

  /** Off play, the view's edges held inside the free box, or the box centred on an axis the view is wider than. */
  private clampFree(): void {
    const b = this.freeBox;
    if (!b || this.playing) return;
    const cam = this.active;
    const axis = (mid: number, view: number, lo: number, hi: number): number =>
      view >= hi - lo ? (lo + hi) / 2 : Phaser.Math.Clamp(mid, lo + view / 2, hi - view / 2);
    cam.centerOn(
      // A panel over the left: the box reaches out under it, so a land at the edge can still come clear of it.
      axis(cam.scrollX + cam.width / 2, cam.width / cam.zoom, b.left - ((this.hooks.inset?.() ?? 0) * cam.width) / cam.zoom, b.right),
      axis(cam.scrollY + cam.height / 2, cam.height / cam.zoom, b.top, b.bottom),
    );
  }

  private devState(): DevState {
    const hero = this.hero;
    const local = this.local;
    return {
      area: local?.area ?? "landing",
      hero: hero && { col: hero.at.col, row: hero.at.row },
      district: (hero && local && districtOf(local, hero.at.col, hero.at.row)?.name) || null,
      gold: this.gold,
      flags: [...this.flags],
      keys: [...remembered<string>(KEYS)],
      slain: [...remembered<string>(SLAIN)],
      kindled: [...remembered<string>(KINDLED)],
      heard: [...this.heard],
      npcs: this.folk.map((f) => ({ id: f.npc.id, name: f.npc.name, col: f.at.col, row: f.at.row, shop: !!f.npc.shop, here: true })),
      exits: (local?.exits ?? []).map((e) => ({ name: e.name, to: e.to, col: e.at.col, row: e.at.row, barred: barred(e) })),
      spots: [
        ...(local?.fires ?? []).map((f) => ({ kind: "fire" as const, name: f.name ?? (local && districtOf(local, f.col, f.row)?.name) ?? "Bonfire", col: f.col, row: f.row })),
        ...(local?.bosses ?? []).map((b) => ({ kind: "boss" as const, name: b.name, col: b.col, row: b.row })),
        ...this.notes.map((n) => ({ kind: "note" as const, name: n.text.split(/[.!?\n]/)[0]!.slice(0, 40), col: n.at.col, row: n.at.row })),
        ...(local?.area === LANE_HOUSE.area ? [{ kind: "note" as const, name: "Lane House", col: LANE_HOUSE.at.col, row: LANE_HOUSE.at.row + 1 }] : []),
        ...(local?.locks ?? []).flatMap((l) => (l.lever ? [{ kind: "note" as const, name: l.lever.verb, col: l.lever.at.col, row: l.lever.at.row + 1 }] : [])),
      ],
      free: this.free,
      god: this.devGod,
      flasks: this.flasks,
      levels: levels(),
      cls: heroClass(),
    };
  }

  private emitDev(): void {
    if (!this.local || !this.hooks.onDev) return;
    const s = this.devState();
    const key = JSON.stringify(s);
    if (key === this.devKey) return;
    this.devKey = key;
    this.hooks.onDev(s);
  }

  /** Dev: the folk's and the exits' names over the map, kept readable at the whole-map zoom. */
  private devLabels(): void {
    const gone = new Set<Phaser.GameObjects.GameObject>(this.devText);
    this.names = this.names.filter((n) => !gone.has(n.text));
    for (const t of this.devText) t.destroy();
    this.devText = [];
    for (const f of this.folk) f.tag.setVisible(!this.free);
    if (!this.free || !this.local) return;
    const label = (x: number, y: number, s: string, color: string): void => {
      const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: "24px", fontStyle: "bold", color, stroke: "#1c2634", strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(DEPTH.fx + 3);
      this.names.push({ text: t, px: 12, tier: this.view });
      this.devText.push(t);
    };
    for (const f of this.folk) label(f.s.x, f.s.y - 1.05 * CELL, f.npc.short ?? f.npc.name, "#f2d48a");
    for (const e of this.local.exits) label((e.at.col + 0.5) * CELL, e.at.row * CELL, barred(e) ? `${e.name} (barred)` : e.name, "#9cdcff");
  }

  private devTalk(id: string): void {
    const f = this.folk.find((x) => x.npc.id === id);
    if (!f || !this.hero) return;
    if (this.free) this.flyTo({ col: f.at.col + 0.5, row: f.at.row + 0.5 }, AREA_ROWS);
    this.closeMenu(false);
    this.talk = null;
    this.read(null);
    if (RECRUITER[id] || f.npc.shop) this.openMenu(f);
    else this.talkTo(f);
  }

  private devRead(n: Note): void {
    this.closeMenu(false);
    this.talk = null;
    this.read(n);
  }

  private devSet(patch: DevPatch): void {
    if (patch.gold !== undefined) this.setGold(patch.gold);
    if (patch.god !== undefined) this.devGod = patch.god;
    if (patch.levels) {
      store(LEVELS, patch.levels);
      if (this.hero) this.regear();
    }
    if (patch.heal && this.hero) {
      this.hero.hp = this.hero.max;
      this.stamina = this.gear.stamina;
      this.flasks = maxFlasks();
    }
    if (patch.flasks !== undefined) this.flasks = patch.flasks;
    if (patch.heal || patch.flasks !== undefined) this.hooks.onFlasks?.(this.flasks);
    if (patch.flags) remember(FLAGS, (this.flags = new Set(patch.flags)));
    if (patch.keys) remember(KEYS, new Set(patch.keys));
    if (patch.slain) remember(SLAIN, new Set(patch.slain));
    this.devLabels();
    this.emitDev();
  }

  update(time: number, delta: number): void {
    this.torchGlows = this.torchGlows.filter(({ s, glow }) => {
      if (!s.active || s.alpha === 0) return void glow.destroy();
      glow.setPosition(s.x + (s.flipX ? -14 : 14), s.y - 40).setVisible(s.visible);
      return true;
    });
    // Each frame, so a wheel zoom easing out is held to the island as well as a drag.
    this.clampFree();
    const act = this.active;
    if (this.hero) {
      // The free camera takes the hero out of the world: nothing walks, greets, prompts, picks up or parts for it.
      if (!this.free) {
        // A long stall (a tab in the background) is not a long stride.
        this.fight(time, Math.min(delta, 100));
        this.mind();
        // Done with a merchant, menu and talk both over: the camera draws back out.
        if (this.close === "folk" && !this.menu && !this.talk) this.closeUp(null);
        this.gather();
        this.whereabouts(time);
        this.partMist();
      }
      for (const b of [this.hero, ...this.foes, ...this.band]) this.drawBar(b);
      // The HUD's bars, a few times a second and only when they change.
      if (time - this.vitalsAt > 80) {
        this.vitalsAt = time;
        const v = { hp: this.hero.hp, max: this.hero.max, stamina: Math.round(this.stamina), staminaMax: this.gear.stamina };
        const key = `${v.hp},${v.max},${v.stamina},${v.staminaMax}`;
        if (key !== this.vitalsKey) {
          this.vitalsKey = key;
          this.hooks.onVitals?.(v);
        }
        if (this.dev) this.emitDev();
        // A boss shows its bar as its fight opens: a room's boss once the captain stands in its room, mist parted, and has it
        // in view; any other within its leash.
        const hero = this.hero;
        const arena = this.local?.arena;
        const inRoom = !!arena && this.mist.length === 0 && districtOf(this.local!, hero.at.col, hero.at.row)?.name === this.roomOf(arena);
        const seen = (f: Foe): boolean => this.active.worldView.contains(f.s.x, f.s.y);
        // No fight under the free camera, and its whole map has every boss in view.
        const found = hero.dead || this.free
          ? undefined
          : this.foes.find((f) => this.isBoss(f) && !f.dead && (f.kind === arena?.boss ? inRoom && seen(f) : tileDistance(f.at, hero.at) <= f.stats.leash));
        const name = found && this.local?.bosses.slice().sort((a, b) => tileDistance(a, found.home) - tileDistance(b, found.home))[0]?.name;
        // The troll is the Landing's lesson, met with no ceremony.
        if (found && !this.cinema && found.kind !== "troll" && !this.met.has(found.kind)) this.meet(found);
        const boss = this.cinema ? undefined : found;
        if (!boss !== !this.bossTune) {
          this.bossTune?.();
          this.bossTune = boss ? loop(BOSS_MUSIC, 0.8, 2500) : null;
        }
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
