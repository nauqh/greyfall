// The Warcraft-style strategic map, built the way the pack's own demo map
// (map.gif) is: one 64px tile per cell, autotiled from an ASCII height map.
// Ground takes the tileset's left block, plateaus its right block, every
// south-facing plateau edge drops a cliff into the cell below, and a slope
// piece at a plateau's end is the way up.
//
// The war is played here: plan with the world frozen, fight, read the round
// report, again, until a main hall falls. The engine decides everything;
// this scene draws its state, turns clicks into planning actions, and plays
// a battle's event log back.

import {
  MINES,
  PLOTS,
  WAR,
  applyAction,
  battle,
  freeBuilders,
  mineById,
  plotDistance,
  tileDistance,
  isOpen,
  maxHp,
  newMatch,
  planAi,
  plotById,
  supplyCap,
  supplyUsed,
  trainsAt,
  type Action,
  type BattleOutcome,
  type BuildingKind,
  type MatchState,
  type Order,
  type Plot,
  type UnitClass,
  type WarEvent,
  type WarUnit,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { packUrl, type BuildingName } from "./art";
import { baseZoom, fitCamera, startGame } from "./boot";
import { HUD_COVER_H, HUD_KEY, ICON, StrategicHud, portraitKey, type HudCommand, type HudModel } from "./StrategicHud";
import { HAND, label } from "./ui";
import { MAP, STRAT_COLS, STRAT_ROWS, at, isSlope, isLand } from "./stratMap";
import { BODY_HEIGHT, MONSTER_BODY_HEIGHT, loadUnits, makeAnims, playPose, unitKey } from "./sprites";

/** Work loops for a Pawn standing at its job: the pickaxe at a mine, the
 *  hammer at a plot. The Gnome has neither, so its swing does both. */
const WORK = {
  dig: { key: "pawnDig", file: "Units/Blue Units/Pawn/Pawn_Interact Pickaxe.png" },
  hammer: { key: "pawnHammer", file: "Units/Blue Units/Pawn/Pawn_Interact Hammer.png" },
} as const;
import {
  DEPTH,
  addBuilding,
  addDecor,
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
import { STEPS, markTutorialDone, tutorialDone, type TutorialContext } from "./tutorial";

/** The tileset's native tile: nothing is stretched. */
const CELL = 64;
/** The map carries its own sea margin, so the world is the grid, plus open
 *  sea above it that the view may scroll into (y runs negative there). */
const WORLD_W = STRAT_COLS * CELL;
const WORLD_H = STRAT_ROWS * CELL;
const TOP_SEA = 2 * CELL;
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
/** Zoom steps: native, halfway, and all of the world in view. */
const ZOOM_STEPS = 3;

/** A step's walk takes most of the second it is given, so a march reads as
 *  one walk rather than a string of hops. */
const STEP_MS = 880;
const TICK_MS = 1000 / 10;

/** Placed in cells, so a building's base lands on the row it names. */
function cell(side: Structure["side"], name: Structure["name"], col: number, row: number, scale?: number): Structure {
  return { side, name, x: col * CELL, y: row * CELL, scale };
}

const ART: Record<BuildingKind, BuildingName> = {
  castle: "castle",
  barracks: "barracks",
  archery: "archery",
  tower: "tower",
  monastery: "monastery",
  house: "house1",
};

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

/** What the monster standing in for each class is called. */
const MONSTER_NAME: Record<UnitClass, string> = {
  pawn: "Gnome",
  warrior: "Skull",
  lancer: "Turtle",
  archer: "Gnoll",
  monk: "Hex Shaman",
};

/** The pack's three house fronts, one per house plot. */
function artOf(p: Plot): BuildingName {
  if (p.kind !== "house") return ART[p.kind];
  return `house${p.id.slice(-1)}` as BuildingName;
}

/** Where a plot's art stands: centred on its footprint, base on its last row. */
function plotBase(p: Plot): { x: number; y: number } {
  return { x: (p.col + p.w / 2) * CELL, y: (p.row + p.h) * CELL };
}

function cellXY(col: number, row: number): { x: number; y: number } {
  return { x: STRAT.x0 + col * CELL + CELL / 2, y: STRAT.y0 + row * CELL + CELL / 2 };
}

function head(u: { side: "a" | "b"; class: UnitClass }): number {
  return (u.side === "a" ? BODY_HEIGHT : MONSTER_BODY_HEIGHT)[u.class];
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

type Phase = "plan" | "battle" | "report" | "over";

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
  /** The walkthrough's current step, or null once it is done or skipped. */
  private tutor: number | null = null;
  private focusRing: Phaser.GameObjects.Graphics | null = null;
  private plotTags = new Map<string, Phaser.GameObjects.Text>();

  /** The round as it began, and as the plan has changed it so far. */
  private roundStart!: MatchState;
  private state!: MatchState;
  private plan: Action[] = [];
  private phase: Phase = "plan";
  private outcome: BattleOutcome | null = null;

  private selected: number[] = [];
  private selectedPlot: string | null = null;
  /** An enemy unit or building shown in the panel without being ordered. */
  private inspected: { unit?: number; plot?: string } | null = null;
  /** A command waiting for its target on the map. */
  private message = "";

  private units = new Map<number, UnitView>();
  private buildings = new Map<string, Phaser.GameObjects.Image>();
  private overlay!: Phaser.GameObjects.Graphics;
  private hud!: StrategicHud;

  /** Battle playback: ms into the battle, the next event, playback speed. */
  private clock = 0;
  private cursor = 0;
  private speed = 1;
  /** Building HP as the playback has shown it, for their bars. */
  private buildingHp = new Map<string, number>();

  init(data: { onMenu?: () => void }): void {
    this.onMenu = data.onMenu ?? (() => {});
  }

  constructor() {
    super("strategic");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadWarFx(this);
    loadBuildings(this, PLOTS.map((p) => cell(p.side, artOf(p), 0, 0)));
    // Lowland grass in the sheet's deeper green, as the pack's demo map does:
    // the plateaus keep the sunlit colour1, so height reads as colour too.
    this.load.image("tilesetLow", packUrl("Terrain/Tileset/Tilemap_color3.png"));
    for (const w of Object.values(WORK)) this.load.spritesheet(w.key, packUrl(w.file), { frameWidth: 192, frameHeight: 192 });
    this.load.image("goldMine", packUrl("Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png"));
    this.load.spritesheet("sheep", packUrl("Terrain/Resources/Meat/Sheep/Sheep_Idle.png"), {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(): void {
    // Open on the player's own plateau.
    fitCamera(this, 10 * CELL, 6 * CELL, () => this.zoomScale(this.zoomLevel));
    prepareTerrain(this);
    makeAnims(this);
    makeWarFxAnims(this);
    for (const w of Object.values(WORK)) {
      if (!this.anims.exists(w.key)) this.anims.create({ key: w.key, frames: this.anims.generateFrameNumbers(w.key), frameRate: 10, repeat: -1 });
    }
    if (!this.anims.exists("gnomeWork")) {
      this.anims.create({ key: "gnomeWork", frames: this.anims.generateFrameNumbers(unitKey("b", "pawn", "attack")), frameRate: 10, repeat: -1 });
    }
    if (!this.anims.exists("sheep_anim")) {
      this.anims.create({ key: "sheep_anim", frames: this.anims.generateFrameNumbers("sheep"), frameRate: 8, repeat: -1 });
    }

    buildWater(this);
    this.buildMap();
    this.buildScenery();
    driftClouds(this, { w: WORLD_W, h: WORLD_H }, "strategic");
    this.overlay = this.add.graphics().setDepth(DEPTH.decorBehind + 0.5);
    this.box = this.add.graphics().setDepth(DEPTH.fx + 2);

    this.startMatch();

    this.hud = this.scene.add(HUD_KEY, StrategicHud, true, {
      map: MAP,
      marks: PLOTS.filter((p) => p.kind === "castle").map((p) => ({ col: p.col + 1, row: p.row + 1, side: p.side })),
      // The HUD is the top scene, so the cloud cover goes there to sit over
      // its buttons too.
      onMenu: () => this.toMenu(),
      onZoom: (dir: 1 | -1) => this.zoomStep(dir),
      onMinimap: (col: number, row: number) => this.lookAt(col, row),
      speaker: () => this.speakerAnchor(),
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
      } else if (this.phase === "plan" && p.leftButtonDown()) {
        this.drawBox(d, p);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.dragStart;
      this.dragStart = null;
      this.box.clear();
      if (!d) return;
      if (d.moved && !d.pan && p.leftButtonReleased()) {
        this.boxSelect(d, p);
        return;
      }
      if (!d.moved) this.tap(p, d.touch);
    });
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
    if (this.phase !== "plan") return;
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

  /** Warcraft's keys, the few this game needs: Esc deselects, F1 picks the
   *  Pawns and F2 the army, arrows pan. Orders are all clicks. */
  private hotkey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === "escape") {
      this.clearSelection();
      this.message = "";
      this.refresh();
      return;
    }
    if (this.phase !== "plan") return;
    if (k === "f1" || k === "f2") {
      e.preventDefault();
      if (k === "f1") this.selectPawns();
      else this.selectArmy();
      return;
    }
  }

  /** Clouds close over the HUD, the top scene, then the page moves on. */
  private toMenu(): void {
    this.input.enabled = false;
    this.hud.input.enabled = false;
    cloudCover(this.hud, "close", () => this.onMenu());
  }

  // --- the match -----------------------------------------------------------

  private startMatch(): void {
    for (const v of this.units.values()) v.root.destroy();
    this.units.clear();
    this.roundStart = newMatch(Date.now() % 1_000_000);
    this.state = this.roundStart;
    this.plan = [];
    this.phase = "plan";
    this.outcome = null;
    this.clearSelection();
    this.tutor = tutorialDone() ? null : 0;
    this.message = this.tutor === null ? "Your Pawns are already digging. Train an army at the barracks, then Fight." : "";
    this.syncWorld(this.state);
    this.refresh();
  }

  // --- the walkthrough -----------------------------------------------------

  private tutorContext(): TutorialContext {
    return { state: this.state, selected: this.selected, phase: this.phase };
  }

  /** Past every step the player has already done, and off after the last. */
  private advanceTutor(): void {
    while (this.tutor !== null) {
      const step = STEPS[this.tutor];
      if (!step) {
        this.endTutor();
        return;
      }
      if (!step.done?.(this.tutorContext())) return;
      this.tutor += 1;
    }
  }

  private nextTutor(): void {
    if (this.tutor === null) return;
    this.tutor += 1;
    this.refresh();
  }

  /** From the top; steps the player has already done pass by themselves. */
  private restartTutor(): void {
    this.tutor = 0;
    this.message = "";
    this.refresh();
  }

  private endTutor(): void {
    this.tutor = null;
    markTutorialDone();
    this.refresh();
  }

  /** The step to show now, or none while its moment has not come. */
  private tutorStep(): (typeof STEPS)[number] | null {
    if (this.tutor === null || this.phase !== "plan") return null;
    const step = STEPS[this.tutor];
    if (!step || (step.when && !step.when(this.tutorContext()))) return null;
    return step;
  }

  /** Where the speaking Pawn's head is, in HUD units, or null when it is gone. */
  private speakerAnchor(): { x: number; y: number } | null {
    const pawn = [...this.units.values()]
      .filter((v) => !v.dead && v.unit.side === "a" && v.unit.class === "pawn")
      .sort((a, b) => a.unit.id - b.unit.id)[0];
    if (!pawn) return null;
    const cam = this.cameras.main;
    const z = baseZoom(this);
    return {
      x: ((pawn.root.x - cam.worldView.x) * cam.zoom) / z,
      y: ((pawn.root.y - head(pawn.unit) - 6 - cam.worldView.y) * cam.zoom) / z,
    };
  }

  /** One planning action for the player: kept when legal, explained when not. */
  private act(action: Action): boolean {
    if (this.phase !== "plan") return false;
    const r = applyAction(this.state, "a", action);
    if (!r.ok) {
      this.message = r.error.charAt(0).toUpperCase() + r.error.slice(1) + ".";
      this.refresh();
      return false;
    }
    this.state = r.state;
    this.plan.push(action);
    this.message = "";
    // Units that died between the plan and now cannot stay selected.
    this.selected = this.selected.filter((id) => this.state.units.some((u) => u.id === id));
    this.syncWorld(this.state);
    this.refresh();
    return true;
  }

  private resetPlan(): void {
    this.state = this.roundStart;
    this.plan = [];
    this.clearSelection();
    this.message = "Plan cleared.";
    this.syncWorld(this.state);
    this.refresh();
  }

  private fight(): void {
    if (this.phase !== "plan") return;
    let out: BattleOutcome;
    try {
      out = battle(this.roundStart, this.plan, planAi(this.roundStart, "b"));
    } catch (err) {
      this.message = err instanceof Error ? err.message : "The battle could not start.";
      this.refresh();
      return;
    }
    this.outcome = out;
    this.phase = "battle";
    this.clearSelection();
    this.message = "";
    this.clock = 0;
    this.cursor = 0;
    this.buildingHp = new Map(PLOTS.map((p) => [p.id, out.start.buildings[p.id]!.hp]));
    this.syncWorld(out.start);
    this.refresh();
  }

  /** Skip the rest of the playback straight to the report. */
  private skip(): void {
    if (this.phase !== "battle" || !this.outcome) return;
    this.tweens.killAll();
    this.time.removeAllEvents();
    clearFx(this);
    for (const v of this.units.values()) v.root.destroy();
    this.units.clear();
    this.finishBattle();
  }

  private finishBattle(): void {
    const out = this.outcome!;
    this.roundStart = out.end;
    this.state = out.end;
    this.plan = [];
    this.phase = out.end.winner ? "over" : "report";
    this.syncWorld(out.end);
    this.refresh();
  }

  private nextRound(): void {
    this.phase = "plan";
    this.outcome = null;
    this.message = "";
    this.refresh();
  }

  // --- drawing the state ---------------------------------------------------

  /** Make the island show `state`: buildings, units, marks. Snaps, no tweens. */
  private syncWorld(state: MatchState): void {
    for (const p of PLOTS) {
      const b = state.buildings[p.id]!;
      let img = this.buildings.get(p.id);
      const shows = b.level > 0 || b.pending === "build";
      if (shows && !img) {
        const { x, y } = plotBase(p);
        img = addBuilding(this, cell(p.side, artOf(p), x / CELL, y / CELL));
        this.buildings.set(p.id, img);
      }
      if (!shows && img) {
        img.destroy();
        this.buildings.delete(p.id);
        img = undefined;
      }
      // Under construction: a pale outline of what is coming.
      img?.setAlpha(b.level === 0 ? 0.45 : 1).clearTint();
    }

    const seen = new Set<number>();
    for (const u of state.units) {
      seen.add(u.id);
      let v = this.units.get(u.id);
      if (!v) v = this.addUnit(u);
      v.unit = u;
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
    this.drawMarks();
  }

  /** Standing still: idle, or a Pawn at its job, digging beside its mine or
   *  hammering beside the plot it builds, facing the work. */
  private restPose(v: UnitView): void {
    const u = v.unit;
    playPose(v.sprite, u.side, u.class, "idle");
    // The world is frozen while planning; work plays out with the battle.
    if (u.class !== "pawn" || this.phase !== "battle") return;
    const o = u.order;
    let at: number | null = null;
    let job: "dig" | "hammer" = "dig";
    if (o.type === "gather") {
      const m = mineById(o.mine);
      if (m && tileDistance(u, m) <= 1) at = cellXY(m.col, m.row).x;
    } else if (o.type === "build") {
      const p = plotById(o.plot);
      if (p && plotDistance(p, u) === 1) {
        at = plotBase(p).x;
        job = "hammer";
      }
    }
    if (at === null) return;
    v.sprite.play(u.side === "a" ? WORK[job].key : "gnomeWork", true);
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
    const v: UnitView = { unit: u, root, sprite, shadow, marks, settle: null, dead: false };
    this.units.set(u.id, v);
    return v;
  }

  /** Selection rings, HP bars, stance badges, planned orders, open plots. */
  private drawMarks(): void {
    const g = this.overlay;
    g.clear();
    for (const t of this.plotTags.values()) t.setVisible(false);
    const planning = this.phase === "plan";

    for (const v of this.units.values()) {
      const u = v.unit;
      const m = v.marks;
      m.clear();
      const chosen = this.selected.includes(u.id) || this.inspected?.unit === u.id;
      if (chosen) {
        m.lineStyle(2, u.side === "a" ? 0x9cff8a : 0xff7a6a, 0.95).strokeEllipse(0, 2, 40, 16);
      }
      const max = maxHp(this.state, u.side, u.class);
      if (chosen || u.hp < max) {
        const top = -head(u) - 12;
        m.fillStyle(0x1c2634, 0.85).fillRect(-16, top, 32, 5);
        m.fillStyle(u.side === "a" ? 0x7ad35a : 0xe0533e).fillRect(-15, top + 1, Math.max(1, 30 * (u.hp / max)), 3);
      }
      if (u.stance === "fallBack" && u.class !== "pawn" && u.side === "a") {
        // A small white flag: this unit falls back when hurt.
        const fx = 14;
        const fy = -head(u) - 2;
        m.lineStyle(2, 0x3a2a1a).lineBetween(fx, fy, fx, fy + 16);
        m.fillStyle(0xfdfaf0).fillTriangle(fx, fy, fx + 10, fy + 4, fx, fy + 8);
      }
    }

    if (!planning) return;
    // Open plots of the player's own, where a building could go, each saying
    // what it would be and what it unlocks.
    for (const p of PLOTS) {
      if (p.side !== "a") continue;
      const b = this.state.buildings[p.id]!;
      const picked = this.selectedPlot === p.id;
      if (b.level > 0 || b.pending) {
        if (picked) g.lineStyle(2, 0x9cff8a, 0.95).strokeRect(p.col * CELL, (p.row - 1) * CELL, p.w * CELL, (p.h + 1) * CELL);
        continue;
      }
      g.lineStyle(2, picked ? 0x9cff8a : 0xfdfaf0, picked ? 0.95 : 0.55);
      g.strokeRect(p.col * CELL + 4, p.row * CELL + 4, p.w * CELL - 8, p.h * CELL - 8);
      this.plotTag(p).setVisible(true);
    }
    // Where the selected units are going.
    for (const id of this.selected) {
      const u = this.state.units.find((x) => x.id === id);
      if (!u) continue;
      const from = cellXY(u.col, u.row);
      const to = this.orderTarget(u.order);
      if (!to) continue;
      const tone = u.order.type === "move" ? 0x9cff8a : u.order.type === "gather" ? 0xffd66a : 0xff9c7a;
      g.lineStyle(2, tone, 0.8).lineBetween(from.x, from.y, to.x, to.y);
      g.fillStyle(tone, 0.9).fillTriangle(to.x, to.y - 18, to.x + 12, to.y - 13, to.x, to.y - 8);
      g.lineStyle(2, tone, 0.9).lineBetween(to.x, to.y - 18, to.x, to.y);
    }
  }

  /** The words on an empty plot, made once and shown while it is empty. */
  private plotTag(p: Plot): Phaser.GameObjects.Text {
    let t = this.plotTags.get(p.id);
    if (!t) {
      const cls = trainsAt(p);
      const what = cls ? CLASS_NAME[cls] : `+${WAR.supply.perHouse} supply`;
      t = label(this, (p.col + p.w / 2) * CELL, (p.row + p.h / 2) * CELL, `${NAME[p.kind]}\n${what}, ${WAR.buildCost[p.kind]}g`, {
        fontSize: p.w > 1 ? "14px" : "11px",
        align: "center",
      }).setDepth(DEPTH.decorBehind + 0.6);
      this.plotTags.set(p.id, t);
    }
    return t;
  }

  private orderTarget(o: Order): { x: number; y: number } | null {
    switch (o.type) {
      case "move":
      case "attackMove":
        return cellXY(o.to.col, o.to.row);
      case "attack": {
        const t = this.state.units.find((u) => u.id === o.unit);
        return t ? cellXY(t.col, t.row) : null;
      }
      case "attackBuilding": {
        const p = plotById(o.plot);
        return p ? plotBase(p) : null;
      }
      case "gather": {
        const m = MINES.find((x) => x.id === o.mine);
        return m ? cellXY(m.col, m.row) : null;
      }
      case "build": {
        const p = plotById(o.plot);
        return p ? plotBase(p) : null;
      }
      default:
        return null;
    }
  }

  private refresh(): void {
    this.advanceTutor();
    this.drawMarks();
    this.drawFocus();
    this.hud?.refresh();
  }

  /** A pulsing outline on the building the walkthrough is pointing at. */
  private drawFocus(): void {
    const g = (this.focusRing ??= this.add.graphics().setDepth(DEPTH.fx));
    if (!this.tweens.isTweening(g)) {
      this.tweens.add({ targets: g, alpha: { from: 1, to: 0.25 }, duration: 600, yoyo: true, repeat: -1 });
    }
    g.clear();
    if (this.tutorStep()?.focus !== "barracks") return;
    const p = plotById("a-barracks")!;
    g.lineStyle(4, 0xffe28a, 1).strokeRoundedRect(p.col * CELL - 6, (p.row - 2) * CELL, p.w * CELL + 12, (p.h + 2) * CELL + 6, 10);
  }

  // --- input ---------------------------------------------------------------

  private clearSelection(): void {
    this.selected = [];
    this.selectedPlot = null;
    this.inspected = null;
  }

  /** What is under a tap: a unit first (its body stands above its tile),
   *  then a building (its art stands above its footprint), a mine, ground. */
  private hitTest(x: number, y: number): { unit?: WarUnit; plot?: Plot; mine?: string; cell: { col: number; row: number } } {
    const cellAt = { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
    let best: WarUnit | undefined;
    let bestD = 34;
    for (const v of this.units.values()) {
      if (v.dead) continue;
      const d = Math.hypot(x - v.root.x, y - (v.root.y - head(v.unit) / 2));
      if (d < bestD) {
        bestD = d;
        best = v.unit;
      }
    }
    if (best) return { unit: best, cell: cellAt };
    const plot = PLOTS.find(
      (p) =>
        cellAt.col >= p.col &&
        cellAt.col < p.col + p.w &&
        cellAt.row >= p.row - (p.kind === "house" ? 1 : 2) &&
        cellAt.row < p.row + p.h,
    );
    if (plot && (this.state.buildings[plot.id]!.level > 0 || this.state.buildings[plot.id]!.pending || plot.side === "a")) {
      return { plot, cell: cellAt };
    }
    const mine = MINES.find((m) => Math.abs(m.col - cellAt.col) <= 0 && Math.abs(m.row - cellAt.row) <= 0);
    if (mine) return { mine: mine.id, cell: cellAt };
    return { cell: cellAt };
  }

  /**
   * A click that did not drag. Right click: the smart order for the
   * selection, as in Warcraft. Left click: aims an armed command, else
   * selects what is under it, and on empty ground deselects. A tap on touch
   * has no right button, so with units selected it orders instead.
   */
  private tap(p: Phaser.Input.Pointer, touch: boolean): void {
    if (this.phase !== "plan") return;
    const hit = this.hitTest(p.worldX, p.worldY);
    const right = p.rightButtonReleased();
    const ev = p.event as MouseEvent | undefined;
    const shift = ev?.shiftKey ?? false;
    const mine = (u?: WarUnit) => u?.side === "a";

    if (right) {
      if (this.selected.length > 0) this.order(hit);
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

  /** The one order there is, read from what was clicked: an enemy to go for,
   *  a mine to dig, or ground to walk to. */
  private order(hit: ReturnType<StrategicScene["hitTest"]>): void {
    const units = this.state.units.filter((u) => this.selected.includes(u.id));
    const pawnsOnly = units.every((u) => u.class === "pawn");
    // A Pawn that is building stays at its plot until the round ends.
    const ids = units.filter((u) => u.order.type !== "build").map((u) => u.id);
    if (ids.length === 0) {
      this.message = "Those Pawns are building until the round ends.";
      this.refresh();
      return;
    }
    // Monks heal and Pawns dig; only the rest go for an enemy.
    const strikers = units.filter((u) => u.class !== "monk" && u.class !== "pawn").map((u) => u.id);
    const pawnIds = units.filter((u) => u.class === "pawn" && u.order.type !== "build").map((u) => u.id);

    if (hit.unit && hit.unit.side === "b") {
      const fighters = strikers;
      if (fighters.length > 0) this.act({ type: "order", units: fighters, order: { type: "attack", unit: hit.unit.id } });
      return;
    }
    if (hit.plot && hit.plot.side === "b" && this.state.buildings[hit.plot.id]!.level > 0) {
      const fighters = strikers;
      if (fighters.length > 0) this.act({ type: "order", units: fighters, order: { type: "attackBuilding", plot: hit.plot.id } });
      return;
    }
    if (hit.mine) {
      if (pawnIds.length > 0) {
        this.act({ type: "order", units: pawnIds, order: { type: "gather", mine: hit.mine } });
        return;
      }
    }
    const to = hit.cell;
    if (!isOpen(to)) {
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
    const base: HudModel = {
      round: s.round,
      gold: s.gold.a,
      supply: [supplyUsed(s, "a"), supplyCap(s, "a")],
      greyIn: Math.max(0, WAR.greying.fromRound - s.round),
      banner: { text: `Round ${s.round}: Plan`, tone: "blue" },
      title: "",
      detail: "",
      portrait: null,
      hp: null,
      message: this.message,
      commands: [],
      primary: null,
      secondary: [],
      report: null,
      dots: s.units.map((u) => ({ col: u.col, row: u.row, side: u.side })),
      tutorial: null,
    };
    const step = this.tutorStep();
    if (step) {
      base.tutorial = {
        text: step.text,
        focus: step.focus,
        button: step.button ? { label: step.button, onClick: () => this.nextTutor() } : null,
        onSkip: () => this.endTutor(),
      };
    }

    if (this.phase === "battle") {
      return {
        ...base,
        banner: { text: `Round ${s.round}: Battle`, tone: "red" },
        title: "The battle",
        detail: "Both plans play out at once. Nothing can be ordered until it settles.",
        secondary: [
          { label: "Skip", onClick: () => this.skip() },
          { label: `Speed ${this.speed}x`, onClick: () => this.toggleSpeed() },
        ],
      };
    }
    if (this.phase === "report" || this.phase === "over") {
      return { ...base, report: this.reportModel() };
    }

    const plan: HudModel = {
      ...base,
      primary: { label: "Fight!", onClick: () => this.fight() },
      secondary: [
        { label: "Army", onClick: () => this.selectArmy() },
        { label: "Pawns", onClick: () => this.selectPawns() },
        // Hidden while the walkthrough runs; it has its own way out.
        ...(this.tutor === null ? [{ label: "Tutorial", onClick: () => this.restartTutor() }] : []),
      ],
    };
    if (this.selected.length > 0) return { ...plan, ...this.unitPanel() };
    if (this.selectedPlot) return { ...plan, ...this.plotPanel(this.selectedPlot) };
    if (this.inspected) return { ...plan, ...this.inspectPanel() };
    return {
      ...plan,
      title: "Your plan",
      detail: "Drag a box or click to select, right click to order. Double click picks every unit of a kind; F2 the whole army.",
      commands: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        { label: "Undo all", hint: "Undo this round's whole plan.", onClick: () => this.resetPlan(), enabled: this.plan.length > 0 },
      ],
    };
  }

  private unitPanel(): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp"> {
    const units = this.state.units.filter((u) => this.selected.includes(u.id));
    const counts = new Map<UnitClass, number>();
    for (const u of units) counts.set(u.class, (counts.get(u.class) ?? 0) + 1);
    const one = units.length === 1 ? units[0]! : null;
    const title = one
      ? CLASS_NAME[one.class]
      : `${units.length} units: ${[...counts].map(([c, n]) => `${n} ${CLASS_NAME[c]}`).join(", ")}`;
    const fighters = units.filter((u) => u.class !== "pawn");
    const allFallBack = fighters.length > 0 && fighters.every((u) => u.stance === "fallBack");
    const close: HudCommand = { label: "Close", hint: "Deselect.", onClick: () => (this.clearSelection(), this.refresh()) };
    // Orders are clicks, so the card holds only what a click cannot say:
    // what the fighters do once they are badly hurt.
    const stance: HudCommand | null =
      fighters.length === 0
        ? null
        : allFallBack
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
    const help =
      fighters.length === 0
        ? "Pawns dig gold and never fight. Right click a mine to send them there."
        : "Right click the ground to send them; they fight whatever they meet. Right click an enemy to go straight for it.";
    return {
      title,
      portrait: portraitKey("a", (one ?? units[0]!).class),
      hp: one ? [one.hp, maxHp(this.state, "a", one.class)] : null,
      detail: one ? `${describeOrder(one.order)} ${help}` : help,
      commands: [stance, null, null, null, null, null, null, null, close],
    };
  }

  private plotPanel(id: string): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp"> {
    const p = plotById(id)!;
    const b = this.state.buildings[id]!;
    const cls = trainsAt(p);
    const name = NAME[p.kind];
    const portrait = buildingKey(p.side, artOf(p));
    const deselect: HudCommand = { label: "Close", hint: "Deselect.", onClick: () => (this.clearSelection(), this.refresh()) };
    // A Pawn raises every building and upgrade, so a free one is part of the price.
    const pawnFree = freeBuilders(this.state, "a").length > 0;
    const busy = "Every Pawn is already building this round.";
    if (b.level === 0 && !b.pending) {
      const cost = WAR.buildCost[p.kind]!;
      return {
        title: `${name}: empty plot`,
        portrait,
        hp: null,
        detail: p.kind === "house" ? `A house adds ${WAR.supply.perHouse} supply.` : `Unlocks the ${cls ? CLASS_NAME[cls] : ""}. Finished after this round's battle.`,
        commands: [
          {
            label: `Build ${cost}g`,
            icon: ICON.build,
            hint: pawnFree
              ? `Build a ${name.toLowerCase()} for ${cost} gold. A Pawn leaves its mine to build it this round, and it stands after the battle.`
              : busy,
            onClick: () => this.act({ type: "build", plot: id }),
            enabled: pawnFree && this.state.gold.a >= cost,
          },
          null, null, null, null, null, null, null, deselect,
        ],
      };
    }
    if (b.pending === "build") {
      return { title: `${name}: being built`, portrait, hp: null, detail: "A Pawn is building it. It stands after this round's battle.", commands: [null, null, null, null, null, null, null, null, deselect] };
    }
    // Train fills the card's top-left 2x2 block; upgrade sits beside it.
    const commands: (HudCommand | null)[] = [null, null, null, null, null, null, null, null, deselect];
    if (cls) {
      const cost = WAR.unitCost[cls];
      const room = supplyUsed(this.state, "a") < supplyCap(this.state, "a");
      commands[0] = {
        label: CLASS_NAME[cls],
        sub: `${cost} gold, 1 supply`,
        portrait: portraitKey("a", cls),
        big: true,
        hint: room
          ? `Train a ${CLASS_NAME[cls]} for ${cost} gold and 1 supply. It can take orders at once.`
          : "No supply left: every unit takes 1. Build a house for 3 more.",
        onClick: () => this.act({ type: "train", plot: id }),
        enabled: room && this.state.gold.a >= cost,
      };
    }
    if (cls && p.kind !== "castle") {
      commands[2] = {
        label: b.level >= WAR.maxLevel ? "Level 2" : `Upgrade ${WAR.upgradeCost}g`,
        hint:
          b.level >= WAR.maxLevel
            ? "Already at its highest level."
            : b.pending === "upgrade"
              ? "Upgrading: done after this round's battle."
              : pawnFree
                ? `Upgrade for ${WAR.upgradeCost} gold: ${upgradeText(p.kind)}. A Pawn leaves its mine to do it this round.`
                : busy,
        onClick: () => this.act({ type: "upgrade", plot: id }),
        enabled: pawnFree && b.level < WAR.maxLevel && !b.pending && this.state.gold.a >= WAR.upgradeCost,
      };
    }
    return {
      title: `${name}, level ${b.level}`,
      portrait,
      hp: [b.hp, p.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other],
      detail: cls
        ? `Trains the ${CLASS_NAME[cls]}.${b.pending === "upgrade" ? " Upgrading." : ""}`
        : p.kind === "house"
          ? `Adds ${WAR.supply.perHouse} supply.`
          : "Your main hall. If it falls, the war is lost.",
      commands,
    };
  }

  private inspectPanel(): Pick<HudModel, "title" | "detail" | "commands" | "portrait" | "hp"> {
    const i = this.inspected!;
    const none = [null, null, null, null, null, null, null, null, { label: "Close", hint: "Close.", onClick: () => (this.clearSelection(), this.refresh()) }];
    if (i.unit !== undefined) {
      const u = this.state.units.find((x) => x.id === i.unit);
      if (u) {
        return {
          title: `Enemy ${MONSTER_NAME[u.class]}`,
          portrait: portraitKey(u.side, u.class),
          hp: [u.hp, maxHp(this.state, u.side, u.class)],
          detail: `Fights as a ${CLASS_NAME[u.class]}. Select your fighters, then right click it to go for it.`,
          commands: none,
        };
      }
    }
    const p = i.plot ? plotById(i.plot) : undefined;
    if (p) {
      const b = this.state.buildings[p.id]!;
      return {
        title: `Enemy ${NAME[p.kind].toLowerCase()}, level ${b.level}`,
        portrait: buildingKey(p.side, artOf(p)),
        hp: [b.hp, p.kind === "castle" ? WAR.buildingHp.castle : WAR.buildingHp.other],
        detail: "Select your fighters, then right click it to go for it.",
        commands: none,
      };
    }
    return { title: "", detail: "", portrait: null, hp: null, commands: none };
  }

  private reportModel(): NonNullable<HudModel["report"]> {
    const out = this.outcome!;
    const r = out.report;
    const list = (xs: UnitClass[]) => {
      if (xs.length === 0) return "none";
      const c = new Map<UnitClass, number>();
      for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
      return [...c].map(([k, n]) => `${n} ${CLASS_NAME[k]}`).join(", ");
    };
    const place = (id: string) => {
      const p = plotById(id)!;
      return `${p.side === "a" ? "your" : "their"} ${NAME[p.kind].toLowerCase()}`;
    };
    const lines = [
      `The battle lasted ${r.seconds.toFixed(1)} s${r.settled ? "" : ", cut off: it carries on next round"}.`,
      `You lost: ${list(r.losses.a)}.   They lost: ${list(r.losses.b)}.`,
    ];
    const mine = r.fellBack.filter((f) => f.side === "a");
    if (mine.length > 0) lines.push(`Fell back: ${mine.map((f) => `${CLASS_NAME[f.class]} at ${f.hpPercent}%`).join(", ")}.`);
    if (r.destroyed.length > 0) lines.push(`Destroyed: ${r.destroyed.map(place).join(", ")}.`);
    const built = [...r.built, ...r.upgraded].filter((id) => id.startsWith("a-"));
    if (built.length > 0) lines.push(`Finished: ${built.map(place).join(", ")}.`);
    if (r.greying > 0) lines.push(`The Greying takes ${r.greying} HP from each main hall.`);

    const end = out.end;
    if (end.winner) {
      const title = end.winner === "a" ? "The land is reclaimed" : end.winner === "b" ? "THE GREY TAKES YOU" : "Both halls fall";
      return {
        title,
        tone: end.winner === "a" ? "blue" : "red",
        lines: [...lines, `The war ended in round ${r.round}.`],
        button: "Play again",
        onClick: () => this.startMatch(),
        also: { label: "Menu", onClick: () => this.toMenu() },
      };
    }
    const inc = end.income.a;
    lines.push(`Round ${end.round} income: ${inc.base} gold, plus ${inc.mines} from the mines.`);
    return { title: `Round ${r.round}: Report`, tone: "blue", lines, button: "Next round", onClick: () => this.nextRound() };
  }

  private selectArmy(): void {
    this.clearSelection();
    this.selected = this.state.units.filter((u) => u.side === "a" && u.class !== "pawn").map((u) => u.id);
    this.message = this.selected.length === 0 ? "No army yet: train one at the barracks." : "";
    this.refresh();
  }

  private selectPawns(): void {
    this.clearSelection();
    this.selected = this.state.units.filter((u) => u.side === "a" && u.class === "pawn").map((u) => u.id);
    this.refresh();
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.hud.refresh();
  }

  // --- battle playback -----------------------------------------------------

  private playEvents(delta: number): void {
    const out = this.outcome;
    if (!out || this.phase !== "battle") return;
    this.clock += delta * this.speed;
    while (this.cursor < out.events.length && out.events[this.cursor]!.t * TICK_MS <= this.clock) {
      this.play(out.events[this.cursor]!);
      this.cursor += 1;
    }
    if (this.cursor >= out.events.length && this.clock >= out.ticks * TICK_MS + 900) this.finishBattle();
  }

  private play(e: WarEvent): void {
    switch (e.type) {
      case "move":
        return this.onMove(e.unit, e.col, e.row);
      case "attack":
        return this.onAttack(e.unit, e.target, e.damage, e.hpAfter);
      case "hitBuilding":
        return this.onHitBuilding(e.unit, e.plot, e.damage, e.hpAfter);
      case "heal":
        return this.onHeal(e.unit, e.target, e.amount, e.hpAfter);
      case "fallBack": {
        const v = this.units.get(e.unit);
        if (v && !v.dead) {
          v.unit = { ...v.unit, stance: "fallBack" };
          floatText(this, v.root.x, v.root.y - head(v.unit) - 22, "Falls back", "#fdfaf0", this.speed);
        }
        return;
      }
      case "death":
        return this.onDeath(e.unit);
      case "destroyed":
        return this.onDestroyed(e.plot);
    }
  }

  private onMove(id: number, col: number, row: number): void {
    const v = this.units.get(id);
    if (!v || v.dead) return;
    const { x, y } = cellXY(col, row);
    const chained = v.settle !== null;
    v.settle?.remove();
    v.settle = null;
    playPose(v.sprite, v.unit.side, v.unit.class, "run");
    if (Math.abs(x - v.root.x) > 0.5) v.sprite.setFlipX(x < v.root.x);
    v.unit = { ...v.unit, col, row };
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

  private onAttack(by: number, target: number, damage: number, hpAfter: number): void {
    const a = this.units.get(by);
    const t = this.units.get(target);
    if (!a || !t) return;
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
      t.unit = { ...t.unit, hp: hpAfter };
      flash(this, t.sprite, this.speed);
      floatText(this, t.root.x, t.root.y - head(t.unit) - 20, `-${damage}`, "#ff8f7a", this.speed);
      this.drawMarks();
    });
  }

  private onHitBuilding(by: number, plotId: string, damage: number, hpAfter: number): void {
    const a = this.units.get(by);
    const p = plotById(plotId)!;
    const img = this.buildings.get(plotId);
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
      this.buildingHp.set(plotId, hpAfter);
      if (img?.active) flash(this, img, this.speed);
      floatText(this, base.x, base.y - 110, `-${damage}`, "#ff8f7a", this.speed);
    });
  }

  private onHeal(by: number, target: number, amount: number, hpAfter: number): void {
    const c = this.units.get(by);
    const t = this.units.get(target);
    if (!t) return;
    if (c && !c.dead) {
      this.face(c, t.root.x);
      this.strikePose(c);
    }
    this.time.delayedCall(IMPACT_MS / this.speed, () => {
      if (!t.root.active) return;
      t.unit = { ...t.unit, hp: hpAfter };
      floatText(this, t.root.x, t.root.y - head(t.unit) - 20, `+${amount}`, "#a9e88a", this.speed);
      this.drawMarks();
    });
  }

  private onDeath(id: number): void {
    const v = this.units.get(id);
    if (!v || v.dead) return;
    v.dead = true;
    // After the killing blow has shown.
    this.time.delayedCall((ARROW_RELEASE_MS + FLIGHT_MS) / this.speed, () => {
      v.settle?.remove();
      this.tweens.killTweensOf(v.root);
      v.marks.clear();
      this.units.delete(id);
      deathFx(this, v.root, v.sprite, this.speed);
    });
  }

  private onDestroyed(plotId: string): void {
    const img = this.buildings.get(plotId);
    if (!img) return;
    this.buildings.delete(plotId);
    trackFx(this, img);
    this.time.delayedCall(IMPACT_MS / this.speed, () => {
      img.setTint(0x6f6f6f);
      const p = plotById(plotId)!;
      const base = plotBase(p);
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
  private zoomLevel = 0;

  /** A step as a multiple of baseZoom. The last fits the whole world, top
   *  sea included, above the HUD on both axes, so there is nothing to drag;
   *  it depends on the screen, so it is worked out each time. */
  private zoomScale(level: number): number {
    const cam = this.cameras.main;
    const base = baseZoom(this);
    const fit = Math.min(cam.width / WORLD_W, (cam.height - HUD_COVER_H * base) / (TOP_SEA + WORLD_H)) / base;
    const out = Math.min(1, fit);
    return [1, (1 + out) / 2, out][level]!;
  }

  /** Centre the view on a cell, as a click on Warcraft's minimap does. */
  private lookAt(col: number, row: number): void {
    const cam = this.cameras.main;
    this.setScroll((col + 0.5) * CELL - cam.width / 2, (row + 0.5) * CELL - cam.height / 2);
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
    // The HUD bar covers the bottom of the view; the map scrolls up past it.
    const under = (HUD_COVER_H * baseZoom(this)) / cam.zoom;
    const fit = (v: number, max: number): number => (max < 0 ? max / 2 : Math.max(0, Math.min(max, v)));
    cam.scrollX = fit(x + shiftX, WORLD_W - viewW) - shiftX;
    cam.scrollY = fit(y + shiftY + TOP_SEA, TOP_SEA + WORLD_H + under - viewH) - shiftY - TOP_SEA;
  }

  /** Screen-edge pan, Warcraft-style, at the same on-screen speed at any
   *  zoom. The clamp runs every frame so a zoom tween stays in bounds. */
  update(_time: number, delta: number): void {
    this.playEvents(delta);
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    // Pointer coordinates are canvas pixels, baseZoom per HUD unit.
    const e = EDGE * baseZoom(this);
    const k = (this.cursors ??= this.input.keyboard?.createCursorKeys() ?? null);
    const dx = p.x < e || k?.left.isDown ? -1 : p.x > cam.width - e || k?.right.isDown ? 1 : 0;
    const dy = p.y < e || k?.up.isDown ? -1 : p.y > cam.height - e || k?.down.isDown ? 1 : 0;
    const step = (PAN_PX_S * baseZoom(this) * delta) / 1000 / cam.zoom;
    this.setScroll(cam.scrollX + dx * step, cam.scrollY + dy * step);
  }

  // --- the island ----------------------------------------------------------

  /** Foam under the shore, ground everywhere on land, then plateau tops,
   *  cliffs and slopes over it: the pack's own layer order. */
  private buildMap(): void {
    const tile = (c: number, r: number, tc: number, tr: number, z: number, sheet = "tileset"): void => {
      this.add.image(c * CELL, r * CELL, sheet, `tile_${tc}_${tr}`).setOrigin(0).setDepth(z);
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
        // Under every shore cell and every cliff standing in the sea, each
        // on its own frame, as the pack's tilemap guide asks.
        if ((isLand(c, r) && shore) || (!isLand(c, r) && wall(c, r))) {
          const foam = this.add.sprite(c * CELL + CELL / 2, r * CELL + CELL / 2, "foam").setDepth(DEPTH.foam);
          foam.play("foam_anim");
          if (foam.anims.currentAnim) foam.anims.setProgress(Math.random());
        }
        if (isLand(c, r)) {
          const tc = edge(isLand(c - 1, r), isLand(c + 1, r));
          tile(c, r, tc, edge(isLand(c, r - 1), isLand(c, r + 1)), DEPTH.island, "tilesetLow");
        }
      }
    }
    // The guide's shadow: one per elevated tile, a whole tile below it, so
    // it pools at the cliff foot and rims the sides. A ramp's foot already
    // stands on the lowland, so only its head casts one.
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (plateau(c, r) || isSlope(c, r)) {
          this.add.image(c * CELL + CELL / 2, (r + 1) * CELL + CELL / 2, "shadow_src").setDepth(DEPTH.island + 0.25);
        }
      }
    }
    // Tops, then walls, then ramps over the walls. Beside a ramp a top runs
    // on without a side edge, as the guide's stair examples show; above one
    // it keeps its rim. Walls cap where the run ends; row 4 stands on grass,
    // row 5 in water. Walls take the lowland colour: the tufts at their foot
    // are the ground below.
    const top = DEPTH.island + 0.5;
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (plateau(c, r)) {
          const side = (dc: number): boolean => plateau(c + dc, r) || isSlope(c + dc, r);
          tile(c, r, 5 + edge(side(-1), side(1)), edge(plateau(c, r - 1), plateau(c, r + 1)), top);
        }
      }
    }
    for (let r = 0; r < STRAT_ROWS; r++) {
      for (let c = 0; c < STRAT_COLS; c++) {
        if (wall(c, r)) tile(c, r, 5 + edge(wall(c - 1, r), wall(c + 1, r)), isLand(c, r) ? 4 : 5, top, "tilesetLow");
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

  /** Lumber lines along the coasts, gold where the engine's mines are, sheep
   *  on the lowland and rocks in the shallows. */
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
      [7.5, -0.6], [20.4, -1.1], [29.2, -0.4],
    ]).forEach((s) => s.setDepth(DEPTH.foam));

    for (const m of MINES) {
      const x = (m.col + 0.5) * CELL;
      const y = (m.row + 0.8) * CELL;
      this.add.image(x, y, "goldMine").setOrigin(0.5, 0.78).setDepth(DEPTH.decorBehind + y / 1000);
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
}

function describeOrder(o: Order): string {
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
      return "Digging gold at a mine.";
    case "stop":
      return "Guarding where it stands.";
    case "build":
      return `Building the ${NAME[plotById(o.plot)!.kind].toLowerCase()}; back to digging once it stands.`;
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
