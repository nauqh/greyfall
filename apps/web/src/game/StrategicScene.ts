// The war on the island, drawn tile by tile from the engine's height map
// (islandMap.ts), in real time: the world never stops unless Space pauses it.
//
// The engine decides everything. This scene steps its simulation at 10 ticks
// a second, draws what each tick's events say happened, and turns clicks
// into the engine's actions.

import {
  AI_EVERY_TICKS,
  FOOTPRINT,
  MINES,
  WAR,
  buildSlots,
  canPlace,
  castlePlot,
  castsCliff,
  plateauOf,
  cellKey,
  createSim,
  freeBuilders,
  freeIn,
  maxHp,
  mineById,
  mineSlots,
  newMatch,
  occupied,
  plotCells,
  runAi,
  sameCell,
  supplyCap,
  supplyUsed,
  trainsAt,
  type Action,
  type Building,
  type BuildingKind,
  type MatchState,
  type Order,
  type Sim,
  type UnitClass,
  type WarEvent,
  type WarUnit,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { baseZoom, fitCamera, startGame } from "./boot";
import { HUD_COVER_H, HUD_KEY, HUD_TOP_H, ICON, StrategicHud, portraitKey, type HudCommand, type HudModel } from "./StrategicHud";
import { HAND } from "./ui";
import { Fog } from "./fog";
import { CELL, artOf, buildMap, buildScenery, cell, loadMapArt, makeMapAnims, plotBase, workKey } from "./islandMap";
import { STRAT_COLS, STRAT_ROWS } from "./stratMap";
import { BODY_HEIGHT, loadUnits, makeAnims, playPose, unitKey } from "./sprites";

import {
  DEPTH,
  addBuilding,
  addShadow,
  buildWater,
  buildingKey,
  cloudCover,
  driftClouds,
  loadBuildings,
  loadTerrain,
  prepareTerrain,
  type Rect,
  type Structure,
} from "./terrain";
import {
  ARROW_RELEASE_MS,
  FLIGHT_MS,
  IMPACT_MS,
  clearFx,
  deathFx,
  flash,
  floatText,
  loadWarFx,
  makeWarFxAnims,
  projectile,
  trackFx,
} from "./warFx";

/** The map carries its own sea margin, so the world is the grid, plus open
 *  sea above it that the view may scroll into (y runs negative there). */
const WORLD_W = STRAT_COLS * CELL;
const WORLD_H = STRAT_ROWS * CELL;
const TOP_SEA = 2 * CELL;
const STRAT: Rect = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };

/** How close to the screen edge the pointer pans, and how fast, in world
 *  px/s. Screen-edge scrolling, exactly as Warcraft did it. */
const EDGE = 28;
const PAN_PX_S = 840;
/** Zoom steps: native, halfway, and all of the world in view. */
const ZOOM_STEPS = 3;

/** A step's walk takes most of the second it is given, so a march reads as
 *  one walk rather than a string of hops. */
const STEP_MS = 880;
const TICK_MS = 1000 / 10;
/** The HUD is rebuilt this often while the world runs, not every tick. */
const HUD_EVERY_TICKS = 5;

const NAME: Record<BuildingKind, string> = {
  castle: "Castle",
  barracks: "Barracks",
  archery: "Archery range",
  tower: "Tower",
  monastery: "Monastery",
  house: "House",
};

const CLASS_NAME: Record<UnitClass, string> = {
  pawn: "Pawn",
  warrior: "Warrior",
  lancer: "Lancer",
  archer: "Archer",
  monk: "Monk",
};

/** Names short enough for a command button. */
const SHORT: Record<BuildingKind, string> = { ...NAME, archery: "Archery" };

/** What a Pawn can put up, in the order its card lists them. */
const BUILDABLE: readonly BuildingKind[] = ["house", "barracks", "archery", "tower", "monastery"];

function cellXY(col: number, row: number): { x: number; y: number } {
  return { x: STRAT.x0 + col * CELL + CELL / 2, y: STRAT.y0 + row * CELL + CELL / 2 };
}

/** A Pawn with nothing to do: not digging, building or walking anywhere. */
function idle(u: WarUnit): boolean {
  return u.class === "pawn" && (u.order.type === "stop" || u.order.type === "hold");
}

function head(u: { side: "a" | "b"; class: UnitClass }): number {
  return BODY_HEIGHT[u.class];
}

