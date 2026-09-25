// A grass island in open water, the shape the pack's terrain art is drawn for.
// The island is a nine-slice of the tileset's grass, so it gets real edges
// instead of a flat green rectangle.
//
// Scenery is placed with the engine's seeded RNG, so a battle seed always
// produces the same island and a replay looks like its own battle.

import { makeRng, type Rng } from "@greyfall/engine";
import * as Phaser from "phaser";

import { GAME_H, GAME_W, WATER_SPAN } from "./boot";
import {
  BUILDINGS,
  CLOUDS,
  CLOUD_COVER,
  CLOUD_DRIFT,
  CLOUD_GRID,
  CLOUD_SKY,
  cloudAt,
  cloudAway,
  cloudDrift,
  DECOR,
  TERRAIN,
  buildingUrl,
  packUrl,
  type BuildingName,
  type BuildingSpec,
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
  for (const key of Object.keys(CLOUD_COVER)) scene.load.image(key, packUrl(`ui/${key}.png`));
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

  // Every cell of the 9x6 sheet, for the strategic map's autotiler, on
  // each colour of the sheet a scene has loaded.
  for (const key of ["tileset", "tilesetLow"]) {
    if (!scene.textures.exists(key)) continue;
    const sheet = scene.textures.get(key);
    for (let c = 0; c < 9; c++) {
      for (let r = 0; r < 6; r++) {
        const name = `tile_${c}_${r}`;
        if (!sheet.has(name)) {
          sheet.add(name, 0, c * TERRAIN.tile, r * TERRAIN.tile, TERRAIN.tile, TERRAIN.tile);
        }
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
// Far bigger than any window EXPAND can open around the world, and centred on
// it, so the water runs to the edges of the page with no seam.
export function buildWater(scene: Phaser.Scene): void {
  scene.add
    .tileSprite(GAME_W / 2, GAME_H / 2, WATER_SPAN.w, WATER_SPAN.h, "water")
    .setOrigin(0.5)
    .setDepth(DEPTH.water);
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

/** One building on the ground, at the point its base touches.
 *  Side "g" is the pack's Black Buildings: the desaturated Greying set. */
export interface Structure {
  side: "a" | "b" | "g";
  name: BuildingName;
  x: number;
  y: number;
  /** Drawn smaller than the art's native size when set. */
  scale?: number;
}

function buildingKey(side: "a" | "b" | "g", name: BuildingName): string {
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
    const spec = BUILDINGS[s.name] as BuildingSpec;
    if (spec.frame) {
      scene.load.spritesheet(key, buildingUrl(s.side, s.name), {
        frameWidth: spec.frame,
        frameHeight: spec.h,
      });
    } else {
      scene.load.image(key, buildingUrl(s.side, s.name));
    }
  }
}

/** The pack bakes each building's shadow in, so this only stands it up. */
export function addBuilding(scene: Phaser.Scene, s: Structure): Phaser.GameObjects.Image {
  const spec = BUILDINGS[s.name];
  return (
    scene.add
      .image(s.x, s.y, buildingKey(s.side, s.name), (BUILDINGS[s.name] as BuildingSpec).frame ? 0 : undefined)
      .setOrigin(0.5, spec.anchorY / spec.h)
      .setScale(s.scale ?? 1)
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

  // Sea rocks in a ring around the island, above and below it, close enough
  // to read as its shallows. The page is full-bleed now, so a rock scattered
  // across the whole canvas can land on a screen edge and read as misplaced;
  // near the island it always reads as scenery. The left column is under the
  // intro menu, the right one is a sliver, so both are skipped.
  for (let i = 0; i < 6; i++) {
    const x = island.x0 + 40 + rng.next() * (island.x1 - island.x0 - 80);
    const y =
      rng.next() < 0.5
        ? island.y0 - 120 + rng.next() * 70
        : island.y1 + 50 + rng.next() * 60;
    place("waterRock", x, y, 0.9).setDepth(DEPTH.foam);
  }
}

/** One prop, hand-placed. Same anim/flip treatment scatterDecor gives. */
export function addDecor(
  scene: Phaser.Scene,
  kind: DecorKind,
  x: number,
  y: number,
  scale = 1,
  seed: number | string = 0,
): Phaser.GameObjects.Sprite {
  const rng = makeRng(`decor-${kind}-${seed}`);
  const specs = DECOR[kind];
  const d = specs[rng.int(specs.length)]!;
  const s = scene.add
    .sprite(x, y, d.key)
    .setOrigin(0.5, d.anchorY / d.frame)
    .setDepth(DEPTH.decorBehind + y / 1000)
    .setScale(scale);
  if (d.frames > 1) {
    s.play(`${d.key}_anim`);
    if (s.anims.currentAnim) s.anims.setProgress(rng.next());
    if (rng.next() < 0.5) s.setFlipX(true);
  }
  return s;
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

/**
 * A bank of cloud over the whole view, the screen transition between pages.
 * "open" starts covered and parts from the middle outward; "close" draws the
 * clouds in from the edges until the view is covered. `done` fires as the
 * last clouds thin (open) or once the cover is solid (close).
 */
export function cloudCover(scene: Phaser.Scene, mode: "open" | "close", done: () => void): void {
  // worldView only refreshes at render, so in create() it predates the
  // camera's fit zoom; work the view out from scroll and zoom instead.
  const cam = scene.cameras.main;
  const vw = cam.width / cam.zoom;
  const vh = cam.height / cam.zoom;
  const view = new Phaser.Geom.Rectangle(
    cam.scrollX + (cam.width - vw) * cam.originX,
    cam.scrollY + (cam.height - vh) * cam.originY,
    vw,
    vh,
  );
  const depth = DEPTH.hud + 40;
  const opening = mode === "open";
  // Solid under the clouds, so the gaps between them never show the world.
  const backdrop = scene.add
    .rectangle(view.centerX, view.centerY, view.width + 400, view.height + 400, CLOUD_SKY)
    .setDepth(depth)
    .setAlpha(opening ? 1 : 0);
  // Three layers, each swaying on the wall clock (art.ts cloudDrift), so the
  // bank never freezes while the next page loads and a cover handed over
  // mid-sway (to the DOM loader, or to the next scene) lines up exactly.
  const layers = CLOUD_DRIFT.map((_, i) => scene.add.container(0, 0).setDepth(depth + 1 + i));
  // Still under reduced motion, matching the CSS cover's media query.
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const sway = (): void => {
    if (still) return;
    const now = Date.now();
    layers.forEach((l, i) => l.setX(cloudDrift(i, now)));
  };
  sway();
  scene.events.on(Phaser.Scenes.Events.UPDATE, sway);
  const stopSway = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, sway);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopSway);

  const clouds: Phaser.GameObjects.Image[] = [];
  for (let row = 0; view.y - 60 + row * CLOUD_GRID.dy < view.bottom + 120; row++) {
    for (let col = 0; view.x - 120 + col * CLOUD_GRID.dx < view.right + 200; col++) {
      const c = cloudAt(row, col);
      const cloud = scene.add
        .image(view.x + c.x, view.y + c.y, c.key)
        .setFlipX(c.flip)
        .setScale(CLOUD_GRID.scale * c.s);
      layers[c.layer]!.add(cloud);
      clouds.push(cloud);
    }
  }

  // A flight through the bank: parting, every cloud leaves outward from the
  // centre and grows, so the view opens as a round hole edged with puffs;
  // closing, they settle back in from that size. A left/right split opened a
  // seam of the clouds' thin wisps with the world striped through it.
  let last = 0;
  for (const c of clouds) {
    const away = cloudAway(c.x - view.centerX, c.y - view.centerY, view.width, view.height);
    const delay = opening ? 200 + away.reach * 350 : (1 - away.reach) * 300;
    last = Math.max(last, delay);
    const home = { x: c.x, y: c.y, scale: c.scale };
    const far = opening ? 0.8 : 0.5;
    const out = { x: c.x + away.dx * view.width * far, y: c.y + away.dy * view.width * far };
    // A cloud stays solid while it moves and only thins at the end of its
    // run: fading the whole way made the bank a grey smear.
    if (opening) {
      scene.tweens.add({ targets: c, ...out, scale: home.scale * 1.25, delay, duration: 1000, ease: "Sine.easeIn" });
      scene.tweens.add({ targets: c, alpha: 0, delay: delay + 550, duration: 450, ease: "Sine.easeIn" });
    } else {
      c.setPosition(out.x, out.y).setScale(home.scale * 1.25).setAlpha(0);
      scene.tweens.add({ targets: c, ...home, delay, duration: 700, ease: "Sine.easeOut" });
      scene.tweens.add({ targets: c, alpha: 1, delay, duration: 300, ease: "Sine.easeOut" });
    }
  }
  // Parting, the gap first opens onto haze, which lifts once the middle has
  // cleared: fading it sooner striped the world through the clouds' wisps.
  // Closing, it comes back as the edges meet, so no gap shows the world.
  scene.tweens.add({
    targets: backdrop,
    alpha: opening ? 0 : 1,
    delay: opening ? 800 : last + 100,
    duration: opening ? 500 : 450,
    onComplete: () => opening && backdrop.destroy(),
  });
  scene.time.delayedCall(opening ? last + 1000 : last + 720, () => {
    // An open cover is spent once the last cloud is out; a closed one stays
    // up, still swaying, until the page swaps.
    if (opening) {
      stopSway();
      for (const l of layers) l.destroy();
    }
  });
  scene.time.delayedCall(opening ? last + 600 : last + 720, done);
}
