// A grass island in open water, the shape the pack's terrain art is drawn for.
// The island is a nine-slice of the tileset's grass, so it gets real edges
// instead of a flat green rectangle.
//
// Scenery is placed with the engine's seeded RNG, so a battle seed always
// produces the same island and a replay looks like its own battle.

import { makeRng, type Rng } from "@greyfall/engine";
import * as Phaser from "phaser";

import {
  BUILDINGS,
  CLOUDS,
  DECOR,
  TERRAIN,
  buildingUrl,
  packUrl,
  type BuildingName,
  type DecorKind,
} from "./art";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const DEPTH = {
  water: 0,
  foam: 1,
  island: 2,
  ground: 3,
  decorBehind: 4,
  clouds: 500,
  unit: 1000,
  fx: 6000,
  hud: 9000,
} as const;

export function loadTerrain(scene: Phaser.Scene): void {
  scene.load.image("tileset", packUrl(TERRAIN.tileset));
  scene.load.image("water", packUrl(TERRAIN.water));
  scene.load.image("shadow_src", packUrl(TERRAIN.shadow));
  scene.load.spritesheet("foam", packUrl(TERRAIN.foam), {
    frameWidth: TERRAIN.foamFrame,
    frameHeight: TERRAIN.foamFrame,
  });
  for (const specs of Object.values(DECOR)) {
    for (const d of specs) {
      scene.load.spritesheet(d.key, packUrl(d.file), {
        frameWidth: d.frame,
        frameHeight: d.frame,
      });
    }
  }
  for (let i = 1; i <= CLOUDS.count; i++) {
    scene.load.image(`cloud${i}`, packUrl(`${CLOUDS.file}${i}.png`));
  }
}

