// The strategic map's Warcraft-style HUD: a ribbon naming the round along
// the top, resources and menu in the corners, and a wooden console along the
// bottom with the minimap, the selection panel and the command card. Its own
// scene on top of the map, so zooming the map's camera never scales the HUD,
// and a click on the console never reaches the map below.
//
// It draws whatever the map scene's model says and calls back into it; the
// war itself lives in the engine and the map scene.

import type { UnitClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { AVATARS, iconKey, iconUrl, packUrl } from "./art";
import { WATER, baseZoom } from "./boot";
import { ARROW, HAND, button, label, loadPanels, panel } from "./ui";

export const HUD_KEY = "strategicHud";
/** The bottom console's height in HUD units. */
const BAR_H = 176;
/** How much of the screen's bottom the HUD covers; the map scrolls up past it. */
export const HUD_COVER_H = BAR_H;

/** The pack's icon sheet, by what each stands for on the command card. */
export const ICON = {
  build: "01",
  gold: "03",
  meat: "04",
  attack: "05",
  hold: "06",
  move: "07",
  back: "08",
  stop: "09",
  menu: "10",
  info: "11",
} as const;

export interface HudCommand {
  /** Short text on the button, always shown: the pack's icons are too few to
   *  tell every command apart on their own. */
  label: string;
  /** An icon sheet number, drawn over the label. */
  icon?: string;
  /** A troop's portrait texture, drawn in place of an icon. */
  portrait?: string;
  /** A second line under the label, such as a price. */
  sub?: string;
  /** Fills the card's top-left 2x2 block; only honoured in the first slot. */
  big?: boolean;
  /** Shown in the selection panel while hovered. */
  hint: string;
  onClick: () => void;
  enabled?: boolean;
  /** Lit, for a mode waiting on a click on the map. */
  active?: boolean;
}

export interface HudModel {
  round: number;
  gold: number;
  supply: [used: number, cap: number];
  /** Rounds until the Greying first bites, 0 once it has begun. */
  greyIn: number;
  /** The ribbon along the top, and its colour: blue while planning, red in battle. */
  banner: { text: string; tone: "blue" | "red" };
  title: string;
  detail: string;
  /** A texture key for the selection panel's portrait. */
  portrait: string | null;
  hp: [cur: number, max: number] | null;
  /** A line under the ribbon: what just went wrong, or what to do next. */
  message: string;
  commands: (HudCommand | null)[];
  /** The sword is the round's one big action; the others are plain buttons. */
  primary: { label: string; style: "sword" | "blue"; onClick: () => void } | null;
  secondary: { label: string; onClick: () => void }[];
  /** The round report or the end of the match, over everything. */
  report: { title: string; tone: "blue" | "red"; lines: string[]; button: string; onClick: () => void; also?: { label: string; onClick: () => void } } | null;
  dots: { col: number; row: number; side: "a" | "b" }[];
  /** The walkthrough line the speaking Pawn says, with what it points at. */
  tutorial: {
    text: string;
    focus: "barracks" | "army" | "fight" | null;
    button: { label: string; onClick: () => void } | null;
    onSkip: () => void;
  } | null;
}

export interface HudData {
  /** The map rows, `~ . # < >` as StrategicScene draws them. */
  map: readonly string[];
  /** Halls as minimap dots, in cells. */
  marks: { col: number; row: number; side: "a" | "b" | "g" }[];
  onMenu: () => void;
  onZoom: (dir: 1 | -1) => void;
  /** A click on the minimap, in cells. */
  onMinimap: (col: number, row: number) => void;
  /** The speaking Pawn's head in HUD units, asked every frame as the map pans. */
  speaker: () => { x: number; y: number } | null;
  model: () => HudModel;
}

/** One piece of the speech bubble, placed at an offset from its centre. */
interface BubblePart {
  o: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth;
  dx: number;
  dy: number;
}

/** The paper art's fill, for the speech bubble's tail. */
const PAPER = 0xeee1c6;
const BUBBLE_W = 300;

/** Portraits: the blue knights' five faces, and each monster's own. */
const KNIGHT_FACE: Record<UnitClass, number> = { warrior: 1, lancer: 2, archer: 3, monk: 4, pawn: 5 };
const MONSTER_FACE: Record<UnitClass, string> = {
  warrior: "Skull/Skull_Avatar.png",
  lancer: "Turtle/Turtle_Avatar.png",
  archer: "Gnoll/Gnoll_Avatar.png",
  monk: "Hex Shaman/Hex Shaman_Avatar.png",
  pawn: "Gnome/Gnome_Avatar.png",
};

export function portraitKey(side: "a" | "b", cls: UnitClass): string {
  return `face_${side}_${cls}`;
}

/**
 * Crops measured off the sheets. Each is a frame added onto the loaded
 * texture, so nothing is copied: the ink box of the small square buttons
 * (their 128px canvas is mostly margin), and one colour row each of the
 * sword and the big ribbon, split into end, stretchable middle and end.
 */
const SQUARE = { x: 19, y: 17, w: 90, h: 94 };
const SWORD = { rowH: 128, hilt: { x: 23, w: 105 }, blade: { x: 192, w: 64, y: 19, h: 90 }, tip: { x: 320, w: 92 } };
const SWORD_ROW = { blue: 0, red: 1 } as const;
const RIBBON_BIG = { rowH: 128, y: 20, h: 103, left: { x: 30, w: 98 }, mid: { x: 192, w: 64 }, right: { x: 320, w: 97 } };
const RIBBON_ROW = { blue: 0, red: 1 } as const;

const INK = { color: "#4a3a2a", stroke: "#f3e6c8", strokeThickness: 0 };
/** Command card cell pitch and button size, in HUD units. */
const CELL = 52;
const BTN = 48;

export class StrategicHud extends Phaser.Scene {
  private hud!: HudData;
  /** Everything the model draws; torn down and redrawn on refresh. */
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private dots!: Phaser.GameObjects.Graphics;
  private layout = { w: 0, h: 0, mapX: 0, mapY: 0, mapW: 150, mapH: 94 };
  /** Where buildBar put the command card, the selection paper and the console's ends. */
  private cardX = 0;
  private selX0 = 0;
  private selX1 = 0;
  private cy = 0;
  private barX0 = 0;
  private barX1 = 0;
  /** The selection panel's last line, which a hovered command borrows. */
  private detail: Phaser.GameObjects.Text | null = null;
  /** The Pawn's speech bubble and its tail, moved every frame to follow it. */
  private bubble: { parts: BubblePart[]; tail: Phaser.GameObjects.Graphics; h: number; at: { x: number; y: number } | null } | null = null;

  constructor() {
    super(HUD_KEY);
  }

  init(data: HudData): void {
    this.hud = data;
  }

  preload(): void {
    loadPanels(this, ["woodTable", "paper", "blueButton", "redButton"]);
    this.load.image("hudSlot", packUrl("UI Elements/UI Elements/Wood Table/WoodTable_Slots.png"));
    this.load.image("hudPaper", packUrl("UI Elements/UI Elements/Banners/Banner_Slots.png"));
    this.load.image("sqBlue", packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Regular.png"));
    this.load.image("sqBlueDown", packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Pressed.png"));
    this.load.image("sqRed", packUrl("UI Elements/UI Elements/Buttons/SmallRedSquareButton_Regular.png"));
    this.load.image("swords", packUrl("UI Elements/UI Elements/Swords/Swords.png"));
    this.load.image("bigRibbons", packUrl("UI Elements/UI Elements/Ribbons/BigRibbons.png"));
    for (const n of new Set(Object.values(ICON))) this.load.image(iconKey(n), iconUrl(n));
    for (const [cls, n] of Object.entries(KNIGHT_FACE)) {
      this.load.image(portraitKey("a", cls as UnitClass), packUrl(`${AVATARS.file}${String(n).padStart(2, "0")}.png`));
    }
    for (const [cls, file] of Object.entries(MONSTER_FACE)) {
      this.load.image(portraitKey("b", cls as UnitClass), packUrl(`Enemy Pack/${file}`));
    }
  }

  create(): void {
    this.cutFrames();
    // Origin 0 so HUD units map to canvas px times the map's base zoom from
    // the top left: the HUD scales with the screen as the map does.
    const zoom = baseZoom(this);
    this.cameras.main.setOrigin(0).setZoom(zoom);
    // EXPAND resizes the canvas; a rebuild is the boring way to re-anchor.
    const rebuild = (): void => {
      this.scene.restart();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, rebuild);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, rebuild));

    this.dynamic = [];
    this.layout.w = this.scale.width / zoom;
    this.layout.h = this.scale.height / zoom;
    this.menuButton(34, 34);
    this.buildBar();
    this.refresh();
  }

  /** Named frames over the loaded sheets, once per game. */
  private cutFrames(): void {
    const add = (key: string, name: string, x: number, y: number, w: number, h: number): void => {
      const t = this.textures.get(key);
      if (!t.has(name)) t.add(name, 0, x, y, w, h);
    };
    for (const k of ["sqBlue", "sqBlueDown", "sqRed"]) add(k, "ink", SQUARE.x, SQUARE.y, SQUARE.w, SQUARE.h);
    for (const [tone, row] of Object.entries(SWORD_ROW)) {
      const y = row * SWORD.rowH;
      const b = SWORD.blade;
      add("swords", `${tone}_hilt`, SWORD.hilt.x, y, SWORD.hilt.w, SWORD.rowH);
      add("swords", `${tone}_blade`, b.x, y + b.y, b.w, b.h);
      add("swords", `${tone}_tip`, SWORD.tip.x, y + b.y, SWORD.tip.w, b.h);
    }
    for (const [tone, row] of Object.entries(RIBBON_ROW)) {
      const y = row * RIBBON_BIG.rowH + RIBBON_BIG.y;
      const r = RIBBON_BIG;
      add("bigRibbons", `${tone}_left`, r.left.x, y, r.left.w, r.h);
      add("bigRibbons", `${tone}_mid`, r.mid.x, y, r.mid.w, r.h);
      add("bigRibbons", `${tone}_right`, r.right.x, y, r.right.w, r.h);
    }
  }

  /** Redraw everything the model owns. Called by the map on every change. */
  refresh(): void {
    // Before create() has built the console there is nothing to draw into.
    if (!this.dots?.active) return;
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.bubble = null;
    const m = this.hud.model();
    this.buildTop(m);
    this.buildSelection(m);
    this.buildCommands(m);
    this.buildButtons(m);
    this.drawDots(m);
    if (m.tutorial) this.buildBubble(m.tutorial);
    if (m.report) this.buildReport(m.report);
  }

  update(): void {
    this.placeBubble();
  }

  /** A paper speech bubble: the line, the step's button, and a way out. */
  private buildBubble(t: NonNullable<HudModel["tutorial"]>): void {
    const pad = 22;
    const text = label(this, -BUBBLE_W / 2 + pad, 0, t.text, {
      ...INK,
      fontSize: "14px",
      fontStyle: "600",
      wordWrap: { width: BUBBLE_W - 2 * pad },
      lineSpacing: 2,
    }).setOrigin(0, 0);
    const foot = 58;
    const h = text.height + 2 * pad + foot;
    text.setY(-h / 2 + pad);
    const paper = panel(this, "paper", 0, 0, BUBBLE_W * 2, h * 2).setScale(0.5).setInteractive({ cursor: ARROW });
    const fy = h / 2 - pad - 18;
    // Top-level pieces rather than one container: a button nested two
    // containers deep never heard its click.
    const parts: BubblePart[] = [
      { o: paper, dx: 0, dy: 0 },
      { o: text, dx: -BUBBLE_W / 2 + pad, dy: -h / 2 + pad },
    ];
    if (t.button) {
      parts.push({ o: button(this, 0, 0, 140, 48, t.button.label, "blue", t.button.onClick, 0.5), dx: -BUBBLE_W / 2 + pad + 70, dy: fy });
    }
    const skip = label(this, 0, 0, "Skip tutorial", { ...INK, color: "#8a6a4a", fontSize: "12px" })
      .setOrigin(1, 0.5)
      .setInteractive({ cursor: HAND })
      .on("pointerup", t.onSkip);
    parts.push({ o: skip, dx: BUBBLE_W / 2 - pad, dy: fy });
    parts.forEach((p, i) => this.keep(p.o).setDepth(20 + i));
    const tail = this.keep(this.add.graphics().setDepth(19));
    this.bubble = { parts, tail, h, at: null };
    this.placeBubble();
  }

  /** Over the speaker's head, kept on screen and clear of the ribbon and the
   *  console; the tail points at the Pawn while it is in view. */
  private placeBubble(): void {
    const b = this.bubble;
    if (!b?.tail.active) return;
    const { w, h } = this.layout;
    const at = this.hud.speaker();
    const minY = 70 + b.h / 2;
    const maxY = h - BAR_H - 70 - b.h / 2;
    const cx = Math.round(Phaser.Math.Clamp(at?.x ?? w / 2, BUBBLE_W / 2 + 10, w - BUBBLE_W / 2 - 10));
    const cy = Math.round(Phaser.Math.Clamp((at?.y ?? minY + b.h / 2) - 26 - b.h / 2, minY, Math.max(minY, maxY)));
    // Only on a move: the button's hover sink tweens its y in between.
    if (b.at?.x === cx && b.at.y === cy) return;
    b.at = { x: cx, y: cy };
    for (const p of b.parts) {
      const o = p.o;
      o.setPosition(cx + p.dx, cy + p.dy);
      o.setData("baseY", cy + p.dy);
    }
    b.tail.clear();
    if (!at || at.x < 0 || at.x > w || at.y < 0 || at.y > h - BAR_H) return;
    // A wedge from the bubble's lower edge toward the head it belongs to.
    const baseY = cy + b.h / 2 - 6;
    const bx = Phaser.Math.Clamp(at.x, cx - BUBBLE_W / 2 + 30, cx + BUBBLE_W / 2 - 30);
    if (at.y <= baseY + 4) return;
    b.tail
      .fillStyle(PAPER)
      .fillTriangle(bx - 12, baseY, bx + 12, baseY, at.x, Math.min(at.y, baseY + 34))
      .lineStyle(2, 0x6b5a45, 0.8)
      .lineBetween(bx - 12, baseY + 1, at.x, Math.min(at.y, baseY + 34))
      .lineBetween(bx + 12, baseY + 1, at.x, Math.min(at.y, baseY + 34));
  }

  /** A soft pulsing ring round whatever the walkthrough points at. */
  private glow(x: number, y: number, w: number, h: number): void {
    const g = this.keep(this.add.graphics());
    g.lineStyle(4, 0xffe28a, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.2 }, duration: 600, yoyo: true, repeat: -1 });
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.dynamic.push(o);
    return o;
  }

  /** Three pieces of one sheet, the middle stretched to fill `w`. The ends
   *  keep their shape at any width. */
  private strip(
    key: string,
    frames: [string, string, string],
    x: number,
    y: number,
    w: number,
    scale: number,
  ): Phaser.GameObjects.Container {
    const tex = this.textures.get(key);
    const lw = tex.get(frames[0]).width * scale;
    const rw = tex.get(frames[2]).width * scale;
    const mw = Math.max(1, w - lw - rw);
    const h = tex.get(frames[1]).height * scale;
    // One texel of overlap at each seam, so no hairline of the map shows through.
    const left = this.add.image(-w / 2, 0, key, frames[0]).setOrigin(0, 0.5).setScale(scale);
    const mid = this.add.image(-w / 2 + lw - 1, 0, key, frames[1]).setOrigin(0, 0.5).setDisplaySize(mw + 2, h);
    const right = this.add.image(w / 2 - rw, 0, key, frames[2]).setOrigin(0, 0.5).setScale(scale);
    return this.add.container(x, y, [mid, left, right]).setSize(w, h);
  }

  private buildTop(m: HudModel): void {
    const { w } = this.layout;
    // The round on a ribbon, centred like a Warcraft objective.
    const tone = m.banner.tone;
    const text = label(this, 0, -6, m.banner.text, { fontSize: "19px" });
    const rw = Math.max(240, text.width + 130);
    const rib = this.keep(this.strip("bigRibbons", [`${tone}_left`, `${tone}_mid`, `${tone}_right`], w / 2, 34, rw, 0.5));
    rib.add(text);
    if (m.message) {
      this.keep(label(this, w / 2, 80, m.message, { fontSize: "15px", wordWrap: { width: Math.min(560, w - 40) }, align: "center" }));
    }

    // Resources on a strip of paper in the corner.
    const items: [string | null, string][] = [
      [ICON.gold, String(m.gold)],
      [ICON.meat, `${m.supply[0]}/${m.supply[1]}`],
      [null, m.greyIn > 0 ? `Greying in ${m.greyIn}` : "The Greying"],
    ];
    const stripW = 330;
    const x0 = w - 12 - stripW;
    this.keep(panel(this, "paper", x0 + stripW / 2, 34, stripW * 2, 104).setScale(0.5).setInteractive({ cursor: ARROW }));
    const at = [x0 + 30, x0 + 118, x0 + 206];
    items.forEach(([icon, value], i) => {
      const x = at[i]!;
      if (icon) this.keep(this.add.image(x, 33, iconKey(icon)).setScale(0.48));
      const tint = i === 2 && m.greyIn <= 2 ? "#a12f2f" : INK.color;
      this.keep(label(this, icon ? x + 20 : x - 10, 34, value, { ...INK, color: tint, fontSize: i === 2 ? "14px" : "17px" }).setOrigin(0, 0.5));
    });
  }

  private buildBar(): void {
    const { w, h } = this.layout;
    // Centred and running off the bottom edge like Warcraft's console; as
    // wide as the screen allows, up to where the three parts sit comfortably.
    const half = Math.max(w / 4, Math.min(w / 2 - 8, 390));
    const x0 = w / 2 - half;
    const x1 = w / 2 + half;
    // The wood table's ink starts this far inside the panel at half scale.
    const pad = { side: 22, top: 22, bottom: 42 };
    const panelW = x1 - x0 + 2 * pad.side;
    const panelH = BAR_H + pad.top + pad.bottom;
    panel(this, "woodTable", w / 2, h + pad.bottom - panelH / 2, panelW * 2, panelH * 2)
      .setScale(0.5)
      // Eats clicks so the map under the console never gets them; the arrow
      // says it is not map to drag.
      .setInteractive({ cursor: ARROW });
    const cy = h - BAR_H / 2 + 2;

    const { mapW, mapH } = this.layout;
    const mapX = x0 + 16;
    this.layout.mapX = mapX;
    this.layout.mapY = cy - mapH / 2;
    this.add.image(mapX + mapW / 2, cy, "hudSlot").setDisplaySize(mapW + 16, mapH + 16);
    this.drawMinimap(mapX, cy - mapH / 2, mapW, mapH);
    this.dots = this.add.graphics();
    // Click or drag on the minimap to look there, as in Warcraft.
    const cols = this.hud.map[0]!.length;
    const rows = this.hud.map.length;
    const look = (p: Phaser.Input.Pointer): void => {
      const col = Phaser.Math.Clamp(Math.floor(((p.x / this.cameras.main.zoom - mapX) / mapW) * cols), 0, cols - 1);
      const row = Phaser.Math.Clamp(Math.floor(((p.y / this.cameras.main.zoom - (cy - mapH / 2)) / mapH) * rows), 0, rows - 1);
      this.hud.onMinimap(col, row);
    };
    this.add
      .zone(mapX, cy - mapH / 2, mapW, mapH)
      .setOrigin(0)
      .setInteractive({ cursor: HAND })
      .on("pointerdown", look)
      .on("pointermove", (p: Phaser.Input.Pointer) => p.isDown && look(p));

    const zx = mapX + mapW + 30;
    this.squareButton(zx, cy - 25, 42, "+", () => this.hud.onZoom(-1));
    this.squareButton(zx, cy + 23, 42, "-", () => this.hud.onZoom(1));

    this.cardX = x1 - 14 - 3 * CELL;
    this.selX0 = zx + 28;
    this.selX1 = this.cardX - 10;
    this.cy = cy;
    this.barX1 = x1;
    this.barX0 = x0;
    this.add.image((this.selX0 + this.selX1) / 2, cy, "hudPaper").setDisplaySize(this.selX1 - this.selX0, 136);
  }

  private buildSelection(m: HudModel): void {
    const top = this.cy - 50;
    let x = this.selX0 + 16;
    if (m.portrait && this.textures.exists(m.portrait)) {
      const slot = 72;
      this.keep(this.add.image(x + slot / 2, this.cy, "hudSlot").setDisplaySize(slot, slot));
      // Building art is a spritesheet for some kinds and a plain image for others.
      const frame = this.textures.get(m.portrait).has("0") ? 0 : undefined;
      const face = this.keep(this.add.image(x + slot / 2, this.cy, m.portrait, frame));
      const fit = (slot - 12) / Math.max(face.width, face.height);
      face.setScale(fit);
      x += slot + 12;
    }
    const width = this.selX1 - 16 - x;
    const wrap = { wordWrap: { width } };
    this.keep(label(this, x, top, m.title, { ...INK, fontSize: "16px", ...wrap }).setOrigin(0, 0));
    let y = top + 24;
    if (m.hp) {
      const [cur, max] = m.hp;
      const bw = Math.min(width, 150);
      const g = this.keep(this.add.graphics());
      g.fillStyle(0x3a2a1c).fillRoundedRect(x, y, bw, 10, 3);
      const frac = Math.max(0, Math.min(1, cur / max));
      const col = frac > 0.5 ? 0x6cc24a : frac > 0.25 ? 0xe0b43a : 0xd8503a;
      if (frac > 0) g.fillStyle(col).fillRoundedRect(x + 2, y + 2, Math.max(4, (bw - 4) * frac), 6, 2);
      this.keep(label(this, x + bw + 8, y + 5, `${cur}/${max}`, { ...INK, fontSize: "12px" }).setOrigin(0, 0.5));
      y += 18;
    }
    this.detail = this.keep(label(this, x, y, m.detail, { ...INK, fontSize: "12px", fontStyle: "500", ...wrap }).setOrigin(0, 0));
  }

  private buildCommands(m: HudModel): void {
    // A big command in the first slot takes the card's top-left 2x2 block.
    const big = m.commands[0]?.big ? m.commands[0] : null;
    if (big) this.keep(this.commandButton(this.cardX + CELL, this.cy - CELL / 2, big, m.detail, 2 * CELL - 4));
    for (let i = 0; i < 9; i++) {
      if (big && [0, 1, 3, 4].includes(i)) continue;
      const x = this.cardX + (i % 3) * CELL + CELL / 2;
      const y = this.cy - CELL + Math.floor(i / 3) * CELL;
      const cmd = m.commands[i] ?? null;
      if (!cmd) {
        // An empty socket in the wood, not a dead button.
        this.keep(this.add.image(x, y, "hudSlot").setDisplaySize(BTN - 8, BTN - 8).setAlpha(0.55));
        continue;
      }
      this.keep(this.commandButton(x, y, cmd, m.detail));
    }
  }

  private commandButton(x: number, y: number, cmd: HudCommand, detail: string, size = BTN): Phaser.GameObjects.Container {
    const on = cmd.enabled !== false;
    const face = this.add.image(0, 0, cmd.active ? "sqRed" : "sqBlue", "ink").setDisplaySize(size, size * (SQUARE.h / SQUARE.w));
    const parts: Phaser.GameObjects.GameObject[] = [face];
    if (cmd.portrait && this.textures.exists(cmd.portrait)) {
      // A troop: its face large enough to read, then its name and price.
      const face_ = this.add.image(0, -size * 0.16, cmd.portrait);
      face_.setScale((size * 0.64) / Math.max(face_.width, face_.height));
      parts.push(face_);
      parts.push(label(this, 0, size * 0.16, cmd.label, { fontSize: "14px", strokeThickness: 3 }));
      if (cmd.sub) parts.push(label(this, 0, size * 0.29, cmd.sub, { fontSize: "11px", color: "#ffe28a", strokeThickness: 3 }));
    } else if (cmd.icon) {
      const k = size / BTN;
      parts.push(this.add.image(0, -9 * k, iconKey(cmd.icon)).setScale(0.4 * k));
      parts.push(label(this, 0, 14 * k, cmd.label, { fontSize: `${Math.round(10 * Math.min(k, 1.5))}px`, strokeThickness: 3 }));
    } else {
      parts.push(label(this, 0, -2, cmd.label, { fontSize: cmd.label.length > 6 ? "11px" : "13px", wordWrap: { width: BTN - 8 }, align: "center" }));
    }
    const box = this.add.container(x, y, parts).setSize(size, size);
    if (!on) {
      face.setTint(0x8a8f96);
      for (const p of parts.slice(1)) (p as Phaser.GameObjects.Image).setAlpha(0.5);
    }
    box
      .setInteractive({ cursor: on ? HAND : ARROW })
      .on("pointerover", () => this.detail?.setText(cmd.hint))
      .on("pointerout", () => {
        this.detail?.setText(detail);
        box.setY(y);
      })
      .on("pointerdown", () => {
        if (!on) return;
        box.setY(y + 2);
        if (!cmd.active) face.setTexture("sqBlueDown", "ink").setDisplaySize(size, size * (SQUARE.h / SQUARE.w));
      })
      .on("pointerup", () => {
        box.setY(y);
        if (on) cmd.onClick();
      });
    return box;
  }

  private buildButtons(m: HudModel): void {
    const y = this.layout.h - BAR_H - 34;
    const focus = m.tutorial?.focus;
    if (focus === "fight" && m.primary) this.glow(this.barX1 - 110, y, 226, 66);
    if (focus === "army" && m.secondary.length > 0) this.glow(this.barX0 + 76, y, 154, 58);
    if (m.primary?.style === "sword") {
      this.keep(this.swordButton(this.barX1 - 110, y, 210, m.primary.label, m.primary.onClick));
    } else if (m.primary) {
      this.keep(button(this, this.barX1 - 80, y, 150, 48, m.primary.label, "blue", m.primary.onClick, 0.5));
    }
    m.secondary.forEach((s, i) => {
      this.keep(button(this, this.barX0 + 76 + i * 150, y, 140, 48, s.label, "blue", s.onClick, 0.5));
    });
  }

  /** The red sword, hilt to tip, with its word on the blade. */
  private swordButton(x: number, y: number, w: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const sword = this.strip("swords", ["red_hilt", "red_blade", "red_tip"], 0, 0, w, 0.62);
    const hilt = this.textures.get("swords").get("red_hilt").width * 0.62;
    sword.add(label(this, (hilt - this.textures.get("swords").get("red_tip").width * 0.62) / 2, -2, text, { fontSize: "20px", color: "#4a2a1a", stroke: "#f7ecd6", strokeThickness: 2 }));
    const box = this.add.container(x, y, [sword]).setSize(w, sword.height);
    const sink = (d: number): void => {
      this.tweens.killTweensOf(sword);
      this.tweens.add({ targets: sword, x: d, duration: 120, ease: "Sine.easeOut" });
    };
    box
      .setInteractive({ cursor: HAND })
      // A thrust: the sword leans toward its tip on hover.
      .on("pointerover", () => sink(6))
      .on("pointerout", () => sink(0))
      .on("pointerdown", () => sink(10))
      .on("pointerup", () => {
        sink(6);
        onClick();
      });
    return box;
  }

  private buildReport(r: NonNullable<HudModel["report"]>): void {
    const { w, h } = this.layout;
    const pw = Math.min(480, w - 40);
    const ph = 150 + r.lines.length * 22;
    const cy = Math.max(ph / 2 + 70, (h - BAR_H) / 2);
    // A veil so the report reads as modal, and eats clicks meant for the map.
    this.keep(this.add.rectangle(w / 2, h / 2, w, h, 0x0b1620, 0.35).setInteractive({ cursor: ARROW }));
    this.keep(panel(this, "paper", w / 2, cy, pw * 2, ph * 2).setScale(0.5).setInteractive({ cursor: ARROW }));
    const title = label(this, 0, -6, r.title, { fontSize: "20px" });
    const rib = this.keep(
      this.strip("bigRibbons", [`${r.tone}_left`, `${r.tone}_mid`, `${r.tone}_right`], w / 2, cy - ph / 2 + 8, Math.max(260, title.width + 130), 0.5),
    );
    rib.add(title);
    r.lines.forEach((line, i) => {
      this.keep(label(this, w / 2, cy - ph / 2 + 64 + i * 22, line, { ...INK, fontSize: "14px", fontStyle: "500", wordWrap: { width: pw - 60 }, align: "center" }));
    });
    const by = cy + ph / 2 - 40;
    if (r.also) {
      this.keep(button(this, w / 2 - 85, by, 150, 48, r.button, "blue", r.onClick, 0.5));
      this.keep(button(this, w / 2 + 85, by, 150, 48, r.also.label, "red", r.also.onClick, 0.5));
    } else {
      this.keep(button(this, w / 2, by, 170, 48, r.button, "blue", r.onClick, 0.5));
    }
  }

  /** The map as flat colour, one rect per cell, halls as dots. */
  private drawMinimap(x: number, y: number, w: number, h: number): void {
    const { map, marks } = this.hud;
    const rows = map.length;
    const cols = map[0]!.length;
    const cw = w / cols;
    const ch = h / rows;
    const g = this.add.graphics();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(WATER).color).fillRect(x, y, w, h);
    const tone: Record<string, number> = { ".": 0x62aa63, "#": 0x99b653, "<": 0x99b653, ">": 0x99b653 };
    map.forEach((line, r) => {
      [...line].forEach((k, c) => {
        const color = tone[k];
        if (color !== undefined) g.fillStyle(color).fillRect(x + c * cw, y + r * ch, Math.ceil(cw), Math.ceil(ch));
      });
    });
    const side = { a: 0x3b6fd8, b: 0xd8443b, g: 0x444444 };
    for (const m of marks) {
      g.fillStyle(side[m.side]).fillRect(x + m.col * cw - 3, y + m.row * ch - 3, 6, 6);
    }
  }

  /** Every unit as a small dot over the minimap. */
  private drawDots(m: HudModel): void {
    const { mapX, mapY, mapW, mapH } = this.layout;
    const cw = mapW / this.hud.map[0]!.length;
    const ch = mapH / this.hud.map.length;
    this.dots.clear();
    for (const d of m.dots) {
      this.dots.fillStyle(d.side === "a" ? 0x9cc4ff : 0xff9c8a).fillRect(mapX + (d.col + 0.5) * cw - 1.5, mapY + (d.row + 0.5) * ch - 1.5, 3, 3);
    }
  }

  /** A small square button with a glyph. Presses sink it a touch. */
  private squareButton(x: number, y: number, size: number, glyph: string, onClick: () => void): void {
    const face = this.add.image(0, 0, "sqBlue", "ink").setDisplaySize(size, size * (SQUARE.h / SQUARE.w));
    const mark = label(this, 0, -3, glyph, { fontSize: "22px" });
    const box = this.add.container(x, y, [face, mark]).setSize(size, size);
    box
      .setInteractive({ cursor: HAND })
      .on("pointerdown", () => box.setY(y + 2))
      .on("pointerout", () => box.setY(y))
      .on("pointerup", () => {
        box.setY(y);
        onClick();
      });
  }

  private menuButton(x: number, y: number): void {
    const face = this.add.image(0, 0, "sqBlue", "ink").setDisplaySize(48, 48 * (SQUARE.h / SQUARE.w));
    const mark = this.add.image(0, -2, iconKey(ICON.menu)).setScale(0.5);
    const box = this.add.container(x, y, [face, mark]).setSize(48, 48);
    box
      .setInteractive({ cursor: HAND })
      .on("pointerdown", () => box.setY(y + 2))
      .on("pointerout", () => box.setY(y))
      .on("pointerup", () => {
        box.setY(y);
        this.hud.onMenu();
      });
  }
}
