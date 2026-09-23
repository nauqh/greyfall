// Battle playback. The engine decided everything; this only replays its log.
//
// The scene opens in draft mode when the launcher carries no result: a panel
// over the enemy half holds the roster cards, clicks place units on the left
// half, and Start slides the panel away to reveal the enemy army.
//
// The board runs LEFT to RIGHT, 10 columns by 3 rows of square cells, your
// army on the left. This matches the art: only the Lancer has a vertical
// attack pose, so every class needs to fight sideways to look right. Units
// keep the pack's native pixel scale and the canvas is scaled up by Phaser
// FIT, so the art never resamples.
//
// Playback waits for a 3-2-1 count, so both armies can be read first.

import {
  BALANCE,
  UNIT_CLASSES,
  armyCost,
  battleCol,
  validateArmy,
  type BattleEvent,
  type BattleResult,
  type Placement,
  type Side,
  type UnitClass,
  type UnitSnapshot,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { AVATARS, FX, ICON, iconKey, iconUrl, packUrl } from "./art";
import { GAME_H, GAME_W, fitCamera, startGame } from "./boot";
import {
  BODY,
  BODY_HEIGHT,
  SPRITE_NUDGE,
  animKey,
  healKey,
  loadUnits,
  makeAnims,
  playPose,
  unitKey,
} from "./sprites";
import {
  DEPTH,
  addShadow,
  buildFoam,
  buildIsland,
  buildWater,
  driftClouds,
  loadTerrain,
  prepareTerrain,
  scatterDecor,
  type Rect,
} from "./terrain";
import { HAND, PackBar, button, label, loadPanels, panel, ribbon } from "./ui";

const COLS = BALANCE.board.battleCols;
const ROWS = BALANCE.board.battleRows;

/** A 192px unit frame carries an ~80px body, so 84 fills a cell. */
const TILE = 84;

/** Whole 64px terrain tiles. The margins hold the scenery and clear the HUD plates. */
const ISLAND: Rect = { x0: 90, y0: 178, x1: 1110, y1: 510 };

const BOARD_W = COLS * TILE;
const BOARD_H = ROWS * TILE;
/** Centre of cell (0, 0), the true grid position - drawGrid and movement use this. */
const ORIGIN_X = (GAME_W - BOARD_W) / 2 + TILE / 2;
const ORIGIN_Y = ISLAND.y0 + (ISLAND.y1 - ISLAND.y0 - BOARD_H) / 2 + TILE / 2;
/** Where the two front columns meet - the clash point, and the countdown's home. */
const MID_X = ORIGIN_X + (COLS / 2 - 0.5) * TILE;
const MID_Y = ORIGIN_Y + ((ROWS - 1) / 2) * TILE;

const TICK_MS = 1000 / BALANCE.tickRate;
/**
 * A unit acts once a second, so the step nearly fills it. At 420ms it crossed
 * the cell in a snap then stood still, which read as teleporting.
 */
const STEP_MS = 880;

/**
 * Time left, m:ss. A battle that runs the clock out is decided on HP, so what
 * matters to watch is how much of it is gone - counting up said nothing until
 * you knew the limit, and the limit is nowhere on screen.
 */
function timeLeft(elapsedMs: number): string {
  const left = Math.max(0, Math.ceil(BALANCE.timeoutSeconds - elapsedMs / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

const CLASS_NAME: Record<UnitClass, string> = {
  pawn: "Pawn",
  warrior: "Warrior",
  lancer: "Lancer",
  archer: "Archer",
  monk: "Monk",
};

const ROSTER = UNIT_CLASSES.filter((c) => c !== "pawn");
/** A portrait per class, from the pack's 25 avatars. */
const PORTRAIT: Record<UnitClass, number> = { warrior: 1, lancer: 2, archer: 3, monk: 4, pawn: 1 };

/**
 * Each class's counter, named. BALANCE.counters is what makes them true; the
 * job here is only to say which class a card ruins, in the game's own voice
 * rather than as a stat sheet.
 */
const BLURB: Record<UnitClass, string> = {
  pawn: "Digs. Dies.",
  warrior: "Fells archers.",
  lancer: "Breaks warriors.",
  archer: "Outreaches lancers.",
  monk: "Mends what still lives.",
};

/** Dark ink on paper, light ink on the selected card's slate. */
interface DraftCard {
  box: Phaser.GameObjects.Container;
  cy: number;
  paper: Phaser.GameObjects.NineSlice;
  special: Phaser.GameObjects.NineSlice;
  name: Phaser.GameObjects.Text;
  /** Everything that has to swap from dark ink on paper to light on slate. */
  ink: Phaser.GameObjects.Text[];
  cost: Phaser.GameObjects.Text;
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
}

/** What the scene needs from a room it does not itself own. */
export interface DuelStatus {
  msRemaining: number | null;
  youLocked: boolean;
  theyLocked: boolean;
  opponent: string | null;
  /** Set once the server has resolved; the scene plays it back. */
  battle: BattleResult | null;
}

export interface DuelHooks {
  /** Every board change, so the deadline always has something to resolve. */
  onArmyChange: (army: Placement[]) => void;
  onLock: () => void;
  /** Read every frame while drafting; no events, no imperative handle. */
  status: () => DuelStatus;
  /**
   * Playback is over and the result card is up. The page waits for this
   * before saying who won: the server resolves the moment both seats lock,
   * so the poll knows the winner long before the fight has been watched.
   */
  onPlayed: () => void;
}

export interface BattleLauncher {
  /** Null while drafting: the scene collects the army, then calls onDraft. */
  result: BattleResult | null;
  seed: number | string;
  /**
   * Which side of the board is the player's. Solo is always side A; in a duel
   * the room decides, and seat B sees the board mirrored so that the half it
   * drafted on is still the half on the left.
   */
  mySide?: Side;
  /** Present only in a duel: the server owns the army and the result. */
  duel?: DuelHooks;
  onDraft: (army: Placement[], seed: number | string) => BattleResult;
  /**
   * Both hand back what the next round needs, rather than tearing the page's
   * canvas down and putting a fresh one up. The scene restarts itself on the
   * answer: a restart keeps every texture, sheet and animation the game has
   * already loaded, so the board is clear and the draft is back in a frame or
   * two instead of half a second.
   */
  onRematch: () => { result: BattleResult; seed: number | string };
  onNewArmy: () => { seed: number | string };
}

export class BattleScene extends Phaser.Scene {
  private launcher!: BattleLauncher;
  private result: BattleResult | null = null;
  private units = new Map<string, UnitView>();
  private drafting = false;
  private draftArmy: Placement[] = [];
  private picked: UnitClass | null = null;
  private draftBox!: Phaser.GameObjects.Container;
  private cellZone!: Phaser.GameObjects.Zone;
  private goldText!: Phaser.GameObjects.Text;
  private goldCoin!: Phaser.GameObjects.Image;
  private errorText!: Phaser.GameObjects.Text;
  private cards = new Map<UnitClass, DraftCard>();
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
  private duel: DuelHooks | null = null;
  private lockBtn: Phaser.GameObjects.Container | null = null;
  private duelText: Phaser.GameObjects.Text | null = null;
  private bars: Record<Side, PackBar | null> = { a: null, b: null };
  private counts: Record<Side, Phaser.GameObjects.Text | null> = { a: null, b: null };
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
    this.duel = data.duel ?? null;
    this.lockBtn = null;
    this.duelText = null;
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
    this.placed = new Map();
    this.clockText = null;
    // Field initialisers run once, at construction; a restart runs only this.
    // A stale PackBar here would be ticked every frame with its art already
    // destroyed along with the old scene's display list.
    this.bars = { a: null, b: null };
    this.counts = { a: null, b: null };
  }

  /** Re-enter the scene with a new round in hand. */
  private restart(next: Partial<BattleLauncher>): void {
    this.scene.restart({ ...this.launcher, ...next });
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
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
    for (const cls of ROSTER) {
      this.load.image(
        `avatar_${cls}`,
        packUrl(`${AVATARS.file}${String(PORTRAIT[cls]).padStart(2, "0")}.png`),
      );
    }
    for (const n of Object.values(ICON)) this.load.image(iconKey(n), iconUrl(n));
  }

  create(): void {
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

    const board: Rect = {
      x0: ORIGIN_X - TILE / 2,
      y0: ORIGIN_Y - TILE / 2,
      x1: ORIGIN_X - TILE / 2 + BOARD_W,
      y1: ORIGIN_Y - TILE / 2 + BOARD_H,
    };

    buildWater(this, GAME_W, GAME_H);
    const island = buildIsland(this, ISLAND);
    buildFoam(this, island);
    scatterDecor(this, island, board, { w: GAME_W, h: GAME_H }, this.launcher.seed);
    this.drawGrid();
    driftClouds(this, { w: GAME_W, h: GAME_H }, this.launcher.seed);

    if (this.result) {
      this.beginBattle();
    } else {
      this.buildDraft();
    }
  }

  /** Armies placed, HUD up, event log queued, count down. */
  private beginBattle(): void {
    this.spawnArmies();
    this.buildHud();
    this.queue = [...this.result!.events].sort((x, y) => x.t - y.t);
    this.runIntro();
  }

  // --- draft ---------------------------------------------------------------

  /**
   * Roster cards on a panel over the enemy half; clicks place on the left.
   *
   * The vertical budget is tight and worth writing down, because everything
   * here is spaced off it: the panel runs y 16..704, the roster takes two rows
   * of 188px cards, and the Start button cannot go under ~128px tall without
   * its nine-slice collapsing into a strip.
   */
  private buildDraft(): void {
    this.drafting = true;
    // Above the HUD too, so the slide-out sweeps across the plates.
    this.draftBox = this.add.container(0, 0).setDepth(DEPTH.hud + 5);

    const panel_ = panel(this, "paper", 900, 360, 576, 688);
    const band = ribbon(this, 900, 52, 380);
    const title = label(this, 900, 48, "DRAFT YOUR WARBAND", { fontSize: "20px" });
    this.goldText = label(this, 900, 98, "", {
      fontSize: "17px",
      color: "#7a4f14",
      strokeThickness: 0,
    });
    this.goldCoin = this.add.image(0, 98, iconKey(ICON.gold)).setScale(0.44);
    // What is wrong with the army, and only that. It used to sit where the
    // instructions are and replace them, so the one moment you most need
    // telling what to do - an empty army, before anything is placed - was the
    // one moment the screen would not tell you.
    this.errorText = label(this, 900, 126, "", {
      fontSize: "14px",
      color: "#8c3a30",
      strokeThickness: 0,
    });
    const how = label(
      this,
      900,
      552,
      "Pick a unit above, then click your half of the field to place it.\nClick one already placed to take it back.",
      { fontSize: "14px", color: "#6b5740", strokeThickness: 0, align: "center" },
    );
    this.draftBox.add([panel_, band, title, this.goldText, this.goldCoin, this.errorText, how]);

    for (const [i, cls] of ROSTER.entries()) {
      const cx = 900 + (i % 2 === 0 ? -124 : 124);
      const cy = i < 2 ? 232 : 432;
      this.draftBox.add(this.buildCard(cls, cx, cy));
    }

    // 104 is under the sheet's own 64px corners, so the frame squashes a
    // little rather than stretching. Any shorter and it reads as a strip.
    // Solo starts the fight itself. A duel hands the army over and waits for
    // the server, which starts it the moment both seats are locked - the
    // deadline is a floor under a stalling opponent, never something two
    // ready players sit through.
    this.lockBtn = this.duel
      ? button(this, 900, 624, 190, 104, "Lock in", "blue", () => this.duel!.onLock())
      : button(this, 900, 624, 190, 104, "Start", "blue", () => this.startFromDraft());
    this.draftBox.add(this.lockBtn);

    if (this.duel) {
      this.duelText = label(this, 900, 512, "", {
        fontSize: "15px",
        color: "#7a4f14",
        strokeThickness: 0,
        align: "center",
      });
      this.draftBox.add(this.duelText);
      how.setY(548);
      this.refreshDuel();
    }

    // In from the right, the way it went out. Only on a second round: the
    // first draft is what the screen opens on, and sliding that in would just
    // delay the game.
    if (this.rounds > 0) {
      this.draftBox.setX(GAME_W);
      this.tweens.add({ targets: this.draftBox, x: 0, duration: 420, ease: "Sine.easeOut" });
    }

    // Own half only, and it is always the left half of the screen: the enemy
    // half sits under the panel whichever side of the engine you hold.
    const zx = ORIGIN_X - TILE / 2;
    const zy = ORIGIN_Y - TILE / 2;
    this.cellZone = this.add
      .zone(zx + (COLS / 2) * (TILE / 2), zy + BOARD_H / 2, (COLS / 2) * TILE, BOARD_H)
      .setInteractive()
      .on("pointerdown", (p: Phaser.Input.Pointer) => {
        const screenCol = Math.floor((p.worldX - zx) / TILE);
        const row = Math.floor((p.worldY - zy) / TILE);
        if (screenCol < 0 || screenCol >= COLS / 2 || row < 0 || row >= ROWS) return;
        // Screen column to battle column to your own half's column. For side
        // A that is the identity; for side B it is the flip, twice.
        const battle = this.mirrored ? COLS - 1 - screenCol : screenCol;
        this.toggleCell(this.myCol(battle), row);
      });

    this.refreshDraft();
  }

  /**
   * One roster card, 236x188: portrait on the left, the price and the name
   * beside it, the three numbers along the foot.
   *
   * Laid out across rather than stacked because the paper nine-slice keeps its
   * 64px corners at any size. A card this short is nearly all frame top and
   * bottom, and five stacked rows put the price and then the stats under the
   * border, which is why neither could be read.
   */
  private buildCard(cls: UnitClass, cx: number, cy: number): Phaser.GameObjects.Container {
    const stats = BALANCE.units[cls];
    const ink = { strokeThickness: 0 };
    const paper = panel(this, "paper", 0, 0, 236, 188);
    const special = panel(this, "specialPaper", 0, 0, 236, 188).setVisible(false);

    const portrait = this.add.image(-66, -12, `avatar_${cls}`).setScale(0.32);
    const coin = this.add.image(26, -58, iconKey(ICON.gold)).setScale(0.46);
    const cost = label(this, 46, -58, `${stats.cost}`, {
      fontSize: "22px",
      color: "#7a4f14",
      ...ink,
    }).setOrigin(0, 0.5);
    const name = label(this, 34, -12, CLASS_NAME[cls], {
      fontSize: "19px",
      color: "#4a3a28",
      ...ink,
    });
    const blurb = label(this, 34, 12, BLURB[cls], { fontSize: "13px", color: "#6b5740", ...ink });

    // Three numbers, each behind the pack icon that says what it is. The Monk
    // deals no damage, so his middle pair is what he does instead.
    const pairs: Phaser.GameObjects.GameObject[] = [];
    const texts = [name, blurb];
    const pair = (dx: number, icon: number, value: number): void => {
      pairs.push(this.add.image(dx - 12, 48, iconKey(icon)).setScale(0.34));
      const t = label(this, dx + 2, 48, `${value}`, {
        fontSize: "15px",
        color: "#4a3a28",
        ...ink,
      }).setOrigin(0, 0.5);
      pairs.push(t);
      texts.push(t);
    };
    pair(-60, ICON.hp, stats.hp);
    pair(4, stats.heal > 0 ? ICON.heal : ICON.damage, stats.heal > 0 ? stats.heal : stats.damage);
    pair(68, ICON.range, stats.range);

    const box = this.add.container(cx, cy, [
      paper,
      special,
      portrait,
      coin,
      cost,
      name,
      blurb,
      ...pairs,
    ]);
    box.setSize(236, 188);
    const card: DraftCard = { box, cy, paper, special, name, ink: texts, cost };
    box
      .setInteractive({ cursor: HAND })
      .on("pointerup", () => {
        this.picked = cls;
        this.refreshDraft();
      })
      .on("pointerover", () => this.liftCard(card, true))
      .on("pointerout", () => this.refreshDraft());
    this.cards.set(cls, card);
    return box;
  }

  /**
   * The duel's own half of the draft screen, read straight off the room every
   * frame. No events and no handle into the scene: the poll owns the truth
   * and this just renders whatever it last said.
   */
  private refreshDuel(): void {
    const duel = this.duel;
    if (!duel || !this.duelText) return;
    const st = duel.status();

    // The result arriving is the signal to play it. Restarting with it in
    // hand runs the same playback path a solo battle does.
    if (st.battle) {
      this.duel = null;
      this.restart({ result: st.battle });
      return;
    }

    const them = st.opponent ?? "your opponent";
    const clock = st.msRemaining === null ? "" : `${Math.ceil(st.msRemaining / 1000)}s left`;
    this.duelText.setText(
      st.youLocked
        ? `Locked in. Waiting for ${them}.\n${clock}`
        : st.theyLocked
          ? `${them} is locked in.\n${clock}`
          : clock,
    );

    // Locked means locked: the army on the server is the one that fights.
    if (st.youLocked && this.lockBtn?.input?.enabled) {
      this.lockBtn.disableInteractive();
      this.lockBtn.setAlpha(0.55);
      this.cellZone.disableInteractive();
    }
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
      if (armyCost(next) > BALANCE.budget || next.length > BALANCE.board.maxUnits) return;
      this.draftArmy = next;
      const { x, y } = this.spriteXY(this.myCol(col), row);
      const shadow = addShadow(this, x, y, this.picked === "lancer" ? 0.8 : 0.62);
      const sprite = this.add.sprite(x, y, unitKey(this.mySide, this.picked, "idle"));
      playPose(sprite, this.mySide, this.picked, "idle", this.mirrored);
      sprite.setDepth(DEPTH.unit + y);
      this.placed.set(key, { sprite, shadow });
    }
    this.duel?.onArmyChange(this.draftArmy);
    this.refreshDraft();
  }

  private refreshDraft(): void {
    const gold = BALANCE.budget - armyCost(this.draftArmy);
    this.goldText.setText(
      `${gold} gold left    ${this.draftArmy.length}/${BALANCE.board.maxUnits} units`,
    );
    this.goldCoin.setX(900 - this.goldText.width / 2 - 20);
    this.errorText.setText(validateArmy(this.draftArmy)[0] ?? "");
    for (const [cls, card] of this.cards) {
      const picked = cls === this.picked;
      card.paper.setVisible(!picked);
      card.special.setVisible(picked);
      card.name.setColor(picked ? "#f5f2e4" : "#4a3a28");
      for (const t of card.ink) if (t !== card.name) t.setColor(picked ? "#a8b4c4" : "#6b5740");
      card.cost.setColor(picked ? "#e8c06a" : "#7a4f14");
      card.box.setAlpha(BALANCE.units[cls].cost <= gold ? 1 : 0.5);
      this.liftCard(card, picked);
    }
  }

  /** Panel slides off right, revealing the enemy army it hid. */
  private startFromDraft(): void {
    if (validateArmy(this.draftArmy).length > 0) return;
    this.drafting = false;
    this.result = this.launcher.onDraft(this.draftArmy, this.launcher.seed);

    for (const { sprite, shadow } of this.placed.values()) {
      sprite.destroy();
      shadow.destroy();
    }
    this.placed.clear();
    this.cellZone.destroy();

    this.spawnArmies();
    this.buildHud();
    this.queue = [...this.result.events].sort((x, y) => x.t - y.t);

    this.tweens.add({
      targets: this.draftBox,
      x: GAME_W,
      duration: 520,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.draftBox.destroy();
        this.runIntro();
      },
    });
  }

  /** Both armies are already placed, so the count is all that is needed. */
  private runIntro(): void {
    const steps = ["3", "2", "1", "FIGHT"];
    let i = 0;

    // A veil so the count reads over the armies without hiding them.
    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a1018, 0.42)
      .setDepth(DEPTH.hud + 19);

    const beat = (): void => {
      const last = i === steps.length - 1;
      const tag = label(this, MID_X, MID_Y, steps[i]!, {
        fontSize: last ? "62px" : "92px",
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

    if (this.drafting) {
      this.refreshDuel();
      return;
    }
    if (!this.started || this.finished) return;
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
    return battleCol(this.mySide, col);
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
      const shadow = addShadow(this, x, y, snap.class === "lancer" ? 0.8 : 0.62);
      const sprite = this.add.sprite(x, y, unitKey(snap.side, snap.class, "idle"));
      playPose(sprite, snap.side, snap.class, "idle", this.mirrored);
      sprite.setDepth(DEPTH.unit + y);

      const pip = this.add.graphics().setDepth(DEPTH.unit + y + 1);
      const view: UnitView = {
        snap,
        sprite,
        shadow,
        pip,
        alive: true,
        hp: snap.maxHp,
        shownHp: snap.maxHp,
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
  private drawPip(view: UnitView): void {
    const w = 38;
    const h = 5;
    const x = view.sprite.x - w / 2;
    const y = view.sprite.y - BODY_HEIGHT[view.snap.class] - 12;
    const frac = Math.max(0, view.shownHp / view.snap.maxHp);
    const mine = view.snap.side === this.mySide;
    view.pip.clear();
    view.pip.fillStyle(0x1a1208, 0.85).fillRect(x - 1, y - 1, w + 2, h + 2);
    view.pip
      .fillStyle(mine ? 0x7fb069 : 0xc4554d, 1)
      .fillRect(x, y, Math.max(0, w * frac), h);
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
      const counts = new Map<UnitClass, number>();
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
    const foeName = this.duel?.status().opponent ?? "THE GREY HOST";

    const topY = 58;
    const foeX = ISLAND.x1 - BAR_W / 2;
    ribbon(this, foeX, topY, BAR_W, 0.8).setDepth(DEPTH.hud);
    label(this, foeX, topY - 2, `${foeName.toUpperCase()}   ${roster(foe)}`, {
      fontSize: "17px",
    }).setDepth(DEPTH.hud + 2);
    this.bars[foe] = new PackBar(this, foeX, topY + 44, BAR_W, 0.75, 0xd9544a, DEPTH.hud + 1);
    this.counts[foe] = label(this, ISLAND.x1 - BAR_W - 16, topY + 44, "", { fontSize: "13px" })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud + 2);

    const bottomY = 606;
    const myX = ISLAND.x0 + BAR_W / 2;
    ribbon(this, myX, bottomY - 34, BAR_W, 0.8).setDepth(DEPTH.hud);
    label(this, myX, bottomY - 36, `YOUR WARBAND   ${roster(mine)}`, {
      fontSize: "17px",
    }).setDepth(DEPTH.hud + 2);
    this.bars[mine] = new PackBar(this, myX, bottomY + 14, BAR_W, 0.75, 0x86d15e, DEPTH.hud + 1);
    this.counts[mine] = label(this, ISLAND.x0 + BAR_W + 16, bottomY + 14, "", { fontSize: "13px" })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud + 2);

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

  private refreshHud(): void {
    for (const side of ["a", "b"] as const) {
      this.bars[side]?.set(this.sideHp(side) / Math.max(1, this.sideMax(side)));
      this.counts[side]?.setText(`${this.sideAlive(side)} left`);
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
    }
  }

  private onMove(ev: Extract<BattleEvent, { type: "move" }>): void {
    const view = this.view(ev.unit);
    if (!view.alive) return;
    const { x, y } = this.spriteXY(ev.col, ev.row);
    playPose(view.sprite, view.snap.side, view.snap.class, "run");
    if (Math.abs(x - view.sprite.x) > 0.5) view.sprite.setFlipX(x < view.sprite.x);
    this.tweens.add({
      targets: view.sprite,
      x,
      y,
      duration: STEP_MS / this.speed,
      // Linear starts and stops dead; a sine ease gives the step weight.
      ease: "Sine.easeInOut",
      onUpdate: () => view.sprite.setDepth(DEPTH.unit + view.sprite.y),
      onComplete: () => {
        if (view.alive) playPose(view.sprite, view.snap.side, view.snap.class, "idle", this.mirrored);
      },
    });
  }

  private onAttack(ev: Extract<BattleEvent, { type: "attack" }>): void {
    const attacker = this.view(ev.unit);
    const target = this.view(ev.target);
    if (!attacker.alive || !target.alive) return;

    const dx = target.sprite.x - attacker.sprite.x;
    if (Math.abs(dx) > 0.5) attacker.sprite.setFlipX(dx < 0);
    playPose(attacker.sprite, attacker.snap.side, attacker.snap.class, "attack");

    if (attacker.snap.class === "archer") {
      // The shoot sheet ends at the release, so the scene flies the arrow.
      const from = { x: attacker.sprite.x, y: attacker.sprite.y - 46 };
      const to = { x: target.sprite.x, y: target.sprite.y - 40 };
      const arrow = this.add
        .sprite(from.x, from.y, "arrow")
        .setDepth(DEPTH.fx)
        .setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
      this.tweens.add({
        targets: arrow,
        x: to.x,
        y: to.y,
        duration: 240 / this.speed,
        onComplete: () => arrow.destroy(),
      });
    }
  }

  private floatText(view: UnitView, text: string, color: string): void {
    const top = view.sprite.y - BODY_HEIGHT[view.snap.class] - 20;
    const tag = this.add
      .text(view.sprite.x, top, text, {
        fontFamily: '"Gochi Hand", cursive',
        fontSize: "17px",
        color,
        stroke: "#1c2634",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx + 1)
      .setResolution(2);
    this.tweens.add({
      targets: tag,
      y: top - 22,
      alpha: 0,
      duration: 780 / this.speed,
      ease: "Sine.easeOut",
      onComplete: () => tag.destroy(),
    });
  }

  private onHit(ev: Extract<BattleEvent, { type: "hit" }>): void {
    const target = this.view(ev.target);
    if (!target.alive) return;
    target.hp = ev.hpAfter;
    this.refreshHud();

    // White flash plus a nudge, per the PRD.
    target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80 / this.speed, () => {
      if (target.alive) target.sprite.clearTint();
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
  }

  private onHeal(ev: Extract<BattleEvent, { type: "heal" }>): void {
    const target = this.view(ev.target);
    if (!target.alive) return;
    target.hp = ev.hpAfter;
    this.refreshHud();

    // The pack heal burst plays on the unit being mended, not the Monk.
    const burst = this.add
      .sprite(
        target.sprite.x,
        target.sprite.y - BODY_HEIGHT[target.snap.class] / 2,
        healKey(target.snap.side),
      )
      .setDepth(DEPTH.fx);
    burst.play(`${healKey(target.snap.side)}_anim`);
    burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());

    this.floatText(target, `+${ev.amount}`, "#a9e88a");
  }

  private onDeath(ev: Extract<BattleEvent, { type: "death" }>): void {
    const view = this.view(ev.unit);
    view.alive = false;
    view.hp = 0;
    view.pip.clear();
    this.refreshHud();

    // Grey, drift up, fade, dust puff: the PRD death beat.
    view.sprite.clearTint();
    view.sprite.setTint(0x6f6f6f);
    playPose(view.sprite, view.snap.side, view.snap.class, "idle", this.mirrored);
    this.tweens.add({
      targets: [view.sprite, view.shadow],
      y: `-=26`,
      alpha: 0,
      duration: 900 / this.speed,
      onComplete: () => {
        view.sprite.setVisible(false);
        view.shadow.setVisible(false);
      },
    });

    const dust = this.add
      .sprite(view.sprite.x, view.sprite.y, "dust")
      .setOrigin(0.5, 0.8)
      .setDepth(DEPTH.unit + view.sprite.y + 2);
    dust.play("dust_anim");
  }

  // --- result --------------------------------------------------------------

  private showResult(): void {
    this.duel?.onPlayed();
    const result = this.result!;
    const headline =
      result.winner === "a"
        ? "THE LINE HELD"
        : result.winner === "b"
          ? "THE GREY TAKES YOU"
          : "NEITHER SIDE YIELDS";

    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0c10, 0.55)
      .setDepth(DEPTH.hud + 10);
    const card = panel(this, "paper", GAME_W / 2, GAME_H / 2, 560, 360).setDepth(DEPTH.hud + 11);
    const title = label(this, GAME_W / 2, GAME_H / 2 - 118, headline, {
      fontSize: "25px",
      color: result.winner === "a" ? "#6b4a12" : "#8c3a30",
      strokeThickness: 0,
    }).setDepth(DEPTH.hud + 12);
    const detail = label(
      this,
      GAME_W / 2,
      GAME_H / 2 - 56,
      `${result.survivors.a} left against ${result.survivors.b}\n` +
        `${result.hpRemaining.a} hp to ${result.hpRemaining.b}\n` +
        `${(result.ticks / BALANCE.tickRate).toFixed(1)}s by ${result.reason}`,
      { fontSize: "14px", color: "#5a4632", strokeThickness: 0 },
    ).setDepth(DEPTH.hud + 12);

    // A duel's rematch belongs to the room, not to this client, so the page
    // offers it instead and these two are left off.
    const buttons = this.duel
      ? []
      : [
          button(this, GAME_W / 2 - 100, GAME_H / 2 + 88, 208, 136, "Rematch", "blue", () =>
            this.restart(this.launcher.onRematch()),
          )
            .setScale(0.85)
            .setDepth(DEPTH.hud + 12),
          button(this, GAME_W / 2 + 100, GAME_H / 2 + 88, 208, 136, "New army", "red", () =>
            this.restart({ ...this.launcher.onNewArmy(), result: null }),
          )
            .setScale(0.85)
            .setDepth(DEPTH.hud + 12),
        ];

    for (const o of [veil, card, title, detail, ...buttons]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 260 });
    }
  }
}

export function startBattle(
  parent: HTMLElement,
  launcher: BattleLauncher,
): { destroy: () => void; ready: Promise<void> } {
  return startGame(parent, "battle", BattleScene, launcher);
}
