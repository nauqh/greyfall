// The Warcraft-style strategic map, built the way the pack's own demo map
// (map.gif) is: one 64px tile per cell, autotiled from an ASCII height map.
// Ground takes the tileset's left block, plateaus its right block, every
// south-facing plateau edge drops a cliff into the cell below, and a slope
// piece at a plateau's end is the way up.
//
// Phase 1 of the strategic layer: look and move only. Nothing here touches
// the engine or the draft.

import type { UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl } from "./art";
import { baseZoom, fitCamera, startGame } from "./boot";
import { HUD_COVER_H, HUD_KEY, StrategicHud } from "./StrategicHud";
import {
  MAP,
  STRAT_COLS,
  STRAT_ROWS,
  at,
  findPath,
  isSlope,
  isLand,
  isWalkable,
  type Cell,
} from "./stratMap";
import { loadUnits, makeAnims, playPose, unitKey } from "./sprites";
import {
  DEPTH,
  addBuilding,
  addDecor,
  addShadow,
  buildWater,
  driftClouds,
  loadBuildings,
  loadTerrain,
  prepareTerrain,
  type Rect,
  type Structure,
} from "./terrain";

/** The tileset's native tile: nothing is stretched. */
const CELL = 64;
/** The map carries its own sea margin, so the world is the grid. */
const WORLD_W = STRAT_COLS * CELL;
const WORLD_H = STRAT_ROWS * CELL;
const STRAT: Rect = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** How close to the screen edge the pointer pans, and how fast, in world
 *  px/s. Screen-edge scrolling, exactly as Warcraft did it. */
const EDGE = 28;
const PAN_PX_S = 840;
/** Camera zoom steps over baseZoom. The first is the native view and the
 *  closest in; out stops about where the whole map fits the page. */
const ZOOMS = [1, 0.8, 0.6] as const;

/** Placed in cells, so a building's base lands on the row it names. */
function cell(side: Structure["side"], name: Structure["name"], col: number, row: number, scale?: number): Structure {
  return { side, name, x: col * CELL, y: row * CELL, scale };
}

/** Blue holds the north-west plateau, red the south-east one; the small
 *  plateaus between are outposts, with a goblin camp on the western one. */
const HALLS: Structure[] = [
  cell("a", "castle", 6.5, 3.9),
  cell("a", "barracks", 10.6, 4.2),
  cell("a", "house1", 4.9, 5.85),
  cell("a", "house2", 6.6, 5.9),
  cell("a", "archery", 7.4, 8.8),
  cell("a", "tower", 9.3, 8.7),
  cell("b", "castle", 26.5, 15.9),
  cell("b", "barracks", 19.6, 13.9),
  cell("b", "house3", 18.6, 15.5),
  cell("b", "house1", 20.4, 16.0),
  cell("b", "tower", 26.0, 4.7),
  cell("b", "goblinHut", 5.2, 12.8),
  cell("g", "deadTree", 3.0, 13.8, 0.6),
];

/** Garrisons around their halls. All homes are walkable. */
const GARRISON: { side: "a" | "b"; cls: UnitClass; home: { col: number; row: number } }[] = [
  { side: "a", cls: "pawn", home: { col: 8, row: 5 } },
  { side: "a", cls: "warrior", home: { col: 11, row: 5 } },
  { side: "a", cls: "lancer", home: { col: 12, row: 3 } },
  { side: "a", cls: "archer", home: { col: 8, row: 7 } },
  { side: "a", cls: "pawn", home: { col: 14, row: 4 } },
  { side: "b", cls: "pawn", home: { col: 17, row: 14 } },
  { side: "b", cls: "warrior", home: { col: 22, row: 13 } },
  { side: "b", cls: "lancer", home: { col: 24, row: 12 } },
  { side: "b", cls: "archer", home: { col: 25, row: 14 } },
  { side: "b", cls: "pawn", home: { col: 21, row: 12 } },
];
/** A wander is a slow amble to a nearby cell, a pause, then on. */
const WANDER_SPEED = 30;
const WANDER_PAUSE = [1200, 3500] as const;
/** How many cells a wander may walk, detours round cliffs included. */
const WANDER_STEPS = 4;
const FLAG_SPEED = 90;

interface Walker {
  side: "a" | "b";
  cls: UnitClass;
  /** Wanderers amble around it; the flag pawn has none and waits for orders. */
  home: Cell | null;
  speed: number;
  sprite: Phaser.GameObjects.Sprite;
  root: Phaser.GameObjects.Container;
  /** Cell centres still to walk, in order. */
  path: { x: number; y: number }[];
  pauseMs: number;
}

