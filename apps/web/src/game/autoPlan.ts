// Skirmish's plan phase: the shop, the bench and your half of the board, over
// the island the fight is played on. The engine owns the run; this draws it
// and turns clicks and drags into its actions.

import {
  AUTO,
  BALANCE,
  armyOf,
  sellValue,
  traitsOf,
  xpToNext,
  type BattleResult,
  type LobbyRound,
  type Piece,
  type Run,
  type RunAction,
  type Champion,
  type Spot,
  type TraitKey,
} from "@greyfall/engine";
import * as Phaser from "phaser";

import { AVATARS, ICON, iconKey, packUrl } from "./art";
import { GAME_W, WATER_SPAN } from "./boot";
import { BODY_HEIGHT, bodyScale, championAvatar, playPose, unitKey } from "./sprites";
import { DEPTH, addShadow } from "./terrain";
import { FONT, HAND, button, label, panel, ribbon } from "./ui";

export const CLASS_NAME: Record<Champion, string> = {
  pawn: "Pawn",
  warrior: "Warrior",
  lancer: "Lancer",
  archer: "Archer",
  monk: "Monk",
  skull: "Skull",
  torch: "Torch Goblin",
  gnoll: "Gnoll",
  thief: "Thief",
  shaman: "Hex Shaman",
  troll: "Troll",
  minotaur: "Minotaur",
};

/** A knight's portrait, from the pack's 25 avatars. */
export const PORTRAIT = { warrior: 1, lancer: 2, archer: 3, monk: 4, pawn: 5 } as const;

/** Every class's portrait: a knight's avatar, or a monster's own from the Enemy Pack. */
export function portraitUrl(cls: Champion): string {
  return cls in PORTRAIT
    ? packUrl(`${AVATARS.file}${String(PORTRAIT[cls as keyof typeof PORTRAIT]).padStart(2, "0")}.png`)
    : championAvatar(cls as Exclude<Champion, keyof typeof PORTRAIT>);
}

/** Ink bounds [x0, y0, x1, y1] of each 256px avatar, measured off the art:
 *  the padding differs per face, so one scale drew them at different sizes. */
export const PORTRAIT_INK: Record<Champion, [number, number, number, number]> = {
  warrior: [22, 31, 219, 213],
  lancer: [52, 58, 201, 187],
  archer: [64, 29, 204, 189],
  monk: [57, 44, 201, 199],
  pawn: [56, 47, 212, 191],
  skull: [39, 59, 201, 202],
  torch: [40, 63, 206, 218],
  gnoll: [42, 38, 220, 201],
  thief: [40, 49, 219, 205],
  shaman: [39, 55, 204, 213],
  troll: [21, 17, 233, 252],
  minotaur: [32, 26, 219, 214],
};

export interface AutoHooks {
  run: () => Run;
  /** Seat 0's action; the error to show, or null once applied. */
  act: (a: RunAction) => string | null;
  /** Resolves the round for every clan and returns seat 0's fight. */
  fight: () => { result: BattleResult | null; foe: string; round: LobbyRound };
  /** A fresh lobby. */
  again: () => void;
}

/** What the plan needs from the scene that hosts it. */
export interface PlanHost {
  scene: Phaser.Scene;
  box: Phaser.GameObjects.Container;
  hooks: AutoHooks;
  /** Own-half cell under a world point, and where a unit on a cell stands. */
  cellAt: (x: number, y: number) => { col: number; row: number } | null;
  standAt: (col: number, row: number) => { x: number; y: number };
  say: (line: string) => void;
  remark: (line: string) => void;
  onTip?: (text: string | null, x: number, y: number) => void;
  fight: () => void;
}

const BENCH = { x0: 204, y: 574, size: 54, scale: 0.6 } as const;
/** The plan panel's left edge: a unit dropped past it is sold. */
const PANEL_X0 = 612;
const STAR_INK = [0, 0xc7884a, 0xdfe6ee, 0xf4cf6b];
const TIER_INK = [0, 0x8a8a8a, 0x4c9a4c, 0x3d6fc4, 0x9a4fc4];
const pct = (f: number): string => `${Math.round(f * 100)}%`;
const AB = BALANCE.abilities;

