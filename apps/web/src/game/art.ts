// Where the Tiny Swords art lives, and the crop geometry measured out of it.
//
// Every number here was read off the actual PNGs rather than guessed, because
// the pack's sheets are not laid out the way their file sizes suggest:
//
//   - The UI kit ships its panels and buttons as nine-slices spread over a
//     grid WITH GAPS. A 320x320 button is really nine 64px pieces at x/y
//     0, 128 and 256; the 64px bands between them are empty. A 448x448 panel
//     is the same idea with 128px corners and a 64px middle. Nothing can use
//     these directly - see ui.ts, which composes them into a contiguous
//     nine-slice first.
//   - The terrain tileset is a 9x6 grid of 64px tiles. Column 4 is blank and
//     acts as a separator; the grass nine-slice is cols 0-2 x rows 0-2, its
//     centre tile (1,1) the only fully solid one.
//   - Unit sheets are horizontal strips of equal frames. The body sits in the
//     middle of a much larger frame, so the ground anchor has to come from
//     the art, not from the frame centre.
//
// The paths below are the pack's own. What sits in front of them is one
// setting: public/tiny-swords is where scripts/fetch-assets.mjs puts the pack,
// and NEXT_PUBLIC_ASSET_BASE overrides the prefix for hosts that serve the app
// from somewhere other than the root. Discord serves Activities behind a
// /.proxy/ prefix, so that is the single knob to turn when the game moves
// inside Discord. Everything that asks for a file goes through packUrl, CSS
// included, so there is no second place to remember.

const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "/tiny-swords").replace(/\/+$/, "");

/**
 * A nine-slice spread over a sheet with gaps between the pieces.
 * `colX/colW` and `rowY/rowH` give each piece's source rect.
 */
export interface SliceSheet {
  file: string;
  colX: readonly [number, number, number];
  colW: readonly [number, number, number];
  rowY: readonly [number, number, number];
  rowH: readonly [number, number, number];
}

/** The 320x320 UI sheets: nine 64px pieces at 0 / 128 / 256. */
function sheet320(file: string): SliceSheet {
  return {
    file,
    colX: [0, 128, 256],
    colW: [64, 64, 64],
    rowY: [0, 128, 256],
    rowH: [64, 64, 64],
  };
}

/** The 448x448 UI sheets: 128px corners, a 64px middle, gaps between. */
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
  blueButtonDown: sheet320("UI Elements/UI Elements/Buttons/BigBlueButton_Pressed.png"),
  redButton: sheet320("UI Elements/UI Elements/Buttons/BigRedButton_Regular.png"),
  redButtonDown: sheet320("UI Elements/UI Elements/Buttons/BigRedButton_Pressed.png"),
  woodTable: sheet448("UI Elements/UI Elements/Wood Table/WoodTable.png"),
  banner: sheet448("UI Elements/UI Elements/Banners/Banner.png"),
} satisfies Record<string, SliceSheet>;

export type PanelName = keyof typeof PANELS;

/**
 * The pack's progress bar: a three-piece horizontal frame plus a separate
 * fill. Both sheets are 64px tall with the art on a few middle rows, so the
 * bar has a natural height of 19px and a minimum width of two 64px caps.
 * Too wide for a per-unit health pip, which is why only the army totals use
 * it and the pips over units stay hand-drawn.
 */
export const BAR = {
  base: "UI Elements/UI Elements/Bars/SmallBar_Base.png",
  fill: "UI Elements/UI Elements/Bars/SmallBar_Fill.png",
  /** Source x of the left cap, middle and right cap; each 64 wide. */
  capW: 64,
  midX: 128,
  rightX: 256,
  /** Rows the frame art actually occupies inside the 64px sheet. */
  artY: 22,
  artH: 19,
  /** Rows the fill art occupies: a 3px strip inside the frame's channel. */
  fillY: 30,
  fillH: 3,
} as const;

/** The grass island: a nine-slice of 64px tiles in the terrain tileset. */
export const TERRAIN = {
  tileset: "Terrain/Tileset/Tilemap_color1.png",
  tile: 64,
  /** Nine-slice origin in tile units: cols 0-2, rows 0-2. */
  sliceCol: 0,
  sliceRow: 0,
  water: "Terrain/Tileset/Water Background color.png",
  /** 16 frames of 192px; the foam blob is 84px centred in its frame. */
  foam: "Terrain/Tileset/Water Foam.png",
  foamFrame: 192,
  foamFrames: 16,
  /** A soft 79x80 blob, anchored like a unit: a ready-made drop shadow. */
  shadow: "Terrain/Tileset/Shadow.png",
  shadowFrame: 192,
  shadowAnchorX: 96,
  shadowAnchorY: 135,
} as const;

/**
 * Scenery, one entry per FILE rather than one per kind. The pack does not use
 * a single frame size within a kind - Tree1 and Tree2 are 6 frames of 256px
 * while Tree3 and Tree4 are 8 frames of 192px, and the water rocks are 16
 * frames of 64px, not the single wide image their proportions suggest. Sharing
 * one frame size across a kind loads half of them as zero-frame textures.
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
  /**
   * Only the slim pair. Tree1 and Tree2 draw a 219px-wide canopy, which
   * overhangs the board from a 149px margin; Tree3 and Tree4 are 90px across
   * and sit in the margin without reaching the hexes.
   */
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

export const CLOUDS = { file: "Terrain/Decorations/Clouds/Clouds_0", count: 8 } as const;

export const FX = {
  dust: { file: "Particle FX/Dust_01.png", frame: 64, frames: 8 },
  explosion: { file: "Particle FX/Explosion_01.png", frame: 192, frames: 8 },
} as const;

/** 25 portraits, 256px each, for the roster cards. */
export const AVATARS = { file: "UI Elements/UI Elements/Human Avatars/Avatars_", count: 25 } as const;

export const ICONS = { file: "UI Elements/UI Elements/Icons/Icon_", count: 12 } as const;

export function packUrl(path: string): string {
  return `${ASSET_BASE}/${path}`;
}