function clockText(ticks: number): string {
  const s = Math.max(0, Math.floor(ticks / 10));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface UnitView {
  unit: WarUnit;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  marks: Phaser.GameObjects.Graphics;
  settle: Phaser.Time.TimerEvent | null;
  dead: boolean;
}

/** live: the match running. over: a hall has fallen. */
type Phase = "live" | "over";

export class StrategicScene extends Phaser.Scene {
  /** Handed in by the page; absent when the map opens on its own. */
  private onMenu: () => void = () => {};
  /** Touch-drag state: where the gesture started, camera included. */
  private dragStart: { x: number; y: number; camX: number; camY: number; moved: boolean; pan: boolean; touch: boolean } | null = null;
  /** The drag-select rectangle. */
  private box!: Phaser.GameObjects.Graphics;
  /** The last unit clicked and when, to spot a double click. */
  private lastTap: { id: number; at: number } | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;

  private phase: Phase = "live";
  private sim!: Sim;
  private paused = false;
  /** Real milliseconds not yet turned into ticks. */
  private acc = 0;
  private speed = 1;
  /** The match's result, once a hall falls. */
  private finalState: MatchState | null = null;

  private selected: number[] = [];
  private selectedPlot: string | null = null;
  /** An enemy unit or building shown in the panel without being ordered. */
  private inspected: { unit?: number; plot?: string } | null = null;
  /** A building waiting for its spot on the map, and where the cursor is. */
  private placing: BuildingKind | null = null;
  private ghost: { img: Phaser.GameObjects.Image | null; kind: BuildingKind | null } = { img: null, kind: null };
  private hover: { col: number; row: number } = { col: 0, row: 0 };
  /** Control groups: Ctrl+number sets, number recalls. */
  private groups = new Map<string, number[]>();
  private msg = { text: "", id: 0 };
  private get message(): string {
    return this.msg.text;
  }
  private set message(text: string) {
    this.msg = { text, id: this.msg.id + 1 };
  }

  private units = new Map<number, UnitView>();
  private buildings = new Map<string, Phaser.GameObjects.Image>();
  /** Bushes and rocks by cell, hidden where a building stands. */
  private strewn = new Map<number, Phaser.GameObjects.Sprite>();
  /** What blue sees and remembers; red's AI sees the whole island. */
  private fog!: Fog;
  private overlay!: Phaser.GameObjects.Graphics;
  private hud!: StrategicHud;

  init(data: { onMenu?: () => void }): void {
    this.onMenu = data.onMenu ?? (() => {});
  }

  constructor() {
    super("strategic");
  }

  /** The world as it stands: live while the simulation runs, the result once it ends. */
  private get state(): MatchState {
    return this.finalState ?? this.sim.world;
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadWarFx(this);
    const all: Structure[] = [];
    for (const side of ["a", "b"] as const) {
      for (const kind of ["castle", "barracks", "archery", "tower", "monastery"] as const) {
        all.push(cell(side, artOf({ id: kind, side, kind, col: 0, row: 0, w: 1, h: 1 }), 0, 0));
      }
      for (const n of [1, 2, 3] as const) all.push(cell(side, `house${n}`, 0, 0));
    }
    loadBuildings(this, all);
    loadMapArt(this);
  }

  create(): void {
    // Open on the middle of the player's own plateau, castle, barracks and mine in view.
    // The plateau and the cliff face under its south edge, which is drawn a row below it.
    const top = plateauOf(castlePlot("a"));
    const home = [...top, ...top.filter((c) => castsCliff(c.col, c.row)).map((c) => ({ col: c.col, row: c.row + 1 }))];
    const mid = (pick: (c: { col: number; row: number }) => number): number =>
      ((Math.min(...home.map(pick)) + Math.max(...home.map(pick)) + 1) / 2) * CELL;
    // Centred in the map's own strip, between the top bar and the command panel.
    const clear = (): number => ((HUD_COVER_H - HUD_TOP_H) * baseZoom(this)) / (2 * this.cameras.main.zoom);
    fitCamera(this, mid((c) => c.col), () => mid((c) => c.row) + clear(), () => this.zoomScale(this.zoomLevel));
    prepareTerrain(this);
    makeAnims(this);
    makeWarFxAnims(this);
    makeMapAnims(this);

    buildWater(this);
    buildMap(this);
    this.strewn = buildScenery(this);
    driftClouds(this, { w: WORLD_W, h: WORLD_H }, "strategic");
    // Over units and buildings, so bars and order lines never hide behind them.
    this.overlay = this.add.graphics().setDepth(DEPTH.fx - 2);
    this.box = this.add.graphics().setDepth(DEPTH.fx + 2);
    // Over the units, under hit numbers and the placing ghost.
    this.fog = new Fog(this, "a", DEPTH.fx - 1);

    this.newWar();

    this.hud = this.scene.add(HUD_KEY, StrategicHud, true, {
      // The HUD is the top scene, so the cloud cover goes there to sit over
      // its buttons too.
      onLeave: () => this.toMenu(),
      onPause: (on: boolean) => this.setPaused(on),
      onZoom: (dir: 1 | -1) => this.zoomStep(dir),
      model: () => this.model(),
    }) as StrategicHud;
    // The opening parts over the map from this scene, on the frame the page's
    // loader leaves; the HUD is still loading its own art then, so it fades
    // in after. Once, from here: the HUD restarts itself on every resize.
    cloudCover(this, "open", () => {});
    this.hud.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.hud.cameras.main.setAlpha(0);
      this.hud.tweens.add({ targets: this.hud.cameras.main, alpha: 1, delay: 700, duration: 400 });
    });
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.zoomStep(dy > 0 ? 1 : -1);
    });
    this.input.mouse?.disableContextMenu();
    // The pointer reads (0,0) until the mouse first moves over the canvas,
    // which edge-pan took for the top-left corner: the opening view slid away.
    // Only a move counts: mouseover arrives before the pointer has a position.
    this.input.on(Phaser.Input.Events.POINTER_MOVE, () => (this.pointerIn = true));
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.hotkey(e));

    // Warcraft's mouse: a left drag boxes units, a click selects, a right
    // click gives the smart order. A middle drag pans. On touch there is no
    // right button and no box, so a drag pans and a tap orders.
    this.input.setDefaultCursor(HAND);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const touch = p.wasTouch;
      this.dragStart = {
        x: p.x,
        y: p.y,
        camX: this.cameras.main.scrollX,
        camY: this.cameras.main.scrollY,
        moved: false,
        pan: touch || p.middleButtonDown(),
        touch,
      };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.dragStart;
      if (!d) return;
      // Released over the HUD, which eats the pointerup this scene would hear.
      if (!p.isDown) {
        this.dragStart = null;
        this.box.clear();
        return;
      }
      if (Math.abs(p.x - d.x) > 6 || Math.abs(p.y - d.y) > 6) d.moved = true;
      if (!d.moved) return;
      if (d.pan) {
        // Canvas px to world px.
        const zoom = this.cameras.main.zoom;
        this.setScroll(d.camX - (p.x - d.x) / zoom, d.camY - (p.y - d.y) / zoom);
      } else if (this.commanding() && p.leftButtonDown() && !this.placing) {
        this.drawBox(d, p);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.dragStart;
      this.dragStart = null;
      this.box.clear();
      if (!d) return;
      if (d.moved && !d.pan && p.leftButtonReleased() && !this.placing) {
        this.boxSelect(d, p);
        return;
      }
      if (!d.moved) this.tap(p, d.touch);
    });
  }

  /** Whether the player can select and command right now. */
  private commanding(): boolean {
    return this.phase === "live";
  }

  /** The drag rectangle, in world space so it sits on the units it covers. */
  private drawBox(d: { x: number; y: number }, p: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;
    const a = cam.getWorldPoint(d.x, d.y);
    const b = cam.getWorldPoint(p.x, p.y);
    this.box
      .clear()
      .fillStyle(0x9cff8a, 0.12)
      .fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y))
      .lineStyle(2 / cam.zoom, 0x9cff8a, 0.9)
      .strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  /** Every own unit whose body the box touches. Fighters win over Pawns, as
   *  a box drawn over an army at the mine means the army. Shift adds. */
  private boxSelect(d: { x: number; y: number }, p: Phaser.Input.Pointer): void {
    if (!this.commanding()) return;
    const cam = this.cameras.main;
    const a = cam.getWorldPoint(d.x, d.y);
    const b = cam.getWorldPoint(p.x, p.y);
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    const inside = [...this.units.values()]
      .filter((v) => !v.dead && v.unit.side === "a")
      .filter((v) => v.root.x >= x0 && v.root.x <= x1 && v.root.y - head(v.unit) <= y1 && v.root.y >= y0)
      .map((v) => v.unit);
    const fighters = inside.filter((u) => u.class !== "pawn");
    const picked = (fighters.length > 0 ? fighters : inside).map((u) => u.id);
    const shift = (p.event as MouseEvent | undefined)?.shiftKey ?? false;
    this.selectedPlot = null;
    this.inspected = null;
    this.selected = shift ? [...new Set([...this.selected, ...picked])] : picked;
    this.message = "";
    this.refresh();
  }

  /** Warcraft's keys: Esc cancels and deselects, F1 the Pawns, F2 the army,
   *  Ctrl+1-9 sets a control group and 1-9 recalls it, Space pauses. */
  private hotkey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === "escape") {
      this.stopPlacing();
      this.clearSelection();
      this.message = "";
      this.refresh();
      return;
    }
    if (k === " " && this.phase === "live") {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (!this.commanding()) return;
    if (k === "f1" || k === "f2") {
      e.preventDefault();
      if (k === "f1") this.selectPawns();
      else this.selectArmy();
      return;
    }
    if (/^[1-9]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.groups.set(k, [...this.selected]);
        this.message = this.selected.length > 0 ? `Group ${k} set.` : "";
      } else {
        const alive = new Set(this.state.units.map((u) => u.id));
        this.clearSelection();
        this.selected = (this.groups.get(k) ?? []).filter((id) => alive.has(id));
      }
      this.refresh();
    }
  }

  /** Clouds close over the HUD, the top scene, then the page moves on. */
  private toMenu(): void {
    this.input.enabled = false;
    this.hud.input.enabled = false;
    cloudCover(this.hud, "close", () => this.onMenu());
  }

  // --- the match -----------------------------------------------------------

  /** A fresh match on a cleared island. */
  private playAgain(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    clearFx(this);
    for (const v of this.units.values()) v.root.destroy();
    this.units.clear();
    this.finalState = null;
    this.paused = false;
    this.acc = 0;
    this.groups.clear();
    this.clearSelection();
    this.stopPlacing();
    this.newWar();
    this.refresh();
  }

  private newWar(): void {
    this.sim = createSim(newMatch(Date.now() % 1_000_000, "realtime"));
    this.fog.reset();
    this.phase = "live";
    this.message = "The world runs on its own. Space pauses. Select a Pawn to build.";
    this.syncWorld(this.sim.world);
  }

  /** One action for the player, into the running world. Explained when it is refused. */
  private act(action: Action): boolean {
    const refuse = (error: string): boolean => {
      this.message = error.charAt(0).toUpperCase() + error.slice(1) + ".";
      this.refresh();
      return false;
    };
    if (this.phase !== "live") return false;
    const error = this.sim.issue("a", action);
    if (error) return refuse(error);
    this.syncLive();
    this.message = "";
    // Units that died meanwhile cannot stay selected.
    this.selected = this.selected.filter((id) => this.state.units.some((u) => u.id === id));
    this.refresh();
    return true;
  }

  private togglePause(): void {
    this.setPaused(!this.paused);
  }

  private setPaused(on: boolean): void {
    if (this.phase !== "live" || this.paused === on) return;
    this.paused = on;
    this.message = this.paused ? "Paused. Orders still go out; Space to go on." : "";
    this.refresh();
  }

  // --- the running world ---------------------------------------------------

  /** One tick of the running world, and what it shows. */
  private tickOnce(): void {
    const sim = this.sim;
    if (sim.t % AI_EVERY_TICKS === 0) runAi(sim, "b");
    sim.step();
    const events = sim.events.splice(0);
    for (const e of events) this.play(e);
    this.syncLive();

    if (sim.world.winner) {
      this.finalState = sim.snapshot();
      this.phase = "over";
      this.refresh();
      return;
    }
    if (sim.t % HUD_EVERY_TICKS === 0) this.refresh();
  }

  /** Bring the views in line with the live world: new units, their current
   *  orders and HP, buildings going up and coming down. */
  private syncLive(): void {
    const world = this.sim.world;
    for (const u of world.units) {
      const v = this.units.get(u.id) ?? this.addUnit(u);
      if (!v.dead) v.unit = { ...u, order: u.order, post: u.post };
    }
    this.syncBuildings(world);
    this.applyFog(world);
    this.drawMarks();
  }

  /** Enemy units show only in sight; an enemy building once it has been seen. */
  private applyFog(state: MatchState): void {
    this.fog.update(state);
    for (const v of this.units.values()) v.root.setVisible(v.unit.side === "a" || this.fog.sees(v.unit.col, v.unit.row));
    for (const [id, img] of this.buildings) img.setVisible(state.buildings[id]?.side !== "b" || this.fog.knows(id));
    if (this.inspected?.unit !== undefined && !this.units.get(this.inspected.unit)?.root.visible) this.inspected = null;
  }

  // --- drawing the state ---------------------------------------------------

  private syncBuildings(state: MatchState): void {
    for (const b of Object.values(state.buildings)) {
      let img = this.buildings.get(b.id);
      if (!img) {
        const { x, y } = plotBase(b);
        img = addBuilding(this, cell(b.side, artOf(b), x / CELL, y / CELL));
        this.buildings.set(b.id, img);
      }
      // Going up: faint at first, then fuller as the Pawn hammers.
      const total = WAR.realtime.buildSeconds[b.kind]! * 10;
      const risen = b.level > 0 ? 1 : state.mode === "realtime" ? 0.3 + (0.6 * b.progress) / Math.max(1, total) : 0.45;
      img.setAlpha(risen);
      if (b.hp <= 0 && b.level === 0 && b.kind === "castle") img.setTint(0x6f6f6f);
    }
    for (const [id, img] of this.buildings) {
      if (!state.buildings[id]) {
        img.destroy();
        this.buildings.delete(id);
      }
    }
    const under = new Set(Object.values(state.buildings).flatMap((b) => plotCells(b).map(cellKey)));
    for (const [key, prop] of this.strewn) prop.setVisible(!under.has(key));
  }

  /** Make the island show `state`: buildings, units, marks. Snaps, no tweens. */
  private syncWorld(state: MatchState): void {
    this.syncBuildings(state);
    const seen = new Set<number>();
    for (const u of state.units) {
      seen.add(u.id);
      let v = this.units.get(u.id);
      if (!v) v = this.addUnit(u);
      v.unit = { ...u };
      const { x, y } = cellXY(u.col, u.row);
      this.tweens.killTweensOf(v.root);
      v.root.setPosition(x, y).setDepth(DEPTH.unit + y).setAlpha(1);
      this.restPose(v);
    }
    for (const [id, v] of this.units) {
      if (!seen.has(id)) {
        v.root.destroy();
        this.units.delete(id);
      }
    }
    this.applyFog(state);
    this.drawMarks();
  }

  /** Standing still: idle, or a Pawn at its job, digging beside its mine or
   *  hammering beside the building it raises, facing the work. */
  private restPose(v: UnitView): void {
    const u = v.unit;
    playPose(v.sprite, u.side, u.class, "idle");
    if (u.class !== "pawn" || this.phase !== "live") return;
    const o = u.order;
    let at: number | null = null;
    let job: "dig" | "hammer" = "dig";
    if (o.type === "gather" && !u.carry) {
      const m = mineById(o.mine);
      if (m && mineSlots(m).some((c) => sameCell(c, u))) at = cellXY(m.col, m.row).x;
    } else if (o.type === "build") {
      const p = this.state.buildings[o.plot];
      const free = freeIn(occupied(this.state));
      if (p && buildSlots(p, (c) => !free(c)).some((c) => sameCell(c, u))) {
        at = plotBase(p).x;
        job = "hammer";
      }
    }
    if (at === null) return;
    v.sprite.play(workKey(u.side, job), true);
    if (Math.abs(at - v.root.x) > 0.5) v.sprite.setFlipX(at < v.root.x);
  }

  private addUnit(u: WarUnit): UnitView {
    const { x, y } = cellXY(u.col, u.row);
    // Children ride at local origin: a container adds its own position,
    // so world coords on the children would double the offset and throw
    // every troop off the map.
    const shadow = addShadow(this, 0, 0, u.class === "lancer" ? 0.8 : 0.62);
    const sprite = this.add.sprite(0, 0, unitKey(u.side, u.class, "idle"));
    const marks = this.add.graphics();
    playPose(sprite, u.side, u.class, "idle");
    const root = this.add.container(x, y, [marks, shadow, sprite]).setDepth(DEPTH.unit + y);
    const v: UnitView = { unit: { ...u }, root, sprite, shadow, marks, settle: null, dead: false };
    this.units.set(u.id, v);
    return v;
  }

  /** Selection rings, HP bars, stance badges, orders, rally points, queues. */
  private drawMarks(): void {
    const g = this.overlay;
    g.clear();
    const state = this.state;

    for (const v of this.units.values()) {
      const u = v.unit;
      const m = v.marks;
      m.clear();
      const chosen = this.selected.includes(u.id) || this.inspected?.unit === u.id;
      if (chosen) {
        m.lineStyle(2, u.side === "a" ? 0x9cff8a : 0xff7a6a, 0.95).strokeEllipse(0, 2, 40, 16);
      }
      const max = maxHp(state, u.side, u.class);
      if (chosen || u.hp < max) {
        const top = -head(u) - 12;
        m.fillStyle(0x1c2634, 0.85).fillRect(-16, top, 32, 5);
        m.fillStyle(u.side === "a" ? 0x7ad35a : 0xe0533e).fillRect(-15, top + 1, Math.max(1, 30 * (Math.max(0, u.hp) / max)), 3);
      }
      if (u.side === "a" && idle(u)) {
        // Warcraft's idle worker: a gold marker over its head.
        const top = -head(u) - 30;
        m.fillStyle(0x3a2a1a).fillCircle(0, top, 14);
        m.fillStyle(0xffd66a).fillCircle(0, top, 11);
        m.fillStyle(0x3a2a1a).fillRect(-2, top - 7, 4, 9).fillRect(-2, top + 4, 4, 4);
      }
      if (u.stance === "fallBack" && u.class !== "pawn" && u.side === "a") {
        // A small white flag: this unit falls back when hurt.
        const fx = 14;
        const fy = -head(u) - 2;
        m.lineStyle(2, 0x3a2a1a).lineBetween(fx, fy, fx, fy + 16);
        m.fillStyle(0xfdfaf0).fillTriangle(fx, fy, fx + 10, fy + 4, fx, fy + 8);
      }
    }

    for (const b of Object.values(state.buildings)) {
      if (b.side === "b" && !this.fog.knows(b.id)) continue;
      // A build bar over every building going up; training shows in the HUD.
      const base = plotBase(b);
      const bar = (fill: number, tone: number, dy: number): void => {
        g.fillStyle(0x1c2634, 0.85).fillRect(base.x - 34, base.y + dy, 68, 7);
        g.fillStyle(tone).fillRect(base.x - 33, base.y + dy + 1, Math.max(1, 66 * Math.min(1, fill)), 5);
      };
      if (state.mode === "realtime" && b.pending) {
        const total = (b.pending === "build" ? WAR.realtime.buildSeconds[b.kind]! : WAR.realtime.upgradeSeconds) * 10;
        bar(b.progress / total, 0xffd66a, 4);
      }
      if (b.hp < (b.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other) && b.level > 0) {
        const max = b.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other;
        g.fillStyle(0x1c2634, 0.85).fillRect(base.x - 34, base.y - (b.kind === "house" ? 150 : 200), 68, 7);
        g.fillStyle(b.side === "a" ? 0x7ad35a : 0xe0533e).fillRect(base.x - 33, base.y - (b.kind === "house" ? 149 : 199), Math.max(1, 66 * (b.hp / max)), 5);
      }
      if (this.selectedPlot === b.id) {
        g.lineStyle(2, 0x9cff8a, 0.95).strokeRect(b.col * CELL, b.row * CELL, b.w * CELL, b.h * CELL);
        if (b.rally) {
          // The rally flag, and the line new units will walk.
          const to = cellXY(b.rally.col, b.rally.row);
          g.lineStyle(2, 0x9cff8a, 0.6).lineBetween(base.x, base.y - 10, to.x, to.y);
          g.lineStyle(2, 0x3a2a1a).lineBetween(to.x, to.y - 22, to.x, to.y);
          g.fillStyle(0x9cff8a).fillTriangle(to.x, to.y - 22, to.x + 12, to.y - 17, to.x, to.y - 12);
        }
      }
    }

    // Where the selected units are going.
    for (const id of this.selected) {
      const u = state.units.find((x) => x.id === id);
      if (!u) continue;
      const v = this.units.get(id);
      const from = v ? { x: v.root.x, y: v.root.y } : cellXY(u.col, u.row);
      const to = this.orderTarget(u.order);
      if (!to) continue;
      const tone = u.order.type === "move" ? 0x9cff8a : u.order.type === "gather" ? 0xffd66a : 0xff9c7a;
      g.lineStyle(2, tone, 0.8).lineBetween(from.x, from.y, to.x, to.y);
      g.fillStyle(tone, 0.9).fillTriangle(to.x, to.y - 18, to.x + 12, to.y - 13, to.x, to.y - 8);
      g.lineStyle(2, tone, 0.9).lineBetween(to.x, to.y - 18, to.x, to.y);
    }
  }

  private orderTarget(o: Order): { x: number; y: number } | null {
    switch (o.type) {
      case "move":
      case "attackMove":
        return cellXY(o.to.col, o.to.row);
      case "attack": {
        const t = this.state.units.find((u) => u.id === o.unit);
        return t && this.units.get(t.id)?.root.visible ? cellXY(t.col, t.row) : null;
      }
      case "attackBuilding":
      case "build": {
        const p = this.state.buildings[o.plot];
        return p ? plotBase(p) : null;
      }
      case "gather": {
        const m = MINES.find((x) => x.id === o.mine);
        return m ? cellXY(m.col, m.row) : null;
      }
      default:
        return null;
    }
  }

  // --- placing a building ----------------------------------------------------

  private startPlacing(kind: BuildingKind): void {
    this.placing = kind;
    this.message = `Click where the ${NAME[kind].toLowerCase()} goes. Right click or Esc to cancel.`;
    this.drawGhost();
    this.refresh();
  }

  private stopPlacing(): void {
    this.placing = null;
    this.ghost.img?.destroy();
    this.ghost = { img: null, kind: null };
    this.box?.clear();
  }

  /** The footprint's top-left tile for the cursor: centred under it. */
  private placeAt(kind: BuildingKind): { col: number; row: number } {
    const f = FOOTPRINT[kind];
    return { col: this.hover.col - Math.floor((f.w - 1) / 2), row: this.hover.row - (f.h - 1) };
  }

  /** The building's art where it would stand, green tiles where it can,
   *  red where it cannot. */
  private drawGhost(): void {
    const kind = this.placing;
    if (!kind) return;
    const at = this.placeAt(kind);
    const f = FOOTPRINT[kind];
    const why = this.placeError(kind, at);
    const plot = { id: `ghost-house-${this.state.nextPlot.a}`, side: "a" as const, kind, ...at, ...f };
    if (this.ghost.kind !== kind) {
      this.ghost.img?.destroy();
      this.ghost = { img: addBuilding(this, cell("a", artOf(plot), 0, 0)).setAlpha(0.55), kind };
    }
    const base = plotBase(plot);
    this.ghost.img!.setPosition(base.x, base.y).setDepth(DEPTH.fx + 1).setTint(why ? 0xff8a7a : 0xffffff);
    this.box.clear();
    for (const c of plotCells(plot)) {
      this.box.fillStyle(why ? 0xff5a4a : 0x7ad35a, 0.35).fillRect(c.col * CELL + 2, c.row * CELL + 2, CELL - 4, CELL - 4);
    }
  }

  /** As Warcraft: nothing goes up on ground nobody has explored. */
  private placeError(kind: BuildingKind, at: { col: number; row: number }): string | null {
    const cells = plotCells({ ...at, ...FOOTPRINT[kind] });
    if (!cells.every((c) => this.fog.known(c.col, c.row))) return "you have not explored there";
    return canPlace(this.state, "a", kind, at.col, at.row);
  }

  private place(): void {
    const kind = this.placing!;
    const at = this.placeAt(kind);
    const why = this.placeError(kind, at);
    if (why) {
      this.message = why.charAt(0).toUpperCase() + why.slice(1) + ".";
      this.refresh();
      return;
    }
    // The selected Pawn builds, not whichever is nearest.
    const by = this.state.units.filter((u) => this.selected.includes(u.id) && u.class === "pawn").map((u) => u.id);
    if (this.act({ type: "build", kind, col: at.col, row: at.row, ...(by.length > 0 && { by }) })) this.stopPlacing();
  }

  // --- input ---------------------------------------------------------------

  private refresh(): void {
    this.drawMarks();
    this.hud?.refresh();
  }

  private clearSelection(): void {
    this.selected = [];
    this.selectedPlot = null;
    this.inspected = null;
  }

  /** What is under a tap: a unit first (its body stands above its tile),
   *  then a building (its art stands above its footprint), a mine, ground. */
  private hitTest(x: number, y: number): { unit?: WarUnit; plot?: Building; mine?: string; cell: { col: number; row: number } } {
    const cellAt = { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
    let best: WarUnit | undefined;
    let bestD = 34;
    for (const v of this.units.values()) {
      if (v.dead || !v.root.visible) continue;
      const d = Math.hypot(x - v.root.x, y - (v.root.y - head(v.unit) / 2));
      if (d < bestD) {
        bestD = d;
        best = v.unit;
      }
    }
    if (best) return { unit: best, cell: cellAt };
    const plot = Object.values(this.state.buildings).find(
      (p) =>
        (p.side === "a" || this.fog.knows(p.id)) &&
        cellAt.col >= p.col &&
        cellAt.col < p.col + p.w &&
        cellAt.row >= p.row - (p.kind === "house" ? 1 : 2) &&
        cellAt.row < p.row + p.h,
    );
    if (plot) return { plot, cell: cellAt };
    const mine = MINES.find((m) => m.col === cellAt.col && m.row === cellAt.row);
    if (mine) return { mine: mine.id, cell: cellAt };
    return { cell: cellAt };
  }

  /**
   * A click that did not drag. Right click: the smart order for the
   * selection, as in Warcraft, or a rally point for a selected building.
   * Left click: places a building being placed, else selects what is under
   * it, and on empty ground deselects. A tap on touch has no right button,
   * so with units selected it orders instead.
   */
  private tap(p: Phaser.Input.Pointer, touch: boolean): void {
    if (this.phase !== "live") return;
    const at = this.cameras.main.getWorldPoint(p.x, p.y);
    const hit = this.hitTest(at.x, at.y);
    const right = p.rightButtonReleased();
    const ev = p.event as MouseEvent | undefined;
    const shift = ev?.shiftKey ?? false;
    const mine = (u?: WarUnit) => u?.side === "a";

    if (this.placing) {
      if (right) {
        this.stopPlacing();
        this.message = "";
        this.refresh();
      } else {
        this.place();
      }
      return;
    }

    if (right) {
      if (this.selected.length > 0) this.order(hit);
      else if (this.selectedPlot) this.rally(hit);
      return;
    }

    if (hit.unit && mine(hit.unit)) {
      this.selectedPlot = null;
      this.inspected = null;
      const id = hit.unit.id;
      const now = this.time.now;
      const again = this.lastTap?.id === id && now - this.lastTap.at < 350;
      this.lastTap = { id, at: now };
      if (again || ev?.ctrlKey || ev?.metaKey) {
        // Double click: every unit of its kind on screen.
        const view = this.cameras.main.worldView;
        const cls = hit.unit.class;
        this.selected = [...this.units.values()]
          .filter((v) => !v.dead && v.unit.side === "a" && v.unit.class === cls && view.contains(v.root.x, v.root.y))
          .map((v) => v.unit.id);
      } else {
        this.selected = shift
          ? this.selected.includes(id)
            ? this.selected.filter((x) => x !== id)
            : [...this.selected, id]
          : [id];
      }
      this.message = "";
      this.refresh();
      return;
    }

    if (touch && this.selected.length > 0) {
      this.order(hit);
      return;
    }

    // A left click on anything else makes that the selection, as in Warcraft.
    if (hit.plot && hit.plot.side === "a") {
      this.selected = [];
      this.selectedPlot = hit.plot.id;
      this.inspected = null;
      this.message = "";
      this.refresh();
      return;
    }
    if (hit.unit || hit.plot) {
      this.inspected = hit.unit ? { unit: hit.unit.id } : { plot: hit.plot!.id };
      this.selected = [];
      this.selectedPlot = null;
      this.refresh();
      return;
    }
    this.clearSelection();
    this.refresh();
  }

  /** A selected building's rally point: where its new units walk to. A mine
   *  sends new Pawns to dig there. */
  private rally(hit: ReturnType<StrategicScene["hitTest"]>): void {
    const b = this.state.buildings[this.selectedPlot!];
    if (!b || !trainsAt(b)) return;
    const m = hit.mine ? mineById(hit.mine) : undefined;
    const to = m ? { col: m.col, row: m.row } : hit.cell;
    if (this.act({ type: "rally", plot: b.id, to })) this.message = m ? "New Pawns will dig there." : "New units will gather there.";
    this.refresh();
  }

  /** The one order there is, read from what was clicked: an enemy to go for,
   *  a mine to dig, or ground to walk to. */
  private order(hit: ReturnType<StrategicScene["hitTest"]>): void {
    const units = this.state.units.filter((u) => this.selected.includes(u.id));
    const pawnsOnly = units.every((u) => u.class === "pawn");
    const ids = units.map((u) => u.id);
    // Monks heal and Pawns dig; only the rest go for an enemy.
    const strikers = units.filter((u) => u.class !== "monk" && u.class !== "pawn").map((u) => u.id);
    const pawnIds = units.filter((u) => u.class === "pawn").map((u) => u.id);

    if (hit.unit && hit.unit.side === "b") {
      if (strikers.length > 0) this.act({ type: "order", units: strikers, order: { type: "attack", unit: hit.unit.id } });
      return;
    }
    if (hit.plot && hit.plot.side === "b") {
      if (strikers.length > 0) this.act({ type: "order", units: strikers, order: { type: "attackBuilding", plot: hit.plot.id } });
      return;
    }
    if (hit.mine && pawnIds.length > 0) {
      this.act({ type: "order", units: pawnIds, order: { type: "gather", mine: hit.mine } });
      return;
    }
    const to = hit.cell;
    if (!freeIn(occupied(this.state))(to)) {
      this.message = "Nobody can stand there.";
      this.refresh();
      return;
    }
    // One move for the player: fighters fight whatever they meet on the way,
    // Pawns walk on past it.
    const type = pawnsOnly ? "move" : "attackMove";
    this.act({ type: "order", units: ids, order: { type, to } });
  }

  // --- the HUD's model -----------------------------------------------------

  private model(): HudModel {
    const s = this.state;
    const g = WAR.realtime.greying;
    const greyTicks = g.fromSeconds * 10 - s.tick;
    const base: HudModel = {
      gold: s.gold.a,
      supply: [supplyUsed(s, "a"), supplyCap(s, "a")],
      clock: { text: greyTicks > 0 ? `Greying in ${clockText(greyTicks)}` : "The Greying", warn: greyTicks < 600 },
      banner: { text: this.paused ? "Paused" : "Two clans, one island", tone: this.paused ? "red" : "blue" },
      title: "",
      detail: "",
      portrait: null,
      hp: null,
      message: this.msg.text,
      messageId: this.msg.id,
      commands: [],
      queue: null,
      primary: null,
      idlePawns: null,
      report: null,
    };

    if (this.phase === "over") return { ...base, report: this.overModel() };

    const panel = this.selected.length > 0
      ? this.unitPanel()
      : this.selectedPlot
        ? this.plotPanel(this.selectedPlot)
        : this.inspected
          ? this.inspectPanel()
          : null;
    const r = this.roster();
    return {
      ...base,
      ...(panel ?? {
        title: "The war",
        detail: `${clockText(s.tick)} played. ${r.summary} Select a Pawn to build; a building to train or set its rally point with a right click.`,
      }),
      // Pausing lives in the menu and on Space; the sword only offers the way back.
      primary: this.paused ? { label: "Resume", onClick: () => this.setPaused(false) } : null,
      idlePawns: r.idle > 0 ? { count: r.idle, onClick: () => this.selectPawns() } : null,
    };
  }

  /** Blue's units by kind, and what its buildings have queued: "+n" is in training. */
  private roster(): { idle: number; summary: string } {
    const s = this.state;
    const have = new Map<UnitClass, number>();
    const queued = new Map<UnitClass, number>();
    for (const u of s.units) if (u.side === "a") have.set(u.class, (have.get(u.class) ?? 0) + 1);
    const idlePawns = s.units.filter((u) => u.side === "a" && idle(u)).length;
    for (const b of Object.values(s.buildings)) {
      if (b.side === "a") for (const q of b.queue) queued.set(q.cls, (queued.get(q.cls) ?? 0) + 1);
    }
    const fighters = (Object.keys(CLASS_NAME) as UnitClass[]).filter((c) => c !== "pawn");
    const kinds = fighters
      .filter((c) => have.get(c) || queued.get(c))
      .map((c) => {
        const n = have.get(c) ?? 0;
        return `${n} ${CLASS_NAME[c]}${n === 1 ? "" : "s"}${queued.get(c) ? ` (+${queued.get(c)})` : ""}`;
      });
    const pawns = have.get("pawn") ?? 0;
    const pawnsTraining = queued.get("pawn") ?? 0;
    return {
      idle: idlePawns,
      summary: `Army: ${kinds.length > 0 ? kinds.join(", ") : "none yet"}. Pawns: ${pawns}${pawnsTraining ? ` (+${pawnsTraining})` : ""}${idlePawns ? `, ${idlePawns} idle` : ""}.`,
    };
  }

  private close(): HudCommand {
    return { label: "Close", hint: "Deselect.", onClick: () => (this.clearSelection(), this.refresh()) };
  }

  private unitPanel(): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp"> {
    const units = this.state.units.filter((u) => this.selected.includes(u.id));
    if (units.length === 0) return { title: "", detail: "", portrait: null, hp: null, commands: [] };
    const counts = new Map<UnitClass, number>();
    for (const u of units) counts.set(u.class, (counts.get(u.class) ?? 0) + 1);
    const one = units.length === 1 ? units[0]! : null;
    const title = one
      ? CLASS_NAME[one.class]
      : `${units.length} units: ${[...counts].map(([c, n]) => `${n} ${CLASS_NAME[c]}`).join(", ")}`;
    const fighters = units.filter((u) => u.class !== "pawn");
    let commands: (HudCommand | null)[] = [null, null, null, null, null, null, null, null, this.close()];
    if (fighters.length === 0) {
      // A Pawn's card is Warcraft's build menu, six to a 3x2 grid.
      commands = BUILDABLE.map((kind) => {
        const cost = WAR.buildCost[kind]!;
        const cls = WAR.trains[kind];
        return {
          label: SHORT[kind],
          sub: `${cost} gold`,
          portrait: buildingKey("a", artOf({ id: `${kind}-1`, side: "a", kind, col: 0, row: 0, w: 1, h: 1 })),
          hint: `${NAME[kind]}, ${cost} gold: ${cls ? `trains the ${CLASS_NAME[cls]}` : `+${WAR.supply.perHouse} supply`}. Then click where it goes; a free Pawn walks over and builds it.`,
          onClick: () => this.startPlacing(kind),
          enabled: this.state.gold.a >= cost,
        };
      });
      commands.push(this.close());
    } else {
      const allFallBack = fighters.every((u) => u.stance === "fallBack");
      commands[0] = allFallBack
        ? {
            label: "Fall back",
            icon: ICON.back,
            hint: "When hurt: they fall back. Below half HP they run home, where they heal. Press to make them fight on.",
            onClick: () => this.act({ type: "stance", units: fighters.map((u) => u.id), stance: "firm" }),
          }
        : {
            label: "Fight on",
            icon: ICON.hold,
            hint: "When hurt: they fight on until they die. Press to make them run home below half HP instead.",
            onClick: () => this.act({ type: "stance", units: fighters.map((u) => u.id), stance: "fallBack" }),
          };
    }
    const help =
      fighters.length === 0
        ? "Pawns dig gold and build. Right click a mine to send them; pick a building to put one up."
        : "Right click the ground to send them; they fight whatever they meet. Right click an enemy to go straight for it.";
    return {
      title,
      portrait: portraitKey("a", (one ?? units[0]!).class),
      hp: one ? [one.hp, maxHp(this.state, "a", one.class)] : null,
      detail: one ? `${describeOrder(one, this.state)} ${help}` : help,
      commands,
    };
  }

  private plotPanel(id: string): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp" | "queue"> {
    const b = this.state.buildings[id];
    if (!b) {
      this.selectedPlot = null;
      return { title: "", detail: "", portrait: null, hp: null, commands: [], queue: null };
    }
    const cls = trainsAt(b);
    const name = NAME[b.kind];
    const portrait = buildingKey(b.side, artOf(b));
    const commands: (HudCommand | null)[] = [null, null, null, null, null, null, null, null, this.close()];
    if (b.pending === "build") {
      const total = WAR.realtime.buildSeconds[b.kind]! * 10;
      return {
        title: `${name}: going up`,
        portrait,
        hp: null,
        detail: `A Pawn is building it: ${Math.round((100 * b.progress) / total)}%. It stops while nobody hammers.`,
        commands,
        queue: null,
      };
    }
    // A Pawn raises every upgrade, so a free one is part of the price.
    const pawnFree = freeBuilders(this.state, "a").length > 0;
    if (cls) {
      const cost = WAR.unitCost[cls];
      const room = supplyUsed(this.state, "a") < supplyCap(this.state, "a");
      const pawns = this.state.units.filter((u) => u.side === "a" && u.class === "pawn").length;
      const pawnsFull = cls === "pawn" && pawns >= WAR.pawns.max;
      const full = b.queue.length >= WAR.realtime.queue;
      commands[0] = {
        label: CLASS_NAME[cls],
        sub: `${cost} gold, 1 supply`,
        portrait: portraitKey("a", cls),
        big: true,
        hint: pawnsFull
          ? `You keep at most ${WAR.pawns.max} Pawns.`
          : !room
            ? `No supply left: every unit takes 1. Build a house for ${WAR.supply.perHouse} more.`
            : full
              ? `The queue holds ${WAR.realtime.queue}.`
              : `Queue a ${CLASS_NAME[cls]} for ${cost} gold: out in ${WAR.realtime.trainSeconds[cls]} s, to the rally point.`,
        onClick: () => this.act({ type: "train", plot: id }),
        enabled: room && !pawnsFull && !full && this.state.gold.a >= cost,
      };
      if (b.kind !== "castle") {
        commands[2] = {
          label: b.level >= WAR.maxLevel ? "Level 2" : `Upgrade ${WAR.upgradeCost}g`,
          hint:
            b.level >= WAR.maxLevel
              ? "Already at its highest level."
              : b.pending === "upgrade"
                ? "Upgrading: a Pawn is at it."
                : `Upgrade for ${WAR.upgradeCost} gold: ${upgradeText(b.kind)}. A Pawn leaves its mine to do it.`,
          onClick: () => this.act({ type: "upgrade", plot: id }),
          enabled: pawnFree && b.level < WAR.maxLevel && !b.pending && this.state.gold.a >= WAR.upgradeCost,
        };
      }
    }
    const front = b.queue[0];
    const queue: HudModel["queue"] = front
      ? {
          units: b.queue.map((q) => ({ portrait: portraitKey("a", q.cls), name: CLASS_NAME[q.cls] })),
          progress: 1 - front.left / (WAR.realtime.trainSeconds[front.cls] * 10),
          cancel: () => this.act({ type: "cancel", plot: id }),
        }
      : null;
    return {
      title: `${name}, level ${b.level}`,
      portrait,
      hp: [b.hp, b.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other],
      detail: cls
        ? queue
          ? `${b.pending === "upgrade" ? "Upgrading. " : ""}Right click the ground for its rally point.`
          : `Trains the ${CLASS_NAME[cls]}.${b.pending === "upgrade" ? " Upgrading." : ""} Right click the ground to set its rally point.`
        : b.kind === "house"
          ? `Adds ${WAR.supply.perHouse} supply.`
          : "Your main hall. If it falls, the war is lost.",
      commands,
      queue,
    };
  }

  private inspectPanel(): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp"> {
    const i = this.inspected!;
    const none = [null, null, null, null, null, null, null, null, this.close()];
    if (i.unit !== undefined) {
      const u = this.state.units.find((x) => x.id === i.unit);
      if (u) {
        return {
          title: `Red ${CLASS_NAME[u.class]}`,
          portrait: portraitKey(u.side, u.class),
          hp: [u.hp, maxHp(this.state, u.side, u.class)],
          detail: "Of the red clan. Select your fighters, then right click it to go for it.",
          commands: none,
        };
      }
    }
    const p = i.plot ? this.state.buildings[i.plot] : undefined;
    if (p) {
      return {
        title: `Red ${NAME[p.kind].toLowerCase()}, level ${p.level}`,
        portrait: buildingKey(p.side, artOf(p)),
        hp: [p.hp, p.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other],
        detail: "Select your fighters, then right click it to go for it.",
        commands: none,
      };
    }
    return { title: "", detail: "", portrait: null, hp: null, commands: none };
  }

  private overModel(): NonNullable<HudModel["report"]> {
    const end = this.finalState!;
    const title = end.winner === "a" ? "The blue clan holds the island" : end.winner === "b" ? "The red clan takes the island" : "Both halls fall";
    return {
      title,
      tone: end.winner === "a" ? "blue" : "red",
      lines: [`The war ended after ${clockText(end.tick)}.`],
      button: "Play again",
      onClick: () => this.playAgain(),
      also: { label: "Menu", onClick: () => this.toMenu() },
    };
  }

  private selectArmy(): void {
    this.clearSelection();
    this.selected = this.state.units.filter((u) => u.side === "a" && u.class !== "pawn").map((u) => u.id);
    this.message = this.selected.length === 0 ? "No army yet: train one at the barracks." : "";
    this.refresh();
  }

  /** The idle Pawns first, as Warcraft's idle worker button; again, every Pawn. */
  private selectPawns(): void {
    const pawns = this.state.units.filter((u) => u.side === "a" && u.class === "pawn");
    const idlers = pawns.filter(idle).map((u) => u.id);
    const already = idlers.length === this.selected.length && idlers.every((id) => this.selected.includes(id));
    this.clearSelection();
    this.selected = idlers.length > 0 && !already ? idlers : pawns.map((u) => u.id);
    this.message = idlers.length > 0 && !already ? "Idle Pawns. Right click a mine to set them digging; click Pawns again for all." : "";
    this.refresh();
  }

  // --- what a tick shows -----------------------------------------------------

  private play(e: WarEvent): void {
    switch (e.type) {
      case "move":
        return this.onMove(e.unit, e.col, e.row);
      case "attack":
        return this.onAttack(e.unit, e.target, e.damage);
      case "hitBuilding":
        return this.onHitBuilding(e.unit, e.plot, e.damage);
      case "heal":
        return this.onHeal(e.unit, e.target, e.amount);
      case "fallBack": {
        const v = this.units.get(e.unit);
        if (v && !v.dead && v.root.visible) floatText(this, v.root.x, v.root.y - head(v.unit) - 22, "Falls back", "#fdfaf0", this.speed);
        return;
      }
      case "death":
        return this.onDeath(e.unit);
      case "destroyed":
        return this.onDestroyed(e.plot);
      case "spawn": {
        const u = this.sim?.world.units.find((x) => x.id === e.unit);
        if (u && !this.units.has(u.id)) this.addUnit(u);
        return;
      }
      case "built":
      case "upgraded": {
        const b = this.sim?.world.buildings[e.plot];
        if (b && b.side === "a") {
          const base = plotBase(b);
          floatText(this, base.x, base.y - 120, e.type === "built" ? "Built" : "Upgraded", "#fdfaf0", this.speed);
        }
        return;
      }
      case "deliver": {
        if (e.side !== "a") return;
        const v = this.units.get(e.unit);
        if (v) floatText(this, v.root.x, v.root.y - head(v.unit) - 18, `+${e.gold}`, "#ffd66a", this.speed);
        return;
      }
      case "greying":
        for (const side of ["a", "b"] as const) {
          if (side === "b" && !this.fog.knows("b-castle")) continue;
          const base = plotBase(castlePlot(side));
          floatText(this, base.x, base.y - 180, `The Greying -${e.hp}`, "#c9c9c9", this.speed);
        }
        return;
    }
  }

  private onMove(id: number, col: number, row: number): void {
    const v = this.units.get(id);
    if (!v || v.dead) return;
    const { x, y } = cellXY(col, row);
    const chained = v.settle !== null;
    v.settle?.remove();
    v.settle = null;
    // A Pawn walking home with gold carries the bag.
    const live = this.sim?.world.units.find((u) => u.id === id);
    if (live?.class === "pawn" && live.carry && live.order.type === "gather") v.sprite.play(workKey(live.side, "carry"), true);
    else playPose(v.sprite, v.unit.side, v.unit.class, "run");
    if (Math.abs(x - v.root.x) > 0.5) v.sprite.setFlipX(x < v.root.x);
    this.tweens.killTweensOf(v.root);
    this.tweens.add({
      targets: v.root,
      x,
      y,
      duration: STEP_MS / this.speed,
      ease: chained ? "Linear" : "Sine.easeIn",
      onUpdate: () => v.root.setDepth(DEPTH.unit + v.root.y),
      onComplete: () => {
        v.settle = this.time.delayedCall((1000 - STEP_MS + 60) / this.speed, () => {
          v.settle = null;
          if (!v.dead) this.restPose(v);
        });
      },
    });
  }

  private face(v: UnitView, x: number): void {
    const dx = x - v.root.x;
    if (Math.abs(dx) > 0.5) v.sprite.setFlipX(dx < 0);
  }

  private strikePose(v: UnitView): void {
    v.settle?.remove();
    playPose(v.sprite, v.unit.side, v.unit.class, "attack");
    v.settle = this.time.delayedCall(700 / this.speed, () => {
      v.settle = null;
      if (!v.dead) this.restPose(v);
    });
  }

  /** When the blow lands: the swing's reach for melee, the arrow's arrival for archers. */
  private impactDelay(attacker: UnitView): number {
    return (attacker.unit.class === "archer" ? ARROW_RELEASE_MS + FLIGHT_MS : IMPACT_MS) / this.speed;
  }

  private onAttack(by: number, target: number, damage: number): void {
    const a = this.units.get(by);
    const t = this.units.get(target);
    if (!a || !t) return;
    // A fight in the fog shows nothing.
    if (!a.root.visible && !t.root.visible) return;
    if (!a.dead) {
      this.face(a, t.root.x);
      this.strikePose(a);
      if (a.unit.class === "archer") {
        this.time.delayedCall(ARROW_RELEASE_MS / this.speed, () => {
          if (a.root.active && t.root.active) {
            projectile(this, a.unit.side, { x: a.root.x, y: a.root.y - 46 }, { x: t.root.x, y: t.root.y - 40 }, this.speed);
          }
        });
      }
    }
    this.time.delayedCall(this.impactDelay(a), () => {
      if (!t.root.active) return;
      flash(this, t.sprite, this.speed);
      floatText(this, t.root.x, t.root.y - head(t.unit) - 20, `-${damage}`, "#ff8f7a", this.speed);
    });
  }

  private onHitBuilding(by: number, plotId: string, damage: number): void {
    const a = this.units.get(by);
    const p = this.sim?.world.buildings[plotId] ?? this.state.buildings[plotId];
    const img = this.buildings.get(plotId);
    if (!p || (img && !img.visible)) return;
    const base = plotBase(p);
    if (a && !a.dead) {
      this.face(a, base.x);
      this.strikePose(a);
      if (a.unit.class === "archer") {
        this.time.delayedCall(ARROW_RELEASE_MS / this.speed, () => {
          if (a.root.active) projectile(this, a.unit.side, { x: a.root.x, y: a.root.y - 46 }, { x: base.x, y: base.y - 60 }, this.speed);
        });
      }
    }
    this.time.delayedCall(a ? this.impactDelay(a) : IMPACT_MS, () => {
      if (img?.active) flash(this, img, this.speed);
      floatText(this, base.x, base.y - 110, `-${damage}`, "#ff8f7a", this.speed);
    });
  }

  private onHeal(by: number, target: number, amount: number): void {
    const c = this.units.get(by);
    const t = this.units.get(target);
    if (!t || !t.root.visible) return;
    if (c && !c.dead) {
      this.face(c, t.root.x);
      this.strikePose(c);
    }
    this.time.delayedCall(IMPACT_MS / this.speed, () => {
      if (!t.root.active) return;
      floatText(this, t.root.x, t.root.y - head(t.unit) - 20, `+${amount}`, "#a9e88a", this.speed);
    });
  }

  private onDeath(id: number): void {
    const v = this.units.get(id);
    if (!v || v.dead) return;
    v.dead = true;
    this.selected = this.selected.filter((x) => x !== id);
    // After the killing blow has shown.
    this.time.delayedCall((ARROW_RELEASE_MS + FLIGHT_MS) / this.speed, () => {
      v.settle?.remove();
      this.tweens.killTweensOf(v.root);
      v.marks.clear();
      this.units.delete(id);
      if (v.root.visible) deathFx(this, v.root, v.sprite, this.speed);
      else v.root.destroy();
    });
  }

  private onDestroyed(plotId: string): void {
    const img = this.buildings.get(plotId);
    if (!img) return;
    this.buildings.delete(plotId);
    if (this.selectedPlot === plotId) this.selectedPlot = null;
    if (!img.visible) {
      img.destroy();
      return;
    }
    trackFx(this, img);
    const base = { x: img.x, y: img.y };
    this.time.delayedCall(IMPACT_MS / this.speed, () => {
      img.setTint(0x6f6f6f);
      trackFx(this, this.add.sprite(base.x, base.y, "dust").setOrigin(0.5, 0.8).setScale(2).setDepth(DEPTH.fx).play("dust_anim"));
      this.tweens.add({ targets: img, alpha: 0, duration: 900 / this.speed, onComplete: () => img.destroy() });
    });
  }

  // --- camera --------------------------------------------------------------

  /** One step in or out. Zoom scales around the view's centre, so the
   *  spot being looked at stays put; update() re-clamps as it animates. */
  private zoomStep(dir: 1 | -1): void {
    const next = Math.max(0, Math.min(ZOOM_STEPS - 1, this.zoomLevel + dir));
    if (next === this.zoomLevel) return;
    this.zoomLevel = next;
    this.cameras.main.zoomTo(this.zoomScale(next) * baseZoom(this), 180, "Sine.easeOut", true);
  }
  /** One step out from the closest: the home plateau with room around it. */
  private zoomLevel = 1;
  /** Set by the first mouse move and kept when it leaves: a push past the window's edge is the pan. */
  private pointerIn = false;

  /** A step as a multiple of baseZoom. The last fits the whole world, top
   *  sea included, above the HUD on both axes, so there is nothing to drag;
   *  it depends on the screen, so it is worked out each time. */
  private zoomScale(level: number): number {
    const cam = this.cameras.main;
    const base = baseZoom(this);
    const fit = Math.min(cam.width / WORLD_W, (cam.height - (HUD_COVER_H + HUD_TOP_H) * base) / (TOP_SEA + WORLD_H)) / base;
    const out = Math.min(1, fit);
    return [1, (1 + out) / 2, out][level]!;
  }

  /** Scroll with the world clamps shared by edge-pan, drag and zoom. A view
   *  wider than the world centres on it. */
  private setScroll(x: number, y: number): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // The view's left edge sits this far past scroll: zoom works from the centre.
    const shiftX = (cam.width - viewW) / 2;
    const shiftY = (cam.height - viewH) / 2;
    // The HUD bar covers the bottom of the view and the header its top; the
    // map scrolls past both, so the top sea always shows below the header.
    const under = (HUD_COVER_H * baseZoom(this)) / cam.zoom;
    const top = TOP_SEA + (HUD_TOP_H * baseZoom(this)) / cam.zoom;
    const fit = (v: number, max: number): number => (max < 0 ? max / 2 : Math.max(0, Math.min(max, v)));
    cam.scrollX = fit(x + shiftX, WORLD_W - viewW) - shiftX;
    cam.scrollY = fit(y + shiftY + top, top + WORLD_H + under - viewH) - shiftY - top;
  }

  /** The world's ticks, then screen-edge pan, Warcraft-style, at the same
   *  on-screen speed at any zoom. The clamp runs every frame so a zoom tween
   *  stays in bounds. */
  update(_time: number, delta: number): void {
    const running = this.phase === "live" && !this.paused;
    if (running) {
      // A long stall (a hidden tab) catches up a few ticks, not minutes.
      this.acc = Math.min(this.acc + delta * this.speed, TICK_MS * 5);
      while (this.acc >= TICK_MS && this.phase === "live") {
        this.acc -= TICK_MS;
        this.tickOnce();
      }
    }
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    // The tile under the pointer, through this map's own camera: a pointer
    // over the HUD carries the HUD camera's world position.
    const at = cam.getWorldPoint(p.x, p.y);
    const hover = { col: Math.floor(at.x / CELL), row: Math.floor(at.y / CELL) };
    if (hover.col !== this.hover.col || hover.row !== this.hover.row) {
      this.hover = hover;
      if (this.placing) this.drawGhost();
    }
    // Pointer coordinates are canvas pixels, baseZoom per HUD unit.
    const e = this.pointerIn ? EDGE * baseZoom(this) : -Infinity;
    const k = (this.cursors ??= this.input.keyboard?.createCursorKeys() ?? null);
    const dx = p.x < e || k?.left.isDown ? -1 : p.x > cam.width - e || k?.right.isDown ? 1 : 0;
    const dy = p.y < e || k?.up.isDown ? -1 : p.y > cam.height - e || k?.down.isDown ? 1 : 0;
    const step = (PAN_PX_S * baseZoom(this) * delta) / 1000 / cam.zoom;
    this.setScroll(cam.scrollX + dx * step, cam.scrollY + dy * step);
  }
}

function describeOrder(u: WarUnit, state: MatchState): string {
  const o = u.order;
  switch (o.type) {
    case "attackMove":
      return "Moving, fighting whatever it meets on the way.";
    case "move":
      return "Walking there.";
    case "attack":
      return "Going for a chosen enemy.";
    case "attackBuilding":
      return "Attacking a building.";
    case "hold":
      return "Holding its tile.";
    case "gather":
      return u.carry ? "Carrying gold home to the castle." : "Digging gold at a mine.";
    case "stop":
      return "Guarding where it stands.";
    case "build": {
      const b = state.buildings[o.plot];
      return b ? `Building the ${NAME[b.kind].toLowerCase()}; back to digging once it stands.` : "Building.";
    }
  }
}

function upgradeText(kind: BuildingKind): string {
  switch (kind) {
    case "barracks":
      return "Warriors +20% HP";
    case "archery":
      return "Archers +1 range";
    case "tower":
      return "Lancers +20% HP";
    case "monastery":
      return "Monks heal 30% more";
    default:
      return "";
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