export class StrategicScene extends Phaser.Scene {
  /** The pawn the flag sends; null until the first click. */
  private flagPawn: Walker | null = null;
  /** Handed in by the page; absent when the map opens on its own. */
  private onMenu: () => void = () => {};
  /** Touch-drag state: where the gesture started, camera included. */
  private dragStart: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
  /** Everyone on foot: the garrison and the flag pawn. */
  private walkers: Walker[] = [];

  init(data: { onMenu?: () => void }): void {
    this.onMenu = data.onMenu ?? (() => {});
  }

  constructor() {
    super("strategic");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadBuildings(this, HALLS);
    this.load.image("goldMine", packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png"));
    this.load.spritesheet("sheep", packUrl("Terrain/Resources/Meat/Sheep/Sheep_Idle.png"), {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(): void {
    fitCamera(this, WORLD_W / 2, WORLD_H / 2, () => ZOOMS[this.zoomLevel]!);
    prepareTerrain(this);
    makeAnims(this);
    if (!this.anims.exists("sheep_anim")) {
      this.anims.create({ key: "sheep_anim", frames: this.anims.generateFrameNumbers("sheep"), frameRate: 8, repeat: -1 });
    }

    buildWater(this);
    this.buildMap();
    this.buildScenery();
    driftClouds(this, { w: WORLD_W, h: WORLD_H }, "strategic");
    for (const hall of HALLS) addBuilding(this, hall);
    this.buildGarrison();
    this.scene.add(HUD_KEY, StrategicHud, true, {
      map: MAP,
      marks: HALLS.map((h) => ({ col: h.x / CELL, row: h.y / CELL, side: h.side })),
      onMenu: () => this.onMenu(),
      onZoom: (dir: 1 | -1) => this.zoomStep(dir),
    });
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.zoomStep(dy > 0 ? 1 : -1);
    });

    // Touch drag pans; a tap (down-up with little movement) places the flag.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, camX: this.cameras.main.scrollX, camY: this.cameras.main.scrollY, moved: false };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      // Canvas px to world px.
      const zoom = this.cameras.main.zoom;
      const dx = (p.x - this.dragStart.x) / zoom;
      const dy = (p.y - this.dragStart.y) / zoom;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.dragStart.moved = true;
      this.setScroll(this.dragStart.camX - dx, this.dragStart.camY - dy);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const start = this.dragStart;
      this.dragStart = null;
      if (!start || start.moved) return;
      const col = Math.floor((p.worldX - STRAT.x0) / CELL);
      const row = Math.floor((p.worldY - STRAT.y0) / CELL);
      if (col < 0 || col >= STRAT_COLS || row < 0 || row >= STRAT_ROWS) return;
      // The flag stands on land, never on water or a cliff face.
      if (!isWalkable(col, row)) return;
      this.moveFlag(col, row);
    });
  }

