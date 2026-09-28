// The strategic map's HUD: a ribbon naming the mode along
// the top, resources and menu in the corners, and a wooden console along the
// bottom with the zoom, the selection panel and the command card. Popups sit
// over it: command tooltips, message toasts, a phase splash and the field
// guide. Its own scene on top of the map, so zooming the map's camera never
// scales the HUD, and a click on the console never reaches the map below.
//
// It draws whatever the map scene's model says and calls back into it; the
// war itself lives in the engine and the map scene.

import { BALANCE, WAR, type UnitClass, type UnitSide } from "@greyfall/engine";
import * as Phaser from "phaser";

import { AVATARS, iconKey, iconUrl, packUrl } from "./art";
import { baseZoom } from "./boot";
import { monsterAvatar } from "./sprites";
import { ARROW, HAND, button, label, loadPanels, panel } from "./ui";

export const HUD_KEY = "strategicHud";
/** The bottom console's height in HUD units. */
const BAR_H = 176;
/** How much of the screen's bottom the HUD covers; the map scrolls up past it. */
export const HUD_COVER_H = BAR_H;
/** The header row's height, flush to the top edge. The map keeps sea under it. */
export const HUD_TOP_H = 46;
/** How far the header papers reach above the screen, hiding their top rims. */
const STRIP_UP = 16;
/** The paper art's clear margin under its ink, at half scale. */
const PAPER_FOOT = 10;

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
  /** Fills the card's top-left 2x2 block; only honoured in the first slot of a 3x3 card. */
  big?: boolean;
  /** Shown in a tooltip over the card while hovered. */
  hint: string;
  onClick: () => void;
  enabled?: boolean;
}

export interface HudModel {
  gold: number;
  supply: [used: number, cap: number];
  /** The next monster wave's countdown as a clock. */
  clock: { text: string; warn: boolean };
  /** The ribbon along the top, and its colour: red while paused. */
  banner: { text: string; tone: "blue" | "red" };
  title: string;
  detail: string;
  /** A texture key for the selection panel's portrait. */
  portrait: string | null;
  hp: [cur: number, max: number] | null;
  /** A toast under the ribbon: what just went wrong, or what to do next. */
  message: string;
  /** Bumped on every message set, so the same line said twice shows twice. */
  messageId: number;
  /** Laid out three to a row: six make a 3x2 card, nine a 3x3. */
  commands: (HudCommand | null)[];
  /** A selected building's training queue, front first: shown in the selection panel. */
  queue: {
    units: { portrait: string; name: string }[];
    /** How far the front unit is, 0 to 1. */
    progress: number;
    /** Takes the last unit off, gold back. */
    cancel: () => void;
  } | null;
  /** The sword over the console, only when there is one big thing to do. */
  primary: { label: string; onClick: () => void } | null;
  /** Blue's Pawns; clicking the idle count picks the idle ones. */
  pawns: { idle: number; onIdle: () => void };
  /** The end of the match, over everything. */
  report: {
    title: string;
    tone: "blue" | "red";
    lines: string[];
    button: string;
    onClick: () => void;
    also?: { label: string; onClick: () => void };
  } | null;
}

export interface HudData {
  onLeave: () => void;
  onPause: (on: boolean) => void;
  onZoom: (dir: 1 | -1) => void;
  model: () => HudModel;
}

/** How long a pointer rests on a command before its tooltip shows, and how
 *  long a toast stays up. */
const TIP_DELAY = 250;
const TOAST_MS = 5000;

/** Portraits: five of the pack's faces for each knight clan. */
const KNIGHT_FACE: Record<"a" | "b", Record<UnitClass, number>> = {
  a: { warrior: 1, lancer: 2, archer: 3, monk: 4, pawn: 5 },
  b: { warrior: 6, lancer: 7, archer: 8, monk: 9, pawn: 10 },
};

export function portraitKey(side: UnitSide, cls: UnitClass): string {
  return `face_${side}_${cls}`;
}

/**
 * Crops measured off the sheets. Each is a frame added onto the loaded
 * texture, so nothing is copied: the ink box of the small square buttons
 * (their 128px canvas is mostly margin), and one colour row each of the
 * sword and the big ribbon, split into end, stretchable middle and end.
 */
const SQUARE = { x: 19, y: 17, w: 90, h: 94 };
/** The blue face inside SQUARE, clear of its white rim and bottom bevel. */
const FACE = { x: 7, y: 7, w: 76, h: 71 };
const SWORD = { rowH: 128, hilt: { x: 23, w: 105 }, blade: { x: 192, w: 64, y: 19, h: 90 }, tip: { x: 320, w: 92 } };
const SWORD_ROW = { blue: 0, red: 1 } as const;
const RIBBON_BIG = { rowH: 128, y: 20, h: 103, left: { x: 30, w: 98 }, mid: { x: 192, w: 64 }, right: { x: 320, w: 97 } };
const RIBBON_ROW = { blue: 0, red: 1 } as const;

