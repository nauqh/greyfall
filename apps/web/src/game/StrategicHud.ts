// The strategic map's Warcraft-style HUD: resources and menu along the top,
// minimap, selection panel and command card in a wooden bar along the
// bottom. Its own scene on top of the map, so zooming the map's camera never
// scales the HUD, and a click on the bar never reaches the map below.
//
// It draws whatever the map scene's model says and calls back into it; the
// war itself lives in the engine and the map scene.

import * as Phaser from "phaser";

import { iconKey, iconUrl, packUrl } from "./art";
import { WATER, baseZoom } from "./boot";
import { ARROW, HAND, button, label, loadPanels, panel } from "./ui";

export const HUD_KEY = "strategicHud";
/** The bottom bar's height in HUD units. */
const BAR_H = 160;
/** How much of the screen's bottom the HUD covers; the map scrolls up past it. */
export const HUD_COVER_H = BAR_H;

/** The pack's icon sheet, by what each stands for on the command card. */
export const ICON = {
  build: "01",
  gold: "03",
  meat: "04",
  attack: "05",
  hold: "06",
  heal: "07",
  move: "08",
  stop: "09",
  menu: "10",
  info: "11",
} as const;

export interface HudCommand {
  /** An icon sheet number, or a short glyph drawn as text. */
  icon: string;
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
  title: string;
  detail: string;
  /** A line over the bar: what just went wrong, or what to do next. */
  message: string;
  commands: (HudCommand | null)[];
  primary: { label: string; tone: "blue" | "red"; onClick: () => void } | null;
  secondary: { label: string; onClick: () => void } | null;
  /** The round report or the end of the match, over everything. */
  report: { title: string; lines: string[]; button: string; onClick: () => void; also?: { label: string; onClick: () => void } } | null;
  dots: { col: number; row: number; side: "a" | "b" }[];
}

export interface HudData {
  /** The map rows, `~ . # < >` as StrategicScene draws them. */
  map: readonly string[];
  /** Halls as minimap dots, in cells. */
  marks: { col: number; row: number; side: "a" | "b" | "g" }[];
  onMenu: () => void;
  onZoom: (dir: 1 | -1) => void;
  model: () => HudModel;
}

/** The wood table art's empty margin at the half scale it is drawn at:
 *  its ink starts this far inside the panel. Bottom is pushed below the
 *  screen: the rim under the wood and the corner brackets above it. */
const TABLE_PAD = { side: 22, top: 22, bottom: 42 };
const INK = { color: "#4a3a2a", stroke: "#f3e6c8", strokeThickness: 0 };

export class StrategicHud extends Phaser.Scene {
  private hud!: HudData;
  /** Everything the model draws; torn down and redrawn on refresh. */
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private dots!: Phaser.GameObjects.Graphics;
  private layout = { w: 0, h: 0, mapX: 0, mapY: 0, mapW: 150, mapH: 94 };
  /** Where buildBar put the command card, the selection paper and the bar's ends. */
  private cardX = 0;
  private selX0 = 0;
  private selX1 = 0;
  private cy = 0;
  private barX0 = 0;
  private barX1 = 0;
  /** The selection panel's second line, which a hovered command borrows. */
  private detail: Phaser.GameObjects.Text | null = null;

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
    this.load.image("hudButton", packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Regular.png"));
    for (const n of Object.values(ICON)) this.load.image(iconKey(n), iconUrl(n));
  }

  create(): void {
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
    this.iconButton(36, 36, ICON.menu, () => this.hud.onMenu());
    this.buildBar();
    this.refresh();
  }

  /** Redraw everything the model owns. Called by the map on every change. */
  refresh(): void {
    // Before create() has built the bar there is nothing to draw into.
    if (!this.dots?.active) return;
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const m = this.hud.model();
    this.buildTop(m);
    this.buildSelection(m);
    this.buildCommands(m);
    this.buildButtons(m);
    this.drawDots(m);
    if (m.report) this.buildReport(m.report);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.dynamic.push(o);
    return o;
  }

  private buildTop(m: HudModel): void {
    const { w } = this.layout;
    const stripW = 360;
    const x0 = w - 16 - stripW;
    // Paper corners are 64px, so it is drawn at double size and halved.
    this.keep(panel(this, "paper", x0 + stripW / 2, 36, stripW * 2, 128).setScale(0.5).setInteractive({ cursor: ARROW }));
    const items: [string | null, string][] = [
      [ICON.gold, String(m.gold)],
      [ICON.meat, `${m.supply[0]} / ${m.supply[1]}`],
      [null, `Round ${m.round}`],
    ];
    items.forEach(([icon, text], i) => {
      const x = x0 + 30 + i * 110;
      if (icon) this.keep(this.add.image(x, 36, iconKey(icon)).setScale(0.5));
      this.keep(label(this, icon ? x + 20 : x - 10, 36, text, { fontSize: "17px" }).setOrigin(0, 0.5));
    });
  }

