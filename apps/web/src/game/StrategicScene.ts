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
import { DPR, fitCamera, startGame } from "./boot";
import { HUD_BAR_H, HUD_KEY, StrategicHud } from "./StrategicHud";
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

/** `~` water, `.` ground, `#` plateau. `<` / `>` are slopes: they sit in a
 *  plateau's bottom row at its west / east end and run down into the row
 *  below. The row under a plateau's bottom edge is its cliff face, so it is
 *  drawn as stone and nothing stands there. */
const MAP = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~#########~~~~~~~~~~~.....~~~~",
  "~~###########...~~~~~~.........~",
  "~~###########......~~~..####...~",
  "~~###########.......~...####>..~",
  "~~..#########>..........~~.....~",
  "~~.............~~...........~~~~",
  "~~~...####.......~~~~........~~~",
  "~~~...####>.....~~~~~~.......~~~",
  "~~~.............~~~..~~.......~~",
  "~~..........~~~~~~~~~~~.......~~",
  "~~..###....~~~~~.~~~~~~~......~~",
  "~~..###>..~~~~~~~~~~..........~~",
  "~~.......~~~~~~~..........###.~~",
  "~~~~.....~~~~~~........#######~~",
  "~~~~.....~~~~~.........#######~~",
  "~~~~~~~..~~~..........<#######~~",
  "~~~~~~~~~~~~~.........~~~~~~~~~~",
  "~~..~~~~~~~~~~~~~.....~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];
export const STRAT_COLS = MAP[0]!.length;
export const STRAT_ROWS = MAP.length;
/** The tileset's native tile: nothing is stretched. */
const CELL = 64;
/** The map carries its own sea margin, so the world is the grid. */
const WORLD_W = STRAT_COLS * CELL;
const WORLD_H = STRAT_ROWS * CELL;
const STRAT: Rect = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };

function at(col: number, row: number): string {
  return MAP[row]?.[col] ?? "~";
}
function isLand(col: number, row: number): boolean {
  return at(col, row) !== "~";
}
function isHigh(col: number, row: number): boolean {
  return "#<>".includes(at(col, row));
}
/** A plateau cell or slope whose south side drops. */
function castsCliff(col: number, row: number): boolean {
  return isHigh(col, row) && !isHigh(col, row + 1);
}
/** Where the flag and the troops may stand: land that is not a cliff face.
 *  A slope's lower half is the ramp, so it stays walkable. */
function isWalkable(col: number, row: number): boolean {
  return isLand(col, row) && !(at(col, row - 1) === "#" && castsCliff(col, row - 1));
}
function level(col: number, row: number): number {
  return isHigh(col, row) ? 2 : isLand(col, row) ? 1 : 0;
}

/** The tileset's 4x4 blocks: 3x3 edges plus a one-wide column, a one-tall
 *  row and a single. Picks the column (or row) from the two neighbours. */
function edge(before: boolean, after: boolean): number {
  return before ? (after ? 1 : 2) : after ? 0 : 3;
}

/** How close to the screen edge the pointer pans, and how fast, in world
 *  px/s. Screen-edge scrolling, exactly as Warcraft did it. */
const EDGE = 28;
const PAN_PX_S = 840;
/** Camera zoom steps over DPR. The first is the native view and the
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
  cell("b", "barracks", 21.0, 13.9),
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
  { side: "b", cls: "pawn", home: { col: 20, row: 11 } },
];
/** A wander is a slow amble to a nearby point, a pause, then on. */
const WANDER_SPEED = 30;
const WANDER_PAUSE = [1200, 3500] as const;