const INK = { color: "#4a3a2a", stroke: "#f3e6c8", strokeThickness: 0 };
/** Command card cell pitch and button size for a 3x3 card, in HUD units. */
const CELL = 52;
/** Warcraft's grid hotkeys: the command card's keys by position, row by row. */
const GRID = "QWEASDZXC";
const BTN = 48;
/** The card's width: a 3x2 card's buttons grow to fill it. */
const CARD_W = 216;
/** A training queue socket in the selection panel. */
const QUEUE_SLOT = 34;

type HudPart = "top" | "panel" | "progress" | "rest";

/** Ink boxes of pictures shown on buttons, by texture key. */
const INK_BOX = new Map<string, { x: number; y: number; w: number; h: number }>();

export class StrategicHud extends Phaser.Scene {
  private hud!: HudData;
  /** Everything the model draws, in three parts, each torn down and redrawn
   *  only when what it shows changes: a running world refreshes several times
   *  a second, and a button redrawn under the pointer loses its click. */
  private parts: Record<HudPart, Phaser.GameObjects.GameObject[]> = { top: [], panel: [], progress: [], rest: [] };
  /** What each part last drew, so an unchanged part is left alone. */
  private drawn: Record<HudPart, string> = { top: "", panel: "", progress: "", rest: "" };
  /** The part keep() files new objects under. */
  private into: HudPart = "rest";
  /** Between create() and shutdown; a refresh outside it has nothing to draw into. */
  private live = false;
  private layout = { w: 0, h: 0 };
  /** Where buildBar put the command card, the selection paper and the console's ends. */
  private cardX = 0;
  private selX0 = 0;
  private selX1 = 0;
  private cy = 0;
  private barX1 = 0;
  /** The hovered command's tooltip, and the timer that will show it. */
  private tip: { parts: Phaser.GameObjects.GameObject[]; timer: Phaser.Time.TimerEvent | null } = { parts: [], timer: null };
  /** The message toast on screen, by the message it shows. */
  private toast: { id: number; box: Phaser.GameObjects.Container | null } = { id: -1, box: null };
  /** The last phase splashed, so a redraw never splashes it twice. */
  private splashed: string | null = null;
  private guideOpen = false;
  private menuOpen = false;
  /** The command card by hotkey, as last drawn. */
  private cardKeys = new Map<string, HudCommand>();
  /** Where buildSelection put the training queue's row, for its progress bar. */
  private queueRow: { x: number; y: number; w: number } | null = null;
  private guideTab: "guide" | "keys" = "guide";

  constructor() {
    super(HUD_KEY);
  }

  /** Read by label(): the HUD camera never zooms after create, and a resize rebuilds it. */
  get textRes(): number {
    return this.cameras.main.zoom;
  }

  init(data: HudData): void {
    this.hud = data;
  }

