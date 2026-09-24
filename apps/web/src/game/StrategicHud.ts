// The strategic map's Warcraft-style HUD: resources and menu along the top,
// minimap, selection panel and command card in a wooden bar along the
// bottom. Its own scene on top of the map, so zooming the map's camera never
// scales the HUD, and a click on the bar never reaches the map below.
//
// Only the menu and zoom buttons do anything yet; the rest is placement.

import * as Phaser from "phaser";

import { iconKey, iconUrl, packUrl } from "./art";
import { WATER, baseZoom } from "./boot";
import { ARROW, HAND, label, loadPanels, panel } from "./ui";

export const HUD_KEY = "strategicHud";
/** The bottom bar's height in HUD units. */
const BAR_H = 160;
/** How much of the screen's bottom the HUD covers; the map scrolls up past it. */
export const HUD_COVER_H = BAR_H;

export interface HudData {
  /** The map rows, `~ . # < >` as StrategicScene draws them. */
  map: readonly string[];
  /** Halls as minimap dots, in cells. */
  marks: { col: number; row: number; side: "a" | "b" | "g" }[];
  onMenu: () => void;
  onZoom: (dir: 1 | -1) => void;
}

const ICON = { build: "01", wood: "02", gold: "03", meat: "04", attack: "05", hold: "06", move: "08", stop: "09", menu: "10" };
/** The wood table art's empty margin at the half scale it is drawn at:
 *  its ink starts this far inside the panel. Bottom is pushed below the
 *  screen: the rim under the wood and the corner brackets above it. */
const TABLE_PAD = { side: 22, top: 22, bottom: 42 };

export class StrategicHud extends Phaser.Scene {
  private hud!: HudData;

  constructor() {
    super(HUD_KEY);
  }

  init(data: HudData): void {
    this.hud = data;
  }

  preload(): void {
    loadPanels(this, ["woodTable", "paper"]);
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

    const w = this.scale.width / zoom;
    const h = this.scale.height / zoom;
    this.buildTop(w);
    this.buildBar(w, h);
  }

  private buildTop(w: number): void {
    this.iconButton(36, 36, ICON.menu, () => this.hud.onMenu());

    // Resource strip, top right: placeholder stock.
    const stripW = 330;
    const x0 = w - 16 - stripW;
    // Paper corners are 64px, so it is drawn at double size and halved.
    panel(this, "paper", x0 + stripW / 2, 36, stripW * 2, 128).setScale(0.5).setInteractive({ cursor: ARROW });
    [
      [ICON.gold, "500"],
      [ICON.wood, "300"],
      [ICON.meat, "4 / 10"],
    ].forEach(([icon, text], i) => {
      const x = x0 + 30 + i * 100;
      this.add.image(x, 36, iconKey(icon!)).setScale(0.5);
      label(this, x + 20, 36, text!, { fontSize: "17px" }).setOrigin(0, 0.5);
    });
  }

  private buildBar(w: number, h: number): void {
    // Half the screen wide, centred, running off the bottom edge like
    // Warcraft's console.
    const x0 = w / 4;
    const x1 = w - w / 4;
    const panelW = x1 - x0 + 2 * TABLE_PAD.side;
    const panelH = BAR_H + TABLE_PAD.top + TABLE_PAD.bottom;
    panel(this, "woodTable", w / 2, h + TABLE_PAD.bottom - panelH / 2, panelW * 2, panelH * 2)
      .setScale(0.5)
      // Eats clicks so the map under the bar never gets them; the arrow says
      // it is not map to drag.
      .setInteractive({ cursor: ARROW });
    const cy = h - BAR_H / 2;

    // Minimap, left.
    const mapW = 150;
    const mapH = 94;
    const mapX = x0 + 18;
    this.add.image(mapX + mapW / 2, cy, "hudSlot").setDisplaySize(mapW + 14, mapH + 14);
    this.drawMinimap(mapX, cy - mapH / 2, mapW, mapH);

    // Zoom, beside the minimap.
    const zx = mapX + mapW + 26;
    this.iconButton(zx, cy - 24, "+", () => this.hud.onZoom(-1));
    this.iconButton(zx, cy + 24, "−", () => this.hud.onZoom(1));

    // Command card, right: 3x3, placeholder orders in the first slots.
    const step = 40;
    const cardX = x1 - 18 - 3 * step;
    const orders = [ICON.move, ICON.stop, ICON.hold, ICON.attack, ICON.build];
    for (let i = 0; i < 9; i++) {
      const x = cardX + (i % 3) * step + step / 2;
      const y = cy - step + Math.floor(i / 3) * step;
      const b = this.add.image(x, y, "hudButton").setDisplaySize(54, 54);
      const order = orders[i];
      if (order) this.add.image(x, y - 2, iconKey(order)).setScale(0.4);
      else b.setAlpha(0.45);
    }

    // Selection, centre: portrait slot and what is selected.
    const selX0 = zx + 36;
    const selX1 = cardX - 12;
    this.add.image((selX0 + selX1) / 2, cy, "hudPaper").setDisplaySize(selX1 - selX0, 110);
    this.add.image(selX0 + 42, cy, "hudSlot").setDisplaySize(68, 68);
    const ink = { color: "#4a3a2a", stroke: "#f3e6c8", strokeThickness: 0 };
    label(this, selX0 + 86, cy - 12, "Nothing selected", { ...ink, fontSize: "15px" }).setOrigin(0, 0.5);
    label(this, selX0 + 86, cy + 12, "Click to select", { ...ink, fontSize: "13px" }).setOrigin(0, 0.5);
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