/** Each class's ability line on its card, and the tooltip that explains it. */
export const ABILITY: Partial<Record<Champion, { name: string; tip: string; on: boolean }>> = {
  warrior: {
    name: "Guard",
    tip: `Guard: once a battle, below ${pct(AB.guard.hpBelow)} health, takes ${pct(1 - AB.guard.damageTaken)} less damage for ${AB.guard.seconds}s`,
    on: AB.guard.enabled,
  },
  lancer: {
    name: "Taunt",
    tip: `Taunt: enemies within ${AB.taunt.radius} tiles must attack it`,
    on: AB.taunt.enabled,
  },
  archer: {
    name: "Piercing shot",
    tip: `Piercing shot: one arrow in ${AB.pierce.every} also hits the enemy behind for ${pct(AB.pierce.damage)} damage`,
    on: AB.pierce.enabled,
  },
  monk: {
    name: "Revive",
    tip: `Revive: once a battle, raises the first fallen ally at ${pct(AB.revive.hp)} health`,
    on: AB.revive.enabled,
  },
  skull: {
    name: "Reassemble",
    tip: `Reassemble: once a battle, the blow that would kill it leaves it at ${pct(AB.reassemble.hp)} health`,
    on: AB.reassemble.enabled,
  },
  torch: {
    name: "Splash",
    tip: `Splash: every hit also burns the enemies beside its target for ${pct(AB.splash.damage)} damage`,
    on: AB.splash.enabled,
  },
  gnoll: {
    name: "Hunter",
    tip: `Hunter: ${pct(AB.hunter.bonus)} more damage to targets below ${pct(AB.hunter.below)} health`,
    on: AB.hunter.enabled,
  },
  thief: {
    name: "Ambush",
    tip: "Ambush: opens the battle by leaping beside the enemy furthest back",
    on: AB.ambush.enabled,
  },
  shaman: {
    name: "Hex",
    tip: `Hex: one bolt in ${AB.hex.every} costs its target ${AB.hex.seconds}s before its next action`,
    on: AB.hex.enabled,
  },
  troll: {
    name: "Regenerate",
    tip: `Regenerate: regains ${pct(AB.regenerate.perSecond)} of its health every second`,
    on: AB.regenerate.enabled,
  },
  minotaur: {
    name: "Cleave",
    tip: `Cleave: every swing also hits each other enemy beside it for ${pct(AB.cleave.damage)} damage`,
    on: AB.cleave.enabled,
  },
};

/**
 * An unaffordable button stays solid, greyed like the handbook's idle tabs:
 * alpha let the paper show through the frame and smeared it.
 */
function dimButton(btn: Phaser.GameObjects.Container, off: boolean): void {
  const face = btn.list[0] as Phaser.GameObjects.NineSlice;
  const text = btn.list[1] as Phaser.GameObjects.Text;
  if (off) {
    face.setTint(0x9aa4aa);
    text.setColor("#e4e8ea").setStroke("#4a5560", 3);
  } else {
    face.clearTint();
    text.setColor(String(FONT.color)).setStroke(String(FONT.stroke), FONT.strokeThickness ?? 3);
  }
}

/** Monsters look alike on both teams, so their ground disc wears the team's colour. */
export function teamShadow(shadow: Phaser.GameObjects.Image, side: "a" | "b", cls: Champion): Phaser.GameObjects.Image {
  if (!(cls in PORTRAIT)) shadow.setTintFill(side === "a" ? 0x3d7fd9 : 0xd9443d).setAlpha(0.55);
  return shadow;
}

