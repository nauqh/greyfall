// Battle playback. The engine decided everything; this only replays its log.
//
// The board runs UP the screen, 5 columns by 6 rows of square cells, your
// army on the near half. Units keep the pack's native pixel scale and the
// canvas is scaled up by Phaser FIT, so the art never resamples.
//
// Playback waits for a 3-2-1 count, so both armies can be read first.

import {
  BALANCE,
  type BattleEvent,
  type BattleResult,
  type Side,
  type UnitClass,
  type UnitSnapshot,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { FX, packUrl } from "./art";
import {
  BODY,
  BODY_HEIGHT,
  animKey,
  healKey,
  loadUnits,
  makeAnims,
  playPose,
  resolveAnim,
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
import { PackBar, button, label, loadPanels, panel } from "./ui";

const COLS = BALANCE.board.battleCols;
const ROWS = BALANCE.board.battleRows;

/** A 192px unit frame carries an ~80px body, so 84 fills a cell. */
const TILE = 84;

export const GAME_W = 960;
export const GAME_H = 830;

/**
 * Whole 64px terrain tiles. The side margins hold the scenery, so they stay
 * wide enough for a tree. The vertical placement is set by the far army plate:
 * a row 0 unit carries its pip ~100px above its cell centre, so the board has
 * to start low enough to clear it.
 */
const ISLAND: Rect = { x0: 128, y0: 168, x1: 832, y1: 744 };

const BOARD_W = COLS * TILE;
const BOARD_H = ROWS * TILE;
/** Centre of cell (0, 0). */
const ORIGIN_X = (GAME_W - BOARD_W) / 2 + TILE / 2;
const ORIGIN_Y = ISLAND.y0 + (ISLAND.y1 - ISLAND.y0 - BOARD_H) / 2 + TILE / 2;
/** Where the two front rows meet. */
const MID_Y = ORIGIN_Y + (ROWS / 2 - 0.5) * TILE;

const TICK_MS = 1000 / BALANCE.tickRate;
/**
 * A unit acts once a second, so the step nearly fills it. At 420ms it crossed
 * the cell in a snap then stood still, which read as teleporting.
 */
const STEP_MS = 880;

const CLASS_NAME: Record<UnitClass, string> = {
  pawn: "Pawn",
  warrior: "Warrior",
  lancer: "Lancer",
  archer: "Archer",
  monk: "Monk",
};

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

export interface BattleLauncher {
  result: BattleResult;
  seed: number | string;
  onRematch: () => void;
  onNewArmy: () => void;
}

export class BattleScene extends Phaser.Scene {
  private launcher!: BattleLauncher;
  private units = new Map<string, UnitView>();
  private queue: BattleEvent[] = [];
  private simTime = 0;
  private nextEvent = 0;
  private finished = false;
  /** Held until the count finishes. */
  private started = false;
  private speed = 1;
  private bars: Record<Side, PackBar | null> = { a: null, b: null };
  private counts: Record<Side, Phaser.GameObjects.Text | null> = { a: null, b: null };

  constructor() {
    super("battle");
  }

  init(data: BattleLauncher): void {
    this.launcher = data;
    this.units = new Map();
    this.queue = [];
    this.simTime = 0;
    this.nextEvent = 0;
    this.finished = false;
    this.started = false;
    this.speed = 1;
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadPanels(this, [
      "paper",
      "specialPaper",
      "woodTable",
      "blueButton",
      "blueButtonDown",
      "redButton",
      "redButtonDown",
    ]);
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
  }

  create(): void {
    prepareTerrain(this);
    makeAnims(this);
    this.anims.create({
      key: "dust_anim",
      frames: this.anims.generateFrameNumbers("dust", { start: 0, end: FX.dust.frames - 1 }),
      frameRate: 16,
      repeat: 0,
      hideOnComplete: true,
    });

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

    this.spawnArmies();
    this.buildHud();
    this.queue = [...this.launcher.result.events].sort((x, y) => x.t - y.t);
    this.runIntro();
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
      const tag = label(this, GAME_W / 2, MID_Y, steps[i]!, {
        fontSize: last ? "62px" : "92px",
        color: last ? "#f4cf6b" : "#fdf6e6",
        stroke: "#1b1208",
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

    if (!this.started || this.finished) return;
    this.simTime += delta * this.speed;
    const tick = Math.floor(this.simTime / TICK_MS);
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

  /** Events already carry battle-grid coordinates, so no side mapping here. */
  private tileXY(col: number, row: number): { x: number; y: number } {
    return { x: ORIGIN_X + col * TILE, y: ORIGIN_Y + row * TILE };
  }

  private drawGrid(): void {
    const g = this.add.graphics().setDepth(DEPTH.ground);
    const inset = 3;
    const w = TILE - inset * 2;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = this.tileXY(col, row);
        // Shade the near half, so you can see which is yours.
        const mine = row >= ROWS / 2;
        g.fillStyle(mine ? 0x2f4f2a : 0x4a3327, mine ? 0.16 : 0.13);
        g.fillRect(x - w / 2, y - w / 2, w, w);
        g.lineStyle(1.5, 0x1f2a18, 0.32);
        g.strokeRect(x - w / 2, y - w / 2, w, w);
      }
    }
    // Where the two front rows meet.
    g.lineStyle(2, 0xe0b64f, 0.24);
    g.beginPath();
    g.moveTo(ISLAND.x0 + 24, MID_Y);
    g.lineTo(ISLAND.x1 - 24, MID_Y);
    g.strokePath();
  }

  // --- views ---------------------------------------------------------------

  private spawnArmies(): void {
    // Far rows first, so nearer units overlap them.
    const order = [...this.launcher.result.units].sort((a, b) => a.row - b.row);
    for (const snap of order) {
      const { x, y } = this.tileXY(snap.col, snap.row);
      const shadow = addShadow(this, x, y, snap.class === "lancer" ? 0.8 : 0.62);
      const sprite = this.add.sprite(x, y, animKey(snap.side, snap.class, "idle"));
      playPose(sprite, snap.side, snap.class, "idle");
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
        if (view.alive) playPose(sprite, snap.side, snap.class, "idle");
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
    const mine = view.snap.side === "a";
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

    // Far side, on the water above the island.
    panel(this, "paper", GAME_W / 2, 62, 620, 76).setDepth(DEPTH.hud);
    label(this, GAME_W / 2, 42, `THE GREY HOST   ${roster("b")}`, {
      fontSize: "13px",
      color: "#5a4632",
      strokeThickness: 0,
    }).setDepth(DEPTH.hud + 2);
    this.bars.b = new PackBar(this, GAME_W / 2 - 34, 76, 400, 1.5, 0xd9544a, DEPTH.hud + 1);
    this.counts.b = label(this, GAME_W / 2 + 208, 76, "", {
      fontSize: "13px",
      color: "#5a4632",
      strokeThickness: 0,
    }).setDepth(DEPTH.hud + 2);

    // Near side, on a wood table below the island.
    panel(this, "woodTable", GAME_W / 2, 756, 660, 132).setDepth(DEPTH.hud);
    label(this, GAME_W / 2, 726, `YOUR WARBAND   ${roster("a")}`, {
      fontSize: "14px",
    }).setDepth(DEPTH.hud + 2);
    this.bars.a = new PackBar(this, GAME_W / 2 - 34, 756, 400, 1.5, 0x86d15e, DEPTH.hud + 1);
    this.counts.a = label(this, GAME_W / 2 + 208, 756, "", { fontSize: "13px" }).setDepth(
      DEPTH.hud + 2,
    );

    // The kit small square button is a single image, not a nine-slice.
    const speedBtn = this.add
      .image(GAME_W - 88, 752, "smallButton")
      .setScale(0.8)
      .setDepth(DEPTH.hud + 1)
      .setInteractive({ useHandCursor: true });
    const speedText = label(this, GAME_W - 88, 748, "1x", { fontSize: "17px" }).setDepth(
      DEPTH.hud + 2,
    );
    speedBtn.on("pointerup", () => {
      this.speed = this.speed === 1 ? 2 : 1;
      speedText.setText(`${this.speed}x`);
    });

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
    const { x, y } = this.tileXY(ev.col, ev.row);
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
        if (view.alive) playPose(view.sprite, view.snap.side, view.snap.class, "idle");
      },
    });
  }

  /**
   * The Lancer is the only class with vertical thrusts, which a vertical board
   * mostly wants; a sideways target still gets the level thrust.
   */
  private onAttack(ev: Extract<BattleEvent, { type: "attack" }>): void {
    const attacker = this.view(ev.unit);
    const target = this.view(ev.target);
    if (!attacker.alive || !target.alive) return;

    const dx = target.sprite.x - attacker.sprite.x;
    const dy = target.sprite.y - attacker.sprite.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 0.8;
    const pose = vertical ? (dy < 0 ? "attackUp" : "attackDown") : "attack";

    if (Math.abs(dx) > 0.5 && resolveAnim(attacker.snap.class, pose) === "attack") {
      attacker.sprite.setFlipX(dx < 0);
    }
    playPose(attacker.sprite, attacker.snap.side, attacker.snap.class, pose);

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
        fontFamily: "ui-monospace, Consolas, monospace",
        fontSize: "17px",
        color,
        stroke: "#1a1208",
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
    const away = target.sprite.x + (target.snap.side === "a" ? -5 : 5);
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
      .sprite(target.sprite.x, target.sprite.y - BODY_HEIGHT[target.snap.class] / 2, healKey(target.snap.side))
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
    playPose(view.sprite, view.snap.side, view.snap.class, "idle");
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
    const { result } = this.launcher;
    const headline =
      result.winner === "a"
        ? "THE LINE HELD"
        : result.winner === "b"
          ? "THE GREY TAKES YOU"
          : "NEITHER SIDE YIELDS";

    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0c10, 0.55)
      .setDepth(DEPTH.hud + 10);
    const card = panel(this, "paper", GAME_W / 2, GAME_H / 2, 560, 360).setDepth(
      DEPTH.hud + 11,
    );
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

    const again = button(this, GAME_W / 2 - 100, GAME_H / 2 + 88, 208, 136, "Rematch", "blue", () =>
      this.launcher.onRematch(),
    )
      .setScale(0.85)
      .setDepth(DEPTH.hud + 12);
    const fresh = button(this, GAME_W / 2 + 100, GAME_H / 2 + 88, 208, 136, "New army", "red", () =>
      this.launcher.onNewArmy(),
    )
      .setScale(0.85)
      .setDepth(DEPTH.hud + 12);

    for (const o of [veil, card, title, detail, again, fresh]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 260 });
    }
  }
}

/** FIT scaling fits the logical board to whatever the page gives it. */
export function startBattle(
  parent: HTMLElement,
  launcher: BattleLauncher,
): { destroy: () => void } {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#12324a",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H,
    },
  });
  game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.add("battle", BattleScene, true, launcher);
  });
  return { destroy: () => game.destroy(true) };
}
