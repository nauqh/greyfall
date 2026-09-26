// Crop geometry measured off the actual PNGs. The pack is not laid out the way
// its file sizes suggest, so none of these numbers are guessable.
//
// Every asset request goes through packUrl, CSS included, so the prefix lives
// in one place: NEXT_PUBLIC_ASSET_BASE (Discord proxies Activities behind
// /.proxy/, which is the one reason it exists).

const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "/tiny-swords").replace(/\/+$/, "");

/** A nine-slice spread over a sheet with gaps between the pieces. */
export interface SliceSheet {
  file: string;
  colX: readonly [number, number, number];
  colW: readonly [number, number, number];
  rowY: readonly [number, number, number];
  rowH: readonly [number, number, number];
}

/** 320px UI sheets: nine 64px pieces at 0 / 128 / 256, empty bands between. */
function sheet320(file: string): SliceSheet {
  return {
    file,
    colX: [0, 128, 256],
    colW: [64, 64, 64],
    rowY: [0, 128, 256],
    rowH: [64, 64, 64],
  };
}

/** 448px UI sheets: 128px corners, 64px middle, gaps between. */
function sheet448(file: string): SliceSheet {
  return {
    file,
    colX: [0, 192, 320],
    colW: [128, 64, 128],
    rowY: [0, 192, 320],
    rowH: [128, 64, 128],
  };
}

export const PANELS = {
  paper: sheet320("UI Elements/UI Elements/Papers/RegularPaper.png"),
  specialPaper: sheet320("UI Elements/UI Elements/Papers/SpecialPaper.png"),
  blueButton: sheet320("UI Elements/UI Elements/Buttons/BigBlueButton_Regular.png"),
  redButton: sheet320("UI Elements/UI Elements/Buttons/BigRedButton_Regular.png"),
  woodTable: sheet448("UI Elements/UI Elements/Wood Table/WoodTable.png"),
  banner: sheet448("UI Elements/UI Elements/Banners/Banner.png"),
  // Top row of BigRibbons (blue): ends and middle only, so rows 2-3 are empty.
  bigRibbon: {
    file: "UI Elements/UI Elements/Ribbons/BigRibbons.png",
    colX: [0, 192, 320],
    colW: [128, 64, 128],
    rowY: [0, 0, 0],
    rowH: [128, 0, 0],
  },
} satisfies Record<string, SliceSheet>;

export type PanelName = keyof typeof PANELS;

/**
 * Three-piece frame plus a separate fill. The BigBar: symmetric 24px caps,
 * 51px tall, a real channel with a 24px fill. The SmallBar's caps are
 * lopsided (15px ornate left, sliver right) and its fill is a 3px thread;
 * it stays unused.
 */
export const BAR = {
  base: "UI Elements/UI Elements/Bars/BigBar_Base.png",
  fill: "UI Elements/UI Elements/Bars/BigBar_Fill.png",
  capW: 64,
  midX: 128,
  rightX: 256,
  /** Ink width of each end cap inside its 64px piece. */
  capInk: 24,
  /** Rows the frame art occupies inside the 64px sheet. */
  artY: 9,
  artH: 51,
  /** The fill strip inside the frame's channel. */
  fillY: 20,
  fillH: 24,
  /** Inset from the frame's ink edge to the channel; the fill spans between
      these, not between the caps. */
  chanX: 8,
} as const;

/**
 * Slate title ribbon. SmallRibbons holds five colors in 64px rows, two end
 * styles each; this is the forked slate row. Same three 64px pieces as every
 * other sheet: left end, solid middle, right end.
 */
export const RIBBON = {
  file: "UI Elements/UI Elements/Ribbons/SmallRibbons.png",
  rowY: 512,
  h: 64,
  midX: 128,
  rightX: 256,
  w: 64,
} as const;

/** Tileset is 9x6 tiles of 64px; column 4 is blank. Grass slice: cols 0-2, rows 0-2. */
export const TERRAIN = {
  tileset: "Terrain/Tileset/Tilemap_color1.png",
  tile: 64,
  sliceCol: 0,
  sliceRow: 0,
  water: "Terrain/Tileset/Water Background color.png",
  /** 16 frames of 192px; the blob is 84px centred in its frame. */
  foam: "Terrain/Tileset/Water Foam.png",
  foamFrame: 192,
  foamFrames: 16,
  /** 79x80 blob anchored like a unit: a ready-made drop shadow. */
  shadow: "Terrain/Tileset/Shadow.png",
  shadowFrame: 192,
  shadowAnchorX: 96,
  shadowAnchorY: 135,
} as const;

/**
 * One entry per FILE: frame sizes differ within a kind. Tree1/2 are 6 frames
 * of 256px, Tree3/4 are 8 of 192, water rocks 16 of 64. Sharing one size per
 * kind loads half of them as zero-frame textures.
 */
export interface DecorSpec {
  key: string;
  file: string;
  frame: number;
  frames: number;
  /** Ground contact row inside the frame. */
  anchorY: number;
}