/** Star pips over a unit, bronze, silver or gold by level. */
export function drawStars(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, r = 5): void {
  for (let k = 0; k < n; k++) {
    const cx = x + (k - (n - 1) / 2) * r * 2.3;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 === 0 ? r : r * 0.45;
      return { x: cx + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
    g.fillStyle(STAR_INK[n]!, 1).fillPoints(pts, true);
    g.lineStyle(1.2, 0x2e2417, 0.9).strokePoints(pts, true);
  }
}

/** Who a trait helps, in a phrase. */
export function traitWho(key: TraitKey): string {
  return key === "horde" ? "Monsters" : `${CLASS_NAME[key]}s`;
}

/** What a trait does at one tier. */
export function traitEffect(key: TraitKey, tier: number): string {
  const v = AUTO.traits[key].values[tier]!;
  const who = traitWho(key);
  return {
    damageTaken: `${who} take ${pct(1 - v)} less damage`,
    hp: `${who} gain ${pct(v - 1)} health`,
    attackSeconds: `${who} attack every ${v}s`,
    heal: `${who} heal ${pct(v - 1)} more`,
    gold: `+${v} gold after each round`,
    damage: `${who} deal ${pct(v - 1)} more damage`,
  }[AUTO.traits[key].effect];
}

/** Which trait a class counts toward. */
export function traitOf(cls: Champion): TraitKey {
  return cls in AUTO.traits ? (cls as TraitKey) : "horde";
}

/** One line per trait: what it does at the tier it has reached, or the first. */
export function traitLine(key: TraitKey, count: number, tier: number): string {
  const t = AUTO.traits[key];
  const unit = t.kinds ? " kinds" : "";
  return `${t.name} ${count}/${t.at[Math.min(tier + 1, t.at.length - 1)]}${unit}  ${traitEffect(key, Math.max(0, tier))}`;
}

function unitTip(cls: Champion): string {
  const s = BALANCE.units[cls];
  const t = AUTO.traits[traitOf(cls)];
  const main = s.heal > 0 ? `heals ${s.heal}` : `${s.damage} damage`;
  return `${CLASS_NAME[cls]}: ${AUTO.tier[cls]} gold, ${s.hp} health, ${main}, range ${s.range}. ${t.name} at ${t.at.join(", ")}${t.kinds ? " kinds" : ""}.`;
}

function ordinal(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

interface PieceView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  stars: Phaser.GameObjects.Graphics;
}

export class AutoPlan {
  private readonly scene: Phaser.Scene;
  private views = new Map<number, PieceView>();
  /** Star level each piece last drew at, so a new or merged one gets its puff. */
  private seen = new Map<number, number>();
  private dyn!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private gold!: Phaser.GameObjects.Text;
  private boardCount!: Phaser.GameObjects.Text;
  private sellVeil!: Phaser.GameObjects.Container;
  private sellText!: Phaser.GameObjects.Text;
  private buttons!: { reroll: Phaser.GameObjects.Container; xp: Phaser.GameObjects.Container };
  private drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  private selected: number | null = null;
  private ground!: Phaser.GameObjects.Graphics;
  private benchLabel!: Phaser.GameObjects.Text;

  constructor(private readonly host: PlanHost) {
    this.scene = host.scene;
    this.buildPanel();
    this.buildBench();
    this.bindInput();
    this.refresh();
  }

  private run(): Run {
    return this.host.hooks.run();
  }

  private act(a: RunAction): boolean {
    const error = this.host.hooks.act(a);
    if (error) this.host.remark(error);
    this.refresh();
    return error === null;
  }

  // --- panel -----------------------------------------------------------------

  private buildPanel(): void {
    const s = this.scene;
    const box = this.host.box;
    box.add(panel(s, "paper", 900, 360, 576, 688));
    box.add(ribbon(s, 900, 52, 380));
    this.title = label(s, 900, 48, "", { fontSize: "20px" });
    const ink = { fontSize: "16px", color: "#4a3a28", strokeThickness: 0 };
    this.stats = label(s, 652, 96, "", ink).setOrigin(0, 0.5);
    const coin = s.add.image(1032, 96, iconKey(ICON.gold)).setScale(0.4);
    this.gold = label(s, 1048, 96, "", { ...ink, color: "#7a4f14" }).setOrigin(0, 0.5);
    this.dyn = s.add.container(0, 0);
    box.add([this.title, this.stats, coin, this.gold, this.dyn]);

    this.buttons = {
      reroll: button(s, 714, 566, 176, 104, `Reroll  ${AUTO.reroll}g`, "blue", () => this.act({ type: "reroll" })),
      xp: button(s, 900, 566, 176, 104, `Level up  ${AUTO.xpBuy.gold}g`, "blue", () => this.act({ type: "xp" })),
    };
    const fight = button(s, 1086, 566, 176, 104, "Fight", "red", () => this.host.fight());
    box.add([this.buttons.reroll, this.buttons.xp, fight]);
    box.add(
      label(s, 900, 644, "Drag units onto your half, drop one here to sell.  D reroll, F level up, H handbook.", {
        fontSize: "13px",
        color: "#7a6a52",
        strokeThickness: 0,
      }),
    );

    // Shown while a unit is dragged over the panel: letting go there sells it.
    const veil = s.add.rectangle(900, 360, 560, 672, 0x1c140c, 0.6);
    this.sellText = label(s, 900, 360, "", { fontSize: "24px", color: "#f4cf6b" });
    this.sellVeil = s.add.container(0, 0, [veil, this.sellText]).setVisible(false);
    box.add(this.sellVeil);
  }

  private buildBench(): void {
    const s = this.scene;
    this.ground = s.add.graphics().setDepth(DEPTH.ground + 1);
    this.boardCount = label(s, 390, 492, "", { fontSize: "14px" }).setDepth(DEPTH.hud);
    this.benchLabel = label(s, BENCH.x0 - 2, BENCH.y - 42, "BENCH", { fontSize: "13px" }).setOrigin(0, 0.5);
    this.benchLabel.setDepth(DEPTH.hud);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.host.onTip?.(null, 0, 0));
  }

  private benchXY(i: number): { x: number; y: number } {
    return { x: BENCH.x0 + i * BENCH.size, y: BENCH.y };
  }

  private spotAt(x: number, y: number): Spot | null {
    const i = Math.round((x - BENCH.x0) / BENCH.size);
    if (i >= 0 && i < AUTO.benchSlots && Math.abs(y - BENCH.y) <= BENCH.size / 2 && Math.abs(x - this.benchXY(i).x) <= BENCH.size / 2)
      return { bench: i };
    return this.host.cellAt(x, y);
  }

  private pieceAt(spot: Spot): Piece | null {
    const seat = this.run().seats[0]!;
    if ("bench" in spot) return seat.bench[spot.bench] ?? null;
    return seat.board.find((p) => p.col === spot.col && p.row === spot.row) ?? null;
  }

  // --- input -----------------------------------------------------------------

  private bindInput(): void {
    const input = this.scene.input;
    input.on("pointerdown", (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const spot = this.spotAt(p.worldX, p.worldY);
      const piece = spot && this.pieceAt(spot);
      // Click a unit, then click where it goes: the touch-friendly half of dragging.
      if (this.selected !== null && spot && piece?.id !== this.selected) {
        const id = this.selected;
        this.selected = null;
        this.act({ type: "move", piece: id, to: spot });
        return;
      }
      if (piece) this.drag = { id: piece.id, x: p.worldX, y: p.worldY, moved: false };
      else if (this.selected !== null) {
        this.selected = null;
        this.refresh();
      }
    });
    input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d) return;
      if (Math.hypot(p.worldX - d.x, p.worldY - d.y) > 8) d.moved = true;
      if (!d.moved) return;
      const v = this.views.get(d.id);
      v?.sprite.setPosition(p.worldX, p.worldY + 30).setDepth(DEPTH.hud + 20);
      v?.shadow.setVisible(false);
      v?.stars.setVisible(false);
      const selling = p.worldX > PANEL_X0;
      this.sellVeil.setVisible(selling);
      if (selling) {
        const piece = this.findOwned(d.id);
        if (piece) this.sellText.setText(`Sell for ${sellValue(piece)} gold`);
      }
    });
    input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      this.sellVeil.setVisible(false);
      if (!d.moved) {
        this.selected = this.selected === d.id ? null : d.id;
        if (this.selected !== null) this.host.say("Now click where it goes.");
        this.refresh();
        return;
      }
      if (p.worldX > PANEL_X0) this.act({ type: "sell", piece: d.id });
      else {
        const spot = this.spotAt(p.worldX, p.worldY);
        if (spot) this.act({ type: "move", piece: d.id, to: spot });
        else this.refresh();
      }
    });
    this.scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.scene.data.get("handbook")) return;
      if (e.key === "d" || e.key === "D") this.act({ type: "reroll" });
      if (e.key === "f" || e.key === "F") this.act({ type: "xp" });
    });
  }

  private findOwned(id: number): Piece | null {
    const seat = this.run().seats[0]!;
    return seat.board.find((p) => p.id === id) ?? seat.bench.find((p) => p?.id === id) ?? null;
  }

  /**
   * The fight takes the board: the bench and every plan marking fade with the
   * panel's exit, and the units on the board stay put for the battle to take over.
   */
  leave(ms: number): void {
    const seat = this.run().seats[0]!;
    const benched = new Set(seat.bench.flatMap((p) => (p ? [p.id] : [])));
    const parts: Phaser.GameObjects.GameObject[] = [this.ground, this.boardCount, this.benchLabel];
    for (const [id, v] of this.views) parts.push(v.stars, ...(benched.has(id) ? [v.sprite, v.shadow] : []));
    this.scene.tweens.add({ targets: parts, alpha: 0, duration: ms, ease: "Quint.easeOut" });
  }

  // --- drawing ---------------------------------------------------------------

  refresh(): void {
    const run = this.run();
    const seat = run.seats[0]!;
    this.title.setText(`ROUND ${run.round}`);
    const next = xpToNext(seat.level);
    const xp = seat.level >= AUTO.maxLevel ? "max" : `${seat.xp}/${next} xp`;
    this.stats.setText(`${Math.max(0, seat.hp)} health     Level ${seat.level}  ${xp}`);
    const interest = Math.min(AUTO.interestMax, Math.floor(seat.gold / 10));
    this.gold.setText(`${seat.gold}${interest > 0 ? `  +${interest}` : ""}`);
    dimButton(this.buttons.reroll, seat.gold < AUTO.reroll);
    dimButton(this.buttons.xp, seat.gold < AUTO.xpBuy.gold || seat.level >= AUTO.maxLevel);

    this.dyn.removeAll(true);
    this.drawLobby(run);
    this.drawTraits(run);
    this.drawShop(run);
    this.drawGround(run);
    this.drawPieces(run);
  }

  private drawLobby(run: Run): void {
    const s = this.scene;
    const order = run.seats
      .map((seat, i) => ({ seat, i }))
      .sort((x, y) => (x.seat.place ?? 0) - (y.seat.place ?? 0) || y.seat.hp - x.seat.hp);
    const g = s.add.graphics();
    this.dyn.add(g);
    for (const [k, { seat, i }] of order.entries()) {
      const y = 134 + k * 23;
      const out = seat.place !== null;
      const ink = i === 0 ? "#2f5d8a" : "#4a3a28";
      const name = label(s, 652, y, i === 0 ? `${seat.name} (you)` : seat.name, {
        fontSize: "14px",
        color: ink,
        strokeThickness: 0,
      }).setOrigin(0, 0.5);
      const frac = Math.max(0, seat.hp) / AUTO.startHp;
      g.fillStyle(0x3d3123, 0.25).fillRect(850, y - 4, 180, 8);
      if (!out) g.fillStyle(frac > 0.6 ? 0x6fcf4f : frac > 0.3 ? 0xe8c547 : 0xd9544a, 1).fillRect(850, y - 4, 180 * frac, 8);
      const hp = label(s, 1042, y, out ? `${ordinal(seat.place!)}` : `${seat.hp}`, {
        fontSize: "14px",
        color: out ? "#8c3a30" : ink,
        strokeThickness: 0,
      }).setOrigin(0, 0.5);
      if (out) name.setAlpha(0.5);
      this.dyn.add([name, hp]);
    }
  }

  private drawTraits(run: Run): void {
    const lines = traitsOf(armyOf(run.seats[0]!));
    if (lines.length === 0) {
      this.dyn.add(
        label(this.scene, 900, 262, "Two or more of a class on the board switch on its trait.", {
          fontSize: "13px",
          color: "#9a8a70",
          strokeThickness: 0,
        }),
      );
      return;
    }
    for (const [k, t] of lines.entries()) {
      const on = t.tier >= 0;
      this.dyn.add(
        label(this.scene, 652, 238 + k * 19, traitLine(t.key, t.count, t.tier), {
          fontSize: "13px",
          color: on ? "#2f5d8a" : "#9a8a70",
          strokeThickness: 0,
        }).setOrigin(0, 0.5),
      );
    }
  }

  private drawShop(run: Run): void {
    const s = this.scene;
    const seat = run.seats[0]!;
    const ones = (cls: Champion): number =>
      [...seat.board, ...seat.bench].filter((p) => p?.class === cls && p?.stars === 1).length;
    for (const [slot, cls] of seat.shop.entries()) {
      const cx = 900 + (slot - 2) * 106;
      const cy = 418;
      const g = s.add.graphics();
      const card = s.add.container(cx, cy, [g]);
      this.dyn.add(card);
      if (!cls) {
        g.fillStyle(0x3d3123, 0.12).fillRoundedRect(-48, -72, 96, 144, 10);
        continue;
      }
      const afford = seat.gold >= AUTO.tier[cls];
      g.fillStyle(0xf2e7cf, 1).fillRoundedRect(-48, -72, 96, 144, 10);
      g.lineStyle(4, TIER_INK[AUTO.tier[cls]]!, 1).strokeRoundedRect(-48, -72, 96, 144, 10);
      const [x0, y0, x1, y1] = PORTRAIT_INK[cls];
      const face = s.add
        .image(0, -22, `avatar_${cls}`)
        .setOrigin((x0 + x1) / 2 / 256, (y0 + y1) / 2 / 256)
        .setScale(58 / Math.max(x1 - x0, y1 - y0));
      if (!afford) face.setTint(0x8a8a8a);
      const name = label(s, 0, 30, CLASS_NAME[cls], { fontSize: "15px", color: "#4a3a28", strokeThickness: 0 });
      const cost = label(s, 6, 54, `${AUTO.tier[cls]}`, {
        fontSize: "16px",
        color: afford ? "#7a4f14" : "#b0443a",
        strokeThickness: 0,
      }).setOrigin(0, 0.5);
      const coin = s.add.image(-8, 54, iconKey(ICON.gold)).setScale(0.36);
      card.add([face, name, cost, coin]);
      // Copies already owned: at two, this buy makes a 2-star.
      const have = ones(cls);
      if (have > 0) {
        const tag = label(s, 38, -60, `${have}/3`, {
          fontSize: "13px",
          color: have >= 2 ? "#b8860b" : "#7a6a52",
          strokeThickness: 0,
        }).setOrigin(1, 0.5);
        card.add(tag);
      }
      card
        .setSize(96, 144)
        .setInteractive({ cursor: HAND })
        .on("pointerover", (p: Phaser.Input.Pointer) => {
          const e = p.event as MouseEvent | undefined;
          this.host.onTip?.(unitTip(cls), e?.clientX ?? 0, e?.clientY ?? 0);
          card.setY(cy - 4);
        })
        .on("pointerout", () => {
          this.host.onTip?.(null, 0, 0);
          card.setY(cy);
        })
        .on("pointerup", () => {
          this.host.onTip?.(null, 0, 0);
          if (this.act({ type: "buy", slot }) && this.run().seats[0]!.board.length === 0)
            this.host.say("Drag it from the bench onto your half of the board.");
        });
    }
  }

  private drawGround(run: Run): void {
    const seat = run.seats[0]!;
    const g = this.ground.clear();
    const w = BENCH.size - 4;
    for (let i = 0; i < AUTO.benchSlots; i++) {
      const { x, y } = this.benchXY(i);
      g.fillStyle(0x1c2634, 0.32).fillRoundedRect(x - w / 2, y - w / 2, w, w, 6);
      g.lineStyle(1.5, 0xfdf6e6, 0.35).strokeRoundedRect(x - w / 2, y - w / 2, w, w, 6);
    }
    const full = seat.board.length >= seat.level;
    this.boardCount
      .setText(`On the board ${seat.board.length}/${seat.level}`)
      .setColor(full ? "#f4cf6b" : "#fdfaf0");
  }

  private drawPieces(run: Run): void {
    const s = this.scene;
    const seat = run.seats[0]!;
    for (const v of this.views.values()) {
      v.sprite.destroy();
      v.shadow.destroy();
      v.stars.destroy();
    }
    this.views.clear();
    const placed: { piece: Piece; x: number; y: number; scale: number }[] = [
      ...seat.board.map((p) => ({ piece: p, ...this.host.standAt(p.col, p.row), scale: 1 + 0.1 * (p.stars - 1) })),
      ...seat.bench.flatMap((p, i) =>
        p ? [{ piece: p, x: this.benchXY(i).x, y: this.benchXY(i).y + 16, scale: BENCH.scale }] : [],
      ),
    ];
    const live = new Set<number>();
    for (const { piece, x, y, scale } of placed) {
      live.add(piece.id);
      const shadow = teamShadow(addShadow(s, x, y, (piece.class === "lancer" ? 0.8 : 0.62) * scale), "a", piece.class);
      const sprite = s.add.sprite(x, y, unitKey("a", piece.class, "idle"));
      playPose(sprite, "a", piece.class, "idle");
      sprite.setScale(scale * bodyScale(piece.class)).setDepth(DEPTH.unit + y);
      if (piece.id === this.selected) sprite.setTint(0xfff1a8);
      const stars = s.add.graphics().setDepth(DEPTH.unit + y + 1);
      drawStars(stars, x, y - BODY_HEIGHT[piece.class] * scale - 8, piece.stars, scale < 1 ? 4 : 5);
      this.views.set(piece.id, { sprite, shadow, stars });

      // A new unit arrives in a puff; a merged one pops up a size.
      const before = this.seen.get(piece.id);
      if (before === undefined || before < piece.stars) {
        const dust = s.add.sprite(x, y, "dust").setOrigin(0.5, 0.85).setDepth(DEPTH.unit + y + 2).setScale(2.4 * scale);
        dust.setAlpha(0.8).play("dust_anim");
        if (before !== undefined) {
          sprite.setScale(scale * bodyScale(piece.class) * 1.35);
          s.tweens.add({ targets: sprite, scale: scale * bodyScale(piece.class), duration: 320, ease: "Back.easeOut" });
          this.host.remark(`${CLASS_NAME[piece.class]} is now ${piece.stars} stars.`);
        }
      }
      this.seen.set(piece.id, piece.stars);
    }
    for (const id of [...this.seen.keys()]) if (!live.has(id)) this.seen.delete(id);
  }
}