  /** One step in or out. Zoom scales around the view's centre, so the
   *  spot being looked at stays put; update() re-clamps as it animates. */
  private zoomStep(dir: 1 | -1): void {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, this.zoomLevel + dir));
    if (next === this.zoomLevel) return;
    this.zoomLevel = next;
    this.cameras.main.zoomTo(ZOOMS[next]! * baseZoom(this), 180, "Sine.easeOut", true);
  }
  private zoomLevel = 0;

  /** Scroll with the world clamps shared by edge-pan, drag and zoom. A view
   *  wider than the world centres on it. */
  private setScroll(x: number, y: number): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // The view's left edge sits this far past scroll: zoom works from the centre.
    const shiftX = (cam.width - viewW) / 2;
    const shiftY = (cam.height - viewH) / 2;
    // The HUD bar covers the bottom of the view; the map scrolls up past it.
    const under = (HUD_COVER_H * baseZoom(this)) / cam.zoom;
    const fit = (v: number, max: number): number => (max < 0 ? max / 2 : Math.max(0, Math.min(max, v)));
    cam.scrollX = fit(x + shiftX, WORLD_W - viewW) - shiftX;
    cam.scrollY = fit(y + shiftY, WORLD_H + under - viewH) - shiftY;
  }

  /** Screen-edge pan, Warcraft-style, at the same on-screen speed at any
   *  zoom. The clamp runs every frame so a zoom tween stays in bounds. */
  update(_time: number, delta: number): void {
    this.updateWalkers(delta);
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    // Pointer coordinates are canvas pixels, baseZoom per HUD unit.
    const e = EDGE * baseZoom(this);
    const dx = p.x < e ? -1 : p.x > cam.width - e ? 1 : 0;
    const dy = p.y < e ? -1 : p.y > cam.height - e ? 1 : 0;
    const step = (PAN_PX_S * baseZoom(this) * delta) / 1000 / cam.zoom;
    this.setScroll(cam.scrollX + dx * step, cam.scrollY + dy * step);
  }

  /** The first click drops the pawn there; after that it walks the way. */
  private moveFlag(col: number, row: number): void {
    if (!this.flagPawn) {
      this.flagPawn = this.addWalker("a", "pawn", { col, row }, null, FLAG_SPEED, 0.5);
      return;
    }
    this.sendTo(this.flagPawn, { col, row });
  }

  /** Route a walker over ground and ramps only. From the cell it is already
   *  heading into, so a new order never cuts across mid-step. */
  private sendTo(w: Walker, to: Cell): boolean {
    const heading = w.path[0];
    const route = findPath(heading ? this.cellAt(heading.x, heading.y) : this.cellAt(w.root.x, w.root.y), to);
    if (!route) return false;
    w.path = [...(heading ? [heading] : []), ...route.map((c) => this.cellXY(c.col, c.row))];
    return true;
  }

  private cellAt(x: number, y: number): Cell {
    return { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
  }


  private cellXY(col: number, row: number): { x: number; y: number } {
    return {
      x: STRAT.x0 + col * CELL + CELL / 2,
      y: STRAT.y0 + row * CELL + CELL / 2,
    };
  }

  /** Foam under the shore, ground everywhere on land, then plateau tops,
   *  cliffs and slopes over it: the pack's own layer order. */
  private buildMap(): void {
    const tile = (c: number, r: number, tc: number, tr: number, z: number): void => {
      this.add.image(c * CELL, r * CELL, "tileset", `tile_${tc}_${tr}`).setOrigin(0).setDepth(z);
    };
    const plateau = (c: number, r: number): boolean => at(c, r) === "#";
    // A cliff face stands in every cell under a plateau or ramp that is not
    // plateau itself - behind a ramp too, so the ramp reads as cut into the
    // rock rather than laid on the lawn.
    const wall = (c: number, r: number): boolean => (plateau(c, r - 1) || isSlope(c, r - 1)) && !plateau(c, r);

    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        let shore = false;
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) shore ||= !isLand(c + dc, r + dr);
        }
        // Opaque and in step, like the battle island: the blobs read as one
        // shoreline only when they lap together. A cliff standing in the sea
        // gets its own.
        if ((isLand(c, r) && shore) || (!isLand(c, r) && wall(c, r))) {
          this.add.sprite(c * CELL + CELL / 2, r * CELL + CELL / 2, "foam").setDepth(DEPTH.foam).play("foam_anim");
        }
        if (isLand(c, r)) {
          tile(c, r, edge(isLand(c - 1, r), isLand(c + 1, r)), edge(isLand(c, r - 1), isLand(c, r + 1)), DEPTH.island);
        }
      }
    }
    // The pack's drop shadow under every plateau cell and cliff face, a
    // little low: it shows as a dark band at the cliff foot and a thin halo
    // down the sides, which is what reads as height. Not round ramps: their
    // open corners would show it as a box.
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (plateau(c, r) || (wall(c, r) && !isSlope(c, r) && !isSlope(c, r - 1))) {
          this.add.image(c * CELL + CELL / 2, r * CELL + CELL / 2 + 16, "shadow_src").setDepth(DEPTH.island + 0.25);
        }
      }
    }
    // Tops, then walls, then ramps over the walls. Tops edge against plateau
    // only, so the cell above a ramp keeps its rim. Walls cap where the run
    // ends; row 4 stands on grass, row 5 in water.
    const top = DEPTH.island + 0.5;
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (plateau(c, r)) {
          tile(c, r, 5 + edge(plateau(c - 1, r), plateau(c + 1, r)), edge(plateau(c, r - 1), plateau(c, r + 1)), top);
        }
      }
    }
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (wall(c, r)) tile(c, r, 5 + edge(wall(c - 1, r), wall(c + 1, r)), isLand(c, r) ? 4 : 5, top);
      }
    }
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (!isSlope(c, r)) continue;
        const col = at(c, r) === "<" ? 0 : 3;
        tile(c, r, col, 4, top);
        tile(c, r + 1, col, 5, top);
      }
    }
  }

  /** Lumber lines along the coasts, gold by each base and one contested in
   *  the lake, sheep on the lowland and rocks in the shallows. */
  private buildScenery(): void {
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r], i) => addDecor(this, kind, c * CELL, r * CELL, 1, `strat-${kind}-${i}`));
    put("tree", [
      [2.6, 2.4], [3.4, 1.7], [11.9, 1.9], [13.8, 2.6], [14.9, 2.3],
      [23.5, 1.9], [24.6, 1.6], [25.8, 1.9], [27.0, 1.7], [28.5, 2.4], [29.8, 2.9], [30.4, 4.3],
      [2.6, 9.8], [2.5, 11.2], [2.6, 13.4], [4.4, 14.2],
      [15.8, 15.8], [17.0, 16.6], [13.6, 17.8], [29.4, 13.6],
    ]);
    put("bush", [[12.5, 6.5], [18.4, 3.7], [9.6, 12.8], [22.7, 9.5], [21.3, 17.6], [3.4, 18.6]]);
    put("rock", [[15.5, 6.6], [26.6, 6.5], [11.6, 10.8], [8.4, 16.6]]);
    put("waterRock", [
      [1.2, 6.4], [17.5, 1.6], [13.8, 10.9], [18.3, 11.6], [10.8, 15.4], [24.5, 18.2], [31.0, 11.5], [6.2, 18.5],
    ]).forEach((s) => s.setDepth(DEPTH.foam));

    for (const [c, r] of [[15.5, 3.8], [16.6, 14.8], [20.0, 9.8]] as const) {
      this.add
        .image(c * CELL, r * CELL, "goldMine")
        .setOrigin(0.5, 0.78)
        .setDepth(DEPTH.decorBehind + (r * CELL) / 1000);
    }
    for (const [c, r] of [[3.3, 7.3], [12.4, 9.4], [25.4, 10.6], [27.6, 11.4]] as const) {
      const sheep = this.add
        .sprite(c * CELL, r * CELL, "sheep")
        .setOrigin(0.5, 0.66)
        .setDepth(DEPTH.decorBehind + (r * CELL) / 1000)
        .setFlipX(c > 16)
        .play("sheep_anim");
      if (sheep.anims.currentAnim) sheep.anims.setProgress(Math.random());
    }
  }
  /** The garrison: one of every class per hall, each idling or ambling
   *  around its home cell. */
  private buildGarrison(): void {
    for (const g of GARRISON) {
      this.addWalker(g.side, g.cls, g.home, g.home, WANDER_SPEED, g.cls === "lancer" ? 0.8 : 0.62);
    }
  }

  private addWalker(
    side: "a" | "b",
    cls: UnitClass,
    at: Cell,
    home: Cell | null,
    speed: number,
    shadowScale: number,
  ): Walker {
    const { x, y } = this.cellXY(at.col, at.row);
    // Children ride at local origin: a container adds its own position,
    // so world coords on the children would double the offset and throw
    // every troop off the map.
    const shadow = addShadow(this, 0, 0, shadowScale);
    const sprite = this.add.sprite(0, 0, unitKey(side, cls, "idle"));
    playPose(sprite, side, cls, "idle");
    const root = this.add.container(x, y, [shadow, sprite]).setDepth(DEPTH.unit + y);
    const w: Walker = { side, cls, home, speed, sprite, root, path: [], pauseMs: 0 };
    this.walkers.push(w);
    return w;
  }

  /** Walk each path a cell centre at a time: run anim while moving, idle
   *  while paused, the flip follows the direction of travel. A wanderer
   *  with nowhere to go picks a cell near home it can reach in a few steps. */
  private updateWalkers(delta: number): void {
    for (const w of this.walkers) {
      const next = w.path[0];
      if (next) {
        const dx = next.x - w.root.x;
        const dy = next.y - w.root.y;
        const dist = Math.hypot(dx, dy);
        const step = (w.speed * delta) / 1000;
        if (dist <= step) {
          w.root.setPosition(next.x, next.y);
          w.path.shift();
        } else {
          w.root.setPosition(w.root.x + (dx / dist) * step, w.root.y + (dy / dist) * step);
          if (dx !== 0) w.sprite.setFlipX(dx < 0 !== (w.side === "b"));
        }
        w.root.setDepth(DEPTH.unit + w.root.y);
        if (w.path.length > 0) {
          playPose(w.sprite, w.side, w.cls, "run");
        } else {
          playPose(w.sprite, w.side, w.cls, "idle");
          w.pauseMs = WANDER_PAUSE[0] + Math.random() * (WANDER_PAUSE[1] - WANDER_PAUSE[0]);
        }
        continue;
      }
      if (!w.home) continue;
      w.pauseMs -= delta;
      if (w.pauseMs > 0) continue;
      for (let tries = 0; tries < 8 && w.path.length === 0; tries++) {
        const to = {
          col: w.home.col + Math.floor(Math.random() * 5) - 2,
          row: w.home.row + Math.floor(Math.random() * 5) - 2,
        };
        const route = findPath(this.cellAt(w.root.x, w.root.y), to);
        if (route && route.length > 0 && route.length <= WANDER_STEPS) {
          w.path = route.map((c) => this.cellXY(c.col, c.row));
        }
      }
      if (w.path.length === 0) w.pauseMs = WANDER_PAUSE[0];
    }
  }

}

/** What the page hands the map. Nothing for now but the way back. */
export interface StrategicLauncher {
  onMenu: () => void;
}

export function startStrategic(
  parent: HTMLElement,
  launcher: StrategicLauncher,
): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "strategic", StrategicScene, launcher);
}