function decor(
  key: string,
  file: string,
  frame: number,
  frames: number,
  anchorY: number,
): DecorSpec {
  return { key, file, frame, frames, anchorY };
}

const TREES = "Terrain/Resources/Wood/Trees/";
const BUSHES = "Terrain/Decorations/Bushes/";
const ROCKS = "Terrain/Decorations/Rocks/";
const WATER_ROCKS = "Terrain/Decorations/Rocks in the Water/";

export const DECOR = {
  /** Slim pair only: Tree1/2 have 219px canopies that overhang the board. */
  tree: [
    decor("tree3", `${TREES}Tree3.png`, 192, 8, 169),
    decor("tree4", `${TREES}Tree4.png`, 192, 8, 169),
  ],
  bush: [1, 2, 3, 4].map((i) => decor(`bush${i}`, `${BUSHES}Bushe${i}.png`, 128, 8, 78)),
  rock: [1, 2, 3, 4].map((i) => decor(`rock${i}`, `${ROCKS}Rock${i}.png`, 64, 1, 50)),
  waterRock: [1, 2, 3, 4].map((i) =>
    decor(`waterRock${i}`, `${WATER_ROCKS}Water Rocks_0${i}.png`, 64, 16, 47),
  ),
} satisfies Record<string, DecorSpec[]>;

export type DecorKind = keyof typeof DECOR;

/**
 * Buildings are single images, not sheets, and none of them is square, so they
 * cannot go in DECOR. anchorY is the ground contact row - the bottom of the ink
 * - and anchorX is the frame middle for every one of them.
 *
 * The frames carry a lot of padding past the walls, so a layout spaced off the
 * frame width leaves gaps you could drive a cart through. The base widths,
 * measured off the art: castle 256, tower 94, barracks 170, archery 177,
 * house1 96, house2 103, house3 118, monastery 146.
 */
export interface BuildingSpec {
  file: string;
  w: number;
  h: number;
  anchorY: number;
  /** Set when the PNG is a horizontal sheet of variants, not one image. */
  frame?: number;
}

export const BUILDINGS = {
  castle: { file: "Castle.png", w: 320, h: 256, anchorY: 249 },
  tower: { file: "Tower.png", w: 128, h: 256, anchorY: 230 },
  // Enemy Pack extras, for the far shore. The hut PNG is 16 hut variants of
  // 192px laid end to end; the dead tree and the towers are single images.
  goblinHut: { file: "Enemy Pack/Extra/Goblin Hut/Goblin Hut.png", w: 192, h: 256, anchorY: 240, frame: 192 },
  deadTree: { file: "Enemy Pack/Extra/Dead Tree/Dead Tree.png", w: 384, h: 320, anchorY: 314 },
  pirateTower:{
    file:"Enemy Pack/Extra/Pirate Tower/Pirate Tower_Ground.png", w: 128, h: 256, anchorY: 229 
  },
  // The war map's neutral landmarks; the cave, fish hut and water tower are
  // idle sheets, drawn on their first frame.
  cave: { file: "Enemy Pack/Extra/Cave/Cave_Idle.png", w: 192, h: 192, anchorY: 172, frame: 192 },
  fishHut: { file: "Enemy Pack/Extra/Fish Hut/Fish Hut.png", w: 192, h: 192, anchorY: 177, frame: 192 },
  gnomeHut: { file: "Enemy Pack/Extra/Gnome Buildings/Gnome Hut.png", w: 128, h: 192, anchorY: 147 },
  gnomeTower: { file: "Enemy Pack/Extra/Gnome Buildings/Gnome Tower.png", w: 128, h: 256, anchorY: 229 },
  skullSpike: { file: "Enemy Pack/Extra/Skull decorations/Skull Spike_01.png", w: 64, h: 128, anchorY: 94 },
  waterTower: { file: "Enemy Pack/Extra/Pirate Tower/Pirate Tower_Water.png", w: 128, h: 192, anchorY: 187, frame: 128 },
  barracks: { file: "Barracks.png", w: 192, h: 256, anchorY: 245 },
  archery: { file: "Archery.png", w: 192, h: 256, anchorY: 240 },
  house1: { file: "House1.png", w: 128, h: 192, anchorY: 173 },
  house2: { file: "House2.png", w: 128, h: 192, anchorY: 178 },
  house3: { file: "House3.png", w: 128, h: 192, anchorY: 172 },
  monastery: { file: "Monastery.png", w: 192, h: 320, anchorY: 310 },
} satisfies Record<string, BuildingSpec>;

export type BuildingName = keyof typeof BUILDINGS;

/** The pack ships a set per faction; the sides match the unit colors.
 * Enemy Pack extras carry their own top-level path, so the faction prefix
 * does not apply to them. */
const BUILD_DIR = { a: "Blue Buildings", b: "Red Buildings", g: "Black Buildings" } as const;