export class StrategicScene extends Phaser.Scene {
  /** Grid position of the flag; null until the first click. */
  private flag: { col: number; row: number } | null = null;
  private flagMark: Phaser.GameObjects.Container | null = null;
  /** Handed in by the page; absent when the map opens on its own. */
  private onMenu: () => void = () => {};
  /** Touch-drag state: where the gesture started, camera included. */
  private dragStart: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
  /** The garrison troops ambling around their halls. */
  private wanderers: {
    side: "a" | "b";
    cls: UnitClass;
    home: { x: number; y: number };
    sprite: Phaser.GameObjects.Sprite;
    root: Phaser.GameObjects.Container;
    target: { x: number; y: number } | null;
    pauseMs: number;
  }[] = [];

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
    fitCamera(this, WORLD_W / 2, WORLD_H / 2);
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
    this.cameras.main.zoomTo(ZOOMS[next]! * DPR, 180, "Sine.easeOut", true);
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
    const under = (HUD_BAR_H * DPR) / cam.zoom;
    const fit = (v: number, max: number): number => (max < 0 ? max / 2 : Math.max(0, Math.min(max, v)));
    cam.scrollX = fit(x + shiftX, WORLD_W - viewW) - shiftX;
    cam.scrollY = fit(y + shiftY, WORLD_H + under - viewH) - shiftY;
  }

  /** Screen-edge pan, Warcraft-style, at the same on-screen speed at any
   *  zoom. The clamp runs every frame so a zoom tween stays in bounds. */
  update(_time: number, delta: number): void {
    this.updateWanderers(delta);
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    // Pointer coordinates are canvas pixels, DPR per HUD unit.
    const e = EDGE * DPR;
    const dx = p.x < e ? -1 : p.x > cam.width - e ? 1 : 0;
    const dy = p.y < e ? -1 : p.y > cam.height - e ? 1 : 0;
    const step = (PAN_PX_S * DPR * delta) / 1000 / cam.zoom;
    this.setScroll(cam.scrollX + dx * step, cam.scrollY + dy * step);
  }

  private moveFlag(col: number, row: number): void {
    this.flag = { col, row };
    const { x, y } = this.cellXY(col, row);
    if (!this.flagMark) {
      // Local origin like the garrison: the container carries the position.
      const shadow = addShadow(this, 0, 0, 0.5);
      // Above the stamped water grass, which restamps at ground level.
      shadow.setDepth(DEPTH.ground + 2);
      const sprite = this.add.sprite(0, 0, unitKey("a", "pawn", "idle"));
      playPose(sprite, "a", "pawn", "idle");
      this.flagMark = this.add.container(x, y, [shadow, sprite]);
      sprite.setDepth(1);
      shadow.setDepth(0);
      this.flagMark.setDepth(DEPTH.unit + y);
    }
    this.flagMark.setPosition(x, y);
    this.flagMark.setDepth(DEPTH.unit + y);
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
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        let shore = false;
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) shore ||= !isLand(c + dc, r + dr);
        }
        // Opaque and in step, like the battle island: the blobs read as one
        // shoreline only when they lap together. A cliff standing in the sea
        // gets its own.
        if ((isLand(c, r) && shore) || (!isLand(c, r) && castsCliff(c, r - 1))) {
          this.add.sprite(c * CELL + CELL / 2, r * CELL + CELL / 2, "foam").setDepth(DEPTH.foam).play("foam_anim");
        }
        if (isLand(c, r)) {
          tile(c, r, edge(isLand(c - 1, r), isLand(c + 1, r)), edge(isLand(c, r - 1), isLand(c, r + 1)), DEPTH.island);
        }
      }
    }
    const top = DEPTH.island + 0.5;
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        const k = at(c, r);
        if (k === "#") {
          tile(c, r, 5 + edge(isHigh(c - 1, r), isHigh(c + 1, r)), edge(isHigh(c, r - 1), isHigh(c, r + 1)), top);
          if (castsCliff(c, r)) {
            // A slope beside the wall carries the stone on, so it counts as
            // wall for the end caps. Row 4 stands on grass, row 5 in water.
            const col = 5 + edge(castsCliff(c - 1, r), castsCliff(c + 1, r));
            tile(c, r + 1, col, isLand(c, r + 1) ? 4 : 5, top);
          }
        } else if (k === "<" || k === ">") {
          const col = k === "<" ? 0 : 3;
          tile(c, r, col, 4, top);
          tile(c, r + 1, col, 5, top);
        }
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
   *  around its home cell. Run anim while moving, idle while paused, the
   *  flip follows the direction of travel. */
  private buildGarrison(): void {
    this.wanderers = GARRISON.map((g) => {
      const { x, y } = this.cellXY(g.home.col, g.home.row);
      // Children ride at local origin: a container adds its own position,
      // so world coords on the children would double the offset and throw
      // every troop off the map.
      const shadow = addShadow(this, 0, 0, g.cls === "lancer" ? 0.8 : 0.62);
      const sprite = this.add.sprite(0, 0, unitKey(g.side, g.cls, "idle"));
      playPose(sprite, g.side, g.cls, "idle");
      const root = this.add.container(x, y, [shadow, sprite]);
      root.setDepth(DEPTH.unit + y);
      return { side: g.side, cls: g.cls, home: { x, y }, sprite, root, target: null, pauseMs: 0 };
    });
  }

  /** Wander AI: pick a point near home, walk it, pause, repeat. */
  private updateWanderers(delta: number): void {
    for (const w of this.wanderers) {
      if (w.target) {
        const dx = w.target.x - w.root.x;
        const dy = w.target.y - w.root.y;
        const dist = Math.hypot(dx, dy);
        const step = (WANDER_SPEED * delta) / 1000;
        if (dist <= step) {
          w.root.setPosition(w.target.x, w.target.y);
          w.target = null;
          w.pauseMs = WANDER_PAUSE[0] + Math.random() * (WANDER_PAUSE[1] - WANDER_PAUSE[0]);
          playPose(w.sprite, w.side, w.cls, "idle");
          w.sprite.setFlipX(w.side === "b");
        } else {
          w.root.setPosition(w.root.x + (dx / dist) * step, w.root.y + (dy / dist) * step);
          w.root.setDepth(DEPTH.unit + w.root.y);
          playPose(w.sprite, w.side, w.cls, "run");
          w.sprite.setFlipX(dx < 0 !== (w.side === "b"));
        }
      } else {
        w.pauseMs -= delta;
        if (w.pauseMs <= 0) {
          // Never stray more than 1.5 cells from home, and stay on the
          // home's level: no walking off a plateau through its cliff.
          const col = (w.home.x - STRAT.x0) / CELL;
          const row = (w.home.y - STRAT.y0) / CELL;
          for (let tries = 0; !w.target && tries < 8; tries++) {
            const c = col + (Math.random() * 3 - 1.5);
            const r = row + (Math.random() * 3 - 1.5);
            const tc = Math.floor(c);
            const tr = Math.floor(r);
            if (!isWalkable(tc, tr) || level(tc, tr) !== level(Math.floor(col), Math.floor(row))) continue;
            w.target = { x: STRAT.x0 + c * CELL, y: STRAT.y0 + r * CELL };
          }
          if (!w.target) w.target = { ...w.home };
        }
      }
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