/** Register the nine grass tiles and the scenery animations. */
export function prepareTerrain(scene: Phaser.Scene): void {
  const tex = scene.textures.get("tileset");
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const name = `t${c}${r}`;
      if (!tex.has(name)) {
        tex.add(
          name,
          0,
          (TERRAIN.sliceCol + c) * TERRAIN.tile,
          (TERRAIN.sliceRow + r) * TERRAIN.tile,
          TERRAIN.tile,
          TERRAIN.tile,
        );
      }
    }
  }

  if (!scene.anims.exists("foam_anim")) {
    scene.anims.create({
      key: "foam_anim",
      frames: scene.anims.generateFrameNumbers("foam", { start: 0, end: TERRAIN.foamFrames - 1 }),
      frameRate: 8,
      repeat: -1,
    });
  }
  for (const specs of Object.values(DECOR)) {
    for (const d of specs) {
      if (d.frames < 2 || scene.anims.exists(`${d.key}_anim`)) continue;
      scene.anims.create({
        key: `${d.key}_anim`,
        frames: scene.anims.generateFrameNumbers(d.key, { start: 0, end: d.frames - 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}

// Plain world object, not scroll-fixed: the camera carries a zoom and a
// matching scroll, and opting out of the scroll alone lands it off-canvas.
export function buildWater(scene: Phaser.Scene, w: number, h: number): void {
  scene.add.tileSprite(0, 0, w, h, "water").setOrigin(0).setDepth(DEPTH.water);
}

/** Snapped to whole 64px tiles. Returns the rect actually covered. */
export function buildIsland(scene: Phaser.Scene, rect: Rect): Rect {
  const t = TERRAIN.tile;
  const x0 = Math.floor(rect.x0 / t) * t;
  const y0 = Math.floor(rect.y0 / t) * t;
  const cols = Math.ceil((rect.x1 - x0) / t);
  const rows = Math.ceil((rect.y1 - y0) / t);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // First / middle / last picks the slice cell.
      const sc = c === 0 ? 0 : c === cols - 1 ? 2 : 1;
      const sr = r === 0 ? 0 : r === rows - 1 ? 2 : 1;
      scene.add
        .image(x0 + c * t, y0 + r * t, "tileset", `t${sc}${sr}`)
        .setOrigin(0)
        .setDepth(DEPTH.island);
    }
  }
  return { x0, y0, x1: x0 + cols * t, y1: y0 + rows * t };
}

/** Foam hugging the shoreline: one blob per perimeter tile, under the island. */
export function buildFoam(scene: Phaser.Scene, island: Rect): void {
  const t = TERRAIN.tile;
  const cols = Math.round((island.x1 - island.x0) / t);
  const rows = Math.round((island.y1 - island.y0) / t);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (c > 0 && c < cols - 1 && r > 0 && r < rows - 1) continue;
      // The blob is 84px of art in a 192px frame, so centred on a 64px shore
      // tile it leaves a ~10px fringe past the grass and overlaps its
      // neighbours. Opaque and in step is what makes that fringe read as one
      // shoreline: part alpha bands where blobs overlap and staggered phases
      // give every tile its own edge, which is the row of squares.
      scene.add
        .sprite(island.x0 + (c + 0.5) * t, island.y0 + (r + 0.5) * t, "foam")
        .setDepth(DEPTH.foam)
        .play("foam_anim");
    }
  }
}

/** One building on the ground, at the point its base touches. */
export interface Structure {
  side: "a" | "b";
  name: BuildingName;
  x: number;
  y: number;
}

function buildingKey(side: "a" | "b", name: BuildingName): string {
  return `build_${side}_${name}`;
}

export function loadBuildings(scene: Phaser.Scene, all: readonly Structure[]): void {
  // A village has two of the same house in it, and the loader warns on a
  // repeated key.
  const seen = new Set<string>();
  for (const s of all) {
    const key = buildingKey(s.side, s.name);
    if (seen.has(key)) continue;
    seen.add(key);
    scene.load.image(key, buildingUrl(s.side, s.name));
  }
}

/** The pack bakes each building's shadow in, so this only stands it up. */
export function addBuilding(scene: Phaser.Scene, s: Structure): Phaser.GameObjects.Image {
  const spec = BUILDINGS[s.name];
  return (
    scene.add
      .image(s.x, s.y, buildingKey(s.side, s.name))
      .setOrigin(0.5, spec.anchorY / spec.h)
      // The same y-sorted band as the props, so a tree in front of a house
      // covers it and one behind it does not.
      .setDepth(DEPTH.decorBehind + s.y / 1000)
  );
}

/**
 * Margins either side of the board, plus rocks in the water. Nothing goes
 * between the armies, so the board stays readable.
 */
export function scatterDecor(
  scene: Phaser.Scene,
  island: Rect,
  board: Rect,
  canvas: { w: number; h: number },
  seed: number | string,
): void {
  const rng: Rng = makeRng(`decor-${seed}`);
  const place = (kind: DecorKind, x: number, y: number, scale = 1): Phaser.GameObjects.Sprite => {
    const specs = DECOR[kind];
    const d = specs[rng.int(specs.length)]!;
    const s = scene.add
      .sprite(x, y, d.key)
      .setOrigin(0.5, d.anchorY / d.frame)
      .setDepth(DEPTH.decorBehind + y / 1000)
      .setScale(scale);
    if (d.frames > 1) {
      s.play(`${d.key}_anim`);
      // Guarded: a sheet with zero frames leaves no current anim, and
      // setProgress then throws.
      if (s.anims.currentAnim) s.anims.setProgress(rng.next());
    }
    if (rng.next() < 0.5) s.setFlipX(true);
    return s;
  };

  // Between the island edge and the board.
  for (const side of [-1, 1] as const) {
    const near = side < 0 ? island.x0 : board.x1;
    const far = side < 0 ? board.x0 : island.x1;
    const width = far - near;
    if (width < 40) continue;
    const count = Math.max(2, Math.floor(width / 70));
    for (let i = 0; i < count; i++) {
      const x = near + 20 + rng.next() * Math.max(1, width - 40);
      const y = island.y0 + 40 + rng.next() * (island.y1 - island.y0 - 80);
      const roll = rng.next();
      if (roll < 0.34) place("tree", x, y, 0.8);
      else if (roll < 0.75) place("bush", x, y);
      else place("rock", x, y);
    }
  }

  // Out in the water, clear of the island.
  for (let i = 0; i < 6; i++) {
    const left = rng.next() < 0.5;
    const x = left ? rng.next() * (island.x0 - 30) : island.x1 + 30 + rng.next() * (canvas.w - island.x1 - 30);
    const y = 40 + rng.next() * (canvas.h - 80);
    place("waterRock", x, y, 0.9).setDepth(DEPTH.foam);
  }
}

/** Slow clouds behind the units. */
export function driftClouds(
  scene: Phaser.Scene,
  canvas: { w: number; h: number },
  seed: number | string,
): void {
  const rng = makeRng(`cloud-${seed}`);
  for (let i = 0; i < 3; i++) {
    const cloud = scene.add
      .image(rng.next() * canvas.w, 40 + rng.next() * (canvas.h - 120), `cloud${1 + rng.int(CLOUDS.count)}`)
      .setDepth(DEPTH.clouds)
      .setAlpha(0.22)
      .setScale(0.8 + rng.next() * 0.5);
    const drift = 90000 + rng.next() * 60000;
    scene.tweens.add({
      targets: cloud,
      x: cloud.x + canvas.w + 600,
      duration: drift,
      repeat: -1,
      onRepeat: () => cloud.setX(-600),
    });
  }
}

/** The pack blob, anchored like a unit. */
export function addShadow(scene: Phaser.Scene, x: number, y: number, scale: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, "shadow_src")
    .setOrigin(TERRAIN.shadowAnchorX / TERRAIN.shadowFrame, TERRAIN.shadowAnchorY / TERRAIN.shadowFrame)
    .setDepth(DEPTH.ground)
    .setAlpha(0.35)
    .setScale(scale);
}