  private buildBar(): void {
    const { w, h } = this.layout;
    // Half the screen wide, centred, running off the bottom edge like
    // Warcraft's console; wider on a narrow screen so the card still fits.
    const half = Math.max(w / 4, Math.min(w / 2 - 8, 330));
    const x0 = w / 2 - half;
    const x1 = w / 2 + half;
    const panelW = x1 - x0 + 2 * TABLE_PAD.side;
    const panelH = BAR_H + TABLE_PAD.top + TABLE_PAD.bottom;
    panel(this, "woodTable", w / 2, h + TABLE_PAD.bottom - panelH / 2, panelW * 2, panelH * 2)
      .setScale(0.5)
      // Eats clicks so the map under the bar never gets them; the arrow says
      // it is not map to drag.
      .setInteractive({ cursor: ARROW });
    const cy = h - BAR_H / 2;

    const { mapW, mapH } = this.layout;
    const mapX = x0 + 18;
    this.layout.mapX = mapX;
    this.layout.mapY = cy - mapH / 2;
    this.add.image(mapX + mapW / 2, cy, "hudSlot").setDisplaySize(mapW + 14, mapH + 14);
    this.drawMinimap(mapX, cy - mapH / 2, mapW, mapH);
    this.dots = this.add.graphics();

    const zx = mapX + mapW + 26;
    this.iconButton(zx, cy - 24, "+", () => this.hud.onZoom(-1));
    this.iconButton(zx, cy + 24, "−", () => this.hud.onZoom(1));

    const step = 40;
    this.cardX = x1 - 18 - 3 * step;
    this.selX0 = zx + 36;
    this.selX1 = this.cardX - 12;
    this.cy = cy;
    this.barX1 = x1;
    this.barX0 = x0;
    this.add.image((this.selX0 + this.selX1) / 2, cy, "hudPaper").setDisplaySize(this.selX1 - this.selX0, 110);
  }

  private buildSelection(m: HudModel): void {
    const x = this.selX0 + 18;
    const wrap = { wordWrap: { width: this.selX1 - this.selX0 - 36 } };
    this.keep(label(this, x, this.cy - 30, m.title, { ...INK, fontSize: "15px", ...wrap }).setOrigin(0, 0));
    this.detail = this.keep(
      label(this, x, this.cy - 8, m.detail, { ...INK, fontSize: "12px", fontStyle: "500", ...wrap }).setOrigin(0, 0),
    );
    if (m.message) {
      this.keep(label(this, this.layout.w / 2, this.layout.h - BAR_H - 34, m.message, { fontSize: "16px" }));
    }
  }

  private buildCommands(m: HudModel): void {
    const step = 40;
    for (let i = 0; i < 9; i++) {
      const x = this.cardX + (i % 3) * step + step / 2;
      const y = this.cy - step + Math.floor(i / 3) * step;
      const cmd = m.commands[i] ?? null;
      const face = this.keep(this.add.image(x, y, "hudButton").setDisplaySize(54, 54));
      if (!cmd) {
        face.setAlpha(0.45);
        continue;
      }
      const on = cmd.enabled !== false;
      const mark = /^\d+$/.test(cmd.icon)
        ? this.keep(this.add.image(x, y - 2, iconKey(cmd.icon)).setScale(0.4))
        : this.keep(label(this, x, y - 3, cmd.icon, { fontSize: cmd.icon.length > 2 ? "11px" : "15px" }));
      if (!on) {
        face.setAlpha(0.5);
        mark.setAlpha(0.45);
      }
      if (cmd.active) face.setTint(0xffe28a);
      face
        .setInteractive({ cursor: on ? HAND : ARROW })
        .on("pointerover", () => this.detail?.setText(cmd.hint))
        .on("pointerout", () => this.detail?.setText(m.detail))
        .on("pointerdown", () => on && face.setY(y + 2))
        .on("pointerup", () => {
          face.setY(y);
          if (on) cmd.onClick();
        });
    }
  }

  private buildButtons(m: HudModel): void {
    const y = this.layout.h - BAR_H - 40;
    if (m.primary) {
      this.keep(button(this, this.barX1 - 80, y, 150, 52, m.primary.label, m.primary.tone, m.primary.onClick));
    }
    if (m.secondary) {
      this.keep(button(this, this.barX0 + 80, y, 150, 52, m.secondary.label, "blue", m.secondary.onClick));
    }
  }

  private buildReport(r: NonNullable<HudModel["report"]>): void {
    const { w, h } = this.layout;
    const pw = Math.min(460, w - 40);
    const ph = 150 + r.lines.length * 22;
    const cy = Math.max(ph / 2 + 70, (h - BAR_H) / 2);
    // A veil so the report reads as modal, and eats clicks meant for the map.
    this.keep(
      this.add.rectangle(w / 2, h / 2, w, h, 0x0b1620, 0.35).setInteractive({ cursor: ARROW }),
    );
    this.keep(panel(this, "paper", w / 2, cy, pw * 2, ph * 2).setScale(0.5).setInteractive({ cursor: ARROW }));
    this.keep(label(this, w / 2, cy - ph / 2 + 36, r.title, { ...INK, fontSize: "22px" }));
    r.lines.forEach((line, i) => {
      this.keep(
        label(this, w / 2, cy - ph / 2 + 70 + i * 22, line, { ...INK, fontSize: "14px", fontStyle: "500" }),
      );
    });
    const by = cy + ph / 2 - 40;
    if (r.also) {
      this.keep(button(this, w / 2 - 85, by, 150, 48, r.button, "blue", r.onClick));
      this.keep(button(this, w / 2 + 85, by, 150, 48, r.also.label, "red", r.also.onClick));
    } else {
      this.keep(button(this, w / 2, by, 170, 48, r.button, "blue", r.onClick));
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

  /** A small square button with an icon, or a glyph when the icon is not a
   *  sheet number. Presses sink it a touch. */
  private iconButton(x: number, y: number, icon: string, onClick: () => void): void {
    const face = this.add.image(0, 0, "hudButton").setDisplaySize(64, 64);
    const mark = /^\d+$/.test(icon)
      ? this.add.image(0, -2, iconKey(icon)).setScale(0.5)
      : label(this, 0, -3, icon, { fontSize: "26px" });
    const box = this.add.container(x, y, [face, mark]).setSize(46, 46);
    box
      .setInteractive({ cursor: HAND })
      .on("pointerdown", () => box.setY(y + 2))
      .on("pointerout", () => box.setY(y))
      .on("pointerup", () => {
        box.setY(y);
        onClick();
      });
  }
}