  preload(): void {
    loadPanels(this, ["woodTable", "paper", "blueButton", "redButton"]);
    this.load.image("hudSlot", packUrl("UI Elements/UI Elements/Wood Table/WoodTable_Slots.png"));
    this.load.image("sqBlue", packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Regular.png"));
    this.load.image("sqBlueDown", packUrl("UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Pressed.png"));
    this.load.image("swords", packUrl("UI Elements/UI Elements/Swords/Swords.png"));
    this.load.image("bigRibbons", packUrl("UI Elements/UI Elements/Ribbons/BigRibbons.png"));
    for (const n of new Set(Object.values(ICON))) this.load.image(iconKey(n), iconUrl(n));
    for (const side of ["a", "b"] as const) {
      for (const [cls, n] of Object.entries(KNIGHT_FACE[side])) {
        this.load.image(portraitKey(side, cls as UnitClass), packUrl(`${AVATARS.file}${String(n).padStart(2, "0")}.png`));
      }
    }
    for (const cls of ["warrior", "lancer", "archer"] as const) {
      const url = monsterAvatar(cls);
      if (url) this.load.image(portraitKey("m", cls), url);
    }
  }

  create(): void {
    this.cutFrames();
    // Origin 0 so HUD units map to canvas px times the map's base zoom from
    // the top left: the HUD scales with the screen as the map does.
    const zoom = baseZoom(this);
    const cam = this.cameras.main.setOrigin(0).setZoom(zoom);
    // Phaser snaps to whole screen pixels only at an integer zoom, and this one
    // rarely is, so every glyph straddled pixels and blurred. The HUD has no
    // tiles that could seam apart, so it always snaps.
    const preRender = cam.preRender.bind(cam);
    cam.preRender = (): void => {
      preRender();
      (cam as { renderRoundPixels: boolean }).renderRoundPixels = true;
    };
    // EXPAND resizes the canvas; a rebuild is the boring way to re-anchor.
    const rebuild = (): void => {
      this.scene.restart();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, rebuild);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, rebuild);
      this.live = false;
    });

    this.parts = { top: [], panel: [], progress: [], rest: [] };
    this.drawn = { top: "", panel: "", progress: "", rest: "" };
    this.tip = { parts: [], timer: null };
    // A resize destroys the toast with everything else; it shows again.
    this.toast = { id: -1, box: null };
    this.layout.w = this.scale.width / zoom;
    this.layout.h = this.scale.height / zoom;
    this.iconButton(34, HUD_TOP_H / 2, ICON.menu, "F10", () => this.toggleMenu());
    this.input.keyboard?.on("keydown-F10", (e: KeyboardEvent) => {
      e.preventDefault();
      if (!this.hud.model().report) this.toggleMenu();
    });
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || this.menuOpen || this.guideOpen) return;
      const cmd = this.cardKeys.get(e.key.toUpperCase());
      if (cmd && cmd.enabled !== false && !this.hud.model().report) cmd.onClick();
    });
    this.input.keyboard?.on("keydown-H", () => this.toggleGuide());
    this.input.keyboard?.on("keydown-ESC", () => (this.menuOpen ? this.toggleMenu() : this.guideOpen && this.toggleGuide()));
    this.buildBar();
    this.live = true;
    this.refresh();
  }

  private toggleGuide(): void {
    this.guideOpen = !this.guideOpen;
    this.drawn.rest = "";
    this.refresh();
  }

  /** The menu pauses the war while it is open; closing it leaves the war paused. */
  private toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) this.hud.onPause(true);
    this.drawn.rest = "";
    this.refresh();
  }

  /** Named frames over the loaded sheets, once per game. */
  private cutFrames(): void {
    const add = (key: string, name: string, x: number, y: number, w: number, h: number): void => {
      const t = this.textures.get(key);
      if (!t.has(name)) t.add(name, 0, x, y, w, h);
    };
    for (const k of ["sqBlue", "sqBlueDown"]) add(k, "ink", SQUARE.x, SQUARE.y, SQUARE.w, SQUARE.h);
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
    if (!this.live) return;
    const m = this.hud.model();
    // Functions drop out of the signature; what is drawn is all that is left.
    const part = (name: HudPart, shows: unknown, draw: () => void): void => {
      const sig = JSON.stringify(shows);
      if (sig === this.drawn[name]) return;
      this.drawn[name] = sig;
      for (const o of this.parts[name]) o.destroy();
      this.parts[name] = [];
      this.into = name;
      draw();
      this.into = "rest";
    };
    part("top", [m.gold, m.supply, m.clock, m.banner, m.pawns], () => this.buildTop(m));
    part("panel", [m.title, m.detail, m.portrait, m.hp, m.queue?.units], () => this.buildSelection(m));
    // Its own part, so the bar creeping on never redraws the queue under the pointer.
    part("progress", [m.queue?.progress, this.drawn.panel], () => this.buildProgress(m));
    part("rest", [m.commands, m.primary, m.report, this.guideOpen, this.guideTab, this.menuOpen], () => {
      this.hideTip();
      this.buildCommands(m);
      this.buildButtons(m);
      if (m.report) this.buildReport(m.report);
      if (this.guideOpen) this.buildGuide();
      if (this.menuOpen && !m.report) this.buildMenu();
    });
    this.showToast(m);
    if (!m.report && m.banner.text !== this.splashed) this.splash(m.banner);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.parts[this.into].push(o);
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
    // Papers run off the top edge, their ink ending at HUD_TOP_H, so the strips hang from it.
    const y = HUD_TOP_H / 2;
    const paper = (cx: number, pw: number): Phaser.GameObjects.NineSlice =>
      this.keep(
        panel(this, "paper", cx, (HUD_TOP_H + PAPER_FOOT - STRIP_UP) / 2, pw * 2, (HUD_TOP_H + PAPER_FOOT + STRIP_UP) * 2)
          .setScale(0.5)
          .setInteractive({ cursor: ARROW }),
      );
    if (m.banner.tone === "red") {
      const t = label(this, w / 2, y, m.banner.text, { ...INK, color: "#a12f2f", fontSize: "17px", fontStyle: "800" });
      paper(w / 2, t.width + 60);
      this.keep(t).setDepth(1);
    }

    // Resources, off the right edge too. Supply is used/cap, as Warcraft's food:
    // queued units count as used.
    const [used, cap] = m.supply;
    const items: [string | null, string, boolean][] = [
      [ICON.gold, String(m.gold), false],
      [ICON.meat, `${used}/${cap}`, used >= cap],
      [null, m.clock.text, m.clock.warn],
    ];
    const stripW = 310;
    const x0 = w - stripW;
    paper(x0 + (stripW + STRIP_UP) / 2, stripW + STRIP_UP);
    const at = [x0 + 30, x0 + 120, x0 + 188];
    items.forEach(([icon, value, warn], i) => {
      const x = at[i]!;
      if (icon) this.keep(this.add.image(x, y - 1, iconKey(icon)).setScale(0.48));
      this.keep(label(this, icon ? x + 20 : x, y, value, { ...INK, color: warn ? "#a12f2f" : INK.color, fontSize: i === 2 ? "14px" : "17px" }).setOrigin(0, 0.5));
    });

    // Warcraft's idle-worker button: only while a Pawn stands idle; a click selects them.
    const idle = m.pawns.idle;
    if (!idle) return;
    const bx = 90;
    const face = this.add.image(0, 0, "sqBlue", "ink").setDisplaySize(48, 48 * (SQUARE.h / SQUARE.w));
    const key = portraitKey("a", "pawn");
    const ink = this.inkOf(key);
    const art = this.add.image(0, -3, key).setScale(30 / Math.max(ink.w, ink.h));
    art.setOrigin((ink.x + ink.w / 2) / art.width, (ink.y + ink.h / 2) / art.height);
    const count = label(this, 14, 10, String(idle), { fontSize: "14px", fontStyle: "800" });
    const box = this.keep(this.add.container(bx, y, [face, art, count]).setSize(48, 48));
    box
      .setInteractive({ cursor: HAND })
      .on("pointerdown", () => box.setY(y + 2))
      .on("pointerout", () => box.setY(y))
      .on("pointerup", () => {
        box.setY(y);
        m.pawns.onIdle();
      });
  }

  private buildBar(): void {
    const { w, h } = this.layout;
    // Centred and running off the bottom edge; as
    // wide as the screen allows, up to where the parts sit comfortably.
    const half = Math.max(w / 4, Math.min(w / 2 - 8, 320));
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

    // No minimap: the island is small enough that zooming out shows it all.
    const zx = x0 + 34;
    this.squareButton(zx, cy - 25, 42, "+", () => this.hud.onZoom(-1));
    this.squareButton(zx, cy + 23, 42, "-", () => this.hud.onZoom(1));

    this.cardX = x1 - 14 - CARD_W;
    this.selX0 = zx + 28;
    this.selX1 = this.cardX - 10;
    this.cy = cy;
    this.barX1 = x1;
    // The resource strip's paper, which reads cleaner than the banner slots.
    panel(this, "paper", (this.selX0 + this.selX1) / 2, cy, (this.selX1 - this.selX0) * 2, 136 * 2).setScale(0.5);
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
    this.queueRow = null;
    if (m.queue) {
      this.buildQueue(m.queue, x, y);
      y += QUEUE_SLOT + 12;
    }
    this.keep(label(this, x, y, m.detail, { ...INK, fontSize: "12px", fontStyle: "500", ...wrap }).setOrigin(0, 0));
  }

  /** The queue's sockets, front first; the last queued unit is the one a click takes off. */
  private buildQueue(q: NonNullable<HudModel["queue"]>, x: number, y: number): void {
    const n = WAR.realtime.queue;
    for (let i = 0; i < n; i++) {
      const cx = x + i * (QUEUE_SLOT + 4) + QUEUE_SLOT / 2;
      const cy = y + QUEUE_SLOT / 2;
      const slot = this.keep(this.add.image(cx, cy, "hudSlot").setDisplaySize(QUEUE_SLOT, QUEUE_SLOT));
      const unit = q.units[i];
      if (!unit) {
        slot.setAlpha(0.45);
        continue;
      }
      const face = this.keep(this.add.image(cx, cy, unit.portrait));
      face.setScale((QUEUE_SLOT - 8) / Math.max(face.width, face.height));
      if (i !== q.units.length - 1) continue;
      face
        .setInteractive({ cursor: HAND })
        .on("pointerover", () => {
          face.setTint(0xff9a8a);
          this.queueTip({ label: `Cancel ${unit.name}`, hint: "Take it off the queue, gold back.", onClick: q.cancel }, cx);
        })
        .on("pointerout", () => {
          face.clearTint();
          this.hideTip();
        })
        .on("pointerup", () => {
          // The redraw destroys this face before the pointer ever leaves it.
          this.hideTip();
          q.cancel();
        });
    }
    this.queueRow = { x, y: y + QUEUE_SLOT + 4, w: n * (QUEUE_SLOT + 4) - 4 };
  }

  /** The front unit's training bar, under the queue's row. */
  private buildProgress(m: HudModel): void {
    const r = this.queueRow;
    if (!m.queue || !r) return;
    const g = this.keep(this.add.graphics());
    g.fillStyle(0x3a2a1c).fillRoundedRect(r.x, r.y, r.w, 6, 2);
    const frac = Math.max(0, Math.min(1, m.queue.progress));
    if (frac > 0) g.fillStyle(0x6cc24a).fillRoundedRect(r.x + 1, r.y + 1, Math.max(3, (r.w - 2) * frac), 4, 2);
  }

  private buildCommands(m: HudModel): void {
    const rows = m.commands.length === 6 ? 2 : 3;
    // Three rows fill the console's height; two leave room to grow into the card's width.
    const pitch = rows === 3 ? CELL : CARD_W / 3;
    const btn = pitch - (CELL - BTN);
    const x0 = this.cardX + (CARD_W - 3 * pitch) / 2;
    const y0 = this.cy - (rows * pitch) / 2;
    // A big command in the first slot takes the card's top-left 2x2 block.
    const big = rows === 3 && m.commands[0]?.big ? m.commands[0] : null;
    this.cardKeys.clear();
    if (big) this.keep(this.commandButton(x0 + pitch, y0 + pitch, big, 2 * pitch - 4, undefined, GRID[0]));
    for (let i = 0; i < rows * 3; i++) {
      if (big && [0, 1, 3, 4].includes(i)) continue;
      const x = x0 + (i % 3) * pitch + pitch / 2;
      const y = y0 + Math.floor(i / 3) * pitch + pitch / 2;
      const cmd = m.commands[i] ?? null;
      if (!cmd) {
        // A blank key sunk into the board. Opaque: at partial alpha the plank seams showed through.
        this.keep(this.add.image(x, y + 2, "sqBlueDown", "ink").setDisplaySize(btn, btn * (SQUARE.h / SQUARE.w)).setTint(0x7a5f52));
        continue;
      }
      this.keep(this.commandButton(x, y, cmd, btn, undefined, GRID[i]));
    }
  }

  private commandButton(x: number, y: number, cmd: HudCommand, size = BTN, tipAt?: number, key?: string): Phaser.GameObjects.Container {
    if (key) this.cardKeys.set(key, cmd);
    const on = cmd.enabled !== false;
    const face = this.add.image(0, 0, "sqBlue", "ink").setDisplaySize(size, size * (SQUARE.h / SQUARE.w));
    const parts: Phaser.GameObjects.GameObject[] = [face];
    // Everything stays on the blue face, inside the white rim and the bevel.
    const px = size / SQUARE.w;
    const x0 = (FACE.x - SQUARE.w / 2) * px + 2;
    const x1 = (FACE.x + FACE.w - SQUARE.w / 2) * px - 2;
    const y0 = (FACE.y - SQUARE.h / 2) * px + 2;
    // The hotkey gets its own row at the top, so no label or picture runs under it.
    const top = key ? y0 + 9 : y0;
    const y1 = (FACE.y + FACE.h - SQUARE.h / 2) * px - 2;
    // A smaller font rather than a scale, which would blur the glyphs.
    const fit = (t: Phaser.GameObjects.Text): Phaser.GameObjects.Text => {
      for (let px = parseFloat(String(t.style.fontSize)); (t.width > x1 - x0 || t.height > y1 - top) && px > 7; ) t.setFontSize(--px);
      return t;
    };
    const k = size / BTN;
    const small = `${Math.round(10 * Math.min(k, 1.3))}px`;
    const picture = cmd.portrait && this.textures.exists(cmd.portrait) ? cmd.portrait : cmd.icon ? iconKey(cmd.icon) : null;
    if (!picture) {
      parts.push(fit(label(this, 0, (top + y1) / 2, cmd.label, { fontSize: cmd.label.length > 6 ? "11px" : "13px", wordWrap: { width: x1 - x0 }, align: "center" })));
    } else {
      // The name, and a troop's price under it, stacked up from the face's bottom.
      const lines = [label(this, 0, 0, cmd.label, { fontSize: cmd.big ? "14px" : small, strokeThickness: 3 })];
      if (cmd.big && cmd.sub) lines.push(label(this, 0, 0, cmd.sub, { fontSize: "11px", color: "#ffe28a", strokeThickness: 3 }));
      let bottom = y1;
      for (const t of lines.reverse()) {
        fit(t).setOrigin(0.5, 1).setY(bottom);
        bottom -= t.displayHeight - 3;
      }
      // The picture in what is left, fitted by its ink rather than its padded frame.
      const ink = this.inkOf(picture);
      const room = Math.min((x1 - x0) / ink.w, (bottom - top) / ink.h);
      const art = this.add.image(0, (top + bottom) / 2, picture).setScale(cmd.icon && !cmd.portrait ? Math.min(room, 0.4 * k) : room);
      art.setOrigin((ink.x + ink.w / 2) / art.width, (ink.y + ink.h / 2) / art.height);
      parts.push(art, ...lines);
    }
    // The hotkey in the face's top-left corner, gold like Warcraft's.
    if (key) parts.push(label(this, x0 + 1, y0, key, { fontSize: "10px", fontStyle: "800", color: "#ffe28a", strokeThickness: 2 }).setOrigin(0, 0));
    const box = this.add.container(x, y, parts).setSize(size, size);
    if (!on) {
      face.setTint(0x8a8f96);
      for (const p of parts.slice(1)) (p as Phaser.GameObjects.Image).setAlpha(0.5);
    }
    box
      .setInteractive({ cursor: on ? HAND : ARROW })
      .on("pointerover", () => this.queueTip(cmd, tipAt))
      .on("pointerout", () => {
        this.hideTip();
        box.setY(y);
      })
      .on("pointerdown", () => {
        if (!on) return;
        box.setY(y + 2);
        face.setTexture("sqBlueDown", "ink").setDisplaySize(size, size * (SQUARE.h / SQUARE.w));
      })
      .on("pointerup", () => {
        box.setY(y);
        if (on) cmd.onClick();
      });
    return box;
  }

  private buildButtons(m: HudModel): void {
    const y = this.layout.h - BAR_H - 34;
    if (m.primary) this.keep(this.swordButton(this.barX1 - 110, y, 210, m.primary.label, m.primary.onClick));
  }

  /** The menu over a veil: the war waits while it is open. */
  private buildMenu(): void {
    const { w, h } = this.layout;
    const pw = 260;
    const ph = 250;
    const cx = w / 2;
    const cy = Math.min(h / 2, (h - BAR_H) / 2 + 40);
    const top = cy - ph / 2;
    this.keep(this.add.rectangle(cx, h / 2, w, h, 0x0b1620, 0.45).setDepth(50).setInteractive({ cursor: ARROW }).on("pointerup", () => this.toggleMenu()));
    this.keep(panel(this, "paper", cx, cy, pw * 2, ph * 2).setScale(0.5).setDepth(51).setInteractive({ cursor: ARROW }));
    const title = label(this, 0, -6, "Menu", { fontSize: "20px" });
    const rib = this.keep(this.strip("bigRibbons", ["blue_left", "blue_mid", "blue_right"], cx, top + 8, Math.max(220, title.width + 130), 0.5)).setDepth(52);
    rib.add(title);
    const items: [string, "blue" | "red", () => void][] = [
      ["Resume", "blue", () => {
        this.toggleMenu();
        this.hud.onPause(false);
      }],
      ["Field guide", "blue", () => {
        this.toggleMenu();
        this.toggleGuide();
      }],
      ["Leave the war", "red", () => this.hud.onLeave()],
    ];
    items.forEach(([name, tone, onClick], i) => {
      this.keep(button(this, cx, top + 78 + i * 62, 190, 54, name, tone, onClick, 0.5)).setDepth(52);
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
      this.keep(button(this, w / 2 - 85, by, 150, 54, r.button, "blue", r.onClick, 0.5));
      this.keep(button(this, w / 2 + 85, by, 150, 54, r.also.label, "red", r.also.onClick, 0.5));
    } else {
      this.keep(button(this, w / 2, by, 170, 54, r.button, "blue", r.onClick, 0.5));
    }
  }

  /** The box around a texture's opaque pixels, measured once per texture. */
  private inkOf(key: string): { x: number; y: number; w: number; h: number } {
    const known = INK_BOX.get(key);
    if (known) return known;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(src, 0, 0);
    const { data } = ctx.getImageData(0, 0, src.width, src.height);
    let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (data[(y * src.width + x) * 4 + 3]! < 16) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    const box = x1 < x0 ? { x: 0, y: 0, w: src.width, h: src.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    INK_BOX.set(key, box);
    return box;
  }

  /** `at`: the x the tip centres over; beside the command card when left out. */
  private queueTip(cmd: HudCommand, at?: number): void {
    this.hideTip();
    this.tip.timer = this.time.delayedCall(TIP_DELAY, () => this.showTip(cmd, at));
  }

  private hideTip(): void {
    this.tip.timer?.remove();
    for (const o of this.tip.parts) o.destroy();
    this.tip = { parts: [], timer: null };
  }

  /** A paper card over the command card: the command, its price, what it does. */
  private showTip(cmd: HudCommand, at?: number): void {
    const tw = 290;
    const pad = 18;
    const key = [...this.cardKeys].find(([, c]) => c === cmd)?.[0];
    const name = `${cmd.label}${key ? ` [${key}]` : ""}`;
    const title = label(this, 0, 0, cmd.sub ? `${name} (${cmd.sub})` : name, { ...INK, fontSize: "16px", fontStyle: "800" }).setOrigin(0, 0);
    const body = label(this, 0, 0, cmd.hint, { ...INK, fontSize: "13px", fontStyle: "500", wordWrap: { width: tw - 2 * pad }, lineSpacing: 2 }).setOrigin(0, 0);
    const th = Math.max(64, pad + title.height + 6 + body.height + pad);
    const x = at === undefined ? this.barX1 - 10 - tw : Math.max(8, Math.min(this.layout.w - 8 - tw, at - tw / 2));
    const y = this.cy - 1.5 * CELL - 12 - th;
    const paper = panel(this, "paper", x + tw / 2, y + th / 2, tw * 2, th * 2).setScale(0.5);
    title.setPosition(x + pad, y + pad);
    body.setPosition(x + pad, y + pad + title.height + 6);
    const box = this.add.container(0, 6, [paper, title, body]).setDepth(40).setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, y: 0, duration: 140, ease: "Sine.easeOut" });
    this.tip.parts = [box];
  }

  /** The message on a paper slip under the header, gone after a few seconds. */
  private showToast(m: HudModel): void {
    if (m.messageId === this.toast.id) return;
    if (this.toast.box) {
      this.tweens.killTweensOf(this.toast.box);
      this.toast.box.destroy();
    }
    this.toast = { id: m.messageId, box: null };
    if (!m.message) return;
    const { w } = this.layout;
    const text = label(this, 0, 0, m.message, { ...INK, fontSize: "15px", fontStyle: "700", wordWrap: { width: Math.min(520, w - 80) }, align: "center" });
    const ph = Math.max(64, text.height + 30);
    const paper = panel(this, "paper", 0, 0, (text.width + 60) * 2, ph * 2).setScale(0.5);
    const y = HUD_TOP_H + 8 + ph / 2;
    const box = this.add.container(w / 2, y - 8, [paper, text]).setDepth(30).setAlpha(0);
    this.toast.box = box;
    this.tweens.add({ targets: box, alpha: 1, y, duration: 180, ease: "Sine.easeOut" });
    this.tweens.add({ targets: box, alpha: 0, delay: TOAST_MS, duration: 400, onComplete: () => box.destroy() });
  }

  /** The phase just begun, large and brief over the middle of the map. */
  private splash(b: HudModel["banner"]): void {
    // The opening clouds already announce the first phase.
    const first = this.splashed === null;
    this.splashed = b.text;
    if (first) return;
    const { w, h } = this.layout;
    const text = label(this, 0, -8, b.text, { fontSize: "30px" });
    const rib = this.strip("bigRibbons", [`${b.tone}_left`, `${b.tone}_mid`, `${b.tone}_right`], 0, 0, Math.max(360, text.width + 180), 0.8);
    rib.add(text);
    const y = (h - BAR_H) / 2 - 20;
    const box = this.add.container(w / 2, y, [rib]).setDepth(35).setAlpha(0).setScale(0.85);
    this.tweens.chain({
      targets: box,
      tweens: [
        { alpha: 1, scale: 1, duration: 240, ease: "Back.easeOut" },
        { alpha: 0, y: y - 16, delay: 1100, duration: 350, ease: "Sine.easeIn", onComplete: () => box.destroy() },
      ],
    });
  }

  /** How the war runs and the troops, or every shortcut, over a veil. */
  private buildGuide(): void {
    const { w, h } = this.layout;
    const pw = Math.min(840, w - 40);
    const ph = Math.min(480, h - 60);
    const cx = w / 2;
    const cy = h / 2;
    const top = cy - ph / 2;
    this.keep(this.add.rectangle(cx, cy, w, h, 0x0b1620, 0.45).setDepth(50).setInteractive({ cursor: ARROW }).on("pointerup", () => this.toggleGuide()));
    this.keep(panel(this, "paper", cx, cy, pw * 2, ph * 2).setScale(0.5).setDepth(51).setInteractive({ cursor: ARROW }));
    const title = label(this, 0, -6, "Field guide", { fontSize: "20px" });
    const rib = this.keep(this.strip("bigRibbons", ["blue_left", "blue_mid", "blue_right"], cx, top + 8, Math.max(260, title.width + 130), 0.5)).setDepth(52);
    rib.add(title);

    // The tabs: the one showing in full colour, the other a muted key. Opaque:
    // alpha on the container faded each overlapping slice apart into stripes.
    const tabs = [["guide", "Guide"], ["keys", "Shortcuts"]] as const;
    tabs.forEach(([tab, name], i) => {
      const b = button(this, cx + (i - 0.5) * 140, top + 62, 130, 54, name, "blue", () => {
        this.guideTab = tab;
        this.refresh();
      }, 0.5);
      this.keep(b).setDepth(52);
      if (this.guideTab !== tab) {
        (b.list[0] as Phaser.GameObjects.NineSlice).setTint(0x9aa4aa);
        (b.list[1] as Phaser.GameObjects.Text).setColor("#e4e8ea").setStroke("#4a5560", 3);
      }
    });

    const y0 = top + 104;
    const sections = this.guideTab === "guide" ? guideSections() : shortcutSections();
    const colW = (pw - 80) / sections.length;
    sections.forEach((sec, i) => {
      const x = cx - pw / 2 + 40 + i * colW;
      let y = y0;
      y += this.keep(label(this, x, y, sec.head, { ...INK, fontSize: "17px", fontStyle: "800" }).setOrigin(0, 0).setDepth(52)).height + 8;
      for (const line of sec.lines) {
        if (typeof line === "string") {
          const t = this.keep(label(this, x, y, line, { ...INK, fontSize: "13px", fontStyle: "500", wordWrap: { width: colW - 20 }, lineSpacing: 1 }).setOrigin(0, 0).setDepth(52));
          y += t.height + 7;
          continue;
        }
        // A shortcut: its keys in a fixed column, what they do beside them.
        const [keys, does] = line;
        const k = this.keep(label(this, x, y, keys, { ...INK, fontSize: "13px", fontStyle: "800", wordWrap: { width: 120 } }).setOrigin(0, 0).setDepth(52));
        const d = this.keep(label(this, x + 130, y, does, { ...INK, fontSize: "13px", fontStyle: "500", wordWrap: { width: colW - 150 } }).setOrigin(0, 0).setDepth(52));
        y += Math.max(k.height, d.height) + 7;
      }
    });

    const by = top + ph - 44;
    this.keep(button(this, cx, by, 150, 54, "Close", "blue", () => this.toggleGuide(), 0.5)).setDepth(52);
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

  private iconButton(x: number, y: number, icon: string, key: string, onClick: () => void): void {
    const face = this.add.image(0, 0, "sqBlue", "ink").setDisplaySize(48, 48 * (SQUARE.h / SQUARE.w));
    // Nudged down and in to leave the hotkey its corner.
    const mark = this.add.image(3, 4, iconKey(icon)).setScale(0.38);
    const hint = label(this, -17, -18, key, { fontSize: "9px", fontStyle: "800", color: "#ffe28a", strokeThickness: 2 }).setOrigin(0, 0);
    const box = this.add.container(x, y, [face, mark, hint]).setSize(48, 48);
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

const TROOP: Record<UnitClass, string> = { pawn: "Pawn", warrior: "Warrior", lancer: "Lancer", archer: "Archer", monk: "Monk" };
const TRAINED_AT: Record<string, string> = { castle: "castle", barracks: "barracks", archery: "archery range", tower: "tower", monastery: "monastery" };

type GuideSection = { head: string; lines: (string | [keys: string, does: string])[] };

/** The guide tab's columns, its numbers read off the balance so they never drift. */
function guideSections(): GuideSection[] {
  const troops = Object.entries(WAR.trains).filter(([, cls]) => cls !== "pawn").map(([at, cls]) => {
    const beats = BALANCE.counters[cls!];
    const does =
      cls === "monk"
        ? "heals the troops around it."
        : cls === "archer"
          ? `shoots ${WAR.range.archer} tiles, up and down cliffs, and beats ${TROOP[beats!]}s.`
          : `beats ${TROOP[beats!]}s.`;
    return `${TROOP[cls!]}, from the ${TRAINED_AT[at]}: ${does}`;
  });
  return [
    {
      head: "The war",
      lines: [
        "The world never stops unless you pause it: Space, or open the menu. Orders still go out while paused.",
        "Train at your buildings and have a Pawn put up new ones. Orders go out at once.",
        `Gold: Pawns dig at the mines and carry ${WAR.realtime.carry} home a trip.`,
        `From minute ${WAR.realtime.monsters.firstSeconds / 60}, monsters come down from the Crown every minute, more each time, and go for whoever is nearest. Each kill pays ${WAR.realtime.monsters.bounty} gold.`,
      ],
    },
    {
      head: "Troops",
      lines: [
        ...troops,
        `Pawns, from the castle, dig gold and build, up to ${WAR.pawns.max}. They never fight, and the dead stay dead.`,
        `A counter deals ${Math.round(BALANCE.counterBonus * 100)}% more damage. Troops on the lowland deal ${Math.round(WAR.highGround * 100)}% to a plateau.`,
        `Each house adds ${WAR.supply.perHouse} supply; every unit takes 1.`,
      ],
    },
  ];
}

/** The shortcuts tab: every binding StrategicScene and this HUD listen for. */
function shortcutSections(): GuideSection[] {
  return [
    {
      head: "Mouse",
      lines: [
        ["Click", "Select a unit or building"],
        ["Drag", "Box your units"],
        ["Shift + click", "Add to or drop from the selection"],
        ["Double click", "Every unit of that kind on screen (or Ctrl + click)"],
        ["Right click", "Move, attack, or dig at a mine; fighters fight on the way"],
        ["Right click", "With a building selected: its rally point"],
        ["Middle drag", "Pan the map"],
        ["Wheel", "Zoom in and out"],
        ["Touch", "Drag to pan, tap to order"],
      ],
    },
    {
      head: "Keyboard",
      lines: [
        ["F1", "Select all your Pawns"],
        ["F2", "Select your whole army"],
        ["Q W E, A S D, Z X C", "The command card's buttons, by position"],
        ["Ctrl + 1-9", "Set a control group"],
        ["1-9", "Recall a control group"],
        ["Space", "Pause and resume"],
        ["Esc", "Cancel placing a building, let go of the selection"],
        ["Arrow keys", "Pan the map (or the screen edge)"],
        ["H", "Open and close this guide"],
        ["F10", "Open and close the menu"],
      ],
    },
  ];
}
