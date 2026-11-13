// Battle playback. The engine decided everything; this only replays its log.
//
// The scene opens in draft mode when the launcher carries no result: a panel
// over the enemy half holds the roster cards, clicks place units on the left
// half, and Start slides the panel away to reveal the enemy army.
//
// The board runs LEFT to RIGHT, two halves of square cells side by side, your
// army on the left. This matches the art: only the Lancer has a vertical
// attack pose, so every class needs to fight sideways to look right. Units
// keep the pack's native pixel scale and the canvas is scaled up by Phaser
// FIT, so the art never resamples.
//
// Playback waits for a 3-2-1 count, so both armies can be read first.

import {
  AUTO,
  BALANCE,
  CHAMPIONS,
  armyCost,
  battleCol,
  traitsOf,
  validateArmy,
  VERSUS,
  type BattleEvent,
  type Board,
  type BattleResult,
  type Champion,
  type LobbyRound,
  type Placement,
  type Side,
  type UnitSnapshot,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { FX, ICON, iconKey, iconUrl, packUrl } from "./art";
import {
  AutoPlan,
  CLASS_NAME,
  PORTRAIT_INK,
  TIER_INK,
  drawStars,
  portraitUrl,
  roundCard,
  skillName,
  teamShadow,
  traitOf,
  traitRow,
  traitTip,
  unitTip,
  type AutoHooks,
} from "./autoPlan";
import { GAME_H, GAME_W, WATER_SPAN, fitCamera, startGame } from "./boot";
import { Handbook } from "./handbook";
import {
  ATTACK_FRAME_RATE,
  BODY_HEIGHT,
  SPRITE_NUDGE,
  animKey,
  healKey,
  bodyScale,
  loadChampions,
  loadUnits,
  makeAnims,
  playPose,
  reviveKey,
  unitKey,
} from "./sprites";
import {
  DEPTH,
  addShadow,
  buildFoam,
  buildIsland,
  buildWater,
  cloudCover,
  driftClouds,
  loadTerrain,
  prepareTerrain,
  scatterDecor,
  type Rect,
} from "./terrain";
import { HAND, PackBar, TEXT_RES, button, label, loadPanels, panel, ribbon } from "./ui";

/** A 192px unit frame carries an ~80px body, so 84 fills a cell. */
const TILE = 84;

// Set by init() from the mode's half board. One scene runs at a time.
let COLS = 0;
let ROWS = 0;
/** Whole 64px terrain tiles. The margins hold the scenery and clear the HUD plates. */
let ISLAND: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
let BOARD_W = 0;
let BOARD_H = 0;
/** Centre of cell (0, 0), the true grid position - drawGrid and movement use this. */
let ORIGIN_X = 0;
let ORIGIN_Y = 0;
/** Where the two front columns meet - the clash point, and the countdown's home. */
let MID_X = 0;
let MID_Y = 0;
/** The advisor's strip, left of the board. */
let ADVISOR_HOME = { x: 0, y: 252 };
let ADVISOR_AREA = { x0: 0, x1: 0, y0: 236, y1: 302 };

function layout(board: Board, island: Rect): void {
  COLS = board.cols * 2;
  ROWS = board.rows;
  ISLAND = island;
  BOARD_W = COLS * TILE;
  BOARD_H = ROWS * TILE;
  ORIGIN_X = (GAME_W - BOARD_W) / 2 + TILE / 2;
  ORIGIN_Y = ISLAND.y0 + (ISLAND.y1 - ISLAND.y0 - BOARD_H) / 2 + TILE / 2;
  MID_X = ORIGIN_X + (COLS / 2 - 0.5) * TILE;
  MID_Y = ORIGIN_Y + ((ROWS - 1) / 2) * TILE;
  const left = ORIGIN_X - TILE / 2;
  ADVISOR_HOME = { x: left - 35, y: 252 };
  ADVISOR_AREA = { x0: Math.max(26, left - 102), x1: left - 12, y0: 236, y1: 302 };
}
layout(BALANCE.board, { x0: 90, y0: 178, x1: 1110, y1: 510 });

const TICK_MS = 1000 / BALANCE.tickRate;
/**
 * A unit acts once a second, so the step nearly fills it. At 420ms it crossed
 * the cell in a snap then stood still, which read as teleporting.
 */
const STEP_MS = 880;

/** The frame of each attack sheet where the weapon leaves the hand. The
 * archer's bow is fully back on frame 5; the projectile spawns then, not at
 * frame 0. */
const RELEASE_FRAME: Partial<Record<Champion, number>> = { archer: 5, gnoll: 5, shaman: 6 };

/** What each ranged attacker throws: sheet key, scale, and whether it tumbles rather than flies point first. */
const MISSILE: Partial<Record<Champion, { key: string; scale: number; spin: boolean }>> = {
  archer: { key: "arrow", scale: 1, spin: false },
  gnoll: { key: "bone", scale: 0.9, spin: true },
  shaman: { key: "hexbolt", scale: 0.55, spin: false },
};

/** Ability callouts over the unit, in the colour of what happened. */
const CALLOUT: Partial<Record<string, [text: string, color: string]>> = {
  splash: ["SPLASH", "#ffb35c"],
  cleave: ["CLEAVE", "#ffd36b"],
  ambush: ["AMBUSH", "#cfd6e0"],
  reassemble: ["REASSEMBLE", "#e8e2cf"],
  smash: ["SMASH", "#ffd36b"],
  hunter: ["HUNTER", "#ffb35c"],
  regenerate: ["REGENERATE", "#9be38a"],
};

/** A spark where a blow lands and a burst where a unit falls, both 192px frames. */
const BLAST = {
  spark: { file: "Particle FX/Explosion_02.png", frames: 10 },
  fall: { file: "Effects/Explosion/Explosions.png", frames: 9 },
} as const;

/** Airtime of a ranged projectile, release to impact. */
const FLIGHT_MS = 320;

/** The advisor's corner. Its amble never leaves this rect, which keeps it
 *  clear of the placement grid at x 180 and the HUD plates at y 58. */
/** An amble, not a march. */
const ADVISOR_SPEED = 46;

/**
 * Time left, m:ss. A battle that runs the clock out is decided on HP, so what
 * matters to watch is how much of it is gone - counting up said nothing until
 * you knew the limit, and the limit is nowhere on screen.
 */
function timeLeft(elapsedMs: number): string {
  const left = Math.max(0, Math.ceil(BALANCE.timeoutSeconds - elapsedMs / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

const ROSTER = CHAMPIONS;

/** Draft cards, four across and three down: size, pitch, and the top row's centre. */
const CARD = { w: 120, h: 112, dx: 130, dy: 116, y0: 178 } as const;

/** Ink on paper, and on the picked card's slate. */
const CARD_INK = {
  paper: { name: "#4a3a28", text: "#6b5740", cost: "#7a4f14", skill: "#7a4f14", on: "#2f5d8a", off: "#9a8a70" },
  slate: { name: "#f5f2e4", text: "#a8b4c4", cost: "#e8c06a", skill: "#e8c06a", on: "#9fd4ff", off: "#8a96a6" },
} as const;

interface DraftCard {
  box: Phaser.GameObjects.Container;
  cy: number;
  face: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text[];
  cost: Phaser.GameObjects.Text;
  trait: Phaser.GameObjects.Text;
  skill: Phaser.GameObjects.Text;
  portrait: Phaser.GameObjects.Image;
}

/** The lock-in block under the cards: a seal and a state per seat, and the clock. */
interface LockBoard {
  seals: Record<"you" | "them", Phaser.GameObjects.Graphics>;
  names: Record<"you" | "them", Phaser.GameObjects.Text>;
  states: Record<"you" | "them", Phaser.GameObjects.Text>;
  clock: Phaser.GameObjects.Text;
  banner: Phaser.GameObjects.Text;
  /** What was last drawn, so a change can pop and nothing redraws every frame. */
  seen: { you: boolean; them: boolean; second: number | null };
}

interface UnitView {
  snap: UnitSnapshot;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  pip: Phaser.GameObjects.Graphics;
  alive: boolean;
  hp: number;
  /** What the pip shows; it slides toward `hp`. */
  shownHp: number;
  /** The warrior's slashes alternate; this is which one plays next. */
  slash: 1 | 2;
  /** Pending return to idle after a step; a follow-on step cancels it. */
  settle: Phaser.Time.TimerEvent | null;
  /** Floating numbers still in the air over this unit. */
  floats: number;
  /** Skirmish: the tick the skill's countdown runs out, and the length of the one under way. */
  skillAt: number;
  skillSpan: number;
}

/** What the scene needs from a room it does not itself own. */
export interface VersusStatus {
  msRemaining: number | null;
  youLocked: boolean;
  theyLocked: boolean;
  opponent: string | null;
  /** Set once the server has resolved; the scene plays it back. */
  battle: BattleResult | null;
}

export interface VersusHooks {
  /** Every board change, so the deadline always has something to resolve. */
  onArmyChange: (army: Placement[]) => void;
  onLock: () => void;
  /** Read every frame while drafting; no events, no imperative handle. */
  status: () => VersusStatus;
  /**
   * Playback is over and the result card is up. The page waits for this
   * before saying who won: the server resolves the moment both seats lock,
   * so the poll knows the winner long before the fight has been watched.
   */
  onPlayed: () => void;
}

export interface BattleLauncher {
  /** Null while drafting: Versus hands the army to the room, which sends the result back. */
  result: BattleResult | null;
  seed: number | string;
  /**
   * Which side of the board is the player's. Skirmish is always side A; in Versus
   * the room decides, and seat B sees the board mirrored so that the half it
   * drafted on is still the half on the left.
   */
  mySide?: Side;
  /** Present only in Versus: the server owns the army and the result. */
  versus?: VersusHooks;
  /** Present only in Skirmish's auto chess lobby, which plans instead of drafting. */
  auto?: AutoHooks;
  /** The opponent's name on the HUD. */
  foe?: string;
  /** The round just fought, for its card after playback. */
  round?: LobbyRound | null;
  /**
   * Hover tooltip requests, with the native pointer position so React can
   * draw the box over the canvas. Absent when nobody is listening.
   */
  onTip?: (text: string | null, x: number, y: number) => void;
  /** Leave the battle for the title screen; the page tears the canvas down. */
  onMenu: () => void;
}

export class BattleScene extends Phaser.Scene {
  private launcher!: BattleLauncher;
  private result: BattleResult | null = null;
  private units = new Map<string, UnitView>();
  private drafting = false;
  private draftArmy: Placement[] = [];
  private picked: Champion | null = null;
  private draftBox!: Phaser.GameObjects.Container;
  /** The how-to bubble; tracks the pawn and leaves with the draft panel. */
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleLine = "";
  private adviceTimer: Phaser.Time.TimerEvent | null = null;
  /** The resident advisor: stand a while, amble to a nearby patch, idle. */
  private advisor: {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    target: { x: number; y: number } | null;
    pauseMs: number;
  } | null = null;
  private cellZone!: Phaser.GameObjects.Zone;
  /** The draft's way back to the menu; gone once the fight starts. */
  private menuBtn: Phaser.GameObjects.Container | null = null;
  /** The placement preview under the cursor while drafting. */
  private ghostCell!: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Sprite | null = null;
  private goldText!: Phaser.GameObjects.Text;
  private goldCoin!: Phaser.GameObjects.Image;
  private errorText!: Phaser.GameObjects.Text;
  private cards = new Map<Champion, DraftCard>();
  private traitBox!: Phaser.GameObjects.Container;
  private lockBoard: LockBoard | null = null;
  /** Gold left at the last refresh, so a spend can pulse the counter. */
  private shownGold = 0;
  private placed = new Map<
    string,
    { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image }
  >();
  private queue: BattleEvent[] = [];
  private simTime = 0;
  private nextEvent = 0;
  private finished = false;
  /** Held until the count finishes. */
  private started = false;
  private speed = 1;
  private mySide: Side = "a";
  /** Seat B's view of the board is flipped, so drafting and battle agree. */
  private mirrored = false;
  private versus: VersusHooks | null = null;
  private auto: AutoHooks | null = null;
  private handbook: Handbook | null = null;
  private plan: AutoPlan | null = null;
  private lockBtn: Phaser.GameObjects.Container | null = null;
  private bars: Record<Side, PackBar | null> = { a: null, b: null };
  private clockText: Phaser.GameObjects.Text | null = null;
  /** Rounds played in this scene, so only a later draft slides in. */
  private rounds = 0;

  constructor() {
    super("battle");
  }

  init(data: BattleLauncher): void {
    // Survives the restart, unlike everything below it.
    if (this.launcher) this.rounds += 1;
    this.launcher = data;
    this.result = data.result;
    this.mySide = data.mySide ?? "a";
    this.mirrored = this.mySide === "b";
    this.versus = data.versus ?? null;
    this.auto = data.auto ?? null;
    // Both halves are 6x4, so the island runs edge to edge.
    layout(this.auto ? AUTO.board : VERSUS.board, { x0: 0, y0: 150, x1: 1200, y1: 540 });
    this.handbook = null;
    this.plan = null;
    this.lockBtn = null;
    this.lockBoard = null;
    this.units = new Map();
    this.queue = [];
    this.simTime = 0;
    this.nextEvent = 0;
    this.finished = false;
    this.started = false;
    this.speed = 1;
    this.drafting = false;
    this.draftArmy = [];
    this.picked = null;
    this.cards = new Map();
    this.shownGold = VERSUS.budget;
    this.placed = new Map();
    this.clockText = null;
    this.bubble = null;
    this.ghost = null;
    this.menuBtn = null;
    this.bubbleLine = "";
    this.adviceTimer = null;
    // Field initialisers run once, at construction; a restart runs only this.
    // A stale PackBar here would be ticked every frame with its art already
    // destroyed along with the old scene's display list.
    this.bars = { a: null, b: null };
  }

  /** Re-enter the scene with a new round in hand. */
  private restart(next: Partial<BattleLauncher>): void {
    this.scene.restart({ ...this.launcher, ...next });
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadChampions(this);
    this.load.spritesheet("bone", packUrl("Enemy Pack/Gnoll/Gnoll_Bone.png"), { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet("hexbolt", packUrl("Enemy Pack/Hex Shaman/Hex Shaman_Projectile.png"), {
      frameWidth: 128,
      frameHeight: 128,
    });
    for (const [key, fx] of Object.entries(BLAST)) this.load.spritesheet(key, packUrl(fx.file), { frameWidth: 192, frameHeight: 192 });
    loadPanels(this, ["paper", "specialPaper", "blueButton", "redButton"]);
    this.load.image(
      "smallButton",
      packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Regular.png"),
    );
    this.load.spritesheet("arrow", packUrl("Units/Blue Units/Archer/Arrow.png"), {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("dust", packUrl(FX.dust.file), {
      frameWidth: FX.dust.frame,
      frameHeight: FX.dust.frame,
    });
    for (const cls of CHAMPIONS) this.load.image(`avatar_${cls}`, portraitUrl(cls));
    for (const n of Object.values(ICON)) this.load.image(iconKey(n), iconUrl(n));
  }

  create(): void {
    // Leaving the plan phase switches input off for its slide-out.
    this.input.enabled = true;
    fitCamera(this);
    prepareTerrain(this);
    makeAnims(this);
    if (!this.anims.exists("dust_anim")) {
      this.anims.create({
        key: "dust_anim",
        frames: this.anims.generateFrameNumbers("dust", { start: 0, end: FX.dust.frames - 1 }),
        frameRate: 16,
        repeat: 0,
        hideOnComplete: true,
      });
    }
    for (const [key, fx] of Object.entries(BLAST)) {
      if (this.anims.exists(`${key}_anim`)) continue;
      this.anims.create({
        key: `${key}_anim`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: fx.frames - 1 }),
        frameRate: 20,
        hideOnComplete: true,
      });
    }

    const board: Rect = {
      x0: ORIGIN_X - TILE / 2,
      y0: ORIGIN_Y - TILE / 2,
      x1: ORIGIN_X - TILE / 2 + BOARD_W,
      y1: ORIGIN_Y - TILE / 2 + BOARD_H,
    };

    buildWater(this);
    const island = buildIsland(this, ISLAND);
    buildFoam(this, island);
    scatterDecor(this, island, board, { w: GAME_W, h: GAME_H }, this.launcher.seed);
    this.drawGrid();
    driftClouds(this, { w: GAME_W, h: GAME_H }, this.launcher.seed);
    this.buildAdvisor();
    if (this.auto) this.buildHandbook();

    if (this.result) {
      this.beginBattle();
    } else if (this.auto && this.launcher.round) {
      // A round nobody could fight (an empty board) skips straight to its card.
      this.showRoundCard();
    } else if (this.auto) {
      this.buildPlan();
    } else {
      this.buildDraft();
    }
  }

  /** The handbook's button, beside the menu's while planning and in its place in a fight. A fight holds still while it is open. */
  private buildHandbook(): void {
    const auto = this.auto!;
    this.data.set("handbook", false);
    this.time.paused = false;
    this.handbook = new Handbook(this, () => auto.run().pool, (open) => {
      this.time.paused = open;
      if (open) this.tweens.pauseAll();
      else this.tweens.resumeAll();
    }, this.launcher.onTip);
    const x = this.result ? 58 : 130;
    const y = 52;
    const slideIn = this.result !== null;
    const face = this.add.image(0, 0, "smallButton").setScale(0.8);
    const mark = label(this, 0, -4, "?", { fontSize: "26px" });
    const btn = this.add.container(x, y, [face, mark]).setDepth(DEPTH.hud + 6);
    btn.setSize(face.displayWidth, face.displayHeight);
    if (slideIn) {
      btn.setX(130);
      this.tweens.add({ targets: btn, x, duration: 300, ease: "Quint.easeOut" });
    }
    // The menu gear's hover: sink, and the mark tips over the way the gear turns.
    // Only the sink is stopped, so a hover never strands the slide into the corner.
    let sinking: Phaser.Tweens.Tween | null = null;
    const sink = (on: number): void => {
      sinking?.stop();
      sinking = this.tweens.add({ targets: btn, y: y + on, duration: 140, ease: "Sine.easeInOut" });
    };
    const tilt = (angle: number): void => {
      this.tweens.killTweensOf(mark);
      this.tweens.add({ targets: mark, angle, duration: 240, ease: "Sine.easeOut" });
    };
    btn
      .setInteractive({ cursor: HAND })
      .on("pointerover", () => {
        sink(2);
        tilt(-14);
      })
      .on("pointerout", () => {
        sink(0);
        tilt(0);
      })
      .on("pointerdown", () => sink(3))
      .on("pointerup", () => {
        sink(0);
        tilt(0);
        this.handbook?.toggle();
      });
  }

  /** Skirmish's plan phase over the left half; the panel covers the enemy's. */
  private buildPlan(): void {
    const auto = this.auto!;
    this.drafting = true;
    this.draftBox = this.add.container(0, 0).setDepth(DEPTH.hud + 5);
    const zx = ORIGIN_X - TILE / 2;
    const zy = ORIGIN_Y - TILE / 2;
    this.plan = new AutoPlan({
      scene: this,
      box: this.draftBox,
      hooks: auto,
      cellAt: (x, y) => {
        const col = Math.floor((x - zx) / TILE);
        const row = Math.floor((y - zy) / TILE);
        return col >= 0 && col < COLS / 2 && row >= 0 && row < ROWS ? { col, row } : null;
      },
      standAt: (col, row) => this.spriteXY(col, row),
      say: (line) => this.say(line),
      remark: (line) => this.remark(line),
      onTip: this.launcher.onTip,
      fight: () => this.fightFromPlan(),
    });
    this.buildMenuButton();
    this.draftBox.setX(GAME_W);
    this.opening(() =>
      this.tweens.add({
        targets: this.draftBox,
        x: 0,
        duration: 460,
        ease: "Sine.easeOut",
        onComplete: () =>
          this.summonAdvisor(() => {
            const seat = auto.run().seats[0]!;
            this.say(
              seat.board.length === 0 && seat.bench.every((p) => p === null)
                ? "Buy units from the shop. Three of a kind make a 2-star."
                : "Set your line, then Fight.",
            );
          }),
      }),
    );
  }

  private fightFromPlan(): void {
    if (!this.drafting) return;
    const seat = this.auto!.run().seats[0]!;
    if (seat.board.length === 0 && seat.bench.some((p) => p !== null))
      return this.remark("Put someone on the board first.");
    this.drafting = false;
    this.input.enabled = false;
    this.launcher.onTip?.(null, 0, 0);
    const { result, foe, round } = this.auto!.fight();
    // Everything that belongs to planning leaves together; the board's units stay.
    const exit = 360;
    this.plan?.leave(exit * 0.6);
    const advisor = this.advisor;
    const fading = [this.menuBtn, this.bubble, advisor?.sprite, advisor?.shadow].filter((o) => o != null);
    this.tweens.add({ targets: fading, alpha: 0, duration: exit * 0.6, ease: "Quint.easeOut" });
    this.tweens.add({
      targets: this.draftBox,
      x: GAME_W,
      duration: exit,
      ease: "Quint.easeOut",
      onComplete: () => this.restart({ result, foe, round }),
    });
  }

  private showRoundCard(): void {
    const auto = this.auto!;
    roundCard(
      this,
      auto.run(),
      this.launcher.round!,
      () => this.restart({ result: null, round: null }),
      () => {
        auto.again();
        this.restart({ result: null, round: null });
      },
      () => {
        this.input.enabled = false;
        cloudCover(this, "close", () => this.launcher.onMenu());
      },
    );
  }

  /** Armies placed, HUD up, event log queued, count down. */
  private beginBattle(): void {
    const before = new Set(this.children.list);
    this.spawnArmies();
    this.buildHud();
    this.queue = [...this.result!.events].sort((x, y) => x.t - y.t);
    if (this.auto) {
      this.revealFoe(before, () => {
        this.summonAdvisor(() => {});
        this.runIntro();
      });
      return;
    }
    this.opening(() => {
      this.summonAdvisor(() => {});
      this.runIntro();
    });
  }

  /**
   * Skirmish arrives from its plan, where your line already stands: the enemy
   * rises in front line first, the HUD settles in from the edges, and only once
   * all of it can be read does the count begin.
   */
  private revealFoe(before: Set<Phaser.GameObjects.GameObject>, then: () => void): void {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const step = still ? 0 : 60;
    const rise = 280;
    const foes = [...this.units.values()]
      .filter((v) => v.snap.side !== this.mySide)
      .sort((a, b) => a.snap.col - b.snap.col || a.snap.row - b.snap.row);
    const mine = new Set<Phaser.GameObjects.GameObject>();
    for (const v of this.units.values()) if (v.snap.side === this.mySide) mine.add(v.sprite).add(v.shadow);
    const foeParts = new Set<Phaser.GameObjects.GameObject>();
    for (const v of foes) foeParts.add(v.sprite).add(v.shadow).add(v.pip);

    foes.forEach((v, i) => {
      const delay = 120 + i * step;
      const scale = v.sprite.scale;
      const shadowAlpha = v.shadow.alpha;
      v.sprite.setAlpha(0).setScale(still ? scale : scale * 0.94);
      v.shadow.setAlpha(0);
      v.pip.setAlpha(0);
      this.tweens.add({ targets: v.sprite, alpha: 1, scale, delay, duration: rise, ease: "Quint.easeOut" });
      this.tweens.add({ targets: v.pip, alpha: 1, delay, duration: rise, ease: "Quint.easeOut" });
      this.tweens.add({ targets: v.shadow, alpha: shadowAlpha, delay, duration: rise, ease: "Quint.easeOut" });
      if (still) return;
      this.time.delayedCall(delay, () => {
        const dust = this.add.sprite(v.sprite.x, v.sprite.y, "dust").setOrigin(0.5, 0.85).setScale(2.2).setAlpha(0.6);
        dust.setDepth(DEPTH.unit + v.sprite.y + 2).play("dust_anim");
      });
    });

    // The HUD, and your own pips, settle in from the edge they live on.
    const hud = this.children.list.filter((o) => !before.has(o) && !foeParts.has(o) && !mine.has(o));
    for (const o of hud) {
      const go = o as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle & { y: number };
      const alpha = go.alpha;
      const y = go.y;
      go.setAlpha(0);
      if (!still) go.y = y + (y < GAME_H / 2 ? -12 : 12);
      this.tweens.add({ targets: go, alpha, y, delay: 60, duration: 300, ease: "Quint.easeOut" });
    }

    // A beat to read the enemy army before the count.
    const done = 120 + Math.max(0, foes.length - 1) * step + rise;
    this.time.delayedCall(done + 300, then);
  }

  /**
   * The first open is under cloud: a bank covers the view, then parts from
   * the middle outward to show the board. Later rounds are the same island,
   * so they skip it and go straight on.
   */
  private opening(then: () => void): void {
    if (this.rounds > 0) return then();
    cloudCover(this, "open", then);
  }

  /** The advisor turns up in a puff of dust, the way placed units do. */
  private summonAdvisor(then: () => void): void {
    const { sprite, shadow } = this.advisor!;
    const dust = this.add
      .sprite(sprite.x, sprite.y, "dust")
      .setOrigin(0.5, 0.85)
      .setDepth(DEPTH.unit + sprite.y + 1)
      .setScale(2.4)
      .setAlpha(0.8);
    dust.play("dust_anim");
    dust.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => dust.destroy());
    shadow.setVisible(true).setAlpha(0);
    sprite.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: [sprite, shadow], alpha: 1, delay: 80, duration: 240, ease: "Sine.easeOut" });
    this.time.delayedCall(420, then);
  }

  // --- draft ---------------------------------------------------------------

  /**
   * Roster cards on a panel over the enemy half; clicks place on the left.
   *
   * The vertical budget is tight and worth writing down, because everything
   * here is spaced off it: the panel runs y 16..704, the twelve cards take
   * y 122..466, all six traits three rows under them, and the Lock in button cannot
   * go under ~104px tall without its nine-slice collapsing into a strip.
   */
  private buildDraft(): void {
    this.drafting = true;
    // Above the HUD too, so the slide-out sweeps across the plates.
    this.draftBox = this.add.container(0, 0).setDepth(DEPTH.hud + 5);

    const panel_ = panel(this, "paper", 900, 360, 576, 688);
    const band = ribbon(this, 900, 52, 380);
    const title = label(this, 900, 48, "DRAFT YOUR WARBAND", { fontSize: "20px" });
    this.goldText = label(this, 900, 90, "", {
      fontSize: "18px",
      color: "#7a4f14",
      strokeThickness: 0,
    });
    this.goldCoin = this.add.image(0, 90, iconKey(ICON.gold)).setScale(0.48);
    // What is wrong with the army, and only that; the how-to is the advisor's.
    this.errorText = label(this, 900, 112, "", {
      fontSize: "13px",
      color: "#8c3a30",
      strokeThickness: 0,
    });
    this.traitBox = this.add.container(0, 0);
    this.draftBox.add([panel_, band, title, this.goldText, this.goldCoin, this.errorText, this.traitBox]);

    for (const [i, cls] of ROSTER.entries()) {
      const cx = 900 + ((i % 4) - 1.5) * CARD.dx;
      const cy = CARD.y0 + Math.floor(i / 4) * CARD.dy;
      this.draftBox.add(this.buildCard(cls, cx, cy));
    }

    // The army goes to the server, which starts the fight the moment both
    // seats are locked - the deadline is a floor under a stalling opponent,
    // never something two ready players sit through.
    this.lockBtn = button(this, 1086, 630, 176, 104, "Lock in", "red", () => this.versus?.onLock());
    this.draftBox.add(this.lockBtn);
    this.buildLockBoard();

    // Clouds part, the roster slides in from the right (the way it goes
    // out), then the advisor turns up and starts talking.
    this.draftBox.setX(GAME_W);
    this.opening(() =>
      this.tweens.add({
        targets: this.draftBox,
        x: 0,
        duration: 460,
        ease: "Sine.easeOut",
        onComplete: () => this.summonAdvisor(() => this.advise()),
      }),
    );

    this.buildMenuButton();

    // A click on nothing clickable - the panel, the water, the sky - drops
    // the picked card. The grid and the cards are interactive, so they keep it.
    this.input.on("pointerdown", (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.drafting || over.length > 0 || !this.picked) return;
      this.picked = null;
      this.hoverCell(null);
      this.refreshDraft();
      this.advise();
    });

    // Own half only, and it is always the left half of the screen: the enemy
    // half sits under the panel whichever side of the engine you hold.
    const zx = ORIGIN_X - TILE / 2;
    const zy = ORIGIN_Y - TILE / 2;
    this.cellZone = this.add
      .zone(zx + (COLS / 2) * (TILE / 2), zy + BOARD_H / 2, (COLS / 2) * TILE, BOARD_H)
      .setInteractive();
    const cellAt = (p: Phaser.Input.Pointer): { battle: number; row: number } | null => {
      const screenCol = Math.floor((p.worldX - zx) / TILE);
      const row = Math.floor((p.worldY - zy) / TILE);
      if (screenCol < 0 || screenCol >= COLS / 2 || row < 0 || row >= ROWS) return null;
      // Screen column to battle column. For side A that is the identity.
      return { battle: this.mirrored ? COLS - 1 - screenCol : screenCol, row };
    };
    this.ghostCell = this.add.graphics().setDepth(DEPTH.ground + 1);
    this.cellZone
      .on("pointermove", (p: Phaser.Input.Pointer) => this.hoverCell(cellAt(p)))
      .on("pointerout", () => this.hoverCell(null))
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        const c = cellAt(p);
        if (!c) return;
        this.toggleCell(this.myCol(c.battle), c.row);
        this.hoverCell(c);
      });

    // The first nine cards' hotkeys, 1 to 9.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const cls = ROSTER[Number(e.key) - 1];
      if (this.drafting && cls) this.pick(cls);
    });

    this.refreshDraft();
  }

  /**
   * One roster card, the shop card's look at 120x120: portrait and price,
   * health and damage beside it, then name, trait and skill. The whole rule
   * set is the card's tooltip, the one Skirmish's shop shows.
   */
  private buildCard(cls: Champion, cx: number, cy: number): Phaser.GameObjects.Container {
    const stats = BALANCE.units[cls];
    const ink = { strokeThickness: 0 };
    const face = this.add.graphics();
    const [x0, y0, x1, y1] = PORTRAIT_INK[cls];
    const portrait = this.add
      .image(-30, -24, `avatar_${cls}`)
      .setOrigin((x0 + x1) / 2 / 256, (y0 + y1) / 2 / 256)
      .setScale(46 / Math.max(x1 - x0, y1 - y0));
    const cost = label(this, 50, -42, `${stats.cost}`, { fontSize: "17px", ...ink }).setOrigin(1, 0.5);
    const coin = this.add.image(50 - cost.width - 12, -42, iconKey(ICON.gold)).setScale(0.36);
    const stat = (y: number, icon: string, value: number): [Phaser.GameObjects.Image, Phaser.GameObjects.Text] => [
      this.add.image(14, y, iconKey(icon)).setScale(0.26),
      label(this, 50, y, `${value}`, { fontSize: "13px", ...ink }).setOrigin(1, 0.5),
    ];
    const hp = stat(-20, ICON.hp, stats.hp);
    const hit = stats.heal > 0 ? stat(-2, ICON.heal, stats.heal) : stat(-2, ICON.damage, stats.damage);
    const name = label(this, 0, 16, CLASS_NAME[cls], { fontSize: "14px", ...ink });
    const trait = label(this, 0, 33, AUTO.traits[traitOf(cls)].name, { fontSize: "12px", ...ink });
    const skill = label(this, 5, 49, skillName(cls), { fontSize: "12px", ...ink });
    const gem = this.add
      .rectangle(5 - skill.width / 2 - 8, 49, 6, 6, 0xe0b64f)
      .setStrokeStyle(1.2, 0x7a4f14)
      .setAngle(45);

    const box = this.add.container(cx, cy, [face, portrait, coin, cost, ...hp, ...hit, name, trait, gem, skill]);
    box.setSize(CARD.w, CARD.h);
    const card: DraftCard = { box, cy, face, name, stats: [hp[1], hit[1]], cost, trait, skill, portrait };
    const tip = (p: Phaser.Input.Pointer): void => {
      const e = p.event as MouseEvent | undefined;
      this.launcher.onTip?.(unitTip(cls, stats.cost), e?.clientX ?? 0, e?.clientY ?? 0);
    };
    box
      .setInteractive({ cursor: HAND })
      .on("pointerup", () => this.pick(cls))
      .on("pointerover", (p: Phaser.Input.Pointer) => {
        tip(p);
        this.liftCard(card, true);
      })
      .on("pointermove", tip)
      .on("pointerout", () => {
        this.launcher.onTip?.(null, 0, 0);
        this.refreshDraft();
      });
    this.cards.set(cls, card);
    return box;
  }

  /**
   * Left of the Lock in button: who has locked, and the clock. The opponent's
   * name also hangs on a banner over your half, the way the HUD names them in
   * the fight.
   */
  private buildLockBoard(): void {
    const ink = { fontSize: "15px", color: "#4a3a28", strokeThickness: 0 };
    const row = (y: number, who: string) => ({
      seal: this.add.graphics({ x: 656, y }),
      name: label(this, 672, y, who, ink).setOrigin(0, 0.5),
      state: label(this, 900, y, "", { ...ink, fontSize: "13px" }).setOrigin(1, 0.5),
    });
    const you = row(604, "You");
    const them = row(636, "");
    const clock = label(this, 950, 618, "", { fontSize: "28px", color: "#7a4f14", strokeThickness: 0 });
    const flag = ribbon(this, 340, 52, 400, 0.8);
    const banner = label(this, 340, 50, "", { fontSize: "18px" });
    this.draftBox.add([you.seal, you.name, you.state, them.seal, them.name, them.state, clock, flag, banner]);
    this.lockBoard = {
      seals: { you: you.seal, them: them.seal },
      names: { you: you.name, them: them.name },
      states: { you: you.state, them: them.state },
      clock,
      banner,
      // True so the first refresh draws both seals open.
      seen: { you: true, them: true, second: null },
    };
  }

  private drawSeal(g: Phaser.GameObjects.Graphics, locked: boolean): void {
    g.clear();
    if (!locked) {
      g.lineStyle(2, 0xa8987c, 1).strokeCircle(0, 0, 8);
      return;
    }
    g.fillStyle(0xe0b64f, 1).fillCircle(0, 0, 9);
    g.lineStyle(1.5, 0x7a4f14, 1).strokeCircle(0, 0, 9);
    g.lineStyle(2.5, 0x3d3123, 1).beginPath();
    g.moveTo(-4, 0);
    g.lineTo(-1, 3.5);
    g.lineTo(4.5, -3.5);
    g.strokePath();
  }

  /**
   * Versus's own half of the draft screen, read straight off the room every
   * frame. No events and no handle into the scene: the poll owns the truth
   * and this just renders whatever it last said.
   */
  private refreshVersus(): void {
    const versus = this.versus;
    const board = this.lockBoard;
    if (!versus || !board) return;
    const st = versus.status();

    // The result arriving is the signal to play it. Restarting with it in
    // hand runs the same playback path Skirmish does.
    if (st.battle) {
      this.versus = null;
      this.restart({ result: st.battle });
      return;
    }

    const them = st.opponent ?? "Opponent";
    board.names.them.setText(them.length > 14 ? `${them.slice(0, 13)}.` : them);
    board.banner.setText(`YOU  VS  ${them.toUpperCase()}`);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    for (const seat of ["you", "them"] as const) {
      const locked = seat === "you" ? st.youLocked : st.theyLocked;
      board.states[seat].setText(locked ? "locked in" : "drafting...").setColor(locked ? "#2f5d8a" : "#9a8a70");
      if (locked === board.seen[seat]) continue;
      board.seen[seat] = locked;
      this.drawSeal(board.seals[seat], locked);
      if (locked && !still) {
        board.seals[seat].setScale(1.8);
        this.tweens.add({ targets: board.seals[seat], scale: 1, duration: 320, ease: "Back.easeOut" });
      }
      if (locked && seat === "them" && !st.youLocked) this.remark(`${them} is locked in.`);
    }

    // The clock: red and ticking in the last ten seconds.
    const second = st.msRemaining === null ? null : Math.ceil(st.msRemaining / 1000);
    if (second !== board.seen.second) {
      board.seen.second = second;
      const urgent = second !== null && second <= 10;
      board.clock.setText(second === null ? "" : `${second}s`).setColor(urgent ? "#b0443a" : "#7a4f14");
      if (urgent && !still) {
        board.clock.setScale(1.25);
        this.tweens.add({ targets: board.clock, scale: 1, duration: 260, ease: "Quint.easeOut" });
      }
    }

    // Locked means locked: the army on the server is the one that fights.
    if (st.youLocked && this.lockBtn?.input?.enabled) {
      this.lockBtn.disableInteractive();
      this.lockBtn.setAlpha(0.55);
      (this.lockBtn.list[1] as Phaser.GameObjects.Text).setText("Locked");
      this.cellZone.disableInteractive();
      this.picked = null;
      this.hoverCell(null);
      this.refreshDraft();
    }
    if (st.youLocked) this.say(st.theyLocked ? "Both locked in. To battle!" : `Locked in. Waiting for ${them}.`);
  }

  /**
   * The battle's resident: an advisor pawn that ambles around the island's
   * top-left corner. Lives outside the draft box, so when the roster slides
   * away it is only the bubble that leaves - the pawn stays for the fight.
   */
  private buildAdvisor(): void {
    const shadow = addShadow(this, ADVISOR_HOME.x, ADVISOR_HOME.y, 0.5);
    const pawn = this.add.sprite(
      ADVISOR_HOME.x,
      ADVISOR_HOME.y,
      unitKey(this.mySide, "pawn", "idle"),
    );
    playPose(pawn, this.mySide, "pawn", "idle", this.mirrored);
    pawn.setDepth(DEPTH.unit + ADVISOR_HOME.y);
    // Hidden until summonAdvisor brings it in.
    pawn.setVisible(false);
    shadow.setVisible(false);
    this.advisor = { sprite: pawn, shadow, target: null, pauseMs: 900 };
  }

  /**
   * The kit's small square button with its gear, top-left over the water,
   * clear of the board and the roster. Drafting only: mid-fight the way out
   * is the result card. Leaving closes the clouds first, the same exit the
   * title screen takes.
   */
  private buildMenuButton(): void {
    const x = 58;
    const y = 52;
    const face = this.add.image(0, 0, "smallButton").setScale(0.8);
    const gear = this.add.image(0, -3, iconKey(ICON.settings)).setScale(0.5);
    const btn = this.add.container(x, y, [face, gear]).setDepth(DEPTH.hud + 6);
    btn.setSize(face.displayWidth, face.displayHeight);
    const sink = (on: number): void => {
      this.tweens.killTweensOf(btn);
      this.tweens.add({ targets: btn, y: y + on, duration: 140, ease: "Sine.easeInOut" });
    };
    btn
      .setInteractive({ cursor: HAND })
      .on("pointerover", () => {
        sink(2);
        this.tweens.add({ targets: gear, angle: 45, duration: 240, ease: "Sine.easeOut" });
      })
      .on("pointerout", () => {
        sink(0);
        this.tweens.add({ targets: gear, angle: 0, duration: 240, ease: "Sine.easeOut" });
      })
      .on("pointerdown", () => sink(3))
      .on("pointerup", () => {
        if (!this.drafting) return;
        this.drafting = false;
        this.input.enabled = false;
        this.launcher.onTip?.(null, 0, 0);
        cloudCover(this, "close", () => this.launcher.onMenu());
      });
    this.menuBtn = btn;
  }

  private cardName(cls: Champion): string {
    return CLASS_NAME[cls];
  }

  private copies(cls: Champion): number {
    return this.draftArmy.filter((p) => p.class === cls).length;
  }

  /** "Two Trolls is the limit." */
  private capLine(cls: Champion): string {
    const name = CLASS_NAME[cls];
    const many = name.endsWith("f") ? `${name.slice(0, -1)}ves` : `${name}s`;
    return `${VERSUS.maxCopies === 2 ? "Two" : VERSUS.maxCopies} ${many} is the limit.`;
  }

  private pick(cls: Champion): void {
    if (!this.cellZone.input?.enabled) return;
    if (this.copies(cls) >= VERSUS.maxCopies) {
      this.remark(this.capLine(cls));
      return;
    }
    if (BALANCE.units[cls].cost > VERSUS.budget - armyCost(this.draftArmy)) {
      this.remark("Not enough gold.");
      return;
    }
    this.picked = cls;
    this.refreshDraft();
    this.advise();
  }

  /** What the advisor says for the draft as it stands:
   *  one short line for the next step, not the whole manual at once. */
  private advise(): void {
    const next = !this.picked
      ? "Pick a unit from the cards."
      : this.draftArmy.length === 0
        ? `Click a tile on your side to place the ${this.cardName(this.picked)}.`
        : "Click a unit to send it back. Lock in when ready.";
    this.say(next);
  }

  /** A passing remark, then back to the advice. */
  private remark(line: string): void {
    this.say(line);
    this.adviceTimer?.remove();
    this.adviceTimer = this.time.delayedCall(1800, () => this.advise());
  }

  /**
   * A speech bubble above the advisor, redrawn per line. It pops out of its
   * tail and the words type in, so each new line reads as the pawn talking.
   * Built around the pawn's feet at (0, 0) and moved whole to follow it.
   */
  private say(line: string): void {
    if (!this.drafting || line === this.bubbleLine) return;
    this.bubbleLine = line;
    this.bubble?.destroy();

    const text = label(this, 0, 0, "", {
      fontSize: "13px",
      color: "#52412e",
      strokeThickness: 0,
      align: "left",
      wordWrap: { width: 220 },
    }).setOrigin(0, 0);
    // Wrap once up front: wrapping a half-typed line moves words mid-type.
    const full = text.getWrappedText(line).join("\n");
    text.setWordWrapWidth(null).setText(full);

    const bw = Math.ceil(text.width) + 28;
    const bh = Math.ceil(text.height) + 20;
    const r = 12;
    const bx = 12;
    const bottom = -96;
    const by = bottom - bh;
    const la = bx + 20;
    const ra = bx + 36;
    const tipX = 4;
    const tipY = -74;

    // Paper and ink over a soft drop shadow. The fill is the union of the
    // rounded rect and the tail, and one stroke runs around the whole
    // outline, so no border crosses the tail's mouth.
    const FILL = 0xf2e7cf;
    const INK = 0x3d3123;
    const g = this.add.graphics();
    const pass = (oy: number, fill: number, alpha: number, stroke: boolean): void => {
      g.fillStyle(fill, alpha);
      g.fillRoundedRect(bx, by + oy, bw, bh, r);
      g.fillTriangle(la, bottom + oy, ra, bottom + oy, tipX, tipY + oy);
      if (!stroke) return;
      g.lineStyle(3, INK, 1);
      g.beginPath();
      g.moveTo(la, bottom + oy);
      g.lineTo(bx + r, bottom + oy);
      g.arc(bx + r, bottom - r + oy, r, Math.PI / 2, Math.PI);
      g.lineTo(bx, by + r + oy);
      g.arc(bx + r, by + r + oy, r, Math.PI, Math.PI * 1.5);
      g.lineTo(bx + bw - r, by + oy);
      g.arc(bx + bw - r, by + r + oy, r, Math.PI * 1.5, Math.PI * 2);
      g.lineTo(bx + bw, bottom - r + oy);
      g.arc(bx + bw - r, bottom - r + oy, r, 0, Math.PI / 2);
      g.lineTo(ra, bottom + oy);
      g.lineTo(tipX, tipY + oy);
      g.closePath();
      g.strokePath();
    };
    pass(4, 0x2e2417, 0.18, false);
    pass(0, FILL, 1, true);
    text.setPosition(bx + 14, by + 10).setText("");

    const at = this.advisor?.sprite ?? ADVISOR_HOME;
    // Scaled about the pawn's feet, so the pop grows out of the tail.
    const bubble = this.add.container(at.x, at.y, [g, text]).setScale(0.6).setAlpha(0);
    this.bubble = bubble;
    this.draftBox.add(bubble);
    this.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 170, ease: "Back.easeOut" });
    let shown = 0;
    this.time.addEvent({
      delay: 22,
      repeat: full.length - 1,
      callback: () => {
        if (bubble.active) text.setText(full.slice(0, ++shown));
      },
    });
  }

  /** Stand a while, pick a nearby patch, amble there, idle again. */
  private tickAdvisor(delta: number): void {
    const a = this.advisor;
    if (!a?.sprite.visible) return;
    const s = a.sprite;
    if (!a.target) {
      a.pauseMs -= delta;
      if (a.pauseMs > 0) return;
      for (let tries = 0; tries < 8; tries++) {
        const x = ADVISOR_AREA.x0 + Math.random() * (ADVISOR_AREA.x1 - ADVISOR_AREA.x0);
        const y = ADVISOR_AREA.y0 + Math.random() * (ADVISOR_AREA.y1 - ADVISOR_AREA.y0);
        if (Math.hypot(x - s.x, y - s.y) < 28) continue;
        a.target = { x, y };
        break;
      }
      if (!a.target) return;
      playPose(s, this.mySide, "pawn", "run", this.mirrored);
    }
    const dx = a.target.x - s.x;
    const dy = a.target.y - s.y;
    const dist = Math.hypot(dx, dy);
    const step = (ADVISOR_SPEED * delta) / 1000;
    if (dist <= step) {
      s.setPosition(a.target.x, a.target.y);
      a.target = null;
      a.pauseMs = 1400 + Math.random() * 2600;
      playPose(s, this.mySide, "pawn", "idle", this.mirrored);
    } else {
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
      // The art faces right; face the way it walks, as the units do.
      if (Math.abs(dx) > 0.5) s.setFlipX(dx < 0);
    }
    a.shadow.setPosition(s.x, s.y);
    s.setDepth(DEPTH.unit + s.y);
    this.bubble?.setPosition(s.x, s.y);
  }

  /** The old CSS translateY transition, as a tween. */
  private liftCard(card: DraftCard, up: boolean): void {
    this.tweens.killTweensOf(card.box);
    this.tweens.add({
      targets: card.box,
      y: card.cy - (up ? 4 : 0),
      duration: 140,
      ease: "Sine.easeInOut",
    });
  }

  /** Whether one more of this class still fits the gold and the unit cap. */
  private fits(cls: Champion): boolean {
    return (
      armyCost([...this.draftArmy, { class: cls, col: 0, row: 0 }]) <= VERSUS.budget &&
      this.copies(cls) < VERSUS.maxCopies &&
      this.draftArmy.length < BALANCE.board.maxUnits
    );
  }

  /**
   * Build placement: the picked unit, see-through, on the cell under the
   * cursor, on a green cell where it can go and a red one where it cannot.
   * A cell that already holds a unit goes red too: clicking it removes.
   */
  private hoverCell(c: { battle: number; row: number } | null): void {
    this.ghostCell.clear();
    this.ghost?.setVisible(false);
    if (!c || !this.drafting || !this.cellZone.input?.enabled) return;
    const taken = this.placed.has(`${this.myCol(c.battle)},${c.row}`);
    if (!taken && !this.picked) return;
    const ok = !taken && this.fits(this.picked!);
    const color = ok ? 0x86d15e : 0xd9544a;
    const { x, y } = this.tileXY(c.battle, c.row);
    const w = TILE - 6;
    this.ghostCell
      .fillStyle(color, 0.22)
      .fillRect(x - w / 2, y - w / 2, w, w)
      .lineStyle(2, color, 0.75)
      .strokeRect(x - w / 2, y - w / 2, w, w);
    if (taken) return;

    const at = this.spriteXY(c.battle, c.row);
    this.ghost ??= this.add.sprite(0, 0, unitKey(this.mySide, this.picked!, "idle")).setAlpha(0.55);
    playPose(this.ghost, this.mySide, this.picked!, "idle", this.mirrored);
    this.ghost.setScale(bodyScale(this.picked!)).setPosition(at.x, at.y).setDepth(DEPTH.unit + at.y).setVisible(true);
    if (ok) this.ghost.clearTint();
    else this.ghost.setTint(0xff7a7a);
  }

  private toggleCell(col: number, row: number): void {
    const key = `${col},${row}`;
    const existing = this.placed.get(key);
    if (existing) {
      existing.sprite.destroy();
      existing.shadow.destroy();
      this.placed.delete(key);
      this.draftArmy = this.draftArmy.filter((p) => !(p.col === col && p.row === row));
    } else {
      if (this.picked === null) return;
      const next: Placement[] = [...this.draftArmy, { class: this.picked, col, row }];
      if (next.length > BALANCE.board.maxUnits) return this.remark("No room for more.");
      if (armyCost(next) > VERSUS.budget) return this.remark("Not enough gold.");
      if (this.copies(this.picked) >= VERSUS.maxCopies) return this.remark(this.capLine(this.picked));
      this.draftArmy = next;
      const { x, y } = this.spriteXY(this.myCol(col), row);
      const shadow = teamShadow(addShadow(this, x, y, this.picked === "lancer" ? 0.8 : 0.62), this.mySide, this.picked);
      // Summon, not spawn: a dust cloud covering the troop first, the unit
      // fading in inside it as the cloud breaks apart. The 64px puff reads
      // at 3x to blanket a 192px frame; 0.8 alpha keeps it from looking
      // like the death cloud's twin.
      const dust = this.add
        .sprite(x, y, "dust")
        .setOrigin(0.5, 0.85)
        .setDepth(DEPTH.unit + y + 1)
        .setScale(3)
        .setAlpha(0.8);
      dust.play("dust_anim");
      this.tweens.add({
        targets: dust,
        alpha: 0,
        duration: (FX.dust.frames / 16) * 1000,
      });
      const sprite = this.add.sprite(x, y, unitKey(this.mySide, this.picked, "idle"));
      playPose(sprite, this.mySide, this.picked, "idle", this.mirrored);
      sprite.setDepth(DEPTH.unit + y).setScale(bodyScale(this.picked));
      sprite.setAlpha(0);
      this.tweens.add({
        targets: sprite,
        alpha: 1,
        duration: 220,
        delay: 80,
        ease: "Sine.easeOut",
      });
      this.placed.set(key, { sprite, shadow });
      // The last copy allowed puts the card down, so the cursor stops offering it.
      if (this.copies(this.picked) >= VERSUS.maxCopies) {
        const line = this.capLine(this.picked);
        this.picked = null;
        this.hoverCell(null);
        this.versus?.onArmyChange(this.draftArmy);
        this.refreshDraft();
        return this.remark(line);
      }
    }
    this.versus?.onArmyChange(this.draftArmy);
    this.refreshDraft();
    this.advise();
  }

  private refreshDraft(): void {
    const gold = VERSUS.budget - armyCost(this.draftArmy);
    this.goldText.setText(`${gold} of ${VERSUS.budget} gold left    ${this.draftArmy.length}/${BALANCE.board.maxUnits} units`);
    this.goldCoin.setX(900 - this.goldText.width / 2 - 20);
    if (gold !== this.shownGold) {
      this.shownGold = gold;
      this.goldText.setScale(1.12);
      this.tweens.add({ targets: this.goldText, scale: 1, duration: 220, ease: "Quint.easeOut" });
    }
    this.errorText.setText(validateArmy(this.draftArmy, VERSUS.budget, VERSUS.board, VERSUS.maxCopies)[0] ?? "");
    const traits = traitsOf(this.draftArmy).sort((a, b) => b.tier - a.tier || b.count - a.count);
    const active = new Set(traits.flatMap((t) => (t.tier >= 0 ? [t.key] : [])));
    const locked = !this.cellZone.input?.enabled;
    for (const [cls, card] of this.cards) {
      const picked = cls === this.picked;
      const ink = picked ? CARD_INK.slate : CARD_INK.paper;
      const cost = BALANCE.units[cls].cost;
      // Out of reach reads as a greyed face and a red price, still legible.
      // At the copy cap a card greys the same way, though its price stays legible.
      const capped = this.copies(cls) >= VERSUS.maxCopies;
      const afford = cost <= gold && !locked && !capped;
      card.face
        .clear()
        .fillStyle(picked ? 0x2b3442 : 0xf2e7cf, 1)
        .fillRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 10)
        .lineStyle(4, TIER_INK[cost]!, 1)
        .strokeRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 10);
      card.name.setColor(ink.name);
      for (const t of card.stats) t.setColor(ink.text);
      card.skill.setColor(ink.skill);
      card.trait.setColor(active.has(traitOf(cls)) ? ink.on : ink.off);
      card.cost.setColor(cost <= gold || picked ? ink.cost : "#b0443a");
      if (afford || picked) card.portrait.clearTint();
      else card.portrait.setTint(0x8a8a8a);
      card.box.setAlpha(afford || picked ? 1 : 0.8);
      this.liftCard(card, picked);
    }

    // The trait tracker Skirmish's plan shows; a Versus army reaches six at most.
    this.traitBox.removeAll(true);
    if (traits.length === 0) {
      this.traitBox.add(
        label(this, 900, 520, "Two or more of a class on the board switch on its trait.", {
          fontSize: "13px",
          color: "#9a8a70",
          strokeThickness: 0,
        }),
      );
    }
    for (const [k, t] of traits.entries()) {
      const row = traitRow(this, t, 652 + (k % 2) * 268 + 128, 488 + Math.floor(k / 2) * 33);
      row
        .on("pointerover", (p: Phaser.Input.Pointer) => {
          const e = p.event as MouseEvent | undefined;
          this.launcher.onTip?.(traitTip(t.key), e?.clientX ?? 0, e?.clientY ?? 0);
        })
        .on("pointerout", () => this.launcher.onTip?.(null, 0, 0));
      this.traitBox.add(row);
    }
  }

  /** Both armies are already placed, so the count is all that is needed. */
  private runIntro(): void {
    const foe = this.versus?.status().opponent;
    // Versus opens on who you face.
    const steps = [...(foe ? [`VS ${foe.toUpperCase()}`] : []), "3", "2", "1", "FIGHT"];
    let i = 0;

    // A veil so the count reads over the armies without hiding them. As wide
    // as the water, so it covers the whole page, not just the world rect.
    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, WATER_SPAN.w, WATER_SPAN.h, 0x0a1018, 0.42)
      .setDepth(DEPTH.hud + 19);

    const beat = (): void => {
      const last = i === steps.length - 1;
      const tag = label(this, MID_X, MID_Y, steps[i]!, {
        fontSize: last ? "62px" : steps[i]!.length > 1 ? "48px" : "92px",
        color: last ? "#f4cf6b" : "#fdf6e6",
        stroke: "#1c2634",
        strokeThickness: 10,
      })
        .setDepth(DEPTH.hud + 21)
        .setScale(0.55)
        .setAlpha(0);

      this.tweens.add({ targets: tag, scale: 1, alpha: 1, duration: 150, ease: "Back.easeOut" });
      this.tweens.add({
        targets: tag,
        scale: last ? 2.1 : 1.5,
        alpha: 0,
        delay: 460,
        duration: 260,
        onComplete: () => tag.destroy(),
      });

      if (last) {
        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 380,
          onComplete: () => veil.destroy(),
        });
      }

      i += 1;
      if (i < steps.length) this.time.delayedCall(680, beat);
      else this.time.delayedCall(520, () => (this.started = true));
    };

    beat();
  }

  update(_time: number, delta: number): void {
    // Pips and shadows ride along while the sprite tweens.
    for (const view of this.units.values()) {
      if (!view.alive) continue;
      view.shadow.setPosition(view.sprite.x, view.sprite.y);
      if (view.shownHp !== view.hp) {
        const step = (view.hp - view.shownHp) * Math.min(1, delta / 110);
        view.shownHp = Math.abs(view.hp - view.shownHp) < 0.4 ? view.hp : view.shownHp + step;
      }
      this.drawPip(view);
    }
    for (const bar of [this.bars.a, this.bars.b]) bar?.tick(delta);
    this.tickAdvisor(delta);

    if (this.drafting) {
      this.refreshVersus();
      return;
    }
    if (!this.started || this.finished || this.handbook?.open) return;
    this.simTime += delta * this.speed;
    const tick = Math.floor(this.simTime / TICK_MS);
    this.clockText?.setText(timeLeft(this.simTime));
    while (this.nextEvent < this.queue.length && this.queue[this.nextEvent]!.t <= tick) {
      this.play(this.queue[this.nextEvent]!);
      this.nextEvent += 1;
    }
    if (this.nextEvent >= this.queue.length) {
      this.finished = true;
      // Let the last death land before the result card.
      this.time.delayedCall(800 / this.speed, () => this.showResult());
    }
  }

  // --- board ---------------------------------------------------------------

  /** The true cell centre. Events carry battle-grid coordinates directly. */
  /** Takes a battle column, 0 on the far left of the shared 10-wide board. */
  private tileXY(col: number, row: number): { x: number; y: number } {
    const c = this.mirrored ? COLS - 1 - col : col;
    return { x: ORIGIN_X + c * TILE, y: ORIGIN_Y + row * TILE };
  }

  /** Your own half's column, in the shared board's coordinates. */
  private myCol(col: number): number {
    return battleCol(this.mySide, col, COLS / 2);
  }

  /** Where a sprite actually renders: the cell centre, nudged down to balance its height. */
  private spriteXY(col: number, row: number): { x: number; y: number } {
    const { x, y } = this.tileXY(col, row);
    return { x, y: y + SPRITE_NUDGE };
  }

  private drawGrid(): void {
    const g = this.add.graphics().setDepth(DEPTH.ground);
    const inset = 3;
    const w = TILE - inset * 2;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = this.tileXY(col, row);
        // Shade your own half. It always draws on the left, because the board
        // is mirrored for whoever holds side B.
        const mine = (this.mySide === "a") === col < COLS / 2;
        g.fillStyle(mine ? 0x2f4f2a : 0x4a3327, mine ? 0.16 : 0.13);
        g.fillRect(x - w / 2, y - w / 2, w, w);
        g.lineStyle(1.5, 0x1f2a18, 0.32);
        g.strokeRect(x - w / 2, y - w / 2, w, w);
      }
    }
    // Where the two front columns meet.
    g.lineStyle(2, 0xe0b64f, 0.24);
    g.beginPath();
    g.moveTo(MID_X, ISLAND.y0 + 24);
    g.lineTo(MID_X, ISLAND.y1 - 24);
    g.strokePath();
  }

  // --- views ---------------------------------------------------------------

  private spawnArmies(): void {
    for (const snap of this.result!.units) {
      const { x, y } = this.spriteXY(snap.col, snap.row);
      const scale = this.starScale(snap.stars);
      const shadow = teamShadow(addShadow(this, x, y, (snap.class === "lancer" ? 0.8 : 0.62) * scale), snap.side, snap.class);
      const sprite = this.add.sprite(x, y, unitKey(snap.side, snap.class, "idle"));
      playPose(sprite, snap.side, snap.class, "idle", this.mirrored);
      sprite.setDepth(DEPTH.unit + y).setScale(scale * bodyScale(snap.class));

      const pip = this.add.graphics().setDepth(DEPTH.unit + y + 1);
      const view: UnitView = {
        snap,
        sprite,
        shadow,
        pip,
        alive: true,
        hp: snap.maxHp,
        shownHp: snap.maxHp,
        slash: 1,
        settle: null,
        floats: 0,
        skillAt: AUTO.skills[snap.class].first * BALANCE.tickRate,
        skillSpan: (AUTO.skills[snap.class].first || AUTO.skills[snap.class].cooldown) * BALANCE.tickRate,
      };

      // Attacks are one-shots; back to idle when they finish.
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (view.alive) playPose(sprite, snap.side, snap.class, "idle", this.mirrored);
      });
      this.units.set(snap.id, view);
    }
  }

  /**
   * Hand-drawn: the pack bar needs two 64px caps, so it cannot go narrower
   * than ~128px, far too wide for an 84px cell.
   */
  /** Stars show as size too, a tenth bigger a star. */
  private starScale(stars: number | undefined): number {
    return 1 + 0.1 * ((stars ?? 1) - 1);
  }

  private drawPip(view: UnitView): void {
    const w = 38;
    const h = 5;
    const x = view.sprite.x - w / 2;
    const y = view.sprite.y - this.headHeight(view.snap.class, view.snap.side) * this.starScale(view.snap.stars) - 12;
    const frac = Math.max(0, view.shownHp / view.snap.maxHp);
    // A bar is coloured by health, not by team: green, then yellow, then
    // red. The bodies already say whose unit it is.
    const color = frac > 0.6 ? 0x6fcf4f : frac > 0.3 ? 0xe8c547 : 0xd9544a;
    view.pip.clear();
    view.pip.fillStyle(0x1a1208, 0.85).fillRect(x - 1, y - 1, w + 2, h + 2);
    view.pip.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * frac), h);
    view.pip.fillStyle(0xffffff, 0.25).fillRect(x, y, Math.max(0, w * frac), 1);
    // The skill's countdown under the health: it drains, and empty means armed.
    const sy = y + h + 2;
    const left = Math.max(0, view.skillAt * TICK_MS - this.simTime) / (view.skillSpan * TICK_MS);
    view.pip.fillStyle(0x1a1208, 0.85).fillRect(x - 1, sy - 1, w + 2, 5);
    if (left > 0) view.pip.fillStyle(0x5fa8ff, 1).fillRect(x, sy, w * Math.min(1, left), 3);
    else view.pip.fillStyle(0xbfe0ff, 0.45 + 0.35 * Math.sin(this.time.now / 140)).fillRect(x, sy, w, 3);
    drawStars(view.pip, view.sprite.x, y - 9, view.snap.stars, 4);
    view.pip.setDepth(DEPTH.unit + view.sprite.y + 1);
  }

  private view(id: string): UnitView {
    return this.units.get(id)!;
  }

  private sideHp(side: Side): number {
    let hp = 0;
    for (const v of this.units.values()) if (v.snap.side === side && v.alive) hp += v.hp;
    return hp;
  }

  private sideMax(side: Side): number {
    let hp = 0;
    for (const v of this.units.values()) if (v.snap.side === side) hp += v.snap.maxHp;
    return hp;
  }

  private sideAlive(side: Side): number {
    let n = 0;
    for (const v of this.units.values()) if (v.snap.side === side && v.alive) n += 1;
    return n;
  }

  // --- hud -----------------------------------------------------------------

  private buildHud(): void {
    const roster = (side: Side): string => {
      const counts = new Map<Champion, number>();
      for (const v of this.units.values()) {
        if (v.snap.side !== side) continue;
        counts.set(v.snap.class, (counts.get(v.snap.class) ?? 0) + 1);
      }
      return [...counts].map(([c, n]) => `${n} ${CLASS_NAME[c]}`).join("  ");
    };

    // Yours along the bottom, theirs along the top, count label trailing
    // outward from the bar. Which engine side that is depends on the seat.
    const BAR_W = 650;
    const mine = this.mySide;
    const foe: Side = mine === "a" ? "b" : "a";
    const foeName = this.launcher.foe ?? this.versus?.status().opponent ?? "THE GREY HOST";

    const topY = 58;
    // Fixed, not off the island: Skirmish's runs to the screen edge.
    const EDGE = 90;
    const foeX = GAME_W - EDGE - BAR_W / 2;
    ribbon(this, foeX, topY, BAR_W, 0.8).setDepth(DEPTH.hud);
    label(this, foeX, topY - 2, `${foeName.toUpperCase()}   ${roster(foe)}`, {
      fontSize: "17px",
    }).setDepth(DEPTH.hud + 2);
    this.bars[foe] = new PackBar(this, foeX, topY + 44, BAR_W, 0.75, 0xd9544a, DEPTH.hud + 1);

    const bottomY = 606;
    const myX = EDGE + BAR_W / 2;
    ribbon(this, myX, bottomY - 34, BAR_W, 0.8).setDepth(DEPTH.hud);
    label(this, myX, bottomY - 36, `YOUR WARBAND   ${roster(mine)}`, {
      fontSize: "17px",
    }).setDepth(DEPTH.hud + 2);
    this.bars[mine] = new PackBar(this, myX, bottomY + 14, BAR_W, 0.75, 0x86d15e, DEPTH.hud + 1);

    // The kit small square button is a single image, not a nine-slice.
    const speedBtn = this.add
      .image(GAME_W - 70, bottomY, "smallButton")
      .setScale(0.8)
      .setDepth(DEPTH.hud + 1)
      .setInteractive({ cursor: HAND });
    const speedText = label(this, GAME_W - 70, bottomY - 4, "1x", { fontSize: "17px" }).setDepth(
      DEPTH.hud + 2,
    );
    speedBtn.on("pointerup", () => {
      this.speed = this.speed === 1 ? 2 : 1;
      speedText.setText(`${this.speed}x`);
    });

    // The battle clock hangs over the clash point, between the two plates.
    this.clockText = label(this, MID_X, 24, timeLeft(0), { fontSize: "22px" }).setDepth(
      DEPTH.hud + 2,
    );

    this.refreshHud();
  }

  private headHeight(cls: Champion, _side: Side): number {
    return BODY_HEIGHT[cls];
  }

  private refreshHud(): void {
    for (const side of ["a", "b"] as const) {
      this.bars[side]?.set(this.sideHp(side) / Math.max(1, this.sideMax(side)));
    }
  }

  // --- events --------------------------------------------------------------

  private play(ev: BattleEvent): void {
    switch (ev.type) {
      case "move":
        this.onMove(ev);
        break;
      case "attack":
        this.onAttack(ev);
        break;
      case "hit":
        this.onHit(ev);
        break;
      case "heal":
        this.onHeal(ev);
        break;
      case "death":
        this.onDeath(ev);
        break;
      case "ability":
        this.onAbility(ev);
        break;
      case "revive":
        this.onRevive(ev);
        break;
    }
  }

  /** A cast: the caster's countdown starts over. */
  private recharge(id: string, t: number): void {
    const view = this.view(id);
    view.skillSpan = AUTO.skills[view.snap.class].cooldown * BALANCE.tickRate;
    view.skillAt = t + view.skillSpan;
  }

  private onAbility(ev: Extract<BattleEvent, { type: "ability" }>): void {
    this.recharge(ev.unit, ev.t);
    const view = this.view(ev.unit);
    if (!view.alive) return;
    const { side, class: cls } = view.snap;

    if (ev.ability === "reassemble") {
      view.hp = ev.hpAfter ?? view.hp;
      this.refreshHud();
      const dust = this.add.sprite(view.sprite.x, view.sprite.y, "dust").setOrigin(0.5, 0.8).setDepth(DEPTH.unit + view.sprite.y + 2);
      dust.play("dust_anim");
    }
    if (ev.ability === "hex") {
      const target = this.view(ev.target!);
      this.time.delayedCall(this.impactMs(view) / this.speed, () => {
        if (!target.alive) return;
        target.sprite.setTint(0xc89cff);
        this.time.delayedCall(700 / this.speed, () => target.alive && target.sprite.clearTint());
        this.floatText(target, "HEXED", "#d6b8ff");
      });
      return;
    }
    const callout = CALLOUT[ev.ability];
    if (callout) {
      this.floatText(view, ...callout);
      return;
    }

    if (ev.ability === "pierce") {
      // The same arrow flies on: a second one released with the first reads as it.
      const target = this.view(ev.target!);
      const release = (RELEASE_FRAME.archer! / ATTACK_FRAME_RATE) * 1000;
      this.time.delayedCall(release / this.speed, () => {
        if (view.alive && target.alive) this.flyProjectile(view, target);
      });
      this.floatText(view, "PIERCE", "#ffe08a");
      return;
    }

    if (this.anims.exists(animKey(side, cls, "guard"))) playPose(view.sprite, side, cls, "guard");
    if (ev.ability === "guard") {
      this.floatText(view, "GUARD", "#9fd4ff");
      return;
    }

    // Taunt: a ring out to the reach that pulls enemies in.
    const reach = (BALANCE.abilities.taunt.radius + 0.5) * TILE;
    const ring = this.add
      .graphics({ x: view.sprite.x, y: view.sprite.y - SPRITE_NUDGE })
      .setDepth(DEPTH.unit + view.sprite.y - 1);
    ring.lineStyle(4, 0xe8c547, 0.9).strokeCircle(0, 0, reach);
    ring.setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1, duration: 500 / this.speed, ease: "Sine.easeOut" });
    // Fading while it grew left the ring half-seen; it lands, then fades.
    this.tweens.add({
      targets: ring,
      alpha: 0,
      delay: 500 / this.speed,
      duration: 500 / this.speed,
      onComplete: () => ring.destroy(),
    });
    this.floatText(view, "TAUNT", "#ffd36b");
  }

  private onRevive(ev: Extract<BattleEvent, { type: "revive" }>): void {
    this.recharge(ev.unit, ev.t);
    const caster = this.view(ev.unit);
    const view = this.view(ev.target);
    if (caster.alive) {
      const dx = view.sprite.x - caster.sprite.x;
      if (Math.abs(dx) > 0.5) caster.sprite.setFlipX(dx < 0);
      playPose(caster.sprite, caster.snap.side, caster.snap.class, "attack");
    }

    // Undo the death beat: the body sank, faded and hid.
    view.alive = true;
    view.hp = ev.hpAfter;
    view.shownHp = ev.hpAfter;
    this.tweens.killTweensOf([view.sprite, view.shadow]);
    view.sprite.setVisible(true).setAlpha(1).setScale(this.starScale(view.snap.stars) * bodyScale(view.snap.class)).clearTint();
    view.shadow.setVisible(true).setAlpha(0.35);
    // Death paused the anim; replaying the same idle key would stay paused.
    view.sprite.anims.stop();
    playPose(view.sprite, view.snap.side, view.snap.class, "idle", this.mirrored);
    this.drawPip(view);
    this.refreshHud();

    const key = reviveKey(view.snap.side);
    const burst = this.add
      .sprite(view.sprite.x, view.sprite.y - this.headHeight(view.snap.class, view.snap.side) / 2, key)
      .setDepth(DEPTH.fx);
    burst.play(`${key}_anim`);
    burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
    this.floatText(view, "REVIVED", "#a9e88a");
  }

  private onMove(ev: Extract<BattleEvent, { type: "move" }>): void {
    const view = this.view(ev.unit);
    if (!view.alive) return;
    const { x, y } = this.spriteXY(ev.col, ev.row);
    // A step straight after a step is one walk: keep the run cycle going and
    // the pace even. Easing and idling every cell made a
    // march read as a string of hops.
    if (Math.hypot(x - view.sprite.x, y - view.sprite.y) > TILE * 1.6) return this.leap(view, x, y);
    const chained = view.settle !== null;
    view.settle?.remove();
    view.settle = null;
    playPose(view.sprite, view.snap.side, view.snap.class, "run");
    if (Math.abs(x - view.sprite.x) > 0.5) view.sprite.setFlipX(x < view.sprite.x);
    this.tweens.add({
      targets: view.sprite,
      x,
      y,
      duration: STEP_MS / this.speed,
      ease: chained ? "Linear" : "Sine.easeIn",
      onUpdate: () => view.sprite.setDepth(DEPTH.unit + view.sprite.y),
      onComplete: () => {
        // Idle only if no next step arrives inside the tick's leftover time.
        view.settle = this.time.delayedCall((BALANCE.actionSeconds * 1000 - STEP_MS + 60) / this.speed, () => {
          view.settle = null;
          if (view.alive) playPose(view.sprite, view.snap.side, view.snap.class, "idle", this.mirrored);
        });
      },
    });
  }

  /** A long jump in an arc, dust where it left and where it lands. */
  private leap(view: UnitView, x: number, y: number): void {
    const from = { x: view.sprite.x, y: view.sprite.y };
    const puff = (px: number, py: number): void => {
      this.add.sprite(px, py, "dust").setOrigin(0.5, 0.8).setDepth(DEPTH.unit + py + 2).play("dust_anim");
    };
    puff(from.x, from.y);
    view.sprite.setFlipX(x < from.x);
    playPose(view.sprite, view.snap.side, view.snap.class, "run");
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520 / this.speed,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        view.sprite.setPosition(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(Math.PI * k) * 70);
        view.sprite.setDepth(DEPTH.unit + view.sprite.y);
      },
      onComplete: () => {
        view.sprite.setPosition(x, y);
        puff(x, y);
        if (view.alive) playPose(view.sprite, view.snap.side, view.snap.class, "idle", this.mirrored);
      },
    });
  }

  /** When a blow lands after its attack starts: a missile's release and flight, or a melee swing's reach. */
  private impactMs(attacker: UnitView): number {
    const release = RELEASE_FRAME[attacker.snap.class];
    return MISSILE[attacker.snap.class] && release !== undefined
      ? (release / ATTACK_FRAME_RATE) * 1000 + FLIGHT_MS
      : 280;
  }

  private onAttack(ev: Extract<BattleEvent, { type: "attack" }>): void {
    const attacker = this.view(ev.unit);
    const target = this.view(ev.target);
    if (!attacker.alive || !target.alive) return;

    const dx = target.sprite.x - attacker.sprite.x;
    if (Math.abs(dx) > 0.5) attacker.sprite.setFlipX(dx < 0);
    // The warrior alternates the kit's two slashes instead of replaying one;
    // every other class has a single attack sheet.
    const anim =
      attacker.snap.class === "warrior" && attacker.slash === 2 ? "attack2" : "attack";
    attacker.slash = attacker.slash === 1 ? 2 : 1;
    playPose(attacker.sprite, attacker.snap.side, attacker.snap.class, anim);

    const release = RELEASE_FRAME[attacker.snap.class];
    if (MISSILE[attacker.snap.class] && release !== undefined) {
      // The projectile waits for the anim's release frame - spawning it at
      // frame 0 had the arrow leaving before the bow was drawn.
      const releaseMs = (release / ATTACK_FRAME_RATE) * 1000;
      this.time.delayedCall(releaseMs / this.speed, () => {
        if (!attacker.alive || !target.alive) return;
        this.flyProjectile(attacker, target);
      });
    }
  }

  /** The archer's arrow. It arcs: a
   * bowshot that flew dead flat reads as a laser line, so it rises by a
   * third of the range over the chord and turns with its velocity. */
  private flyProjectile(attacker: UnitView, target: UnitView): void {
    const from = { x: attacker.sprite.x, y: attacker.sprite.y - 46 };
    const to = { x: target.sprite.x, y: target.sprite.y - 40 };
    const missile = MISSILE[attacker.snap.class] ?? MISSILE.archer!;
    const projectile = this.add.sprite(from.x, from.y, missile.key).setScale(missile.scale);
    projectile.setDepth(DEPTH.fx);

    // Quadratic bezier: start, apex above the midpoint, target. The arrow's
    // nose follows the curve's tangent so it points where it is going.
    const apexY = Math.min(from.y, to.y) - Math.min(90, Math.abs(to.x - from.x) / 4);
    const curve = (t: number): { x: number; y: number; angle: number } => {
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ((from.x + to.x) / 2) + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * apexY + t * t * to.y;
      // The derivative at t: where the tip is heading right now.
      const dx = 2 * (1 - t) * (((from.x + to.x) / 2) - from.x) + 2 * t * (to.x - ((from.x + to.x) / 2));
      const dy = 2 * (1 - t) * (apexY - from.y) + 2 * t * (to.y - apexY);
      return { x, y, angle: Math.atan2(dy, dx) };
    };
    projectile.setRotation(curve(0).angle);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLIGHT_MS / this.speed,
      onUpdate: (tw) => {
        const p = curve(tw.progress);
        projectile.setPosition(p.x, p.y);
        projectile.setRotation(missile.spin ? tw.progress * Math.PI * 4 : p.angle);
      },
      onComplete: () => projectile.destroy(),
    });
  }

  /** Spread for simultaneous hits so a volley reads as one number per
   * attacker, not three stacked into one. */
  private floatStack = 0;

  private floatText(view: UnitView, text: string, color: string): void {
    // A volley lands several numbers on one unit at once; each live one
    // pushes the next a line higher, so they stack instead of overprinting.
    const top = view.sprite.y - this.headHeight(view.snap.class, view.snap.side) - 20 - view.floats * 16;
    view.floats += 1;
    const jitter = this.floatStack;
    this.floatStack = (this.floatStack + 14) % 42;
    const tag = this.add
      .text(view.sprite.x + jitter - 14, top, text, {
        fontFamily: '"Nunito", sans-serif',
        fontSize: "17px",
        color,
        stroke: "#1c2634",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 1)
      .setResolution(TEXT_RES);
    // Pop, rise, and only fade on the way out: a
    // number that starts fading the instant it appears is half-read.
    tag.setScale(1.35);
    this.tweens.add({ targets: tag, scale: 1, duration: 110 / this.speed, ease: "Back.easeOut" });
    this.tweens.add({
      targets: tag,
      y: top - 28,
      duration: 900 / this.speed,
      ease: "Sine.easeOut",
      onComplete: () => {
        tag.destroy();
        view.floats -= 1;
      },
    });
    this.tweens.add({ targets: tag, alpha: 0, delay: 520 / this.speed, duration: 380 / this.speed });
  }

  private onHit(ev: Extract<BattleEvent, { type: "hit" }>): void {
    const target = this.view(ev.target);
    if (!target.alive) return;
    const attacker = this.view(ev.unit);
    target.hp = ev.hpAfter;
    this.refreshHud();

    // Impact lands when the blow would connect: melee at the thrust's reach,
    // ranged when the projectile arrives. Attack and hit share a tick, so
    // firing both at once hid the windup under the flash.
    const delay = this.impactMs(attacker) / this.speed;

    // The PRD's white flash, cut to a blink and handed to a red blush: a
    // full-body white silhouette for 80ms was the loudest thing on screen.
    this.time.delayedCall(delay, () => {
      if (!target.alive) return;
      target.sprite.setTintFill(0xffffff);
      this.time.delayedCall(40 / this.speed, () => {
        if (!target.alive) return;
        target.sprite.setTint(0xff8a80);
        this.time.delayedCall(110 / this.speed, () => {
          if (target.alive) target.sprite.clearTint();
        });
      });
      // One soft nudge; a 45ms double-shake read as jitter.
      const home = target.sprite.x;
      const away = target.sprite.x + (target.snap.side === this.mySide ? -5 : 5);
      this.tweens.add({
        targets: target.sprite,
        x: away,
        duration: 90 / this.speed,
        ease: "Sine.easeOut",
        yoyo: true,
        onComplete: () => target.sprite.setX(home),
      });
      this.floatText(target, `-${ev.damage}`, "#ff8f7a");
      const half = this.headHeight(target.snap.class, target.snap.side) / 2;
      this.blast("spark", target.sprite.x + Phaser.Math.Between(-10, 10), target.sprite.y - half, 0.32);
    });
  }

  /** One of the pack's bursts, played once and gone. */
  private blast(key: keyof typeof BLAST, x: number, y: number, scale: number): void {
    const fx = this.add.sprite(x, y, key).setScale(scale).setDepth(DEPTH.fx);
    fx.anims.timeScale = this.speed;
    fx.play(`${key}_anim`);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  private onHeal(ev: Extract<BattleEvent, { type: "heal" }>): void {
    const target = this.view(ev.target);
    if (!target.alive) return;
    const caster = this.view(ev.unit);
    target.hp = ev.hpAfter;
    this.refreshHud();

    // A Troll mending itself every second: a quiet number, no cast and no burst.
    if (caster === target) {
      this.floatText(target, `+${ev.amount}`, "#a9e88a");
      return;
    }

    // The Monk casts; heal events skip onAttack, so pose the healer here.
    if (caster.alive) {
      const dx = target.sprite.x - caster.sprite.x;
      if (Math.abs(dx) > 0.5) caster.sprite.setFlipX(dx < 0);
      playPose(caster.sprite, caster.snap.side, caster.snap.class, "attack");
    }

    // The pack heal burst lands on the unit being mended, timed to the cast.
    this.time.delayedCall(280 / this.speed, () => {
      if (!target.alive) return;
      const burst = this.add
        .sprite(
          target.sprite.x,
          target.sprite.y - this.headHeight(target.snap.class, target.snap.side) / 2,
          healKey(target.snap.side),
        )
        .setDepth(DEPTH.fx);
      burst.play(`${healKey(target.snap.side)}_anim`);
      burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());

      this.floatText(target, `+${ev.amount}`, "#a9e88a");
    });
  }

  private onDeath(ev: Extract<BattleEvent, { type: "death" }>): void {
    const view = this.view(ev.unit);
    view.alive = false;
    view.hp = 0;
    view.pip.clear();
    this.refreshHud();

    // The PRD beat, split in two: the body greys and sinks into the ground
    // where it stood, while a pale soul lifts off it
    // and fades. One sprite doing both read as the whole unit floating away.
    view.settle?.remove();
    this.tweens.killTweensOf(view.sprite);
    const body = view.sprite;
    body.clearTint().setTint(0x6f6f6f);
    body.anims.pause();
    const soul = this.add
      .sprite(body.x, body.y, body.texture.key, body.frame.name)
      .setOrigin(body.originX, body.originY)
      .setFlipX(body.flipX)
      .setTint(0xcfe0ff)
      .setAlpha(0.35)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: soul,
      y: soul.y - 40,
      alpha: 0,
      duration: 1100 / this.speed,
      ease: "Sine.easeOut",
      onComplete: () => soul.destroy(),
    });
    this.tweens.add({
      targets: body,
      scaleY: 0.2,
      alpha: 0,
      delay: 120 / this.speed,
      duration: 700 / this.speed,
      ease: "Sine.easeIn",
      onComplete: () => body.setVisible(false),
    });
    this.tweens.add({
      targets: view.shadow,
      alpha: 0,
      duration: 800 / this.speed,
      onComplete: () => view.shadow.setVisible(false),
    });

    const dust = this.add
      .sprite(view.sprite.x, view.sprite.y, "dust")
      .setOrigin(0.5, 0.8)
      .setDepth(DEPTH.unit + view.sprite.y + 2);
    dust.play("dust_anim");
    this.blast("fall", body.x, body.y - this.headHeight(view.snap.class, view.snap.side) / 2, 0.7);
  }

  // --- result --------------------------------------------------------------

  private showResult(): void {
    if (this.auto) return this.showRoundCard();
    this.versus?.onPlayed();
    const result = this.result!;
    // The engine names sides, the player names players: winner is read
    // against mySide, not against a.
    const won = result.winner === this.mySide;
    const lost = result.winner !== this.mySide && result.winner !== "draw";
    const foeName = this.versus?.status().opponent ?? "THE GREY HOST";
    // One verdict per ending, short and flat. The win line names the foe.
    const headline = won
      ? `${foeName.toUpperCase()} DEFEATED`
      : lost
        ? "DEFEAT"
        : "DRAW";
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    // The whole veil is the card: no sheet, just darkness and the words. As
    // wide as the water, so it covers the whole page.
    const veil = this.add
      .rectangle(cx, cy, WATER_SPAN.w, WATER_SPAN.h, 0x050608, 0.82)
      .setDepth(DEPTH.hud + 10);
    const band = ribbon(this, cx, cy - 150, 600).setDepth(DEPTH.hud + 11);
    const title = label(this, cx, cy - 154, headline, {
      fontSize: won && foeName.length > 12 ? "30px" : "38px",
      color: won ? "#f4cf6b" : lost ? "#e0796a" : "#e4e8ea",
    }).setDepth(DEPTH.hud + 12);

    // The scoreline stays, but quiet: one line, not a ledger. Losing says
    // how it ended (wipe or the clock), winning does not need the excuse.
    const loserLine =
      result.reason === "wipe"
        ? "your line was wiped from the field"
        : "the clock ran out on your army";
    const detail = label(
      this,
      cx,
      cy - 96,
      won
        ? `${result.survivors[this.mySide]} of yours left standing - ` +
          `${(result.ticks / BALANCE.tickRate).toFixed(1)}s`
        : lost
          ? `${loserLine} - ${(result.ticks / BALANCE.tickRate).toFixed(1)}s`
          : `${result.survivors.a} against ${result.survivors.b} - ` +
            `${(result.ticks / BALANCE.tickRate).toFixed(1)}s`,
      { fontSize: "15px", color: "#b9a887", strokeThickness: 0 },
    ).setDepth(DEPTH.hud + 11);

    // Both armies as they ended: the fallen greyed, the standing lit.
    const standing = new Set(result.standing);
    const faces: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
    for (const [side, y, who] of [
      [this.mySide, cy - 36, "YOU"],
      [this.mySide === "a" ? "b" : "a", cy + 20, foeName.toUpperCase()],
    ] as const) {
      const units = result.units.filter((u) => u.side === side);
      const name = who.length > 14 ? `${who.slice(0, 13)}.` : who;
      faces.push(
        label(this, cx - 200, y, name, { fontSize: "15px", color: "#b9a887", strokeThickness: 0 })
          .setOrigin(1, 0.5)
          .setDepth(DEPTH.hud + 11),
      );
      for (const [i, u] of units.entries()) {
        const [x0, y0, x1, y1] = PORTRAIT_INK[u.class];
        const face = this.add
          .image(cx - 160 + i * 48, y, `avatar_${u.class}`)
          .setOrigin((x0 + x1) / 2 / 256, (y0 + y1) / 2 / 256)
          .setScale(42 / Math.max(x1 - x0, y1 - y0))
          .setDepth(DEPTH.hud + 11);
        if (!standing.has(u.id)) face.setTint(0x4a4a4a);
        faces.push(face);
      }
    }

    // Your hardest hitter, off the log.
    const dealt = new Map<string, number>();
    for (const ev of result.events) if (ev.type === "hit") dealt.set(ev.unit, (dealt.get(ev.unit) ?? 0) + ev.damage);
    const best = result.units
      .filter((u) => u.side === this.mySide)
      .sort((x, y) => (dealt.get(y.id) ?? 0) - (dealt.get(x.id) ?? 0))[0];
    const mvp = label(
      this,
      cx,
      cy + 74,
      best && dealt.get(best.id) ? `Your best blade: ${CLASS_NAME[best.class]}, ${dealt.get(best.id)} damage` : "",
      { fontSize: "15px", color: "#e8c06a", strokeThickness: 0 },
    ).setDepth(DEPTH.hud + 11);

    // The menu link: a quiet text button, styled after the boss-fog exit. A
    // rematch belongs to the room, so the page offers that, not this card.
    const menu = label(this, cx, cy + 150, "Return to menu", {
      fontSize: "15px",
      color: "#b9a887",
      strokeThickness: 0,
    })
      .setDepth(DEPTH.hud + 11)
      .setInteractive({ cursor: HAND })
      .on("pointerover", () => menu.setColor("#fdfaf0"))
      .on("pointerout", () => menu.setColor("#b9a887"))
      .on("pointerup", () => {
        this.input.enabled = false;
        cloudCover(this, "close", () => this.launcher.onMenu());
      });

    for (const [i, o] of [veil, band, title, detail, ...faces, mvp, menu].entries()) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, delay: Math.min(i, 3) * 120, duration: 260 });
    }
    // The verdict lands: the band and its words pop in together.
    for (const o of [band, title]) {
      const scale = o.scale;
      o.setScale(scale * 0.6);
      this.tweens.add({ targets: o, scale, delay: 120, duration: 420, ease: "Back.easeOut" });
    }
  }
}

export function startBattle(
  parent: HTMLElement,
  launcher: BattleLauncher,
): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "battle", BattleScene, launcher);
}