/**
 * After a round: who won, what it cost, the lobby, and the gold coming. A
 * knocked-out seat, or the last one standing, gets its place instead.
 */
export function roundCard(
  scene: Phaser.Scene,
  run: Run,
  round: LobbyRound,
  onContinue: () => void,
  onAgain: () => void,
  onMenu: () => void,
): void {
  const cx = GAME_W / 2;
  const cy = 360;
  const me = run.seats[0]!;
  const mine = round.fights.find((f) => f.a === 0);
  const won = mine?.winner === 0;
  const lost = mine !== undefined && mine.winner !== null && !won;
  const foe = mine ? run.seats[mine.b]!.name : "";
  const done = me.place !== null;

  const headline = done
    ? me.place === 1
      ? "THE ISLAND IS YOURS"
      : "KNOCKED OUT"
    : `ROUND ${round.round} ${won ? "WON" : lost ? "LOST" : "DRAWN"}`;
  const detail = done
    ? `${ordinal(me.place!)} of ${run.seats.length}, after ${round.round} rounds`
    : won
      ? `${foe} takes ${mine!.damage} damage`
      : lost
        ? `${foe} hits you for ${mine!.damage}`
        : "Nobody takes damage";

  const parts: Phaser.GameObjects.GameObject[] = [];
  parts.push(scene.add.rectangle(cx, cy, WATER_SPAN.w, WATER_SPAN.h, 0x050608, 0.82));
  parts.push(
    label(scene, cx, cy - 190, headline, {
      fontSize: "40px",
      color: won || me.place === 1 ? "#f4cf6b" : lost || done ? "#e0796a" : "#c9cdd4",
      strokeThickness: 0,
    }),
  );
  parts.push(label(scene, cx, cy - 140, detail, { fontSize: "16px", color: "#b9a887", strokeThickness: 0 }));

  // The lobby, with this round's damage beside each clan that took some.
  const hurt = new Map<number, number>();
  for (const f of round.fights) {
    if (f.winner === null) continue;
    const loser = f.winner === f.a ? f.b : f.a;
    if (!(f.ghost && loser === f.b)) hurt.set(loser, f.damage);
  }
  const order = run.seats
    .map((s, i) => ({ s, i }))
    .sort((x, y) => (x.s.place ?? 0) - (y.s.place ?? 0) || y.s.hp - x.s.hp);
  for (const [k, { s, i }] of order.entries()) {
    const y = cy - 88 + k * 28;
    const ink = i === 0 ? "#9fd4ff" : "#e6dccb";
    parts.push(label(scene, cx - 150, y, s.name, { fontSize: "16px", color: ink, strokeThickness: 0 }).setOrigin(0, 0.5));
    const hp = s.place !== null ? ordinal(s.place) : `${s.hp}`;
    parts.push(label(scene, cx + 90, y, hp, { fontSize: "16px", color: ink, strokeThickness: 0 }).setOrigin(1, 0.5));
    const d = hurt.get(i);
    if (d) parts.push(label(scene, cx + 104, y, `-${d}`, { fontSize: "15px", color: "#e0796a", strokeThickness: 0 }).setOrigin(0, 0.5));
  }

  const pay = round.income[0];
  if (!done && pay) {
    const bits = [`${pay.base} base`];
    if (pay.interest) bits.push(`${pay.interest} interest`);
    if (pay.streak) bits.push(`${pay.streak} streak`);
    if (pay.win) bits.push(`${pay.win} win`);
    if (pay.prospectors) bits.push(`${pay.prospectors} Prospectors`);
    const total = pay.base + pay.interest + pay.streak + pay.win + pay.prospectors;
    parts.push(
      label(scene, cx, cy + 40, `+${total} gold: ${bits.join(", ")}`, { fontSize: "15px", color: "#e8c06a", strokeThickness: 0 }),
    );
  }

  const menu = label(scene, cx, cy + 190, "Return to menu", { fontSize: "15px", color: "#b9a887", strokeThickness: 0 })
    .setInteractive({ cursor: HAND })
    .on("pointerover", () => menu.setColor("#fdfaf0"))
    .on("pointerout", () => menu.setColor("#b9a887"))
    .on("pointerup", onMenu);
  parts.push(menu);
  parts.push(
    done
      ? button(scene, cx, cy + 110, 220, 120, "Play again", "blue", onAgain).setScale(0.85)
      : button(scene, cx, cy + 110, 220, 120, "Continue", "blue", onContinue).setScale(0.85),
  );

  for (const o of parts) {
    const go = o as Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject;
    go.setDepth(DEPTH.hud + 11).setAlpha(0);
    scene.tweens.add({ targets: go, alpha: 1, duration: 260 });
  }
}