export function buildingUrl(side: keyof typeof BUILD_DIR, name: BuildingName): string {
  const file = BUILDINGS[name].file;
  return packUrl(file.startsWith("Enemy Pack/") ? file : `Buildings/${BUILD_DIR[side]}/${file}`);
}

export const CLOUDS = {
  file: "Terrain/Decorations/Clouds/Clouds_0",
  count: 8,
} as const;

/** The cloud bank's layout, in world units from the view's top-left. The
 *  DOM cover (Clouds.tsx) lays out the same grid from the same numbers, so
 *  an HTML screen's clouds and a scene's line up cloud for cloud. */
export const CLOUD_GRID = { dx: 260, dy: 130, scale: 3.2 } as const;

/** The two big pack clouds, recoloured white by compose-ui.mjs into ui/<key>.png. */
export const CLOUD_COVER = { cover1: 1, cover5: 5 } as const;

/** One cloud of the bank. Odd rows sit half a cloud over, so the bank reads
 *  as heaped cloud rather than a grid, and each cloud varies a little in size.
 *  The back layer takes the shaded cloud, so the grey reads as depth. */
export function cloudAt(
  row: number,
  col: number,
): { x: number; y: number; key: keyof typeof CLOUD_COVER; flip: boolean; layer: number; s: number } {
  const k = row * 7 + col;
  const jitter = (k * 37) % 90;
  const layer = k % 3;
  return {
    x: -120 + col * CLOUD_GRID.dx + (row % 2) * (CLOUD_GRID.dx / 2) + jitter - 45,
    y: -60 + row * CLOUD_GRID.dy + (jitter % 40),
    key: layer === 0 ? "cover5" : "cover1",
    flip: k % 4 < 2,
    layer,
    s: 0.9 + ((k * 53) % 21) / 100,
  };
}

/** Which way a cloud at (x, y) from the view's centre leaves it, as a unit
 *  vector, and how far out it sits: 0 at the centre, 1 at a corner or past. */
export function cloudAway(x: number, y: number, w: number, h: number): { dx: number; dy: number; reach: number } {
  const len = Math.hypot(x, y);
  return {
    dx: len ? x / len : 1,
    dy: len ? y / len : 0,
    reach: Math.min(1, Math.hypot(x / (w / 2), y / (h / 2)) / Math.SQRT2),
  };
}

/**
 * Each cloud layer's idle sway, so the bank never stands still while a page
 * loads: `a` world units either side, `p` ms per sweep, alternating like a
 * CSS `alternate` animation. Signs differ so layers slide past each other.
 */
export const CLOUD_DRIFT = [
  { a: 14, p: 9000 },
  { a: -24, p: 7000 },
  { a: 36, p: 5500 },
] as const;

/**
 * A layer's sway at a wall-clock time. Driven by Date.now() in Phaser and by
 * a CSS animation phased to Date.now() in the DOM, so the covers hand over
 * mid-motion without a jump. Sine.easeInOut, which the CSS approximates with
 * cubic-bezier(0.37, 0, 0.63, 1).
 */
export function cloudDrift(layer: number, now: number): number {
  const { a, p } = CLOUD_DRIFT[layer]!;
  const c = now % (2 * p);
  const k = c < p ? c / p : 1 - (c - p) / p;
  return -a + 2 * a * (-(Math.cos(Math.PI * k) - 1) / 2);
}

/** The sky under the cover, the white clouds' mid tone, shared with the DOM
 *  cover (.cloudsSky) so the page's loader and a scene's cover are one sky. */
export const CLOUD_SKY = 0xf0f4f9;

export const FX = {
  dust: { file: "Particle FX/Dust_01.png", frame: 64, frames: 8 },
  explosion: { file: "Particle FX/Explosion_01.png", frame: 192, frames: 8 },
} as const;

/** 25 portraits, 256px each. */
export const AVATARS = { file: "UI Elements/UI Elements/Human Avatars/Avatars_", count: 25 } as const;

export const ICONS = { file: "UI Elements/UI Elements/Icons/Icon_", count: 12 } as const;

/**
 * Which of the pack's twelve icons stands for what, numbered as the files
 * are. They label the draft's numbers, so a stat line is read rather than
 * parsed: a shield for health, crossed arms for damage, a green gem for
 * healing, plus the coin the whole screen is spending. Range has no sheet
 * icon either, so it takes the info mark, Icon_11.
 */
export const ICON = {
  gold: "03",
  damage: "05",
  hp: "06",
  heal: "07",
  range: "11",
  settings: "10",
} as const;

/** Icons that live outside the numbered sheet. */
export const ICON_FILES: Record<string, string> = {
  arrow: "Red Units/Archer/Arrow.png",
};

export function iconUrl(n: string): string {
  return packUrl(ICON_FILES[n] ?? `${ICONS.file}${n}.png`);
}

export function iconKey(n: string): string {
  return `icon_${n}`;
}

export function packUrl(path: string): string {
  return `${ASSET_BASE}/${path}`;
}
